# Numeración única de actas de titulación

## Formato
`AAAA-CCCC-MM-NNNN`: año y mes del registro en Ecuador, cuatro primeros dígitos de la cédula y consecutivo **global para toda la institución en el mes**. El consecutivo no se reinicia por carrera, modalidad ni prefijo de cédula.

Ejemplo: `2026-1313-10-0001`.

## Garantías de diseño
- Un registro central por **período + cédula** en `actas_registro`.
- Un contador mensual global en `actas_contadores`; toda emisión avanza el contador con una transacción Firestore.
- Una reserva inmutable por número en `actas_numeros`.
- La misma identidad obtiene su número anterior al repetir la operación, incluso desde otro equipo.
- Si cambia la modalidad de una acta ya registrada, se bloquea una segunda emisión: requiere conciliación institucional.
- No existe generación de números oficiales en `localStorage`; si no hay conexión, se descarga un **BORRADOR SIN NÚMERO OFICIAL**.
- Solo se asignan números oficiales a actas con todos los controles académicos verificados. Los demás borradores siguen descargándose sin numeración.
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
El sistema protege la **nueva numeración central** contra colisiones por concurrencia y reutilización indebida dentro del flujo de aplicación. No puede garantizar que no existan **duplicados históricos** fuera de estas colecciones sin una auditoría inicial. El tiempo de año/mes proviene del reloj del cliente en la zona America/Guayaquil; requiere control de equipos o reloj confiable para la exactitud cronológica.

Las transacciones de numeración son una operación explícita separada de la sincronización manual de los datos académicos.
