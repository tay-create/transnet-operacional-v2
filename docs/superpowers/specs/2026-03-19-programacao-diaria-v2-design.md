# Programação Diária v2 — Design Spec

**Data:** 2026-03-19
**Status:** Aprovado

---

## Contexto

O `PainelProgramacao.js` exibe snapshots históricos da programação diária de carregamento, gerados automaticamente pelo cron às 10h e 17h (seg–sex). Cada snapshot registra quantos veículos estão previstos por operação, separando os novos do dia dos reprogramados (vindos de dias anteriores).

### Problemas atuais

1. Os reprogramados são contados por operação como um número único — sem separar por unidade (Recife / Moreno).
2. O critério de reprogramado usa `data_criacao`, que nunca muda. O correto é usar `data_prevista`, que reflete o rollover feito pelo botão "Finalizar Operação".
3. A coluna QUANTIDADE também soma Recife + Moreno sem distinguir.
4. O PDF é um screenshot da tela escura — ilegível para impressão.
5. O botão "Finalizar Operação" avança `data_prevista` de todos os veículos elegíveis sem alertar sobre veículos em status misto (uma unidade em andamento, outra ainda pendente).

---

## Operações e Unidades

| Operação | Unidades envolvidas |
|---|---|
| Delta | Recife + Moreno (ambas) |
| Porcelana | Moreno apenas |
| Eletrik | Moreno apenas |
| Consolidados | Recife + Moreno (operação mista) |

Nomes exibidos sem sufixo de unidade — a separação ocorre dentro das colunas de valores.

> **Nota sobre `data_prevista` compartilhada:** `data_prevista` é uma única coluna por veículo, não por unidade. Quando Recife finaliza, pode avançar veículos mistos que Moreno ainda não concluiu. Comportamento aceito — mitigado pela confirmação extra de status misto descrita na seção 4.

---

## Mudanças

### 1. Backend — `gerarProgramacaoDiaria` (server.js)

**Query:** adicionar `data_prevista` ao SELECT.

```sql
SELECT id, unidade, operacao, data_criacao, data_prevista, status_recife, status_moreno
FROM veiculos
WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
  AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'))
```

> O WHERE com AND é mantido: veículos com pelo menos uma unidade ativa devem aparecer no snapshot.

**Critério de data de referência:**
```
dataRef = (data_prevista ?? data_criacao).substring(0, 10)
```
Ambos os campos são normalizados para `YYYY-MM-DD` via `.substring(0, 10)`, pois `data_criacao` pode ser ISO datetime completo.

**Classificação por veículo:**
- `dataRef < hoje` → reprogramado → incrementa `reprogramado_recife` ou `reprogramado_moreno` conforme `v.unidade`
- `dataRef >= hoje` → lançado hoje → incrementa `recife` ou `moreno` conforme `v.unidade`

**Mapeamento de unidade → campo:**
- `v.unidade === 'Moreno'` → `moreno` / `reprogramado_moreno`
- qualquer outro → `recife` / `reprogramado_recife`

**Mapeamento de operação → chave:**
- `op.includes('DELTA')` → `Delta`
- `op.includes('PORCELANA')` → `Porcelana`
- `op.includes('ELETRIK')` → `Eletrik`
- demais → `Consolidados`

**Inicialização do objeto `totais` (sem campo `reprogramado` legado):**
```js
const totais = {
  Delta:        { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
  Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
};
```

**Novo formato `dados_json` por operação:**
```json
{
  "Delta":        { "recife": 2, "moreno": 1, "reprogramado_recife": 1, "reprogramado_moreno": 0 },
  "Porcelana":    { "recife": 0, "moreno": 3, "reprogramado_recife": 0, "reprogramado_moreno": 1 },
  "Eletrik":      { "recife": 0, "moreno": 2, "reprogramado_recife": 0, "reprogramado_moreno": 0 },
  "Consolidados": { "recife": 4, "moreno": 2, "reprogramado_recife": 2, "reprogramado_moreno": 1 }
}
```

---

### 2. Frontend — `PainelProgramacao.js`

**Detecção de formato por snapshot:**
```js
const isNovoFormato = (dados) =>
  Object.values(dados).some(d => d.reprogramado_recife !== undefined);
```

**Snapshots legados** (apenas campo `reprogramado`): mantém comportamento atual — número único na coluna REPROGRAMADOS, sem badge de unidade.

**Snapshots novos:**

#### Cabeçalho da tabela
| OPERAÇÃO | QUANTIDADE | REPROGRAMADOS |

(Sem badge de unidade ao lado do nome da operação.)

#### Células — novo formato
- **QUANTIDADE:** `Recife: {recife} / Moreno: {moreno}`
  - Se `recife = 0`: exibir só `Moreno: {moreno}`
  - Se `moreno = 0`: exibir só `Recife: {recife}`
- **REPROGRAMADOS:** mesmo padrão com `reprogramado_recife` / `reprogramado_moreno`; cor vermelha quando > 0

#### Rodapé (TOTAL GERAL) — novo formato
```
QUANTIDADE    → Recife: ΣR / Moreno: ΣM
REPROGRAMADOS → Recife: ΣRR / Moreno: ΣRM
```

