/* =========================================================
Nombre completo: ficha.matricula.js
Ruta o ubicación: /Ficha/ficha.matricula.js
Función o funciones:
- Mostrar el estado de matrícula del estudiante seleccionado.
- Permitir cambiar únicamente entre ACTIVO y RETIRADO.
- Guardar el cambio exclusivamente mediante ConFicha.updateEnrollmentStatus.
- Esperar la confirmación del conector antes de mostrar éxito.
Con qué se conecta:
- ficha.html
- ficha.app.js
- ../BDLocal/conexiones/cone.ficha.js
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-conficha";
  var saving=false;
  var observer=null;

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function connector(){return window.ConFicha||window.BDLocalFicha||null;}

  function appState(){
    try{
      return window.FichaApp&&typeof window.FichaApp.getState==="function"
        ? window.FichaApp.getState()||{}
        : {};
    }catch(error){return {};}
  }

  function rowId(row){
    row=row||{};
    return text(row.idEstudiantePeriodo||row.studentId||row.id||row._id||row._cedula||row.cedula||row.numeroIdentificacion);
  }

  function periodId(row){
    row=row||{};
    return text(row._periodoId||row.periodoId||row.periodId||row.ultimoPeriodoId||row.periodoCanonicoId||row._periodo||row.periodoLabel);
  }

  function selectedRow(){
    var state=appState();
    if(state.selectedDetail){return state.selectedDetail;}
    var wanted=text(state.selectedId);
    return (state.rows||[]).filter(function(row){
      return rowId(row)===wanted||text(row&&row._cedula)===wanted;
    })[0]||null;
  }

  function normalizeStatus(value){
    var con=connector();
    if(con&&typeof con.normalizeEnrollmentStatus==="function"){
      return con.normalizeEnrollmentStatus(value);
    }
    value=text(value).toUpperCase();
    return value==="RETIRADO"?"RETIRADO":"ACTIVO";
  }

  function statusOf(row){
    row=row||{};
    return normalizeStatus(
      row._estadoMatricula||
      row.estadoMatricula||
      row.EstadoMatricula||
      row._bl2EstadoMatricula||
      (row._raw&&(row._raw.estadoMatricula||row._raw.EstadoMatricula))||
      "ACTIVO"
    );
  }

  function setGlobalStatus(message,cls){
    var node=el("ficha-status");
    if(node){node.textContent=message;node.className="ficha-status "+(cls||"");}
  }

  function setInfo(message,locked){
    var node=el("ficha-matricula-info");
    if(!node){return;}
    node.textContent=message||"—";
    node.className="ficha-modalidad-info"+(locked?" locked":"");
  }

  function patchRow(row,status){
    if(!row){return;}
    row._estadoMatricula=status;
    row.estadoMatricula=status;
    row.retirado=status==="RETIRADO";
    if(row._raw&&typeof row._raw==="object"){
      row._raw._estadoMatricula=status;
      row._raw.estadoMatricula=status;
      row._raw.retirado=status==="RETIRADO";
    }
  }

  function render(){
    var row=selectedRow();
    var select=el("ficha-matricula-edit");
    var button=el("ficha-matricula-save");

    if(!select||!button){return;}

    if(!row){
      select.value="ACTIVO";
      select.disabled=true;
      button.disabled=true;
      setInfo("Selecciona un estudiante.",true);
      return;
    }

    var current=statusOf(row);
    if(!saving){select.value=current;}
    select.disabled=saving;
    button.disabled=saving;
    button.textContent=saving?"Guardando...":"Guardar estado";

    if(!saving){setInfo("Estado actual: "+current,false);}
  }

  function save(){
    if(saving){return Promise.resolve(null);}

    var row=selectedRow();
    var select=el("ficha-matricula-edit");
    var con=connector();

    if(!row||!select){
      setInfo("Selecciona un estudiante.",true);
      return Promise.resolve(null);
    }
    if(!con||typeof con.updateEnrollmentStatus!=="function"){
      var missing=new Error("ConFicha.updateEnrollmentStatus no está disponible.");
      setInfo(missing.message,true);
      return Promise.reject(missing);
    }

    var id=rowId(row);
    var next=normalizeStatus(select.value);
    var previous=statusOf(row);

    if(!id){
      var noId=new Error("No se pudo identificar al estudiante seleccionado.");
      setInfo(noId.message,true);
      return Promise.reject(noId);
    }

    if(next===previous){
      setInfo("El estudiante ya está "+next+".",false);
      return Promise.resolve({ok:true,status:next,unchanged:true});
    }

    saving=true;
    render();
    setInfo("Guardando "+next+"...",false);
    setGlobalStatus("Guardando estado de matrícula mediante ConFicha...","");

    return Promise.resolve(con.updateEnrollmentStatus(id,next,{
      periodoId:periodId(row),
      periodId:periodId(row),
      cedula:row._cedula||row.cedula||row.numeroIdentificacion||"",
      source:"ficha.matricula"
    })).then(function(result){
      if(!result||result.ok!==true){throw new Error("ConFicha no confirmó el cambio de estado.");}

      patchRow(row,result.status||next);
      setInfo("Guardado: "+(result.status||next)+".",false);
      setGlobalStatus("Estado de matrícula guardado correctamente: "+(result.status||next)+".","ok");

      try{
        if(window.FichaCore&&typeof window.FichaCore.invalidate==="function"){window.FichaCore.invalidate();}
        if(window.FichaApp&&typeof window.FichaApp.render==="function"){window.FichaApp.render("bdlocal-refresh");}
      }catch(error){}

      return result;
    }).catch(function(error){
      select.value=previous;
      setInfo(error&&error.message?error.message:String(error),true);
      setGlobalStatus("No se pudo guardar el estado: "+(error&&error.message?error.message:String(error)),"warn");
      throw error;
    }).finally(function(){
      saving=false;
      render();
    });
  }

  function bind(){
    var button=el("ficha-matricula-save");
    if(button&&!button.getAttribute("data-ficha-matricula-bound")){
      button.setAttribute("data-ficha-matricula-bound","1");
      button.addEventListener("click",function(){save().catch(function(){});});
    }

    var watched=el("ficha-matricula-label")||el("ficha-detail");
    if(watched&&typeof MutationObserver==="function"&&!observer){
      observer=new MutationObserver(function(){render();});
      observer.observe(watched,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    }

    [
      "ficha:connection-ready",
      "ficha:student-saved",
      "ficha:enrollment-status-saved",
      "bdlocal:screen-data-updated"
    ].forEach(function(name){window.addEventListener(name,render);});

    render();
  }

  window.FichaMatricula={
    version:VERSION,
    render:render,
    save:save,
    selectedRow:selectedRow,
    statusOf:statusOf
  };

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
})(window,document);