# Programação Diária v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar split por unidade (Recife/Moreno) nos snapshots da programação diária, corrigir o critério de reprogramado para usar `data_prevista`, adicionar confirmação extra no "Finalizar Operação" para veículos com status misto, e criar um componente de relatório imprimível (tema claro) para exportar PDF.

**Architecture:** Backend atualiza `gerarProgramacaoDiaria` para gravar `reprogramado_recife`/`reprogramado_moreno` e a rota de finalizar operação passa a detectar conflitos de status misto antes de avançar veículos. Frontend adiciona detecção de formato novo/legado, renderiza tabelas com split de unidade, e um novo componente `RelatorioImpressao` fornece o HTML de tema claro capturado pelo html2pdf.

**Tech Stack:** Node.js/Express (server.js + src/routes/veiculos.js), React 18 (src/components/), html2pdf.js, Recharts, PM2 no WSL Ubuntu.

**Spec:** `docs/superpowers/specs/2026-03-19-programacao-diaria-v2-design.md`

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server.js` | Modificar | Função `gerarProgramacaoDiaria` — novo formato JSON |
| `src/routes/veiculos.js` | Modificar | Rota `POST /veiculos/finalizar-operacao` — detecção de mistos |
| `src/components/PainelOperacional.js` | Modificar | Segundo modal de confirmação para status misto |
| `src/components/PainelProgramacao.js` | Modificar | Tabela split, rodapé split, gráfico 2, integração PDF |
| `src/components/RelatorioImpressao.js` | Criar | Componente de relatório tema claro para PDF |

---

## Task 1: Backend — `gerarProgramacaoDiaria` com split por unidade

**Files:**
- Modify: `server.js` (função `gerarProgramacaoDiaria`, ~linha 1738)

### Contexto
A função atual usa `data_criacao` para decidir se um veículo é reprogramado e grava um único campo `reprogramado` por operação. Precisa usar `data_prevista` (com fallback para `data_criacao`) e gravar `reprogramado_recife`/`reprogramado_moreno` separados.

- [ ] **Step 1: Localizar e ler a função atual**

Leia `server.js` linhas 1738–1790 para confirmar o contexto antes de editar.

- [ ] **Step 2: Atualizar a query SQL — adicionar `data_prevista`**

Localize:
```js
SELECT id, unidade, operacao, data_criacao, status_recife, status_moreno,
       coletaRecife, coletaMoreno
FROM veiculos
```
Substitua por:
```js
SELECT id, unidade, operacao, data_criacao, data_prevista, status_recife, status_moreno,
       coletaRecife, coletaMoreno