#### Gráficos de pizza — atualização para novo formato
- **Gráfico 1 (Operações/Unidade):** mantém lógica atual via `UNIDADE_RECIFE`/`UNIDADE_MORENO` + `d.recife`/`d.moreno`
- **Gráfico 2 (Reprogramados/Unidade):**
  - Novo formato: `totalRecifeRepro = Σ reprogramado_recife`, `totalMorenoRepro = Σ reprogramado_moreno`
  - Legado: mantém lógica atual com `d.reprogramado`

---

### 3. PDF — Componente `RelatorioImpressao`

Novo componente `src/components/RelatorioImpressao.js`, renderizado em `<div style={{ position: 'absolute', left: '-9999px', top: 0 }}>` dentro de `PainelProgramacao.js`. O `handleExportPDF` captura esse componente pelo id `relatorio-impressao-print` em vez da div escura atual.

**Configuração html2pdf:** A4 landscape, margem 10mm, qualidade máxima.

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
│  (snapshots no novo formato apenas; legados mostram     │
│   total único sem split na linha correspondente)        │
├─────────────────────────────────────────────────────────┤
│  19/03/2026 — Turno 10h                                 │
│  [tabela: layout igual ao da tela mas tema claro]       │
│  19/03/2026 — Turno 17h                                 │
│  [tabela]                                               │
│  ...um bloco por snapshot do período filtrado           │
└─────────────────────────────────────────────────────────┘
```

**Paleta:**
- Fundo: #ffffff — Texto: #1e293b
- Cabeçalho tabela: #f1f5f9 — Bordas: #e2e8f0
- Valores Recife: #0369a1 (azul) — Valores Moreno: #b45309 (âmbar)
- Reprogramados: #dc2626 (vermelho)

**Tabelas legadas dentro do relatório:** exibem número único na coluna REPROGRAMADOS (mesmo comportamento da tela).

**Resumo executivo:**
- Novo formato: soma `recife`, `moreno`, `reprogramado_recife`, `reprogramado_moreno` de todos os snapshots filtrados
- Legado: soma `recife + moreno` em "Lançados" e `reprogramado` em "Reprogramados" sem split de unidade (exibe como "Total: Z" sem Recife/Moreno)
- Se o período tiver mix de formatos, exibe as duas linhas separadas: "Novos snapshots: Recife X / Moreno Y" e "Snapshots legados: Total Z"

---

### 4. Finalizar Operação — Confirmação Extra para Status Misto

#### Definição de "status misto"
Um veículo está em status misto quando **a unidade que está finalizando** tem seu status dentro dos elegíveis para avanço (`AGUARDANDO`, `EM SEPARAÇÃO`, `LIBERADO P/ DOCA`, `EM CARREGAMENTO`) **e** a outra unidade também está em andamento — ou seja, seu status está em (`EM SEPARAÇÃO`, `LIBERADO P/ DOCA`, `EM CARREGAMENTO`). Veículos onde a outra unidade está `AGUARDANDO` também são considerados mistos por precaução.

#### Fluxo backend — `POST /veiculos/finalizar-operacao`

**Etapa 1 (sem `confirmarMisto`):**
1. Encontrar veículos elegíveis (`data_prevista < hoje`, `campoStatus IN statusParaAvancar`)
2. Dos elegíveis, identificar veículos mistos (outro status ≠ FINALIZADO/Despachado/Em Trânsito/Entregue)
3. Se `conflitos.length > 0` → retornar **sem avançar**:
```json
{ "success": true, "requerConfirmacao": true, "conflitos": 3, "detalhes": ["op1", "op2"] }
```
4. Se sem conflitos → avançar normalmente e retornar resultado final

**Etapa 2 (com `confirmarMisto: true`):**
- Ignorar a checagem de mistos e avançar todos os elegíveis

#### Fluxo frontend — `PainelOperacional.js`

1. Usuário clica "Finalizar" → abre modal de confirmação primária (atual)
2. Usuário confirma → chama API sem `confirmarMisto`
3. Se resposta `requerConfirmacao: true` → fecha modal atual, abre **segundo modal**:
   > "X veículo(s) ainda estão em andamento na outra unidade. Avançar mesmo assim vai reprogramá-los. Deseja continuar?"
4. Usuário confirma segundo modal → chama API com `{ unidade, confirmarMisto: true }`
5. Sucesso → notificação e refresh (igual ao fluxo atual)

**Estado adicional no componente:**
```js
const [confirmarMisto, setConfirmarMisto] = useState(null); // { conflitos: N, detalhes: [] }
```

---

## Compatibilidade com registros legados

| Campo presente | Comportamento tela | Comportamento relatório |
|---|---|---|
| `reprogramado_recife` presente | Split Recife/Moreno em colunas e rodapé | Split Recife/Moreno em tabela e resumo |
| Apenas `reprogramado` | Número único (atual) | Número único, marcado como legado no resumo |

Não há migração de dados históricos.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `server.js` | `gerarProgramacaoDiaria`: query + critério data_prevista + novo formato JSON |
| `src/routes/veiculos.js` | `POST /veiculos/finalizar-operacao`: detecção de mistos + flag `confirmarMisto` |
| `src/components/PainelOperacional.js` | Segundo modal de confirmação para status misto |
| `src/components/PainelProgramacao.js` | Detecção de formato, colunas split, rodapé split, gráfico 2, integração RelatorioImpressao |
| `src/components/RelatorioImpressao.js` | Novo componente — tema claro, cabeçalho, resumo executivo, tabelas |
