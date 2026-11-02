import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel par root (/) se serve hota hai, isliye base path ki zaroorat nahi.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
