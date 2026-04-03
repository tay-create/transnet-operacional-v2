const express = require('express');
const fs = require('fs');
const path = require('path');

const TASKS_FILE = '/home/transnet/decisions/tasks.json';
const LOG_FILE = '/home/transnet/decisions/tasks.log';

function loadTasks() {
    try {
        if (!fs.existsSync(TASKS_FILE)) return [];
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch { return []; }
}

function saveTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function appendLog(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf8');
}

function nextId(tasks) {
    return tasks.length === 0 ? 1 : Math.max(...tasks.map(t => t.id)) + 1;
}

const PRIORIDADE_LABEL = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Urgente' };
const PRIORIDADE_COR   = { 1: '#64748b', 2: '#2563eb', 3: '#f59e0b', 4: '#ef4444' };

function gerarHtml(key) {
    const tasks = loadTasks();
    const pendentes  = tasks.filter(t => t.status !== 'concluida').sort((a, b) => b.prioridade - a.prioridade || new Date(a.criadaEm) - new Date(b.criadaEm));
    const concluidas = tasks.filter(t => t.status === 'concluida').sort((a, b) => new Date(b.concluidaEm) - new Date(a.concluidaEm));

    const renderTask = (t) => {
        const cor = PRIORIDADE_COR[t.prioridade] || '#64748b';
        const pLabel = PRIORIDADE_LABEL[t.prioridade] || '?';
        const isConcluida = t.status === 'concluida';
        return `
        <div class="task-card ${isConcluida ? 'done' : ''}" id="task-${t.id}">
            <div class="task-header">
                <span class="badge" style="background:${cor}20;color:${cor};border:1px solid ${cor}40">${pLabel}</span>
                ${t.status === 'em_progresso' ? '<span class="badge-prog">Em progresso</span>' : ''}
                ${isConcluida ? '<span class="badge-done">Concluída</span>' : ''}
                <div class="task-actions">
                    ${!isConcluida ? `
                    <button class="btn-icon" onclick="editarTask(${t.id})" title="Editar">✏️</button>
                    <button class="btn-icon btn-done" onclick="concluirTask(${t.id})" title="Marcar concluída">✓</button>
                    ` : ''}
                    <button class="btn-icon btn-del" onclick="deletarTask(${t.id})" title="Excluir">✕</button>
                </div>
            </div>
            <div class="task-title">${escHtml(t.titulo)}</div>
            ${t.descricao ? `<div class="task-desc">${escHtml(t.descricao)}</div>` : ''}
            ${t.resultado ? `<div class="task-resultado"><strong>Resultado:</strong> ${escHtml(t.resultado)}</div>` : ''}
            <div class="task-meta">
                Criada ${new Date(t.criadaEm).toLocaleString('pt-BR')}
                ${isConcluida && t.concluidaEm ? ` · Concluída ${new Date(t.concluidaEm).toLocaleString('pt-BR')}` : ''}
            </div>
        </div>`;
    };

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tasks — Transnet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 24px 16px; }
  h1 { font-size: 22px; font-weight: 800; color: #f1f5f9; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #475569; margin-bottom: 24px; }
  .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin-bottom: 20px; }
  label { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 6px; margin-top: 14px; }
  label:first-child { margin-top: 0; }
  input[type=text], textarea, select { width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #f1f5f9; font-size: 14px; padding: 10px 12px; outline: none; transition: border 0.2s; }
  input[type=text]:focus, textarea:focus, select:focus { border-color: #6366f1; }
  textarea { resize: vertical; min-height: 70px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: #6366f1; color: #fff; width: 100%; justify-content: center; margin-top: 16px; }
  .btn-icon { background: none; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; cursor: pointer; padding: 4px 8px; font-size: 13px; margin-left: 4px; transition: all 0.2s; }
  .btn-icon:hover { border-color: #6366f1; color: #6366f1; }
  .btn-done:hover { border-color: #22c55e !important; color: #22c55e !important; }
  .btn-del:hover { border-color: #ef4444 !important; color: #ef4444 !important; }
  .section-title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; }
  .task-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 10px; transition: border-color 0.2s; }
  .task-card:hover { border-color: #475569; }
  .task-card.done { opacity: 0.5; }
  .task-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .task-actions { margin-left: auto; }
  .badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.4px; }
  .badge-prog { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
  .badge-done { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
  .task-title { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
  .task-desc { font-size: 13px; color: #94a3b8; margin-bottom: 6px; white-space: pre-wrap; }
  .task-resultado { font-size: 13px; color: #86efac; background: rgba(34,197,94,0.07); border: 1px solid rgba(34,197,94,0.15); border-radius: 8px; padding: 8px 12px; margin: 8px 0; white-space: pre-wrap; }
  .task-meta { font-size: 11px; color: #334155; }
  .empty { text-align: center; padding: 32px; color: #334155; font-size: 14px; }
  .log-box { background: #0a0f1e; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 12px; color: #64748b; max-height: 220px; overflow-y: auto; white-space: pre-wrap; margin-top: 8px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; }
  .tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid #334155; background: none; color: #64748b; transition: all 0.2s; }
  .tab.active { background: rgba(99,102,241,0.15); color: #818cf8; border-color: rgba(99,102,241,0.3); }
  #modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100; align-items:center; justify-content:center; }
  #modal-overlay.open { display:flex; }
  #modal { background:#1e293b; border:1px solid #334155; border-radius:16px; padding:24px; width:100%; max-width:480px; }
  #modal h2 { font-size:16px; font-weight:700; margin-bottom:16px; color:#f1f5f9; }
  .btn-cancel { background:#1e293b; color:#94a3b8; border:1px solid #334155; margin-top:10px; width:100%; justify-content:center; }
</style>
</head>
<body>
<h1>Task Dashboard</h1>
<p class="subtitle">Tarefas do projeto Transnet Operacional · Cron autônomo ativo (a cada hora)</p>

<div class="tabs">
  <button class="tab active" onclick="showTab('pendentes')">Pendentes (${pendentes.length})</button>
  <button class="tab" onclick="showTab('concluidas')">Concluídas (${concluidas.length})</button>
  <button class="tab" onclick="showTab('log')">Log</button>
</div>

<!-- Nova tarefa -->
<div class="card">
  <label>Título *</label>
  <input type="text" id="inp-titulo" placeholder="Ex: Corrigir bug no MobileDashboardTV" />
  <label>Descrição (contexto para o Claude)</label>
  <textarea id="inp-desc" placeholder="Descreva o que precisa ser feito com detalhes..."></textarea>
  <label>Prioridade</label>
  <select id="inp-prio">
    <option value="4">🔴 Urgente</option>
    <option value="3" selected>🟠 Alta</option>
    <option value="2">🔵 Média</option>
    <option value="1">⚪ Baixa</option>
  </select>
  <button class="btn btn-primary" onclick="adicionarTask()">+ Adicionar Tarefa</button>
</div>

<!-- Pendentes -->
<div id="tab-pendentes">
  <div class="section-title">Pendentes</div>
  ${pendentes.length === 0 ? '<div class="empty">Nenhuma tarefa pendente.</div>' : pendentes.map(renderTask).join('')}
</div>

<!-- Concluídas -->
<div id="tab-concluidas" style="display:none">
  <div class="section-title">Concluídas</div>
  ${concluidas.length === 0 ? '<div class="empty">Nenhuma tarefa concluída ainda.</div>' : concluidas.map(renderTask).join('')}
</div>

<!-- Log -->
<div id="tab-log" style="display:none">
  <div class="section-title">Atividade Recente</div>
  <div class="log-box" id="log-content">Carregando...</div>
</div>

<!-- Modal de edição -->
<div id="modal-overlay">
  <div id="modal">
    <h2>Editar Tarefa</h2>
    <input type="hidden" id="edit-id" />
    <label>Título</label>
    <input type="text" id="edit-titulo" />
    <label>Descrição</label>
    <textarea id="edit-desc"></textarea>
    <label>Prioridade</label>
    <select id="edit-prio">
      <option value="4">🔴 Urgente</option>
      <option value="3">🟠 Alta</option>
      <option value="2">🔵 Média</option>
      <option value="1">⚪ Baixa</option>
    </select>
    <button class="btn btn-primary" onclick="salvarEdicao()">Salvar</button>
    <button class="btn btn-cancel" onclick="fecharModal()">Cancelar</button>
  </div>
</div>

<script>
const KEY = '${key}';

function showTab(name) {
  ['pendentes','concluidas','log'].forEach(t => {
    document.getElementById('tab-'+t).style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['pendentes','concluidas','log'][i] === name);
  });
  if (name === 'log') carregarLog();
}

async function api(method, path, body) {
  const r = await fetch('/admin/tasks/api' + path + '?key=' + KEY, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

async function adicionarTask() {
  const titulo = document.getElementById('inp-titulo').value.trim();
  if (!titulo) { alert('Título obrigatório.'); return; }
  await api('POST', '', {
    titulo,
    descricao: document.getElementById('inp-desc').value.trim(),
    prioridade: Number(document.getElementById('inp-prio').value)
  });
  location.reload();
}

async function deletarTask(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  await api('DELETE', '/' + id);
  location.reload();
}

async function concluirTask(id) {
  await api('PATCH', '/' + id + '/concluir');
  location.reload();
}

function editarTask(id) {
  const card = document.getElementById('task-' + id);
  const titulo = card.querySelector('.task-title').textContent;
  const desc = card.querySelector('.task-desc')?.textContent || '';
  const badgeText = card.querySelector('.badge').textContent.trim();
  const prioMap = { 'Urgente': 4, 'Alta': 3, 'Média': 2, 'Baixa': 1 };
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-titulo').value = titulo;
  document.getElementById('edit-desc').value = desc;
  document.getElementById('edit-prio').value = prioMap[badgeText] || 3;
  document.getElementById('modal-overlay').classList.add('open');
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function salvarEdicao() {
  const id = document.getElementById('edit-id').value;
  await api('PUT', '/' + id, {
    titulo: document.getElementById('edit-titulo').value.trim(),
    descricao: document.getElementById('edit-desc').value.trim(),
    prioridade: Number(document.getElementById('edit-prio').value)
  });
  fecharModal();
  location.reload();
}

async function carregarLog() {
  const r = await api('GET', '/log');
  document.getElementById('log-content').textContent = r.log || '(vazio)';
}

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});
</script>
</body>
</html>`;
}

function escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = function createTasksRouter(adminAuth) {
    const router = express.Router();

    // Dashboard HTML
    router.get('/admin/tasks', adminAuth, (req, res) => {
        res.send(gerarHtml(req.query.key));
    });

    // API — listar
    router.get('/admin/tasks/api', adminAuth, (req, res) => {
        res.json({ success: true, tasks: loadTasks() });
    });

    // API — criar
    router.post('/admin/tasks/api', adminAuth, (req, res) => {
        const { titulo, descricao, prioridade } = req.body;
        if (!titulo) return res.status(400).json({ success: false, message: 'Título obrigatório.' });
        const tasks = loadTasks();
        const nova = {
            id: nextId(tasks),
            titulo: titulo.trim(),
            descricao: (descricao || '').trim(),
            prioridade: Number(prioridade) || 2,
            status: 'pendente',
            criadaEm: new Date().toISOString(),
            concluidaEm: null,
            resultado: null
        };
        tasks.push(nova);
        saveTasks(tasks);
        appendLog(`CRIADA #${nova.id} [P${nova.prioridade}] "${nova.titulo}"`);
        res.json({ success: true, task: nova });
    });

    // API — editar
    router.put('/admin/tasks/api/:id', adminAuth, (req, res) => {
        const id = Number(req.params.id);
        const tasks = loadTasks();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Não encontrada.' });
        const { titulo, descricao, prioridade } = req.body;
        if (titulo) tasks[idx].titulo = titulo.trim();
        if (descricao !== undefined) tasks[idx].descricao = descricao.trim();
        if (prioridade) tasks[idx].prioridade = Number(prioridade);
        saveTasks(tasks);
        appendLog(`EDITADA #${id} "${tasks[idx].titulo}"`);
        res.json({ success: true });
    });

    // API — deletar
    router.delete('/admin/tasks/api/:id', adminAuth, (req, res) => {
        const id = Number(req.params.id);
        const tasks = loadTasks();
        const task = tasks.find(t => t.id === id);
        if (!task) return res.status(404).json({ success: false, message: 'Não encontrada.' });
        saveTasks(tasks.filter(t => t.id !== id));
        appendLog(`DELETADA #${id} "${task.titulo}"`);
        res.json({ success: true });
    });

    // API — concluir manualmente
    router.patch('/admin/tasks/api/:id/concluir', adminAuth, (req, res) => {
        const id = Number(req.params.id);
        const tasks = loadTasks();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Não encontrada.' });
        tasks[idx].status = 'concluida';
        tasks[idx].concluidaEm = new Date().toISOString();
        saveTasks(tasks);
        appendLog(`CONCLUÍDA MANUALMENTE #${id} "${tasks[idx].titulo}"`);
        res.json({ success: true });
    });

    // API — log (últimas 100 linhas)
    router.get('/admin/tasks/api/log', adminAuth, (req, res) => {
        try {
            if (!fs.existsSync(LOG_FILE)) return res.json({ success: true, log: '(sem registros ainda)' });
            const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
            res.json({ success: true, log: lines.slice(-100).reverse().join('\n') });
        } catch { res.json({ success: true, log: '(erro ao ler log)' }); }
    });

    return router;
};
