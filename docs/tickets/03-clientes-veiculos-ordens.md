# 03 — Clientes, veículos e OS (banco)

**Rótulos:** banco · segurança · **Depende de:** 02

## Objetivo

Modelar o núcleo do sistema, com isolamento por oficina e regras garantidas pelo
banco (não só pelo app).

## Banco (migração)

- `clientes`: `id`, `oficina_id`, `nome` (1–100), `telefone` (dígitos, 10–11), `created_at`.
- `veiculos`: `id`, `oficina_id`, `placa` (CHECK do formato `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`), `modelo` (1–60), `cliente_id` (dono atual), `created_at`. **Único** `(oficina_id, placa)`.
- `ordens`:
  - `id`, `oficina_id`, `numero` (sequencial por oficina), `veiculo_id`, `cliente_id` (o cliente **daquela visita**; o histórico não muda se o carro trocar de dono).
  - `problema` (1–1000), `km` (opcional, inteiro ≥ 0), `obs_interna` (opcional, até 1000).
  - `status`: `aguardando | em_servico | pronto | entregue | cancelada`.
  - `origem`: `balcao | link`.
  - `created_at`, `updated_at`, `entregue_em`.
- Número da OS: trigger `before insert` pega `oficinas.proximo_numero_os` com `for update` e incrementa. **Único** `(oficina_id, numero)`.
- Uma OS aberta por carro: índice único parcial em `ordens (veiculo_id) where status not in ('entregue','cancelada')`.
- `oficina_id` preenchido por default `minha_oficina()` e **conferido** pelas políticas (`with check`), além de checar que `veiculo_id`/`cliente_id` são da mesma oficina (trigger ou FK composta `(oficina_id, id)`).
- RLS nas três tabelas: select/insert/update só da própria oficina. Sem delete na v1 (OS se cancela, não se apaga).
- Índices: `veiculos (oficina_id, placa)`, `ordens (oficina_id, status)`, `ordens (veiculo_id)`.

## Lógica compartilhada (`src/lib/`)

- `normalizarPlaca`, `validarPlaca`, `normalizarTelefone`, `validarTelefone`, com testes Vitest (placa com hífen, minúscula, espaços; telefone com máscara, com +55).

## Critérios de aceite

- [ ] Duas OS na mesma oficina recebem #1 e #2; em outra oficina a primeira é #1.
- [ ] Inserir 2ª OS aberta para o mesmo carro falha no banco.
- [ ] Inserir OS apontando para veículo de outra oficina falha.
- [ ] Testes de banco: A não lê/edita clientes, veículos e OS de B; anônimo não lê nada.
