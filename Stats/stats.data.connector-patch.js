/* =========================================================
Nombre completo: stats.data.connector-patch.js
Ruta: /Stats/stats.data.connector-patch.js
Función:
- Hidratar estudiantes con notas entregadas por ConStats.
- Cargar notas únicamente para el período seleccionado.
- Reaccionar a cambios de notas realizados desde Defensas, Cr-def o Ncomplex.
- Diferenciar cargando, lectura correcta y error real de conexión.
- Mantener identidad canónica cédula__período.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-live-notes-signal";
  var SIGNAL_KEY="REQ_BDLOCAL_NOTES_SIGNAL_V1";

  var state={
    installed:false,
    bound:false,
    loading:null,
    loadingPeriod:"",
    currentPeriod:"",
    requestSeq:0,
    notes:[],
    byKey:Object.create(null),
    byCedula:Object.create(null),
    error:"",
    loadedAt:"",
    phase:"idle",
    reloadTimer:null,
    lastSignalAt:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function cedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function period(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function api(){return window.ConStats||window.BDLocalStats||null;}
  function selectedPeriod(){var node=document.getElementById("stats-periodo");return period(node&&node.value||"");}
  function cedulaOf(row){row=row||{};return cedula(row.cedula||row._cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row["Cédula"]);}
  function periodOf(row){row=row||{};return period(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId||row._bl2PeriodoId);}
  function keyOf(row){var c=cedulaOf(row),p=periodOf(row);return c&&p?c+"__"+p:"";}
  function number(value){if(value===null||value===undefined||text(value)===""){return null;}var result=Number(text(value).replace(",","."));return Number.isFinite(result)?result:null;}
  function first(row,names){row=row||{};for(var i=0;i<names.length;i+=1){if(Object.prototype.hasOwnProperty.call(row,names[i])&&text(row[names[i]])!==""){return row[names[i]];}}return "";}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}

  function normalizeNote(input){
    var row=Object.assign({},input||{});
    var nested=row._bdlNotas&&typeof row._bdlNotas==="object"?row._bdlNotas:(row.notas&&typeof row.notas==="object"?row.notas:{});
    var source=Object.assign({},nested,row);
    var nart=number(first(source,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var ndef=number(first(source,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var storedFinal=number(first(source,["Notafinal","NotaFinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","_nfin"]));
    var nfin=storedFinal;
    if(nfin===null&&nart!==null&&ndef!==null&&nart>=7){
      nfin=Math.round(((nart*0.70)+(ndef*0.30))*100)/100;
    }
    return Object.assign({},row,{
      cedula:cedulaOf(row),
      periodoId:periodOf(row),
      Notart:nart,Nart:nart,nart:nart,notaArticulo:nart,
      Notdef:ndef,Ndef:ndef,ndef:ndef,notaDefensa:ndef,
      Notafinal:nfin,NotaFinal:nfin,Nfin:nfin,nfin:nfin,notaFinal:nfin,
      _bdlNotas:{
        nart:nart,
        ndef:ndef,
        nfin:nfin,
        nfinCalculado:nfin,
        nfinGuardado:storedFinal,
        completo:nfin!==null
      }
    });
  }

  function rebuildIndexes(rows,periodoId){
    state.currentPeriod=period(periodoId||"");
    state.notes=(Array.isArray(rows)?rows:[])
      .map(normalizeNote)
      .filter(function(note){
        return !state.currentPeriod||periodOf(note)===state.currentPeriod;
      });

    state.byKey=Object.create(null);
    state.byCedula=Object.create(null);

    state.notes.forEach(function(note){
      var key=keyOf(note);
      var id=cedulaOf(note);
      if(key){state.byKey[key]=note;}
      if(id){
        if(!state.byCedula[id]){state.byCedula[id]=[];}
        state.byCedula[id].push(note);
      }
    });

    return state.notes;
  }

  function clear(periodoId){
    state.requestSeq+=1;
    state.loading=null;
    state.loadingPeriod="";
    state.error="";
    state.loadedAt="";
    state.phase=periodoId?"loading":"idle";
    return rebuildIndexes([],periodoId||"");
  }

  function notifyView(ok,periodoId,error){
    periodoId=period(periodoId||selectedPeriod());
    if(selectedPeriod()!==periodoId){return;}

    try{
      if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){
        window.StatsCore.invalidate({keepPeriods:true,reason:ok?"notes-loaded":"notes-error"});
      }

      if(window.StatsApp&&typeof window.StatsApp.render==="function"){
        window.StatsApp.render({force:false,reason:ok?"notes-loaded":"notes-error"});
      }
    }catch(innerError){}

    emit("stats:notes-loaded",{
      ok:ok!==false,
      periodoId:periodoId,
      total:state.notes.length,
      error:error?text(error.message||error):"",
      phase:state.phase,
      at:new Date().toISOString()
    });
  }

  function loadPeriod(periodoId,force){
    periodoId=period(periodoId||selectedPeriod());

    if(!periodoId){
      clear("");
      return Promise.resolve([]);
    }

    if(
      !force &&
      state.currentPeriod===periodoId &&
      state.phase==="ready" &&
      state.loadedAt
    ){
      return Promise.resolve(state.notes);
    }

    if(state.loading&&state.loadingPeriod===periodoId&&!force){
      return state.loading;
    }

    var current=api();
    if(!current||typeof current.listNotes!=="function"){
      state.currentPeriod=periodoId;
      state.error="ConStats.listNotes no está disponible.";
      state.phase="error";
      notifyView(false,periodoId,state.error);
      return Promise.resolve([]);
    }

    var seq=++state.requestSeq;
    var previousPeriod=state.currentPeriod;

    if(previousPeriod!==periodoId){
      rebuildIndexes([],periodoId);
      state.loadedAt="";
    }

    state.loadingPeriod=periodoId;
    state.error="";
    state.phase="loading";

    state.loading=Promise.resolve(
      current.listNotes({periodoId:periodoId,periodId:periodoId})
    ).then(function(rows){
      if(seq!==state.requestSeq){return state.notes;}

      rebuildIndexes(rows,periodoId);
      state.error="";
      state.loadedAt=new Date().toISOString();
      state.phase="ready";
      notifyView(true,periodoId,null);
      return state.notes;
    }).catch(function(error){
      if(seq!==state.requestSeq){return state.notes;}

      state.currentPeriod=periodoId;
      state.error=error&&error.message?error.message:String(error);
      state.phase="error";
      notifyView(false,periodoId,error);
      return state.notes;
    }).finally(function(){
      if(seq===state.requestSeq){
        state.loading=null;
        state.loadingPeriod="";
      }
    });

    return state.loading;
  }

  function noteFor(row){
    var key=keyOf(row);
    if(key&&state.byKey[key]){return state.byKey[key];}

    var id=cedulaOf(row);
    var list=id&&state.byCedula[id]?state.byCedula[id]:[];
    var p=periodOf(row);

    if(p){
      return list.filter(function(note){return periodOf(note)===p;})[0]||null;
    }

    return list.length===1?list[0]:null;
  }

  function hydrate(row){
    var copy=Object.assign({},row||{});
    var note=noteFor(row);

    copy._telegramUser=text(copy._telegramUser||copy.telegramUser||copy.usuarioTelegram||copy.telegram);
    copy._telegramChatId=text(copy._telegramChatId||copy.telegramChatId||copy.chatIdTelegram||copy.chatId);
    copy._hasTelegram=!!(copy._telegramUser||copy._telegramChatId);

    if(!note){return copy;}

    [
      "Notart","Nart","nart","notaArticulo",
      "Notdef","Ndef","ndef","notaDefensa",
      "Notafinal","NotaFinal","Nfin","nfin","notaFinal"
    ].forEach(function(name){
      copy[name]=note[name];
    });

    copy._bdlNotas=Object.assign({},note._bdlNotas||{});
    copy._bdlNotaRegistro=Object.assign({},note);
    return copy;
  }

  function hydrateRows(rows){
    return (Array.isArray(rows)?rows:[]).map(hydrate);
  }

  function mapResult(result){
    if(Array.isArray(result)){return hydrateRows(result);}
    result=result&&typeof result==="object"?result:{};
    var rows=hydrateRows(result.rows||result.estudiantes||result.students||[]);
    return Object.assign({},result,{
      rows:rows,
      estudiantes:rows,
      students:rows,
      total:rows.length
    });
  }

  function maybe(value,mapper){
    return value&&typeof value.then==="function"
      ?value.then(mapper)
      :mapper(value);
  }

  function wrap(apiObject,name,mapper){
    var original=apiObject&&apiObject[name];
    if(typeof original!=="function"||original.__statsConnectorPatch){return;}

    var wrapped=function(){
      return maybe(original.apply(apiObject,arguments),mapper);
    };

    wrapped.__statsConnectorPatch=true;
    wrapped.__original=original;
    apiObject[name]=wrapped;
  }

  function requestSelectedPeriod(force){
    var periodoId=selectedPeriod();

    if(!periodoId){
      clear("");
      return Promise.resolve([]);
    }

    return loadPeriod(periodoId,force===true);
  }

  function signalPeriods(detail){
    detail=detail||{};
    var list=Array.isArray(detail.periods)?detail.periods:[];
    if(!list.length&&detail.periodoId){list=[detail.periodoId];}
    if(!list.length&&detail.periodId){list=[detail.periodId];}
    return list.map(period).filter(Boolean);
  }

  function scheduleReload(detail){
    var current=selectedPeriod();
    if(!current){return;}

    var periods=signalPeriods(detail);
    if(periods.length&&periods.indexOf(current)<0){return;}

    state.lastSignalAt=new Date().toISOString();

    if(state.reloadTimer){
      window.clearTimeout(state.reloadTimer);
    }

    state.reloadTimer=window.setTimeout(function(){
      state.reloadTimer=null;
      requestSelectedPeriod(true);
    },80);
  }

  function bindEvent(target,name){
    if(!target||typeof target.addEventListener!=="function"){return;}
    target.addEventListener(name,function(event){
      scheduleReload(event&&event.detail||{});
    });
  }

  function bind(){
    if(state.bound){return;}
    state.bound=true;

    var periodNode=document.getElementById("stats-periodo");
    if(periodNode){
      periodNode.addEventListener("change",function(){
        requestSelectedPeriod(false);
      });
    }

    [
      "bdlocal:notas-updated",
      "bdlocal:defart-notas-saved",
      "bdlocal:defart-saved",
      "bdlocal:crdef-grade-saved",
      "bdlocal:ncomplex-saved"
    ].forEach(function(name){
      bindEvent(window,name);

      try{
        if(window.top&&window.top!==window){
          bindEvent(window.top,name);
        }
      }catch(error){}
    });

    window.addEventListener("storage",function(event){
      if(event&&event.key===SIGNAL_KEY){
        var detail={};
        try{detail=JSON.parse(event.newValue||"{}")||{};}catch(error){}
        scheduleReload(detail);
      }
    });

    window.addEventListener("stats:cache-invalidated",function(event){
      var reason=text(event&&event.detail&&event.detail.reason||"");
      if(reason==="refresh-button"||reason==="manual-refresh"){
        requestSelectedPeriod(true);
      }
    });

    window.addEventListener("requisitos:periodo-global-cambiado",function(){
      window.setTimeout(function(){
        requestSelectedPeriod(false);
      },0);
    });

    window.addEventListener("stats:bootstrap-ready",function(){
      requestSelectedPeriod(false);
    });
  }

  function install(){
    var current=api();
    if(!current){return false;}

    if(current.__statsConnectorDataPatch){
      state.installed=true;
      bind();
      return true;
    }

    ["students","getStudents","rows","getRows"].forEach(function(name){
      wrap(current,name,hydrateRows);
    });

    wrap(current,"listStudents",mapResult);

    current.__statsConnectorDataPatch=true;
    state.installed=true;
    bind();
    return true;
  }

  function ready(){
    if(!install()){
      return Promise.reject(new Error("ConStats no está disponible."));
    }

    if(selectedPeriod()){
      return requestSelectedPeriod(false).then(function(){
        return status();
      });
    }

    return Promise.resolve(status());
  }

  function status(){
    return {
      ok:state.phase!=="error",
      version:VERSION,
      source:"ConStats",
      installed:state.installed,
      deferred:true,
      phase:state.phase,
      currentPeriod:state.currentPeriod,
      loadingPeriod:state.loadingPeriod,
      notes:state.notes.length,
      loadedAt:state.loadedAt,
      lastSignalAt:state.lastSignalAt,
      error:state.error
    };
  }

  window.StatsDataPatch={
    version:VERSION,
    install:install,
    ready:ready,
    loadPeriod:loadPeriod,
    reload:function(){return requestSelectedPeriod(true);},
    hydrateStudent:hydrate,
    status:status,
    signalKey:SIGNAL_KEY
  };
})(window,document);
