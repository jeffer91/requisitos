# Smoke test BDLocal / DefArt

## Objetivo

Verificar después de `git pull` que los bloques 12 al 22 estén presentes y conectados.

## Comandos

Desde la carpeta del proyecto:

```powershell
cd "C:\Users\ITSQMET Desktop\requisitos"
git pull
powershell -ExecutionPolicy Bypass -File .\tools\bdl-smoke-test.ps1
```

## Qué debe salir

Debe terminar con:

```text
Smoke test aprobado. Ahora abre BL2 y ejecuta Diagnóstico general BDLocal.
```

## Luego probar en la app

1. Abrir BL2.
2. Ejecutar **Diagnóstico general BDLocal**.
3. Verificar que aparezcan los targets:
   - google
   - supabase
   - firebase
4. Revisar cola nueva:
   - Google pendientes
   - Firebase pendientes
   - Supabase pendientes
5. Abrir Defensas.
6. Cambiar una nota de prueba.
7. Guardar.
8. Volver a BL2 y ejecutar diagnóstico.
9. Confirmar que aumenten los pendientes de `notas_titulacion`.
10. Probar **Sincronizar cola**.

## Si falla

Copiar toda la salida del PowerShell y enviarla al chat.

No borrar la base ni limpiar IndexedDB antes de revisar el error.
