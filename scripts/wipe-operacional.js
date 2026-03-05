require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Apaga apenas dados operacionais de teste.
// Preserva: usuarios, marcacoes_placas, configuracoes, docas_interditadas, tokens_motoristas
const TABELAS_PARA_LIMPAR = [
    'notificacoes',
    'veiculos',
    'fila',
    'solicitacoes',
    'historico',
    'historico_cte',
    'historico_liberacoes',
    'operacao_ocorrencias',
    'cubagens',
    'cubagem_itens',
    'checklists_carreta',
    'frota_checklists',
    'frota_programacao_diaria',
    'ctes_ativos',
    'logs'
];

async function wipeOperacional() {
    console.log('🚀 Iniciando limpeza de dados operacionais (sem apagar usuários/motoristas)...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const tabela of TABELAS_PARA_LIMPAR) {
            console.log(`🧹 Limpando tabela: ${tabela}...`);
            await client.query(`TRUNCATE TABLE ${tabela} RESTART IDENTITY CASCADE`);
        }

        await client.query('COMMIT');
        console.log('✅ Limpeza operacional concluída!');
        console.log('ℹ️  Preservados: usuarios, marcacoes_placas, configuracoes, docas_interditadas, tokens_motoristas');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao limpar:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

wipeOperacional();
