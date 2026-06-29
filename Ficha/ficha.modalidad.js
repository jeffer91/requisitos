/* =========================================================
Nombre completo: ficha.modalidad.js
Ruta o ubicación: /Requisitos/Ficha/ficha.modalidad.js
Función o funciones:
- Calcular y mostrar la modalidad de titulación del estudiante.
- Para períodos regulares permitir Examen Complexivo o Trabajo de Titulación.
- Para PVC fijar Artículo Académico.
- Guardar modalidadTitulacion en BaseLocal cuando sea posible.
Con qué se conecta:
- ficha.core.js
- ficha.app.js
- ../Gestion/Excel/excel-local.repo.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

  var VALUES = {
    complexivo:"EXAMEN_COMPLEXIVO",
    trabajo:"TRABAJO_TITULACION",
    articulo:"ARTICULO_ACADEMICO"
  };

  function classifyPeriod(value){
    var raw = text(value);
    if(window.StatsRules && typeof window.StatsRules.classifyPeriod === "function"){
      return window.StatsRules.classifyPeriod(raw);
    }
    var n = norm(raw);
    var regular = (n.indexOf("octubre") >= 0 && n.indexOf("marzo") >= 0) || (n.indexOf("abril") >= 0 && n.indexOf("septiembre") >= 0);
    return {id:regular ? "REGULAR" : "PVC", label:regular ? "Regular" : "PVC", isRegular:regular, isPVC:!regular, raw:raw};
  }

  function periodOf(row){
    row = row || {};
    return text(row._periodo || row._periodoNormalizado || row.periodoLabel || row.periodoId || row.ultimoPeriodoId || row.periodo || row.Periodo);
  }

  function label(value){
    value = text(value).toUpperCase();
    if(value === VALUES.complexivo){return "Examen Complexivo";}
    if(value === VALUES.trabajo){return "Trabajo de Titulación";}
    if(value === VALUES.articulo){return "Artículo Académico";}
    return "Sin modalidad";
  }

  function normalize(value, periodInfo){
    var n = norm(value);
    if(n.indexOf("trabajo") >= 0 || n.indexOf("tesis") >= 0 || n.indexOf("proyecto") >= 0){return VALUES.trabajo;}
    if(n.indexOf("articulo") >= 0 || n.indexOf("pvc") >= 0){return VALUES.articulo;}
    if(n.indexOf("complexivo") >= 0 || n.indexOf("examen") >= 0){return VALUES.complexivo;}
    if(periodInfo && periodInfo.id === "PVC"){return VALUES.articulo;}
    if(periodInfo && periodInfo.id === "REGULAR"){return VALUES.complexivo;}
    return "";
  }

  function current(row){
    row = row || {};
    var periodInfo = classifyPeriod(periodOf(row));
    var raw = text(row.modalidadTitulacion || row.ModalidadTitulacion || row.modalidad || row.Modalidad || "");
    var value = normalize(raw, periodInfo);
    return {
      value:value,
      label:label(value),
      periodType:periodInfo,
      editable:periodInfo.id === "REGULAR",
      locked:periodInfo.id === "PVC",
      source:raw ? "guardado" : "automatico"
    };
  }

  function options(row){
    var info = current(row);
    if(info.periodType.id === "PVC"){
      return [{value:VALUES.articulo, label:"Artículo Académico", selected:true, disabled:false}];
    }
    return [
      {value:VALUES.complexivo, label:"Examen Complexivo", selected:info.value === VALUES.complexivo, disabled:false},
      {value:VALUES.trabajo, label:"Trabajo de Titulación", selected:info.value === VALUES.trabajo, disabled:false}
    ];
  }

  function studentId(row){
    row = row || {};
    return text(row._id || row._cedula || row._bl2Id || row._docId || row.docId || row.cedula || row.numeroIdentificacion);
  }

  function save(row, value){
    row = row || {};
    var id = studentId(row);
    var info = current(row);
    var finalValue = normalize(value, info.periodType);
    if(info.periodType.id === "PVC"){finalValue = VALUES.articulo;}
    if(!id){throw new Error("No se puede guardar modalidad: estudiante sin identificador.");}
    if(!finalValue){throw new Error("Modalidad inválida.");}

    if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.patchStudentById === "function"){
      window.ExcelLocalRepo.patchStudentById(id, {modalidadTitulacion:finalValue, modalidadTitulacionActualizadaEn:new Date().toISOString()});
      if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){window.FichaCore.invalidate();}
      return {ok:true, value:finalValue, label:label(finalValue), source:"ExcelLocalRepo"};
    }
    throw new Error("ExcelLocalRepo.patchStudentById no está disponible.");
  }

  window.FichaModalidad = {
    VALUES:VALUES,
    classifyPeriod:classifyPeriod,
    current:current,
    options:options,
    save:save,
    label:label,
    normalize:normalize
  };
})(window);
