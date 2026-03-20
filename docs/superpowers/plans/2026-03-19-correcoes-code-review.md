# Correções Code Review — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bugs, melhorar performance e substituir polling HTTP por eventos socket identificados na revisão completa do projeto.

**Architecture:** Correções cirúrgicas em arquivos existentes — sem refatoração estrutural. Bugs primeiro, performance depois, realtime por último.

**Tech Stack:** React 19, Express 5, Socket.io 4, PostgreSQL, Zustand, Tailwind

---

## Mapa de Arquivos

| Arquivo | Mudança |
|---|---|
| `.gitignore` | Adicionar `upd.js` e `update_paulo.js` |
| `src/components/PainelCadastro.js` | Fix race condition salvar, fix stale closure socket+datas |
| `src/components/PainelOperacional.js` | Fix memory leak toasts, useMemo filtros, substituir polling por socket |
| `src/App.js` | Adicionar handler `reordenar_fila` |
| `src/components/DashboardTV.js` | Substituir polling 3 endpoints por socket |
| `server.js` | Emitir socket em ocorrências e saldo-paletes |

---

## Task 1: Segurança — .gitignore para scripts com credenciais

**Arquivos:**
- Modify: `.gitignore`

- [x] **Step 1: Adicionar entradas ao .gitignore**

Adicionar ao final do `.gitignore`:
```
upd.js
update_paulo.js
```

