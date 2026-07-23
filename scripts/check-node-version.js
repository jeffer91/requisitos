'use strict';

const MINIMUM_NODE = [22, 12, 0];

function parseVersion(version) {
  return version
    .replace(/^v/, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isAtLeast(current, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}

const currentVersion = parseVersion(process.version);

if (!isAtLeast(currentVersion, MINIMUM_NODE)) {
  console.error('\nNo se puede iniciar Requisitos Desktop.');
  console.error(`Node.js instalado: ${process.version}`);
  console.error('Node.js requerido: v22.12.0 o superior.');
  console.error('\nActualiza Node.js, cierra PowerShell, abre una terminal nueva y ejecuta:');
  console.error('  node -v');
  console.error('  npm ci');
  console.error('  npm start\n');
  process.exit(1);
}
