import { describe, expect, it } from "vitest";
import {
  KM_MAX,
  formatarKm,
  kmFoiConferida,
  kmMenorQueUltima,
  lerEntrada,
  lerKm,
  lerTanque,
  textoEntrada,
  textoKmMenor,
  ultimaKm,
} from "./km";

describe("lerKm", () => {
  it.each([
    ["120000", 120000],
    ["120.000", 120000],
    ["120 000", 120000],
    [" 0 ", 0],
    [String(KM_MAX), KM_MAX],
  ])("aceita %j", (texto, km) => {
    expect(lerKm(texto)).toEqual({ km });
  });

  it("vazio: pede a km (é obrigatória)", () => {
    expect(lerKm("")).toEqual({ erro: "Informe a km do painel." });
    expect(lerKm("   ")).toEqual({ erro: "Informe a km do painel." });
  });

  it.each(["abc", "-5", "12,5", String(KM_MAX + 1)])("recusa %j", (texto) => {
    expect(lerKm(texto)).toEqual({ erro: "Km inválida: use só números." });
  });
});

describe("lerTanque", () => {
  it.each(["reserva", "1/4", "1/2", "3/4", "cheio"])("aceita %j", (t) => {
    expect(lerTanque(t)).toEqual({ tanque: t });
  });

  it("vazio = não anotado", () => {
    expect(lerTanque("")).toEqual({ tanque: null });
  });

  it("fora das opções: erro", () => {
    expect(lerTanque("meio")).toEqual({ erro: "Escolha uma das opções do tanque." });
  });
});

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

describe("lerEntrada", () => {
  it("lê km e tanque", () => {
    expect(lerEntrada(form({ km: "120.300", tanque: "1/4" }), true)).toEqual({
      valores: { km: "120.300", tanque: "1/4" },
      erros: {},
      dados: { km: 120300, tanque: "1/4" },
    });
  });

  it("junta os erros dos dois campos", () => {
    const r = lerEntrada(form({ km: "", tanque: "meio" }), true);
    expect(r.dados).toBeUndefined();
    expect(r.erros).toEqual({ km: "Informe a km do painel.", tanque: "Escolha uma das opções do tanque." });
  });

  it("km travada: ignora a km e lê só o tanque", () => {
    expect(lerEntrada(form({ tanque: "cheio" }), false).dados).toEqual({ km: null, tanque: "cheio" });
  });
});

describe("kmFoiConferida", () => {
  it("só vale para a km avisada", () => {
    expect(kmFoiConferida(form({ km_conferida: "120300" }), 120300)).toBe(true);
    expect(kmFoiConferida(form({ km_conferida: "120300" }), 120299)).toBe(false);
    expect(kmFoiConferida(form({}), 120300)).toBe(false);
  });
});

describe("aviso de km menor", () => {
  const historico = [
    { id: "c", km: null },
    { id: "b", km: 120300 },
    { id: "a", km: 100000 },
  ];

  it("ultimaKm: a mais recente anotada, ignorando a própria OS", () => {
    expect(ultimaKm(historico)).toBe(120300);
    expect(ultimaKm(historico, "b")).toBe(100000);
    expect(ultimaKm([])).toBeNull();
    expect(ultimaKm([{ id: "x", km: null }])).toBeNull();
  });

  it("kmMenorQueUltima só quando há última e a nova é menor", () => {
    expect(kmMenorQueUltima(120299, 120300)).toBe(true);
    expect(kmMenorQueUltima(120300, 120300)).toBe(false);
    expect(kmMenorQueUltima(130000, 120300)).toBe(false);
    expect(kmMenorQueUltima(5, null)).toBe(false);
  });

  it("textoKmMenor", () => {
    expect(textoKmMenor(120300)).toBe("A última OS deste carro anotou 120.300 km. Confere a km?");
  });
});

describe("textos", () => {
  it("formatarKm usa ponto de milhar", () => {
    expect(formatarKm(120300)).toBe("120.300 km");
    expect(formatarKm(0)).toBe("0 km");
  });

  it("textoEntrada junta km e tanque", () => {
    expect(textoEntrada(120300, "1/4")).toBe("Entrada com 120.300 km, tanque 1/4");
    expect(textoEntrada(120300, "cheio")).toBe("Entrada com 120.300 km, tanque cheio");
    expect(textoEntrada(120300, "reserva")).toBe("Entrada com 120.300 km, tanque na reserva");
    expect(textoEntrada(120300, null)).toBe("Entrada com 120.300 km");
    expect(textoEntrada(null, null)).toBe("Km não anotada");
    expect(textoEntrada(null, "1/2")).toBe("Km não anotada, tanque 1/2");
  });
});
