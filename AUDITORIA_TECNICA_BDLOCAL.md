# Auditoría técnica integral de Requisitos y BDLocal

Fecha de cierre de código: 10 de julio de 2026  
Repositorio: `jeffer91/requisitos`  
Rama: `main`

## 1. Alcance

La auditoría revisa:

- dependencias antiguas o flotantes;
- rutas legacy que pudieran cruzarse con la arquitectura actual;
- comunicaciones entre Base Local, pantallas, Firebase, Telegram y Google Sheets;
- claves e identificadores de persona, período y matrícula;
- duplicados de archivos, rutas, scripts e interfaces;
- archivos y procesamiento XML;
- seguridad de Electron, ventanas, navegación e IPC;
- carga de XLSX, CSV, JSON, HTML y archivos de respaldo;
- prueba estática y prueba real aislada de Electron e IndexedDB.

## 2. Arquitectura certificada

```text
Firebase
├── Estudiantes/{cedula}
│   └── persona y Telegram
└── EstudiantesPeriodo/{periodoId__cedula}
    └── información académica

Base Local
└── cedula__periodoId
```

Reglas obligatorias:

- `Estudiantes` usa exclusivamente la cédula como ID del documento.
- `EstudiantesPeriodo` usa `periodoId__cedula`.
- Base Local usa `cedula__periodoId` para matrícula y relaciones académicas.
- Telegram se lee desde `Estudiantes` y no se incluye en documentos académicos.
- Las escrituras externas son manuales y usan lotes máximos de 25.

## 3. Problemas críticos corregidos

### 3.1 Sincronizador legacy directo

El archivo antiguo `BDLocal/bl2.sync.js` conservaba rutas capaces de escribir directamente en Google Sheets y Firebase. Fue sustituido por una fachada de compatibilidad que:

- delega todas las escrituras a `BDLSyncV2`;
- bloquea sincronización automática, por inactividad y al cerrar;
- limita cada ejecución a 25 cambios;
- no contiene `fetch` de escritura, batch Firestore ni commit directo;
- conserva únicamente la inicialización compartida del SDK Firebase.

### 3.2 Seguridad de Electron

