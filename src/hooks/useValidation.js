import { useState } from 'react';

/**
 * Hook customizado para validação com Zod
 *
 * @param {ZodSchema} schema - Schema Zod para validação
 * @returns {Object} - { validate, errors, clearErrors }
 */
export const useValidation = (schema) => {
    const [errors, setErrors] = useState({});

    /**
     * Valida dados contra o schema
     * @param {Object} data - Dados a serem validados
     * @returns {Object|null} - Retorna dados validados ou null se houver erro
     */
    const validate = (data) => {
        try {
            // safeParse retorna { success, data, error }
            const result = schema.safeParse(data);

            if (!result.success) {
                // Formatar erros do Zod
                const formattedErrors = {};
                result.error.errors.forEach(err => {
                    const path = err.path.join('.');
                    formattedErrors[path] = err.message;
                });

                setErrors(formattedErrors);
                return null;
            }

            // Validação bem-sucedida
            setErrors({});
            return result.data;
        } catch (error) {
            console.error('Erro na validação:', error);
            setErrors({ _global: 'Erro ao validar dados' });
            return null;
        }
    };

    /**
     * Limpa todos os erros
     */
    const clearErrors = () => {
        setErrors({});
    };

    /**
     * Limpa erro de um campo específico
     */
    const clearFieldError = (fieldName) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    };

    /**
     * Verifica se um campo específico tem erro
     */
    const hasError = (fieldName) => {
        return !!errors[fieldName];
    };

    /**
     * Obtém mensagem de erro de um campo
     */
    const getError = (fieldName) => {
        return errors[fieldName] || '';
    };

    return {
        validate,
        errors,
        clearErrors,
        clearFieldError,
        hasError,
        getError
    };
};

export default useValidation;
