/* =========================================================
Nombre completo: bdl.firebase.migration.contract.js
Ruta: /BDLocal/firebase/bdl.firebase.migration.contract.js
Función:
- Normalizar las claves públicas de los conteos legacy.
- Mantener estable el contrato de la vista previa aunque cambien nombres configurados.
- Conservar intacto el plan interno y la aplicación de la migración.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-canonical-source-counts";
  var api=window.RequisitosFirebaseMigration;
  if(!api||api.__canonicalSourceCountsInstalled){return;}

  function text(value){return String(value==null?"":value).trim();}
  function number(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function normalized(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,"");}
  function findCount(counts,names){
    counts=counts||{};names=(names||[]).map(normalized);
    var keys=Object.keys(counts);
    for(var index=0;index<keys.length;index+=1){
      if(names.indexOf(normalized(keys[index]))>=0){return number(counts[keys[index]]);}
    }
    return 0;
  }
  function canonicalCounts(counts){
    counts=Object.assign({},counts||{});
    counts.Estudiantes=findCount(counts,["Estudiantes","estudiantes"]);
    counts.EstudiantesPeriodo=findCount(counts,["EstudiantesPeriodo","estudiantes_periodo","estudiantesperiodo"]);
    counts.historial=findCount(counts,["historial"]);
    counts.historial_periodos=findCount(counts,["historial_periodos","historialPeriodos"]);
    return counts;
  }

  var originalPreview=api.preview.bind(api);
  api.preview=function(options){
    return originalPreview(options||{}).then(function(result){
      result=Object.assign({},result||{});
      result.sourceCounts=canonicalCounts(result.sourceCounts);
      result.sourceCountContractVersion=VERSION;
      return result;
    });
  };
  api.canonicalSourceCounts=canonicalCounts;
  api.sourceCountContractVersion=VERSION;
  api.__canonicalSourceCountsInstalled=true;

  window.RequisitosFirebaseMigrationContract={version:VERSION,canonicalCounts:canonicalCounts,install:function(){return true;}};
})(window);
