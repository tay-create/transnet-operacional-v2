<div align="center">
  <img src="public/appicon.ico" width="80" alt="Logo Transnet" />
  <h1>Transnet Operacional (v2)</h1>
  <p><strong>Plataforma Logística e Gestão Operacional de Transporte</strong></p>
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Versão-0.3.4-blue.svg" alt="Versão" />
  <img src="https://img.shields.io/badge/Produção-portal.tnethub.com.br-success.svg" alt="Produção" />
  <img src="https://img.shields.io/badge/Homologação-homolog.tnethub.com.br-yellow.svg" alt="Homologação" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-green.svg" alt="Node JS" />
  <img src="https://img.shields.io/badge/PostgreSQL-15%2B-informational.svg" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Compose-blue.svg" alt="Docker" />
</div>

<br />

O **Transnet Operacional** é um sistema web completo voltado para gestão logística de embarques, CT-e, frota e pós-embarque em transportadoras. Centraliza todas as etapas operacionais — da marcação do motorista na fila até a emissão do CT-e e rastreamento de ocorrências — com atualização em tempo real via Socket.io.

---

## Infraestrutura

| Ambiente | URL | Branch | Porta |
|---|---|---|---|
| **Produção** | portal.tnethub.com.br | `main` | 3001 |
| **Homologação** | homolog.tnethub.com.br | `develop` | 3002 |

- **Stack**: React 19 + Express 5 + PostgreSQL 15 + Socket.io + Docker + nginx + Cloudflare
- **Deploy**: push em `main` → CI GitHub Actions rebuilda imagem Docker e faz deploy automaticamente no servidor via self-hosted runner. O branch `develop` é sincronizado automaticamente após cada deploy em `main`.
- **Containers**: `transnet-prod` (porta 3001) e `transnet-staging` (porta 3002) no mesmo host WSL Ubuntu
- **Imagens**: `ghcr.io/tay-create/transnet-operacional-v2:latest` (prod) e `:staging` (homolog)
- **Banco**: PostgreSQL em containers separados (`transnet-db-prod` e `transnet-db-staging`). Migrations automáticas ao subir o servidor.

---

## Módulos

### Operação de Embarques
- Painel Kanban com cards por motorista/coleta — status em tempo real via socket
- Gestão de Docas visual (Recife e Moreno) com mapa de calor por status
- Importação em lote de coletas via planilha XLSX com detecção automática de duplicatas
- Reprogramação de cards com flag `foi_reprogramado` e controle de data original
- Lançamento de nova coleta com validação de operação, unidade e tipo de veículo
- Botão "Avisar Saída" e controle de tempo em pátio por card

### Auto-atendimento de Status — Motorista Interestadual (Leão SP / Eletrik Sul)
- Coordenador gera link temporário (válido 24h) direto no card
- Motorista acessa `/operacao/:token` no celular sem login
- Confirma a coleta como autenticação, depois avança os status linearmente: `LIBERADO P/ CARREGAMENTO` → `EM CARREGAMENTO` → `CARREGADO`
- Token expira ao chegar em CARREGADO ou após 24h
- Dropdown e régua de status restritos a esses 3 status para operações interestaduais

### Conferente (Pátio)
- Checklist de vistoria da carreta com fotos, assinatura digital e controle de avarias
- Corda extra: botão por card com modal de quantidade — registrado separado do checklist principal
- Status atualizado em tempo real — refletido no PainelOperacional e DashboardTV

### CT-e e Liberações
- Painel de emissão com fluxo: Aguardando → Em Emissão → Emitido
- Controle de liberações de Gerenciadora de Risco com verificação de checklists
- CT-e antecipado (flag por unidade) para operações especiais
- Destinatários configuráveis por operação (inclui Planejamento para interestaduais)

### Pós-Embarque
- Painel de ocorrências com KPIs (Em Andamento / Resolvidas / +24h / Total)
- Cards ordenados por atraso, com CTE/NF em destaque (15px/800 weight)
- Atualização em tempo real via socket (`posembarque_atualizada`)

### Dashboard TV
Exibido em televisões do galpão. 6 painéis em rotação automática:

| Painel | Conteúdo |
|---|---|
| 0 — Embarques (Visão Geral) | KPIs por operação, total geral, ocorrências, status CT-e, frota vs terceiros, gráfico de status por unidade |
| 1 — Recife | Veículos agrupados por doca + régua de status real |
| 2 — Moreno | Veículos agrupados por doca + régua de status real |
| 3 — Leão / Eletrik Sul | Dois painéis lado a lado (laranja/roxo), régua restrita a 3 status, fluxo CT-e |
| 4 — Tramontina | Monitoramento via Google Sheets API (cache 30s) — badges, gauges Plástico/Porcelana/Consolidadas |
| 5 — Fluxo Mensal | Heatmap 5 dias com coletas por operação + coluna Reprogramados |

### Monitoramento Tramontina (Google Sheets)
- Lê a aba `DELTA-PORCELANA` e `ELETRIK` da planilha via service account
- Lógica 100% espelhada do AppScript (`codigo.gs`):
  - **TOTAL ROTAS**: maior número encontrado em col A
  - **EMBARCADAS**: count col D = "X" linha a linha
  - **PROG. HOJE**: col C = "X" + col B = "X" (programadas + reprogramadas)
  - **REPROGRAMADAS**: col B = "X"
  - **PENDENTES**: TOTAL ROTAS − EMBARCADAS
  - **ELETRIK (EMBARC.)**: col B = "SIM" na aba Eletrik
