/* =========================================================
Nombre completo: ncomplex.firebase-sync.js
Ruta: /Ncomplex/ncomplex.firebase-sync.js
Función:
- Analizar las diferencias de Ncomplex para el período seleccionado.
- Subir solamente notas y sus registros auxiliares de auditoría/importación.
- Exigir un análisis vigente antes de enviar.
- Mantener estudiantes, matrículas, requisitos y Telegram fuera de esta operación.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-ncomplex-firebase";
  var analysis=null;
  var running=false;
  var periodAligned=false;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}
  function periodId(){return text(byId("ncomplex-filter-periodo")&&byId("ncomplex-filter-periodo").value);}
  function globalPeriod(){
    var api=window.BDLPeriodoGlobal||window.RequisitosPeriodoGlobal||null;
    try{
      var value=api&&typeof api.get==="function"
        ?api.get()
        :api&&typeof api.status==="function"?(api.status()||{}).period:null;
      return text(value&&(value.id||value.periodoId||value.value));
    }catch(error){return "";}
  }
  function alignPeriod(attempt){
    attempt=Number(attempt||0);
    if(periodAligned){return true;}
    var select=byId("ncomplex-filter-periodo");
    var wanted=globalPeriod();
    if(select&&wanted&&select.options&&select.options.length>1){
      var exists=Array.prototype.some.call(select.options,function(option){
        return text(option.value)===wanted;
      });
      if(exists){
        if(!text(select.value)){
          select.value=wanted;
          select.dispatchEvent(new Event("change",{bubbles:true}));
        }
        periodAligned=text(select.value)===wanted;
        if(periodAligned){clear();return true;}
      }
    }
    if(attempt<160){window.setTimeout(function(){alignPeriod(attempt+1);},60);}
    return false;
  }
  function setNumber(id,value){
    var node=byId(id);
    if(node){node.textContent=String(Number(value||0));}
  }
  function status(message,type){
    var node=byId("ncomplex-firebase-status");
    if(node){
      node.textContent=text(message);
      node.className="ncomplex-firebase-status "+(type||"");
    }
  }
  function setButtons(){
    var analyzeButton=byId("ncomplex-btn-firebase-analyze");
    var pushButton=byId("ncomplex-btn-firebase-push");
    if(analyzeButton){analyzeButton.disabled=running||!periodId();}
    if(pushButton){
      pushButton.disabled=running||!periodId()||!analysis||
        Number(analysis.batchChanges||0)===0||
        Number(analysis.conflictos||0)>0;
    }
  }
  function clear(){
    analysis=null;
    ["Pending","New","Modified","Unchanged","Conflicts"].forEach(function(name){
      setNumber("ncomplexFirebase"+name,0);
    });
    status(
      periodId()?"Analice las diferencias de Ncomplex.":"Seleccione un período.",
      periodId()?"is-warn":""
    );
    setButtons();
  }
  function ensure(){
    var api=center();
    if(!api){return Promise.reject(new Error("El Centro de Operaciones Firebase no está disponible."));}
    return Promise.resolve(typeof api.ensure==="function"?api.ensure():api).then(function(){return api;});
  }
  function render(result){
    analysis=result&&result.ok?result:null;
    setNumber("ncomplexFirebasePending",result&&result.pendingChanges);
    setNumber("ncomplexFirebaseNew",result&&result.nuevos);
    setNumber("ncomplexFirebaseModified",result&&result.modificados);
    setNumber("ncomplexFirebaseUnchanged",result&&result.sinCambios);
    setNumber("ncomplexFirebaseConflicts",result&&result.conflictos);

    if(!result||result.ok===false){
      status(result&&result.message||"No se pudo analizar Firebase.","is-danger");
    }else if(Number(result.conflictos||0)>0){
      status("Hay conflictos en Ncomplex. Revise antes de subir.","is-danger");
    }else if(Number(result.batchChanges||0)===0){
      status("Ncomplex está actualizado en Firebase.","is-ok");
    }else{
      status("Análisis listo: "+Number(result.differences||0)+" diferencia(s).","is-ok");
    }
    running=false;
    setButtons();
  }
  function analyze(){
    if(running||!periodId()){return;}
    running=true;
    setButtons();
    status("Comparando Ncomplex con Firebase...","is-warn");
    ensure()
      .then(function(api){
        return api.analyze("ncomplex",{
          periodoId:periodId(),
          source:"Ncomplex.firebase.analyze"
        });
      })
      .then(render)
      .catch(function(error){
        render({ok:false,message:error&&error.message?error.message:String(error)});
      });
  }
  function push(){
    if(running||!analysis||!periodId()){return;}
    if(!window.confirm(
      "Se subirán las calificaciones de Ncomplex del lote analizado y sus registros de auditoría/importación.\n\n"+
      "No se modificarán estudiantes, matrículas, requisitos ni Telegram. ¿Continuar?"
    )){return;}

    running=true;
    setButtons();
    status("Subiendo Ncomplex a Firebase...","is-warn");
    ensure()
      .then(function(api){
        return api.push("ncomplex",{
          periodoId:periodId(),
          requireAnalysis:true,
          source:"Ncomplex.firebase.push"
        });
      })
      .then(function(result){
        if(!result||result.ok===false){
          analysis=null;
          running=false;
          status(result&&result.message||"No se pudo subir Ncomplex.","is-danger");
          setButtons();
          return null;
        }
        status("Ncomplex procesado: "+Number(result.confirmedChanges||0)+" cambio(s).","is-ok");
        analysis=null;
        return center().analyze("ncomplex",{
          periodoId:periodId(),
          source:"Ncomplex.firebase.afterPush"
        }).then(render);
      })
      .catch(function(error){
        analysis=null;
        running=false;
        status(error&&error.message?error.message:String(error),"is-danger");
        setButtons();
      });
  }
  function bind(){
    var period=byId("ncomplex-filter-periodo");
    var analyzeButton=byId("ncomplex-btn-firebase-analyze");
    var pushButton=byId("ncomplex-btn-firebase-push");

    if(period&&!period.__ncomplexFirebaseBound){
      period.__ncomplexFirebaseBound=true;
      period.addEventListener("change",function(){
        periodAligned=true;
        clear();
      });
    }
    if(analyzeButton&&!analyzeButton.__ncomplexFirebaseBound){
      analyzeButton.__ncomplexFirebaseBound=true;
      analyzeButton.addEventListener("click",analyze);
    }
    if(pushButton&&!pushButton.__ncomplexFirebaseBound){
      pushButton.__ncomplexFirebaseBound=true;
      pushButton.addEventListener("click",push);
    }

    ["bdlocal:ncomplex-saved","bdlocal:evaluaciones-titulacion-updated","bdlocal:importaciones-updated"]
      .forEach(function(name){
        window.addEventListener(name,function(){
          analysis=null;
          status("Los datos locales cambiaron. Analice nuevamente.","is-warn");
          setButtons();
        });
      });

    window.addEventListener("ncomplex:bootstrap-ready",function(){
      periodAligned=false;
      alignPeriod(0);
    });
    clear();
    alignPeriod(0);
  }

  window.NcomplexFirebaseSync={
    version:VERSION,
    analyze:analyze,
    push:push,
    render:render,
    alignPeriod:alignPeriod,
    isRunning:function(){return running;}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})(window,document);
