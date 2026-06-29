/* =========================================================
Nombre completo: excel-resumen.logic.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-resumen.logic.js
Función o funciones:
- Formatear esquema, análisis y consolidado para mostrar en pantalla.
Con qué se conecta:
- excel-ui.resumen.js
========================================================= */
(function(window){
  "use strict";
  function list(title,items){items=Array.isArray(items)?items:[];return title+": "+(items.length?items.join(", "):"—");}
  function schema(s){if(!s)return "Sin análisis.";return ["Estado: "+(s.ok?"OK":"REVISAR"),list("Faltan",s.missing),list("Críticas",s.criticalMissing),list("Extra",s.extra)].join("\n");}
  function analisis(a){if(!a)return "";return ["Filas leídas: "+(a.totalFilas||0),"Filas válidas: "+(a.validas||0),"Duplicados: "+(a.duplicados||0),"Sin identificación: "+(a.sinId||0)].join("\n");}
  function consolidado(c){if(!c)return "Sin consolidado.";var out=["Total estudiantes: "+(c.totalEstudiantes||0),"","Requisitos:"];Object.keys(c.requisitos||{}).forEach(function(k){var r=c.requisitos[k];out.push("- "+k+": "+r.cumple+" cumple / "+r.noCumple+" no cumple / "+r.pendiente+" pendiente / "+r.porcentaje+"%");});out.push("","Carreras:");Object.keys(c.carreras||{}).forEach(function(k){var r=c.carreras[k];out.push("- "+k+": total "+r.total+" / cumple "+r.cumple+" / no cumple "+r.noCumple+" / "+r.porcentaje+"%");});return out.join("\n");}
  window.ExcelResumenLogic={schema:schema,analisis:analisis,consolidado:consolidado};
})(window);
