const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tnetlog.db');

console.log('Adicionando coluna numero_coleta na tabela veiculos...');

db.run(`ALTER TABLE veiculos ADD COLUMN numero_coleta TEXT`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('✅ Coluna numero_coleta já existe!');
        } else {
            console.error('❌ Erro ao adicionar coluna:', err.message);
        }
    } else {
        console.log('✅ Coluna numero_coleta adicionada com sucesso!');
    }
    db.close();
});
