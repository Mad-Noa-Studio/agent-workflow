#!/usr/bin/env python3
"""SessionStart hook: in a Workflow project (workflow/features.json exists), tell agente A where the work stopped.

Reads only local files of the project. Prints nothing (and does nothing) in other folders.
"""
import json
import os
import sys
import subprocess

FEATURES = os.path.join("workflow", "features.json")
PROGRESS = os.path.join("workflow", "PROGRESO.md")


def last_entries(path, n=2):
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return ""
    parts = text.split("\n## ")
    entries = parts[1:][-n:]
    return "\n".join("## " + e.strip() for e in entries)


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        event = {}
    # agente A puede invocar el hook desde otra carpeta. El cwd del evento es el proyecto.
    cwd = event.get("cwd") if isinstance(event, dict) else None
    if isinstance(cwd, str):
        try:
            os.chdir(cwd)
        except OSError:
            return
    if not os.path.exists(FEATURES):
        return
    try:
        data = json.load(open(FEATURES, encoding="utf-8"))
        features = data.get("features", []) if isinstance(data, dict) else None
        if not isinstance(features, list) or not all(isinstance(f, dict) for f in features):
            raise ValueError("estructura de funciones inválida")
    except (OSError, ValueError):
        msg = "Proyecto de la Workflow, pero workflow/features.json no se puede leer o tiene estructura inválida. Arreglarlo antes de seguir."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": msg}}, ensure_ascii=False))
        return
    count = lambda st: sum(1 for f in features if f.get("estado") == st)
    current = [f for f in features if f.get("estado") in ("en_curso", "en_revision")]
    nxt = next((f for f in features if f.get("estado") == "pendiente"), None)
    lines = [
        "Este proyecto sigue la Workflow (skill desarrollo-optimizado:metodologia).",
        f"Funciones: {count('hecha')} hechas, {len(current)} en curso o revisión, {count('pendiente')} pendientes, {count('bloqueada')} bloqueadas.",
    ]
    for f in current:
        lines.append(f"- En marcha: {f.get('id')} «{f.get('titulo')}» ({f.get('estado')}, autor {f.get('autor') or '?'}, rama {f.get('rama') or '-'})")
    if nxt:
        lines.append(f"- Siguiente pendiente: {nxt.get('id')} «{nxt.get('titulo')}»")
    progress = last_entries(PROGRESS)
    if progress:
        lines.append("Últimas entradas de workflow/PROGRESO.md:\n" + progress)
    if os.path.isfile(os.path.join('workflow', 'workflow.mjs')):
        try:
            result = subprocess.run(['node', 'workflow/workflow.mjs', 'metodologia'],
                                    capture_output=True, text=True, timeout=5)
            if result.stdout.strip():
                lines.append(result.stdout.strip())
            if result.returncode and not result.stdout.strip():
                lines.append('No se pudo comprobar la metodología; ejecutar node workflow/workflow.mjs metodologia.')
        except (OSError, subprocess.TimeoutExpired):
            lines.append('Comprobación de metodología no disponible; revisar workflow/metodologia.json.')
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(lines)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
