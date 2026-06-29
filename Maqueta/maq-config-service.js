/* =========================================================
Nombre completo: maq-config-service.js
Ruta o ubicación: /Requisitos/Maqueta/maq-config-service.js
Función o funciones:
- Construir el menú superior de Requisitos en el orden definido por Jeff.
- Crear grupo Titulos con submenús funcionales: Estudiante, Administrador y Coordinador.
- Mantener Requisito como pantalla inicial.
Con qué se conecta:
- maq-menu.js
- maq-modulos-registry.js
========================================================= */
(function(window){
  "use strict";
  var ORDER=[
    {tipo:"modulo",moduloId:"carga_excel",etiqueta:"Requisito"},
    {tipo:"modulo",moduloId:"baselocal",etiqueta:"Bl"},
    {tipo:"modulo",moduloId:"tabla_principal",etiqueta:"tabla"},
    {tipo:"modulo",moduloId:"ficha_estudiante",etiqueta:"Ficha"},
    {tipo:"modulo",moduloId:"stat_main",etiqueta:"Stats"},
    {tipo:"modulo",moduloId:"coordi",etiqueta:"Coordi"},
    {tipo:"modulo",moduloId:"modulo_reporte",etiqueta:"Repor"},
    {tipo:"modulo",moduloId:"defart",etiqueta:"Defensas"},
    {tipo:"grupo",id:"titulos",etiqueta:"Titulos",hijos:[
      {tipo:"modulo",moduloId:"titulos_estudiante",etiqueta:"Estudiante"},
      {tipo:"modulo",moduloId:"titulos_admin",etiqueta:"Administrador"},
      {tipo:"modulo",moduloId:"titulos_coordinador",etiqueta:"Coordinador"}
    ]},
    {tipo:"modulo",moduloId:"titulacion",etiqueta:"Infor"}
  ];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function obtenerConfigEfectiva(){return Promise.resolve({itemsMenuCalculados:clone(ORDER),moduloInicial:"carga_excel"});}
  function construirItemsMenu(config){return config&&Array.isArray(config.itemsMenuCalculados)?config.itemsMenuCalculados:clone(ORDER);}
  window.MAQ_CONFIG_SERVICE={obtenerConfigEfectiva:obtenerConfigEfectiva,construirItemsMenu:construirItemsMenu};
})(window);
