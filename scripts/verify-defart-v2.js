"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const connectorFile="BDLocal/conexiones/cone.defart.js";
const bridgeFile="defart/defart.save-service-bridge.js";
const bootstrapFile="defart/defart.bootstrap.js";
const eligibilityFile="BDLocal/rules/bdl.rules.defense-eligibility.js";
const coreFile="defart/defart.core.js";
const tableFile="defart/defart.table.js";
const guardFile="defart/defart.requirements-guard.js";
const serviceFile="BDLocal/services/bdl.service.defensas.js";
[connectorFile,bridgeFile,bootstrapFile,eligibilityFile,coreFile,tableFile,guardFile,serviceFile].forEach(syntax);

const connector=read(connectorFile);
const bootstrap=read(bootstrapFile);
const bridgeSource=read(bridgeFile);
const coreSource=read(coreFile);
const tableSource=read(tableFile);
const guardSource=read(guardFile);
const serviceSource=read(serviceFile);
const defartHtml=read("defart/defart.html");
const compactCss=read("defart/defart.compact.css");
const maquetaCore=read("Maqueta/maq-core.js");
check(connector.includes('return {periodoId:periodoId,cedula:cedula,localId:cedula&&periodoId?cedula+"__"+periodoId'),"ConDefart debe construir la clave local cédula__período");
check(connector.includes('baseChange("notas_titulacion"'),"ConDefart debe crear cambios específicos de notas");
check(connector.includes('baseChange("historial"'),"ConDefart debe crear cambios de historial");
check(connector.includes('estadoSheets:"SINCRONIZADO"'),"Defart no debe crear pendientes para Sheets");
check(connector.includes('estadoSupabase:"SINCRONIZADO"'),"Defart no debe crear pendientes para Supabase");
check(connector.includes('estadoFirebase:"PENDIENTE"'),"Defart debe crear pendientes para Firebase");
check(!bootstrap.includes("defart.persistence.js"),"Defart no debe cargar el mirror antiguo duplicado");
check(bridgeSource.includes("N-ART bloqueada:"),"El guardado rechaza N-ART con requisitos previos pendientes.");
check(coreSource.includes("var canArt = requirementsOk;"),"El núcleo debe verificar los ocho requisitos antes de habilitar N-ART.");
check(tableSource.includes('var enabled = isArt ? shown._canArt === true : shown._canDef === true;'),"La tabla debe respetar la elegibilidad de ambas notas.");
check(guardSource.includes("_canArt: false"),"N-ART se deshabilita cuando los requisitos no están cargados.");
check(serviceSource.includes("function firstRecordedNote(")&&!serviceSource.includes("row.Notart ||"),"El estado de notas debe conservar ceros sin usar OR lógico.");
check((defartHtml.match(/id="def-btn-save"/g)||[]).length===1&&defartHtml.includes('class="def-inline-save"'),"El botón de guardado debe aparecer una sola vez.");
check(!compactCss.includes(".def-floating-save")&&compactCss.includes(".def-inline-save"),"No debe quedar el botón flotante superpuesto.");
check((maquetaCore.match(/status\("Pantalla activa: "\+module.nombre\);syncPeriodGlobal\(item.iframe\)/g)||[]).length===2,"La navegación debe indicar la pantalla activa en ambos recorridos.");

const tableSandbox={console,document:{}};
tableSandbox.window=tableSandbox;
new vm.Script(read(tableFile),{filename:tableFile}).runInContext(vm.createContext(tableSandbox));
const supletorioWithPending=tableSandbox.DefartTable.statePill({
  _estadoDefensa:"Supletorio Art",_requirementsLoaded:true,_requirementsOk:false,_missingRequirements:["Financiero"]
});
check(supletorioWithPending.includes("Supletorio Art")&&supletorioWithPending.includes("def-requirement-mini"),"Supletorio Art debe ser visible aunque falten requisitos.");
const incomplete=tableSandbox.DefartTable.statePill({
  _estadoDefensa:"Sin requisitos",_requirementsLoaded:true,_requirementsOk:false
});
check(incomplete.includes("Req. incompletos"),"El estado real de requisitos incompletos se conserva.");
const noteHelpers=serviceSource.slice(serviceSource.indexOf("  function firstRecordedNote("),serviceSource.indexOf("  function estadoLabel(estado){"));
const noteStatus=new vm.Script(noteHelpers+"\nnotaEstado", {filename:"verify-defart-v2:notes-status"}).runInNewContext({
  text:value=>String(value==null?"":value).trim(),
  numberOrNull:value=>value==null||String(value).trim()===""?null:Number(value)
});
check(noteStatus({Notart:0})==="ARTICULO_NO_APROBADO","N-ART 0 no es ausencia de nota.");
check(noteStatus({Notart:0,Nart:9})==="ARTICULO_NO_APROBADO","N-ART 0 prevalece sobre alias.");
check(noteStatus({Notart:8,Notdef:0})==="DEFENSA_NO_APROBADA","N-DEF 0 es defensa reprobada.");
check(noteStatus({Notart:null})==="SIN_ARTICULO","La falta de nota sigue siendo pendiente.");


const eligibilitySandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set};
eligibilitySandbox.window=eligibilitySandbox;
const eligibilityContext=vm.createContext(eligibilitySandbox);
new vm.Script(read(eligibilityFile),{filename:eligibilityFile}).runInContext(eligibilityContext);
const blockedByRequirements=eligibilitySandbox.BDLDefenseEligibility.evaluate({
  tipoPeriodo:"PVC",
  Notart:8,
  Academico:"CUMPLE",
  Documentacion:"PENDIENTE",
  Financiero:"PENDIENTE"
});
check(blockedByRequirements.canArt===false,"N-ART debe bloquearse si falta documentación u otro requisito previo.");
check(blockedByRequirements.canDef===false,"N-DEF debe permanecer bloqueada si faltan requisitos.");
check(blockedByRequirements.stateLabel==="Sin requisitos","Con N-ART >=7 y requisitos pendientes debe conservar estado Sin requisitos.");

const failedArticle=eligibilitySandbox.BDLDefenseEligibility.evaluate({
  tipoPeriodo:"PVC",
  Notart:6.5
});
check(failedArticle.canArt===false&&failedArticle.stateLabel==="Sin requisitos","Una N-ART histórica <7 no habilita nuevas notas si faltan requisitos.");
const readyStudent={tipoPeriodo:"REGULAR",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE","PrácticasVinculacion":"CUMPLE",Vinculacion:"CUMPLE",SeguimientoGraduados:"CUMPLE",Ingles:"CUMPLE","ActualizaciónDatos":"CUMPLE",Titulacion:"PENDIENTE"};
const onlyTitulacionMissing=eligibilitySandbox.BDLDefenseEligibility.evaluate(readyStudent);
check(onlyTitulacionMissing.canArt===true&&onlyTitulacionMissing.canDef===false&&onlyTitulacionMissing.requirementsOk===true,"Solo Titulación pendiente permite N-ART.");
const approvedArticle=eligibilitySandbox.BDLDefenseEligibility.evaluate(Object.assign({},readyStudent,{Notart:8}));
check(approvedArticle.canArt===true&&approvedArticle.canDef===true,"N-ART >=7 y ocho requisitos completos habilitan N-DEF.");
const zeroArticle=eligibilitySandbox.BDLDefenseEligibility.evaluate(Object.assign({},readyStudent,{Notart:0}));
check(zeroArticle.canArt===true&&zeroArticle.canDef===false&&zeroArticle.stateLabel==="Supletorio Art","N-ART 0 se conserva como nota válida de supletorio.");
const unloaded=eligibilitySandbox.BDLDefenseEligibility.evaluate(Object.assign({},readyStudent,{_bdlRequirementsLoaded:false}));
check(unloaded.canArt===false&&unloaded.canDef===false,"Sin requisitos cargados ninguna nota se habilita.");

const calls=[];
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent:function(type,options){this.type=type;this.detail=options&&options.detail||{};},
  dispatchEvent(){},
  DefartCore:{saveNotes(){return Promise.resolve(true);}},
  DefartApp:{getState(){return {data:{rows:[{
    idEstudiantePeriodo:"2026-04__2026-09__1723456789",
    periodoId:"2026-04__2026-09",cedula:"1723456789",Notart:8.5,Notdef:8,
    tipoPeriodo:"REGULAR",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE","PrácticasVinculacion":"CUMPLE",Vinculacion:"CUMPLE",SeguimientoGraduados:"CUMPLE",Ingles:"CUMPLE","ActualizaciónDatos":"CUMPLE",Titulacion:"PENDIENTE"
  }]}};}},
  BDLDefenseEligibility:eligibilitySandbox.BDLDefenseEligibility,
  ConDefart:{save(note,options){calls.push({note:{...note},options:{...options}});return Promise.resolve(note);}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
new vm.Script(read(bridgeFile),{filename:bridgeFile}).runInContext(context);

(async()=>{
  const note=sandbox.DefartSaveServiceBridge.notaFromChange({id:"2026-04__2026-09__1723456789",ndef:9});
  check(note.idEstudiantePeriodo==="1723456789__2026-04__2026-09","El puente debe convertir un ID remoto/legacy a la clave local");
  check(note.Notart===8.5&&note.Notdef===9&&note.Notafinal===8.65,"El puente debe calcular correctamente la nota final 70/30");
  const result=await sandbox.DefartSaveServiceBridge.saveDirect([{id:"2026-04__2026-09__1723456789",ndef:9}]);
  check(result.ok===true&&calls.length===1,"Defart debe esperar y confirmar el guardado mediante ConDefart");
  check(calls[0].options.enqueue===true,"Defart debe solicitar la creación del cambio Firebase");
  const invalidRow=Object.assign({},readyStudent,{Documentacion:"PENDIENTE",idEstudiantePeriodo:"1723456790__2026-04__2026-09",periodoId:"2026-04__2026-09",cedula:"1723456790"});
  sandbox.DefartApp.getState=()=>({data:{rows:[invalidRow]}});
  const blocked=await sandbox.DefartSaveServiceBridge.saveDirect([{id:"1723456790__2026-04__2026-09",nart:9}]).then(()=>false,()=>true);
  check(blocked&&calls.length===1,"Guardado directo impide registrar N-ART sin documentación.");

  if(errors.length){
    console.error("\nVERIFICACIÓN DEFART V2: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DEFART V2: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DEFART V2: ERROR",error);
  process.exit(1);
});
