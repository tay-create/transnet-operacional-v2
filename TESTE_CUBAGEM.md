# 📋 TESTE COMPLETO - CALCULADORA DE CUBAGEM

## 🎯 Objetivo
Validar todas as funcionalidades do módulo de cubagem após a refatoração para múltiplas NFs.

---

## ✅ TESTE 1: Adicionar Múltiplas NFs

### Passos:
1. Acesse o módulo **Cálculo de Cubagem**
2. Preencha os dados básicos:
   - **Nº Coleta:** `12345`
   - **Motorista:** `João Silva`
   - **Cliente:** `Porcelana Delta`
   - **Destino:** `São Paulo/SP`
   - **Volume:** `150`
   - **Tipo:** `100% Moreno`

3. No campo **Nº NF** (primeira linha), digite: `1001`
4. No campo **Metragem** (primeira linha), digite: `50.5`
5. Clique no botão **"+ ADICIONAR NF"**
6. Preencha a segunda linha:
   - **Nº NF:** `1002`
   - **Metragem:** `30.25`
7. Clique novamente em **"+ ADICIONAR NF"**
8. Preencha a terceira linha:
   - **Nº NF:** `1003`
   - **Metragem:** `45.00`

### Resultado Esperado:
- ✅ Devem aparecer **3 linhas** de NF + Metragem
- ✅ Cada linha deve mostrar:
  - Campo **Nº NF** (editável)
  - Campo **Metragem** (editável)
  - Valor **Mix** calculado e exibido em formato `0,00` (ex: `1,55`)
  - Valor **Kit** calculado e exibido em formato `0,00` (ex: `1,06`)
  - Botão **🗑️ Remover** (exceto na primeira linha)

### Cálculos Esperados (para validação manual):

**NF 1001 (50.5m):**
- Mix: `(50.5 × 0.10) ÷ 2.5 ÷ 1.3 = 1,55`
- Kit: `(50.5 × 0.10) ÷ 2.5 ÷ 1.9 = 1,06`

**NF 1002 (30.25m):**
- Mix: `(30.25 × 0.10) ÷ 2.5 ÷ 1.3 = 0,93`
- Kit: `(30.25 × 0.10) ÷ 2.5 ÷ 1.9 = 0,64`

**NF 1003 (45.0m):**
- Mix: `(45.0 × 0.10) ÷ 2.5 ÷ 1.3 = 1,38`
- Kit: `(45.0 × 0.10) ÷ 2.5 ÷ 1.9 = 0,95`

**TOTAIS:**
- Total Metragem: `125,75 m`
- Total Mix: `3,86`
- Total Kit: `2,65`

---

## ✅ TESTE 2: Validação dos Cards de Totais

### Passos:
1. Após preencher as 3 NFs do Teste 1
2. Role a página até os **3 cards de totais** (acima do botão SALVAR)

### Resultado Esperado:
Os 3 cards devem exibir:

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  TOTAL METRAGEM     │   │   TOTAL MIX         │   │   TOTAL KIT         │
│      125,75 m       │   │      3,86           │   │      2,65           │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

- ✅ Valores com **vírgula** como separador decimal (não ponto)
- ✅ Metragem com sufixo **"m"**
- ✅ Cores dos cards: Azul (Metragem), Verde (Mix), Roxo (Kit)

---

## ✅ TESTE 3: Remover NF

### Passos:
1. Mantenha as 3 NFs do Teste 1
2. Clique no botão **🗑️** da segunda linha (NF 1002)

### Resultado Esperado:
- ✅ A linha NF 1002 (30.25m) deve **desaparecer**
- ✅ Restam apenas 2 linhas: NF 1001 e NF 1003
- ✅ Os totais devem **recalcular automaticamente**:
  - Total Metragem: `95,50 m` (era 125,75)
  - Total Mix: `2,93` (era 3,86)
  - Total Kit: `2,01` (era 2,65)

### Validação Extra:
- ❌ O botão **🗑️ NÃO deve aparecer** se houver apenas 1 linha (tente remover até sobrar 1)

---

## ✅ TESTE 4: Salvar no Banco de Dados

### Passos:
1. Preencha um novo cálculo:
   - **Nº Coleta:** `99999`
   - **Motorista:** `Maria Teste`
   - **Cliente:** `Teste LTDA`
   - **Destino:** `Recife/PE`
   - **Volume:** `75`
   - **Tipo:** `Kit`
   - **Data:** Deixe a data de hoje

2. Adicione 2 NFs:
   - **NF 5001:** Metragem `20.00`
   - **NF 5002:** Metragem `15.50`

3. Clique em **💾 SALVAR CÁLCULO**

### Resultado Esperado:
- ✅ Mensagem: **"✅ Cálculo salvo com sucesso!"**
- ✅ Formulário deve **limpar** (voltar ao estado inicial)
- ✅ A lista de cálculos abaixo deve **atualizar** mostrando o novo registro no topo

---

## ✅ TESTE 5: Editar Cálculo Existente

