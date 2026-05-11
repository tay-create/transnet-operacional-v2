# Separação Lógica/Apresentação — Domain Hooks + Utils

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair lógica de negócio para `src/utils/` e chamadas de API para domain hooks em `src/hooks/`, tornando os componentes fins, testáveis e desacoplados de `api`.

**Architecture:** Três ondas — (1) utils puras: mover funções já existentes, zero risco; (2) criar hooks sem consumir ainda; (3) migrar componentes para os hooks. `DashboardFrota` e `PainelOperacional` participam só da Onda 1.

**Tech Stack:** React 18, hooks (useState/useCallback/useEffect/useRef), ES Modules.

**Branch:** `develop` — nunca tocar em `main`.

---

## Estrutura de Arquivos

```
src/
  utils/
    slaUtils.js          ← CRIAR — funções SLA extraídas de PainelPosEmbarque.js
    marcacoesUtils.js    ← CRIAR — funções de tempo extraídas de GestaoMarcacoes.js
    frotaUtils.js        ← CRIAR — normalizarVeiculos extraída de DashboardFrota.js
    operacaoUtils.js     ← CRIAR — ehOperacao* extraídas de PainelOperacional.js
  hooks/
    usePosEmbarque.js    ← CRIAR — domain hook para ocorrências pós-embarque
    useMarcacoes.js      ← CRIAR — domain hook para marcações e tokens
  components/
    PainelPosEmbarque.js ← MODIFICAR — usar usePosEmbarque + slaUtils
    GestaoMarcacoes.js   ← MODIFICAR — usar useMarcacoes + marcacoesUtils
    DashboardFrota.js    ← MODIFICAR — importar frotaUtils (remover definição local)
    PainelOperacional.js ← MODIFICAR — importar operacaoUtils (remover definições locais)
```

---

## ONDA 1 — Utils Puras

### Task 1: Criar `src/utils/slaUtils.js`

**Files:**
- Create: `src/utils/slaUtils.js`
- Modify: `src/components/PainelPosEmbarque.js` (remover definições, adicionar import)

- [ ] **Step 1: Criar o arquivo**

```js
// src/utils/slaUtils.js

function parseDatetimeBRT(data, hora) {
    const d = (data || '').substring(0, 10);
    const h = (hora || '00:00').substring(0, 5);
    return new Date(`${d}T${h}:00-03:00`);
}

export function calcularHorasAtraso(oc) {
    const inicio = parseDatetimeBRT(oc.data_ocorrencia, oc.hora_ocorrencia);
    const fim = oc.situacao === 'RESOLVIDO'
        ? (oc.resolved_at ? new Date(oc.resolved_at) : parseDatetimeBRT(oc.data_conclusao, oc.hora_conclusao))
        : new Date();
    return (fim - inicio) / (60 * 60 * 1000);
}

export function verificarAtraso(oc) {
    return calcularHorasAtraso(oc) > 24;
}

export function getLabelAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas <= 24) return null;
    const dias = Math.floor(horas / 24);
    const horasRestantes = Math.floor(horas % 24);
    if (dias >= 1) return `${dias}d ${horasRestantes}h atrasado`;
    return `${Math.floor(horas)}h atrasado`;
}

export function getCorAtraso(oc) {
    const horas = calcularHorasAtraso(oc);
    if (horas > 72) return '#dc2626';
    if (horas > 48) return '#ef4444';
    if (horas > 24) return '#f59e0b';
    return null;
}

export function getSituacaoDisplay(oc) {
    const horas = calcularHorasAtraso(oc);
    if (oc.situacao === 'RESOLVIDO') {
        return horas > 24
            ? { texto: 'RESOLVIDO (>24H)', cor: '#d97706' }
            : { texto: 'RESOLVIDO', cor: '#16a34a' };
    }
    return horas > 24
        ? { texto: 'ATRASADO (>24H)', cor: '#dc2626' }
        : { texto: 'EM ANDAMENTO', cor: '#64748b' };
}

export function ordenarOcorrencias(lista) {
    return [...lista].sort((a, b) => {
        const aEmAndamento = a.situacao === 'Em Andamento';
        const bEmAndamento = b.situacao === 'Em Andamento';
        const aAtrasado = aEmAndamento && verificarAtraso(a);
        const bAtrasado = bEmAndamento && verificarAtraso(b);
        if (aAtrasado && !bAtrasado) return -1;
        if (!aAtrasado && bAtrasado) return 1;
        if (aAtrasado && bAtrasado) return calcularHorasAtraso(b) - calcularHorasAtraso(a);
        if (aEmAndamento && !bEmAndamento) return -1;
        if (!aEmAndamento && bEmAndamento) return 1;
        return 0;
    });
}
```

