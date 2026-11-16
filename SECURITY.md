# Seguridad

Este paquete ejecuta comandos definidos por el proyecto en gates.check. Lee ese comando antes de
ejecutarlo: pasar la validación de formato no lo hace seguro. Usa un entorno de prueba aislado,
sin credenciales de producción ni archivos privados, para evaluar contribuciones no confiables.

Los hooks son optativos y solo se habilitan en proyectos de confianza. El aviso de CI consulta
GitHub mediante gh, con su autenticación existente. No guarda tokens ni envía archivos o prompts.
Los adaptadores instalados deben proceder de un checkout estable de confianza, separado de aquel
en el que se inspeccionan PRs. No reinstales hooks desde una contribución sin revisar su código.
El hook de sesión ejecuta el CLI del paquete donde reside, nunca el CLI del proyecto destino.

La detección de secretos es heurística y analiza diff/snapshots: no revisa todo el historial,
archivos ignorados ni contenido binario/cifrado. Si se expone una credencial, revócala; quitarla
del último commit no retira copias ni forks. No incorporar datos reales a tests o evidencia.

Para reportar una vulnerabilidad usa el reporte privado de la pestaña Security si está habilitado.
Si no está disponible, solicita un canal privado al mantenedor sin publicar detalles sensibles.
Nunca adjuntes credenciales, datos de clientes ni una explotación con información real en un issue.

No hay telemetría ni envío de resultados. Node y Python usan archivos locales; los adaptadores
opcionales consultan GitHub y las acciones de CI se descargan de sus repositorios oficiales.
No se garantiza que ningún sistema falle: revisa permisos, aislamiento y cambios antes de adoptarlo.
