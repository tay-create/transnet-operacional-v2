# Filtro de Notificações por Cargo

**Data:** 2026-03-19
**Status:** Aprovado

## Objetivo

Restringir quais tipos de notificação cada cargo recebe, eliminando ruído e garantindo que cada cargo veja apenas o que é relevante para seu fluxo de trabalho.

## Cargos afetados

- **Cadastro** — deve receber apenas: Ger. Risco (liberações) e Liberar p/ Doca
- **Conhecimento** — deve receber apenas: Ger. Risco (liberações), Liberar p/ Doca e Aceite CT-e
- **Coordenador** — não deve mais receber notificações de marcação de placa (`nova_marcacao_coord`)

## Mudanças no mapa de destinatários

Dois arquivos mantêm mapas paralelos de destinatários por tipo de notificação:
- **Frontend:** `src/App.js` → `DESTINATARIOS_ALERTA`
- **Backend:** `server.js` → `DESTINATARIOS_NOTIFICACAO`

Ambos devem ser atualizados de forma idêntica:

| Tipo | Antes | Depois |
|---|---|---|
| `doca` | *(ausente — todos recebem)* | `['Cadastro', 'Conhecimento']` |
| `veiculo_carregado` | `['Conhecimento', 'Planejamento']` | `['Planejamento']` |
| `nova_marcacao` | `['Pos Embarque', 'Cadastro']` | `['Pos Embarque']` |
| `nova_marcacao_coord` | `['Coordenador']` | `[]` |
| `nova_ocorrencia` | `['Pos Embarque', 'Cadastro']` | `['Pos Embarque']` |
| `aviso` | `['Planejamento', 'Conhecimento', 'Encarregado', 'Aux. Operacional']` | `['Planejamento', 'Encarregado', 'Aux. Operacional']` |
| `aceite_cte_pendente` | `['Conhecimento', 'Planejamento']` | *(sem mudança)* |

## Mudanças nos eventos `notificacao_direcionada`

Esses eventos definem `cargos_alvo` diretamente no payload, sem passar pelos mapas acima.

### `server.js` — checklist atualizado (2 pontos)

- **~linha 714** (checklist de marcação): `['Coordenador', 'Cadastro', 'Encarregado']` → `['Cadastro', 'Encarregado']`
- **~linha 858** (checklist de veículo): `['Coordenador', 'Cadastro', 'Encarregado']` → `['Cadastro', 'Encarregado']`

### `server.js` — liberações (Ger. Risco)

- **~linha 1850** (`liberacao_expirada`): `['Cadastro', 'Encarregado', 'Planejamento']` → `['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento']`
- **~linha 1873** (`liberacao_vencendo`): `['Cadastro', 'Encarregado', 'Planejamento']` → `['Cadastro', 'Conhecimento', 'Encarregado', 'Planejamento']`

### `src/routes/checklists.js` — status conferente LIBERADO P/ DOCA

- **~linha 399**: `cargosAlvo.push('Cadastro', 'Conhecimento')` com base inicial `['Auxiliar Operacional']`
  → Mudar base para `[]` quando status for LIBERADO P/ DOCA, resultando em `['Cadastro', 'Conhecimento']`

## Resultado esperado por cargo

| Cargo | Notificações recebidas após mudança |
|---|---|
| Cadastro | `doca`, `liberacao_expirada`, `liberacao_vencendo`, checklist atualizado |
| Conhecimento | `doca`, `aceite_cte_pendente`, `liberacao_expirada`, `liberacao_vencendo` |
| Coordenador | `admin_cadastro`, `admin_senha`, `nova_marcacao_coord` (vazio), `admin_config_mudou` |
| Pos Embarque | `nova_marcacao`, `nova_ocorrencia` |
| Planejamento | `aceite_cte_pendente`, `veiculo_carregado`, `aviso`, `programacao_gerada` |
| Encarregado | `aviso`, checklist atualizado, `liberacao_expirada`, `liberacao_vencendo` |

## Arquivos a modificar

1. `src/App.js` — `DESTINATARIOS_ALERTA` (linhas 38-48)
2. `server.js` — `DESTINATARIOS_NOTIFICACAO` (linhas 37-46)
3. `server.js` — `cargos_alvo` do checklist marcação (~714)
4. `server.js` — `cargos_alvo` do checklist veículo (~858)
5. `server.js` — `cargos_alvo` de `liberacao_expirada` (~1850)
6. `server.js` — `cargos_alvo` de `liberacao_vencendo` (~1873)
7. `src/routes/checklists.js` — `cargosAlvo` status conferente LIBERADO P/ DOCA (~399)
