# Importação de Lotes v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o upsert de reimportação (rota/obs/data não persistiam), implementar ROTA NOVA passo a passo com input por coleta, e detectar coletas que sumiram do novo arquivo com prompt de exclusão ou reprogramação.

**Architecture:** Abordagem cirúrgica sem novos arquivos. Backend: expandir o bloco de upsert no `POST /veiculos` para incluir rota/obs/data e emitir socket. Frontend: adicionar estados de máquina ao `ModalImportacaoLotes.js` seguindo o padrão já existente de `eletrikPendente`/`rotaNovaPendente`.

**Tech Stack:** Node.js/Express + SQLite (better-sqlite3/dbGet/dbRun), React 18, socket.io

---

## Mapa de arquivos

| Arquivo | O que muda |
|---------|-----------|
| `src/routes/veiculos.js` | Bloco upsert no `router.post('/')` ~L274–314: SELECT expandido, novos mudou*, UPDATE expandido, socket emit |
| `src/components/ModalImportacaoLotes.js` | +6 estados, renomear `avancarParaPasso2` → `avancarParaRotaNova`, nova função `detectarSumidas`, overlay rotaNovaAtual, overlay coletasSumidas + sub-overlay reprogramar, atualizar `fechar()` |

---

## Task 1: Backend — Upsert ampliado + socket

**Files:**
- Modify: `src/routes/veiculos.js:274–314`

### Contexto rápido

O bloco começa com:
```js
for (const tag of [...tagsRec, ...tagsMor, ...tagsInt]) {
    const existente = await dbGet(
        `SELECT id, motorista, placa, modelo, dados_json FROM veiculos ...`,
        ...
    );
    if (existente) { ... UPDATE ... }
}
```

O SELECT não busca `rota_recife`, `rota_moreno`, `observacao`, `data_prevista`, então o UPDATE nunca os escreve.

---

- [ ] **Step 1: Expandir o SELECT para incluir os novos campos**

Em `src/routes/veiculos.js`, localizar (L274–280):

```js
const existente = await dbGet(
    `SELECT id, motorista, placa, modelo, dados_json FROM veiculos
     WHERE (coletaRecife LIKE ? OR coletaMoreno LIKE ? OR coletainterestadual LIKE ?)
       AND (status_recife IS NULL OR status_recife NOT IN (${placeholders}))
       AND (status_moreno IS NULL OR status_moreno NOT IN (${placeholders}))
     LIMIT 1`,
    [`%${tag}%`, `%${tag}%`, `%${tag}%`, ...STATUS_FINAIS, ...STATUS_FINAIS]
);
```

Substituir por:

```js
const existente = await dbGet(
    `SELECT id, motorista, placa, modelo, dados_json,
            rota_recife, rota_moreno, observacao, data_prevista FROM veiculos
     WHERE (coletaRecife LIKE ? OR coletaMoreno LIKE ? OR coletainterestadual LIKE ?)
       AND (status_recife IS NULL OR status_recife NOT IN (${placeholders}))
       AND (status_moreno IS NULL OR status_moreno NOT IN (${placeholders}))
     LIMIT 1`,
    [`%${tag}%`, `%${tag}%`, `%${tag}%`, ...STATUS_FINAIS, ...STATUS_FINAIS]
);
```

- [ ] **Step 2: Adicionar detecção de mudança para os novos campos**

Logo após o bloco que declara `mudouModelo` (L292), adicionar:

```js
const novaRotaRecife  = v.rotaRecife  || v.rota_recife  || '';
const novaRotaMoreno  = v.rotaMoreno  || v.rota_moreno  || '';
const novaObs         = v.observacao  || '';
const novaData        = v.data_prevista || '';

const mudouRotaRecife = novaRotaRecife.trim() !== '' && novaRotaRecife !== (existente.rota_recife || '');
const mudouRotaMoreno = novaRotaMoreno.trim() !== '' && novaRotaMoreno !== (existente.rota_moreno || '');
const mudouObs        = novaObs.trim() !== '' && novaObs !== (existente.observacao || '');
const mudouData       = novaData.trim() !== '' && novaData !== (existente.data_prevista || '');
```

