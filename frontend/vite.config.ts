import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Backend (FastAPI) origin reachable from THIS dev machine. The browser never
// talks to it directly — Vite proxies /api to it — so it stays "localhost" even
// when the page is opened from a Quest over the LAN.
const BACKEND = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

export default defineConfig({
  // HTTPS is required for WebXR over the LAN: http://<ip> is not a secure
  // context, so navigator.xr is undefined on the headset. (Self-signed cert —
  // the Quest browser will show a one-time warning to accept.)
  plugins: [basicSsl()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
});
