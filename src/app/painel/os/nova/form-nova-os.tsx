"use client";
// Formulário da nova OS. Os 6 campos obrigatórios (com a km de entrada) e o
// tanque ficam à vista; a observação interna fica no bloco recolhido
// "Mais detalhes".

import Link from "next/link";
import { useActionState } from "react";
import { AvisoKm, CampoKm, CampoTanque } from "../../campos-entrada";
import {
  type CampoOrdem,
  MODELO_MAX,
  NOME_CLIENTE_MAX,
  OBS_MAX,
  PROBLEMA_MAX,
  type ValoresOrdem,
} from "@/lib/validacao-ordem";
import { criarOrdem } from "./actions";

const classeCampo =
  "mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-placa focus:outline-none aria-invalid:border-red-500";
const classeBotao =
  "min-h-12 w-full rounded-md bg-placa px-4 py-2 font-medium text-white hover:bg-placa-escuro disabled:opacity-50";

export function FormNovaOs({ inicial }: { inicial: ValoresOrdem }) {
  const [estado, enviar, pendente] = useActionState(criarOrdem, {});
  // Depois de enviar, mostra de novo o que foi digitado.
  const valores = estado.valores ?? inicial;
  const erros = estado.erros ?? {};

  // Liga o campo à mensagem de erro dele (leitor de tela e borda vermelha).
  const erroDe = (campo: CampoOrdem) =>
    erros[campo]
      ? { "aria-invalid": true, "aria-describedby": `erro-${campo}` }
      : {};

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <Campo rotulo="Placa" campo="placa" erro={erros.placa}>
        <input
          name="placa"
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABC1D23"
          defaultValue={valores.placa}
          className={`${classeCampo} uppercase`}
          {...erroDe("placa")}
        />
      </Campo>

      <Campo rotulo="Modelo" campo="modelo" erro={erros.modelo}>
        <input
          name="modelo"
          maxLength={MODELO_MAX}
          autoCapitalize="words"
          autoComplete="off"
          placeholder="Gol 1.0"
          defaultValue={valores.modelo}
          className={classeCampo}
          {...erroDe("modelo")}
        />
      </Campo>

      <CampoKm valor={valores.km} erro={erros.km} />

      <Campo rotulo="Nome do cliente" campo="nome" erro={erros.nome}>
        <input
          name="nome"
          maxLength={NOME_CLIENTE_MAX}
          autoCapitalize="words"
          autoComplete="off"
          defaultValue={valores.nome}
          className={classeCampo}
          {...erroDe("nome")}
        />
      </Campo>

      <Campo rotulo="Telefone (WhatsApp)" campo="telefone" erro={erros.telefone}>
        <input
          name="telefone"
          type="tel"
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          placeholder="(47) 99999-0000"
          defaultValue={valores.telefone}
          className={classeCampo}
          {...erroDe("telefone")}
        />
      </Campo>

      <Campo rotulo="Problema" campo="problema" erro={erros.problema}>
        <textarea
          name="problema"
          rows={3}
          maxLength={PROBLEMA_MAX}
          autoCapitalize="sentences"
          defaultValue={valores.problema}
          className={classeCampo}
          {...erroDe("problema")}
        />
      </Campo>

      <CampoTanque valor={valores.tanque} erro={erros.tanque} />

      {/* Abre sozinho se já tem algo digitado ou com erro aqui dentro. */}
      <details open={Boolean(valores.obs || erros.obs)} className="rounded-md border border-zinc-200 px-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-zinc-700">
          Mais detalhes
        </summary>
        <div className="space-y-4 pb-4">
          <Campo rotulo="Observação interna (o cliente não vê)" campo="obs" erro={erros.obs}>
            <textarea
              name="obs"
              rows={2}
              maxLength={OBS_MAX}
              autoCapitalize="sentences"
              defaultValue={valores.obs}
              className={classeCampo}
              {...erroDe("obs")}
            />
          </Campo>
        </div>
      </details>

      {estado.erro && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{estado.erro}</p>
          {estado.ordemAberta && (
            <Link
              href={`/painel/os/${estado.ordemAberta.id}`}
              className="mt-1 flex min-h-12 items-center font-medium underline"
            >
              Abrir a OS #{estado.ordemAberta.numero}
            </Link>
          )}
        </div>
      )}

      {/* Km já conferida no aviso: continua valendo na pergunta de troca de dono. */}
      {!estado.avisoKm && estado.kmConferida !== undefined && (
        <input type="hidden" name="km_conferida" value={estado.kmConferida} />
      )}

      {estado.avisoKm ? (
        <AvisoKm aviso={estado.avisoKm} pendente={pendente} />
      ) : estado.confirmarTroca ? (
        // Nome ou telefone diferente do dono: os dois botões reenviam o formulário
        // com a resposta. A chave faz a resposta valer só para estes dados; se a
        // pessoa mudar placa, nome ou telefone, o servidor pergunta de novo.
        <div role="alert" className="space-y-3 rounded-md bg-amber-50 p-3 text-zinc-900">
          <input type="hidden" name="pergunta_troca" value={estado.confirmarTroca.chave} />
          <p className="break-words">
            Este carro está no nome de <strong>{estado.confirmarTroca.donoAtual}</strong>. Trocar dono para{" "}
            <strong>{estado.confirmarTroca.donoNovo}</strong>?
          </p>
          <button type="submit" name="trocar_dono" value="sim" disabled={pendente} className={classeBotao}>
            Sim, trocar dono
          </button>
          <button
            type="submit"
            name="trocar_dono"
            value="nao"
            disabled={pendente}
            className="min-h-12 w-full rounded-md border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Não, manter o dono atual
          </button>
        </div>
      ) : (
        <button type="submit" disabled={pendente} className={classeBotao}>
          {pendente ? "Salvando..." : "Salvar OS"}
        </button>
      )}
    </form>
  );
}

function Campo({
  rotulo,
  campo,
  erro,
  children,
}: {
  rotulo: string;
  campo: CampoOrdem;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
      {children}
      {erro && (
        <span id={`erro-${campo}`} className="mt-1 block text-sm text-red-700">
          {erro}
        </span>
      )}
    </label>
  );
}
