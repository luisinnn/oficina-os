import { describe, expect, it } from "vitest";
import { codigoComFormato, ehRobo, linkPreCadastro, validarPreCadastro } from "./pre-cadastro";
import { MODELO_MAX, NOME_CLIENTE_MAX, PROBLEMA_MAX } from "./validacao-ordem";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

const valido = {
  nome: " Maria Souza ",
  telefone: "(47) 93333-4444",
  placa: "abc-1d23",
  modelo: " Onix 1.4 ",
  problema: " Luz do óleo acesa ",
};

describe("validarPreCadastro", () => {
  it("aceita os 5 campos e devolve os dados prontos para o banco", () => {
    const r = validarPreCadastro(form(valido));
    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({
      nome: "Maria Souza",
      telefone: "47933334444",
      placa: "ABC1D23",
      modelo: "Onix 1.4",
      problema: "Luz do óleo acesa",
    });
  });

  it("vazio: um erro em cada campo e sem dados", () => {
    const r = validarPreCadastro(form({}));
    expect(r.dados).toBeUndefined();
    expect(Object.keys(r.erros).sort()).toEqual(["modelo", "nome", "placa", "problema", "telefone"]);
  });

  it("devolve o que foi digitado para mostrar de novo", () => {
    const r = validarPreCadastro(form({ ...valido, placa: "xx" }));
    expect(r.valores).toEqual({ ...valido, placa: "xx", nome: "Maria Souza", modelo: "Onix 1.4", problema: "Luz do óleo acesa" });
  });

  it.each([
    ["nome", NOME_CLIENTE_MAX],
    ["modelo", MODELO_MAX],
    ["problema", PROBLEMA_MAX],
  ])("%s: aceita até %i caracteres", (campo, max) => {
    expect(validarPreCadastro(form({ ...valido, [campo]: "a".repeat(max) })).erros).toEqual({});
    expect(validarPreCadastro(form({ ...valido, [campo]: "a".repeat(max + 1) })).erros).toHaveProperty(campo);
  });

  it("emoji conta como 1 caractere, igual ao banco", () => {
    expect(validarPreCadastro(form({ ...valido, modelo: "🚗".repeat(MODELO_MAX) })).erros).toEqual({});
  });

  it("placa e telefone inválidos", () => {
    const r = validarPreCadastro(form({ ...valido, placa: "AB12", telefone: "123" }));
    expect(r.erros).toHaveProperty("placa");
    expect(r.erros).toHaveProperty("telefone");
  });
});

describe("ehRobo", () => {
  it("campo isca preenchido = robô", () => {
    expect(ehRobo(form({ ...valido, site: "http://spam" }))).toBe(true);
  });

  it("isca vazia ou ausente = gente", () => {
    expect(ehRobo(form({ ...valido, site: "" }))).toBe(false);
    expect(ehRobo(form(valido))).toBe(false);
  });
});

describe("codigoComFormato", () => {
  it("aceita o formato do banco (base64url, 12 caracteres)", () => {
    expect(codigoComFormato("aB3-_x9Zq0Lm")).toBe(true);
  });

  it.each(["", "curto", "tem espaço aqui", "com/barra/123", "a".repeat(65)])("recusa %j", (codigo) => {
    expect(codigoComFormato(codigo)).toBe(false);
  });
});

describe("linkPreCadastro", () => {
  it("monta o endereço público", () => {
    expect(linkPreCadastro("https://oficina.app", "aB3-_x9Zq0Lm")).toBe("https://oficina.app/p/aB3-_x9Zq0Lm");
  });
});
