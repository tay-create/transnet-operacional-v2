<div align="center">
  <img src="public/appicon.ico" width="80" alt="Logo Transnet" />
  <h1>Transnet Operacional (v2)</h1>
  <p><strong>Plataforma Logística e Gestão Operacional de Transporte</strong></p>
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Versão-0.3.3-blue.svg" alt="Versão" />
  <img src="https://img.shields.io/badge/Estágio-Produção-success.svg" alt="Produção" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node JS" />
  <img src="https://img.shields.io/badge/PostgreSQL-15%2B-informational.svg" alt="PostgreSQL" />
</div>

<br />

O **Transnet Operacional** é um sistema completo Client-Server focado no setor de Transportes e Logística, com interface WEB (React) e Desktop (Electron). Ele centraliza o registro, auditoria e gestão das etapas operacionais de fretamento, emissão de CT-e, liberação de cadastro de risco e pátio.

---

## 🚀 Principais Módulos

O sistema é dividido em submódulos isolados por permissão de acesso (RBAC), projetados para diferentes Setores/Cargos de uma transportadora (Coordenador, Planejamento, Encarregado, Auxiliar, Conhecimento, Cadastro e Pós Embarque):

- **📌 Marcação de Placas (Fila Pública)**
  - Geração de links seguros com tokens (`/cadastro/:token`) válidos por 4 horas para preenchimento de dados e envio de anexos (CRLV, CNH) direto pelo próprio motorista via celular.
  - Painel da Fila com gestão visual de tempos (SLA), disponibilidade e rastreamento.
- **🛡️ Gerenciamento de Risco e Cadastro**
  - Aprovação/bloqueio veicular via *Checklists de Documentações* (CNH, ANTT, Tacógrafo).
  - Controle das Liberações de GR (Gerenciadora de Risco do Seguro) integrado aos lançamentos.
- **🚚 Operações de Embarque**
  - Quadros Kanban interativos ou listagem de controle para Doca, Carregamento e Expedição.
  - Formulários de Nova Coleta e Ocorrências com envio de imagens Base64.
- **📦 Cubagem de Carga**
  - Módulo detalhado para mensuração de lotes e cálculo de Mix, Metragem e Valor de Frota/Terceiros.
- **📋 Checklists de Carreta (Vistoria de Pátio)**
  - Auditoria física com assinaturas digitais, fotos contra vazamentos/avarias e controles de avarias (Canvas).
- **🧱 Saldo de Paletes**
  - Rastreamento e gestão financeira de estoques (PBR / Descartáveis) repassados ou retidos com agregados/frota.
- **🗓️ Provisionamento de Frota**
  - Grid semanal de status por veículo com atualização em tempo real via Socket.io.
  - Ciclo de vida automático ao lançar um veículo: `EM OPERAÇÃO` → `CARREGANDO` (conferente) → `CARREGADO` → `EM VIAGEM` → `RETORNANDO` → `DISPONÍVEL`.
  - Modal de registro de viagem simplificado: informa apenas as datas de entrega e retorno. O destino aparece no grid somente no dia da entrega; dias de trânsito ficam sem texto.
  - O dia de retorno informado é automaticamente marcado como `DISPONÍVEL`.
- **📱 Portal Mobile — PWA para Coordenador** *(novo em v0.3.3)*
  - Acesso via `https://portal.tnethub.com.br/mobile` — instalável como app no iOS e Android.
  - Visualização de Painel Operacional (Recife/Moreno), Ger. Risco/CT-e e Dashboard TV em tempo real.
  - **Marcação de Placas totalmente interativa** no celular: criar links, reativar, revogar e copiar via WhatsApp com feedback háptico.
  - Design touch-first com bottom navigation bar, swipe, pull-to-refresh e suporte a notch/home indicator do iPhone.
- **🖥️ Painel TV (Painel Status)**
  - Modo interativo "Real-Time" (`socket.io`) para projetar o status de liberação e chamadas em telões visuais da operação (Dashboard Viewer).
  - Fluxo Mensal com KPIs de embarques, CT-es emitidos e tabela de coletas por operação (estilo planilha).
- **🔔 Notificações em Tempo Real**
  - Pos Embarque e Cadastro recebem alertas automáticos (sem F5) de novas ocorrências e marcações de placa.
  - Coordenador recebe aviso simplificado de quem marcou placa.
- **📝 Auditoria Completa (Cockpit)**
  - Todas as ações de modificação de dados (tokens, marcações, CT-es, checklists, fila, paletes, cubagens) são registradas na tabela de logs com usuário, horário e detalhes.

---

## 📱 Portal Mobile — `/mobile`

Rota dedicada ao **Coordenador** para acompanhar a operação e gerenciar motoristas pelo celular, sem precisar do computador.

### Como instalar como app

| Plataforma | Passos |
|------------|--------|
| **iOS (Safari)** | Abrir a URL → Compartilhar → "Adicionar à Tela de Início" |
| **Android (Chrome)** | Abrir a URL → Banner "Instalar" ou menu → "Adicionar à tela inicial" |

