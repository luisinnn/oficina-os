# 04 — Tela inicial, busca por placa e nova OS

**Rótulos:** tela · **Depende de:** 03

## Objetivo

O fluxo do dia a dia: chegou um carro, registrar em **menos de 1 minuto** no celular.

## Telas

- **`/painel` (tela inicial)**, de cima para baixo:
  1. Campo de busca por placa (teclado em maiúsculas) + botão grande **"+ Nova OS"**.
  2. Espaço reservado para "Pré-cadastros para confirmar" (preenchido no ticket 09).
  3. OS ativas agrupadas: Aguardando, Em serviço, Pronto. Cartão grande com `#número`, placa, modelo e nome do cliente; toque abre a OS.
- **Busca por placa** (`/painel/placa/[placa]`):
  - Placa existe → dono atual (nome, telefone) + histórico de OS do carro (mais recente primeiro).
  - Tem OS aberta → aviso "Este carro já está na OS #12 (em serviço)" com botão para abri-la, e **sem** botão de nova OS.
  - Sem OS aberta → botão "Nova OS para este carro" com cliente e modelo já preenchidos.
  - Placa não existe → "Placa nova" + botão "Cadastrar OS" com a placa preenchida.
- **Nova OS** (`/painel/os/nova`): placa, modelo, nome, telefone, problema. Bloco recolhido "Mais detalhes": km e observação interna.
  - Placa nova → cria cliente + veículo + OS.
  - Placa existente com outro nome/telefone digitado → pergunta "Trocar dono para X?" (sim atualiza `veiculos.cliente_id` para um cliente novo ou existente; não mantém o dono e usa o cliente atual na OS).
  - Tudo numa RPC `criar_ordem(...)` (`authenticated`) para ser uma transação só.
- **Detalhe da OS** (`/painel/os/[id]`): dados, problema, km, obs interna, data de entrada. (Status no 05, orçamento no 06.)

## Critérios de aceite

- [ ] Do toque em "+ Nova OS" até salvar, com placa nova: 5 campos, 1 botão. Cronometrar no celular: < 1 minuto.
- [ ] Erros de validação aparecem no campo certo e não apagam o que foi digitado.
- [ ] Testado em largura 360px (Chrome DevTools) sem rolagem horizontal.
- [ ] Testes unitários da validação do formulário; teste de banco da RPC `criar_ordem` (placa nova, existente, troca de dono, OS aberta bloqueia).
