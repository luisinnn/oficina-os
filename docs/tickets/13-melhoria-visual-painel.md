# 13 — Melhoria visual do painel

**Rótulos:** tela · **Depende de:** 09

## Objetivo

Hoje o painel é o visual padrão do template (cinza, azul e cartões com sombra).
Funciona, mas parece qualquer sistema. Este ticket dá ao painel uma cara de
**quadro de serviços de oficina**: na tela inicial, o mecânico olha e sabe na hora
qual carro está em que fase, mesmo no sol e com o celular na mão suja.

Só visual. Nenhuma mudança de banco, de regra ou de fluxo.

## Para quem e em que situação

- O dono da oficina (primo do Luis), no celular, em pé no pátio, muitas vezes sob sol.
- Abre o painel dezenas de vezes por dia para achar um carro e ver o que falta.
- Reconhece o carro pela **placa** antes do nome do cliente. A placa vira o centro do visual.

## Direção visual

### Cores

| Nome | Hex | Uso |
| --- | --- | --- |
| Concreto | `#E4E6E3` | Fundo das telas (piso de oficina, frio, sem tom creme) |
| Chapa | `#FFFFFF` | Cartões e campos |
| Grafite | `#1F2328` | Texto principal, faixa de "Em serviço" |
| Azul placa | `#003399` | Faixa da placa e botão "+ Nova OS" (a única cor de ação) |
| Amarelo sinalização | `#F2B705` | Faixa de "Aguardando" e bloco de pré-cadastros |
| Verde liberado | `#1E7B4A` | Faixa de "Pronto" |

Texto sobre o amarelo é sempre grafite. Todas as combinações de texto passam
o contraste AA (4,5:1), conferido numa ferramenta de contraste.

### Tipografia

Uma família só: **Barlow** (Google Fonts), desenhada a partir de placas de
trânsito e de veículos. Sai a Geist.

- **Barlow Condensed 700**: placa, número da OS e contadores. Números com `tabular-nums`.
- **Barlow 400/600**: todo o resto (texto, botões, campos).
- Escala: 14 / 16 / 20 / 28 / 40 px. Corpo em 16px, entrelinha 1,5.
- Sem rótulos em maiúsculas espaçadas e sem fonte mono (a placa deixa de usar `font-mono`).

### A placa (o elemento marcante)

Um componente `<Placa>` desenha a placa como a placa real do Mercosul:
retângulo branco com borda grafite, faixa azul fina no topo e letras em Barlow
Condensed grandes. É usado em todo lugar do painel onde a placa aparece
(cartões, busca por placa, detalhe da OS, pré-cadastros).

```
┌────────────────┐
│▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│  ← faixa azul placa
│   ABC 1D23     │  ← Barlow Condensed 700
└────────────────┘
```

Para o leitor de tela, a placa continua sendo texto comum (`ABC1D23`).
O resto da tela fica quieto: sem gradiente, sem sombra, sem animação.

### Tela inicial (`/painel`)

No celular (360px), de cima para baixo:

```
┌──────────────────────────────┐
│ Oficina do Zé   Config  Sair │
├──────────────────────────────┤
│ [ Buscar placa      ][Buscar]│
│ [        + Nova OS          ]│  ← azul placa, 56px
│                              │
│ ┌ 2 pré-cadastros ─────────┐ │  ← amarelo, só aparece se houver
│ └──────────────────────────┘ │
│ [ 3 Aguardando ][ 2 Em serv.]│  ← contadores; tocar rola até o grupo
│ [ 1 Pronto     ]             │
│                              │
│ Aguardando                   │
│ ▌┌──────────┐          #41   │  ← faixa de cor do status à esquerda
│ ▌│ ABC 1D23 │                │
│ ▌└──────────┘                │
│ ▌Gol 1.0                     │
│ ▌Maria Souza                 │
│ ▌Orçamento: enviado          │
│ ...                          │
└──────────────────────────────┘
```

- **Contadores** no topo: um por status, com o número grande. Tocar leva ao grupo.
  Servem de resumo do dia e de atalho no celular, onde os grupos ficam longe.
- **Grupos** no computador (≥ 1024px) viram 3 colunas lado a lado, como um quadro
  na parede: Aguardando | Em serviço | Pronto. No celular ficam empilhados.
- **Cartão da OS:** faixa de 6px na cor do status à esquerda (a única marca de status),
  placa grande, `#número` à direita, modelo e cliente embaixo, etiqueta do orçamento
  por último. Sem sombra, borda de 1px. Cantos: placa 4px, cartão 8px.
- **Pré-cadastros:** um bloco amarelo só quando houver pendente. Sem pendente, some
  (hoje mostra "Nenhum pré-cadastro esperando").
- **Grupo vazio:** texto direto, sem cartão: "Nenhum carro aguardando.",
  "Nenhum carro em serviço.", "Nenhum carro pronto."
- Texto alinhado à esquerda em tudo.

### Cabeçalho (layout do `/painel`)

Fundo grafite, nome da oficina em Barlow Condensed branco, links "Configurações"
e "Sair" em branco. Separa bem o cabeçalho do conteúdo no sol.

## Escopo

- Cores e fontes como tokens no `globals.css` (`@theme`) e `next/font` no `layout.tsx` raiz.
- Componente `Placa` em `src/components/placa.tsx`, usado em todas as telas do painel.
- Tela inicial, cabeçalho do painel e `EtiquetaOrcamento` redesenhados como acima.
- As outras telas do painel (OS, itens, placa, pré-cadastro, configurações) só herdam
  fontes, cores e a `Placa`. Redesenho delas fica para depois, se o Luis quiser.
- Telas públicas (`/aprovar`, `/p`) e login ficam como estão.

## Critérios de aceite

- [ ] Nenhuma migração, RPC ou regra alterada. `git diff` só em `src/` (e no README dos tickets).
- [ ] Barlow carregada via `next/font`; Geist removida.
- [ ] `Placa` usada em todos os lugares do painel que mostram placa; nenhum `font-mono` sobrando no painel.
- [ ] Contraste AA conferido para cada par texto/fundo da tabela de cores.
- [ ] Contadores levam ao grupo certo; foco visível no teclado em links, botões e campos.
- [ ] Largura 360px sem rolagem horizontal; 3 colunas a partir de 1024px.
- [ ] Botões e cartões com no mínimo 48px de altura de toque.
- [ ] Lint, tipos e testes existentes passando.
- [ ] Luis testa no celular, **ao ar livre no sol**: acha um carro pela placa em poucos segundos e
      diz em qual status ele está sem ler o título do grupo.
