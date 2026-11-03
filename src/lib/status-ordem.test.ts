import { describe, expect, it } from "vitest";
import { agruparPorStatus, podeCancelar, proximoStatus, statusAnterior } from "./status-ordem";

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

describe("agruparPorStatus", () => {
  it("separa as OS abertas nos 3 grupos, na ordem da tela, mantendo a ordem de cada grupo", () => {
    const ordens = [
      { id: "a", status: "pronto" },
      { id: "b", status: "aguardando" },
      { id: "c", status: "aguardando" },
    ] as const;
    expect(agruparPorStatus(ordens)).toEqual([
      { status: "aguardando", ordens: [ordens[1], ordens[2]] },
      { status: "em_servico", ordens: [] },
      { status: "pronto", ordens: [ordens[0]] },
    ]);
  });

  it("sem OS, devolve os 3 grupos vazios", () => {
    expect(agruparPorStatus([]).map((g) => g.ordens.length)).toEqual([0, 0, 0]);
  });
});
