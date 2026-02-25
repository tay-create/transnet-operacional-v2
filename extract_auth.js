const fs = require('fs');
const txt = fs.readFileSync('server.js', 'utf8');
const lines = txt.split('\n');

const extracted = lines.slice(1522, 1646).join('\n').replace(/app\./g, 'router.');

const routesContent = `const express = require('express');
const bcrypt = require('bcryptjs');
const { dbRun, dbAll, dbGet } = require('../database/db');
const { authMiddleware, authorize, generateToken } = require('../middleware/authMiddleware');
const { validate, loginSchema, cadastroUsuarioSchema } = require('../middleware/validationMiddleware');

const router = express.Router();

${extracted}

module.exports = router;
`;

fs.writeFileSync('src/routes/auth.js', routesContent);

const newServer = [...lines.slice(0, 1522), "app.use('/', require('./src/routes/auth'));", ...lines.slice(1646)].join('\n');
fs.writeFileSync('server.js', newServer);
console.log('Extração concluída com sucesso!');
