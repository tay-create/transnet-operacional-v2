require('dotenv').config();
const { dbAll } = require('./src/database/db');
dbAll("SELECT id, placa, motorista, operacao, data_prevista FROM veiculos ORDER BY id DESC LIMIT 50")
  .then(rows => {
    console.log('Recent vehicles data:');
    rows.forEach(r => {
      console.log(`ID: ${r.id} | Placa: ${r.placa} | Op: ${r.operacao} | Data: ${r.data_prevista}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
