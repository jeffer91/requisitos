/* =========================================================
Nombre completo: ficha.modalidad-ui.js
Ruta o ubicación: /Ficha/ficha.modalidad-ui.js
Función o funciones:
- Reemplazar el listener antiguo del botón Guardar modalidad.
- Esperar la promesa de FichaModalidad.save.
- Mostrar éxito únicamente después de la confirmación de ConFicha.
- Mantener PVC bloqueado en Artículo Académico.
Con qué se conecta:
- ficha.app.js
- ficha.modalidad.js
- ../BDLocal/conexiones/cone.ficha.js
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-confirmed-save";
  var saving=false;
  var button=null;

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
    if(current.locked){
      select.value=window.FichaModalidad.VALUES.articulo;
      setInfo("PVC · Artículo Académico · automático",true);
      return Promise.resolve({ok:true,value:select.value,locked:true,unchanged:true});
    }

    saving=true;
    button=button||replaceLegacyButton();
    if(button){button.disabled=true;button.textContent="Guardando...";}
    select.disabled=true;
    setInfo("Guardando modalidad...",false);
    setStatus("Guardando modalidad mediante ConFicha...","");

    return Promise.resolve(window.FichaModalidad.save(row,select.value)).then(function(result){
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
      var latest=selectedRow();
      var info=latest&&window.FichaModalidad?window.FichaModalidad.current(latest):null;
      if(button){
        button.disabled=!!(info&&info.locked);
        button.textContent=info&&info.locked?"Modalidad fija":"Guardar modalidad";
      }
      if(select){select.disabled=!!(info&&info.locked);}
    });
  }

  function bind(){
    button=replaceLegacyButton();
    if(button&&!button.getAttribute("data-ficha-modalidad-bound")){
      button.setAttribute("data-ficha-modalidad-bound","1");
      button.addEventListener("click",function(){save().catch(function(){});});
    }
  }

  window.FichaModalidadUI={version:VERSION,bind:bind,save:save,selectedRow:selectedRow};

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
})(window,document);