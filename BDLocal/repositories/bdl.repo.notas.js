(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  if(!B){ throw new Error("BDLRepoNotas requiere BDLRepoBase."); }

  function txt(value){ return String(value == null ? "" : value).trim(); }
  function idNota(row){
    row = row || {};
    return txt(row.id || row.idNota || ((row.idEstudiantePeriodo || row.numeroIdentificacion || row.cedula || "SIN_ESTUDIANTE") + "__" + (row.periodoId || "SIN_PERIODO") + "__nota"));
  }
  function getField(row, field){ return row ? row[field] : ""; }

  function guardarMuchos(rows){
    return B.putAll(B.stores.estudianteNotas, rows);
  }

  function porEstudiante(idEstudiantePeriodo){
    return B.byIndex(B.stores.estudianteNotas, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 });
  }

  function porPeriodo(periodoId){
    return B.byIndex(B.stores.estudianteNotas, "by_periodoId", periodoId, { limit: 0 });
  }

  function guardarManual(row, meta){
    row = Object.assign({}, row || {});
    row.id = idNota(row);
    row.actualizadoEn = B.now();
    return B.get(B.stores.estudianteNotas, row.id).catch(function(){ return null; }).then(function(old){
      return B.put(B.stores.estudianteNotas, row).then(function(){
        var fields = ["Nart", "Ndef", "Nfin", "nota", "notaFinal", "calificacion", "observacion"];
        fields.forEach(function(field){
          if(Object.prototype.hasOwnProperty.call(row, field)){
            var oldValue = old ? getField(old, field) : "";
            var newValue = getField(row, field);
            if(String(oldValue) !== String(newValue) && window.BDLManualEvents){
              window.BDLManualEvents.recordNota(row, field, oldValue, newValue, meta || {});
            }
          }
        });
        B.cacheClear();
        return { ok:true, row:row };
      });
    });
  }

  function guardarCampoManual(row, field, value, meta){
    row = Object.assign({}, row || {});
    row.id = idNota(row);
    return B.get(B.stores.estudianteNotas, row.id).catch(function(){ return null; }).then(function(old){
      var next = Object.assign({}, old || {}, row);
      var oldValue = old ? getField(old, field) : "";
      next[field] = value;
      next.actualizadoEn = B.now();
      return B.put(B.stores.estudianteNotas, next).then(function(){
        if(String(oldValue) !== String(value) && window.BDLManualEvents){
          window.BDLManualEvents.recordNota(next, field, oldValue, value, meta || {});
        }
        B.cacheClear();
        return { ok:true, row:next };
      });
    });
  }

  window.BDLRepoNotas = {
    guardarMuchos: guardarMuchos,
    guardarManual: guardarManual,
    guardarCampoManual: guardarCampoManual,
    porEstudiante: porEstudiante,
    porPeriodo: porPeriodo
  };
})(window);