<div align="center">
  <img src="public/appicon.ico" width="80" alt="Logo Transnet" />
  <h1>Transnet Operacional (v2)</h1>
  <p><strong>Plataforma Logística e Gestão Operacional de Transporte</strong></p>
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Versão-0.1.0-blue.svg" alt="Versão" />
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
- **🖥️ Painel TV (Painel Status)**
  - Modo interativo "Real-Time" (`socket.io`) para projetar o status de liberação e chamadas em telões visuais da operação (Dashboard Viewer).

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
DB_USER=transnet_user
DB_HOST=localhost
DB_NAME=tnet_operacional
DB_PASSWORD=sua_senha
DB_PORT=5432

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
