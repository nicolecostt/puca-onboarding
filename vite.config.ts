import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Cada página HTML vira uma entrada do build.
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: page("./index.html"),
        onboarding: page("./src/screens/onboarding-call/index.html"),
        liveSession: page("./src/screens/live-session/index.html"),
        aulaQuadro: page("./src/screens/aula-quadro/index.html"),
      },
    },
  },
});
