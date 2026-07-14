/* =========================================================
Nombre completo: cone.coordi.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.coordi.js
Función o funciones:
- Ser la fuente autoritativa de Coordi sobre la caché central.
- Entregar estudiantes con requisitos relacionados por cédula y período.
- Exponer períodos, estudiantes, requisitos, carreras y diagnóstico.
- Solicitar refresco ligero por defecto y completo solo cuando se requiere.
Con qué se conecta:
- conexiones/cone.index.js.
- conexiones/cone.utils.js.
- Coordi/coo.data.js.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-authoritative-requirements";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){ return; }

  var memo = {
    token:"",
    requirementsByCedula:Object.create(null)
  };

  function text(value){
    return typeof U.text === "function"
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    if(typeof U.normalizeKey === "function"){
      return U.normalizeKey(value);
    }
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeCedula(value){
    if(typeof U.normalizeCedula === "function"){
      return U.normalizeCedula(value);
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    return typeof U.canonicalPeriodId === "function"
      ? U.canonicalPeriodId(value)
      : text(value);
  }

  function samePeriod(a,b){
    if(typeof U.samePeriod === "function"){
      return U.samePeriod(a,b);
    }
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    return !b || a === b || normalizeKey(a) === normalizeKey(b);
  }

  function cache(){
    return U.readCache();
  }

  function cacheToken(current){
    current = current || cache();
    var meta = current.meta || {};
    return [
      Number(meta.revision || 0),
      text(meta.updatedAt || ""),
      Array.isArray(current.students) ? current.students.length : 0,
      Array.isArray(current.requirements) ? current.requirements.length : 0
    ].join("|");
  }

  function cedulaOf(row){
    row = row || {};
    return normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row.Cedula ||
      row["Cédula"] ||
      row._cedula ||
      row._bl2Id ||
      ""
    );
  }

  function periodOf(row){
    row = row || {};
    return canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );
  }

  function requirementKey(row){
    row = row || {};
    var nested = row.requisito && typeof row.requisito === "object"
      ? row.requisito
      : null;

    return text(
      row.requisitoKey ||
      row.requirementKey ||
      row.key ||
      row.campo ||
      row.field ||
      row.nombre ||
      row.codigo ||
      (nested && (nested.requisitoKey || nested.key || nested.nombre || nested.codigo || nested.id)) ||
      (typeof row.requisito === "string" ? row.requisito : "")
    );
  }

  function requirementLabel(row){
    row = row || {};
    var nested = row.requisito && typeof row.requisito === "object"
      ? row.requisito
      : null;
    return text(
      row.requisitoLabel ||
      row.label ||
      row.titulo ||
      row.nombre ||
      (nested && (nested.label || nested.titulo || nested.nombre)) ||
      requirementKey(row)
    );
  }

  function requirementValue(row){
    row = row || {};
    var keys = ["valor","value","estado","cumple","aprobado","resultado"];
    for(var i=0;i<keys.length;i+=1){
      var value = row[keys[i]];
      if(value !== undefined && value !== null){
        if(value && typeof value === "object"){
          return value.id || value.value || value.label || "";
        }
        return value;
      }
    }
    return "";
  }

  function buildRequirementsIndex(current){
    current = current || cache();
    var token = cacheToken(current);
    if(memo.token === token){
      return memo.requirementsByCedula;
    }

    memo.token = token;
    memo.requirementsByCedula = Object.create(null);

    (current.requirements || []).forEach(function(row){
      var cedula = cedulaOf(row);
      if(!cedula){ return; }
      if(!memo.requirementsByCedula[cedula]){
        memo.requirementsByCedula[cedula] = [];
      }
      memo.requirementsByCedula[cedula].push(row);
    });

    return memo.requirementsByCedula;
  }

  function attachRequirement(student, requirement){
    var key = requirementKey(requirement);
    var normalized = normalizeKey(key);
    var value = requirementValue(requirement);

    if(key){ student[key] = value; }
    if(normalized){ student[normalized] = value; }
    if(requirement.requisitoKey){ student[text(requirement.requisitoKey)] = value; }
    if(requirement.requirementKey){ student[text(requirement.requirementKey)] = value; }
  }

  function hydrateStudent(row,index){
    row = row || {};
    var student = Object.assign({},row);
    var cedula = cedulaOf(row);
    var periodoId = periodOf(row);
    var related = cedula && index[cedula] ? index[cedula] : [];
    var matched = related.filter(function(requirement){
      var reqPeriod = periodOf(requirement);
      return !periodoId || !reqPeriod || samePeriod(reqPeriod,periodoId);
    });

    matched.forEach(function(requirement){
      attachRequirement(student,requirement);
    });

    student.requisitos = matched.map(function(requirement){
      return Object.assign({},requirement,{
        requisitoKey:requirementKey(requirement),
        requisitoLabel:requirementLabel(requirement),
        valor:requirementValue(requirement)
      });
    });
    student._bdlRequirementsHydrated = true;
    student._bdlRequirementsCount = matched.length;
    return student;
  }

  function listPeriods(){
    return (cache().periods || []).slice();
  }

  function requirements(options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");

    return (cache().requirements || []).filter(function(row){
      if(periodoId && !samePeriod(periodOf(row),periodoId)){ return false; }
      if(cedula && cedulaOf(row) !== cedula){ return false; }
      return true;
    }).map(function(row){ return Object.assign({},row); });
  }

  function getStudents(options){
    options = options || {};
    var current = cache();
    var rows = U.filterStudents(current.students || [],options || {});
    var index = buildRequirementsIndex(current);
    return rows.map(function(row){ return hydrateStudent(row,index); });
  }

  function listStudents(options){
    options = options || {};
    var rows = getStudents(options);
    return {
      ok:true,
      rows:rows,
      students:rows,
      estudiantes:rows,
      total:rows.length,
      requirements:requirements(options),
      periodList:listPeriods(),
      source:"BDLocalConCoordi"
    };
  }

  function listCareers(options){
    var map = Object.create(null);
    getStudents(options || {}).forEach(function(row){
      var value = text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || row._carrera || "");
      if(value){ map[normalizeKey(value)] = value; }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
      return a.localeCompare(b,"es");
    });
  }

  function listRequirements(options){
    var map = Object.create(null);
    requirements(options || {}).forEach(function(row){
      var key = requirementKey(row);
      if(!key){ return; }
      var normalized = normalizeKey(key);
      map[normalized] = {
        key:key,
        label:requirementLabel(row) || key
      };
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
      return a.label.localeCompare(b.label,"es");
    });
  }

  function refresh(options){
    options = Object.assign({},options || {});
    var current = cache();
    var incomplete = !(current.students || []).length || !(current.requirements || []).length;
    var full = options.full === true || options.force === true || options.mode === "full" || incomplete;

    return HUB.refreshCache(Object.assign({},options,{
      source:options.source || (full ? "cone.coordi.refresh.full" : "cone.coordi.refresh.light"),
      mode:full ? "full" : "light",
      full:full,
      light:!full,
      immediate:full || options.immediate === true,
      force:options.force === true || incomplete
    })).then(function(result){
      memo.token = "";
      memo.requirementsByCedula = Object.create(null);
      return result;
    });
  }

  var api = {
    version:VERSION,
    source:"BDLocal/conexiones/cone.coordi.js",
    ready:HUB.ready,
    refresh:refresh,
    refreshFull:function(options){
      return refresh(Object.assign({},options || {},{full:true,force:true,mode:"full"}));
    },
    invalidate:function(){ memo.token = ""; memo.requirementsByCedula = Object.create(null); },
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    periods:listPeriods,
    listStudents:listStudents,
    getStudents:getStudents,
    rows:getStudents,
    buscar:listStudents,
    requirements:requirements,
    getRequirements:requirements,
    listRequirements:listRequirements,
    listCareers:listCareers,
    getStudentByCedula:function(cedula,periodoId){
      return getStudents({periodoId:periodoId || "",matricula:""}).filter(function(row){
        return cedulaOf(row) === normalizeCedula(cedula);
      })[0] || null;
    },
    status:function(){
      var current = cache();
      return {
        ok:true,
        ready:true,
        version:VERSION,
        source:"BDLocalConCoordi",
        cacheRevision:Number(current.meta && current.meta.revision || 0),
        periods:Array.isArray(current.periods) ? current.periods.length : 0,
        students:Array.isArray(current.students) ? current.students.length : 0,
        requirements:Array.isArray(current.requirements) ? current.requirements.length : 0
      };
    }
  };

  HUB.register("coordi",api);
  window.BDLocalCoordi = api;
  window.ConCoordi = api;
})(window);
