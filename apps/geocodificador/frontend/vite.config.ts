import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, la API, la autenticación y la página de login se piden al gateway (docker compose up)
const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8088";

export default defineConfig({
  base: "/geocodificador/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: { "/api": GATEWAY, "/auth": GATEWAY, "/login": GATEWAY, "/assets": GATEWAY },
  },
});
