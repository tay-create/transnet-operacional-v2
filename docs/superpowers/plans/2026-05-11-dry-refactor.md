# DRY Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar padrões de código duplicado no projeto através de 4 ondas de refatoração que criam utilitários reutilizáveis e migram todos os consumidores existentes.

**Architecture:** Cada onda é um commit independente: (1) middleware backend, (2) utilitários frontend, (3) migração dos consumidores, (4) ModalWrapper. Ondas 1 e 2 são adições puras — zero risco. Ondas 3 e 4 são substituições de padrões, arquivo por arquivo.

**Tech Stack:** Express.js (CommonJS), React 18 (ES Modules), Zustand, Axios (`src/services/apiService.js`)

---

## Branch de Trabalho

**Todos os commits de implementação devem ser feitos na branch `develop`, não em `main`.**

```bash
git checkout -b develop
# ou, se já existir:
git checkout develop
```

O push final deve ser: `git push origin develop` — sem tocar em `main` enquanto estiver em teste.

---

## Arquivo Map

**Criados:**
- `middleware/asyncHandler.js` — wrapper de erro para handlers Express
- `middleware/roles.js` — constantes de grupos de cargos
- `src/utils/dateFormatter.js` — funções de formatação de data
- `src/hooks/useToast.js` — hook de notificações toast
- `src/hooks/useApiCall.js` — hook de chamadas API com loading/erro
- `src/components/ModalWrapper.js` — overlay genérico para modais

**Modificados:**
- `src/routes/posembarque.js`, `chamados.js`, `checklists.js`, `tasks.js`, `tramontina.js`, `ocorrencias.js`, `veiculos.js`, `auth.js`
- `server.js` — rotas inline
- `src/components/DashboardPosEmbarque.js`, `PainelPosEmbarque.js`, `RelatorioPerformance.js`, `PainelProgramacao.js`
- `src/components/GestaoMarcacoes.js`, `PainelSaldoPaletes.js`, `ProvisionamentoFrota.js`, `DashboardFrota.js`
- `src/components/PainelOperacional.js` e demais com padrão loading/erro
- `src/components/ModalImagem.js`, `ModalOcorrencia.js`, `ModalChecklistCarreta.js`, `ModalChamados.js`, `ModalImportacaoLotes.js`

---

## Task 1: Criar `middleware/asyncHandler.js`

**Files:**
- Create: `middleware/asyncHandler.js`

- [ ] **Step 1: Criar o arquivo**

```js
// middleware/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) =>
        res.status(500).json({ success: false, message: e.message })
    );

module.exports = { asyncHandler };
```

- [ ] **Step 2: Verificar que o arquivo foi criado corretamente**

```bash
cat middleware/asyncHandler.js
```

Esperado: conteúdo exibido sem erros.

---

## Task 2: Criar `middleware/roles.js`

**Files:**
- Create: `middleware/roles.js`

**Contexto importante:** `authMiddleware.js` já inclui `['Coordenador', 'Direção', 'Adm Frota', 'Desenvolvedor']` em `CARGOS_ADMIN` e concede acesso automaticamente — esses cargos não precisam estar nos grupos abaixo. Os grupos só precisam listar cargos que NÃO são admin mas que têm acesso à rota.

**Nota sobre `tramontina.js`:** esse arquivo já usa uma constante local `CARGOS_EDITAR`. Não mover para `roles.js` — é específico de um módulo.

**Nota sobre `checklists.js`:** usa `['Conferente', ...]` em vários padrões. Acrescentar `CONFERENTE` ao roles.js.

- [ ] **Step 1: Criar o arquivo**

```js
// middleware/roles.js
const ROLES = {
    // Operação diária (Painel Operacional, veículos, cubagem)
    OPERACIONAL:  ['Planejamento', 'Encarregado', 'Aux. Operacional'],

    // Apenas cadastro/risco
    CADASTRO:     ['Encarregado', 'Cadastro'],

    // CT-e e conhecimento
    CTE:          ['Planejamento', 'Conhecimento'],

    // Pós-embarque
    POS_EMBARQUE: ['Pos Embarque', 'Planejamento'],

    // Gestão de frota própria
    FROTA:        ['Adm Frota', 'Planejamento'],

    // Conferente de carregamento
    CONFERENTE:   ['Conferente', 'Encarregado'],

    // Consulta ampla (leitura, sem edição)
    CONSULTA:     ['Planejamento', 'Encarregado', 'Aux. Operacional',
                   'Cadastro', 'Conhecimento', 'Pos Embarque'],
};

module.exports = { ROLES };
```

