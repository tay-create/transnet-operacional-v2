require('dotenv').config();
const { dbAll } = require('./src/database/db');
dbAll("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'")
  .then(tables => {
    console.log('Tables in database:');
    tables.forEach(t => console.log("- " + t.tablename));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
