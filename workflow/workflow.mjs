#!/usr/bin/env node
// Contrato 1. Node >= 22, sin dependencias.
import { readFileSync, statSync, lstatSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const MAX_BUFFER = 32 * 1024 * 1024;
const fail = message => { throw new Error(message); };
const git = (...args) => {
  const r = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: MAX_BUFFER, env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' },
  });
  if (r.error || r.status !== 0) fail('No se pudo leer Git. Comprueba el repositorio, la base y el historial completo.');
  return r.stdout;
};
function read(path) {
  try { return readFileSync(resolve(root, path), 'utf8'); }
  catch { fail(`No se pudo leer ${path}.`); }
}
function load() {
  const text = read('workflow/features.json');
  try { return JSON.parse(text); }
  catch { fail('workflow/features.json no contiene JSON válido.'); }
}
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const positive = x => Number.isSafeInteger(x) && x > 0;
function validate(data) {
  const errors = [];
  const check = (ok, path, rule) => { if (!ok) errors.push(`${path}: ${rule}`); };
  const fields = (value, keys, path) => {
    if (!object(value)) { errors.push(`${path}: debe ser un objeto`); return false; }
    check(keys.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => keys.includes(k)),
      path, 'campos obligatorios ausentes o campos desconocidos');
    return true;
  };
  if (!fields(data, ['contrato', 'proyecto', 'gates', 'features'], 'documento')) return errors;
  check(data.contrato === 1, 'contrato', 'versión admitida: 1');
  check(nonempty(data.proyecto), 'proyecto', 'debe ser texto no vacío');
  if (fields(data.gates, ['check', 'max_rondas_ci', 'max_lineas_pr'], 'gates')) {
    check(nonempty(data.gates.check), 'gates.check', 'debe ser un comando no vacío');
    check([1, 2].includes(data.gates.max_rondas_ci), 'gates.max_rondas_ci', 'debe ser 1 o 2');
    check(positive(data.gates.max_lineas_pr), 'gates.max_lineas_pr', 'debe ser un entero positivo');
  }
  check(Array.isArray(data.features), 'features', 'debe ser una lista');
  const ids = new Set();
  for (const [i, f] of (Array.isArray(data.features) ? data.features : []).entries()) {
    const p = `features[${i}]`;
    if (!fields(f, ['id', 'titulo', 'criterios', 'verificacion', 'estado', 'pasa', 'autor', 'revisor', 'rama', 'pr', 'evidencia'], p)) continue;
    check(typeof f.id === 'string' && /^F-\d{3}$/.test(f.id) && !ids.has(f.id), `${p}.id`, 'F- y tres cifras, sin duplicados');
    ids.add(f.id);
    for (const key of ['titulo', 'verificacion']) check(nonempty(f[key]), `${p}.${key}`, 'debe ser texto no vacío');
    check(Array.isArray(f.criterios) && f.criterios.length > 0 && f.criterios.every(nonempty), `${p}.criterios`, 'lista no vacía de textos no vacíos');
    check(['pendiente', 'en_curso', 'en_revision', 'hecha', 'bloqueada'].includes(f.estado), `${p}.estado`, 'estado no admitido');
    check(typeof f.pasa === 'boolean', `${p}.pasa`, 'debe ser booleano');
    for (const key of ['autor', 'revisor']) check(['', 'agent-a', 'agent-b', 'human'].includes(f[key]), `${p}.${key}`, 'rol no admitido');
    check(!f.revisor || (nonempty(f.autor) && f.revisor !== f.autor), `${p}.revisor`, 'requiere autor y debe ser distinto de él');
    check(typeof f.rama === 'string', `${p}.rama`, 'debe ser texto');
    check(f.pr === null || positive(f.pr), `${p}.pr`, 'debe ser null o un número entero positivo');
    check(Array.isArray(f.evidencia) && f.evidencia.every(nonempty), `${p}.evidencia`, 'debe ser una lista de rutas o enlaces no vacíos');
    if (f.estado === 'hecha') check(f.pasa === true && nonempty(f.autor) && nonempty(f.revisor) && f.autor !== f.revisor,
      p, 'hecha exige pasa: true, autor y revisor distintos y no vacíos');
  }
  return errors;
}
function validated() {
  const data = load(), errors = validate(data);
  if (errors.length) fail(errors.join('\nERROR: '));
  return data;
}
function validar() {
  revisionState(validated());
  for (const file of ['workflow/SPEC.md', 'workflow/PROGRESO.md']) {
    try { if (!statSync(resolve(root, file)).isFile()) throw new Error(); }
    catch { fail(`Falta el archivo ${file}.`); }
  }
  console.log('Validación: correcta.');
}
function gates() {
  const { gates: config } = validated();
  if (process.env.WORKFLOW_GATES_ACTIVE === '1') fail('gates.check no puede invocar gates ni todo recursivamente.');
  console.log('Comprobaciones: ejecutando gates.check.');
  // Es código del proyecto, nunca ejecutar en un entorno con credenciales o datos de producción.
  const r = spawnSync(config.check, { cwd: root, shell: true, stdio: 'inherit',
    env: { ...process.env, WORKFLOW_GATES_ACTIVE: '1' } });
  if (r.error || r.status !== 0) fail('Comprobaciones: fallaron o fueron interrumpidas.');
  console.log('Comprobaciones: correctas.');
}
function baseCommit(base = process.env.WORKFLOW_BASE || 'main') {
  const sha = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
  return git('merge-base', sha, 'HEAD').trim();
}
const diffArgs = ['--no-ext-diff', '--no-textconv', '--no-color', '--no-renames'];
function ignoredSize(path) {
  return /(^|\/)(test|tests|__tests__|e2e|__snapshots__|node_modules|dist|build|coverage|generated|\.next)(\/|$)/i.test(path)
    || /\.(test|spec)\.[^/]+$|\.(generated|g)\.[^/]+$|\.min\.(js|css)$|\.map$|\.snap$/i.test(path)
    || /^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|go\.sum)$/i.test(basename(path));
}
function tamano(base, warning) {
  const data = validated();
  // --no-renames hace que cada registro NUL sea altas<TAB>bajas<TAB>ruta.
  const records = git('diff', ...diffArgs, '--numstat', '-z', baseCommit(base), '--').split('\0').filter(Boolean);
  let total = 0, binaries = 0;
  for (const record of records) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(record);
    if (!match) fail('No se pudo interpretar el tamaño del diff.');
    if (ignoredSize(match[3])) continue;
    if (match[1] === '-') { binaries++; continue; }
    total += Number(match[1]) + Number(match[2]);
  }
  console.log(`Tamaño: ${total} líneas; límite ${data.gates.max_lineas_pr}. Binarios sin cómputo: ${binaries}.`);
  if (total > data.gates.max_lineas_pr) {
    if (warning) console.log('AVISO: el cambio supera el límite de líneas.');
    else fail('El cambio supera el límite de líneas.');
  }
}
const knownSecrets = [
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bsk-(?:(?:proj|svcacct|ant-api\d+)-)?[A-Za-z0-9_-]{20,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[A-Za-z0-9_-]{35}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
];
function secretLine(line) {
  if (knownSecrets.some(re => re.test(line))) return true;
  const assignment = /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|client[_-]?secret|password|passwd)\b["']?\s*[:=]\s*(?:["']([^"'\r\n]{8,})["']|([^\s;,#"']{12,}))/ig;
  for (const match of line.matchAll(assignment)) {
    const value = match[1] ?? match[2];
    if (/^(?:example|placeholder|__placeholder__|change[-_]?me|dummy|test|fake|not[-_]a[-_]real[-_].*|your[-_].*|replace[-_].*|<.*>)$/i.test(value)) continue;
    if (/^(?:process\.env\b|os\.environ\b|os\.getenv\(|getenv\(|env\(|import\.meta\.env\b|\$|secrets\.|vars\.)/.test(value)) continue;
    // Sin comillas: solo valores literales, no llamadas ni expresiones de código.
    if (match[2] && !/^[A-Za-z0-9_+\/-]{12,}={0,2}$/.test(value)) continue;
    return true;
  }
  return false;
}
function secretos(staged) {
  // Exigir Git incluso sin cambios; --staged no depende de una rama base.
  git('rev-parse', '--show-toplevel');
  const hits = new Set();
  const add = (path, line) => hits.add(`${JSON.stringify(path)}:${line}`);
  const envFile = path => /^\.env(?:\..+)?$/.test(basename(path)) && !/^\.env\.(?:example|sample|template)$/.test(basename(path));
  const scan = (path, content, initial = 1) => {
    for (const [i, line] of content.split('\n').entries()) if (secretLine(line)) add(path, initial + i);
  };
  const scanDiff = range => {
    const paths = git('diff', ...diffArgs, '--name-only', '--diff-filter=ACMT', '-z', ...range, '--').split('\0').filter(Boolean);
    for (const path of paths) {
      if (envFile(path)) add(path, 1);
      const patch = git('diff', ...diffArgs, '--unified=0', ...range, '--', path);
      let line = 0, inHunk = false;
      for (const row of patch.split('\n')) {
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
        if (hunk) { line = Number(hunk[1]); inHunk = true; continue; }
        if (!inHunk) continue;
        if (row.startsWith('+')) { scan(path, row.slice(1), line); line++; }
        else if (row.startsWith(' ')) line++;
      }
    }
  };
  if (staged) scanDiff(['--cached']);
  else {
    scanDiff([baseCommit()]); scanDiff(['--cached']); scanDiff([]);
    for (const path of git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)) {
      if (envFile(path)) add(path, 1);
      const full = resolve(root, path);
      // No seguir enlaces simbólicos hacia datos ajenos al repositorio.
      if (!lstatSync(full).isFile()) continue;
      if (statSync(full).size > MAX_BUFFER) fail('Archivo nuevo demasiado grande para revisar secretos.');
      scan(path, readFileSync(full, 'utf8'));
    }
  }
  if (hits.size) {
    console.log('Secretos: posibles credenciales; solo se muestran archivo y línea.');
    // También censurar patrones conocidos en nombres de archivo controlados por el diff.
    for (let hit of [...hits].sort()) {
      for (const re of knownSecrets) hit = hit.replace(new RegExp(re.source, 'g'), '[REDACTADO]');
      console.log(hit);
    }
    fail('Revisión de secretos fallida.');
  }
  console.log('Secretos: sin hallazgos en el diff revisado.');
}
function revisionState(data) {
  const path = 'workflow/metodologia.json';
  if (!existsSync(resolve(root, path))) {
    if (data.contrato === 1) fail(`Falta ${path}. Copia la plantilla sin inventar revisiones previas.`);
    return null;
  }
  let record;
  try { record = JSON.parse(read(path)); } catch { fail(`${path}: JSON inválido.`); }
  const bad = () => fail(`${path}: registro inválido; revisa la sección 8 del contrato.`);
  const keys = (obj, names) => object(obj) && Object.keys(obj).length === names.length && names.every(k => Object.hasOwn(obj, k));
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const list = value => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
  if (!keys(record, ['version', 'incidentes', 'revisiones']) || record.version !== 1
    || !Array.isArray(record.incidentes) || !Array.isArray(record.revisiones)) bad();
  const types = ['fallo_produccion', 'exposicion_datos', 'fallo_repetido', 'regla_bloqueante', 'manual'];
  const incidents = new Map(), done = new Set(data.features.filter(f => f.estado === 'hecha').map(f => f.id));
  for (const i of record.incidentes) {
    if (!keys(i, ['id', 'fecha', 'tipo', 'evidencia']) || !/^I-\d{3}$/.test(i.id)
      || incidents.has(i.id) || !date(i.fecha) || !types.includes(i.tipo)
      || !list(i.evidencia) || !i.evidencia.length) bad();
    incidents.set(i.id, i);
  }
  const reviewed = new Set(), addressed = new Set();
  let previous = '';
  for (const r of record.revisiones) {
    if (!keys(r, ['fecha', 'features', 'incidentes', 'resultado', 'evidencia']) || !date(r.fecha)
      || r.fecha < previous || !list(r.features) || !r.features.every(id => done.has(id))
      || !list(r.incidentes) || !r.incidentes.every(id => incidents.has(id) && incidents.get(id).fecha <= r.fecha)
      || !['sin_cambios', 'cambios_propuestos'].includes(r.resultado)
      || !list(r.evidencia) || !r.evidencia.length) bad();
    previous = r.fecha;
    r.features.forEach(id => reviewed.add(id)); r.incidentes.forEach(id => addressed.add(id));
  }
  return { pending: [...done].filter(id => !reviewed.has(id)),
    incidents: [...incidents.values()].filter(i => !addressed.has(i.id)), last: previous };
}
function metodologia(strict = true) {
  const state = revisionState(validated());
  if (!state) { console.log('Metodología: seguimiento sin inicializar (contrato anterior).'); return; }
  const due = state.pending.length >= 3 || state.incidents.length > 0;
  console.log(`Metodología: ${due ? 'REVISIÓN PENDIENTE' : 'al día'}. Última revisión: ${state.last || 'ninguna'}.`);
  console.log(`Entregas desde la revisión: ${state.pending.length}/3${state.pending.length ? ' · ' + state.pending.join(', ') : ''}.`);
  for (const incident of state.incidents) console.log(`Incidente pendiente: ${incident.id} · ${incident.tipo}.`);
  if (due) {
    console.log('Revisa LECCIONES y evidencia; registra la evaluación aunque no proponga cambios.');
    if (strict) fail('Corresponde revisar la metodología.');
  }
}
function estado() {
  const data = validated();
  console.log(`Estado de ${data.proyecto}:`);
  const current = data.features.filter(f => ['en_curso', 'en_revision'].includes(f.estado));
  for (const f of current) console.log(`En marcha: ${f.id} · ${f.titulo} · ${f.estado} · ${f.autor || 'sin autor'} · ${f.rama || 'sin rama'}`);
  if (!current.length) console.log('Sin funciones en curso o revisión.');
  const next = data.features.find(f => f.estado === 'pendiente');
  console.log(next ? `Siguiente pendiente: ${next.id} · ${next.titulo}` : 'Sin funciones pendientes.');
  const entries = read('workflow/PROGRESO.md').split(/^## /m).slice(1).slice(-2);
  console.log(entries.length ? 'Últimas entradas:\n' + entries.map(x => '## ' + x.trim()).join('\n\n') : 'Sin entradas de progreso.');
  metodologia(false);
}
function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) fail('Se requiere Node 22 o posterior.');
  const [command, ...args] = process.argv.slice(2);
  const allowed = ['validar', 'gates', 'tamano', 'secretos', 'estado', 'todo', 'metodologia'];
  if (!allowed.includes(command)) fail('Uso: node workflow/workflow.mjs validar|gates|tamano [base] [--aviso]|secretos [--staged]|estado|metodologia|todo');
  if (command === 'tamano') {
    if (args.filter(x => x === '--aviso').length > 1 || args.filter(x => x !== '--aviso').length > 1
      || args.some(x => x.startsWith('-') && x !== '--aviso')) fail('Opciones de tamaño no válidas.');
    tamano(args.find(x => x !== '--aviso'), args.includes('--aviso')); return;
  }
  if (command === 'secretos') {
    if (args.length > 1 || args.some(x => x !== '--staged')) fail('Opciones de secretos no válidas.');
    secretos(args.includes('--staged')); return;
  }
  if (args.length) fail('Esta orden no admite argumentos.');
  if (command === 'todo') { validar(); secretos(false); gates(); tamano(undefined, true); metodologia(false); }
  else ({ validar, gates, estado, metodologia })[command]();
}
try { main(); process.exitCode = 0; }
catch (error) {
  // Nunca imprimir stdout/stderr de Git, JSON defectuoso o el contenido de un secreto.
  console.error(`ERROR: ${error instanceof Error && !error.code ? error.message : 'No se pudo completar la comprobación.'}`);
  process.exitCode = 1;
}
