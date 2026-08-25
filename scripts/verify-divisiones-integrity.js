"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
function read(relative){ return fs.readFileSync(path.join(ROOT, relative), "utf8"); }
function period(id){ return id; }

const PERIOD_A = period("2026-01__2026-06");
const PERIOD_B = period("2026-07__2026-12");
const studentsSeed = [
  { id:"stu-adm", idEstudiantePeriodo:"stu-adm", cedula:"1001", periodoId:PERIOD_A, CodigoCarrera:"ADM-01", NombreCarrera:"Administración", division:"Vieja" },
  { id:"stu-mkt", idEstudiantePeriodo:"stu-mkt", cedula:"1002", periodoId:PERIOD_A, CodigoCarrera:"MKT 02", NombreCarrera:"Marketing", division:"" },
  { id:"stu-est", idEstudiantePeriodo:"stu-est", cedula:"1003", periodoId:PERIOD_B, CodigoCarrera:"EST/03", NombreCarrera:"Estética", division:"Sur" }
];

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function baseWindow(){
  const listeners = Object.create(null);
  return {
    console,
    Promise,
    Object,
    Array,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    setTimeout,
    clearTimeout,
    CustomEvent:function(name, options){ this.type = name; this.detail = options && options.detail || {}; },
    addEventListener(name, fn){ (listeners[name] || (listeners[name] = [])).push(fn); },
    dispatchEvent(event){ (listeners[event && event.type] || []).forEach((fn) => fn(event)); return true; },
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} }
  };
}

async function verifyCargaOps(){
  const source = read("BDLocal/conexiones/cone.carga.ops.js");
  const rows = clone(studentsSeed);
  const periods = [{
    id:PERIOD_A,
    periodoId:PERIOD_A,
    carrerasDetectadas:[
      { id:"adm01", codigo:"ADM-01", nombre:"Administración" },
      { id:"est03", codigo:"EST/03", nombre:"Estética" }
    ],
    divisiones:[
      { id:"norte", nombre:"Norte", carreras:[{ id:"adm01", codigo:"ADM-01", nombre:"Administración" }, { id:"est03", codigo:"EST/03", nombre:"Estética" }] }
    ]
  }];
  const stores = Object.create(null);
  ["matriculas_periodo","divisiones_estudiante","periodos_carreras","periodos_divisiones"].forEach((name) => { stores[name] = new Map(); });
  stores.matriculas_periodo.set("stu-adm", { id:"stu-adm", idEstudiantePeriodo:"stu-adm", periodoId:PERIOD_A, division:"Vieja", divisiones:["Vieja"] });
  stores.matriculas_periodo.set("stu-mkt", { id:"stu-mkt", idEstudiantePeriodo:"stu-mkt", periodoId:PERIOD_A, division:"", divisiones:[] });
  stores.divisiones_estudiante.set("old-adm", { id:"old-adm", idEstudiantePeriodo:"stu-adm", periodoId:PERIOD_A, division:"Vieja" });
  stores.periodos_divisiones.set(PERIOD_A + "__objectobject", { id:PERIOD_A + "__objectobject", periodoId:PERIOD_A, division:"[object Object]" });

  const db = {
    getAll(name){ return Promise.resolve(Array.from((stores[name] || new Map()).values()).map(clone)); },
    remove(name, id){ if(stores[name]){ stores[name].delete(id); } return Promise.resolve(true); },
    bulkPut(name, list){
      if(!stores[name]){ stores[name] = new Map(); }
      list.forEach((row) => stores[name].set(row.id || row.idEstudiantePeriodo, clone(row)));
      return Promise.resolve(clone(list));
    },
    get(name, id){ return Promise.resolve(stores[name] && stores[name].has(id) ? clone(stores[name].get(id)) : null); },
    put(name, row){
      if(!stores[name]){ stores[name] = new Map(); }
      stores[name].set(row.id || row.idEstudiantePeriodo, clone(row));
      return Promise.resolve(clone(row));
    }
  };

  const api = {
    ready(){ return Promise.resolve({ ok:true }); },
    getPeriods(){ return Promise.resolve(clone(periods)); },
    getSummary(){ return Promise.resolve({}); },
    refresh(){ return Promise.resolve({ ok:true }); }
  };
  const core = {
    getStudents(){ return Promise.resolve(clone(rows)); },
    getPeriods(){ return Promise.resolve(clone(periods)); },
    savePeriod(value){
      const index = periods.findIndex((item) => item.id === value.id);
      if(index >= 0){ periods[index] = clone(value); } else{ periods.push(clone(value)); }
      return Promise.resolve(clone(value));
    },
    updateStudent(id, changes){
      const row = rows.find((item) => item.id === id || item.idEstudiantePeriodo === id);
      if(!row){ return Promise.reject(new Error("student not found")); }
      Object.assign(row, clone(changes));
      return Promise.resolve(clone(row));
    }
  };
  const win = baseWindow();
  win.ConCarga = api;
  win.BL2Core = core;
  win.BL2DB = db;
  win.BL2Config = { stores:{ matriculasPeriodo:"matriculas_periodo", divisionesEstudiante:"divisiones_estudiante", periodosCarreras:"periodos_carreras", periodosDivisiones:"periodos_divisiones" } };
  win.BDLocalConUtils = {
    canonicalPeriodId(value){ return String(value || "").replace(/_+/g, "__"); },
    readCache(){ return { students:clone(rows) }; },
    filterStudents(input, options){
      return input.filter((row) => !options.periodoId || row.periodoId === options.periodoId);
    }
  };
  const context = vm.createContext({ window:win, console, Promise, Object, Array, Date, Math, JSON, String, Number, Boolean, RegExp, Error, setTimeout, clearTimeout, CustomEvent:win.CustomEvent });
  vm.runInContext(source, context, { filename:"cone.carga.ops.js" });

  const careersA = await api.listCareers(PERIOD_A);
  assert.deepEqual(careersA.map((item) => item.id), ["adm01","mkt02"], "Carga debe derivar carreras solo de estudiantes del período A");
  assert.equal(api.careerKey(studentsSeed[0]), "adm01", "El ID de estudiante no debe usarse como careerKey");

  const dirtyDivisions = [
    { id:"norte", nombre:"Norte", carreras:[
      { codigo:"ADM-01", nombre:"Administración" },
      { codigo:"EST/03", nombre:"Estética" }
    ] },
    { id:"sur", nombre:"Sur", carreras:[
      { codigo:"ADM-01", nombre:"Administración" },
      { codigo:"MKT 02", nombre:"Marketing" }
    ] }
  ];
  const result = await api.saveDivisions({ id:PERIOD_A, periodoId:PERIOD_A }, dirtyDivisions);
  assert.equal(result.ok, true);
  assert.equal(result.careers, 2);
  assert.equal(periods[0].carrerasDetectadas.length, 2, "El período debe reemplazar carrerasDetectadas por el catálogo real");
  assert.deepEqual(periods[0].carrerasDetectadas.map((item) => item.id), ["adm01","mkt02"]);
  assert.deepEqual(periods[0].divisiones[0].carreras.map((item) => item.id), ["adm01"], "EST de otro período debe eliminarse");
  assert.deepEqual(periods[0].divisiones[1].carreras.map((item) => item.id), ["mkt02"], "ADM no puede quedar duplicada en dos divisiones");
  assert.equal(rows.find((item) => item.id === "stu-adm").division, "Norte");
  assert.equal(rows.find((item) => item.id === "stu-mkt").division, "Sur");
  assert.equal(rows.find((item) => item.id === "stu-est").division, "Sur", "Otro período no debe modificarse");

  const periodDivisionRows = Array.from(stores.periodos_divisiones.values());
  assert.equal(periodDivisionRows.length, 2);
  assert.equal(periodDivisionRows.some((row) => row.division === "[object Object]"), false, "periodos_divisiones no puede conservar [object Object]");
  const studentDivisionRows = Array.from(stores.divisiones_estudiante.values());
  assert.equal(studentDivisionRows.filter((row) => row.periodoId === PERIOD_A).length, 2, "Debe existir una división vigente por estudiante asignado");
  assert.equal(studentDivisionRows.some((row) => row.division === "Vieja"), false, "La división histórica debe eliminarse");
}

