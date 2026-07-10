/* =========================================================
Nombre completo: cone.carga.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.carga.js
Función o funciones:
- Conectar la pantalla Carga con BDLocal/BL2.
- Guardar estudiantes exclusivamente en IndexedDB mediante BL2Core.
- Solicitar un único refresco incremental después de cada escritura.
- Evitar el refresco duplicado provocado por eventos del mismo guardado.
- Mantener snapshots de compatibilidad sin duplicar arreglos dentro del JSON.
- Avisar a las pantallas una sola vez por revisión de caché.
Con qué se conecta:
- conexiones/cone.index.js.
- conexiones/cone.utils.js.
- BL2Core.
- Pantallas antiguas que consumen snapshots o eventos de compatibilidad.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.3.0-single-write-refresh";
  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;

  var LEGACY_CACHE_KEY=
    "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1";

  var EXCEL_SNAPSHOT_KEY=
    "REQ_EXCEL_LOCAL_V1:snapshot";

  var EVENT_NAMES=[
    "bdlocal:legacy-ready",
    "bdlocal:legacy-snapshot",
    "requisitos:bl:snapshot-changed",
    "requisitos:bdlocal-cambio-disponible",
    "bdlocal:screen-data-updated"
  ];

  var state={
    managedWrite:false,
    coreWriteTimer:null,
    lastRefreshAt:0,
    lastRefreshPeriodoId:"",
    lastNotifiedToken:"",
    legacyRaw:Object.create(null),
    metrics:{
      managedWrites:0,
      externalWrites:0,
      refreshes:0,
      suppressedEvents:0,
      legacyWrites:0,
      legacySkipped:0,
      notifications:0
    }
  };

  if(!HUB||!U){
    return;
  }

  function core(){
    return window.BL2Core||null;
  }

  function ready(){
    return HUB.ensureCoreReady();
  }

  function revisionOf(cache){
    return Number(
      cache&&
      cache.meta&&
      cache.meta.revision||
      0
    );
  }

  function periodIdOfDetail(detail){
    detail=detail||{};

    return U.canonicalPeriodId(
      detail.periodoCanonicoId||
      detail.periodoId||
      detail.periodId||
      detail.id||
      ""
    );
  }

  function cacheToken(cache){
    cache=cache||{};

    var revision=revisionOf(cache);

    var updatedAt=U.text(
      cache.meta&&
      cache.meta.updatedAt||
      ""
    );

    return revision>0
      ?"revision:"+revision
      :[
        "fallback",
        updatedAt,
        Array.isArray(cache.periods)
          ?cache.periods.length
          :0,
        Array.isArray(cache.students)
          ?cache.students.length
          :0,
        Array.isArray(cache.requirements)
          ?cache.requirements.length
          :0
      ].join(":");
  }

  function legacyPayload(cache,options){
    cache=cache||U.readCache();
    options=options||{};

    return {
      meta:Object.assign(
        {},
        cache.meta||{},
        {
          source:
            options.source||
            "cone.carga",
          screenFlowVersion:VERSION,
          updatedAt:
            cache.meta&&
            cache.meta.updatedAt||
            U.nowISO()
        }
      ),
      periodList:
        Array.isArray(cache.periods)
          ?cache.periods
          :[],
      rows:
        Array.isArray(cache.students)
          ?cache.students
          :[],
      requirements:
        Array.isArray(cache.requirements)
          ?cache.requirements
          :[],
      diagnostics:
        Array.isArray(cache.diagnostics)
          ?cache.diagnostics
          :[]
    };
  }

  function excelPayload(cache,options){
    cache=cache||U.readCache();
    options=options||{};

    return {
      meta:Object.assign(
        {},
        cache.meta||{},
        {
          source:
            options.source||
            "cone.carga",
          screenFlowVersion:VERSION,
          updatedAt:
            cache.meta&&
            cache.meta.updatedAt||
            U.nowISO()
        }
      ),
      periods:
        Array.isArray(cache.periods)
          ?cache.periods
          :[],
      students:
        Array.isArray(cache.students)
          ?cache.students
          :[],
      history:[],
      diagnostics:
        Array.isArray(cache.diagnostics)
          ?cache.diagnostics
          :[]
    };
  }

  function writeLegacyKey(key,payload){
    var raw="";

    try{
      raw=JSON.stringify(payload);
    }catch(error){
      U.emit(
        "bdlocal:con-carga-legacy-warning",
        {
          ok:false,
          key:key,
          message:
            error&&error.message
              ?error.message
              :String(error),
          source:
            "cone.carga.writeLegacyKey"
        }
      );

      return false;
    }

    if(state.legacyRaw[key]===raw){
      state.metrics.legacySkipped+=1;
      return true;
    }

    try{
      window.localStorage.setItem(
        key,
        raw
      );

      state.legacyRaw[key]=raw;
      state.metrics.legacyWrites+=1;

      return true;
    }catch(error2){
      U.emit(
        "bdlocal:con-carga-legacy-warning",
        {
          ok:false,
          key:key,
          message:
            error2&&error2.message
              ?error2.message
              :String(error2),
          source:
            "cone.carga.writeLegacyKey"
        }
      );

      return false;
    }
  }

  function dispatchTo(target,name,detail){
    try{
      if(
        target&&
        typeof target.dispatchEvent==="function"
      ){
        var EventCtor=
          target.CustomEvent||
          window.CustomEvent;

        target.dispatchEvent(
          new EventCtor(name,{
            detail:detail||{}
          })
        );
      }
    }catch(error){}
  }

  function broadcast(name,detail){
    dispatchTo(window,name,detail);

    try{
      if(
        window.parent&&
        window.parent!==window
      ){
        dispatchTo(
          window.parent,
          name,
          detail
        );

        var frames=
          window.parent.document&&
          window.parent.document.querySelectorAll
            ?window.parent.document.querySelectorAll(
              "iframe"
            )
            :[];

        Array.prototype.forEach.call(
          frames||[],
          function(frame){
            if(
              frame&&
              frame.contentWindow&&
              frame.contentWindow!==window
            ){
              dispatchTo(
                frame.contentWindow,
                name,
                detail
              );
            }
          }
        );
      }
    }catch(error){}

    try{
      if(
        window.top&&
        window.top!==window&&
        window.top!==window.parent
      ){
        dispatchTo(
          window.top,
          name,
          detail
        );
      }
    }catch(error2){}
  }

  function notifyScreens(cache,options){
    cache=cache||U.readCache();
    options=options||{};

    var token=cacheToken(cache);

    if(
      token===state.lastNotifiedToken&&
      options.force!==true
    ){
      state.metrics.legacySkipped+=1;
      return cache;
    }

    writeLegacyKey(
      LEGACY_CACHE_KEY,
      legacyPayload(cache,options)
    );

    writeLegacyKey(
      EXCEL_SNAPSHOT_KEY,
      excelPayload(cache,options)
    );

    var detail={
      ok:true,
      source:
        options.source||
        "cone.carga",
      periodoId:U.canonicalPeriodId(
        options.periodoId||""
      ),
      refreshMode:
        cache.meta&&
        cache.meta.refreshMode||
        options.mode||
        "full",
      revision:revisionOf(cache),
      periods:
        Array.isArray(cache.periods)
          ?cache.periods.length
          :0,
      students:
        Array.isArray(cache.students)
          ?cache.students.length
          :0,
      requirements:
        Array.isArray(cache.requirements)
          ?cache.requirements.length
          :0,
      updatedAt:
        cache.meta&&
        cache.meta.updatedAt||
        U.nowISO()
    };

    EVENT_NAMES.forEach(function(name){
      broadcast(name,detail);
    });

    state.lastNotifiedToken=token;
    state.metrics.notifications+=1;

    return cache;
  }

  function safeRefreshCache(options){
    options=Object.assign(
      {
        source:"cone.carga"
      },
      options||{}
    );

    if(
      !HUB||
      typeof HUB.refreshCache!=="function"
    ){
      return Promise.resolve(
        U.readCache()
      );
    }

    return HUB.refreshCache(options)
      .then(function(cache){
        state.lastRefreshAt=Date.now();

        state.lastRefreshPeriodoId=
          U.canonicalPeriodId(
            options.periodoId||""
          );

        state.metrics.refreshes+=1;

        return cache||U.readCache();
      })
      .catch(function(error){
        U.emit(
          "bdlocal:con-carga-cache-warning",
          {
            ok:false,
            message:
              error&&error.message
                ?error.message
                :String(error),
            source:
              options.source||
              "cone.carga"
          }
        );

        return U.readCache();
      });
  }

  function refreshAfterChange(
    periodoId,
    source,
    options
  ){
    periodoId=U.canonicalPeriodId(
      periodoId||""
    );

    options=Object.assign({},options||{});

    return safeRefreshCache({
      source:
        source||
        "cone.carga.change",
      periodoId:periodoId,
      mode:"full",
      full:true,
      immediate:true,
      changed:true,
      incremental:
        periodoId
          ?options.incremental!==false
          :false,
      allowEmpty:
        options.allowEmpty===true,
      cooldown:0
    }).then(function(cache){
      return notifyScreens(cache,{
        source:
          source||
          "cone.carga.change",
        periodoId:periodoId,
        mode:"full"
      });
    });
  }

  function scheduleCoreWriteRefresh(event){
    var detail=
      event&&event.detail||{};

    var periodoId=
      periodIdOfDetail(detail);

    if(state.managedWrite){
      state.metrics.suppressedEvents+=1;
      return;
    }

    if(
      Date.now()-state.lastRefreshAt<700&&
      (
        !periodoId||
        U.samePeriod(
          periodoId,
          state.lastRefreshPeriodoId
        )
      )
    ){
      state.metrics.suppressedEvents+=1;
      return;
    }

    if(state.coreWriteTimer){
      window.clearTimeout(
        state.coreWriteTimer
      );
    }

    state.coreWriteTimer=
      window.setTimeout(function(){
        state.coreWriteTimer=null;
        state.metrics.externalWrites+=1;

        refreshAfterChange(
          periodoId,
          "cone.carga.external-core-write",
          {
            incremental:!!periodoId
          }
        );
      },240);
  }

  window.addEventListener(
    "bl2:students-saved",
    scheduleCoreWriteRefresh
  );

  window.addEventListener(
    "bl2:student-updated",
    scheduleCoreWriteRefresh
  );

  function getPeriods(){
    return ready().then(function(){
      if(
        core()&&
        typeof core().getPeriods==="function"
      ){
        return core().getPeriods();
      }

      return U.readCache().periods;
    });
  }

  function savePeriod(period){
    period=U.normalizePeriod(period);

    if(!period){
      return Promise.reject(
        new Error("Período inválido.")
      );
    }

    return ready().then(function(){
      if(
        !core()||
        typeof core().savePeriod!=="function"
      ){
        return period;
      }

      return core().savePeriod(period)
        .then(function(saved){
          return safeRefreshCache({
            source:"cone.carga.savePeriod",
            mode:"light",
            light:true,
            immediate:true,
            changed:true,
            cooldown:0
          }).then(function(cache){
            notifyScreens(cache,{
              source:
                "cone.carga.savePeriod",
              periodoId:
                period.periodoId||
                period.id,
              mode:"light"
            });

            return saved||period;
          });
        });
    });
  }

  function setActivePeriod(
    periodoId,
    periodoLabel
  ){
    periodoId=U.canonicalPeriodId(
      periodoId
    );

    periodoLabel=U.text(
      periodoLabel||
      periodoId
    );

    if(!periodoId){
      return Promise.reject(
        new Error(
          "Seleccione un período válido."
        )
      );
    }

    try{
      window.localStorage.setItem(
        "carga.periodoSeleccionado",
        periodoId
      );
    }catch(error){}

    try{
      window.localStorage.setItem(
        "carga.periodoSeleccionadoLabel",
        periodoLabel
      );
    }catch(error2){}

    return ready().then(function(){
      if(
        core()&&
        typeof core().setActivePeriod==="function"
      ){
        return core().setActivePeriod(
          periodoId,
          periodoLabel
        );
      }

      return {
        id:periodoId,
        label:periodoLabel,
        periodoId:periodoId,
        periodoLabel:periodoLabel,
        periodoCanonicoId:periodoId,
        periodoCanonicoLabel:periodoLabel
      };
    });
  }

  function normalizeOptions(options){
    options=Object.assign(
      {},
      options||{}
    );

    options.periodoId=
      U.canonicalPeriodId(
        options.periodoCanonicoId||
        options.periodoId||
        options.id||
        ""
      );

    options.periodoLabel=U.text(
      options.periodoCanonicoLabel||
      options.periodoLabel||
      options.label||
      options.periodoId
    );

    options.periodoCanonicoId=
      options.periodoId;

    options.periodoCanonicoLabel=
      options.periodoLabel;

    options.normalized=
      options.normalized!==false;

    options.source=
      options.source||
      "carga_excel";

    options.sync=false;
    options.localOnly=true;
    options.cloudSync=false;
    options.manualCloudSync=true;

    return options;
  }

  function saveStudents(rows,options){
    rows=Array.isArray(rows)?rows:[];

    options=normalizeOptions(
      options||{}
    );

    if(!options.periodoId){
      return Promise.reject(
        new Error(
          "No hay período seleccionado para guardar."
        )
      );
    }

    return ready().then(function(){
      if(
        !core()||
        typeof core().saveStudents!=="function"
      ){
        throw new Error(
          "BL2Core.saveStudents no está disponible para Carga."
        );
      }

      state.managedWrite=true;
      state.metrics.managedWrites+=1;

      U.emit(
        "bdlocal:con-carga-saving",
        {
          ok:true,
          periodoId:options.periodoId,
          total:rows.length,
          source:options.source
        }
      );

      return core().saveStudents(
        rows,
        options
      ).then(function(result){
        return refreshAfterChange(
          options.periodoId,
          "cone.carga.saveStudents",
          {
            incremental:true,
            allowEmpty:true
          }
        ).then(function(){
          U.emit(
            "bdlocal:con-carga-saved",
            {
              ok:
                result&&
                result.ok!==false,
              periodoId:
                options.periodoId,
              periodoLabel:
                options.periodoLabel,
              total:rows.length,
              saved:
                result&&
                typeof result.total==="number"
                  ?result.total
                  :rows.length,
              source:options.source
            }
          );

          return result;
        });
      }).then(function(result){
        state.managedWrite=false;
        return result;
      }).catch(function(error){
        state.managedWrite=false;
        throw error;
      });
    });
  }

  function guardarEstudiantes(
    rows,
    periodoInfo,
    options
  ){
    return saveStudents(
      rows,
      Object.assign(
        {},
        options||{},
        periodoInfo||{}
      )
    );
  }

  function getSummary(periodoId){
    periodoId=U.canonicalPeriodId(
      periodoId||""
    );

    return ready().then(function(){
      if(
        core()&&
        typeof core().getSummary==="function"
      ){
        return core().getSummary(periodoId);
      }

      return {
        periodoId:periodoId,
        totalEstudiantes:0
      };
    });
  }

  function manualRefresh(options){
    options=Object.assign(
      {},
      options||{}
    );

    var periodoId=U.canonicalPeriodId(
      options.periodoId||
      options.periodId||
      ""
    );

    return safeRefreshCache(
      Object.assign(
        {
          source:"cone.carga.refresh",
          mode:"full",
          full:true,
          immediate:true,
          force:true,
          periodoId:periodoId,
          incremental:!!periodoId,
          cooldown:0
        },
        options
      )
    ).then(function(cache){
      return notifyScreens(cache,{
        source:
          options.source||
          "cone.carga.refresh",
        periodoId:periodoId,
        mode:
          options.mode||
          "full",
        force:true
      });
    });
  }

  var api={
    version:VERSION,
    source:
      "BDLocal/conexiones/cone.carga.js",
    ready:ready,
    refresh:manualRefresh,
    notifyScreens:notifyScreens,
    getPeriods:getPeriods,
    listarPeriodos:getPeriods,
    savePeriod:savePeriod,
    guardarPeriodo:savePeriod,
    setActivePeriod:setActivePeriod,
    saveStudents:saveStudents,
    guardarEstudiantes:guardarEstudiantes,
    getSummary:getSummary,
    resumen:getSummary,

    status:function(){
      return {
        ok:true,
        version:VERSION,
        managedWrite:
          state.managedWrite,
        lastRefreshAt:
          state.lastRefreshAt,
        lastRefreshPeriodoId:
          state.lastRefreshPeriodoId,
        metrics:Object.assign(
          {},
          state.metrics
        )
      };
    }
  };

  HUB.register("carga",api);

  window.BDLocalCarga=api;
  window.ConCarga=api;

  if(!window.BDLRepoEstudiantes){
    window.BDLRepoEstudiantes={
      guardarMuchos:function(
        rows,
        periodoInfo,
        options
      ){
        return guardarEstudiantes(
          rows,
          periodoInfo,
          options
        );
      }
    };
  }
})(window);