- Gauges: Consolidado tem prioridade (col O ou P = "-"), depois Plástico (M ou Q), Porcelana (N ou R)

### Programação Diária de Frota
- Geração manual (Inicial/Final) ou automática via cron (10h e 17h)
- Snapshot salvo em `frota_programacao_diaria` com lista de veículos e KPIs por operação/unidade
- Flag `foi_reprogramado` é a única fonte de verdade para o contador de reprogramados

### Provisionamento de Frota Própria
- Grid semanal de veículos com status e destino
- Placa do cavalo opcional (suporte a carretas sem cavalo cadastrado)
- Ciclo de vida: `EM OPERAÇÃO` → `CARREGANDO` → `CARREGADO` → `EM VIAGEM` → `RETORNANDO` → `DISPONÍVEL`

### Relatório Operacional
- Período, unidade e tipo de operação configuráveis
- Bloco "Total de Embarques" com sub-contadores Recife / Moreno / São Paulo
- Bloco separado para interestaduais (Leão SP + Eletrik Sul)
- Gráficos: embarques por dia (barras verticais) + por operação (barras horizontais)
- Impressão formatada em A4 landscape

### Portal Mobile (PWA)
Acesso via `/mobile` — instalável como app no iOS e Android.

| Tela | Descrição |
|---|---|
| Home | Grid 2×2 com badges dinâmicos e relógio |
| Painel Operacional | Toggle Recife/Moreno, cards por status |
| Ger. Risco / CT-e | Checklist pills e timer colorido |
| Marcação de Placas | Criar/revogar links, copiar via WhatsApp com háptico |
| Dashboard TV | Swipe entre 4 telas (Embarques · Operação · CT-e · Leão/Eletrik Sul) |

### Outros Módulos
- **Marcação de Placas (Fila Pública)**: link com token válido 4h para motorista preencher dados e enviar documentos
- **Cadastro de Motoristas**: QR Code de auto-registro (`/api/tokens/auto`)
- **Cubagem de Carga**: mensuração de lotes, mix, metragem e valor
- **Saldo de Paletes**: rastreamento de PBR/descartáveis por viagem
- **Auditoria**: logs de todas as ações com usuário, horário e detalhes
- **Tema claro/escuro global**: toggle no menu de perfil, persiste em localStorage

---

## Tema e UI

- **ThemeContext** (`src/contexts/ThemeContext.js`): provedor global com `useTheme()` hook
- Toggle Sol/Lua no menu de perfil do Header — aplica `data-theme="claro"` ou `"escuro"` no `<html>`
- CSS variables em `src/index.css`: `--tn-bg-app`, `--tn-text-primary`, etc.
- Neon/glow desativados automaticamente no tema claro via seletores CSS

---

## Cargos e Permissões (RBAC)

| Cargo | Acesso principal |
|---|---|
| Coordenador | Tudo |
| Planejamento | Operacional, lançamento, CT-e, relatórios |
| Encarregado | Operacional, checklist, doca |
| Aux. Operacional | Operacional leitura + ações limitadas |
| Conhecimento | CT-e e liberações |
| Cadastro | Cadastro de motoristas e documentação |
| Conferente | Checklist de carreta e status de carga |
| Pós Embarque | Painel de ocorrências |
| Manutenção | Provisionamento de frota |
| Dashboard Viewer | Somente DashboardTV (sem expiração de JWT) |

---

## Setup de Desenvolvimento

### Requisitos
- Node.js 20+
- PostgreSQL 15+
- Docker + Docker Compose (para rodar equivalente ao prod)

### Variáveis de ambiente (`.env`)
```ini
NODE_ENV=development
PORT=3001

DB_USER=postgres
DB_HOST=localhost
DB_NAME=transnet_dev
DB_PASSWORD=sua_senha
DB_PORT=5432

JWT_SECRET=sua_chave_jwt

GMAIL_USER=email@gmail.com
GMAIL_APP_PASSWORD=app_password

# Google Sheets (Tramontina)
# Arquivo google-credentials.json na raiz com service account key
```

### Executar
```bash
npm install
npm run dev        # React (porta 3000) + Express (porta 3001) em paralelo
npm run server     # Só o backend
npm run build      # Build de produção do React
```

### Docker (equivalente ao prod)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Estrutura de pastas relevante

```
src/
├── components/          Painéis principais (PainelOperacional, DashboardTV, DashboardPosEmbarque, ...)
├── conferente/          Módulo do conferente (checklist, painel)
├── contexts/            ThemeContext
├── database/            db.js (pg), migrations.js
├── mobile/              PWA mobile (MobileApp, MobileDashboardTV, ...)
├── routes/              Express routers (veiculos, checklists, tramontina, ...)
└── services/            apiService (axios com baseURL automática)
```

---

<div align="center">
  <p>Desenvolvido para gestão logística em tempo real — Transnet Logística</p>
</div>
