# 08 — Página pública de aprovação

**Rótulos:** banco · tela · segurança · **Depende de:** 07

## Objetivo

O cliente abre o link no celular, vê o orçamento e aprova ou recusa, sem login.

## Banco (funções liberadas para `anon`)

- `ver_orcamento(token)` → procura por `extensions.digest(token, 'sha256')`; devolve **só**: nome da oficina, número da OS, placa, modelo, itens (tipo, descrição, qtd, valor), total, estado, `expirado` (bool). Nada de nome completo/telefone do cliente, ids internos ou observação interna.
- `responder_orcamento(token, aprovar, motivo)` → só aceita se estado = `enviado` e não expirado. Grava `aprovado`/`recusado`, `respondido_em`, `motivo_recusa` (até 500, só na recusa). Segunda resposta falha.
  - **Uma operação só**, para o duplo clique não responder duas vezes: `update public.orcamentos set ... where token_hash = ... and estado = 'enviado' and token_expira_em > now() returning ...`. Se não voltar linha, responde "não encontrado". Nada de "ler, conferir e depois gravar".
  - Na mesma transação, grava em `orcamento_respostas` (ticket 06) o total e a cópia dos itens daquele momento.
- Token inválido, expirado ou anulado → a mesma resposta genérica "não encontrado", sem dizer qual dos casos.
- `security definer` + `set search_path = ''`; `grant execute ... to anon` só nessas duas.

## Tela `/aprovar/[token]`

- Fora do login: liberar o caminho no `proxy.ts`.
- Mostra oficina, OS, carro, itens, total; botões grandes **Aprovar** e **Recusar** (recusa abre campo opcional de motivo).
- Depois de responder: "Obrigado! A oficina já foi avisada." Reabrir o link mostra a resposta já dada, sem botões.
- Expirado/inválido: "Link expirado ou inválido. Peça um novo à oficina."
- Cabeçalho `Referrer-Policy: no-referrer` e `robots: noindex` nessa rota (o token não vaza para outros sites nem para buscadores).
- Não registrar o token em `console.log`.

## Critérios de aceite

- [ ] Fluxo completo no celular: enviar (07) → abrir link → aprovar → etiqueta "aprovado" no painel.
- [ ] Testes de banco: token errado, expirado, já respondido e anulado por edição → falham; anônimo continua sem acesso direto a `orcamentos`.
- [ ] Duas chamadas de `responder_orcamento` ao mesmo tempo (`Promise.all`) → só uma dá certo, e só uma linha aparece em `orcamento_respostas`.
