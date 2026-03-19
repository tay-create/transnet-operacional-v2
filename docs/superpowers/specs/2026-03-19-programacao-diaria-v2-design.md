# Programação Diária v2 — Design Spec

**Data:** 2026-03-19
**Status:** Aprovado

---

## Contexto

O `PainelProgramacao.js` exibe snapshots históricos da programação diária de carregamento, gerados automaticamente pelo cron às 10h e 17h (seg–sex). Cada snapshot registra quantos veículos estão previstos por operação, separando os novos do dia dos reprogramados (vindos de dias anteriores).

### Problema atual

1. Os reprogramados são contados por operação como um número único — sem separar por unidade (Recife / Moreno).
2. O critério de reprogramado usa `data_criacao`, que nunca muda. O correto é usar `data_prevista`, que reflete o rollover feito pelo botão "Finalizar Operação".
3. A coluna QUANTIDADE também soma Recife + Moreno sem distinguir.
4. O PDF é um screenshot da tela escura — ilegível para impressão.

---

## Operações e Unidades

| Operação | Unidades envolvidas |
|---|---|
| Delta | Recife + Moreno (ambas) |
| Porcelana | Moreno apenas |
| Eletrik | Moreno apenas |
| Consolidados | Recife + Moreno (operação mista) |

Nomes exibidos sem sufixo de unidade — a separação ocorre dentro das colunas de valores.

---

## Mudanças

### 1. Backend — `gerarProgramacaoDiaria` (server.js)

**Query:** adicionar `data_prevista` ao SELECT.

**Critério de data de referência:**
```
dataRef = data_prevista ?? data_criacao
```

**Classificação por veículo:**
- `dataRef < hoje` → reprogramado → incrementa `reprogramado_recife` ou `reprogramado_moreno` conforme `v.unidade`
- `dataRef >= hoje` → lançado hoje → incrementa `recife` ou `moreno` conforme `v.unidade`

**Mapeamento de unidade → campo:**
- `v.unidade === 'Moreno'` → `moreno` / `reprogramado_moreno`
- qualquer outro → `recife` / `reprogramado_recife`

**Novo formato `dados_json` por operação:**
```json
{
  "Delta":        { "recife": 2, "moreno": 1, "reprogramado_recife": 1, "reprogramado_moreno": 0 },
  "Porcelana":    { "recife": 0, "moreno": 3, "reprogramado_recife": 0, "reprogramado_moreno": 1 },
  "Eletrik":      { "recife": 0, "moreno": 2, "reprogramado_recife": 0, "reprogramado_moreno": 0 },
  "Consolidados": { "recife": 4, "moreno": 2, "reprogramado_recife": 2, "reprogramado_moreno": 1 }
}
```

> O campo `reprogramado` legado não é gravado em novos snapshots.

**Inicialização do objeto `totais`:**
```js
const totais = {
  Delta:        { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
};
```

---

### 2. Frontend — `PainelProgramacao.js`

**Detecção de formato:**
```js
const isNovoFormato = (dados) =>
  Object.values(dados).some(d => d.reprogramado_recife !== undefined);
```

**Snapshots legados** (sem `reprogramado_recife`): exibir comportamento atual — número único na coluna REPROGRAMADOS.

**Snapshots novos:**

#### Cabeçalho da tabela
| OPERAÇÃO | QUANTIDADE | REPROGRAMADOS |
|---|---|---|

(Remove badge de unidade ao lado do nome da operação.)

#### Células — novo formato
- QUANTIDADE: `Recife: {recife} / Moreno: {moreno}`
  - Se recife = 0: exibir só `Moreno: {moreno}`
  - Se moreno = 0: exibir só `Recife: {recife}`
- REPROGRAMADOS: mesmo padrão com `reprogramado_recife` / `reprogramado_moreno`

#### Rodapé (TOTAL GERAL)
```
QUANTIDADE   → Recife: ΣR / Moreno: ΣM
REPROGRAMADOS → Recife: ΣRR / Moreno: ΣRM
```

---

### 3. PDF — Componente `RelatorioImpressao`

Novo componente renderizado em div oculta (`position: absolute; left: -9999px`), capturado pelo `html2pdf` no lugar da div da tela escura.

**Configuração html2pdf:** A4 landscape, margem 10mm, qualidade máxima (igual ao atual).

#### Estrutura do relatório (tema claro)

```
┌─────────────────────────────────────────────────────────┐
│  PROGRAMAÇÃO DIÁRIA DE CARREGAMENTO                     │
│  Período: DD/MM/AAAA a DD/MM/AAAA                       │
│  Gerado em: DD/MM/AAAA às HH:MM                         │
├─────────────────────────────────────────────────────────┤
│  RESUMO EXECUTIVO                                        │
│  Total Lançados: Recife X / Moreno Y = Z                │
│  Total Reprogramados: Recife X / Moreno Y = Z           │
│  (calculado sobre os snapshots do período filtrado)     │
├─────────────────────────────────────────────────────────┤
│  19/03/2026 — Turno 10h                                 │
│  [tabela fundo branco, texto escuro, sem badges]        │
│  19/03/2026 — Turno 17h                                 │
│  [tabela]                                               │
└─────────────────────────────────────────────────────────┘
```

**Paleta do relatório:**
- Fundo: branco (#ffffff)
- Texto principal: #1e293b
- Cabeçalho tabela: #f1f5f9
- Bordas: #e2e8f0
- Reprogramados: vermelho escuro (#dc2626)
- Valores Recife: #0369a1 (azul)
- Valores Moreno: #b45309 (âmbar)

**Resumo executivo:** agrega todos os snapshots do período filtrado (`programacoesFiltradas`), somando apenas snapshots no novo formato. Snapshots legados são somados com o total único sem split.

---

## Compatibilidade com registros legados

| Campo presente | Comportamento |
|---|---|
| `reprogramado_recife` presente | Novo formato — exibe split Recife/Moreno |
| Apenas `reprogramado` | Legado — exibe número único (comportamento atual) |

Não há migração de dados históricos.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `server.js` | `gerarProgramacaoDiaria`: query + lógica de classificação + novo formato JSON |
| `src/components/PainelProgramacao.js` | Detecção de formato, colunas split, rodapé split, integração RelatorioImpressao |
| `src/components/RelatorioImpressao.js` | Novo componente — tema claro, cabeçalho, resumo executivo, tabelas |
