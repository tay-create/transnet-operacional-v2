# PlanejamentoDelta — substituir planilha "Operação Maio/2026" — Design Spec

**Data:** 2026-05-19
**Alvo de produção:** 1º de junho de 2026 (13 dias)
**Branch alvo:** `develop` (cada sprint mergeada em `main` separadamente)

---

## Contexto

Hoje o planejamento operacional da Transnet usa uma planilha Google Sheets ("Operação Maio/2026") com várias abas. As duas abas que importam para esta feature são **DELTA-PORCELANA** (33 colunas, range A9:AG) e **ELETRIK** (24 colunas, range A11:O, com bloco financeiro extra em S-V).

Cada linha-grupo na planilha representa uma rota com 1+ destinos. Tem forward-fill de número de rota, dashboard manual de KPIs no topo, dados de cliente/notas fiscais por destino, e (na ELETRIK) valores de carga/frete e status financeiro.

**Problema:** o sistema Transnet Operacional v2 atualmente lê essa planilha via API (`src/utils/geradorRotas.js`) só para popular destinos em cards e pré-preencher modais. O planejamento edita tudo manualmente na planilha. Isso gera double-source-of-truth com latência (cache 60s), bugs ocasionais ("regenerar rota", "Col AC sem data"), e o risco de erros de digitação que só são pegos quando a coleta é lançada.

**Solução:** substituir as duas abas operacionais (DELTA-PORCELANA + ELETRIK; sem LEÃO) por uma UI dentro do próprio sistema, reusando a arquitetura do `PlanejamentoTramontina` que já existe e funciona em produção. A partir de 1º de junho, planejamento e Pos-Embarque editam diretamente no sistema. A planilha de maio fica como histórico read-only.

**Resultado esperado:**
- Eliminação da dependência da planilha Google Sheets para o fluxo operacional Tramontina
- Single source of truth: tabelas `tramontina_rotas` + `tramontina_rota_entregas` (renomeação fica pra depois)
- Pos-Embarque ganha autonomia pra editar status financeiro e valores sem precisar pedir pra alguém mexer na planilha
- Sistema continua se integrando consigo mesmo: o gerador de rotas OSRM passa a ler do banco

---

## Decisões travadas (do brainstorming)

1. **Escopo de abas:** DELTA-PORCELANA + ELETRIK (sem LEÃO). LEÃO não é tratada hoje como aba separada no gerador e fica fora do MVP.
2. **Reuso de tabelas:** as tabelas `tramontina_rotas` e `tramontina_rota_entregas` ganham uma coluna `aba_origem` (default `'DELTA-PORCELANA'`). Não criamos tabelas novas. Mesmo componente `PlanejamentoTramontina.js` ganha seletor de aba.
3. **Estratégia de transição:** sem importação one-shot, sem sincronização bidirecional. A planilha de maio é arquivada; em junho o sistema começa zerado. Planejamento cadastra rotas direto no sistema.
4. **Cronograma:** MVP em 13 dias, faseado em 4 sprints, cada uma de `develop → main → prod` isoladamente.
5. **Estrutura de dados (campos financeiros):** colunas regulares normais (sem JSON), ficando NULL quando não aplicável (aba DELTA-PORCELANA não usa os 4 campos novos).
6. **Status:** dois campos separados — `status_embarque` (operacional, ambas abas) e `status_financeiro` (só ELETRIK).
7. **Permissões:** 3 novas keys (`delta_ver`, `delta_editar_operacional`, `delta_editar_financeiro`). Pos-Embarque entra como editor (operacional E financeiro).
8. **UI:** cards expansíveis (não grid horizontal), múltiplos cards expandidos simultaneamente.
9. **Bloco financeiro:** visível só quando aba=ELETRIK.
10. **KPIs financeiros:** só quando aba=ELETRIK.
11. **Integração com gerador de rotas:** incluída no MVP (Sprint 3) via env var `GERADOR_FONTE=banco|planilha`.
12. **Importação XLSX:** modal existente do Tramontina fica escondido na UI durante MVP (não vai ser usado em junho).
13. **Cálculo de representatividade:** GENERATED ALWAYS AS STORED no banco — fórmula `(valor_frete / valor_carga) * 100` com guarda de NULL/zero.
14. **Sidebar:** entrada "Planejamento Tramontina" renomeada para **"Planejamento"** (slug `planejamento`). Toggle DELTA-PORCELANA / ELETRIK fica dentro da tela. Não há entrada separada nova.

