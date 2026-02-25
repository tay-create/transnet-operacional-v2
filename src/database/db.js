const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../tnetlog.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Erro SQLite:', err.message);
    else {
        console.log('Conectado ao SQLite (src/database/db.js).');
    }
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows); });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
});

module.exports = { db, dbRun, dbAll, dbGet };
