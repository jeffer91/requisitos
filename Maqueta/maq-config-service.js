/* =========================================================
Nombre completo: maq-config-service.js
Ruta o ubicación: /Requisitos/Maqueta/maq-config-service.js
Función o funciones:
- Construir el menú superior de Requisitos en el orden definido.
- Mantener Carga como pantalla inicial.
- Mostrar nombres completos y consistentes en la navegación.
- Excluir del menú superior el grupo antiguo Títulos.
- Excluir Reportes del menú superior.
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
    {tipo:"grupo",id:"notas",etiqueta:"Notas",hijos:[
      {tipo:"modulo",moduloId:"carga_notas",etiqueta:"Cargado de notas"},
      {tipo:"modulo",moduloId:"notas_nucleos",etiqueta:"Núcleos"},
      {tipo:"modulo",moduloId:"notas_complexivo",etiqueta:"Complexivo"},
      {tipo:"modulo",moduloId:"notas_articulo",etiqueta:"Artículo"},
      {tipo:"modulo",moduloId:"notas_trabajo",etiqueta:"Trabajo"},
      {tipo:"modulo",moduloId:"notas_descargas",etiqueta:"Descargas"}
    ]},
    {tipo:"modulo",moduloId:"stat_not",etiqueta:"Stat Not"},
    {tipo:"modulo",moduloId:"actas",etiqueta:"Actas"}
    ,{tipo:"modulo",moduloId:"inf",etiqueta:"Inf"}
  ];
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function obtenerConfigEfectiva(){return Promise.resolve({itemsMenuCalculados:clone(ORDER),moduloInicial:"carga_excel"});}
  function construirItemsMenu(config){return config&&Array.isArray(config.itemsMenuCalculados)?config.itemsMenuCalculados:clone(ORDER);}
  window.MAQ_CONFIG_SERVICE={obtenerConfigEfectiva:obtenerConfigEfectiva,construirItemsMenu:construirItemsMenu};
})(window);
