import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_BASE = '/tmp/smart-docker-cache';

async function getDigest(image: string): Promise<string> {
  let stdout = '';
  try {
    await exec.exec('bash', [
      '-c',
      `skopeo inspect --override-os linux --override-arch amd64 --no-tags docker://${image} | jq -r '.Digest'`
    ], {
      silent: true,
      listeners: { stdout: (data) => { stdout += data.toString(); } }
    });
    const digest = stdout.trim();
    if (digest) return digest;
    return image;
  } catch {
    return image;
  }
}

async function processImage(img: string) {
  const t0 = Date.now();
  const digest = await getDigest(img);
  const digestTime = Date.now() - t0;

  const hash = digest.replace(/sha256:/g, '').substring(0, 64);
  const safeName = img.replace(/[^a-z0-9]/gi, '_');

  const cacheKey = `${process.env.RUNNER_OS}-docker-${safeName}-${hash}`;
  const imgDir = path.join(CACHE_BASE, safeName);
  const tarPath = path.join(imgDir, 'image.tar');

  await io.mkdirP(imgDir);
  const t1 = Date.now();
  const hitKey = await cache.restoreCache([imgDir], cacheKey);
  const cacheTime = Date.now() - t1;

  if (hitKey) {
    const t2 = Date.now();
    core.info(`✅ Hit: ${img} (digest: ${digestTime}ms, cache: ${cacheTime}ms)`);
    if (fs.existsSync(tarPath)) await exec.exec('docker', ['load', '-i', tarPath]);
    const loadTime = Date.now() - t2;
    core.info(`   docker load: ${loadTime}ms`);
    return { image: img, key: cacheKey, dir: imgDir, hit: true, totalTime: Date.now() - t0 };
  } else {
    const t2 = Date.now();
    core.info(`❌ Miss: ${img}, pulling... (digest: ${digestTime}ms, cache: ${cacheTime}ms)`);
    await exec.exec('docker', ['pull', img]);
    const pullTime = Date.now() - t2;
    core.info(`   docker pull: ${pullTime}ms`);
    return { image: img, key: cacheKey, dir: imgDir, hit: false, totalTime: Date.now() - t0 };
  }
}

async function run() {
  try {
    const imagesInput = core.getInput('images');
    const images = imagesInput.split(/\r?\n/).map(i => i.trim()).filter(Boolean);

    const startTime = Date.now();
    const states = await Promise.all(images.map(processImage));
    const totalTime = Date.now() - startTime;

    const hitCount = states.filter(s => s.hit).length;
    core.info(`\n✅ Cache hits: ${hitCount}/${images.length}, total time: ${totalTime}ms`);

    core.saveState('image_states', JSON.stringify(states));
  } catch (e: any) {
    core.setFailed(e.message);
  }
}

run();