import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mesmo atalho do tsconfig.json: "@/lib/x" aponta para "src/lib/x".
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Roda os arquivos *.test.ts dentro de src/, em ambiente Node.
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Os testes de lógica pura chegam a partir do ticket 03; até lá não há
    // nenhum arquivo, e isso não deve quebrar o "npm test".
    passWithNoTests: true,
  },
});