- [ ] **Step 2: Atualizar `PainelPosEmbarque.js` — remover definições, adicionar import**

No topo do arquivo, após os imports existentes, adicionar:
```js
import {
    calcularHorasAtraso, verificarAtraso, getLabelAtraso,
    getCorAtraso, getSituacaoDisplay, ordenarOcorrencias,
} from '../utils/slaUtils';
```

Em seguida, apagar as linhas 11–79 do arquivo (as funções `parseDatetimeBRT`, `calcularHorasAtraso`, `verificarAtraso`, `getLabelAtraso`, `getCorAtraso`, `getSituacaoDisplay`, `ordenarOcorrencias`).

Para confirmar quais linhas apagar, procurar no arquivo pelo bloco:
```js
// ──────────── Helpers ────────────────────────────────────

function parseDatetimeBRT(data, hora) {
```
até o fim de `ordenarOcorrencias` (linha que termina o bloco de sort, antes dos estilos `// ──────────── Estilos ────────────────────────────────────`).

- [ ] **Step 3: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`. Se houver erro de "X is not defined", é porque alguma referência ao nome antigo ficou no componente — encontrar e substituir pelo import.

---

### Task 2: Criar `src/utils/marcacoesUtils.js`

**Files:**
- Create: `src/utils/marcacoesUtils.js`
- Modify: `src/components/GestaoMarcacoes.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/utils/marcacoesUtils.js

export function parseDateLocal(str) {
    if (!str) return null;
    if (str.endsWith('Z') || str.includes('+')) return new Date(str);
    return new Date(str.replace(' ', 'T'));
}

// Retorna número de minutos entre dataMarcacao e dataContratacao (ou agora)
export function calcularTempoEspera(dataMarcacao, dataContratacao) {
    if (!dataMarcacao) return null;
    const inicio = parseDateLocal(dataMarcacao);
    const fim = dataContratacao ? parseDateLocal(dataContratacao) : new Date();
    if (!inicio || isNaN(inicio)) return null;
    const diff = Math.floor((fim - inicio) / 60000);
    return Math.max(0, diff);
}

export function formatarTempo(minutos) {
    if (minutos === null) return '—';
    if (minutos < 60) return `${minutos}min`;
    const totalH = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (totalH < 24) return m > 0 ? `${totalH}h ${m}min` : `${totalH}h`;
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (h === 0 && m === 0) return `${d}d`;
    if (h === 0) return `${d}d ${m}min`;
    if (m === 0) return `${d}d ${h}h`;
    return `${d}d ${h}h ${m}min`;
}

export function corTempo(min) {
    if (min === null) return '#64748b';
    if (min < 60) return '#4ade80';
    if (min < 240) return '#fbbf24';
    return '#f87171';
}

export function corDisponibilidade(disp) {
    if (!disp) return '#64748b';
    if (disp === 'NO PÁTIO') return '#4ade80';
    if (disp === 'NO POSTO') return '#fbbf24';
    return '#94a3b8';
}
```

- [ ] **Step 2: Atualizar `GestaoMarcacoes.js` — remover definições, adicionar import**

No topo do arquivo, adicionar:
```js
import {
    parseDateLocal, calcularTempoEspera, formatarTempo,
    corTempo, corDisponibilidade,
} from '../utils/marcacoesUtils';
```

Apagar as funções locais `parseDateLocal`, `calcularTempoEspera`, `formatarTempo`, `corTempo`, `corDisponibilidade` do arquivo (localizadas entre o comentário `// ── Cálculo de tempo de espera` e `// ── Cor da disponibilidade` inclusive, terminando antes de `const FORM_FROTA_INICIAL`).

- [ ] **Step 3: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

---

### Task 3: Criar `src/utils/frotaUtils.js`

