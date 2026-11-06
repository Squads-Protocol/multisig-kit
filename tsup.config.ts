import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  target: "es2022",
  splitting: false,
  treeshake: true,
  // The Codama error module reads process.env.NODE_ENV at import time, which throws in a browser
  // without a bundler. Pin it so the readable program error messages always ship.
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
