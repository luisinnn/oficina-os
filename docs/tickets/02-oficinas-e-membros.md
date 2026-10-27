# 02 — Oficinas, membros e onboarding

**Rótulos:** banco · tela · segurança · **Depende de:** 01

## Objetivo

Criar a base multi-oficina: toda conta pertence a uma oficina, e o RLS de todas
as tabelas futuras se apoia nisso.

## Banco (migração)

- `oficinas`: `id`, `nome` (1–100), `telefone` (dígitos, 10–11), `codigo_publico` (texto aleatório, único; usado no link de pré-cadastro), `proximo_numero_os` (inteiro, começa em 1), `created_at`.
- `oficina_membros`: `oficina_id`, `user_id` (**único** → 1 oficina por usuário na v1), `papel` (`check (papel = 'dono')`), `created_at`. `on delete cascade` dos dois lados.
- Função `minha_oficina()` → `uuid` da oficina do usuário logado (`security definer`, `stable`, `set search_path = ''`). As políticas usam `(select public.minha_oficina())`.
- RPC `criar_oficina(nome, telefone)` (só `authenticated`): cria oficina + membro "dono" numa transação; erro se o usuário já tem oficina. Gera o `codigo_publico` com `gen_random_bytes`.
- RLS:
  - `oficinas`: membro lê e atualiza `nome`/`telefone` da própria. Sem insert/delete direto (insert só pela RPC).
  - `oficina_membros`: membro lê a própria linha. Sem escrita direta.
- `revoke all` de `anon` nas duas tabelas; `revoke execute` de `public, anon` nas funções.

## Telas

- Depois do login, se o usuário não tem oficina → `/onboarding`: campos "Nome da oficina" e "WhatsApp da oficina", botão "Começar". Quem já tem oficina e abre `/onboarding` vai para `/painel`.
- `/painel/configuracoes`: editar nome e telefone. (O botão de trocar código entra no ticket 09.)
- Cabeçalho mostra o nome da oficina e o botão Sair.
- Helper `getOficina()` no servidor (como o `getUsuario()` do template): devolve a oficina ou redireciona para `/onboarding`.

## Critérios de aceite

- [ ] Conta nova → onboarding → painel mostra o nome da oficina.
- [ ] Chamar `criar_oficina` duas vezes com o mesmo usuário → segunda falha.
- [ ] Teste de banco (`test:db`): usuário A não lê a oficina de B; anônimo não lê nenhuma; ninguém troca o `codigo_publico` ou `proximo_numero_os` via update direto.
- [ ] Validação de nome/telefone com testes unitários (Vitest).
