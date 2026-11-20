import { defineConfig } from "vite";

export default defineConfig({
  base: "/kid-icarus-web/",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
});