// middleware/roles.js
const ROLES = {
    // Operação diária (Painel Operacional, veículos, cubagem)
    OPERACIONAL:  ['Planejamento', 'Encarregado', 'Aux. Operacional'],

    // Apenas cadastro/risco
    CADASTRO:     ['Encarregado', 'Cadastro'],

    // CT-e e conhecimento
    CTE:          ['Planejamento', 'Conhecimento'],

    // Pós-embarque
    POS_EMBARQUE: ['Pos Embarque', 'Planejamento'],

    // Gestão de frota própria
    FROTA:        ['Adm Frota', 'Planejamento'],

    // Conferente de carregamento
    CONFERENTE:   ['Conferente', 'Encarregado'],

    // Consulta ampla (leitura, sem edição)
    CONSULTA:     ['Planejamento', 'Encarregado', 'Aux. Operacional',
                   'Cadastro', 'Conhecimento', 'Pos Embarque'],
};

module.exports = { ROLES };