### Passos:
1. Na lista de cálculos salvos, localize o cálculo da coleta `99999` (do Teste 4)
2. Clique no botão **✏️ EDITAR**

### Resultado Esperado:
- ✅ O formulário deve **preencher automaticamente** com os dados salvos:
  - Nº Coleta: `99999`
  - Motorista: `Maria Teste`
  - Cliente: `Teste LTDA`
  - Destino: `Recife/PE`
  - Volume: `75`
  - Tipo: `Kit`
  - **2 linhas de NF** com os valores:
    - NF 5001: `20.00`
    - NF 5002: `15.50`

3. Modifique a metragem da **NF 5001** para `25.00`
4. Clique em **💾 ATUALIZAR CÁLCULO**

### Resultado Esperado:
- ✅ Mensagem: **"✅ Cálculo atualizado!"**
- ✅ Na lista, os totais do cálculo `99999` devem refletir a mudança:
  - Total Metragem: `40,50` (antes era 35,50)
  - Total Mix: `1,25` (recalculado)
  - Total Kit: `0,85` (recalculado)

---

## ✅ TESTE 6: Excluir Cálculo

### Passos:
1. Localize o cálculo da coleta `99999`
2. Clique no botão **🗑️ EXCLUIR**
3. Confirme a exclusão no alerta do navegador

### Resultado Esperado:
- ✅ O cálculo deve **desaparecer** da lista
- ✅ Mensagem: **"✅ Cálculo excluído!"**

---

## ✅ TESTE 7: Geração de PDF

### Passos:
1. Crie um novo cálculo:
   - **Nº Coleta:** `77777`
   - **Motorista:** `Pedro Santos`
   - **Cliente:** `ABC Logística`
   - **Destino:** `Fortaleza/CE`
   - **Volume:** `100`
   - **Tipo:** `Mix`
   - **Faturado:** Marque como **SIM**

2. Adicione 3 NFs:
   - **NF 6001:** `40.00 m`
   - **NF 6002:** `35.00 m`
   - **NF 6003:** `25.00 m`

3. Clique em **💾 SALVAR CÁLCULO**
4. Na lista de cálculos, clique no botão **📄 PDF** do cálculo `77777`

### Resultado Esperado:
- ✅ PDF deve **baixar automaticamente** com nome: `Cubagem_77777.pdf`
- ✅ O PDF deve conter:
  - **Logo da empresa** no topo
  - **Cabeçalho:** "CÁLCULO DE CUBAGEM"
  - **Dados do cálculo:**
    - Nº Coleta: 77777
    - Motorista: Pedro Santos
    - Cliente: ABC Logística
    - Destino: Fortaleza/CE
    - Volume: 100
    - Data: (data atual)
    - Faturado: ✔
    - Tipo: Mix
  - **Tabela de itens** com 3 linhas:
    | Nº NF | Metragem | Mix | Kit |
    |-------|----------|-----|-----|
    | 6001  | 40,00    | 1,23| 0,84|
    | 6002  | 35,00    | 1,08| 0,74|
    | 6003  | 25,00    | 0,77| 0,53|
  - **Linha de totais** em negrito
  - **Rodapé:** "Gerado pelo Sistema Transnet"

---

## ✅ TESTE 8: Filtros e Busca

### Passos:
1. Crie múltiplos cálculos com datas diferentes
2. Use o filtro **"Faturado"** e selecione **"Sim"**

### Resultado Esperado:
- ✅ Apenas cálculos marcados como faturados devem aparecer

3. Mude para **"Não"**

### Resultado Esperado:
- ✅ Apenas cálculos **não faturados** devem aparecer

4. Digite **"Porcelana"** no campo de busca

### Resultado Esperado:
- ✅ Apenas cálculos com **"Porcelana"** no nome do cliente devem aparecer

---

## ✅ TESTE 9: Formatação de Números (Crítico)

### Passos:
1. Crie um cálculo com metragem que gere resultado com múltiplas casas decimais
2. **NF 9001:** Digite `13.7` na metragem

### Resultado Esperado:
- ✅ Mix deve exibir: **`0,42`** (não `0.42` nem `0,4217...`)
- ✅ Kit deve exibir: **`0,29`** (não `0.29` nem `0,2876...`)

### Validação:
- ✅ **Todos os valores devem ter exatamente 2 casas decimais**
- ✅ **Vírgula como separador decimal** (padrão brasileiro)

---

## ✅ TESTE 10: Integração com Painel Operacional (PORCELANA)

### Passos:
1. Vá para o **Painel Operacional - MORENO**
2. Clique em **"NOVO LANÇAMENTO"**
3. Selecione a operação: **"PORCELANA"**
4. No campo **"COLETAS MORENO"**, digite: `12345` (uma coleta que você salvou no módulo de cubagem)
5. Pressione Enter ou clique fora do campo

