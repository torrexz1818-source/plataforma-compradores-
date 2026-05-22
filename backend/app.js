const fs = require('fs');
const path = require('path');

process.chdir(__dirname);

const entrypoint = path.join(__dirname, 'dist', 'main.js');

if (!fs.existsSync(entrypoint)) {
  throw new Error(
    `No se encontro ${entrypoint}. Ejecuta "npm install" y "npm run build" en el backend antes de iniciar la app.`,
  );
}

require(entrypoint);
