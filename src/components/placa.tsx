import { formatarPlaca } from "@/lib/formatos";

const TAMANHO = {
  p: "px-1.5 text-xl",
  m: "px-2 text-titulo",
  g: "px-3 text-destaque",
};

// A placa desenhada como a chapa do Mercosul: branca, borda escura e faixa
// azul no topo. Para o leitor de tela é só o texto da placa.
export function Placa({ placa, tamanho = "m" }: { placa: string; tamanho?: keyof typeof TAMANHO }) {
  return (
    <span className="inline-flex flex-col overflow-hidden rounded border-2 border-grafite bg-chapa align-middle">
      <span aria-hidden="true" className="h-1.5 bg-placa" />
      <span className={`py-0.5 font-condensada font-bold leading-none tracking-wide text-grafite ${TAMANHO[tamanho]}`}>
        {formatarPlaca(placa)}
      </span>
    </span>
  );
}
