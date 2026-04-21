const html = require('fs').readFileSync(process.argv[2], 'utf8');
const matches = html.match(/claw_[a-zA-Z0-9_\-]+/g);
console.log(matches ? [...new Set(matches)] : "No matches");