---

## Modelo de Dados

### Migration (1 arquivo em `src/database/migrations.js`)

```sql
-- Sprint 1: extensões nas tabelas existentes do Tramontina

-- Aba de origem (distingue DELTA-PORCELANA vs ELETRIK)
ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS aba_origem TEXT DEFAULT 'DELTA-PORCELANA';
CREATE INDEX IF NOT EXISTS idx_tramontina_rotas_aba ON tramontina_rotas(aba_origem);

-- Campos financeiros (só ELETRIK preenche)
ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS status_financeiro TEXT
    CHECK (status_financeiro IS NULL OR status_financeiro IN ('CONCLUIDO', 'EM_ROTA_DE_ENTREGA', 'PENDENTE'));
ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS valor_carga NUMERIC(14,2);
ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(14,2);

-- Representatividade calculada pelo banco
ALTER TABLE tramontina_rotas ADD COLUMN IF NOT EXISTS representatividade_pct NUMERIC(7,2)
    GENERATED ALWAYS AS (
        CASE
            WHEN valor_carga IS NOT NULL AND valor_carga > 0 AND valor_frete IS NOT NULL
            THEN (valor_frete / valor_carga) * 100
            ELSE NULL
        END
    ) STORED;

-- Permissões novas
INSERT INTO permissoes (cargo, permissao) VALUES
    ('Direção', 'delta_ver'),
    ('Coordenador', 'delta_ver'),
    ('Planejamento', 'delta_ver'),
    ('Desenvolvedor', 'delta_ver'),
    ('Pos-Embarque', 'delta_ver'),
    ('Coordenador', 'delta_editar_operacional'),
    ('Planejamento', 'delta_editar_operacional'),
    ('Desenvolvedor', 'delta_editar_operacional'),
    ('Pos-Embarque', 'delta_editar_operacional'),
    ('Coordenador', 'delta_editar_financeiro'),
    ('Planejamento', 'delta_editar_financeiro'),
    ('Pos-Embarque', 'delta_editar_financeiro'),
    ('Desenvolvedor', 'delta_editar_financeiro')
ON CONFLICT DO NOTHING;
```

### Mapeamento campo planilha → coluna banco

**DELTA-PORCELANA (já modelado em `tramontina_rotas` + `tramontina_rota_entregas`):**

| Planilha | Coluna banco | Tabela | Notas |
|---|---|---|---|
| A — ROTA | `numero_rota` | rotas | int |
| E — COLETA | `coleta` | rotas | texto (pode ter múltiplas separadas por espaço) |
| F — DATA CRIAÇÃO | `data_criacao` | rotas | date |
| G — DATA PREVISÃO | `data_prevista` | rotas | date |
| H — DATA EMBARQUE | `data_embarque` | rotas | date (NULL = ainda não embarcou) |
| I — CIDADE | `cidade` | entregas | uma por entrega (linhas-filhas) |
| J — UF | `uf` | entregas | |
| K — REGIÃO | `regiao` | entregas | |
| L — OP | `operacao_codigo` | rotas | D/DC/PC/P/DL/PL |
| V — CLIENTE | `cliente` | entregas | |
| W — NOTAS FISCAIS | `notas_fiscais` | entregas | texto livre |
| X — AGENDA | `status_agendamento` | entregas | AG/S_AG/CONFIRMADO |
| AB — DATA (agendamento) | `data_entrega_cliente` | entregas | |
| AC — ENTREGAS | (não armazenado — calculado: count(entregas)) | | |
| AD — VEÍCULO | `tipo_veiculo` | rotas | CARRETA/TRUCK/3-4 |
| AE — MOTORISTA | `motorista_nome` | rotas | |
| AF — REDESPACHO | `redespacho` | rotas | texto |
| AG — OBSERVAÇÕES | `observacao` | rotas | texto |
| D — E (embarcado flag) | (não armazenado — derivado: status_embarque='EMBARCADA') | | |