La ventana principal tenía seguridad web y sandbox desactivados. Ahora utiliza:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
allowRunningInsecureContent: false
navigateOnDragDrop: false
```

También se incorporó:

- validación estricta de rutas internas;
- bloqueo de `webview`;
- bloqueo de permisos del navegador;
- validación de remitente para todos los canales IPC;
- validación y límite de URL externas;
- sanitización de los estudiantes enviados a la prueba visible de SISACAD;
- eliminación de rutas físicas del sistema en la API pública del renderer.

### 3.3 Dependencia XLSX antigua

Se retiró el uso de SheetJS/XLSX `0.18.5` y sus referencias por CDN. La aplicación ahora declara SheetJS `0.20.3` mediante el tarball oficial fijado y lo carga desde `node_modules`.

El importador y el lector de Carga ahora limitan:

- archivos a 15 MB;
- 50 000 filas;
- 500 columnas;
- 50 000 caracteres por celda.

Además:

- bloquean `__proto__`, `prototype` y `constructor`;
- desactivan fórmulas, HTML, estilos, VBA y dependencias del libro durante la lectura;
- no agregan cero a una identificación de nueve dígitos salvo que el resultado valide como cédula ecuatoriana.

### 3.4 Dependencias flotantes

Se retiraron:

```text
electron: latest
npx --yes electron .
```

La configuración actual utiliza:

```text
Node >= 22.12.0
Electron 43.1.0
SheetJS 0.20.3
```

### 3.5 Interfaces legacy duplicadas

Se eliminaron por no estar cargadas y duplicar funcionalidades actuales:

```text
js/bdlocal-config/bdlocal-modal.js
BDLocal/migrations/bdl.migration.legacy-v2.ui.js
```

La migración sigue disponible dentro de `Mantenimiento seguro` mediante la interfaz oficial.

### 3.6 Navegación inexistente

Se retiró el enlace heredado `../../index.html` del shell principal porque salía del repositorio y apuntaba a un archivo inexistente.

## 4. Auditoría de conexiones

Se verifican los conectores oficiales:

```text
carga
tabla
ficha
stats
coordi
reportes
defensas
global
```

`BDLocalConexiones` conserva los errores de carga en su estado y expone el estado de cada conector. Las pantallas utilizan servicios y repositorios V2, manteniendo compatibilidad legacy únicamente como fallback controlado.

## 5. XML y duplicados

La auditoría automática revisa:

- archivos `.xml`;
- MIME `application/xml` y `text/xml`;
- `responseXML`;
- parsers XML;
- rutas que solo difieran por mayúsculas/minúsculas;
- IDs HTML estáticos repetidos;
- scripts repetidos en una misma pantalla;
- referencias locales inexistentes;
- archivos con contenido exactamente duplicado;
- archivos vacíos.

`DOMParser` usado por el importador opera exclusivamente como `text/html`, no como XML.

Los duplicados lógicos de estudiantes, matrículas, requisitos, notas y cola se revisan también dentro de Base Local mediante `Diagnóstico y salud` y `Mantenimiento seguro`.

## 6. Pruebas incorporadas

### 6.1 Auditoría estática

```powershell
npm test
```

Ejecuta:

```text
scripts/verify-bdlocal.js
scripts/audit-repository.js
```

Comprueba sintaxis, archivos, rutas, dependencias, seguridad, conexiones, XML, duplicados, Firebase e identidad.

### 6.2 Prueba real aislada de Electron

```powershell
npm run test:electron
```

La prueba:

- abre Electron realmente;
- carga `BDLocal/bl2.html`;
- crea una carpeta temporal de datos distinta a la base real;
- crea y abre IndexedDB en ese entorno aislado;
- espera módulos, conectores y arranque completo;
- ejecuta `BL2Test`;
- no escribe en Firebase ni Google Sheets;
- genera `artifacts/bdlocal-electron-smoke.json`;
- devuelve código `1` si un control falla.

### 6.3 GitHub Actions

El workflow `.github/workflows/bdlocal-integrity.yml` ejecuta:

1. auditoría estática;
2. instalación de dependencias fijadas;
3. prueba real de Electron con `xvfb`;
4. publicación del reporte JSON como artefacto.

## 7. Procedimiento final en Windows

Ejecutar desde PowerShell en la raíz del proyecto:

```powershell
npm install
npm test
npm run test:electron
npm start
```

Después, dentro de la aplicación:

```text
Base Local
→ Diagnóstico y salud
→ Ejecutar diagnóstico
```

Antes de aplicar correcciones reales:

```text
Base Local
→ Mantenimiento seguro
→ Analizar primero
→ Revisar vista previa
→ Confirmar únicamente el lote seguro
```

## 8. Advertencias que permanecen

### 8.1 `package-lock.json`

El repositorio todavía debe generar y guardar `package-lock.json` después de un `npm install` exitoso. Las dependencias directas están fijadas, pero el lockfile es necesario para fijar también todo el árbol transitivo.

### 8.2 Protección de secretos locales

El centro de control ofusca algunos valores con Base64. Esto evita mostrarlos directamente, pero no equivale a cifrado del sistema operativo. No deben guardarse claves `service_role`, claves privadas ni secretos administrativos en la aplicación.

### 8.3 Resultado de ejecución

La prueba real está implementada y automatizada. El cierre definitivo requiere confirmar uno de estos resultados:

- workflow verde en GitHub Actions; o
- ejecución local satisfactoria de `npm test` y `npm run test:electron`.

No debe afirmarse que IndexedDB y Electron fueron aprobados en ejecución hasta disponer de ese resultado.

## 9. Criterio de aprobación

La aplicación puede considerarse aprobada cuando:

- `npm test` termina con código 0;
- `npm run test:electron` termina con código 0;
- el reporte JSON contiene `ok: true`;
- `Diagnóstico y salud` no presenta controles fallidos;
- no existen conflictos pendientes en `Mantenimiento seguro`;
- se genera y confirma `package-lock.json`.
