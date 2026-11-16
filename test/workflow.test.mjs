import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../workflow/workflow.mjs', import.meta.url));
const plugin = resolve(dirname(cli), '..');
const tracking = () => ({ version: 1, incidentes: [], revisiones: [] });
function completed(f, count) {
  const d = valid(); d.contrato = 1;
  d.features = Array.from({ length: count }, (_, n) => ({ ...valid().features[0],
    id: `F-${String(n + 1).padStart(3, '0')}`, estado: 'hecha', pasa: true, autor: 'agent-b', revisor: 'agent-a' }));
  f.config(d); f.put('workflow/metodologia.json', JSON.stringify(tracking()));
}
const valid = () => ({
  contrato: 1, proyecto: 'prueba',
  gates: { check: 'node --version', max_rondas_ci: 2, max_lineas_pr: 400 },
  features: [{ id: 'F-001', titulo: 'Función de prueba', criterios: ['Entrega un resultado'],
    verificacion: 'Ejecutar un caso real', estado: 'pendiente', pasa: false,
    autor: '', revisor: '', rama: '', pr: null, evidencia: [] }],
});
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'workflow-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const put = (path, body) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  const config = (data = valid()) => put('workflow/features.json', JSON.stringify(data));
  config(); put('workflow/metodologia.json', JSON.stringify(tracking())); put('workflow/SPEC.md', '# Especificación\n');
  put('workflow/PROGRESO.md', '# Progreso\n\n## 2026-01-01 · agent-b · F-001\n- Hecho: prueba\n');
  git('init', '-b', 'main'); git('config', 'user.email', 'pruebas@example.invalid');
  git('config', 'user.name', 'Pruebas Workflow'); git('add', '.'); git('commit', '-m', 'Base de prueba');
  git('checkout', '-b', 'trabajo');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, WORKFLOW_BASE: 'main', WORKFLOW_GATES_ACTIVE: '' },
  });
  return { dir, put, git, config, run };
}
test('validar acepta contrato, estados y hecha con revisión independiente', t => {
  const f = fixture(t);
  for (const version of [1]) for (const state of ['pendiente', 'en_curso', 'en_revision', 'bloqueada', 'hecha']) {
    const data = valid(); data.contrato = version; data.features[0].estado = state;
    if (state === 'hecha') Object.assign(data.features[0], { pasa: true, autor: 'agent-b', revisor: 'agent-a' });
    f.config(data); const r = f.run('validar'); assert.equal(r.status, 0, r.stdout + r.stderr);
  }
});
const invalid = {
  'versión desconocida': d => { d.contrato = 99; },
  'proyecto vacío': d => { d.proyecto = ' '; },
  'campo extra': d => { d.sorpresa = true; },
  'gates ausente': d => { delete d.gates; },
  'gates con campo desconocido': d => { d.gates.omitir = true; },
  'check vacío': d => { d.gates.check = ''; },
  'rondas mayores que dos': d => { d.gates.max_rondas_ci = 3; },
  'rondas cero': d => { d.gates.max_rondas_ci = 0; },
  'límite fraccionario': d => { d.gates.max_lineas_pr = 1.5; },
  'features no es lista': d => { d.features = {}; },
  'feature nula': d => { d.features = [null]; },
  'id mal formado': d => { d.features[0].id = 'F-1'; },
  'id duplicado': d => { d.features.push({ ...d.features[0] }); },
  'título vacío': d => { d.features[0].titulo = ''; },
  'criterios vacíos': d => { d.features[0].criterios = []; },
  'criterio no textual': d => { d.features[0].criterios = [false]; },
  'verificación vacía': d => { d.features[0].verificacion = ' '; },
  'estado inválido': d => { d.features[0].estado = 'lista'; },
  'pasa no booleano': d => { d.features[0].pasa = 'true'; },
  'autor inválido': d => { d.features[0].autor = 'otro'; },
  'revisor inválido': d => { d.features[0].revisor = 'otro'; },
  'revisor sin autor': d => { d.features[0].revisor = 'agent-a'; },
  'autorevisión': d => { Object.assign(d.features[0], { autor: 'agent-b', revisor: 'agent-b' }); },
  'rama no textual': d => { d.features[0].rama = 5; },
  'pr cero': d => { d.features[0].pr = 0; },
  'pr textual': d => { d.features[0].pr = 'https://ejemplo.invalid/1'; },
  'evidencia no textual': d => { d.features[0].evidencia = [12]; },
  'campo obligatorio ausente': d => { delete d.features[0].evidencia; },
  'hecha sin pasar': d => { Object.assign(d.features[0], { estado: 'hecha', autor: 'agent-b', revisor: 'agent-a' }); },
  'hecha sin autor': d => { Object.assign(d.features[0], { estado: 'hecha', pasa: true, revisor: 'agent-a' }); },
  'hecha sin revisor': d => { Object.assign(d.features[0], { estado: 'hecha', pasa: true, autor: 'agent-b' }); },
};
for (const [name, mutate] of Object.entries(invalid)) test(`validar rechaza ${name}`, t => {
  const f = fixture(t), d = valid(); mutate(d); f.config(d);
  const r = f.run('validar'); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /ERROR/);
});
test('JSON roto y archivos faltantes fallan sin volcar contenido', t => {
  const f = fixture(t); f.put('workflow/features.json', 'NO_MOSTRAR_ESTO{');
  let r = f.run('validar'); assert.equal(r.status, 1); assert.doesNotMatch(r.stdout + r.stderr, /NO_MOSTRAR_ESTO/);
  f.config();
  for (const path of ['workflow/SPEC.md', 'workflow/PROGRESO.md']) {
    rmSync(join(f.dir, path)); assert.equal(f.run('validar').status, 1); f.put(path, '# Documento');
  }
});
test('tamaño suma altas y bajas y excluye tests, lockfiles y generados', t => {
  const f = fixture(t);
  f.put('src/app.js', 'uno\ndos\n'); f.git('add', '.'); f.git('commit', '-m', 'Código');
  for (const path of ['test/a.js', '__tests__/a.js', 'src/a.test.js', 'src/a.spec.ts',
    'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'dist/a.js', 'src/a.generated.ts']) f.put(path, 'ignorado\n'.repeat(500));
  f.put('src/app.js', 'nuevo\n'); f.git('add', '.');
  const d = valid(); d.gates.max_lineas_pr = 1; f.config(d);
  // No incluir el cambio de configuración en el tamaño: límite leído del disco.
  f.git('add', 'workflow/features.json'); f.git('commit', '-m', 'Cambios');
  const r = f.run('tamano'); assert.equal(r.status, 1); assert.match(r.stdout, /Tamaño: 3 líneas/);
  assert.equal(f.run('tamano', '--aviso').status, 0);
});
test('tamaño exacto, archivos con espacios, renombres y base explícita', t => {
  const f = fixture(t);
  f.put('src/old.js', 'base\n'); f.git('add', '.'); f.git('commit', '-m', 'Base adicional'); f.git('branch', 'otra-base');
  f.put('src/old.js', 'nuevo\notro\n'); f.put('src/con espacio.js', 'tres\n');
  f.put('test/prueba.js', 'ignorar\n'.repeat(1000)); f.git('add', '.'); f.git('commit', '-m', 'Trabajo');
  assert.match(f.run('tamano', 'otra-base').stdout, /Tamaño: 4 líneas/);
  f.git('mv', 'src/con espacio.js', 'src/nuevo nombre.js');
  assert.match(f.run('tamano', 'otra-base').stdout, /Tamaño: 4 líneas/);
  assert.equal(f.run('tamano', 'inexistente', '--aviso').status, 1);
});
test('secretos detecta commits, índice, trabajo y nuevos; nunca imprime valores', t => {
  const f = fixture(t);
  const token = ['ghp', '_', 'A'.repeat(36)].join('');
  f.put('src/cred.js', `const token = '${token}';\n`);
  for (const step of ['nuevo', 'índice', 'commit']) {
    if (step === 'índice') f.git('add', '.');
    if (step === 'commit') f.git('commit', '-m', 'Señuelo sintético');
    const r = f.run('secretos'); assert.equal(r.status, 1, step); assert.match(r.stdout, /"src\/cred.js":1/);
    assert.ok(!(r.stdout + r.stderr).includes(token));
  }
  f.put('src/cred.js', 'limpio\n'); // El snapshot final no tiene clave, pero sigue en el diff sin stage.
  f.git('add', '.'); f.git('commit', '-m', 'Retirar señuelo');
  assert.equal(f.run('secretos').status, 0);
  f.put('src/cred.js', `const token = '${token}';\n`); assert.equal(f.run('secretos').status, 1);
});
test('--staged mira exclusivamente el índice incluso si el archivo cambia después', t => {
  const f = fixture(t), token = ['sk', '-proj-', 'B'.repeat(40)].join('');
  f.put('secret.js', token); assert.equal(f.run('secretos', '--staged').status, 0);
  f.git('add', '.'); f.put('secret.js', 'limpio');
  const r = f.run('secretos', '--staged'); assert.equal(r.status, 1); assert.ok(!r.stdout.includes(token));
  assert.equal(f.run('secretos').status, 1);
});
test('secretos detecta familias conocidas, claves privadas y asignaciones literales', t => {
  const f = fixture(t);
  const samples = [
    ['AKIA', 'C'.repeat(16)].join(''), ['AIza', 'D'.repeat(35)].join(''),
    ['xoxb-', '1234567890-', 'E'.repeat(24)].join(''),
    ['github_pat_', 'F'.repeat(82)].join(''),
    ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join(''),
    'password = "' + 'valorSintetico123456' + '"',
  ];
  for (const value of samples) {
    f.put('src/prueba.txt', value + '\n'); const r = f.run('secretos');
    assert.equal(r.status, 1); assert.ok(!(r.stdout + r.stderr).includes(value));
  }
});
test('no confunde referencias, ejemplos vacíos, claves públicas ni lockfiles con secretos', t => {
  const f = fixture(t);
  f.put('.env.example', 'API_KEY=\nPASSWORD=change-me\n');
  f.put('src/config.js', 'const apiKey = process.env.API_KEY;\nconst password = "example";\nconst token = "${TOKEN}";\n');
  f.put('examples.txt', 'API_KEY=your-api-key\nPASSWORD="not-a-real-password"\nTOKEN=__PLACEHOLDER__\n');
  f.put('public.pem', '-----BEGIN PUBLIC KEY-----\n');
  f.put('package-lock.json', JSON.stringify({ integrity: 'sha512-' + 'a'.repeat(100) }));
  assert.equal(f.run('secretos').status, 0);
  f.put('.env.example', 'API_KEY=' + ['ghp_', 'Z'.repeat(36)].join('')); // ejemplos también se escanean
  assert.equal(f.run('secretos').status, 1);
});
test('.env reales fallan incluso vacíos; borrarlos no genera un hallazgo', t => {
  const f = fixture(t); f.put('.env.production', ''); assert.equal(f.run('secretos').status, 1);
  f.git('add', '.'); assert.equal(f.run('secretos', '--staged').status, 1);
  f.git('commit', '-m', 'Entorno vacío de prueba'); f.git('branch', '-f', 'main');
  f.git('rm', '.env.production'); assert.equal(f.run('secretos', '--staged').status, 0);
});
test('gates respeta salida, shell y ejecuta desde la raíz; todo falla cerrado', t => {
  const f = fixture(t), d = valid();
  d.gates.check = 'node -e "process.exit(7)"'; f.config(d); assert.equal(f.run('gates').status, 1);
  d.gates.check = 'node --version && node -e "require(\'node:fs\').writeFileSync(\'gate-ran\',\'ok\')"';
  f.config(d); assert.equal(f.run('todo').status, 0); assert.ok(existsSync(join(f.dir, 'gate-ran')));
  rmSync(join(f.dir, 'gate-ran')); f.put('.env', '');
  assert.equal(f.run('todo').status, 1); assert.ok(!existsSync(join(f.dir, 'gate-ran')));
});
test('estado muestra función actual, próxima y dos últimas entradas', t => {
  const f = fixture(t), d = valid();
  d.features.push({ ...d.features[0], id: 'F-002' }); d.features[0].estado = 'en_curso';
  f.config(d); f.put('workflow/PROGRESO.md', '# Progreso\n\n## Vieja\nAntigua\n\n## Media\nSegunda\n\n## Nueva\nTercera\n');
  const r = f.run('estado'); assert.equal(r.status, 0);
  assert.match(r.stdout, /F-001/); assert.match(r.stdout, /F-002/); assert.match(r.stdout, /Segunda/);
  assert.match(r.stdout, /Tercera/); assert.doesNotMatch(r.stdout, /Antigua/);
});
test('opciones inválidas y ejecución sin repo salen con 1', t => {
  const f = fixture(t);
  for (const args of [[], ['desconocido'], ['validar', '--staged'], ['todo', 'main'], ['tamano', '--raro']]) {
    assert.equal(f.run(...args).status, 1);
  }
  rmSync(join(f.dir, '.git'), { recursive: true }); assert.equal(f.run('secretos').status, 1);
});
test('iniciar instala herramienta y workflow sin sobrescribir; sesion usa cwd del evento', t => {
  const f = fixture(t);
  const first = spawnSync('python3', [join(plugin, 'scripts/iniciar.py'), plugin], { cwd: f.dir, encoding: 'utf8' });
  assert.equal(first.status, 0); assert.equal(readFileSync(join(f.dir, 'workflow/workflow.mjs'), 'utf8'), readFileSync(cli, 'utf8'));
  assert.ok(existsSync(join(f.dir, '.github/workflows/workflow.yml')));
  f.put('AGENTS.md', 'Reglas existentes');
  assert.equal(spawnSync('python3', [join(plugin, 'scripts/iniciar.py'), plugin], { cwd: f.dir }).status, 0);
  assert.equal(readFileSync(join(f.dir, 'AGENTS.md'), 'utf8'), 'Reglas existentes');
  const r = spawnSync('python3', [join(plugin, 'scripts/sesion.py')], {
    cwd: tmpdir(), input: JSON.stringify({ cwd: f.dir }), encoding: 'utf8',
  });
  assert.equal(r.status, 0); assert.match(r.stdout, /F-001/);
  const installed = spawnSync(process.execPath, ['workflow/workflow.mjs', 'todo'], {
    cwd: f.dir, encoding: 'utf8', env: { ...process.env, WORKFLOW_BASE: 'main', WORKFLOW_GATES_ACTIVE: '' },
  });
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
});
test('sesion maneja estructuras inválidas sin traceback ni contenido del documento', t => {
  const f = fixture(t);
  for (const data of ['null', '[]', '{"features": [null]}', 'DATO_NO_PUBLICABLE{']) {
    f.put('workflow/features.json', data);
    const r = spawnSync('python3', [join(plugin, 'scripts/sesion.py')], {
      cwd: f.dir, input: '{}', encoding: 'utf8',
    });
    assert.equal(r.status, 0); assert.equal(r.stderr, '');
    assert.match(r.stdout, /inválida/); assert.doesNotMatch(r.stdout, /DATO_NO_PUBLICABLE/);
  }
});
test('la base usa merge-base: cambios ajenos posteriores no cuentan', t => {
  const f = fixture(t);
  f.git('checkout', 'main'); f.put('ajeno.js', 'ajeno\n'.repeat(700));
  f.git('add', '.'); f.git('commit', '-m', 'Trabajo ajeno'); f.git('checkout', 'trabajo');
  f.put('propio.js', 'propio\n'); f.git('add', '.'); f.git('commit', '-m', 'Trabajo propio');
  assert.match(f.run('tamano').stdout, /Tamaño: 1 líneas/);
  // Sin main: simular CI de un PR dirigido a una rama no principal.
  f.git('branch', '-m', 'main', 'desarrollo-optimizado');
  const r = spawnSync(process.execPath, [cli, 'todo'], {
    cwd: f.dir, encoding: 'utf8', env: { ...process.env, WORKFLOW_BASE: 'desarrollo-optimizado', WORKFLOW_GATES_ACTIVE: '' },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('tamaño cuenta eliminaciones y no ignora archivos de producto con test en su nombre', t => {
  const f = fixture(t);
  f.put('src/latest.js', 'uno\ndos\n'); f.git('add', '.'); f.git('commit', '-m', 'Base');
  f.git('branch', '-f', 'main'); f.git('rm', 'src/latest.js'); f.put('src/testing-service.js', 'tres\n');
  f.git('add', '.'); assert.match(f.run('tamano').stdout, /Tamaño: 3 líneas/);
});
test('gates rechaza recursión, incluso invocada indirectamente', t => {
  const f = fixture(t), d = valid();
  // Ruta propia de la prueba, nunca datos externos interpolados en un shell.
  d.gates.check = `node '${cli.replaceAll("'", "'\\''")}' gates`; f.config(d);
  const r = f.run('gates'); assert.equal(r.status, 1); assert.match(r.stderr, /recursivamente/);
});
test('metodología avisa exactamente desde la tercera entrega y no modifica archivos', t => {
  const f = fixture(t);
  for (const n of [0, 1, 2, 3, 4]) {
    completed(f, n); const before = readFileSync(join(f.dir, 'workflow/metodologia.json'), 'utf8');
    const r = f.run('metodologia'); assert.equal(r.status, n >= 3 ? 1 : 0, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`${n}/3`));
    assert.equal(readFileSync(join(f.dir, 'workflow/metodologia.json'), 'utf8'), before);
    assert.equal(f.run('estado').status, 0);
  }
});
test('revisión sin cambios reconoce entregas; nuevas entregas vuelven a disparar', t => {
  const f = fixture(t); completed(f, 6); const record = tracking();
  record.revisiones.push({ fecha: '2026-11-16', features: ['F-001', 'F-002', 'F-003'], incidentes: [],
    resultado: 'sin_cambios', evidencia: ['workflow/LECCIONES.md#evaluacion'] });
  f.put('workflow/metodologia.json', JSON.stringify(record));
  const r = f.run('metodologia'); assert.equal(r.status, 1); assert.match(r.stdout, /3\/3 · F-004, F-005, F-006/);
  record.revisiones.push({ ...record.revisiones[0], features: ['F-004','F-005','F-006'] });
  f.put('workflow/metodologia.json', JSON.stringify(record)); assert.equal(f.run('metodologia').status, 0);
});
test('cada incidente obliga a revisar inmediatamente y solo su revisión lo resuelve', t => {
  const f = fixture(t); completed(f, 0);
  for (const tipo of ['fallo_produccion','exposicion_datos','fallo_repetido','regla_bloqueante','manual']) {
    const record = tracking();
    record.incidentes.push({ id: 'I-001', fecha: '2026-11-16', tipo, evidencia: ['workflow/LECCIONES.md#incidente'] });
    f.put('workflow/metodologia.json', JSON.stringify(record)); assert.equal(f.run('metodologia').status, 1);
    record.revisiones.push({ fecha:'2026-11-16', features:[], incidentes:['I-001'], resultado:'cambios_propuestos', evidencia:['workflow/DECISIONES.md#revision'] });
    f.put('workflow/metodologia.json', JSON.stringify(record)); assert.equal(f.run('metodologia').status, 0);
  }
});
test('registros inválidos no se confunden con metodología al día', t => {
  const f = fixture(t); completed(f, 3);
  const review = {fecha:'2026-11-16',features:['F-001'],incidentes:[],resultado:'sin_cambios',evidencia:['nota.md']};
  for (const record of [null, {}, { ...tracking(), version:2 },
    { ...tracking(), revisiones:[{...review,features:['F-999']}] },
    { ...tracking(), revisiones:[{...review,evidencia:[]}] },
    { ...tracking(), revisiones:[{...review,fecha:'2026-02-30'}] },
    { ...tracking(), revisiones:[{...review,incidentes:['I-001']}] },
    { ...tracking(), revisiones:[{...review,features:['F-001','F-001']}] }]) {
    f.put('workflow/metodologia.json', JSON.stringify(record));
    assert.equal(f.run('validar').status, 1); assert.equal(f.run('metodologia').status, 1);
  }
  f.put('workflow/metodologia.json','NO_PUBLICAR{'); const r=f.run('metodologia');
  assert.equal(r.status,1); assert.doesNotMatch(r.stdout+r.stderr,/NO_PUBLICAR/);
});
test('el contrato exige registro de metodología', t => {
  const f=fixture(t); rmSync(join(f.dir,'workflow/metodologia.json'));
  assert.equal(f.run('validar').status,1);
});
test('todo informa revisión pendiente sin bloquear gates y SessionStart expone el aviso', t => {
  const f=fixture(t);completed(f,3); assert.equal(f.run('todo').status,0);
  spawnSync('python3',[join(plugin,'scripts/iniciar.py'),plugin],{cwd:f.dir});
  const r=spawnSync('python3',[join(plugin,'scripts/sesion.py')],{cwd:tmpdir(),input:JSON.stringify({cwd:f.dir}),encoding:'utf8'});
  assert.equal(r.status,0);assert.match(r.stdout,/REVISIÓN PENDIENTE/);
});