- [ ] **Step 2: Verificar**

```bash
node -e "const { ROLES } = require('./middleware/roles'); console.log(Object.keys(ROLES))"
```

Esperado: `[ 'OPERACIONAL', 'CADASTRO', 'CTE', 'POS_EMBARQUE', 'FROTA', 'CONFERENTE', 'CONSULTA' ]`

- [ ] **Step 3: Commit**

```bash
git add middleware/asyncHandler.js middleware/roles.js
git commit -m "feat(middleware): asyncHandler + ROLES constants"
```

---

## Task 3: Criar `src/utils/dateFormatter.js`

**Files:**
- Create: `src/utils/dateFormatter.js`

**Atenção ao mapear consumidores:**
- `DashboardPosEmbarque.js` e `PainelPosEmbarque.js`: função local `formatData(d)` → usar `formatDataBR`
- `RelatorioPerformance.js`: tem DUAS funções locais com nomes confusos:
  - `formatDataBR(dataISO)` → retorna `"DD/MM"` (sem ano, para gráficos) → usar `formatDataCurta`
  - `formatDataBRFull(dataISO)` → retorna `"DD/MM/YYYY"` → usar `formatDataBR`
- `PainelProgramacao.js`: função local `formatData(dStr)` → usar `formatDataBR`

- [ ] **Step 1: Criar o arquivo**

```js
// src/utils/dateFormatter.js

// "01/05/2025" — compatível com datas ISO "YYYY-MM-DD" e datetimes
// Strings de apenas data (10 chars) são fixadas em 12:00 BRT para evitar
// deslocamento UTC→BRT que inverte o dia.
export const formatDataBR = (d) => {
    if (!d) return '—';
    const s = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00-03:00' : d;
    return new Date(s).toLocaleDateString('pt-BR');
};

// "01/05/2025 14:30"
export const formatDataHoraBR = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

// "01/05" — para labels de gráficos, sem ano
export const formatDataCurta = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    return `${parts[2]}/${parts[1]}`;
};
```

- [ ] **Step 2: Verificar que o módulo exporta corretamente**

Não há ambiente de teste no projeto. Verificar via build do React:

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully` (sem erros de import).

- [ ] **Step 3: Commit**

```bash
git add src/utils/dateFormatter.js
git commit -m "feat(utils): dateFormatter — formatDataBR, formatDataHoraBR, formatDataCurta"
```

---

## Task 4: Criar `src/hooks/useToast.js` e `src/hooks/useApiCall.js`

**Files:**
- Create: `src/hooks/useToast.js`
- Create: `src/hooks/useApiCall.js`

- [ ] **Step 1: Criar `useToast.js`**

```js
// src/hooks/useToast.js
import { useState, useCallback, useMemo } from 'react';

