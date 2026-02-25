const bcrypt = require('bcryptjs');
const { dbRun, dbGet } = require('./db');

// Configurações Padrão de Permissões
const PERMISSOES_PADRAO = JSON.stringify({
    'Coordenador': ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota', 'cadastro'],
    'Planejamento': ['operacao', 'cte', 'cubagem', 'relatorios', 'relatorio_op', 'dashboard_tv', 'fila', 'ver_unidade_recife', 'ver_unidade_moreno', 'performance_cte', 'gestao_frota'],
    'Encarregado': ['operacao', 'cte', 'relatorios', 'relatorio_op', 'dashboard_tv', 'ver_unidade_recife', 'ver_unidade_moreno', 'cadastro'],
    'Aux. Operacional': ['operacao', 'cte', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Conhecimento': ['cte', 'operacao', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Cadastro': ['operacao', 'cadastro', 'ver_unidade_recife', 'ver_unidade_moreno'],
    'Dashboard Viewer': ['dashboard_tv']
});

const PERMISSOES_EDICAO_PADRAO = JSON.stringify({
    'Coordenador': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem', 'fila'],
    'Planejamento': ['lancamento', 'operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo', 'cte', 'cubagem'],
    'Encarregado': ['operacao', 'editar_operacao_card', 'coleta_card', 'adiar_dia', 'timer_solicitado', 'timer_liberado', 'gestao_tempo'],
    'Aux. Operacional': ['operacao', 'editar_operacao_card', 'coleta_card', 'timer_solicitado', 'timer_liberado'],
    'Conhecimento': ['cte'],
    'Cadastro': []
});

const inicializarBanco = async () => {
    try {
        await dbRun('PRAGMA journal_mode = WAL;');

        await dbRun(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT, senha TEXT, cidade TEXT, cargo TEXT, avatarUrl TEXT, usaPermissaoIndividual INTEGER DEFAULT 0, permissoesAcesso TEXT, permissoesEdicao TEXT)`);

        await dbRun(`CREATE TABLE IF NOT EXISTS solicitacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, nome TEXT, email TEXT, unidade TEXT, senha TEXT, data_criacao TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS historico_cte (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS veiculos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT,
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

        await dbRun(`CREATE TABLE IF NOT EXISTS notificacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT, data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS fila (id INTEGER PRIMARY KEY AUTOINCREMENT, dados_json TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS checklists_carreta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            created_at TEXT
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            acao TEXT NOT NULL,
            usuario TEXT NOT NULL,
            alvo_id INTEGER,
            alvo_tipo TEXT,
            valor_antigo TEXT,
            valor_novo TEXT,
            detalhes TEXT,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
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
            { tabela: 'veiculos', coluna: 'timestamps_status', tipo: 'TEXT' }
        ];

        // Criação de Índices Otimizados
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_status_recife ON veiculos (status_recife)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_status_moreno ON veiculos (status_moreno)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_motorista ON veiculos (motorista)`);
        await dbRun(`CREATE INDEX IF NOT EXISTS idx_veiculos_coleta ON veiculos (coleta)`);

        // Tabela de CT-es Ativos (persistencia entre reloads)
        await dbRun(`CREATE TABLE IF NOT EXISTS ctes_ativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origem TEXT NOT NULL,
            status TEXT DEFAULT 'Aguardando Emissão',
            dados_json TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS docas_interditadas(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unidade TEXT,
                doca TEXT,
                nome TEXT
            )`);
        for (const { tabela, coluna, tipo } of colunasParaAdicionar) {
            try {
                await dbRun(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo} `);
                console.log(`✅ Coluna ${coluna} adicionada em ${tabela} `);
            } catch (e) {
                // Coluna já existe - ignorar
            }
        }

        // Marcação de Placas
        await dbRun(`CREATE TABLE IF NOT EXISTS tokens_motoristas(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefone TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'ativo',
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_expiracao DATETIME
            )`);
        // Migração: adiciona coluna em banco existente sem ela
        try { await dbRun(`ALTER TABLE tokens_motoristas ADD COLUMN data_expiracao DATETIME`); } catch (_) { }
        await dbRun(`CREATE TABLE IF NOT EXISTS marcacoes_placas(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                data_marcacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(token_id) REFERENCES tokens_motoristas(id)
            )`);
        for (const [tabela, coluna, tipo] of [
            ['marcacoes_placas', 'origem_cidade_uf', 'TEXT'],
            ['marcacoes_placas', 'destino_desejado', 'TEXT'],
            ['marcacoes_placas', 'disponibilidade', 'TEXT'],
            ['marcacoes_placas', 'viagens_realizadas', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'status_operacional', "TEXT DEFAULT 'DISPONIVEL'"],
            ['marcacoes_placas', 'is_frota', 'INTEGER DEFAULT 0'],
            ['marcacoes_placas', 'data_contratacao', 'DATETIME'],
        ]) {
            try { await dbRun(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo} `); } catch (_) { }
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                veiculo_id INTEGER NOT NULL,
                motorista TEXT NOT NULL,
                descricao TEXT NOT NULL,
                foto_base64 TEXT,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(veiculo_id) REFERENCES veiculos(id) ON DELETE CASCADE
            )`);

        // Tabela separada para itens de cubagem (relação N:1)
        await dbRun(`CREATE TABLE IF NOT EXISTS cubagem_itens(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cubagem_id INTEGER NOT NULL,
                numero_nf TEXT,
                metragem REAL DEFAULT 0,
                valor_mix REAL DEFAULT 0,
                valor_kit REAL DEFAULT 0,
                FOREIGN KEY(cubagem_id) REFERENCES cubagens(id) ON DELETE CASCADE
            )`);

        // ── Módulo de Frota e Telemetria ────────────────────────────────────────
        await dbRun(`CREATE TABLE IF NOT EXISTS frota_checklists(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                motorista_id INTEGER,
                motorista_nome TEXT,
                placa_carreta TEXT,
                placa_confere INTEGER NOT NULL DEFAULT 0,
                condicao_bau TEXT,
                cordas INTEGER NOT NULL DEFAULT 0,
                foto_vazamento TEXT,
                assinatura TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        const admin = await dbGet("SELECT * FROM usuarios WHERE email = ?", ['julio@tnetlog.com.br']);
        if (!admin) {
            const hashedPassword = await bcrypt.hash('123', 10);
            await dbRun(`INSERT INTO usuarios(nome, email, senha, cidade, cargo) VALUES(?, ?, ?, ?, ?)`,
                ['Julio', 'julio@tnetlog.com.br', hashedPassword, 'Recife', 'Coordenador']);
            console.log("✅ Usuário admin criado com senha hasheada");
        }

        const testePlanejamento = await dbGet("SELECT * FROM usuarios WHERE email = ?", ['teste@tnetlog.com.br']);
        if (!testePlanejamento) {
            const hashedPassword = await bcrypt.hash('123', 10);
            await dbRun(`INSERT INTO usuarios(nome, email, senha, cidade, cargo) VALUES(?, ?, ?, ?, ?)`,
                ['will.teste', 'teste@tnetlog.com.br', hashedPassword, 'Moreno', 'Planejamento']);
            console.log("✅ Usuário de teste (Planejamento) criado com senha hasheada");
        }

        // FORÇA ATUALIZAÇÃO DAS PERMISSÕES SEMPRE AO INICIAR
        const perm = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_acesso'");
        if (!perm) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_acesso', PERMISSOES_PADRAO]);
            console.log("✅ Permissões de ACESSO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, apenas adiciona cargos/módulos novos que ainda não existem
            const permSalvas = JSON.parse(perm.valor);
            const permPadrao = JSON.parse(PERMISSOES_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permPadrao)) {
                if (!permSalvas[cargo]) {
                    permSalvas[cargo] = permPadrao[cargo];
                    atualizado = true;
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_acesso'", [JSON.stringify(permSalvas)]);
                console.log("✅ Permissões de ACESSO: novos cargos adicionados.");
            }
        }

        const permEd = await dbGet("SELECT * FROM configuracoes WHERE chave = 'permissoes_edicao'");
        if (!permEd) {
            await dbRun("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", ['permissoes_edicao', PERMISSOES_EDICAO_PADRAO]);
            console.log("✅ Permissões de EDIÇÃO inicializadas com padrão.");
        } else {
            // Mescla: preserva configurações salvas, apenas adiciona cargos novos
            const permEdSalvas = JSON.parse(permEd.valor);
            const permEdPadrao = JSON.parse(PERMISSOES_EDICAO_PADRAO);
            let atualizado = false;
            for (const cargo of Object.keys(permEdPadrao)) {
                if (!permEdSalvas[cargo]) {
                    permEdSalvas[cargo] = permEdPadrao[cargo];
                    atualizado = true;
                }
            }
            if (atualizado) {
                await dbRun("UPDATE configuracoes SET valor = ? WHERE chave = 'permissoes_edicao'", [JSON.stringify(permEdSalvas)]);
                console.log("✅ Permissões de EDIÇÃO: novos cargos adicionados.");
            }
        }

        console.log("✅ Banco pronto com permissões atualizadas!");
    } catch (e) { console.error("Erro inicializar:", e); }
};


module.exports = { inicializarBanco };
