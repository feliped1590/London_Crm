const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const version = crypto.randomBytes(8).toString('hex');
const output = path.join(__dirname, 'dist', 'version.json');

// Ensure dist exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
}

fs.writeFileSync(output, JSON.stringify({ version, builtAt: new Date().toISOString() }));
console.log(`version.json generated: ${version}`);
