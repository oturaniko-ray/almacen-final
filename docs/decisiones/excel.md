\# Decisión Técnica: Migración de librería Excel



\## Problema

El paquete `xlsx` en npm tiene dos vulnerabilidades de alta gravedad:

\- CVE-2023-30533 (Prototype Pollution)

\- CVE-2024-22363 (ReDoS)



\## Impacto en nuestro sistema

\- Solo usamos `xlsx` para \*\*exportar datos\*\* (no para leer archivos subidos)

\- Según los avisos oficiales, estos flujos \*\*no están afectados\*\* por las vulnerabilidades



\## Solución adoptada

\- Migramos a `@e965/xlsx` (fork mantenido con las correcciones aplicadas)

\- Encapsulamos toda la lógica de Excel en `lib/excel/excelService.ts`

\- Esto nos permite cambiar de librería en el futuro modificando solo un archivo



\## Beneficios

\- ✅ Vulnerabilidades resueltas

\- ✅ Misma API (cambio mínimo)

\- ✅ Mantenimiento activo

\- ✅ Arquitectura preparada para futuros cambios

