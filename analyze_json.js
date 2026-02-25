const { dbAll } = require('./src/database/db.js');

async function analyze() {
    try {
        const rows = await dbAll('SELECT dados_json FROM veiculos WHERE dados_json IS NOT NULL');
        const keys = {};
        rows.forEach(r => {
            try {
                const j = JSON.parse(r.dados_json);
                Object.keys(j).forEach(k => {
                    keys[k] = (keys[k] || 0) + 1;
                });
            } catch (e) { }
        });

        console.log('Keys inside dados_json:');
        const sorted = Object.entries(keys).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([k, count]) => console.log(`${k}: ${count}`));
    } catch (err) {
        console.error("Database Error:", err);
    }
    process.exit(0);
}

analyze();
