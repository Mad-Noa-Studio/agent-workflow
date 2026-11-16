# Agent Workflow

Metodología y herramientas neutrales para desarrollar con agentes y revisión independiente.
Roles: persona responsable (`human`), agente A (`agent-a`) y agente B (`agent-b`). Asigna cada
rol a una herramienta o persona antes de trabajar. Los nombres de roles no acreditan quién revisó.

## Qué incluye

- Seis puertas: necesidad, especificación, comprobaciones, uso real, revisión e integración.
- Estado compartido en archivos; instrucciones de especificar, construir, verificar, revisar y cerrar.
- CLI Node >=22 sin dependencias: validar, gates, tamano, secretos, estado, metodologia y todo.
- CI de PR con permiso de lectura, sin secretos y base real del PR.
- Revisión de método tras tres entregas sin evaluar o incidentes registrados.
- Adaptadores opcionales de hooks de sesión/prompt, con aviso de CI mediante gh autenticado.

Lee [metodología](docs/METODOLOGIA.md) y [contrato](docs/CONTRATO.md).

## Usarlo en un proyecto

Desde la raíz del proyecto destino (Git y Python 3 disponibles):

```sh
python3 /ruta/agent-workflow/scripts/iniciar.py /ruta/agent-workflow
```

No sobrescribe archivos. Completa AGENTS.md, workflow/SPEC.md y workflow/features.json: nombre genérico
para el proyecto y un gates.check real con tests/tipos/lint/build aplicables. No uses el comando de
prueba de esta plantilla en un proyecto con otro stack. Añade instalación reproducible de dependencias
al workflow si hace falta. Mantén credenciales y datos reales en ejecución, fuera de Git.

```sh
node workflow/workflow.mjs estado
node workflow/workflow.mjs todo
node workflow/workflow.mjs tamano development
node workflow/workflow.mjs metodologia
```

Usa WORKFLOW_BASE con la base acordada si difiere de main. CI la configura con el SHA real.
El CLI valida estructura, no aprobaciones ni la veracidad de evidencia. El escáner de secretos es
heurístico y revisa diff/snapshots; no certifica historial completo ni datos binarios.

## Instrucciones reutilizables

Las cinco skills están en `.agents/skills/workflow-*`. Los clientes compatibles las descubren al trabajar aquí.
Para otro proyecto enlaza cada carpeta dentro de su `.agents/skills/`, conservando el checkout origen
para resolver las referencias a docs. También puedes leer cada SKILL.md como prompt en otro agente.
Son instrucciones compatibles con roles genéricos; no inician otro modelo automáticamente.

## Aviso opcional de CI

`scripts/instalar_aviso_ci.py /ruta/proyecto` instala hooks locales SessionStart/UserPromptSubmit en
un cliente que soporte ese protocolo y settings.local.json. Preserva permisos y hooks existentes.
Requiere gh autenticado, origin GitHub y ramas agent-b/. Solo GET, no envía mensajes ni revisa código.
Se entrega al iniciar/retomar o recibir un prompt; no despierta sesiones cerradas. No instalarlo si
el cliente no soporta ese esquema. Eliminar sus entradas locales desactiva el aviso.
Estado y script se guardan en ~/.cache/agent-workflow y ~/.local/share/agent-workflow.

## Mantener este paquete

```sh
node --test test/*.test.mjs
```

Tests con Git temporal y datos ficticios, sin servicios de negocio. El aviso se prueba con respuestas
simuladas. No se incluyen datos, bitácoras ni historias de ningún proyecto externo. Este repositorio
usa development como rama base. Revisión independiente pendiente hasta que el otro rol la emita.

## Licencia y contribuciones

[MIT](LICENSE): permite usar, modificar y distribuir conservando sus avisos. Ver
[contribuciones](CONTRIBUTING.md), [seguridad](SECURITY.md) y
[revisión para publicación](docs/REVISION_PUBLICACION.md). El contenido es neutral; GitHub sigue
mostrando la organización anfitriona y la actividad de las cuentas de plataforma.
