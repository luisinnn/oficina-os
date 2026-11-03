# 15 — Km de entrada e nível do tanque

**Rótulos:** banco · tela · **Depende de:** 09

## Objetivo

As peças têm **garantia por km**. Hoje, se o carro sai, roda e volta com defeito,
o cliente pode dizer que andou pouco, e a oficina não tem como provar com quantos
km o carro chegou. A km de entrada é opcional e fica escondida em "Mais detalhes",
e o pré-cadastro nem pede.

Este ticket faz toda OS nova ter a km de entrada, registrada de um jeito que sirva
de prova, e anota o nível do tanque na chegada.

## Km de entrada

- **Toda OS nova tem km.** OS antigas sem km continuam como estão (aparecem com "km não anotada").
- **Nova OS (balcão):** a km sai de "Mais detalhes" e vira o 6º campo à vista, logo depois do modelo,
  com teclado numérico.
- **Pré-cadastro:** o formulário público continua igual (o cliente não sabe a km de cabeça).
  Quem anota é o mecânico, ao **confirmar** o pré-cadastro, com o carro na oficina: campo de km
  obrigatório nessa tela.
- **Km menor que a última deste carro:** aviso "A última OS deste carro anotou 120.300 km.
  Confere a km?" com "Sim, está certa" para salvar assim mesmo. Não bloqueia: painel trocado
  ou erro antigo acontecem.
- **Corrigir a km** no detalhe da OS só **até o orçamento ser enviado ao cliente**. Depois disso
  ela fica fixa: o cliente já viu aquele número, e é isso que vale como prova.
- **O cliente vê a km:** a mensagem do WhatsApp e a página de aprovação mostram
  "Entrada com 120.300 km". Quem aprova o orçamento aprova junto a km de entrada.
- A resposta de aprovação (`orcamento_respostas`) guarda uma cópia da km, como já guarda os
  itens e o total: se alguém mexer depois, a prova continua lá.

## Nível do tanque

- Opções fixas, um toque: **Reserva · 1/4 · 1/2 · 3/4 · Cheio**. Opções em vez de texto livre
  porque é mais rápido no celular e todo mundo anota igual.
- **Opcional** e só da chegada: aparece na nova OS (balcão) e na confirmação do pré-cadastro.
  O formulário público do pré-cadastro **não** pede.
- Pode ser anotado **depois**, no detalhe da OS, enquanto ela estiver aberta.
- Aparece no detalhe da OS ao lado da km ("Entrada com 120.300 km, tanque 1/4").

## Banco

- `criar_ordem` e a função de confirmar pré-cadastro passam a exigir km (`null` → erro com código
  próprio) e aceitam o tanque (opcional). Sem `NOT NULL` na coluna km, por causa das OS antigas.
- Coluna nova `ordens.tanque text` com CHECK nas 5 opções (`reserva`, `1/4`, `1/2`, `3/4`, `cheio`),
  editável pelo usuário (entra no `grant update` de colunas).
- Km fixa depois do envio do orçamento, e km e tanque fixos com a OS fechada: recusado no banco
  (trigger), não só escondido na tela.
- `orcamento_respostas` ganha `km integer` (cópia no momento da resposta).

## Onde a km aparece

- Detalhe da OS: perto da placa, em destaque.
- Histórico da placa: km em cada OS, para ver quanto o carro rodou entre uma visita e outra.
- Mensagem do WhatsApp e página pública de aprovação.
- Histórico das OS fechadas (ticket 14).

## Critérios de aceite

- [ ] Teste de banco: `criar_ordem` e a confirmação de pré-cadastro sem km dão erro.
- [ ] Teste de banco: alterar a km depois do orçamento enviado dá erro; antes, funciona.
- [ ] Teste de banco: tanque fora das 5 opções dá erro; alterar tanque de OS fechada dá erro.
- [ ] Teste de banco: a resposta de aprovação guarda a km do momento.
- [ ] Testes unitários: validação da km obrigatória, do aviso de km menor e da mensagem do WhatsApp com a km.
- [ ] Do toque em "+ Nova OS" até salvar, com placa nova: 6 campos obrigatórios, 1 botão, ainda
      < 1 minuto no celular (o ticket 04 dizia 5 campos).
- [ ] Luis testa: OS de balcão com tanque, confirmação de pré-cadastro, tanque anotado depois,
      aviso de km menor, km travada depois de enviar o orçamento, km na página de aprovação.
