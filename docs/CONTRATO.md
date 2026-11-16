# Contrato del paquete · versión 1

Este paquete autónomo usa un contrato inicial propio. Cambiar formatos exige actualizar CLI,
plantillas, instrucciones y tests juntos. No hay migración implícita desde otros sistemas.

## 1. Archivos

AGENTS.md: instrucciones del proyecto. workflow/SPEC.md: alcance y aprobación. workflow/features.json:
funciones y estado. workflow/PROGRESO.md: bitácora solo al final. workflow/DECISIONES.md: contexto,
decisión y alternativas. workflow/LECCIONES.md: fallos y prevención. workflow/metodologia.json:
checkpoint. workflow/workflow.mjs: CLI. .github/workflows/workflow.yml: CI de PR.

## 2. Funciones

```json
{
  "contrato": 1,
  "proyecto": "example-project",
  "gates": {"check":"npm test", "max_rondas_ci":2, "max_lineas_pr":400},
  "features": [{
    "id":"F-001", "titulo":"Validar un formulario", "criterios":["Una entrada inválida muestra un error"],
    "verificacion":"Test de entrada inválida y prueba real", "estado":"pendiente", "pasa":false,
    "autor":"", "revisor":"", "rama":"", "pr":null, "evidencia":[]
  }]
}
```

Campos del ejemplo obligatorios y sin extras. proyecto/titulo/verificacion: textos no vacíos;
criterios: lista no vacía de textos no vacíos. Features puede estar vacía al iniciar. Id F- y tres
cifras, único y no reutilizado. Estados pendiente/en_curso/en_revision/hecha/bloqueada. pasa booleano.
Autor y revisor: vacío, agent-a, agent-b o human; revisor no vacío exige autor no vacío y distinto.
Rama texto; pr null o entero positivo; evidencia lista de rutas/enlaces no vacíos, puede estar vacía.
Hecha exige pasa true, autor y revisor distintos/no vacíos e integración confirmada por la persona.

Agentes solo modifican estado, pasa, autor, revisor, rama, pr y evidencia. Añadir o cambiar criterios,
título, verificación o prioridad es cambiar alcance y necesita aprobación. El esquema no verifica
aprobaciones, evidencia real, integración ni reutilización histórica de ids.
Gates.check no vacío; max_rondas_ci es 1 o 2; max_lineas_pr entero positivo. Rondas anotadas en PROGRESO.

## 3. Bitácora

Añadir al final una entrada por sesión: fecha, rol, función, hecho, verificado, pendiente y siguiente.
Guardar solo evidencia redactada. No reescribir resultados fallidos como éxitos.

## 4. Decisiones

Cada decisión lleva id, fecha, contexto, decisión, alternativas descartadas y rol responsable.
Decisiones de agentes deben ser reversibles y dentro del alcance autorizado.

## 5. Revisión

```text
### Revisión de agent-b · PR #1 · F-001
Veredicto: APROBADO | CAMBIOS
1. [bloqueante|importante|menor] archivo:línea — fallo
   Escenario: entrada concreta → resultado incorrecto
   Propuesta: corrección
Comprobado: tests, ejecución y lectura realizadas; límites de cobertura.
```

Bloqueante rompe criterios, pierde datos, expone información o falsea comportamiento; no integrar.
Importante requiere corrección salvo decisión explícita de la persona. Menor no bloquea.
Sin escenario concreto no hay hallazgo. Si se acepta totalmente una respuesta, basta «ok».
Sin publicación autorizada, guardar el informe localmente en workflow/revisiones/.

## 6. Herramienta

Node >=22, Git e historial suficiente, sin dependencias. Ejecutar desde raíz Git. Mensajes en español,
0 correcto y 1 fallo. Las órdenes de consulta no modifican archivos.

| Orden | Resultado |
|---|---|
| validar | Tipos/campos/ids/reglas de hecha; SPEC y PROGRESO existentes; checkpoint válido. |
| gates | Ejecuta gates.check como shell del proyecto. Falla con salida no cero o señal; evita recursión. |
| tamano [base] [--aviso] | Altas+bajas desde merge-base hasta árbol de trabajo; límite o solo aviso. |
| secretos [--staged] | Patrones conocidos, claves privadas, asignaciones literales y archivos .env en diff. |
| estado | En curso/revisión, primera pendiente, dos últimas entradas y aviso del método. |
| metodologia | 1 si toca revisión; 0 si al día; no escribe una evaluación. |
| todo | validar, secretos, gates, tamano --aviso y aviso de metodología, en orden. |

