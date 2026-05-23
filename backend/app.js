const fs = require('fs');
const path = require('path');

process.chdir(__dirname);

const entrypoints = [
  path.join(__dirname, 'dist', 'main.js'),
  path.join(__dirname, 'dist', 'backend', 'src', 'main.js'),
];
const entrypoint = entrypoints.find((candidate) => fs.existsSync(candidate));

if (!entrypoint) {
  throw new Error(
    `No se encontro el entrypoint compilado. Ejecuta "npm install" y "npm run build" en el backend antes de iniciar la app.`,
  );
}

require(entrypoint);
