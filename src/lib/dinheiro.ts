// Dinheiro em centavos (inteiro), como no banco. Arquivo "puro" (sem banco nem
// Next.js), testado em dinheiro.test.ts.

// Parte inteira: "1234" ou com ponto de milhar "1.234.567".
const INTEIRO = /^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)$/;

// O que a pessoa digitou em reais -> centavos. null = não dá para entender.
// Aceita "10", "10,50", "1.234,56", "R$ 10" e também "10.50" (teclado de
// celular que só tem ponto). Ponto seguido de 3 dígitos é milhar ("1.234").
// Mais de 2 casas depois da vírgula é erro, para não arredondar escondido.
export function reaisParaCentavos(digitado: string): number | null {
  const texto = digitado.replace(/\s/g, "").replace(/^r\$/i, "");

  let inteiro: string;
  let decimal: string;
  const virgula = texto.match(/^([0-9.]*),([0-9]{1,2})$/);
  const pontoDecimal = texto.match(/^([0-9]+)\.([0-9]{1,2})$/);
  if (virgula) {
    [, inteiro, decimal] = virgula;
    if (inteiro && !INTEIRO.test(inteiro)) return null;
  } else if (INTEIRO.test(texto)) {
    [inteiro, decimal] = [texto, ""];
  } else if (pontoDecimal) {
    [, inteiro, decimal] = pontoDecimal;
  } else {
    return null;
  }

  const centavos = Number(inteiro.replace(/\./g, "") || "0") * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

// 123456 -> "1.234,56" (sem "R$"; é o que vai no campo para editar).
export function centavosParaCampo(centavos: number): string {
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.floor(absoluto / 100)).replace(/\B(?=([0-9]{3})+$)/g, ".");
  const decimal = String(absoluto % 100).padStart(2, "0");
  return `${inteiro},${decimal}`;
}

// 123456 -> "R$ 1.234,56", para mostrar na tela.
export function formatarReais(centavos: number): string {
  return `${centavos < 0 ? "-" : ""}R$ ${centavosParaCampo(centavos)}`;
}
