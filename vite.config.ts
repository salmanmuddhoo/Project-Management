import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          excel: ["xlsx", "exceljs"],
          charts: ["recharts"],
          pdf: ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
});
