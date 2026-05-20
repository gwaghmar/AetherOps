/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const dir = './e2e';

fs.readdirSync(dir)
  .filter(f => f.endsWith('.spec.ts'))
  .forEach(f => {
    const file = path.join(dir, f);
    let content = fs.readFileSync(file, 'utf8');
    // Remove test.skip(!process.env.DATABASE_URL?.trim(), "DATABASE_URL");
    // along with its leading whitespace
    content = content.replace(/\s*test\.skip\(!process\.env\.DATABASE_URL\?\.trim\(\),\s*"DATABASE_URL"\);/g, '');
    fs.writeFileSync(file, content);
  });
