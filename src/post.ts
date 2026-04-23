import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  try {
    const stateStr = core.getState('image_states');
    if (!stateStr) return;

    const states = JSON.parse(stateStr);

    for (const state of states) {
      if (state.hit) continue; 

      core.info(`💾 Saving: ${state.image}`);
      const tarPath = path.join(state.dir, 'image.tar');

      try {
        await exec.exec('docker', ['save', '-o', tarPath, state.image]);
        if (fs.existsSync(tarPath)) {
          await cache.saveCache([state.dir], state.key);
        }
      } catch {}
    }
  } catch (e: any) {
    core.warning(e.message);
  }
}

run();