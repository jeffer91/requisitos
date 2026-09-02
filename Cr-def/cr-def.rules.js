/* =========================================================
Nombre completo: cr-def.rules.js
Ruta: /Cr-def/cr-def.rules.js
Función:
- Consumir la regla única BDLDefenseEligibility.
- Determinar aptitud ordinaria, supletorio o defensa ya aprobada.
- Mantener un respaldo mínimo si el dominio compartido no cargó.
========================================================= */
(function(window){
  "use strict";
  var config=window.CR_DEF_CONFIG||{};
  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function toNumber(value){if(value===null||value===undefined||text(value)==="")return null;var n=Number(text(value).replace(",","."));return Number.isFinite(n)?n:null;}
  function engine(){return window.BDLDefenseEligibility||null;}
  function fallbackNote(record,names){
    var keys=Object.keys(record||{});
    for(var i=0;i<names.length;i+=1){
      var wanted=norm(names[i]).replace(/[^a-z0-9]/g,"");
      for(var j=0;j<keys.length;j+=1){if(norm(keys[j]).replace(/[^a-z0-9]/g,"")===wanted)return toNumber(record[keys[j]]);}
    }
    return null;
  }
  function fallbackEvaluate(record){
    var nart=fallbackNote(record,["Notart","Nart","notaArticulo","nota articulo"]);
    var ndef=fallbackNote(record,["Notdef","Ndef","notaDefensa","nota defensa"]);
    var minArt=Number(config.notaArticuloMinima||7),minDef=Number(config.notaDefensaAprobada||7);
    var required=["Academico","Documentacion","Financiero","PrácticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizaciónDatos"];
    var missing=required.filter(function(key){return norm(record&&record[key])!=="cumple";});
    return {requirementsLoaded:true,requirementsOk:missing.length===0,missingRequirements:missing,nart:nart,ndef:ndef,nfin:null,eligibleForSchedule:missing.length===0&&nart!==null&&nart>=minArt&&(ndef===null||ndef<minDef),intento:ndef!==null&&ndef<minDef?2:1,noteState:ndef!==null&&ndef>=minDef?"APROBADO":"PENDIENTE_DEFENSA"};
  }
  function decision(record){var current=engine();return current&&typeof current.evaluate==="function"?current.evaluate(record||{}):fallbackEvaluate(record||{});}
  function evaluarAptitud(record){
    var d=decision(record),alertas=[],minArt=Number(config.notaArticuloMinima||7),minDef=Number(config.notaDefensaAprobada||7);
    if(d.ndef!==null&&d.ndef>=minDef){
      return {apto:false,estadoClave:"defensa-aprobada",estado:"Defensa aprobada",faltantes:[],alertas:["Ya tiene nota de defensa aprobada."],notaArticulo:d.nart,notaDefensa:d.ndef,intento:1,tipoDefensa:"ORDINARIA"};
    }
    if(d.requirementsLoaded===false){
      return {apto:false,estadoClave:"bloqueado",estado:"Requisitos no cargados",faltantes:[],alertas:["Los requisitos todavía no están cargados."],notaArticulo:d.nart,notaDefensa:d.ndef,intento:d.intento||1,tipoDefensa:d.tipoDefensa||"ORDINARIA"};
    }
    if(!d.requirementsOk)alertas.push("Faltan requisitos: "+(d.missingRequirements||[]).join(", ")+".");
    if(d.nart===null)alertas.push("Falta nota de artículo.");
    else if(d.nart<minArt)alertas.push("Nota de artículo menor a "+minArt+".");
    if(d.ndef!==null&&d.ndef<minDef)alertas.push("Tiene nota de defensa menor a "+minDef+". Debe ir como supletorio / segunda defensa.");
    var apto=d.eligibleForSchedule===true,intento=d.intento||((d.ndef!==null&&d.ndef<minDef)?2:1);
    return {apto:apto,estadoClave:apto?(intento===2?"supletorio":"apto"):"bloqueado",estado:apto?(intento===2?"Supletorio / segunda defensa":"Apto para agendar"):"No apto",faltantes:d.missingRequirements||[],alertas:alertas,notaArticulo:d.nart,notaDefensa:d.ndef,notaFinal:d.nfin,intento:intento,tipoDefensa:intento===2?"SUPLETORIO":"ORDINARIA"};
  }
  function requisitosFaltantes(record){return decision(record).missingRequirements||[];}
  function leerNotaArticulo(record){return decision(record).nart;}
  function leerNotaDefensa(record){return decision(record).ndef;}
  window.CR_DEF_RULES=Object.freeze({evaluarAptitud:evaluarAptitud,requisitosFaltantes:requisitosFaltantes,leerNotaArticulo:leerNotaArticulo,leerNotaDefensa:leerNotaDefensa,helpers:Object.freeze({text:text,norm:norm,toNumber:toNumber})});
})(window);