### Resultado Esperado:
- ✅ Deve aparecer um **card de cubagem vinculada** abaixo do campo de coleta
- ✅ O card deve mostrar:
  - 📦 **CUBAGEM ENCONTRADA**
  - Valor **Mix:** (formato 0.0000 com 4 casas decimais)
  - Valor **Kit:** (formato 0.0000 com 4 casas decimais)
  - **Cliente:** (nome do cliente)
  - **Destino:** (destino cadastrado)

### Validação:
- ✅ Os valores no card do Painel devem **bater** com os totais salvos no módulo de cubagem

---

## ✅ TESTE 11: Validação de Campos Obrigatórios

### Passos:
1. Tente salvar um cálculo **SEM** preencher o campo **"Nº Coleta"**
2. Clique em **💾 SALVAR CÁLCULO**

### Resultado Esperado:
- ✅ Mensagem de erro: **"⚠️ Preencha todos os campos obrigatórios!"**
- ✅ Cálculo **não deve ser salvo**

### Repita para:
- Campo **Motorista** vazio
- Campo **Cliente** vazio
- Campo **Destino** vazio
- Campo **Metragem** vazio (na primeira NF)

---

## ✅ TESTE 12: Marcar/Desmarcar Faturado

### Passos:
1. Na lista de cálculos, localize qualquer registro
2. Clique no **checkbox "Faturado"** para marcá-lo
3. Clique novamente para desmarcá-lo

### Resultado Esperado:
- ✅ O status deve **alternar visualmente** (checkbox marcado/desmarcado)
- ✅ A alteração deve ser **salva no banco automaticamente**
- ✅ Ao recarregar a página, o status deve **persistir**

---

## ✅ TESTE 13: Marcar/Desmarcar Redespacho

### Passos:
1. Ao criar/editar um cálculo, marque o checkbox **"Redespacho"**
2. Salve o cálculo
3. Edite novamente o mesmo cálculo

### Resultado Esperado:
- ✅ O checkbox **"Redespacho"** deve estar **marcado** ao reabrir a edição
- ✅ Ao desmarcar e salvar, a mudança deve **persistir no banco**

---

## 🧪 TESTE 14: Banco de Dados (SQL - Verificação Manual)

### Passos (no terminal):
```bash
sqlite3 tnetlog.db
```

Execute:
```sql
SELECT * FROM cubagens WHERE numero_coleta = '12345';
```

### Resultado Esperado:
- ✅ Coluna **`itens`** deve conter JSON no formato:
  ```json
  [
    {"numero_nf":"1001","metragem":"50.5"},
    {"numero_nf":"1002","metragem":"30.25"},
    {"numero_nf":"1003","metragem":"45.00"}
  ]
  ```
- ✅ Coluna **`metragem_total`** deve conter: `125.75`
- ✅ Coluna **`valor_mix_total`** deve conter: `3.86` (aproximadamente)
- ✅ Coluna **`valor_kit_total`** deve conter: `2.65` (aproximadamente)

---

## 📊 CHECKLIST FINAL

Marque conforme completa:

- [ ] ✅ TESTE 1: Adicionar múltiplas NFs
- [ ] ✅ TESTE 2: Validação dos cards de totais
- [ ] ✅ TESTE 3: Remover NF
- [ ] ✅ TESTE 4: Salvar no banco
- [ ] ✅ TESTE 5: Editar cálculo existente
- [ ] ✅ TESTE 6: Excluir cálculo
- [ ] ✅ TESTE 7: Geração de PDF
- [ ] ✅ TESTE 8: Filtros e busca
- [ ] ✅ TESTE 9: Formatação de números (0,00)
- [ ] ✅ TESTE 10: Integração com Painel Operacional
- [ ] ✅ TESTE 11: Validação de campos obrigatórios
- [ ] ✅ TESTE 12: Marcar/Desmarcar faturado
- [ ] ✅ TESTE 13: Marcar/Desmarcar redespacho
- [ ] ✅ TESTE 14: Verificação do banco de dados

---

## 🐛 BUGS ENCONTRADOS

Se encontrar algum problema, documente aqui:

| #  | Descrição do Bug | Passos para Reproduzir | Prioridade |
|----|------------------|------------------------|------------|
| 1  |                  |                        | Alta/Média/Baixa |
| 2  |                  |                        | Alta/Média/Baixa |

---

## ✅ CRITÉRIOS DE APROVAÇÃO

Para considerar o módulo **100% funcional**, TODOS os testes devem passar com sucesso:

- ✅ Adicionar/Remover NFs funciona corretamente
- ✅ Cálculos de Mix e Kit estão corretos (margem de erro: ±0.01)
- ✅ Formatação brasileira (vírgula) aplicada em todos os valores
- ✅ Salvar/Editar/Excluir funcionam sem erros
- ✅ PDF gerado com todas as informações corretas
- ✅ Integração com Painel Operacional funcionando
- ✅ Banco de dados armazena dados no formato JSON correto
- ✅ Filtros e busca funcionam conforme esperado

---

**Data do Teste:** __________
**Testador:** __________
**Versão Testada:** v2.0 (Múltiplas NFs)
**Status:** [ ] APROVADO [ ] REPROVADO [ ] EM ANÁLISE