export function useToast(duracao = 3000) {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((msg, tipo = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracao);
    }, [duracao]);

    const toast = useMemo(() => ({
        success: (msg) => add(msg, 'success'),
        error:   (msg) => add(msg, 'erro'),
        info:    (msg) => add(msg, 'info'),
    }), [add]);

    return { toasts, toast };
}
```

**Como renderizar os toasts no componente:**
```jsx
{toasts.map(t => (
    <div key={t.id} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        background: t.tipo === 'erro' ? '#7f1d1d' : '#1e293b',
        border: `1px solid ${t.tipo === 'erro' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '10px', padding: '12px 20px',
        color: t.tipo === 'erro' ? '#f87171' : '#4ade80',
        fontWeight: '600', fontSize: '14px', zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
        {t.msg}
    </div>
))}
```

- [ ] **Step 2: Criar `useApiCall.js`**

```js
// src/hooks/useApiCall.js
import { useState, useCallback } from 'react';

export function useApiCall() {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const execute = useCallback(async (fn) => {
        try {
            setLoading(true);
            setErro('');
            return await fn();
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Erro ao processar';
            setErro(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, erro, execute };
}
```

**Uso padrão com múltiplas operações independentes no mesmo componente:**
```jsx
const { loading: loadingDados, erro: erroDados, execute: carregarDados } = useApiCall();
const { loading: loadingSalvar, execute: salvar } = useApiCall();

// No useEffect:
useEffect(() => {
    carregarDados(() => api.get('/api/rota')).then(res => setDados(res.data.itens));
}, []);

// No handler:
const handleSalvar = async () => {
    try {
        await salvar(() => api.post('/api/rota', payload));
        toast.success('Salvo!');
    } catch (_) {}  // erro já capturado em useApiCall
};
```

**Atenção:** `execute` relança o erro após capturá-lo. Envolver chamadas em `try/catch` quando precisar fazer algo no catch (ex: não fechar o modal).

- [ ] **Step 3: Build para verificar**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useToast.js src/hooks/useApiCall.js
git commit -m "feat(hooks): useToast + useApiCall"
```

---

## Task 5: Migrar `src/routes/*.js` — asyncHandler + ROLES

**Files:**
- Modify: `src/routes/posembarque.js`
- Modify: `src/routes/chamados.js`
- Modify: `src/routes/checklists.js`
- Modify: `src/routes/tasks.js`
- Modify: `src/routes/tramontina.js`
- Modify: `src/routes/ocorrencias.js`
- Modify: `src/routes/veiculos.js`
- Modify: `src/routes/auth.js`

**Padrão a aplicar em cada arquivo:**

1. Adicionar imports no topo:
```js
const { asyncHandler } = require('../../middleware/asyncHandler');
const { ROLES } = require('../../middleware/roles');
```

2. Substituir cada handler:
```js
// ANTES:
router.get('/rota', authMiddleware, async (req, res) => {
    try {
        // lógica
        res.json({ success: true, dados });
    } catch (e) {
        console.error('Erro:', e);
        res.status(500).json({ success: false, message: 'Mensagem de erro.' });
    }
});

// DEPOIS:
router.get('/rota', authMiddleware, asyncHandler(async (req, res) => {
    // lógica (sem try/catch)
    res.json({ success: true, dados });
}));
```

3. Substituir arrays de roles inline por constantes:
```js
// ANTES:
authorize(['Pos Embarque', 'Planejamento', 'Coordenador', 'Direção'])
// DEPOIS:
authorize(ROLES.POS_EMBARQUE)

// ANTES:
authorize(['Planejamento', 'Encarregado', 'Aux. Operacional'])
// DEPOIS:
authorize(ROLES.OPERACIONAL)

// ANTES:
authorize(['Conferente', 'Coordenador', 'Direção', 'Encarregado'])
// DEPOIS:
authorize(ROLES.CONFERENTE)
```

**Mapeamento por arquivo:**

| Arquivo | Arrays substituíveis por ROLES |
|---|---|
| `posembarque.js` | `['Pos Embarque', 'Planejamento', ...]` → `ROLES.POS_EMBARQUE` |
| `veiculos.js` | `['Planejamento', 'Encarregado', 'Aux. Operacional']` → `ROLES.OPERACIONAL` |
| `checklists.js` | `['Conferente', ..., 'Encarregado']` → `ROLES.CONFERENTE`; arrays maiores → manter inline |
| `ocorrencias.js` | `['Coordenador', 'Direção']` → podem ser removidos pois estão em CARGOS_ADMIN, mas manter inline por clareza |
| `tramontina.js` | Já usa `CARGOS_EDITAR` local → **não alterar roles**, só adicionar `asyncHandler` |
| `chamados.js`, `tasks.js`, `auth.js` | Sem `authorize()` relevante → só `asyncHandler` |

**Exceção — `catch` com lógica de negócio:** se o bloco `catch` existente faz algo além de `res.status(500).json(...)` (ex: log específico, fallback de dados), manter o `try/catch` interno e só remover o `catch` mais externo que responde 500.

Exemplo em `posembarque.js` — POST criar ocorrência tem try/catch INTERNOS para listas auxiliares e logs. Esses try/catch internos devem ser PRESERVADOS:
```js
router.post('/api/posembarque/ocorrencias', authMiddleware, authorize(ROLES.POS_EMBARQUE), asyncHandler(async (req, res) => {
    // lógica principal sem try/catch
    const result = await dbRun(`INSERT INTO ...`, [...]);

    // try/catch interno para operação secundária — MANTER
    try {
        if (motorista) await dbRun(`INSERT INTO posemb_motoristas...`);
    } catch (errListas) {
        console.warn('[POSEMB] Falha ao popular listas:', errListas.message);
    }

    res.json({ success: true, id: result.lastID });
    // O asyncHandler captura qualquer erro não tratado acima e responde 500
}));
```

- [ ] **Step 1: Migrar `posembarque.js`** — adicionar imports, aplicar asyncHandler em todos os handlers, substituir roles.

- [ ] **Step 2: Migrar `chamados.js`** — asyncHandler em todos os handlers (sem ROLES a substituir).

- [ ] **Step 3: Migrar `checklists.js`** — asyncHandler + ROLES.CONFERENTE onde aplicável.

- [ ] **Step 4: Migrar `tasks.js`** — asyncHandler (sem ROLES a substituir).

- [ ] **Step 5: Migrar `tramontina.js`** — asyncHandler apenas (já tem `CARGOS_EDITAR` local, não alterar).

- [ ] **Step 6: Migrar `ocorrencias.js`** — asyncHandler.

- [ ] **Step 7: Migrar `veiculos.js`** — asyncHandler + ROLES.OPERACIONAL onde aplicável.

- [ ] **Step 8: Migrar `auth.js`** — asyncHandler.

- [ ] **Step 9: Commit**

```bash
git add src/routes/
git commit -m "refactor(routes): asyncHandler + ROLES em src/routes/*"
```

---

## Task 6: Migrar `server.js` — asyncHandler + ROLES nas rotas inline

**Files:**
- Modify: `server.js`

**Contexto:** `server.js` tem ~50+ rotas inline além das importadas de `src/routes/`. Essas rotas inline usam o mesmo padrão try/catch. O arquivo já importa `authMiddleware` e `authorize` de `./middleware/authMiddleware`.

- [ ] **Step 1: Adicionar imports no topo do `server.js`**

Localizar a linha de imports dos middlewares (linha ~18) e adicionar logo abaixo:
```js
const { asyncHandler } = require('./middleware/asyncHandler');
const { ROLES } = require('./middleware/roles');
```

- [ ] **Step 2: Aplicar asyncHandler e ROLES em todas as rotas inline**

Percorrer o `server.js` e aplicar o mesmo padrão da Task 5. Para cada bloco:
```js
// ANTES:
app.get('/api/rota', authMiddleware, authorize(['Planejamento', 'Encarregado', 'Aux. Operacional']), async (req, res) => {
    try {
        const dados = await dbAll('SELECT ...', []);
        res.json({ success: true, dados });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// DEPOIS:
app.get('/api/rota', authMiddleware, authorize(ROLES.OPERACIONAL), asyncHandler(async (req, res) => {
    const dados = await dbAll('SELECT ...', []);
    res.json({ success: true, dados });
}));
```

Mapeamento de roles frequentes no `server.js`:
- `['Planejamento', 'Encarregado', 'Aux. Operacional']` ou `['Coordenador', 'Planejamento', 'Encarregado', 'Aux. Operacional']` → `ROLES.OPERACIONAL`
- `['Pos Embarque', 'Planejamento', 'Coordenador', 'Direção']` → `ROLES.POS_EMBARQUE`
- `['Planejamento', 'Conhecimento', 'Coordenador']` → `ROLES.CTE`
- Arrays que não têm um grupo limpo → manter inline

- [ ] **Step 3: Verificar que o servidor inicia sem erros**

```bash
node -e "require('./server.js')" 2>&1 | head -20
```

Esperado: logs de inicialização sem `Error:` ou `Cannot find module`.

Ou se o projeto roda em Docker, fazer o build e verificar os logs do container.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "refactor(server): asyncHandler + ROLES nas rotas inline"
```

---

## Task 7: Migrar componentes — `dateFormatter`

**Files:**
- Modify: `src/components/DashboardPosEmbarque.js`
- Modify: `src/components/PainelPosEmbarque.js`
- Modify: `src/components/RelatorioPerformance.js`
- Modify: `src/components/PainelProgramacao.js`

**ATENÇÃO — Armadilha em `RelatorioPerformance.js`:**
A função local chamada `formatDataBR` nesse arquivo retorna `"DD/MM"` (sem ano), ao contrário do `formatDataBR` do `dateFormatter` que retorna `"DD/MM/YYYY"`. O mapeamento correto é:

| Função local em `RelatorioPerformance.js` | Função de `dateFormatter.js` |
|---|---|
| `formatDataBR(dataISO)` → `"DD/MM"` | `formatDataCurta(isoStr)` |
| `formatDataBRFull(dataISO)` → `"DD/MM/YYYY"` | `formatDataBR(d)` |

- [ ] **Step 1: Migrar `DashboardPosEmbarque.js`**

Localizar (linha ~47):
```js
const formatData = (d) => {
    if (!d) return '—';
    const s = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00-03:00' : d;
    return new Date(s).toLocaleDateString('pt-BR');
};
```

Remover essa função.

Adicionar no topo do arquivo junto aos imports:
```js
import { formatDataBR } from '../utils/dateFormatter';
```

Substituir todas as chamadas `formatData(...)` por `formatDataBR(...)` no arquivo.

- [ ] **Step 2: Migrar `PainelPosEmbarque.js`**

Mesma operação: localizar e remover `const formatData = (d) => { ... }` (linha ~9), adicionar import, substituir chamadas.

- [ ] **Step 3: Migrar `RelatorioPerformance.js`**

Localizar (linhas ~95-105):
```js
function formatDataBR(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
}

function formatDataBRFull(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}
```

Remover ambas as funções.

Adicionar import:
```js
import { formatDataBR, formatDataCurta } from '../utils/dateFormatter';
```

Substituir no arquivo:
- `formatDataBR(...)` → `formatDataCurta(...)` (retorna "DD/MM" — para labels de gráfico)
- `formatDataBRFull(...)` → `formatDataBR(...)` (retorna "DD/MM/YYYY")

- [ ] **Step 4: Migrar `PainelProgramacao.js`**

Localizar a função local `formatData`:
```js
const formatData = (dStr) => {
    if (!dStr) return '';
    const [a, m, d] = dStr.split('-');
    return `${d}/${m}/${a}`;
};
```

Remover e adicionar import:
```js
import { formatDataBR } from '../utils/dateFormatter';
```

Substituir chamadas `formatData(...)` por `formatDataBR(...)`.

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardPosEmbarque.js src/components/PainelPosEmbarque.js src/components/RelatorioPerformance.js src/components/PainelProgramacao.js
git commit -m "refactor(components): migrar formatData local para dateFormatter"
```

---

## Task 8: Migrar componentes — `useToast`

**Files:**
- Modify: `src/components/GestaoMarcacoes.js`
- Modify: `src/components/PainelSaldoPaletes.js`
- Modify: `src/components/ProvisionamentoFrota.js`
- Modify: `src/components/DashboardFrota.js`

**Padrão a substituir em cada arquivo:**

```jsx
// ANTES — estado simples:
const [toastMsg, setToastMsg] = useState('');
// ... no handler:
setToastMsg('Salvo com sucesso!');
setTimeout(() => setToastMsg(''), 3000);
// ... no JSX:
{toastMsg && <div style={{ /* estilos inline */ }}>{toastMsg}</div>}

