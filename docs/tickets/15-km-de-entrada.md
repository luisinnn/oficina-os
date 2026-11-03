# 15 — Km de entrada obrigatória

**Rótulos:** banco · tela · **Depende de:** 09

## Objetivo

O mecânico pediu: a km com que o carro **entrou** na oficina é muito importante.
Hoje ela é opcional e fica escondida no bloco "Mais detalhes" da nova OS, e o
pré-cadastro nem pede. Este ticket faz toda OS nova ter a km de entrada.

## Regras

- **Toda OS nova tem km.** OS antigas sem km continuam como estão (aparecem com "km não anotada").
- **Nova OS (balcão):** a km sai de "Mais detalhes" e vira o 6º campo à vista, logo depois do modelo,
  com teclado numérico. "Mais detalhes" fica só com a observação interna.
- **Pré-cadastro:** o formulário público continua igual (o cliente não sabe a km de cabeça).
  Quem anota é o mecânico, ao **confirmar** o pré-cadastro: campo de km obrigatório nessa tela.
- **Km menor que a última deste carro:** aviso "A última OS deste carro anotou 120.300 km.
  Confere a km?" com "Sim, está certa" para salvar assim mesmo. Não bloqueia: painel trocado
  ou erro antigo acontecem.
- **Corrigir a km** no detalhe da OS enquanto ela estiver aberta (a permissão de coluna já existe).
  Fechada (entregue ou cancelada) não muda mais.

## Banco

- `criar_ordem` e a função de confirmar pré-cadastro passam a exigir km (`null` → erro com código
  próprio). Sem `NOT NULL` na coluna, por causa das OS antigas.
- O aviso de km menor usa a km da última OS do carro, que o app já lê em `buscarCarro`.
- Correção de km com a OS fechada recusada no banco (trigger ou função), não só escondida na tela.

## Onde a km aparece

- Detalhe da OS: perto da placa, em destaque ("Entrou com 120.300 km").
- Histórico da placa: km em cada OS, para ver quanto o carro rodou entre uma visita e outra.
- Histórico das OS fechadas (ticket 14).

## Critérios de aceite

- [ ] Teste de banco: `criar_ordem` e a confirmação de pré-cadastro sem km dão erro.
- [ ] Teste de banco: alterar a km de OS entregue ou cancelada dá erro.
- [ ] Testes unitários: validação da km obrigatória e do aviso de km menor que a anterior.
- [ ] Do toque em "+ Nova OS" até salvar, com placa nova: 6 campos, 1 botão, ainda < 1 minuto no celular
      (o ticket 04 dizia 5 campos).
- [ ] Luis testa: OS de balcão, confirmação de pré-cadastro, aviso de km menor e correção da km.
