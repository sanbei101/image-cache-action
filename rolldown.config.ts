import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/main.ts",
    output: {
      file: "dist/main.js",
      format: "esm",
      sourcemap: false,
      minify: true,
      minifyInternalExports: true,
    },
    platform: "node",
  },
  {
    input: "src/post.ts",
    output: {
      file: "dist/post.js",
      format: "esm",
      sourcemap: false,
      minify: true,
      minifyInternalExports: true,
    },
    platform: "node",
  },
]);
