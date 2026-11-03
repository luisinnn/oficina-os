import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTAINER, sqlAdmin } from "../banco/admin";
import { montarOficina, type Oficina } from "../seguranca/cenario";

// Ticket 11: os scripts que o workflow de backup usa (scripts/backup/), rodando
// contra o Supabase local. O pg_dump e o psql são os do container (mesma versão
// do Postgres); o gpg é o da máquina, como no runner do GitHub.

// No Windows, "bash" no PATH costuma ser o do WSL; o do Git é o que tem gpg.
// GIT_BASH muda o caminho se o Git estiver instalado em outro lugar.
const BASH =
  process.env.GIT_BASH ?? (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash");
const SENHA = "senha-do-backup-de-teste";
// Endereços vistos de dentro do container.
const ORIGEM = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const BANCO_RESTAURO = "restauro_teste";
const DESTINO = `postgresql://supabase_admin:postgres@127.0.0.1:5432/${BANCO_RESTAURO}`;

let pasta: string;
let gpgHome: string;
let arquivo: string;
let A: Oficina;

// Caminho do Windows (C:\x\y) no formato do Git Bash (/c/x/y); no Linux não muda.
function noBash(caminho: string): string {
  if (process.platform !== "win32") return caminho;
  return caminho.replace(/^([A-Za-z]):/, (_, d: string) => "/" + d.toLowerCase()).replaceAll("\\", "/");
}

function rodar(script: string, args: string[], env: Record<string, string>): string {
  return execFileSync(BASH, [`scripts/backup/${script}`, ...args.map(noBash)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // GNUPGHOME separado: não mexe no gpg do usuário. MSYS_NO_PATHCONV: o Git
    // Bash não "corrige" os argumentos que parecem caminho (a URL do banco).
    env: { ...process.env, GNUPGHOME: noBash(gpgHome), MSYS_NO_PATHCONV: "1", ...env },
  });
}

function gerar(saida = arquivo, env: Record<string, string> = {}) {
  return rodar("gerar.sh", [saida], {
    DB_URL: ORIGEM,
    BACKUP_PASSPHRASE: SENHA,
    PG_DUMP: `docker exec -i ${CONTAINER} pg_dump`,
    ...env,
  });
}

function restaurar(entrada = arquivo, senha = SENHA) {
  return rodar("restaurar.sh", [entrada], {
    DB_URL: DESTINO,
    BACKUP_PASSPHRASE: senha,
    PSQL: `docker exec -i ${CONTAINER} psql`,
  });
}

// SQL no banco de restauração, como superusuário.
const sqlRestauro = (sql: string) => sqlAdmin(sql, DESTINO);

// Banco vazio com a mesma estrutura do local (como um "db reset" faria), mas
// separado: restaurar nele não apaga nada dos outros testes.
function criarBancoVazio() {
  sqlAdmin(`drop database if exists ${BANCO_RESTAURO} with (force);`);
  sqlAdmin(`create database ${BANCO_RESTAURO};`);
  // O banco novo já vem com um schema public vazio; o dump cria o dele.
  sqlRestauro("drop schema public; create schema extensions; create extension pgcrypto schema extensions;");
  const estrutura = execFileSync(
    "docker",
    ["exec", CONTAINER, "pg_dump", "-U", "supabase_admin", "--schema-only", "-n", "public", "-n", "auth", "postgres"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  sqlRestauro(estrutura);
}

beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), "backup-"));
  gpgHome = mkdtempSync(join(tmpdir(), "gnupg-"));
  arquivo = join(pasta, "backup.sql.gpg");
  A = await montarOficina("A");
  gerar();
  criarBancoVazio();
}, 120_000);

afterAll(() => {
  try {
    sqlAdmin(`drop database if exists ${BANCO_RESTAURO} with (force);`);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
    rmSync(gpgHome, { recursive: true, force: true });
  }
});

// O banco local cresce a cada rodada dos testes: backup e restauração demoram.
describe("gerar.sh", { timeout: 60_000 }, () => {
  it("gera um arquivo gpg em que nenhum dado aparece legível", () => {
    const bruto = readFileSync(arquivo);
    expect(bruto.length).toBeGreaterThan(0);
    // Primeiro pacote OpenPGP de um arquivo cifrado com senha (SKESK).
    expect([0x8c, 0xc3]).toContain(bruto[0]);
    const texto = bruto.toString("latin1");
    for (const dado of [A.nomeCliente, A.telefoneCliente, A.placa, A.usuario.email, A.obsInterna, "COPY"]) {
      expect(texto, dado).not.toContain(dado);
    }
  });

  it("falha sem senha e não deixa arquivo pela metade", () => {
    const outro = join(pasta, "sem-senha.sql.gpg");
    expect(() => gerar(outro, { BACKUP_PASSPHRASE: "" })).toThrow();
    expect(() => readFileSync(outro)).toThrow();
  });

  it("falha se o pg_dump falhar (banco errado) e não deixa arquivo", () => {
    const outro = join(pasta, "banco-errado.sql.gpg");
    expect(() => gerar(outro, { DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/banco_que_nao_existe" })).toThrow();
    expect(() => readFileSync(outro)).toThrow();
  });
});

describe("restaurar.sh", { timeout: 60_000 }, () => {
  it("com a senha errada não restaura nada", () => {
    expect(() => restaurar(arquivo, "senha-errada")).toThrow();
    expect(sqlRestauro("select count(*) from public.oficinas")).toBe("0");
  });

  it("com o arquivo cortado no meio não restaura nada (nem a parte boa)", () => {
    const bruto = readFileSync(arquivo);
    const cortado = join(pasta, "cortado.sql.gpg");
    writeFileSync(cortado, bruto.subarray(0, Math.floor(bruto.length * 0.9)));
    expect(() => restaurar(cortado)).toThrow();
    expect(sqlRestauro("select count(*) from public.oficinas")).toBe("0");
  });

  it("restaura num banco vazio com os mesmos dados, sem os triggers mexerem", () => {
    restaurar();

    // Cada tabela de dados volta com o mesmo número de linhas.
    for (const tabela of [
      "auth.users",
      "auth.identities",
      "public.oficinas",
      "public.oficina_membros",
      "public.clientes",
      "public.veiculos",
      "public.ordens",
      "public.orcamentos",
      "public.orcamento_itens",
      "public.orcamento_respostas",
      "public.pre_cadastros",
    ]) {
      const sql = `select count(*) from ${tabela}`;
      expect(sqlRestauro(sql), tabela).toBe(sqlAdmin(sql));
    }

    // As OS de A com o mesmo número e status (o trigger de numeração não rodou
    // de novo) e o usuário de A consegue ser achado pelo e-mail.
    const ordensDeA = `select numero || ':' || status from public.ordens where oficina_id = '${A.oficina}' order by numero`;
    expect(sqlRestauro(ordensDeA)).toBe(sqlAdmin(ordensDeA));
    expect(sqlRestauro(`select count(*) from auth.users where email = lower('${A.usuario.email}')`)).toBe("1");
    const cliente = `select nome from public.clientes where id = '${A.cliente}'`;
    expect(sqlRestauro(cliente)).toBe(A.nomeCliente);
  });

  it("não restaura duas vezes por cima (tudo ou nada)", () => {
    const antes = sqlRestauro("select count(*) from public.ordens");
    expect(() => restaurar()).toThrow();
    expect(sqlRestauro("select count(*) from public.ordens")).toBe(antes);
  });
});
