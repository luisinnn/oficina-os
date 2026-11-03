import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Ticket 12: deploy/deploy.sh, o script que roda na VPS a cada deploy. Aqui o
// "docker" e o "curl" são falsos: só anotam como foram chamados.

const BASH =
  process.env.GIT_BASH ?? (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash");
const SCRIPT = resolve("deploy/deploy.sh");
const SHA = "0123456789abcdef0123456789abcdef01234567";

let pasta: string; // pasta do app na VPS (/opt/oficina-os)
let bin: string; // docker e curl falsos
let log: string;

function noBash(caminho: string): string {
  if (process.platform !== "win32") return caminho;
  return caminho.replace(/^([A-Za-z]):/, (_, d: string) => "/" + d.toLowerCase()).replaceAll("\\", "/");
}

function falso(nome: string, corpo: string) {
  const arquivo = join(bin, nome);
  writeFileSync(arquivo, `#!/usr/bin/env bash\necho "${nome} $*" >> "$LOG"\n${corpo}\n`);
  chmodSync(arquivo, 0o755);
}

// curl falso. API do GitHub (compare): responde com o status COMPARE (padrão
// "behind" = o commit está na main). Resto: grava "conteúdo de <url>" no -o.
// CURL_FALHA=1 faz o download dos arquivos falhar.
const CURL = `
while [ $# -gt 0 ]; do
  case "$1" in -o) saida="$2"; shift;; http*) url="$1";; esac
  shift
done
if [[ "$url" == https://api.github.com/* ]]; then
  [ "\${COMPARE:-behind}" = inexistente ] && exit 22
  printf '{\\n  "status": "%s",\\n  "ahead_by": 0\\n}\\n' "\${COMPARE:-behind}"
  exit 0
fi
[ "\${CURL_FALHA:-}" = 1 ] && exit 22
echo "conteúdo de $url" > "$saida"`;

// docker falso: DOCKER_PULL_FALHA=1 faz o "compose pull" falhar.
const DOCKER = `[[ "\${DOCKER_PULL_FALHA:-}" = 1 && "$*" == *pull* ]] && exit 1; exit 0`;

function deploy(args: string[], env: Record<string, string> = {}) {
  // O bash.exe do Git põe as pastas dele na frente do PATH: o PATH dos falsos
  // é montado já dentro do bash.
  return execFileSync(BASH, ["-c", 'PATH="$BIN:$PATH" exec bash "$0" "$@"', noBash(SCRIPT), ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BIN: noBash(bin),
      PASTA: noBash(pasta),
      LOG: noBash(log),
      MSYS_NO_PATHCONV: "1",
      ...env,
    },
  });
}

const chamadas = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
const docker = () => chamadas().filter((c) => c.startsWith("docker "));

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "deploy-"));
  bin = join(pasta, "..", `${pasta.split(/[\\/]/).pop()}-bin`);
  mkdirSync(bin);
  log = join(bin, "log.txt");
  falso("curl", CURL);
  falso("docker", DOCKER);
  writeFileSync(join(pasta, "config.env"), "DOMINIO=oficina.exemplo.com.br\n");
});

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

describe("deploy.sh", () => {
  it("baixa compose.yml e Caddyfile do commit, grava o TAG e sobe os containers", () => {
    deploy([SHA]);

    const base = `https://raw.githubusercontent.com/luisinnn/oficina-os/${SHA}/deploy`;
    expect(readFileSync(join(pasta, "compose.yml"), "utf8")).toBe(`conteúdo de ${base}/compose.yml\n`);
    expect(readFileSync(join(pasta, "Caddyfile"), "utf8")).toBe(`conteúdo de ${base}/Caddyfile\n`);
    expect(readFileSync(join(pasta, ".env"), "utf8")).toBe(`DOMINIO=oficina.exemplo.com.br\nTAG=${SHA}\n`);
    expect(chamadas()[0]).toBe(`curl -fsSL https://api.github.com/repos/luisinnn/oficina-os/compare/main...${SHA}`);
    expect(docker()).toEqual([
      // O pull usa os arquivos novos antes de trocar: se falhar, nada muda.
      "docker compose --env-file .env.novo -f compose.yml.novo pull",
      "docker compose up -d --remove-orphans",
      // Só as imagens deste app (label do build), não as de outros containers.
      "docker image prune -af --filter label=org.opencontainers.image.source=https://github.com/luisinnn/oficina-os",
    ]);
  });

  it("aceita o commit pelo SSH_ORIGINAL_COMMAND (chave com command= no authorized_keys)", () => {
    deploy([], { SSH_ORIGINAL_COMMAND: SHA });
    expect(readFileSync(join(pasta, ".env"), "utf8")).toContain(`TAG=${SHA}`);
  });

  it.each([["main"], [`${SHA}; rm -rf /`], [SHA.slice(0, 39)], [SHA.toUpperCase()], [""]])(
    "recusa %j (só aceita o SHA completo do commit) e não chama nada",
    (tag) => {
      expect(() => deploy([], { SSH_ORIGINAL_COMMAND: tag })).toThrow();
      expect(chamadas()).toEqual([]);
    },
  );

  it("se o download falhar, não mexe nos arquivos nem nos containers", () => {
    writeFileSync(join(pasta, "compose.yml"), "antigo");
    writeFileSync(join(pasta, ".env"), "DOMINIO=oficina.exemplo.com.br\nTAG=antigo\n");

    expect(() => deploy([SHA], { CURL_FALHA: "1" })).toThrow();

    expect(readFileSync(join(pasta, "compose.yml"), "utf8")).toBe("antigo");
    expect(readFileSync(join(pasta, ".env"), "utf8")).toContain("TAG=antigo");
    expect(docker()).toEqual([]);
  });

  it.each([["diverged"], ["ahead"], ["inexistente"]])(
    "recusa commit que não está na main (compare: %s) e não chama o docker",
    (status) => {
      expect(() => deploy([SHA], { COMPARE: status })).toThrow();
      expect(docker()).toEqual([]);
      expect(existsSync(join(pasta, ".env"))).toBe(false);
    },
  );

  it("se o pull da imagem falhar, os arquivos e o .env continuam os antigos", () => {
    writeFileSync(join(pasta, "compose.yml"), "antigo");
    writeFileSync(join(pasta, ".env"), "DOMINIO=oficina.exemplo.com.br\nTAG=antigo\n");

    expect(() => deploy([SHA], { DOCKER_PULL_FALHA: "1" })).toThrow();

    expect(readFileSync(join(pasta, "compose.yml"), "utf8")).toBe("antigo");
    expect(readFileSync(join(pasta, ".env"), "utf8")).toContain("TAG=antigo");
    expect(docker()).toEqual(["docker compose --env-file .env.novo -f compose.yml.novo pull"]);
    expect(existsSync(join(pasta, "compose.yml.novo"))).toBe(false);
  });

  it("falha sem o config.env (com o DOMINIO) e não chama o docker", () => {
    rmSync(join(pasta, "config.env"));
    expect(() => deploy([SHA])).toThrow();
    expect(docker()).toEqual([]);
  });
});
