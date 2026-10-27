# 07 — Enviar orçamento pelo WhatsApp

**Rótulos:** banco · tela · segurança · **Depende de:** 06

## Objetivo

Um toque gera o link de aprovação e abre o WhatsApp com a mensagem pronta.

## Banco

- RPC `enviar_orcamento(ordem_id)` (`authenticated`, só membro da oficina):
  - exige ao menos 1 item;
  - gera token com `gen_random_bytes(32)` em base64url (~43 caracteres);
  - grava só `token_hash = sha256(token)`, `token_expira_em = now() + 30 days`, `estado = 'enviado'`, `enviado_em = now()`;
  - devolve o token **uma única vez** (não dá para recuperar depois; reenviar gera outro e anula o anterior).

## App

- Botão **"Enviar pelo WhatsApp"** no orçamento → chama a RPC → monta `https://wa.me/55<telefone>?text=<mensagem>` → abre.
- Mensagem fixa:
  > Olá, {primeiro nome}! Segue o orçamento do {modelo} ({placa}) na {oficina}, OS #{número}: total R$ {total}. Para aprovar ou recusar: {link}
- Link: `${NEXT_PUBLIC_SITE_URL}/aprovar/<token>` (mesma função `urlDoSite()` do template, nunca o header da requisição).
- Funções puras `linkWhatsApp(telefone, texto)` e `mensagemOrcamento(dados)` com testes (acento, `&`, quebra de linha codificados certo).

## Critérios de aceite

- [ ] Abrir no celular abre o WhatsApp com a conversa do cliente e o texto pronto.
- [ ] Reenviar gera link novo; o anterior para de funcionar (teste de banco).
- [ ] Coluna `token_hash` nunca contém o token em texto (teste de banco compara).
