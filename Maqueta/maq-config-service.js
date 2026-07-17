/* =========================================================
Nombre completo: maq-config-service.js
Ruta o ubicación: /Requisitos/Maqueta/maq-config-service.js
Función o funciones:
- Construir el menú superior de Requisitos en el orden definido.
- Mantener Carga como pantalla inicial.
- Mantener BL como pantalla de control de BDLocal y Firebase.
- Incluir los módulos activos de requisitos, estadísticas y titulación.
- Excluir del menú superior el grupo antiguo Títulos.
Con qué se conecta:
- maq-menu.js
- maq-modulos-registry.js
========================================================= */
(function(window){
  "use strict";
  var ORDER=[
    {tipo:"modulo",moduloId:"carga_excel",etiqueta:"Carga"},
    {tipo:"modulo",moduloId:"baselocal",etiqueta:"BL"},
    {tipo:"modulo",moduloId:"tabla_principal",etiqueta:"tabla"},
    {tipo:"modulo",moduloId:"ficha_estudiante",etiqueta:"Ficha"},
    {tipo:"modulo",moduloId:"stat_main",etiqueta:"Stats"},
    {tipo:"modulo",moduloId:"coordi",etiqueta:"Coordi"},
    {tipo:"modulo",moduloId:"global",etiqueta:"Global"},
    {tipo:"modulo",moduloId:"modulo_reporte",etiqueta:"Repor"},
    {tipo:"modulo",moduloId:"defart",etiqueta:"Defensas"},
    {tipo:"modulo",moduloId:"ncomplex",etiqueta:"Ncomplex"},
    {tipo:"modulo",moduloId:"cr_def",etiqueta:"Cr-def"},
    {tipo:"modulo",moduloId:"titulacion",etiqueta:"InPVC"}
  ];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function obtenerConfigEfectiva(){return Promise.resolve({itemsMenuCalculados:clone(ORDER),moduloInicial:"carga_excel"});}
  function construirItemsMenu(config){return config&&Array.isArray(config.itemsMenuCalculados)?config.itemsMenuCalculados:clone(ORDER);}
  window.MAQ_CONFIG_SERVICE={obtenerConfigEfectiva:obtenerConfigEfectiva,construirItemsMenu:construirItemsMenu};
})(window);
