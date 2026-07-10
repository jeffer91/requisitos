/* =========================================================
Nombre completo: tabla.export.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.export.js
Función o funciones:
- Exportar la tabla filtrada en CSV o JSON.
- Usar campos normalizados por TablaCore para evitar columnas vacías con BL2.
Con qué se conecta:
- tabla.app.js
========================================================= */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).trim();}
  function download(name,content,type){var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function csvCell(v){return '"'+text(v).replace(/"/g,'""')+'"';}
  function csv(rows){
    var headers=["cedula","nombres","carrera","division","periodo","matricula","estado","celular","correo","telegramUser","telegramChatId"];
    var lines=[headers.join(",")];
    (rows||[]).forEach(function(r){
      lines.push([
        r._cedula,
        r._nombres,
        r._carrera,
        r._division,
        r._periodo||r.periodoLabel||r.periodoId,
        r._estadoMatricula,
        r._estadoGeneral&&r._estadoGeneral.label,
        r._celular,
        r._correo,
        r._telegramUser,
        r._telegramChatId
      ].map(csvCell).join(","));
    });
    return lines.join("\n");
  }
  function exportCsv(rows){download("tabla-requisitos.csv",csv(rows),"text/csv;charset=utf-8");}
  function exportJson(rows){download("tabla-requisitos.json",JSON.stringify(rows||[],null,2),"application/json;charset=utf-8");}
  window.TablaExport={exportCsv:exportCsv,exportJson:exportJson,csv:csv};
})(window);
