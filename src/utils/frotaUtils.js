/**
 * Normaliza lista de veículos para o dashboard:
 * CONJUNTO → card CONJUNTO + entrada virtual _cardTipo='CARRETA' (_atrelada=true)
 * CARRETA avulsa → _cardTipo='CARRETA', _atrelada=false
 * demais → _cardTipo=tipo_veiculo
 *
 * Para o card CARRETA, também marca carretas dos CONJUNTOs como _atrelada=true.
 */
export function normalizarVeiculos(veiculos) {
    const result = [];
    for (const v of veiculos) {
        if (v.tipo_veiculo === 'CONJUNTO') {
            // Card CONJUNTO
            result.push({ ...v, _cardTipo: 'CONJUNTO', _placaExibicao: v.placa });
            // Gera entrada virtual para a carreta atrelada no card CARRETA
            if (v.carreta) {
                result.push({
                    ...v,
                    _cardTipo: 'CARRETA',
                    _placaExibicao: v.carreta,
                    _atrelada: true,
                });
            }
        } else if (v.tipo_veiculo === 'CARRETA') {
            // CARRETA avulsa: placa='-', placa real está no campo carreta
            const placaReal = (v.placa && v.placa !== '-') ? v.placa : (v.carreta || v.placa);
            result.push({
                ...v,
                _cardTipo: 'CARRETA',
                _placaExibicao: placaReal,
                _atrelada: false,
            });
        } else {
            result.push({ ...v, _cardTipo: v.tipo_veiculo, _placaExibicao: v.placa });
        }
    }
    return result;
}
