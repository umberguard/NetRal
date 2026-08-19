/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base relativa: il build deve funzionare anche servito da una sottocartella
// (portabilità Cloudflare Pages -> GitHub Pages, §3 del brief)
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
  },
});
