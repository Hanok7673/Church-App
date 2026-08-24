import vinext from "vinext";
import { defineConfig } from "vite";

// Production builds still use vite.config.ts with the Cloudflare plugin.
// Local Windows previews use vinext directly so Miniflare cannot interrupt
// the browser asset server during startup.
export default defineConfig({
  plugins: [vinext()],
});
