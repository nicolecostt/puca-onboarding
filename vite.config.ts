import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Cada página HTML vira uma entrada do build.
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  // Em dev o Vite repassa /api para o servidor: o local (npm run dev:server) ou, com API_TARGET, outro, como o do
  // Fly (npm run dev:fly), que já tem o Claude e a voz; aí só o front roda na máquina.
  server: { proxy: { "/api": { target: process.env.API_TARGET || "http://localhost:8787", changeOrigin: true } } },
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
        tarefas: page("./src/screens/tarefas/index.html"),
        landing: page("./src/screens/landing/index.html"),
        boasVindas: page("./src/screens/boas-vindas/index.html"),
        inicio: page("./src/screens/inicio/index.html"),
        rh: page("./src/screens/rh/index.html"),
      },
    },
  },
});