**ELETRIK (campos extras além dos comuns):**

| Planilha | Coluna banco | Tabela | Notas |
|---|---|---|---|
| K — VOLUMES | (não modelado no MVP, ignorar) | | |
| S — STATUS | `status_financeiro` | rotas | enum: CONCLUIDO / EM_ROTA_DE_ENTREGA / PENDENTE |
| T — VALOR CARGA | `valor_carga` | rotas | NUMERIC(14,2) |
| U — VALOR DO FRETE | `valor_frete` | rotas | NUMERIC(14,2) |
| V — REPREST.(%) | `representatividade_pct` | rotas | GENERATED — não aceita escrita |

---

## Endpoints

### Alterações em `src/routes/tramontina.js`

**`GET /api/tramontina/rotas?mes=YYYY-MM&aba=DELTA-PORCELANA|ELETRIK`**
- Aceita query param novo `aba` (default `DELTA-PORCELANA` pra retrocompat com Tramontina existente)
- Adiciona filtro `WHERE aba_origem = $aba` na query
- Auth: aceita `delta_ver` **OU** `tramontina_planejamento` (permissão antiga continua funcionando — usuários antigos não perdem acesso. Usamos `authorize(['delta_ver','tramontina_planejamento'])` no middleware se ele aceita OR; caso contrário, escrevemos um guard manual no handler.)

**`POST /api/tramontina/rotas`**
- Body pode incluir `aba_origem` (string), `status_financeiro`, `valor_carga`, `valor_frete`
- Se body tem qualquer campo financeiro:
  - Backend valida que `req.user` tem `delta_editar_financeiro`
  - Se não tiver → 403 com mensagem clara
- Auth básica: `delta_editar_operacional`

**`PUT /api/tramontina/rotas/:id`**
- Mesma lógica do POST: campos financeiros = 403 sem `delta_editar_financeiro`
- Recalcula `lead_status` das entregas se `data_embarque` mudou (lógica já existe)
- `representatividade_pct` ignorado se vier no body (GENERATED no banco)

**`GET /api/tramontina/kpis?mes=YYYY-MM&aba=...`**
- Quando `aba === 'ELETRIK'`, response inclui:
  ```json
  {
    ...kpis_atuais,
    "total_mercadoria": 1587403.93,
    "total_frete": 91960.00,
    "repres_media": 5.79
  }
  ```
- `repres_media` = AVG não-ponderada de `representatividade_pct` das rotas que têm valor.

**Endpoints `/entregas` e o resto continuam iguais** — entregas não têm campos financeiros nem aba (a aba fica na rota-pai).

---

## Frontend

### Refactor de `src/components/PlanejamentoTramontina.js`

O componente atual usa uma table HTML manual com linhas expandíveis. Vamos:

1. **Adicionar state `abaAtiva`** (default 'DELTA-PORCELANA') e seletor de toggle no header
2. **Substituir a table por lista de `<CardRota>`** — componente novo extraído em `src/components/planejamento/CardRota.js`
3. **`<CardRota>` props:** `{ rota, expanded, onToggle, onEdit, podeEditarOperacional, podeEditarFinanceiro, abaAtiva, motoristas }`
4. **State `expandidas: Set<number>`** já existe — reusamos
5. **KPIs strip horizontal acima dos cards** — componente novo `<KpisStrip aba={abaAtiva} kpis={kpis} />`
6. **Botão flutuante `+ Nova rota`** posicionado bottom-right (substitui o botão atual no header — fica mais à mão)
7. **Filtros existentes preservados** + filtro `status_financeiro` (só aparece se aba=ELETRIK)
8. **Modal `ModalImportarTramontina`** — o botão `<button>Importar XLSX</button>` no header da tela é **removido do JSX** durante o MVP (não basta `display:none` porque os ícones e shortcut adjacentes precisam reposicionar). O componente do modal continua importado e disponível pra reativar no pós-MVP — basta voltar a renderizar o botão. Decisão de remover renderização (vs. esconder com CSS): mais limpo, sem CSS dead code.

