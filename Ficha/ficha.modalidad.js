/* =========================================================
Nombre completo: ficha.modalidad.js
Ruta o ubicación: /Ficha/ficha.modalidad.js
Función o funciones:
- Calcular la modalidad de titulación disponible por tipo de período.
- Guardar modalidadTitulacion exclusivamente mediante ConFicha.
- Mantener respaldo local y respuesta inmediata para la interfaz.
Con qué se conecta:
- ficha.core.js
- ../BDLocal/conexiones/cone.ficha.js
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY="REQ_FICHA_MODALIDAD_TITULACION_V1";
  var VALUES={complexivo:"EXAMEN_COMPLEXIVO",trabajo:"TRABAJO_TITULACION",articulo:"ARTICULO_ACADEMICO"};
  var LABELS={};
  LABELS[VALUES.complexivo]="Examen Complexivo";
  LABELS[VALUES.trabajo]="Trabajo de Titulación";
  LABELS[VALUES.articulo]="Artículo Académico";

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function connector(){return window.ConFicha||window.BDLocalFicha||null;}
  function rowId(row){
    row=row||{};
    return text(row.idEstudiantePeriodo||row.studentId||row.id||row._id||row._cedula||row.cedula||row.numeroIdentificacion||row.Cedula||row.NumeroIdentificacion||row.docId||row._docId);
  }
  function periodOf(row){
    row=row||{};
    return text(row._periodoId||row.periodoId||row.periodId||row.ultimoPeriodoId||row.periodoCanonicoId||row._periodo||row.periodoLabel||row.periodo||row.Periodo);
  }
  function classifyPeriod(value){
    var raw=text(value);
    try{
      if(window.FichaCore&&typeof window.FichaCore.studentApproval==="function"){
        var approval=window.FichaCore.studentApproval({_periodo:raw,periodo:raw,periodoLabel:raw,periodoId:raw});
        if(approval&&approval.periodType){return approval.periodType;}
      }
    }catch(error){}
    var n=norm(raw);
    var regular=(n.indexOf("octubre")>=0&&n.indexOf("marzo")>=0)||(n.indexOf("abril")>=0&&n.indexOf("septiembre")>=0)||/20\d{2}[-_/ ]?10.*20\d{2}[-_/ ]?03/.test(n)||/20\d{2}[-_/ ]?04.*20\d{2}[-_/ ]?09/.test(n);
    return {id:regular?"REGULAR":"PVC",label:regular?"Regular":"PVC",isRegular:regular,isPVC:!regular,raw:raw};
  }
  function normalizeValue(value){
    var raw=text(value);var n=norm(raw);
    if(!raw){return "";}
    if(raw===VALUES.complexivo||n.indexOf("complexivo")>=0){return VALUES.complexivo;}
    if(raw===VALUES.trabajo||n.indexOf("trabajo")>=0||n.indexOf("titulacion")>=0||n.indexOf("tesis")>=0){return VALUES.trabajo;}
    if(raw===VALUES.articulo||n.indexOf("articulo")>=0||n.indexOf("academico")>=0){return VALUES.articulo;}
    return raw;
  }
  function labelOf(value){value=normalizeValue(value);return LABELS[value]||text(value)||"Sin modalidad";}
  function storageKey(row){return [rowId(row),periodOf(row)].join("|");}
  function readStorage(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};}catch(error){return {};}}
  function writeStorage(map){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(map||{}));}catch(error){}}
  function savedFromStorage(row){return normalizeValue(readStorage()[storageKey(row)]);}
  function savedFromRow(row){
    row=row||{};
    return normalizeValue(row._modalidadTitulacion||row.modalidadTitulacion||row.ModalidadTitulacion||row.modalidad||row.Modalidad||row.tipoTitulacion||row.TipoTitulacion||row._raw&&(row._raw._modalidadTitulacion||row._raw.modalidadTitulacion||row._raw.ModalidadTitulacion||row._raw.modalidad||row._raw.Modalidad));
  }
  function defaultFor(row){var type=classifyPeriod(periodOf(row));return type.isPVC||type.id==="PVC"?VALUES.articulo:VALUES.complexivo;}
  function options(row){
    var type=classifyPeriod(periodOf(row));
    if(type.isPVC||type.id==="PVC"){return [{value:VALUES.articulo,label:LABELS[VALUES.articulo],locked:true}];}
    return [{value:VALUES.complexivo,label:LABELS[VALUES.complexivo],locked:false},{value:VALUES.trabajo,label:LABELS[VALUES.trabajo],locked:false}];
  }
  function current(row){
    row=row||{};var type=classifyPeriod(periodOf(row));var locked=!!(type.isPVC||type.id==="PVC");
    var savedRow=savedFromRow(row);var savedLocal=savedFromStorage(row);var value=locked?VALUES.articulo:(savedRow||savedLocal||defaultFor(row));
    return {value:value,label:labelOf(value),source:savedRow?"guardado":savedLocal?"local":"automático",locked:locked,periodType:type,options:options(row)};
  }
  function patchRow(row,value){
    if(!row){return;}
    row._modalidadTitulacion=value;row.modalidadTitulacion=value;
    if(row._raw&&typeof row._raw==="object"){row._raw._modalidadTitulacion=value;row._raw.modalidadTitulacion=value;}
  }
  function saveStorage(row,value){var map=readStorage();map[storageKey(row)]=value;writeStorage(map);}
  function persist(row,value){
    var con=connector();var id=rowId(row);var periodoId=periodOf(row);
    if(!con||typeof con.updateStudent!=="function"){
      try{window.dispatchEvent(new CustomEvent("ficha:modalidad-save-error",{detail:{ok:false,source:"ConFicha",id:id,error:"ConFicha.updateStudent no está disponible."}}));}catch(error){}
      return;
    }
    Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){
      if(status&&status.ok===false){throw new Error(status.error||"ConFicha no está listo.");}
      return con.updateStudent(id,{modalidadTitulacion:value,_modalidadTitulacion:value,actualizadoEn:new Date().toISOString()},{periodoId:periodoId,periodId:periodoId,source:"ficha.modalidad"});
    }).then(function(saved){
      try{window.dispatchEvent(new CustomEvent("ficha:modalidad-saved",{detail:{ok:true,source:"ConFicha",id:id,periodoId:periodoId,value:value,saved:saved||null}}));}catch(error){}
    }).catch(function(error){
      try{window.dispatchEvent(new CustomEvent("ficha:modalidad-save-error",{detail:{ok:false,source:"ConFicha",id:id,periodoId:periodoId,value:value,error:error.message||String(error)}}));}catch(innerError){}
    });
  }
  function save(row,value){
    row=row||{};var info=current(row);var selected=normalizeValue(value||info.value||defaultFor(row));
    if(info.locked){selected=VALUES.articulo;}
    if(!options(row).some(function(item){return item.value===selected;})){selected=defaultFor(row);}
    patchRow(row,selected);saveStorage(row,selected);persist(row,selected);
    return {value:selected,label:labelOf(selected),source:"ConFicha",locked:info.locked,periodType:info.periodType,savedInRepo:true};
  }

  window.FichaModalidad={
    version:"2.0.0-conficha-only",VALUES:VALUES,LABELS:LABELS,current:current,options:options,
    save:save,labelOf:labelOf,normalizeValue:normalizeValue,classifyPeriod:classifyPeriod
  };
})(window);