- [x] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignorar scripts locais com credenciais hardcoded"
```

---

## Task 2: Bug — Race condition no duplo clique em salvar (PainelCadastro)

**Arquivos:**
- Modify: `src/components/PainelCadastro.js` linhas 220, 267, 308

As três funções `salvar`, `salvarOperacao` e `salvarFrota` não verificam se já há um save em andamento para o mesmo item, permitindo dois requests simultâneos.

- [x] **Step 1: Editar `salvar()` linha 220**

Adicionar guard no início da função:
```js
async function salvar(id) {
    if (salvando === id) return;  // ← ADICIONAR ESTA LINHA
    setSalvando(id);
    // ... resto igual
```

- [x] **Step 2: Editar `salvarOperacao()` linha 267**

```js
async function salvarOperacao(id) {
    if (salvandoOp === id) return;  // ← ADICIONAR ESTA LINHA
    setSalvandoOp(id);
    // ... resto igual
```

- [x] **Step 3: Editar `salvarFrota()` linha 308**

```js
async function salvarFrota(id) {
    if (salvandoFrota === id) return;  // ← ADICIONAR ESTA LINHA
    setSalvandoFrota(id);
    // ... resto igual
```

- [x] **Step 4: Commit**

```bash
git add src/components/PainelCadastro.js
git commit -m "fix: prevenir duplo clique em salvar no PainelCadastro"
```

---

## Task 3: Bug — Stale closure: socket usa datas antigas (PainelCadastro)

**Arquivos:**
- Modify: `src/components/PainelCadastro.js` linhas 178-199

O handler do socket captura `dataInicioOp`/`dataFimOp` no momento do mount e nunca atualiza. Fix: usar refs para as datas.

- [x] **Step 1: Adicionar refs para as datas (logo após os useState das datas, ~linha 77)**

```js
const dataInicioOpRef = useRef(dataInicioOp);
const dataFimOpRef = useRef(dataFimOp);
```

- [x] **Step 2: Sincronizar refs quando as datas mudam (dentro do useEffect linha 202)**

Substituir o useEffect das datas:
```js
useEffect(() => {
    dataInicioOpRef.current = dataInicioOp;
    dataFimOpRef.current = dataFimOp;
    carregarMotoristasOperacao(dataInicioOp, dataFimOp);
}, [dataInicioOp, dataFimOp]); // eslint-disable-line
```

- [x] **Step 3: Usar refs no handler do socket (linha 188)**

No handler `handleRefresh` dentro do useEffect linha 178, trocar:
```js
carregarMotoristasOperacao(dataInicioOp, dataFimOp);
```
por:
```js
carregarMotoristasOperacao(dataInicioOpRef.current, dataFimOpRef.current);
```

- [x] **Step 4: Adicionar `useRef` ao import do React (linha 1)**

Verificar se `useRef` já está no import. Se não estiver, adicionar.

- [x] **Step 5: Commit**

```bash
git add src/components/PainelCadastro.js
git commit -m "fix: stale closure datas no handler socket do PainelCadastro"
```

---

## Task 4: Bug — Handler faltante para reordenar_fila no socket (App.js)

**Arquivos:**
- Modify: `src/App.js` ~linha 349

O servidor emite `{ tipo: 'reordenar_fila', ordem }` mas o frontend não tem case para isso. Outros usuários veem a fila na ordem antiga.

- [x] **Step 1: Adicionar case `reordenar_fila` logo após o case `remove_fila` (~linha 349)**

```js
else if (data.tipo === 'remove_fila') setFila(prev => prev.filter(f => f.id !== data.id));
else if (data.tipo === 'reordenar_fila' && Array.isArray(data.ordem)) setFila(data.ordem);
```

- [x] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "fix: adicionar handler socket para reordenar_fila"
```

---

## Task 5: Performance — useMemo nos filtros de lista (PainelOperacional)

**Arquivos:**
- Modify: `src/components/PainelOperacional.js` linhas 288, 549

O filtro `itensFiltrados` e o sort rodam em todo render, incluindo renders triviais.

- [x] **Step 1: Adicionar `useMemo` ao import do React (linha 1)**

Verificar se `useMemo` já está no import. Se não, adicionar.

- [x] **Step 2: Envolver `itensFiltrados` em useMemo (~linha 288)**

```js
const itensFiltrados = useMemo(() => lista.filter(item => {
    // ... conteúdo do filter atual sem mudanças
}), [lista, dataInicio, dataFim, termoBusca, filtroOperacao, origem]);
```

- [x] **Step 3: Criar `itensOrdenados` com useMemo baseado em `itensFiltrados` (~linha 549)**

Extrair o sort inline para um useMemo separado:
```js
const itensOrdenados = useMemo(() => [...itensFiltrados].sort((a, b) => {
    const campo = origem === 'Recife' ? 'status_recife' : 'status_moreno';
    return ORDEM.indexOf(a[campo] || 'AGUARDANDO') - ORDEM.indexOf(b[campo] || 'AGUARDANDO');
}), [itensFiltrados, origem]);
```

Substituir no JSX o `[...itensFiltrados].sort(...)` por `itensOrdenados`.

- [x] **Step 4: Commit**

```bash
git add src/components/PainelOperacional.js
git commit -m "perf: useMemo em itensFiltrados e itensOrdenados no PainelOperacional"
```

---

## Task 6: Realtime — Substituir polling de motoristas por socket (PainelOperacional)

**Arquivos:**
- Modify: `src/components/PainelOperacional.js` linhas 168-191

O servidor já emite `marcacao_atualizada` quando marcações são criadas, atualizadas ou removidas. O componente pode escutar esse evento em vez de fazer polling HTTP.

- [x] **Step 1: Substituir o useEffect de polling (~linhas 168-191)**

Trocar o bloco inteiro pelo seguinte (mantendo a busca inicial e adicionando socket listener):
```js
// Carregar e manter atualizado motoristas disponíveis via socket
useEffect(() => {
    const buscarMotoristas = () => {
        if (!useAuthStore.getState().isAuthenticated) return;
        api.get('/api/marcacoes/disponiveis')
            .then(r => {
                if (!r.data.success) return;
                const lista = r.data.motoristas;
                setMotoristasDisponiveis(lista);
                if (qtdMotoristasPrev.current !== null && lista.length > qtdMotoristasPrev.current) {
                    const novos = lista.slice(0, lista.length - qtdMotoristasPrev.current);
                    novos.forEach(m => {
                        adicionarToast(`${m.nome_motorista} — ${m.disponibilidade || 'Disponível'} `);
                    });
                }
                qtdMotoristasPrev.current = lista.length;
            })
            .catch(() => { });
    };
    buscarMotoristas();
    if (socket) {
        socket.on('marcacao_atualizada', buscarMotoristas);
        return () => socket.off('marcacao_atualizada', buscarMotoristas);
    }
}, [adicionarToast, socket]);
```

- [x] **Step 2: Commit**

```bash
git add src/components/PainelOperacional.js
git commit -m "perf: substituir polling 15s de motoristas por evento socket marcacao_atualizada"
```

---

## Task 7: Realtime — DashboardTV substituir polling por socket

**Arquivos:**
- Modify: `src/components/DashboardTV.js` linhas 95-125
- Modify: `server.js` — rotas POST/PUT/DELETE de ocorrências e saldo-paletes

O DashboardTV faz 3 requisições a cada 10s (30 req/min). O evento `docas_interditadas_update` já existe. Precisamos criar `ocorrencias_update` e `saldo_paletes_update` no backend e escutá-los no DashboardTV.

- [x] **Step 1: Adicionar emit no backend — saldo-paletes POST (~linha 2000)**

Após o INSERT bem-sucedido em `POST /api/saldo-paletes`, antes do `res.json`, adicionar:
```js
io.emit('saldo_paletes_update');
```

- [x] **Step 2: Adicionar emit no backend — saldo-paletes PUT devolucao (~linha 2019)**

Após o UPDATE bem-sucedido em `PUT /api/saldo-paletes/:id/devolucao`, adicionar:
```js
io.emit('saldo_paletes_update');
```

- [x] **Step 3: Adicionar emit no backend — saldo-paletes DELETE (~linha 2042)**

Após o DELETE bem-sucedido em `DELETE /api/saldo-paletes/:id`, adicionar:
```js
io.emit('saldo_paletes_update');
```

- [x] **Step 4: Encontrar rotas de ocorrências e adicionar emit**

Buscar no `server.js` as rotas POST/PUT/DELETE de ocorrências. Em cada uma, após operação bem-sucedida, adicionar:
```js
io.emit('ocorrencias_update');
```

- [x] **Step 5: Atualizar DashboardTV — receber socket ao invés de polling**

O componente recebe `socket` via props ou não. Verificar como recebe. Se não recebe socket, importar `useSocket` ou usar a instância global.

Verificar como DashboardTV recebe/usa socket:
```bash
grep -n 'socket\|props' /home/transnet/projects/transnet-operacional-v2/src/components/DashboardTV.js | head -20
```

Substituir o useEffect de polling (linhas 95-125) por:
```js
useEffect(() => {
    let unmounted = false;
    const hoje = obterDataBrasilia();

    const fetchDocas = () => {
        api.get('/api/docas-interditadas').then(r => {
            if (!unmounted && r.data?.success) setDocasInterditadas(r.data.docas);
        }).catch(() => {});
    };
    const fetchOcorrencias = () => {
        api.get('/api/ocorrencias').then(r => {
            if (!unmounted && r.data?.success) {
                setOcorrenciasHoje((r.data.ocorrencias || []).filter(o =>
                    (o.data_criacao || '').substring(0, 10) === hoje
                ));
            }
        }).catch(() => {});
    };
    const fetchPaletes = () => {
        api.get('/api/saldo-paletes').then(r => {
            if (!unmounted && r.data?.success) setPaletesHoje(r.data.registros || []);
        }).catch(() => {});
    };

    // Carga inicial
    fetchDocas(); fetchOcorrencias(); fetchPaletes();

    // Atualizar via socket em vez de polling
    const handleDocas = () => { if (!unmounted) fetchDocas(); };
    const handleOcorrencias = () => { if (!unmounted) fetchOcorrencias(); };
    const handlePaletes = () => { if (!unmounted) fetchPaletes(); };

    // socket global (importar de apiService ou receber via props)
    // VERIFICAR como DashboardTV acessa socket antes de implementar
    if (socket) {
        socket.on('docas_interditadas_update', handleDocas);
        socket.on('ocorrencias_update', handleOcorrencias);
        socket.on('saldo_paletes_update', handlePaletes);
    }

    return () => {
        unmounted = true;
        if (socket) {
            socket.off('docas_interditadas_update', handleDocas);
            socket.off('ocorrencias_update', handleOcorrencias);
            socket.off('saldo_paletes_update', handlePaletes);
        }
    };
}, [socket]);
```

- [x] **Step 6: Commit**

```bash
git add server.js src/components/DashboardTV.js
git commit -m "perf: DashboardTV substitui polling 10s por eventos socket para docas/ocorrencias/paletes"
```

---

## Task 8: Build, deploy e push final

- [x] **Step 1: Build React**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1"
```

Esperado: `The build folder is ready to be deployed.`

- [x] **Step 2: Reiniciar PM2**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env"
```

- [x] **Step 3: Push**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git push"
```
