"use client";

import { useActionState } from "react";
import { buscarPlaca } from "./actions";

export function FormBuscaPlaca() {
  const [estado, enviar, pendente] = useActionState(buscarPlaca, {});

  return (
    <form action={enviar} role="search">
      <label htmlFor="busca-placa" className="text-sm font-medium text-zinc-700">
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
          className="min-h-12 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base uppercase text-zinc-900 focus:border-blue-500 focus:outline-none aria-invalid:border-red-500"
        />
        <button
          type="submit"
          disabled={pendente}
          className="min-h-12 shrink-0 rounded-md border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
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
