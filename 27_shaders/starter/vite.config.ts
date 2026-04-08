import { defineConfig } from "vite";

export default defineConfig({
  root: "src/", // Sources files (where index.html is)
  publicDir: "../static/", // Static assets
  server: {
    host: true, // Open to local network
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    open: true,
  },
  // Optional: better TSL + GLSL support
  plugins: [],
});
