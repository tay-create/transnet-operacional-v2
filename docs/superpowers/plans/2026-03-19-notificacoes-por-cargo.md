# Filtro de Notificações por Cargo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir quais notificações cada cargo recebe, garantindo que Cadastro receba apenas Ger. Risco e Doca, Conhecimento receba apenas Ger. Risco, Doca e Aceite CT-e, e Coordenador pare de receber marcações de placa.

**Architecture:** Todas as mudanças são nos mapas de destinatários (`DESTINATARIOS_ALERTA` no frontend e `DESTINATARIOS_NOTIFICACAO` no backend) e em arrays `cargos_alvo` embutidos diretamente nos payloads de `notificacao_direcionada` no servidor.

**Tech Stack:** React (frontend), Express + Socket.io (backend), PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-19-notificacoes-por-cargo-design.md`

---

## Mapa de arquivos

| Arquivo | Mudança |
|---|---|
| `src/App.js` | Atualizar `DESTINATARIOS_ALERTA` (linhas 38–48) |
| `server.js` | Atualizar `DESTINATARIOS_NOTIFICACAO` (linhas 37–46) + 4 arrays `cargos_alvo` inline |
| `src/routes/checklists.js` | Corrigir `cargosAlvo` para status LIBERADO P/ DOCA |

---

## Task 1: Atualizar DESTINATARIOS_ALERTA no frontend

**Arquivos:**
- Modify: `src/App.js:38-48`

Este mapa controla quais cargos recebem cada tipo de alerta **em tempo real** no cliente (função `handleReceberAlerta`). É o filtro principal para os alertas emitidos via socket.

- [ ] **Step 1: Editar DESTINATARIOS_ALERTA em `src/App.js`**

Localizar o bloco nas linhas 38–48 e substituir pelo seguinte:

```js
const DESTINATARIOS_ALERTA = {
    'admin_cadastro':      ['Coordenador'],
    'admin_senha':         ['Coordenador'],
    'aceite_cte_pendente': ['Conhecimento', 'Planejamento'],
    'veiculo_carregado':   ['Planejamento'],
    'checklist_pendente':  [],
    'aviso':               ['Planejamento', 'Encarregado', 'Aux. Operacional'],
    'nova_ocorrencia':     ['Pos Embarque'],
    'nova_marcacao':       ['Pos Embarque'],
    'nova_marcacao_coord': [],
    'doca':                ['Cadastro', 'Conhecimento'],
};
```

Diferenças em relação ao original:
- `veiculo_carregado`: remove `Conhecimento`
- `aviso`: remove `Conhecimento`
- `nova_ocorrencia`: remove `Cadastro`
- `nova_marcacao`: remove `Cadastro`
- `nova_marcacao_coord`: era `['Coordenador']`, agora `[]`
- `doca`: **novo** — antes ausente (todos recebiam), agora só Cadastro e Conhecimento

- [ ] **Step 2: Verificar no console do browser**

Após iniciar o app, abrir o console e confirmar que o log `🚀 [App] Carregando` aparece sem erros de sintaxe.

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: filtrar notificacoes por cargo no frontend"
```

---

## Task 2: Atualizar DESTINATARIOS_NOTIFICACAO no backend

**Arquivos:**
- Modify: `server.js:37-46`

Este mapa filtra as notificações persistidas no banco quando o endpoint `GET /notificacoes` é chamado (ao recarregar a página ou reconectar). Deve espelhar o mapa do frontend, exceto `doca` (que não passa por esse fluxo).

- [ ] **Step 1: Editar DESTINATARIOS_NOTIFICACAO em `server.js`**

Localizar o bloco nas linhas 37–46 e substituir pelo seguinte:

```js
const DESTINATARIOS_NOTIFICACAO = {
    'aceite_cte_pendente': ['Conhecimento', 'Planejamento'],
    'veiculo_carregado':   ['Planejamento'],
    'admin_cadastro':      ['Coordenador'],
    'admin_senha':         ['Coordenador'],
    'nova_ocorrencia':     ['Pos Embarque'],
    'nova_marcacao':       ['Pos Embarque'],
    'nova_marcacao_coord': [],
    'aviso':               ['Planejamento', 'Encarregado', 'Aux. Operacional'],
};
```

