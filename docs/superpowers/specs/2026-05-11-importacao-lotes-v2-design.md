# Spec: Importação de Lotes v2

**Data:** 2026-05-11
**Abordagem:** A — Cirúrgica/incremental (sem novos arquivos)
**Arquivos afetados:** `src/routes/veiculos.js`, `src/components/ModalImportacaoLotes.js`

---

## Contexto

`ModalImportacaoLotes.js` permite importar coletas via planilha xlsx. O fluxo atual tem três problemas:

1. **Upsert incompleto:** o backend atualiza motorista/placa/modelo quando reimporta uma coleta existente, mas ignora rota, observação, operação e data_prevista. Bug confirmado: campo de rota digitado na reimportação não persiste no card.
2. **ROTA NOVA sem follow-up:** o modal pergunta se existe rota para coletas com "ROTA NOVA" na observação, mas ambos os botões ("Sim" e "Ainda não") executam o mesmo código — vão ao passo 2 sem coletar o número da rota.
3. **Coletas sumidas não detectadas:** ao reimportar um arquivo menor (ex: 10 coletas no lugar de 15), o sistema não avisa que 5 coletas ativas no painel sumiram do novo arquivo.

---

## Feature 1 — Upsert ampliado (backend)

**Arquivo:** `src/routes/veiculos.js` — bloco `router.post('/')`, dentro do loop de verificação de duplicatas (linhas ~282–314).

### Mudanças

**SELECT existente:** expandir para buscar `rota_recife`, `rota_moreno`, `observacao`, `data_prevista` além dos campos já buscados.

```sql
SELECT id, motorista, placa, modelo, dados_json,
       rota_recife, rota_moreno, observacao, data_prevista
FROM veiculos WHERE ...
```

**Detecção de mudança:** adicionar comparações para os novos campos.

```js
const novaRotaRecife  = v.rotaRecife  || v.rota_recife  || '';
const novaRotaMoreno  = v.rotaMoreno  || v.rota_moreno  || '';
const novaObs         = v.observacao  || '';
const novaData        = v.data_prevista || '';

const mudouRotaRecife = novaRotaRecife && novaRotaRecife !== (existente.rota_recife || '');
const mudouRotaMoreno = novaRotaMoreno && novaRotaMoreno !== (existente.rota_moreno || '');
const mudouObs        = novaObs && novaObs !== (existente.observacao || '');
const mudouData       = novaData && novaData !== (existente.data_prevista || '');
```

**UPDATE:** incluir os novos campos, **sem tocar** em `status_recife`, `status_moreno`, `tempos_recife`, `tempos_moreno`.

```sql
UPDATE veiculos SET
  motorista          = COALESCE(NULLIF(?, ''), motorista),
  placa              = COALESCE(NULLIF(?, ''), placa),
  modelo             = COALESCE(NULLIF(?, ''), modelo),
  rota_recife        = COALESCE(NULLIF(?, ''), rota_recife),
  rota_moreno        = COALESCE(NULLIF(?, ''), rota_moreno),
  observacao         = COALESCE(NULLIF(?, ''), observacao),
  data_prevista      = COALESCE(NULLIF(?, ''), data_prevista),
  dados_json         = ?,
  chk_cnh = 0, chk_antt = 0, chk_tacografo = 0, chk_crlv = 0,
  situacao_cadastro  = 'NÃO CONFERIDO'
WHERE id = ?
```

**Parâmetros:** `[novoMotorista, novaPlaca1, novoModelo, novaRotaRecife, novaRotaMoreno, novaObs, novaData, JSON.stringify(djNovo), existente.id]`

**Condição de disparo:** `mudouMotorista || mudouPlaca1 || mudouPlaca2 || mudouModelo || mudouRotaRecife || mudouRotaMoreno || mudouObs || mudouData`

**Socket:** após o UPDATE, emitir `veiculoAtualizado` para o painel atualizar em tempo real (replicar o padrão do `router.put('/:id')`).

---

## Feature 2 — ROTA NOVA passo a passo (frontend)

**Arquivo:** `src/components/ModalImportacaoLotes.js`

### Novos estados