### Componente `<CardRota>` — estrutura

```jsx
<div className="card-rota">
  {/* HEADER (sempre visível) */}
  <div className="card-rota-header" onClick={onToggle}>
    <span className="numero-rota">#{rota.numero_rota}</span>
    <span className="motorista">{rota.motorista_nome}</span>
    <span className="veiculo">{rota.tipo_veiculo}</span>
    <span className={`status status-${rota.status_embarque}`}>{rota.status_embarque}</span>
    <span className="coleta-principal">Coleta {rota.coleta}</span>
    <span className="primeiro-destino">{primeiroDestino?.cidade}/{primeiroDestino?.uf}</span>
    {abaAtiva === 'ELETRIK' && rota.valor_carga && (
      <span className="resumo-financeiro">
        💰 {formatBRL(rota.valor_carga)} · Frete {formatBRL(rota.valor_frete)} ({rota.representatividade_pct?.toFixed(2)}%)
      </span>
    )}
    <ChevronDown style={{transform: expanded ? 'rotate(180deg)' : ''}} />
  </div>

  {/* EXPANDIDO */}
  {expanded && (
    <>
      <BlocoDadosRota rota={rota} podeEditar={podeEditarOperacional} ... />
      <BlocoDestinos rota={rota} podeEditar={podeEditarOperacional} ... />
      {abaAtiva === 'ELETRIK' && (
        <BlocoFinanceiro rota={rota} podeEditar={podeEditarFinanceiro} ... />
      )}
    </>
  )}
</div>
```

### Detalhes UX

- **Múltiplos cards expandidos simultâneos**: ok, sem auto-collapse
- **Inputs disabled** quando user não tem permissão (visual acinzentado, tooltip "Você não tem permissão")
- **Representatividade**: input read-only sempre (calculado no banco). Atualiza via fetch após salvar valor_carga/valor_frete (debounce 300ms)
- **Currency input**: campo aceita `R$ 1.234,56` no input mas envia número (`1234.56`) ao backend. Helper de parse/format BRL.
- **Animação expand/collapse**: `max-height` com transition CSS (300ms ease)
- **Real-time**: cards atualizam automaticamente via Socket.io quando outro user edita (já implementado pro Tramontina, herda)

### KPIs strip

```jsx
<div className="kpis-strip">
  <KpiCard label="Total rotas" value={kpis.total_rotas} />
  <KpiCard label="Programadas" value={kpis.programadas} color="blue" />
  <KpiCard label="Embarcadas" value={kpis.embarcadas} color="green" />
  <KpiCard label="Pendentes" value={kpis.pendentes} color="orange" />
  <KpiCard label="Entregas ANTECIPADAS" value={kpis.lead.antecipado} small />
  <KpiCard label="Entregas DENTRO" value={kpis.lead.dentro} small />
  <KpiCard label="Entregas FORA" value={kpis.lead.fora} small color="red" />

  {abaAtiva === 'ELETRIK' && (
    <>
      <KpiCard label="R$ Mercadoria" value={formatBRL(kpis.total_mercadoria)} highlight />
      <KpiCard label="R$ Frete" value={formatBRL(kpis.total_frete)} highlight />
      <KpiCard label="Repres. média" value={`${kpis.repres_media?.toFixed(2)}%`} highlight />
    </>
  )}
</div>
```

---

## Integração com gerador de rotas

### `src/utils/geradorRotas.js`

Hoje `buscarRotaPorColeta(coleta, sheetId)` lê do Sheets. Vamos adicionar fonte alternativa via env var.

