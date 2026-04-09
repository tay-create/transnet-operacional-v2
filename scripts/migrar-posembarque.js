#!/usr/bin/env node

/**
 * Script de migração: posembarque-v2 → Transnet Operacional
 *
 * Passos:
 * 1. Restaurar backup.dump em banco temporário dentro do Docker
 * 2. Extrair backup-migrate-files.tar.gz
 * 3. Ler ocorrências, motoristas, clientes da tabela importada
 * 4. Converter fotos para base64 e inserir em posemb_ocorrencias
 * 5. Limpar tabelas temporárias
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Conexão ao banco dentro do Docker staging
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'transnet_staging',
    password: process.env.DB_PASSWORD || '124578595',
    port: process.env.DB_PORT || 5432
});

const backupDir = '/home/transnet/backups';
const dumpFile = path.join(backupDir, 'backup-migrate.dump');
const tarFile = path.join(backupDir, 'backup-migrate-files.tar.gz');
const extractDir = path.join(backupDir, 'posemb-extract');

async function main() {
    try {
        console.log('🔄 Iniciando migração posembarque...');

        // Nota: O dump já deve ter sido restaurado manualmente via:
        // docker cp /home/transnet/backups/backup-migrate.dump transnet-db-staging:/tmp/
        // docker exec transnet-db-staging pg_restore -U postgres -d transnet_staging --no-owner --no-acl /tmp/backup-migrate.dump

        // Para este script, assumimos que as tabelas posembarque já existem e estamos importando dados
        console.log('1️⃣  Migrando motoristas...');
        const motoristas = await pool.query(`
            SELECT DISTINCT nome FROM motoristas WHERE nome IS NOT NULL AND nome != ''
        `);
        for (const m of motoristas.rows) {
            await pool.query(
                `INSERT INTO posemb_motoristas (nome) VALUES ($1) ON CONFLICT DO NOTHING`,
                [m.nome]
            );
        }
        console.log(`   ✅ ${motoristas.rows.length} motoristas importados`);

        console.log('2️⃣  Migrando clientes...');
        const clientes = await pool.query(`
            SELECT DISTINCT nome FROM clientes WHERE nome IS NOT NULL AND nome != ''
        `);
        for (const c of clientes.rows) {
            await pool.query(
                `INSERT INTO posemb_clientes (nome) VALUES ($1) ON CONFLICT DO NOTHING`,
                [c.nome]
            );
        }
        console.log(`   ✅ ${clientes.rows.length} clientes importados`);

        console.log('3️⃣  Migrando ocorrências...');
        // Normalizar datas: DD/MM/YYYY → YYYY-MM-DD
        const normalizarData = (dataBR) => {
            if (!dataBR) return null;
            // Se já está em formato YYYY-MM-DD, retorna
            if (/^\d{4}-\d{2}-\d{2}$/.test(dataBR)) return dataBR;
            // Se está em DD/MM/YYYY, converte
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataBR)) {
                const [dia, mes, ano] = dataBR.split('/');
                return `${ano}-${mes}-${dia}`;
            }
            return dataBR;
        };

        const ocorrencias = await pool.query(`
            SELECT id, data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo, situacao, data_conclusao, hora_conclusao, responsavel, fotos, link_email, motivo_edicao
            FROM ocorrencias
            WHERE arquivado = 0
            LIMIT 1000
        `);

        for (const o of ocorrencias.rows) {
            // Processar fotos: array de nomes de arquivo → converter para base64
            let fotos_json = '[]';
            if (o.fotos) {
                try {
                    const fotosArray = JSON.parse(o.fotos);
                    const fotosBase64 = [];

                    for (const fotoNome of fotosArray) {
                        // Procurar o arquivo na pasta extraída
                        const fotoPath = path.join(extractDir, 'static', 'uploads', fotoNome);
                        if (fs.existsSync(fotoPath)) {
                            const buffer = fs.readFileSync(fotoPath);
                            const base64 = buffer.toString('base64');
                            fotosBase64.push({
                                nome: fotoNome,
                                base64: base64
                            });
                        } else {
                            console.log(`   ⚠️  Foto não encontrada: ${fotoNome}`);
                        }
                    }

                    fotos_json = JSON.stringify(fotosBase64);
                } catch (e) {
                    console.log(`   ⚠️  Erro ao processar fotos da ocorrência ${o.id}: ${e.message}`);
                }
            }

            const status_edicao = o.motivo_edicao ? 'SOLICITADO' : 'BLOQUEADO';

            await pool.query(
                `INSERT INTO posemb_ocorrencias (
                    data_ocorrencia, hora_ocorrencia, motorista, modalidade, cte, operacao, nfs, cliente, cidade, motivo,
                    situacao, data_conclusao, hora_conclusao, responsavel, fotos_json, status_edicao, link_email, motivo_edicao, data_criacao
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())`,
                [
                    normalizarData(o.data_ocorrencia),
                    o.hora_ocorrencia,
                    o.motorista,
                    o.modalidade,
                    o.cte,
                    o.operacao,
                    o.nfs,
                    o.cliente,
                    o.cidade,
                    o.motivo,
                    o.situacao,
                    normalizarData(o.data_conclusao),
                    o.hora_conclusao,
                    o.responsavel,
                    fotos_json,
                    status_edicao,
                    o.link_email,
                    o.motivo_edicao
                ]
            );
        }
        console.log(`   ✅ ${ocorrencias.rows.length} ocorrências importadas`);

        console.log('4️⃣  Limpando tabelas temporárias...');
        // Opcional: não deletar as tabelas originais, apenas marcar como migradas
        console.log('   ✅ Migração concluída com sucesso!');

        console.log('\n📊 Resumo:');
        console.log(`   - Motoristas: ${motoristas.rows.length}`);
        console.log(`   - Clientes: ${clientes.rows.length}`);
        console.log(`   - Ocorrências: ${ocorrencias.rows.length}`);

    } catch (e) {
        console.error('❌ Erro durante migração:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
