/* =========================================================
Nombre completo: maq-config-service.js
Ruta o ubicación: /Requisitos/Maqueta/maq-config-service.js
Función o funciones:
- Construir el menú superior de Requisitos en el orden definido.
- Mantener Carga como pantalla inicial.
- Mostrar nombres completos y consistentes en la navegación.
- Excluir del menú superior el grupo antiguo Títulos.
========================================================= */
(function(window){
  "use strict";
  var ORDER=[
    {tipo:"modulo",moduloId:"carga_excel",etiqueta:"Carga"},
    {tipo:"modulo",moduloId:"baselocal",etiqueta:"Centro de datos"},
    {tipo:"modulo",moduloId:"tabla_principal",etiqueta:"Tabla"},
    {tipo:"modulo",moduloId:"ficha_estudiante",etiqueta:"Ficha"},
    {tipo:"modulo",moduloId:"stat_main",etiqueta:"Estadísticas"},
    {tipo:"modulo",moduloId:"coordi",etiqueta:"Coordi"},
    {tipo:"modulo",moduloId:"global",etiqueta:"Global"},
    {tipo:"modulo",moduloId:"modulo_reporte",etiqueta:"Reportes"},
    {tipo:"modulo",moduloId:"defart",etiqueta:"Defensas"},
    {tipo:"modulo",moduloId:"ncomplex",etiqueta:"Ncomplex"},
    {tipo:"modulo",moduloId:"cr_def",etiqueta:"Cr-def"},
    {tipo:"modulo",moduloId:"titulacion",etiqueta:"InPVC"}
  ];
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function obtenerConfigEfectiva(){return Promise.resolve({itemsMenuCalculados:clone(ORDER),moduloInicial:"carga_excel"});}
  function construirItemsMenu(config){return config&&Array.isArray(config.itemsMenuCalculados)?config.itemsMenuCalculados:clone(ORDER);}
  window.MAQ_CONFIG_SERVICE={obtenerConfigEfectiva:obtenerConfigEfectiva,construirItemsMenu:construirItemsMenu};
})(window);
