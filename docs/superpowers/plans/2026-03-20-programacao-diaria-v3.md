# Programação Diária v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a geração automática por cron (10h/17h) por dois botões manuais — "Gerar Inicial" e "Gerar Final" — com lógica de classificação revisada usando o novo campo `data_prevista_original`.

**Architecture:** Quatro mudanças em camadas independentes: (1) migration de banco adiciona coluna `data_prevista_original` em `veiculos`; (2) backend refatora `gerarProgramacaoDiaria` com nova lógica e adiciona endpoint POST + remove crons; (3) `src/routes/veiculos.js` grava o novo campo na criação; (4) frontend adiciona payload no lançamento e botões no painel.

**Tech Stack:** Node.js/Express, PostgreSQL, React 18, `dbRun`/`dbAll` helpers (src/database/db.js), `authMiddleware` + `authorize` (middleware/authMiddleware.js), `api` (src/services/apiService.js)

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/database/migrations.js` | Adicionar `data_prevista_original TEXT` ao `colunasParaAdicionar` |
| `server.js` | Remover 2 crons, refatorar `gerarProgramacaoDiaria`, adicionar endpoint POST |
| `src/routes/veiculos.js` | Incluir `data_prevista_original` no INSERT do `POST /veiculos` |
| `src/App.js` | Incluir `data_prevista_original` no payload de criação |
| `src/components/PainelProgramacao.js` | Adicionar estado `gerando`, função `gerarProgramacao`, dois botões |

---

## Contexto crítico para o implementador

- **`dbRun(sql, params)`** — executa INSERT/UPDATE/DELETE; retorna `{ lastID, changes }`.
- **`dbAll(sql, params)`** — executa SELECT; retorna array de rows. Aceita `[]` como params vazio.
- **`authMiddleware`** — valida JWT; popula `req.user`.
- **`authorize(roles)`** — middleware que checa `req.user.cargo` contra o array. Roles reais do sistema: `'Coordenador'`, `'Planejamento'`, `'Encarregado'`, `'Aux. Operacional'`, `'Conhecimento'`, `'Cadastro'`, `'Conferente'`, `'Pos Embarque'`, `'Dashboard Viewer'`. (O spec usa nomes genéricos — usar os nomes reais abaixo.)
- **`hojeStr`** — data local Brasília em YYYY-MM-DD: `new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(',')[0]`
- **Tabela `frota_programacao_diaria`** — colunas: `id SERIAL PK`, `data_referencia TEXT`, `turno TEXT`, `dados_json TEXT`, `data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- **`dados_json` format:**
  ```json
  { "Delta": { "recife": 0, "moreno": 0, "reprogramado_recife": 0, "reprogramado_moreno": 0 }, "Porcelana": {...}, "Eletrik": {...}, "Consolidados": {...} }
  ```
- **`enviarNotificacao(tipo, dados)`** — função global já existente em `server.js`; usar igual à versão atual da função.
- **`colunasParaAdicionar`** — array em `src/database/migrations.js` linha ~119; cada item `{ tabela, coluna, tipo }`.
- **INSERT atual de veículos** — `src/routes/veiculos.js` linha ~226; tem 32 colunas e 32 `?` placeholders.
- **Placeholders SQL:** O wrapper `dbRun`/`dbAll` em `src/database/db.js` converte automaticamente `?` para `$1`, `$2`, etc. (via `convertSql`). **Todo SQL neste plano usa `?`** — padrão exclusivo em toda a codebase. Não usar `$N` diretamente.
- **Roles reais do sistema:** Os cargos são `'Coordenador'`, `'Planejamento'`, `'Encarregado'`, `'Aux. Operacional'`, `'Conhecimento'`, `'Cadastro'`, `'Conferente'`, `'Pos Embarque'`, `'Dashboard Viewer'`. O spec usa nomes genéricos (`admin`, `supervisor`, `operador`) que não existem — **este plano é a fonte de verdade para os nomes de roles**.

---

## Task 1: Migration — adicionar `data_prevista_original`

**Arquivos:**
- Modify: `src/database/migrations.js` (linha ~187, ao final do array `colunasParaAdicionar`)

**O que fazer:** Adicionar um item ao array `colunasParaAdicionar` para criar a coluna `data_prevista_original TEXT` na tabela `veiculos`. Veículos existentes ficam com `NULL` (tratados como Programados).

> Nota: não há testes automatizados de banco neste projeto — verificação é manual via restart do servidor.

