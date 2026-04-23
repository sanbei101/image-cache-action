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
    await exec.exec('skopeo', ['inspect', '--override-os', 'linux', `docker://${image}`], {
      silent: true,
      listeners: { stdout: (data) => { stdout += data.toString(); } }
    });
    return JSON.parse(stdout).Digest;
  } catch {
    return image;
  }
}

async function run() {
  try {
    const imagesInput = core.getInput('images');
    const images = imagesInput.split(/\r?\n/).map(i => i.trim()).filter(Boolean);
    const states = [];

    const startTime = Date.now();
    for (const img of images) {
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
        states.push({ image: img, key: cacheKey, dir: imgDir, hit: true });
      } else {
        const t2 = Date.now();
        core.info(`❌ Miss: ${img}, pulling... (digest: ${digestTime}ms, cache: ${cacheTime}ms)`);
        await exec.exec('docker', ['pull', img]);
        const pullTime = Date.now() - t2;
        core.info(`   docker pull: ${pullTime}ms`);
        states.push({ image: img, key: cacheKey, dir: imgDir, hit: false });
      }
    }
    core.info(`Total time: ${Date.now() - startTime}ms`);
    
    core.saveState('image_states', JSON.stringify(states));
  } catch (e: any) {
    core.setFailed(e.message);
  }
}

run();