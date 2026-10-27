# 10 — Teste de segurança

**Rótulos:** segurança · **Depende de:** 08, 09

## Objetivo

Provar, com testes que rodam sozinhos, que uma oficina nunca enxerga a outra e que
as rotas públicas só fazem o que devem. Obrigatório passar antes do deploy (12).

## Como

- Testes Vitest em `tests/seguranca/` rodando no Supabase local (`npm run test:db`, também no CI).
- Preparação: cria **dois usuários** (A e B) via `signUp` no banco local (confirmação de e-mail desligada no `config.toml` local), cada um com sua oficina, cliente, veículo, OS, orçamento enviado e pré-cadastro. Usa só a chave **publishable**, como um atacante usaria.
- Cada teste usa o cliente Supabase autenticado como A, como B ou anônimo.

## Casos — isolamento entre oficinas (A atacando B)

- [ ] `select` em cada tabela (`oficinas`, `oficina_membros`, `clientes`, `veiculos`, `ordens`, `orcamentos`, `orcamento_itens`, `orcamento_respostas`, `pre_cadastros`) só devolve linhas de A.
- [ ] Nem A consegue `update`/`delete` em `orcamento_respostas`, mesmo nas linhas da própria oficina (o histórico não se apaga).
- [ ] `update`/`delete` em linhas de B por id → 0 linhas afetadas.
- [ ] `insert` com `oficina_id` de B → recusado.
- [ ] `insert` de OS de A apontando para veículo/cliente de B → recusado.
- [ ] RPCs autenticadas (`criar_ordem`, `mudar_status`, `enviar_orcamento`, `confirmar_pre_cadastro`, `descartar_pre_cadastro`) com ids de B → erro.
- [ ] A não consegue se colocar em `oficina_membros` da oficina de B.
- [ ] A não altera colunas protegidas da própria oficina por update direto: `oficinas.codigo_publico`, `oficinas.proximo_numero_os`, `ordens.status`/`numero`/`oficina_id`, qualquer coluna de `orcamentos`.
- [ ] Teste "de catálogo": consulta `information_schema.column_privileges` e confere que `authenticated` só tem `UPDATE` nas colunas da lista permitida (pega `grant` esquecido em migração nova).

## Casos — anônimo

- [ ] `select`/`insert`/`update`/`delete` em todas as tabelas → recusado ou vazio.
- [ ] Toda função do schema `public` que não é pública de propósito → sem permissão para `anon` (o teste lista as funções e compara com a lista permitida: `ver_orcamento`, `responder_orcamento`, `enviar_pre_cadastro`, `nome_oficina_publico`).
- [ ] `ver_orcamento`: token aleatório, token de outro orçamento alterado em 1 caractere, expirado, anulado por edição → "não encontrado"; resposta válida não contém telefone, nome completo, ids, `obs_interna`.
- [ ] `responder_orcamento`: segunda resposta falha; resposta em orçamento `rascunho` falha.
- [ ] `enviar_pre_cadastro`: código inválido, código antigo após troca, 21º na hora, placa pendente repetida, campos gigantes e formatos inválidos → recusados; resposta não traz dados.

## Lista manual (rodar de novo em produção no ticket 12)

- [ ] Com o DevTools aberto, navegar logado como A: nenhuma resposta de rede contém dados de B.
- [ ] Abrir `/painel/os/<id de B>` logado como A → "não encontrado".
- [ ] `/aprovar/<token>` e `/p/<codigo>` funcionam em aba anônima; `/painel` em aba anônima → login.
- [ ] Ver o código-fonte da página pública: nenhum id interno nem telefone do cliente.
- [ ] Scan de segredos no repositório (padrões `sb_secret_`, `service_role`, `eyJhbGci`) vazio.
