import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SENHA } from "../banco/usuarios";
import { montarOficina, type Oficina } from "./cenario";

// Ticket 10: a "lista manual" rodada por um navegador de verdade. Duas oficinas
// novas (A e B) são montadas pela API; o navegador entra como A e confere que
// nada de B chega até ele, e que as páginas públicas não entregam dados internos.
// Rodar: npm run dev (num terminal) e depois npm run test:navegador.

const app = process.env.APP_URL!;

let navegador: Browser;
let A: Oficina;
let B: Oficina;

beforeAll(async () => {
  A = await montarOficina("A");
  B = await montarOficina("B");
  navegador = await chromium.launch();
});

afterAll(async () => {
  await navegador?.close();
});

// Ids internos da oficina (nunca saem do painel dela).
function ids(o: Oficina): string[] {
  return [
    o.oficina,
    o.ordem,
    o.ordemFechada,
    o.cliente,
    o.veiculo,
    o.orcamento,
    o.orcamentoRespondido,
    o.item,
    o.resposta,
    o.preCadastro,
    o.usuario.id,
  ];
}

// Telefone do cliente (cru e formatado) e outros dados privados.
function privados(o: Oficina, apelido: string): string[] {
  const t = o.telefoneCliente;
  return [t, `${t.slice(2, 7)}-${t.slice(7)}`, o.obsInterna, o.usuario.email, `Visitante ${apelido}`];
}

// Tudo de uma oficina que outra não pode ver.
function tudoDe(o: Oficina, apelido: string): string[] {
  const placas = [1, 2, 3].map((n) => o.placa.replace(/\d$/, String(n)));
  return [...ids(o), ...privados(o, apelido), o.nomeCliente, o.codigoPublico, ...placas];
}

// Guarda o corpo de toda resposta que o navegador recebe (HTML, payload do
// React, JSON...): o que aparece na aba Rede do DevTools.
function gravarRede(page: Page): () => Promise<string[]> {
  const corpos: Promise<string>[] = [];
  page.on("response", (r) => {
    corpos.push(r.text().catch(() => ""));
  });
  return () => Promise.all(corpos);
}

function vazamentos(corpos: string[], proibidos: string[]): string[] {
  return proibidos.filter((p) => corpos.some((c) => c.includes(p)));
}

async function entrarComo(o: Oficina): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await navegador.newContext();
  const page = await contexto.newPage();
  await page.goto(`${app}/login`);
  await page.getByLabel("E-mail").fill(o.usuario.email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/painel/);
  return { contexto, page };
}

async function visitar(page: Page, rota: string) {
  await page.goto(`${app}${rota}`);
  await page.waitForLoadState("networkidle");
}

describe("navegador logado como A", () => {
  it("navegando pelo painel, nenhuma resposta de rede tem dado de B", async () => {
    const { contexto, page } = await entrarComo(A);
    const corpos = gravarRede(page);

    for (const rota of [
      "/painel",
      `/painel/os/${A.ordem}`,
      `/painel/os/${A.ordemFechada}`,
      `/painel/os/${A.ordem}/itens/${A.item}`,
      `/painel/placa/${A.placa}`,
      "/painel/historico",
      "/painel/configuracoes",
      `/painel/pre-cadastros/${A.preCadastro}`,
    ]) {
      await visitar(page, rota);
    }

    const tudo = await corpos();
    // Controle: se os dados de A aparecem, a gravação está funcionando.
    expect(tudo.some((c) => c.includes(A.nomeCliente))).toBe(true);
    expect(vazamentos(tudo, tudoDe(B, "B"))).toEqual([]);
    await contexto.close();
  });

  it("abrir páginas de B pelo endereço dá 'não encontrado' e não mostra nada de B", async () => {
    const { contexto, page } = await entrarComo(A);
    const corpos = gravarRede(page);

    const rotas = [
      `/painel/os/${B.ordem}`,
      `/painel/os/${B.ordemFechada}`,
      `/painel/os/${B.ordem}/itens/${B.item}`,
      `/painel/os/${B.ordem}/itens/novo`,
      `/painel/pre-cadastros/${B.preCadastro}`,
    ];
    for (const rota of rotas) {
      await visitar(page, rota);
      expect(await page.textContent("body"), rota).toMatch(/could not be found/i);
    }
    // Buscar a placa de B não acha o veículo dele.
    await visitar(page, `/painel/placa/${B.placa}`);
    expect(await page.textContent("body")).not.toContain(B.nomeCliente);

    // Os ids e a placa pedidos estão no próprio endereço; o resto de B não
    // pode voltar em nenhuma resposta.
    const pedidos = [B.ordem, B.ordemFechada, B.item, B.preCadastro, B.placa];
    const tudo = await corpos();
    expect(vazamentos(tudo, tudoDe(B, "B").filter((m) => !pedidos.includes(m)))).toEqual([]);
    await contexto.close();
  });
});

describe("aba anônima", () => {
  it("/painel manda para o login", async () => {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    await page.goto(`${app}/painel`);
    expect(new URL(page.url()).pathname).toBe("/login");
    await contexto.close();
  });

  it("aprovação e pré-cadastro abrem sem login e não entregam id interno nem telefone do cliente", async () => {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    const corpos = gravarRede(page);

    const aprovar = await page.goto(`${app}/aprovar/${A.token}`);
    expect(aprovar?.status()).toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    expect(await page.textContent("body")).toContain("Pastilha de freio");

    const pre = await page.goto(`${app}/p/${A.codigoPublico}`);
    expect(pre?.status()).toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    expect(await page.locator("form").count()).toBeGreaterThan(0);

    // Inclui o HTML das duas páginas (o "código-fonte" do Ctrl+U).
    const tudo = await corpos();
    expect(vazamentos(tudo, [...ids(A), ...privados(A, "A")])).toEqual([]);
    // Nenhum dado de B, claro.
    expect(vazamentos(tudo, tudoDe(B, "B"))).toEqual([]);
    await contexto.close();
  });
});
