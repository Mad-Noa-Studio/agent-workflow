# Reglas para agentes en este proyecto

Este proyecto sigue la Workflow (metodología y contrato 1). Lee primero `workflow/PROGRESO.md` (últimas
entradas) y `workflow/features.json` para saber dónde quedó el trabajo.

## Cómo se trabaja aquí

- Una función de `workflow/features.json` por vez, en su rama `<autor>/F-<id>-<descripcion>`.
- Test primero; terminado = `node workflow/workflow.mjs todo` pasa y la función se verificó en la app real.
- Al terminar cada sesión, añade una entrada a `workflow/PROGRESO.md`.
- Solo cambias en `features.json` los campos `estado`, `pasa`, `autor`, `revisor`, `rama`, `pr` y `evidencia`.
  Cambiar criterios es cambiar la especificación: pregúntale a la persona responsable.
- Quien escribe una función no la revisa. La revisión sigue el formato de la sección 5 del contrato.
- Usa la base y rama pedidas por la persona responsable; exporta `WORKFLOW_BASE` con la base del PR. `main` es solo el defecto.
- `revisor` se rellena al publicar la revisión, no al pedirla. Al cambiar código o fallar una verificación,
  invalida `pasa` y la revisión previa. `hecha` requiere además integración confirmada por la persona responsable.
- Nunca debilites, saltes ni borres tests, ni apagues reglas de lint o tipos, para que pase algo.

## Lo que no se hace nunca

- Secretos o datos de clientes en el código, los tests, los commits o el README.
- Merge o push a `main`, o desplegar, sin pedido explícito de la persona responsable en ese momento.
- Decir que algo funciona con un servicio real si solo se probó contra una simulación.

## Este proyecto

- Qué es: (una frase)
- Cómo se arranca: (comando)
- Comprobaciones: ver `gates.check` en `workflow/features.json`
- Particularidades: (lo que un agente nuevo tiene que saber)

Al comenzar ejecuta `node workflow/workflow.mjs estado`: incluye el checkpoint de metodología. Al descubrir
un incidente del proceso registra tipo y evidencia redactada en `workflow/metodologia.json`; no esperes
al cierre para registrarlo. Al terminar ejecuta `node workflow/workflow.mjs metodologia`; si avisa, sigue
el procedimiento de evaluación de la sección 8 del contrato. Nunca inventes una revisión cumplida.
