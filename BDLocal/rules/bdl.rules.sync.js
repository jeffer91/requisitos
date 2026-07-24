/* =========================================================
Archivo: bdl.rules.sync.js
Ruta: /BDLocal/rules/bdl.rules.sync.js
Función:
- Preparar cambios pendientes por destino.
- Usar Firebase como destino operativo predeterminado.
- Mantener Google Sheets y Supabase sincronizados salvo solicitud explícita.
- Evitar el modelo inseguro de sincronizado:true único.
========================================================= */
(function(window){
  "use strict";

  var Rules=window.BDLRules;
  if(!Rules){return;}

  function text(value){return String(value==null?"":value).trim();}
  function upper(value){return text(value).toUpperCase();}
  function safeJson(value){try{return JSON.stringify(value||{});}catch(error){return "{}";}}
  function hash(value){var raw=safeJson(value),h=0;for(var i=0;i<raw.length;i+=1){h=((h<<5)-h)+raw.charCodeAt(i);h|=0;}return String(h);}
  function changeId(row,action,table){
    row=row||{};
    return [text(table||row.tabla||"registro"),text(action||row.accion||"UPSERT"),text(row.periodoId||"global"),text(row.cedula||row.registroId||row.id||"sin_id"),Date.now(),Math.random().toString(16).slice(2)].join("__");
  }
  function list(value){
    if(Array.isArray(value)){return value.map(function(item){return text(item).toLowerCase();}).filter(Boolean);}
    return text(value).split(/[\s,;|]+/).map(function(item){return item.toLowerCase();}).filter(Boolean);
  }
  function explicitTarget(row,options,target){
    row=row||{};options=options||{};target=target.toLowerCase();
    var names=list(options.targets||options.target||row.targets||row.target||row.destinos||row.destino);
    if(target==="google"){return names.some(function(name){return name==="google"||name==="sheets"||name==="google_sheets";});}
    if(target==="firebase"){return names.some(function(name){return name==="firebase"||name==="firestore";});}
    return names.some(function(name){return name==="supabase";});
  }
  function hasOwn(row,names){return names.some(function(name){return Object.prototype.hasOwnProperty.call(row||{},name);});}
  function defaultStatus(row,options,target){
    if(target==="firebase"){
      if(hasOwn(row,["estadoFirebase","statusFirebase"])){
        return text(row.estadoFirebase||row.statusFirebase||"PENDIENTE");
      }
      return explicitTarget(row,options,"firebase")||!list(options.targets||options.target||row.targets||row.target).length?"PENDIENTE":"SINCRONIZADO";
    }
    if(target==="google"){
      if(hasOwn(row,["estadoSheets","statusGoogle"])){
        return text(row.estadoSheets||row.statusGoogle||"SINCRONIZADO");
      }
      return explicitTarget(row,options,"google")?"PENDIENTE":"SINCRONIZADO";
    }
    if(hasOwn(row,["estadoSupabase","statusSupabase"])){
      return text(row.estadoSupabase||row.statusSupabase||"SINCRONIZADO");
    }
    return explicitTarget(row,options,"supabase")?"PENDIENTE":"SINCRONIZADO";
  }
  function build(row,options){
    row=row||{};options=options||{};
    var table=text(options.tabla||options.table||row.tabla||"registro");
    var action=text(options.accion||options.action||"UPSERT").toUpperCase();
    var registroId=text(options.registroId||row.idEstudiantePeriodo||row.id||row.cedula||"");
    var payload=options.payload||row;
    var id=text(row.id||row.cambioId||changeId(row,action,table));
    var firebaseStatus=defaultStatus(row,options,"firebase");
    var sheetsStatus=defaultStatus(row,options,"google");
    var supabaseStatus=defaultStatus(row,options,"supabase");

    return {
      id:id,cambioId:id,
      periodoId:text(row.periodoId||options.periodoId||""),
      cedula:text(row.cedula||options.cedula||""),
      tabla:table,registroId:registroId,accion:action,payload:payload,
      hash:hash(payload),prioridad:Number(options.prioridad||options.priority||4),
      source:text(options.source||row.origen||"local"),
      schemaVersion:text(options.schemaVersion||"1"),
      createdAt:text(row.createdAt||"")||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      estadoFirebase:firebaseStatus,statusFirebase:firebaseStatus,
      estadoSupabase:supabaseStatus,statusSupabase:supabaseStatus,
      estadoSheets:sheetsStatus,statusGoogle:sheetsStatus,
      intentosFirebase:Number(row.intentosFirebase||0),
      intentosSupabase:Number(row.intentosSupabase||0),
      intentosSheets:Number(row.intentosSheets||0),
      ultimoErrorFirebase:text(row.ultimoErrorFirebase||""),
      ultimoErrorSupabase:text(row.ultimoErrorSupabase||""),
      ultimoErrorSheets:text(row.ultimoErrorSheets||""),
      sincronizadoEnFirebase:text(row.sincronizadoEnFirebase||""),
      sincronizadoEnSupabase:text(row.sincronizadoEnSupabase||""),
      sincronizadoEnSheets:text(row.sincronizadoEnSheets||""),
      firebaseOfficialDefault:true
    };
  }
  function apply(payload,context){context=context||{};return Array.isArray(payload)?payload.map(function(row){return build(row,context);}):build(payload||{},context);}

  Rules.register("sync.change",apply);
  window.BDLRulesSync={version:"2.0.0-firebase-default",hash:hash,build:build,apply:apply,explicitTarget:explicitTarget,defaultStatus:defaultStatus};
})(window);
