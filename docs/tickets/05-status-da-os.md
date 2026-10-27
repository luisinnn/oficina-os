# 05 — Status da OS

**Rótulos:** tela · banco · **Depende de:** 04

## Objetivo

Mover a OS pelo fluxo com um toque, sem deixar estados impossíveis.

## Regras

- Fluxo: `aguardando → em_servico → pronto → entregue`.
- **Avançar** um passo; **voltar** um passo (exceto a partir de `entregue`).
- **Cancelar** de qualquer status menos `entregue`. Cancelada não volta.
- Ao entrar em `entregue`, grava `entregue_em`.
- Regras aplicadas numa RPC `mudar_status(ordem_id, novo_status)` que confere a transição; o update direto da coluna `status` fica bloqueado (trigger ou coluna fora do `grant update`).
- Função pura `proximoStatus` / `statusAnterior` / `podeCancelar` em `src/lib/` com testes Vitest (mesma tabela de transições do banco).

## Telas

- No detalhe da OS: botão grande **"Avançar para Em serviço"** (texto muda conforme o status), link discreto "Voltar para Aguardando", e "Cancelar OS" com confirmação.
- Entregue/cancelada some da tela inicial e continua no histórico da placa.

## Critérios de aceite

- [ ] Toda transição válida funciona; inválidas (ex.: `aguardando → entregue`, `cancelada → aguardando`) falham no banco.
- [ ] Testes unitários das transições + teste de banco da RPC.