**Files:**
- Create: `src/utils/frotaUtils.js`
- Modify: `src/components/DashboardFrota.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/utils/frotaUtils.js

/**
 * Normaliza lista de veículos para o dashboard de frota:
 * - CONJUNTO → card _cardTipo='CONJUNTO' + entrada virtual _cardTipo='CARRETA' (_atrelada=true)
 * - CARRETA avulsa → _cardTipo='CARRETA', _atrelada=false
 * - demais → _cardTipo=tipo_veiculo
 */
export function normalizarVeiculos(veiculos) {
    const result = [];
    for (const v of veiculos) {
        if (v.tipo_veiculo === 'CONJUNTO') {
            result.push({ ...v, _cardTipo: 'CONJUNTO', _placaExibicao: v.placa });
            if (v.carreta) {
                result.push({
                    ...v,
                    _cardTipo: 'CARRETA',
                    _placaExibicao: v.carreta,
                    _atrelada: true,
                });
            }
        } else if (v.tipo_veiculo === 'CARRETA') {
            const placaReal = (v.placa && v.placa !== '-') ? v.placa : (v.carreta || v.placa);
            result.push({
                ...v,
                _cardTipo: 'CARRETA',
                _placaExibicao: placaReal,
                _atrelada: false,
            });
        } else {
            result.push({ ...v, _cardTipo: v.tipo_veiculo, _placaExibicao: v.placa });
        }
    }
    return result;
}
```

- [ ] **Step 2: Atualizar `DashboardFrota.js` — remover definição, adicionar import**

No topo do arquivo, adicionar:
```js
import { normalizarVeiculos } from '../utils/frotaUtils';
```

Apagar a função `normalizarVeiculos` do arquivo (linhas ~38–67, o bloco que começa com `function normalizarVeiculos(veiculos) {` e termina com `}`).

- [ ] **Step 3: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

---

### Task 4: Criar `src/utils/operacaoUtils.js`

**Files:**
- Create: `src/utils/operacaoUtils.js`
- Modify: `src/components/PainelOperacional.js`

- [ ] **Step 1: Criar o arquivo**

```js
// src/utils/operacaoUtils.js

export const ehOperacaoInterestadual = (op) =>
    op === 'LEÃO - SP' || op === 'ELETRIK SUL';

export const ehOperacaoRecife = (op) =>
    op && !ehOperacaoInterestadual(op) && op.includes('RECIFE');

export const ehOperacaoMoreno = (op) =>
    op && !ehOperacaoInterestadual(op) &&
    (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));
```

- [ ] **Step 2: Atualizar `PainelOperacional.js` — remover definições, adicionar import**

No topo do arquivo, adicionar:
```js
import { ehOperacaoInterestadual, ehOperacaoRecife, ehOperacaoMoreno } from '../utils/operacaoUtils';
```

Apagar as três linhas locais (próximas ao início do arquivo, após os imports):
```js
const ehOperacaoInterestadual = (op) => op === 'LEÃO - SP' || op === 'ELETRIK SUL';
const ehOperacaoRecife = (op) => op && !ehOperacaoInterestadual(op) && op.includes('RECIFE');
const ehOperacaoMoreno = (op) => op && !ehOperacaoInterestadual(op) && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'));
```

- [ ] **Step 3: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

- [ ] **Step 4: Commit Onda 1**

```bash
cd /home/transnet/projects/transnet-operacional-v2
git add src/utils/slaUtils.js src/utils/marcacoesUtils.js src/utils/frotaUtils.js src/utils/operacaoUtils.js
git add src/components/PainelPosEmbarque.js src/components/GestaoMarcacoes.js src/components/DashboardFrota.js src/components/PainelOperacional.js
git commit -m "refactor(utils): extrair lógica de negócio — slaUtils, marcacoesUtils, frotaUtils, operacaoUtils"
git push origin develop
```

---

## ONDA 2 — Domain Hooks (criação sem consumo)

### Task 5: Criar `src/hooks/usePosEmbarque.js`

**Files:**
- Create: `src/hooks/usePosEmbarque.js`

O hook gerencia fetch e mutações de ocorrências pós-embarque. Não usa `useApiCall` (o fetch precisa de loading manual; as mutações são fire-and-forget com re-fetch). Carrega `listas` automaticamente no mount.

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/usePosEmbarque.js
import { useState, useCallback, useEffect } from 'react';
import api from '../services/apiService';

