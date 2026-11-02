"use client";
// Formulário de item do orçamento (novo ou edição) e o botão de remover.
// Se o orçamento já foi enviado ao cliente, avisa que salvar anula o link.

import { useActionState, useState } from "react";
import { type CampoItem, DESCRICAO_MAX, ROTULO_TIPO, type TipoItem, type ValoresItem } from "@/lib/orcamento";
import { removerItem, salvarItem } from "./actions";

const classeCampo =
  "mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none aria-invalid:border-red-500";
const classeBotao =
  "min-h-12 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50";

const AVISO_LINK = "Este orçamento já foi enviado. Isso invalida o link enviado ao cliente, e vai ser preciso enviar de novo.";

export function FormItem({
  alvo,
  inicial,
  enviado,
}: {
  // Item novo vai para o orçamento; edição muda o item.
  alvo: { orcamentoId: string } | { itemId: string };
  inicial: ValoresItem;
  // Orçamento já enviado ou respondido.
  enviado: boolean;
}) {
  const [estado, enviar, pendente] = useActionState(salvarItem, {});
  const valores = estado.valores ?? inicial;
  const erros = estado.erros ?? {};

  const erroDe = (campo: CampoItem) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": `erro-${campo}` } : {};

  return (
    <form action={enviar} className="space-y-4" noValidate>
      {"itemId" in alvo ? (
        <input type="hidden" name="item_id" value={alvo.itemId} />
      ) : (
        <input type="hidden" name="orcamento_id" value={alvo.orcamentoId} />
      )}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Tipo</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(Object.keys(ROTULO_TIPO) as TipoItem[]).map((tipo) => (
            <label
              key={tipo}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-3 font-medium text-zinc-700 has-checked:border-blue-600 has-checked:bg-blue-50 has-checked:text-blue-800"
            >
              <input
                type="radio"
                name="tipo"
                value={tipo}
                defaultChecked={valores.tipo === tipo}
                className="sr-only"
              />
              {ROTULO_TIPO[tipo]}
            </label>
          ))}
        </div>
        <Erro campo="tipo" erro={erros.tipo} />
      </fieldset>

      <Campo rotulo="Descrição" campo="descricao" erro={erros.descricao}>
        <input
          name="descricao"
          maxLength={DESCRICAO_MAX}
          autoCapitalize="sentences"
          autoComplete="off"
          placeholder="Ex.: pastilha de freio dianteira"
          defaultValue={valores.descricao}
          className={classeCampo}
          {...erroDe("descricao")}
        />
      </Campo>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Campo rotulo="Qtd." campo="quantidade" erro={erros.quantidade}>
          <input
            name="quantidade"
            inputMode="numeric"
            maxLength={3}
            autoComplete="off"
            defaultValue={valores.quantidade}
            className={classeCampo}
            {...erroDe("quantidade")}
          />
        </Campo>
        <Campo rotulo="Valor unitário (R$)" campo="valor" erro={erros.valor}>
          <input
            name="valor"
            inputMode="decimal"
            maxLength={15}
            autoComplete="off"
            placeholder="0,00"
            defaultValue={valores.valor}
            className={classeCampo}
            {...erroDe("valor")}
          />
        </Campo>
      </div>

      {enviado && (
        <p role="note" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {AVISO_LINK}
        </p>
      )}

      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={pendente} className={classeBotao}>
        {pendente ? "Salvando..." : enviado ? "Salvar mesmo assim" : "Salvar item"}
      </button>
    </form>
  );
}

// Remover pede confirmação (e repete o aviso do link, se for o caso).
export function RemoverItem({ itemId, enviado }: { itemId: string; enviado: boolean }) {
  const [estado, enviar, pendente] = useActionState(removerItem, {});
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="min-h-12 font-medium text-red-600 underline hover:text-red-800"
      >
        Remover item
      </button>
    );
  }

  return (
    <form action={enviar} className="space-y-3 rounded-md bg-red-50 p-3 text-zinc-900">
      <input type="hidden" name="item_id" value={itemId} />
      <p>Remover este item do orçamento?{enviado && ` ${AVISO_LINK}`}</p>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={pendente}
        className="min-h-12 w-full rounded-md bg-red-600 px-4 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Sim, remover
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        disabled={pendente}
        className="min-h-12 w-full rounded-md border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
      >
        Não, manter
      </button>
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
  campo: CampoItem;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
      {children}
      <Erro campo={campo} erro={erro} />
    </label>
  );
}

function Erro({ campo, erro }: { campo: CampoItem; erro?: string }) {
  if (!erro) return null;
  return (
    <span id={`erro-${campo}`} className="mt-1 block text-sm text-red-700">
      {erro}
    </span>
  );
}
