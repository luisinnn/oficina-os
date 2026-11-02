import { describe, expect, it } from "vitest";
import { DESCRICAO_MAX, foiEnviado, QUANTIDADE_MAX, subtotal, VALOR_MAX_CENTAVOS, validarItem } from "./orcamento";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const valido = { tipo: "peca", descricao: "Pastilha de freio", quantidade: "2", valor: "89,90" };

describe("validarItem", () => {
  it("item válido vira dados prontos para o banco", () => {
    const r = validarItem(form(valido));
    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({
      tipo: "peca",
      descricao: "Pastilha de freio",
      quantidade: 2,
      valor_unitario_centavos: 8990,
    });
  });

  it("tira espaços da descrição e aceita mão de obra", () => {
    const r = validarItem(form({ ...valido, tipo: "mao_de_obra", descricao: "  Troca  " }));
    expect(r.dados?.tipo).toBe("mao_de_obra");
    expect(r.dados?.descricao).toBe("Troca");
  });

  it("valor zero vale (ex.: serviço de cortesia)", () => {
    expect(validarItem(form({ ...valido, valor: "0" })).dados?.valor_unitario_centavos).toBe(0);
  });

  it("limites exatos valem", () => {
    const r = validarItem(
      form({
        ...valido,
        descricao: "a".repeat(DESCRICAO_MAX),
        quantidade: String(QUANTIDADE_MAX),
        valor: "100.000,00",
      }),
    );
    expect(r.erros).toEqual({});
    expect(r.dados?.valor_unitario_centavos).toBe(VALOR_MAX_CENTAVOS);
  });

  it.each([
    ["tipo", { tipo: "brinde" }],
    ["tipo", { tipo: "" }],
    ["descricao", { descricao: "" }],
    ["descricao", { descricao: "   " }],
    ["descricao", { descricao: "a".repeat(DESCRICAO_MAX + 1) }],
    ["quantidade", { quantidade: "0" }],
    ["quantidade", { quantidade: "-1" }],
    ["quantidade", { quantidade: "1000" }],
    ["quantidade", { quantidade: "1,5" }],
    ["quantidade", { quantidade: "" }],
    ["quantidade", { quantidade: "dois" }],
    ["valor", { valor: "" }],
    ["valor", { valor: "-10" }],
    ["valor", { valor: "abc" }],
    ["valor", { valor: "10,999" }],
    ["valor", { valor: "100.000,01" }],
  ])("erro em %s: %j", (campo, mudanca) => {
    const r = validarItem(form({ ...valido, ...mudanca }));
    expect(r.dados).toBeUndefined();
    expect(Object.keys(r.erros)).toEqual([campo]);
  });

  it("descrição conta emoji como 1 caractere, igual ao banco", () => {
    expect(validarItem(form({ ...valido, descricao: "🔧".repeat(DESCRICAO_MAX) })).erros).toEqual({});
  });

  it("junta todos os erros e devolve o que foi digitado", () => {
    const r = validarItem(form({ tipo: "peca", descricao: "", quantidade: "0", valor: "x" }));
    expect(Object.keys(r.erros).sort()).toEqual(["descricao", "quantidade", "valor"]);
    expect(r.valores).toEqual({ tipo: "peca", descricao: "", quantidade: "0", valor: "x" });
  });
});

describe("subtotal", () => {
  it("quantidade × valor", () => {
    expect(subtotal({ quantidade: 3, valor_unitario_centavos: 1050 })).toBe(3150);
  });
});

describe("foiEnviado", () => {
  it.each([
    ["rascunho", false],
    ["enviado", true],
    ["aprovado", true],
    ["recusado", true],
  ] as const)("%s -> %s", (estado, esperado) => {
    expect(foiEnviado(estado)).toBe(esperado);
  });
});
