"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../StatNot/stat-not.app.js"),"utf8");
const periods=[
 {id:"2026-02__2026-08",nombre:"Febrero – Agosto",activo:true},
 {id:"2026-05__2026-11",nombre:"Mayo – Noviembre",activo:false}
];
const select={value:"",innerHTML:""};
let desired="2026-05__2026-11";
const w={StatNotModel:{text(v){return String(v==null?"":v).trim();}},
 BDLPeriodoGlobal:{status(){return {period:{id:desired}}}},
 ConStatNot:{listPeriods(){return Promise.resolve(periods);}}};
const d={getElementById(id){return id==="statnot-period"?select:null;}};
vm.runInNewContext(source,{window:w,document:d}, {filename:"stat-not.app.js"});
async function run(){
 await w.StatNotApp.loadPeriods();
 assert.equal(select.value,"2026-05__2026-11","Se debe priorizar el período global incluso si otro figura activo");
 desired="2025-10__2026-03";
 await w.StatNotApp.loadPeriods();
 assert.equal(select.value,"2026-02__2026-08","Se mantiene el período activo si el global no está en el catálogo");
 w.BDLPeriodoGlobal.status=()=>({period:{id:"2026-05__2026-11"}});
 await w.StatNotApp.loadPeriods();
 assert.equal(select.value,"2026-05__2026-11");
 console.log("VERIFICACIÓN STATNOT PERÍODO GLOBAL: OK");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