// DEPOIS:
import { useToast } from '../hooks/useToast';
const { toasts, toast } = useToast();
// ... no handler:
toast.success('Salvo com sucesso!');
// ... no JSX (adicionar no final do return, antes do fechamento da raiz):
{toasts.map(t => (
    <div key={t.id} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        background: t.tipo === 'erro' ? '#7f1d1d' : '#1e293b',
        border: `1px solid ${t.tipo === 'erro' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '10px', padding: '12px 20px',
        color: t.tipo === 'erro' ? '#f87171' : '#4ade80',
        fontWeight: '600', fontSize: '14px', zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
        {t.msg}
    </div>
))}
```

Para toasts de erro, usar `toast.error(mensagem)`.

- [ ] **Step 1: Migrar `GestaoMarcacoes.js`** — remover estado de toast string, adicionar `useToast`, atualizar JSX.

- [ ] **Step 2: Migrar `PainelSaldoPaletes.js`** — mesmo processo.

- [ ] **Step 3: Migrar `ProvisionamentoFrota.js`** — mesmo processo.

- [ ] **Step 4: Migrar `DashboardFrota.js`** — mesmo processo. Este componente pode ter toast com estado de array — remover toda a implementação manual e substituir por `useToast`.

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/components/GestaoMarcacoes.js src/components/PainelSaldoPaletes.js src/components/ProvisionamentoFrota.js src/components/DashboardFrota.js
git commit -m "refactor(components): useToast nos componentes com toast manual"
```

---

## Task 9: Migrar componentes — `useApiCall`

**Files:**
- Modify: `src/components/PainelOperacional.js`
- Modify: `src/components/PainelPosEmbarque.js`
- Modify: `src/components/DashboardPosEmbarque.js`
- Modify: demais componentes com padrão `loading/erro/try/finally`

**Padrão a substituir:**

```jsx
// ANTES:
const [loading, setLoading] = useState(false);
const [erro, setErro] = useState('');

const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
        const res = await api.get('/api/rota');
        setDados(res.data.itens || []);
    } catch (e) {
        setErro(e.response?.data?.message || 'Erro ao carregar.');
    } finally {
        setLoading(false);
    }
}, []);

