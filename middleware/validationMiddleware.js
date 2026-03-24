const { z } = require('zod');

/**
 * Schemas Zod para validação no backend (espelhando frontend)
 */

const loginSchema = z.object({
    nome: z.string().min(1, 'Nome/Email é obrigatório').trim(),
    senha: z.string().min(3, 'A senha deve ter no mínimo 3 caracteres')
});

const novoLancamentoSchema = z.object({
    operacao: z.string().min(1, 'Operação é obrigatória'),
    data_prevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    motorista: z.string().optional().transform(val => val || ''),
    tipoVeiculo: z.string().min(1, 'Tipo de veículo é obrigatório'),
    coletaRecife: z.string().optional().transform(val => val || ''),
    coletaMoreno: z.string().optional().transform(val => val || ''),
    rotaRecife: z.string().optional().transform(val => val || ''),
    rotaMoreno: z.string().optional().transform(val => val || ''),
    observacao: z.string().optional().transform(val => val || ''),
    imagens: z.array(z.string()).optional().default([])
}).passthrough();

const cubagemSchema = z.object({
    numero_coleta: z.string().min(1, 'Número da coleta é obrigatório'),
    motorista: z.string().optional().transform(val => val || ''),
    cliente: z.string().min(1, 'Cliente é obrigatório'),
    redespacho: z.boolean().default(false),
    nome_redespacho: z.string().optional().transform(val => val || ''),
    destino: z.string().min(1, 'Destino é obrigatório'),
    volume: z.string().optional().transform(val => val || ''),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    faturado: z.boolean().default(false),
    tipo: z.string().optional().transform(val => val || ''),
    itens: z.array(
        z.object({
            numero_nf: z.string().optional().transform(val => val || ''),
            metragem: z.union([
                z.string().transform(val => parseFloat(val) || 0),
                z.number()
            ]).refine(val => val >= 0, { message: 'Metragem deve ser positiva' })
        })
    ).optional().default([]),
    metragem_total: z.number().nonnegative().optional().default(0),
    valor_mix_total: z.number().nonnegative().optional().default(0),
    valor_kit_total: z.number().nonnegative().optional().default(0)
});

const cadastroUsuarioSchema = z.object({
    nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').trim(),
    email: z.string().email('Email inválido').trim().toLowerCase(),
    senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    cidade: z.enum(['Recife', 'Moreno'], {
        errorMap: () => ({ message: 'Cidade inválida' })
    }),
    cargo: z.string().min(1, 'Cargo é obrigatório')
});

/**
 * Middleware genérico de validação Zod
 * Uso: validate(loginSchema)
 */
const validate = (schema) => {
    return (req, res, next) => {
        try {
            // Valida o req.body com o schema fornecido
            const validated = schema.parse(req.body);

            // Substitui req.body pelos dados validados e transformados
            req.body = validated;

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Formata erros do Zod para resposta amigável (Zod v4 usa .issues)
                const issues = error.issues || error.errors || [];
                const errors = issues.map(err => ({
                    campo: err.path.join('.'),
                    mensagem: err.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Erro de validação',
                    errors
                });
            }

            // Erro genérico
            return res.status(500).json({
                success: false,
                message: 'Erro ao validar dados'
            });
        }
    };
};

module.exports = {
    validate,
    loginSchema,
    novoLancamentoSchema,
    cubagemSchema,
    cadastroUsuarioSchema
};
