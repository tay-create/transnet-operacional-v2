const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./tnetlog.db');

db.get("SELECT * FROM usuarios WHERE email = ?", ['julio@tnetlog.com.br'], async (err, user) => {
    if (err) {
        console.error('Erro ao buscar usuário:', err);
        db.close();
        return;
    }

    if (!user) {
        console.log('❌ Usuário julio@tnetlog.com.br NÃO encontrado no banco');
        db.close();
        return;
    }

    console.log('✅ Usuário encontrado:');
    console.log('   ID:', user.id);
    console.log('   Nome:', user.nome);
    console.log('   Email:', user.email);
    console.log('   Cargo:', user.cargo);
    console.log('   Senha hash:', user.senha);
    console.log('');

    // Testar senha '123'
    const senhaValida = await bcrypt.compare('123', user.senha);
    console.log('Testando senha "123":', senhaValida ? '✅ VÁLIDA' : '❌ INVÁLIDA');

    // Criar novo hash para comparar
    const novoHash = await bcrypt.hash('123', 10);
    console.log('');
    console.log('Hash novo gerado para "123":', novoHash);
    console.log('Hash no banco:', user.senha);

    db.close();
});
