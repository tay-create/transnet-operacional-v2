const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', user: 'postgres', password: '124578595', database: 'transnet', port: 5432 });
async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT timestamps_status, tempos_moreno FROM veiculos WHERE id = ', [62]);
    const ts = JSON.parse(res.rows[0].timestamps_status || '{}');
    const tempos = JSON.parse(res.rows[0].tempos_moreno || '{}');
    ts['carregamento_moreno_at'] = '2026-03-19T11:37:38.000Z';
    tempos['t_inicio_carregamento'] = '08:37';
    const upd = await client.query(
      'UPDATE veiculos SET status_moreno = , timestamps_status = , tempos_moreno =  WHERE id = 62 RETURNING id, status_moreno',
      ['EM CARREGAMENTO', JSON.stringify(ts), JSON.stringify(tempos)]
    );
    console.log('Updated:', JSON.stringify(upd.rows[0]));
  } finally {
    client.release();
    pool.end();
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });
