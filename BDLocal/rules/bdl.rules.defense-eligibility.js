/* =========================================================
Nombre completo: bdl.rules.defense-eligibility.js
Ruta: /BDLocal/rules/bdl.rules.defense-eligibility.js
Función:
- Ser la regla única de elegibilidad para Defensas y Cr-def.
- Resolver requisitos aplicables por estudiante/período.
- Normalizar equivalentes de CUMPLE.
- Unificar N-ART, N-DEF, N-FIN y supletorio.
========================================================= */
(function(window){
  "use strict";
  var VERSION="1.1.0-nart-independent-requirements";
  var BASE=[
    {key:"academico",label:"Académico",aliases:["academico","académico","Academico","Académico"]},
    {key:"documentacion",label:"Documentación",aliases:["documentacion","documentación","Documentacion","Documentación","documentos"]},
    {key:"financiero",label:"Financiero",aliases:["financiero","Financiero","pago","pagos"]},
    {key:"practicasvinculacion",label:"Prácticas",aliases:["practicasvinculacion","PrácticasVinculacion","PracticasVinculacion","practicas","prácticas"]},
    {key:"vinculacion",label:"Vinculación",aliases:["vinculacion","vinculación","Vinculacion","Vinculación"]},
    {key:"seguimientograduados",label:"Seguimiento graduados",aliases:["seguimientograduados","SeguimientoGraduados","seguimiento graduados","seguimiento"]},
    {key:"ingles",label:"Inglés",aliases:["ingles","inglés","Ingles","Inglés"]},
    {key:"actualizaciondatos",label:"Actualización de datos",aliases:["actualizaciondatos","ActualizacionDatos","ActualizaciónDatos","actualizacion de datos","actualización de datos"]}
  ];
  var EXTRA=[{key:"titulacion",label:"Titulación",aliases:["titulacion","titulación","Titulacion","Titulación"]}];
  var OK=["cumple","aprobado","aprobada","si","sí","s","ok","1","true","x","validado","validada","completo","completa"];

  function text(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
  function compact(v){return norm(v).replace(/[^a-z0-9]+/g,"");}
  function numberOrNull(v){if(v===null||v===undefined||text(v)==="")return null;var n=Number(text(v).replace(",","."));return Number.isFinite(n)?Math.max(0,Math.min(10,Math.round(n*100)/100)):null;}
  function round2(v){return Number.isFinite(v)?Math.round(v*100)/100:null;}
  function external(){return window.BL2RequirementsEngine||window.StatsRules||null;}
  function periodRaw(row){row=row||{};return text(row.tipoPeriodo||row.periodType||row.periodoTipo||row._tipoPeriodo||row.clasificacionPeriodo||row._bl2Periodo||row.periodoLabel||row.periodo||row.Periodo||row.periodoId||row.periodId);}
  function classifyPeriod(row){
    var explicit=norm(row&&(row.tipoPeriodo||row.periodType||row.periodoTipo||row._tipoPeriodo||row.clasificacionPeriodo||""));
    if(/\bpvc\b/.test(explicit))return {id:"PVC",source:"explicit",raw:periodRaw(row)};
    if(/regular/.test(explicit))return {id:"REGULAR",source:"explicit",raw:periodRaw(row)};
    var e=external();try{if(e&&typeof e.classifyStudent==="function"){var x=e.classifyStudent(row||{}),id=norm(x&&x.id).toUpperCase();if(id==="REGULAR"||id==="PVC")return {id:id,source:"engine",raw:periodRaw(row)};}}catch(error){}
    var raw=periodRaw(row);
    if(/\bpvc\b/i.test(raw))return {id:"PVC",source:"label",raw:raw};
    if(/regular/i.test(raw))return {id:"REGULAR",source:"label",raw:raw};
    var nums=[];String(raw).replace(/(20\d{2})\D{0,5}(0?[1-9]|1[0-2])/g,function(_,y,m){nums.push(Number(m));});
    var r=(nums.indexOf(10)>=0&&nums.indexOf(3)>=0)||(nums.indexOf(4)>=0&&nums.indexOf(9)>=0);
    return {id:r?"REGULAR":"UNKNOWN",source:r?"known-pattern":"unknown",raw:raw};
  }
  function normReq(req){req=req||{};var key=text(req.key||req.requisitoKey||req.id||req.campo||req.nombre||req.label);var known=BASE.concat(EXTRA).find(function(item){return compact(item.key)===compact(key)||compact(item.label)===compact(key)||item.aliases.some(function(a){return compact(a)===compact(key);});});return known?Object.assign({},known):{key:key||"requisito",label:text(req.label||req.requisitoLabel||req.nombre||key||"Requisito"),aliases:[key,req.label,req.requisitoLabel,req.nombre].filter(Boolean)};}
  function requirementsForStudent(row){
    var e=external();try{if(e&&typeof e.requirementsForStudent==="function"){var list=e.requirementsForStudent(row||{});if(Array.isArray(list)&&list.length)return list.map(normReq);}}catch(error){}
    return BASE.concat(classifyPeriod(row).id==="REGULAR"?EXTRA:[]).map(function(x){return Object.assign({},x,{aliases:x.aliases.slice()});});
  }
  function flat(row){
    row=row||{};var map={};Object.keys(row).forEach(function(k){var n=compact(k);if(n&&!Object.prototype.hasOwnProperty.call(map,n))map[n]=row[k];});
    [row._requirementValues,row.requirementValues,row.requisitos,row.requirements,row._requirements].forEach(function(c){
      if(!c)return;
      if(Array.isArray(c)){c.forEach(function(item){item=item||{};var k=item.requisitoKey||item.key||item.requisitoLabel||item.nombreRequisito||item.nombre||item.label||item.campo;var v=item.estado||item.estadoKey||item.valor||item.value||item.status||item.cumple;if(k)map[compact(k)]=v;});}
      else if(typeof c==="object"){Object.keys(c).forEach(function(k){map[compact(k)]=c[k];});}
    });return map;
  }
  function valueOf(row,reqOrKey){var req=typeof reqOrKey==="object"?normReq(reqOrKey):normReq({key:reqOrKey}),aliases=[req.key,req.label].concat(req.aliases||[]),map=flat(row);for(var i=0;i<aliases.length;i++){var k=compact(aliases[i]);if(k&&map[k]!==undefined&&text(map[k])!=="")return map[k];}var e=external();try{if(e&&typeof e.valueOf==="function"){var v=e.valueOf(row||{},req.key);if(text(v)!=="")return v;}}catch(error){}return "";}
  function isApproved(v){return OK.indexOf(norm(v))>=0;}
  function requirementSummary(row){
    if(row&&row._bdlRequirementsLoaded===false)return {ok:false,loaded:false,missing:[],values:{},total:0,periodType:classifyPeriod(row)};
    var list=requirementsForStudent(row),missing=[],values={},e=external();
    list.forEach(function(req){var applies=true;try{if(e&&typeof e.requirementStatus==="function"){var st=e.requirementStatus(row||{},req.key);if(st&&st.applies===false)applies=false;}}catch(error){}if(!applies)return;var v=valueOf(row,req);values[req.key]=text(v);if(!isApproved(v))missing.push(req.label);});
    return {ok:missing.length===0,loaded:true,missing:missing,values:values,total:list.length,periodType:classifyPeriod(row)};
  }
  function notes(row){row=row||{};function first(names){for(var i=0;i<names.length;i++){if(row[names[i]]!==undefined&&row[names[i]]!==null&&text(row[names[i]])!=="")return row[names[i]];}return null;}return {nart:numberOrNull(first(["Notart","Nart","nart","notart","notaArticulo","nota_articulo","articulo"])),ndef:numberOrNull(first(["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","defensa"])),nfin:numberOrNull(first(["Notafinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","final"]))};}
  function calculateFinal(a,d){a=numberOrNull(a);d=numberOrNull(d);if(a===null||d===null||a<7)return null;return round2(a*.70+d*.30);}
  function noteState(a,d,f){a=numberOrNull(a);d=numberOrNull(d);f=numberOrNull(f);if(a===null)return "SIN_ARTICULO";if(a<7)return "ARTICULO_NO_APROBADO";if(d===null)return "PENDIENTE_DEFENSA";if(d<7)return "DEFENSA_NO_APROBADA";if(f===null)f=calculateFinal(a,d);if(f===null)return "PENDIENTE_FINAL";return f>=7?"APROBADO":"NO_APROBADO";}
  function evaluate(row){
    var req=requirementSummary(row),n=notes(row);
    if(n.nfin===null)n.nfin=calculateFinal(n.nart,n.ndef);
    var canArt=true;
    var requirementsReady=req.loaded&&req.ok;
    var canDef=requirementsReady&&n.nart!==null&&n.nart>=7;
    var state="Pendiente Art";
    if(n.nart!==null&&n.nart<7)state="Supletorio Art";
    else if(!req.loaded)state="Requisitos no cargados";
    else if(!req.ok)state="Sin requisitos";
    else if(n.nart===null)state="Pendiente Art";
    else if(n.ndef===null)state="Pendiente Def";
    else if(n.ndef<7)state="Supletorio Def";
    else state="Completo";
    var intento=n.ndef!==null&&n.ndef<7?2:1;
    return {
      requirementsLoaded:req.loaded,requirementsOk:req.ok,missingRequirements:req.missing,requirementValues:req.values,
      periodType:req.periodType,nart:n.nart,ndef:n.ndef,nfin:n.nfin,canArt:canArt,canDef:canDef,stateLabel:state,
      noteState:noteState(n.nart,n.ndef,n.nfin),eligibleForSchedule:canDef&&(n.ndef===null||n.ndef<7),
      intento:intento,tipoDefensa:intento===2?"SUPLETORIO":"ORDINARIA"
    };
  }
  window.BDLDefenseEligibility={version:VERSION,BASE_REQUIREMENTS:BASE,REGULAR_EXTRA_REQUIREMENTS:EXTRA,classifyPeriod:classifyPeriod,requirementsForStudent:requirementsForStudent,valueOf:valueOf,isApproved:isApproved,requirementSummary:requirementSummary,notes:notes,calculateFinal:calculateFinal,noteState:noteState,evaluate:evaluate,helpers:{text:text,norm:norm,compact:compact,numberOrNull:numberOrNull}};
})(window);
