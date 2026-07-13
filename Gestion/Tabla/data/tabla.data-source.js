/* =========================================================
Nombre completo: tabla.data-source.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/data/tabla.data-source.js
Función o funciones:
- Ser la única puerta de entrada de Tabla hacia BDLocal.
- Leer períodos, estudiantes y requisitos desde el conector oficial.
- Unir los requisitos por cédula y período antes de normalizar estudiantes.
- Mantener compatibilidad con conectores y adaptadores antiguos.
========================================================= */
(function(window){
  "use strict";

  var VERSION =
    "2.1.0-requirements-envelope";

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var N =
    window.TablaDataNormalizer ||
    {};

  var memo = {
    connector:
      null,

    connectorName:
      "",

    envelope:
      null,

    token:
      "",

    reads:
      0,

    refreshes:
      0,

    failures:
      0,

    updatedAt:
      ""
  };

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function safeParse(
    value,
    fallback
  ){
    if(U.safeParse){
      return U.safeParse(
        value,
        fallback
      );
    }

    try{
      return JSON.parse(value);
    }catch(error){
      return fallback;
    }
  }

  function storageValue(key){
    try{
      return window.localStorage
        .getItem(key) || "";
    }catch(error){
      return "";
    }
  }

  function isFallback(api){
    return !!(
      api &&
      (
        api.__tablaFallback === true ||
        text(api.source) ===
          "TablaDataGuardFallback"
      )
    );
  }

  function candidates(){
    var list = [];

    function add(name, api){
      if(
        !api ||
        typeof api !== "object" ||
        isFallback(api)
      ){
        return;
      }

      if(
        list.some(function(item){
          return item.api === api;
        })
      ){
        return;
      }

      list.push({
        name:
          name,

        api:
          api
      });
    }

    add(
      "ConTabla",
      window.ConTabla
    );

    add(
      "BDLocalTabla",
      window.BDLocalTabla
    );

    try{
      if(
        window.BDLocalConexiones &&
        typeof window
          .BDLocalConexiones
          .get === "function"
      ){
        add(
          "BDLocalConexiones.get(tabla)",
          window.BDLocalConexiones
            .get("tabla")
        );
      }
    }catch(error){}

    add(
      "BDLocalScreenDeps",
      window.BDLocalScreenDeps
    );

    add(
      "BL2DataEngine",
      window.BL2DataEngine
    );

    add(
      "BL2EstudiantesRepo",
      window.BL2EstudiantesRepo
    );

    add(
      "ExcelLocalRepo",
      window.ExcelLocalRepo
    );

    return list;
  }

  function connector(force){
    if(
      !force &&
      memo.connector &&
      !isFallback(
        memo.connector
      )
    ){
      return memo.connector;
    }

    var selected =
      candidates()[0] ||
      null;

    memo.connector =
      selected
        ? selected.api
        : null;

    memo.connectorName =
      selected
        ? selected.name
        : "";

    return memo.connector;
  }

  function method(api, names){
    api = api || {};

    names =
      Array.isArray(names)
        ? names
        : [names];

    for(
      var i = 0;
      i < names.length;
      i += 1
    ){
      if(
        typeof api[names[i]] ===
        "function"
      ){
        return {
          name:
            names[i],

          fn:
            api[names[i]]
        };
      }
    }

    return null;
  }

  function invoke(
    api,
    names,
    args
  ){
    var found =
      method(api, names);

    return found
      ? found.fn.apply(
          api,
          Array.isArray(args)
            ? args
            : []
        )
      : undefined;
  }

  function unwrapRows(result){
    if(Array.isArray(result)){
      return result;
    }

    if(
      result &&
      Array.isArray(result.rows)
    ){
      return result.rows;
    }

    if(
      result &&
      Array.isArray(
        result.students
      )
    ){
      return result.students;
    }

    if(
      result &&
      result.data &&
      Array.isArray(
        result.data.rows
      )
    ){
      return result.data.rows;
    }

    if(
      result &&
      result.data &&
      Array.isArray(
        result.data.students
      )
    ){
      return result.data.students;
    }

    return [];
  }

  function unwrapPeriods(result){
    if(Array.isArray(result)){
      return result;
    }

    if(
      result &&
      Array.isArray(
        result.periods
      )
    ){
      return result.periods;
    }

    if(
      result &&
      Array.isArray(
        result.periodList
      )
    ){
      return result.periodList;
    }

    if(
      result &&
      Array.isArray(result.rows)
    ){
      return result.rows;
    }

    return [];
  }

  function unwrapRequirements(
    result
  ){
    if(
      result &&
      Array.isArray(
        result.requirements
      )
    ){
      return result.requirements;
    }

    if(
      result &&
      Array.isArray(
        result.requisitos
      )
    ){
      return result.requisitos;
    }

    if(
      result &&
      result.data &&
      Array.isArray(
        result.data.requirements
      )
    ){
      return result.data.requirements;
    }

    if(
      result &&
      result.data &&
      Array.isArray(
        result.data.requisitos
      )
    ){
      return result.data.requisitos;
    }

    return [];
  }

  function normalizeEnvelope(raw){
    if(N.normalizeEnvelope){
      return N.normalizeEnvelope(
        raw || {}
      );
    }

    raw =
      raw &&
      typeof raw === "object"
        ? raw
        : {};

    return {
      meta:
        raw.meta || {},

      periods:
        Array.isArray(raw.periods)
          ? raw.periods
          : [],

      students:
        Array.isArray(raw.students)
          ? raw.students
          : [],

      requirements:
        Array.isArray(
          raw.requirements
        )
          ? raw.requirements
          : [],

      summaries:
        raw.summaries || {},

      diagnostics:
        Array.isArray(
          raw.diagnostics
        )
          ? raw.diagnostics
          : []
    };
  }

  function localEnvelope(){
    var raw = null;

    try{
      if(
        window.BDLocalConUtils &&
        typeof window
          .BDLocalConUtils
          .readCache === "function"
      ){
        raw =
          window.BDLocalConUtils
            .readCache();
      }
    }catch(error){}

    if(!raw){
      try{
        if(
          window.BDLocalScreenDeps &&
          typeof window
            .BDLocalScreenDeps
            .readCache === "function"
        ){
          raw =
            window.BDLocalScreenDeps
              .readCache();
        }
      }catch(error){}
    }

    if(!raw){
      var storage =
        C.storage || {};

      raw =
        safeParse(
          storageValue(
            storage.centralCache ||
            "REQ_BDLOCAL_CONEXIONES_CACHE_V1"
          ),
          null
        ) ||
        safeParse(
          storageValue(
            storage.oldSnapshot ||
            "REQ_EXCEL_LOCAL_V1:snapshot"
          ),
          null
        ) ||
        {};
    }

    return normalizeEnvelope(raw);
  }

  function envelopeToken(
    envelope
  ){
    envelope = envelope || {};

    var meta =
      envelope.meta || {};

    return [
      text(meta.revision),
      text(meta.updatedAt),
      text(meta.source),

      Array.isArray(
        envelope.periods
      )
        ? envelope.periods.length
        : 0,

      Array.isArray(
        envelope.students
      )
        ? envelope.students.length
        : 0,

      Array.isArray(
        envelope.requirements
      )
        ? envelope.requirements.length
        : 0
    ].join("|");
  }

  function readEnvelope(options){
    options = options || {};

    var fresh =
      localEnvelope();

    var token =
      envelopeToken(fresh);

    memo.reads += 1;

    if(
      !options.force &&
      memo.envelope &&
      token === memo.token
    ){
      return memo.envelope;
    }

    memo.envelope =
      fresh;

    memo.token =
      token;

    memo.updatedAt =
      U.nowIso
        ? U.nowIso()
        : new Date()
            .toISOString();

    return memo.envelope;
  }

  function normalizePeriodList(
    rows
  ){
    return (
      Array.isArray(rows)
        ? rows
        : []
    )
      .map(function(item){
        return N.normalizePeriod
          ? N.normalizePeriod(item)
          : item;
      })
      .filter(Boolean);
  }

  function readPeriods(options){
    options = options || {};

    var api =
      connector(
        options.forceConnector ===
        true
      );

    var result;

    try{
      result =
        invoke(
          api,
          [
            "listPeriods",
            "getPeriods",
            "periods",
            "periodos"
          ],
          []
        );
    }catch(error){
      memo.failures += 1;
      result = null;
    }

    if(
      result &&
      typeof result.then ===
        "function"
    ){
      return result
        .then(function(value){
          var periods =
            unwrapPeriods(value);

          return normalizePeriodList(
            periods.length
              ? periods
              : readEnvelope(
                  options
                ).periods
          );
        })
        .catch(function(){
          memo.failures += 1;

          return normalizePeriodList(
            readEnvelope(
              options
            ).periods
          );
        });
    }

    var periods =
      unwrapPeriods(result);

    return normalizePeriodList(
      periods.length
        ? periods
        : readEnvelope(
            options
          ).periods
    );
  }

  function normalizeStudentsWithRequirements(
    rows,
    options,
    sourceResult
  ){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    options = options || {};

    var envelope =
      readEnvelope(options);

    var requirements =
      unwrapRequirements(
        sourceResult
      );

    if(!requirements.length){
      requirements =
        Array.isArray(
          envelope.requirements
        )
          ? envelope.requirements
          : [];
    }

    if(N.normalizeEnvelope){
      var normalized =
        N.normalizeEnvelope({
          meta:
            envelope.meta || {},

          periods:
            envelope.periods || [],

          students:
            rows,

          requirements:
            requirements,

          summaries:
            envelope.summaries || {},

          diagnostics:
            envelope.diagnostics || []
        });

      return normalized &&
        Array.isArray(
          normalized.students
        )
          ? normalized.students
          : [];
    }

    return N.normalizeStudents
      ? N.normalizeStudents(
          rows,
          options
        )
      : rows.slice();
  }

  function readStudents(options){
    options =
      Object.assign(
        {},
        options || {}
      );

    var api =
      connector(
        options.forceConnector ===
        true
      );

    var result;

    try{
      result =
        invoke(
          api,
          [
            "listStudents",
            "getStudents",
            "rows",
            "getRows",
            "listarEstudiantes",
            "filterStudents",
            "buscar",
            "all",
            "listar"
          ],
          [options]
        );
    }catch(error){
      memo.failures += 1;
      result = null;
    }

    function normalizeResult(value){
      var rows =
        unwrapRows(value);

      if(
        !rows.length &&
        value == null
      ){
        rows =
          readEnvelope(
            options
          ).students;
      }

      return normalizeStudentsWithRequirements(
        rows,
        options,
        value
      );
    }

    if(
      result &&
      typeof result.then ===
        "function"
    ){
      return result
        .then(normalizeResult)
        .catch(function(){
          memo.failures += 1;

          var envelope =
            readEnvelope(options);

          return normalizeStudentsWithRequirements(
            envelope.students,
            options,
            envelope
          );
        });
    }

    return normalizeResult(result);
  }

  function ready(){
    var api =
      connector(true);

    var tasks = [];

    if(
      window.BDLScreenDepsReady &&
      typeof window
        .BDLScreenDepsReady
        .then === "function"
    ){
      tasks.push(
        window.BDLScreenDepsReady
          .catch(function(){
            return null;
          })
      );
    }

    try{
      var result =
        invoke(
          api,
          ["ready"],
          []
        );

      if(
        result &&
        typeof result.then ===
          "function"
      ){
        tasks.push(
          result.catch(function(){
            return null;
          })
        );
      }
    }catch(error){}

    try{
      if(
        window.BDLocalScreenDeps &&
        typeof window
          .BDLocalScreenDeps
          .ready === "function"
      ){
        var deps =
          window.BDLocalScreenDeps
            .ready();

        if(
          deps &&
          typeof deps.then ===
            "function"
        ){
          tasks.push(
            deps.catch(function(){
              return null;
            })
          );
        }
      }
    }catch(error){}

    return Promise.all(tasks)
      .then(function(){
        connector(true);
        return status();
      });
  }

  function refresh(options){
    options =
      Object.assign(
        {
          source:
            "TablaDataSource.refresh",

          full:
            true,

          immediate:
            true
        },
        options || {}
      );

    memo.refreshes += 1;

    var api =
      connector(true);

    var task;

    try{
      task =
        invoke(
          api,
          [
            "refresh",
            "actualizar",
            "reload"
          ],
          [options]
        );

      if(
        task === undefined &&
        window.BDLocalConexiones &&
        typeof window
          .BDLocalConexiones
          .refreshCache === "function"
      ){
        task =
          window.BDLocalConexiones
            .refreshCache(options);
      }
    }catch(error){
      memo.failures += 1;

      task =
        Promise.reject(error);
    }

    return Promise.resolve(task)
      .catch(function(error){
        memo.failures += 1;

        return {
          ok: false,
          error: error
        };
      })
      .then(function(result){
        invalidate();

        var envelope =
          readEnvelope({
            force: true
          });

        return {
          ok:
            !(
              result &&
              result.ok === false
            ),

          result:
            result || null,

          envelope:
            envelope,

          source:
            sourceName()
        };
      });
  }

  function sourceName(){
    var api =
      connector(false);

    var envelope =
      readEnvelope();

    return (
      text(
        api &&
        api.source
      ) ||
      memo.connectorName ||
      text(
        envelope.meta &&
        envelope.meta.source
      ) ||
      "Base Local"
    );
  }

  function invalidate(){
    memo.envelope = null;
    memo.token = "";
    memo.connector = null;
    memo.connectorName = "";
  }

  function status(){
    var envelope =
      readEnvelope();

    var api =
      connector(false);

    return {
      ok:
        !!api ||
        !!envelope,

      version:
        VERSION,

      connector:
        memo.connectorName,

      source:
        sourceName(),

      periods:
        envelope.periods.length,

      students:
        envelope.students.length,

      requirements:
        envelope.requirements.length,

      reads:
        memo.reads,

      refreshes:
        memo.refreshes,

      failures:
        memo.failures,

      updatedAt:
        memo.updatedAt
    };
  }

  window.TablaDataSource = {
    version:
      VERSION,

    ready:
      ready,

    connector:
      connector,

    source:
      sourceName,

    readEnvelope:
      readEnvelope,

    readCache:
      readEnvelope,

    readPeriods:
      readPeriods,

    listPeriods:
      readPeriods,

    readStudents:
      readStudents,

    listStudents:
      readStudents,

    refresh:
      refresh,

    invalidate:
      invalidate,

    status:
      status
  };
})(window);