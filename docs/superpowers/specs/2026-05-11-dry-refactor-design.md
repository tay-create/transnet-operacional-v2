# Design: Refatoração DRY — Transnet Operacional v2

**Data:** 2026-05-11  
**Abordagem escolhida:** Ondas priorizadas por ROI e risco (Opção C)  
**Escopo excluído:** database query helpers adicionais (dbGet já é suficiente), factory Zustand (stores diferem demais), buttonStyles (variação muito alta para objeto simples)

---

## Onda 1 — Backend: adições puras, zero risco

### `middleware/asyncHandler.js`

Wrapper que captura erros não tratados em handlers Express, eliminando o bloco `try/catch/res.status(500)` repetido em ~50 rotas.

```js
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) =>
        res.status(500).json({ success: false, message: e.message })
    );

module.exports = { asyncHandler };
```

- Erros de negócio (400, 404) continuam sendo respondidos explicitamente pelo handler
- Apenas substitui o `catch (e) { res.status(500).json(...) }` que hoje é cópia em cada rota
- Importado em `src/routes/*.js` e nas rotas inline do `server.js`

### `middleware/roles.js`

Constantes de grupos de cargos para uso com `authorize()`. `Desenvolvedor`, `Coordenador`, `Direção` e `Adm Frota` não precisam estar nos grupos porque `authMiddleware.js` já os inclui em `CARGOS_ADMIN` e concede acesso automaticamente.

```js
const ROLES = {
    ADMIN:        ['Coordenador', 'Direção'],
    OPERACIONAL:  ['Planejamento', 'Encarregado', 'Aux. Operacional'],
    CADASTRO:     ['Encarregado', 'Cadastro'],
    CTE:          ['Planejamento', 'Conhecimento'],
    POS_EMBARQUE: ['Pos Embarque', 'Planejamento'],
    FROTA:        ['Adm Frota', 'Planejamento'],
    CONSULTA:     ['Planejamento', 'Encarregado', 'Aux. Operacional', 'Cadastro', 'Conhecimento', 'Pos Embarque'],
};

module.exports = { ROLES };
```

Uso: `authorize(ROLES.OPERACIONAL)` substitui `authorize(['Planejamento', 'Encarregado', 'Aux. Operacional'])`.

**Migração:** todos os arquivos em `src/routes/` + rotas inline no `server.js`.

---

## Onda 2 — Frontend: utilitários, adições puras

### `src/utils/dateFormatter.js`

Consolida 5 variantes de formatação de data espalhadas nos componentes. O `helpers.js` existente não é alterado — ele contém funções de cálculo (`calcularDiferencaHoras`, `obterDataBrasilia`), não de formatação.

```js
// "01/05/2025"
export const formatDataBR = (d) => {
    if (!d) return '—';
    const s = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00-03:00' : d;
    return new Date(s).toLocaleDateString('pt-BR');
};

// "01/05/2025 14:30"
export const formatDataHoraBR = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
};

// "01/05" — usado em labels de gráficos
export const formatDataCurta = (isoStr) => {
    if (!isoStr) return '';
    const [, m, d] = isoStr.split('-');
    return `${d}/${m}`;
};
```

### `src/hooks/useToast.js`

Unifica 4 implementações inconsistentes (array+id em `PainelOperacional`, string simples nos demais).

```js
export function useToast(duracao = 3000) {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((msg, tipo = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, tipo }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracao);
    }, [duracao]);

    return {
        toasts,
        toast: {
            success: (msg) => add(msg, 'success'),
            error:   (msg) => add(msg, 'erro'),
            info:    (msg) => add(msg, 'info'),
        }
    };
}
```

Retorna `toasts` (array para renderizar) + `toast.success/error/info` (funções de disparo). Componentes que hoje têm `{toastMsg && <div ...>{toastMsg}</div>}` migram para iterar sobre `toasts`.

### `src/hooks/useApiCall.js`

Elimina o padrão `loading/erro/useState/try/finally` de ~50 componentes.