FROM veiculos
```

- [ ] **Step 3: Atualizar a inicialização de `totais` — remover `reprogramado`, adicionar campos split**

Localize o bloco:
```js
const totais = {
    Delta: { recife: 0, moreno: 0, reprogramado: 0 },
    Porcelana: { recife: 0, moreno: 0, reprogramado: 0 },
    Eletrik: { recife: 0, moreno: 0, reprogramado: 0 },
    Consolidados: { recife: 0, moreno: 0, reprogramado: 0 }
};
```
Substitua por:
```js
const totais = {
    Delta:        { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
    Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
    Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
    Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
};
```

- [ ] **Step 4: Atualizar a lógica de classificação — usar `data_prevista` e campos split**

Localize o bloco `rows.forEach(v => {` e substitua o corpo inteiro:

```js
rows.forEach(v => {
    let cliente = 'Consolidados';
    const op = (v.operacao || '').toUpperCase();
    if (op.includes('DELTA')) cliente = 'Delta';
    else if (op.includes('PORCELANA')) cliente = 'Porcelana';
    else if (op.includes('ELETRIK')) cliente = 'Eletrik';

    const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';

    // Usar data_prevista como referência; fallback para data_criacao
    const dataRef = ((v.data_prevista || v.data_criacao) || '').substring(0, 10);

    if (dataRef && dataRef < hojeStr) {
        // Reprogramado: veículo previsto para antes de hoje ainda em aberto
        if (un === 'moreno') {
            totais[cliente].reprogramado_moreno += 1;
        } else {
            totais[cliente].reprogramado_recife += 1;
        }
    } else {
        // Lançado hoje (ou sem data)
        totais[cliente][un] += 1;
    }
});
```

- [ ] **Step 5: Verificar que o restante da função (INSERT + notificação) não precisa de alteração**

As linhas após o `forEach` (INSERT no BD e `enviarNotificacao`) não mudam — o `dados_json` já recebe o novo objeto `totais`.

- [ ] **Step 6: Reiniciar o servidor e verificar o log**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 20 --nostream"
```

Esperado: sem erros de sintaxe, servidor rodando na porta 3001.

- [ ] **Step 7: Verificar sintaxe do arquivo sem executar**

```bash
wsl -d Ubuntu -- bash -c "node --check /home/transnet/projects/transnet-operacional-v2/server.js && echo 'Sintaxe OK'"
```

Esperado: `Sintaxe OK` (sem erros de parse).

- [ ] **Step 8: Commit**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add server.js && git commit -m 'feat: programacao diaria usa data_prevista e split reprogramado por unidade'"
```

---

## Task 2: Backend — Finalizar Operação com detecção de status misto

**Files:**
- Modify: `src/routes/veiculos.js` (rota `POST /veiculos/finalizar-operacao`, ~linha 914)

### Contexto
A rota atual avança `data_prevista` sem checar se a outra unidade do veículo ainda está em andamento. A nova lógica: na primeira chamada (sem `confirmarMisto`), detecta veículos mistos e retorna `requerConfirmacao: true` com a contagem. Na segunda chamada (com `confirmarMisto: true`), avança tudo.

- [ ] **Step 1: Ler a rota atual completa**

Leia `src/routes/veiculos.js` linhas 912–964 para confirmar o contexto.

- [ ] **Step 2: Adicionar extração de `confirmarMisto` do body e definir statuses do outro lado**

Localize:
```js
const { unidade } = req.body; // 'Recife' ou 'Moreno'
```
Substitua por:
```js
const { unidade, confirmarMisto } = req.body; // 'Recife' ou 'Moreno'
```

- [ ] **Step 3: Inserir a checagem de mistos antes do UPDATE — logo após a definição de `statusParaAvancar`**

Após a linha `const statusParaAvancar = [...]`, insira:

> **Banco confirmado: PostgreSQL.** O projeto usa `pg` com conversão automática de `?` para `$1`, `$2`... via `convertSql` em `src/database/db.js`. Use `STRING_AGG` (sintaxe PostgreSQL).

```js
// Se não confirmou mistos, verificar conflitos antes de avançar
if (!confirmarMisto) {
    const campoStatusOutro = unidade === 'Recife' ? 'status_moreno' : 'status_recife';
    // statusNaoFinalizados: mesmos statuses elegíveis para avanço — veículos ainda em andamento na outra unidade
    const statusNaoFinalizados = ['AGUARDANDO', 'EM SEPARAÇÃO', 'LIBERADO P/ DOCA', 'EM CARREGAMENTO'];

    // Parâmetros na ordem: $1..$4 = statusParaAvancar (4 itens), $5 = amanhaStr, $6..$9 = statusNaoFinalizados (4 itens)
    const conflitosQuery = `
        SELECT COUNT(*) as total,
               STRING_AGG(COALESCE(operacao, 'Sem operação'), ', ') as operacoes
        FROM veiculos
        WHERE ${campoStatus} IN (${statusParaAvancar.map(() => '?').join(',')})
          AND data_prevista < ?
          AND ${campoStatusOutro} IN (${statusNaoFinalizados.map(() => '?').join(',')})
    `;
    const conflitosResult = await dbGet(conflitosQuery, [
        ...statusParaAvancar,   // $1–$4
        amanhaStr,              // $5
        ...statusNaoFinalizados // $6–$9
    ]);

    if (conflitosResult && parseInt(conflitosResult.total) > 0) {
        return res.json({
            success: true,
            requerConfirmacao: true,
            conflitos: parseInt(conflitosResult.total),
            detalhes: conflitosResult.operacoes ? conflitosResult.operacoes.split(', ') : []
        });
    }
}
```

- [ ] **Step 4: Reiniciar e verificar sintaxe**

```bash
wsl -d Ubuntu -- bash -c "node --check /home/transnet/projects/transnet-operacional-v2/src/routes/veiculos.js && echo 'Sintaxe OK' && cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 10 --nostream"
```

Esperado: `Sintaxe OK` + servidor subindo sem erros.

- [ ] **Step 5: Commit**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/routes/veiculos.js && git commit -m 'feat: finalizar-operacao detecta status misto e requer confirmacao extra'"
```

---

## Task 3: Frontend — PainelOperacional.js — segundo modal para status misto

**Files:**
- Modify: `src/components/PainelOperacional.js` (~linhas 132–133 e 1280–1303)

### Contexto
Quando a API retorna `requerConfirmacao: true`, o frontend precisa exibir um segundo modal explicando quantos veículos estão em conflito e pedindo confirmação antes de chamar a API com `confirmarMisto: true`.

- [ ] **Step 1: Adicionar estado `confirmarMisto` junto aos outros estados locais**

Localize:
```js
const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
const [finalizando, setFinalizando] = useState(false);
```
Substitua por:
```js
const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
const [confirmarMisto, setConfirmarMisto] = useState(null); // { conflitos: N, detalhes: [] }
const [finalizando, setFinalizando] = useState(false);
```

- [ ] **Step 2: Atualizar o handler `onConfirm` do modal primário para tratar `requerConfirmacao`**

Localize o bloco `onConfirm={async () => {` do modal de confirmação de Finalizar (dentro do `{confirmarFinalizar && (`). O corpo atual é:
```js
if (finalizando) return;
setFinalizando(true);
try {
    const r = await api.post('/veiculos/finalizar-operacao', { unidade: origem });
    mostrarNotificacao?.(`✅ ${r.data.message}`);
    setConfirmarFinalizar(false);
} catch (err) {
    const msg = err.response?.data?.message || 'Erro ao finalizar operação.';
    mostrarNotificacao?.(`⚠️ ${msg}`);
} finally {
    setFinalizando(false);
}
```

Substitua por:
```js
if (finalizando) return;
setFinalizando(true);
try {
    const r = await api.post('/veiculos/finalizar-operacao', { unidade: origem });
    if (r.data.requerConfirmacao) {
        setConfirmarFinalizar(false);
        setConfirmarMisto({ conflitos: r.data.conflitos, detalhes: r.data.detalhes || [] });
    } else {
        mostrarNotificacao?.(`✅ ${r.data.message}`);
        setConfirmarFinalizar(false);
    }
} catch (err) {
    const msg = err.response?.data?.message || 'Erro ao finalizar operação.';
    mostrarNotificacao?.(`⚠️ ${msg}`);
} finally {
    setFinalizando(false);
}
```

- [ ] **Step 3: Adicionar o segundo modal logo após o modal de Finalizar existente**

Localize a linha:
```js
{/* Modal Pausar/Retomar Unidade */}
```
Logo **antes** dela, adicione:

```jsx
{/* Modal de Confirmação — Status Misto */}
{confirmarMisto && (
    <ModalConfirm
        titulo={`Atenção — Veículos em Andamento (${origem})`}
        mensagem={`${confirmarMisto.conflitos} veículo(s) ainda estão em processamento na outra unidade. Avançar irá reprogramá-los para o próximo dia útil. Deseja continuar mesmo assim?`}
        textConfirm={finalizando ? 'Aguarde...' : 'Avançar mesmo assim'}
        textCancel="Cancelar"
        variante="perigo"
        onConfirm={async () => {
            if (finalizando) return;
            setFinalizando(true);
            try {
                const r = await api.post('/veiculos/finalizar-operacao', { unidade: origem, confirmarMisto: true });
                mostrarNotificacao?.(`✅ ${r.data.message}`);
                setConfirmarMisto(null);
            } catch (err) {
                const msg = err.response?.data?.message || 'Erro ao finalizar operação.';
                mostrarNotificacao?.(`⚠️ ${msg}`);
            } finally {
                setFinalizando(false);
            }
        }}
        onCancel={() => { if (!finalizando) setConfirmarMisto(null); }}
    />
)}
```

- [ ] **Step 4: Build e verificar no browser**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20"
```

Esperado: `Compiled successfully` sem erros. Verificar no browser que o modal de Finalizar ainda funciona normalmente.

- [ ] **Step 5: Commit**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/components/PainelOperacional.js && git commit -m 'feat: segundo modal confirmacao para veiculos em status misto no finalizar operacao'"
```

---

## Task 4: Frontend — PainelProgramacao.js — tabela split e gráfico corrigido

**Files:**
- Modify: `src/components/PainelProgramacao.js`

### Contexto
A tabela atual mostra QUANTIDADE (soma) e REPROGRAMADOS (número único). Com novo formato, mostrar split Recife/Moreno em ambas as colunas e no rodapé. Corrigir o gráfico 2 para ler os novos campos. Remover badge de unidade ao lado do nome da operação.

- [ ] **Step 1: Ler o arquivo completo para ter o contexto antes de editar**

Leia `src/components/PainelProgramacao.js` completo (já lido no início da sessão de brainstorming — confirme se não há alterações).

- [ ] **Step 2: Adicionar helper `isNovoFormato` e helper de renderização de valor split**

Após as constantes no topo do arquivo (após `CORES_OPERACAO`), adicione:

```js
const isNovoFormato = (dados) =>
    Object.values(dados).some(d => d.reprogramado_recife !== undefined);

const renderSplit = (recife, moreno, corRecife = '#38bdf8', corMoreno = '#fbbf24') => {
    if (recife === 0 && moreno === 0) return <span style={{ color: '#475569' }}>—</span>;
    if (recife === 0) return <span style={{ color: corMoreno }}>Moreno: {moreno}</span>;
    if (moreno === 0) return <span style={{ color: corRecife }}>Recife: {recife}</span>;
    return (
        <span>
            <span style={{ color: corRecife }}>Recife: {recife}</span>
            <span style={{ color: '#475569', margin: '0 4px' }}>/</span>
            <span style={{ color: corMoreno }}>Moreno: {moreno}</span>
        </span>
    );
};
```

- [ ] **Step 3: Atualizar o cálculo dos totais dentro do `.map(prog =>` para incluir split**

> **Escopo:** Todo este bloco e as referências a `novoFmt` nos passos seguintes (4, 6, 7) estão **dentro do callback `.map(prog => { ... })`** que começa por volta da linha 137. Não edite fora desse callback.

Localize o bloco que calcula `totalRecife`, `totalMoreno`, `totalRepro`, `totalRecifeRepro`, `totalMorenoRepro` e substitua por:

```js
let totalRecife = 0, totalMoreno = 0;
let totalReproRecife = 0, totalReproMoreno = 0;
// legado — mantidos para o Gráfico 2 no formato antigo
let totalRepro = 0, totalRecifeRepro = 0, totalMorenoRepro = 0;

const novoFmt = isNovoFormato(dados);

OPERACOES.forEach(op => {
    const d = dados[op] || {};
    totalRecife += d.recife || 0;
    totalMoreno += d.moreno || 0;
    if (novoFmt) {
        totalReproRecife += d.reprogramado_recife || 0;
        totalReproMoreno += d.reprogramado_moreno || 0;
    } else {
        totalRepro += d.reprogramado || 0;
        if (UNIDADE_RECIFE.includes(op)) totalRecifeRepro += d.reprogramado || 0;
        else totalMorenoRepro += d.reprogramado || 0;
    }
});

- [ ] **Step 4: Atualizar os dados do Gráfico 2 para usar campos split no novo formato**

Localize:
```js
// Dados gráfico 2: Reprogramados por Unidade
const dadosGrafico2 = [
    { name: 'Recife', value: totalRecifeRepro },
    { name: 'Moreno', value: totalMorenoRepro },
].filter(i => i.value > 0);
```
Substitua por:
```js
// Dados gráfico 2: Reprogramados por Unidade
const dadosGrafico2 = novoFmt
    ? [
        { name: 'Recife', value: totalReproRecife },
        { name: 'Moreno', value: totalReproMoreno },
      ].filter(i => i.value > 0)
    : [
        { name: 'Recife', value: totalRecifeRepro },
        { name: 'Moreno', value: totalMorenoRepro },
      ].filter(i => i.value > 0);
```

- [ ] **Step 5: Atualizar o cabeçalho da tabela — remover "(D-1)" do título REPROGRAMADOS**

Localize:
```jsx
<th style={{ padding: '12px 20px', color: '#f43f5e', fontWeight: 'bold', textAlign: 'center' }}>REPROGRAMADOS (D-1)</th>
```
Substitua por:
```jsx
<th style={{ padding: '12px 20px', color: '#f43f5e', fontWeight: 'bold', textAlign: 'center' }}>REPROGRAMADOS</th>
```

- [ ] **Step 6: Atualizar as linhas de operação — remover badge de unidade e mostrar split**

Localize o bloco `<tr key={op}` completo dentro do `tbody`. Substitua as células de QUANTIDADE e REPROGRAMADOS:

Célula QUANTIDADE (localize `{(d.recife || 0) + (d.moreno || 0)}`):
```jsx
<td style={{ padding: '12px 20px', textAlign: 'center', color: '#e2e8f0' }}>
    {novoFmt
        ? renderSplit(d.recife || 0, d.moreno || 0)
        : (d.recife || 0) + (d.moreno || 0)
    }
</td>
```

Célula REPROGRAMADOS (localize `{d.reprogramado || 0}`):
```jsx
<td style={{ padding: '12px 20px', textAlign: 'center', color: (d.reprogramado || d.reprogramado_recife || d.reprogramado_moreno || 0) > 0 ? '#fca5a5' : '#64748b' }}>
    {novoFmt
        ? renderSplit(d.reprogramado_recife || 0, d.reprogramado_moreno || 0, '#fca5a5', '#fca5a5')
        : (d.reprogramado || 0)
    }
</td>
```

No mesmo `<tr key={op}`, localize o badge de unidade:
```jsx
<span style={{
    fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
    background: unidade === 'Recife' ? 'rgba(56,189,248,0.1)' : 'rgba(251,191,36,0.1)',
    color: unidade === 'Recife' ? '#38bdf8' : '#fbbf24',
    border: `1px solid ${unidade === 'Recife' ? 'rgba(56,189,248,0.2)' : 'rgba(251,191,36,0.2)'}`
}}>{unidade}</span>
```
**Remova esse bloco inteiro** (apenas o `<span>` do badge — manter o `<span>` do bullet colorido e o `<span>` do nome da operação).

- [ ] **Step 7: Atualizar o rodapé (tfoot) com split**

Localize as duas células do rodapé (`TOTAL GERAL`) e substitua:

```jsx
<td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>
    {novoFmt
        ? renderSplit(totalRecife, totalMoreno)
        : totalRecife + totalMoreno
    }
</td>
<td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: '#f43f5e' }}>
    {novoFmt
        ? renderSplit(totalReproRecife, totalReproMoreno, '#fca5a5', '#fca5a5')
        : totalRepro
    }
</td>
```

- [ ] **Step 8: Build e verificar**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20"
```

Esperado: `Compiled successfully`. Abrir o painel Programação no browser e confirmar:
- Snapshots antigos exibem formato único (sem split)
- Snapshots novos (depois do próximo cron ou disparado manualmente) exibem split
- Gráficos funcionam sem erro
- Badge de unidade sumiu das linhas de operação
- Coluna chama só "REPROGRAMADOS"

- [ ] **Step 9: Commit**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/components/PainelProgramacao.js && git commit -m 'feat: tabela programacao com split recife/moreno, remove badge unidade, corrige grafico reprogramados'"
```

---

## Task 5: Novo componente `RelatorioImpressao.js`

**Files:**
- Create: `src/components/RelatorioImpressao.js`

### Contexto
Componente puro de apresentação (sem estado, sem API calls). Recebe `programacoes` (array filtrado) e `periodo` (dataInicio, dataFim) como props. Renderiza HTML com tema claro: cabeçalho formal, resumo executivo, tabelas por snapshot.

- [ ] **Step 1: Criar o arquivo**

Criar `src/components/RelatorioImpressao.js` com o seguinte conteúdo:

```jsx
import React from 'react';

// Array local — não importar de constants para manter o componente autocontido
const OPERACOES_REL = ['Delta', 'Porcelana', 'Eletrik', 'Consolidados'];

const isNovoFormato = (dados) =>
    Object.values(dados).some(d => d.reprogramado_recife !== undefined);

const formatData = (dStr) => {
    if (!dStr) return '';
    const [a, m, d] = dStr.split('-');
    return `${d}/${m}/${a}`;
};

const estiloTabela = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    marginTop: '8px',
};

