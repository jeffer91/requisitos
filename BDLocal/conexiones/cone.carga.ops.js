/* =========================================================
Archivo: cone.carga.ops.js
Ruta: /BDLocal/conexiones/cone.carga.ops.js
Función:
- Extender ConCarga con lecturas y escrituras usadas por /Carga/.
- Mantener carreras y divisiones estrictamente aisladas por período.
- Usar los estudiantes reales del período como catálogo autoritativo de carreras.
- Garantizar una sola división por carrera y una división efectiva por estudiante.
- Reparar periodos_carreras, periodos_divisiones, divisiones_estudiante y matriculas_periodo.
- Registrar cada carga de archivo para Firebase sin duplicar por archivo/período.
========================================================= */
(function(window){
  "use strict";

  var api = window.ConCarga || window.BDLocalCarga;
  if(!api){ return; }
  var VERSION = "2.0.0-period-strict-divisions";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }
  function repositories(){ return window.BDLRepositories || null; }
  function importRepo(){
    if(window.BDLRepoImportaciones){ return window.BDLRepoImportaciones; }
    var registry = repositories();
    return registry && typeof registry.get === "function" ? registry.get("importaciones") : null;
  }
  function changesRepo(){
    if(window.BDLRepoCambios){ return window.BDLRepoCambios; }
    var registry = repositories();
    return registry && typeof registry.get === "function"
      ? (registry.get("cambios_pendientes") || registry.get("cambios"))
      : null;
  }
  function canon(value){
    var utils = window.BDLocalConUtils;
    return utils && typeof utils.canonicalPeriodId === "function"
      ? utils.canonicalPeriodId(value)
      : text(value).replace(/_+/g, "__");
  }
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase();
  }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }
  function idOf(row){ return text(row && (row.idEstudiantePeriodo || row.studentId || row.id || row._id)); }
  function periodOf(row){ return canon(row && (row.periodoId || row.periodId || row.periodoCanonicoId || row.ultimoPeriodoId || "")); }
  function ready(){
    return Promise.resolve(typeof api.ready === "function" ? api.ready() : true).then(function(result){
      if(result && result.ok === false){ throw new Error(result.error || "ConCarga no está listo."); }
      if(!core()){ throw new Error("BL2Core no está disponible dentro de cone.carga."); }
      return api;
    });
  }
  function sharedStudents(options){
    var utils = window.BDLocalConUtils;
    if(!utils || typeof utils.readCache !== "function"){ return []; }
    var cache = utils.readCache() || {};
    var rows = Array.isArray(cache.students) ? cache.students : [];
    return typeof utils.filterStudents === "function" ? utils.filterStudents(rows, options || {}) : rows.slice();
  }
  function students(options){
    options = Object.assign({ matricula:"" }, options || {});
    options.periodoId = canon(options.periodoId || options.periodId || "");
    return ready().then(function(){
      if(typeof core().getStudents !== "function"){ return sharedStudents(options); }
      return Promise.resolve(core().getStudents(options)).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        return rows.length ? rows : sharedStudents(options);
      }).catch(function(){ return sharedStudents(options); });
    }).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      return options.periodoId
        ? rows.filter(function(row){ return periodOf(row) === options.periodoId; })
        : rows;
    });
  }
  function updateStudent(id, changes, options){
    options = Object.assign({ localOnly:true, sync:false }, options || {});
    return ready().then(function(){
      if(typeof core().updateStudent !== "function"){ throw new Error("No se puede actualizar el estudiante."); }
      return core().updateStudent(text(id), changes || {}, options);
    });
  }
  function removeStudents(periodoId, options){
    periodoId = canon(periodoId);
    options = Object.assign({ localOnly:true, sync:false }, options || {});
    return ready().then(function(){
      if(typeof core().deleteStudentsByPeriod === "function"){
        return core().deleteStudentsByPeriod(periodoId, options);
      }
      if(typeof core().deleteStudent !== "function"){ throw new Error("No se pueden borrar estudiantes."); }
      return students({ periodoId:periodoId, matricula:"" }).then(function(rows){
        var chain = Promise.resolve();
        rows.forEach(function(row){
          chain = chain.then(function(){ var id = idOf(row); return id ? core().deleteStudent(id, options) : null; });
        });
        return chain.then(function(){ return { ok:true, deleted:rows.length }; });
      });
    }).then(function(result){
      return typeof api.refresh === "function"
        ? Promise.resolve(api.refresh({ periodoId:periodoId, force:true, changed:true })).then(function(){ return result; })
        : result;
    });
  }
  function removePeriod(periodoId, options){
    periodoId = canon(periodoId);
    options = Object.assign({ deleteStudents:true, deleteDivisions:true, localOnly:true, sync:false }, options || {});
    return ready().then(function(){
      if(typeof core().deletePeriod !== "function"){ throw new Error("No se puede borrar el período."); }
      return core().deletePeriod(periodoId, options);
    }).then(function(result){
      return typeof api.refresh === "function"
        ? Promise.resolve(api.refresh({ force:true, changed:true })).then(function(){ return result; })
        : result;
    });
  }

  function career(item){
    item = item || {};
    if(typeof item === "string"){ item = { nombre:item }; }
    var code = text(item.codigo || item.codigoCarrera || item.CodigoCarrera || item.codCarrera || "");
    var name = text(item.nombre || item.nombreCarrera || item.NombreCarrera || item.carrera || item.Carrera || item._carrera || item.label || code);
    var id = key(code || name);
    if(!id || !name){ return null; }
    return { id:id, codigo:code, nombre:name, total:Math.max(0, Number(item.total || item.estudiantes || 0) || 0) };
  }
  function uniqueCareers(list){
    var map = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(item){
      var current = career(item);
      if(!current){ return; }
      if(!map[current.id]){ map[current.id] = current; }
      else{
        map[current.id] = Object.assign({}, map[current.id], current, {
          total:Math.max(Number(map[current.id].total || 0), Number(current.total || 0))
        });
      }
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }
  function careersFromStudents(rows){
    var counts = Object.create(null);
    var list = [];
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var current = career(row);
      if(!current){ return; }
      counts[current.id] = (counts[current.id] || 0) + 1;
      list.push(current);
    });
    return uniqueCareers(list).map(function(item){
      return Object.assign({}, item, { total:counts[item.id] || 0 });
    });
  }
  function normalizeDivision(item){
    if(!item){ return null; }
    if(typeof item === "string"){ item = { nombre:item }; }
    var name = text(item.nombre || item.label || item.name || item.id || "");
    var id = key(item.id || name);
    if(!id || !name){ return null; }
    return {
      id:id,
      nombre:name,
      carreras:uniqueCareers(item.carreras || item.careers || []),
      createdAt:item.createdAt || item.creadoEn || now(),
      updatedAt:item.updatedAt || item.actualizadoEn || now()
    };
  }
  function sanitizeDivisions(list, allowedCareers){
    var allowed = Object.create(null);
    uniqueCareers(allowedCareers || []).forEach(function(item){ allowed[item.id] = item; });
    var divisions = Object.create(null);
    var order = [];
    (Array.isArray(list) ? list : []).forEach(function(item){
      var division = normalizeDivision(item);
      if(!division){ return; }
      if(!divisions[division.id]){
        divisions[division.id] = Object.assign({}, division, { carreras:[] });
        order.push(division.id);
      }else{
        divisions[division.id].nombre = division.nombre;
        divisions[division.id].updatedAt = division.updatedAt || divisions[division.id].updatedAt;
      }
      divisions[division.id].carreras = uniqueCareers([].concat(divisions[division.id].carreras || [], division.carreras || []));
    });
    var owned = Object.create(null);
    return order.map(function(id){
      var division = divisions[id];
      var cleaned = [];
      (division.carreras || []).forEach(function(item){
        var current = career(item);
        if(!current || !allowed[current.id] || owned[current.id]){ return; }
        owned[current.id] = id;
        cleaned.push(allowed[current.id]);
      });
      return Object.assign({}, division, { carreras:uniqueCareers(cleaned) });
    }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" }); });
  }
  function assignmentMap(divisions){
    var map = Object.create(null);
    (divisions || []).forEach(function(division){
      (division.carreras || []).forEach(function(item){
        var current = career(item);
        if(current && !map[current.id]){ map[current.id] = text(division.nombre || division.id); }
      });
    });
    return map;
  }
  function careers(periodoId){
    periodoId = canon(periodoId);
    return students({ periodoId:periodoId, matricula:"" }).then(careersFromStudents);
  }
  function periodRecord(periodoId){
    periodoId = canon(periodoId);
    return ready().then(function(){
      return typeof core().getPeriods === "function" ? core().getPeriods() : [];
    }).then(function(rows){
      return (Array.isArray(rows) ? rows : []).filter(function(row){
        return canon(row && (row.periodoId || row.id || row.periodoCanonicoId)) === periodoId;
      })[0] || null;
    });
  }
  function divisions(periodoId){
    periodoId = canon(periodoId);
    return Promise.all([
      students({ periodoId:periodoId, matricula:"" }),
      periodRecord(periodoId)
    ]).then(function(values){
      var validCareers = careersFromStudents(values[0] || []);
      var period = values[1] || {};
      return sanitizeDivisions(period.divisiones || [], validCareers);
    });
  }

  function stores(){
    var current = window.BL2Config && window.BL2Config.stores || {};
    return {
      matriculas:current.matriculasPeriodo || "matriculas_periodo",
      divisiones:current.divisionesEstudiante || "divisiones_estudiante",
      periodosCarreras:current.periodosCarreras || "periodos_carreras",
      periodosDivisiones:current.periodosDivisiones || "periodos_divisiones"
    };
  }
  function dbGetAll(storeName){
    var database = db();
    return database && typeof database.getAll === "function"
      ? database.getAll(storeName).catch(function(){ return []; })
      : Promise.resolve([]);
  }
  function removeRows(storeName, predicate){
    var database = db();
    if(!database || typeof database.remove !== "function"){ return Promise.resolve(0); }
    return dbGetAll(storeName).then(function(rows){
      var chain = Promise.resolve();
      var removed = 0;
      (rows || []).forEach(function(row){
        if(!predicate(row)){ return; }
        var id = text(row && (row.id || row.idEstudiantePeriodo || row.key || row._id));
        if(!id){ return; }
        chain = chain.then(function(){
          return database.remove(storeName, id).then(function(){ removed += 1; }).catch(function(){ return null; });
        });
      });
      return chain.then(function(){ return removed; });
    });
  }
  function putMany(storeName, rows){
    var database = db();
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length || !database){ return Promise.resolve([]); }
    if(typeof database.bulkPut === "function"){ return database.bulkPut(storeName, rows); }
    if(typeof database.put !== "function"){ return Promise.resolve([]); }
    var saved = [];
    var chain = Promise.resolve();
    rows.forEach(function(row){
      chain = chain.then(function(){ return database.put(storeName, row).then(function(value){ saved.push(value || row); }); });
    });
    return chain.then(function(){ return saved; });
  }
  function repairV2(period, studentRows, divisionsRows, careersRows){
    var database = db();
    if(!database){ return Promise.resolve({ ok:true, skipped:true }); }
    var currentStores = stores();
    var periodoId = canon(period && (period.periodoId || period.id));
    var assigned = assignmentMap(divisionsRows);
    var periodCareerRows = (careersRows || []).map(function(item){
      return {
        type:"career",
        id:periodoId + "__" + item.id,
        periodoId:periodoId,
        careerId:item.id,
        codigoCarrera:item.codigo || "",
        carrera:item.nombre,
        updatedAt:now(),
        source:"division_integrity"
      };
    });
    var periodDivisionRows = (divisionsRows || []).map(function(item){
      return {
        type:"division",
        id:periodoId + "__" + item.id,
        periodoId:periodoId,
        divisionId:item.id,
        division:item.nombre,
        nombre:item.nombre,
        carreras:uniqueCareers(item.carreras || []),
        updatedAt:now(),
        source:"division_integrity"
      };
    });
    var studentDivisionRows = [];
    (studentRows || []).forEach(function(row){
      var studentId = idOf(row);
      var currentCareer = career(row);
      var label = currentCareer ? text(assigned[currentCareer.id] || "") : "";
      if(!studentId || !label){ return; }
      studentDivisionRows.push({
        id:studentId + "__" + key(label),
        idEstudiantePeriodo:studentId,
        studentId:studentId,
        cedula:text(row.cedula || row.numeroIdentificacion || ""),
        periodoId:periodoId,
        division:label,
        divisionKey:key(label),
        source:"division_integrity",
        updatedAt:now()
      });
    });

    return Promise.all([
      removeRows(currentStores.periodosCarreras, function(row){ return canon(row && row.periodoId) === periodoId; }),
      removeRows(currentStores.periodosDivisiones, function(row){ return canon(row && row.periodoId) === periodoId; }),
      removeRows(currentStores.divisiones, function(row){ return canon(row && row.periodoId) === periodoId; })
    ]).then(function(){
      return Promise.all([
        putMany(currentStores.periodosCarreras, periodCareerRows),
        putMany(currentStores.periodosDivisiones, periodDivisionRows),
        putMany(currentStores.divisiones, studentDivisionRows)
      ]);
    }).then(function(){
      if(typeof database.get !== "function" || typeof database.put !== "function"){ return 0; }
      var chain = Promise.resolve();
      var updated = 0;
      (studentRows || []).forEach(function(row){
        var studentId = idOf(row);
        var currentCareer = career(row);
        var label = currentCareer ? text(assigned[currentCareer.id] || "") : "";
        if(!studentId){ return; }
        chain = chain.then(function(){
          return database.get(currentStores.matriculas, studentId).catch(function(){ return null; }).then(function(existing){
            if(!existing){ return null; }
            var previous = text(existing.division || "");
            var previousList = Array.isArray(existing.divisiones) ? existing.divisiones : [];
            if(previous === label && previousList.length === (label ? 1 : 0) && (!label || text(previousList[0]) === label)){ return null; }
            updated += 1;
            return database.put(currentStores.matriculas, Object.assign({}, existing, {
              division:label,
              divisiones:label ? [label] : [],
              updatedAt:now(),
              source:existing.source || "division_integrity"
            }));
          });
        });
      });
      return chain.then(function(){ return { ok:true, matriculasActualizadas:updated, divisionesEstudiante:studentDivisionRows.length }; });
    });
  }
  function rollbackDivisionSave(oldPeriod, snapshots, periodoId){
    var chain = Promise.resolve();
    (snapshots || []).slice().reverse().forEach(function(snapshot){
      chain = chain.then(function(){
        return updateStudent(snapshot.id, {
          division:snapshot.division,
          divisiones:snapshot.divisiones,
          divisionActualizadaEn:snapshot.divisionActualizadaEn || ""
        }, { periodoId:periodoId, action:"division_rollback" }).catch(function(){ return null; });
      });
    });
    if(oldPeriod && typeof core().savePeriod === "function"){
      chain = chain.then(function(){ return core().savePeriod(oldPeriod).catch(function(){ return null; }); });
    }
    return chain;
  }
  function saveDivisions(period, divisionRows){
    period = Object.assign({}, period || {});
    var periodoId = canon(period.periodoId || period.id || period.periodoCanonicoId || "");
    if(!periodoId){ return Promise.reject(new Error("No se puede guardar divisiones sin período.")); }

    return Promise.all([
      students({ periodoId:periodoId, matricula:"" }),
      periodRecord(periodoId)
    ]).then(function(values){
      var rows = values[0] || [];
      var oldPeriod = values[1] ? JSON.parse(JSON.stringify(values[1])) : null;
      var validCareers = careersFromStudents(rows);
      var cleanDivisions = sanitizeDivisions(divisionRows || [], validCareers);
      var assigned = assignmentMap(cleanDivisions);
      var preparedPeriod = Object.assign({}, oldPeriod || {}, period, {
        id:periodoId,
        periodoId:periodoId,
        periodoCanonicoId:periodoId,
        carrerasDetectadas:validCareers,
        divisiones:cleanDivisions,
        updatedAt:now()
      });
      var changedSnapshots = [];
      var updated = 0;

      return ready().then(function(){
        if(typeof core().savePeriod !== "function"){ throw new Error("No se puede guardar la configuración del período."); }
        return core().savePeriod(preparedPeriod);
      }).then(function(){
        var chain = Promise.resolve();
        rows.forEach(function(row){
          var currentCareer = career(row);
          var desired = currentCareer ? text(assigned[currentCareer.id] || "") : "";
          var current = text(row.division || row.Division || row._division || "");
          if(current === desired || !idOf(row)){ return; }
          chain = chain.then(function(){
            changedSnapshots.push({
              id:idOf(row),
              division:current,
              divisiones:Array.isArray(row.divisiones) ? row.divisiones.slice() : (current ? [current] : []),
              divisionActualizadaEn:text(row.divisionActualizadaEn || "")
            });
            return updateStudent(idOf(row), {
              division:desired,
              divisiones:desired ? [desired] : [],
              divisionActualizadaEn:now()
            }, { periodoId:periodoId, action:"division_period_career_update" }).then(function(){ updated += 1; });
          });
        });
        return chain;
      }).then(function(){
        var finalRows = rows.map(function(row){
          var currentCareer = career(row);
          var desired = currentCareer ? text(assigned[currentCareer.id] || "") : "";
          return Object.assign({}, row, { division:desired, divisiones:desired ? [desired] : [] });
        });
        return repairV2(preparedPeriod, finalRows, cleanDivisions, validCareers).then(function(repair){
          return { ok:true, updated:updated, total:rows.length, careers:validCareers.length, divisions:cleanDivisions.length, repair:repair, period:preparedPeriod };
        });
      }).catch(function(error){
        return rollbackDivisionSave(oldPeriod, changedSnapshots, periodoId).then(function(){
          throw new Error((error && error.message ? error.message : String(error)) + " La operación fue revertida para evitar un guardado parcial.");
        });
      }).then(function(result){
        if(window.BLDivisionesService && typeof window.BLDivisionesService.invalidate === "function"){
          try{ window.BLDivisionesService.invalidate(); }catch(error){}
        }
        return typeof api.refresh === "function"
          ? Promise.resolve(api.refresh({ periodoId:periodoId, force:true, changed:true, immediate:true, incremental:true })).then(function(){ return result; })
          : result;
      });
    });
  }

  function waitImportRepository(timeoutMs){
    timeoutMs = Math.max(1000, Number(timeoutMs || 8000));
    var started = Date.now();
    return new Promise(function(resolve, reject){
      (function check(){
        var current = importRepo();
        if(current && typeof current.save === "function"){ resolve(current); return; }
        if(window.BDLOutboxBridge && typeof window.BDLOutboxBridge.loadSharedArchitecture === "function"){
          window.BDLOutboxBridge.loadSharedArchitecture().catch(function(){});
        }
        if(Date.now() - started >= timeoutMs){ reject(new Error("No se pudo preparar el repositorio de importaciones.")); return; }
        window.setTimeout(check, 60);
      })();
    });
  }
  function saveImport(row){
    row = Object.assign({}, row || {});
    row.periodoId = canon(row.periodoId || row.periodId || "");
    row.archivoHash = text(row.archivoHash || row.rawTextHash || row.hash);
    row.archivoNombre = text(row.archivoNombre || row.fileName || row.archivo || "carga_estudiantes");
    row.source = text(row.source || "CARGA_ARCHIVO").toUpperCase();
    row.tipo = text(row.tipo || "ARCHIVO_ESTUDIANTES").toUpperCase();
    row.createdAt = text(row.createdAt) || now();
    row.updatedAt = now();
    if(!row.periodoId){ return Promise.reject(new Error("La importación no tiene período.")); }
    if(!row.archivoHash){ return Promise.reject(new Error("La importación no tiene hash de archivo.")); }
    row.id = text(row.id) || "importacion__" + row.archivoHash + "__" + row.periodoId;
    row.importacionId = row.id;

    return waitImportRepository().then(function(current){ return current.save(row); }).then(function(saved){
      var changes = changesRepo();
      if(!changes || typeof changes.save !== "function"){ throw new Error("No se pudo preparar la cola para la importación."); }
      return changes.save({
        tabla:"importaciones",
        periodoId:saved.periodoId,
        registroId:saved.id,
        accion:"UPSERT",
        payload:saved,
        estadoSheets:"SINCRONIZADO",
        statusGoogle:"SINCRONIZADO",
        estadoSupabase:"SINCRONIZADO",
        statusSupabase:"SINCRONIZADO",
        estadoFirebase:"PENDIENTE",
        statusFirebase:"PENDIENTE",
        createdAt:saved.createdAt,
        updatedAt:saved.updatedAt
      }, { source:"cone.carga.saveImport" }).then(function(change){
        try{ window.dispatchEvent(new CustomEvent("bdlocal:carga-import-registered", { detail:{ importacion:saved, cambioId:change && change.id || "" } })); }catch(error){}
        return Object.assign({}, saved, { cambioId:change && change.id || "" });
      });
    });
  }

  api.versionOps = VERSION;
  api.careerKey = function(item){ var current = career(item); return current ? current.id : ""; };
  api.normalizeCareer = career;
  api.sanitizeDivisions = sanitizeDivisions;
  api.listStudents = students;
  api.getStudents = students;
  api.updateStudent = updateStudent;
  api.actualizarEstudiante = updateStudent;
  api.deleteStudentsByPeriod = removeStudents;
  api.deletePeriod = removePeriod;
  api.listCareers = careers;
  api.getCareers = careers;
  api.listDivisions = divisions;
  api.getDivisions = divisions;
  api.saveDivisions = saveDivisions;
  api.repairDivisionsV2 = function(periodoId){
    periodoId = canon(periodoId);
    return Promise.all([students({ periodoId:periodoId, matricula:"" }), periodRecord(periodoId), divisions(periodoId)]).then(function(values){
      var validCareers = careersFromStudents(values[0] || []);
      var period = Object.assign({}, values[1] || { id:periodoId, periodoId:periodoId }, { carrerasDetectadas:validCareers, divisiones:values[2] || [] });
      return repairV2(period, values[0] || [], values[2] || [], validCareers);
    });
  };
  api.saveImport = saveImport;
  api.registrarImportacion = saveImport;
  api.read = function(options){
    options = options || {};
    var periodoId = canon(options.periodoId || options.periodId || "");
    return Promise.all([api.getPeriods(), students(options), api.getSummary(periodoId)]).then(function(values){
      return { ok:true, source:"ConCarga", screen:"carga", data:{ periods:values[0] || [], students:values[1] || [], summary:values[2] || {} } };
    });
  };
})(window);
