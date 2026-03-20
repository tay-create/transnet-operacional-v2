# Programação Diária v3 — Design Spec

**Data:** 2026-03-20
**Status:** Aprovado

---

## Contexto

A Programação Diária atualmente é gerada automaticamente por crons às 10h e 17h (seg–sex). O usuário quer substituir esse mecanismo por geração manual via dois botões: **Inicial** e **Final**, com lógica de classificação completamente revisada.

---

## Conceitos

### Programação Inicial
Snapshot gerado manualmente pelo botão "Gerar Inicial". Representa a programação do início do dia operacional.

- **Programados:** veículos com `data_prevista = hoje` que nunca tiveram a data alterada desde a criação (lançados ontem ou hoje via NovoLançamento para o dia de hoje).
- **Reprogramados:** veículos com `data_prevista = hoje` mas que tiveram a data alterada após a criação (foram movidos para hoje via PainelOperacional ou Finalizar Operação).

> **Limitação conhecida:** Veículos que já avançaram para `CARREGADO` ou `LIBERADO P/ CT-e` antes do botão ser pressionado são excluídos da Programação Inicial (a query exclui esses status). Se o botão for acionado tarde na manhã, alguns veículos já carregados não aparecerão no snapshot. Comportamento aceito — a Programação Inicial é idealmente gerada no início do dia.

### Programação Final
Snapshot gerado manualmente pelo botão "Gerar Final". Representa o estado ao fim do dia — todos os veículos ainda ativos.

- **Programados:** todos os veículos ativos (não em status terminal), independente de `data_prevista`. Inclui veículos em `CARREGADO` e `LIBERADO P/ CT-e`.
- **Reprogramados:** sempre **0**.

---

## Mudanças

### 1. Banco de Dados — novo campo `data_prevista_original`

Adicionar coluna à tabela `veiculos`:

```sql
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS data_prevista_original TEXT;
```

**Regras:**
- Preenchido na criação do veículo com o mesmo valor de `data_prevista`
- Nunca alterado por nenhuma rota de update
- Veículos existentes ficam com `NULL` — tratados como Programados (benefício da dúvida)

Adicionar à lista `colunasParaAdicionar` em `src/database/migrations.js`.

> **Nota operacional:** Após a migration rodar (primeira inicialização do servidor com o novo código), reiniciar o PM2 não é necessário além do deploy normal — a migration é executada automaticamente no startup do `server.js`.

---

### 2. Backend — `server.js`

#### 2a. Remover crons
Remover as duas linhas de `cron.schedule`:
```js
cron.schedule('0 10 * * 1-5', () => gerarProgramacaoDiaria('10h'), ...);
cron.schedule('0 17 * * 1-5', () => gerarProgramacaoDiaria('17h'), ...);
```

#### 2b. Atualizar função `gerarProgramacaoDiaria`

**Query — Programação Inicial:**
```sql
SELECT id, unidade, operacao, data_prevista, data_prevista_original
FROM veiculos
WHERE LEFT(data_prevista, 10) = $1
  AND (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
  AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
```
Parâmetro `$1` = `hojeStr` (YYYY-MM-DD local). Chamada: `await dbAll(sql, [hojeStr])`.

> **`LEFT()` em vez de `::date`:** Como `data_prevista` é TEXT e pode conter `YYYY-MM-DDThh:mm`, o cast `::date` falharia em runtime. `LEFT(data_prevista, 10)` extrai os primeiros 10 caracteres (a parte da data) de forma segura.

> **Formato dos campos de data:** `data_prevista` e `data_prevista_original` são armazenados como `TEXT` no formato `YYYY-MM-DD` (ou com hora: `YYYY-MM-DDThh:mm`). O `substring(0, 10)` extrai apenas a parte da data, tornando a comparação segura independente da presença ou não de horário.

**Classificação por veículo — Inicial:**
```js
const foiReprogramado =
  v.data_prevista_original !== null &&
  v.data_prevista_original !== undefined &&
  v.data_prevista_original.substring(0, 10) !== v.data_prevista.substring(0, 10);

if (foiReprogramado) {
  // incrementa reprogramado_recife ou reprogramado_moreno
} else {
  // incrementa recife ou moreno
}
```
> `v.data_prevista` é seguro de acessar sem null-guard: a query Inicial filtra por `LEFT(data_prevista, 10) = $1`, garantindo que apenas rows com `data_prevista` não-nulo são retornadas.

**Query — Programação Final:**
```sql
SELECT id, unidade, operacao
FROM veiculos
WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
  AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
```
> **Sem filtro de data intencional:** A query Final não filtra por `data_prevista`. Inclui todos os veículos ainda ativos no sistema, independente de quando foram programados. Isso reflete o estado real da operação ao fim do dia — veículos de dias anteriores ainda em aberto também aparecem. Chamada: `await dbAll(sql, [])`.

**Classificação por veículo — Final:**
- Todo veículo retornado incrementa `recife` ou `moreno` conforme `v.unidade`
- `reprogramado_recife` e `reprogramado_moreno` sempre 0

