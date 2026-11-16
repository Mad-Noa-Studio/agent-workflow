#!/usr/bin/env python3
"""Sets up the Workflow in the current project: copies the templates without overwriting anything.

Usage: iniciar.py <package_root>
"""
import os
import shutil
import sys

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tpl = os.path.join(root, "templates")
plan = {
    "AGENTS.md": "AGENTS.md",
    "SPEC.md": os.path.join("workflow", "SPEC.md"),
    "features.json": os.path.join("workflow", "features.json"),
    "PROGRESO.md": os.path.join("workflow", "PROGRESO.md"),
    "DECISIONES.md": os.path.join("workflow", "DECISIONES.md"),
    "LECCIONES.md": os.path.join("workflow", "LECCIONES.md"),
    "metodologia.json": os.path.join("workflow", "metodologia.json"),
}
os.makedirs("workflow", exist_ok=True)
created, kept = [], []
for src, dst in plan.items():
    if os.path.exists(dst):
        kept.append(dst)
        continue
    shutil.copyfile(os.path.join(tpl, src), dst)
    created.append(dst)
# Copiar herramienta y CI del paquete sin sobrescribir archivos existentes.
tools = os.path.join(root, "workflow")
for src, dst in (("workflow.mjs", os.path.join("workflow", "workflow.mjs")), ("workflow.yml", os.path.join(".github", "workflows", "workflow.yml"))):
    s = os.path.join(root, "templates", src) if src.endswith(".yml") else os.path.join(tools, src)
    if os.path.exists(dst):
        kept.append(dst)
    elif os.path.exists(s):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(s, dst)
        created.append(dst)
    else:
        print(f"Aviso: falta {src} en el paquete. Sin él, las comprobaciones se corren a mano.")
print("Creados: " + (", ".join(created) or "ninguno"))
print("Ya existían (no se tocaron): " + (", ".join(kept) or "ninguno"))
