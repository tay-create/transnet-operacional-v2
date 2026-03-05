const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on('error', (err) => {
    console.error('Erro inesperado no cliente PostgreSQL', err);
});

console.log('Conectado ao PostgreSQL (src/database/db.js).');

// Auxiliar para converter interrogações para formato PostgreSQL e emular .lastID
const convertSql = (sql) => {
    let index = 1;
    // Substitui cada ? por $1, $2, etc.
    let pgSql = sql.replace(/\?/g, () => `$${index++}`);

    // Auto-inserir RETURNING id para INSERTs para manter o comportamento de (result.lastID)
    const upperSql = pgSql.trim().toUpperCase();
    if (upperSql.startsWith('INSERT') && !upperSql.includes('RETURNING') && !upperSql.includes('INTO CONFIGURACOES')) {
        pgSql += ' RETURNING id';
    }

    return pgSql;
};

const dbRun = async (sql, params = []) => {
    const pgSql = convertSql(sql);
    const client = await pool.connect();
    try {
        const result = await client.query(pgSql, params);
        return {
            lastID: result.rows && result.rows.length > 0 ? result.rows[0].id : null,
            changes: result.rowCount
        };
    } catch (e) {
        console.error('Erro dbRun:', pgSql, params, e);
        throw e;
    } finally {
        client.release();
    }
};

const dbAll = async (sql, params = []) => {
    const pgSql = convertSql(sql);
    const client = await pool.connect();
    try {
        const result = await client.query(pgSql, params);
        return result.rows;
    } catch (e) {
        console.error('Erro dbAll:', pgSql, params, e);
        throw e;
    } finally {
        client.release();
    }
};

const dbGet = async (sql, params = []) => {
    const pgSql = convertSql(sql);
    const client = await pool.connect();
    try {
        const result = await client.query(pgSql, params);
        return result.rows.length ? result.rows[0] : null;
    } catch (e) {
        console.error('Erro dbGet:', pgSql, params, e);
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Executa múltiplas operações dentro de uma transaction PostgreSQL.
 * Em caso de erro, faz ROLLBACK automático.
 * @param {function} fn - Função assíncrona que recebe { run, all, get } com o client da transaction
 * @returns {*} Retorno da função fn
 */
const dbTransaction = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const run = async (sql, params = []) => {
            const pgSql = convertSql(sql);
            const result = await client.query(pgSql, params);
            return {
                lastID: result.rows && result.rows.length > 0 ? result.rows[0].id : null,
                changes: result.rowCount
            };
        };
        const all = async (sql, params = []) => {
            const pgSql = convertSql(sql);
            const result = await client.query(pgSql, params);
            return result.rows;
        };
        const get = async (sql, params = []) => {
            const pgSql = convertSql(sql);
            const result = await client.query(pgSql, params);
            return result.rows.length ? result.rows[0] : null;
        };
        const resultado = await fn({ run, all, get });
        await client.query('COMMIT');
        return resultado;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Erro na transaction (ROLLBACK):', e);
        throw e;
    } finally {
        client.release();
    }
};

module.exports = { db: pool, dbRun, dbAll, dbGet, dbTransaction };
