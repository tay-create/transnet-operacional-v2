const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database('tnetlog.db');
db.all("SELECT type, name, sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) throw err;
    let out = '';
    rows.forEach(r => {
        out += `-- Table: ${r.name}\n${r.sql}\n\n`;
    });
    fs.writeFileSync('schema.txt', out);
});