const estiloTh = {
    padding: '8px 12px',
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
};

const estiloThLeft = { ...estiloTh, textAlign: 'left' };

const estiloTd = {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    textAlign: 'center',
};

const estiloTdLeft = { ...estiloTd, textAlign: 'left' };

const renderSplitPrint = (recife, moreno, corRecife = '#0369a1', corMoreno = '#b45309') => {
    if (recife === 0 && moreno === 0) return '—';
    if (recife === 0) return <span style={{ color: corMoreno }}>Moreno: {moreno}</span>;
    if (moreno === 0) return <span style={{ color: corRecife }}>Recife: {recife}</span>;
    return (
        <span>
            <span style={{ color: corRecife }}>Recife: {recife}</span>
            <span style={{ color: '#94a3b8', margin: '0 3px' }}>/</span>
            <span style={{ color: corMoreno }}>Moreno: {moreno}</span>
        </span>
    );
};

export default function RelatorioImpressao({ programacoes, dataInicio, dataFim }) {
    const agora = new Date();
    const geradoEm = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // Calcular resumo executivo
    let resumoLancadosR = 0, resumoLancadosM = 0;
    let resumoReproR = 0, resumoReproM = 0;
    let resumoLancadosLegado = 0, resumoReproLegado = 0;
    let temLegado = false, temNovo = false;

    programacoes.forEach(prog => {
        const dados = prog.dados_json || {};
        const novoFmt = isNovoFormato(dados);
        if (novoFmt) temNovo = true; else temLegado = true;

        OPERACOES_REL.forEach(op => {
            const d = dados[op] || {};
            if (novoFmt) {
                resumoLancadosR += d.recife || 0;
                resumoLancadosM += d.moreno || 0;
                resumoReproR += d.reprogramado_recife || 0;
                resumoReproM += d.reprogramado_moreno || 0;
            } else {
                resumoLancadosLegado += (d.recife || 0) + (d.moreno || 0);
                resumoReproLegado += d.reprogramado || 0;
            }
        });
    });

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', background: '#ffffff', padding: '20px 28px', fontSize: '13px' }}>

            {/* Cabeçalho */}
            <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
                <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Programação Diária de Carregamento
                </h1>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                    <span>
                        Período: <strong style={{ color: '#1e293b' }}>{formatData(dataInicio)}</strong>
                        {dataInicio !== dataFim && <> a <strong style={{ color: '#1e293b' }}>{formatData(dataFim)}</strong></>}
                    </span>
                    <span>Gerado em: <strong style={{ color: '#1e293b' }}>{geradoEm}</strong></span>
                </div>
            </div>

            {/* Resumo Executivo */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                    Resumo Executivo
                </h2>
                {temNovo && (
                    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Total Lançados </span>
                            <span style={{ color: '#0369a1', fontWeight: '700' }}>Recife: {resumoLancadosR}</span>
                            <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#b45309', fontWeight: '700' }}>Moreno: {resumoLancadosM}</span>
                            <span style={{ color: '#64748b', fontWeight: '700' }}> = {resumoLancadosR + resumoLancadosM}</span>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>Total Reprogramados </span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>Recife: {resumoReproR}</span>
                            <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>Moreno: {resumoReproM}</span>
                            <span style={{ color: '#dc2626', fontWeight: '700' }}> = {resumoReproR + resumoReproM}</span>
                        </div>
                    </div>
                )}
                {temLegado && (
                    <div style={{ marginTop: temNovo ? '6px' : 0, fontSize: '11px', color: '#64748b' }}>
                        Snapshots legados — Lançados: <strong>{resumoLancadosLegado}</strong> | Reprogramados: <strong style={{ color: '#dc2626' }}>{resumoReproLegado}</strong>
                    </div>
                )}
            </div>

            {/* Snapshots */}
            {programacoes.map(prog => {
                const dados = prog.dados_json || {};
                const novoFmt = isNovoFormato(dados);

                let totLancR = 0, totLancM = 0, totReproR = 0, totReproM = 0, totRepro = 0;

                return (
                    <div key={prog.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                        <div style={{ background: '#1e293b', color: '#f8fafc', padding: '6px 12px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <strong>{formatData(prog.data_referencia)} — Turno {prog.turno}</strong>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>Snapshot Automático</span>
                        </div>
                        <table style={estiloTabela}>
                            <thead>
                                <tr>
                                    <th style={estiloThLeft}>Operação</th>
                                    <th style={estiloTh}>Quantidade</th>
                                    <th style={{ ...estiloTh, color: '#dc2626' }}>Reprogramados</th>
                                </tr>
                            </thead>
                            <tbody>
                                {OPERACOES_REL.map(op => {
                                    const d = dados[op] || {};
                                    const lanc_r = d.recife || 0;
                                    const lanc_m = d.moreno || 0;
                                    const repro_r = d.reprogramado_recife || 0;
                                    const repro_m = d.reprogramado_moreno || 0;
                                    const repro_leg = d.reprogramado || 0;
                                    totLancR += lanc_r; totLancM += lanc_m;
                                    if (novoFmt) { totReproR += repro_r; totReproM += repro_m; }
                                    else totRepro += repro_leg;
                                    return (
                                        <tr key={op} style={{ background: op === OPERACOES_REL[OPERACOES_REL.length - 1] ? 'transparent' : 'transparent' }}>
                                            <td style={estiloTdLeft}><strong>{op}</strong></td>
                                            <td style={estiloTd}>
                                                {novoFmt ? renderSplitPrint(lanc_r, lanc_m) : lanc_r + lanc_m}
                                            </td>
                                            <td style={{ ...estiloTd, color: (novoFmt ? repro_r + repro_m : repro_leg) > 0 ? '#dc2626' : '#94a3b8' }}>
                                                {novoFmt ? renderSplitPrint(repro_r, repro_m, '#dc2626', '#dc2626') : repro_leg}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
                                    <td style={estiloTdLeft}>TOTAL GERAL</td>
                                    <td style={estiloTd}>
                                        {novoFmt ? renderSplitPrint(totLancR, totLancM) : totLancR + totLancM}
                                    </td>
                                    <td style={{ ...estiloTd, color: '#dc2626' }}>
                                        {novoFmt ? renderSplitPrint(totReproR, totReproM, '#dc2626', '#dc2626') : totRepro}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Verificar se `OPERACOES` é exportado de `constants.js` ou definir localmente**

```bash
wsl -d Ubuntu -- bash -c "grep -n 'OPERACOES' /home/transnet/projects/transnet-operacional-v2/src/constants.js"
```

Se não existir, manter o array `OPERACOES_REL` definido diretamente no componente (como no código acima). Se existir e for compatível, pode importar — mas manter local é mais seguro e mantém o componente autocontido.

- [ ] **Step 3: Verificar build**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20"
```

Esperado: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/components/RelatorioImpressao.js && git commit -m 'feat: componente RelatorioImpressao tema claro para exportacao PDF'"
```

---

## Task 6: Integração — PainelProgramacao.js conecta RelatorioImpressao ao PDF

**Files:**
- Modify: `src/components/PainelProgramacao.js`

### Contexto
Substituir o alvo do html2pdf da div escura atual pelo componente `RelatorioImpressao` renderizado em div oculta. Importar o componente e injetar no JSX.

- [ ] **Step 1: Importar RelatorioImpressao no topo de PainelProgramacao.js**

Localize a linha de imports e adicione:
```js
import RelatorioImpressao from './RelatorioImpressao';
```

- [ ] **Step 2: Atualizar `handleExportPDF` para capturar o componente de impressão**

Localize:
```js
const handleExportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const elemento = document.getElementById('relatorio-programacao');
    if (!elemento) return;
    html2pdf().set({
        margin: 10,
        filename: `Programacao_Diaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(elemento).save();
};
```
Substitua por:
```js
const handleExportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const elemento = document.getElementById('relatorio-impressao-print');
    if (!elemento) return;
    html2pdf().set({
        margin: 10,
        filename: `Programacao_Diaria_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(elemento).save();
};
```

- [ ] **Step 3: Adicionar a div oculta com RelatorioImpressao no JSX**

Localize o último `</div>` do componente — o que fecha o `<div style={{ padding: '20px 25px', height: 'calc(100vh - 124px)'...` que abre na linha 68. O anchor exato é:

```jsx
        </div>
    );
}
```

(o `</div>` que precede o `);` que fecha o `return`, seguido do `}` que fecha a função). Insira o bloco **antes** desse último `</div>`:

```jsx
{/* Componente oculto para exportação PDF */}
<div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1100px' }}>
    <div id="relatorio-impressao-print">
        <RelatorioImpressao
            programacoes={programacoesFiltradas}
            dataInicio={dataInicio}
            dataFim={dataFim}
        />
    </div>
</div>
```

- [ ] **Step 4: Build e testar exportação PDF**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -20"
```

Após o build, abrir o Painel Programação no browser, clicar "Exportar PDF" e verificar:
- PDF gerado com fundo branco
- Cabeçalho com título e data de geração
- Resumo executivo visível
- Tabelas legíveis com bordas e texto escuro
- Split Recife/Moreno aparece nos snapshots novos

- [ ] **Step 5: Reiniciar PM2 para servir o novo build**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env"
```

- [ ] **Step 6: Commit final**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/components/PainelProgramacao.js && git commit -m 'feat: exportacao PDF usa RelatorioImpressao tema claro'"
```

---

## Verificação Final

- [ ] Disparar snapshot manual para gerar um registro novo e confirmar o formato:

```bash
# Acessa o REPL do Node com as variáveis do servidor já carregadas
# Alternativa: adicionar temporariamente uma rota de teste protegida por authMiddleware
# Opção mais simples — chamar direto via Node (servidor deve estar parado primeiro):
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 stop transnet && node -e \"
  process.env.NODE_ENV='production';
  // Importar e chamar a função diretamente
  // Como gerarProgramacaoDiaria não é exportada, adicione temporariamente ao final de server.js:
  // module.exports = { gerarProgramacaoDiaria };
  // Então chame: require('./server').gerarProgramacaoDiaria('teste');
  // Ou use a opção abaixo para verificar o último registro no BD após o próximo cron
  console.log('Use psql para verificar: SELECT dados_json FROM frota_programacao_diaria ORDER BY id DESC LIMIT 1;');
\" && pm2 start transnet"
```

Maneira mais prática: aguardar o próximo cron (10h ou 17h) ou verificar diretamente no BD:

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && node -e \"
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://localhost/transnet' });
pool.query('SELECT id, turno, data_referencia, dados_json FROM frota_programacao_diaria ORDER BY id DESC LIMIT 1')
  .then(r => { console.log(JSON.stringify(JSON.parse(r.rows[0].dados_json), null, 2)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
\""
```

Esperado: objeto com `reprogramado_recife` e `reprogramado_moreno` por operação (se já rodou o cron após a Task 1).

- [ ] Confirmar que `dados_json` contém `reprogramado_recife`/`reprogramado_moreno` no snapshot mais recente
- [ ] Painel Programação exibe split correto no novo snapshot
- [ ] Snapshots antigos ainda exibem formato legado sem erros
- [ ] Botão Finalizar Operação: se há mistos → aparece segundo modal; se não há → avança diretamente
- [ ] PDF exportado tem fundo branco e é legível
- [ ] Push para o repositório remoto:

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git push"
```