### Telas

| Tela | Permissão | Descrição |
|------|-----------|-----------|
| Home | — | Grid 2×2 com badges dinâmicos, relógio, indicador online/offline, botão sair |
| Painel Operacional | Leitura | Toggle Recife/Moreno, filtro de data, pull-to-refresh, cards por status com cores neon |
| Ger. Risco / CT-e | Leitura | Em Espera (checklist pills) · Na Operação (timer colorido) · Frota Própria (grid) |
| Marcação de Placas | **Interativo** | Criar/reativar/revogar links, copiar via clipboard com vibração háptica, ver marcações com cronômetro |
| Dashboard TV | Leitura | Swipe entre 3 telas (Embarques · Operação · CT-e), autoplay 12s com toggle |

### Arquitetura

```
src/mobile/
├── MobileApp.js          Wrapper + bottom navigation bar + login gate
├── MobileLogin.js        Tela de login (font-size 16px → sem zoom no iOS)
├── MobileHome.js         Home com 4 cards e badges dinâmicos
├── MobileOperacional.js  Painel Operacional read-only
├── MobileCadastro.js     Ger. Risco / CT-e read-only
├── MobileMarcacoes.js    Marcações interativo — bottom sheets, háptico
└── MobileDashboardTV.js  Dashboard TV com swipe e dots indicator
```

---

## 🛠️ Tecnologias Utilizadas

A pilha escolhida (Stack) enfatiza respostas em Tempo Real (Event-Driven) aliadas a uma UI Fluida.

| Frontend (UI) | Backend (API) | Banco e Ferramentas |
| :--- | :--- | :--- |
| **React** (v19.x) | **Node.js + Express** (v5) | **PostgreSQL** (Driver `pg`) |
| **TailwindCSS** (Estilos rápidos) | **Socket.io** (WebSockets) | **Bcryptjs + JWT** (Segurança OTP) |
| **Zustand** (Gestão de Estado global)| **Multer / Body-Parser** | **html2pdf / jsPDF** (Relatórios) |
| **Lucide-React** (Ícones) | **Express-Rate-Limit** | **Electron** (Desktop wrapper) |

---

## ⚙️ Pré-requisitos e Setup

### 1. Requisitos de Ambiente
* **Node.js** (v18.x ou superior recomendado)
* **PostgreSQL** (v14+ com credenciais administrativas prontas)
* (Opcional) Ambiente WSL/Linux para desenvolvimento. *(Testado em Windows 11/Ubuntu WSL).*

### 2. Configurando Variáveis (`.env`)
Duplique o arquivo `.env.example` (se existente) para `.env` e ajuste seu acesso ao banco:
```ini
NODE_ENV=development
PORT=3000

# Conexão Banco Postgres
DB_USER=DB_USER
DB_HOST=localhost
DB_NAME=tnet_operacional
DB_PASSWORD=sua_senha
DB_PORT=DB_PORT

# Autenticação
JWT_SECRET=SuaChaveSuperSecretaToken
```

### 3. Instalando as Dependências
```bash
npm install
```

### 4. Inicializando Banco e Usuários
```bash
# Popula os cargos mínimos padrão (senha padrao: 123456)
node scripts/seed_usuarios.js
```

---

## 🏃‍♂️ Como Executar (Modo Desenvolvedor)

### Web (API + React ao mesmo tempo)
Inicia o Back-End Express na porta `3000` e o Dev-Server do React na porta `3001` em paralelo:
```bash
npm run dev
```

### Só Servidor (Back-end)
```bash
npm run server
```

---

## 📦 Empacotamento para Produção (Desktop App)

O Transnet Operacional pode ser compilado como um aplicativo Nativo de Windows (`.exe` em NSIS) utilizando o `electron-builder`.

```bash
# Faz o Build otimizado do React e gera o instalador Desktop:
npm run electron:build
```
> ⚠️ **Nota de Ambiente Windows SmartScreen:** O artefato gerado `.exe` pela pasta `dist/` entrará no processo de *SmartScreen* do Windows 11 caso você não tenha uma licença EV (*Code Signing* comprada) assinando o pacote. Instrua os usuários a clicar em "*Mais Informações > Executar assim mesmo*" na primeira abertura do aplicativo. 

---

## 🗃️ Estrutura do Banco e Permissões (RBAC)
As regras de negócio do acesso a abas são atreladas diretamente a tabela `configuracoes` sob as chaves `permissoes_acesso` e `permissoes_edicao`.

**Cargos Suportados e Hierarquias:**
`Coordenador`, `Planejamento`, `Encarregado`, `Aux. Operacional`, `Conhecimento`, `Cadastro`, `Conferente`, `Pos Embarque`, e `Dashboard Viewer` (para as TVs).
O sistema **gera automaticamente** a tabela subjacente pelo Migrations ao ligar o Node.

---

<div align="center">
  <p>Feito para suprir Logística em Tempo Real.</p>
</div>