```js
async function buscarRotaPorColeta(coleta, sheetIdOuMes) {
    if (process.env.GERADOR_FONTE === 'banco') {
        // Aceita tanto 'YYYY-MM' direto quanto o sheetId que o caller atual passa.
        // Se vier sheetId, o banco já tem mapeamento mes→sheet_id em resultado_sheets;
        // fazemos lookup reverso pra descobrir o mês. Pra MVP, simplificamos: caller que
        // usar banco passa diretamente o mês (assinatura nova). Adaptamos os 3 callers
        // existentes em src/routes/veiculos.js pra passar mes em vez de sheetId.
        return buscarRotaPorColetaNoBanco(coleta, sheetIdOuMes);
    }
    // ... código atual lendo Sheets via lerPlanilha
}

async function buscarRotaPorColetaNoBanco(coleta, mes) {
    const rota = await dbGet(`
        SELECT r.*, json_agg(
            json_build_object(
                'cidade', e.cidade, 'uf', e.uf, 'regiao', e.regiao,
                'cliente', e.cliente, 'notas_fiscais', e.notas_fiscais,
                'data', e.data_entrega_cliente
            ) ORDER BY e.id
        ) AS destinos
        FROM tramontina_rotas r
        LEFT JOIN tramontina_rota_entregas e ON e.rota_id = r.id
        WHERE r.coleta LIKE $1 AND r.mes_referencia = $2
        GROUP BY r.id
    `, [`%${coleta}%`, mes]);

    if (!rota) return null;

    return {
        rota: rota.numero_rota,
        destinos: rota.destinos.filter(d => d.cidade),
        fonte: 'banco',
    };
}
```

`buscarEntregasAgendadasPorColeta` ganha tratamento análogo.

### Como ativar

- Em **staging**: env var `GERADOR_FONTE=banco` no `.env.staging`. Sprint 3 testa com flag ligada.
- Em **produção**: na transição (sábado 31 maio), atualizar `/opt/transnet/prod/.env.prod` com `GERADOR_FONTE=banco` + `docker compose up -d` (restart).
- Em **dev local**: continua sem a env (default = planilha), facilita debug.

---

## Arquivos a criar / modificar

| Arquivo | Sprint | Mudança |
|---|---|---|
| `src/database/migrations.js` | 1 | Migration ALTER TABLE + INSERT permissoes |
| `src/routes/tramontina.js` | 1 | Aceitar `?aba=`, campos financeiros com guard, KPIs estendidos |
| `src/utils/tramontinaLeadTime.js` | (sem mudanças) | — |
| `src/components/PlanejamentoTramontina.js` | 2 | Refactor pra cards, seletor de aba, esconder import |
| `src/components/planejamento/CardRota.js` | 2 | **NOVO** — card expansível |
| `src/components/planejamento/BlocoDadosRota.js` | 2 | **NOVO** — bloco edição dados rota |
| `src/components/planejamento/BlocoDestinos.js` | 2 | **NOVO** — lista entregas + add |
| `src/components/planejamento/BlocoFinanceiro.js` | 2 | **NOVO** — só ELETRIK |
| `src/components/planejamento/KpisStrip.js` | 2 | **NOVO** — KPIs horizontais |
| `src/utils/formatBRL.js` | 2 | **NOVO** — helper formatar/parsear R$ |
| `src/utils/geradorRotas.js` | 3 | Despachante `GERADOR_FONTE` + `buscarRotaPorColetaNoBanco` |
| `.github/workflows/deploy-staging.yml` | 3 | Adicionar `GERADOR_FONTE=banco` no `.env.staging` |
| `/opt/transnet/prod/.env.prod` | 4 (manual) | Adicionar `GERADOR_FONTE=banco` no dia 31/05 + restart |

---

## Cronograma de Sprints