export function usePosEmbarque() {
    const [ocorrencias, setOcorrencias] = useState([]);
    const [listas, setListas] = useState({ motoristas: [], clientes: [], motivos: [] });
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Carrega listas de suporte (operações, motoristas, motivos) uma vez no mount
    useEffect(() => {
        api.get('/api/posembarque/listas')
            .then(res => {
                if (res.data.success) setListas({
                    motoristas: res.data.motoristas || [],
                    clientes: res.data.clientes || [],
                    motivos: res.data.motivos || [],
                });
            })
            .catch(() => {});
    }, []);

    const carregarOcorrencias = useCallback(async (busca = '', filtroSituacao = '') => {
        setLoading(true);
        setErro('');
        try {
            const res = await api.get('/api/posembarque/ocorrencias', {
                params: { busca, situacao: filtroSituacao, arquivado: 0 },
            });
            if (res.data.success) setOcorrencias(res.data.ocorrencias || []);
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao carregar ocorrências.');
        } finally {
            setLoading(false);
        }
    }, []);

    const criarOcorrencia = useCallback(async (form) => {
        const res = await api.post('/api/posembarque/ocorrencias', form);
        return res.data;
    }, []);

    const resolverOcorrencia = useCallback(async (id) => {
        await api.post(`/api/posembarque/ocorrencias/${id}/resolver`);
    }, []);

    const editarOcorrencia = useCallback(async (id, form) => {
        const res = await api.put(`/api/posembarque/ocorrencias/${id}`, form);
        return res.data;
    }, []);

    const arquivarResolvidas = useCallback(async (lista) => {
        for (const oc of lista) {
            await api.post(`/api/posembarque/ocorrencias/${oc.id}/arquivar`);
        }
    }, []);

    const deletarOcorrencia = useCallback(async (id) => {
        await api.delete(`/api/posembarque/ocorrencias/${id}`);
        setOcorrencias(prev => prev.filter(oc => oc.id !== id));
    }, []);

    const adicionarFoto = useCallback(async (id, base64) => {
        await api.post(`/api/posembarque/ocorrencias/${id}/fotos`, {
            base64,
            nome: `foto_${Date.now()}.jpg`,
        });
    }, []);

    const deletarFoto = useCallback(async (id, index) => {
        await api.delete(`/api/posembarque/ocorrencias/${id}/fotos/${index}`);
    }, []);

    // Não armazena estado — retorna os dados direto para o componente gerenciar
    const carregarRelatorio = useCallback(async (params) => {
        const res = await api.get('/api/posembarque/relatorio', { params });
        return res.data;
    }, []);

    return {
        ocorrencias,
        listas,
        loading,
        erro,
        carregarOcorrencias,
        carregarRelatorio,
        criarOcorrencia,
        resolverOcorrencia,
        editarOcorrencia,
        arquivarResolvidas,
        deletarOcorrencia,
        adicionarFoto,
        deletarFoto,
    };
}
```

- [ ] **Step 2: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`. O hook existe mas ainda não é usado por nenhum componente — isso é esperado.

---

### Task 6: Criar `src/hooks/useMarcacoes.js`

**Files:**
- Create: `src/hooks/useMarcacoes.js`

O hook usa `AbortController` em `carregarMarcacoes` para evitar race conditions quando filtros mudam rápido (múltiplas requests em voo). Loading é gerenciado manualmente por essa razão.

- [ ] **Step 1: Criar o arquivo**

