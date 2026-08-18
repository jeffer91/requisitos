(function(window){
  "use strict";

  var CHUNK_SIZE=1000;

  function emit(percent,message){
    try{window.dispatchEvent(new CustomEvent("carga:progress",{detail:{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"Normalizando datos",phase:"analysis"}}));}catch(error){}
  }
  function finish(rows,mapped,options){
    var periodoDetectado=window.CargaDetectPeriodo?window.CargaDetectPeriodo.detect(mapped,options.periodoId,options.periodoLabel):{periodoId:options.periodoId||"SIN_PERIODO",periodoLabel:options.periodoLabel||options.periodoId||"Sin período"};
    var carrerasDetectadas=window.CargaDetectCarrera?window.CargaDetectCarrera.detect(mapped):{};
    return {
      origen:options.origen||"",
      detectedType:options.detectedType||"",
      fileName:options.fileName||"",
      periodoDetectado:periodoDetectado,
      carrerasDetectadas:carrerasDetectadas,
      rowsOriginales:rows,
      rowsMapeadas:mapped,
      total:mapped.length,
      createdAt:new Date().toISOString()
    };
  }
  function text(value){return String(value==null?"":value).trim();}
  function ensureName(row){
    row=row||{};
    var current=text(row.nombres||row.Nombres||row.nombre||row.Nombre||row.estudiante||row.Estudiante);
    if(!current){
      row.nombres="PENDIENTE";
      row.Nombres="PENDIENTE";
    }
    return row;
  }
  function normalizeOne(row){
    var mapped=window.CargaFieldMap?window.CargaFieldMap.mapRow(row):row;
    mapped=window.BDLNormCarrera?window.BDLNormCarrera.normalizeRow(mapped):mapped;
    return ensureName(mapped);
  }
  function normalizeRows(rows,options){
    options=options||{};rows=Array.isArray(rows)?rows:[];
    return finish(rows,rows.map(normalizeOne),options);
  }
  function normalizeRowsAsync(rows,options){
    options=options||{};rows=Array.isArray(rows)?rows:[];
    var mapped=new Array(rows.length),index=0;
    return new Promise(function(resolve,reject){
      function step(){
        try{
          var end=Math.min(rows.length,index+CHUNK_SIZE);
          for(;index<end;index+=1){mapped[index]=normalizeOne(rows[index]);}
          emit(55+(index/Math.max(1,rows.length))*20,"Normalizando "+index+" de "+rows.length+" filas");
          if(index<rows.length){window.setTimeout(step,0);}else{resolve(finish(rows,mapped,options));}
        }catch(error){reject(error);}
      }
      step();
    });
  }

  window.CargaNormalizer={version:"2.1.0-pending-name",normalizeRows:normalizeRows,normalizeRowsAsync:normalizeRowsAsync};
})(window);