// DEPOIS:
import { useApiCall } from '../hooks/useApiCall';
const { loading, erro, execute: carregarDados } = useApiCall();

const carregarDados = useCallback(async () => {
    const res = await execute(() => api.get('/api/rota'));
    setDados(res.data.itens || []);
}, [execute]);
```

**Quando usar múltiplos `useApiCall` no mesmo componente:**
```jsx
// Se o componente tem operações independentes (ex: carregar dados + salvar):
const { loading: loadingDados, erro: erroDados, execute: executarCarga } = useApiCall();
const { loading: loadingSalvar, execute: executarSalvar } = useApiCall();
```

**Atenção — naming ao renomear `execute`:** não reutilize o mesmo nome que o callback recebe. Use `execute` para o hook e um nome descritivo no callback:
```jsx
// CORRETO:
const { loading, erro, execute } = useApiCall();
const carregarDados = useCallback(async () => {
    const res = await execute(() => api.get('/api/rota'));
    setDados(res.data.itens || []);
}, [execute]);

// ERRADO (conflito de nome):
const { execute: carregarDados } = useApiCall();
const carregarDados = useCallback(...); // ← redeclaração
```

**Critério de parada:** se a migração de um componente não remove pelo menos 5 linhas ou o pattern loading/erro/try/finally aparece apenas uma vez e de forma simples, avaliar se vale a mudança.

- [ ] **Step 1: Migrar `PainelOperacional.js`**

Este é o maior componente (~2000+ linhas). Identificar todos os `useState(false)` e `useState('')` para loading e erro, e todos os `useCallback` de fetch. Migrar um useCallback de cada vez, verificando que o anterior funciona antes de avançar.

Adicionar import:
```js
import { useApiCall } from '../hooks/useApiCall';
```

Para cada fetch com o padrão:
```js
const [loading, setLoading] = useState(false);
const [erro, setErro] = useState('');
```
→ remover esses estados e usar `useApiCall()`.

- [ ] **Step 2: Migrar `PainelPosEmbarque.js`** — mesmo processo.

- [ ] **Step 3: Migrar `DashboardPosEmbarque.js`** — mesmo processo.

- [ ] **Step 4: Varrer demais componentes**

Arquivos a verificar (abrir cada um e aplicar o critério de parada):
- `PainelCte.js`
- `PainelOcorrencias.js`
- `PainelCadastro.js`
- `PainelChecklist.js`
- `RelatorioContratacao.js`
- `RelatorioCte.js`
- `RelatorioResultadoOperacional.js`
- `LogsAuditoria.js`
- `HistoricoLiberacoes.js`
- `ModalImportacaoLotes.js`
- `ModalChamados.js`

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "refactor(components): useApiCall — eliminar loading/erro/try/finally inline"
```

