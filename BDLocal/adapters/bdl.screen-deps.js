/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.screen-deps.js
Función o funciones:
- Adaptar BDLocal para pantallas que requieren consultas síncronas.
- Consumir directamente la caché central de BDLocalConUtils cuando existe.
- Evitar volver a parsear y normalizar todos los estudiantes en cada evento.
- Resolver divisiones únicamente cuando el filtro o la pantalla lo requiere.
- Exponer ExcelLocalRepo, BL2DataEngine, BL2EstudiantesRepo y BL2ReportesRepo.
- Mantener una ruta de compatibilidad con snapshots antiguos si los conectores no están disponibles.
Con qué se conecta:
- conexiones/cone.utils.js y conexiones/cone.index.js.
- adapters/bdl.divisiones.service.js.
- adapters/bdl.divisiones.fast-cache.js mientras exista por compatibilidad.
- Ficha, Tabla, Stats, Coordi, Reportes y Defensas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION=
    "1.4.0-central-cache-direct";

  var currentScript=document.currentScript;

  var CACHE_KEY=
    "REQ_BDLOCAL_CONEXIONES_CACHE_V1";

  var OLD_SNAPSHOT_KEY=
    "REQ_EXCEL_LOCAL_V1:snapshot";

  var memo={
    raw:"",
    cache:null,
    normalizedAt:"",
    readyPromise:null,
    adapters:null,
    installed:false,
    fallbackReads:0,
    centralReads:0
  };

  function conUtils(){
    return window.BDLocalConUtils||null;
  }

  function text(value){
    var U=conUtils();

    return U&&typeof U.text==="function"
      ?U.text(value)
      :String(value==null?"":value).trim();
  }

  function safeParse(value,fallback){
    var U=conUtils();

    if(
      U&&
      typeof U.safeParse==="function"
    ){
      return U.safeParse(
        value,
        fallback
      );
    }

    try{
      if(!value){
        return fallback;
      }

      var parsed=JSON.parse(value);

      return parsed==null
        ?fallback
        :parsed;
    }catch(error){
      return fallback;
    }
  }

  function rawStorage(key){
    try{
      return window.localStorage.getItem(key)||"";
    }catch(error){
      return "";
    }
  }

  function normalizeBasic(value){
    var U=conUtils();

    if(
      U&&
      typeof U.normalizeBasic==="function"
    ){
      return U.normalizeBasic(value);
    }

    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .trim();
  }

  function normalizeKey(value){
    var U=conUtils();

    if(
      U&&
      typeof U.normalizeKey==="function"
    ){
      return U.normalizeKey(value);
    }

    return normalizeBasic(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"");
  }

  function normalizeCedula(value){
    var U=conUtils();

    if(
      U&&
      typeof U.normalizeCedula==="function"
    ){
      return U.normalizeCedula(value);
    }

    var raw=text(value)
      .replace(/[^0-9A-Za-z]/g,"");

    return /^\d{9}$/.test(raw)
      ?"0"+raw
      :raw;
  }

  function canonicalPeriodId(value){
    var U=conUtils();

    if(
      U&&
      typeof U.canonicalPeriodId==="function"
    ){
      return U.canonicalPeriodId(value);
    }

    value=text(value);

    if(!value){
      return "";
    }

    var match=value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ?match[1]+"-"+match[2]+
        "__"+
        match[3]+"-"+match[4]
      :value.replace(/_+/g,"__");
  }

  function samePeriod(a,b){
    var U=conUtils();

    if(
      U&&
      typeof U.samePeriod==="function"
    ){
      return U.samePeriod(a,b);
    }

    a=canonicalPeriodId(a);
    b=canonicalPeriodId(b);

    return !b||
      !!a&&(
        a===b||
        normalizeKey(a)===normalizeKey(b)
      );
  }

  function containsText(haystack,needle){
    needle=normalizeBasic(needle)
      .toLowerCase();

    if(!needle){
      return true;
    }

    return normalizeBasic(haystack)
      .toLowerCase()
      .indexOf(needle)>=0;
  }

  function normalizePeriod(period){
    var U=conUtils();

    if(
      U&&
      typeof U.normalizePeriod==="function"
    ){
      return U.normalizePeriod(period);
    }

    period=period||{};

    var id=canonicalPeriodId(
      period.periodoCanonicoId||
      period.periodoId||
      period.periodId||
      period.id||
      period.value||
      period.key||
      ""
    );

    if(!id){
      return null;
    }

    var label=text(
      period.periodoCanonicoLabel||
      period.periodoLabel||
      period.label||
      period.nombre||
      period.name||
      id
    );

    return Object.assign({},period,{
      id:id,
      value:id,
      key:id,
      label:label,
      nombre:label,
      periodoId:id,
      periodId:id,
      periodoLabel:label,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label,
      divisiones:
        Array.isArray(period.divisiones)
          ?period.divisiones
          :[],
      carrerasDetectadas:
        Array.isArray(
          period.carrerasDetectadas
        )
          ?period.carrerasDetectadas
          :[]
    });
  }

  function fallbackDivision(row){
    row=row||{};

    var direct=text(
      row._division||
      row._bl2Division||
      row.division||
      row.Division||
      row["División"]||
      row.divisionActual||
      ""
    );

    var list=
      Array.isArray(row.divisiones)
        ?row.divisiones
        :[];

    return direct||
      text(list[0])||
      "Sin división";
  }

  function resolveDivision(row){
    var division="";

    try{
      if(
        window.BLDivisionesService&&
        typeof window.BLDivisionesService
          .studentDivision==="function"
      ){
        division=
          window.BLDivisionesService
            .studentDivision(row);
      }
    }catch(error){}

    division=text(
      division||
      fallbackDivision(row)||
      "Sin división"
    );

    return division||"Sin división";
  }

  function normalizeStudent(row){
    var U=conUtils();
    var result;

    if(
      U&&
      typeof U.normalizeStudent==="function"
    ){
      result=U.normalizeStudent(row||{});
    }else{
      result=Object.assign({},row||{});

      var cedula=normalizeCedula(
        result.cedula||
        result.numeroIdentificacion||
        result.NumeroIdentificacion||
        result.identificacion||
        result.Identificacion||
        result.Cedula||
        result["Cédula"]||
        ""
      );

      var periodoId=canonicalPeriodId(
        result.periodoCanonicoId||
        result.periodoId||
        result.periodId||
        result.ultimoPeriodoId||
        result.idPeriodo||
        result._periodoId||
        result._bl2PeriodoId||
        ""
      );

      var nombres=text(
        result.Nombres||
        result.nombres||
        result.nombreCompleto||
        result.Nombre||
        result.nombre||
        result.Estudiante||
        result.estudiante||
        ""
      );

      result.cedula=cedula;

      result.numeroIdentificacion=
        result.numeroIdentificacion||
        cedula;

      result.NumeroIdentificacion=
        result.NumeroIdentificacion||
        cedula;

      result.periodoId=periodoId;
      result.periodId=periodoId;

      result.Nombres=
        result.Nombres||nombres;

      result.nombres=
        result.nombres||nombres;

      result.nombreCompleto=
        result.nombreCompleto||nombres;

      result.estadoMatricula=text(
        result.estadoMatricula||
        result._estadoMatricula||
        result.EstadoMatricula||
        "ACTIVO"
      ).toUpperCase()==="RETIRADO"
        ?"RETIRADO"
        :"ACTIVO";

      result._estadoMatricula=
        result.estadoMatricula;
    }

    if(
      result.__bdlScreenDepsVersion===VERSION
    ){
      return result;
    }

    result.__bdlScreenDepsVersion=VERSION;

    return result;
  }

  function emptyCache(){
    return {
      meta:{
        source:"empty",
        updatedAt:new Date().toISOString(),
        totalPeriods:0,
        totalStudents:0,
        screenDepsVersion:VERSION
      },
      periods:[],
      students:[],
      requirements:[],
      summaries:{},
      diagnostics:[]
    };
  }

  function normalizeFallbackCache(cache){
    cache=
      cache&&typeof cache==="object"
        ?cache
        :emptyCache();

    var result={
      meta:
        cache.meta&&
        typeof cache.meta==="object"
          ?cache.meta
          :{},
      periods:
        Array.isArray(cache.periods)
          ?cache.periods
            .map(normalizePeriod)
            .filter(Boolean)
          :[],
      students:
        Array.isArray(cache.students)
          ?cache.students
            .map(normalizeStudent)
          :[],
      requirements:
        Array.isArray(cache.requirements)
          ?cache.requirements
          :[],
      summaries:
        cache.summaries&&
        typeof cache.summaries==="object"
          ?cache.summaries
          :{},
      diagnostics:
        Array.isArray(cache.diagnostics)
          ?cache.diagnostics
          :[]
    };

    result.meta.totalPeriods=
      result.periods.length;

    result.meta.totalStudents=
      result.students.length;

    result.meta.screenDepsVersion=VERSION;

    return result;
  }

  function readFallbackCache(force){
    var raw=rawStorage(CACHE_KEY);

    if(!raw){
      raw=rawStorage(
        OLD_SNAPSHOT_KEY
      );
    }

    if(
      !force&&
      memo.cache&&
      memo.raw===raw
    ){
      return memo.cache;
    }

    var cache=safeParse(raw,null);

    if(
      (
        !cache||
        !Array.isArray(cache.students)
      )&&
      rawStorage(OLD_SNAPSHOT_KEY)
    ){
      cache=safeParse(
        rawStorage(OLD_SNAPSHOT_KEY),
        null
      );
    }

    memo.fallbackReads+=1;
    memo.raw=raw;
    memo.cache=
      normalizeFallbackCache(cache);
    memo.normalizedAt=
      new Date().toISOString();

    return memo.cache;
  }

  function readCache(force){
    var U=conUtils();

    if(
      U&&
      typeof U.readCache==="function"
    ){
      memo.centralReads+=1;
      memo.cache=U.readCache(
        force===true
      );

      memo.normalizedAt=
        memo.cache&&
        memo.cache.meta&&
        memo.cache.meta.updatedAt||
        memo.normalizedAt||
        new Date().toISOString();

      return memo.cache;
    }

    return readFallbackCache(
      force===true
    );
  }

  function clearMemo(){
    memo.raw="";
    memo.cache=null;
    memo.normalizedAt="";
  }

  function filterByDivision(rows,division){
    division=text(division);

    if(!division){
      return rows;
    }

    var divisionKey=
      normalizeKey(division);

    return rows.filter(function(input){
      var row=normalizeStudent(input);

      var direct=normalizeKey(
        row.division||
        row._division||
        fallbackDivision(row)
      );

      if(direct===divisionKey){
        return true;
      }

      try{
        if(
          window.BLDivisionesService&&
          typeof window.BLDivisionesService
            .hasDivision==="function"
        ){
          return window.BLDivisionesService
            .hasDivision(
              row,
              division
            );
        }
      }catch(error){}

      return normalizeKey(
        resolveDivision(row)
      )===divisionKey;
    });
  }

  function fallbackFilterStudents(
    rows,
    options
  ){
    options=options||{};
    rows=Array.isArray(rows)?rows:[];

    var periodoId=canonicalPeriodId(
      options.periodoId||
      options.periodId||
      options.period||
      ""
    );

    var matricula=text(
      options.matricula||
      options.estadoMatricula||
      ""
    ).toUpperCase();

    var carrera=text(
      options.carrera||
      options.career||
      ""
    );

    var sede=text(
      options.sede||""
    );

    var search=text(
      options.search||
      options.busqueda||
      options.query||
      ""
    );

    var limit=Math.max(
      0,
      Number(options.limit||0)
    );

    var out=[];

    for(var i=0;i<rows.length;i+=1){
      var row=normalizeStudent(rows[i]);

      if(
        periodoId&&
        !samePeriod(
          row.periodoId||
          row._periodoId||
          row.ultimoPeriodoId,
          periodoId
        )
      ){
        continue;
      }

      if(
        matricula&&
        text(
          row.estadoMatricula||
          row._estadoMatricula
        ).toUpperCase()!==matricula
      ){
        continue;
      }

      if(
        carrera&&
        !containsText(
          [
            row.NombreCarrera,
            row.nombreCarrera,
            row.Carrera,
            row.carrera,
            row.CodigoCarrera,
            row.codigoCarrera
          ].join(" "),
          carrera
        )
      ){
        continue;
      }

      if(
        sede&&
        !containsText(
          [
            row.Sede,
            row.sede,
            row._sede
          ].join(" "),
          sede
        )
      ){
        continue;
      }

      if(
        search&&
        !containsText(
          [
            row.cedula,
            row.numeroIdentificacion,
            row.NumeroIdentificacion,
            row.Nombres,
            row.nombres,
            row.nombreCompleto,
            row.NombreCarrera,
            row.nombreCarrera,
            row.Carrera,
            row.carrera,
            row.CodigoCarrera,
            row.codigoCarrera,
            row.division,
            row._division,
            row.Sede,
            row.sede,
            row.CorreoPersonal,
            row.CorreoInstitucional,
            row.correoPersonal,
            row.correoInstitucional,
            row.Celular,
            row.celular,
            row.telefono
          ].join(" "),
          search
        )
      ){
        continue;
      }

      out.push(row);

      if(
        limit>0&&
        out.length>=limit
      ){
        break;
      }
    }

    return out;
  }

  function filterStudents(rows,options){
    options=Object.assign(
      {},
      options||{}
    );

    rows=Array.isArray(rows)?rows:[];

    var division=options.division||"";

    var limit=Math.max(
      0,
      Number(options.limit||0)
    );

    var U=conUtils();

    var baseOptions=Object.assign(
      {},
      options
    );

    delete baseOptions.division;

    if(division){
      baseOptions.limit=0;
    }

    var filtered=
      U&&typeof U.filterStudents==="function"
        ?U.filterStudents(
          rows,
          baseOptions
        )
        :fallbackFilterStudents(
          rows,
          baseOptions
        );

    filtered=filterByDivision(
      filtered,
      division
    );

    return limit>0
      ?filtered.slice(0,limit)
      :filtered;
  }

  function listPeriodsSync(){
    return readCache()
      .periods
      .slice();
  }

  function getStudentsSync(options){
    return filterStudents(
      readCache().students,
      options||{}
    );
  }

  function listStudentsSync(options){
    var rows=getStudentsSync(
      options||{}
    );

    return {
      ok:true,
      rows:rows,
      total:rows.length,
      periodList:listPeriodsSync(),
      source:"BDLocalScreenDeps",
      cacheAt:memo.normalizedAt
    };
  }

  function getRequirementsSync(filters){
    filters=filters||{};

    var periodoId=canonicalPeriodId(
      filters.periodoId||
      filters.periodId||
      ""
    );

    var cedula=normalizeCedula(
      filters.cedula||
      filters.numeroIdentificacion||
      ""
    );

    return readCache()
      .requirements
      .filter(function(req){
        req=req||{};

        return (
          !periodoId||
          samePeriod(
            req.periodoId||
            req.periodId||
            req.periodoCanonicoId,
            periodoId
          )
        )&&(
          !cedula||
          normalizeCedula(
            req.cedula||
            req.numeroIdentificacion
          )===cedula
        );
      });
  }

  function getSummarySync(periodoId){
    periodoId=canonicalPeriodId(
      periodoId||""
    );

    var cache=readCache();

    var stored=
      cache.summaries&&(
        cache.summaries[periodoId]||
        cache.summaries[
          normalizeKey(periodoId)
        ]
      );

    if(
      stored&&
      typeof stored==="object"
    ){
      return Object.assign(
        {
          id:periodoId,
          periodoId:periodoId,
          source:
            "BDLocalScreenDeps.cache"
        },
        stored
      );
    }

    var rows=getStudentsSync({
      periodoId:periodoId,
      matricula:""
    });

    var activos=0;

    rows.forEach(function(row){
      if(
        text(
          row.estadoMatricula||
          row._estadoMatricula
        ).toUpperCase()!=="RETIRADO"
      ){
        activos+=1;
      }
    });

    return {
      id:periodoId,
      periodoId:periodoId,
      totalEstudiantes:rows.length,
      totalActivos:activos,
      totalRetirados:
        rows.length-activos,
      source:"BDLocalScreenDeps"
    };
  }

  function getStudentByCedulaSync(
    cedula,
    periodoId
  ){
    cedula=normalizeCedula(cedula);

    var rows=getStudentsSync({
      periodoId:periodoId||"",
      matricula:""
    });

    for(var i=0;i<rows.length;i+=1){
      if(
        normalizeCedula(
          rows[i].cedula||
          rows[i].numeroIdentificacion
        )===cedula
      ){
        return rows[i];
      }
    }

    return null;
  }

  function getStudentByIdSync(id,options){
    id=text(id);

    if(!id){
      return null;
    }

    var rows=getStudentsSync(
      Object.assign(
        {},
        options||{},
        {
          matricula:
            options&&
            options.matricula!=null
              ?options.matricula
              :""
        }
      )
    );

    for(var i=0;i<rows.length;i+=1){
      var row=rows[i]||{};

      if(
        text(row.id)===id||
        text(row._id)===id||
        text(row.studentId)===id||
        text(row.idEstudiantePeriodo)===id||
        text(row.cedula)===id||
        text(row.numeroIdentificacion)===id
      ){
        return row;
      }
    }

    return null;
  }

  function makeSyncAdapters(){
    var readyFn=function(){
      return window.BDLScreenDepsReady||
        Promise.resolve(true);
    };

    var excelAdapter={
      __bdlScreenDepsVersion:VERSION,
      ready:readyFn,
      source:"BDLocalScreenDeps",

      getSnapshot:function(){
        var cache=readCache();

        return {
          meta:cache.meta,
          periods:cache.periods,
          students:cache.students,
          history:[],
          diagnostics:
            cache.diagnostics||[]
        };
      },

      listPeriods:listPeriodsSync,
      getPeriods:listPeriodsSync,
      periods:listPeriodsSync,
      listStudents:listStudentsSync,
      getStudents:getStudentsSync,
      getRows:getStudentsSync,
      rows:getStudentsSync,
      all:getStudentsSync,
      listar:getStudentsSync,

      listAllStudents:function(){
        return getStudentsSync({
          matricula:""
        });
      },

      filterStudents:getStudentsSync,

      listStudentsByStatus:function(
        status,
        periodoId
      ){
        return getStudentsSync({
          matricula:status||"",
          periodoId:periodoId||""
        });
      },

      byCedula:getStudentByCedulaSync,
      getStudentByCedula:
        getStudentByCedulaSync,
      getStudentById:
        getStudentByIdSync,

      search:function(q,options){
        return listStudentsSync(
          Object.assign(
            {},
            options||{},
            {
              search:q||""
            }
          )
        );
      },

      getSummary:getSummarySync,
      summary:getSummarySync,
      getRequirements:
        getRequirementsSync,
      invalidate:clearMemo
    };

    var engineAdapter=Object.assign(
      {},
      excelAdapter,
      {
        search:function(options){
          return listStudentsSync(
            options||{}
          );
        },

        requirements:
          getRequirementsSync,

        stats:function(periodoId){
          return {
            periodoId:periodoId,
            estudiantes:getStudentsSync({
              periodoId:periodoId,
              matricula:""
            }),
            requisitos:
              getRequirementsSync({
                periodoId:periodoId
              }),
            resumen:
              getSummarySync(periodoId),
            source:"BDLocalScreenDeps"
          };
        }
      }
    );

    var estudiantesAdapter={
      __bdlScreenDepsVersion:VERSION,
      ready:readyFn,
      source:"BDLocalScreenDeps",
      buscar:listStudentsSync,
      getStudents:getStudentsSync,
      listStudents:listStudentsSync,
      filterStudents:getStudentsSync,

      listAllStudents:function(){
        return getStudentsSync({
          matricula:""
        });
      },

      obtenerPorCedula:
        getStudentByCedulaSync,
      getStudentByCedula:
        getStudentByCedulaSync,
      getStudentById:
        getStudentByIdSync,
      listPeriods:listPeriodsSync,
      getPeriods:listPeriodsSync,
      invalidate:clearMemo
    };

    var reportesAdapter={
      __bdlScreenDepsVersion:VERSION,
      ready:readyFn,
      source:"BDLocalScreenDeps",

      buildReportData:function(filters){
        filters=filters||{};

        var rows=getStudentsSync(filters);

        return {
          ok:true,
          source:"BDLocalScreenDeps",
          filters:filters,
          generatedAt:
            new Date().toISOString(),
          estudiantes:rows,
          rows:rows,
          requisitos:
            getRequirementsSync(filters),
          periodos:listPeriodsSync(),
          resumen:{
            totalEstudiantes:rows.length
          }
        };
      },

      build:function(filters){
        return this.buildReportData(
          filters||{}
        );
      },

      report:function(filters){
        return this.buildReportData(
          filters||{}
        );
      },

      getStudents:getStudentsSync,
      listStudents:listStudentsSync,
      getRequirements:
        getRequirementsSync,
      getSummary:getSummarySync,
      getPeriods:listPeriodsSync,
      listPeriods:listPeriodsSync,
      invalidate:clearMemo
    };

    return {
      excel:excelAdapter,
      engine:engineAdapter,
      estudiantes:
        estudiantesAdapter,
      reportes:
        reportesAdapter
    };
  }

  function ensureSyncAdapters(force){
    if(!memo.adapters){
      memo.adapters=
        makeSyncAdapters();
    }

    if(
      memo.installed&&
      force!==true
    ){
      return memo.adapters;
    }

    window.ExcelLocalRepo=
      Object.assign(
        {},
        window.ExcelLocalRepo||{},
        memo.adapters.excel
      );

    window.BL2DataEngine=
      Object.assign(
        {},
        window.BL2DataEngine||{},
        memo.adapters.engine
      );

    window.BL2EstudiantesRepo=
      Object.assign(
        {},
        window.BL2EstudiantesRepo||{},
        memo.adapters.estudiantes
      );

    window.BL2ReportesRepo=
      Object.assign(
        {},
        window.BL2ReportesRepo||{},
        memo.adapters.reportes
      );

    memo.installed=true;

    return memo.adapters;
  }

  function resolve(relative){
    try{
      return new URL(
        relative,
        currentScript&&
        currentScript.src
          ?currentScript.src
          :window.location.href
      ).href;
    }catch(error){
      return relative;
    }
  }

  function loaded(src){
    return Array.prototype
      .slice.call(document.scripts||[])
      .some(function(script){
        return script.src===src||
          script.getAttribute(
            "data-bdl-screen-src"
          )===src;
      });
  }

  function load(relative){
    var src=resolve(relative);

    if(loaded(src)){
      return Promise.resolve(src);
    }

    return new Promise(function(resolvePromise){
      var script=
        document.createElement("script");

      script.src=src;
      script.async=false;
      script.defer=false;

      script.setAttribute(
        "data-bdl-screen-src",
        src
      );

      script.onload=function(){
        resolvePromise(src);
      };

      script.onerror=function(){
        try{
          console.warn(
            "[BDLocalScreenDeps] No se pudo cargar",
            src
          );
        }catch(error){}

        resolvePromise(src);
      };

      document.head.appendChild(script);
    });
  }

  function sequential(files){
    var chain=Promise.resolve();

    files.forEach(function(file){
      chain=chain.then(function(){
        return load(file);
      });
    });

    return chain;
  }

  function ensureDivisionesService(){
    if(
      window.BLDivisionesService&&
      typeof window.BLDivisionesService
        .studentDivision==="function"
    ){
      return Promise.resolve(
        window.BLDivisionesService
      );
    }

    return sequential([
      "./bdl.divisiones.service.js",
      "./bdl.divisiones.fast-cache.js"
    ]).then(function(){
      return window.BLDivisionesService||
        null;
    });
  }

  function ensureConexiones(){
    if(
      window.BDLocalConexiones&&
      typeof window.BDLocalConexiones
        .ready==="function"
    ){
      return window.BDLocalConexiones
        .ready();
    }

    return sequential([
      "../conexiones/cone.utils.js",
      "../conexiones/cone.index.js"
    ]).then(function(){
      if(
        window.BDLocalConexiones&&
        typeof window.BDLocalConexiones
          .ready==="function"
      ){
        return window.BDLocalConexiones
          .ready();
      }

      return {
        ok:false,
        ready:false,
        message:
          "BDLocalConexiones no disponible."
      };
    });
  }

  function ready(){
    if(memo.readyPromise){
      return memo.readyPromise;
    }

    ensureSyncAdapters();

    memo.readyPromise=
      ensureDivisionesService()
        .then(function(){
          return ensureConexiones();
        })
        .then(function(result){
          ensureSyncAdapters(true);
          readCache();

          try{
            window.dispatchEvent(
              new CustomEvent(
                "bdlocal:screen-deps-ready",
                {
                  detail:status()
                }
              )
            );
          }catch(error){}

          return result||status();
        })
        .catch(function(error){
          try{
            console.warn(
              "[BDLocalScreenDeps]",
              error
            );
          }catch(innerError){}

          ensureSyncAdapters(true);

          return status();
        });

    return memo.readyPromise;
  }

  function status(){
    var cache=readCache();

    return {
      ok:true,
      ready:!!memo.readyPromise,
      version:VERSION,
      mode:
        conUtils()
          ?"central-cache-direct"
          :"legacy-fallback",
      periods:cache.periods.length,
      students:cache.students.length,
      requirements:
        cache.requirements.length,
      cacheAt:memo.normalizedAt,
      centralReads:
        memo.centralReads,
      fallbackReads:
        memo.fallbackReads,
      divisionesService:
        !!window.BLDivisionesService,
      conexiones:
        !!window.BDLocalConexiones,
      message:
        "Adaptador síncrono conectado a la caché central."
    };
  }

  ensureSyncAdapters();

  window.BDLocalScreenDeps={
    version:VERSION,
    ready:ready,
    status:status,
    load:load,
    readCache:readCache,
    clearMemo:clearMemo,
    filterStudents:
      getStudentsSync,
    listStudents:
      listStudentsSync,
    listPeriods:
      listPeriodsSync,
    getRequirements:
      getRequirementsSync,
    getSummary:
      getSummarySync,
    getStudentByCedula:
      getStudentByCedulaSync,
    getStudentById:
      getStudentByIdSync,
    ensureSyncAdapters:
      ensureSyncAdapters,
    ensureDivisionesService:
      ensureDivisionesService,
    normalizeStudent:
      normalizeStudent,
    normalizePeriod:
      normalizePeriod
  };

  window.BDLScreenDepsReady=ready();

  window.addEventListener(
    "storage",
    function(event){
      if(
        !event||
        [
          CACHE_KEY,
          OLD_SNAPSHOT_KEY,
          "carga.periodos.divisiones",
          "carga.periodos.local"
        ].indexOf(event.key)>=0
      ){
        if(!conUtils()){
          clearMemo();
        }
      }
    }
  );

  window.addEventListener(
    "bdlocal:conexiones-cache-updated",
    function(event){
      var detail=
        event&&event.detail||{};

      memo.normalizedAt=
        detail.at||
        new Date().toISOString();
    }
  );
})(window,document);