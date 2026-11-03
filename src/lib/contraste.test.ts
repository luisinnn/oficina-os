import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contraste (WCAG AA) das cores do painel, lidas direto do @theme do
// globals.css (ticket 13): mudou uma cor lá, este teste confere de novo.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tema = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));

// Cinzas e vermelho do Tailwind usados junto com as cores do tema.
const cor: Record<string, string> = {
  ...tema,
  branco: "#ffffff",
  "zinc-200": "#e4e4e7",
  "zinc-500": "#71717a",
  "zinc-600": "#52525b",
  "zinc-700": "#3f3f46",
  "red-700": "#b91c1c",
};

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

describe("contraste das cores do painel", () => {
  it("lê as cores do tema", () => {
    expect(Object.keys(tema)).toEqual(
      expect.arrayContaining(["concreto", "chapa", "grafite", "placa", "placa-escuro", "sinal", "liberado"]),
    );
  });

  // Texto: mínimo 4,5.
  it.each([
    ["grafite", "concreto"],
    ["grafite", "chapa"],
    ["zinc-600", "concreto"],
    ["zinc-600", "chapa"],
    ["zinc-700", "chapa"],
    ["branco", "grafite"],
    ["branco", "placa"],
    ["branco", "placa-escuro"],
    ["grafite", "sinal"],
    ["branco", "liberado"],
    ["branco", "red-700"],
    ["grafite", "zinc-200"],
    ["placa", "concreto"],
    ["placa", "chapa"],
  ])("texto %s sobre %s", (frente, fundo) => {
    expect(contraste(cor[frente], cor[fundo])).toBeGreaterThanOrEqual(4.5);
  });

  // Contorno de foco e borda do campo de busca: mínimo 3.
  it.each([
    ["placa", "concreto"],
    ["placa", "chapa"],
    ["chapa", "grafite"],
    ["zinc-500", "concreto"],
  ])("contorno %s sobre %s", (frente, fundo) => {
    expect(contraste(cor[frente], cor[fundo])).toBeGreaterThanOrEqual(3);
  });
});
