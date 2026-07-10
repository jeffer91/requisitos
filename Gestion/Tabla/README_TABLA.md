# Bloque 5 - Tabla

Pantalla principal para consultar estudiantes guardados en Base Local / BL2 y gestionar comunicación de requisitos por WhatsApp y Telegram.

## Objetivo de la pantalla

La pantalla Tabla sirve para revisar estudiantes cargados desde Excel, filtrar por período, división, matrícula, carrera, estado o búsqueda general, y contactar a los estudiantes según su situación de requisitos.

La pantalla no modifica el módulo Títulos y no reemplaza la Ficha. Su función es consulta, control visual y comunicación rápida.

## Flujo recomendado

1. Entrar a Requisito.
2. Crear o seleccionar período.
3. Cargar y analizar Excel.
4. Entrar a Tabla.
5. Filtrar por período, carrera, división, matrícula, estado o búsqueda.
6. Revisar estudiantes activos, retirados, pendientes, no cumplen o cumplen todo.
7. Contactar individualmente o preparar Telegram masivo.

## Archivos del módulo

```text
Requisitos/Gestion/Tabla/
  tabla.html              Pantalla principal y modales.
  tabla.css               Diseño de tabla, acciones, Telegram, masivo e historial.
  tabla.core.js           Lectura, normalización, filtros, paginación y datos Telegram.
  tabla.app.js            Renderizado, filtros, acciones compactas y conexión de botones.
  tabla.export.js         Exportación de tabla a CSV y JSON.
  tabla.message.js        Generador de mensajes formales.
  tabla.telegram-api.js   Cliente seguro para enviar por Telegram sin exponer token.
  tabla.telegram.js       Telegram individual.
  tabla.selection.js      Selección manual de estudiantes para masivo.
  tabla.mass.js           Telegram masivo.
  tabla.history.js        Historial local de envíos.
```

## Datos de Telegram

Tabla toma los datos de Telegram desde los mismos alias usados por Ficha.

Usuarios Telegram reconocidos:

```text
telegramUser
TelegramUser
telegramuser
usuarioTelegram
UsuarioTelegram
usuariotelegram
telegram
Telegram
```

Chat ID reconocidos:

```text
telegramChatId
TelegramChatId
telegramchatid
chatIdTelegram
ChatIdTelegram
chatidtelegram
chatId
ChatId
chatid
```

Campos normalizados por Tabla:

```text
_telegramUser
_telegramChatId
_telegramTiene
_telegramBot
```

Para envío automático por bot se necesita `_telegramChatId`. Si solo existe usuario Telegram, la pantalla permite abrir el perfil y copiar el mensaje.

## Acciones por estudiante

Cada fila muestra acciones compactas:

```text
📋  🟢  ✈️
```

- 📋 Copiar cédula.
- 🟢 Abrir WhatsApp.
- ✈️ Abrir Telegram individual.

## Telegram individual

El botón de Telegram individual abre un modal con:

- datos del estudiante,
- estado del Telegram registrado,
- tipo de mensaje,
- vista previa,
- copiar mensaje,
- abrir Telegram,
- enviar por bot.

Tipos de mensaje:

1. Requisitos faltantes.
2. Cronograma manual.
3. Mensaje libre.

## Telegram masivo

El botón **Telegram masivo** usa los estudiantes filtrados actualmente en Tabla.

Flujo:

1. Filtrar estudiantes en Tabla.
2. Abrir Telegram masivo.
3. Revisar resumen: total, con Telegram, con chatId, seleccionados y listos para bot.
4. Seleccionar todos, solo con chatId o limpiar selección.
5. Elegir tipo de mensaje.
6. Revisar vista previa.
7. Marcar confirmación.
8. Preparar lote.
9. Enviar lote.

El envío masivo solo se hace por Telegram y siempre requiere confirmación. Para envío automático por bot, el estudiante debe tener `chatId`.

## Mensajes formales

`tabla.message.js` genera mensajes formales para:

- requisitos faltantes,
- cronograma manual,
- mensaje libre.

Variables disponibles en mensajes manuales:

```text
{{NOMBRE}}
{{CEDULA}}
{{CARRERA}}
{{PERIODO}}
{{DIVISION}}
{{TELEGRAM}}
```

## API segura de Telegram

`tabla.telegram-api.js` no guarda ni expone el token del bot en el frontend.

Usa la función segura configurada para Telegram:

```text
ta-titulo-articulo-api-telegram
```

Requiere:

```text
TELEGRAM_BOT_TOKEN
TA_TITULO_ARTICULO_ADMIN_TOKEN
```

Si se abre en local o Live Server, puede pedir la URL base de Netlify Functions.

Ejemplo local:

```text
http://127.0.0.1:8888/.netlify/functions
```

## Historial

`tabla.history.js` guarda historial local en `localStorage`.

Clave usada:

```text
tabla.telegram.historial.v1
```

Guarda:

- fecha,
- modo: individual o masivo,
- tipo de mensaje,
- cédula,
- nombre,
- carrera,
- período,
- usuario Telegram,
- chatId,
- mensaje,
- estado,
- error,
- loteId,
- telegramMessageId.

Estados:

```text
enviado
fallido
omitido
pendiente
```

El historial permite:

- consultar registros,
- exportar JSON,
- exportar CSV,
- limpiar historial local.

## Pruebas manuales recomendadas

### Datos y filtros

1. Cargar Tabla con estudiantes activos.
2. Filtrar por período.
3. Filtrar por carrera.
4. Filtrar por división.
5. Filtrar por estado: cumple, pendiente y no cumple.
6. Buscar por cédula, nombre, correo y Telegram.

### Telegram individual

1. Estudiante con `telegramChatId`: debe habilitar Enviar por bot.
2. Estudiante con solo usuario Telegram: debe permitir abrir perfil y copiar mensaje.
3. Estudiante sin Telegram: debe permitir copiar mensaje, pero no enviar por bot.
4. Requisitos faltantes: debe generar mensaje formal automático.
5. Cronograma manual: debe incluir el texto escrito.
6. Mensaje libre: debe reemplazar variables como `{{NOMBRE}}`.

### Telegram masivo

1. Aplicar filtros y abrir Telegram masivo.
2. Confirmar que el total corresponde a los estudiantes filtrados.
3. Seleccionar todos.
4. Seleccionar solo con chatId.
5. Limpiar selección.
6. Preparar lote sin marcar confirmación: debe bloquear.
7. Preparar lote con confirmación: debe crear lote solo con estudiantes que tengan chatId.
8. Enviar lote: debe mostrar enviados, fallidos y omitidos.

### Historial

1. Enviar mensaje individual y verificar registro.
2. Enviar lote masivo y verificar registros por estudiante.
3. Exportar JSON.
4. Exportar CSV.
5. Limpiar historial.

## Estado final del bloque

Tabla queda como pantalla de consulta, filtro, contacto individual, Telegram masivo, mensajes formales, envío seguro por bot e historial local.
