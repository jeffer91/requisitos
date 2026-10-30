# Numeración única de actas de titulación

## Formato
`AAAA-CCCC-MM-NNNN`: año y mes de **emisión académica** (último día laborable del segundo mes posterior al cierre del período), cuatro primeros dígitos de la cédula y consecutivo **global para toda la institución en el mes**. El consecutivo no se reinicia por carrera, modalidad ni prefijo de cédula.

Ejemplo para el período octubre 2025 – marzo 2026: `2026-1313-05-0001`, fecha de emisión viernes **29 de mayo de 2026**. Para abril – septiembre 2026 la emisión será el lunes **30 de noviembre de 2026**.

## Garantías de diseño
- Un registro central por **período + cédula** en `actas_registro`.
- Un contador mensual global en `actas_contadores`; toda emisión avanza el contador con una transacción Firestore.
- Una reserva inmutable por número en `actas_numeros`.
- La misma identidad obtiene su número anterior al repetir la operación, incluso desde otro equipo.
- Si cambia la modalidad de una acta ya registrada, se bloquea una segunda emisión: requiere conciliación institucional.
- No existe generación de números oficiales en `localStorage`; si no hay conexión, se descarga un **BORRADOR SIN NÚMERO OFICIAL**.
- Solo se asignan números oficiales a actas con todos los controles académicos verificados **y cuando haya llegado la fecha de emisión programada**. Los demás borradores siguen descargándose sin numeración.
- El registro del número es explícito: Descargar PDF o ZIP jamás genera números nuevos.
- En la portada, «Unidad de Titulación y Eficiencia Terminal» queda sin negrita y «Acta de Titulación por Examen Complexivo» lleva mayúsculas iniciales, conservando 23 pt.
- El número se imprime **en el cuerpo de la segunda página** y en el nombre del PDF. La portada y el código documental existente permanecen intactos.
- Los ZIP preservan los números registrados y explicitan los borradores sin número en su CSV.

## Activación pendiente en Firebase
El código de la aplicación y `firestore.rules` deben estar desplegados en el **mismo proyecto Firebase**. Un commit en GitHub no publica automáticamente las reglas Firestore.

El archivo `firebase.json` contiene la ruta de reglas: `firestore.rules`. Antes de utilizar números oficiales:
1. Revisar la seguridad: el proyecto todavía admite operaciones públicas en otras colecciones y **no implementa Firebase Authentication**. Una institución debe configurar autenticación y permisos de emisión antes de producción.
2. Desplegar las reglas con una cuenta de administrador del proyecto mediante `firebase deploy --only firestore:rules --project utet-4387a` después de auditar el cambio.
3. Verificar en dos equipos una emisión simultánea y el reuso del número tras recargar; comprobar permisos de lectura/escritura de las tres colecciones.
4. Conciliar actas históricas ya legalizadas y cualquier numeración anterior antes de declarar el libro histórico completo. No renumerar automáticamente números legales anteriores.

## Advertencia de operación
El sistema protege la **nueva numeración central** contra colisiones por concurrencia y reutilización indebida dentro del flujo de aplicación. No puede garantizar que no existan **duplicados históricos** fuera de estas colecciones sin una auditoría inicial. El año y el mes del número provienen de la fecha de emisión calculada según el período, no del reloj del equipo. El registro de auditoría conserva por separado la fecha real de asignación; la comprobación de si ya llegó el día programado usa America/Guayaquil. Los calendarios nacionales de 2026 y 2027 están codificados; los años posteriores requieren revisión de feriados oficiales/locales antes de numerar.

Las transacciones de numeración son una operación explícita separada de la sincronización manual de los datos académicos.
