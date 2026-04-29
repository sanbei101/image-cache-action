import * as core from '@actions/core';
import * as exec from '@actions/exec';

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
  const cacheKey = `${process.env.RUNNER_OS}-docker-${hash}`;
  
  const githubRepo = (process.env.GITHUB_REPOSITORY || '').toLowerCase();
  const safeImageName = img.replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
  const targetImage = `ghcr.io/${githubRepo}/imagecache/${safeImageName}:${cacheKey}`;

  try {
    const t1 = Date.now();
    await exec.exec('docker', ['pull', targetImage]);
    const cacheTime = Date.now() - t1;
    
    // 重命名回原本的镜像名称以便给后续步骤使用
    await exec.exec('docker', ['tag', targetImage, img]);
    core.info(`✅ Hit: ${img} (digest: ${digestTime}ms, pull cache: ${cacheTime}ms)`);
    
    return { image: img, key: cacheKey, hit: true };
  } catch {
    // 拉取失败说明没有缓存,开始拉取原始镜像
    const t2 = Date.now();
    core.info(`❌ Miss: ${img}, pulling original image...`);
    await exec.exec('docker', ['pull', img]);
    const pullTime = Date.now() - t2;
    core.info(`   docker pull: ${pullTime}ms`);
    
    return { image: img, key: cacheKey, hit: false };
  }
}

async function run() {
  try {
    const imagesInput = core.getInput('images');
    const token = core.getInput('github_token');
    
    if (token) {
      core.info('🔑 Logging into ghcr.io...');
      const actor = process.env.GITHUB_ACTOR || 'metadata';
      await exec.exec('docker', ['login', 'ghcr.io', '-u', actor, '--password-stdin'], {
        input: Buffer.from(token)
      });
    }

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