**Mapeamento operação → chave** (igual ao atual):
- `op.includes('DELTA')` → `Delta`
- `op.includes('PORCELANA')` → `Porcelana`
- `op.includes('ELETRIK')` → `Eletrik`
- demais → `Consolidados`

**Mapeamento unidade → campo** (igual ao atual):
- `v.unidade === 'Moreno'` → `moreno` / `reprogramado_moreno`
- qualquer outro → `recife` / `reprogramado_recife`

**Formato `dados_json`** (sem mudança em relação à v2):
```json
{
  "Delta":        { "recife": N, "moreno": N, "reprogramado_recife": N, "reprogramado_moreno": N },
  "Porcelana":    { "recife": N, "moreno": N, "reprogramado_recife": N, "reprogramado_moreno": N },
  "Eletrik":      { "recife": N, "moreno": N, "reprogramado_recife": N, "reprogramado_moreno": N },
  "Consolidados": { "recife": N, "moreno": N, "reprogramado_recife": N, "reprogramado_moreno": N }
}
```

#### 2c. Novo endpoint de geração manual

```
POST /api/programacao-diaria/gerar
Auth: requerida — usar authorize(['admin', 'supervisor', 'operador']) (mesmo padrão das rotas protegidas existentes)
Body: { turno: 'Inicial' | 'Final' }
Response: { success: true, turno, data_referencia }
```

Chama `gerarProgramacaoDiaria(turno)` internamente. Se `turno` não for `'Inicial'` ou `'Final'`, retorna erro 400.

**Idempotência — comportamento ao pressionar o botão mais de uma vez:**
Se já existir um snapshot com o mesmo `(data_referencia, turno)`, o endpoint sobrescreve: DELETE o registro existente, depois INSERT o novo. Isso garante que pressionar "Gerar Inicial" duas vezes no mesmo dia simplesmente atualiza o snapshot com os dados mais recentes, sem duplicar registros.

O valor armazenado na coluna `turno` da tabela `frota_programacao_diaria` é exatamente o string recebido no body (`'Inicial'` ou `'Final'`). O valor armazenado em `data_referencia` é `hojeStr` (data local no formato `YYYY-MM-DD` calculada no início de `gerarProgramacaoDiaria`). O campo `data_prevista` da tabela `veiculos` é sempre não-nulo para veículos inseridos via `POST /veiculos`; registros legados com `data_prevista = NULL` não serão retornados pela query Inicial (que filtra por `LEFT(data_prevista, 10) = $1`).

#### 2d. Gravar `data_prevista_original` na criação do veículo

Em `src/routes/veiculos.js`, no `POST /veiculos`, incluir `data_prevista_original` na lista de colunas do INSERT, recebendo o valor do body (`req.body.data_prevista_original`).

---

### 3. Frontend — `src/App.js`

No payload de criação do veículo (chamada `POST /veiculos` originada do NovoLançamento), adicionar:
```js
data_prevista_original: formData.data_prevista
```

---

### 4. Frontend — `src/components/PainelProgramacao.js`

#### Dois novos botões no header

```jsx
<button onClick={() => gerarProgramacao('Inicial')} disabled={gerando === 'Inicial'}>
  {gerando === 'Inicial' ? 'Gerando...' : 'Gerar Inicial'}
</button>
<button onClick={() => gerarProgramacao('Final')} disabled={gerando === 'Final'}>
  {gerando === 'Final' ? 'Gerando...' : 'Gerar Final'}
</button>
```

Estado: `const [gerando, setGerando] = useState(null)` — valor `'Inicial'`, `'Final'` ou `null`.

Após geração bem-sucedida, chamar `carregarDados()` automaticamente. (`carregarDados` é a função de busca de dados já existente no componente `PainelProgramacao.js`.)

#### Função de geração

```js
const gerarProgramacao = async (turno) => {
  setGerando(turno);
  try {
    await api.post('/api/programacao-diaria/gerar', { turno });
    await carregarDados();
  } catch (e) {
    console.error('Erro ao gerar programação:', e);
  } finally {
    setGerando(null);
  }
};
```

#### Display do turno

| Valor no banco | Label exibido |
|---|---|
| `Inicial` | Turno **Inicial** |
| `Final` | Turno **Final** |
| `10h` | Turno **10h** |
| `17h` | Turno **17h** |

Sem mudança em tabela, rodapé ou gráfico — o design da v2 é mantido.

---

## Compatibilidade com snapshots legados

Snapshots existentes com `turno = '10h'` ou `'17h'` continuam sendo exibidos normalmente no painel. Nenhuma migração de dados históricos.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/database/migrations.js` | ADD COLUMN `data_prevista_original TEXT` em veiculos |
| `server.js` | Remover crons, atualizar `gerarProgramacaoDiaria`, novo endpoint POST |
| `src/routes/veiculos.js` | Gravar `data_prevista_original` no INSERT do POST /veiculos |
| `src/App.js` | Incluir `data_prevista_original` no payload de criação |
| `src/components/PainelProgramacao.js` | Botões Gerar Inicial/Final, estado `gerando`, função `gerarProgramacao` |
