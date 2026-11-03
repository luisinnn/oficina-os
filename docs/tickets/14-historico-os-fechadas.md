# 14 — Histórico das OS fechadas

**Rótulos:** banco · tela · **Depende de:** 13

## Objetivo

Hoje uma OS entregue ou cancelada some da tela inicial e só aparece buscando a
placa daquele carro. O dono precisa de uma visão geral para ter controle:
**quanto entrou no mês** e **achar uma OS antiga** sem lembrar a placa.

## Regras

- Entram no histórico as OS **entregues** e **canceladas**, da mais recente para a mais antiga.
- **Mês da OS** = mês em que ela fechou: `entregue_em` para entregue, `cancelada_em` para cancelada,
  no fuso `America/Sao_Paulo`.
- **Valor** = total da resposta de aprovação do cliente (`orcamento_respostas.total_centavos`
  da última resposta, quando ela foi de aprovação). É o valor que o cliente aceitou,
  mesmo que o orçamento tenha sido mexido depois (mexer volta o orçamento para rascunho, mas
  não apaga a resposta). Sem resposta ou com a última recusando: "sem valor".
- **Total do mês** = soma dos valores das OS **entregues** do mês. Cancelada aparece na lista,
  mas não soma.
- **Busca** por placa ou nome do cliente procura em **todos os meses** (até as 50 mais recentes)
  e não mostra total. Sem busca, mostra o mês escolhido.
- Sem paginação: um mês de oficina de beira de pista cabe numa tela. Rever se passar de 200 OS no mês.

## Banco

- Coluna nova `ordens.cancelada_em timestamptz`, gravada pela `mudar_status` ao cancelar
  (igual a `entregue_em`). OS canceladas antes desta migração recebem `updated_at`.
  Sem permissão de update para `authenticated` (mesma regra das colunas protegidas).
- View `historico_ordens` com `security_invoker = true` (o RLS de `ordens` continua valendo):
  id, número, status, data de fechamento, km, placa, modelo, nome do cliente, valor aprovado.
  `revoke all ... from anon`.
- Contas do mês (início e fim do mês no fuso de São Paulo, total) numa função pura em
  `src/lib/historico.ts`, com testes.

## Tela `/painel/historico`

Link **"Histórico"** no cabeçalho do painel, entre o nome da oficina e "Configurações".
Mesma direção visual do ticket 13 (Barlow, `Placa`, cores do tema).

```
┌──────────────────────────────┐
│ Oficina do Zé  Histórico ... │
├──────────────────────────────┤
│ [ Placa ou nome     ][Buscar]│
│                              │
│ [‹]   Outubro de 2026    [›] │  ← troca de mês (› some no mês atual)
│ R$ 12.480,00                 │  ← total do mês, Barlow Condensed 40px
│ 23 entregues, 2 canceladas   │
│                              │
│ ┌──────────┐            #41  │
│ │ ABC-1234 │   R$ 850,00     │
│ └──────────┘                 │
│ Gol 1.0 · Maria Souza        │
│ Entregue em 28/10 · 120.300 km│
│ ──────────────────────────── │
│ ┌──────────┐            #39  │
│ │ XYZ1A23  │   Cancelada     │
│ └──────────┘                 │
│ ...                          │
└──────────────────────────────┘
```

- O mês vai no endereço (`?mes=2026-10`) e a busca também (`?busca=maria`): dá para voltar
  com o botão do navegador e mandar o link.
- Cada linha abre o detalhe da OS. Linhas separadas por fio, sem cartão: é uma lista para
  ler em sequência, diferente do quadro da tela inicial.
- Mês sem OS fechada: "Nenhuma OS fechada em outubro de 2026."
- Busca sem resultado: "Nenhuma OS fechada com "maria"." e um link "Ver o mês atual".

## Critérios de aceite

- [ ] Teste de banco: cancelar grava `cancelada_em`; o usuário não consegue alterar `cancelada_em` direto.
- [ ] Teste de banco: a view só mostra OS da oficina do usuário; anônimo não lê nada.
- [ ] Teste de banco: o valor vem da resposta de aprovação, e OS sem aprovação vem sem valor.
- [ ] Testes unitários: limites do mês no fuso (OS entregue às 22h do dia 31 em São Paulo conta
      naquele mês) e total ignorando canceladas e "sem valor".
- [ ] Busca acha por placa (com ou sem hífen) e por parte do nome, sem diferenciar maiúscula.
- [ ] Largura 360px sem rolagem horizontal; botões de mês com 48px.
- [ ] Luis confere no celular o total de um mês com OS montadas por ele.
