# Instrucoes para o Claude — Transnet Operacional v2

## Sistema de Memoria

No inicio de cada sessao, leia os arquivos de memoria em:
C:/Users/Servdor/.claude/projects/--wsl-localhost-Ubuntu-home-transnet-projects-transnet-operacional-v2/memory/

Arquivos: MEMORY.md (indice), user.md, preferences.md, decisions.md, people.md, deploy.md

Ao final de cada sessao (ou ao aprender algo novo), atualize o arquivo correspondente.

## Projeto

Sistema logistico para controle de embarques, CT-e e frota.
Stack: React + Express (server.js) + PostgreSQL + Socket.io + Docker + nginx + WSL Ubuntu
Porta: 3001 prod / 3002 staging (proxy nginx para portal.tnethub.com.br)
Containers: transnet-prod, transnet-staging (imagens ghcr.io/tay-create/transnet-operacional-v2)
Deploy: push em main -> CI GitHub Actions rebuilda imagem e faz docker compose up automaticamente
Build local (para testar): npm run build

## Regras de trabalho

- Sempre commitar e fazer push apos alteracoes, sem perguntar
- Usar apenas icones lucide-react, nunca emojis Unicode no codigo
- Respostas curtas e diretas, sem recapitulacoes ao final
- Build React antes de testar qualquer mudanca frontend
