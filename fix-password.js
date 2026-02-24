const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./tnetlog.db');

async function fixPasswords() {
    // Hash da senha '123'
    const hashedPassword = await bcrypt.hash('123', 10);

    console.log('Atualizando senhas para formato bcrypt...');
    console.log('Novo hash:', hashedPassword);

    // Atualizar usuário julio
    db.run(
        "UPDATE usuarios SET senha = ? WHERE email = ?",
        [hashedPassword, 'julio@tnetlog.com.br'],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar julio:', err);
            } else {
                console.log('✅ Senha de julio@tnetlog.com.br atualizada!');
            }

            // Atualizar usuário teste
            db.run(
                "UPDATE usuarios SET senha = ? WHERE email = ?",
                [hashedPassword, 'teste@tnetlog.com.br'],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao atualizar teste:', err);
                    } else {
                        console.log('✅ Senha de teste@tnetlog.com.br atualizada!');
                    }

                    // Verificar
                    db.get("SELECT nome, email, senha FROM usuarios WHERE email = ?", ['julio@tnetlog.com.br'], (err, user) => {
                        if (user) {
                            console.log('\n📋 Verificação:');
                            console.log('   Email:', user.email);
                            console.log('   Hash atual:', user.senha);
                        }
                        db.close();
                        console.log('\n✅ Concluído! Reinicie o servidor e tente fazer login.');
                    });
                }
            );
        }
    );
}

fixPasswords();
