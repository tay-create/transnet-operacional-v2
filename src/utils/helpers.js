// Função para obter data no timezone de Brasília (America/Sao_Paulo) — formato YYYY-MM-DD
export const obterDataBrasilia = () => {
    const agora = new Date();
    const dataBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const ano = dataBrasilia.getFullYear();
    const mes = String(dataBrasilia.getMonth() + 1).padStart(2, '0');
    const dia = String(dataBrasilia.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};

// Função para calcular a diferença entre dois horários (ex: 14:00 e 16:30)
export const calcularDiferencaHoras = (inicio, fim) => {
    if (!inicio || !fim) return "00:00";

    const [hInicio, mInicio] = inicio.split(':').map(Number);
    const [hFim, mFim] = fim.split(':').map(Number);

    const minutosInicio = hInicio * 60 + mInicio;
    const minutosFim = hFim * 60 + mFim;

    let diferenca = minutosFim - minutosInicio;
    if (diferenca < 0) diferenca += 24 * 60; // Ajuste para virada de dia

    const horas = Math.floor(diferenca / 60);
    const minutos = diferenca % 60;

    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
};

// Função para converter arquivo de imagem para Base64 (usado no Avatar)
export const converterImagemParaBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};