- [ ] **Step 3: Expandir a condição de disparo do UPDATE**

Localizar (L294):
```js
if (mudouMotorista || mudouPlaca1 || mudouPlaca2 || mudouModelo) {
```

Substituir por:
```js
if (mudouMotorista || mudouPlaca1 || mudouPlaca2 || mudouModelo ||
    mudouRotaRecife || mudouRotaMoreno || mudouObs || mudouData) {
```

- [ ] **Step 4: Atualizar o dados_json para incluir os novos campos**

Dentro do `if`, após o bloco que popula `djNovo` (L295–299), adicionar:

```js
if (mudouRotaRecife) djNovo.rotaRecife = novaRotaRecife;
if (mudouRotaMoreno) djNovo.rotaMoreno = novaRotaMoreno;
if (mudouObs)        djNovo.observacao  = novaObs;
if (mudouData)       djNovo.data_prevista = novaData;
```

- [ ] **Step 5: Expandir o UPDATE para escrever os novos campos**

Localizar o `dbRun` com o UPDATE (L300–310):

```js
await dbRun(
    `UPDATE veiculos SET
        motorista = COALESCE(NULLIF(?, ''), motorista),
        placa = COALESCE(NULLIF(?, ''), placa),
        modelo = COALESCE(NULLIF(?, ''), modelo),
        dados_json = ?,
        chk_cnh = 0, chk_antt = 0, chk_tacografo = 0, chk_crlv = 0,
        situacao_cadastro = 'NÃO CONFERIDO'
     WHERE id = ?`,
    [novoMotorista, novaPlaca1, novoModelo, JSON.stringify(djNovo), existente.id]
);
```

Substituir por:

```js
await dbRun(
    `UPDATE veiculos SET
        motorista     = COALESCE(NULLIF(?, ''), motorista),
        placa         = COALESCE(NULLIF(?, ''), placa),
        modelo        = COALESCE(NULLIF(?, ''), modelo),
        rota_recife   = COALESCE(NULLIF(?, ''), rota_recife),
        rota_moreno   = COALESCE(NULLIF(?, ''), rota_moreno),
        observacao    = COALESCE(NULLIF(?, ''), observacao),
        data_prevista = COALESCE(NULLIF(?, ''), data_prevista),
        dados_json    = ?,
        chk_cnh = 0, chk_antt = 0, chk_tacografo = 0, chk_crlv = 0,
        situacao_cadastro = 'NÃO CONFERIDO'
     WHERE id = ?`,
    [novoMotorista, novaPlaca1, novoModelo,
     novaRotaRecife, novaRotaMoreno, novaObs, novaData,
     JSON.stringify(djNovo), existente.id]
);
```

- [ ] **Step 6: Emitir socket após o UPDATE para o painel atualizar em tempo real**

Imediatamente após o `dbRun` (antes do `return res.json({ success: true, atualizado: true, ... })`), inserir:

```js
const veicAtualizado = await dbGet(`
    SELECT v.*,
           (SELECT m.telefone FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as telefone_bd,
           (SELECT m.is_frota FROM marcacoes_placas m WHERE m.nome_motorista = v.motorista AND m.nome_motorista != '' ORDER BY m.data_marcacao DESC LIMIT 1) as is_frota_bd
    FROM veiculos v WHERE v.id = ?
`, [existente.id]);
if (veicAtualizado) {
    const djAt = (() => { try { return JSON.parse(veicAtualizado.dados_json || '{}'); } catch { return {}; } })();
    io.emit('receber_atualizacao', {
        tipo: 'atualiza_veiculo',
        id: Number(existente.id),
        ...veicAtualizado,
        rotaRecife: veicAtualizado.rota_recife,
        rotaMoreno: veicAtualizado.rota_moreno,
        coletaRecife: veicAtualizado.coletarecife || '',
        coletaMoreno: veicAtualizado.coletamoreno || '',
        tempos_recife: (() => { try { return JSON.parse(veicAtualizado.tempos_recife || '{}'); } catch { return {}; } })(),
        tempos_moreno: (() => { try { return JSON.parse(veicAtualizado.tempos_moreno || '{}'); } catch { return {}; } })(),
        status_coleta: (() => { try { return JSON.parse(veicAtualizado.status_coleta || '{}'); } catch { return {}; } })(),
        imagens: (() => { try { return JSON.parse(veicAtualizado.imagens || '[]'); } catch { return []; } })(),
        timestamps_status: (() => { try { return JSON.parse(veicAtualizado.timestamps_status || '{}'); } catch { return {}; } })(),
        observacao: veicAtualizado.observacao || '',
        numero_coleta: veicAtualizado.numero_coleta || '',
        situacao_cadastro: veicAtualizado.situacao_cadastro || 'NÃO CONFERIDO',
        chk_cnh: veicAtualizado.chk_cnh ? 1 : 0,
        chk_antt: veicAtualizado.chk_antt ? 1 : 0,
        chk_tacografo: veicAtualizado.chk_tacografo ? 1 : 0,
        chk_crlv: veicAtualizado.chk_crlv ? 1 : 0,
        tipoVeiculo: djAt.tipoVeiculo || '',
        placa1Motorista: djAt.placa1Motorista || '',
        placa2Motorista: djAt.placa2Motorista || '',
        telefoneMotorista: djAt.telefoneMotorista || veicAtualizado.telefone_bd || '',
        isFrotaMotorista: veicAtualizado.is_frota_bd === 1 || false,
    });
}
```

- [ ] **Step 7: Testar manualmente**

1. Abra um card no PainelOperacional que tenha coleta ativa sem rota preenchida
2. Importe um arquivo com essa coleta + rota preenchida
3. Verifique no card do painel: campo "ROTA" deve aparecer imediatamente (via socket) sem recarregar
4. Verifique também: reimportar com mesmo motorista/rota retorna `duplicata: true` (sem alterar)

- [ ] **Step 8: Commit**

```bash
git add src/routes/veiculos.js
git commit -m "fix(veiculos): upsert ampliado — rota, obs, data_prevista + socket emit"
```

---

## Task 2: Frontend — ROTA NOVA passo a passo

**Files:**
- Modify: `src/components/ModalImportacaoLotes.js`

### Contexto rápido

O overlay `rotaNovaPendente` (L511–559) pergunta se existe rota para lotes com "ROTA NOVA" na observação. Ambos os botões chamam o mesmo código. O botão "Sim, tenho a rota" deve abrir um overlay por lote pedindo o número da rota, mostrando a coleta como referência.

---

- [ ] **Step 1: Adicionar os 3 novos estados de fila de rota nova**

Em `ModalImportacaoLotes`, após a declaração `const [rotaNovaPendente, setRotaNovaPendente] = useState(null);` (L268), adicionar:

```js
const [rotaNovaFila,  setRotaNovaFila]  = useState([]);
const [rotaNovaAtual, setRotaNovaAtual] = useState(null);
const [rotaNovaInput, setRotaNovaInput] = useState('');
```

- [ ] **Step 2: Adicionar a função `avancarRotaNova`**

Após a função `avancarParaPasso2` (L311–323), adicionar:

```js
const avancarRotaNova = useCallback(() => {
    setRotaNovaFila(prev => {
        if (prev.length > 0) {
            setRotaNovaAtual(prev[0]);
            setRotaNovaInput('');
            return prev.slice(1);
        }
        setRotaNovaAtual(null);
        setPasso(2);
        verificarDuplicatas(lotes);
        return [];
    });
}, [lotes, verificarDuplicatas]);
```

- [ ] **Step 3: Atualizar o botão "Sim, tenho a rota" no overlay `rotaNovaPendente`**

Localizar (L537–545) — botão "Sim, tenho a rota":

```jsx
<button
    onClick={() => { setRotaNovaPendente(null); setPasso(2); verificarDuplicatas(lotes); }}
    style={{ ... }}
>
    Sim, tenho a rota
</button>
```

Substituir o `onClick` por:

```js
onClick={() => {
    const fila = rotaNovaPendente || [];
    setRotaNovaPendente(null);
    if (fila.length > 0) {
        setRotaNovaAtual(fila[0]);
        setRotaNovaFila(fila.slice(1));
        setRotaNovaInput('');
    } else {
        setPasso(2);
        verificarDuplicatas(lotes);
    }
}}
```

- [ ] **Step 4: Adicionar o overlay `rotaNovaAtual` no JSX**

Logo após o overlay `eletrikPendente` (após L605), antes do bloco `{/* PASSO 1: Upload */}`, adicionar:

```jsx
{/* Overlay ROTA NOVA — passo a passo por lote */}
{rotaNovaAtual && (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
        background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
    }}>
        <MapPin size={36} color="#60a5fa" style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
            Qual a rota desta coleta?
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            {rotaNovaAtual.motorista || '—'} · <span style={{ fontFamily: 'monospace' }}>{rotaNovaAtual.placa1}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '20px', fontFamily: 'monospace' }}>
            Coleta: {rotaNovaAtual.coletaRecife || rotaNovaAtual.coletaMoreno || rotaNovaAtual.coletaInterestadual || '—'}
        </div>
        <input
            className="input-internal"
            placeholder="Nº da Rota"
            value={rotaNovaInput}
            onChange={e => setRotaNovaInput(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter' && rotaNovaInput.trim()) {
                    const ehRec = ehRecife(rotaNovaAtual.operacao);
                    atualizarLote(rotaNovaAtual._id, ehRec ? 'rotaRecife' : 'rotaMoreno', rotaNovaInput.trim());
                    avancarRotaNova();
                }
            }}
            style={{ width: '200px', textAlign: 'center', fontSize: '14px', marginBottom: '24px' }}
            autoFocus
        />
        <div style={{ display: 'flex', gap: '12px' }}>
            <button
                onClick={() => {
                    if (!rotaNovaInput.trim()) return;
                    const ehRec = ehRecife(rotaNovaAtual.operacao);
                    atualizarLote(rotaNovaAtual._id, ehRec ? 'rotaRecife' : 'rotaMoreno', rotaNovaInput.trim());
                    avancarRotaNova();
                }}
                disabled={!rotaNovaInput.trim()}
                style={{
                    padding: '12px 28px', borderRadius: '10px', border: 'none',
                    background: rotaNovaInput.trim() ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : 'rgba(59,130,246,0.3)',
                    color: 'white', fontWeight: '700', fontSize: '13px',
                    cursor: rotaNovaInput.trim() ? 'pointer' : 'not-allowed'
                }}
            >
                Confirmar
            </button>
            <button
                onClick={() => avancarRotaNova()}
                style={{
                    padding: '12px 28px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
            >
                Pular
            </button>
        </div>
        {rotaNovaFila.length > 0 && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: '#475569' }}>
                {rotaNovaFila.length} coleta(s) restante(s)
            </div>
        )}
    </div>
)}
```

- [ ] **Step 5: Atualizar `fechar()` para resetar os novos estados**

Na função `fechar()` (L445–457), adicionar antes de `onClose()`:

```js
setRotaNovaFila([]);
setRotaNovaAtual(null);
setRotaNovaInput('');
```

- [ ] **Step 6: Testar manualmente**

1. Importe um arquivo com pelo menos 1 linha cuja "Observação" contenha "ROTA NOVA"
2. O primeiro overlay deve aparecer perguntando se tem rota (comportamento atual)
3. Clique "Sim, tenho a rota" → deve aparecer o novo overlay com motorista + placa + coleta como referência
4. Digite um número e clique "Confirmar" → se houver mais lotes com ROTA NOVA, deve avançar para o próximo; se não, deve ir ao passo 2
5. Verifique no CardLote do passo 2 que o campo ROTA RECIFE ou ROTA MORENO está preenchido
6. Teste "Pular" → rota fica vazia, avança normalmente
7. Teste "Ainda não" no primeiro overlay → vai direto ao passo 2 sem pedir rota (comportamento original preservado)

- [ ] **Step 7: Commit**

```bash
git add src/components/ModalImportacaoLotes.js
git commit -m "feat(importacao): ROTA NOVA passo a passo — input de rota por coleta com referência"
```

---

## Task 3: Frontend — Detecção de Coletas Sumidas

**Files:**
- Modify: `src/components/ModalImportacaoLotes.js`

### Contexto rápido

A função `avancarParaPasso2` hoje é chamada em dois lugares: em `resolverEletrik` e em `handleArquivo`. Será renomeada para `avancarParaRotaNova`. Uma nova função `detectarSumidas` será inserida antes dela no fluxo. O overlay de coletas sumidas permite excluir ou reprogramar cada card faltante.

---

- [ ] **Step 1: Adicionar os 3 novos estados de coletas sumidas**

Em `ModalImportacaoLotes`, após os estados de `rotaNovaInput` adicionados na Task 2, adicionar:

```js
const [coletasSumidas,  setColetasSumidas]  = useState(null); // null | [{ id, motorista, placa1, placa2, coleta, operacao, _full }]
const [reprogramarCard, setReprogramarCard] = useState(null); // null | card completo sendo reprogramado
const [novaDataRepro,   setNovaDataRepro]   = useState('');
```

- [ ] **Step 2: Renomear `avancarParaPasso2` para `avancarParaRotaNova`**

Localizar a função `avancarParaPasso2` (L311):

```js
const avancarParaPasso2 = (lotesResolvidos) => {
```

Renomear para:

```js
const avancarParaRotaNova = (lotesResolvidos) => {
```

O corpo interno não muda.

- [ ] **Step 3: Adicionar a função `detectarSumidas`**

Após `avancarParaRotaNova`, adicionar:

```js
const detectarSumidas = useCallback(async (lotesResolvidos) => {
    try {
        const r = await api.get('/veiculos');
        const veiculos = r.data.veiculos || [];
        const STATUS_FINAIS = ['FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'];

        const coletasNovas = new Set();
        for (const l of lotesResolvidos) {
            for (const campo of [l.coletaRecife, l.coletaMoreno, l.coletaInterestadual]) {
                (campo || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => coletasNovas.add(t));
            }
        }

        const sumidos = veiculos.filter(v => {
            const recFinal = !v.status_recife || STATUS_FINAIS.includes(v.status_recife);
            const morFinal = !v.status_moreno || STATUS_FINAIS.includes(v.status_moreno);
            if (recFinal && morFinal) return false;
            if ((v.data_prevista || '') !== dataPrevista) return false;
            const coletas = [
                ...(v.coletaRecife || '').split(','),
                ...(v.coletaMoreno || '').split(','),
                ...((v.coletaInterestadual || v.coletainterestadual || '')).split(','),
            ].map(t => t.trim()).filter(Boolean);
            return coletas.length > 0 && coletas.every(t => !coletasNovas.has(t));
        }).map(v => ({
            id: v.id,
            motorista: v.motorista || '—',
            placa1: v.placa1Motorista || v.placa || '',
            placa2: v.placa2Motorista || '',
            coleta: v.coletaRecife || v.coletaMoreno || v.coletaInterestadual || v.coletainterestadual || '',
            operacao: v.operacao || '',
            _full: v,
        }));

        setLotes(lotesResolvidos);
        if (sumidos.length > 0) {
            setColetasSumidas(sumidos);
        } else {
            avancarParaRotaNova(lotesResolvidos);
        }
    } catch {
        setLotes(lotesResolvidos);
        avancarParaRotaNova(lotesResolvidos);
    }
}, [dataPrevista, avancarParaRotaNova]);
```

- [ ] **Step 4: Atualizar os dois call sites de `avancarParaPasso2` para `detectarSumidas`**

**Call site 1** — em `resolverEletrik` (L473):
```js
avancarParaPasso2(resolvidos);
```
→ substituir por:
```js
detectarSumidas(resolvidos);
```

**Call site 2** — em `handleArquivo` (L371):
```js
avancarParaPasso2(processados);
```
→ substituir por:
```js
detectarSumidas(processados);
```

- [ ] **Step 5: Adicionar helper `resolverSumida` para atualizar a lista e avançar quando vazia**

Após `detectarSumidas`, adicionar:

```js
const resolverSumida = useCallback((idResolvido, lotesParaRotaNova) => {
    setColetasSumidas(prev => {
        const nova = (prev || []).filter(c => c.id !== idResolvido);
        if (nova.length === 0) {
            setColetasSumidas(null);
            avancarParaRotaNova(lotesParaRotaNova);
        }
        return nova.length > 0 ? nova : null;
    });
}, [avancarParaRotaNova]);
```

- [ ] **Step 6: Adicionar overlay "Coletas Sumidas" no JSX**

Logo após o overlay `eletrikPendente` e o overlay `rotaNovaAtual` (já adicionado na Task 2), adicionar:

```jsx
{/* Overlay Coletas Sumidas */}
{coletasSumidas && !reprogramarCard && (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
        background: 'rgba(15,23,42,0.97)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
    }}>
        <AlertCircle size={36} color="#f59e0b" style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>
            Coletas não encontradas no novo arquivo
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px', maxWidth: '360px', lineHeight: 1.6 }}>
            As coletas abaixo estavam no painel com esta data, mas não vieram nesta importação.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '420px', marginBottom: '8px' }}>
            {coletasSumidas.map(card => (
                <div key={card.id} style={{
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '10px', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0' }}>
                            {card.motorista}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                            {card.placa1}{card.placa2 ? ` / ${card.placa2}` : ''} · Coleta: {card.coleta || '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{card.operacao}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                            onClick={async () => {
                                try {
                                    await api.delete(`/veiculos/${card.id}`);
                                } catch { /* ignora — pode já ter sido removido */ }
                                resolverSumida(card.id, lotes);
                            }}
                            style={{
                                padding: '6px 12px', borderRadius: '7px', border: 'none',
                                background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                                fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                            }}
                        >
                            Excluída
                        </button>
                        <button
                            onClick={() => { setReprogramarCard(card); setNovaDataRepro(dataPrevista); }}
                            style={{
                                padding: '6px 12px', borderRadius: '7px', border: 'none',
                                background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                                fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                            }}
                        >
                            Reprogramada
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
)}
```

- [ ] **Step 7: Adicionar sub-overlay "Reprogramar"**

Logo após o overlay de coletas sumidas, adicionar:

```jsx
{/* Sub-overlay Reprogramar */}
{reprogramarCard && (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 11, borderRadius: '16px',
        background: 'rgba(15,23,42,0.98)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center'
    }}>
        <CalendarPlus size={36} color="#60a5fa" style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>
            Nova data para esta coleta
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            {reprogramarCard.motorista} · <span style={{ fontFamily: 'monospace' }}>{reprogramarCard.placa1}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '20px', fontFamily: 'monospace' }}>
            Coleta: {reprogramarCard.coleta || '—'}
        </div>
        <input
            type="date"
            className="input-internal"
            value={novaDataRepro}
            onChange={e => setNovaDataRepro(e.target.value)}
            style={{ width: '180px', textAlign: 'center', fontSize: '13px', marginBottom: '24px' }}
        />
        <div style={{ display: 'flex', gap: '12px' }}>
            <button
                onClick={async () => {
                    if (!novaDataRepro) return;
                    try {
                        await api.put(`/veiculos/${reprogramarCard.id}`, {
                            ...reprogramarCard._full,
                            data_prevista: novaDataRepro,
                            data_prevista_original: reprogramarCard._full.data_prevista_original || dataPrevista,
                        });
                    } catch { /* falha silenciosa */ }
                    const idResolvido = reprogramarCard.id;
                    setReprogramarCard(null);
                    setNovaDataRepro('');
                    resolverSumida(idResolvido, lotes);
                }}
                disabled={!novaDataRepro}
                style={{
                    padding: '12px 28px', borderRadius: '10px', border: 'none',
                    background: novaDataRepro ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : 'rgba(59,130,246,0.3)',
                    color: 'white', fontWeight: '700', fontSize: '13px',
                    cursor: novaDataRepro ? 'pointer' : 'not-allowed'
                }}
            >
                Confirmar
            </button>
            <button
                onClick={() => { setReprogramarCard(null); setNovaDataRepro(''); }}
                style={{
                    padding: '12px 28px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
            >
                Cancelar
            </button>
        </div>
    </div>
)}
```

**Nota:** `CalendarPlus` já está importado em `PainelOperacional.js` mas precisa ser adicionado ao import de `ModalImportacaoLotes.js`. Localizar (L3):
```js
import { Upload, X, ChevronDown, AlertCircle, CheckCircle, Loader, Trash2, MapPin } from 'lucide-react';
```
Adicionar `CalendarPlus`:
```js
import { Upload, X, ChevronDown, AlertCircle, CheckCircle, Loader, Trash2, MapPin, CalendarPlus } from 'lucide-react';
```

- [ ] **Step 8: Atualizar `fechar()` para resetar os novos estados**

Na função `fechar()`, adicionar:

```js
setColetasSumidas(null);
setReprogramarCard(null);
setNovaDataRepro('');
```

- [ ] **Step 9: Testar manualmente**

**Cenário A — sem coletas sumidas:**
1. Importe arquivo com 3 coletas novas → o overlay de coletas sumidas não deve aparecer → fluxo normal

**Cenário B — com coletas sumidas:**
1. Importe arquivo com coletas [A, B, C] → passo 2 → confirme → cards criados com data_prevista = hoje
2. Importe mesmo arquivo mas com apenas [A, B] → o overlay de coletas sumidas deve aparecer com o card da coleta C
3. Teste "Excluída" → o card C deve desaparecer do PainelOperacional
4. Repita o passo 2 → teste "Reprogramada" → selecione outra data → confirme → o card C deve aparecer no painel com nova data

**Cenário C — coleta sumida + ROTA NOVA:**
1. Importe arquivo com coletas [A, B], sendo B com "ROTA NOVA" na obs, e cards [A, B, C] existentes no painel
2. Overlay coletas sumidas aparece primeiro (card C)
3. Após resolver → overlay ROTA NOVA para coleta B
4. Após resolver → passo 2

- [ ] **Step 10: Commit**

```bash
git add src/components/ModalImportacaoLotes.js
git commit -m "feat(importacao): detecção de coletas sumidas — excluir ou reprogramar via overlay"
```

---

## Task 4: Build e push

- [ ] **Step 1: Build de produção**

```bash
npm run build
```

Esperar terminar sem erros. Se houver erro de lint/compilação, corrigir antes de continuar.

- [ ] **Step 2: Commit e push**

```bash
git add -A
git status  # confirmar que só há arquivos esperados
git push origin develop
```

CI do GitHub Actions vai rebuildar a imagem de staging automaticamente.

- [ ] **Step 3: Verificar deploy**

Aguardar CI terminar e testar o fluxo completo em staging (portal.tnethub.com.br) antes de mergear para main.

---

## Ao final, atualizar os arquivos .md do Obsidian pertinentes em `C:/transnet memory/`

- `modulos/ModalImportacaoLotes.md` — atualizar com novos overlays e fluxo
- `decisions.md` — registrar decisão de escopo (data_prevista + coleta para detecção de sumidas)