| Sprint | Dias | Datas | Entrega | Merge |
|---|---|---|---|---|
| **1 — Backend** | 2 dias úteis | 21-22 maio (qua-qui) | Migration + endpoints + permissões | `develop → main` |
| **2 — Frontend cards** | 3 dias | 23-25 maio (sex-dom) | Cards expansíveis + seletor de aba + KPIs | `develop → main` |
| **3 — Integração gerador** | 2 dias úteis | 26-27 maio (seg-ter) | `GERADOR_FONTE=banco` funcional em staging | `develop → main` |
| **4 — Polish** | 2 dias úteis | 28-29 maio (qua-qui) | Bugs + filtros + tooltips | `develop → main` |
| **Validação prod** | 1 dia | 30 maio (sex) | Time real testa em produção | (hotfix se preciso) |
| **Flip env var** | 1 dia | 31 maio (sáb) | Restart prod com `GERADOR_FONTE=banco` + smoke test | (config manual) |
| **Go live** | 1 dia | 1 junho (seg) | Planejamento começa o mês no sistema | — |

Buffer: fins de semana 23-24-30-31 disponíveis se precisar.

---

## Verificação end-to-end

**Sprint 1:**
- Migration roda sem erro em staging (`docker logs transnet-staging | grep -i error` deve estar limpo)
- `GET /api/tramontina/rotas?aba=ELETRIK&mes=2026-06` retorna `{ "rotas": [] }` sem 500
- `POST /api/tramontina/rotas` aceita body com `aba_origem='ELETRIK'`, `valor_carga=1000.00`, `valor_frete=200.00` quando user tem `delta_editar_financeiro`. Verifica que `representatividade_pct` ficou `20.00` no banco.
- `POST` com financeiro mas sem permissão → 403.

**Sprint 2:**
- A entrada do Sidebar "Planejamento Tramontina" é renomeada para **"Planejamento"** (slug `planejamento`, mantendo retrocompat com slug antigo `planejamento_tramontina` se algum link externo apontar). Tela carrega sem erros JS.
- Seletor de aba alterna entre DELTA-PORCELANA e ELETRIK; lista de cards muda
- Click no card expande (animação suave); múltiplos abertos OK
- Aba ELETRIK mostra bloco FINANCEIRO; aba DELTA-PORCELANA não mostra
- KPIs strip mostra valores; quando aba=ELETRIK adiciona 3 financeiros
- User Pos-Embarque consegue editar financeiro; user Encarregado não vê os inputs (ou vê desabilitados)
- Real-time: abrir em 2 abas do navegador, editar numa, ver atualizar na outra

**Sprint 3:**
- Em staging com `GERADOR_FONTE=banco`: cadastrar rota fake no PlanejamentoDelta com coleta `9999`, cidade `RECIFE/PE`. Lançar card com coleta `9999`. Verificar que `destinos_json` do card foi populado com RECIFE/PE.
- Mesmo cenário com `GERADOR_FONTE=planilha`: deve voltar a ler do Sheets (rota não existe lá, retorna sem-coleta).

**Sprint 4:**
- Filtros UI funcionais (UF, região, status_embarque, status_financeiro quando aba=ELETRIK)
- Botão `+ Nova rota` flutuante cria rota nova ao clicar
- Validações de campo (data inválida, valor negativo, etc.)
- Vazio: aba sem rotas mostra mensagem "Nenhuma rota cadastrada"

**Go live (1 junho):**
- Sidebar mostra item "Planejamento Delta" pra users com `delta_ver`
- Planejamento cria primeira rota de junho
- Card lançado com coleta dessa rota busca destinos do banco (gerador conferido)

---

## Memória / Obsidian

Ao final da implementação, criar/atualizar em `C:/transnet memory/`:
- `modulos/PlanejamentoDelta.md` — **novo**, descreve a feature
- `modulos.md` — adicionar entrada na seção "Planejamento" do índice
- `decisions.md` — registrar:
  - "Substituição da planilha Operação/Maio por PlanejamentoDelta — reuso de tabelas Tramontina via `aba_origem`"
  - "GERADOR_FONTE env var como switch entre Sheets e banco"
  - "Representatividade calculada via GENERATED ALWAYS AS STORED — não permite escrita externa"
- `people.md` — Pos-Embarque ganha papel de editor financeiro
