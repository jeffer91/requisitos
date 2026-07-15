/* =========================================================
Nombre completo: bl2.config.v3.js
Ruta o ubicación: /BDLocal/bl2.config.v3.js
Función:
- Extender la configuración V2 con evaluaciones_titulacion.
- Mantener todas las tablas existentes sin borrarlas.
- Preparar DB_VERSION 3 para Ncomplex.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-ncomplex";
  var config = window.BL2Config = window.BL2Config || {};
  var stores = config.stores = config.stores || {};

  function text(value){ return String(value == null ? "" : value).trim(); }
  function number(value,fallback){ value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function unique(list){
    var seen = Object.create(null);
    return (Array.isArray(list) ? list : []).map(text).filter(function(item){
      if(!item || seen[item]){ return false; }
      seen[item] = true;
      return true;
    });
  }

  stores.evaluacionesTitulacion = text(stores.evaluacionesTitulacion || "evaluaciones_titulacion");

  config.version = "3";
  config.dbVersion = Math.max(number(config.dbVersion,2),3);
  config.schemaVersion = "3";

  var required = config.dbV2 && Array.isArray(config.dbV2.requiredStores)
    ? config.dbV2.requiredStores.slice()
    : [];
  required.push(stores.evaluacionesTitulacion);
  required = unique(required);

  config.dbV2 = Object.assign({},config.dbV2 || {},{
    requiredStores:required.slice()
  });

  config.dbV3 = Object.assign({},config.dbV3 || {},{
    enabled:true,
    version:3,
    configVersion:VERSION,
    destructive:false,
    addedStores:[stores.evaluacionesTitulacion],
    requiredStores:required.slice(),
    indexes:{
      evaluacionesTitulacion:[
        "periodoId","cedula","periodo_cedula","modalidadTitulacion",
        "estadoEvaluacion","periodo_modalidad","importacionId","updatedAt"
      ]
    },
    updatedAt:new Date().toISOString()
  });

  config.ncomplex = Object.assign({
    defaultModality:"EXAMEN_COMPLEXIVO",
    passingGrade:7,
    pageSize:25,
    formulas:{
      complexivo:{ teorico:0.40,practico:0.60 },
      trabajoTitulacion:{ escrito:0.60,defensa:0.40 }
    }
  },config.ncomplex || {});

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:config-v3-ready",{
      detail:{
        ok:true,
        version:VERSION,
        dbVersion:config.dbVersion,
        store:stores.evaluacionesTitulacion
      }
    }));
  }catch(error){}
})(window);
