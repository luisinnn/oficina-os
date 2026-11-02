import { describe, expect, it } from "vitest";
import { limparMotivo, MOTIVO_MAX, situacaoDoLink, tokenComFormato, type OrcamentoPublico } from "./aprovacao";

describe("tokenComFormato", () => {
  it("aceita base64url de 43 caracteres", () => {
    expect(tokenComFormato("abcDEF0123456789_-abcDEF0123456789_-abcdefg")).toBe(true);
  });

  it.each(["", "x", "A".repeat(42), "A".repeat(44), `${"A".repeat(42)}=`, `${"A".repeat(42)}+`, `${"A".repeat(42)}/`])(
    "recusa %j",
    (token) => expect(tokenComFormato(token)).toBe(false),
  );
});

describe("limparMotivo", () => {
  it("tira espaços das pontas", () => {
    expect(limparMotivo("  Achei caro  ")).toEqual({ motivo: "Achei caro" });
  });

  it.each([null, "", "   ", "\n\t"])("vazio %j vira null", (texto) => {
    expect(limparMotivo(texto)).toEqual({ motivo: null });
  });

  it("aceita até o limite, contando emoji como 1", () => {
    expect(limparMotivo("a".repeat(MOTIVO_MAX))).toEqual({ motivo: "a".repeat(MOTIVO_MAX) });
    expect(limparMotivo("😀".repeat(MOTIVO_MAX))).toEqual({ motivo: "😀".repeat(MOTIVO_MAX) });
  });

  it("passou do limite: erro", () => {
    expect(limparMotivo("a".repeat(MOTIVO_MAX + 1))).toEqual({
      erro: `O motivo pode ter no máximo ${MOTIVO_MAX} caracteres.`,
    });
  });
});

describe("situacaoDoLink", () => {
  const base: OrcamentoPublico = {
    oficina: "Oficina",
    numero: 1,
    placa: "ABC1D23",
    modelo: "Gol",
    itens: [],
    total_centavos: 0,
    estado: "enviado",
    expirado: false,
  };

  it("sem orçamento: inválido", () => expect(situacaoDoLink(null)).toBe("invalido"));
  it("enviado e no prazo: aberto", () => expect(situacaoDoLink(base)).toBe("aberto"));
  it("enviado e vencido: inválido", () => expect(situacaoDoLink({ ...base, expirado: true })).toBe("invalido"));
  it.each(["aprovado", "recusado"] as const)("%s: respondido, mesmo vencido", (estado) => {
    expect(situacaoDoLink({ ...base, estado })).toBe("respondido");
    expect(situacaoDoLink({ ...base, estado, expirado: true })).toBe("respondido");
  });
  it("rascunho (não deveria chegar): inválido", () => {
    expect(situacaoDoLink({ ...base, estado: "rascunho" })).toBe("invalido");
  });
});
