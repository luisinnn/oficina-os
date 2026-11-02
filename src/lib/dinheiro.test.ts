import { describe, expect, it } from "vitest";
import { centavosParaCampo, formatarReais, reaisParaCentavos } from "./dinheiro";

describe("reaisParaCentavos", () => {
  it.each([
    ["10", 1000],
    ["10,5", 1050],
    ["10,50", 1050],
    ["0,99", 99],
    [",99", 99],
    ["0", 0],
    ["0,00", 0],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["1.234.567,89", 123456789],
    // Teclado numérico de alguns celulares só tem ponto.
    ["10.50", 1050],
    ["10.5", 1050],
    ["R$ 1.234,56", 123456],
    ["r$10", 1000],
    [" 45,00 ", 4500],
    ["1 234,56", 123456],
  ])("%j -> %i", (digitado, centavos) => {
    expect(reaisParaCentavos(digitado)).toBe(centavos);
  });

  it.each([
    "",
    "   ",
    "abc",
    "-5",
    "-0,50",
    "10,999",
    "1,2,3",
    "1.23.4",
    "12.34.56",
    "1.2345",
    "1,234.56",
    "10,",
    "10.",
    "R$",
    "1e3",
    "١٢",
  ])("recusa %j", (digitado) => {
    expect(reaisParaCentavos(digitado)).toBeNull();
  });

  it("número grande não vira notação científica nem perde precisão", () => {
    expect(reaisParaCentavos("99.999.999.999,99")).toBe(9_999_999_999_999);
  });
});

describe("formatarReais", () => {
  it.each([
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [99, "R$ 0,99"],
    [1050, "R$ 10,50"],
    [123456, "R$ 1.234,56"],
    [123456789, "R$ 1.234.567,89"],
    [10_000_000, "R$ 100.000,00"],
  ])("%i -> %j", (centavos, texto) => {
    expect(formatarReais(centavos)).toBe(texto);
  });

  it("negativo leva o sinal", () => {
    expect(formatarReais(-1050)).toBe("-R$ 10,50");
  });
});

describe("centavosParaCampo", () => {
  it.each([
    [0, "0,00"],
    [99, "0,99"],
    [123456, "1.234,56"],
  ])("%i -> %j (e volta igual)", (centavos, texto) => {
    expect(centavosParaCampo(centavos)).toBe(texto);
    expect(reaisParaCentavos(texto)).toBe(centavos);
  });
});
