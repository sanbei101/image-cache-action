# Docker 镜像缓存 GitHub Action

跨 workflow 缓存 Docker 镜像,加速依赖大型镜像的 CI/CD 流程。

## 使用方法

```yaml
- name: 缓存 Docker 镜像
  uses: sanbei101/image-cache-action@v1
  with:
    images: |
      nginx:latest
      redis:alpine
      myregistry.com/myimage:v1.2.3
```

## 工作原理

1. **主步骤 (main.ts)**:获取镜像摘要,尝试从缓存恢复已存在的 tar 文件并 load
2. **后置步骤 (post.ts)**:将镜像保存为 tar 文件,上传至 GitHub Actions 缓存

缓存 key 由系统平台和镜像摘要组成,任意镜像变化都会使缓存失效。

## 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `images` | 要缓存的镜像列表,每行一个 | 是 |

## 完整示例

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 检出代码
        uses: actions/checkout@v6

      - name: 设置 Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: 登录容器仓库(可选,私有镜像需要)
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 缓存 Docker 镜像
        uses: sanbei101/image-sync-action@v1
        with:
          images: |
            ubuntu:latest

      - name: 构建
        run: docker build -t app .
```

### 注意事项:
- 仅支持`Linux`