import { defineConfig } from "vite";

// three.js addons import "three": point them at the WebGPU build, so that one copy of three.js runs.
export default defineConfig({
  resolve: { alias: [{ find: /^three$/, replacement: "three/webgpu" }] },
});
