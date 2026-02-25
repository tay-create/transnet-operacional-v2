const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const routes = [];
lines.forEach((l, i) => {
    if (l.includes('app.get(') || l.includes('app.post(') || l.includes('app.put(') || l.includes('app.delete(')) {
        routes.push(`${i + 1}: ${l.trim()}`);
    }
});
fs.writeFileSync('routes_summary.txt', routes.join('\n'));
console.log('Routes mapped to routes_summary.txt');
