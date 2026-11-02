# 07 — Enviar orçamento pelo WhatsApp

**Rótulos:** banco · tela · segurança · **Depende de:** 06

## Objetivo

Um toque gera o link de aprovação e abre o WhatsApp com a mensagem pronta.

## Banco

- RPC `enviar_orcamento(ordem_id)` (`authenticated`, só membro da oficina; `security definer`, `set search_path = ''`, porque `orcamentos` não tem `UPDATE` para o usuário):
  - exige ao menos 1 item;
  - gera token com `extensions.gen_random_bytes(32)` em base64url (~43 caracteres);
  - grava só `token_hash = extensions.digest(token, 'sha256')`, `token_expira_em = now() + 30 days`, `estado = 'enviado'`, `enviado_em = now()`;
  - devolve o token **uma única vez** (não dá para recuperar depois; reenviar gera outro e anula o anterior).
  - reenviar orçamento já respondido: zerar também `respondido_em` e `motivo_recusa` (os CHECKs de `orcamentos`, ticket 06, exigem isso para o estado `enviado`). O histórico em `orcamento_respostas` fica.

## App

- Botão **"Enviar pelo WhatsApp"** no orçamento → chama a RPC → monta `https://wa.me/55<telefone>?text=<mensagem>` → abre.
- Mensagem fixa:
  > Olá, {primeiro nome}! Segue o orçamento do {modelo} ({placa}) na {oficina}, OS #{número}: total R$ {total}. Para aprovar ou recusar: {link}
- Link: `${NEXT_PUBLIC_SITE_URL}/aprovar/<token>` (mesma função `urlDoSite()` do template, nunca o header da requisição).
- Funções puras `linkWhatsApp(telefone, texto)` e `mensagemOrcamento(dados)` com testes (acento, `&`, quebra de linha codificados certo).

## Critérios de aceite

- [x] Abrir no celular abre o WhatsApp com a conversa do cliente e o texto pronto.
- [x] Reenviar gera link novo; o anterior para de funcionar (teste de banco).
- [x] Coluna `token_hash` nunca contém o token em texto (teste de banco compara).
