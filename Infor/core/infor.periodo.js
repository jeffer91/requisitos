/* =========================================================
Nombre completo: infor.periodo.js
Ruta o ubicación: /Requisitos/Infor/core/infor.periodo.js
Función o funciones:
- Leer períodos y conteos exclusivamente desde ConInfor.
- Clasificar períodos como REGULAR o PVC usando StatsRules.
- Preparar modalidad y nombre automático del informe.
Con qué se conecta:
- ../../BDLocal/conexiones/cone.infor.js
- ../../Stats/stats.rules.js
- infor.state.js
========================================================= */
(function(window,document){
  "use strict";

  var connectorPromise=null;

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function connector(){return window.ConInfor||window.BDLocalConeInfor||null;}

  function connectorUrl(){
    try{return new URL("../../BDLocal/conexiones/cone.infor.js",document.currentScript&&document.currentScript.src||document.baseURI).href;}
    catch(error){return "../../BDLocal/conexiones/cone.infor.js";}
  }

  function ensureConnector(){
    if(connector()){
      return typeof connector().ready==="function"?connector().ready().then(function(){return connector();}):Promise.resolve(connector());
    }
    if(connectorPromise){return connectorPromise;}

    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.load==="function"){
      connectorPromise=window.BDLocalScreenDeps.load("../conexiones/cone.infor.js")
        .then(function(){
          if(!connector()){throw new Error("ConInfor no quedó disponible.");}
          return typeof connector().ready==="function"?connector().ready().then(function(){return connector();}):connector();
        });
      return connectorPromise;
    }

    connectorPromise=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=connectorUrl();
      script.async=false;
      script.onload=function(){
        if(!connector()){reject(new Error("ConInfor no quedó disponible."));return;}
        Promise.resolve(typeof connector().ready==="function"?connector().ready():connector()).then(function(){resolve(connector());},reject);
      };
      script.onerror=function(){reject(new Error("No se pudo cargar cone.infor.js."));};
      (document.head||document.documentElement).appendChild(script);
    });
    return connectorPromise;
  }

  function periodIdOf(period){
    return text(period&&(period.id||period.periodoId||period.value||period.key||period.codigo)||period);
  }

  function periodLabelOf(period){
    return text(period&&(period.label||period.periodoLabel||period.nombre||period.name||period.descripcion||period.id||period.periodoId)||period);
  }

  function classify(value){
    var raw=text(value);
    if(!raw){return {id:"",label:"Sin período",isRegular:false,isPVC:false,pattern:"SIN_PERIODO",raw:""};}
    if(window.StatsRules&&typeof window.StatsRules.classifyPeriod==="function"){
      return window.StatsRules.classifyPeriod(raw);
    }
    var source=norm(raw);
    var regular=(source.indexOf("octubre")>=0&&source.indexOf("marzo")>=0)||(source.indexOf("abril")>=0&&source.indexOf("septiembre")>=0);
    return {id:regular?"REGULAR":"PVC",label:regular?"Regular":"PVC",isRegular:regular,isPVC:!regular,pattern:regular?"REGULAR":"PVC",raw:raw};
  }

  function normalizePeriod(period){
    var id=periodIdOf(period);
    var label=periodLabelOf(period)||id;
    return {id:id,label:label,type:classify(label||id),raw:period};
  }

  function uniquePeriods(list){
    var map=Object.create(null);
    (list||[]).forEach(function(period){
      var item=normalizePeriod(period);
      var key=compact(item.id||item.label);
      if(key&&!map[key]){map[key]=item;}
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }

  function list(){
    var current=connector();
    if(!current){return [];}
    var rows=[];
    try{
      if(typeof current.listPeriodsSync==="function"){rows=current.listPeriodsSync()||[];}
      else if(typeof current.getPeriodsSync==="function"){rows=current.getPeriodsSync()||[];}
      else if(typeof current.snapshot==="function"){rows=(current.snapshot().periods||[]);}
    }catch(error){rows=[];}
    return uniquePeriods(rows);
  }

  function samePeriod(a,b){
    if(!text(b)){return true;}
    var current=window.BDLocalConUtils;
    if(current&&typeof current.samePeriod==="function"){return current.samePeriod(a,b);}
    return text(a)===text(b)||compact(a)===compact(b);
  }

  function countStudents(periodId){
    var current=connector();
    if(!current){return {source:"ConInfor no disponible",total:0,activos:0};}
    var rows=[];
    try{
      if(typeof current.listStudentsSync==="function"){
        rows=current.listStudentsSync({periodoId:periodId,matricula:"ACTIVO",limit:0})||[];
      }else if(typeof current.getStudentsSync==="function"){
        rows=current.getStudentsSync({periodoId:periodId,matricula:"ACTIVO",limit:0})||[];
      }
    }catch(error){rows=[];}
    return {source:"ConInfor",total:rows.length,activos:rows.length};
  }

  function modalitiesForType(type){
    type=type||{};
    if(type.id==="REGULAR"){
      return [
        {id:"EXAMEN_COMPLEXIVO",label:"Examen Complexivo",default:true},
        {id:"TRABAJO_TITULACION",label:"Trabajo de Titulación",default:false}
      ];
    }
    if(type.id==="PVC"){
      return [{id:"ARTICULO_ACADEMICO",label:"Artículo Académico",default:true,locked:true}];
    }
    return [];
  }

  function reportKind(type){
    type=type||{};
    if(type.id==="REGULAR"){
      return {id:"REGULAR",label:"Informe Regular",cronogramas:["complexivo","trabajoTitulacion"],secciones:["complexivo","trabajo_titulacion"]};
    }
    if(type.id==="PVC"){
      return {id:"PVC",label:"Informe PVC",cronogramas:["pvc"],secciones:["pvc"]};
    }
    return {id:"",label:"Sin período",cronogramas:[],secciones:[]};
  }

  function reportName(periodLabel){
    periodLabel=text(periodLabel);
    return periodLabel?"Informe de Titulación "+periodLabel:"Informe de Titulación";
  }

  function summary(period){
    var item=normalizePeriod(period||{});
    var students=item.id?countStudents(item.id):{source:"ConInfor",total:0,activos:0};
    return {
      id:item.id,label:item.label,type:item.type,students:students,
      modalities:modalitiesForType(item.type),reportKind:reportKind(item.type),reportName:reportName(item.label)
    };
  }

  function refillSelect(){
    var select=document.getElementById("infor-periodo");
    if(!select){return;}
    var current=select.value;
    var rows=list();
    select.innerHTML="";
    var first=document.createElement("option");
    first.value="";
    first.textContent="Selecciona un período";
    select.appendChild(first);
    rows.forEach(function(period){
      var option=document.createElement("option");
      option.value=period.id;
      option.textContent=period.label;
      select.appendChild(option);
    });
    if(current&&rows.some(function(period){return period.id===current;})){select.value=current;}
  }

  var ready=ensureConnector().then(function(){
    refillSelect();
    try{window.dispatchEvent(new CustomEvent("infor:periods-ready",{detail:{periods:list()}}));}catch(error){}
    return true;
  }).catch(function(error){
    try{console.warn("[InforPeriodo]",error);}catch(innerError){}
    return false;
  });

  window.InforPeriodo={
    ready:ready,list:list,normalizePeriod:normalizePeriod,classify:classify,
    periodIdOf:periodIdOf,periodLabelOf:periodLabelOf,samePeriod:samePeriod,
    countStudents:countStudents,modalitiesForType:modalitiesForType,
    reportKind:reportKind,reportName:reportName,summary:summary,refillSelect:refillSelect
  };
})(window,document);