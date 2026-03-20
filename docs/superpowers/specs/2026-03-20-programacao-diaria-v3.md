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
WHERE data_prevista::date = $1
  AND (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
  AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
```
Parâmetro `$1` = `hojeStr` (YYYY-MM-DD local).

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

**Query — Programação Final:**
```sql
SELECT id, unidade, operacao
FROM veiculos
WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
  AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
```

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
Auth: requerida (mesmo padrão das rotas protegidas)
Body: { turno: 'Inicial' | 'Final' }
Response: { success: true, turno, data_referencia }
```

Chama `gerarProgramacaoDiaria(turno)` internamente. Se `turno` não for `'Inicial'` ou `'Final'`, retorna erro 400.

#### 2d. Gravar `data_prevista_original` na criação do veículo

No `POST /veiculos`, incluir `data_prevista_original` na lista de colunas do INSERT, recebendo o valor do body (`req.body.data_prevista_original`).

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

Após geração bem-sucedida, chamar `carregarDados()` automaticamente.

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
| `server.js` | Remover crons, atualizar `gerarProgramacaoDiaria`, novo endpoint POST, gravar `data_prevista_original` no INSERT |
| `src/App.js` | Incluir `data_prevista_original` no payload de criação |
| `src/components/PainelProgramacao.js` | Botões Gerar Inicial/Final, estado `gerando`, função `gerarProgramacao` |
