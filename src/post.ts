import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as fs from 'fs';
import * as path from 'path';

async function saveImage(state: any) {
  if (state.hit) return null;

  const t0 = Date.now();
  core.info(`💾 Saving: ${state.image}`);
  const tarPath = path.join(state.dir, 'image.tar');

  try {
    await exec.exec('docker', ['save', '-o', tarPath, state.image]);
    const saveTime = Date.now() - t0;

    if (fs.existsSync(tarPath)) {
      const t1 = Date.now();
      await cache.saveCache([state.dir], state.key);
      const uploadTime = Date.now() - t1;
      core.info(`   docker save: ${saveTime}ms, cache upload: ${uploadTime}ms`);
      return saveTime + uploadTime;
    }
  } catch {}
  return null;
}

async function run() {
  try {
    const stateStr = core.getState('image_states');
    if (!stateStr) return;

    const states = JSON.parse(stateStr);
    const results = await Promise.all(states.map(saveImage));
    const totalSaveTime = results.reduce((sum, t) => sum + (t || 0), 0);

    if (totalSaveTime > 0) core.info(`Total save time: ${totalSaveTime}ms (parallel)`);
  } catch (e: any) {
    core.warning(e.message);
  }
}

run();