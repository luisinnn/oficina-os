import { describe, expect, it } from "vitest";
import {
  limitesDoMes,
  lerMes,
  mesAnterior,
  mesAtual,
  mesDe,
  mesSeguinte,
  nomeDoMes,
  resumoDoMes,
  termoBusca,
  textoFechamento,
  textoResumo,
} from "./historico";

describe("mesDe (fuso de São Paulo)", () => {
  it("OS fechada às 22h do dia 31 em São Paulo conta naquele mês", () => {
    // 31/10 22:00 em São Paulo = 01/11 01:00 em UTC.
    expect(mesDe("2026-11-01T01:00:00Z")).toBe("2026-10");
  });

  it("meia-noite do dia 1 em São Paulo já é o mês novo", () => {
    expect(mesDe("2026-11-01T03:00:00Z")).toBe("2026-11");
  });

  it("virada do ano", () => {
    expect(mesDe("2027-01-01T02:59:59Z")).toBe("2026-12");
  });
});

describe("limitesDoMes", () => {
  it("vai da meia-noite do dia 1 à meia-noite do mês seguinte, em São Paulo", () => {
    expect(limitesDoMes("2026-10")).toEqual({
      inicio: "2026-10-01T03:00:00.000Z",
      fim: "2026-11-01T03:00:00.000Z",
    });
  });

  it("dezembro termina no ano seguinte", () => {
    expect(limitesDoMes("2026-12").fim).toBe("2027-01-01T03:00:00.000Z");
  });

  it("22h do dia 31 fica dentro do mês", () => {
    const { inicio, fim } = limitesDoMes("2026-10");
    const momento = "2026-11-01T01:00:00.000Z";
    expect(momento >= inicio && momento < fim).toBe(true);
  });
});

describe("mês no endereço", () => {
  const agora = new Date("2026-11-03T15:00:00Z");

  it("mês atual no fuso de São Paulo", () => {
    expect(mesAtual(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
    expect(mesAtual(agora)).toBe("2026-11");
  });

  it("aceita um mês passado no formato AAAA-MM", () => {
    expect(lerMes("2026-10", agora)).toBe("2026-10");
    expect(lerMes("2025-01", agora)).toBe("2025-01");
  });

  it("sem mês, mês inválido ou futuro: mês atual", () => {
    expect(lerMes(undefined, agora)).toBe("2026-11");
    expect(lerMes("2026-13", agora)).toBe("2026-11");
    expect(lerMes("2026-1", agora)).toBe("2026-11");
    expect(lerMes("abc", agora)).toBe("2026-11");
    expect(lerMes("2026-12", agora)).toBe("2026-11");
  });

  it("anterior e seguinte, com virada de ano", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-10")).toBe("2026-09");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesSeguinte("2026-09")).toBe("2026-10");
  });

  it("nome do mês", () => {
    expect(nomeDoMes("2026-10")).toBe("outubro de 2026");
    expect(nomeDoMes("2027-03")).toBe("março de 2027");
  });
});

describe("resumoDoMes", () => {
  it("total soma só as entregues com valor; cancelada aparece mas não soma", () => {
    const resumo = resumoDoMes([
      { status: "entregue", valor_centavos: 85000 },
      { status: "entregue", valor_centavos: null },
      { status: "cancelada", valor_centavos: 40000 },
      { status: "entregue", valor_centavos: 12050 },
      { status: "cancelada", valor_centavos: null },
    ]);
    expect(resumo).toEqual({ totalCentavos: 97050, entregues: 3, canceladas: 2 });
  });

  it("mês vazio", () => {
    expect(resumoDoMes([])).toEqual({ totalCentavos: 0, entregues: 0, canceladas: 0 });
  });

  it("texto com singular e plural", () => {
    expect(textoResumo({ totalCentavos: 0, entregues: 23, canceladas: 2 })).toBe("23 entregues, 2 canceladas");
    expect(textoResumo({ totalCentavos: 0, entregues: 1, canceladas: 1 })).toBe("1 entregue, 1 cancelada");
    expect(textoResumo({ totalCentavos: 0, entregues: 4, canceladas: 0 })).toBe("4 entregues");
    expect(textoResumo({ totalCentavos: 0, entregues: 0, canceladas: 1 })).toBe("1 cancelada");
  });
});

describe("termoBusca", () => {
  it("placa com ou sem hífen vira o formato do banco", () => {
    expect(termoBusca("abc-1234")).toEqual({ placa: "ABC1234", nome: "abc-1234" });
    expect(termoBusca(" ABC1234 ")?.placa).toBe("ABC1234");
  });

  it("nome: tira espaço sobrando e mantém acento", () => {
    expect(termoBusca("  maria   souza ")).toEqual({ placa: "MARIASOUZA", nome: "maria souza" });
    expect(termoBusca("João")?.nome).toBe("João");
  });

  it("tira caracteres que mudariam o filtro do banco", () => {
    const termo = termoBusca('ma%r_i*a,(x)"\\');
    expect(termo?.nome).toBe("mariax");
    expect(termo?.placa).toBe("MARIAX");
  });

  it("placa só com letras e números; sem eles não busca placa", () => {
    expect(termoBusca("d'ávila")?.placa).toBeNull();
    expect(termoBusca("d'ávila")?.nome).toBe("d'ávila");
  });

  it("vazio ou só símbolos: sem busca", () => {
    expect(termoBusca(undefined)).toBeNull();
    expect(termoBusca("   ")).toBeNull();
    expect(termoBusca("%%,")).toBeNull();
  });

  it("limita o tamanho", () => {
    expect(termoBusca("a".repeat(200))?.nome).toHaveLength(60);
  });
});

describe("textoFechamento", () => {
  // 28/10 22:30 em São Paulo.
  const fechada_em = "2026-10-29T01:30:00Z";

  it("status, dia no fuso de São Paulo e km", () => {
    expect(textoFechamento({ status: "entregue", fechada_em, km: 120300 })).toBe("Entregue em 28/10 · 120.300 km");
    expect(textoFechamento({ status: "cancelada", fechada_em, km: null })).toBe("Cancelada em 28/10 · km não anotada");
  });

  it("com ano (busca, que junta vários meses)", () => {
    expect(textoFechamento({ status: "entregue", fechada_em, km: 5 }, true)).toBe("Entregue em 28/10/2026 · 5 km");
  });
});
