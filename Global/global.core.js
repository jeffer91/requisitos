/* =========================================================
Nombre completo: global.core.js
Ruta o ubicación: /Requisitos/Global/global.core.js
Función:
- Consumir una sola vez el snapshot ya hidratado de ConGlobal/BDLocalGlobal.
- Aplicar disponibilidad de períodos con un mes completo de titulación.
- Filtrar períodos cronológicamente y normalizar carrera, división y requisito.
- Calcular indicadores, agrupaciones y graduados sin duplicar estudiante-período.
- Mostrar en Graduados únicamente períodos con al menos tres graduados.
- Recargar desde la caché central sin reconstruir Base Local.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0-stable-cache-core";
  var config = window.GlobalConfig || {};
  var state = {
    ready: false,
    loading: null,
    snapshot: null,
    lastGoodSnapshot: null,
    lastFilters: null,
    lastData: null,
    errors: [],
    revision: 0
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(error){}
  }

  function addError(message, error){
    state.errors.push({
      message: text(message),
      detail: error && error.message ? error.message : text(error),
      at: new Date().toISOString()
    });

    if(state.errors.length > 20){
      state.errors = state.errors.slice(-20);
    }

    try{ console.warn("[GlobalCore] " + message, error || ""); }
    catch(consoleError){}
  }

  function connection(){
    if(window.ConGlobal){ return window.ConGlobal; }
    if(window.BDLocalGlobal){ return window.BDLocalGlobal; }

    if(
      window.BDLocalConexiones &&
      typeof window.BDLocalConexiones.get === "function"
    ){
      return window.BDLocalConexiones.get("global");
    }

    return null;
  }

  function waitForConnection(attempt){
    attempt = Number(attempt || 0);

    if(connection()){
      return Promise.resolve(connection());
    }

    if(
      attempt === 0 &&
      window.BDLocalScreenDeps &&
      typeof window.BDLocalScreenDeps.ready === "function"
    ){
      return Promise.resolve(window.BDLocalScreenDeps.ready())
        .catch(function(){ return null; })
        .then(function(){ return waitForConnection(1); });
    }

    if(
      attempt === 0 &&
      window.BDLScreenDepsReady &&
      typeof window.BDLScreenDepsReady.then === "function"
    ){
      return Promise.resolve(window.BDLScreenDepsReady)
        .catch(function(){ return null; })
        .then(function(){ return waitForConnection(1); });
    }

    if(attempt >= 50){
      return Promise.resolve(null);
    }

    return new Promise(function(resolve){
      window.setTimeout(resolve, 50);
    }).then(function(){
      return waitForConnection(attempt + 1);
    });
  }

  function fallbackSnapshot(){
    var repo = window.ExcelLocalRepo || window.BL2DataEngine || null;
    var periods = [];
    var students = [];
    var requirements = [];

    try{
      if(repo && typeof repo.listPeriods === "function"){
        periods = repo.listPeriods() || [];
      }else if(repo && typeof repo.getPeriods === "function"){
        periods = repo.getPeriods() || [];
      }
    }catch(error){
      addError("No se pudieron leer períodos de respaldo", error);
    }

    try{
      if(repo && typeof repo.listStudents === "function"){
        var result = repo.listStudents({ matricula: "" });
        students = Array.isArray(result)
          ? result
          : array(result && (result.rows || result.students || result.estudiantes));
      }else if(repo && typeof repo.getStudents === "function"){
        students = repo.getStudents({ matricula: "" }) || [];
      }
    }catch(error2){
      addError("No se pudieron leer estudiantes de respaldo", error2);
    }

    try{
      if(repo && typeof repo.getRequirements === "function"){
        requirements = repo.getRequirements({}) || [];
      }
    }catch(error3){
      addError("No se pudieron leer requisitos de respaldo", error3);
    }

    return {
      ok: true,
      source: "GlobalCore.fallback",
      meta: {},
      periods: periods,
      students: students,
      requirements: requirements,
      careers: [],
      requirementCatalog: [],
      diagnostics: [],
      generatedAt: new Date().toISOString()
    };
  }

  function snapshotFromConnection(repo){
    if(repo && typeof repo.snapshot === "function"){
      return repo.snapshot({ filters: { matricula: "" } });
    }

    if(repo && typeof repo.getSnapshot === "function"){
      return repo.getSnapshot({ filters: { matricula: "" } });
    }

    return fallbackSnapshot();
  }

  function periodIdOf(value){
    value = value || {};
    return text(
      value.periodoCanonicoId ||
      value.periodoId ||
      value.periodId ||
      value.ultimoPeriodoId ||
      value.idPeriodo ||
      value._periodoId ||
      value._bl2PeriodoId ||
      value.PeriodoId ||
      value.id ||
      value.value ||
      value.key ||
      value.periodo ||
      value.Periodo
    );
  }

  function periodLabelOf(value){
    value = value || {};
    return text(
      value.periodoCanonicoLabel ||
      value.periodoLabel ||
      value.label ||
      value.nombre ||
      value.name ||
      value.periodo ||
      value.Periodo ||
      value._periodo ||
      value._bl2Periodo ||
      periodIdOf(value)
    );
  }

  function normalizePeriod(value){
    if(typeof value === "string"){
      value = { id: value, label: value };
    }

    value = value || {};
    var id = periodIdOf(value);
    var label = periodLabelOf(value) || id;

    if(!id && !label){ return null; }

    return Object.assign({}, value, {
      id: id || label,
      value: id || label,
      key: id || label,
      label: label || id,
      nombre: label || id,
      periodoId: id || label,
      periodId: id || label,
      periodoLabel: label || id
    });
  }

  function samePeriod(a, b){
    if(!text(a) || !text(b)){ return text(a) === text(b); }

    try{
      if(
        window.BDLocalConUtils &&
        typeof window.BDLocalConUtils.samePeriod === "function"
      ){
        return window.BDLocalConUtils.samePeriod(a, b);
      }
    }catch(error){}

    return key(a) === key(b);
  }

  function cedulaOf(row){
    row = row || {};
    var value = text(
      row.cedula ||
      row.Cedula ||
      row["Cédula"] ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row._cedula ||
      row._bl2Id
    );

    try{
      if(
        window.BDLocalConUtils &&
        typeof window.BDLocalConUtils.normalizeCedula === "function"
      ){
        return window.BDLocalConUtils.normalizeCedula(value);
      }
    }catch(error){}

    return value.replace(/[^0-9A-Za-z]/g, "");
  }

  function studentName(row){
    row = row || {};
    return text(
      row.Nombres ||
      row.nombres ||
      row.nombreCompleto ||
      row.Nombre ||
      row.nombre ||
      row.Estudiante ||
      row.estudiante ||
      row._nombres ||
      row._bl2Nombre
    );
  }

  function careerName(row){
    row = row || {};
    return text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.carrera ||
      row.Carrera ||
      row._carrera ||
      row._bl2Carrera
    ) || "SIN CARRERA";
  }

  function careerCode(row){
    row = row || {};
    return text(
      row.CodigoCarrera ||
      row.codigoCarrera ||
      row.codigo ||
      row._codigoCarrera ||
      careerName(row)
    );
  }

  function divisionName(row){
    row = row || {};
    var divisions = array(row.divisiones);
    var first = divisions.length
      ? text(
          divisions[0] && typeof divisions[0] === "object"
            ? (
                divisions[0].nombre ||
                divisions[0].label ||
                divisions[0].division
              )
            : divisions[0]
        )
      : "";

    return text(
      row.division ||
      row.Division ||
      row["División"] ||
      row._division ||
      row._bl2Division ||
      row.divisionPrincipal ||
      first ||
      "Sin división"
    ) || "Sin división";
  }

  function matriculaState(row){
    row = row || {};
    var value = text(
      row.estadoMatricula ||
      row.EstadoMatricula ||
      row._estadoMatricula ||
      row._bl2EstadoMatricula ||
      "ACTIVO"
    ).toUpperCase();

    return value === "RETIRADO" ? "RETIRADO" : "ACTIVO";
  }

  function typeCareer(name){
    if(
      config.reglas &&
      typeof config.reglas.tipoCarrera === "function"
    ){
      return config.reglas.tipoCarrera(name);
    }

    return text(name).toUpperCase().indexOf("UNIVERSITARIA") >= 0
      ? "UNIVERSITARIA"
      : "SUPERIOR";
  }

  function requirementName(requirement){
    requirement = requirement || {};
    return text(
      requirement.requisitoId ||
      requirement.requisitoKey ||
      requirement.requisito ||
      requirement.nombreRequisito ||
      requirement.requisitoNombre ||
      requirement.campo ||
      requirement.field ||
      requirement.key ||
      requirement.id ||
      requirement.nombre ||
      requirement.label
    );
  }

  function requirementRecordValue(requirement){
    requirement = requirement || {};
    var names = ["estado", "estadoKey", "valor", "value", "cumple", "resultado"];

    for(var index = 0; index < names.length; index += 1){
      if(Object.prototype.hasOwnProperty.call(requirement, names[index])){
        return requirement[names[index]];
      }
    }

    return "";
  }

  function normalizeRequirement(requirement){
    requirement = Object.assign({}, requirement || {});
    var id = requirementName(requirement);

    if(!id){ return null; }

    return Object.assign(requirement, {
      id: id,
      key: requirement.key || id,
      label: text(
        requirement.label ||
        requirement.nombre ||
        requirement.nombreRequisito ||
        id
      )
    });
  }

  function requirementMatchesStudent(requirement, student){
    var reqCedula = cedulaOf(requirement);
    var studentCedula = cedulaOf(student);
    var reqPeriod = periodIdOf(requirement);
    var studentPeriod = periodIdOf(student);
    var reqStudentId = text(
      requirement.idEstudiantePeriodo ||
      requirement.matriculaId ||
      ""
    );
    var studentId = text(
      student.idEstudiantePeriodo ||
      student.matriculaId ||
      student.id ||
      ""
    );

    if(reqStudentId && studentId && reqStudentId === studentId){
      return true;
    }

    return !!(
      reqCedula &&
      studentCedula &&
      reqCedula === studentCedula &&
      (!reqPeriod || !studentPeriod || samePeriod(reqPeriod, studentPeriod))
    );
  }

  function applyRequirementAlias(target, name, value){
    var id = key(name);

    if(name && text(target[name]) === ""){
      target[name] = value;
    }

    function put(property){
      if(text(target[property]) === ""){
        target[property] = value;
      }
    }

    if(id.indexOf("academ") >= 0){ put("Académico"); }
    if(id.indexOf("document") >= 0){ put("Documentación"); }
    if(id.indexOf("financier") >= 0 || id.indexOf("pago") >= 0){ put("Financiero"); }
    if(id.indexOf("titulacion") >= 0){ put("Titulación"); }
    if(id.indexOf("practic") >= 0){ put("PrácticasVinculacion"); }
    if(id.indexOf("vincul") >= 0){ put("Vinculación"); }
    if(id.indexOf("seguimiento") >= 0){ put("SeguimientoGraduados"); }
    if(id.indexOf("ingles") >= 0){ put("Inglés"); }
    if(id.indexOf("actualizacion") >= 0 && id.indexOf("dato") >= 0){ put("ActualizaciónDatos"); }

    if(
      id === "aprobaciontitulacion" ||
      (id.indexOf("aprobacion") >= 0 && id.indexOf("titulacion") >= 0)
    ){
      put("AprobacionTitulacion");
    }

    if(
      id === "aprobacioncomplexivoproyecto" ||
      (
        id.indexOf("aprobacion") >= 0 &&
        (id.indexOf("complexivo") >= 0 || id.indexOf("proyecto") >= 0)
      )
    ){
      put("AprobacionComplexivoProyecto");
    }
  }

  function normalizeStudent(row, requirements){
    row = Object.assign({}, row || {});
    var linked = array(row._globalRequirements).length
      ? array(row._globalRequirements).map(clone)
      : array(row.requisitos).length
        ? array(row.requisitos).map(clone)
        : array(requirements).filter(function(requirement){
            return requirementMatchesStudent(requirement, row);
          }).map(clone);

    row._globalRequirements = linked;
    row.requisitos = linked.map(clone);

    linked.forEach(function(requirement){
      applyRequirementAlias(
        row,
        requirementName(requirement),
        requirementRecordValue(requirement)
      );
    });

    var periodId = periodIdOf(row);
    var periodLabel = periodLabelOf(row) || periodId || "SIN PERÍODO";
    var career = careerName(row);

    row._globalCedula = cedulaOf(row);
    row._globalNombres = studentName(row);
    row._globalCarrera = career;
    row._globalCodigoCarrera = careerCode(row);
    row._globalTipoCarrera = typeCareer(career);
    row._globalPeriodoId = periodId || periodLabel;
    row._globalPeriodoLabel = periodLabel;
    row._globalDivision = divisionName(row);
    row._globalEstadoMatricula = matriculaState(row);

    return row;
  }

  function studentIdentity(row){
    var period = text(row._globalPeriodoId || periodIdOf(row));
    var identity = text(row._globalCedula || cedulaOf(row));
    return period && identity ? key(period) + "__" + identity : "";
  }

  function dedupeStudents(students){
    var map = Object.create(null);
    var withoutIdentity = [];

    array(students).forEach(function(row){
      var id = studentIdentity(row);

      if(!id){
        withoutIdentity.push(row);
        return;
      }

      if(!map[id]){
        map[id] = row;
        return;
      }

      Object.keys(row || {}).forEach(function(property){
        if(text(map[id][property]) === "" && text(row[property]) !== ""){
          map[id][property] = row[property];
        }
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; })
      .concat(withoutIdentity);
  }

  function buildRequirementCatalog(students, requirements, provided){
    var map = Object.create(null);

    array(provided).forEach(function(item){
      var normalized = normalizeRequirement(item);
      if(normalized){ map[key(normalized.id)] = normalized; }
    });

    array(requirements).forEach(function(item){
      var normalized = normalizeRequirement(item);
      if(normalized && !map[key(normalized.id)]){
        map[key(normalized.id)] = normalized;
      }
    });

    array(students).forEach(function(row){
      Object.keys(row || {}).forEach(function(property){
        if(property.indexOf("_global") === 0 || property === "requisitos"){
          return;
        }

        var value = text(row[property]).toUpperCase();
        if(["CUMPLE", "NO CUMPLE", "PENDIENTE"].indexOf(value) < 0){
          return;
        }

        var id = key(property);
        if(!map[id]){
          map[id] = {
            id: property,
            key: property,
            label: property
          };
        }
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; })
      .sort(function(a, b){
        return text(a.label).localeCompare(text(b.label), "es", { sensitivity: "base" });
      });
  }

  function buildCareerCatalog(students, provided){
    var map = Object.create(null);

    array(provided).forEach(function(item){
      item = item || {};
      var name = text(item.nombre || item.name || item.label || item.carrera);
      var code = text(item.codigo || item.id || item.key || name);
      if(!name){ return; }
      map[key(code || name)] = {
        id: code || name,
        codigo: code || name,
        nombre: name,
        label: name,
        tipo: text(item.tipo || typeCareer(name))
      };
    });

    array(students).forEach(function(row){
      var name = row._globalCarrera;
      var code = row._globalCodigoCarrera || name;
      var id = key(code || name);
      if(!name || map[id]){ return; }
      map[id] = {
        id: code || name,
        codigo: code || name,
        nombre: name,
        label: name,
        tipo: row._globalTipoCarrera || typeCareer(name)
      };
    });

    return Object.keys(map).map(function(id){ return map[id]; })
      .sort(function(a, b){
        return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
      });
  }

  function buildPeriodCatalog(students, provided){
    var map = Object.create(null);

    function add(item){
      var normalized = normalizePeriod(item);
      if(!normalized){ return; }
      var id = key(normalized.id || normalized.label);
      if(!map[id]){ map[id] = normalized; }
    }

    array(provided).forEach(add);
    array(students).forEach(function(row){
      add({
        periodoId: row._globalPeriodoId,
        periodoLabel: row._globalPeriodoLabel
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; })
      .sort(comparePeriods);
  }

  function normalizeSnapshot(snapshot){
    snapshot = snapshot || {};
    var rawRequirements = array(snapshot.requirements).map(clone);
    var students = dedupeStudents(
      array(snapshot.students).map(function(row){
        return normalizeStudent(row, rawRequirements);
      })
    );

    var periods = buildPeriodCatalog(students, snapshot.periods);
    var requirements = buildRequirementCatalog(
      students,
      rawRequirements,
      snapshot.requirementCatalog
    );
    var careers = buildCareerCatalog(students, snapshot.careers);

    return {
      ok: snapshot.ok !== false,
      source: snapshot.source || "GlobalCore",
      meta: clone(snapshot.meta || {}),
      periods: periods,
      students: students,
      requirements: rawRequirements,
      careers: careers,
      requirementCatalog: requirements,
      diagnostics: array(snapshot.diagnostics).map(clone),
      generatedAt: snapshot.generatedAt || new Date().toISOString()
    };
  }

  function configuredWaitMonths(){
    var value = Number(
      config.periodos &&
      config.periodos.mesesEsperaTitulacion
    );

    return Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 1;
  }

  function minimumGraduates(){
    var value = Number(
      config.graduados &&
      config.graduados.minimoPorPeriodo
    );

    return Number.isFinite(value) && value >= 1
      ? Math.floor(value)
      : 3;
  }

  function periodSourceText(period){
    if(period && typeof period === "object"){
      return periodLabelOf(period) || periodIdOf(period);
    }
    return text(period);
  }

  function periodEnd(period){
    var source = norm(periodSourceText(period));
    if(!source){ return null; }

    var monthIndexes = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      setiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11
    };
    var candidates = [];
    var match;
    var words = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de(?:l)?\s+)?((?:19|20)\d{2})\b/g;
    var yearMonth = /\b((?:19|20)\d{2})[-\/.](0?[1-9]|1[0-2])\b/g;
    var monthYear = /\b(0?[1-9]|1[0-2])[-\/.]((?:19|20)\d{2})\b/g;

    while((match = words.exec(source))){
      candidates.push({ index: match.index, month: monthIndexes[match[1]], year: Number(match[2]) });
    }
    while((match = yearMonth.exec(source))){
      candidates.push({ index: match.index, month: Number(match[2]) - 1, year: Number(match[1]) });
    }
    while((match = monthYear.exec(source))){
      candidates.push({ index: match.index, month: Number(match[1]) - 1, year: Number(match[2]) });
    }

    if(!candidates.length){ return null; }
    candidates.sort(function(a, b){ return a.index - b.index; });
    var result = candidates[candidates.length - 1];

    if(
      !Number.isFinite(result.year) ||
      !Number.isFinite(result.month) ||
      result.month < 0 ||
      result.month > 11
    ){
      return null;
    }

    return {
      year: result.year,
      month: result.month,
      source: periodSourceText(period)
    };
  }

  function periodOrderValue(period){
    var end = periodEnd(period);
    return end ? end.year * 12 + end.month : null;
  }

  function comparePeriods(a, b){
    var valueA = periodOrderValue(a);
    var valueB = periodOrderValue(b);

    if(valueA !== null && valueB !== null && valueA !== valueB){
      return valueA - valueB;
    }
    if(valueA !== null && valueB === null){ return -1; }
    if(valueA === null && valueB !== null){ return 1; }

    return periodSourceText(a).localeCompare(
      periodSourceText(b),
      "es",
      { numeric: true, sensitivity: "base" }
    );
  }

  function periodAvailabilityDate(period){
    var end = periodEnd(period);
    if(!end){ return null; }

    return new Date(
      end.year,
      end.month + configuredWaitMonths() + 1,
      1
    );
  }

  function isPeriodAvailable(period, referenceDate){
    var availableFrom = periodAvailabilityDate(period);
    if(!availableFrom){ return true; }

    var reference = referenceDate instanceof Date
      ? new Date(referenceDate.getTime())
      : new Date();

    if(!Number.isFinite(reference.getTime())){
      reference = new Date();
    }

    reference = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate()
    );

    return reference.getTime() >= availableFrom.getTime();
  }

  function periodForStudent(row, periods){
    var rowId = text(row._globalPeriodoId || periodIdOf(row));
    var rowLabel = text(row._globalPeriodoLabel || periodLabelOf(row));
    var found = null;

    array(periods).some(function(period){
      if(
        samePeriod(period.id, rowId) ||
        samePeriod(period.label, rowId) ||
        samePeriod(period.id, rowLabel) ||
        samePeriod(period.label, rowLabel)
      ){
        found = period;
        return true;
      }
      return false;
    });

    return found || {
      id: rowId || rowLabel,
      label: rowLabel || rowId
    };
  }

  function availablePeriodList(periods, referenceDate){
    return array(periods)
      .filter(function(period){
        return isPeriodAvailable(period, referenceDate);
      })
      .slice()
      .sort(comparePeriods);
  }

  function requirementValue(row, requirementId){
    row = row || {};
    if(!requirementId){ return ""; }

    if(Object.prototype.hasOwnProperty.call(row, requirementId)){
      return row[requirementId];
    }

    var wanted = key(requirementId);
    var found = "";

    Object.keys(row).some(function(property){
      if(key(property) === wanted){
        found = row[property];
        return true;
      }
      return false;
    });

    if(text(found) !== ""){ return found; }

    array(row._globalRequirements)
      .concat(array(row.requisitos))
      .some(function(requirement){
        if(key(requirementName(requirement)) !== wanted){ return false; }
        found = requirementRecordValue(requirement);
        return true;
      });

    return found;
  }

  function cellStatus(value){
    var normalized = norm(value);

    if(["cumple", "aprobado", "aprobada", "si", "sí", "ok"].indexOf(normalized) >= 0){
      return {
        id: "cumple",
        label: "Cumple",
        cumple: true,
        pendiente: false,
        noCumple: false
      };
    }

    if(["no cumple", "nocumple", "no aprobado", "reprobado", "reprobada"].indexOf(normalized) >= 0){
      return {
        id: "no_cumple",
        label: "No cumple",
        cumple: false,
        pendiente: false,
        noCumple: true
      };
    }

    return {
      id: "pendiente",
      label: "Pendiente",
      cumple: false,
      pendiente: true,
      noCumple: false
    };
  }

  function studentCompliance(row, catalog){
    var result = {
      cumple: 0,
      pendiente: 0,
      noCumple: 0,
      total: 0,
      porcentaje: 0,
      aprobado: false
    };

    array(catalog).forEach(function(requirement){
      var id = requirement.id || requirement.key;
      var value = requirementValue(row, id);
      if(text(value) === ""){ return; }

      var statusValue = cellStatus(value);
      result.total += 1;

      if(statusValue.cumple){ result.cumple += 1; }
      else if(statusValue.noCumple){ result.noCumple += 1; }
      else{ result.pendiente += 1; }
    });

    result.porcentaje = result.total
      ? Math.round((result.cumple / result.total) * 100)
      : 0;
    result.aprobado = result.total > 0 && result.cumple === result.total;

    return result;
  }

  function graduationConfig(){
    var settings = config.graduados || {};
    return {
      campo: text(settings.campo || "AprobacionTitulacion") || "AprobacionTitulacion",
      valorEsperado: text(settings.valorEsperado || "CUMPLE").toUpperCase() || "CUMPLE",
      contarUnicoPorPeriodo: settings.contarUnicoPorPeriodo !== false,
      minimoPorPeriodo: minimumGraduates()
    };
  }

  function graduationValue(row){
    return text(requirementValue(row || {}, graduationConfig().campo));
  }

  function isGraduate(row){
    return graduationValue(row).toUpperCase() === graduationConfig().valorEsperado;
  }

  function uniqueGraduates(rows){
    var seen = Object.create(null);
    var settings = graduationConfig();

    return array(rows).filter(function(row){
      if(!isGraduate(row)){ return false; }
      if(!settings.contarUnicoPorPeriodo){ return true; }

      var id = studentIdentity(row);
      if(!id){
        id = key(
          (row._globalPeriodoLabel || row._globalPeriodoId || "SIN PERIODO") +
          "__" +
          (row.id || row._globalNombres || Math.random())
        );
      }

      if(seen[id]){ return false; }
      seen[id] = true;
      return true;
    });
  }

  function groupCount(list, getter){
    var map = Object.create(null);

    array(list).forEach(function(item){
      var value = text(getter(item)) || "SIN DATO";
      var id = key(value) || value;

      if(!map[id]){
        map[id] = { id: value, label: value, total: 0 };
      }
      map[id].total += 1;
    });

    return Object.keys(map).map(function(id){ return map[id]; });
  }

  function groupGraduatesByPeriod(rows){
    return groupCount(uniqueGraduates(rows), function(row){
      return row._globalPeriodoLabel || row._globalPeriodoId;
    })
      .filter(function(item){
        return item.total >= minimumGraduates();
      })
      .map(function(item){
        return {
          periodo: item.label,
          periodoId: item.id,
          label: item.label,
          total: item.total,
          graduados: item.total
        };
      })
      .sort(function(a, b){
        return comparePeriods(a.periodo, b.periodo);
      });
  }

  function periodReference(value, periods){
    value = text(value);
    if(!value){ return null; }

    var found = null;
    array(periods).some(function(period){
      if(
        samePeriod(period.id, value) ||
        samePeriod(period.label, value)
      ){
        found = period;
        return true;
      }
      return false;
    });

    return found || value;
  }

  function insidePeriodRange(row, filters, periods){
    var rowPeriod = periodForStudent(row, periods);
    var single = text(filters.periodo || filters.periodoId || filters.periodId || "");

    if(
      single &&
      !samePeriod(rowPeriod.id, single) &&
      !samePeriod(rowPeriod.label, single)
    ){
      return false;
    }

    var from = periodReference(
      filters.periodoDesde || filters.desde || filters.periodFrom,
      periods
    );
    var to = periodReference(
      filters.periodoHasta || filters.hasta || filters.periodTo,
      periods
    );
    var rowValue = periodOrderValue(rowPeriod);
    var fromValue = from ? periodOrderValue(from) : null;
    var toValue = to ? periodOrderValue(to) : null;

    if(fromValue !== null && toValue !== null && fromValue > toValue){
      var swap = fromValue;
      fromValue = toValue;
      toValue = swap;
    }

    if(rowValue !== null && fromValue !== null && rowValue < fromValue){ return false; }
    if(rowValue !== null && toValue !== null && rowValue > toValue){ return false; }

    if(rowValue === null){
      var comparable = rowPeriod.id || rowPeriod.label;
      if(from && text(comparable).localeCompare(periodSourceText(from), "es") < 0){ return false; }
      if(to && text(comparable).localeCompare(periodSourceText(to), "es") > 0){ return false; }
    }

    return true;
  }

  function uniqueCount(list, getter){
    var map = Object.create(null);
    array(list).forEach(function(item){
      var value = text(getter(item));
      if(value){ map[key(value) || value] = true; }
    });
    return Object.keys(map).length;
  }

  function filteredPeriodCatalog(rows){
    return buildPeriodCatalog(rows, []).filter(function(period){
      return array(rows).some(function(row){
        return samePeriod(period.id, row._globalPeriodoId) ||
          samePeriod(period.label, row._globalPeriodoLabel);
      });
    }).sort(comparePeriods);
  }

  function filteredCareerCatalog(rows){
    return buildCareerCatalog(rows, []);
  }

  function buildData(rows, snapshot, filters, catalog){
    rows = array(rows);
    catalog = array(catalog);

    var totals = {
      cumple: 0,
      pendiente: 0,
      noCumple: 0,
      total: 0,
      estudiantesCumplen: 0
    };

    rows.forEach(function(row){
      var compliance = row._globalCumplimiento || studentCompliance(row, catalog);
      totals.cumple += compliance.cumple;
      totals.pendiente += compliance.pendiente;
      totals.noCumple += compliance.noCumple;
      totals.total += compliance.total;
      if(compliance.aprobado){ totals.estudiantesCumplen += 1; }
    });

    var graduates = uniqueGraduates(rows);
    var byGraduatePeriod = groupGraduatesByPeriod(graduates);
    var eligiblePeriods = Object.create(null);

    byGraduatePeriod.forEach(function(item){
      eligiblePeriods[key(item.periodoId || item.periodo)] = true;
    });

    var reportGraduates = graduates.filter(function(row){
      return !!eligiblePeriods[key(row._globalPeriodoLabel || row._globalPeriodoId)];
    });

    var periods = filteredPeriodCatalog(rows);
    var careers = filteredCareerCatalog(rows);
    var settings = graduationConfig();

    return {
      ok: true,
      source: "GlobalCore",
      filters: clone(filters || {}),
      snapshotMeta: clone(snapshot.meta || {}),
      resumen: {
        totalEstudiantes: rows.length,
        totalCarreras: uniqueCount(rows, function(row){
          return row._globalCodigoCarrera || row._globalCarrera;
        }),
        totalPeriodos: uniqueCount(rows, function(row){
          return row._globalPeriodoId || row._globalPeriodoLabel;
        }),
        totalRequisitos: catalog.length,
        porcentajeCumplimiento: totals.total
          ? Math.round((totals.cumple / totals.total) * 100)
          : 0,
        estudiantesCumplen: totals.estudiantesCumplen,
        totalGraduados: reportGraduates.length,
        activos: rows.filter(function(row){
          return row._globalEstadoMatricula !== "RETIRADO";
        }).length,
        retirados: rows.filter(function(row){
          return row._globalEstadoMatricula === "RETIRADO";
        }).length
      },
      students: rows,
      graduates: reportGraduates,
      graduados: {
        campo: settings.campo,
        valorEsperado: settings.valorEsperado,
        minimoPorPeriodo: settings.minimoPorPeriodo,
        total: reportGraduates.length,
        estudiantes: reportGraduates,
        porPeriodo: byGraduatePeriod
      },
      periods: periods,
      careers: careers,
      requirements: catalog,
      catalogs: {
        periods: availablePeriodList(snapshot.periods),
        careers: snapshot.careers.slice(),
        requirements: snapshot.requirementCatalog.slice()
      },
      groups: {
        byPeriodo: groupCount(rows, function(row){
          return row._globalPeriodoLabel || row._globalPeriodoId;
        }).sort(function(a, b){ return comparePeriods(a.label, b.label); }),
        byCarrera: groupCount(rows, function(row){ return row._globalCarrera; }),
        byTipoCarrera: groupCount(rows, function(row){ return row._globalTipoCarrera; }),
        byEstadoMatricula: groupCount(rows, function(row){ return row._globalEstadoMatricula; }),
        byPeriodoGraduados: byGraduatePeriod
      },
      generatedAt: new Date().toISOString()
    };
  }

  function applyFilters(filters){
    filters = filters || {};
    var snapshot = state.snapshot || state.lastGoodSnapshot || normalizeSnapshot(fallbackSnapshot());
    var career = text(filters.carrera);
    var requirement = text(filters.requisito);
    var type = text(filters.tipoCarrera).toUpperCase();
    var division = text(filters.division);
    var periods = snapshot.periods;
    var catalog = requirement
      ? snapshot.requirementCatalog.filter(function(item){
          return key(item.id || item.key) === key(requirement);
        })
      : snapshot.requirementCatalog;

    var rows = snapshot.students
      .filter(function(row){
        var period = periodForStudent(row, periods);
        if(!isPeriodAvailable(period)){ return false; }
        if(!insidePeriodRange(row, filters, periods)){ return false; }

        if(
          career &&
          key(row._globalCodigoCarrera) !== key(career) &&
          key(row._globalCarrera) !== key(career)
        ){
          return false;
        }

        if(type && row._globalTipoCarrera !== type){ return false; }
        if(division && key(row._globalDivision) !== key(division)){ return false; }
        if(requirement && text(requirementValue(row, requirement)) === ""){ return false; }
        return true;
      })
      .map(function(row){
        var copy = Object.assign({}, row);
        copy._globalCumplimiento = studentCompliance(copy, catalog);
        copy._globalAprobacionTitulacion = graduationValue(copy);
        copy._globalEsGraduado = isGraduate(copy);
        return copy;
      });

    state.lastFilters = clone(filters);
    state.lastData = buildData(rows, snapshot, filters, catalog);
    return state.lastData;
  }

  function getFilterOptions(){
    var snapshot = state.snapshot || state.lastGoodSnapshot || normalizeSnapshot(fallbackSnapshot());
    var visiblePeriods = availablePeriodList(snapshot.periods);
    var visibleStudents = snapshot.students.filter(function(row){
      return isPeriodAvailable(periodForStudent(row, snapshot.periods));
    });
    var divisions = Object.create(null);

    visibleStudents.forEach(function(row){
      var division = text(row._globalDivision || divisionName(row));
      if(division){ divisions[key(division)] = division; }
    });

    return {
      periods: visiblePeriods,
      careers: buildCareerCatalog(visibleStudents, snapshot.careers),
      divisions: Object.keys(divisions).map(function(id){
        return {
          id: id,
          value: divisions[id],
          label: divisions[id],
          nombre: divisions[id]
        };
      }).sort(function(a, b){
        return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
      }),
      requirements: snapshot.requirementCatalog.slice(),
      tiposCarrera: (
        config.filtros &&
        config.filtros.tiposCarrera
      ) || []
    };
  }

  function acceptSnapshot(resolved, passive){
    var normalized = normalizeSnapshot(resolved || fallbackSnapshot());
    state.snapshot = normalized;
    state.lastGoodSnapshot = normalized;
    state.lastFilters = null;
    state.lastData = null;
    state.ready = true;
    state.revision += 1;

    emit("global:data-refreshed", {
      passive: passive === true,
      status: status(),
      at: new Date().toISOString()
    });

    return normalized;
  }

  function reloadFromCache(options){
    options = options || {};

    if(state.loading && options.force !== true){
      return state.loading;
    }

    state.loading = waitForConnection(0)
      .then(function(repo){
        return Promise.resolve(snapshotFromConnection(repo));
      })
      .then(function(resolved){
        return acceptSnapshot(resolved, options.passive !== false);
      })
      .catch(function(error){
        addError("No se pudo leer la caché central para Global", error);
        state.ready = true;
        return state.lastGoodSnapshot || normalizeSnapshot(fallbackSnapshot());
      })
      .then(function(result){
        state.loading = null;
        return result;
      }, function(error){
        state.loading = null;
        throw error;
      });

    return state.loading;
  }

  function refresh(options){
    return reloadFromCache(Object.assign({}, options || {}, {
      passive: false
    }));
  }

  function ready(options){
    options = options || {};

    if(state.ready && state.snapshot && options.force !== true){
      return Promise.resolve(status());
    }

    return reloadFromCache({
      force: options.force === true,
      passive: true
    }).then(function(){
      emit("global:core-ready", status());
      return status();
    });
  }

  function invalidate(){
    state.ready = false;
    state.snapshot = null;
    state.lastFilters = null;
    state.lastData = null;
    return true;
  }

  function status(){
    var snapshot = state.snapshot || state.lastGoodSnapshot || {
      periods: [], students: [], careers: [], requirementCatalog: []
    };

    return {
      ok: state.errors.length === 0,
      ready: state.ready,
      version: VERSION,
      source: snapshot.source || "GlobalCore",
      revision: state.revision,
      periods: array(snapshot.periods).length,
      students: array(snapshot.students).length,
      careers: array(snapshot.careers).length,
      requirements: array(snapshot.requirementCatalog).length,
      errors: state.errors.slice(-10),
      updatedAt: new Date().toISOString()
    };
  }

  window.GlobalCore = {
    version: VERSION,
    ready: ready,
    refresh: refresh,
    reloadFromCache: reloadFromCache,
    invalidate: invalidate,
    status: status,
    getSnapshot: function(){
      return clone(
        state.snapshot ||
        state.lastGoodSnapshot ||
        normalizeSnapshot(fallbackSnapshot())
      );
    },
    getFilterOptions: getFilterOptions,
    applyFilters: applyFilters,
    buildData: applyFilters,
    helpers: {
      text: text,
      norm: norm,
      key: key,
      typeCareer: typeCareer,
      cellStatus: cellStatus,
      requirementValue: requirementValue,
      graduationValue: graduationValue,
      isGraduate: isGraduate,
      uniqueGraduates: uniqueGraduates,
      groupGraduatesByPeriod: groupGraduatesByPeriod,
      studentCompliance: studentCompliance,
      normalizeStudent: normalizeStudent,
      periodEnd: periodEnd,
      periodOrderValue: periodOrderValue,
      periodAvailabilityDate: periodAvailabilityDate,
      isPeriodAvailable: isPeriodAvailable,
      availablePeriodList: availablePeriodList,
      comparePeriods: comparePeriods
    }
  };

  ready({ force: false });
})(window, document);
