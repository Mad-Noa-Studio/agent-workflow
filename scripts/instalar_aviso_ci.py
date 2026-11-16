#!/usr/bin/env python3
"""Instala solo el aviso en un proyecto, preservando otros hooks y permisos."""
import json
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import os


def atomic_write(path, content):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as output:
        temporary = Path(output.name)
        output.write(content)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def install(project):
    project = Path(project).resolve()
    subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=project, check=True, capture_output=True)
    source = Path(__file__).with_name('aviso_ci.py')
    target = Path.home() / '.local/share/agent-workflow/aviso_ci.py'
    settings = project / '.claude/settings.local.json'
    if settings.is_symlink() or settings.parent.is_symlink() or target.is_symlink() or target.parent.is_symlink():
        raise ValueError('No se instalan hooks sobre enlaces simbólicos de configuración.')
    data = json.loads(settings.read_text()) if settings.exists() else {}
    if not isinstance(data, dict) or not isinstance(data.get('hooks', {}), dict):
        raise ValueError('Configuración inválida; no se modificó.')
    hooks = data.setdefault('hooks', {})
    cmd = f'python3 {shlex.quote(str(target))}'
    for kind in ['SessionStart', 'UserPromptSubmit']:
        entries = hooks.setdefault(kind, [])
        if (not isinstance(entries, list) or not all(isinstance(entry, dict)
                and isinstance(entry.get('hooks', []), list)
                and all(isinstance(h, dict) for h in entry.get('hooks', [])) for entry in entries)):
            raise ValueError('Hooks inválidos; no se modificó la configuración.')
        if not any(h.get('command') == cmd for entry in entries for h in entry.get('hooks', [])):
            entries.append({'hooks': [{'type': 'command', 'command': cmd, 'timeout': 12}]})
    target.parent.mkdir(parents=True, exist_ok=True)
    settings.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(target, source.read_text())
    atomic_write(settings, json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    # La configuración es local; no agregarla por accidente al PR.
    exclude = Path(subprocess.check_output(['git', 'rev-parse', '--git-path', 'info/exclude'], cwd=project, text=True).strip())
    if not exclude.is_absolute(): exclude = project / exclude
    existing = exclude.read_text() if exclude.exists() else ''
    if '/.claude/settings.local.json' not in existing.splitlines():
        exclude.parent.mkdir(parents=True, exist_ok=True)
        exclude.write_text(existing.rstrip() + '\n/.claude/settings.local.json\n')
    print('Aviso CI instalado en el proyecto. Reinicia o inicia una sesión de agente A para cargar hooks.')


if __name__ == '__main__':
    install(sys.argv[1] if len(sys.argv) > 1 else Path.cwd())
