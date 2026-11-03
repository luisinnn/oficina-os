import { describe, expect, it } from "vitest";
import {
  formatarDataHora,
  formatarPlaca,
  formatarTelefone,
  normalizarPlaca,
  normalizarTelefone,
  validarPlaca,
  validarTelefone,
} from "./formatos";

describe("placa", () => {
  it.each([
    ["ABC1234", "ABC1234"],
    ["abc1d23", "ABC1D23"],
    ["ABC-1234", "ABC1234"],
    [" abc 1d23 ", "ABC1D23"],
    ["abc - 1234", "ABC1234"],
  ])("normaliza %j para %j", (digitada, esperada) => {
    expect(normalizarPlaca(digitada)).toBe(esperada);
    expect(validarPlaca(normalizarPlaca(digitada))).toBe(true);
  });

  it.each(["", "ABC123", "ABC12345", "AB12345", "1BC1234", "ABC1DD3", "ABÇ1234", "ABC.1234", "ABC_1234"])(
    "recusa %j",
    (digitada) => {
      expect(validarPlaca(normalizarPlaca(digitada))).toBe(false);
    },
  );

  it("validarPlaca exige o formato já normalizado", () => {
    expect(validarPlaca("abc1234")).toBe(false);
    expect(validarPlaca("ABC-1234")).toBe(false);
  });
});

describe("telefone", () => {
  it.each([
    ["(47) 99999-0000", "47999990000"],
    ["47 3333-0000", "4733330000"],
    ["47.99999.0000", "47999990000"],
    ["+55 47 99999-0000", "47999990000"],
    ["5547999990000", "47999990000"],
    // DDD 55 (RS) não é confundido com o código do Brasil.
    ["(55) 99999-0000", "55999990000"],
    ["+55 (55) 99999-0000", "55999990000"],
  ])("normaliza %j para %j", (digitado, esperado) => {
    expect(normalizarTelefone(digitado)).toBe(esperado);
    expect(validarTelefone(normalizarTelefone(digitado))).toBe(true);
  });

  it.each(["", "99999-0000", "(47) 99999-00000", "47 99999-0000 ramal", "47a999990000", "+1 47 99999-0000"])(
    "recusa %j",
    (digitado) => {
      expect(validarTelefone(normalizarTelefone(digitado))).toBe(false);
    },
  );

  it("validarTelefone exige só dígitos", () => {
    expect(validarTelefone("(47) 99999-0000")).toBe(false);
  });
});

describe("formatarTelefone", () => {
  it.each([
    ["47999990000", "(47) 99999-0000"],
    ["4733330000", "(47) 3333-0000"],
  ])("mostra %j como %j", (telefone, esperado) => {
    expect(formatarTelefone(telefone)).toBe(esperado);
  });

  it("devolve como está o que não for telefone válido", () => {
    expect(formatarTelefone("123")).toBe("123");
  });
});

describe("formatarDataHora", () => {
  it("mostra no fuso de São Paulo", () => {
    // 15:30 em UTC = 12:30 em Brasília (UTC-3).
    expect(formatarDataHora("2026-10-27T15:30:00Z")).toBe("27/10/2026 12:30");
  });

  it("vira o dia pelo fuso de São Paulo, não pelo UTC", () => {
    expect(formatarDataHora("2026-10-28T01:00:00Z")).toBe("27/10/2026 22:00");
  });
});

describe("formatarPlaca", () => {
  // Como está escrito na placa de verdade: a antiga tem hífen, a Mercosul não.
  it.each([
    ["ABC1234", "ABC-1234"],
    ["ABC1D23", "ABC1D23"],
    // Fora do formato (não deveria vir do banco): mostra como veio.
    ["XYZ", "XYZ"],
  ])("%j -> %j", (placa, esperada) => {
    expect(formatarPlaca(placa)).toBe(esperada);
  });
});
