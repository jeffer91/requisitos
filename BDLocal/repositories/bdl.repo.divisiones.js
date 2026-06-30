(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var T = window.BDLNormText;
  if(!B || !T){ throw new Error("BDLRepoDivisiones requiere BDLRepoBase y BDLNormText."); }

  function cfgKey(periodoId){ return "divisiones_periodo__" + String(periodoId || ""); }
  function carreraKey(row){ return T.key(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || "SIN_CARRERA"); }
  function carreraLabel(row){ return T.cleanSpaces(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || "Sin carrera"); }
  function recordDivision(action, periodoId, nombre, payload){
    if(window.BDLManualEvents && typeof window.BDLManualEvents.recordDivision === "function"){
      window.BDLManualEvents.recordDivision(action, periodoId, nombre, payload || {});
    }
  }

  function guardarMuchos(rows){ return B.putAll(B.stores.estudianteDivisiones, rows); }
  function porEstudiante(idEstudiantePeriodo){ return B.byIndex(B.stores.estudianteDivisiones, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 }); }
  function porPeriodo(periodoId){ return B.byIndex(B.stores.estudianteDivisiones, "by_periodoId", periodoId, { limit: 0 }); }
  function porPeriodoDivision(periodoId, divisionKey){ return B.byIndex(B.stores.estudianteDivisiones, "by_periodo_division", [periodoId, divisionKey], { limit: 0 }); }

  function getConfig(periodoId){
    return B.get(B.stores.appConfig, cfgKey(periodoId)).then(function(row){
      return row && row.valor ? row.valor : { periodoId: periodoId, divisiones: [] };
    });
  }

  function saveConfig(periodoId, config){
    config = config || { periodoId: periodoId, divisiones: [] };
    config.periodoId = periodoId;
    config.updatedAt = B.now();
    return B.put(B.stores.appConfig, { clave: cfgKey(periodoId), valor: config, updatedAt: B.now() }).then(function(){ return config; });
  }

  function carrerasPorPeriodo(periodoId){
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(rows){
      var map = {};
      rows.forEach(function(row){
        var key = carreraKey(row);
        if(key && !map[key]){ map[key] = { key: key, nombre: carreraLabel(row), codigo: row.codigoCarrera || row.CodigoCarrera || "" }; }
      });
      return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return a.nombre.localeCompare(b.nombre, "es"); });
    });
  }

  function rowDivision(student, division){
    var id = student.idEstudiantePeriodo;
    return { id:id + "__principal", idEstudiantePeriodo:id, periodoId:student.periodoId, numeroIdentificacion:student.numeroIdentificacion || "", division:division, divisionKey:T.key(division), esPrincipal:true, actualizadaEn:B.now() };
  }

  function updateStudent(student, division){
    var resumen = Object.assign({}, student || {});
    var id = resumen.idEstudiantePeriodo;
    resumen.divisionPrincipal = division || "";
    resumen.division = division || "";
    resumen.Division = division || "";
    resumen.divisiones = division ? [division] : [];
    resumen.actualizadoEn = B.now();
    return B.put(B.stores.estudiantesResumen, resumen).then(function(){
      return B.get(B.stores.estudiantesDetalle, id).then(function(detalle){
        if(!detalle){ return null; }
        detalle = Object.assign({}, detalle, { divisionPrincipal:resumen.divisionPrincipal, division:resumen.division, Division:resumen.Division, divisiones:resumen.divisiones, actualizadoEn:B.now() });
        return B.put(B.stores.estudiantesDetalle, detalle);
      });
    }).then(function(){
      if(division){ return B.put(B.stores.estudianteDivisiones, rowDivision(resumen, division)); }
      return B.remove(B.stores.estudianteDivisiones, id + "__principal").catch(function(){ return null; });
    });
  }

  function aplicarConfiguracion(periodoId, config){
    config = config || { divisiones: [] };
    var carreraToDivision = {};
    (config.divisiones || []).forEach(function(div){
      (div.carreras || []).forEach(function(key){ carreraToDivision[key] = div.nombre; });
    });
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(students){
      var updated = 0;
      var chain = Promise.resolve();
      students.forEach(function(student){
        var div = carreraToDivision[carreraKey(student)] || "";
        chain = chain.then(function(){ return updateStudent(student, div).then(function(){ updated += 1; }); });
      });
      return chain.then(function(){
        B.cacheClear();
        if(window.BDLRepoEstudiantes && window.BDLRepoEstudiantes.mirrorSnapshot){ window.BDLRepoEstudiantes.mirrorSnapshot(); }
        return { ok:true, updated:updated };
      });
    });
  }

  function guardarDivision(periodoId, nombre, oldNombre, carreras){
    nombre = T.cleanSpaces(nombre || "");
    oldNombre = T.cleanSpaces(oldNombre || nombre);
    carreras = Array.isArray(carreras) ? carreras : [];
    if(!nombre){ return Promise.reject(new Error("Ingrese el nombre de la división.")); }
    return getConfig(periodoId).then(function(config){
      var before = JSON.parse(JSON.stringify(config || {}));
      var divisiones = config.divisiones || [];
      divisiones.forEach(function(div){ div.carreras = (div.carreras || []).filter(function(key){ return carreras.indexOf(key) < 0; }); });
      var current = divisiones.filter(function(div){ return div.nombre === oldNombre; })[0];
      if(!current){ current = { nombre:nombre, carreras:[] }; divisiones.push(current); }
      current.nombre = nombre;
      current.carreras = carreras;
      config.divisiones = divisiones.filter(function(div){ return div.nombre && ((div.carreras || []).length || div.nombre === nombre); });
      return saveConfig(periodoId, config).then(function(saved){
        return aplicarConfiguracion(periodoId, saved).then(function(){
          recordDivision("guardar_division", periodoId, nombre, { oldNombre:oldNombre, carreras:carreras, before:before, after:saved });
          return saved;
        });
      });
    });
  }

  function borrarDivision(periodoId, nombre){
    nombre = T.cleanSpaces(nombre || "");
    return getConfig(periodoId).then(function(config){
      var before = JSON.parse(JSON.stringify(config || {}));
      config.divisiones = (config.divisiones || []).filter(function(div){ return div.nombre !== nombre; });
      return saveConfig(periodoId, config).then(function(saved){
        return aplicarConfiguracion(periodoId, saved).then(function(){
          recordDivision("borrar_division", periodoId, nombre, { oldNombre:nombre, before:before, after:saved });
          return saved;
        });
      });
    });
  }

  window.BDLRepoDivisiones = { guardarMuchos:guardarMuchos, porEstudiante:porEstudiante, porPeriodo:porPeriodo, porPeriodoDivision:porPeriodoDivision, getConfig:getConfig, saveConfig:saveConfig, carrerasPorPeriodo:carrerasPorPeriodo, guardarDivision:guardarDivision, borrarDivision:borrarDivision, aplicarConfiguracion:aplicarConfiguracion };
})(window);