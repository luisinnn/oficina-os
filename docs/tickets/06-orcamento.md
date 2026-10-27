# 06 — Orçamento: itens e total

**Rótulos:** banco · tela · **Depende de:** 05

## Objetivo

Montar o orçamento dentro da OS, com total sempre calculado.

## Banco (migração)

- `orcamentos`: `id`, `oficina_id`, `ordem_id` (**único** → 1 orçamento por OS), `estado` (`rascunho | enviado | aprovado | recusado`), `token_hash`, `token_expira_em`, `enviado_em`, `respondido_em`, `motivo_recusa` (até 500).
- `orcamento_itens`: `id`, `oficina_id`, `orcamento_id`, `tipo` (`peca | mao_de_obra`), `descricao` (1–200), `quantidade` (inteiro 1–999), `valor_unitario_centavos` (inteiro 0–10.000.000), `created_at`.
- Total = soma de `quantidade × valor_unitario_centavos`, calculado (view ou função), nunca gravado à mão.
- **Edição depois do envio:** trigger em `orcamento_itens` (insert/update/delete): se o orçamento não está em `rascunho`, volta para `rascunho`, apaga `token_hash`/`token_expira_em`/`respondido_em`/`motivo_recusa`. O link antigo morre.
- O estado do orçamento **não** muda o status da OS.
- RLS por oficina nas duas tabelas. Colunas `estado`, `token_*`, `respondido_em` não editáveis direto pelo usuário (só por RPC/trigger).

## Telas

- No detalhe da OS, seção **Orçamento**: lista de itens (tipo, descrição, qtd × valor), total em destaque, etiqueta do estado.
- "+ Peça" / "+ Mão de obra": formulário curto (descrição, quantidade = 1, valor com teclado numérico em reais → convertido para centavos).
- Editar/remover item. Se o orçamento já foi enviado/respondido, avisa antes: "Isso invalida o link enviado ao cliente."
- Etiqueta do orçamento aparece também no cartão da tela inicial.

## Critérios de aceite

- [ ] Funções `reaisParaCentavos` / `formatarReais` com testes (vírgula, ponto de milhar, `0,99`, valores inválidos).
- [ ] Total confere em teste de banco com vários itens.
- [ ] Editar item de orçamento `aprovado` → volta a `rascunho` e `token_hash` vira null.
- [ ] Valor negativo ou quantidade 0 recusados no app e no banco.
