import { z } from 'zod';

/**
 * Schema de validação para Login
 */
export const loginSchema = z.object({
    nome: z.string()
        .min(1, 'Nome/Email é obrigatório')
        .trim(),
    senha: z.string()
        .min(3, 'A senha deve ter no mínimo 3 caracteres')
});

/**
 * Schema de validação para Novo Lançamento de Veículo
 */
export const novoLancamentoSchema = z.object({
    operacao: z.string()
        .min(1, 'Operação é obrigatória'),
    data_prevista: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato: YYYY-MM-DD)'),
    motorista: z.string()
        .optional()
        .transform(val => val || ''),
    tipoVeiculo: z.string()
        .min(1, 'Tipo de veículo é obrigatório'),
    coletaRecife: z.string()
        .optional()
        .transform(val => val || ''),
    coletaMoreno: z.string()
        .optional()
        .transform(val => val || ''),
    rotaRecife: z.string()
        .optional()
        .transform(val => val || ''),
    rotaMoreno: z.string()
        .optional()
        .transform(val => val || ''),
    inicio: z.enum(['Recife', 'Moreno'])
        .default('Recife'),
    observacao: z.string()
        .optional()
        .transform(val => val || ''),
    entregaLocal: z.boolean()
        .optional()
        .default(false),
    imagens: z.array(z.string())
        .optional()
        .default([])
}).refine(data => {
    // Validação customizada: Se operação incluir RECIFE, coletaRecife é obrigatória
    if (data.operacao.includes('RECIFE') && !data.coletaRecife) {
        return false;
    }
    return true;
}, {
    message: 'Coleta de Recife é obrigatória para operações de Recife',
    path: ['coletaRecife']
}).refine(data => {
    // Validação customizada: Se operação incluir MORENO/PORCELANA/ELETRIK, coletaMoreno é obrigatória
    const precisaMoreno = data.operacao.includes('MORENO') ||
                         data.operacao.includes('PORCELANA') ||
                         data.operacao.includes('ELETRIK');
    if (precisaMoreno && !data.coletaMoreno) {
        return false;
    }
    return true;
}, {
    message: 'Coleta de Moreno é obrigatória para operações de Moreno/Porcelana/Eletrik',
    path: ['coletaMoreno']
});

/**
 * Schema de validação para Cubagem
 */
export const cubagemSchema = z.object({
    numero_coleta: z.string()
        .min(1, 'Número da coleta é obrigatório'),
    motorista: z.string()
        .optional()
        .transform(val => val || ''),
    cliente: z.string()
        .min(1, 'Cliente é obrigatório'),
    redespacho: z.boolean()
        .default(false),
    nome_redespacho: z.string()
        .optional()
        .transform(val => val || ''),
    destino: z.string()
        .min(1, 'Destino é obrigatório'),
    volume: z.string()
        .optional()
        .transform(val => val || ''),
    data: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato: YYYY-MM-DD)'),
    faturado: z.boolean()
        .default(false),
    tipo: z.string()
        .optional()
        .transform(val => val || ''),
    itens: z.array(
        z.object({
            numero_nf: z.string()
                .optional()
                .transform(val => val || ''),
            metragem: z.union([
                z.string().transform(val => {
                    const num = parseFloat(val);
                    return isNaN(num) ? 0 : num;
                }),
                z.number()
            ]).refine(val => val >= 0, {
                message: 'Metragem deve ser um número positivo'
            }),
            uf: z.string().optional().transform(val => val || ''),
            regiao: z.string().optional().transform(val => val || ''),
            valor: z.number().optional().default(0),
            volumes: z.number().optional().default(0),
            peso_kg: z.number().optional().default(0),
            redespacho_nome: z.string().nullable().optional().default(null),
            redespacho_uf: z.string().nullable().optional().default(null),
        })
    ).optional().default([]),
    metragem_total: z.number()
        .nonnegative('Metragem total deve ser positiva')
        .optional()
        .default(0),
    valor_mix_total: z.number()
        .nonnegative('Valor MIX deve ser positivo')
        .optional()
        .default(0),
    valor_kit_total: z.number()
        .nonnegative('Valor KIT deve ser positivo')
        .optional()
        .default(0)
});

/**
 * Schema de validação para Cadastro de Usuário
 */
export const cadastroUsuarioSchema = z.object({
    nome: z.string()
        .min(3, 'Nome deve ter no mínimo 3 caracteres')
        .trim(),
    email: z.string()
        .email('Email inválido')
        .trim()
        .toLowerCase(),
    senha: z.string()
        .min(3, 'Senha deve ter no mínimo 3 caracteres'),
    cidade: z.enum(['Recife', 'Moreno', 'Ambas'], {
        errorMap: () => ({ message: 'Cidade deve ser Recife, Moreno ou Ambas' })
    }).optional().default('Recife'),
    cargo: z.string()
        .min(1, 'Cargo é obrigatório')
});

/**
 * Schema de validação para Atualização de Veículo
 */
export const atualizarVeiculoSchema = z.object({
    motorista: z.string().optional(),
    status_recife: z.string().optional(),
    status_moreno: z.string().optional(),
    doca_recife: z.string().optional(),
    doca_moreno: z.string().optional(),
    coleta: z.string().optional(),
    coletaRecife: z.string().optional(),
    coletaMoreno: z.string().optional(),
    rotaRecife: z.string().optional(),
    rotaMoreno: z.string().optional(),
    data_prevista: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
        .optional(),
    observacao: z.string().optional(),
    imagens: z.array(z.string()).optional(),
    tempos_recife: z.record(z.string()).optional(),
    tempos_moreno: z.record(z.string()).optional(),
    status_coleta: z.record(z.string()).optional()
});
