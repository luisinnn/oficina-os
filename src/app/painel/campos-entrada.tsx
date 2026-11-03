// Campos de km e tanque da chegada do carro (ticket 15). Usados na nova OS,
// na confirmação do pré-cadastro e no detalhe da OS (corrigir km / anotar
// tanque depois). Sem estado: o valor inicial vem de quem usa.

import { type AvisoDeKm, ROTULO_TANQUE, TANQUES } from "@/lib/km";

const classeCampo =
  "mt-1 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-placa focus:outline-none aria-invalid:border-red-500";

function Erro({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <span id={id} className="mt-1 block text-sm text-red-700">
      {erro}
    </span>
  );
}

export function CampoKm({ valor, erro }: { valor: string; erro?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">Km do painel</span>
      <input
        name="km"
        inputMode="numeric"
        maxLength={12}
        autoComplete="off"
        placeholder="120.000"
        defaultValue={valor}
        className={classeCampo}
        {...(erro ? { "aria-invalid": true, "aria-describedby": "erro-km" } : {})}
      />
      <Erro id="erro-km" erro={erro} />
    </label>
  );
}

// Km menor que a da última OS do carro: avisa, mas deixa salvar (painel
// trocado ou erro antigo acontecem). O botão reenvia o formulário com
// km_conferida = a km avisada; se a pessoa corrigir a km, o servidor confere
// de novo. "acao" repete o botão que foi tocado (pré-cadastro).
export function AvisoKm({
  aviso,
  pendente,
  acao,
}: {
  aviso: AvisoDeKm;
  pendente: boolean;
  acao?: string;
}) {
  return (
    <div role="alert" className="space-y-3 rounded-md bg-amber-50 p-3 text-zinc-900">
      <input type="hidden" name="km_conferida" value={aviso.km} />
      <p>{aviso.texto}</p>
      <button
        type="submit"
        {...(acao ? { name: "acao", value: acao } : {})}
        disabled={pendente}
        className="min-h-12 w-full rounded-md bg-placa px-4 py-2 font-medium text-white hover:bg-placa-escuro disabled:opacity-50"
      >
        {pendente ? "Salvando..." : "Sim, está certa"}
      </button>
      <p className="text-sm text-zinc-700">Se estiver errada, corrija a km acima e toque no botão de novo.</p>
    </div>
  );
}

// Um toque por opção. Opcional: nenhuma marcada = não anotado.
export function CampoTanque({ valor, erro }: { valor: string; erro?: string }) {
  return (
    <fieldset {...(erro ? { "aria-describedby": "erro-tanque" } : {})}>
      <legend className="text-sm font-medium text-zinc-700">Tanque (opcional)</legend>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {TANQUES.map((t) => (
          <label
            key={t}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-800 has-checked:border-placa has-checked:bg-placa has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-placa"
          >
            <input type="radio" name="tanque" value={t} defaultChecked={valor === t} className="sr-only" />
            {ROTULO_TANQUE[t]}
          </label>
        ))}
      </div>
      <Erro id="erro-tanque" erro={erro} />
    </fieldset>
  );
}
