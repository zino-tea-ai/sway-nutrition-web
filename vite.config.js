import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cutoutApiPlugin } from "./server/cutout-api.mjs";

export default defineConfig({
  plugins: [cutoutApiPlugin(), react()],
  server: {
    allowedHosts: [".loca.lt", "192.168.2.12"],
  },
});