function verifyFastBridge(){
  const source = read("BDLocal/adapters/bdl.divisiones.fast-cache.js");
  const win = baseWindow();
  win.BDLocalConUtils = {
    text(value){ return String(value == null ? "" : value).trim(); },
    normalizeKey(value){ return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ""); },
    canonicalPeriodId(value){ return String(value || "").replace(/_+/g, "__"); },
    samePeriod(a, b){ return String(a || "").replace(/_+/g, "__") === String(b || "").replace(/_+/g, "__"); },
    readCache(){ return { students:clone(studentsSeed) }; }
  };
  win.BLDivisionesService = {
    version:"legacy",
    careersForPeriod(){ return [{ codigo:"ADM-01", nombre:"Administración" }, { codigo:"EST/03", nombre:"Estética" }]; },
    divisionsForPeriod(){
      return [
        { id:"norte", nombre:"Norte", carreras:[{ codigo:"ADM-01", nombre:"Administración" }, { codigo:"EST/03", nombre:"Estética" }] },
        { id:"sur", nombre:"Sur", carreras:[{ codigo:"ADM-01", nombre:"Administración" }] }
      ];
    },
    studentDivision(row){ return row.division || "Sin división"; },
    listDivisions(){ return ["Norte","Sur"]; },
    invalidate(){ return true; },
    status(){ return { ok:true }; }
  };
  const context = vm.createContext({ window:win, document:{}, console, Promise, Object, Array, Date, Math, JSON, String, Number, Boolean, RegExp, Error, setTimeout, clearTimeout, CustomEvent:win.CustomEvent });
  vm.runInContext(source, context, { filename:"bdl.divisiones.fast-cache.js" });

  const service = win.BLDivisionesService;
  assert.equal(service.careerKey(studentsSeed[0]), "adm01", "El puente debe priorizar CodigoCarrera antes que id del estudiante");
  assert.deepEqual(service.careersForPeriod(PERIOD_A).map((item) => item.id), ["adm01","mkt02"], "El servicio debe aislar carreras por período");
  const divisions = service.divisionsForPeriod(PERIOD_A);
  assert.deepEqual(divisions[0].carreras.map((item) => item.id), ["adm01"]);
  assert.deepEqual(divisions[1].carreras.map((item) => item.id), [], "Una carrera no puede pertenecer a dos divisiones");
  assert.equal(service.studentDivision(studentsSeed[1]), "Sin división", "Un valor directo viejo no puede revivir una división no configurada");
}

function verifyStaticGuards(){
  const popup = read("Carga/carga.divisiones.popup.js");
  const ops = read("BDLocal/conexiones/cone.carga.ops.js");
  assert.equal(popup.includes("con.listCareers"), false, "El popup no debe mezclar catálogos externos de carreras");
  assert.equal(popup.includes("careersFromStudents(students)"), true, "El popup debe derivar carreras desde estudiantes del período");
  assert.equal(ops.includes("periodosDivisiones"), true);
  assert.equal(ops.includes("divisionesEstudiante"), true);
  assert.equal(ops.includes("division_rollback"), true, "El guardado debe tener rollback ante fallos parciales");
  assert.equal(ops.includes("[object Object]"), false, "No debe generarse texto de objeto como división");
}

(async function main(){
  verifyStaticGuards();
  verifyFastBridge();
  await verifyCargaOps();
  console.log("VERIFICACIÓN DE DIVISIONES: OK");
})().catch((error) => {
  console.error("VERIFICACIÓN DE DIVISIONES: ERROR");
  console.error(error && error.stack || error);
  process.exit(1);
});
