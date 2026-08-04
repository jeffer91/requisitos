# Centro de Datos y sincronización por dominio

## Objetivo

Centro de Datos mantiene la estructura oficial, la validación, los identificadores, el análisis de diferencias, los conflictos y el acceso seguro a Firebase. Las pantallas operativas únicamente solicitan acciones dentro del dominio que les corresponde.

## Flujo común

```text
Pantalla operativa
        ↓
BDLocal y cambios_pendientes
        ↓
RequisitosFirebaseOperationCenter
        ↓
Mapeadores + validadores + control de versión/hash + cuota
        ↓
Tablas oficiales de Firebase
```

Ninguna pantalla operativa escribe directamente en Firestore.

## Responsabilidades

### Carga

Puede analizar y subir solamente:

- `estudiantes`
- `matriculas`
- `requisitos`
- `importaciones`

El usuario debe ejecutar primero **Analizar diferencias**. El análisis clasifica el lote en nuevos, modificados, ya iguales y conflictos. Después se habilita **Subir diferencias**.

Carga no puede procesar `notas`.

### Defensas

Puede analizar y subir solamente:

- `notas`

Incluye N-ART, N-DEF, N-FIN y estado de evaluación. Defensas no puede modificar estudiantes, matrículas, requisitos ni Telegram.

### Stats

No sube información. En la sección Telegram, la acción Actualizar:

- consulta los documentos actualizados de `estudiantes`;
- extrae únicamente `telegramUser` y `telegramChatId`;
- conserva nombres, correos, carrera, matrícula, requisitos y notas locales;
- no crea cambios pendientes de subida.

Firestore entrega documentos completos, pero el Centro de Operaciones aplica localmente solo los campos Telegram.

### Centro de Datos

Administra y supervisa:

- esquema de tablas;
- IDs locales y remotos;
- validación de documentos;
- reconstrucción de documentos completos;
- comparación por `dataHash`, `version` y `updatedAt`;
- conflictos;
- cuotas;
- cola de cambios;
- historial y diagnóstico.

## Tablas oficiales

| Tabla | Propietario operativo |
|---|---|
| `estudiantes` | Carga; Stats solo lee Telegram |
| `matriculas` | Carga |
| `requisitos` | Carga |
| `notas` | Defensas |
| `periodos` | Centro de Datos |
| `carreras` | Centro de Datos |
| `historial` | Automático / Centro de Datos |
| `importaciones` | Carga |

## Reglas de seguridad

1. Cada operación requiere un período seleccionado.
2. Cada subida requiere análisis previo.
3. Si la cola cambia después del análisis, la subida se bloquea y exige analizar nuevamente.
4. Cada ejecución procesa como máximo 25 cambios.
5. Los documentos con el mismo hash se confirman sin generar una escritura innecesaria.
6. Los conflictos permanecen pendientes.
7. Carga nunca envía calificaciones.
8. Defensas nunca envía información general del estudiante.
9. Stats nunca reemplaza el documento completo del estudiante.
