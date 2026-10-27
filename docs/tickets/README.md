# Tickets da v1 — oficina-os

Sistema de ordens de serviço (OS) para oficina mecânica de beira de pista.
Primeiro cliente real: oficina do primo. Feito em cima do template
`cadastro-clientes` (Next.js 16 + Supabase + Tailwind).

## Como trabalhamos

- Um commit (ou poucos) por ticket, na `main`, citando o ticket: `#03 Cria tabelas de OS`.
- Push só depois do ticket fechado, com lint/tipos/testes passando, e com OK do Luis.
- Sem Vercel até o ticket 12. Depois que estiver em produção, passamos a usar branch + pull request.
- Desenvolvimento 100% no Supabase local (Docker). Nenhuma chave real no PC até o deploy.

## Ordem e dependências

| # | Ticket | Rótulos | Depende de | Feito |
| --- | --- | --- | --- | --- |
| 01 | [Infra: Supabase local, limpeza do template](01-infra-supabase-local.md) | infra | — | [x] |
| 02 | [Oficinas, membros e onboarding](02-oficinas-e-membros.md) | banco, tela, segurança | 01 | [x] |
| 03 | [Clientes, veículos e OS (banco)](03-clientes-veiculos-ordens.md) | banco, segurança | 02 | [x] |
| 04 | [Tela inicial, busca por placa e nova OS](04-tela-inicial-busca-nova-os.md) | tela | 03 | [ ] |
| 05 | [Status da OS](05-status-da-os.md) | tela, banco | 04 | [ ] |
| 06 | [Orçamento: itens e total](06-orcamento.md) | banco, tela | 05 | [ ] |
| 07 | [Enviar orçamento pelo WhatsApp](07-envio-whatsapp.md) | banco, tela, segurança | 06 | [ ] |
| 08 | [Página pública de aprovação](08-aprovacao-publica.md) | banco, tela, segurança | 07 | [ ] |
| 09 | [Pré-cadastro público e confirmação](09-pre-cadastro.md) | banco, tela, segurança | 04 | [ ] |
| 10 | [Teste de segurança](10-teste-seguranca.md) | segurança | 08, 09 | [ ] |
| 11 | [Backup semanal](11-backup.md) | infra | 01 | [ ] |
| 12 | [Deploy em produção](12-deploy.md) | infra, segurança | todos | [ ] |

## Decisões que valem para todos os tickets

- **Multi-oficina:** toda tabela de dados tem `oficina_id`. O RLS libera só a oficina do usuário logado (via `oficina_membros`). Na v1, 1 usuário = 1 oficina, papel único "dono".
- **Partes públicas** (aprovação e pré-cadastro): só por funções no banco (`security definer`) com `grant execute` para `anon`. Anônimo **não** tem nenhuma permissão direta em tabela.
- **Funções:** o Supabase dá `execute` para `anon` em funções novas por padrão. Toda migração que cria função faz `revoke execute ... from public, anon` e só libera o que for público de propósito.
- **Colunas protegidas:** o Supabase dá `UPDATE` na tabela inteira para `authenticated`, e um `revoke` só de coluna não vence a permissão da tabela. Toda tabela com coluna que o usuário não pode mexer faz `revoke update on <tabela> from authenticated` + `grant update (col1, col2, ...)` só nas editáveis. Funções e triggers que mexem nas protegidas são `security definer`.
- **`search_path = ''`** em toda função `security definer`. Com ele vazio, tudo vai com schema: `public.tabela`, `extensions.gen_random_bytes(...)`, `extensions.digest(...)` (o pgcrypto do Supabase fica no schema `extensions`).
- **Dinheiro** em centavos (`integer`). **Telefone** só dígitos (10 ou 11, com DDD). **Placa** maiúscula sem hífen, formato antigo `ABC1234` ou Mercosul `ABC1D23`.
- **Fuso:** datas mostradas em `America/Sao_Paulo`.
- **Celular primeiro:** botões com no mínimo 48px de altura, uma ação principal por tela, teclado certo em cada campo (`inputmode`, `autocapitalize`).
- **Limites de tamanho** iguais no app e em CHECK no banco (lição do template).

## Fora da v1

Agendamento de horário, pagamento online, API oficial do WhatsApp, estoque de peças,
nota fiscal, convite de funcionários, captcha, texto de mensagem editável, desconto,
campos extras de veículo (ano, cor) e previsão de entrega.
