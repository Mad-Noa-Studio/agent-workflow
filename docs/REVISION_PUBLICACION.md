# Revisión para publicación

Alcance: archivos versionados, metadatos y todos los blobs del historial, referencias remotas,
logs históricos de CI, artefactos, releases e issues existentes antes de publicar. Revisión técnica
del contenido distribuido; no certifica seguridad absoluta ni aprobaciones de un revisor independiente.

## Comprobaciones

- Historial creado de cero: sin commits ni identidades heredadas de otros proyectos.
- Autores/committers sintéticos y contacto example.invalid; sin direcciones personales reales.
- Solo documentación, código, plantillas vacías, instrucciones y tests de datos ficticios.
- Sin datos de negocios, clientes, conversaciones, bases de datos, adjuntos o credenciales.
- Comprobados secretos conocidos, claves privadas, asignaciones y referencias a identidades privadas
  en todos los blobs y logs históricos. No se guardan en el repo las expresiones privadas de auditoría.
- Sin releases, artefactos o issues históricos con contenido adicional.
- No se copiaron las skills comerciales ni sus archivos de terceros; el paquete no contiene ese código.
  Las acciones externas se referencian por SHA y no se redistribuyen como código del paquete.

## Correcciones realizadas

- Licencia MIT para permitir reutilización, con denominación genérica de contribuidores.
- Eliminadas referencias rotas a comandos o skills ausentes en el paquete neutral.
- SessionStart usa la herramienta de su paquete de confianza, sin ejecutar el CLI del PR destino.
- Instalación de hooks rechaza enlaces simbólicos de configuración y conserva archivos mediante
  reemplazo atómico privado; valida estructura antes de modificar.
- Caché de avisos escrita mediante archivo temporal único y privado; se valida caché malformada.
- Acciones oficiales fijadas por SHA; runner hospedado, permiso contents:read y credenciales no
  persistidas. Los PRs no reciben secretos configurados y no se usa pull_request_target.
- Documentados instalación, límites del escáner, manejo de reportes y contribuciones seguras.

## Límites de privacidad de la plataforma

La publicación revela el código y su historial, además de la organización anfitriona y los actores
de actividad de GitHub (push, CI, PR). Un autor de commit genérico no anonimiza esas acciones.
Los logs estándar pueden incluir nombres del repositorio, rutas del runner y metadatos de plataforma.
Ese alcance no equivale a publicar datos privados del negocio ni credenciales.

## Uso seguro

No instalar hooks automáticamente al clonar. gates.check ejecuta shell elegido por el proyecto y
requiere revisión y aislamiento; una etiqueta de CI verde no acredita una revisión de seguridad.
La herramienta no promete anonimato, ausencia total de vulnerabilidades ni resultados de negocio.
Ver SECURITY.md y el contrato para límites y verificaciones reproducibles.

## Resultado de verificación

Suite de 56 tests Node/Python correcta en Node 22 y 23. Cinco skills validadas y YAML comprobado.
Gitleaks 8.30.1 con redacción total, checksum oficial validado: cero hallazgos en historial completo.
Los checks del proyecto y auditoría de identidades se repiten sobre el estado de publicación.
Este informe no promete ausencia absoluta de vulnerabilidades ni sustituye revisar cada adopción.
