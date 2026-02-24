# 🚀 Guia de Integração Zustand + Service Layer

## 📦 Estrutura Criada

```
src/
├── store/
│   ├── useAuthStore.js      # Autenticação e usuário
│   ├── useUIStore.js         # Modais e notificações
│   ├── useDataStore.js       # Veículos, cubagens, fila
│   └── index.js              # Exportação centralizada
│
├── services/
│   ├── apiService.js         # Configuração Axios + Interceptadores
│   ├── authService.js        # Chamadas de autenticação
│   ├── operacaoService.js    # Chamadas de operações
│   └── index.js              # Exportação centralizada
```

---

## 🔧 Como Usar as Stores

### **1. Store de Autenticação (useAuthStore)**

```jsx
import { useAuthStore } from './store';

function MeuComponente() {
    const { user, token, isAuthenticated, login, logout } = useAuthStore();

    const handleLogin = async () => {
        const userData = { /* ... */ };
        const jwtToken = 'token_aqui';
        login(userData, jwtToken);
    };

    return (
        <div>
            {isAuthenticated ? (
                <p>Bem-vindo, {user?.nome}!</p>
            ) : (
                <button onClick={handleLogin}>Login</button>
            )}
        </div>
    );
}
```

**Ações disponíveis:**
- `login(userData, token)` - Fazer login
- `logout()` - Fazer logout
- `updateUser(updates)` - Atualizar dados do usuário
- `temAcesso(modulo)` - Verificar permissão de acesso
- `podeEditar(acao)` - Verificar permissão de edição
- `isAdmin()` - Verificar se é admin

---

### **2. Store de UI (useUIStore)**

```jsx
import { useUIStore } from './store';

function MeuComponente() {
    const {
        modals,
        openModal,
        closeModal,
        mostrarNotificacao
    } = useUIStore();

    const handleAbrirAdmin = () => {
        openModal('admin');
    };

    const handleSalvar = () => {
        mostrarNotificacao('✅ Salvo com sucesso!');
    };

    return (
        <>
            <button onClick={handleAbrirAdmin}>Abrir Admin</button>
            {modals.admin && <ModalAdmin onClose={() => closeModal('admin')} />}
        </>
    );
}
```

**Modais disponíveis:**
- `cadastro`, `esqueciSenha`, `admin`, `tempo`, `relatorio`, `fila`, `avatar`, `cubagem`

**Ações disponíveis:**
- `openModal(name)` - Abrir modal
- `closeModal(name)` - Fechar modal
- `closeAllModals()` - Fechar todos
- `mostrarNotificacao(msg, duracao)` - Notificação temporária
- `toggleMenu()` - Toggle sidebar

---

### **3. Store de Dados (useDataStore)**

```jsx
import { useDataStore } from './store';

function ListaVeiculos() {
    const { veiculos, adicionarVeiculo, removerVeiculo } = useDataStore();

    return (
        <ul>
            {veiculos.map(v => (
                <li key={v.id}>
                    {v.motorista}
                    <button onClick={() => removerVeiculo(v.id)}>X</button>
                </li>
            ))}
        </ul>
    );
}
```

**Ações disponíveis:**
- Veículos: `setVeiculos`, `adicionarVeiculo`, `atualizarVeiculo`, `removerVeiculo`
- Cubagens: `setCubagens`, `adicionarCubagem`, `atualizarCubagemTemp`, `limparCubagemTemp`
- Fila: `setFila`, `adicionarNaFila`, `removerDaFila`, `reordenarFila`
- CTEs: `adicionarCte`, `atualizarStatusCte`

---

## 🌐 Como Usar os Serviços

### **1. Serviço de Autenticação (authService)**

```jsx
import { authService } from './services';
import { useAuthStore } from './store';

function Login() {
    const { login } = useAuthStore();

    const handleLogin = async () => {
        try {
            const response = await authService.login({
                nome: 'julio',
                senha: '123'
            });

            if (response.success) {
                login(response.usuario, response.token);
            }
        } catch (error) {
            console.error('Erro no login:', error);
        }
    };

    return <button onClick={handleLogin}>Login</button>;
}
```

**Métodos disponíveis:**
- `login(credentials)` - Fazer login
- `getUsuarios()` - Listar usuários
- `criarUsuario(userData)` - Criar usuário
- `atualizarUsuario(id, updates)` - Atualizar usuário
- `deletarUsuario(id)` - Deletar usuário
- `getSolicitacoes()` - Obter solicitações pendentes

---

### **2. Serviço de Operações (operacaoService)**

