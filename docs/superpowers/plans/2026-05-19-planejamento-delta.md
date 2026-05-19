# PlanejamentoDelta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as abas DELTA-PORCELANA e ELETRIK da planilha "Operação Maio/2026" por UI dentro do sistema, mirando 1º de junho de 2026. Reusa tabelas/endpoints do `PlanejamentoTramontina` estendendo com `aba_origem` + campos financeiros (ELETRIK).

**Architecture:** 4 sprints, cada uma mergeada de `develop → main` separadamente. Backend (Sprint 1): migration adicionando colunas em `tramontina_rotas` + 3 permissões novas + endpoints aceitando `aba` e campos financeiros com guard por permissão. Frontend (Sprint 2): refactor de `PlanejamentoTramontina.js` extraindo componentes em `src/components/planejamento/` (CardRota expansível, blocos DadosRota/Destinos/Financeiro, KpisStrip). Integração gerador (Sprint 3): `geradorRotas.js` ganha despachante via env `GERADOR_FONTE=banco|planilha`. Polish (Sprint 4): bugs, filtros, validações.

**Tech Stack:** Node.js/Express + PostgreSQL (`dbGet`/`dbRun`/`dbAll`), React 18 (sem libs novas — segue padrões de Lucide icons + styled inline), Socket.io (eventos `tramontina_*` reusados).

**Spec de referência:** `docs/superpowers/specs/2026-05-19-planejamento-delta-design.md`

---

## Mapa de arquivos

| Sprint | Arquivo | O que muda |
|--------|---------|-----------|
| 1 | `src/database/migrations.js` | ALTER TABLE `tramontina_rotas` (5 colunas) + INSERT permissoes (3 keys × N cargos) |
| 1 | `src/routes/tramontina.js` | GET/POST/PUT aceitam `aba` + campos financeiros com guard de permissão. KPIs estendidos. |
| 2 | `src/components/PlanejamentoTramontina.js` | Refactor: state `abaAtiva`, render usando `<CardRota>`, KpisStrip, ocultar botão Importar XLSX |
| 2 | `src/components/planejamento/CardRota.js` | **NOVO** — card expansível com 3 blocos |
| 2 | `src/components/planejamento/BlocoDadosRota.js` | **NOVO** — bloco edição dados rota |
| 2 | `src/components/planejamento/BlocoDestinos.js` | **NOVO** — lista entregas + add/edit/delete |
| 2 | `src/components/planejamento/BlocoFinanceiro.js` | **NOVO** — só renderiza quando aba=ELETRIK |
| 2 | `src/components/planejamento/KpisStrip.js` | **NOVO** — KPIs horizontais (operacional + financeiro condicional) |
| 2 | `src/utils/formatBRL.js` | **NOVO** — formatar/parsear valores R$ |
| 2 | `src/components/Sidebar.js` | Renomear label "Planejamento Tramontina" → "Planejamento"; slug `planejamento_tramontina` continua aceito |
| 3 | `src/utils/geradorRotas.js` | Despachante `GERADOR_FONTE` + função `buscarRotaPorColetaNoBanco`, `buscarEntregasAgendadasPorColetaNoBanco` |
| 3 | `.github/workflows/deploy-staging.yml` | Adicionar `GERADOR_FONTE=banco` no `.env.staging` |
| 4 | Vários | Bugs + polish |

---

## Sprint 1 — Backend (Dias 1-2, qua-qui 21-22 maio)

### Task 1.1: Migration — adicionar colunas e permissões

**Files:**
- Modify: `src/database/migrations.js`

#### Contexto

Em `src/database/migrations.js`, a função `runMigrations()` cria/altera tabelas em sequência. Tem padrões consolidados:
- `ALTER TABLE IF NOT EXISTS` é feito com `try/catch` em volta porque o Postgres não suporta `IF NOT EXISTS` em ADD COLUMN diretamente (mas o código geralmente usa um padrão de array iterando — busque "ALTER TABLE" para ver exemplos).
- Seed de permissões: procurar `INSERT INTO permissoes` no arquivo para ver o padrão.

- [ ] **Step 1: Localizar fim do bloco de migrations de `tramontina_rotas` em `migrations.js`**

Use Grep com pattern `tramontina_rotas` em `src/database/migrations.js` para achar a região de tramontina. Depois das colunas existentes, adicionar bloco novo. Localizar a linha onde termina a criação/migration da tabela `tramontina_rotas`.

- [ ] **Step 2: Adicionar coluna `aba_origem` + índice**

Adicionar ao final do bloco tramontina:

```js
// PlanejamentoDelta: distingue rotas DELTA-PORCELANA vs ELETRIK (2026-05-19)
await dbRun(`ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS aba_origem TEXT DEFAULT 'DELTA-PORCELANA'`).catch(() => {});
await dbRun(`CREATE INDEX IF NOT EXISTS idx_tramontina_rotas_aba ON tramontina_rotas(aba_origem)`).catch(() => {});
```

- [ ] **Step 3: Adicionar campos financeiros (status, valor_carga, valor_frete)**

Logo abaixo:

```js
await dbRun(`ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS status_financeiro TEXT`).catch(() => {});
// Constraint adicionada separada pra ser idempotente
await dbRun(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.constraint_column_usage
            WHERE table_name='tramontina_rotas' AND constraint_name='tramontina_rotas_status_financeiro_check'
        ) THEN
            ALTER TABLE tramontina_rotas ADD CONSTRAINT tramontina_rotas_status_financeiro_check
            CHECK (status_financeiro IS NULL OR status_financeiro IN ('CONCLUIDO','EM_ROTA_DE_ENTREGA','PENDENTE'));
        END IF;
    END$$;
`).catch(() => {});

