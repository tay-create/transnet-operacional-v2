const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

const applyExtraction = (startIdx, endIdx, fileName) => {
    // startIdx is 0-based; so line 919 is idx 918. line 1466 is idx 1465.
    // We want slice(918, 1466) which returns elements from 918 to 1465 inclusive.
    const extracted = lines.slice(startIdx, endIdx).join('\n').replace(/app\./g, 'router.');
    const content = `const express = require('express');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize } = require('../../middleware/authMiddleware');
const { validate, novoLancamentoSchema } = require('../../middleware/validationMiddleware');

const router = express.Router();

${extracted}

module.exports = router;
`;
    fs.writeFileSync(`src/routes/${fileName}.js`, content);

    // mark lines for deletion (null them out)
    for (let i = startIdx; i < endIdx; i++) {
        lines[i] = null;
    }
};

// veiculos: lines 919 - 1466
applyExtraction(918, 1466, 'veiculos');

// ocorrencias: lines 1467 - 1522
applyExtraction(1466, 1522, 'ocorrencias');

// checklists (first block): lines 736 - 805
applyExtraction(735, 805, 'checklists');

// Clear nulled lines and add the app.use statements where the first block of routes was. Oh wait, we can just append them at the end of the imports.
lines = lines.filter(l => l !== null);

const finalServer = [];
let routeImportsAdded = false;
for (let line of lines) {
    if (line.includes('// --- BANCO DE DADOS ---') && !routeImportsAdded) {
        finalServer.push(line);
        finalServer.push("app.use('/veiculos', require('./src/routes/veiculos'));");
        finalServer.push("app.use('/api/ocorrencias', require('./src/routes/ocorrencias')); // Ensure prefix if needed, or simply app.use('/', ...)");
        finalServer.push("app.use('/', require('./src/routes/veiculos')); // Keeping root for legacy /veiculos calls");
        finalServer.push("app.use('/', require('./src/routes/ocorrencias'));");
        finalServer.push("app.use('/', require('./src/routes/checklists'));");
        routeImportsAdded = true;
    } else {
        finalServer.push(line);
    }
}

fs.writeFileSync('server.js', finalServer.join('\n'));
console.log('Extraction completed successfully!');