Prioridad de base: argumento de tamaño, WORKFLOW_BASE, main. Secretos usa variable o main.
Base inválida y errores de lectura/Git fallan incluso en modo aviso. Diff desde merge-base(base,HEAD),
commits de la rama, índice y árbol. Tamaño no incluye archivos nuevos hasta añadir al índice. Renombres
se cuentan baja+alta; binarios informados sin líneas. Excluye test/tests/__tests__/e2e/__snapshots__,
node_modules/dist/build/coverage/generated/.next, *.test.*, *.spec.*, *.generated.*, *.g.*, *.min.js,
*.min.css, *.map, *.snap y lockfiles habituales de gestores (incluido go.sum). Sin exclusiones del usuario.

Secretos sin opciones revisa añadidos contra base, índice, árbol y nuevos no ignorados; --staged
solo índice y no requiere base. No omite tests/ejemplos ni sigue symlinks nuevos. .env y .env.* fallan,
excepto .env.example/.env.sample/.env.template cuyo contenido se revisa. Solo muestra archivo/línea,
nunca el secreto. No revisa historial completo, binarios/cifrado ni ignorados. Es heurístico y no prueba
ausencia de secretos. El comando gates.check es código del proyecto y su salida debe redactarse.
Todo detiene el primer fallo; exceso de tamaño o revisión de método pendiente solo avisan. Datos
inválidos de checkpoint fallan. No usar credenciales de producción al ejecutar código de un PR.

CI usa pull_request, runner hospedado, contents:read, head SHA, historial completo, base SHA del evento,
credenciales no persistidas y ningún secreto configurado. Añadir instalación reproducible de las
dependencias propias. Nunca pull_request_target. El token de checkout no se entrega a gates.

## 7. Ramas

Rama por función agent-a/F-001-descripcion o agent-b/F-001-descripcion; título del PR comienza con id.
Prevalece la base/rama indicada por la persona responsable. No integrar, desplegar ni alterar
protecciones sin autorización. Este paquete usa development; consumidores pueden elegir otra base.

## 8. Checkpoint

Obligatorio workflow/metodologia.json: {"version":1,"incidentes":[],"revisiones":[]}.
Incidente: id único I- y tres cifras, fecha ISO válida, tipo fallo_produccion/exposicion_datos/
fallo_repetido/regla_bloqueante/manual y evidencia lista no vacía. Revisión: fecha, features (ids hechos),
incidentes (ids existentes anteriores o de ese día), resultado sin_cambios/cambios_propuestos y evidencia
no vacía. Todos los campos obligatorios sin extras, listas sin duplicados, revisiones en orden temporal.

Cuenta ids hechos no incluidos en revisiones. Tres o más, o cualquier incidente sin evaluar, disparan
aviso. Sin cambios es una conclusión válida. No borrar historial ni inventar evaluaciones para silenciar.
Estado es por proyecto; no hay monitor de producción ni contador global. Revisar también al cerrar.
La validación de evidencias solo comprueba formato, no autenticidad ni vigencia.

## 9. Adaptadores opcionales de aviso

Script de sesión/prompt solo GET con gh, PRs abiertos no borrador del mismo repo, ramas agent-b/,
CI workflow.yml más reciente del SHA exacto. Máximo diez PRs y cien runs por SHA; timeout ~7 segundos,
pausa 60 s entre prompts. Caché por repo/sesión/id/SHA en carpeta de usuario. Otra sesión puede repetir
un aviso; no certifica que falte revisión. El revisor comprueba estado actual antes de actuar.
No ejecuta código de PR ni despierta clientes cerrados. No envía prompts ni publica comentarios.
El adaptador SessionStart consulta estado/metodología. Son adaptadores optativos para clientes que
implementen hookSpecificOutput/SessionStart/UserPromptSubmit, no un protocolo universal.

### Endurecimiento compatible del paquete

Los adaptadores opcionales conservan el protocolo; SessionStart usa el CLI de su instalación de
confianza. Avisos CI escriben caché privada mediante temporal único y descartan estructuras inválidas.
Acciones fijadas por SHA y guía de instalación segura; no cambia el formato del contrato 1.
