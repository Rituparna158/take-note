import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // TipTap/ProseMirror (rich-text editor, AB-1012) legitimately pushes the
    // main chunk past Vite's default 500kB warning threshold.
    chunkSizeWarningLimit: 800,
  },
});
