"use client";
// Link de pré-cadastro: copiar e "Gerar novo link" (pede confirmação, porque
// o link antigo para de funcionar).

import { Fragment, useActionState, useState } from "react";
import { type EstadoLink, gerarNovoLink } from "./actions";

const classeBotao = "min-h-12 w-full rounded-md px-4 py-2 font-medium disabled:opacity-50";
const secundario = `${classeBotao} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;

export function LinkPreCadastro({ link }: { link: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);
  // Terminou de gerar (ou falhou): fecha a confirmação. O link novo chega pela
  // página, que é recarregada pela action.
  const [estado, gerar, pendente] = useActionState(async (): Promise<EstadoLink> => {
    const resultado = await gerarNovoLink();
    setConfirmando(false);
    setCopiado(null);
    return resultado;
  }, {});

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado("sim");
    } catch {
      // Sem permissão ou fora de https (ex.: celular no IP do PC).
      setCopiado("falhou");
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={link}
        aria-label="Link de pré-cadastro"
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-12 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
      />
      <button type="button" onClick={copiar} className={`${classeBotao} bg-placa text-white hover:bg-placa-escuro`}>
        {copiado === "sim" ? "Copiado!" : "Copiar"}
      </button>
      {copiado === "falhou" && (
        <p role="alert" className="text-sm text-red-700">
          Não deu para copiar. Toque no link acima e copie à mão.
        </p>
      )}

      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      {estado.mensagem && !confirmando && (
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          {estado.mensagem}
        </p>
      )}

      {/* Keys diferentes: elementos novos ao trocar de tela, para nenhum botão
          virar "submit" no meio do clique (lição do Recusar, ticket 08). */}
      {confirmando ? (
        <Fragment key="confirmando">
          <p className="rounded-md bg-amber-50 p-3 text-sm text-zinc-900">
            O link atual para de funcionar na hora. Quem tiver o antigo vai precisar do novo. Gerar mesmo assim?
          </p>
          <form action={gerar}>
            <button
              type="submit"
              disabled={pendente}
              className={`${classeBotao} bg-red-600 text-white hover:bg-red-700`}
            >
              {pendente ? "Gerando..." : "Sim, gerar novo link"}
            </button>
          </form>
          <button type="button" onClick={() => setConfirmando(false)} disabled={pendente} className={secundario}>
            Cancelar
          </button>
        </Fragment>
      ) : (
        <Fragment key="inicio">
          <button type="button" onClick={() => setConfirmando(true)} disabled={pendente} className={secundario}>
            Gerar novo link
          </button>
        </Fragment>
      )}
    </div>
  );
}