- [ ] **Step 1: Adicionar item ao array `colunasParaAdicionar`**

  Localizar o fim do array `colunasParaAdicionar` (última entrada é `cte_antecipado_moreno` por volta da linha 186). Adicionar **após** o último item existente, antes do `];`:

  ```js
  // Programação Diária v3 — data original para classificar Programado vs Reprogramado
  { tabela: 'veiculos', coluna: 'data_prevista_original', tipo: 'TEXT' },
  ```

- [ ] **Step 2: Verificar que a migration roda no startup**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 20 --nostream"
  ```

  Esperado: sem erros, linha `✅ Banco pronto com permissões atualizadas!` presente.

  Se houver erro de sintaxe JS, corrigir antes de continuar.

- [ ] **Step 3: Confirmar coluna no banco**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && PGPASSWORD=124578595 psql -U postgres -d transnet -c \"\\d veiculos\" | grep data_prevista"
  ```

  Esperado: duas linhas — `data_prevista` e `data_prevista_original`.

- [ ] **Step 4: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/database/migrations.js && git commit -m 'feat: migration data_prevista_original em veiculos'"
  ```

---

## Task 2: Backend — refatorar `gerarProgramacaoDiaria` e remover crons

**Arquivos:**
- Modify: `server.js` (linhas ~1763–1826)

**O que fazer:**
1. Atualizar o comentário do bloco (era "CRON Jobs", agora é "PROGRAMAÇÃO DIÁRIA (Manual)")
2. Reescrever a função `gerarProgramacaoDiaria(turno)` com dois caminhos: `'Inicial'` e `'Final'`
3. Remover as duas linhas `cron.schedule` para 10h e 17h (linhas ~1825–1826)

**Lógica Inicial:**
- Query filtra `LEFT(data_prevista, 10) = hojeStr` **E** exclui status FINALIZADO/Despachado/Em Trânsito/Entregue/LIBERADO P/ CT-e/CARREGADO de ambas unidades
- Classificação: `foiReprogramado` = `data_prevista_original` não-nulo E `data_prevista_original.substring(0,10) !== data_prevista.substring(0,10)`
- Se reprogramado → incrementa `reprogramado_recife` ou `reprogramado_moreno`
- Se não → incrementa `recife` ou `moreno`

**Lógica Final:**
- Query retorna todos os veículos ativos (sem filtro de data), excluindo apenas FINALIZADO/Despachado/Em Trânsito/Entregue
- Todo veículo incrementa apenas `recife` ou `moreno` (reprogramados sempre 0)

**Idempotência:** antes do INSERT, DELETE o registro existente com mesmo `(data_referencia, turno)`.

- [ ] **Step 1: Reescrever a função `gerarProgramacaoDiaria`**

  Substituir completamente o bloco da função (linhas ~1763–1822) e as duas linhas de cron (linhas ~1824–1826) pelo seguinte:

  ```js
  // ── PROGRAMAÇÃO DIÁRIA (Manual) ──────────────────────────────────────
  async function gerarProgramacaoDiaria(turno) {
      try {
          console.log(`[PROG] Iniciando Programação Diária - Turno: ${turno}`);
          const hojeStr = new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(',')[0];

          const totais = {
              Delta:        { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
              Porcelana:    { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
              Eletrik:      { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
              Consolidados: { recife: 0, moreno: 0, reprogramado_recife: 0, reprogramado_moreno: 0 },
          };

          let rows;
          if (turno === 'Inicial') {
              rows = await dbAll(`
                  SELECT id, unidade, operacao, data_prevista, data_prevista_original
                  FROM veiculos
                  WHERE LEFT(data_prevista, 10) = ?
                    AND (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
                    AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue','LIBERADO P/ CT-e','CARREGADO'))
              `, [hojeStr]);

              rows.forEach(v => {
                  const op = (v.operacao || '').toUpperCase();
                  let cliente = 'Consolidados';
                  if (op.includes('DELTA')) cliente = 'Delta';
                  else if (op.includes('PORCELANA')) cliente = 'Porcelana';
                  else if (op.includes('ELETRIK')) cliente = 'Eletrik';

                  const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';

                  const foiReprogramado =
                      v.data_prevista_original !== null &&
                      v.data_prevista_original !== undefined &&
                      v.data_prevista_original.substring(0, 10) !== v.data_prevista.substring(0, 10);

                  if (foiReprogramado) {
                      totais[cliente][`reprogramado_${un}`] += 1;
                  } else {
                      totais[cliente][un] += 1;
                  }
              });

          } else { // Final
              rows = await dbAll(`
                  SELECT id, unidade, operacao
                  FROM veiculos
                  WHERE (status_recife IS NULL OR status_recife NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
                    AND (status_moreno IS NULL OR status_moreno NOT IN ('FINALIZADO','Despachado','Em Trânsito','Entregue'))
              `, []);

              rows.forEach(v => {
                  const op = (v.operacao || '').toUpperCase();
                  let cliente = 'Consolidados';
                  if (op.includes('DELTA')) cliente = 'Delta';
                  else if (op.includes('PORCELANA')) cliente = 'Porcelana';
                  else if (op.includes('ELETRIK')) cliente = 'Eletrik';

                  const un = v.unidade === 'Moreno' ? 'moreno' : 'recife';
                  totais[cliente][un] += 1;
              });
          }

          // Idempotência: apagar snapshot anterior do mesmo (data, turno) antes de inserir
          await dbRun(
              'DELETE FROM frota_programacao_diaria WHERE data_referencia = ? AND turno = ?',
              [hojeStr, turno]
          );

          const dados_json = JSON.stringify(totais);
          await dbRun(
              'INSERT INTO frota_programacao_diaria (data_referencia, turno, dados_json) VALUES (?, ?, ?)',
              [hojeStr, turno, dados_json]
          );

          enviarNotificacao('programacao_gerada', { turno, data_referencia: hojeStr, data_criacao: new Date().toISOString() });
          console.log(`[PROG] Programação Diária (${turno}) concluída. ${rows.length} veículos processados.`);
          return { turno, data_referencia: hojeStr };
      } catch (e) {
          console.error(`[PROG] Erro ao gerar programação diária:`, e);
          throw e;
      }
  }
  ```

- [ ] **Step 2: Remover as duas linhas de cron de 10h/17h**

  Remover exatamente estas duas linhas (ficam logo após a função):
  ```js
  // Rodar de seg a sex (1-5), às 10:00 e 17:00
  cron.schedule('0 10 * * 1-5', () => gerarProgramacaoDiaria('10h'), { scheduled: true, timezone: "America/Sao_Paulo" });
  cron.schedule('0 17 * * 1-5', () => gerarProgramacaoDiaria('17h'), { scheduled: true, timezone: "America/Sao_Paulo" });
  ```

  Manter o comentário de separação do próximo bloco intacto.

- [ ] **Step 3: Verificar que o servidor sobe sem erro**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 20 --nostream"
  ```

  Esperado: sem erros de sintaxe, `✅ Banco pronto` visível, nenhum `[CRON]` ou `Error` novo.

- [ ] **Step 4: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add server.js && git commit -m 'feat: gerarProgramacaoDiaria v3 (Inicial/Final), remove crons 10h/17h'"
  ```

---

## Task 3: Backend — endpoint POST `/api/programacao-diaria/gerar`

**Arquivos:**
- Modify: `server.js` (logo após o GET `/api/programacao-diaria`, por volta da linha ~1987)

**O que fazer:** Adicionar rota POST que chama `gerarProgramacaoDiaria(turno)`. Restrita a `Coordenador` e `Planejamento` (os papéis que gerenciam programação). Valida que turno é `'Inicial'` ou `'Final'`.

- [ ] **Step 1: Adicionar endpoint POST logo após o GET existente**

  Localizar o bloco do GET `/api/programacao-diaria` (~linha 1974). Imediatamente após o fechamento `});` desse GET, inserir:

  ```js
  app.post('/api/programacao-diaria/gerar', authMiddleware, authorize(['Coordenador', 'Planejamento']), async (req, res) => {
      const { turno } = req.body;
      if (turno !== 'Inicial' && turno !== 'Final') {
          return res.status(400).json({ success: false, message: "turno deve ser 'Inicial' ou 'Final'" });
      }
      try {
          const resultado = await gerarProgramacaoDiaria(turno);
          res.json({ success: true, turno: resultado.turno, data_referencia: resultado.data_referencia });
      } catch (e) {
          res.status(500).json({ success: false, message: e.message });
      }
  });
  ```

- [ ] **Step 2: Testar o endpoint manualmente**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 5 --nostream"
  ```

  Confirmar que o servidor subiu sem erro. O endpoint será testado pelo frontend na Task 5.

- [ ] **Step 3: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add server.js && git commit -m 'feat: endpoint POST /api/programacao-diaria/gerar'"
  ```

---

## Task 4: Backend — gravar `data_prevista_original` no INSERT de veículos

**Arquivos:**
- Modify: `src/routes/veiculos.js` (INSERT por volta das linhas ~226–258)

**O que fazer:** Adicionar `data_prevista_original` como 33ª coluna no INSERT, recebendo `v.data_prevista_original` do body (enviado pelo frontend na Task 5). A coluna deve ser adicionada tanto na lista de colunas quanto nos values, totalizando 33 `?` placeholders (o wrapper converte para `$N` automaticamente).

- [ ] **Step 1: Adicionar `data_prevista_original` ao INSERT**

  No INSERT de veículos (`src/routes/veiculos.js` ~linha 226), alterar:

  **Colunas** — adicionar `data_prevista_original` após `dados_json`:
  ```js
  const query = `INSERT INTO veiculos (
      placa, modelo, motorista, status_recife, status_moreno,
      doca_recife, doca_moreno, coleta, coletaRecife, coletaMoreno,
      rota_recife, rota_moreno, numero_coleta,
      unidade, operacao, inicio_rota, origem_criacao, data_prevista,
      data_criacao, tempos_recife, tempos_moreno, status_coleta,
      observacao, imagens,
      chk_cnh, chk_antt, chk_tacografo, chk_crlv,
      situacao_cadastro, numero_liberacao, data_liberacao,
      dados_json, data_prevista_original
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  ```

  **Values** — adicionar `v.data_prevista_original || v.data_prevista` ao final do array (fallback para `data_prevista` garante que mesmo que o frontend não envie o campo, o valor correto seja gravado):
  ```js
  const values = [
      v.placa || 'NÃO INFORMADA', v.modelo, v.motorista, v.status_recife, v.status_moreno,
      v.doca_recife, v.doca_moreno, v.coleta, v.coletaRecife, v.coletaMoreno,
      v.rotaRecife || '', v.rotaMoreno || '', v.numero_coleta || '',
      v.unidade, v.operacao, v.inicio_rota, v.origem_criacao, v.data_prevista,
      data_criacao,
      JSON.stringify(v.tempos_recife || {}),
      JSON.stringify(v.tempos_moreno || {}),
      JSON.stringify(v.status_coleta || {}),
      v.observacao || '',
      JSON.stringify(v.imagens || []),
      chk_cnh, chk_antt, chk_tacografo, chk_crlv,
      situacao_cadastro, numero_liberacao, data_liberacao,
      JSON.stringify({ ...v, telefoneMotorista, isFrotaMotorista, chk_cnh, chk_antt, chk_tacografo, chk_crlv, situacao_cadastro, numero_liberacao, data_liberacao }),
      v.data_prevista_original || v.data_prevista
  ];
  ```

- [ ] **Step 2: Verificar que o servidor sobe sem erro**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env && sleep 3 && pm2 logs transnet --lines 10 --nostream"
  ```

- [ ] **Step 3: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/routes/veiculos.js && git commit -m 'feat: grava data_prevista_original no INSERT de veiculos'"
  ```

---

## Task 5: Frontend — `data_prevista_original` no payload de criação (`src/App.js`)

**Arquivos:**
- Modify: `src/App.js` (função `lancarVeiculoInteligente`, por volta da linha ~618)

**O que fazer:** No objeto `novoItem` montado em `lancarVeiculoInteligente`, adicionar o campo `data_prevista_original` com o mesmo valor de `formLanca.data_prevista`. Isso garante que qualquer veículo criado daqui em diante tenha o campo gravado no banco.

> Nota: o spec usa `formData.data_prevista` mas a variável correta em `src/App.js` é `formLanca.data_prevista` — usar `formLanca`.

- [ ] **Step 1: Adicionar campo ao payload**

  Localizar o objeto `novoItem` (~linha 600). Após a linha `data_prevista: formLanca.data_prevista,`, adicionar:

  ```js
  data_prevista_original: formLanca.data_prevista,
  ```

- [ ] **Step 2: Build e verificação visual**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -5"
  ```

  Esperado: `Compiled successfully` sem erros.

- [ ] **Step 3: Restart PM2**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env"
  ```

- [ ] **Step 4: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/App.js && git commit -m 'feat: inclui data_prevista_original no payload de lancamento'"
  ```

---

## Task 6: Frontend — botões Gerar Inicial/Final em `PainelProgramacao.js`

**Arquivos:**
- Modify: `src/components/PainelProgramacao.js`

**O que fazer:** Adicionar estado `gerando`, função `gerarProgramacao`, e dois botões no header do painel. Após geração bem-sucedida, recarregar os dados chamando `carregarDados()` (já existe no componente).

- [ ] **Step 1: Adicionar estado `gerando`**

  No topo do componente, junto aos outros `useState` (~linha 22), adicionar:

  ```js
  const [gerando, setGerando] = useState(null); // 'Inicial' | 'Final' | null
  ```

- [ ] **Step 2: Adicionar função `gerarProgramacao`**

  Logo após o `useEffect` (~linha 41), adicionar:

  ```js
  const gerarProgramacao = async (turno) => {
      setGerando(turno);
      try {
          await api.post('/api/programacao-diaria/gerar', { turno });
          await carregarDados();
      } catch (e) {
          console.error('Erro ao gerar programação:', e);
          alert('Erro ao gerar programação. Verifique o console.');
      } finally {
          setGerando(null);
      }
  };
  ```

- [ ] **Step 3: Adicionar os dois botões no header**

  Localizar o botão de reload existente no header (que chama `carregarDados`, ~linha 84). Adicionar os dois novos botões **antes** do botão de reload existente:

  ```jsx
  <button
      onClick={() => gerarProgramacao('Inicial')}
      disabled={gerando === 'Inicial'}
      style={{ marginRight: '8px' }}
  >
      {gerando === 'Inicial' ? 'Gerando...' : 'Gerar Inicial'}
  </button>
  <button
      onClick={() => gerarProgramacao('Final')}
      disabled={gerando === 'Final'}
      style={{ marginRight: '8px' }}
  >
      {gerando === 'Final' ? 'Gerando...' : 'Gerar Final'}
  </button>
  ```

- [ ] **Step 4: Verificar display do turno**

  O componente atual exibe `turno` diretamente (ex.: `{p.turno}`). Como os novos valores são `'Inicial'` e `'Final'`, strings legíveis por si sós, **nenhuma mudança de display é necessária**. Apenas confirmar visualmente que não há conversão hardcoded de `'10h'`/`'17h'` que precisaria ser atualizada.

- [ ] **Step 5: Build**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && npm run build 2>&1 | tail -5"
  ```

  Esperado: `Compiled successfully`.

- [ ] **Step 6: Restart PM2**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && pm2 restart transnet --update-env"
  ```

- [ ] **Step 7: Commit**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git add src/components/PainelProgramacao.js && git commit -m 'feat: botões Gerar Inicial/Final no PainelProgramacao'"
  ```

---

## Task 7: Push e verificação final

- [ ] **Step 1: Push para o GitHub**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && git push"
  ```

- [ ] **Step 2: Verificação funcional em produção**

  1. Acessar https://portal.tnethub.com.br com usuário Coordenador ou Planejamento
  2. Navegar até a Programação Diária
  3. Clicar "Gerar Inicial" — botão deve mostrar "Gerando..." enquanto processa, depois voltar ao normal e a tabela deve atualizar
  4. Clicar "Gerar Final" — mesmo comportamento
  5. Confirmar que os snapshots aparecem na tabela com turno "Inicial" e "Final"
  6. Clicar "Gerar Inicial" de novo — deve sobrescrever sem duplicar (verificar que há apenas um registro Inicial para o dia)

- [ ] **Step 3: Criar novo veículo via NovoLançamento e confirmar `data_prevista_original`**

  ```bash
  wsl -d Ubuntu -- bash -c "cd /home/transnet/projects/transnet-operacional-v2 && PGPASSWORD=124578595 psql -U postgres -d transnet -c \"SELECT id, data_prevista, data_prevista_original FROM veiculos ORDER BY id DESC LIMIT 3\""
  ```

  O veículo mais recente deve ter `data_prevista_original` igual ao `data_prevista`.

---

## Notas de compatibilidade

- Snapshots legados com `turno = '10h'` ou `'17h'` continuam exibidos normalmente — nenhuma migração de dados.
- Veículos existentes com `data_prevista_original = NULL` são tratados como Programados (benefício da dúvida) — a condição `data_prevista_original !== null` no JS garante isso.
- O painel frontend (PainelProgramacao.js) já foi atualizado na v2 para suportar o formato `{ recife, moreno, reprogramado_recife, reprogramado_moreno }` — nenhuma mudança no display é necessária.
