# 09 — Pré-cadastro público e confirmação

**Rótulos:** banco · tela · segurança · **Depende de:** 04

## Objetivo

Link fixo da oficina (para o WhatsApp Business e o Google) onde o cliente se
adianta; a oficina confere e transforma em OS.

## Banco

- Tabela `pre_cadastros`: `id`, `oficina_id`, `nome`, `telefone`, `placa`, `modelo`, `problema` (mesmos limites e formatos das outras tabelas), `situacao` (`pendente | confirmado | descartado`), `ordem_id` (preenchido na confirmação), `created_at`.
  - Fica separado de `ordens` de propósito: o que vem de fora nunca encosta em `clientes`/`veiculos` até alguém confirmar.
- `enviar_pre_cadastro(codigo, nome, telefone, placa, modelo, problema)` (**`anon`**):
  - acha a oficina pelo `codigo_publico`; código inválido → erro genérico;
  - normaliza e valida tudo no banco;
  - antispam: no máximo **20** pré-cadastros por oficina na última hora; no máximo **1 pendente por placa**;
    - **limitação conhecida (aceita na v1):** quem mandar 20 falsos por hora bloqueia os clientes de verdade naquela hora. A saída é "Gerar novo link" (abaixo). Se acontecer, o próximo passo é captcha (Turnstile) ou limite por IP;
  - devolve só "ok" (nenhum dado da oficina ou do carro).
- `nome_oficina_publico(codigo)` (`anon`) → só o nome, para o título da página.
- `confirmar_pre_cadastro(id, trocar_dono bool)` (`authenticated`): cria/reaproveita cliente e veículo, cria OS `aguardando` com `origem = 'link'`, marca `confirmado`. Respeita a regra de 1 OS aberta por carro.
- `descartar_pre_cadastro(id)` (`authenticated`).
- `trocar_codigo_publico()` (`authenticated`, `security definer`, `set search_path = ''`): gera código novo com `extensions.gen_random_bytes` (mesmo formato do ticket 02); o link antigo morre na hora.

## Telas

- **`/p/[codigo]`** (público, liberado no `proxy.ts`): "Pré-cadastro — {oficina}", campos nome, telefone, placa, modelo, problema, botão "Enviar". Campo isca escondido (`name="site"`, fora da tela, `tabindex=-1`): se vier preenchido, a server action responde "ok" sem gravar. Sucesso: "Recebido! A oficina vai falar com você pelo WhatsApp."
  - Aviso de privacidade (LGPD) acima do botão: "Seus dados são usados só pela {oficina} para atender o seu veículo."
- **Painel**: seção "Pré-cadastros para confirmar" com contador. Abrir mostra os dados; se a placa já existe com outro dono, mostra lado a lado e oferece "Manter {atual}" / "Trocar dono para {novo}". Botões **Confirmar** e **Descartar**.
- **Configurações**: link de pré-cadastro com botão "Copiar" e "Gerar novo link" (com confirmação).

## Critérios de aceite

- [ ] Pré-cadastro chega ao painel e, confirmado, vira OS #n `aguardando`.
- [ ] Confirmar placa existente sem trocar dono não altera `clientes`/`veiculos`.
- [ ] 21º envio na mesma hora e 2º pendente da mesma placa → recusados (teste de banco).
- [ ] Depois de "Gerar novo link", o código antigo responde erro.
