import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = '/tmp/docker-cache-dir';

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
    const digests = await Promise.all(images.map(getDigest));
    const hash = digests.join('-').replace(/sha256:/g, '').substring(0, 100);
    const cacheKey = `${process.env.RUNNER_OS}-docker-cache-${hash}`;

    core.saveState('cache_key', cacheKey);
    core.saveState('images_list', imagesInput);

    if (await cache.restoreCache([CACHE_DIR], cacheKey)) {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      for (const img of images) {
        const tar = path.join(CACHE_DIR, `${img.replace(/[^a-z0-9]/gi, '_')}.tar`);
        if (fs.existsSync(tar)) await exec.exec('docker', ['load', '-i', tar]);
      }
    }
  } catch (e: any) {
    core.setFailed(e.message);
  }
}

run();