/* =========================================================
Nombre completo: ficha.modalidad.js
Ruta o ubicación: /Ficha/ficha.modalidad.js
Función o funciones:
- Calcular la modalidad disponible según el tipo de período.
- Fijar Artículo Académico para estudiantes PVC.
- Permitir Complexivo o Trabajo de Titulación en períodos regulares.
- Guardar exclusivamente mediante ConFicha.updateGraduationModality.
- Esperar la confirmación del conector antes de actualizar la interfaz.
Con qué se conecta:
- ficha.core.js
- ficha.modalidad-ui.js
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
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}

  function rowId(row){
    row=row||{};
    return text(row.idEstudiantePeriodo||row.studentId||row.id||row._id||row._cedula||row.cedula||row.numeroIdentificacion||row.Cedula||row.NumeroIdentificacion||row.docId||row._docId);
  }

  function periodOf(row){
    row=row||{};
    return text(row._periodoId||row.periodoId||row.periodId||row.ultimoPeriodoId||row.periodoCanonicoId||row._periodo||row.periodoLabel||row.periodo||row.Periodo);
  }

  function periodLabelOf(row){
    row=row||{};
    return text(row._periodoNormalizado||row.periodoCanonicoLabel||row.periodoLabel||row._periodo||row.periodo||row.Periodo||periodOf(row));
  }

  function explicitPeriodType(row){
    row=row||{};
    var raw=row._raw&&typeof row._raw==="object"?row._raw:{};
    var value=text(
      row.tipoPeriodo||row.periodType||row.periodoTipo||row._tipoPeriodo||
      raw.tipoPeriodo||raw.periodType||raw.periodoTipo||raw._tipoPeriodo||""
    );
    var n=norm(value);
    if(n.indexOf("pvc")>=0){return "PVC";}
    if(n.indexOf("regular")>=0){return "REGULAR";}
    return "";
  }

  function classifyPeriod(value,row){
    var explicit=explicitPeriodType(row);
    if(explicit){return {id:explicit,label:explicit==="PVC"?"PVC":"Regular",isRegular:explicit==="REGULAR",isPVC:explicit==="PVC",raw:text(value)};}

    var raw=text(value);
    try{
      if(window.FichaCore&&typeof window.FichaCore.studentApproval==="function"){
        var candidate=Object.assign({},row||{},{_periodo:raw,periodo:raw,periodoLabel:periodLabelOf(row)||raw,periodoId:raw});
        var approval=window.FichaCore.studentApproval(candidate);
        if(approval&&approval.periodType&&approval.periodType.id){return approval.periodType;}
      }
    }catch(error){}

    var n=norm([raw,periodLabelOf(row)].join(" "));
    if(n.indexOf("pvc")>=0){return {id:"PVC",label:"PVC",isRegular:false,isPVC:true,raw:raw};}

    var regular=(n.indexOf("octubre")>=0&&n.indexOf("marzo")>=0)||
      (n.indexOf("abril")>=0&&n.indexOf("septiembre")>=0)||
      /20\d{2}[-_/ ]?10.*20\d{2}[-_/ ]?03/.test(n)||
      /20\d{2}[-_/ ]?04.*20\d{2}[-_/ ]?09/.test(n);

    return {id:regular?"REGULAR":"PVC",label:regular?"Regular":"PVC",isRegular:regular,isPVC:!regular,raw:raw};
  }

  function normalizeValue(value){
    var raw=text(value);var n=norm(raw);
    if(!raw){return "";}
    if(raw===VALUES.complexivo||n.indexOf("complexivo")>=0){return VALUES.complexivo;}
    if(raw===VALUES.trabajo||n.indexOf("trabajo")>=0||n.indexOf("tesis")>=0){return VALUES.trabajo;}
    if(raw===VALUES.articulo||n.indexOf("articulo")>=0){return VALUES.articulo;}
    return "";
  }

  function labelOf(value){value=normalizeValue(value);return LABELS[value]||text(value)||"Sin modalidad";}
  function storageKey(row){return [rowId(row),periodOf(row)].join("|");}
  function readStorage(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};}catch(error){return {};}}
  function writeStorage(map){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(map||{}));}catch(error){}}
  function savedFromStorage(row){return normalizeValue(readStorage()[storageKey(row)]);}

  function savedFromRow(row){
    row=row||{};
    return normalizeValue(
      row._modalidadTitulacion||row.modalidadTitulacion||row.ModalidadTitulacion||row.modalidad||row.Modalidad||row.tipoTitulacion||row.TipoTitulacion||
      (row._raw&&(row._raw._modalidadTitulacion||row._raw.modalidadTitulacion||row._raw.ModalidadTitulacion||row._raw.modalidad||row._raw.Modalidad))
    );
  }

  function defaultFor(row){
    var type=classifyPeriod(periodOf(row),row);
    return type.isPVC||type.id==="PVC"?VALUES.articulo:VALUES.complexivo;
  }

  function options(row){
    var type=classifyPeriod(periodOf(row),row);
    if(type.isPVC||type.id==="PVC"){
      return [{value:VALUES.articulo,label:LABELS[VALUES.articulo],locked:true}];
    }
    return [
      {value:VALUES.complexivo,label:LABELS[VALUES.complexivo],locked:false},
      {value:VALUES.trabajo,label:LABELS[VALUES.trabajo],locked:false}
    ];
  }

  function current(row){
    row=row||{};
    var type=classifyPeriod(periodOf(row),row);
    var locked=!!(type.isPVC||type.id==="PVC");
    var savedRow=savedFromRow(row);
    var savedLocal=savedFromStorage(row);
    var value=locked?VALUES.articulo:(savedRow||savedLocal||defaultFor(row));
    return {
      value:value,
      label:labelOf(value),
      source:savedRow?"guardado":savedLocal?"local":"automático",
      locked:locked,
      periodType:type,
      options:options(row)
    };
  }

  function patchRow(row,value){
    if(!row){return;}
    row._modalidadTitulacion=value;
    row.modalidadTitulacion=value;
    if(row._raw&&typeof row._raw==="object"){
      row._raw._modalidadTitulacion=value;
      row._raw.modalidadTitulacion=value;
    }
  }

  function saveStorage(row,value){
    var map=readStorage();
    map[storageKey(row)]=value;
    writeStorage(map);
  }

  function save(row,value){
    row=row||{};
    var info=current(row);
    var selected=normalizeValue(value||info.value||defaultFor(row));
    var con=connector();
    var id=rowId(row);
    var periodoId=periodOf(row);

    if(info.locked){selected=VALUES.articulo;}
    if(!options(row).some(function(item){return item.value===selected;})){selected=defaultFor(row);}

    if(!id){return Promise.reject(new Error("No se pudo identificar al estudiante."));}
    if(!con||typeof con.updateGraduationModality!=="function"){
      return Promise.reject(new Error("ConFicha.updateGraduationModality no está disponible."));
    }

    emit("ficha:modalidad-saving",{ok:true,source:"ConFicha",id:id,periodoId:periodoId,value:selected});

    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){
      if(status&&status.ok===false){throw new Error(status.error||"ConFicha no está listo.");}
      return con.updateGraduationModality(id,selected,{
        periodoId:periodoId,
        periodId:periodoId,
        periodoLabel:periodLabelOf(row),
        periodType:info.periodType,
        isPVC:info.locked,
        isRegular:!info.locked,
        cedula:row._cedula||row.cedula||row.numeroIdentificacion||"",
        source:"ficha.modalidad"
      });
    }).then(function(result){
      if(!result||result.ok!==true){throw new Error("ConFicha no confirmó la modalidad.");}
      selected=normalizeValue(result.value||selected);
      patchRow(row,selected);
      saveStorage(row,selected);

      var response={
        ok:true,
        value:selected,
        label:labelOf(selected),
        source:"ConFicha",
        locked:info.locked,
        periodType:info.periodType,
        savedInRepo:true,
        result:result
      };

      emit("ficha:modalidad-saved",response);
      return response;
    }).catch(function(error){
      emit("ficha:modalidad-save-error",{
        ok:false,
        source:"ConFicha",
        id:id,
        periodoId:periodoId,
        value:selected,
        error:error&&error.message?error.message:String(error)
      });
      throw error;
    });
  }

  window.FichaModalidad={
    version:"3.0.0-conficha-confirmed",
    VALUES:VALUES,
    LABELS:LABELS,
    current:current,
    options:options,
    save:save,
    labelOf:labelOf,
    normalizeValue:normalizeValue,
    classifyPeriod:classifyPeriod
  };
})(window);