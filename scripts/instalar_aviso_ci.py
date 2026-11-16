#!/usr/bin/env python3
"""Instala solo el aviso en un proyecto, preservando otros hooks y permisos."""
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys


def install(project):
    project = Path(project).resolve()
    subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=project, check=True, capture_output=True)
    source = Path(__file__).with_name('aviso_ci.py')
    target = Path.home() / '.local/share/agent-workflow/aviso_ci.py'
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    settings = project / '.claude/settings.local.json'
    settings.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(settings.read_text()) if settings.exists() else {}
    hooks = data.setdefault('hooks', {})
    cmd = f'python3 {shlex.quote(str(target))}'
    for kind in ['SessionStart', 'UserPromptSubmit']:
        entries = hooks.setdefault(kind, [])
        if not any(h.get('command') == cmd for entry in entries for h in entry.get('hooks', [])):
            entries.append({'hooks': [{'type': 'command', 'command': cmd, 'timeout': 12}]})
    settings.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
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
