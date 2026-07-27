/* =========================================================
Nombre completo: medir-carga-base-runtime.js
Ruta: /scripts/medir-carga-base-runtime.js
Función:
- Conectarse a la aplicación Electron por DevTools remoto.
- Medir desde el inicio del proceso hasta que Base Local y ConCarga quedan listos.
- Registrar la lectura de períodos como hito adicional cuando esté disponible.
- No ejecutar sincronizaciones externas.
- Guardar un reporte JSON reutilizable.
========================================================= */
"use strict";

const fs=require("node:fs");
const path=require("node:path");

function arg(name,fallback){
  const prefix=`--${name}=`;
  const found=process.argv.find((item)=>String(item).startsWith(prefix));
  return found?String(found).slice(prefix.length):fallback;
}
function wait(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function number(value,fallback=0){value=Number(value);return Number.isFinite(value)?value:Number(fallback||0);}
function nowISO(){return new Date().toISOString();}

const port=number(arg("port","9331"),9331);
const timeoutMs=Math.max(3000,number(arg("timeoutMs","30000"),30000));
const pollMs=Math.max(20,number(arg("pollMs","40"),40));
const startedAt=Math.max(1,number(arg("startedAt",String(Date.now())),Date.now()));
const output=path.resolve(arg("output","artifacts/tiempo-carga-base.json"));
const endpoint=`http://127.0.0.1:${port}/json/list`;

class CDPClient{
  constructor(url){this.url=url;this.socket=null;this.nextId=0;this.pending=new Map();}
  connect(){
    return new Promise((resolve,reject)=>{
      const socket=new WebSocket(this.url);this.socket=socket;
      const timer=setTimeout(()=>reject(new Error("DevTools no aceptó la conexión WebSocket.")),5000);
      socket.addEventListener("open",()=>{clearTimeout(timer);resolve();});
      socket.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("Falló la conexión WebSocket con DevTools."));});
      socket.addEventListener("message",(event)=>{
        let message;try{message=JSON.parse(String(event.data));}catch(error){return;}
        if(!message.id||!this.pending.has(message.id)){return;}
        const pending=this.pending.get(message.id);this.pending.delete(message.id);clearTimeout(pending.timer);
        if(message.error){pending.reject(new Error(message.error.message||JSON.stringify(message.error)));}
        else{pending.resolve(message.result);}
      });
    });
  }
  send(method,params={},timeout=5000){
    return new Promise((resolve,reject)=>{
      const id=++this.nextId;
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`DevTools no respondió a ${method}.`));},timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  close(){try{this.socket&&this.socket.close();}catch(error){}}
}

async function fetchTarget(){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    try{
      const response=await fetch(endpoint,{cache:"no-store"});
      if(response.ok){
        const targets=await response.json();
        const pages=targets.filter((item)=>item.type==="page");
        const target=pages.find((item)=>/maq-index\.html/i.test(String(item.url||"")))||pages[0];
        if(target&&target.webSocketDebuggerUrl){return target;}
      }
    }catch(error){}
    await wait(40);
  }
  throw new Error("No apareció una página Electron inspeccionable dentro del tiempo límite.");
}

const inspectExpression=String.raw`
(() => {
  const text=(value)=>String(value==null?"":value).trim();
  const frames=Array.from(document.querySelectorAll("iframe"));
  const frame=frames.find((node)=>/[\\/]Carga[\\/]carga\.html(?:$|[?#])/i.test(node.src||""));
  const result={
    observedAt:Date.now(),
    top:{readyState:document.readyState,href:location.href,title:document.title},
    frameFound:!!frame,
    frames:frames.map((node)=>({src:node.src||"",moduleId:node.dataset&&node.dataset.moduleId||"",hidden:!!node.hidden}))
  };
  if(!frame){return result;}
  try{
    const win=frame.contentWindow;
    const doc=frame.contentDocument;
    const safe=(fn,fallback)=>{try{return fn();}catch(error){return fallback;}};
    const metrics=win.CargaStartupMetrics&&typeof win.CargaStartupMetrics.status==="function"
      ?safe(()=>win.CargaStartupMetrics.status(),null)
      :null;
    const db=win.BL2DB&&typeof win.BL2DB.meta==="function"?safe(()=>win.BL2DB.meta(),null):null;
    const con=win.ConCarga||win.BDLocalCarga||null;
    const conStatus=con&&typeof con.status==="function"?safe(()=>con.status(),null):null;
    const hub=win.BDLocalConexiones&&typeof win.BDLocalConexiones.status==="function"
      ?safe(()=>win.BDLocalConexiones.status(),null)
      :null;
    const cache=metrics&&metrics.cache||{};
    result.carga={
      href:frame.src||"",
      readyState:doc&&doc.readyState||"",
      title:doc&&doc.title||"",
      metrics,
      database:db,
      conCarga:conStatus,
      connections:hub,
      globals:{
        CargaStartupMetrics:!!win.CargaStartupMetrics,
        BDLocalScreenDeps:!!win.BDLocalScreenDeps,
        BL2DB:!!win.BL2DB,
        BL2Core:!!win.BL2Core,
        BDLocalConexiones:!!win.BDLocalConexiones,
        ConCarga:!!con
      },
      counts:{
        periods:Number(cache.periods||0),
        students:Number(cache.students||0),
        requirements:Number(cache.requirements||0)
      },
      statusText:text(doc&&doc.getElementById("cargaEstadoPill")&&doc.getElementById("cargaEstadoPill").textContent)
    };
  }catch(error){result.frameError=error&&error.message||String(error);}
  return result;
})()
`;

