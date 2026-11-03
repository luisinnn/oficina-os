"use client";

import { useActionState } from "react";
import { buscarPlaca } from "./actions";

export function FormBuscaPlaca() {
  const [estado, enviar, pendente] = useActionState(buscarPlaca, {});

  return (
    <form action={enviar} role="search">
      <label htmlFor="busca-placa" className="text-sm font-semibold">
        Buscar placa
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="busca-placa"
          name="placa"
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="ABC1D23"
          defaultValue={estado.placa}
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? "erro-busca" : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-zinc-500 bg-chapa px-3 py-2 font-condensada text-titulo font-bold uppercase tracking-wide text-grafite placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal focus:border-placa focus:outline-none aria-invalid:border-red-500"
        />
        <button
          type="submit"
          disabled={pendente}
          className="min-h-12 shrink-0 rounded-lg border-2 border-grafite bg-chapa px-4 font-semibold text-grafite hover:bg-zinc-100 disabled:opacity-50"
        >
          Buscar
        </button>
      </div>
      {estado.erro && (
        <p id="erro-busca" className="mt-1 text-sm text-red-700">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