```js
export function useApiCall() {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const execute = useCallback(async (fn) => {
        try {
            setLoading(true);
            setErro('');
            return await fn();
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Erro ao processar';
            setErro(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, erro, execute };
}
```

Interface: `const { loading, erro, execute } = useApiCall()`. Múltiplos `useApiCall()` por componente se houver operações independentes (ex: carregar dados vs. salvar). Não gerencia `data` — cada componente mantém seu próprio estado de dados, pois os tipos variam.

---

## Onda 3 — Migração dos consumidores

Migrar por arquivo completo — um arquivo por vez, consistente por inteiro antes de avançar.

**Critério de parada:** se a migração de um componente não reduz pelo menos 5 linhas ou não remove nenhuma duplicação relevante, pular.

### Backend

Todos os handlers em `src/routes/posembarque.js`, `src/routes/chamados.js`, `src/routes/checklists.js`, `src/routes/tasks.js`, `src/routes/tramontina.js`, `src/routes/ocorrencias.js`, `src/routes/veiculos.js`, `src/routes/auth.js` + rotas inline no `server.js`.

### Frontend — prioridade por impacto

| Arquivo | Migra para |
|---|---|
| `PainelOperacional.js` | `useApiCall` + `dateFormatter` |
| `DashboardFrota.js` | `useApiCall` + `useToast` |
| `PainelPosEmbarque.js` | `useApiCall` + `dateFormatter` |
| `DashboardPosEmbarque.js` | `useApiCall` + `dateFormatter` |
| `RelatorioPerformance.js` | `dateFormatter` |
| `GestaoMarcacoes.js` | `useToast` |
| `PainelSaldoPaletes.js` | `useToast` |
| `ProvisionamentoFrota.js` | `useToast` |
| `PainelProgramacao.js` | `dateFormatter` |
| Demais com padrão loading/erro | `useApiCall` |

---

## Onda 4 — ModalWrapper (estrutural)

### `src/components/ModalWrapper.js`

Encapsula overlay + stopPropagation + botão X. Resolve duplicação nos modais maiores.

```jsx
export default function ModalWrapper({ isOpen, onClose, children, maxWidth = '600px', zIndex = 9999 }) {
    if (!isOpen) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative', maxWidth, width: '100%',
                    background: '#0f172a', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                    overflow: 'hidden',
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px', zIndex: 1,
                        background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px',
                    }}
                >
                    <X size={16} />
                </button>
                {children}
            </div>
        </div>
    );
}
```

**`ModalConfirm` não é migrado** — tem lógica de variante (perigo/aviso/info) com bordas coloridas que não cabe no wrapper genérico.

**Modais a migrar:** `ModalImagem`, `ModalOcorrencia`, `ModalChecklistCarreta`, `ModalChamados`, `ModalImportacaoLotes`.

---

## Ordem de commits

1. `feat(middleware): asyncHandler + ROLES constants`
2. `feat(utils): dateFormatter`
3. `feat(hooks): useToast + useApiCall`
4. `refactor(routes): asyncHandler + ROLES em src/routes/*`
5. `refactor(server): asyncHandler + ROLES nas rotas inline`
6. `refactor(components): useApiCall + dateFormatter nos painéis`
7. `refactor(components): useToast nos componentes com toast`
8. `feat(components): ModalWrapper`
9. `refactor(modals): migrar modais para ModalWrapper`

---

## O que foi excluído e por quê

- **Database query helpers adicionais:** `dbGet/dbRun/dbAll/dbTransaction` já são abstrações suficientes. Adicionar `findById`, `checkExists` etc. criaria uma camada extra sem benefício claro.
- **Factory Zustand:** Os 4 stores têm lógica de negócio suficientemente diferente (`useAuthStore` tem `temAcesso/podeEditar/podeVerUnidade`, `useConfigStore` tem lógica de toggle) que uma factory genérica complicaria sem reduzir código real.
- **buttonStyles object:** A variação de estilos entre componentes é alta demais para um objeto simples ser útil — cada componente usa combinações diferentes de padding, cor, borda e estado.
