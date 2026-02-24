# Transnet Operacional 🚚

Sistema integrado de gestão logística para controle operacional, emissão de CT-e, gestão de frota e monitoramento em tempo real.

![Logo Transnet](file:///d:/transnet-operacional/src/assets/logo.png)

## 🚀 Sobre o Projeto

O **Transnet Operacional** é uma solução robusta (Web & Desktop) desenvolvida para otimizar o fluxo logístico entre unidades (Recife/Moreno). O sistema centraliza desde o lançamento de veículos e controle de docas até a gestão de cubagem e monitoramento de motoristas em trânsito.

## 🛠️ Stack Tecnológica

### Frontend
- **React 19**: Interface moderna e reativa.
- **Zustand**: Gerenciamento de estado leve e eficiente.
- **Tailwind CSS**: Estilização responsiva e customizada.
- **Lucide React**: Biblioteca de ícones moderna.
- **Recharts**: Visualização de dados e dashboards operacionais.
- **Socket.io-client**: Comunicação bidirecional em tempo real.

### Backend
- **Node.js & Express**: API REST escalável.
- **SQLite3**: Banco de dados relacional local para alta performance.
- **Socket.io**: Motor de eventos em tempo real para alertas e atualizações.
- **JWT & Bcrypt**: Autenticação segura e criptografia de senhas.
- **Node-cron**: Agendamento de tarefas e automações.

### Desktop
- **Electron**: Wrapper para execução nativa em Windows com suporte a notificações de sistema.

## ✨ Funcionalidades Principais

- **Painel Operacional**: Gestão de veículos em tempo real (Recife/Moreno) com controle de status e docas.
- **Gestão de CT-e**: Fluxos de aceite, emissão e arquivamento automático de Conhecimentos de Transporte.
- **Módulo de Frota**: Aplicativo do motorista, checklist de carreta, previsões de disponibilidade e ocorrências.
- **Controle de Cubagem**: Cálculo de cubagem por coleta, integração de itens e redespacho.
- **Dashboards & TV**: Telas de monitoramento em tempo real para operações e desempenho mensal.
- **Relatórios**: Exportação programada em PDF e XLSX (Excel).
- **RBAC (Permissões)**: Controle granular de acesso baseado em cargos (Coordenador, Planejamento, Encarregado, etc).
- **Audit Logs**: Rastreabilidade completa de todas as ações sensíveis no sistema.

## 📦 Estrutura do Projeto

```text
├── electron/          # Lógica nativa do Electron (main process)
├── middleware/        # Middlewares Express (Auth, Validação Zod)
├── public/            # Ativos estáticos públicos
├── src/               # Código fonte React
│   ├── assets/        # Imagens e logotipos
│   ├── components/    # Componentes modulares (Painéis, Modais, UI)
│   ├── store/         # Estados globais (Zustand)
│   ├── services/      # Integração com API (Axios)
│   └── utils/         # Helpers e funções de utilidade
├── server.js          # Servidor Express & Configuração SQLite
└── tnetlog.db         # Banco de dados SQLite
```

## ⚙️ Instalação e Configuração

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18+)
- npm ou yarn

### Passo a Passo

1. **Clonar o Repositório**
   ```bash
   git clone https://github.com/seu-usuario/transnet-operacional.git
   cd transnet-operacional
   ```

2. **Instalar Dependências**
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente**
   Clone o arquivo `.env.example` para `.env` e ajuste as chaves se necessário:
   ```bash
   copy .env.example .env
   ```

4. **Executar em Desenvolvimento**
   Este comando inicia simultaneamente o servidor backend e o ambiente React:
   ```bash
   npm run dev
   ```

5. **Executar via Electron (Desktop)**
   ```bash
   npm run electron
   ```

## 📜 Licença

Propriedade da **Transnet - Logística Integrada**. Todos os direitos reservados.

---
*Created in 2026 • Transnet Dev*