```js
// src/hooks/useMarcacoes.js
import { useState, useCallback, useRef } from 'react';
import api from '../services/apiService';

const ITENS_POR_PAGINA = 50;

export function useMarcacoes() {
    const [marcacoes, setMarcacoes] = useState([]);
    const [tokens, setTokens] = useState([]);
    const [totalMarcacoes, setTotalMarcacoes] = useState(0);
    const [contadores, setContadores] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [erro, setErro] = useState('');
    const abortRef = useRef(null);

    const carregarTokens = useCallback(async () => {
        setLoadingTokens(true);
        try {
            const r = await api.get('/api/tokens');
            if (r.data.success) setTokens(r.data.tokens);
        } catch (e) {
            setErro(e.response?.data?.message || 'Erro ao carregar links.');
        } finally {
            setLoadingTokens(false);
        }
    }, []);

    // filtros: { local?, disponibilidade?, busca?, estado?, tipo_veiculo?, tag?, tempo_min?, tempo_max? }
    const carregarMarcacoes = useCallback(async (filtros = {}, pagina = 1) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const qp = new URLSearchParams({ page: pagina, limit: ITENS_POR_PAGINA });
        if (filtros.local) qp.set('local', filtros.local);
        if (filtros.disponibilidade) qp.set('disponibilidade', filtros.disponibilidade);
        if (filtros.busca) qp.set('busca', filtros.busca);
        if (filtros.estado) qp.set('estado', filtros.estado);
        if (filtros.tipo_veiculo) qp.set('tipo_veiculo', filtros.tipo_veiculo);
        if (filtros.tag) qp.set('tag', filtros.tag);
        if (filtros.tempo_min != null) qp.set('tempo_min', filtros.tempo_min);
        if (filtros.tempo_max != null) qp.set('tempo_max', filtros.tempo_max);

        setLoading(true);
        setErro('');
        try {
            const r = await api.get(`/api/marcacoes?${qp}`, { signal: controller.signal });
            if (r.data.success) {
                setMarcacoes(r.data.marcacoes);
                setTotalMarcacoes(r.data.total || 0);
                if (r.data.contadores) setContadores(r.data.contadores);
            }
        } catch (e) {
            if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
            setErro(e.response?.data?.message || 'Erro ao carregar marcações.');
        } finally {
            setLoading(false);
        }
    }, []);

    const criarToken = useCallback(async (telefone) => {
        const r = await api.post('/api/tokens', { telefone });
        return r.data;
    }, []);

    const atualizarToken = useCallback(async (id, status) => {
        await api.put(`/api/tokens/${id}`, { status });
        setTokens(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    }, []);

    const deletarToken = useCallback(async (id) => {
        await api.delete(`/api/tokens/${id}`);
        setTokens(prev => prev.filter(t => t.id !== id));
    }, []);

    const deletarMarcacao = useCallback(async (id) => {
        await api.delete(`/api/marcacoes/${id}`);
        setMarcacoes(prev => prev.filter(m => m.id !== id));
    }, []);

    // Atualiza disponibilidade (local físico: NO PÁTIO / NO POSTO / EM CASA / Indisponível)
    const atualizarStatus = useCallback(async (id, status) => {
        const r = await api.put(`/api/marcacoes/${id}/status`, { status });
        if (r.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, disponibilidade: status } : m));
        }
    }, []);

    // Atualiza status operacional (DISPONIVEL / EM OPERACAO / CONTRATADO)
    const atualizarStatusOperacional = useCallback(async (id, novoStatus) => {
        const r = await api.put(`/api/marcacoes/${id}/status`, { status_operacional: novoStatus });
        if (r.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, status_operacional: novoStatus } : m));
        }
    }, []);

    const atualizarTag = useCallback(async (id, body) => {
        const r = await api.put(`/api/marcacoes/${id}/tag`, body);
        if (r.data.success) {
            setMarcacoes(prev => prev.map(m => m.id === id ? { ...m, ...body } : m));
        }
    }, []);

    return {
        marcacoes,
        tokens,
        totalMarcacoes,
        contadores,
        loading,
        loadingTokens,
        erro,
        carregarMarcacoes,
        carregarTokens,
        criarToken,
        atualizarToken,
        deletarToken,
        deletarMarcacao,
        atualizarStatus,
        atualizarStatusOperacional,
        atualizarTag,
    };
}
```

