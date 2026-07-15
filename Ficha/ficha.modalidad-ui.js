/* =========================================================
Nombre completo: ficha.modalidad-ui.js
Ruta o ubicación: /Ficha/ficha.modalidad-ui.js
Función o funciones:
- Reemplazar el listener antiguo del botón Guardar modalidad.
- Esperar la promesa de FichaModalidad.save.
- Mostrar éxito únicamente después de la confirmación de ConFicha.
- Mantener PVC fijo en Artículo Académico y permitir confirmarlo una vez.
Con qué se conecta:
- ficha.app.js
- ficha.modalidad.js
- ../BDLocal/conexiones/cone.ficha.js
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-confirmed-pvc";
  var saving=false;
  var button=null;
  var observer=null;

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}

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

  function selectedRow(){
    var state=appState();
    if(state.selectedDetail){return state.selectedDetail;}
    var wanted=text(state.selectedId);
    return (state.rows||[]).filter(function(row){
      return rowId(row)===wanted||text(row&&row._cedula)===wanted;
    })[0]||null;
  }

  function setStatus(message,cls){
    var node=el("ficha-status");
    if(node){node.textContent=message;node.className="ficha-status "+(cls||"");}
  }

  function setInfo(message,locked){
    var node=el("ficha-modalidad-info");
    if(!node){return;}
    node.textContent=message||"—";
    node.className="ficha-modalidad-info"+(locked?" locked":"");
  }

  function replaceLegacyButton(){
    var current=el("ficha-modalidad-save");
    if(!current){return null;}
    if(current.getAttribute("data-ficha-modalidad-confirmed")==="1"){return current;}

    var clean=current.cloneNode(true);
    clean.setAttribute("data-ficha-modalidad-confirmed","1");
    current.parentNode.replaceChild(clean,current);
    return clean;
  }

  function refreshFicha(){
    try{
      if(window.FichaCore&&typeof window.FichaCore.invalidate==="function"){window.FichaCore.invalidate();}
      if(window.FichaApp&&typeof window.FichaApp.render==="function"){window.FichaApp.render("modalidad");}
    }catch(error){}
  }

  function syncControls(){
    if(saving){return;}
    var row=selectedRow();
    var select=el("ficha-modalidad-select");
    button=button||replaceLegacyButton();

    if(!row||!select||!button||!window.FichaModalidad){return;}

    var info=window.FichaModalidad.current(row);
    if(info.locked){
      select.value=window.FichaModalidad.VALUES.articulo;
      select.disabled=true;
      button.disabled=info.source==="guardado";
      button.textContent=info.source==="guardado"?"Artículo guardado":"Guardar artículo";
    }else{
      select.disabled=false;
      button.disabled=false;
      button.textContent="Guardar modalidad";
    }
  }

  function save(){
    if(saving){return Promise.resolve(null);}

    var row=selectedRow();
    var select=el("ficha-modalidad-select");

    if(!row||!select){
      setInfo("Selecciona un estudiante.",true);
      return Promise.resolve(null);
    }
    if(!window.FichaModalidad||typeof window.FichaModalidad.save!=="function"){
      var missing=new Error("FichaModalidad no está disponible.");
      setInfo(missing.message,true);
      return Promise.reject(missing);
    }

    var current=window.FichaModalidad.current(row);
    var selected=current.locked?window.FichaModalidad.VALUES.articulo:select.value;

    if(current.locked&&current.source==="guardado"){
      setInfo("PVC · Artículo Académico · guardado",true);
      return Promise.resolve({ok:true,value:selected,locked:true,unchanged:true});
    }

    saving=true;
    button=button||replaceLegacyButton();
    if(button){button.disabled=true;button.textContent="Guardando...";}
    select.disabled=true;
    setInfo(current.locked?"Guardando Artículo Académico...":"Guardando modalidad...",current.locked);
    setStatus("Guardando modalidad mediante ConFicha...","");

    return Promise.resolve(window.FichaModalidad.save(row,selected)).then(function(result){
      if(!result||result.ok!==true){throw new Error("No se recibió confirmación de la modalidad.");}

      select.value=result.value;
      setInfo((result.periodType&&result.periodType.label||"Regular")+" · "+result.label+" · guardado",!!result.locked);
      setStatus("Modalidad guardada correctamente: "+result.label+".","ok");
      refreshFicha();
      return result;
    }).catch(function(error){
      var message=error&&error.message?error.message:String(error);
      select.value=current.value;
      setInfo(message,true);
      setStatus("No se pudo guardar la modalidad: "+message,"warn");
      throw error;
    }).finally(function(){
      saving=false;
      syncControls();
    });
  }

  function bind(){
    button=replaceLegacyButton();
    if(button&&!button.getAttribute("data-ficha-modalidad-bound")){
      button.setAttribute("data-ficha-modalidad-bound","1");
      button.addEventListener("click",function(){save().catch(function(){});});
    }

    var watched=el("ficha-modalidad-info")||el("ficha-detail");
    if(watched&&typeof MutationObserver==="function"&&!observer){
      observer=new MutationObserver(function(){setTimeout(syncControls,0);});
      observer.observe(watched,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    }

    ["ficha:modalidad-saved","ficha:student-saved","ficha:connection-ready"].forEach(function(name){
      window.addEventListener(name,syncControls);
    });

    syncControls();
  }

  window.FichaModalidadUI={version:VERSION,bind:bind,save:save,selectedRow:selectedRow,syncControls:syncControls};

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
})(window,document);