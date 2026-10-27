import { describe, expect, it } from "vitest";
import { podeCancelar, proximoStatus, statusAnterior } from "./status-ordem";

// Mesma tabela de transições da função mudar_status do banco
// (tests/banco/mudar-status.test.ts testa o lado do banco).

describe("proximoStatus", () => {
  it.each([
    ["aguardando", "em_servico"],
    ["em_servico", "pronto"],
    ["pronto", "entregue"],
    ["entregue", null],
    ["cancelada", null],
  ] as const)("%s → %s", (de, para) => {
    expect(proximoStatus(de)).toBe(para);
  });
});

describe("statusAnterior", () => {
  it.each([
    ["aguardando", null],
    ["em_servico", "aguardando"],
    ["pronto", "em_servico"],
    // Entregue e cancelada não voltam.
    ["entregue", null],
    ["cancelada", null],
  ] as const)("%s → %s", (de, para) => {
    expect(statusAnterior(de)).toBe(para);
  });
});

describe("podeCancelar", () => {
  it.each([
    ["aguardando", true],
    ["em_servico", true],
    ["pronto", true],
    ["entregue", false],
    ["cancelada", false],
  ] as const)("%s: %s", (de, pode) => {
    expect(podeCancelar(de)).toBe(pode);
  });
});