await dbRun(`ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS valor_carga NUMERIC(14,2)`).catch(() => {});
await dbRun(`ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(14,2)`).catch(() => {});
```

- [ ] **Step 4: Adicionar coluna GENERATED `representatividade_pct`**

```js
await dbRun(`
    ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS representatividade_pct NUMERIC(7,2)
    GENERATED ALWAYS AS (
        CASE
            WHEN valor_carga IS NOT NULL AND valor_carga > 0 AND valor_frete IS NOT NULL
            THEN (valor_frete / valor_carga) * 100
            ELSE NULL
        END
    ) STORED
`).catch(() => {});
```

- [ ] **Step 5: Seed das 3 permissões novas**

Procurar bloco de `INSERT INTO permissoes` que já existe em `migrations.js` para Tramontina (`tramontina_planejamento`, `tramontina_editar`). Logo abaixo adicionar:

```js
const permissoesDelta = [
    ['Direção', 'delta_ver'],
    ['Coordenador', 'delta_ver'],
    ['Planejamento', 'delta_ver'],
    ['Desenvolvedor', 'delta_ver'],
    ['Pos-Embarque', 'delta_ver'],
    ['Coordenador', 'delta_editar_operacional'],
    ['Planejamento', 'delta_editar_operacional'],
    ['Desenvolvedor', 'delta_editar_operacional'],
    ['Pos-Embarque', 'delta_editar_operacional'],
    ['Coordenador', 'delta_editar_financeiro'],
    ['Planejamento', 'delta_editar_financeiro'],
    ['Pos-Embarque', 'delta_editar_financeiro'],
    ['Desenvolvedor', 'delta_editar_financeiro'],
];
for (const [cargo, permissao] of permissoesDelta) {
    await dbRun(
        `INSERT INTO permissoes (cargo, permissao) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [cargo, permissao]
    ).catch(() => {});
}
```

- [ ] **Step 6: Restart staging container e verificar logs**

```bash
echo 124578595 | sudo -S docker restart transnet-staging
echo 124578595 | sudo -S docker logs --tail 100 transnet-staging 2>&1 | grep -iE "error|migration"
```

Expected: sem erros relacionados a `tramontina_rotas` ou `permissoes`.

- [ ] **Step 7: Validar colunas no banco staging**

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "\d tramontina_rotas" 2>&1 | grep -E "aba_origem|status_financeiro|valor_carga|valor_frete|representatividade_pct"
```

Expected: as 5 colunas aparecem listadas com tipos corretos.

- [ ] **Step 8: Validar permissões inseridas**

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "SELECT cargo, permissao FROM permissoes WHERE permissao LIKE 'delta_%' ORDER BY permissao, cargo;"
```

Expected: 13 linhas (5 de delta_ver, 4 de delta_editar_operacional, 4 de delta_editar_financeiro).

- [ ] **Step 9: Validar coluna calculada funciona**

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "INSERT INTO tramontina_rotas (mes_referencia, numero_rota, coleta, aba_origem, valor_carga, valor_frete) VALUES ('2026-99', 99999, 'TEST', 'ELETRIK', 1000.00, 200.00) RETURNING id, representatividade_pct;"
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "DELETE FROM tramontina_rotas WHERE mes_referencia='2026-99';"
```

Expected: `representatividade_pct = 20.00`.

- [ ] **Step 10: Commit**

```bash
git add src/database/migrations.js
git commit -m "feat(delta): migration aba_origem + financeiro + permissoes"
```

---

### Task 1.2: Backend — Endpoints aceitam `aba` e campos financeiros

**Files:**
- Modify: `src/routes/tramontina.js`

#### Contexto

`src/routes/tramontina.js` tem endpoints `GET /api/tramontina/rotas`, `POST /api/tramontina/rotas`, `PUT /api/tramontina/rotas/:id`, `DELETE /api/tramontina/rotas/:id`, e os de entregas. Auth via middleware `authorize(['cargo1','cargo2'])` que aceita lista de cargos OU lista de permissões — verificar como funciona lendo `src/middleware/authMiddleware.js` se necessário.

A função `recalcularEntrega()` existe e recalcula `dias_uteis` + `lead_status` quando entrega é criada/editada — não mexer.

- [ ] **Step 1: Helper interno `temPermissaoFinanceiro(req)`**

No topo do `tramontina.js`, depois dos imports, adicionar:

```js
function temPermissaoFinanceiro(req) {
    const perms = req.user?.permissoes || [];
    return perms.includes('delta_editar_financeiro');
}

// Sanitiza body: se user não tem permissão financeira, remove os 3 campos
function sanitizarFinanceiro(body, req) {
    if (temPermissaoFinanceiro(req)) return body;
    const { status_financeiro, valor_carga, valor_frete, ...resto } = body;
    return resto;
}
```

- [ ] **Step 2: Adicionar filtro `aba` no GET /api/tramontina/rotas**

Localizar o handler `router.get('/rotas', ...)`. Olhar onde define `mes_referencia` da query. Adicionar:

```js
const aba = (req.query.aba || 'DELTA-PORCELANA').toUpperCase();
const abasValidas = ['DELTA-PORCELANA', 'ELETRIK'];
if (!abasValidas.includes(aba)) {
    return res.status(400).json({ success: false, message: 'aba inválida' });
}
```

E na query SQL, adicionar `AND aba_origem = $N` no WHERE (incrementar o número do placeholder e o array de params).

A query SELECT deve incluir as novas colunas:
```sql
SELECT r.id, r.mes_referencia, r.numero_rota, r.coleta, r.data_criacao, r.data_prevista,
       r.data_embarque, r.operacao_codigo, r.tipo_veiculo, r.motorista_nome,
       r.placa_cavalo, r.placa_carreta, r.redespacho, r.status_embarque, r.veiculo_id,
       r.observacao, r.aba_origem, r.status_financeiro, r.valor_carga, r.valor_frete,
       r.representatividade_pct, r.atualizado_em
FROM tramontina_rotas r
WHERE r.mes_referencia = $1 AND r.aba_origem = $2
ORDER BY r.numero_rota ASC NULLS LAST, r.id ASC
```

- [ ] **Step 3: POST /rotas aceita aba_origem + financeiros**

No handler `router.post('/rotas', ...)`, antes de inserir:

```js
const body = sanitizarFinanceiro(req.body || {}, req);
const aba = (body.aba_origem || 'DELTA-PORCELANA').toUpperCase();
if (!['DELTA-PORCELANA', 'ELETRIK'].includes(aba)) {
    return res.status(400).json({ success: false, message: 'aba_origem inválida' });
}
// Se body tinha campos financeiros mas user não tem permissão, retorna 403 explícito
const tinhaFinanceiro = req.body && (req.body.status_financeiro !== undefined
    || req.body.valor_carga !== undefined || req.body.valor_frete !== undefined);
if (tinhaFinanceiro && !temPermissaoFinanceiro(req)) {
    return res.status(403).json({ success: false, message: 'Sem permissão para editar campos financeiros' });
}
```

Estender o INSERT pra incluir as novas colunas:

```sql
INSERT INTO tramontina_rotas (
    mes_referencia, numero_rota, coleta, data_criacao, data_prevista, data_embarque,
    operacao_codigo, tipo_veiculo, motorista_nome, placa_cavalo, placa_carreta,
    redespacho, observacao, aba_origem,
    status_financeiro, valor_carga, valor_frete
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
)
RETURNING *
```

Adaptar a lista de params adequadamente.

- [ ] **Step 4: PUT /rotas/:id idem POST**

Mesma validação. UPDATE deve incluir SET nas novas colunas quando vierem no body. Manter o `recalcularEntrega` existente para data_embarque.

- [ ] **Step 5: GET /api/tramontina/kpis estende com financeiros**

Localizar o handler `router.get('/kpis', ...)`. Adicionar query param `aba` (igual GET /rotas). Após a query de KPIs existente, se `aba === 'ELETRIK'`:

```js
let kpisFinanceiros = {};
if (aba === 'ELETRIK') {
    const fin = await dbGet(`
        SELECT
            COALESCE(SUM(valor_carga), 0) AS total_mercadoria,
            COALESCE(SUM(valor_frete), 0) AS total_frete,
            COALESCE(AVG(representatividade_pct) FILTER (WHERE representatividade_pct IS NOT NULL), 0) AS repres_media
        FROM tramontina_rotas
        WHERE mes_referencia = $1 AND aba_origem = 'ELETRIK'
    `, [mes]);
    kpisFinanceiros = {
        total_mercadoria: parseFloat(fin.total_mercadoria) || 0,
        total_frete: parseFloat(fin.total_frete) || 0,
        repres_media: parseFloat(fin.repres_media) || 0,
    };
}
// Adicionar kpisFinanceiros ao response final
res.json({ success: true, ...kpisExistentes, ...kpisFinanceiros });
```

- [ ] **Step 6: Authorize aceita `delta_*` OU `tramontina_*`**

Olhar como os handlers usam `authorize(['Coordenador', 'Planejamento'])`. Mudar para aceitar OR de permissões. Se o middleware atual não suporta isso, criar um guard local:

```js
function authDelta(req, res, next) {
    const perms = req.user?.permissoes || [];
    if (perms.includes('delta_ver') || perms.includes('tramontina_planejamento')) return next();
    return res.status(403).json({ success: false, message: 'Sem permissão' });
}
function authDeltaEditar(req, res, next) {
    const perms = req.user?.permissoes || [];
    if (perms.includes('delta_editar_operacional') || perms.includes('tramontina_editar')) return next();
    return res.status(403).json({ success: false, message: 'Sem permissão para editar' });
}
```

Substituir os `authorize(...)` chamados nos handlers do tramontina por esses dois conforme aplicável (`authDelta` para GETs, `authDeltaEditar` para POST/PUT/DELETE).

- [ ] **Step 7: Restart staging**

```bash
echo 124578595 | sudo -S docker restart transnet-staging
sleep 5
echo 124578595 | sudo -S docker logs --tail 30 transnet-staging 2>&1
```

Expected: aplicação sobe sem erro.

- [ ] **Step 8: Validar GET /rotas via curl**

```bash
# pegue um token válido logando primeiro via /login (use credenciais admin master)
TOKEN="<seu-token>"
curl -s "https://homolog.tnethub.com.br/api/tramontina/rotas?mes=2026-06&aba=ELETRIK" -H "Authorization: Bearer $TOKEN" | head -200
```

Expected: `{ "success": true, "rotas": [] }` sem 500.

- [ ] **Step 9: Validar POST com financeiro**

```bash
curl -s -X POST "https://homolog.tnethub.com.br/api/tramontina/rotas" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mes_referencia":"2026-06","numero_rota":1,"coleta":"TEST001","aba_origem":"ELETRIK","valor_carga":1000.00,"valor_frete":200.00,"status_financeiro":"PENDENTE"}'
```

Expected: response inclui `representatividade_pct: 20.00`.

- [ ] **Step 10: Validar 403 sem permissão**

Logar com user que não tem `delta_editar_financeiro` (ex: Encarregado). Repetir o POST acima.

Expected: 403 com `"Sem permissão para editar campos financeiros"`.

- [ ] **Step 11: Limpar rota de teste**

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "DELETE FROM tramontina_rotas WHERE coleta = 'TEST001';"
```

- [ ] **Step 12: Commit**

```bash
git add src/routes/tramontina.js
git commit -m "feat(delta): endpoints aceitam aba + campos financeiros com guard"
```

- [ ] **Step 13: Build + push develop → main**

```bash
npm run build 2>&1 | tail -3
git push origin develop
# aguardar CI staging
# então merge develop → main
git checkout main && git pull --ff-only origin main
git merge --no-ff develop -m "release(delta-sprint1): backend completo"
git push origin main
git checkout develop
```

---

## Sprint 2 — Frontend cards expansíveis (Dias 3-5, sex-dom 23-25 maio)

### Task 2.1: Helper `formatBRL.js`

**Files:**
- Create: `src/utils/formatBRL.js`

- [ ] **Step 1: Criar utilitário**

```js
// src/utils/formatBRL.js — formata e parseia valores em Real brasileiro

export function formatBRL(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const n = Number(valor);
    if (isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

// Parse: "R$ 1.234,56" → 1234.56. "1.234,56" → 1234.56. "1234.56" → 1234.56. "" → null.
export function parseBRL(texto) {
    if (texto === null || texto === undefined) return null;
    const s = String(texto).trim();
    if (!s) return null;
    // Remove "R$", espaços, e separadores de milhar
    const limpo = s.replace(/R\$\s?/g, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(limpo);
    return isNaN(n) ? null : n;
}
```

- [ ] **Step 2: Criar testes unitários**

`src/utils/formatBRL.test.js`:

```js
import { formatBRL, parseBRL } from './formatBRL';

describe('formatBRL', () => {
    test('formata número inteiro como R$ pt-BR', () => {
        expect(formatBRL(1000)).toBe('R$ 1.000,00');
    });
    test('formata decimal com 2 casas', () => {
        expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
    });
    test('arredonda para 2 casas', () => {
        expect(formatBRL(1234.567)).toBe('R$ 1.234,57');
    });
    test('formata zero', () => {
        expect(formatBRL(0)).toBe('R$ 0,00');
    });
    test('retorna vazio para null', () => {
        expect(formatBRL(null)).toBe('');
    });
    test('retorna vazio para undefined', () => {
        expect(formatBRL(undefined)).toBe('');
    });
    test('retorna vazio para string vazia', () => {
        expect(formatBRL('')).toBe('');
    });
    test('retorna vazio para NaN', () => {
        expect(formatBRL('abc')).toBe('');
    });
    test('aceita string numérica', () => {
        expect(formatBRL('1234.56')).toBe('R$ 1.234,56');
    });
});

describe('parseBRL', () => {
    test('parseia formato BR completo', () => {
        expect(parseBRL('R$ 1.234,56')).toBe(1234.56);
    });
    test('parseia sem prefixo R$', () => {
        expect(parseBRL('1.234,56')).toBe(1234.56);
    });
    test('parseia número simples com ponto', () => {
        expect(parseBRL('1234.56')).toBe(1234.56);
    });
    test('parseia número inteiro', () => {
        expect(parseBRL('1234')).toBe(1234);
    });
    test('parseia com múltiplos separadores de milhar', () => {
        expect(parseBRL('R$ 1.234.567,89')).toBe(1234567.89);
    });
    test('retorna null para vazio', () => {
        expect(parseBRL('')).toBeNull();
    });
    test('retorna null para null', () => {
        expect(parseBRL(null)).toBeNull();
    });
    test('retorna null para undefined', () => {
        expect(parseBRL(undefined)).toBeNull();
    });
    test('retorna null para string não-numérica', () => {
        expect(parseBRL('abc')).toBeNull();
    });
    test('roundtrip formatBRL -> parseBRL', () => {
        const original = 9876.54;
        expect(parseBRL(formatBRL(original))).toBe(original);
    });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx react-scripts test src/utils/formatBRL.test.js --watchAll=false 2>&1 | tail -15
```

Expected: `Tests: 18 passed, 18 total`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/formatBRL.js src/utils/formatBRL.test.js
git commit -m "feat(delta): helper formatBRL + testes unitarios"
```

---

### Task 2.2: Componente `<KpisStrip>`

**Files:**
- Create: `src/components/planejamento/KpisStrip.js`

#### Contexto

KPIs strip horizontal acima da lista de cards. Operacionais sempre. Financeiros só se aba=ELETRIK.

- [ ] **Step 1: Criar diretório e componente**

```bash
mkdir -p src/components/planejamento
```

`src/components/planejamento/KpisStrip.js`:

```js
import React from 'react';
import { formatBRL } from '../../utils/formatBRL';

function KpiCard({ label, value, color = '#94a3b8', highlight = false }) {
    return (
        <div style={{
            background: highlight ? 'rgba(167,139,250,0.12)' : 'rgba(30,41,59,0.6)',
            border: `1px solid ${highlight ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8,
            padding: '10px 14px',
            minWidth: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}>
            <span style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
            <span style={{ color, fontSize: 18, fontWeight: 700 }}>{value}</span>
        </div>
    );
}

export default function KpisStrip({ kpis = {}, abaAtiva = 'DELTA-PORCELANA' }) {
    const lead = kpis.lead || {};
    return (
        <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
            overflowX: 'auto',
            paddingBottom: 4,
        }}>
            <KpiCard label="Total rotas" value={kpis.total_rotas ?? 0} />
            <KpiCard label="Programadas" value={kpis.programadas ?? 0} color="#60a5fa" />
            <KpiCard label="Embarcadas" value={kpis.embarcadas ?? 0} color="#4ade80" />
            <KpiCard label="Pendentes" value={kpis.pendentes ?? 0} color="#fbbf24" />
            <KpiCard label="Antecipadas" value={lead.antecipado ?? 0} color="#a78bfa" />
            <KpiCard label="Dentro" value={lead.dentro ?? 0} color="#60a5fa" />
            <KpiCard label="Fora" value={lead.fora ?? 0} color="#f87171" />

            {abaAtiva === 'ELETRIK' && (
                <>
                    <KpiCard label="R$ Mercadoria" value={formatBRL(kpis.total_mercadoria)} color="#a78bfa" highlight />
                    <KpiCard label="R$ Frete" value={formatBRL(kpis.total_frete)} color="#a78bfa" highlight />
                    <KpiCard label="Repres. média" value={`${(kpis.repres_media ?? 0).toFixed(2)}%`} color="#a78bfa" highlight />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/KpisStrip.js
git commit -m "feat(delta): componente KpisStrip"
```

---

### Task 2.3: Componente `<BlocoFinanceiro>`

**Files:**
- Create: `src/components/planejamento/BlocoFinanceiro.js`

- [ ] **Step 1: Criar componente**

```js
import React, { useState, useEffect } from 'react';
import { formatBRL, parseBRL } from '../../utils/formatBRL';

const STATUS_OPCOES = [
    { value: '', label: '—' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'EM_ROTA_DE_ENTREGA', label: 'Em rota de entrega' },
    { value: 'CONCLUIDO', label: 'Concluído' },
];

const inputStyle = {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
};

export default function BlocoFinanceiro({ rota, podeEditar, onSalvar }) {
    const [valorCargaTexto, setValorCargaTexto] = useState(formatBRL(rota.valor_carga));
    const [valorFreteTexto, setValorFreteTexto] = useState(formatBRL(rota.valor_frete));
    const [status, setStatus] = useState(rota.status_financeiro || '');

    useEffect(() => {
        setValorCargaTexto(formatBRL(rota.valor_carga));
        setValorFreteTexto(formatBRL(rota.valor_frete));
        setStatus(rota.status_financeiro || '');
    }, [rota.id, rota.valor_carga, rota.valor_frete, rota.status_financeiro]);

    function blurValor(campo, texto) {
        const numero = parseBRL(texto);
        const atual = rota[campo];
        if (numero !== atual) {
            onSalvar({ [campo]: numero });
        }
    }

    function mudarStatus(novo) {
        setStatus(novo);
        if (novo !== (rota.status_financeiro || '')) {
            onSalvar({ status_financeiro: novo || null });
        }
    }

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(167,139,250,0.06)',
            borderTop: '1px solid rgba(167,139,250,0.15)',
        }}>
            <div style={{
                fontSize: 11, fontWeight: 700, color: '#a78bfa',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>Financeiro</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Status</label>
                    <select
                        value={status}
                        onChange={e => mudarStatus(e.target.value)}
                        disabled={!podeEditar}
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    >
                        {STATUS_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Valor da carga</label>
                    <input
                        type="text"
                        value={valorCargaTexto}
                        onChange={e => setValorCargaTexto(e.target.value)}
                        onBlur={e => blurValor('valor_carga', e.target.value)}
                        disabled={!podeEditar}
                        placeholder="R$ 0,00"
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Valor do frete</label>
                    <input
                        type="text"
                        value={valorFreteTexto}
                        onChange={e => setValorFreteTexto(e.target.value)}
                        onBlur={e => blurValor('valor_frete', e.target.value)}
                        disabled={!podeEditar}
                        placeholder="R$ 0,00"
                        style={{ ...inputStyle, opacity: podeEditar ? 1 : 0.5 }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Representatividade</label>
                    <input
                        type="text"
                        value={rota.representatividade_pct != null ? `${Number(rota.representatividade_pct).toFixed(2)}%` : '—'}
                        disabled
                        style={{ ...inputStyle, opacity: 0.7, fontFamily: 'monospace' }}
                    />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/BlocoFinanceiro.js
git commit -m "feat(delta): componente BlocoFinanceiro"
```

---

### Task 2.4: Componente `<BlocoDadosRota>`

**Files:**
- Create: `src/components/planejamento/BlocoDadosRota.js`

#### Contexto

Bloco com campos de DADOS DA ROTA (data_prevista, data_embarque, tipo_veiculo, motorista_nome, redespacho, observacao, status_embarque). Salva on-blur por campo. Read-only quando `!podeEditar`.

- [ ] **Step 1: Criar componente**

```js
import React, { useState, useEffect } from 'react';

const STATUS_EMBARQUE_OPCOES = [
    { value: 'PROGRAMADA', label: 'Programada' },
    { value: 'EMBARCADA', label: 'Embarcada' },
    { value: 'PENDENTE', label: 'Pendente' },
];

const TIPOS_VEICULO = ['CARRETA', 'TRUCK', '3/4', 'VAN'];

const inputStyle = {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
};

function Campo({ label, children, span = 1 }) {
    return (
        <div style={{ gridColumn: `span ${span}` }}>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}

export default function BlocoDadosRota({ rota, podeEditar, onSalvar }) {
    const [local, setLocal] = useState(rota);

    useEffect(() => { setLocal(rota); }, [rota.id, rota.atualizado_em]);

    function blurCampo(campo, valor) {
        const atual = rota[campo] ?? '';
        const novo = valor ?? '';
        if (String(novo) !== String(atual)) {
            onSalvar({ [campo]: valor || null });
        }
    }

    function mudarLocal(campo, valor) {
        setLocal(prev => ({ ...prev, [campo]: valor }));
    }

    const style = (extra = {}) => ({ ...inputStyle, opacity: podeEditar ? 1 : 0.5, ...extra });

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(30,41,59,0.4)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
            <div style={{
                fontSize: 11, fontWeight: 700, color: '#60a5fa',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>Dados da rota</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <Campo label="Data prevista">
                    <input
                        type="date" value={local.data_prevista || ''}
                        onChange={e => mudarLocal('data_prevista', e.target.value)}
                        onBlur={e => blurCampo('data_prevista', e.target.value)}
                        disabled={!podeEditar} style={style()}
                    />
                </Campo>
                <Campo label="Data embarque">
                    <input
                        type="date" value={local.data_embarque || ''}
                        onChange={e => mudarLocal('data_embarque', e.target.value)}
                        onBlur={e => blurCampo('data_embarque', e.target.value)}
                        disabled={!podeEditar} style={style()}
                    />
                </Campo>
                <Campo label="Status embarque">
                    <select
                        value={local.status_embarque || 'PROGRAMADA'}
                        onChange={e => { mudarLocal('status_embarque', e.target.value); onSalvar({ status_embarque: e.target.value }); }}
                        disabled={!podeEditar} style={style()}
                    >
                        {STATUS_EMBARQUE_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Campo>
                <Campo label="Operação (código)">
                    <input
                        type="text" value={local.operacao_codigo || ''}
                        onChange={e => mudarLocal('operacao_codigo', e.target.value)}
                        onBlur={e => blurCampo('operacao_codigo', e.target.value)}
                        disabled={!podeEditar} style={style()} maxLength={4}
                    />
                </Campo>

                <Campo label="Tipo veículo">
                    <select
                        value={local.tipo_veiculo || ''}
                        onChange={e => { mudarLocal('tipo_veiculo', e.target.value); onSalvar({ tipo_veiculo: e.target.value || null }); }}
                        disabled={!podeEditar} style={style()}
                    >
                        <option value="">—</option>
                        {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </Campo>
                <Campo label="Motorista">
                    <input
                        type="text" value={local.motorista_nome || ''}
                        onChange={e => mudarLocal('motorista_nome', e.target.value)}
                        onBlur={e => blurCampo('motorista_nome', e.target.value)}
                        disabled={!podeEditar} style={style()}
                    />
                </Campo>
                <Campo label="Placa cavalo">
                    <input
                        type="text" value={local.placa_cavalo || ''}
                        onChange={e => mudarLocal('placa_cavalo', e.target.value)}
                        onBlur={e => blurCampo('placa_cavalo', e.target.value)}
                        disabled={!podeEditar} style={style({ fontFamily: 'monospace', textTransform: 'uppercase' })}
                    />
                </Campo>
                <Campo label="Placa carreta">
                    <input
                        type="text" value={local.placa_carreta || ''}
                        onChange={e => mudarLocal('placa_carreta', e.target.value)}
                        onBlur={e => blurCampo('placa_carreta', e.target.value)}
                        disabled={!podeEditar} style={style({ fontFamily: 'monospace', textTransform: 'uppercase' })}
                    />
                </Campo>

                <Campo label="Redespacho" span={2}>
                    <input
                        type="text" value={local.redespacho || ''}
                        onChange={e => mudarLocal('redespacho', e.target.value)}
                        onBlur={e => blurCampo('redespacho', e.target.value)}
                        disabled={!podeEditar} style={style()}
                    />
                </Campo>
                <Campo label="Observações" span={2}>
                    <input
                        type="text" value={local.observacao || ''}
                        onChange={e => mudarLocal('observacao', e.target.value)}
                        onBlur={e => blurCampo('observacao', e.target.value)}
                        disabled={!podeEditar} style={style()}
                    />
                </Campo>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/BlocoDadosRota.js
git commit -m "feat(delta): componente BlocoDadosRota"
```

---

### Task 2.5: Componente `<BlocoDestinos>`

**Files:**
- Create: `src/components/planejamento/BlocoDestinos.js`

#### Contexto

Bloco que lista entregas (rota.entregas[]) em mini-cards. CRUD inline. Cada entrega tem cidade, uf, regiao, cliente, notas_fiscais, status_agendamento, data_entrega_cliente, lead_status (calculado pelo backend).

API:
- `POST /api/tramontina/rotas/:rotaId/entregas` — body: `{cidade, uf, regiao, cliente, notas_fiscais, status_agendamento, data_entrega_cliente}` — retorna entrega criada
- `PUT /api/tramontina/entregas/:id` — body: campos a atualizar — retorna entrega atualizada
- `DELETE /api/tramontina/entregas/:id` — sem body

- [ ] **Step 1: Criar componente**

```js
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/apiService';

const REGIOES = ['', 'NORTE', 'NORDESTE', 'CENTRO-OESTE', 'SUDESTE', 'SUL'];
const STATUS_AGENDAMENTO = [
    { value: '', label: '—' },
    { value: 'AG', label: 'AG' },
    { value: 'S_AG', label: 'S/ AG' },
    { value: 'CONFIRMADO', label: 'Confirmado' },
];

const inputStyle = {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: '#e2e8f0',
    padding: '5px 8px',
    fontSize: 12,
    outline: 'none',
};

const leadCor = {
    ANTECIPADO: '#a78bfa',
    DENTRO: '#4ade80',
    FORA: '#f87171',
    AGUARDANDO: '#fbbf24',
};

function MiniEntrega({ entrega, podeEditar, onSalvar, onRemover }) {
    function blur(campo, valor) {
        if (String(valor || '') !== String(entrega[campo] || '')) {
            onSalvar(entrega.id, { [campo]: valor || null });
        }
    }
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 50px 1fr 2fr 2fr 80px 110px 80px 30px',
            gap: 6, alignItems: 'center',
            padding: '6px 8px',
            background: 'rgba(15,23,42,0.5)',
            borderRadius: 4,
            marginBottom: 4,
        }}>
            <input type="text" placeholder="Cidade"
                defaultValue={entrega.cidade || ''} onBlur={e => blur('cidade', e.target.value)}
                disabled={!podeEditar} style={inputStyle} />
            <input type="text" placeholder="UF"
                defaultValue={entrega.uf || ''} onBlur={e => blur('uf', e.target.value.toUpperCase().slice(0, 2))}
                disabled={!podeEditar} style={{ ...inputStyle, textTransform: 'uppercase' }} maxLength={2} />
            <select defaultValue={entrega.regiao || ''} onChange={e => onSalvar(entrega.id, { regiao: e.target.value || null })}
                disabled={!podeEditar} style={inputStyle}>
                {REGIOES.map(r => <option key={r} value={r}>{r || '—'}</option>)}
            </select>
            <input type="text" placeholder="Cliente"
                defaultValue={entrega.cliente || ''} onBlur={e => blur('cliente', e.target.value)}
                disabled={!podeEditar} style={inputStyle} />
            <input type="text" placeholder="Notas Fiscais"
                defaultValue={entrega.notas_fiscais || ''} onBlur={e => blur('notas_fiscais', e.target.value)}
                disabled={!podeEditar} style={inputStyle} />
            <select defaultValue={entrega.status_agendamento || ''} onChange={e => onSalvar(entrega.id, { status_agendamento: e.target.value || null })}
                disabled={!podeEditar} style={inputStyle}>
                {STATUS_AGENDAMENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="date"
                defaultValue={entrega.data_entrega_cliente || ''} onBlur={e => blur('data_entrega_cliente', e.target.value)}
                disabled={!podeEditar} style={inputStyle} />
            <span style={{ color: leadCor[entrega.lead_status] || '#64748b', fontSize: 11, fontWeight: 600 }}>
                {entrega.lead_status || '—'}
            </span>
            {podeEditar ? (
                <button onClick={() => onRemover(entrega.id)} title="Remover"
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}>
                    <Trash2 size={14} />
                </button>
            ) : <span />}
        </div>
    );
}

export default function BlocoDestinos({ rota, entregas = [], podeEditar, onAlterado }) {
    const [adicionando, setAdicionando] = useState(false);

    async function salvarEntrega(id, patch) {
        try {
            const r = await api.put(`/api/tramontina/entregas/${id}`, patch);
            if (r.data?.success) onAlterado?.();
        } catch (e) {
            console.warn('Falha ao salvar entrega', e);
        }
    }

    async function removerEntrega(id) {
        if (!window.confirm('Remover destino?')) return;
        try {
            await api.delete(`/api/tramontina/entregas/${id}`);
            onAlterado?.();
        } catch (e) {
            console.warn('Falha ao remover entrega', e);
        }
    }

    async function adicionarEntrega() {
        setAdicionando(true);
        try {
            await api.post(`/api/tramontina/rotas/${rota.id}/entregas`, {
                cidade: '', uf: '', regiao: null,
                cliente: '', notas_fiscais: '',
                status_agendamento: null, data_entrega_cliente: null,
            });
            onAlterado?.();
        } catch (e) {
            console.warn('Falha ao adicionar entrega', e);
        } finally {
            setAdicionando(false);
        }
    }

    return (
        <div style={{
            padding: '12px 16px',
            background: 'rgba(30,41,59,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
            }}>
                <div style={{
                    fontSize: 11, fontWeight: 700, color: '#4ade80',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                }}>Destinos ({entregas.length})</div>
                {podeEditar && (
                    <button onClick={adicionarEntrega} disabled={adicionando}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'rgba(74,222,128,0.15)',
                            border: '1px solid rgba(74,222,128,0.4)',
                            color: '#4ade80', borderRadius: 5,
                            padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                        }}>
                        <Plus size={12} /> Adicionar destino
                    </button>
                )}
            </div>

            {entregas.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
                    Nenhum destino adicionado ainda.
                </div>
            ) : (
                <div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 50px 1fr 2fr 2fr 80px 110px 80px 30px',
                        gap: 6, fontSize: 10, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.3,
                        padding: '0 8px 4px 8px',
                    }}>
                        <span>Cidade</span><span>UF</span><span>Região</span>
                        <span>Cliente</span><span>Notas Fiscais</span>
                        <span>Agenda</span><span>Entrega</span><span>Lead</span><span></span>
                    </div>
                    {entregas.map(e => (
                        <MiniEntrega key={e.id} entrega={e} podeEditar={podeEditar}
                            onSalvar={salvarEntrega} onRemover={removerEntrega} />
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/BlocoDestinos.js
git commit -m "feat(delta): componente BlocoDestinos"
```

---

### Task 2.6: Componente `<CardRota>` (juntando tudo)

**Files:**
- Create: `src/components/planejamento/CardRota.js`

- [ ] **Step 1: Criar componente**

```js
import React from 'react';
import { ChevronDown, Truck, MapPin } from 'lucide-react';
import BlocoDadosRota from './BlocoDadosRota';
import BlocoDestinos from './BlocoDestinos';
import BlocoFinanceiro from './BlocoFinanceiro';
import { formatBRL } from '../../utils/formatBRL';

const corStatusEmbarque = {
    PROGRAMADA: { bg: 'rgba(96,165,250,0.15)', border: '#60a5fa', text: '#93c5fd' },
    EMBARCADA: { bg: 'rgba(74,222,128,0.15)', border: '#4ade80', text: '#86efac' },
    PENDENTE: { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fcd34d' },
};

function StatusBadge({ status }) {
    const cor = corStatusEmbarque[status] || corStatusEmbarque.PROGRAMADA;
    return (
        <span style={{
            background: cor.bg, border: `1px solid ${cor.border}`,
            color: cor.text, padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        }}>{status || 'PROGRAMADA'}</span>
    );
}

export default function CardRota({
    rota, entregas = [], expanded, onToggle,
    abaAtiva, podeEditarOperacional, podeEditarFinanceiro,
    onSalvarRota, onAlteradoEntregas,
}) {
    const primeiroDestino = entregas[0];
    const temFinanceiro = abaAtiva === 'ELETRIK';

    return (
        <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            marginBottom: 8,
            overflow: 'hidden',
            transition: 'all 0.2s',
        }}>
            {/* HEADER */}
            <div onClick={onToggle} style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer',
                userSelect: 'none',
                background: expanded ? 'rgba(30,41,59,0.4)' : 'transparent',
            }}>
                <span style={{
                    background: 'rgba(167,139,250,0.15)',
                    color: '#a78bfa', fontWeight: 700, fontSize: 13,
                    padding: '4px 10px', borderRadius: 5, minWidth: 40, textAlign: 'center',
                }}>#{rota.numero_rota ?? '?'}</span>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>
                        {rota.motorista_nome || <em style={{ color: '#64748b' }}>sem motorista</em>}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Truck size={10} /> {rota.tipo_veiculo || '—'}
                    </span>
                </div>

                <StatusBadge status={rota.status_embarque} />

                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                    Coleta <strong style={{ color: '#e2e8f0' }}>{rota.coleta || '—'}</strong>
                </span>

                <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} />
                    {primeiroDestino
                        ? `${primeiroDestino.cidade || '?'}/${primeiroDestino.uf || '?'}${entregas.length > 1 ? ` +${entregas.length - 1}` : ''}`
                        : <em style={{ color: '#64748b' }}>sem destinos</em>
                    }
                </span>

                {temFinanceiro && rota.valor_carga != null && (
                    <span style={{
                        marginLeft: 'auto', color: '#a78bfa', fontSize: 12,
                        fontFamily: 'monospace',
                    }}>
                        {formatBRL(rota.valor_carga)} · Frete {formatBRL(rota.valor_frete)}
                        {rota.representatividade_pct != null && ` (${Number(rota.representatividade_pct).toFixed(2)}%)`}
                    </span>
                )}

                <ChevronDown size={16} color="#64748b" style={{
                    marginLeft: temFinanceiro && rota.valor_carga != null ? 8 : 'auto',
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                }} />
            </div>

            {/* EXPANDIDO */}
            {expanded && (
                <>
                    <BlocoDadosRota rota={rota} podeEditar={podeEditarOperacional} onSalvar={onSalvarRota} />
                    <BlocoDestinos rota={rota} entregas={entregas} podeEditar={podeEditarOperacional} onAlterado={onAlteradoEntregas} />
                    {temFinanceiro && (
                        <BlocoFinanceiro rota={rota} podeEditar={podeEditarFinanceiro} onSalvar={onSalvarRota} />
                    )}
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/CardRota.js
git commit -m "feat(delta): componente CardRota expansivel"
```

---

### Task 2.7: Refactor `PlanejamentoTramontina.js` para usar cards + seletor de aba

**Files:**
- Modify: `src/components/PlanejamentoTramontina.js`

#### Contexto

O componente atual tem:
- State `mes`, `rotas`, `expandidas`, `kpis`, filtros, etc
- Render via `<table>` HTML manual
- Eventos socket `tramontina_*` registrados
- Botão "Importar XLSX" no header

Mudanças:
1. Adicionar state `abaAtiva` ('DELTA-PORCELANA' | 'ELETRIK')
2. Renderizar `<KpisStrip>` no topo
3. Substituir a `<table>` por mapping para `<CardRota>`
4. Adicionar toggle de aba no header (botões pill estilo)
5. Esconder botão "Importar XLSX"
6. Passar `aba` nos fetches (`GET /rotas?aba=...`, `/kpis?aba=...`)
7. Calcular permissões do user (props `permissoes` ou via `useUser`/contexto)

- [ ] **Step 1: Localizar estado e fetch atual**

Use Grep `useState\|useEffect\|fetchRotas\|fetchKpis` em `src/components/PlanejamentoTramontina.js`. Identifique:
- onde `mes`/`rotas`/`kpis` são declarados
- a função que faz `api.get('/api/tramontina/rotas...')`
- a função que faz `api.get('/api/tramontina/kpis...')`
- onde renderiza o `<thead>`/`<tbody>` da table

- [ ] **Step 2: Adicionar state `abaAtiva` no topo do componente**

```js
const [abaAtiva, setAbaAtiva] = useState('DELTA-PORCELANA');
```

- [ ] **Step 3: Incluir `aba` nos fetches**

Onde está `api.get('/api/tramontina/rotas?mes=${mes}')`, mudar para:

```js
api.get(`/api/tramontina/rotas?mes=${mes}&aba=${abaAtiva}`)
```

E para KPIs:

```js
api.get(`/api/tramontina/kpis?mes=${mes}&aba=${abaAtiva}`)
```

Adicionar `abaAtiva` às dependências do `useEffect` que dispara esses fetches.

- [ ] **Step 4: Calcular permissões**

Procurar onde o componente acessa o user / props. Adicionar logo após:

```js
const userPerms = props.user?.permissoes || [];  // ajuste conforme padrão do componente
const podeEditarOperacional = userPerms.includes('delta_editar_operacional') || userPerms.includes('tramontina_editar');
const podeEditarFinanceiro = userPerms.includes('delta_editar_financeiro');
```

Nota: se o componente não recebe `user` como prop hoje, importar do contexto / hook que já existe no app. Verificar pelos imports do topo.

- [ ] **Step 5: Adicionar imports**

No topo:

```js
import KpisStrip from './planejamento/KpisStrip';
import CardRota from './planejamento/CardRota';
```

- [ ] **Step 6: Toggle de aba no header**

Logo abaixo do título "Planejamento" / acima dos filtros, adicionar:

```jsx
<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
    {['DELTA-PORCELANA', 'ELETRIK'].map(a => (
        <button key={a}
            onClick={() => setAbaAtiva(a)}
            style={{
                background: abaAtiva === a ? 'rgba(167,139,250,0.2)' : 'transparent',
                border: `1px solid ${abaAtiva === a ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                color: abaAtiva === a ? '#a78bfa' : '#94a3b8',
                padding: '7px 16px', borderRadius: 6,
                fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                cursor: 'pointer', textTransform: 'uppercase',
            }}>
            {a}
        </button>
    ))}
</div>
```

- [ ] **Step 7: Substituir `<table>` por lista de `<CardRota>`**

Identificar o bloco da `<table>`. Substituir o `<tbody>` (que faz `rotas.map(...)`) por:

```jsx
<KpisStrip kpis={kpis} abaAtiva={abaAtiva} />

<div>
    {rotasFiltradas.length === 0 ? (
        <div style={{
            padding: 40, textAlign: 'center', color: '#64748b',
            background: 'rgba(15,23,42,0.4)', borderRadius: 8,
        }}>
            Nenhuma rota cadastrada para {abaAtiva} em {mes}.
        </div>
    ) : (
        rotasFiltradas.map(rota => (
            <CardRota
                key={rota.id}
                rota={rota}
                entregas={rota.entregas || []}
                expanded={expandidas.has(rota.id)}
                onToggle={() => toggleExpandida(rota.id)}
                abaAtiva={abaAtiva}
                podeEditarOperacional={podeEditarOperacional}
                podeEditarFinanceiro={podeEditarFinanceiro}
                onSalvarRota={patch => salvarRota(rota.id, patch)}
                onAlteradoEntregas={() => fetchRotas()}
            />
        ))
    )}
</div>
```

Remover o `<thead>` e a `<table>` antiga (mantendo só os filtros que ficam acima dos cards).

Se `salvarRota` / `toggleExpandida` / `rotasFiltradas` / `fetchRotas` não existem com esses nomes, ajustar para os nomes reais identificados no Step 1.

- [ ] **Step 8: Definir `salvarRota` se não existir**

Se o componente atual não tem uma função `salvarRota(id, patch)` reusável, adicionar:

```js
async function salvarRota(rotaId, patch) {
    try {
        const r = await api.put(`/api/tramontina/rotas/${rotaId}`, patch);
        if (r.data?.success) {
            // atualiza local
            setRotas(prev => prev.map(rt => rt.id === rotaId ? { ...rt, ...r.data.rota } : rt));
        }
    } catch (e) {
        if (e.response?.status === 403) {
            window.alert('Sem permissão para editar esses campos.');
        } else {
            console.warn('Falha ao salvar rota:', e);
        }
    }
}
```

- [ ] **Step 9: Remover botão Importar XLSX**

Localizar `<button.*Importar.*XLSX|ModalImportarTramontina|setMostrarImportar`. Comentar/remover o `<button>` que abre o modal (mantém o import e o componente — só esconde o trigger).

- [ ] **Step 10: Build + verificar erros**

```bash
npm run build 2>&1 | tail -10
```

Expected: build passa com warnings (não errors).

- [ ] **Step 11: Commit**

```bash
git add src/components/PlanejamentoTramontina.js
git commit -m "feat(delta): refactor para cards + seletor aba + KpisStrip"
```

---

### Task 2.8: Sidebar — renomear "Planejamento Tramontina" → "Planejamento"

**Files:**
- Modify: `src/components/Sidebar.js`

- [ ] **Step 1: Localizar entrada do Tramontina**

Grep `Planejamento Tramontina` em `src/components/Sidebar.js`. Provavelmente está num array de items com `{ label, slug, icon, permissao }`.

- [ ] **Step 2: Renomear label, manter slug + permissão**

Mudar `label: 'Planejamento Tramontina'` para `label: 'Planejamento'`.

Manter `slug: 'planejamento_tramontina'` (não mudamos para não quebrar links salvos).

Mudar a verificação de permissão para aceitar `delta_ver` OU `tramontina_planejamento`:

```js
{
    label: 'Planejamento',
    slug: 'planejamento_tramontina',
    icon: <Calendar size={14} />,
    permissoes: ['tramontina_planejamento', 'delta_ver'],  // OR
}
```

Verificar como o Sidebar checa permissões: se hoje compara só uma string, precisa ajustar a lógica de filtro para `permissoes.some(p => userPerms.includes(p))`.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.js
git commit -m "feat(delta): Sidebar renomeia para Planejamento + aceita delta_ver"
```

---

### Task 2.9: Push + merge develop → main

- [ ] **Step 1: Push**

```bash
git push origin develop
```

- [ ] **Step 2: Aguardar CI staging (~3min)**

```bash
curl -s "https://api.github.com/repos/tay-create/transnet-operacional-v2/actions/runs?branch=develop&per_page=1" | grep -E '"status"|"conclusion"'
```

Esperar até `status: completed, conclusion: success`.

- [ ] **Step 3: Validação manual em staging**

Abrir `https://homolog.tnethub.com.br` logado como Planejamento. Esperado:
- Sidebar mostra "Planejamento" (não "Planejamento Tramontina")
- Tela abre, mostra toggle DELTA-PORCELANA / ELETRIK no topo
- Clicando ELETRIK, KPIs adicionais aparecem (R$ Mercadoria, R$ Frete, Repres.)
- Criar uma rota nova de teste, expandir o card
- Aba ELETRIK mostra bloco FINANCEIRO; DELTA-PORCELANA NÃO mostra
- Preencher valor_carga=1000 e valor_frete=200 → representatividade vira 20,00% automaticamente após blur
- Logar como Encarregado e abrir mesma tela: inputs financeiros aparecem desabilitados

- [ ] **Step 4: Merge develop → main**

```bash
git checkout main && git pull --ff-only origin main
git merge --no-ff develop -m "release(delta-sprint2): frontend cards expansiveis"
git push origin main
git checkout develop
```

---

## Sprint 3 — Integração gerador de rotas (Dias 6-7, seg-ter 26-27 maio)

### Task 3.1: `geradorRotas.js` — função `buscarRotaPorColetaNoBanco`

**Files:**
- Modify: `src/utils/geradorRotas.js`

#### Contexto

O arquivo tem `buscarRotaPorColeta(coleta, sheetId)` e `buscarEntregasAgendadasPorColeta(coleta, sheetId)`. Ambos chamam `lerPlanilha(sheetId)` e fazem lookup. Vou adicionar funções paralelas que leem do banco e um despachante por env var.

- [ ] **Step 1: Importar `dbGet` no topo**

Verificar se `geradorRotas.js` já importa pool/db. Caso não:

```js
const { dbGet, dbAll } = require('../database/db');  // ajustar caminho conforme estrutura real
```

(Procurar como outros arquivos em `src/utils/` ou `src/routes/` importam dbGet — replicar o mesmo padrão.)

- [ ] **Step 2: Adicionar função `buscarRotaPorColetaNoBanco`**

No fim do arquivo, antes do `module.exports`:

```js
// Lê rota+destinos do banco (tramontina_rotas + tramontina_rota_entregas).
// Usada quando GERADOR_FONTE === 'banco'.
// Retorna shape compatível com buscarRotaPorColeta (Sheets):
//   { rota: number, destinos: [{cidade, uf, data, cliente, ...}], fonte: 'banco' }
//   ou null se não achar.
async function buscarRotaPorColetaNoBanco(coleta, mes) {
    if (!coleta || !mes) return null;
    const coletaTrim = String(coleta).trim();
    if (!coletaTrim) return null;

    const rota = await dbAll(`
        SELECT r.id, r.numero_rota, r.coleta, r.data_prevista, r.aba_origem,
               e.cidade, e.uf, e.regiao, e.cliente, e.notas_fiscais,
               e.status_agendamento, e.data_entrega_cliente
        FROM tramontina_rotas r
        LEFT JOIN tramontina_rota_entregas e ON e.rota_id = r.id
        WHERE r.mes_referencia = $1
          AND (r.coleta = $2 OR r.coleta LIKE $3 OR r.coleta LIKE $4 OR r.coleta LIKE $5)
        ORDER BY r.numero_rota ASC, e.id ASC
    `, [mes, coletaTrim, `${coletaTrim} %`, `% ${coletaTrim}`, `% ${coletaTrim} %`]);

    if (!rota || rota.length === 0) return null;

    const numeroRota = rota[0].numero_rota;
    const destinos = rota
        .filter(r => r.cidade && r.uf)
        .map(r => ({
            cidade: r.cidade,
            uf: r.uf,
            regiao: r.regiao,
            cliente: r.cliente,
            data: r.data_entrega_cliente,  // mesma posição lógica que o Col AC da planilha
            cidade_uf: `${r.cidade}/${r.uf}`,
        }));

    return { rota: numeroRota, destinos, fonte: 'banco' };
}

// Lê entregas agendadas (variante usada por /api/provisionamento/entregas-da-coleta).
// Diferente da função acima: NÃO deduplica destinos. Retorna shape:
//   [{ cidade, data }, ...]
async function buscarEntregasAgendadasPorColetaNoBanco(coleta, mes) {
    if (!coleta || !mes) return [];
    const coletaTrim = String(coleta).trim();
    if (!coletaTrim) return [];

    const rows = await dbAll(`
        SELECT e.cidade, e.data_entrega_cliente AS data
        FROM tramontina_rotas r
        JOIN tramontina_rota_entregas e ON e.rota_id = r.id
        WHERE r.mes_referencia = $1
          AND (r.coleta = $2 OR r.coleta LIKE $3 OR r.coleta LIKE $4 OR r.coleta LIKE $5)
        ORDER BY e.id ASC
    `, [mes, coletaTrim, `${coletaTrim} %`, `% ${coletaTrim}`, `% ${coletaTrim} %`]);

    return rows
        .filter(r => r.cidade)
        .map(r => ({ cidade: r.cidade, data: r.data }));
}
```

- [ ] **Step 3: Adicionar helper `derivarMes`**

```js
// Aceita sheetId (ex: '1zhC6...') OU string de mês 'YYYY-MM' diretamente.
// Quando vier sheetId, faz lookup reverso em resultado_sheets.
async function derivarMes(sheetIdOuMes) {
    if (!sheetIdOuMes) return null;
    const s = String(sheetIdOuMes);
    // Padrão YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    // Lookup reverso
    const row = await dbGet(
        `SELECT mes FROM resultado_sheets WHERE sheet_id = $1 ORDER BY mes DESC LIMIT 1`,
        [s]
    );
    return row?.mes || null;
}
```

- [ ] **Step 4: Adicionar despachante na função `buscarRotaPorColeta` existente**

Logo no início da função `async function buscarRotaPorColeta(coleta, sheetId)`, adicionar:

```js
async function buscarRotaPorColeta(coleta, sheetId) {
    if (process.env.GERADOR_FONTE === 'banco') {
        const mes = await derivarMes(sheetId);
        if (!mes) return null;
        return buscarRotaPorColetaNoBanco(coleta, mes);
    }
    // ... código atual que lê da planilha
}
```

- [ ] **Step 5: Idem para `buscarEntregasAgendadasPorColeta`**

```js
async function buscarEntregasAgendadasPorColeta(coleta, sheetId) {
    if (process.env.GERADOR_FONTE === 'banco') {
        const mes = await derivarMes(sheetId);
        if (!mes) return [];
        return buscarEntregasAgendadasPorColetaNoBanco(coleta, mes);
    }
    // ... código atual que lê da planilha
}
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/geradorRotas.js
git commit -m "feat(delta): geradorRotas le do banco quando GERADOR_FONTE=banco"
```

---

### Task 3.2: Ativar `GERADOR_FONTE=banco` em staging

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`

- [ ] **Step 1: Localizar onde escreve `.env.staging` no workflow**

Grep `SHEETS_ID_OVERRIDE\|DISABLE_CRONS` em `.github/workflows/deploy-staging.yml`. O workflow tem um step que escreve um `.env.staging` via `printf` com várias vars.

- [ ] **Step 2: Adicionar `GERADOR_FONTE=banco` no printf**

Adicionar `\nGERADOR_FONTE=banco` na string do printf, depois das outras vars (`SHEETS_ID_OVERRIDE`, `DISABLE_CRONS`).

- [ ] **Step 3: Commit + push**

```bash
git add .github/workflows/deploy-staging.yml
git commit -m "chore(staging): GERADOR_FONTE=banco para testar Sprint 3"
git push origin develop
```

- [ ] **Step 4: Aguardar CI staging**

```bash
curl -s "https://api.github.com/repos/tay-create/transnet-operacional-v2/actions/runs?branch=develop&per_page=1" | grep status
```

Aguardar até `completed/success`.

- [ ] **Step 5: Validar em staging**

Criar rota fake de teste no PlanejamentoDelta (mês corrente ou junho 2026):
- Rota número 999
- Coleta `99999`
- Aba ELETRIK
- Adicionar 2 destinos: RECIFE/PE e FORTALEZA/CE

Depois, lançar um veículo no Novo Lançamento com coleta `99999` (sem cadastrar nada na planilha real). Verificar:

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "SELECT id, destinos_json FROM veiculos WHERE coletainterestadual='99999' OR coletarecife='99999' ORDER BY id DESC LIMIT 1;"
```

Expected: `destinos_json` contém RECIFE/PE e FORTALEZA/CE (do banco).

- [ ] **Step 6: Limpar dados de teste**

```bash
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "DELETE FROM veiculos WHERE coletainterestadual='99999' OR coletarecife='99999';"
echo 124578595 | sudo -S docker exec transnet-db-staging psql -U postgres -d transnet_staging -c "DELETE FROM tramontina_rotas WHERE coleta='99999';"
```

- [ ] **Step 7: Merge develop → main**

```bash
git checkout main && git pull --ff-only origin main
git merge --no-ff develop -m "release(delta-sprint3): integracao gerador rotas com banco"
git push origin main
git checkout develop
```

Nota: **NÃO** ativamos `GERADOR_FONTE=banco` em produção ainda — isso é feito manualmente no Sprint 4 (final). O `.env.prod` continua sem essa variável até o dia 31/05.

---

## Sprint 4 — Polish + validação (Dias 8-9, qua-qui 28-29 maio)

### Task 4.1: Filtro `status_financeiro` na UI (só ELETRIK)

**Files:**
- Modify: `src/components/PlanejamentoTramontina.js`

- [ ] **Step 1: Adicionar state do filtro**

```js
const [filtroStatusFinanceiro, setFiltroStatusFinanceiro] = useState('');
```

- [ ] **Step 2: Adicionar select no header dos filtros (renderiza condicional)**

Onde os outros filtros estão renderizados:

```jsx
{abaAtiva === 'ELETRIK' && (
    <select value={filtroStatusFinanceiro} onChange={e => setFiltroStatusFinanceiro(e.target.value)}
        style={{ /* mesmo estilo dos outros filtros */ }}>
        <option value="">Status financeiro: todos</option>
        <option value="PENDENTE">Pendente</option>
        <option value="EM_ROTA_DE_ENTREGA">Em rota de entrega</option>
        <option value="CONCLUIDO">Concluído</option>
    </select>
)}
```

- [ ] **Step 3: Adicionar filtro no `rotasFiltradas` (useMemo)**

Localizar a definição de `rotasFiltradas` (provavelmente um useMemo). Adicionar:

```js
.filter(r => !filtroStatusFinanceiro || r.status_financeiro === filtroStatusFinanceiro)
```

- [ ] **Step 4: Resetar filtro ao trocar aba**

No `setAbaAtiva`, encadear:

```js
function trocarAba(a) {
    setAbaAtiva(a);
    setFiltroStatusFinanceiro('');
}
```

E mudar o `onClick` do toggle para chamar `trocarAba(a)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlanejamentoTramontina.js
git commit -m "feat(delta): filtro status_financeiro condicional para ELETRIK"
```

---

### Task 4.2: Botão flutuante `+ Nova rota`

**Files:**
- Modify: `src/components/PlanejamentoTramontina.js`

- [ ] **Step 1: Localizar função `criarNovaRota`**

Grep `criarNovaRota\|novaRota\|api.post.*tramontina/rotas` em PlanejamentoTramontina. Identificar a função que faz POST.

Se existe: usar.
Se não existe ou só está dentro de um onClick do botão antigo do header, extrair pra função separada:

```js
async function criarNovaRota() {
    try {
        const r = await api.post('/api/tramontina/rotas', {
            mes_referencia: mes,
            aba_origem: abaAtiva,
        });
        if (r.data?.success && r.data.rota?.id) {
            setExpandidas(prev => new Set([...prev, r.data.rota.id]));
            fetchRotas();
        }
    } catch (e) {
        console.warn('Falha ao criar rota:', e);
    }
}
```

- [ ] **Step 2: Adicionar botão flutuante no JSX**

No final do return do componente, antes do fechamento do container principal:

```jsx
{podeEditarOperacional && (
    <button onClick={criarNovaRota}
        title="Nova rota"
        style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
            color: '#fff', border: 'none', borderRadius: '50%',
            width: 56, height: 56, fontSize: 28, fontWeight: 700,
            boxShadow: '0 8px 20px rgba(167,139,250,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        +
    </button>
)}
```

- [ ] **Step 3: Remover botão antigo do header**

Se ainda existe um botão "+" ou "Nova rota" no header do componente, removê-lo.

- [ ] **Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -3
git add src/components/PlanejamentoTramontina.js
git commit -m "feat(delta): botao flutuante + Nova rota"
```

---

### Task 4.3: Validações de campo no backend

**Files:**
- Modify: `src/routes/tramontina.js`

- [ ] **Step 1: Validar valores financeiros não-negativos no POST/PUT**

No POST e PUT, depois do `sanitizarFinanceiro`, antes do INSERT/UPDATE:

```js
if (body.valor_carga !== undefined && body.valor_carga !== null) {
    const n = Number(body.valor_carga);
    if (isNaN(n) || n < 0) {
        return res.status(400).json({ success: false, message: 'valor_carga deve ser número não-negativo' });
    }
    body.valor_carga = n;
}
if (body.valor_frete !== undefined && body.valor_frete !== null) {
    const n = Number(body.valor_frete);
    if (isNaN(n) || n < 0) {
        return res.status(400).json({ success: false, message: 'valor_frete deve ser número não-negativo' });
    }
    body.valor_frete = n;
}
```

- [ ] **Step 2: Validar status_financeiro contra enum**

```js
const STATUS_FIN_VALIDOS = ['CONCLUIDO', 'EM_ROTA_DE_ENTREGA', 'PENDENTE'];
if (body.status_financeiro !== undefined && body.status_financeiro !== null
    && !STATUS_FIN_VALIDOS.includes(body.status_financeiro)) {
    return res.status(400).json({ success: false, message: 'status_financeiro inválido' });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/tramontina.js
git commit -m "feat(delta): validacao backend de campos financeiros"
```

---

### Task 4.4: Mensagens de vazio + tooltips de permissão

**Files:**
- Modify: `src/components/planejamento/BlocoFinanceiro.js`, `src/components/planejamento/BlocoDadosRota.js`

- [ ] **Step 1: Adicionar tooltip explicativo nos inputs disabled**

Em cada `<input disabled={!podeEditar} ...>`, adicionar:

```jsx
title={!podeEditar ? 'Você não tem permissão para editar este campo' : undefined}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planejamento/BlocoFinanceiro.js src/components/planejamento/BlocoDadosRota.js
git commit -m "polish(delta): tooltips de permissao nos inputs disabled"
```

---

### Task 4.5: Push + merge final develop → main

- [ ] **Step 1: Build local**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 2: Push**

```bash
git push origin develop
```

- [ ] **Step 3: Aguardar CI staging**

```bash
curl -s "https://api.github.com/repos/tay-create/transnet-operacional-v2/actions/runs?branch=develop&per_page=1" | grep status
```

- [ ] **Step 4: Smoke test em staging**

Roteiro:
- Logar como Planejamento. Sidebar mostra "Planejamento". Abrir.
- Aba DELTA-PORCELANA: criar rota, expandir, adicionar 2 destinos, marcar status_embarque=EMBARCADA.
- Aba ELETRIK: criar rota, expandir, preencher financeiro (carga 5000, frete 600). Repres = 12%. KPIs no topo somam corretamente.
- Filtrar por status_financeiro=PENDENTE → some a rota recém-criada (que tá CONCLUIDO ou null).
- Logar como Pos-Embarque: consegue editar financeiro. Não vê botão "+ Nova rota".
- Logar como Encarregado: vê tudo readonly. Tooltip aparece nos inputs.
- Em outra aba, editar valor_carga; em primeira aba, real-time atualiza (socket).
- Botão flutuante "+ Nova rota" cria rota nova, abre expandida.

- [ ] **Step 5: Merge develop → main**

```bash
git checkout main && git pull --ff-only origin main
git merge --no-ff develop -m "release(delta-sprint4): polish final pre-go-live"
git push origin main
git checkout develop
```

CI de produção rebuilda; aguardar `~5min`.

---

## Sprint Final — Go Live (30-31 maio + 1 junho)

### Task 5.1: Validação em produção pelo time real (30 maio sex)

- [ ] **Step 1: Convidar Planejamento + Pos-Embarque para testar**

Mandar mensagem com link `portal.tnethub.com.br/?aba=planejamento_tramontina` e roteiro:
- Criar rotas de teste em mês fictício `2026-99` para não interferir com dados reais
- Reportar bugs

- [ ] **Step 2: Hotfix se necessário**

Cada bug vira commit isolado em develop, ciclo `develop → main`.

- [ ] **Step 3: Limpar dados de teste**

```bash
echo 124578595 | sudo -S docker exec transnet-prod node -e "require('./src/database/db').dbRun(\"DELETE FROM tramontina_rota_entregas WHERE rota_id IN (SELECT id FROM tramontina_rotas WHERE mes_referencia='2026-99')\").then(()=>require('./src/database/db').dbRun(\"DELETE FROM tramontina_rotas WHERE mes_referencia='2026-99'\")).then(()=>console.log('ok')).catch(console.error)"
```

---

### Task 5.2: Ativar GERADOR_FONTE=banco em produção (31 maio sáb)

**Files:**
- Modify: `/opt/transnet/prod/.env.prod` (no servidor)

- [ ] **Step 1: Backup do .env.prod atual**

```bash
echo 124578595 | sudo -S cp /opt/transnet/prod/.env.prod /opt/transnet/prod/.env.prod.bak-$(date +%Y%m%d)
```

- [ ] **Step 2: Adicionar variável**

```bash
echo "GERADOR_FONTE=banco" | echo 124578595 | sudo -S tee -a /opt/transnet/prod/.env.prod
```

Verificar:

```bash
echo 124578595 | sudo -S cat /opt/transnet/prod/.env.prod | grep GERADOR_FONTE
```

Expected: `GERADOR_FONTE=banco`.

- [ ] **Step 3: Restart container prod**

```bash
cd /opt/transnet/prod
echo 124578595 | sudo -S docker compose --env-file .env.prod restart app
```

- [ ] **Step 4: Smoke test em prod**

Lançar um card de teste com coleta inexistente (`99998`) e operação `DELTA-PORCELANA RECIFE`. Verificar logs:

```bash
echo 124578595 | sudo -S docker logs --tail 50 transnet-prod 2>&1 | grep -iE "gerador|rota|coleta"
```

Expected: nenhum erro 500 nem stack trace. Se a coleta não existir no banco, gerador retorna sem-rota silenciosamente.

Apagar o card de teste pelo painel.

---

### Task 5.3: Comunicação ao time + monitoramento (1 junho seg)

- [ ] **Step 1: Mensagem ao time de planejamento**

Texto sugerido:
> A partir de hoje, todas as rotas DELTA-PORCELANA e ELETRIK devem ser cadastradas direto no sistema, em **Planejamento** no menu lateral. A planilha do Google Sheets fica congelada como histórico de maio. Mês corrente (junho/2026) começa vazio. Qualquer dúvida, me chama.

- [ ] **Step 2: Monitorar logs do dia**

```bash
echo 124578595 | sudo -S docker logs --tail 200 -f transnet-prod 2>&1 | grep -iE "error|exception|gerador"
```

Manter o terminal aberto durante o expediente.

- [ ] **Step 3: Atualizar Obsidian vault**

Em `C:/transnet memory/`:
- Criar `modulos/PlanejamentoDelta.md` descrevendo a feature
- Atualizar `modulos.md` adicionando entrada
- `decisions.md`: registrar
  - "Substituição da planilha Operação/Maio por PlanejamentoDelta (2026-06-01)"
  - "GERADOR_FONTE env var como switch entre Sheets e banco"
  - "Representatividade calculada via GENERATED ALWAYS AS STORED no banco"
  - "Pos-Embarque ganha papel de editor financeiro"
- `people.md`: registrar Pos-Embarque como editor de status_financeiro

---

## Anexo — Variáveis de ambiente novas

| Variável | Onde | Valor | Quando ativa |
|---|---|---|---|
| `GERADOR_FONTE` | `.env.staging` | `banco` | Sprint 3 (~26 maio) |
| `GERADOR_FONTE` | `.env.prod` | `banco` | Manual em 31 maio |

Sem esta env (default), gerador continua lendo da planilha Sheets — comportamento atual.

---

## Anexo — Permissões adicionadas

| Permissão | Cargos default |
|---|---|
| `delta_ver` | Direção, Coordenador, Planejamento, Desenvolvedor, Pos-Embarque |
| `delta_editar_operacional` | Coordenador, Planejamento, Desenvolvedor, Pos-Embarque |
| `delta_editar_financeiro` | Coordenador, Planejamento, Pos-Embarque, Desenvolvedor |

Permissões antigas (`tramontina_planejamento`, `tramontina_editar`) **continuam funcionando** em paralelo — não removemos nada para evitar regressão.