---

## Task 10: Criar `src/components/ModalWrapper.js`

**Files:**
- Create: `src/components/ModalWrapper.js`

- [ ] **Step 1: Criar o componente**

```jsx
// src/components/ModalWrapper.js
import React from 'react';
import { X } from 'lucide-react';

export default function ModalWrapper({
    isOpen,
    onClose,
    children,
    maxWidth = '600px',
    zIndex = 9999,
    hideCloseButton = false,
}) {
    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative', maxWidth, width: '100%',
                    background: '#0f172a', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                    overflow: 'hidden',
                }}
            >
                {!hideCloseButton && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '16px', right: '16px', zIndex: 1,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#64748b', padding: '2px',
                        }}
                    >
                        <X size={16} />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ModalWrapper.js
git commit -m "feat(components): ModalWrapper — overlay genérico reutilizável"
```

---

## Task 11: Migrar modais para `ModalWrapper`

**Files:**
- Modify: `src/components/ModalImagem.js`
- Modify: `src/components/ModalOcorrencia.js`
- Modify: `src/components/ModalChecklistCarreta.js`
- Modify: `src/components/ModalChamados.js`
- Modify: `src/components/ModalImportacaoLotes.js`

**Padrão a substituir:**

```jsx
// ANTES — estrutura típica em cada modal:
import { X } from 'lucide-react';

// Overlay + container + botão X repetidos:
if (!visible) return null;
return (
    <div
        onClick={() => setVisible(false)}
        style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}
    >
        <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '700px', width: '100%', background: '#0f172a', ... }}
        >
            <button onClick={() => setVisible(false)} style={{ position: 'absolute', top: '16px', right: '16px', ... }}>
                <X size={16} />
            </button>
            {/* conteúdo */}
        </div>
    </div>
);

// DEPOIS:
import ModalWrapper from './ModalWrapper';

return (
    <ModalWrapper isOpen={visible} onClose={() => setVisible(false)} maxWidth="700px">
        {/* conteúdo — sem overlay, sem container externo, sem botão X */}
    </ModalWrapper>
);
```

