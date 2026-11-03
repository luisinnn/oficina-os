import { describe, expect, it } from "vitest";
import { linkAprovacao, linkWhatsApp, mensagemOrcamento, type DadosMensagem } from "./whatsapp";

const dados: DadosMensagem = {
  nomeCliente: "João da Silva",
  modelo: "Gol 1.0",
  placa: "ABC1D23",
  oficina: "Oficina do Zé",
  numero: 42,
  km: 120300,
  totalCentavos: 123456,
  link: "https://oficina.exemplo/aprovar/abc_DEF-123",
};

describe("mensagemOrcamento", () => {
  it("monta o texto fixo com primeiro nome, carro, oficina, OS, km, total e link", () => {
    expect(mensagemOrcamento(dados)).toBe(
      "Olá, João! Segue o orçamento do Gol 1.0 (ABC1D23) na Oficina do Zé, OS #42, entrada com 120.300 km: " +
        "total R$ 1.234,56. " +
        "Para aprovar ou recusar: https://oficina.exemplo/aprovar/abc_DEF-123",
    );
  });

  it("OS antiga sem km: a mensagem não fala de km", () => {
    expect(mensagemOrcamento({ ...dados, km: null })).toContain("OS #42: total R$ 1.234,56.");
  });

  it("primeiro nome ignora espaços sobrando", () => {
    expect(mensagemOrcamento({ ...dados, nomeCliente: "  Maria   Clara " })).toMatch(/^Olá, Maria! /);
  });

  it("nome de uma palavra só fica inteiro", () => {
    expect(mensagemOrcamento({ ...dados, nomeCliente: "Zé" })).toMatch(/^Olá, Zé! /);
  });

  it("total zero e centavos", () => {
    expect(mensagemOrcamento({ ...dados, totalCentavos: 0 })).toContain("total R$ 0,00.");
    expect(mensagemOrcamento({ ...dados, totalCentavos: 99 })).toContain("total R$ 0,99.");
  });
});

describe("linkWhatsApp", () => {
  it("põe o 55 na frente do telefone e codifica o texto", () => {
    expect(linkWhatsApp("47999990000", "Oi")).toBe("https://wa.me/5547999990000?text=Oi");
  });

  it("aceita fixo (10 dígitos)", () => {
    expect(linkWhatsApp("4733330000", "Oi")).toBe("https://wa.me/554733330000?text=Oi");
  });

  it.each([
    ["acento e ç", "Olá, ação", "Ol%C3%A1%2C%20a%C3%A7%C3%A3o"],
    ["&, = e ? não quebram a URL", "a&b=c?d", "a%26b%3Dc%3Fd"],
    ["quebra de linha", "linha 1\nlinha 2", "linha%201%0Alinha%202"],
    ["# não vira âncora", "OS #42", "OS%20%2342"],
    ["+ não vira espaço", "1+1", "1%2B1"],
    ["emoji", "🔧", "%F0%9F%94%A7"],
  ])("%s", (_nome, texto, codificado) => {
    const link = linkWhatsApp("47999990000", texto);
    expect(link).toBe(`https://wa.me/5547999990000?text=${codificado}`);
    // Quem abre o link lê de volta exatamente o texto original.
    expect(new URL(link).searchParams.get("text")).toBe(texto);
  });

  it("a mensagem inteira volta igual depois de decodificar", () => {
    const texto = mensagemOrcamento(dados);
    expect(new URL(linkWhatsApp("47999990000", texto)).searchParams.get("text")).toBe(texto);
  });

  it.each(["", "999990000", "479999900001", "(47) 99999-0000", "5547999990000"])(
    "recusa telefone fora do formato do banco: %j",
    (telefone) => {
      expect(() => linkWhatsApp(telefone, "Oi")).toThrow();
    },
  );
});

describe("linkAprovacao", () => {
  it("junta o endereço do site com o token", () => {
    expect(linkAprovacao("https://oficina.exemplo", "abc_DEF-123")).toBe("https://oficina.exemplo/aprovar/abc_DEF-123");
  });
});
