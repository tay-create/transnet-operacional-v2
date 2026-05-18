const bcrypt = require('bcryptjs');
const { dbRun, dbGet, db: pool } = require('./db');

// Configurações Padrão de Permissões
const PERMISSOES_PADRAO = JSON.stringify({
    'Direção':          ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro', 'checklist_carreta', 'historico_liberacoes', 'provisionamento', 'marcacao_placas', 'painel_frota', 'roteirizacao_frota', 'tramontina_planejamento', 'lead_time_operacional'],
    'Coordenador':      ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro', 'checklist_carreta', 'historico_liberacoes', 'provisionamento', 'marcacao_placas', 'painel_frota', 'roteirizacao_frota', 'tramontina_planejamento', 'lead_time_operacional'],
    'Desenvolvedor':    ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro', 'checklist_carreta', 'historico_liberacoes', 'provisionamento', 'marcacao_placas', 'painel_frota', 'roteirizacao_frota', 'tramontina_planejamento', 'lead_time_operacional'],
    'Adm Frota':        ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro', 'checklist_carreta', 'historico_liberacoes', 'provisionamento', 'marcacao_placas', 'painel_frota', 'roteirizacao_frota', 'tramontina_planejamento', 'lead_time_operacional'],
    'Planejamento':     ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro', 'checklist_carreta', 'historico_liberacoes', 'marcacao_placas', 'provisionamento', 'painel_frota', 'roteirizacao_frota', 'tramontina_planejamento', 'lead_time_operacional'],
    'Encarregado':      ['operacao', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro', 'saldo_paletes', 'painel_frota'],
    'Aux. Operacional': ['operacao', 'cte', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro', 'fila', 'painel_frota'],
    'Conhecimento':     ['operacao', 'cte', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro', 'marcacao_placas', 'painel_frota'],
    'Cadastro':         ['operacao', 'cte', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro', 'marcacao_placas', 'painel_frota'],
    'Dashboard Viewer': ['dashboard_tv'],
    'Conferente':       ['dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Pos Embarque':     ['dashboard_tv', 'marcacao_placas', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Manutenção':       ['provisionamento', 'dashboard_tv', 'painel_frota']
});

const PERMISSOES_EDICAO_PADRAO = JSON.stringify({
    'Direção':          ['lancamento', 'operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila'],
    'Coordenador':      ['lancamento', 'operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila', 'tramontina_editar'],
    'Desenvolvedor':    ['lancamento', 'operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila', 'tramontina_editar'],
    'Adm Frota':        ['lancamento', 'operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila'],
    'Planejamento':     ['lancamento', 'operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila', 'tramontina_editar'],
    'Encarregado':      ['operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo'],
    'Aux. Operacional': ['operacao', 'editar_operacao_card', 'alterar_status_operacao', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'fila'],
    'Conhecimento':     ['cte'],
    'Cadastro':         [],
    'Conferente':       [],
    'Pos Embarque':     ['marcacao_placas'],
    'Manutenção':       []
});

const inicializarBanco = async () => {
    try {
        // PostgreSQL initialization doesn't require WAL mode setup here


        await dbRun(`CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome TEXT, email TEXT, senha TEXT, cidade TEXT, cargo TEXT, avatarUrl TEXT, usaPermissaoIndividual INTEGER DEFAULT 0, permissoesAcesso TEXT, permissoesEdicao TEXT)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS solicitacoes (id SERIAL PRIMARY KEY, tipo TEXT, nome TEXT, email TEXT, unidade TEXT, senha TEXT, data_criacao TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico (id SERIAL PRIMARY KEY, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico_cte (id SERIAL PRIMARY KEY, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS veiculos (
            id SERIAL PRIMARY KEY, dados_json TEXT,
            placa TEXT, modelo TEXT, motorista TEXT,
            status_recife TEXT, status_moreno TEXT,
            doca_recife TEXT, doca_moreno TEXT,
            coleta TEXT, coletaRecife TEXT, coletaMoreno TEXT,
            rota_recife TEXT, rota_moreno TEXT,
            unidade TEXT, operacao TEXT, inicio_rota TEXT, origem_criacao TEXT,
            data_prevista TEXT, data_criacao TEXT,
            tempos_recife TEXT, tempos_moreno TEXT, status_coleta TEXT,
            observacao TEXT, imagens TEXT
         )`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_status ON veiculos (status_recife, status_moreno)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_data ON veiculos (data_criacao)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS notificacoes (id SERIAL PRIMARY KEY, dados_json TEXT, data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS notificacoes_lidas (id SERIAL PRIMARY KEY, notificacao_id INTEGER NOT NULL, user_id INTEGER NOT NULL, data_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        try { await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_lidas_unique ON notificacoes_lidas (notificacao_id, user_id)`); } catch (_) { }
        await dbRun(`CREATE TABLE IF NOT EXISTS fila (id SERIAL PRIMARY KEY, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS checklists_carreta (
            id SERIAL PRIMARY KEY,
            veiculo_id INTEGER,
            motorista_nome TEXT,
            placa_carreta TEXT,
            placa_confere INTEGER,
            condicao_bau TEXT,
            cordas INTEGER,
            foto_vazamento TEXT,
            assinatura TEXT,
            conferente_nome TEXT,
            status TEXT DEFAULT 'PENDENTE',
            created_at TEXT,
            is_paletizado TEXT,
            tipo_palete TEXT,
            qtd_paletes INTEGER
        )`);
        // Migrações seguras para colunas novas
        try { await dbRun(`ALTER TABLE fila ADD COLUMN IF NOT EXISTS unidade TEXT`); } catch (_) { }
        try { await dbRun(`ALTER TABLE fila ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch (_) { }
        try { await dbRun(`ALTER TABLE checklists_carreta ADD COLUMN IF NOT EXISTS is_paletizado TEXT`); } catch (_) { }
        try { await dbRun(`ALTER TABLE checklists_carreta ADD COLUMN IF NOT EXISTS tipo_palete TEXT`); } catch (_) { }
        try { await dbRun(`ALTER TABLE checklists_carreta ADD COLUMN IF NOT EXISTS qtd_paletes INTEGER`); } catch (_) { }
        try { await dbRun(`ALTER TABLE checklists_carreta ADD COLUMN IF NOT EXISTS fornecedor_pbr TEXT`); } catch (_) { }
        try { await dbRun(`ALTER TABLE checklists_carreta ADD COLUMN IF NOT EXISTS cordas_adicionais INTEGER DEFAULT 0`); } catch (_) { }

        await dbRun(`CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            acao TEXT NOT NULL,
            usuario TEXT NOT NULL,
            alvo_id INTEGER,
            alvo_tipo TEXT,
            valor_antigo TEXT,
            valor_novo TEXT,
            detalhes TEXT,
            data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagens (
            id SERIAL PRIMARY KEY,
            numero_coleta TEXT,
            motorista TEXT,
            cliente TEXT,
            redespacho INTEGER DEFAULT 0,
            nome_redespacho TEXT,
            destino TEXT,
            volume TEXT,
            data TEXT,
            faturado INTEGER DEFAULT 0,
            tipo TEXT,
            metragem_total REAL DEFAULT 0,
            valor_mix_total REAL DEFAULT 0,
            valor_kit_total REAL DEFAULT 0,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_programacao_diaria (
            id SERIAL PRIMARY KEY,
            data_referencia TEXT NOT NULL,
            turno TEXT NOT NULL,
            dados_json TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Adicionar colunas faltantes em tabelas existentes (ALTER TABLE é seguro - ignora se já existe)
        const colunasParaAdicionar = [
            { tabela: 'cubagens', coluna: 'metragem_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'valor_mix_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'valor_kit_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'nome_redespacho', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'observacao', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'imagens', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_cte', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'chave_cte', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_coleta', tipo: 'TEXT' },
            // Módulo de Checklist / Liberação
            { tabela: 'veiculos', coluna: 'chk_cnh', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_antt', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_tacografo', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'chk_crlv', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'gerenciadora_risco', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'status_gerenciadora', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'numero_liberacao', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'situacao_cadastro', tipo: "TEXT DEFAULT 'NÃO CONFERIDO'" },
            { tabela: 'veiculos', coluna: 'data_liberacao', tipo: 'TEXT' },
            // Módulo Cadastro / Gerenciamento de Risco (pré-liberação em marcacoes_placas)
            { tabela: 'marcacoes_placas', coluna: 'chk_cnh_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_antt_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_tacografo_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'chk_crlv_cad', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'marcacoes_placas', coluna: 'seguradora_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'num_liberacao_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'data_liberacao_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'situacao_cad', tipo: "TEXT DEFAULT 'PENDENTE'" },
            { tabela: 'marcacoes_placas', coluna: 'comprovante_pdf', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_cnh', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_doc_veiculo', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_crlv_carreta', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_antt', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'anexo_outros', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'origem_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'destino_uf_cad', tipo: 'TEXT' },
            { tabela: 'marcacoes_placas', coluna: 'destino_cidade_cad', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'status_cte', tipo: "TEXT DEFAULT 'Aguardando Emissão'" },
            { tabela: 'veiculos', coluna: 'timestamps_cte', tipo: 'TEXT' },
            // Módulo de Otimização Phase 4 (Substituição do dados_json)
            { tabela: 'veiculos', coluna: 'tipoVeiculo', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'telefoneMotorista', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'isFrotaMotorista', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'veiculos', coluna: 'placa1Motorista', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'placa2Motorista', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'timestamps_status', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'pausas_status', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'data_inicio_patio', tipo: 'TEXT' },
            // Recuperação de senha via WhatsApp
            { tabela: 'usuarios', coluna: 'telefone', tipo: 'TEXT' },
            // Gerenciamento de Risco — campos salvos direto no veículo (evita dependência de marcacoes_placas)
            { tabela: 'veiculos', coluna: 'seguradora_cad', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'origem_cad', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'destino_uf_cad', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'destino_cidade_cad', tipo: 'TEXT' },
            // Normalização ctes_ativos — campos críticos em colunas dedicadas
            { tabela: 'ctes_ativos', coluna: 'motorista', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'placa1', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'coleta', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'numero_liberacao', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'data_liberacao', tipo: 'TIMESTAMP' },
            { tabela: 'ctes_ativos', coluna: 'origem_cad', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'destino_uf_cad', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'destino_cidade_cad', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'usuario_aceitou', tipo: 'TEXT' },
            { tabela: 'ctes_ativos', coluna: 'data_emissao', tipo: 'TIMESTAMP' },
            // CT-e liberado antecipadamente (ainda em EM CARREGAMENTO)
            { tabela: 'veiculos', coluna: 'cte_antecipado_recife', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'cte_antecipado_moreno', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'cte_antecipado_interestadual', tipo: 'TEXT' },
            // Programação Diária v3 — data original para classificar Programado vs Reprogramado
            { tabela: 'veiculos', coluna: 'data_prevista_original', tipo: 'TEXT' },
            // Programação Diária v3.1 — flag explícita de reprogramação (botão ou calendário)
            { tabela: 'veiculos', coluna: 'foi_reprogramado', tipo: 'INTEGER DEFAULT 0' },
            // Auto-atendimento do motorista interestadual (Leão SP / Eletrik Sul)
            // Token público que o motorista usa pra avançar status pela rota /operacao/:token
            { tabela: 'veiculos', coluna: 'token_operacao_motorista', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'token_operacao_expira_em', tipo: 'TIMESTAMP' },
            // Âncoras de data por unidade — garante que card CARREGADO fique no dia certo mesmo após Finalizar
            { tabela: 'veiculos', coluna: 'data_carregado_recife', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'data_carregado_moreno', tipo: 'TEXT' },
            // Split de data_prevista por unidade (cards consolidados podem ter ciclos em dias diferentes)
            { tabela: 'veiculos', coluna: 'data_prevista_recife', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'data_prevista_moreno', tipo: 'TEXT' },
            // Provisionamento de Frota — motorista e destinos na programação semanal
            { tabela: 'prov_programacao', coluna: 'motorista', tipo: 'TEXT' },
            { tabela: 'prov_programacao', coluna: 'destinos_json', tipo: 'TEXT' },
            // Foto do motorista na marcação de placas (frota própria)
            { tabela: 'marcacoes_placas', coluna: 'foto', tipo: 'TEXT' },
            // Cubagem v2 — valor total das NFs e peso total
            { tabela: 'cubagens', coluna: 'valor_total', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagens', coluna: 'peso_total', tipo: 'REAL DEFAULT 0' },
            // Cubagem v2 — dados por NF para agregação por região no relatório
            { tabela: 'cubagem_itens', coluna: 'uf', tipo: 'TEXT DEFAULT \'\'' },
            { tabela: 'cubagem_itens', coluna: 'regiao', tipo: 'TEXT DEFAULT \'\'' },
            { tabela: 'cubagem_itens', coluna: 'valor', tipo: 'REAL DEFAULT 0' },
            { tabela: 'cubagem_itens', coluna: 'volumes', tipo: 'INTEGER DEFAULT 0' },
            { tabela: 'cubagem_itens', coluna: 'peso_kg', tipo: 'REAL DEFAULT 0' },
            // Cubagem v3 — múltiplos redespachos por cubagem (por NF)
            { tabela: 'cubagem_itens', coluna: 'redespacho_nome', tipo: 'TEXT' },
            { tabela: 'cubagem_itens', coluna: 'redespacho_uf', tipo: 'TEXT' },
            // Observação por veículo/dia no provisionamento
            { tabela: 'prov_programacao', coluna: 'observacao', tipo: 'TEXT DEFAULT \'\'' },
            // Timestamp ISO completo de resolução de ocorrência pós-embarque
            { tabela: 'posemb_ocorrencias', coluna: 'resolved_at', tipo: 'TEXT' },
            // Foto do lacre do baú (base64) registrada pelo conferente ao marcar CARREGADO
            { tabela: 'veiculos', coluna: 'foto_lacre_recife', tipo: 'TEXT' },
            { tabela: 'veiculos', coluna: 'foto_lacre_moreno', tipo: 'TEXT' },
        ];

        // Backfill: cards antigos têm só data_prevista. Preencher apenas o lado que o card usa.
        // Idempotente.
        await dbRun(`UPDATE veiculos
                        SET data_prevista_recife = data_prevista
                      WHERE data_prevista_recife IS NULL
                        AND data_prevista IS NOT NULL AND data_prevista <> ''
                        AND coletarecife IS NOT NULL AND coletarecife <> ''`);
        await dbRun(`UPDATE veiculos
                        SET data_prevista_moreno = data_prevista
                      WHERE data_prevista_moreno IS NULL
                        AND data_prevista IS NOT NULL AND data_prevista <> ''
                        AND coletamoreno IS NOT NULL AND coletamoreno <> ''`);
        // Fix: limpar lado incorreto gerado por backfill anterior (cards single-unit)
        await dbRun(`UPDATE veiculos
                        SET data_prevista_recife = NULL
                      WHERE (coletarecife IS NULL OR coletarecife = '')
                        AND (coletamoreno IS NOT NULL AND coletamoreno <> '')
                        AND data_prevista_recife IS NOT NULL
                        AND data_prevista_recife = data_prevista_moreno`);
        await dbRun(`UPDATE veiculos
                        SET data_prevista_moreno = NULL
                      WHERE (coletamoreno IS NULL OR coletamoreno = '')
                        AND (coletarecife IS NOT NULL AND coletarecife <> '')
                        AND data_prevista_moreno IS NOT NULL
                        AND data_prevista_moreno = data_prevista_recife`);
        // Recalcular guarda-chuva após correção
        await dbRun(`UPDATE veiculos
                        SET data_prevista = COALESCE(
                            LEAST(NULLIF(data_prevista_recife,''), NULLIF(data_prevista_moreno,'')),
                            NULLIF(data_prevista_recife,''),
                            NULLIF(data_prevista_moreno,''),
                            data_prevista)
                      WHERE data_prevista_recife IS NULL OR data_prevista_moreno IS NULL`);
        // Sincronizar dados_json com a coluna data_prevista (o JSON pode ter ficado desatualizado)
        await dbRun(`UPDATE veiculos
                        SET dados_json = regexp_replace(
                            dados_json,
                            '"data_prevista":\\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"',
                            '"data_prevista": "' || data_prevista || '"'
                        )
                      WHERE dados_json IS NOT NULL AND dados_json <> ''
                        AND dados_json LIKE '%"data_prevista"%'
                        AND dados_json NOT LIKE '%"data_prevista":"' || data_prevista || '"%'
                        AND dados_json NOT LIKE '%"data_prevista": "' || data_prevista || '"%'`);

        // Criação de Índices Otimizados
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_status_recife ON veiculos (status_recife)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_status_moreno ON veiculos (status_moreno)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_motorista ON veiculos (motorista)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_coleta ON veiculos (coleta)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_dp_recife ON veiculos (data_prevista_recife)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_dp_moreno ON veiculos (data_prevista_moreno)`);

        // Tabela de CT-es Ativos (persistencia entre reloads)
        await dbRun(`CREATE TABLE IF NOT EXISTS ctes_ativos (
            id SERIAL PRIMARY KEY,
            origem TEXT NOT NULL,
            status TEXT DEFAULT 'Aguardando Emissão',
            dados_json TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Trava de duplicata de CT-e removida — não impomos unicidade no nível do banco.
        // Se existir um índice antigo de versões anteriores, dropa para alinhar com prod.
        await dbRun(`DROP INDEX IF EXISTS idx_ctes_ativos_unique_ativo`);

        await dbRun(`CREATE TABLE IF NOT EXISTS docas_interditadas(
                id SERIAL PRIMARY KEY,
                unidade TEXT,
                doca TEXT,
                nome TEXT,
                data_referencia DATE
            )`);
        // Adiciona coluna data_referencia se não existir (migração incremental)
        await dbRun(`ALTER TABLE docas_interditadas ADD COLUMN IF NOT EXISTS data_referencia DATE`);

        // Marcação de Placas
        await dbRun(`CREATE TABLE IF NOT EXISTS tokens_motoristas(
                id SERIAL PRIMARY KEY,
                telefone TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'ativo',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_expiracao TIMESTAMP
            )`);
        // Migração: adiciona coluna em banco existente sem ela
        try { await dbRun(`ALTER TABLE tokens_motoristas ADD COLUMN IF NOT EXISTS data_expiracao TIMESTAMP`); } catch (_) { }
        await dbRun(`CREATE TABLE IF NOT EXISTS marcacoes_placas(
                id SERIAL PRIMARY KEY,
                token_id INTEGER,
                nome_motorista TEXT NOT NULL,
                telefone TEXT NOT NULL,
                placa1 TEXT NOT NULL,
                placa2 TEXT,
                tipo_veiculo TEXT NOT NULL,
                altura REAL,
                largura REAL,
                comprimento REAL,
                estados_destino TEXT,
                estado_origem TEXT,
                ja_carregou TEXT,
                rastreador TEXT,
                status_rastreador TEXT,
                latitude TEXT,
                longitude TEXT,
                origem_cidade_uf TEXT,
                destino_desejado TEXT,
                disponibilidade TEXT,
                data_marcacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(token_id) REFERENCES tokens_motoristas(id)
            )`);
        for (const [tabela, coluna, tipo] of [
            ['marcacoes_placas', 'origem_cidade_uf', 'TEXT'],
            ['marcacoes_placas', 'destino_desejado', 'TEXT'],
            ['marcacoes_placas', 'disponibilidade', 'TEXT'],
            ['marcacoes_placas', 'viagens_realizadas', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'status_operacional', "TEXT DEFAULT 'DISPONIVEL'"],
            ['marcacoes_placas', 'is_frota', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'data_contratacao', 'TIMESTAMP'],
            ['marcacoes_placas', 'chk_cnh_cad', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'chk_antt_cad', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'chk_tacografo_cad', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'chk_crlv_cad', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'situacao_cad', "TEXT DEFAULT 'Pendente'"],
            ['marcacoes_placas', 'num_liberacao_cad', 'TEXT'],
            ['marcacoes_placas', 'data_liberacao_cad', 'TEXT'],
            ['marcacoes_placas', 'destino_uf_cad', 'TEXT'],
            ['marcacoes_placas', 'favorito', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'tag_motorista', 'TEXT'],
        ]) {
            try { await dbRun(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${coluna} ${tipo} `); } catch (e) { console.error(`Erro ao adicionar ${coluna} em ${tabela}`, e); }
        }
        // Garantir UNIQUE no telefone (cria índice único se não existir)
        try {
            await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_marcacoes_telefone ON marcacoes_placas(telefone)`);
        } catch (_) { }

        // Garantir UNIQUE no email de usuarios (migration segura para bancos existentes)
        try {
            await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
        } catch (_) { }

        // Tabela para Ocorrências das Operações 
        await dbRun(`CREATE TABLE IF NOT EXISTS operacao_ocorrencias(
                id SERIAL PRIMARY KEY,
                veiculo_id INTEGER NOT NULL,
                motorista TEXT NOT NULL,
                descricao TEXT NOT NULL,
                foto_base64 TEXT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(veiculo_id) REFERENCES veiculos(id) ON DELETE CASCADE
            )`);

        // Tabela separada para itens de cubagem (relação N:1)
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagem_itens(
                id SERIAL PRIMARY KEY,
                cubagem_id INTEGER NOT NULL,
                numero_nf TEXT,
                metragem REAL DEFAULT 0,
                valor_mix REAL DEFAULT 0,
                valor_kit REAL DEFAULT 0,
                FOREIGN KEY(cubagem_id) REFERENCES cubagens(id) ON DELETE CASCADE
            )`);

        // ── Histórico de Liberações (GR) ───────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS historico_liberacoes (
            id SERIAL PRIMARY KEY,
            primeira_letra TEXT NOT NULL,
            motorista_nome TEXT NOT NULL,
            num_coleta TEXT,
            num_liberacao TEXT,
            datetime_cte TEXT NOT NULL,
            origem TEXT,
            destino_uf TEXT,
            destino_cidade TEXT,
            placa TEXT,
            operacao TEXT,
            veiculo_id INTEGER,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_histlib_motorista ON historico_liberacoes (primeira_letra, motorista_nome)`); } catch (_) { }
        try { await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_historico_lib_unique ON historico_liberacoes (motorista_nome, num_liberacao, num_coleta)`); } catch (_) { }

        await dbRun(`CREATE TABLE IF NOT EXISTS historico_frota (
            id SERIAL PRIMARY KEY,
            primeira_letra TEXT NOT NULL,
            motorista_nome TEXT NOT NULL,
            placa TEXT,
            origem TEXT,
            destino TEXT,
            operacao TEXT,
            veiculo_id INTEGER,
            data_viagem TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_histfrota_motorista ON historico_frota (primeira_letra, motorista_nome)`); } catch (_) { }

        // Indexes para colunas frequentemente consultadas
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_marcacoes_data ON marcacoes_placas (data_marcacao DESC)`); } catch (_) { }
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_cubagens_coleta ON cubagens (numero_coleta)`); } catch (_) { }
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens_motoristas (status)`); } catch (_) { }
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_marcacoes_nome ON marcacoes_placas (nome_motorista, data_marcacao DESC)`); } catch (_) { }
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_marcacoes_status_op ON marcacoes_placas (status_operacional)`); } catch (_) { }
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_marcacoes_is_frota ON marcacoes_placas (is_frota)`); } catch (_) { }

        // ── Módulo de Frota e Telemetria ────────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_checklists(
                id SERIAL PRIMARY KEY,
                motorista_id INTEGER,
                motorista_nome TEXT,
                placa_carreta TEXT,
                placa_confere INTEGER NOT NULL DEFAULT 0,
                condicao_bau TEXT,
                cordas INTEGER NOT NULL DEFAULT 0,
                foto_vazamento TEXT,
                assinatura TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        // ── Módulo de Saldo de Paletes ──────────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS saldo_paletes(
                id SERIAL PRIMARY KEY,
                motorista TEXT NOT NULL,
                telefone TEXT,
                placa_cavalo TEXT,
                placa_carreta TEXT,
                tipo_palete TEXT NOT NULL,
                qtd_pbr INTEGER DEFAULT 0,
                qtd_descartavel INTEGER DEFAULT 0,
                fornecedor_pbr TEXT,
                devolvido BOOLEAN DEFAULT FALSE,
                qtd_devolvida_pbr INTEGER DEFAULT 0,
                qtd_devolvida_desc INTEGER DEFAULT 0,
                data_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_devolucao TIMESTAMP,
                observacao TEXT,
                unidade TEXT
            )`);

        // Tabela de tokens para recuperação de senha via WhatsApp (legado — mantida para compatibilidade)
        await dbRun(`CREATE TABLE IF NOT EXISTS reset_tokens (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expira_em TIMESTAMP NOT NULL,
            usado INTEGER DEFAULT 0
        )`);

        // ── Sessões server-side (controle de sessão única + force-logout) ─────────
        await dbRun(`CREATE TABLE IF NOT EXISTS sessoes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            ip TEXT,
            user_agent TEXT,
            criada_em TIMESTAMP DEFAULT NOW(),
            ultima_atividade TIMESTAMP DEFAULT NOW(),
            ativa BOOLEAN DEFAULT TRUE
        )`);
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id) WHERE ativa = TRUE`); } catch (_) {}
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_sessoes_hash ON sessoes(token_hash) WHERE ativa = TRUE`); } catch (_) {}

        // ── E-mail pessoal para recuperação automática de senha ───────────────────
        try { await dbRun(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_pessoal TEXT`); } catch (_) {}
        try { await dbRun(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_pessoal_verificado INTEGER DEFAULT 0`); } catch (_) {}

        // ── Manter conectado: expiração da sessão ──────────────────────────────
        try { await dbRun(`ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`); } catch (_) {}

        await dbRun(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            tipo TEXT NOT NULL,
            expira_em TIMESTAMP NOT NULL,
            usado INTEGER DEFAULT 0
        )`);

        // ── Provisionamento de Frota ───────────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS prov_veiculos (
            id SERIAL PRIMARY KEY,
            placa TEXT,
            carreta TEXT,
            tipo_veiculo TEXT NOT NULL,
            modelo TEXT,
            motorista TEXT,
            ativo INTEGER DEFAULT 1,
            ordem INTEGER DEFAULT 0,
            data_criacao TIMESTAMP DEFAULT NOW()
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS prov_programacao (
            id SERIAL PRIMARY KEY,
            veiculo_id INTEGER NOT NULL REFERENCES prov_veiculos(id) ON DELETE CASCADE,
            data DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPONIVEL',
            destino TEXT,
            UNIQUE(veiculo_id, data)
        )`);
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_prov_prog_data ON prov_programacao(data)`); } catch (_) {}
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_prov_veiculos_ativo ON prov_veiculos(ativo, ordem)`); } catch (_) {}
        // Relaxa placa NOT NULL — carreta pura pode ser cadastrada só com campo "carreta" preenchido
        try { await dbRun(`ALTER TABLE prov_veiculos ALTER COLUMN placa DROP NOT NULL`); } catch (_) {}
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_obs_diarias (
            id SERIAL PRIMARY KEY,
            data_referencia DATE NOT NULL UNIQUE,
            observacao TEXT DEFAULT '',
            atualizada_em TIMESTAMP DEFAULT NOW()
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS usabilidade_alertas_log (
            id SERIAL PRIMARY KEY,
            disparado_em TIMESTAMP NOT NULL DEFAULT NOW(),
            taxa NUMERIC(5,2) NOT NULL,
            periodo_inicio DATE NOT NULL,
            periodo_fim DATE NOT NULL,
            resolvido_em TIMESTAMP NULL
        )`);
        try { await dbRun(`CREATE INDEX IF NOT EXISTS idx_usab_alertas_disparado ON usabilidade_alertas_log(disparado_em)`); } catch (_) {}

        // Adicionar colunas faltantes em tabelas existentes (executado após todas as tabelas criadas)
        for (const { tabela, coluna, tipo } of colunasParaAdicionar) {
            try {
                await dbRun(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${coluna} ${tipo} `);
            } catch (e) {
                // Coluna já existe - ignorar silenciosamente no log do pg
            }
        }

        // Remover contas de teste legadas caso ainda existam
        await dbRun(`DELETE FROM usuarios WHERE email IN ('teste@tnetlog.com.br', 'testeconferencia@tnetlog.com.br')`);

        // ── Tabelas para Área Pós-Embarque ───────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS posemb_ocorrencias (
            id SERIAL PRIMARY KEY,
            data_ocorrencia TEXT,
            hora_ocorrencia TEXT,
            motorista TEXT,
            modalidade TEXT,
            cte TEXT,
            operacao TEXT,
            nfs TEXT,
            cliente TEXT,
            cidade TEXT,
            motivo TEXT,
            situacao TEXT DEFAULT 'Em Andamento',
            data_conclusao TEXT,
            hora_conclusao TEXT,
            responsavel TEXT,
            arquivado INTEGER DEFAULT 0,
            fotos_json TEXT DEFAULT '[]',
            status_edicao TEXT DEFAULT 'BLOQUEADO',
            link_email TEXT,
            motivo_edicao TEXT,
            data_criacao TEXT
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS posemb_motoristas (
            nome TEXT PRIMARY KEY
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS posemb_clientes (
            nome TEXT PRIMARY KEY
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS posemb_motivos (
            nome TEXT PRIMARY KEY
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS chamados (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'ajuste',
            status TEXT NOT NULL DEFAULT 'Analisando',
            autor_nome TEXT NOT NULL,
            autor_cargo TEXT NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS chamados_imagens (
            id SERIAL PRIMARY KEY,
            chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
            imagem TEXT NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS chamados_historico (
            id SERIAL PRIMARY KEY,
            chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
            status_anterior TEXT,
            status_novo TEXT NOT NULL,
            autor_nome TEXT NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS frota_roteirizacoes (
            id SERIAL PRIMARY KEY,
            nome_cliente TEXT,
            coleta_recife TEXT DEFAULT '',
            coleta_moreno TEXT DEFAULT '',
            operacao TEXT NOT NULL DEFAULT '',
            motorista_nome TEXT NOT NULL DEFAULT '',
            motorista_id INTEGER,
            placa_cavalo TEXT DEFAULT '',
            placa_carreta TEXT DEFAULT '',
            origem TEXT DEFAULT '',
            quantidade_entregas INTEGER DEFAULT 1,
            destinos_json TEXT DEFAULT '[]',
            data_saida TIMESTAMPTZ,
            data_retorno_prevista DATE,
            status TEXT DEFAULT 'PREPARANDO',
            observacao_manutencao TEXT,
            criado_por INTEGER,
            criado_em TIMESTAMPTZ DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ DEFAULT NOW()
        )`);

        try { await dbRun(`ALTER TABLE frota_roteirizacoes ADD COLUMN IF NOT EXISTS data_entrada_operacao TIMESTAMPTZ`); } catch (_) {}
        try { await dbRun(`ALTER TABLE frota_roteirizacoes ALTER COLUMN status SET DEFAULT 'EM_OPERACAO'`); } catch (_) {}

        // ── Coleta para operações interestaduais (Leão - SP / Eletrik Sul) ─────
        try { await dbRun(`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS coletainterestadual TEXT DEFAULT ''`); } catch (_) {}

        // ── Tabelas para Planejamento Tramontina ────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS tramontina_rotas (
            id SERIAL PRIMARY KEY,
            mes_referencia TEXT NOT NULL,
            numero_rota INTEGER NOT NULL,
            coleta TEXT,
            data_criacao TIMESTAMPTZ DEFAULT NOW(),
            data_prevista DATE,
            data_embarque DATE,
            operacao_codigo TEXT,
            tipo_veiculo TEXT,
            motorista_nome TEXT,
            placa_cavalo TEXT,
            placa_carreta TEXT,
            redespacho TEXT,
            status_embarque TEXT DEFAULT 'PROGRAMADA',
            veiculo_id INTEGER,
            observacao TEXT,
            criado_por TEXT,
            atualizado_em TIMESTAMPTZ DEFAULT NOW()
        )`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_tramontina_rotas_mes ON tramontina_rotas (mes_referencia)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS tramontina_rota_entregas (
            id SERIAL PRIMARY KEY,
            rota_id INTEGER NOT NULL REFERENCES tramontina_rotas(id) ON DELETE CASCADE,
            cidade TEXT,
            uf TEXT,
            regiao TEXT,
            cliente TEXT,
            notas_fiscais TEXT,
            status_agendamento TEXT,
            data_entrega_cliente DATE,
            dias_uteis INTEGER,
            lead_status TEXT
        )`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_tramontina_entregas_rota ON tramontina_rota_entregas (rota_id)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS tramontina_lead_padrao_uf (
            uf_origem TEXT NOT NULL,
            uf_destino TEXT NOT NULL,
            dias_uteis_padrao INTEGER NOT NULL,
            PRIMARY KEY (uf_origem, uf_destino)
        )`);

        // Seed lead padrão Transnet (origem PE → destinos)
        // Usa pool.query direto porque dbRun auto-injeta "RETURNING id" e a tabela tem PK composta sem coluna id
        const SEED_LEAD_PE = [
            ['PE','PE',1],['PE','AC',9],['PE','AL',1],['PE','BA',2],['PE','CE',2],
            ['PE','DF',5],['PE','ES',4],['PE','GO',6],['PE','MA',3],['PE','MT',7],
            ['PE','MS',7],['PE','MG',4],['PE','PA',4],['PE','PB',1],['PE','PR',6],
            ['PE','RJ',5],['PE','RN',1],['PE','RO',8],['PE','RS',7],['PE','SC',6],
            ['PE','SE',2],['PE','TO',4],['PE','PI',3],['PE','SP',5]
        ];
        for (const [orig, dest, dias] of SEED_LEAD_PE) {
            try {
                await pool.query(
                    `INSERT INTO tramontina_lead_padrao_uf (uf_origem, uf_destino, dias_uteis_padrao)
                     VALUES ($1, $2, $3) ON CONFLICT (uf_origem, uf_destino) DO NOTHING`,
                    [orig, dest, dias]
                );
            } catch (_) {}
        }

        // Tabela e seed do lead padrão Tramontina por região
        // Códigos coerentes com REGIOES_BR em src/utils/tramontinaLeadTime.js (N, NE, CO, SE, S)
        await dbRun(`CREATE TABLE IF NOT EXISTS tramontina_lead_padrao_regiao (
            regiao TEXT PRIMARY KEY,
            dias_uteis_padrao INTEGER NOT NULL
        )`);
        const SEED_LEAD_REGIAO = [
            ['N', 8],   // NORTE
            ['CO', 11], // CENTRO-OESTE
            ['NE', 8],  // NORDESTE
            ['S', 12],  // SUL
            ['SE', 10], // SUDESTE
        ];
        for (const [regiao, dias] of SEED_LEAD_REGIAO) {
            try {
                await pool.query(
                    `INSERT INTO tramontina_lead_padrao_regiao (regiao, dias_uteis_padrao)
                     VALUES ($1, $2) ON CONFLICT (regiao) DO NOTHING`,
                    [regiao, dias]
                );
            } catch (_) {}
        }

        // Gerador de Rotas (OSM público): cache de geocode + cache de distâncias
        await dbRun(`CREATE TABLE IF NOT EXISTS geo_cache (
            cidade_uf TEXT PRIMARY KEY,
            lat DOUBLE PRECISION NOT NULL,
            lon DOUBLE PRECISION NOT NULL,
            display_name TEXT,
            criado_em TIMESTAMP DEFAULT NOW()
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS dist_cache (
            origem_key TEXT NOT NULL,
            destino_key TEXT NOT NULL,
            distancia_metros INTEGER NOT NULL,
            duracao_segundos INTEGER NOT NULL,
            criado_em TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (origem_key, destino_key)
        )`);

        // Cache de geometria de rota por estrada (OSRM /route)
        await dbRun(`CREATE TABLE IF NOT EXISTS route_cache (
            origem_key TEXT NOT NULL,
            destino_key TEXT NOT NULL,
            geometry_json TEXT NOT NULL,
            distancia_metros INTEGER NOT NULL,
            duracao_segundos INTEGER NOT NULL,
            criado_em TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (origem_key, destino_key)
        )`);

        // Seed dos pontos fixos da Transnet (CDs) — evita geocoding.
        // Coordenadas dos endereços reais dos CDs (não do centro da cidade).
        // Recife: Av. Barão de Bonito, 1110 - Várzea.
        // Moreno: Av. Industrial - Distrito Industrial.
        const SEED_GEO = [
            ['RECIFE/PE', -8.0434124, -34.9542906, 'CD Transnet — Av. Barão de Bonito, 1110, Várzea, Recife/PE'],
            ['MORENO/PE', -8.130545712978426, -35.12564333469332, 'CD Transnet — Av. Industrial, Distrito Industrial, Moreno/PE'],
            ['CARLOS BARBOSA/RS', -29.28426360237548, -51.4879727918691, 'CD Transnet — Carlos Barbosa/RS (operação ELETRIK SUL)'],
        ];
        for (const [chave, lat, lon, nome] of SEED_GEO) {
            try {
                // UPSERT (sobrescreve coords antigas se já houver — necessário para migrar
                // ambientes que já tinham o seed antigo com coords do centro da cidade).
                await pool.query(
                    `INSERT INTO geo_cache (cidade_uf, lat, lon, display_name)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (cidade_uf) DO UPDATE
                     SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, display_name = EXCLUDED.display_name`,
                    [chave, lat, lon, nome]
                );
            } catch (_) {}
        }

        // Limpa dist_cache de pares envolvendo RECIFE/PE ou MORENO/PE — distâncias antigas
        // foram calculadas a partir das coords do centro da cidade. Próxima geração de rota
        // recalcula automaticamente via OSRM.
        try {
            await pool.query(
                `DELETE FROM dist_cache WHERE origem_key IN ('RECIFE/PE','MORENO/PE') OR destino_key IN ('RECIFE/PE','MORENO/PE')`
            );
        } catch (_) {}

        // Colunas novas em veiculos para guardar destinos ordenados + origem da rota
        await dbRun(`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS destinos_json TEXT`);
        await dbRun(`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS origem_rota TEXT`);

        // FORÇA ATUALIZAÇÃO DAS PERMISSÕES SEMPRE AO INICIAR
        const perm = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_acesso'");
        if (!perm) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_acesso', PERMISSOES_PADRAO]);
            console.log("✅ Permissões de ACESSO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, adiciona cargos novos E módulos novos em cargos existentes
            const permSalvas = JSON.parse(perm.valor);
            const permPadrao = JSON.parse(PERMISSOES_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permPadrao)) {
                if (!permSalvas[cargo]) {
                    permSalvas[cargo] = permPadrao[cargo];
                    atualizado = true;
                } else {
                    const modulosNovos = permPadrao[cargo].filter(m => !permSalvas[cargo].includes(m));
                    if (modulosNovos.length > 0) {
                        permSalvas[cargo] = [...permSalvas[cargo], ...modulosNovos];
                        atualizado = true;
                    }
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_acesso'", [JSON.stringify(permSalvas)]);
                console.log("✅ Permissões de ACESSO: cargos e módulos atualizados.");
            }
        }

        const permEd = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_edicao'");
        if (!permEd) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_edicao', PERMISSOES_EDICAO_PADRAO]);
            console.log("✅ Permissões de EDIÇÃO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, adiciona cargos novos E módulos novos em cargos existentes
            const permEdSalvas = JSON.parse(permEd.valor);
            const permEdPadrao = JSON.parse(PERMISSOES_EDICAO_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permEdPadrao)) {
                if (!permEdSalvas[cargo]) {
                    permEdSalvas[cargo] = permEdPadrao[cargo];
                    atualizado = true;
                } else {
                    const modulosNovos = permEdPadrao[cargo].filter(m => !permEdSalvas[cargo].includes(m));
                    if (modulosNovos.length > 0) {
                        permEdSalvas[cargo] = [...permEdSalvas[cargo], ...modulosNovos];
                        atualizado = true;
                    }
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_edicao'", [JSON.stringify(permEdSalvas)]);
                console.log("✅ Permissões de EDIÇÃO: cargos e módulos atualizados.");
            }
        }

        console.log("✅ Banco pronto com permissões atualizadas!");
    } catch (e) { console.error("Erro inicializar:", e); }
};


module.exports = { inicializarBanco };
