# Instrucoes para o Claude — Transnet Operacional v2

## Sistema de Memoria

No inicio de cada sessao, leia os arquivos de memoria em:
C:/Users/Servdor/.claude/projects/--wsl-localhost-Ubuntu-home-transnet-projects-transnet-operacional-v2/memory/

Arquivos: MEMORY.md (indice), user.md, preferences.md, decisions.md, people.md

Ao final de cada sessao (ou ao aprender algo novo), atualize o arquivo correspondente.

## Projeto

Sistema logistico para controle de embarques, CT-e e frota.
Stack: React + Express (server.js) + PostgreSQL + Socket.io + PM2 + nginx + WSL Ubuntu
Porta: 3001 (proxy nginx para portal.tnethub.com.br)
Processo PM2: transnet (id 0)
Build: npm run build depois pm2 restart transnet --update-env

## Regras de trabalho

- Sempre commitar e fazer push apos alteracoes, sem perguntar
- Usar apenas icones lucide-react, nunca emojis Unicode no codigo
- Respostas curtas e diretas, sem recapitulacoes ao final
- Build React antes de testar qualquer mudanca frontend
