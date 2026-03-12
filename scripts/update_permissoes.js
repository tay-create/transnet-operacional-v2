require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const PERMISSOES_ACESSO = JSON.stringify({
    'Coordenador':      ['operacao','cte','cubagem','relatorios','relatorio_op','dashboard_tv','fila','ver_unidade_recife','ver_unidade_moreno','performance_cte','gestao_frota','cadastro','checklist_carreta','historico_liberacoes'],
    'Planejamento':     ['operacao','cte','cubagem','relatorios','relatorio_op','dashboard_tv','fila','ver_unidade_recife','ver_unidade_moreno','performance_cte','gestao_frota','cadastro','checklist_carreta','historico_liberacoes'],
    'Encarregado':      ['operacao','ver_unidade_recife','ver_unidade_moreno','cadastro'],
    'Aux. Operacional': ['operacao','cte','ver_unidade_recife','ver_unidade_moreno','cadastro','fila'],
    'Conhecimento':     ['operacao','cte','ver_unidade_recife','ver_unidade_moreno','cadastro'],
    'Cadastro':         ['operacao','cte','ver_unidade_recife','ver_unidade_moreno','cadastro'],
    'Dashboard Viewer': ['dashboard_tv'],
    'Conferente':       ['ver_unidade_recife','ver_unidade_moreno'],
    'Pos Embarque':     ['marcacao_placas','ver_unidade_recife','ver_unidade_moreno']
});

const PERMISSOES_EDICAO = JSON.stringify({
    'Coordenador':      ['lancamento','operacao','editar_operacao_card','coleta_card','adiar_dia','timer_solicitado','timer_liberado','gestao_tempo','cte','cubagem','fila'],
    'Planejamento':     ['lancamento','operacao','editar_operacao_card','coleta_card','adiar_dia','timer_solicitado','timer_liberado','gestao_tempo','cte','cubagem','fila'],
    'Encarregado':      ['operacao','editar_operacao_card','coleta_card','adiar_dia','timer_solicitado','timer_liberado','gestao_tempo'],
    'Aux. Operacional': ['operacao','editar_operacao_card','coleta_card','adiar_dia','timer_solicitado','timer_liberado','gestao_tempo','fila'],
    'Conhecimento':     ['cte'],
    'Cadastro':         [],
    'Conferente':       [],
    'Pos Embarque':     ['marcacao_placas']
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query("UPDATE configuracoes SET valor = $1 WHERE chave = 'permissoes_acesso'", [PERMISSOES_ACESSO]);
        console.log('✅ permissoes_acesso atualizado no banco.');

        await client.query("UPDATE configuracoes SET valor = $1 WHERE chave = 'permissoes_edicao'", [PERMISSOES_EDICAO]);
        console.log('✅ permissoes_edicao atualizado no banco.');

        // Verificação
        const r1 = await client.query("SELECT valor FROM configuracoes WHERE chave = 'permissoes_acesso'");
        const r2 = await client.query("SELECT valor FROM configuracoes WHERE chave = 'permissoes_edicao'");
        console.log('\n📋 Permissões de Acesso salvas:', JSON.parse(r1.rows[0].valor));
        console.log('\n📋 Permissões de Edição salvas:', JSON.parse(r2.rows[0].valor));
    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
