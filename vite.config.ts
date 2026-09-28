import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 5503, strictPort: true },
  preview: { port: 5504, strictPort: true },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        minifyInternalExports: false,
        codeSplitting: {
          groups: [
            {
              name: "repository",
              test: /src\/data\/repository\.ts$/,
              includeDependenciesRecursively: false,
            },
            {
              name: "note",
              test: /src\/services\/note\.ts$/,
              includeDependenciesRecursively: false,
            },
            {
              name: "firebase",
              test: /node_modules\/(?:@firebase|firebase)\//,
              maxSize: 400000,
            },
            {
              name: "react",
              test: /node_modules\/(?:react|react-dom|scheduler)\//,
            },
          ],
        },
      },
    },
  },
});