```js
const [rotaNovaFila,  setRotaNovaFila]  = useState([]);   // lotes pendentes de rota
const [rotaNovaAtual, setRotaNovaAtual] = useState(null); // lote sendo resolvido agora
const [rotaNovaInput, setRotaNovaInput] = useState('');   // valor digitado
```

### Lógica

**Botão "Sim, tenho a rota"** (no overlay `rotaNovaPendente`):
```js
onClick={() => {
  setRotaNovaPendente(null);
  setRotaNovaFila(rotaNovaPendente.slice(1));
  setRotaNovaAtual(rotaNovaPendente[0]);
  setRotaNovaInput('');
}}
```

**Botão "Ainda não":** mantém comportamento atual (vai ao passo 2 sem preencher rota).

**Overlay novo `rotaNovaAtual`** — exibido sobre o conteúdo, mesmo padrão visual dos overlays existentes (`position: absolute, inset: 0, zIndex: 10`):
- Título: "Qual a rota desta coleta?"
- Referência: motorista + placa + coleta (coletaRecife ou coletaMoreno, o que estiver preenchido)
- Input: "Nº da Rota" → `rotaNovaInput`
- Botão **Confirmar**:
  ```js
  () => {
    const ehRec = ehRecife(rotaNovaAtual.operacao);
    const campo = ehRec ? 'rotaRecife' : 'rotaMoreno';
    atualizarLote(rotaNovaAtual._id, campo, rotaNovaInput);
    avancarRotaNova();
  }
  ```
- Botão **Pular**: `() => avancarRotaNova()` (rota fica vazia)

**Função `avancarRotaNova`:**
```js
const avancarRotaNova = () => {
  if (rotaNovaFila.length > 0) {
    setRotaNovaAtual(rotaNovaFila[0]);
    setRotaNovaFila(prev => prev.slice(1));
    setRotaNovaInput('');
  } else {
    setRotaNovaAtual(null);
    setPasso(2);
    verificarDuplicatas(lotes);
  }
};
```

**Reset no `fechar()`:** adicionar `setRotaNovaFila([])`, `setRotaNovaAtual(null)`, `setRotaNovaInput('')`.

---

## Feature 3 — Detecção de Coletas Sumidas (frontend)

**Arquivo:** `src/components/ModalImportacaoLotes.js`

### Novos estados

```js
const [coletasSumidas,    setColetasSumidas]    = useState(null); // null | [{id, motorista, placa1, coleta, operacao}]
const [reprogramarCard,   setReprogramarCard]   = useState(null); // null | card sendo reprogramado
const [novaDataRepro,     setNovaDataRepro]      = useState('');
```

### Posição no fluxo

A sequência de resolução passa a ser:
```
arquivo processado
  → resolver Eletrik (se ambíguo)         [existente]
  → detectar coletas sumidas              [novo]
  → resolver ROTA NOVA (passo a passo)    [corrigido]
  → passo 2
```

`avancarParaPasso2` é renomeado para `avancarParaRotaNova` (apenas internamente), e o antigo `avancarParaPasso2` passa a ser chamado só após ROTA NOVA resolvida.

### Função `detectarSumidas(lotesResolvidos)`