Diferenças em relação ao original:
- `veiculo_carregado`: remove `Conhecimento`
- `nova_ocorrencia`: remove `Cadastro`
- `nova_marcacao`: remove `Cadastro`
- `nova_marcacao_coord`: era `['Coordenador']`, agora `[]`
- `aviso`: remove `Conhecimento`
- `doca` **não é adicionado** aqui — alertas `doca` são emitidos pelo frontend, não persistidos pelo backend

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: filtrar notificacoes persistidas por cargo no backend"
```

---

## Task 3: Remover Coordenador dos cargos_alvo do checklist

**Arquivos:**
- Modify: `server.js:~714` (checklist de marcação)
- Modify: `server.js:~858` (checklist de veículo)

Duas rotas no `server.js` enviam `notificacao_direcionada` quando um checklist é atualizado. Atualmente incluem `Coordenador` no `cargos_alvo` — deve ser removido.

- [ ] **Step 1: Localizar e editar ~linha 714 (checklist de marcação)**

Encontrar o bloco:
```js
enviarNotificacao('notificacao_direcionada', {
    mensagem: `Checklist de ${placaDesc} atualizado — ${situacao}`,
    situacao,
    cargos_alvo: ['Coordenador', 'Cadastro', 'Encarregado'],
    data_criacao: new Date().toISOString()
});
```

Mudar `cargos_alvo` para:
```js
cargos_alvo: ['Cadastro', 'Encarregado'],
```

- [ ] **Step 2: Localizar e editar ~linha 858 (checklist de veículo)**

Encontrar o bloco:
```js
enviarNotificacao('notificacao_direcionada', {
    mensagem: `Checklist de ${motoristaNome} atualizado — ${situacao}`,
    situacao,
    cargos_alvo: ['Coordenador', 'Cadastro', 'Encarregado'],
    veiculoId: Number(req.params.id),
    data_criacao: new Date().toISOString()
});
```

Mudar `cargos_alvo` para:
```js
cargos_alvo: ['Cadastro', 'Encarregado'],
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: remove coordenador das notificacoes de checklist"
```

---

## Task 4: Adicionar Conhecimento nas liberações (Ger. Risco)

**Arquivos:**
- Modify: `server.js:~1850` (liberacao_expirada)
- Modify: `server.js:~1873` (liberacao_vencendo)

As notificações de liberação expirada/vencendo são o "Ger. Risco" do sistema. Atualmente só chegam para Cadastro, Encarregado e Planejamento. O cargo Conhecimento precisa recebê-las também.

- [ ] **Step 1: Localizar e editar ~linha 1850 (liberacao_expirada)**

Encontrar o bloco com:
```js
tipo: 'liberacao_expirada',
cargos_alvo: ['Cadastro', 'Encarregado', 'Planejamento'],
```

Mudar `cargos_alvo` para:
```js
cargos_alvo: ['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento'],
```

- [ ] **Step 2: Localizar e editar ~linha 1873 (liberacao_vencendo)**

Encontrar o bloco com:
```js
tipo: 'liberacao_vencendo',
cargos_alvo: ['Cadastro', 'Encarregado', 'Planejamento'],
```

Mudar `cargos_alvo` para:
```js
cargos_alvo: ['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento'],
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: adiciona conhecimento nas notificacoes de liberacao ger risco"
```

---

## Task 5: Corrigir cargosAlvo no status conferente LIBERADO P/ DOCA

**Arquivos:**
- Modify: `src/routes/checklists.js:~394-399`

Quando o conferente muda o status para LIBERADO P/ DOCA, o evento `notificacao_direcionada` é enviado. Atualmente o array base inclui `Auxiliar Operacional`, que então recebe essa notificação mesmo sendo ela equivalente ao fluxo de `doca` (exclusivo para Cadastro e Conhecimento).

- [ ] **Step 1: Localizar e editar `src/routes/checklists.js` ~linha 394**

Encontrar o bloco:
```js
const cargosAlvo = ['Auxiliar Operacional'];

// LIBERADO P/ DOCA → também notifica Cadastro e Conhecimento
if (novoStatus === 'LIBERADO P/ DOCA') {
    cargosAlvo.push('Cadastro', 'Conhecimento');
    ...
}
```

Substituir a declaração de `cargosAlvo` por:
```js
const cargosAlvo = novoStatus === 'LIBERADO P/ DOCA'
    ? ['Cadastro', 'Conhecimento']
    : ['Auxiliar Operacional'];
```

Dentro do bloco `if (novoStatus === 'LIBERADO P/ DOCA')`:
- **Remover** a linha `cargosAlvo.push('Cadastro', 'Conhecimento');`
- **Manter** o `io.emit('conferente_novo_veiculo', ...)` intacto

Resultado esperado do bloco completo após a edição:
```js
const cargosAlvo = novoStatus === 'LIBERADO P/ DOCA'
    ? ['Cadastro', 'Conhecimento']
    : ['Auxiliar Operacional'];

// LIBERADO P/ DOCA → também notifica Cadastro e Conhecimento
if (novoStatus === 'LIBERADO P/ DOCA') {
    io.emit('conferente_novo_veiculo', {
        veiculoId,
        motorista: motoristaNome,
        placa: veiculo.placa,
        doca: docaAtual,
        coleta: coletaNum,
        cidade
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/checklists.js
git commit -m "feat: status conferente LIBERADO P/ DOCA notifica apenas Cadastro e Conhecimento"
```

---

## Task 6: Build, deploy e verificação final

- [ ] **Step 1: Build React**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build"
```

Esperado: build sem erros.

- [ ] **Step 2: Reiniciar PM2**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env"
```

- [ ] **Step 3: Verificação manual — Cadastro**

Logar com um usuário de cargo `Cadastro`. Verificar no console do browser que ao receber alertas:
- `doca` → aparece ✅
- `nova_marcacao` → **não** aparece ✅
- `nova_ocorrencia` → **não** aparece ✅

- [ ] **Step 4: Verificação manual — Conhecimento**

Logar com um usuário de cargo `Conhecimento`. Verificar:
- `aceite_cte_pendente` → aparece ✅
- `doca` → aparece ✅
- `veiculo_carregado` → **não** aparece ✅
- `aviso` → **não** aparece ✅

- [ ] **Step 5: Verificação manual — Coordenador**

Logar com um usuário de cargo `Coordenador`. Verificar:
- `nova_marcacao_coord` → **não** aparece ✅ (tipo `nova_marcacao_coord` estava em `cargos_alvo: ['Coordenador']`, agora `[]`)
- Checklist atualizado → **não** aparece no sino ✅

- [ ] **Step 6: Push**

```bash
wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git push"
```
