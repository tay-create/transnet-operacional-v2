# Filtro de Notificações por Cargo

**Data:** 2026-03-19
**Status:** Aprovado

## Objetivo

Restringir quais tipos de notificação cada cargo recebe, eliminando ruído e garantindo que cada cargo veja apenas o que é relevante para seu fluxo de trabalho.

## Cargos afetados

- **Cadastro** — deve receber apenas: Ger. Risco (liberações) e Liberar p/ Doca
- **Conhecimento** — deve receber apenas: Ger. Risco (liberações), Liberar p/ Doca e Aceite CT-e
- **Coordenador** — não deve mais receber notificações de marcação de placa

## Mudanças no mapa de destinatários

Dois arquivos mantêm mapas paralelos de destinatários:
- **Frontend:** `src/App.js` → `DESTINATARIOS_ALERTA` (filtra no cliente via `handleReceberAlerta`)
- **Backend:** `server.js` → `DESTINATARIOS_NOTIFICACAO` (filtra ao servir GET `/notificacoes`)

> **Nota:** o tipo `doca` é emitido pelo frontend via `socket.emit('enviar_alerta', ...)`, portanto só precisa ser adicionado ao mapa do frontend. Adicioná-lo ao backend é uma no-op para o fluxo em tempo real (mas pode ser feito por simetria documental).

### Frontend — `src/App.js` `DESTINATARIOS_ALERTA`

| Tipo | Antes | Depois |
|---|---|---|
| `doca` | *(ausente — todos recebem)* | `['Cadastro', 'Conhecimento']` |
| `veiculo_carregado` | `['Conhecimento', 'Planejamento']` | `['Planejamento']` |
| `nova_marcacao` | `['Pos Embarque', 'Cadastro']` | `['Pos Embarque']` |
| `nova_marcacao_coord` | `['Coordenador']` | `[]` |
| `nova_ocorrencia` | `['Pos Embarque', 'Cadastro']` | `['Pos Embarque']` |
| `aviso` | `['Planejamento', 'Conhecimento', 'Encarregado', 'Aux. Operacional']` | `['Planejamento', 'Encarregado', 'Aux. Operacional']` |
| `aceite_cte_pendente` | `['Conhecimento', 'Planejamento']` | *(sem mudança)* |

### Backend — `server.js` `DESTINATARIOS_NOTIFICACAO`

Mesmas mudanças acima, exceto `doca` (não se aplica ao fluxo de persistência).

## Mudanças nos eventos `notificacao_direcionada`

Esses eventos definem `cargos_alvo` diretamente no payload, independente dos mapas acima.

### `server.js` — checklist atualizado (2 pontos)

- **~linha 714** (checklist de marcação): `['Coordenador', 'Cadastro', 'Encarregado']` → `['Cadastro', 'Encarregado']`
- **~linha 858** (checklist de veículo): `['Coordenador', 'Cadastro', 'Encarregado']` → `['Cadastro', 'Encarregado']`

### `server.js` — liberações (Ger. Risco)

- **~linha 1850** (`liberacao_expirada`): `['Cadastro', 'Encarregado', 'Planejamento']` → `['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento']`
- **~linha 1873** (`liberacao_vencendo`): `['Cadastro', 'Encarregado', 'Planejamento']` → `['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento']`

### `src/routes/checklists.js` — status conferente LIBERADO P/ DOCA

Código atual:
```js
const cargosAlvo = ['Auxiliar Operacional'];
if (novoStatus === 'LIBERADO P/ DOCA') {
    cargosAlvo.push('Cadastro', 'Conhecimento');
}
```

`Auxiliar Operacional` não deve receber o evento LIBERADO P/ DOCA (repete o fluxo do `doca`, que é exclusivo para Cadastro e Conhecimento). Mudança: quando `novoStatus === 'LIBERADO P/ DOCA'`, o array deve ser `['Cadastro', 'Conhecimento']` sem incluir `Aux. Operacional`.

```js
const cargosAlvo = novoStatus === 'LIBERADO P/ DOCA'
    ? ['Cadastro', 'Conhecimento']
    : ['Auxiliar Operacional'];
```

## Resultado esperado por cargo

| Cargo | Notificações recebidas após mudança |
|---|---|
| Cadastro | `doca`, `liberacao_expirada`, `liberacao_vencendo`, checklist atualizado |
| Conhecimento | `doca`, `aceite_cte_pendente`, `liberacao_expirada`, `liberacao_vencendo` |
| Coordenador | `admin_cadastro`, `admin_senha`, `admin_config_mudou`, `programacao_gerada` |
| Pos Embarque | `nova_marcacao`, `nova_ocorrencia` |
| Planejamento | `aceite_cte_pendente`, `veiculo_carregado`, `aviso`, `programacao_gerada` |
| Encarregado | `aviso`, checklist atualizado, `liberacao_expirada`, `liberacao_vencendo` |
| Aux. Operacional | `aviso`, `status_conferente` (outros status, não LIBERADO P/ DOCA) |

## Arquivos a modificar

1. `src/App.js` — `DESTINATARIOS_ALERTA` (linhas 38-48)
2. `server.js` — `DESTINATARIOS_NOTIFICACAO` (linhas 37-46)
3. `server.js` — `cargos_alvo` do checklist marcação (~714)
4. `server.js` — `cargos_alvo` do checklist veículo (~858)
5. `server.js` — `cargos_alvo` de `liberacao_expirada` (~1850)
6. `server.js` — `cargos_alvo` de `liberacao_vencendo` (~1873)
7. `src/routes/checklists.js` — `cargosAlvo` status conferente LIBERADO P/ DOCA (~399)
