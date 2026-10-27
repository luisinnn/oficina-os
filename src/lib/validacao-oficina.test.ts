import { describe, expect, it } from "vitest";
import { NOME_OFICINA_MAX, validarOficina } from "./validacao-oficina";

// Monta um FormData igual ao que o navegador envia ao salvar o formulário.
function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

describe("validarOficina", () => {
  it("aceita nome e telefone válidos e guarda o telefone só com dígitos", () => {
    const r = validarOficina(form({ nome: "  Auto Center do Zé  ", telefone: "(47) 99999-0000" }));

    expect(r.erro).toBeUndefined();
    expect(r.dados).toEqual({ nome: "Auto Center do Zé", telefone: "47999990000" });
  });

  it("aceita telefone fixo com 10 dígitos", () => {
    expect(validarOficina(form({ nome: "Oficina", telefone: "47 3333-4444" })).dados.telefone).toBe(
      "4733334444",
    );
  });

  it("tira o +55 do começo do número", () => {
    expect(validarOficina(form({ nome: "Oficina", telefone: "+55 47 99999-0000" })).dados.telefone).toBe(
      "47999990000",
    );
  });

  it("exige o nome", () => {
    expect(validarOficina(form({ nome: "   ", telefone: "47999990000" })).erro).toBe(
      "Informe o nome da oficina.",
    );
  });

  it("recusa nome maior que o limite e aceita no limite", () => {
    const noLimite = "a".repeat(NOME_OFICINA_MAX);
    expect(validarOficina(form({ nome: noLimite, telefone: "47999990000" })).erro).toBeUndefined();
    expect(validarOficina(form({ nome: noLimite + "a", telefone: "47999990000" })).erro).toBe(
      `O nome pode ter no máximo ${NOME_OFICINA_MAX} caracteres.`,
    );
  });

  it("conta emoji como 1 caractere, igual ao banco", () => {
    const nome = "🔧".repeat(NOME_OFICINA_MAX);
    expect(validarOficina(form({ nome, telefone: "47999990000" })).erro).toBeUndefined();
  });

  it.each([
    ["vazio", ""],
    ["curto demais (sem DDD)", "99999-0000"],
    ["longo demais", "479999900001"],
    ["com letras no meio", "47 99999-0000 ramal"],
  ])("recusa telefone %s", (_caso, telefone) => {
    expect(validarOficina(form({ nome: "Oficina", telefone })).erro).toBe(
      "WhatsApp inválido: use DDD + número (10 ou 11 dígitos).",
    );
  });

  it("trata campos ausentes do formulário como vazios", () => {
    const r = validarOficina(new FormData());
    expect(r.erro).toBe("Informe o nome da oficina.");
    expect(r.valores).toEqual({ nome: "", telefone: "" });
  });

  it("devolve o que foi digitado para o formulário mostrar de novo", () => {
    const r = validarOficina(form({ nome: "Oficina", telefone: "(47) 9999" }));
    expect(r.valores).toEqual({ nome: "Oficina", telefone: "(47) 9999" });
  });
});
