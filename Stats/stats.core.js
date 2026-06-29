/* =========================================================
Nombre completo: stats.core.js
Ruta o ubicación: /Requisitos/Stats/stats.core.js
Función o funciones:
- Leer estudiantes desde ExcelLocalRepo como fuente principal ligera.
- Evitar que Stats cargue motores BL2 pesados al abrir.
- Evitar calcular estudiantes si no hay período seleccionado.
- Calcular KPIs, estados, carreras, divisiones, requisitos, aprobación final y notas.
- Usar una sola regla PVC/Regular desde BL2RequirementsEngine/StatsRules.
- Mantener compatibilidad con ExcelLocalStorage como respaldo.
Con qué se conecta:
- stats.rules.js
- ../Gestion/Excel/excel-local/excel-local.storage.js
- ../Gestion/Excel/excel-local.repo.js
- ../BaseLocal2/core/bl2-student-normalizer.js
- ../BaseLocal2/core/bl2-requirements-engine.js
- ../BaseLocal/services/bl-notas-defensa.service.js
- stats.app.js
- stats.students.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-stats-fast.2";
  var lastSource = "StatsCore";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function pct(n,d){return d ? Math.round((Number(n || 0) * 10000) / Number(d || 0)) / 100 : 0;}
  function round2(value){return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;}
  function label(key,fallback){try{if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){return window.BLCampos.requirementLabel(key,fallback);}}catch(error){}return fallback || key;}
  function req(key,fallback,group){return {key:key,label:label(key,fallback),group:group || "requisito"};}
  function cloneReq(item){return {key:item.key,label:label(item.key,item.label),group:item.group || "requisito"};}
  function cloneList(list){return (list || []).map(cloneReq);}

  var FALLBACK_RULES = (function(){
    var BASE = [
      req("academico","Académico"),
      req("documentacion","Documentación"),
      req("financiero","Financiero"),
      req("practicasvinculacion","Prácticas"),
      req("vinculacion","Vinculación"),
      req("seguimientograduados","Seguimiento graduados"),
      req("ingles","Inglés"),
      req("actualizaciondatos","Actualización de datos")
    ];

    var EXTRA = [
      req("titulacion","Titulación")
    ];

    var FINAL = [
      req("aprobaciontitulacion","Aprobación titulación","final"),
      req("aprobacioncomplexivoproyecto","Aprobación complexivo/proyecto","final")
    ];

    var MONTHS = {
      enero:1, ene:1,
      febrero:2, feb:2,
      marzo:3, mar:3,
      abril:4, abr:4,
      mayo:5, may:5,
      junio:6, jun:6,
      julio:7, jul:7,
      agosto:8, ago:8,
      septiembre:9, setiembre:9, sept:9, sep:9, set:9,
      octubre:10, oct:10,
      noviembre:11, nov:11,
      diciembre:12, dic:12
    };

    var OK = ["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","validada","completo","completa"];

    var ALIASES = {
      academico:["academico","académico","Academico","Académico"],
      documentacion:["documentacion","documentación","Documentacion","Documentación"],
      financiero:["financiero","Financiero"],
      titulacion:["titulacion","titulación","Titulacion","Titulación"],
      practicasvinculacion:["practicasvinculacion","practicas","prácticas","PracticasVinculacion","PrácticasVinculacion","Prácticas Vinculación","Practicas Vinculacion","Practicas"],
      vinculacion:["vinculacion","vinculación","Vinculacion","Vinculación"],
      seguimientograduados:["seguimientograduados","seguimiento graduados","SeguimientoGraduados","Seguimiento graduados"],
      ingles:["ingles","inglés","Ingles","Inglés"],
      actualizaciondatos:["actualizaciondatos","actualización datos","actualizacion datos","ActualizacionDatos","ActualizaciónDatos","Actualización de datos"],
      aprobaciontitulacion:["aprobaciontitulacion","aprobación titulación","aprobacion titulacion","AprobacionTitulacion","AprobaciónTitulación","Aprobación titulación"],
      aprobacioncomplexivoproyecto:["aprobacioncomplexivoproyecto","aprobación complexivo proyecto","aprobacion complexivo proyecto","AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","Aprobación complexivo/proyecto"]
    };

    function monthNum(name){return MONTHS[norm(name)] || null;}

    function classifyPeriod(value){
      var raw = text(value);
      var n = norm(raw);
      var months = Object.keys(MONTHS).filter(function(key){
        return n.indexOf(key) >= 0;
      }).map(function(key){
        return MONTHS[key];
      });

      var unique = [];
      months.forEach(function(month){
        if(unique.indexOf(month) < 0){unique.push(month);}
      });

      var isPvc = unique.indexOf(4) >= 0 && unique.indexOf(8) >= 0;
      return {
        id:isPvc ? "PVC" : "REGULAR",
        label:isPvc ? "PVC / Abril a Agosto" : "Regular",
        raw:raw,
        pattern:isPvc ? "abril-agosto" : "regular"
      };
    }

    function appliesRequirement(key, periodText){
      if(key === "titulacion"){
        return classifyPeriod(periodText).id !== "PVC";
      }
      return true;
    }

    function isFinalRequirement(key){
      return FINAL.some(function(item){return item.key === key;});
    }

    function getRequirementByKey(key){
      key = compact(key);
      return BASE.concat(EXTRA).concat(FINAL).find(function(item){
        return compact(item.key) === key;
      }) || req(key,key);
    }

    function ownValue(row, aliases){
      row = row || {};
      aliases = aliases || [];

      var keys = Object.keys(row);
      var wanted = aliases.map(compact);

      for(var i = 0; i < aliases.length; i += 1){
        if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){
          return row[aliases[i]];
        }
      }

      for(var j = 0; j < keys.length; j += 1){
        if(wanted.indexOf(compact(keys[j])) >= 0 && text(row[keys[j]]) !== ""){
          return row[keys[j]];
        }
      }

      return "";
    }

    function valueOf(row,key){
      return ownValue(row || {}, ALIASES[compact(key)] || [key]);
    }

    function cellStatus(value){
      return OK.indexOf(norm(value)) >= 0 ? "cumple" : "no_cumple";
    }

    function requirementStatus(row,key){
      var reqItem = getRequirementByKey(key);
      var period = classifyPeriod(row && (row._periodo || row.periodoLabel || row.periodoId || ""));
      var applies = isFinalRequirement(reqItem.key) || appliesRequirement(reqItem.key, period.raw || row._periodo || row.periodoLabel || row.periodoId);

      if(!applies){
        return {
          key:reqItem.key,
          label:reqItem.label,
          status:"no_aplica",
          labelStatus:"No aplica para PVC",
          cumple:false,
          applies:false
        };
      }

      var status = cellStatus(valueOf(row, reqItem.key));
      return {
        key:reqItem.key,
        label:reqItem.label,
        status:status,
        labelStatus:status === "cumple" ? "Cumple" : "No cumple",
        cumple:status === "cumple",
        applies:true
      };
    }

    function studentApproval(row){
      var period = classifyPeriod(row && (row._periodo || row.periodoLabel || row.periodoId || ""));
      var requirements = BASE.concat(EXTRA).filter(function(item){
        return appliesRequirement(item.key, period.raw || row._periodo || row.periodoLabel || row.periodoId);
      });

      var applicable = [];
      var missing = [];
      var notApplicable = [];

      BASE.concat(EXTRA).forEach(function(item){
        if(!appliesRequirement(item.key, period.raw || row._periodo || row.periodoLabel || row.periodoId)){
          notApplicable.push(item);
          return;
        }

        applicable.push(item);
        if(requirementStatus(row, item.key).status !== "cumple"){
          missing.push(item);
        }
      });

      return {
        approved:missing.length === 0,
        periodType:period,
        applicableRequirements:applicable,
        missingRequirements:missing,
        notApplicableRequirements:notApplicable
      };
    }

    function finalApproval(row){
      return FINAL.map(function(item){
        return requirementStatus(row, item.key);
      });
    }

    return {
      BASE_REQUIREMENTS:BASE,
      REGULAR_EXTRA_REQUIREMENTS:EXTRA,
      FINAL_REQUIREMENTS:FINAL,
      FILTER_REQUIREMENTS:BASE.concat(EXTRA).concat(FINAL),
      classifyPeriod:classifyPeriod,
      appliesRequirement:appliesRequirement,
      isFinalRequirement:isFinalRequirement,
      getRequirementByKey:getRequirementByKey,
      valueOf:valueOf,
      cellStatus:cellStatus,
      requirementStatus:requirementStatus,
      studentApproval:studentApproval,
      finalApproval:finalApproval,
      monthNum:monthNum
    };
  })();

  function rules(){return window.StatsRules || window.BL2RequirementsEngine || FALLBACK_RULES;}
  function normalizer(){return window.BL2StudentNormalizer || null;}
  function engine(){return window.BL2DataEngine || null;}
  function estudiantesRepo(){return window.BL2EstudiantesRepo || null;}
  function excelRepo(){return window.ExcelLocalRepo || null;}

  function requirementLists(){
    var r = rules();

    return {
      base:cloneList(r.BASE_REQUIREMENTS || []),
      regularExtra:cloneList(r.REGULAR_EXTRA_REQUIREMENTS || []),
      finals:cloneList(r.FINAL_REQUIREMENTS || []),
      filter:cloneList(r.FILTER_REQUIREMENTS || []),
      normal:cloneList(r.BASE_REQUIREMENTS || []).concat(cloneList(r.REGULAR_EXTRA_REQUIREMENTS || []))
    };
  }

  function estadoMatricula(value){
    return norm(value || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";
  }

  function estadoCelda(value){
    return rules().cellStatus(value);
  }

  function valueOf(row,key){
    return rules().valueOf(row,key);
  }

  function periodValue(row){
    row = row || {};
    return text(row._bl2Periodo || row._periodo || row.periodoLabel || row.periodo || row.Periodo || row.periodoId || row.idPeriodo || row.periodId || "");
  }

  function samePeriod(a,b){
    if(!text(b)){return true;}

    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        return window.BLPeriodosCanon.samePeriod(a,b);
      }
    }catch(error){}

    return text(a) === text(b) || norm(a) === norm(b);
  }

  function divisionOf(row){
    if(row && row._bl2Division){return row._bl2Division;}

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        return window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];
    return list[0] || (row && (row.division || row.Division || row.División)) || "Sin división";
  }

  function hasDivision(row,division){
    if(!text(division)){return true;}

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
        return window.BLDivisionesService.hasDivision(row,division);
      }
    }catch(error){}

    return norm(divisionOf(row)) === norm(division);
  }

  function noteNumber(value){
    if(window.BLNotasDefensa && typeof window.BLNotasDefensa.normalizarNota === "function"){
      return window.BLNotasDefensa.normalizarNota(value);
    }

    if(value === null || value === undefined || text(value) === ""){
      return null;
    }

    var n = Number(text(value).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function fallbackNoteValue(row,aliases){
    row = row || {};
    var keys = Object.keys(row);

    for(var i = 0; i < aliases.length; i += 1){
      var wanted = compact(aliases[i]);

      for(var j = 0; j < keys.length; j += 1){
        if(compact(keys[j]) === wanted){
          var v = row[keys[j]];
          if(v !== null && v !== undefined && text(v) !== ""){
            return v;
          }
        }
      }
    }

    return "";
  }

  function extractNotes(row){
    if(window.BLNotasDefensa && typeof window.BLNotasDefensa.extraerNotas === "function"){
      return window.BLNotasDefensa.extraerNotas(row || {});
    }

    var nart = noteNumber(fallbackNoteValue(row,["Notart","Nart","nart","N_ART","N-ART","NotaArt","notaArticulo"]));
    var ndef = noteNumber(fallbackNoteValue(row,["Notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDefensa"]));
    var nfin = noteNumber(fallbackNoteValue(row,["Notafinal","NotaFinal","Nfin","nfin","N_FIN","N-FIN","notaFinal"]));

    if(nfin === null && nart !== null && ndef !== null && nart >= 7){
      nfin = round2((nart * .7) + (ndef * .3));
    }

    return {
      nart:nart,
      ndef:ndef,
      nfin:nfin,
      nfinCalculado:null,
      nfinGuardado:nfin,
      completo:nfin !== null
    };
  }

  function normalizeRow(row){
    return normalizer() && typeof normalizer().normalize === "function"
      ? normalizer().normalize(row || {}, {clone:false})
      : Object.assign({}, row || {});
  }

  function estadoGeneral(row){
    var approval = rules().studentApproval(row || {});
    var ok = approval.applicableRequirements.length - approval.missingRequirements.length;
    var no = approval.missingRequirements.length;

    return {
      id:approval.approved ? "cumple" : "no_cumple",
      label:approval.approved ? "Aprobado" : "No cumple",
      ok:ok,
      no:no,
      pend:0,
      approved:approval.approved,
      periodType:approval.periodType,
      applicableRequirements:approval.applicableRequirements,
      missingRequirements:approval.missingRequirements,
      notApplicableRequirements:approval.notApplicableRequirements || []
    };
  }

  function decorate(row){
    var r = normalizeRow(row);

    r._estadoMatricula = estadoMatricula(r._bl2EstadoMatricula || r.estadoMatricula || r.EstadoMatricula);
    r._cedula = text(r._bl2Id || r.cedula || r.Cedula || r.cédula || r.numeroIdentificacion || r.numeroidentificacion || r.NumeroIdentificacion || r.identificacion || r.Identificacion);
    r._nombres = text(r._bl2Nombre || r.nombres || r.Nombres || r.nombre || r.Nombre || r.estudiante || r.Estudiante || r.apellidosNombres || r.ApellidosNombres);
    r._carrera = text(r._bl2Carrera || r.nombrecarrera || r.nombreCarrera || r.NombreCarrera || r.carrera || r.Carrera) || "SIN CARRERA";
    r._division = divisionOf(r);
    r._periodo = periodValue(r) || "SIN PERÍODO";
    r._periodoId = text(r._bl2PeriodoId || r.periodoId || r.idPeriodo || r.periodId || r._periodo || r._bl2Periodo);
    r.periodoLabel = r._periodo;
    r.periodoId = r._periodoId;
    r._periodType = rules().classifyPeriod(r._periodo || r._periodoId);
    r._approval = rules().studentApproval(r);
    r._estado = estadoGeneral(r);
    r._finalApproval = rules().finalApproval(r);
    r._notas = extractNotes(r);

    return r;
  }

  function readLocalSnapshotLite(){
    var snap = null;

    try{
      if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){
        snap = window.ExcelLocalStorage.readSnapshot({session:true, clone:false});
        if(snap && typeof snap === "object"){
          return snap;
        }
      }
    }catch(error){}

    try{
      var key = "REQ_EXCEL_LOCAL_V1:snapshot";

      if(window.ExcelLocalConfig && window.ExcelLocalConfig.keys && window.ExcelLocalConfig.keys.snapshot){
        key = window.ExcelLocalConfig.keys.snapshot;
      }

      var raw = localStorage.getItem(key) || "";

      if(raw){
        snap = JSON.parse(raw);

        if(snap && typeof snap === "object"){
          snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
          snap.students = Array.isArray(snap.students) ? snap.students : [];
          return snap;
        }
      }
    }catch(error){}

    return {
      meta:{},
      periods:[],
      students:[],
      history:[],
      diagnostics:[]
    };
  }

  function periods(){
    try{
      if(excelRepo() && typeof excelRepo().listPeriods === "function"){
        lastSource = "ExcelLocalRepo";
        return excelRepo().listPeriods() || [];
      }
    }catch(error){}

    try{
      var snap = readLocalSnapshotLite();
      lastSource = "ExcelLocalStorage";
      return Array.isArray(snap.periods) ? snap.periods : [];
    }catch(error){}

    return [];
  }

  function rowsFromEngine(opts){
    opts = opts || {};

    if(!opts.useEngine){
      return [];
    }

    var result = engine().listStudents({
      periodId:opts.periodId || "",
      division:opts.division || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      search:"",
      limit:0,
      force:opts.force === true
    });

    lastSource = "BL2DataEngine";
    return (result.rows || []).map(decorate);
  }

  function rowsFromRepo(opts){
    opts = opts || {};

    var result = estudiantesRepo().buscar({
      periodId:opts.periodId || "",
      division:opts.division || "",
      matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,
      search:"",
      limit:0,
      force:opts.force === true
    });

    lastSource = "BL2EstudiantesRepo";
    return (result.rows || []).map(decorate);
  }

  function rowsFromExcel(opts){
    opts = opts || {};

    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);
    var rows = [];

    try{
      if(excelRepo() && typeof excelRepo().filterStudents === "function"){
        rows = excelRepo().filterStudents({
          periodoId:opts.periodId || "",
          estadoMatricula:matricula,
          division:opts.division || ""
        });
      }else if(excelRepo() && typeof excelRepo().listStudentsByStatus === "function"){
        rows = excelRepo().listStudentsByStatus(matricula, opts.periodId || "");
      }else if(excelRepo() && typeof excelRepo().listAllStudents === "function"){
        rows = excelRepo().listAllStudents();
      }
    }catch(error){
      console.warn("[StatsCore] ExcelLocalRepo falló", error);

      try{
        var snap = readLocalSnapshotLite();
        rows = Array.isArray(snap.students) ? snap.students : [];
      }catch(error2){
        rows = [];
      }
    }

    lastSource = "ExcelLocalRepo";
    return (rows || []).map(decorate);
  }

  function baseRows(opts){
    opts = opts || {};

    try{
      return rowsFromExcel(opts);
    }catch(error){
      console.warn("[StatsCore] lectura ExcelLocalRepo falló", error);
    }

    try{
      if(estudiantesRepo() && typeof estudiantesRepo().buscar === "function"){
        return rowsFromRepo(opts);
      }
    }catch(error){
      console.warn("[StatsCore] BL2EstudiantesRepo falló", error);
    }

    try{
      if(opts.useEngine === true && engine() && typeof engine().listStudents === "function"){
        return rowsFromEngine(opts);
      }
    }catch(error){
      console.warn("[StatsCore] BL2DataEngine falló", error);
    }

    return [];
  }

  function normalizeStatusFilter(status){
    status = text(status);
    return status === "pendiente" ? "no_cumple" : status;
  }

  function filtered(opts){
    opts = opts || {};

    var periodId = text(opts.periodId);
    var division = text(opts.division);
    var career = text(opts.career || opts.carrera);
    var status = normalizeStatusFilter(opts.status || opts.estado);
    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);

    if(!periodId && opts.allowGlobal !== true){
      return [];
    }

    var list = baseRows({
      periodId:periodId,
      division:"",
      matricula:matricula,
      career:"",
      force:opts.force === true
    });

    return filterDecoratedList(list, {
      periodId:periodId,
      division:division,
      career:career,
      status:status,
      matricula:matricula
    });
  }

  function filterDecoratedList(list, opts){
    opts = opts || {};
    list = Array.isArray(list) ? list : [];

    var periodId = text(opts.periodId);
    var division = text(opts.division);
    var career = text(opts.career || opts.carrera);
    var status = normalizeStatusFilter(opts.status || opts.estado);
    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);

    return list.filter(function(row){
      if(matricula && row._estadoMatricula !== matricula){return false;}
      if(periodId && !samePeriod(row._periodoId || row._periodo, periodId)){return false;}
      if(division && !hasDivision(row, division)){return false;}
      if(career && row._carrera !== career){return false;}
      if(status && row._estado.id !== status){return false;}
      return true;
    });
  }

  function listOptions(values){
    var map = {};

    (values || []).forEach(function(value){
      value = text(value);
      if(value){map[value] = true;}
    });

    return Object.keys(map).sort(function(a,b){
      return a.localeCompare(b,"es");
    });
  }

  function careers(list){
    return listOptions((list || []).map(function(row){
      return row._carrera || "SIN CARRERA";
    }));
  }

  function divisions(list){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.listDivisionsWithEmpty === "function"){
      return window.BLDivisionesService.listDivisionsWithEmpty(list || [], "");
    }

    return listOptions((list || []).map(function(row){
      return row._division || "Sin división";
    }));
  }

  function byKey(list,getKey){
    var out = {};

    (list || []).forEach(function(row){
      var key = getKey(row) || "Sin dato";

      if(!out[key]){
        out[key] = {
          key:key,
          total:0,
          cumple:0,
          pendiente:0,
          no_cumple:0,
          avance:0
        };
      }

      out[key].total++;
      out[key][row._estado.id]++;
    });

    Object.keys(out).forEach(function(key){
      out[key].avance = pct(out[key].cumple, out[key].total);
    });

    return Object.keys(out).map(function(key){
      return out[key];
    }).sort(function(a,b){
      return b.total - a.total || a.key.localeCompare(b.key,"es");
    });
  }

  function requirementStatus(row,key){
    if(rules() && typeof rules().requirementStatus === "function"){
      return rules().requirementStatus(row,key);
    }

    var period = rules().classifyPeriod(periodValue(row));
    var reqItem = rules().getRequirementByKey(key);
    var applies = rules().isFinalRequirement(reqItem.key) || rules().appliesRequirement(reqItem.key, period.raw || row._periodo || row._periodoId);

    if(!applies){
      return {
        key:reqItem.key,
        label:reqItem.label,
        status:"no_aplica",
        labelStatus:"No aplica para PVC",
        cumple:false,
        applies:false
      };
    }

    var status = estadoCelda(valueOf(row,reqItem.key));

    return {
      key:reqItem.key,
      label:reqItem.label,
      status:status,
      labelStatus:status === "cumple" ? "Cumple" : "No cumple",
      cumple:status === "cumple",
      applies:true
    };
  }

  function requirementSummary(list,requirements){
    list = list || [];

    return (requirements || []).map(function(reqItem){
      var item = {
        key:reqItem.key,
        label:reqItem.label,
        group:reqItem.group || "requisito",
        total:list.length,
        aplica:0,
        no_aplica:0,
        cumple:0,
        pendiente:0,
        no_cumple:0,
        avance:0
      };

      list.forEach(function(row){
        var status = requirementStatus(row,reqItem.key);

        if(!status.applies){
          item.no_aplica++;
          return;
        }

        item.aplica++;

        if(status.cumple){
          item.cumple++;
        }else{
          item.no_cumple++;
        }
      });

      item.avance = pct(item.cumple,item.aplica);
      return item;
    });
  }

  function requisitos(list){
    return requirementSummary(list, requirementLists().normal);
  }

  function requisitosFinales(list){
    return requirementSummary(list, requirementLists().finals);
  }

  function requisitosFiltro(){
    var lists = requirementLists();

    return {
      requisitos:lists.normal.map(function(item){
        return {
          key:item.key,
          label:item.label,
          group:"requisito"
        };
      }),
      finales:lists.finals.map(function(item){
        return {
          key:item.key,
          label:item.label,
          group:"final"
        };
      }),
      all:lists.filter.map(function(item){
        return {
          key:item.key,
          label:item.label,
          group:item.group || "requisito"
        };
      })
    };
  }

  function selectedRequirementSummary(list,key){
    key = text(key);

    if(!key){
      return null;
    }

    var reqItem = rules().getRequirementByKey(key);
    var stats = requirementSummary(list,[reqItem])[0];

    var rows = (list || []).map(function(row){
      var status = requirementStatus(row,reqItem.key);
      return Object.assign({},row,{
        _selectedRequirementStatus:status
      });
    });

    return {
      key:reqItem.key,
      label:reqItem.label,
      group:reqItem.group || "requisito",
      stats:stats,
      rows:rows
    };
  }

  function periodApproval(list,opts){
    opts = opts || {};

    if(!text(opts.periodId)){
      return null;
    }

    var reference = (list && list[0]) ? periodValue(list[0]) : text(opts.periodLabel || opts.periodId);
    var period = rules().classifyPeriod(reference || opts.periodId);
    var approved = 0;

    (list || []).forEach(function(row){
      if(row._estado.id === "cumple"){
        approved++;
      }
    });

    return {
      visible:true,
      type:period.id,
      label:period.label,
      pattern:period.pattern,
      total:(list || []).length,
      approved:approved,
      rejected:(list || []).length - approved,
      avance:pct(approved,(list || []).length)
    };
  }

  function requirementTotals(list){
    var totalReq = 0;
    var okReq = 0;

    (list || []).forEach(function(row){
      var approval = row._approval || rules().studentApproval(row);
      totalReq += approval.applicableRequirements.length;
      okReq += approval.applicableRequirements.length - approval.missingRequirements.length;
    });

    return {
      total:totalReq,
      ok:okReq,
      avance:pct(okReq,totalReq)
    };
  }

  function notasResumen(list){
    list = list || [];

    var finales = [];
    var nart = 0;
    var ndef = 0;

    list.forEach(function(row){
      var notes = row._notas || extractNotes(row);

      if(notes.nart !== null && notes.nart !== undefined){
        nart++;
      }

      if(notes.ndef !== null && notes.ndef !== undefined){
        ndef++;
      }

      if(notes.nfin !== null && notes.nfin !== undefined){
        finales.push(Number(notes.nfin));
      }
    });

    var total = list.length;
    var conNota = finales.length;
    var sum = finales.reduce(function(a,b){
      return a + b;
    },0);

    return {
      total:total,
      conNota:conNota,
      sinNota:total - conNota,
      promedio:conNota ? round2(sum / conNota) : null,
      minima:conNota ? round2(Math.min.apply(Math,finales)) : null,
      maxima:conNota ? round2(Math.max.apply(Math,finales)) : null,
      conNart:nart,
      conNdef:ndef
    };
  }

  function emptySummary(opts,message){
    opts = opts || {};

    return {
      total:0,
      estados:{
        cumple:0,
        pendiente:0,
        no_cumple:0
      },
      matriculas:{
        ACTIVO:0,
        RETIRADO:0
      },
      avanceGeneral:0,
      notasResumen:{
        total:0,
        conNota:0,
        sinNota:0,
        promedio:null,
        minima:null,
        maxima:null,
        conNart:0,
        conNdef:0
      },
      requisitos:[],
      requisitosFinales:[],
      requisitosFiltro:requisitosFiltro(),
      selectedRequirement:null,
      periodApproval:null,
      carreras:[],
      periodos:[],
      divisiones:[],
      periodList:periods(),
      divisionList:[],
      careerList:[],
      rows:[],
      estudiantes:[],
      _requiresPeriod:!text(opts.periodId),
      _message:message || "Selecciona un período para cargar estadísticas.",
      diagnostics:{
        generatedAt:new Date().toISOString(),
        source:source(),
        version:VERSION,
        skipped:true,
        reason:"period_required",
        filters:opts
      }
    };
  }

  function resumen(opts){
    opts = Object.assign({
      matricula:"ACTIVO"
    }, opts || {});

    if(!text(opts.periodId) && opts.allowGlobal !== true){
      return emptySummary(opts);
    }

    var periodId = text(opts.periodId);
    var matricula = opts.matricula == null ? "ACTIVO" : text(opts.matricula);

    var base = baseRows({
      periodId:periodId,
      division:"",
      matricula:matricula,
      career:"",
      force:opts.force === true
    });

    var list = filterDecoratedList(base, {
      periodId:periodId,
      division:opts.division || "",
      career:opts.career || opts.carrera || "",
      status:opts.status || opts.estado || "",
      matricula:matricula
    });

    var baseForDivision = filterDecoratedList(base, {
      periodId:periodId,
      division:"",
      career:"",
      status:"",
      matricula:matricula
    });

    var baseForCareer = filterDecoratedList(base, {
      periodId:periodId,
      division:opts.division || "",
      career:"",
      status:"",
      matricula:matricula
    });

    var total = list.length;
    var estados = {
      cumple:0,
      pendiente:0,
      no_cumple:0
    };
    var matriculas = {
      ACTIVO:0,
      RETIRADO:0
    };

    list.forEach(function(row){
      estados[row._estado.id] = (estados[row._estado.id] || 0) + 1;
      matriculas[row._estadoMatricula] = (matriculas[row._estadoMatricula] || 0) + 1;
    });

    var reqTotals = requirementTotals(list);
    var notes = notasResumen(list);
    var selected = selectedRequirementSummary(list, opts.requirementKey || opts.requisito || "");

    return {
      total:total,
      estados:estados,
      matriculas:matriculas,
      avanceGeneral:reqTotals.avance,
      notasResumen:notes,
      requisitos:requisitos(list),
      requisitosFinales:requisitosFinales(list),
      requisitosFiltro:requisitosFiltro(),
      selectedRequirement:selected,
      periodApproval:periodApproval(list, opts),
      carreras:byKey(list,function(row){return row._carrera;}),
      periodos:byKey(list,function(row){return row._periodo;}),
      divisiones:byKey(list,function(row){return row._division;}),
      periodList:periods(),
      divisionList:divisions(baseForDivision),
      careerList:careers(baseForCareer),
      rows:list,
      estudiantes:list,
      studentDisplayLimit:150,
      diagnostics:{
        generatedAt:new Date().toISOString(),
        source:source(),
        version:VERSION,
        totalStudents:total,
        totalRequirements:reqTotals.total,
        fulfilledRequirements:reqTotals.ok,
        notes:notes,
        filters:opts || {},
        optimized:true,
        mode:"stats-light-excel-local"
      }
    };
  }

  function source(){
    return lastSource || (engine() ? "BL2DataEngine" : "ExcelLocalRepo");
  }

  var lists = requirementLists();

  window.StatsCore = {
    version:VERSION,
    REQS:lists.filter,
    BASE_REQUIREMENTS:lists.base,
    REGULAR_EXTRA_REQUIREMENTS:lists.regularExtra,
    FINAL_REQUIREMENTS:lists.finals,
    FILTER_REQUIREMENTS:lists.filter,
    periods:periods,
    careers:careers,
    divisions:divisions,
    filtered:filtered,
    resumen:resumen,
    estadoCelda:estadoCelda,
    estadoGeneral:estadoGeneral,
    estadoMatricula:estadoMatricula,
    divisionOf:divisionOf,
    valueOf:valueOf,
    requirementStatus:requirementStatus,
    extractNotes:extractNotes,
    notasResumen:notasResumen,
    source:source
  };
})(window);