import { describe, expect, it } from "vitest";
import {
  chaveTroca,
  KM_MAX,
  MODELO_MAX,
  NOME_CLIENTE_MAX,
  OBS_MAX,
  PROBLEMA_MAX,
  validarNovaOrdem,
} from "./validacao-ordem";

// Monta um FormData igual ao que o navegador envia ao salvar o formulário.
function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

const valido = {
  placa: "abc-1d23",
  modelo: " Gol 1.0 ",
  nome: " João da Silva ",
  telefone: "(47) 99999-0000",
  problema: " Barulho no freio ",
};

describe("validarNovaOrdem", () => {
  it("aceita os 5 campos e devolve os dados prontos para o banco", () => {
    const r = validarNovaOrdem(form(valido));

    expect(r.erros).toEqual({});
    expect(r.dados).toEqual({
      placa: "ABC1D23",
      modelo: "Gol 1.0",
      nome: "João da Silva",
      telefone: "47999990000",
      problema: "Barulho no freio",
      km: null,
      obs_interna: null,
      trocar_dono: null,
    });
  });

  it("lê km e observação interna (Mais detalhes)", () => {
    const r = validarNovaOrdem(form({ ...valido, km: "120.000", obs: "  Cliente com pressa  " }));
    expect(r.dados?.km).toBe(120000);
    expect(r.dados?.obs_interna).toBe("Cliente com pressa");
  });

  it.each([
    ["120000", 120000],
    ["120 000", 120000],
    ["0", 0],
    [String(KM_MAX), KM_MAX],
  ])("aceita km %j", (km, esperado) => {
    expect(validarNovaOrdem(form({ ...valido, km })).dados?.km).toBe(esperado);
  });

  it.each(["abc", "-5", "12,5", String(KM_MAX + 1)])("recusa km %j", (km) => {
    const r = validarNovaOrdem(form({ ...valido, km }));
    expect(r.dados).toBeUndefined();
    expect(r.erros).toEqual({ km: "Km inválido: use só números." });
  });

  it("observação só com espaços vira null", () => {
    expect(validarNovaOrdem(form({ ...valido, obs: "   " })).dados?.obs_interna).toBeNull();
  });

  it.each([
    ["sim", true],
    ["nao", false],
    ["", null],
    ["talvez", null],
  ])("resposta %j ao \"Trocar dono?\" vira %j", (trocar, esperado) => {
    const pergunta = chaveTroca({ placa: "ABC1D23", nome: "João da Silva", telefone: "47999990000" });
    const r = validarNovaOrdem(form({ ...valido, trocar_dono: trocar, pergunta_troca: pergunta }));
    expect(r.dados?.trocar_dono).toBe(esperado);
  });

  it.each([
    ["a placa", { placa: "XYZ9999" }],
    ["o nome", { nome: "Outra Pessoa" }],
    ["o telefone", { telefone: "47988887777" }],
  ])("ignora a resposta se %s mudou depois da pergunta", (_caso, mudou) => {
    const pergunta = chaveTroca({ placa: "ABC1D23", nome: "João da Silva", telefone: "47999990000" });
    const r = validarNovaOrdem(form({ ...valido, ...mudou, trocar_dono: "sim", pergunta_troca: pergunta }));
    expect(r.dados?.trocar_dono).toBeNull();
  });

  it("ignora a resposta sem a pergunta", () => {
    expect(validarNovaOrdem(form({ ...valido, trocar_dono: "sim" })).dados?.trocar_dono).toBeNull();
  });

  it("cada erro aparece no campo certo, todos de uma vez", () => {
    const r = validarNovaOrdem(new FormData());
    expect(r.dados).toBeUndefined();
    expect(r.erros).toEqual({
      placa: "Placa inválida: use ABC1234 ou ABC1D23.",
      modelo: "Informe o modelo.",
      nome: "Informe o nome do cliente.",
      telefone: "Telefone inválido: use DDD + número (10 ou 11 dígitos).",
      problema: "Descreva o problema.",
    });
  });

  it("recusa placa e telefone fora do formato", () => {
    const r = validarNovaOrdem(form({ ...valido, placa: "AB1234", telefone: "9999-0000" }));
    expect(Object.keys(r.erros).sort()).toEqual(["placa", "telefone"]);
  });

  it.each([
    ["modelo", MODELO_MAX, `O modelo pode ter no máximo ${MODELO_MAX} caracteres.`],
    ["nome", NOME_CLIENTE_MAX, `O nome pode ter no máximo ${NOME_CLIENTE_MAX} caracteres.`],
    ["problema", PROBLEMA_MAX, `O problema pode ter no máximo ${PROBLEMA_MAX} caracteres.`],
    ["obs", OBS_MAX, `A observação pode ter no máximo ${OBS_MAX} caracteres.`],
  ])("limite de %s: aceita %i e recusa 1 a mais", (campo, max, mensagem) => {
    // Emoji conta como 1 caractere, igual ao char_length do banco.
    const noLimite = "🔧".repeat(max);
    expect(validarNovaOrdem(form({ ...valido, [campo]: noLimite })).erros).toEqual({});
    expect(validarNovaOrdem(form({ ...valido, [campo]: noLimite + "a" })).erros).toEqual({ [campo]: mensagem });
  });

  it("devolve o que foi digitado para o formulário mostrar de novo", () => {
    const digitado = { ...valido, telefone: "(47) 9999", km: "12a", obs: "anotação" };
    expect(validarNovaOrdem(form(digitado)).valores).toEqual({
      placa: "abc-1d23",
      modelo: "Gol 1.0",
      nome: "João da Silva",
      telefone: "(47) 9999",
      problema: "Barulho no freio",
      km: "12a",
      obs: "anotação",
    });
  });
});
