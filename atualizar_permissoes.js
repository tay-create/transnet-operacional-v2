const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'tnetlog.db');
const db = new sqlite3.Database(DB_PATH);

// Novas permissões corretas
const PERMISSOES_ACESSO = {
    'Coordenador': ['operacao', 'cte', 'relatorios', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Planejamento': ['operacao', 'cte', 'relatorios', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Encarregado': ['operacao', 'cte', 'relatorios'],
    'Aux. Operacional': ['operacao', 'cte'],
    'Conhecimento': ['cte', 'operacao'],
    'Cadastro': ['operacao']
};

const PERMISSOES_EDICAO = {
    'Coordenador': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'fila'],
    'Planejamento': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte'],
    'Encarregado': ['operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo'],
    'Aux. Operacional': ['operacao', 'editar_operacao_card', 'coleta_card', 'timer_solicitado', 'timer_liberado'],
    'Conhecimento': ['cte'],
    'Cadastro': []
};

console.log('🔄 Atualizando permissões no banco de dados...\n');

// Atualizar permissões na tabela configuracoes
db.serialize(() => {
    // Atualizar permissões de acesso
    db.run(
        "UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_acesso'",
        [JSON.stringify(PERMISSOES_ACESSO)],
        (err) => {
            if (err) {
                console.error('❌ Erro ao atualizar permissões de acesso:', err);
            } else {
                console.log('✅ Permissões de ACESSO atualizadas!');
            }
        }
    );

    // Atualizar permissões de edição
    db.run(
        "UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_edicao'",
        [JSON.stringify(PERMISSOES_EDICAO)],
        (err) => {
            if (err) {
                console.error('❌ Erro ao atualizar permissões de edição:', err);
            } else {
                console.log('✅ Permissões de EDIÇÃO atualizadas!');
            }
        }
    );

    // Resetar permissões individuais para usar as padrões do cargo
    db.run(
        "UPDATE usuarios SET usaPermissaoIndividual = 0, permissoesAcesso = '[]', permissoesEdicao = '[]' WHERE usaPermissaoIndividual = 1",
        (err) => {
            if (err) {
                console.error('❌ Erro ao resetar permissões individuais:', err);
            } else {
                console.log('✅ Permissões individuais resetadas para padrão do cargo!');
            }
        }
    );
});

// Fechar banco após 2 segundos
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Erro ao fechar banco:', err);
        } else {
            console.log('\n✨ Banco de dados atualizado com sucesso!');
            console.log('🔄 Reinicie o servidor (node server.js) para aplicar as mudanças.\n');
        }
        process.exit(0);
    });
}, 2000);
