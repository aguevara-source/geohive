import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8088";

// Dos páginas: el portal (/) y el inicio de sesión (/login/)
export default defineConfig({
  // En GitHub Pages el sitio vive en /<repositorio>/ (ver .github/workflows/pages.yml)
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { portal: resolve(__dirname, "index.html"), login: resolve(__dirname, "login/index.html") },
    },
  },
  server: { port: 5173, strictPort: true, proxy: { "/auth": GATEWAY } },
});
