/* =========================================================
Nombre completo: excel-ui.borrado.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.borrado.js
Función o funciones:
- Activar borrado local básico por período.
Con qué se conecta:
- excel-delete.service.js
========================================================= */
(function(window,document){
  "use strict";
  var booted=false;
  function el(id){return document.getElementById(id);}
  function boot(){if(booted)return;booted=true;var btn=el("excel-delete-students-btn");if(btn){btn.disabled=false;btn.addEventListener("click",function(){var p=el("excel-delete-period-select");if(!p||!p.value)return alert("Selecciona un período.");if(!confirm("¿Borrar alumnos locales del período seleccionado?"))return;window.ExcelDeleteService.clearPeriod(p.value);alert("Alumnos borrados localmente.");});}}
  window.ExcelUIBorrado={boot:boot};
})(window,document);
