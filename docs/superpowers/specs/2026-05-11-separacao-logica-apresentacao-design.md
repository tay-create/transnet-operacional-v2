# Separação Lógica/Apresentação — Domain Hooks + Utils

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extrair lógica de negócio e chamadas de API dos componentes React para utils puras e hooks de domínio, tornando os componentes mais finos, testáveis e reutilizáveis.

**Architecture:** Domain Hooks encapsulam fetch + estado de servidor; utils puras encapsulam regras de negócio sem efeitos colaterais; componentes ficam como consumidores de hooks e renderizadores de JSX.

**Branch:** `develop` — não tocar em `main`.

---

## Escopo

### Arquivos novos a criar

| Arquivo | Origem | Tipo |
|---|---|---|
| `src/utils/slaUtils.js` | `PainelPosEmbarque.js` | Utils puras |
| `src/utils/marcacoesUtils.js` | `GestaoMarcacoes.js` | Utils puras |
| `src/utils/frotaUtils.js` | `DashboardFrota.js` | Utils puras |
| `src/utils/operacaoUtils.js` | `PainelOperacional.js` | Utils puras |
| `src/hooks/usePosEmbarque.js` | — | Domain hook |
| `src/hooks/useMarcacoes.js` | — | Domain hook |

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/components/PainelPosEmbarque.js` | Remover api.* internos + funções SLA → importar `usePosEmbarque` + `slaUtils` |
| `src/components/GestaoMarcacoes.js` | Remover api.* internos + funções de tempo → importar `useMarcacoes` + `marcacoesUtils` |
| `src/components/DashboardFrota.js` | Remover `normalizarVeiculos` → importar `frotaUtils` |
| `src/components/PainelOperacional.js` | Remover `ehOperacao*` → importar `operacaoUtils` |

### Fora do escopo

- `DashboardFrota.js` e `PainelOperacional.js`: **sem hook** — dados via Socket.io + múltiplas sub-seções independentes tornam um hook único tão complexo quanto o componente
- `DashboardTV.js`: painel de TV sem interação, risco vs. ganho não justifica
- Componentes < 400 linhas: tamanho não justifica o padrão
- Split de JSX dos monólitos (2000+ linhas): diferido para após validação em produção

---

## Ondas de Migração

### Onda 1 — Utils puras (zero risco)

Move funções que já existem. Componente original atualiza import. Nenhuma lógica muda.

### Onda 2 — Domain Hooks (médio risco)

Cria os hooks. Componente ainda **não os usa** nesta onda — hooks existem mas não são consumidos. Serve para validar que compilam.

### Onda 3 — Migração dos componentes (maior risco)

Componentes param de chamar `api.*` diretamente e passam a usar os hooks. Estado de servidor sai do componente.

---

## Interfaces das Utils

### `src/utils/slaUtils.js`

Extraído de `PainelPosEmbarque.js` (linhas 11–79).

```js
// Parse de datetime no fuso BRT
export function parseDatetimeBRT(data, hora)
// → new Date(`${data}T${hora}:00-03:00`)

// Quantas horas desde abertura (ou até resolução se RESOLVIDO)
export function calcularHorasAtraso(oc)
// → number

// Ocorrência está atrasada (> 24h)?
export function verificarAtraso(oc)
// → boolean

// Label de atraso para exibição ("2d 3h atrasado" | null)
export function getLabelAtraso(oc)
// → string | null

// Cor CSS para o atraso
export function getCorAtraso(oc)
// → '#dc2626' | '#ef4444' | '#f59e0b' | null

// Objeto de exibição de situação
export function getSituacaoDisplay(oc)
// → { texto: string, cor: string }

// Ordena lista: atrasados primeiro (mais atrasado no topo), depois Em Andamento, depois Resolvidos
export function ordenarOcorrencias(lista)
// → array (nova referência)
```

### `src/utils/marcacoesUtils.js`

Extraído de `GestaoMarcacoes.js` (linhas 52–80 aprox).

```js
// Parse de datetime sem shift de timezone (strings sem Z/offset tratadas como local)
export function parseDateLocal(str)
// → Date | null

// Tempo de espera entre marcação e contratação
export function calcularTempoEspera(dataMarcacao, dataContratacao)
// → { horas: number, label: string, cor: string } | null
// label: "2h30" | "1d 3h" etc.
// cor: verde (<2h) | amarelo (2-4h) | vermelho (>4h)
```

### `src/utils/frotaUtils.js`

Extraído de `DashboardFrota.js` (linhas 38–67).

```js
// Normaliza lista de veículos para o dashboard:
// CONJUNTO → card CONJUNTO + entrada virtual _cardTipo='CARRETA' (_atrelada=true)
// CARRETA avulsa → _cardTipo='CARRETA', _atrelada=false
// demais → _cardTipo=tipo_veiculo
export function normalizarVeiculos(veiculos)
// → array com campos _cardTipo, _placaExibicao, _atrelada
```

### `src/utils/operacaoUtils.js`

Extraído de `PainelOperacional.js` (linhas 25–27).

```js
export function ehOperacaoInterestadual(op)
// → op === 'LEÃO - SP' || op === 'ELETRIK SUL'

