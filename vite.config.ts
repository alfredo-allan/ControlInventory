import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Plugins opcionais (somente em ambiente Replit e dev)
const devPlugins = async () => {
  const plugins = [];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID) {
    const [{ cartographer }, { devBanner }] = await Promise.all([
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);

    plugins.push(cartographer(), devBanner());
  }

  return plugins;
};

export default defineConfig(async () => ({
  plugins: [
    react(),
    (await import("@replit/vite-plugin-runtime-error-modal")).default(),
    ...(await devPlugins()),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },

  root: path.resolve(__dirname, "client"),

  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== "production",
  },

  server: {
    fs: {
      strict: true,
      deny: ["**/.*"], // bloqueia acesso a arquivos ocultos
    },
    port: 5173,
    open: true,
  },
}));
