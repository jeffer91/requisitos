const fs = require('fs');
const vm = require('vm');

const files = [
  'Stats/stats.data.connector-patch.js',
  'BDLocal/conexiones/cone.stats.notes.js'
];

let failed = false;
for (const file of files) {
  try {
    const source = fs.readFileSync(file, 'utf8');
    new vm.Script(source, { filename: file });
    console.log(`OK ${file}`);
  } catch (error) {
    failed = true;
    console.error(`ERROR ${file}: ${error.message}`);
  }
}

const patch = fs.readFileSync('Stats/stats.data.connector-patch.js', 'utf8');
const notes = fs.readFileSync('BDLocal/conexiones/cone.stats.notes.js', 'utf8');

const checks = [
  ['StatsDataPatch ready no carga notas', !/function ready\(\)\{[\s\S]{0,300}load\(/.test(patch)],
  ['Notas se consultan por periodo', /listNotes\(\{periodoId:periodoId,periodId:periodoId\}\)/.test(patch)],
  ['No existe timeout fijo de 15 segundos', !/15000/.test(notes)],
  ['Repositorio de notas activa pesado bajo demanda', /activateHeavy/.test(notes)]
];

for (const [label, ok] of checks) {
  if (!ok) {
    failed = true;
    console.error(`ERROR ${label}`);
  } else {
    console.log(`OK ${label}`);
  }
}

process.exitCode = failed ? 1 : 0;
