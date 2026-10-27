# 06 — Orçamento: itens e total

**Rótulos:** banco · tela · **Depende de:** 05

## Objetivo

Montar o orçamento dentro da OS, com total sempre calculado.

## Banco (migração)

- `orcamentos`: `id`, `oficina_id`, `ordem_id` (**único** → 1 orçamento por OS), `estado` (`rascunho | enviado | aprovado | recusado`), `token_hash`, `token_expira_em`, `enviado_em`, `respondido_em`, `motivo_recusa` (até 500).
- `orcamento_itens`: `id`, `oficina_id`, `orcamento_id`, `tipo` (`peca | mao_de_obra`), `descricao` (1–200), `quantidade` (inteiro 1–999), `valor_unitario_centavos` (inteiro 0–10.000.000), `created_at`.
- Total = soma de `quantidade × valor_unitario_centavos`, calculado (view ou função), nunca gravado à mão.
- `orcamento_respostas` (**histórico, ninguém apaga nem edita**): `id`, `oficina_id`, `orcamento_id`, `resposta` (`aprovado | recusado`), `total_centavos` (o total no momento da resposta), `itens` (`jsonb` com a cópia dos itens respondidos), `motivo` (até 500), `respondido_em`. Gravada pela RPC de resposta (ticket 08).
  - **Por quê:** a edição (abaixo) volta o orçamento para rascunho. Sem histórico, some a prova de que o cliente aprovou e de qual valor ("eu aprovei R$ 400").
  - RLS: membro da oficina só lê. Sem `insert`/`update`/`delete` para `authenticated` (nem `grant`).
- **Edição depois do envio:** trigger em `orcamento_itens` (insert/update/delete): se o orçamento não está em `rascunho`, volta para `rascunho`, apaga `token_hash`/`token_expira_em`/`respondido_em`/`motivo_recusa`. O link antigo morre. O histórico em `orcamento_respostas` **não** é tocado.
  - A função do trigger é `security definer` (`search_path = ''`): o usuário não tem `UPDATE` nessas colunas, então sem isso o próprio trigger seria bloqueado.
- O estado do orçamento **não** muda o status da OS.
- RLS por oficina nas tabelas. Permissão por coluna em `orcamentos`: `revoke update on public.orcamentos from authenticated` e **nenhum** `grant update` de volta (todas as colunas mudam só por RPC/trigger). `orcamento_itens` continua com update normal.

## Telas

- No detalhe da OS, seção **Orçamento**: lista de itens (tipo, descrição, qtd × valor), total em destaque, etiqueta do estado.
- "+ Peça" / "+ Mão de obra": formulário curto (descrição, quantidade = 1, valor com teclado numérico em reais → convertido para centavos).
- Editar/remover item. Se o orçamento já foi enviado/respondido, avisa antes: "Isso invalida o link enviado ao cliente."
- Etiqueta do orçamento aparece também no cartão da tela inicial.
- Bloco "Respostas do cliente" no orçamento: lista o histórico (aprovou/recusou, valor, data e hora, motivo), mesmo depois de editar.

## Critérios de aceite

- [ ] Funções `reaisParaCentavos` / `formatarReais` com testes (vírgula, ponto de milhar, `0,99`, valores inválidos).
- [ ] Total confere em teste de banco com vários itens.
- [ ] Editar item de orçamento `aprovado` → volta a `rascunho` e `token_hash` vira null, e a linha em `orcamento_respostas` continua lá com o valor aprovado.
- [ ] Usuário logado não consegue `update`/`delete` em `orcamento_respostas` nem `update` direto em `orcamentos.estado`.
- [ ] Valor negativo ou quantidade 0 recusados no app e no banco.
