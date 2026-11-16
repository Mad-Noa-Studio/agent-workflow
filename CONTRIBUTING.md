# Contribuir

Lee AGENTS.md, docs/METODOLOGIA.md y docs/CONTRATO.md. Propón cambios pequeños contra development,
con problema, escenario, solución y verificaciones. No hagas cambios de protecciones ni auto-merge.

```sh
node --test test/*.test.mjs
WORKFLOW_BASE=development node workflow/workflow.mjs todo
```

Especifica Node/Python/SO probados y lo pendiente. Si modificas formatos, sincroniza CLI, contrato,
plantillas e instrucciones. Si modificas acciones, conserva SHA completo y cita la revisión oficial.

Usa datos ficticios y dominios reservados de ejemplo. No adjuntes configuración de tu equipo,
clientes, conversaciones, credenciales ni rutas personales en archivos, PRs o salidas de tests.
Los hallazgos de seguridad siguen SECURITY.md. Se aplica la licencia MIT del repositorio.
