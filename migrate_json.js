const { dbRun, dbAll } = require('./src/database/db.js');
const { inicializarBanco } = require('./src/database/migrations.js');

async function migrate() {
    console.log("Iniciando migração de dados_json para colunas relacionais...");
    try {
        await inicializarBanco();
        console.log("Banco sincronizado e colunas criadas.");

        const veiculos = await dbAll('SELECT id, dados_json FROM veiculos WHERE dados_json IS NOT NULL');
        let count = 0;

        for (const v of veiculos) {
            try {
                const j = JSON.parse(v.dados_json);
                const updates = {};
                let hasUpdates = false;

                if (j.tipoVeiculo) { updates.tipoVeiculo = j.tipoVeiculo; hasUpdates = true; }
                if (j.telefoneMotorista) { updates.telefoneMotorista = j.telefoneMotorista; hasUpdates = true; }
                if (j.isFrotaMotorista !== undefined) { updates.isFrotaMotorista = j.isFrotaMotorista ? 1 : 0; hasUpdates = true; }
                if (j.placa1Motorista) { updates.placa1Motorista = j.placa1Motorista; hasUpdates = true; }
                if (j.placa2Motorista) { updates.placa2Motorista = j.placa2Motorista; hasUpdates = true; }
                if (j.timestamps_status) { updates.timestamps_status = JSON.stringify(j.timestamps_status); hasUpdates = true; }

                if (hasUpdates) {
                    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                    const values = Object.values(updates);
                    values.push(v.id);

                    await dbRun(`UPDATE veiculos SET ${setClause} WHERE id = ?`, values);
                    count++;
                }
            } catch (e) {
                console.error(`Erro no veículo ID ${v.id}:`, e);
            }
        }
        console.log(`Migração concluída! ${count} veículos atualizados.`);
    } catch (err) {
        console.error("Erro na migração:", err);
    }
    process.exit(0);
}

// Guarantee tables are updated first before migrating
const { execSync } = require('child_process');
try {
    // restart server slowly to let migrations.js run? No, db.js runs migrations on import.
    migrate();
} catch (e) {
    console.error(e);
    process.exit(1);
}
