import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('aviso CI: selección, deduplicación y fallos sin red', () => {
  const result = spawnSync('python3', [fileURLToPath(new URL('./test_aviso_ci.py', import.meta.url))], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
