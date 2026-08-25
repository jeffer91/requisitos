"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "BDLocal/patches/bdl.divisiones.period-guard.js"), "utf8");
const PERIOD = "2026-01__2026-06";
const stores = { periodos_carreras:new Map(), periodos_divisiones:new Map(), periodos:new Map() };
stores.periodos_divisiones.set(PERIOD + "__objectobject", { id:PERIOD + "__objectobject", periodoId:PERIOD, division:"[object Object]" });
const db = {
  getAll(name){ return Promise.resolve(Array.from((stores[name] || new Map()).values())); },
  remove(name,id){ stores[name] && stores[name].delete(id); return Promise.resolve(true); },
  bulkPut(name,rows){ if(!stores[name]) stores[name]=new Map(); rows.forEach(r=>stores[name].set(r.id,r)); return Promise.resolve(rows); },
  put(name,row){ if(!stores[name]) stores[name]=new Map(); stores[name].set(row.id,row); return Promise.resolve(row); }
};
const api = { ready(){ return Promise.resolve({ok:true}); } };
const win = {
  ConCarga:api,
  BL2DB:db,
  BL2Config:{ stores:{ periodos:"periodos", periodosCarreras:"periodos_carreras", periodosDivisiones:"periodos_divisiones" } },
  BDLocalConUtils:{ canonicalPeriodId(v){ return String(v||"").replace(/_+/g,"__"); } },
  Promise,Object,Array,Date,Math,JSON,String,Number,Boolean,RegExp,Error,console
};
vm.runInNewContext(source, { window:win, console, Promise,Object,Array,Date,Math,JSON,String,Number,Boolean,RegExp,Error }, { filename:"bdl.divisiones.period-guard.js" });
(async()=>{
  await api.ready();
  assert.equal(db.__divisionPeriodGuardInstalled,true);
  await db.put("periodos", {
    id:PERIOD, periodoId:PERIOD,
    carrerasDetectadas:[{codigo:"ADM-01",nombre:"Administración"}],
    divisiones:[{id:"norte",nombre:"Norte",carreras:[{codigo:"ADM-01",nombre:"Administración"}]}]
  });
  const divisions = Array.from(stores.periodos_divisiones.values());
  assert.equal(divisions.length,1);
  assert.equal(divisions[0].division,"Norte");
  assert.equal(divisions.some(row=>row.division==="[object Object]"),false);
  console.log("VERIFICACIÓN DEL GUARD DE DIVISIONES: OK");
})().catch(error=>{ console.error(error); process.exit(1); });
