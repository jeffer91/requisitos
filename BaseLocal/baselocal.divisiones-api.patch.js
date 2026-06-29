/* =========================================================
Nombre completo: baselocal.divisiones-api.patch.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.divisiones-api.patch.js
Función o funciones:
- Reforzar la API pública de divisiones sin tocar otras pantallas.
- Separar creación de división y asignación de carreras.
- Permitir crear divisiones vacías por período y conservarlas en catálogo local/Firebase.
- Corregir edición/asignación para que una división nueva no requiera carreras al crearse.
- Mantener escritura en Base Local con historial.
Con qué se conecta:
- baselocal.core.js
- services/bl-divisiones.service.js
- baselocal.divisiones.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function api(){if(!window.BaseLocalAPI){throw new Error("BaseLocalAPI no disponible.");}return window.BaseLocalAPI;}
  function svc(){if(!window.BLDivisionesService){throw new Error("BLDivisionesService no disponible.");}return window.BLDivisionesService;}

  if(!window.BaseLocalAPI){return;}

  var original = {
    getPeriods: window.BaseLocalAPI.getPeriods,
    getDivisions: window.BaseLocalAPI.getDivisions,
    getDivisionsWithEmpty: window.BaseLocalAPI.getDivisionsWithEmpty,
    getDivisionDetail: window.BaseLocalAPI.getDivisionDetail,
    getDivisionsSummary: window.BaseLocalAPI.getDivisionsSummary,
    deleteDivision: window.BaseLocalAPI.deleteDivision
  };

  function samePeriod(a,b){
    if(!text(b)){return true;}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}
    return text(a) === text(b);
  }

  function rowPeriod(row){return text(row && (row.periodoId || row.ultimoPeriodoId || row.periodId || row.PeriodoId || row.periodo || row.Periodo || row.periodoLabel));}
  function careerOf(row){return text(row && (row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa)) || "SIN CARRERA";}

  function periodLabel(periodId, snapshot){
    var periods = snapshot && Array.isArray(snapshot.periods) ? snapshot.periods : (typeof original.getPeriods === "function" ? original.getPeriods.call(api()) : []);
    var p = (periods || []).find(function(x){return samePeriod(x.id || x.periodoId || x.label || x.periodoLabel, periodId);});
    return p ? text(p.label || p.periodoLabel || p.id || p.periodoId) : text(periodId);
  }

  function uniqueSorted(values){
    var seen = {};
    var out = [];
    (values || []).forEach(function(value){
      var clean = text(typeof value === "object" && value ? (value.nombre || value.name || value.label || value.division || value.id) : value);
      var key = norm(clean);
      if(!clean || key === norm(svc().sinDivision) || seen[key]){return;}
      seen[key] = true;
      out.push(clean);
    });
    return out.sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function uniqueCareers(careers){
    var seen = {}, out = [];
    (careers || []).forEach(function(career){
      var clean = text(career);
      var key = norm(clean);
      if(!clean || seen[key]){return;}
      seen[key] = true;
      out.push(clean);
    });
    return out;
  }

  function divisionId(periodId, divisionName){
    return [text(periodId), text(divisionName)].join("__").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w.-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");
  }

  function normalizeCatalogRecord(record, fallbackPeriodId, fallbackLabel){
    var periodId = text(record && (record.periodoId || record.periodId || record.periodo || record.idPeriodo)) || text(fallbackPeriodId);
    var division = text(record && (record.division || record.nombre || record.name || record.label || record.id)) || text(record);
    if(!periodId || !division || norm(division) === norm(svc().sinDivision)){return null;}
    return {
      id:divisionId(periodId, division),
      periodoId:periodId,
      periodoLabel:text(record && (record.periodoLabel || record.labelPeriodo)) || text(fallbackLabel) || periodLabel(periodId),
      division:division,
      nombre:division,
      createdAt:text(record && record.createdAt) || now(),
      updatedAt:text(record && record.updatedAt) || now(),
      source:text(record && record.source) || "catalogo_divisiones"
    };
  }

  function periodDivisionNames(period){
    var values = [];
    if(Array.isArray(period && period.divisiones)){values = values.concat(period.divisiones);}
    if(Array.isArray(period && period.divisions)){values = values.concat(period.divisions);}
    if(Array.isArray(period && period.catalogoDivisiones)){values = values.concat(period.catalogoDivisiones);}
    if(Array.isArray(period && period.divisionesCatalogo)){values = values.concat(period.divisionesCatalogo);}
    return uniqueSorted(values);
  }

  function catalogFromSnapshot(snapshot){
    snapshot = snapshot || {};
    var map = {};
    var out = [];

    function add(record, fallbackPeriodId, fallbackLabel){
      var normalized = normalizeCatalogRecord(record, fallbackPeriodId, fallbackLabel);
      if(!normalized){return;}
      var key = norm(normalized.periodoId) + "::" + norm(normalized.division);
      if(map[key]){return;}
      map[key] = true;
      out.push(normalized);
    }

    if(Array.isArray(snapshot.divisiones)){snapshot.divisiones.forEach(function(row){add(row);});}
    if(Array.isArray(snapshot.divisions)){snapshot.divisions.forEach(function(row){add(row);});}

    (Array.isArray(snapshot.periods) ? snapshot.periods : []).forEach(function(period){
      var pid = text(period.id || period.periodoId || period.label || period.periodoLabel);
      var plabel = text(period.label || period.periodoLabel || pid);
      periodDivisionNames(period).forEach(function(name){add({division:name, periodoId:pid, periodoLabel:plabel, source:"periodo"}, pid, plabel);});
    });

    return out.sort(function(a,b){return String(a.periodoLabel || a.periodoId).localeCompare(String(b.periodoLabel || b.periodoId),"es") || a.division.localeCompare(b.division,"es");});
  }

  function catalogDivisionNames(snapshot, periodId){
    return uniqueSorted(catalogFromSnapshot(snapshot).filter(function(row){return !periodId || samePeriod(row.periodoId, periodId);}).map(function(row){return row.division;}));
  }

  function syncPeriodCatalog(snapshot, periodId, divisionName, mode){
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.periods = snapshot.periods.map(function(period){
      var pid = text(period.id || period.periodoId || period.label || period.periodoLabel);
      if(!samePeriod(pid, periodId)){return period;}
      var list = periodDivisionNames(period);
      if(mode === "remove"){
        list = list.filter(function(name){return norm(name) !== norm(divisionName);});
      }else{
        list.push(divisionName);
      }
      list = uniqueSorted(list);
      var next = Object.assign({}, period, {
        divisiones:list,
        catalogoDivisiones:list,
        divisionesActualizadasEn:now(),
        updatedAt:now()
      });
      return next;
    });
    return snapshot;
  }

  function upsertCatalog(snapshot, periodId, divisionName){
    snapshot.divisiones = catalogFromSnapshot(snapshot).filter(function(row){return !(samePeriod(row.periodoId, periodId) && norm(row.division) === norm(divisionName));});
    snapshot.divisiones.push({
      id:divisionId(periodId, divisionName),
      periodoId:periodId,
      periodoLabel:periodLabel(periodId, snapshot),
      division:divisionName,
      nombre:divisionName,
      createdAt:now(),
      updatedAt:now(),
      source:"base_local"
    });
    syncPeriodCatalog(snapshot, periodId, divisionName, "add");
    return snapshot;
  }

  function removeCatalog(snapshot, periodId, divisionName){
    snapshot.divisiones = catalogFromSnapshot(snapshot).filter(function(row){return !(samePeriod(row.periodoId, periodId) && norm(row.division) === norm(divisionName));});
    syncPeriodCatalog(snapshot, periodId, divisionName, "remove");
    return snapshot;
  }

  function catalogExists(snapshot, periodId, divisionName){
    return catalogFromSnapshot(snapshot).some(function(row){return samePeriod(row.periodoId, periodId) && norm(row.division) === norm(divisionName);});
  }

  function assignedDivisionByCareer(students, periodId){
    var out = {};
    (students || []).forEach(function(student){
      var row = svc().normalizeStudent(student);
      if(periodId && !samePeriod(rowPeriod(row), periodId)){return;}
      var division = svc().studentDivision(row);
      if(norm(division) === norm(svc().sinDivision)){return;}
      out[norm(careerOf(row))] = division;
    });
    return out;
  }

  function createDivision(periodId, divisionName){
    periodId = text(periodId);
    divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de crear la división.");}
    if(!divisionName){throw new Error("Escribe el nombre de la división.");}

    var snapshot = clone(api().getSnapshot({force:true})) || {meta:{}, periods:[], students:[], history:[], diagnostics:[]};
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];

    var label = periodLabel(periodId, snapshot);
    var existed = catalogExists(snapshot, periodId, divisionName) || getDivisions(periodId).some(function(name){return norm(name) === norm(divisionName);});

    upsertCatalog(snapshot, periodId, divisionName);

    snapshot.history.unshift({
      id:"division_create_catalog_" + Date.now(),
      action:existed ? "divisionExistente" : "crearDivision",
      periodoId:periodId,
      periodoLabel:label,
      fileName:"Base Local",
      division:divisionName,
      carreras:[],
      totalRows:0,
      createdAt:now(),
      proceso:"crear_division_sin_carreras"
    });

    var saved = api().writeSnapshot(snapshot, {source:"division-create"});
    return {
      ok:true,
      action:existed ? "divisionExistente" : "crearDivision",
      periodId:periodId,
      periodLabel:label,
      division:divisionName,
      careers:[],
      updated:0,
      alreadyExists:existed,
      snapshot:saved,
      message:(existed ? "La división " : "División ") + divisionName + " del período " + label + (existed ? " ya existe." : " creada.")
    };
  }

  function getDivisions(periodId){
    var snapshot = api().getSnapshot({force:false}) || {};
    var fromOriginal = typeof original.getDivisions === "function" ? original.getDivisions.call(api(), periodId) : [];
    return uniqueSorted((fromOriginal || []).concat(catalogDivisionNames(snapshot, periodId)));
  }

  function getDivisionsWithEmpty(periodId){
    var fromOriginal = typeof original.getDivisionsWithEmpty === "function" ? original.getDivisionsWithEmpty.call(api(), periodId) : [];
    var sin = svc().sinDivision;
    var hasSin = (fromOriginal || []).some(function(name){return norm(name) === norm(sin);});
    var names = uniqueSorted((fromOriginal || []).filter(function(name){return norm(name) !== norm(sin);}).concat(getDivisions(periodId)));
    return hasSin ? [sin].concat(names) : names;
  }

  function getDivisionDetail(periodId, divisionName){
    var detail = typeof original.getDivisionDetail === "function" ? original.getDivisionDetail.call(api(), periodId, divisionName) : {periodId:periodId || "", division:divisionName || "", carreras:[], total:0};
    detail = detail || {periodId:periodId || "", division:divisionName || "", carreras:[], total:0};
    detail.existsInCatalog = catalogExists(api().getSnapshot({force:false}) || {}, periodId, divisionName);
    return detail;
  }

  function getDivisionsSummary(periodId){
    var summary = typeof original.getDivisionsSummary === "function" ? original.getDivisionsSummary.call(api(), periodId) : [];
    summary = Array.isArray(summary) ? summary.slice() : [];
    var seen = {};
    summary.forEach(function(row){seen[norm(row && row.division)] = true;});
    getDivisions(periodId).forEach(function(name){
      if(seen[norm(name)]){return;}
      seen[norm(name)] = true;
      summary.push({division:name,total:0,carreras:[]});
    });
    return summary.sort(function(a,b){return String(a.division || "").localeCompare(String(b.division || ""),"es");});
  }

  function replaceDivisionToCareers(periodId, oldDivisionName, newDivisionName, careers){
    periodId = text(periodId);
    oldDivisionName = text(oldDivisionName);
    newDivisionName = text(newDivisionName);
    var validCareers = uniqueCareers(careers);

    if(!periodId){throw new Error("Selecciona un período antes de editar la división.");}
    if(!newDivisionName){throw new Error("Escribe el nombre de la división.");}
    if(!oldDivisionName && !validCareers.length){throw new Error("Primero crea la división. Después adjunta carreras en un proceso separado.");}

    var snapshot = clone(api().getSnapshot({force:true})) || {meta:{}, periods:[], students:[], history:[], diagnostics:[]};
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];

    var assigned = assignedDivisionByCareer(snapshot.students, periodId);
    validCareers.forEach(function(career){
      var current = assigned[norm(career)];
      if(current && norm(current) !== norm(oldDivisionName) && norm(current) !== norm(newDivisionName)){
        throw new Error("La carrera ya pertenece a otra división: " + career + " → " + current);
      }
    });

    if(oldDivisionName && norm(oldDivisionName) !== norm(newDivisionName)){
      removeCatalog(snapshot, periodId, oldDivisionName);
    }
    upsertCatalog(snapshot, periodId, newDivisionName);

    var selected = {};
    validCareers.forEach(function(career){selected[norm(career)] = true;});

    var updated = 0;
    snapshot.students = snapshot.students.map(function(student){
      var row = svc().normalizeStudent(student);
      if(periodId && !samePeriod(rowPeriod(row), periodId)){return row;}

      var currentDivision = svc().studentDivision(row);
      var currentKey = norm(currentDivision);
      var careerKey = norm(careerOf(row));
      var shouldBelong = !!selected[careerKey];
      var belongedToOld = oldDivisionName ? currentKey === norm(oldDivisionName) : false;

      if(shouldBelong){
        if(currentKey !== norm(newDivisionName)){
          row.divisiones = [newDivisionName];
          row.division = newDivisionName;
          row.divisionActualizadaEn = now();
          row.updatedAt = now();
          row.ultimaSincronizacion = now();
          updated += 1;
        }
        return row;
      }

      if(belongedToOld){
        row.divisiones = [];
        delete row.division;
        row.divisionActualizadaEn = now();
        row.updatedAt = now();
        row.ultimaSincronizacion = now();
        updated += 1;
      }

      return row;
    });

    var label = periodLabel(periodId, snapshot);
    var action = oldDivisionName && norm(oldDivisionName) !== norm(newDivisionName) ? "editarDivision" : "asignarCarrerasDivision";
    if(!validCareers.length){action = "quitarCarrerasDivision";}

    snapshot.history.unshift({
      id:"division_assign_patch_" + Date.now(),
      action:action,
      periodoId:periodId,
      periodoLabel:label,
      fileName:"Base Local",
      division:newDivisionName,
      divisionAnterior:oldDivisionName,
      carreras:validCareers,
      totalRows:updated,
      createdAt:now(),
      proceso:"adjuntar_carreras"
    });

    var saved = api().writeSnapshot(snapshot, {source:"division-assign-patch"});
    return {
      ok:true,
      action:action,
      periodId:periodId,
      periodLabel:label,
      division:newDivisionName,
      oldDivision:oldDivisionName,
      careers:validCareers,
      updated:updated,
      snapshot:saved,
      message:"Carreras actualizadas en la división " + newDivisionName + " del período " + label + "."
    };
  }

  function deleteDivision(periodId, divisionName){
    periodId = text(periodId);
    divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de borrar la división.");}
    if(!divisionName){throw new Error("Selecciona la división que deseas borrar.");}

    var snapshot = clone(api().getSnapshot({force:true})) || {meta:{}, periods:[], students:[], history:[], diagnostics:[]};
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];

    var cleared = svc().clearDivision(snapshot.students, periodId, divisionName);
    snapshot.students = cleared.students;
    removeCatalog(snapshot, periodId, divisionName);

    var label = periodLabel(periodId, snapshot);
    snapshot.history.unshift({
      id:"division_delete_patch_" + Date.now(),
      action:"borrarDivision",
      periodoId:periodId,
      periodoLabel:label,
      fileName:"Base Local",
      division:divisionName,
      totalRows:cleared.updated || 0,
      createdAt:now()
    });

    var saved = api().writeSnapshot(snapshot, {source:"division-delete-patch"});
    return {ok:true, action:"borrarDivision", periodId:periodId, periodLabel:label, division:divisionName, updated:cleared.updated || 0, snapshot:saved};
  }

  window.BaseLocalAPI.getDivisions = getDivisions;
  window.BaseLocalAPI.getDivisionsWithEmpty = getDivisionsWithEmpty;
  window.BaseLocalAPI.getDivisionDetail = getDivisionDetail;
  window.BaseLocalAPI.getDivisionsSummary = getDivisionsSummary;
  window.BaseLocalAPI.createDivision = createDivision;
  window.BaseLocalAPI.replaceDivisionToCareers = replaceDivisionToCareers;
  window.BaseLocalAPI.deleteDivision = deleteDivision;
})(window);
