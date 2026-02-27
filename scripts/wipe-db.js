require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const TABELAS_PARA_LIMPAR = [
    'notificacoes',
    'veiculos',
    'fila',
    'solicitacoes',
    'historico',
    'historico_cte',
    'operacao_ocorrencias',
    'cubagens',
    'cubagem_itens',
    'historico_liberacoes',
    'checklists_carreta',
    'marcacoes_placas',
    'tokens_motoristas',
    'frota_checklists',
    'frota_programacao_diaria',
    'logs'
];

async function wipeDatabase() {
    console.log('🚀 Iniciando limpeza de dados operacionais...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const tabela of TABELAS_PARA_LIMPAR) {
            console.log(`🧹 Limpando tabela: ${tabela}...`);
            await client.query(`TRUNCATE TABLE ${tabela} RESTART IDENTITY CASCADE`);
        }

        await client.query('COMMIT');
        console.log('✅ Limpeza concluída com sucesso!');
        console.log('ℹ️ As tabelas "usuarios", "configuracoes" e "docas_interditadas" foram preservadas.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao limpar banco de dados:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

wipeDatabase();
