const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', user: 'postgres', password: '124578595', database: 'transnet', port: 5432 });
pool.query('SELECT timestamps_status, tempos_moreno FROM veiculos WHERE id = 62').then(function(res) {
  var ts = JSON.parse(res.rows[0].timestamps_status || '{}');
  var tempos = JSON.parse(res.rows[0].tempos_moreno || '{}');
  ts.carregamento_moreno_at = '2026-03-19T11:37:38.000Z';
  tempos.t_inicio_carregamento = '08:37';
  return pool.query('UPDATE veiculos SET status_moreno = , timestamps_status = , tempos_moreno =  WHERE id = 62 RETURNING id, status_moreno', ['EM CARREGAMENTO', JSON.stringify(ts), JSON.stringify(tempos)]);
}).then(function(upd) { console.log(JSON.stringify(upd.rows[0])); pool.end(); }).catch(function(e) { console.error(e.message); pool.end(); });
