/* =========================================================
Nombre completo: cone.client.js
Ruta: /BDLocal/conexiones/cone.client.js
Función:
- Ser la única puerta de comunicación utilizada por las pantallas.
- Esperar contrato, registro, utilidades, orquestador y conector oficial.
- Leer y escribir sin consultar IndexedDB directamente.
- Traducir eventos antiguos a un solo evento oficial sin duplicarlos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-single-event-client";
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var declaredScreen=currentScript?String(currentScript.getAttribute("data-bdl-screen")||"").trim():"";

  var state={
    screen:"",
    corePromise:null,
    ready:Object.create(null),
    listeners:[],
    eventsBound:false,
    lastLegacySignature:"",
    lastLegacyAt:0,
    lastOfficialSignature:"",
    lastOfficialAt:0,
    reads:0,
    writes:0,
    refreshes:0,
    failures:0,
    lastError:null
  };

  function contract(){return window.BDLocalConeContract||null;}
  function registry(){return window.BDLocalConeRegistry||null;}
  function hub(){return window.BDLocalConexiones||null;}
  function utils(){return window.BDLocalConUtils||null;}

  function text(value){
    return contract()&&contract().text
      ? contract().text(value)
      : String(value==null?"":value).trim();
  }

  function now(){return new Date().toISOString();}

  function normalizeScreen(value){
    return contract()&&contract().normalizeScreen
      ? contract().normalizeScreen(value)
      : text(value).toLowerCase().replace(/[^a-z0-9_-]+/g,"");
  }

  function source(file){
    try{return new URL(file,base).href;}
    catch(error){return file;}
  }

  function existingScript(url){
    return Array.prototype.slice.call(document.scripts||[]).some(function(item){
      try{return new URL(item.src,window.location.href).href===url;}
      catch(error){return item.src===url;}
    });
  }

  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();

    return new Promise(function(resolve,reject){
      function check(){
        var value=null;
        try{value=test();}catch(error){value=null;}

        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){
          reject(new Error("No se pudo preparar "+label+"."));
          return;
        }
        window.setTimeout(check,40);
      }
      check();
    });
  }

  function load(file,test){
    var url=source(file);
    try{if(test()){return Promise.resolve(test());}}catch(error){}

    if(existingScript(url)){
      return waitFor(test,file,15000);
    }

    return new Promise(function(resolve,reject){
      var item=document.createElement("script");
      item.src=url;
      item.async=false;
      item.defer=false;
      item.setAttribute("data-bdl-connection-src",file);
      item.onload=function(){
        var value=null;
        try{value=test();}catch(error){}
        value?resolve(value):reject(new Error("El archivo no expuso la API esperada: "+file));
      };
      item.onerror=function(){reject(new Error("No se pudo cargar: "+file));};
      (document.head||document.documentElement).appendChild(item);
    });
  }

  function loadCore(){
    if(state.corePromise){return state.corePromise;}

    state.corePromise=Promise.resolve()
      .then(function(){return load("cone.contract.js",function(){return window.BDLocalConeContract;});})
      .then(function(){return load("cone.registry.js",function(){return window.BDLocalConeRegistry;});})
      .then(function(){return load("cone.utils.js",function(){return window.BDLocalConUtils;});})
      .then(function(){return load("cone.index.js",function(){return window.BDLocalConexiones;});})
      .then(function(){bindEvents();return true;})
      .catch(function(error){
        state.corePromise=null;
        state.failures+=1;
        state.lastError=error;
        throw error;
      });

    return state.corePromise;
  }

  function resolveScreen(value){
    value=normalizeScreen(value||declaredScreen||state.screen);
    if(value&&registry()&&registry().get(value)){return value;}
    return registry()&&registry().detect?registry().detect(value):value;
  }

  function resolveConnector(screen){
    var item=registry()&&registry().get?registry().get(screen):null;
    var found=null;

    if(registry()&&registry().resolve){
      try{found=registry().resolve(screen);}catch(error){found=null;}
    }

    if(!found&&item&&window[item.global]){found=window[item.global];}

    ["getConnector","connector","get"].some(function(method){
      if(found||!hub()||typeof hub()[method]!=="function"){return !!found;}
      try{found=hub()[method](screen)||null;}catch(error){found=null;}
      return !!found;
    });

    return found;
  }

  function ensureConnector(screen){
    var found=resolveConnector(screen);
    if(found){return Promise.resolve(found);}

    var item=registry()&&registry().get?registry().get(screen):null;
    if(!item){return Promise.reject(new Error("La pantalla no está registrada: "+screen));}

    return load(item.file,function(){return resolveConnector(screen);});
  }

  function hubReady(){
    if(!hub()){return Promise.reject(new Error("BDLocalConexiones no está disponible."));}
    return typeof hub().ready==="function"?Promise.resolve(hub().ready()):Promise.resolve(hub());
  }

  function ready(screen){
    return loadCore().then(function(){
      var resolved=resolveScreen(screen);

      if(!resolved){
        return hubReady().then(function(){return {ok:true,screen:"",connector:null,hub:hub()};});
      }

      state.screen=resolved;
      if(state.ready[resolved]){return state.ready[resolved];}

      state.ready[resolved]=hubReady()
        .then(function(){return ensureConnector(resolved);})
        .then(function(found){
          if(found&&typeof found.ready==="function"){
            return Promise.resolve(found.ready()).then(function(){return found;});
          }
          return found;
        })
        .then(function(found){
          try{
            contract().dispatch(contract().EVENTS.SCREEN_READY,{
              ok:true,
              screen:resolved,
              connector:registry().get(resolved).global,
              at:now()
            });
          }catch(error){}
          return {ok:true,screen:resolved,connector:found,hub:hub()};
        })
        .catch(function(error){delete state.ready[resolved];throw error;});

      return state.ready[resolved];
    });
  }

  function firstMethod(target,names){
    for(var i=0;i<names.length;i+=1){
      if(target&&typeof target[names[i]]==="function"){return target[names[i]];}
    }
    return null;
  }

  function call(target,names,args,fallback){
    var method=firstMethod(target,names);
    if(!method){return Promise.resolve(fallback);}
    return Promise.resolve().then(function(){return method.apply(target,args||[]);});
  }

  function unwrap(value,names){
    if(Array.isArray(value)){return value;}
    value=value&&typeof value==="object"?value:{};

    for(var i=0;i<names.length;i+=1){
      if(Array.isArray(value[names[i]])){return value[names[i]];}
    }

    return value.data&&typeof value.data==="object"?unwrap(value.data,names):[];
  }

  function snapshot(){
    var value=null;
    var target=hub();
    var method=firstMethod(target,["snapshot","getSnapshot"]);

    if(method){
      try{value=method.call(target);}catch(error){value=null;}
      if(value&&typeof value.then!=="function"){return value;}
    }

    return utils()&&typeof utils().readCache==="function"?utils().readCache():{};
  }

  function fallbackRead(found,query){
    var snapshotMethod=firstMethod(found,["snapshot","getSnapshot"]);

    if(snapshotMethod){
      return Promise.resolve(snapshotMethod.call(found,{filters:query||{}})).then(function(value){
        value=value&&typeof value==="object"?value:{};

        value.meta=Object.assign(
          {},
          value.meta||{},
          {
            fallbackUsed:true,
            source:value.source||"legacy-snapshot"
          }
        );

        return value;
      });
    }

    return Promise.all([
      call(found,["getPeriods","listPeriods","periods","periodos"],[],[]),
      call(found,["getStudents","listStudents","students","rows","getRows"],[query||{}],[]),
      call(found,["getRequirements","requirements","requisitos"],[query||{}],[]),
      call(found,["getCareers","careers","carreras"],[query||{}],[]),
      call(found,["getRequirementCatalog","requirementCatalog","catalog"],[],[])
    ]).then(function(values){
      return {
        periods:unwrap(values[0],["periods","periodos","rows"]),
        students:unwrap(values[1],["students","estudiantes","rows","filas"]),
        requirements:unwrap(values[2],["requirements","requisitos","rows"]),
        careers:unwrap(values[3],["careers","carreras","rows"]),
        requirementCatalog:unwrap(values[4],["requirementCatalog","catalog","rows"]),

        revision:Number(
          values[1]&&
          (
            values[1].revision||
            values[1].cacheRevision
          )||
          snapshot().meta&&
          snapshot().meta.revision||
          0
        ),

        meta:{
          source:"legacy-methods",
          fallbackUsed:true
        }
      };
    });
  }

  function failure(screen,operation,error,started){
    state.failures+=1;
    state.lastError=error;

    var response=contract().failure({
      screen:screen,
      operation:operation,
      error:error,
      source:"BDLocalConnectionClient",
      meta:{
        durationMs:Date.now()-started
      }
    });

    try{
      contract().dispatch(
        contract().EVENTS.ERROR,
        response
      );
    }catch(innerError){}

    return response;
  }

  function normalizeResponse(value,defaults){
    var response=contract().normalize(
      value,
      defaults||{}
    );

    var current=snapshot();

    response.revision=Number(
      response.revision||
      current&&
      current.meta&&
      current.meta.revision||
      0
    );

    response.meta=Object.assign(
      {},
      response.meta||{},
      {
        generatedAt:
          response.meta&&
          response.meta.generatedAt||
          now()
      }
    );

    return response;
  }

  function read(screen,query){
    if(typeof screen==="object"){
      query=screen;
      screen=query.screen;
    }

    query=query||{};
    state.reads+=1;

    var started=Date.now();
    var resolved="";

    return ready(screen||query.screen)
      .then(function(info){
        resolved=info.screen;

        var found=
          info.connector||
          resolveConnector(resolved);

        if(!found){
          throw new Error(
            "No está disponible el conector de "+
            resolved+
            "."
          );
        }

        return typeof found.read==="function"
          ? Promise.resolve(found.read(query))
          : fallbackRead(found,query);
      })
      .then(function(value){
        var response=normalizeResponse(
          value,
          {
            screen:resolved,
            operation:"read",
            source:"BDLocalConnectionClient"
          }
        );

        response.periodoId=text(
          response.periodoId||
          query.periodoId||
          query.periodId
        );

        response.meta.durationMs=
          Date.now()-started;

        state.lastError=null;
        return response;
      })
      .catch(function(error){
        return failure(
          resolved||
          normalizeScreen(
            screen||
            query.screen
          ),
          "read",
          error,
          started
        );
      });
  }

  function invoke(screen,operation,payload){
    if(typeof screen==="object"){
      payload=screen;
      screen=payload.screen;
    }

    payload=payload||{};
    operation=text(operation).toLowerCase();

    var started=Date.now();

    if(
      ["save","update","remove"]
        .indexOf(operation)>=0
    ){
      state.writes+=1;
    }

    return ready(screen||payload.screen)
      .then(function(info){
        var found=
          info.connector||
          resolveConnector(info.screen);

        if(
          !found||
          typeof found[operation]!=="function"
        ){
          throw new Error(
            "El conector "+
            info.screen+
            " no admite la operación "+
            operation+
            "."
          );
        }

        return Promise.resolve(
          found[operation](payload)
        ).then(function(value){
          return normalizeResponse(
            value,
            {
              screen:info.screen,
              operation:operation,
              source:"BDLocalConnectionClient"
            }
          );
        });
      })
      .then(function(response){
        response.meta.durationMs=
          Date.now()-started;

        return response;
      })
      .catch(function(error){
        return failure(
          normalizeScreen(
            screen||
            payload.screen
          ),
          operation,
          error,
          started
        );
      });
  }

  function refresh(screen,options){
    if(typeof screen==="object"){
      options=screen;
      screen=options.screen;
    }

    options=options||{};
    state.refreshes+=1;

    var started=Date.now();

    return ready(screen||options.screen)
      .then(function(info){
        var found=
          info.connector||
          resolveConnector(info.screen);

        if(
          found&&
          typeof found.refresh==="function"
        ){
          return found.refresh(options);
        }

        if(
          hub()&&
          typeof hub().refreshCache==="function"
        ){
          return hub().refreshCache(
            Object.assign(
              {},
              options,
              {
                source:
                  options.source||
                  (
                    "cone.client."+
                    (
                      info.screen||
                      "general"
                    )
                  ),

                sourceScreen:
                  options.sourceScreen||
                  info.screen||
                  "bdlocal"
              }
            )
          );
        }

        throw new Error(
          "No existe un método oficial para actualizar la caché."
        );
      })
      .then(function(value){
        var response=normalizeResponse(
          value,
          {
            screen:resolveScreen(
              screen||
              options.screen
            ),

            operation:"refresh",
            source:"BDLocalConnectionClient"
          }
        );

        response.meta.durationMs=
          Date.now()-started;

        return response;
      })
      .catch(function(error){
        return failure(
          resolveScreen(
            screen||
            options.screen
          ),
          "refresh",
          error,
          started
        );
      });
  }

  function eventSignature(detail){
    detail=
      detail&&
      typeof detail==="object"
        ? detail
        : {};

    return [
      Number(detail.revision||0),
      text(detail.periodoId||detail.periodId),
      text(detail.operation||"refresh"),
      text(
        detail.sourceScreen||
        detail.screen||
        detail.source||
        "bdlocal"
      )
    ].join("|");
  }

  function recent(
    signature,
    lastSignature,
    lastAt
  ){
    return (
      signature===lastSignature&&
      Date.now()-lastAt<400
    );
  }

  function acceptOfficial(detail){
    var signature=
      eventSignature(detail);

    if(
      recent(
        signature,
        state.lastOfficialSignature,
        state.lastOfficialAt
      )
    ){
      return false;
    }

    state.lastOfficialSignature=
      signature;

    state.lastOfficialAt=
      Date.now();

    return true;
  }

  function acceptLegacy(detail){
    var signature=
      eventSignature(detail);

    if(
      recent(
        signature,
        state.lastLegacySignature,
        state.lastLegacyAt
      )
    ){
      return false;
    }

    if(
      recent(
        signature,
        state.lastOfficialSignature,
        state.lastOfficialAt
      )
    ){
      return false;
    }

    state.lastLegacySignature=
      signature;

    state.lastLegacyAt=
      Date.now();

    return true;
  }

  function notify(detail){
    state.listeners
      .slice()
      .forEach(function(callback){
        try{
          callback(detail||{});
        }catch(error){}
      });
  }

  function dispatchOfficial(detail){
    detail=
      detail&&
      typeof detail==="object"
        ? detail
        : {};

    if(!acceptLegacy(detail)){
      return false;
    }

    try{
      contract().dispatch(
        contract().EVENTS.UPDATED,
        detail
      );

      return true;
    }catch(error){
      return false;
    }
  }

  function bindEvents(){
    if(state.eventsBound){
      return;
    }

    state.eventsBound=true;

    var official=
      contract().EVENTS.UPDATED;

    window.addEventListener(
      official,
      function(event){
        var detail=
          event&&
          event.detail||
          {};

        if(!acceptOfficial(detail)){
          return;
        }

        notify(detail);
      }
    );

    [
      "bdlocal:conexiones-cache-updated",
      "bdlocal:screen-data-updated",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ].forEach(function(name){
      window.addEventListener(
        name,
        function(event){
          var detail=
            event&&
            event.detail&&
            typeof event.detail==="object"
              ? event.detail
              : {};

          var current=snapshot();
          var meta=
            current&&
            current.meta||
            {};

          dispatchOfficial({
            revision:Number(
              detail.revision||
              meta.revision||
              0
            ),

            periodoId:text(
              detail.periodoId||
              detail.periodId||
              meta.periodoId
            ),

            tablesRead:
              Array.isArray(detail.tablesRead)
                ? detail.tablesRead
                : meta.tablesRead||[],

            tablesChanged:
              Array.isArray(detail.tablesChanged)
                ? detail.tablesChanged
                : meta.tablesChanged||[],

            sourceScreen:text(
              detail.sourceScreen||
              detail.screen||
              meta.sourceScreen||
              "bdlocal"
            ),

            sourceEvent:name,

            operation:text(
              detail.operation||
              meta.operation||
              "refresh"
            ),

            updatedAt:text(
              detail.updatedAt||
              detail.at||
              meta.updatedAt||
              now()
            )
          });
        }
      );
    });
  }

  function safeStatus(target){
    try{
      return (
        target&&
        typeof target.status==="function"
      )
        ? target.status()||{}
        : {};
    }catch(error){
      return {
        ok:false,
        error:text(
          error.message||
          error
        )
      };
    }
  }

  function status(screen){
    var resolved=
      resolveScreen(screen);

    var found=
      resolveConnector(resolved);

    var current=snapshot();
    var meta=
      current&&
      current.meta||
      {};

    return {
      ok:
        !!hub()&&
        (
          !resolved||
          !!found
        ),

      version:VERSION,
      screen:resolved,

      connectorLoaded:
        !!found,

      connector:
        safeStatus(found),

      hub:
        safeStatus(hub()),

      registry:
        registry()&&
        registry().status
          ? registry().status()
          : {},

      cache:{
        revision:Number(
          meta.revision||0
        ),

        periods:
          Array.isArray(current.periods)
            ? current.periods.length
            : 0,

        students:
          Array.isArray(current.students)
            ? current.students.length
            : 0,

        requirements:
          Array.isArray(current.requirements)
            ? current.requirements.length
            : 0,

        periodoId:
          text(meta.periodoId),

        tablesRead:
          Array.isArray(meta.tablesRead)
            ? meta.tablesRead.slice()
            : [],

        tablesChanged:
          Array.isArray(meta.tablesChanged)
            ? meta.tablesChanged.slice()
            : [],

        operation:
          text(meta.operation),

        sourceScreen:
          text(meta.sourceScreen),

        updatedAt:
          text(meta.updatedAt)
      },

      metrics:{
        reads:state.reads,
        writes:state.writes,
        refreshes:state.refreshes,
        failures:state.failures
      },

      lastError:
        state.lastError
          ? text(
              state.lastError.message||
              state.lastError
            )
          : "",

      updatedAt:now()
    };
  }

  function diagnose(screen,options){
    options=options||{};

    if(
      window.BDLocalConnectionMonitor&&
      typeof window.BDLocalConnectionMonitor
        .diagnoseScreen==="function"
    ){
      return window
        .BDLocalConnectionMonitor
        .diagnoseScreen(
          screen||
          options.screen,
          options
        );
    }

    return read(
      screen||
      options.screen,
      options.filters||{}
    ).then(function(response){
      return {
        ok:response.ok,
        screen:response.screen,
        response:response,
        status:status(
          response.screen
        ),
        generatedAt:now()
      };
    });
  }

  function onUpdated(callback){
    if(typeof callback!=="function"){
      return function(){};
    }

    state.listeners.push(callback);

    return function(){
      state.listeners=
        state.listeners.filter(
          function(item){
            return item!==callback;
          }
        );
    };
  }

  var api={
    version:VERSION,
    source:"BDLocal/conexiones/cone.client.js",

    ready:ready,
    read:read,
    refresh:refresh,
    invoke:invoke,

    save:function(screen,payload){
      return invoke(
        screen,
        "save",
        payload
      );
    },

    update:function(screen,payload){
      return invoke(
        screen,
        "update",
        payload
      );
    },

    remove:function(screen,payload){
      return invoke(
        screen,
        "remove",
        payload
      );
    },

    status:status,
    diagnose:diagnose,

    connector:function(screen){
      return resolveConnector(
        resolveScreen(screen)
      );
    },

    screen:function(){
      return resolveScreen(
        state.screen
      );
    },

    setScreen:function(screen){
      state.screen=
        normalizeScreen(screen);

      return state.screen;
    },

    listScreens:function(){
      return (
        registry()&&
        registry().list
      )
        ? registry().list()
        : [];
    },

    onUpdated:onUpdated
  };

  window.BDLocalConnectionClient=
    api;

  window.BDLConnectionClientReady=
    loadCore()
      .then(function(){
        var screen=
          resolveScreen(
            declaredScreen
          );

        return screen
          ? ready(screen)
              .then(function(){
                return api;
              })
          : api;
      })
      .catch(function(error){
        state.lastError=error;
        state.failures+=1;

        return api;
      });
})(window,document);