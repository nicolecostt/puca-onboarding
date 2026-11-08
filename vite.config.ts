import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Cada página HTML vira uma entrada do build.
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // O agente roda em server/ (npm run dev:server); em dev o Vite repassa /api para ele.
  server: { proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } } },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: page("./index.html"),
        onboarding: page("./src/screens/onboarding-call/index.html"),
        liveSession: page("./src/screens/live-session/index.html"),
        lesson: page("./src/screens/lesson/index.html"),
        rastro: page("./src/screens/rastro/index.html"),
        primeiraTarefa: page("./src/screens/primeira-tarefa/index.html"),
        landing: page("./src/screens/landing/index.html"),
      },
    },
  },
});
