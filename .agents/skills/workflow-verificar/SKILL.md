---
name: workflow-verificar
description: Verificar trabajo bajo el contrato compartido de desarrollo con agentes. Úsala para esta fase del flujo, con estado y evidencia en el proyecto destino.
---

# Contexto compartido

Lee ../../../docs/METODOLOGIA.md y ../../../docs/CONTRATO.md desde el directorio físico
.agents/skills/workflow-<operacion>/. Trabaja sobre el proyecto destino y sus AGENTS/estado/progreso.
Conserva evidencia, decisiones y límites. No inventes aprobación, asignación de roles ni integración.

Comprueba criterios con CLI/API/interfaz real y un borde pertinente. Guarda evidencia redactada. Falta de navegador no acredita interfaz. Si falla, pasa false, revisor vacío y en_curso/bloqueada; conserva evidencia. Si cumple, pasa true y en_revision. Detén solo procesos propios; declara simulaciones y pendientes.
