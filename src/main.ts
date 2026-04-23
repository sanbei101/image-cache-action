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

    for (const img of images) {
      const digest = await getDigest(img);
      const hash = digest.replace(/sha256:/g, '').substring(0, 64);
      const safeName = img.replace(/[^a-z0-9]/gi, '_');
      
      const cacheKey = `${process.env.RUNNER_OS}-docker-${safeName}-${hash}`;
      const imgDir = path.join(CACHE_BASE, safeName);
      const tarPath = path.join(imgDir, 'image.tar');

      await io.mkdirP(imgDir);
      const hitKey = await cache.restoreCache([imgDir], cacheKey);

      if (hitKey) {
        core.info(`✅ Hit: ${img}`);
        if (fs.existsSync(tarPath)) await exec.exec('docker', ['load', '-i', tarPath]);
        states.push({ image: img, key: cacheKey, dir: imgDir, hit: true });
      } else {
        core.info(`❌ Miss: ${img}, pulling...`);
        await exec.exec('docker', ['pull', img]);
        states.push({ image: img, key: cacheKey, dir: imgDir, hit: false });
      }
    }
    
    core.saveState('image_states', JSON.stringify(states));
  } catch (e: any) {
    core.setFailed(e.message);
  }
}

run();