"use client";
// Formulário do pré-cadastro público. Depois de enviar, some e mostra o recado.

import { useActionState } from "react";
import { type CampoPre, type ValoresPre } from "@/lib/pre-cadastro";
import { MODELO_MAX, NOME_CLIENTE_MAX, PROBLEMA_MAX } from "@/lib/validacao-ordem";
import { enviarPreCadastro } from "./actions";

const classeCampo =
  "mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none aria-invalid:border-red-500";

const VAZIO: ValoresPre = { nome: "", telefone: "", placa: "", modelo: "", problema: "" };

export function FormPreCadastro({ codigo, oficina }: { codigo: string; oficina: string }) {
  const [estado, enviar, pendente] = useActionState(enviarPreCadastro, {});
  const valores = estado.valores ?? VAZIO;
  const erros = estado.erros ?? {};

  if (estado.enviado) {
    return (
      <div role="status" className="rounded-xl bg-green-50 p-4 text-center text-green-900">
        <p className="text-xl font-semibold">Recebido!</p>
        <p className="mt-1">A oficina vai falar com você pelo WhatsApp.</p>
      </div>
    );
  }

  const erroDe = (campo: CampoPre) =>
    erros[campo] ? { "aria-invalid": true, "aria-describedby": `erro-${campo}` } : {};

  return (
    <form action={enviar} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" noValidate>
      <input type="hidden" name="codigo" value={codigo} />

      {/* Isca para robô: fora da tela e fora do Tab. Gente não preenche. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Site
          <input name="site" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <Campo rotulo="Seu nome" campo="nome" erro={erros.nome}>
        <input
          name="nome"
          maxLength={NOME_CLIENTE_MAX}
          autoCapitalize="words"
          autoComplete="name"
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
          autoComplete="tel"
          placeholder="(47) 99999-0000"
          defaultValue={valores.telefone}
          className={classeCampo}
          {...erroDe("telefone")}
        />
      </Campo>

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

      <Campo rotulo="Modelo do carro" campo="modelo" erro={erros.modelo}>
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

      <Campo rotulo="O que o carro tem?" campo="problema" erro={erros.problema}>
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

      {estado.erro && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      <p className="text-sm text-zinc-500">Seus dados são usados só pela {oficina} para atender o seu veículo.</p>

      <button
        type="submit"
        disabled={pendente}
        className="min-h-14 w-full rounded-md bg-blue-600 px-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pendente ? "Enviando..." : "Enviar"}
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
  campo: CampoPre;
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
