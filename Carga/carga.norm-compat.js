/* =========================================================
Nombre completo: carga.norm-compat.js
Ruta o ubicación: /Carga/carga.norm-compat.js
Función o funciones:
- Preparar normalizadores requeridos por los mapeadores de Carga.
- Reutilizar normalizadores del contenedor cuando existan.
- No leer ni escribir BDLocal.
========================================================= */
(function(window){
  "use strict";

  function inherit(name){
    if(window[name]){return window[name];}
    try{
      if(window.parent&&window.parent!==window&&window.parent[name]){
        window[name]=window.parent[name];
        return window[name];
      }
    }catch(error){}
    try{
      if(window.top&&window.top!==window&&window.top[name]){
        window[name]=window.top[name];
        return window[name];
      }
    }catch(error2){}
    return null;
  }

  [
    "BDLNormText","BDLNormPeriodo","BDLNormEstudiante","BDLNormCarrera",
    "BDLNormRequisito","BDLValidatorEstudiante"
  ].forEach(inherit);

  if(!window.BDLNormText){
    window.BDLNormText={
      cleanSpaces:function(value){return String(value==null?"":value).replace(/\u00a0/g," ").replace(/\s+/g," ").trim();},
      upper:function(value){return this.cleanSpaces(value).toUpperCase();},
      key:function(value){return this.cleanSpaces(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");},
      first:function(row,fields){
        row=row||{};fields=Array.isArray(fields)?fields:[];
        var keys=Object.keys(row);var wanted=fields.map(this.key.bind(this));
        for(var index=0;index<keys.length;index+=1){if(wanted.indexOf(this.key(keys[index]))>=0){return this.cleanSpaces(row[keys[index]]);}}
        return "";
      }
    };
  }

  if(!window.BDLNormPeriodo){
    window.BDLNormPeriodo={
      normalize:function(row,selected){
        row=row||{};selected=selected||{};var T=window.BDLNormText;
        var id=selected.periodoCanonicoId||selected.periodoId||selected.id||T.first(row,["periodoId","periodo","periodoLabel","cohorte"]);
        var label=selected.periodoCanonicoLabel||selected.periodoLabel||selected.label||T.first(row,["periodoLabel","periodo","cohorte"])||id;
        id=T.cleanSpaces(id).replace(/_+/g,"__");
        return {periodoId:id||"SIN_PERIODO",periodoLabel:T.cleanSpaces(label)||"Sin período",valid:!!id&&id!=="SIN_PERIODO"};
      },
      isValid:function(periodo){return !!(periodo&&periodo.periodoId&&periodo.periodoId!=="SIN_PERIODO");}
    };
  }

  if(!window.BDLNormEstudiante){
    window.BDLNormEstudiante={
      numero:function(row){return window.BDLNormText.first(row||{},["numeroIdentificacion","identificacion","cedula","cédula","documento"]);},
      normalize:function(row){
        row=Object.assign({},row||{});var T=window.BDLNormText;
        var cedula=T.cleanSpaces(this.numero(row)).replace(/[^0-9A-Za-z]/g,"");
        if(/^\d{9}$/.test(cedula)){cedula="0"+cedula;}
        var periodo=window.BDLNormPeriodo.normalize(row,{periodoId:row.periodoCanonicoId||row.periodoId||row.PeriodoId||"",periodoLabel:row.periodoCanonicoLabel||row.periodoLabel||row.Periodo||""});
        return {persona:{numeroIdentificacion:cedula,nombres:T.first(row,["nombres","nombre","estudiante","alumno"])},periodo:periodo,detalle:Object.assign({},row,{numeroIdentificacion:cedula,cedula:cedula,periodoId:periodo.periodoId,periodoLabel:periodo.periodoLabel})};
      }
    };
  }

  if(!window.BDLNormCarrera){
    window.BDLNormCarrera={
      normalize:function(nombre,codigo){
        var T=window.BDLNormText;var cleanName=T.upper(nombre);var cleanCode=T.upper(codigo);
        return {nombre:cleanName||cleanCode,codigo:cleanCode,key:T.key(cleanCode||cleanName)};
      },
      normalizeRow:function(row){
        row=Object.assign({},row||{});var T=window.BDLNormText;
        var info=this.normalize(T.first(row,["nombreCarrera","NombreCarrera","carrera","Carrera","programa"]),T.first(row,["codigoCarrera","CodigoCarrera","CódigoCarrera","codCarrera"]));
        if(info.nombre){row.nombreCarrera=info.nombre;row.NombreCarrera=info.nombre;}
        if(info.codigo){row.codigoCarrera=info.codigo;row.CodigoCarrera=info.codigo;}
        return row;
      }
    };
  }

  window.CargaNormCompat={version:"1.0.0",ready:true};
})(window);