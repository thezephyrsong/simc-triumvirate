import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set base to your GitHub repo name, e.g. "/simc-triumvirate/"
// This is needed for GitHub Pages project sites (not user/org sites).
// If you rename the repo, update this too.
const BASE_PATH = process.env.VITE_BASE_PATH || "/simc-triumvirate/";

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
});
