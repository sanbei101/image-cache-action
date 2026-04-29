import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function saveImage(state: any) {
  if (state.hit) return null;

  const t0 = Date.now();
  core.info(`🚀 Pushing to GHCR cache: ${state.image}`);

  const githubRepo = (process.env.GITHUB_REPOSITORY || '').toLowerCase();
  const safeImageName = state.image.replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
  
  const targetImage = `ghcr.io/${githubRepo}/imagecache/${safeImageName}:${state.key}`;

  try {
    await exec.exec('docker', ['tag', state.image, targetImage]);
    await exec.exec('docker', ['push', targetImage]);
    
    const pushTime = Date.now() - t0;
    core.info(`   docker push: ${pushTime}ms`);
    return pushTime;
  } catch (e: any) {
    core.warning(`Failed to push image to cache: ${e.message}`);
  }
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