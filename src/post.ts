import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = '/tmp/docker-cache-dir';

async function run() {
  try {
    const cacheKey = core.getState('cache_key');
    const imagesInput = core.getState('images_list');
    
    if (!cacheKey || !imagesInput) return;

    await io.mkdirP(CACHE_DIR);
    const images = imagesInput.split(/\r?\n/).map(i => i.trim()).filter(Boolean);

    for (const img of images) {
      const tar = path.join(CACHE_DIR, `${img.replace(/[^a-z0-9]/gi, '_')}.tar`);
      try {
        await exec.exec('docker', ['save', '-o', tar, img]);
      } catch {}
    }
    if (fs.readdirSync(CACHE_DIR).length > 0) {
      await cache.saveCache([CACHE_DIR], cacheKey);
    }
  } catch {}
}

run();