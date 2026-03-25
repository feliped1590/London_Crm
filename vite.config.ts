import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import crypto from "crypto";
import fs from "fs";

function versionJsonPlugin(): Plugin {
  return {
    name: 'generate-version-json',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      const version = crypto.randomBytes(8).toString('hex');
      const content = JSON.stringify({ version, builtAt: new Date().toISOString() });
      fs.writeFileSync(path.join(outDir, 'version.json'), content);
      console.log(`✅ version.json generated: ${version}`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionJsonPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