**`ModalImagem.js` — caso especial:** usa `className="modal-overlay"` (CSS externo) e container sem `maxWidth` fixo. Migrar assim:
```jsx
// ANTES:
export default function ModalImagem({ imagemAmpliada, setImagemAmpliada }) {
    if (!imagemAmpliada) return null;
    return (
        <div className="modal-overlay" onClick={() => setImagemAmpliada(null)} style={{ zIndex: 9999, ... }}>
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90%', ... }}>
                <button onClick={() => setImagemAmpliada(null)} style={{ /* botão vermelho */ }}>
                    <X size={18} />
                </button>
                <img src={imagemAmpliada} ... />
            </div>
        </div>
    );
}

// DEPOIS:
import ModalWrapper from './ModalWrapper';
export default function ModalImagem({ imagemAmpliada, setImagemAmpliada }) {
    return (
        <ModalWrapper isOpen={!!imagemAmpliada} onClose={() => setImagemAmpliada(null)} maxWidth="90%" hideCloseButton>
            <div style={{ padding: '20px', position: 'relative' }}>
                <button
                    onClick={() => setImagemAmpliada(null)}
                    style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '50%',
                        width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10000
                    }}
                >
                    <X size={18} />
                </button>
                <img src={imagemAmpliada} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
        </ModalWrapper>
    );
}
```

- [ ] **Step 1: Migrar `ModalImagem.js`** — menor e mais simples, bom para validar o wrapper primeiro.

- [ ] **Step 2: Migrar `ModalOcorrencia.js`** — identificar o div de overlay externo e o container interno, substituir pela estrutura ModalWrapper.

- [ ] **Step 3: Migrar `ModalChecklistCarreta.js`** — maior modal (~31KB), o mesmo padrão. Manter toda a lógica interna, só substituir a estrutura de overlay.

- [ ] **Step 4: Migrar `ModalChamados.js`** — mesmo processo.

- [ ] **Step 5: Migrar `ModalImportacaoLotes.js`** — maior modal (~49KB). Precisa de atenção: pode ter múltiplos `zIndex` internos que precisam ser revistos após remover o container externo.

- [ ] **Step 6: Build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 7: Commit e push para develop**

```bash
git add src/components/ModalImagem.js src/components/ModalOcorrencia.js src/components/ModalChecklistCarreta.js src/components/ModalChamados.js src/components/ModalImportacaoLotes.js
git commit -m "refactor(modals): migrar modais para ModalWrapper"
git push origin develop
```

---

## Verificação Final

Após todos os commits, verificar:

- [ ] `git log --oneline -9` — 9 commits desde o início da refatoração
- [ ] Servidor inicia sem erros (`node server.js` ou via Docker)
- [ ] Build React compilado sem warnings de import
- [ ] Abrir os principais painéis no browser e verificar: Painel Operacional, Pós-embarque, Relatório Performance (datas exibidas corretamente), qualquer modal migrado
- [ ] Atualizar `C:/transnet memory/decisions.md` com a decisão de refatoração DRY e os padrões estabelecidos
