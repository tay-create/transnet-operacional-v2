console.log('Testing merge logic...');
const prev = [{id: 1, operacao: 'DELTA (RECIFE)'}];
const data = {id: 1, operacao: 'DELTA MORENO'};
const updated = prev.map(c => c.id === data.id ? { ...c, ...data } : c);
console.log(updated);
