# 05 — Status da OS

**Rótulos:** tela · banco · **Depende de:** 04

## Objetivo

Mover a OS pelo fluxo com um toque, sem deixar estados impossíveis.

## Regras

- Fluxo: `aguardando → em_servico → pronto → entregue`.
- **Avançar** um passo; **voltar** um passo (exceto a partir de `entregue`).
- **Cancelar** de qualquer status menos `entregue`. Cancelada não volta.
- Ao entrar em `entregue`, grava `entregue_em`.
- Regras aplicadas numa RPC `mudar_status(ordem_id, novo_status)` que confere a transição e se a OS é da oficina do usuário. `security definer`, `set search_path = ''`.
- Update direto de `status`, `entregue_em`, `numero`, `oficina_id` bloqueado por permissão de coluna: `revoke update on public.ordens from authenticated` + `grant update (problema, km, obs_interna) on public.ordens to authenticated`. (Revogar só a coluna não funciona enquanto existir o `UPDATE` da tabela inteira, que o Supabase dá por padrão.)
- Função pura `proximoStatus` / `statusAnterior` / `podeCancelar` em `src/lib/` com testes Vitest (mesma tabela de transições do banco).

## Telas

- No detalhe da OS: botão grande **"Avançar para Em serviço"** (texto muda conforme o status), link discreto "Voltar para Aguardando", e "Cancelar OS" com confirmação.
- Entregue/cancelada some da tela inicial e continua no histórico da placa.

## Critérios de aceite

- [ ] Toda transição válida funciona; inválidas (ex.: `aguardando → entregue`, `cancelada → aguardando`) falham no banco.
- [ ] Testes unitários das transições + teste de banco da RPC.
- [ ] Teste de banco: `update ordens set status = 'entregue'` direto, como usuário logado, dá erro de permissão.
