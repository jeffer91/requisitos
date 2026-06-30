# Sacar N - Verificacion de conexiones

## Resultado de revision

Estado general: configuracion completa para prueba local en Electron.

## Menu principal

Verificado:

- `Maqueta/maq-modulos-registry.js` registra el modulo `sacar_n` como activo.
- La ruta configurada es `../sn-sacar-n/sn-sacar-n.html`.
- `Maqueta/maq-menu.js` incluye `Sacar N` en el menu principal despues de Defensas.
- `Maqueta/maq-config-service.js` tambien incluye `Sacar N` dentro del orden efectivo del menu.

## Pantalla Sacar N

Verificado:

- Existe `sn-sacar-n/sn-sacar-n.html`.
- Carga BDLocal antes de los servicios de Sacar N.
- Carga los servicios de configuracion, estado, estudiantes, SISACAD, reporte, exportacion y verificacion final.
- El archivo inicializador es `sn-sacar-n/sn-sacar-n.js`.
- La pantalla ejecuta `SNFinalCheck.run()` al abrir.

## BDLocal

Verificado:

- La pantalla carga `../BDLocal/adapters/bdl.screen-deps.js`.
- El servicio `sn-estudiantes.service.js` intenta usar `BDLocal` o `BDLRepoEstudiantes`.
- Los filtros de periodo, carrera y modalidad dependen de los datos disponibles en BDLocal.

## SISACAD / Electron

Verificado:

- `electron/main.js` abre SISACAD en una ventana visible independiente.
- `electron/preload.js` expone la API `electronAPI.sacarN`.
- Estan disponibles las funciones:
  - `openSisacad`
  - `getSisacadStatus`
  - `focusSisacad`
  - `closeSisacad`
  - `checkRegistroNotasProyecto`
  - `navigateRegistroNotasProyecto`
  - `runPruebaVisible`
  - `runExtraccionAutomatica`
- La automatizacion trabaja desde `electron/sn-sisacad-automation.js`.

## Correccion aplicada en esta verificacion

Se corrigio `sn-state.service.js` para que el estado `Sesion expirada` cuente como error final y no altere el resumen del avance.

## Prueba local recomendada

Ejecutar:

```bash
git pull
npm start
```

Luego:

1. Confirmar que `Sacar N` aparece en el menu principal.
2. Abrir `Sacar N`.
3. Abrir consola y revisar:

```js
window.SN_FINAL_CHECK
```

4. Confirmar que `ok` sea `true`.
5. Presionar `Cargar estudiantes`.
6. Confirmar que los filtros y la tabla se llenen desde BDLocal.
7. Presionar `Abrir SISACAD`.
8. Iniciar sesion manualmente si hace falta.
9. Presionar `Ir a Registro Notas Proyecto`.
10. Presionar `Prueba visible`.
11. Si la prueba visible funciona, usar `Continuar automatico`.
12. Probar `Pausar` y `Continuar`.
13. Revisar resumen y novedades.
14. Presionar `Exportar Excel`.

## Nota

La lectura real de SISACAD solo puede validarse localmente con una sesion autorizada y datos reales visibles en la pantalla de SISACAD.
