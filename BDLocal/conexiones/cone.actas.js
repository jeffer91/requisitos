/* Conector de solo lectura para Actas. No escribe estados ni calificaciones. */
(function(w,d){"use strict";
const base=d.currentScript&&d.currentScript.src||d.baseURI;
let promise=null,loaded=false,error="",stamp="";
function resolve(path){return new URL(path,base).href;}
function load(path,predicate){if(predicate())return Promise.resolve();const url=resolve(path);return new Promise((yes,no)=>{const found=[...d.scripts].find(x=>x.src===url);if(found){let ticks=0;const check=()=>{if(predicate())yes();else if(++ticks>160)no(Error("No se inicializó "+path));else setTimeout(check,75);};check();return;}let s=d.createElement("script");s.src=url;s.async=false;s.onload=()=>predicate()?yes():no(Error("Módulo sin API: "+path));s.onerror=()=>no(Error("No se pudo cargar "+path));d.head.appendChild(s);});}
function ready(){if(loaded)return Promise.resolve({ok:true});if(promise)return promise;error="";promise=load("cone.ncomplex.js",()=>!!w.ConNcomplex).then(()=>w.ConNcomplex.ready()).then(s=>{if(!s||!s.ok)throw Error(s&&s.error||"No se pudo iniciar Ncomplex.");return load("../rules/bdl.rules.requisitos.js",()=>!!w.BDLRulesRequisitos);}).then(()=>load("../repositories/bdl.repo.requisitos.js",()=>!!w.BDLRepoRequisitos)).then(()=>{loaded=true;stamp=new Date().toISOString();return {ok:true};}).catch(e=>{error=e.message||String(e);throw e;}).finally(()=>{promise=null;});return promise;}
function read(opts){opts=opts||{};return ready().then(()=>Promise.all([w.ConNcomplex.listPeriods(),w.ConNcomplex.listStudents({periodoId:opts.periodoId||"",matricula:""}),w.BDLRepoRequisitos.list({periodoId:opts.periodoId||""})])).then(a=>({ok:true,data:{periods:a[0]||[],students:a[1]||[],requirements:a[2]||[]},meta:{source:"BDLocal + Ncomplex",readOnly:true}}));}
function listPeriods(){return ready().then(()=>w.ConNcomplex.listPeriods());}
function diagnose(){return {ok:loaded&&!error,source:"BDLocal + Ncomplex",canRead:true,canWrite:false,error};}
function status(){return {ok:loaded&&!error,ready:loaded,error,loadedAt:stamp};}
const api={version:"1.0",screen:"actas",ready,read,listPeriods,status,diagnose,refresh:(opts)=>read(opts)};
w.ConActas=api;w.BDLocalConeActas=api;
const hub=w.BDLocalConexiones;if(hub&&typeof hub.register==="function")hub.register("actas",api);
})(window,document);