```jsx
import { operacaoService } from './services';
import { useDataStore } from './store';

function PainelVeiculos() {
    const { setVeiculos } = useDataStore();

    useEffect(() => {
        carregarVeiculos();
    }, []);

    const carregarVeiculos = async () => {
        try {
            const veiculos = await operacaoService.getVeiculos();
            setVeiculos(veiculos);
        } catch (error) {
            console.error('Erro ao carregar:', error);
        }
    };

    const criarNovoVeiculo = async (dados) => {
        try {
            await operacaoService.criarVeiculo(dados);
            carregarVeiculos(); // Recarregar lista
        } catch (error) {
            console.error('Erro ao criar:', error);
        }
    };

    return <div>{/* ... */}</div>;
}
```

**Métodos disponíveis:**
- **Veículos:** `getVeiculos`, `criarVeiculo`, `atualizarVeiculo`, `deletarVeiculo`
- **Cubagens:** `getCubagens`, `getCubagemPorColeta`, `criarCubagem`, `atualizarCubagem`, `deletarCubagem`
- **Fila:** `getFila`, `adicionarNaFila`, `atualizarFila`, `deletarDaFila`
- **Notificações:** `getNotificacoes`, `deletarNotificacao`

---

## 🔄 Fluxo Completo de Login com Zustand + Services

```jsx
// LoginScreen.js
import { authService } from './services';
import { useAuthStore } from './store';
import { useUIStore } from './store';

function LoginScreen() {
    const { login } = useAuthStore();
    const { mostrarNotificacao } = useUIStore();
    const [dados, setDados] = useState({ nome: '', senha: '' });

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            // Chamar serviço
            const response = await authService.login(dados);

            if (response.success && response.token) {
                // Salvar no Zustand
                login(response.usuario, response.token);

                // Notificar sucesso
                mostrarNotificacao('✅ Login realizado!');
            }
        } catch (error) {
            mostrarNotificacao('❌ ' + error.message);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <input
                value={dados.nome}
                onChange={e => setDados({...dados, nome: e.target.value})}
            />
            <input
                type="password"
                value={dados.senha}
                onChange={e => setDados({...dados, senha: e.target.value})}
            />
            <button type="submit">Login</button>
        </form>
    );
}
```

---

## 🔐 Interceptador JWT Automático

O `apiService.js` já configura o interceptador automaticamente:

```javascript
// Busca token do Zustand (via localStorage persist)
const token = JSON.parse(localStorage.getItem('auth-storage')).state?.token;

// Anexa automaticamente em TODAS as requisições
config.headers.Authorization = `Bearer ${token}`;
```

**Você não precisa mais:**
```javascript
// ❌ ANTES
axios.post('/veiculos', data, {
    headers: { Authorization: `Bearer ${token}` }
});

// ✅ AGORA
operacaoService.criarVeiculo(data); // Token anexado automaticamente
```

---

## 📋 Refatoração Sugerida

### **Substituir prop drilling:**

**❌ ANTES (prop drilling):**
```jsx
<App>
  <Header user={user} onLogout={logout} />
  <Sidebar user={user} />
  <PainelOperacional user={user} permissoes={permissoes} />
</App>
```

**✅ DEPOIS (Zustand):**
```jsx
// Cada componente acessa diretamente
function Header() {
    const { user, logout } = useAuthStore();
    return <button onClick={logout}>Logout {user?.nome}</button>;
}

function Sidebar() {
    const { user } = useAuthStore();
    return <div>Cidade: {user?.cidade}</div>;
}
```

---

## 🎯 Benefícios

| Antes | Depois |
|-------|--------|
| ❌ Prop drilling excessivo | ✅ Acesso direto ao estado |
| ❌ `useState` em vários lugares | ✅ Estado centralizado |
| ❌ Lógica duplicada de API | ✅ Service layer reutilizável |
| ❌ Token manual em cada chamada | ✅ Interceptador automático |
| ❌ Difícil de testar | ✅ Fácil de mockar serviços |

---

## 🚀 Próximos Passos

1. **Refatorar App.js:**
   - Substituir `useState` de user/token por `useAuthStore`
   - Substituir modais locais por `useUIStore`

2. **Refatorar componentes:**
   - PainelOperacional: usar `useDataStore` para veículos
   - ModuloCubagem: usar `useDataStore` para cubagem temporária
   - Header/Sidebar: usar `useAuthStore` direto

3. **Testar fluxo completo:**
   - Login → Token salvo automaticamente
   - Requisições → Token anexado automaticamente
   - Logout → Estado limpo completamente

---

🎉 **Zustand + Service Layer implementados com sucesso!**