```js
const detectarSumidas = useCallback(async (lotesResolvidos) => {
  try {
    const r = await api.get('/veiculos');
    const veiculos = r.data.veiculos || [];
    const STATUS_FINAIS = ['FINALIZADO', 'Despachado', 'Em Trânsito', 'Entregue'];

    // Coletas que vieram no novo arquivo
    const coletasNovas = new Set();
    for (const l of lotesResolvidos) {
      for (const campo of [l.coletaRecife, l.coletaMoreno, l.coletaInterestadual]) {
        (campo || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => coletasNovas.add(t));
      }
    }

    // Cards ativos com mesma data_prevista cujas coletas não estão no novo arquivo
    const sumidos = veiculos.filter(v => {
      const statusFinal =
        STATUS_FINAIS.includes(v.status_recife) &&
        STATUS_FINAIS.includes(v.status_moreno);
      if (statusFinal) return false;
      if ((v.data_prevista || '') !== dataPrevista) return false;

      const coletas = [
        ...(v.coletaRecife || '').split(','),
        ...(v.coletaMoreno || '').split(','),
        ...(v.coletaInterestadual || '').split(','),
      ].map(t => t.trim()).filter(Boolean);

      return coletas.length > 0 && coletas.every(t => !coletasNovas.has(t));
    }).map(v => ({
      id: v.id,
      motorista: v.motorista,
      placa1: v.placa1Motorista || v.placa || '',
      placa2: v.placa2Motorista || '',
      coleta: v.coletaRecife || v.coletaMoreno || v.coletaInterestadual || '',
      operacao: v.operacao,
    }));

    if (sumidos.length > 0) {
      setColetasSumidas(sumidos);
      setLotes(lotesResolvidos); // salva para usar depois
    } else {
      setLotes(lotesResolvidos);
      avancarParaRotaNova(lotesResolvidos);
    }
  } catch {
    // falha silenciosa — segue sem checagem
    setLotes(lotesResolvidos);
    avancarParaRotaNova(lotesResolvidos);
  }
}, [dataPrevista]);
```

### `avancarParaRotaNova(lotesResolvidos)`

Renomeia o atual `avancarParaPasso2`, sem mudança de lógica interna:
```js
const avancarParaRotaNova = (lotesResolvidos) => {
  const comRotaNova = lotesResolvidos.filter(l => /rota\s*nova/i.test(l.observacao || ''));
  if (comRotaNova.length > 0) {
    setLotes(lotesResolvidos);
    setRotaNovaPendente(comRotaNova);
  } else {
    setLotes(lotesResolvidos);
    setPasso(2);
    verificarDuplicatas(lotesResolvidos);
  }
};
```

### Overlay "Coletas Sumidas"

Exibido quando `coletasSumidas !== null`. Mesmo padrão visual dos outros overlays.

- Título: "Coletas não encontradas no novo arquivo"
- Subtítulo: "As coletas abaixo estavam no painel com a mesma data, mas não vieram nesta importação."
- Lista: para cada card sumido → motorista + placa + coleta + operação
- Para cada item, dois botões:
  - **Excluída** → `DELETE /veiculos/:id`, remove da lista local; se lista vazia → `avancarParaRotaNova(lotes)`
  - **Reprogramada** → seta `reprogramarCard = card`, exibe sub-overlay com date picker

### Sub-overlay "Reprogramar"

- Input date (`novaDataRepro`)
- Botão **Confirmar** → `PUT /veiculos/:id` com `{ data_prevista: novaDataRepro }`, remove da lista sumidas, fecha sub-overlay
- Botão **Cancelar** → fecha sub-overlay sem alterar

Quando `coletasSumidas` esvazia após todas as ações → `avancarParaRotaNova(lotes)`.

### Reset no `fechar()`

Adicionar: `setColetasSumidas(null)`, `setReprogramarCard(null)`, `setNovaDataRepro('')`.

---

## Fluxo completo revisado

```
Upload arquivo
  └─ Eletrik ambíguo?
      ├─ Sim → overlay Eletrik → resolverEletrik()
      └─ Não ↓
         detectarSumidas()
           └─ Há sumidas?
               ├─ Sim → overlay ColetasSumidas
               │          ├─ Excluída → DELETE → remove da lista
               │          └─ Reprogramada → sub-overlay data → PUT
               │          (quando lista vazia → avancarParaRotaNova)
               └─ Não ↓
                  avancarParaRotaNova()
                    └─ Tem ROTA NOVA?
                        ├─ Sim → overlay RotaNovaPendente
                        │          ├─ "Ainda não" → passo 2
                        │          └─ "Sim" → fila rotaNovaAtual (passo a passo)
                        │                      → passo 2 ao esgotar fila
                        └─ Não → passo 2
```

---

## O que NÃO muda

- Lógica de `processarPlanilha`, `consolidarPorPlaca`, `mapearOperacao`
- UI do passo 1 (upload) e passo 2 (CardLote)
- `verificarDuplicatas` e exibição de aviso de duplicata
- `confirmarLotes` e integração com `ModalEntregasProvisao`
- Padrão visual dos overlays existentes
