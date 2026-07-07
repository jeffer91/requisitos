/* =========================================================
Nombre completo: carga.divisiones.ficha-source.js
Ruta o ubicación: /Requisitos/Carga/carga.divisiones.ficha-source.js
Función o funciones:
- Hacer que Carga tome divisiones igual que Ficha.
- Leer divisiones reales desde los estudiantes del período.
- Sincronizar esas divisiones al store usado por el modal de Carga.
- Crear divisiones por nombre cuando existen en Ficha aunque no estén creadas manualmente en Carga.
- Agrupar carreras dentro de cada división detectada.
Con qué se conecta:
- carga.divisiones.popup.js
- ../BDLocal/adapters/bdl.screen-deps.js
- BL2DataEngine / BL2EstudiantesRepo / ExcelLocalRepo
- localStorage carga.periodos.local
- localStorage carga.periodos.divisiones
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";

  function text(value){ return String(value == null ? "" : value).trim(); }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }

  function safeParse(value, fallback){
    try{
      var parsed = JSON.parse(value || "");
      return parsed == null ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  function storageGet(name, fallback){
    try{ return safeParse(window.localStorage.getItem(name), fallback); }
    catch(error){ return fallback; }
  }

  function storageSet(name, value){
    try{ window.localStorage.setItem(name, JSON.stringify(value)); }catch(error){}
  }

  function nowISO(){ return new Date().toISOString(); }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    if(!b){ return true; }
    if(!a){ return false; }
    return a === b || key(a) === key(b);
  }

  function selectedPeriod(){
    var select = document.getElementById("cargaPeriodoSelect");
    var id = canonicalPeriodId(text(select ? select.value : "") || text(window.localStorage.getItem(LS_PERIODO)));
    if(!id){ return null; }

    var label = "";
    if(select && select.selectedOptions && select.selectedOptions[0]){
      label = text(select.selectedOptions[0].textContent);
    }
    label = label || text(window.localStorage.getItem(LS_PERIODO_LABEL)) || id;

    return { id:id, periodoId:id, periodoCanonicoId:id, label:label, periodoLabel:label, periodoCanonicoLabel:label };
  }

  function normalizeStudentPeriod(row){
    row = row || {};
    return canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );
  }

  function directDivision(row){
    row = row || {};
    var raw = text(
      row._division ||
      row._bl2Division ||
      row.division ||
      row.Division ||
      row["División"] ||
      row.divisionActual ||
      ""
    );

    if(!raw && Array.isArray(row.divisiones) && row.divisiones.length){
      raw = text(row.divisiones[0]);
    }

    return key(raw) === "sindivision" ? "" : raw;
  }

  function careerFromStudent(row){
    row = row || {};
    var nombre = text(row._carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "");
    var codigo = text(row.CodigoCarrera || row.codigoCarrera || row.codigo || row.codCarrera || "");
    var id = codigo || key(nombre);
    if(!id && !nombre){ return null; }
    return { id:id || key(nombre), codigo:codigo, nombre:nombre || codigo || id };
  }

  function uniqueCareers(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      if(!item){ return; }
      var id = text(item.id || item.codigo || key(item.nombre || item.NombreCarrera || item.Carrera));
      var nombre = text(item.nombre || item.NombreCarrera || item.Carrera || item.carrera || id);
      if(!id && !nombre){ return; }
      map[id || key(nombre)] = {
        id:id || key(nombre),
        codigo:text(item.codigo || item.CodigoCarrera || item.codigoCarrera || ""),
        nombre:nombre || id
      };
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" });
    });
  }

  function normalizeDivision(div){
    if(!div){ return null; }
    if(typeof div === "string"){
      return { id:key(div), nombre:text(div), carreras:[] };
    }
    var nombre = text(div.nombre || div.label || div.name || div.id || "");
    var id = text(div.id || key(nombre));
    if(!id && !nombre){ return null; }
    return {
      id:id || key(nombre),
      nombre:nombre || id,
      carreras:uniqueCareers(div.carreras || []),
      createdAt:div.createdAt || div.creadoEn || nowISO(),
      updatedAt:div.updatedAt || div.actualizadoEn || nowISO()
    };
  }

  function mergeDivisions(a, b){
    var map = {};
    [a, b].forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(item){
        var div = normalizeDivision(item);
        if(!div){ return; }
        if(!map[div.id]){
          map[div.id] = div;
          return;
        }
        map[div.id] = Object.assign({}, map[div.id], div, {
          carreras:uniqueCareers([].concat(map[div.id].carreras || [], div.carreras || [])),
          updatedAt:nowISO()
        });
      });
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(x, y){
      return text(x.nombre).localeCompare(text(y.nombre), "es", { sensitivity:"base" });
    });
  }

  function rowsFromResult(result){
    if(Array.isArray(result)){ return result; }
    if(result && Array.isArray(result.rows)){ return result.rows; }
    if(result && Array.isArray(result.estudiantes)){ return result.estudiantes; }
    if(result && Array.isArray(result.students)){ return result.students; }
    return [];
  }

  function collectRows(periodId){
    var rows = [];
    var payloads = [
      { periodId:periodId, periodoId:periodId, division:"", matricula:"", limit:0, force:true },
      { periodId:periodId, periodoId:periodId, division:"", matricula:"ACTIVO", limit:0, force:true }
    ];

    function add(list){ rows = rows.concat(rowsFromResult(list)); }

    try{
      if(window.BL2DataEngine && typeof window.BL2DataEngine.listStudents === "function"){
        payloads.forEach(function(payload){ add(window.BL2DataEngine.listStudents(payload)); });
      }
    }catch(error){}

    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.buscar === "function"){
        payloads.forEach(function(payload){ add(window.BL2EstudiantesRepo.buscar(payload)); });
      }
    }catch(error2){}

    try{
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.filterStudents === "function"){
        add(window.ExcelLocalRepo.filterStudents({ periodoId:periodId, periodId:periodId, estadoMatricula:"", matricula:"", division:"" }));
      }
    }catch(error3){}

    try{
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.listAllStudents === "function"){
        add(window.ExcelLocalRepo.listAllStudents());
      }
    }catch(error4){}

    try{
      if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.readCache === "function"){
        var cache = window.BDLocalScreenDeps.readCache();
        add(cache && cache.students);
      }
    }catch(error5){}

    var map = {};
    rows.forEach(function(row){
      row = row || {};
      var rowPeriod = normalizeStudentPeriod(row);
      if(periodId && rowPeriod && !samePeriod(rowPeriod, periodId)){ return; }
      var id = text(row.id || row._id || row.cedula || row.numeroIdentificacion || JSON.stringify(row).slice(0, 80));
      map[id + "|" + normalizeStudentPeriod(row)] = row;
    });

    return Object.keys(map).map(function(id){ return map[id]; });
  }

  function divisionsFromRows(rows){
    var map = {};
    rows.forEach(function(row){
      var division = directDivision(row);
      var career = careerFromStudent(row);
      if(!division){ return; }
      var id = key(division);
      if(!map[id]){
        map[id] = { id:id, nombre:division, carreras:[], createdAt:nowISO(), updatedAt:nowISO() };
      }
      if(career){ map[id].carreras = uniqueCareers(map[id].carreras.concat([career])); }
    });
    return Object.keys(map).map(function(id){ return map[id]; });
  }

  function readExistingStore(periodId){
    var store = storageGet(LS_DIVISIONES, {});
    var item = store[periodId] || store[canonicalPeriodId(periodId)] || {};
    if(Array.isArray(item)){ return item; }
    if(item && Array.isArray(item.divisiones)){ return item.divisiones; }
    return [];
  }

  function writeDivisions(period, divisions, careers){
    if(!period || !period.id){ return; }

    var store = storageGet(LS_DIVISIONES, {});
    var merged = mergeDivisions(readExistingStore(period.id), divisions);
    store[period.id] = Object.assign({}, store[period.id] || {}, {
      periodoId:period.id,
      divisiones:merged,
      updatedAt:nowISO(),
      source:"FichaLikeStudentRows"
    });
    storageSet(LS_DIVISIONES, store);

    var periods = storageGet(LS_PERIODOS, []);
    periods = Array.isArray(periods) ? periods : [];
    var found = false;
    periods = periods.map(function(item){
      var id = canonicalPeriodId(item.periodoCanonicoId || item.periodoId || item.id || item.value || "");
      if(samePeriod(id, period.id)){
        found = true;
        return Object.assign({}, item, {
          id:period.id,
          periodoId:period.id,
          periodoCanonicoId:period.id,
          label:item.label || period.label,
          periodoLabel:item.periodoLabel || period.periodoLabel || period.label,
          periodoCanonicoLabel:item.periodoCanonicoLabel || period.periodoCanonicoLabel || period.label,
          divisiones:merged,
          carrerasDetectadas:uniqueCareers([].concat(item.carrerasDetectadas || [], careers || [])),
          updatedAt:nowISO()
        });
      }
      return item;
    });

    if(!found){
      periods.unshift(Object.assign({}, period, {
        divisiones:merged,
        carrerasDetectadas:uniqueCareers(careers || []),
        updatedAt:nowISO()
      }));
    }

    storageSet(LS_PERIODOS, periods);
  }

  function syncFromFichaStyle(){
    var period = selectedPeriod();
    if(!period){ return { ok:false, message:"Sin período seleccionado" }; }

    var rows = collectRows(period.id);
    var divisions = divisionsFromRows(rows);
    var careers = uniqueCareers(rows.map(careerFromStudent).filter(Boolean));

    if(!divisions.length && !careers.length){
      return { ok:false, periodoId:period.id, rows:rows.length, divisions:0, message:"No se encontraron divisiones en estudiantes" };
    }

    writeDivisions(period, divisions, careers);

    try{
      window.dispatchEvent(new CustomEvent("carga:divisiones-ficha-source", {
        detail:{ ok:true, periodoId:period.id, rows:rows.length, divisions:divisions.length, careers:careers.length }
      }));
    }catch(error){}

    return { ok:true, periodoId:period.id, rows:rows.length, divisions:divisions.length, careers:careers.length };
  }

  function bindBeforePopup(){
    document.addEventListener("click", function(event){
      if(event.target && event.target.closest && event.target.closest("#cargaBtnDivisionesPeriodo")){
        syncFromFichaStyle();
      }
    }, true);
  }

  function boot(){
    bindBeforePopup();
    window.CargaDivisionesFichaSource = {
      sync:syncFromFichaStyle,
      collectRows:collectRows,
      divisionsFromRows:divisionsFromRows
    };

    window.addEventListener("bdlocal:screen-deps-ready", function(){ syncFromFichaStyle(); });
    window.setTimeout(syncFromFichaStyle, 500);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