export function ehOperacaoRecife(op)
// → op && !ehOperacaoInterestadual(op) && op.includes('RECIFE')

export function ehOperacaoMoreno(op)
// → op && !ehOperacaoInterestadual(op) && (op.includes('MORENO') || op.includes('PORCELANA') || op.includes('ELETRIK'))
```

---

## Interfaces dos Hooks

### `src/hooks/usePosEmbarque.js`

```js
export function usePosEmbarque() {
    return {
        // Estado
        ocorrencias,    // array — lista atual filtrada
        listas,         // { motoristas: [], clientes: [], motivos: [] } — carregado automaticamente no mount via GET /api/posembarque/listas
        loading,        // boolean — fetch de ocorrências em andamento
        erro,           // string — mensagem de erro

        // Ações de leitura
        // Nota: listas NÃO tem ação explícita — o hook chama GET /api/posembarque/listas num useEffect interno sem dependências
        carregarOcorrencias,    // (busca?: string, filtroSituacao?: string) → void
        carregarRelatorio,      // (params: object) → Promise<data> — não armazena estado

        // Ações de escrita
        criarOcorrencia,        // (form: object) → Promise<ocorrencia>
        resolverOcorrencia,     // (id: number) → Promise<void>
        editarOcorrencia,       // (id: number, form: object) → Promise<ocorrencia>
        arquivarResolvidas,     // (lista: array) → Promise<void> — itera e arquiva cada uma
        deletarOcorrencia,      // (id: number) → Promise<void>
        adicionarFoto,          // (id: number, base64: string) → Promise<void>
        deletarFoto,            // (id: number, index: number) → Promise<void>
    };
}
```

**O hook usa `useApiCall` internamente** para loading/erro automático.

**O componente mantém:**
- Estado de UI: `aba`, `busca`, `filtroSituacao`, form fields, modals abertos
- `useEffect` de montagem que chama `carregarOcorrencias()`

**O componente NÃO mantém mais:**
- `useState` para `ocorrencias`, `listas`, `carregando`
- Nenhum `api.get/post/put/delete`

### `src/hooks/useMarcacoes.js`

```js
export function useMarcacoes() {
    return {
        // Estado
        marcacoes,          // array
        tokens,             // array
        loading,            // boolean — fetch de marcações
        loadingTokens,      // boolean — fetch de tokens (independente)
        erro,               // string

        // Ações de leitura
        carregarMarcacoes,          // (filtros: object) → void
        carregarTokens,             // () → void

        // Ações sobre tokens
        criarToken,                 // (telefone: string) → Promise<token>
        atualizarToken,             // (id: number, status: string) → Promise<void>
        deletarToken,               // (id: number) → Promise<void>

        // Ações sobre marcações
        deletarMarcacao,            // (id: number) → Promise<void>
        atualizarStatus,            // (id: number, status: string) → Promise<void>
        atualizarStatusOperacional, // (id: number, status: string) → Promise<void>
        atualizarTag,               // (id: number, body: object) → Promise<void>
    };
}
```

**Atenção — atualização otimista:** ações que já fazem `setMarcacoes(prev => ...)` no componente atual devem continuar fazendo isso **dentro do hook** para manter a responsividade de UI. O hook atualiza o estado local imediatamente e dispara a API em segundo plano.

**O componente mantém:**
- Estado de UI: aba ativa, filtros, formulários, confirmações
- Chamadas iniciais via `useEffect`

---

## Critério de separação (regra geral)

| Pertence ao hook | Pertence ao componente |
|---|---|
| `api.get/post/put/delete` | `useState` de formulários e modais |
| `useState` de dados do servidor | `useEffect` que chama funções do hook |
| Atualização otimista de listas | Handlers de submit que chamam o hook |
| Retry / refresh de dados | Filtros e busca locais |

---

## Testes (referência futura)

As utils puras são testáveis sem React:
```js
// slaUtils.test.js
import { calcularHorasAtraso, getSituacaoDisplay } from '../utils/slaUtils';
test('ocorrência > 24h é atrasada', () => { ... });
```

Os hooks são testáveis com `@testing-library/react` + `renderHook` + mock de `api`.
Os componentes, após a migração, ficam testáveis com mock do hook inteiro.

O projeto não tem test runner configurado — isso fica fora do escopo desta refatoração.
