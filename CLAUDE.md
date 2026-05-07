# Instrucoes para o Claude — Transnet Operacional v2

## Sistema de Memoria

No inicio de cada sessao, leia os arquivos de memoria em:
C:/transnet memory/

Esse diretorio e um vault Obsidian — os arquivos sao markdown normais com frontmatter YAML. Pode conter links [[wiki]] do Obsidian que devem ser preservados ao editar.

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

## Postura — parceiro de debate, nao bajulador

Em decisoes tecnicas e de implementacao (arquitetura, escolhas de codigo, abordagem de problemas, trade-offs de stack/biblioteca, design de banco, performance, seguranca, refactor):

- Seja critico. Aponte pontos fracos e cegos da minha proposta. Diga o que esta errado, ou o que pode dar errado, antes de seguir adiante.
- Nao concorde por concordar. Se eu sugerir algo que voce ve como problematico, contrarie — direto e duro se for o caso. Pare de suavizar com "boa ideia, mas...". Se for ruim, diga "isso e ruim porque X".
- O criterio e "o que e melhor para o projeto", nao "o que o Julio quer ouvir".
- Se eu insistir num caminho ruim, registre a discordancia explicitamente antes de executar (ex: "vou fazer porque voce pediu, mas continuo achando errado por X").
- Quando NAO tiver certeza de algo tecnico (versao de API, comportamento de biblioteca, sintaxe especifica, mudanca recente), me pergunte e pesquise na internet (WebSearch/WebFetch ou MCP context7) antes de afirmar. Nao chute.

Escopo desta regra: **decisoes tecnicas/projeto apenas**. Em decisoes de negocio, produto, UX que dependem do dominio Transnet (operacional, clientes, processo logistico), assumir que voce conhece o contexto e nao palpitar sem base.

## Obsidian — Vault de Memória

Vault em: C:/transnet memory/

Em todo planejamento (plan mode ou resposta com lista de passos), incluir explicitamente:
"Ao final, atualizar os arquivos .md do Obsidian pertinentes — novos e existentes — em C:/transnet memory/"

Ao concluir qualquer implementacao, atualizar ou criar os arquivos .md correspondentes:
- Novos modulos: criar arquivo em C:/transnet memory/modulos/<NomeComponente>.md
- Modulos alterados: atualizar o .md existente
- Decisoes arquiteturais: adicionar em C:/transnet memory/decisions.md
- Deploy, infra, banco: atualizar C:/transnet memory/deploy.md
- Pessoas/usuarios: atualizar C:/transnet memory/people.md