function elapsed(epoch){return epoch?Math.max(0,Math.round(number(epoch)-startedAt)):null;}
function first(report,name,value){if(report.milestones[name]==null&&value!=null){report.milestones[name]=Math.max(0,Math.round(value));}}

async function main(){
  const report={
    ok:false,
    startedAt,
    startedAtISO:new Date(startedAt).toISOString(),
    generatedAt:nowISO(),
    timeoutMs,
    pollMs,
    endpoint,
    target:null,
    milestones:{
      processStarted:0,
      rendererAvailable:null,
      cargaFrameCreated:null,
      cargaDomReady:null,
      baseScriptsReady:null,
      indexedDBOpen:null,
      baseLocalReady:null,
      conCargaReady:null,
      periodsReady:null,
      complete:null
    },
    samples:0,
    final:null,
    error:""
  };
  let client=null;
  try{
    const target=await fetchTarget();
    first(report,"rendererAvailable",Date.now()-startedAt);
    report.target={id:target.id,title:target.title,url:target.url};
    client=new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");

    const deadline=startedAt+timeoutMs;
    while(Date.now()<deadline){
      const evaluated=await client.send("Runtime.evaluate",{
        expression:inspectExpression,
        awaitPromise:false,
        returnByValue:true
      },4000);
      const snapshot=evaluated&&evaluated.result&&evaluated.result.value||null;
      report.samples+=1;
      report.final=snapshot;

      if(snapshot&&snapshot.frameFound){first(report,"cargaFrameCreated",snapshot.observedAt-startedAt);}
      const carga=snapshot&&snapshot.carga;
      const metrics=carga&&carga.metrics;
      if(carga){
        if(carga.readyState==="interactive"||carga.readyState==="complete"){
          const domElapsed=metrics&&elapsed(metrics.domReadyAt);
          first(report,"cargaDomReady",domElapsed!=null?domElapsed:snapshot.observedAt-startedAt);
        }
        if(carga.globals&&carga.globals.BDLocalScreenDeps&&carga.globals.BL2DB&&carga.globals.BL2Core){
          first(report,"baseScriptsReady",snapshot.observedAt-startedAt);
        }
        if(carga.database&&carga.database.open===true){first(report,"indexedDBOpen",snapshot.observedAt-startedAt);}
        if(metrics&&metrics.bdlocalReadyAt){first(report,"baseLocalReady",elapsed(metrics.bdlocalReadyAt));}
        if(metrics&&metrics.connectionReadyAt){first(report,"conCargaReady",elapsed(metrics.connectionReadyAt));}
        if(metrics&&metrics.periodsReadyAt){first(report,"periodsReady",elapsed(metrics.periodsReadyAt));}
      }

      if(report.milestones.baseLocalReady!=null&&report.milestones.conCargaReady!=null){
        report.milestones.complete=Math.max(report.milestones.baseLocalReady,report.milestones.conCargaReady);
        report.ok=true;
        break;
      }
      await wait(pollMs);
    }

    if(!report.ok){
      report.error="La aplicación no confirmó Base Local y ConCarga dentro del tiempo límite.";
    }
  }catch(error){
    report.error=error&&error.stack||error&&error.message||String(error);
  }finally{
    client&&client.close();
    report.generatedAt=nowISO();
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(report,null,2),"utf8");
  }

  if(report.ok){
    console.log(`BASE LOCAL LISTA EN ${report.milestones.complete} ms`);
  }else{
    console.error(report.error||"No se pudo completar la medición.");
    process.exitCode=1;
  }
}

main();