- [ ] **Step 2: Build + commit Onda 2**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`.

```bash
cd /home/transnet/projects/transnet-operacional-v2
git add src/hooks/usePosEmbarque.js src/hooks/useMarcacoes.js
git commit -m "feat(hooks): usePosEmbarque + useMarcacoes — domain hooks sem consumo ainda"
git push origin develop
```

---

## ONDA 3 — Migração dos Componentes

### Task 7: Migrar `PainelPosEmbarque.js` para `usePosEmbarque`

**Files:**
- Modify: `src/components/PainelPosEmbarque.js`

Antes de começar, ler o arquivo para confirmar os números de linha atuais. Os números abaixo são referências — podem ter mudado após a Onda 1.

- [ ] **Step 1: Atualizar imports no topo do arquivo**

Remover:
```js
import api from '../services/apiService';
```

Adicionar (após os outros imports):
```js
import { usePosEmbarque } from '../hooks/usePosEmbarque';
```

- [ ] **Step 2: Adicionar hook no topo do componente, substituir estados de servidor**

Logo após a linha `export default function PainelPosEmbarque() {`, adicionar a destruturação do hook:
```js
const {
    ocorrencias, listas, loading: carregando, erro,
    carregarOcorrencias, carregarRelatorio,
    criarOcorrencia: criarOcorrenciaAPI,
    resolverOcorrencia, editarOcorrencia: editarOcorrenciaAPI,
    arquivarResolvidas, deletarOcorrencia: deletarOcorrenciaAPI,
    adicionarFoto, deletarFoto,
} = usePosEmbarque();
```

Remover os três `useState` de dados do servidor:
```js
// REMOVER estas linhas:
const [ocorrencias, setOcorrencias] = useState([]);
const [carregando, setCarregando] = useState(false);
const [listas, setListas] = useState({ motoristas: [], clientes: [], motivos: [] });
```

- [ ] **Step 3: Substituir `carregarOcorrencias` local e o `useEffect` de listas**

Remover o `useCallback` inteiro de `carregarOcorrencias` (o que captura `busca` e `filtroSituacao` por closure):
```js
// REMOVER:
const carregarOcorrencias = useCallback(async () => {
    setCarregando(true);
    try {
        const res = await api.get('/api/posembarque/ocorrencias', {
            params: { busca, situacao: filtroSituacao, arquivado: 0 }
        });
        if (res.data.success) setOcorrencias(res.data.ocorrencias || []);
    } catch (e) {
        console.error('Erro ao carregar ocorrências:', e);
    } finally {
        setCarregando(false);
    }
}, [busca, filtroSituacao]);
```

Substituir o `useEffect` que chama `carregarOcorrencias`:
```js
// ANTES:
useEffect(() => {
    carregarOcorrencias();
}, [carregarOcorrencias]);

// DEPOIS — passa os filtros como parâmetros:
useEffect(() => {
    carregarOcorrencias(busca, filtroSituacao);
}, [busca, filtroSituacao, carregarOcorrencias]);
```

Remover o `useEffect` de listas inteiro:
```js
// REMOVER — o hook carrega listas automaticamente no mount:
useEffect(() => {
    const carregar = async () => {
        try {
            const res = await api.get('/api/posembarque/listas');
            if (res.data.success) {
                setListas({
                    motoristas: res.data.motoristas || [],
                    clientes: res.data.clientes || [],
                    motivos: res.data.motivos || []
                });
            }
        } catch (e) {
            console.error('Erro ao carregar listas:', e);
        }
    };
    carregar();
}, []);
```

- [ ] **Step 4: Substituir ações inline por chamadas ao hook**

Localizar a função `criarOcorrencia` local (que tem validação + `api.post`). Manter a validação e o controle de modal, mas substituir o `api.post` pela chamada ao hook. A função passa a ser:

```js
const criarOcorrencia = async () => {
    if (!form.motorista || !form.cliente || !form.motivo) {
        setModalConfirm({ titulo: 'Campos obrigatórios', mensagem: 'Preencha ao menos Motorista, Cliente e Motivo.', variante: 'aviso' });
        return;
    }
    try {
        const data = await criarOcorrenciaAPI(form);
        if (!data?.success) {
            setModalConfirm({ titulo: 'Erro ao criar', mensagem: data?.message || 'Erro ao criar ocorrência', variante: 'perigo' });
            return;
        }
        setForm({ data_ocorrencia: new Date().toISOString().split('T')[0], hora_ocorrencia: new Date().toTimeString().substring(0, 5), motorista: '', modalidade: '', cte: '', operacao: '', nfs: '', cliente: '', cidade: '', motivo: '', link_email: '' });
        setBusca('');
        setFiltroSituacao('');
        setModalNovaAberto(false);
        setAba('dashboard');
        carregarOcorrencias(busca, filtroSituacao);
    } catch (e) {
        setModalConfirm({ titulo: 'Erro ao criar', mensagem: e?.response?.data?.message || 'Erro ao criar ocorrência', variante: 'perigo' });
    }
};
```

Localizar `resolver` e substituir `api.post` pela chamada ao hook:
```js
// ANTES:
const resolver = async (id) => {
    try {
        await api.post(`/api/posembarque/ocorrencias/${id}/resolver`);
        carregarOcorrencias();
    } catch (e) { console.error('Erro ao resolver:', e); }
};

// DEPOIS:
const resolver = async (id) => {
    try {
        await resolverOcorrencia(id);
        carregarOcorrencias(busca, filtroSituacao);
    } catch (e) { console.error('Erro ao resolver:', e); }
};
```

Para as demais chamadas `api.*` no componente (arquivar, deletar foto, adicionar foto, carregar relatório, salvar edição): localizar cada uma e substituir pela função equivalente do hook, passando os mesmos parâmetros. O padrão é:
- `api.post(url, body)` → `nomeFuncaoHook(params)`
- Remover try/catch interno se o hook já gerencia o erro, OU manter se o componente precisa reagir ao erro (ex: exibir modal de erro)

- [ ] **Step 5: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`. Se houver `api is not defined`, há chamada `api.*` esquecida no componente — procurar e substituir.

---

### Task 8: Migrar `GestaoMarcacoes.js` para `useMarcacoes`

**Files:**
- Modify: `src/components/GestaoMarcacoes.js`

Ler o arquivo antes de começar.

- [ ] **Step 1: Atualizar imports**

Remover:
```js
import api from '../services/apiService';
```

Adicionar:
```js
import { useMarcacoes } from '../hooks/useMarcacoes';
```

- [ ] **Step 2: Adicionar hook, remover estados de servidor**

Logo após `export default function GestaoMarcacoes({ socket }) {`, adicionar:
```js
const {
    marcacoes, setMarcacoes,   // setMarcacoes é necessário para a remoção pontual do socket
    tokens,
    totalMarcacoes, contadores,
    loading, loadingTokens, erro,
    carregarMarcacoes, carregarTokens,
    criarToken, atualizarToken, deletarToken,
    deletarMarcacao, atualizarStatus, atualizarStatusOperacional, atualizarTag,
} = useMarcacoes();
```

**Atenção:** o hook não expõe `setMarcacoes` diretamente. Para a remoção pontual via socket (`payload.tipo === 'marcacao_removida'`), o componente precisa de acesso ao setter. Há duas opções:

**Opção A (recomendada):** Adicionar `setMarcacoes` no retorno do hook:
```js
// Em useMarcacoes.js, adicionar setMarcacoes ao return:
return {
    marcacoes, setMarcacoes,   // expor setter para uso pontual via socket
    // ... resto
};
```

**Opção B:** Manter a lógica de remoção pontual chamando `carregarMarcacoes(filtros, paginaMarcacoes)` em vez de atualizar estado local — mais simples, mas faz um fetch desnecessário.

Usar Opção A. Editar `useMarcacoes.js` para incluir `setMarcacoes` no `return`.

Remover os estados de servidor do componente:
```js
// REMOVER:
const [marcacoes, setMarcacoes] = useState([]);
const [tokens, setTokens] = useState([]);
const [loading, setLoading] = useState(false);
const [totalMarcacoes, setTotalMarcacoes] = useState(0);
const [contadores, setContadoresMarcacoes] = useState(null);
```

- [ ] **Step 3: Substituir `carregarTokens` e `carregarMarcacoes` locais**

Remover os `useCallback` locais de `carregarTokens` e `carregarMarcacoes` inteiros — eles são substituídos pelas funções do hook.

A lógica de AbortController já está dentro do hook. O `useRef(abortMarcacoesRef)` do componente também pode ser removido.

Atualizar o `useEffect` que recarrega marcações. O filtro precisa ser montado e passado para o hook:
```js
// ANTES — capturava filtros por closure:
useEffect(() => {
    if (aba !== 'placas') return;
    const delay = buscaMarcacoes ? 400 : 0;
    const t = setTimeout(() => carregarMarcacoes(1), delay);
    return () => clearTimeout(t);
}, [aba, carregarMarcacoes]);

// DEPOIS — passa filtros explicitamente:
useEffect(() => {
    if (aba !== 'placas') return;
    const filtros = {
        local: filtroDisponibilidade || undefined,
        disponibilidade: filtroStatusOp || undefined,
        busca: buscaMarcacoes.trim() || undefined,
        estado: filtroEstado || undefined,
        tipo_veiculo: filtroTipoVeiculo || undefined,
        tag: filtroTag || undefined,
        ...(filtroTempo ? (() => { const f = FAIXAS_TEMPO.find(x => x.label === filtroTempo); return f ? { tempo_min: f.minutos[0], tempo_max: f.minutos[1] } : {}; })() : {}),
    };
    const delay = buscaMarcacoes ? 400 : 0;
    const t = setTimeout(() => carregarMarcacoes(filtros, 1), delay);
    return () => clearTimeout(t);
}, [aba, filtroDisponibilidade, filtroStatusOp, buscaMarcacoes, filtroEstado, filtroTipoVeiculo, filtroTag, filtroTempo, carregarMarcacoes]);
```

- [ ] **Step 4: Substituir funções de ação locais**

Para cada função que chamava `api.*` diretamente (`gerarLink`, `toggleStatus`, `excluirToken`, `excluirMarcacao`, `handleToggleIndisponivel`, `handleAtualizarLocalizacao`, `handleAvancarStatus`, `toggleTag`):

Localizar a chamada `api.*` dentro de cada função e substituir pela função equivalente do hook. Manter a lógica de UI (toast, setConfirmar, setTokens otimista quando necessário).

Exemplos de substituição:

```js
// gerarLink — ANTES:
async function gerarLink() {
    if (!tel.trim()) { toast.error('Informe o telefone.'); return; }
    try {
        const r = await api.post('/api/tokens', { telefone: tel.trim() });
        if (r.data.success) { setTel(''); toast.success('Link gerado com sucesso!'); carregarTokens(); }
        else { toast.error(r.data.message || 'Erro ao gerar link.'); }
    } catch (e) { toast.error(e.response?.data?.message || 'Erro de conexão.'); }
}

// gerarLink — DEPOIS:
async function gerarLink() {
    if (!tel.trim()) { toast.error('Informe o telefone.'); return; }
    try {
        const data = await criarToken(tel.trim());
        if (data?.success) { setTel(''); toast.success('Link gerado com sucesso!'); carregarTokens(); }
        else { toast.error(data?.message || 'Erro ao gerar link.'); }
    } catch (e) { toast.error(e.response?.data?.message || 'Erro de conexão.'); }
}
```

```js
// toggleStatus — ANTES:
async function toggleStatus(token) {
    const novoStatus = statusEfetivo(token) === 'ativo' ? 'inativo' : 'ativo';
    try {
        await api.put(`/api/tokens/${token.id}`, { status: novoStatus });
        setTokens(prev => prev.map(t => t.id === token.id ? { ...t, status: novoStatus } : t));
        toast.success(novoStatus === 'ativo' ? 'Link reativado.' : 'Link inativado.');
    } catch (e) { toast.error('Erro ao atualizar.'); }
}

// toggleStatus — DEPOIS (hook já faz o setTokens otimista internamente):
async function toggleStatus(token) {
    const novoStatus = statusEfetivo(token) === 'ativo' ? 'inativo' : 'ativo';
    try {
        await atualizarToken(token.id, novoStatus);
        toast.success(novoStatus === 'ativo' ? 'Link reativado.' : 'Link inativado.');
    } catch (e) { toast.error('Erro ao atualizar.'); }
}
```

```js
// handleAvancarStatus — ANTES:
async function handleAvancarStatus(m) {
    const fluxo = { DISPONIVEL: 'EM OPERACAO', 'EM OPERACAO': 'CONTRATADO', CONTRATADO: 'DISPONIVEL', 'EM VIAGEM': 'DISPONIVEL', 'EM ROTA': 'DISPONIVEL' };
    const novoStatus = fluxo[m.status_operacional || 'DISPONIVEL'] || 'DISPONIVEL';
    try {
        const r = await api.put(`/api/marcacoes/${m.id}/status`, { status_operacional: novoStatus });
        if (r.data.success) setMarcacoes(prev => prev.map(x => x.id === m.id ? { ...x, status_operacional: novoStatus } : x));
    } catch (e) { toast.error('Erro ao atualizar status.'); }
}

// handleAvancarStatus — DEPOIS:
async function handleAvancarStatus(m) {
    const fluxo = { DISPONIVEL: 'EM OPERACAO', 'EM OPERACAO': 'CONTRATADO', CONTRATADO: 'DISPONIVEL', 'EM VIAGEM': 'DISPONIVEL', 'EM ROTA': 'DISPONIVEL' };
    const novoStatus = fluxo[m.status_operacional || 'DISPONIVEL'] || 'DISPONIVEL';
    try {
        await atualizarStatusOperacional(m.id, novoStatus);
    } catch (e) { toast.error('Erro ao atualizar status.'); }
}
```

Aplicar o mesmo padrão para `excluirToken`, `excluirMarcacao`, `handleToggleIndisponivel`, `handleAtualizarLocalizacao`, `toggleTag`.

- [ ] **Step 5: Build**

```bash
cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20
```

Esperado: `compiled successfully`. Se houver `api is not defined`, há chamada esquecida — procurar com grep:

```bash
grep -n "api\." /home/transnet/projects/transnet-operacional-v2/src/components/GestaoMarcacoes.js
```

- [ ] **Step 6: Commit + push Onda 3**

```bash
cd /home/transnet/projects/transnet-operacional-v2
git add src/components/PainelPosEmbarque.js src/components/GestaoMarcacoes.js src/hooks/useMarcacoes.js
git commit -m "refactor(components): migrar PainelPosEmbarque e GestaoMarcacoes para domain hooks"
git push origin develop
```

---

## Verificação Final

Após todos os commits, confirmar no staging (portal.tnethub.com.br, porta 3002):

1. **PainelPosEmbarque** — abre, lista ocorrências, criar nova, resolver, arquivar funciona
2. **GestaoMarcações** — lista de links e de motoristas carrega, gerar link, toggle status, excluir funcionam
3. **DashboardFrota** — cards de veículos normalizam corretamente (CONJUNTO + CARRETA)
4. **PainelOperacional** — operações interestadual/Recife/Moreno identificadas corretamente

Ao final, atualizar os arquivos .md do Obsidian pertinentes — novos e existentes — em `C:/transnet memory/`.
