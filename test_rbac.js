/**
 * test_rbac.js — Testes Automatizados de RBAC (Role-Based Access Control)
 * Projeto: TransNet Operacional
 *
 * Execução: node test_rbac.js
 * Dependências: axios (já instalado no projeto)
 *
 * O script gera tokens JWT mockados para cada cargo e valida
 * que cada rota retorna o status HTTP correto para cada perfil.
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Porta do servidor Node (backend). O React CRA ocupa a 3001 em dev quando o backend está na 3000.
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'transnet-secret-key-2024-ultra-secure';

// ──────────────────────────────────────────────
// 1. GERAÇÃO DE TOKENS MOCKADOS POR CARGO
// ──────────────────────────────────────────────
const PERFIS = {
    Coordenador:      { id: 1, nome: 'Teste Coordenador', email: 'coord@tnetlog.com.br',  cargo: 'Coordenador',      cidade: 'Recife' },
    Planejamento:     { id: 2, nome: 'Teste Planejamento', email: 'plan@tnetlog.com.br',   cargo: 'Planejamento',     cidade: 'Recife' },
    Encarregado:      { id: 3, nome: 'Teste Encarregado',  email: 'enc@tnetlog.com.br',    cargo: 'Encarregado',      cidade: 'Recife' },
    AuxOperacional:   { id: 4, nome: 'Teste Aux',          email: 'aux@tnetlog.com.br',    cargo: 'Aux. Operacional', cidade: 'Recife' },
    Conhecimento:     { id: 5, nome: 'Teste Conhecimento', email: 'con@tnetlog.com.br',    cargo: 'Conhecimento',     cidade: 'Recife' },
    Cadastro:         { id: 6, nome: 'Teste Cadastro',     email: 'cad@tnetlog.com.br',    cargo: 'Cadastro',         cidade: 'Recife' },
    SemToken:         null, // Representa requisição sem autenticação
};

const tokens = {};
for (const [cargo, perfil] of Object.entries(PERFIS)) {
    if (perfil) {
        tokens[cargo] = jwt.sign(perfil, JWT_SECRET, { expiresIn: '1h' });
    }
}

// ──────────────────────────────────────────────
// 2. HELPER: FAZER REQUISIÇÃO E CAPTURAR STATUS
// ──────────────────────────────────────────────
async function req(method, path, cargo, body = null) {
    const headers = {};
    if (cargo && tokens[cargo]) {
        headers['Authorization'] = `Bearer ${tokens[cargo]}`;
    }
    try {
        const response = await axios({ method, url: `${BASE_URL}${path}`, headers, data: body, timeout: 5000 });
        return response.status;
    } catch (e) {
        return e.response?.status || 0; // 0 = servidor offline
    }
}

// ──────────────────────────────────────────────
// 3. DEFINIÇÃO DOS CASOS DE TESTE
// ──────────────────────────────────────────────
// Formato: { descricao, method, path, cargo, body, esperado }
//   esperado: status HTTP esperado
//   200 = OK, 201 = Created, 401 = Unauthorized, 403 = Forbidden

const CASOS = [
    // ── LOGIN (público) ──────────────────────────────────────────────────
    { desc: 'POST /login — credenciais erradas → 401', method: 'POST', path: '/login', cargo: 'SemToken', body: { nome: 'naoexiste@tnetlog.com.br', senha: 'senhaerrada' }, esperado: [400, 401, 422] },

    // ── VEÍCULOS ──────────────────────────────────────────────────────────
    { desc: 'GET /veiculos — sem token → 401', method: 'GET', path: '/veiculos', cargo: 'SemToken', esperado: 401 },
    { desc: 'GET /veiculos — Coordenador → 200', method: 'GET', path: '/veiculos', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /veiculos — Conhecimento → 200', method: 'GET', path: '/veiculos', cargo: 'Conhecimento', esperado: 200 },
    { desc: 'GET /veiculos — Cadastro → 200', method: 'GET', path: '/veiculos', cargo: 'Cadastro', esperado: 200 },

    { desc: 'POST /veiculos — Coordenador → aceito (400/422 body inválido)', method: 'POST', path: '/veiculos', cargo: 'Coordenador', body: {}, esperado: [200, 400, 422, 500] },
    { desc: 'POST /veiculos — Encarregado → aceito (400/422 body inválido)', method: 'POST', path: '/veiculos', cargo: 'Encarregado', body: {}, esperado: [200, 400, 422, 500] },
    { desc: 'POST /veiculos — Conhecimento → 403', method: 'POST', path: '/veiculos', cargo: 'Conhecimento', body: {}, esperado: 403 },
    { desc: 'POST /veiculos — Cadastro → 403', method: 'POST', path: '/veiculos', cargo: 'Cadastro', body: {}, esperado: 403 },
    { desc: 'POST /veiculos — sem token → 401', method: 'POST', path: '/veiculos', cargo: 'SemToken', body: {}, esperado: 401 },

    { desc: 'DELETE /veiculos/999 — Coordenador → 200|404', method: 'DELETE', path: '/veiculos/999', cargo: 'Coordenador', esperado: [200, 404] },
    { desc: 'DELETE /veiculos/999 — Encarregado → 403', method: 'DELETE', path: '/veiculos/999', cargo: 'Encarregado', esperado: 403 },
    { desc: 'DELETE /veiculos/999 — AuxOperacional → 403', method: 'DELETE', path: '/veiculos/999', cargo: 'AuxOperacional', esperado: 403 },
    { desc: 'DELETE /veiculos/999 — sem token → 401', method: 'DELETE', path: '/veiculos/999', cargo: 'SemToken', esperado: 401 },

    // ── FILA ─────────────────────────────────────────────────────────────
    { desc: 'GET /fila — sem token → 401', method: 'GET', path: '/fila', cargo: 'SemToken', esperado: 401 },
    { desc: 'GET /fila — Coordenador → 200', method: 'GET', path: '/fila', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /fila — Cadastro → 200', method: 'GET', path: '/fila', cargo: 'Cadastro', esperado: 200 },

    { desc: 'POST /fila — Encarregado → 200|201', method: 'POST', path: '/fila', cargo: 'Encarregado', body: { teste: true }, esperado: [200, 201] },
    { desc: 'POST /fila — Conhecimento → 403', method: 'POST', path: '/fila', cargo: 'Conhecimento', body: { teste: true }, esperado: 403 },
    { desc: 'POST /fila — Cadastro → 403', method: 'POST', path: '/fila', cargo: 'Cadastro', body: { teste: true }, esperado: 403 },
    { desc: 'POST /fila — sem token → 401', method: 'POST', path: '/fila', cargo: 'SemToken', body: {}, esperado: 401 },

    { desc: 'DELETE /fila/999 — Coordenador → 200|404', method: 'DELETE', path: '/fila/999', cargo: 'Coordenador', esperado: [200, 404] },
    { desc: 'DELETE /fila/999 — Encarregado → 403', method: 'DELETE', path: '/fila/999', cargo: 'Encarregado', esperado: 403 },
    { desc: 'DELETE /fila/999 — sem token → 401', method: 'DELETE', path: '/fila/999', cargo: 'SemToken', esperado: 401 },

    // ── CUBAGENS ──────────────────────────────────────────────────────────
    { desc: 'GET /cubagens — sem token → 401', method: 'GET', path: '/cubagens', cargo: 'SemToken', esperado: 401 },
    { desc: 'GET /cubagens — Coordenador → 200', method: 'GET', path: '/cubagens', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /cubagens — Cadastro → 200', method: 'GET', path: '/cubagens', cargo: 'Cadastro', esperado: 200 },

    { desc: 'POST /cubagens — Coordenador → aceito (400/422 body inválido)', method: 'POST', path: '/cubagens', cargo: 'Coordenador', body: {}, esperado: [200, 400, 422, 500] },
    { desc: 'POST /cubagens — Conhecimento → 403', method: 'POST', path: '/cubagens', cargo: 'Conhecimento', body: {}, esperado: 403 },
    { desc: 'POST /cubagens — Cadastro → 403', method: 'POST', path: '/cubagens', cargo: 'Cadastro', body: {}, esperado: 403 },
    { desc: 'POST /cubagens — sem token → 401', method: 'POST', path: '/cubagens', cargo: 'SemToken', body: {}, esperado: 401 },

    { desc: 'DELETE /cubagens/999 — Coordenador → 200|404', method: 'DELETE', path: '/cubagens/999', cargo: 'Coordenador', esperado: [200, 404] },
    { desc: 'DELETE /cubagens/999 — Encarregado → 403', method: 'DELETE', path: '/cubagens/999', cargo: 'Encarregado', esperado: 403 },
    { desc: 'DELETE /cubagens/999 — sem token → 401', method: 'DELETE', path: '/cubagens/999', cargo: 'SemToken', esperado: 401 },

    // ── USUÁRIOS ──────────────────────────────────────────────────────────
    { desc: 'GET /usuarios — Coordenador → 200', method: 'GET', path: '/usuarios', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /usuarios — Planejamento → 200', method: 'GET', path: '/usuarios', cargo: 'Planejamento', esperado: 200 },
    { desc: 'GET /usuarios — Encarregado → 403', method: 'GET', path: '/usuarios', cargo: 'Encarregado', esperado: 403 },
    { desc: 'GET /usuarios — sem token → 401', method: 'GET', path: '/usuarios', cargo: 'SemToken', esperado: 401 },

    { desc: 'DELETE /usuarios/999 — Coordenador → 200|404', method: 'DELETE', path: '/usuarios/999', cargo: 'Coordenador', esperado: [200, 404] },
    { desc: 'DELETE /usuarios/999 — Planejamento → 403', method: 'DELETE', path: '/usuarios/999', cargo: 'Planejamento', esperado: 403 },
    { desc: 'DELETE /usuarios/999 — Encarregado → 403', method: 'DELETE', path: '/usuarios/999', cargo: 'Encarregado', esperado: 403 },
    { desc: 'DELETE /usuarios/999 — sem token → 401', method: 'DELETE', path: '/usuarios/999', cargo: 'SemToken', esperado: 401 },

    // ── CONFIGURAÇÕES (CRÍTICO) ────────────────────────────────────────────
    { desc: 'GET /configuracoes — sem token → 401', method: 'GET', path: '/configuracoes', cargo: 'SemToken', esperado: 401 },
    { desc: 'GET /configuracoes — Coordenador → 200', method: 'GET', path: '/configuracoes', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /configuracoes — Encarregado → 200', method: 'GET', path: '/configuracoes', cargo: 'Encarregado', esperado: 200 },

    { desc: 'POST /configuracoes — Coordenador → 200', method: 'POST', path: '/configuracoes', cargo: 'Coordenador', body: {}, esperado: 200 },
    { desc: 'POST /configuracoes — Planejamento → 403', method: 'POST', path: '/configuracoes', cargo: 'Planejamento', body: {}, esperado: 403 },
    { desc: 'POST /configuracoes — Encarregado → 403', method: 'POST', path: '/configuracoes', cargo: 'Encarregado', body: {}, esperado: 403 },
    { desc: 'POST /configuracoes — sem token → 401', method: 'POST', path: '/configuracoes', cargo: 'SemToken', body: {}, esperado: 401 },

    // ── SOLICITAÇÕES ──────────────────────────────────────────────────────
    { desc: 'GET /solicitacoes — Coordenador → 200', method: 'GET', path: '/solicitacoes', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /solicitacoes — Encarregado → 403', method: 'GET', path: '/solicitacoes', cargo: 'Encarregado', esperado: 403 },
    { desc: 'GET /solicitacoes — sem token → 401', method: 'GET', path: '/solicitacoes', cargo: 'SemToken', esperado: 401 },

    // ── RELATÓRIOS ────────────────────────────────────────────────────────
    { desc: 'GET /relatorios — Coordenador → 200', method: 'GET', path: '/relatorios', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /relatorios — Encarregado → 200', method: 'GET', path: '/relatorios', cargo: 'Encarregado', esperado: 200 },
    { desc: 'GET /relatorios — Conhecimento → 403', method: 'GET', path: '/relatorios', cargo: 'Conhecimento', esperado: 403 },
    { desc: 'GET /relatorios — sem token → 401', method: 'GET', path: '/relatorios', cargo: 'SemToken', esperado: 401 },

    // ── LOGS ─────────────────────────────────────────────────────────────
    { desc: 'GET /logs — Coordenador → 200', method: 'GET', path: '/logs', cargo: 'Coordenador', esperado: 200 },
    { desc: 'GET /logs — Planejamento → 200', method: 'GET', path: '/logs', cargo: 'Planejamento', esperado: 200 },
    { desc: 'GET /logs — Encarregado → 403', method: 'GET', path: '/logs', cargo: 'Encarregado', esperado: 403 },
    { desc: 'GET /logs — Cadastro → 403', method: 'GET', path: '/logs', cargo: 'Cadastro', esperado: 403 },
    { desc: 'GET /logs — sem token → 401', method: 'GET', path: '/logs', cargo: 'SemToken', esperado: 401 },

    // ── CT-e STATUS ───────────────────────────────────────────────────────
    { desc: 'PUT /cte/status — Conhecimento → 200|400', method: 'PUT', path: '/cte/status', cargo: 'Conhecimento', body: {}, esperado: [200, 400, 500] },
    { desc: 'PUT /cte/status — Cadastro → 403', method: 'PUT', path: '/cte/status', cargo: 'Cadastro', body: {}, esperado: 403 },
    { desc: 'PUT /cte/status — sem token → 401', method: 'PUT', path: '/cte/status', cargo: 'SemToken', body: {}, esperado: 401 },
];

// ──────────────────────────────────────────────
// 4. EXECUTOR DE TESTES
// ──────────────────────────────────────────────
const VERDE  = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const AMARELO = '\x1b[33m';
const RESET  = '\x1b[0m';
const NEGRITO = '\x1b[1m';
const CINZA  = '\x1b[90m';

async function executarTestes() {
    console.log(`\n${NEGRITO}════════════════════════════════════════════════════${RESET}`);
    console.log(`${NEGRITO}   TRANSNET — TESTES DE RBAC (Controle de Acesso)   ${RESET}`);
    console.log(`${NEGRITO}════════════════════════════════════════════════════${RESET}\n`);

    // Verificar se servidor está online
    try {
        await axios.get(`${BASE_URL}/login`, { timeout: 3000 }).catch(() => {});
    } catch (e) {
        // Pode falhar, mas se chegar aqui é porque respondeu algo
    }

    let passou = 0;
    let falhou = 0;
    let grupoAtual = '';

    for (const caso of CASOS) {
        // Extrair grupo da descrição para separador visual
        const grupo = caso.path.split('/')[1].toUpperCase();
        if (grupo !== grupoAtual) {
            console.log(`\n${CINZA}── ${grupo} ${'─'.repeat(45 - grupo.length)}${RESET}`);
            grupoAtual = grupo;
        }

        const statusObtido = await req(caso.method, caso.path, caso.cargo, caso.body);

        // Verificar se passou — esperado pode ser número ou array de números aceitos
        const esperados = Array.isArray(caso.esperado) ? caso.esperado : [caso.esperado];
        const ok = esperados.includes(statusObtido);

        if (statusObtido === 0) {
            console.log(`  ${AMARELO}⚠  OFFLINE ${RESET} ${caso.desc}`);
            console.log(`       ${CINZA}→ Servidor não respondeu (offline ou porta incorreta)${RESET}`);
            falhou++;
        } else if (ok) {
            console.log(`  ${VERDE}✔  PASSOU  ${RESET} ${caso.desc}`);
            console.log(`       ${CINZA}→ HTTP ${statusObtido} (esperado: ${esperados.join('|')})${RESET}`);
            passou++;
        } else {
            console.log(`  ${VERMELHO}✘  FALHOU  ${RESET} ${caso.desc}`);
            console.log(`       ${CINZA}→ Obtido: HTTP ${statusObtido} | Esperado: ${esperados.join('|')}${RESET}`);
            falhou++;
        }
    }

    // ── RESUMO FINAL ─────────────────────────────────────────────────────
    const total = passou + falhou;
    const pct = total > 0 ? Math.round((passou / total) * 100) : 0;
    const corResumo = pct === 100 ? VERDE : pct >= 80 ? AMARELO : VERMELHO;

    console.log(`\n${NEGRITO}════════════════════════════════════════════════════${RESET}`);
    console.log(`${NEGRITO}   RESULTADO FINAL${RESET}`);
    console.log(`${NEGRITO}════════════════════════════════════════════════════${RESET}`);
    console.log(`   Total de testes : ${total}`);
    console.log(`   ${VERDE}Passaram${RESET}         : ${passou}`);
    console.log(`   ${VERMELHO}Falharam${RESET}         : ${falhou}`);
    console.log(`   Cobertura        : ${corResumo}${NEGRITO}${pct}%${RESET}`);

    if (pct === 100) {
        console.log(`\n   ${VERDE}${NEGRITO}✔ RBAC 100% funcional — sistema seguro!${RESET}\n`);
    } else if (falhou > 0) {
        console.log(`\n   ${VERMELHO}${NEGRITO}✘ Existem falhas de permissão — revisar antes de ir para produção!${RESET}\n`);
    }

    process.exit(falhou > 0 ? 1 : 0);
}

executarTestes();
