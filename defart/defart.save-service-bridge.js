/* =========================================================
Nombre completo: defart.save-service-bridge.js
Ruta o ubicación: /defart/defart.save-service-bridge.js
Función o funciones:
- Guardar notas exclusivamente mediante ConDefart.
- Evitar acceso directo desde la pantalla a servicios o repositorios de BDLocal.
- Mantener el guardado legacy únicamente como respaldo final.
========================================================= */
(function(window){
  "use strict";

  var VERSION="0.3.0-condefart-only";
  var previousSave=null;

  function text(value){return String(value==null?"":value).trim();}
  function num(value){
    var raw=text(value).replace(",",".");
    if(!raw){return null;}
    var number=Number(raw);
    return Number.isFinite(number)?Math.max(0,Math.min(10,Math.round(number*100)/100)):null;
  }
  function nfin(article,defense){
    article=num(article);
    defense=num(defense);
    if(article==null||defense==null||article<7){return null;}
    return Math.round(((article*0.70)+(defense*0.30))*100)/100;
  }
  function connector(){return window.ConDefart||window.BDLocalConeDefart||null;}

  function stateRows(){
    try{
      var state=window.DefartApp&&window.DefartApp.getState?window.DefartApp.getState():{};
      var data=state.data||{};
      return Array.isArray(data.exportRows)&&data.exportRows.length?data.exportRows:(Array.isArray(data.rows)?data.rows:[]);
    }catch(error){return [];}
  }

  function rowId(row){return text(row&&(row._defId||row.idEstudiantePeriodo||row.studentId||row._docId||row.id||row.cedula));}
  function findRow(change){
    var id=text(change&&change.id);
    return stateRows().find(function(row){return rowId(row)===id;})||null;
  }

  function splitCanonicalId(id){
    id=text(id);
    if(id.indexOf("__")<0){return {periodoId:"",cedula:""};}
    var parts=id.split("__");
    var first=text(parts[0]);
    var rest=text(parts.slice(1).join("__"));
    if(/^\d{9,10}$/.test(first)){return {cedula:first,periodoId:rest};}
    if(/^\d{9,10}$/.test(rest)){return {periodoId:first,cedula:rest};}
    return {periodoId:"",cedula:""};
  }

  function notaFromChange(change){
    change=change||{};
    var row=findRow(change)||{};
    var id=text(row.idEstudiantePeriodo||row.studentId||row._docId||row._defId||change.id);
    var parts=splitCanonicalId(id);
    var periodoId=text(row._periodoId||row.periodoId||row.periodId||parts.periodoId);
    var cedula=text(row._cedula||row.cedula||row.numeroIdentificacion||parts.cedula);
    var article=Object.prototype.hasOwnProperty.call(change,"nart")?num(change.nart):num(row._nart||row.Notart||row.notart);
    var defense=Object.prototype.hasOwnProperty.call(change,"ndef")?num(change.ndef):num(row._ndef||row.Notdef||row.notdef);
    var finalGrade=nfin(article,defense);
    return {
      idEstudiantePeriodo:id,studentId:id,periodoId:periodoId,periodId:periodoId,
      cedula:cedula,numeroIdentificacion:cedula,
      Notart:article,Notdef:defense,Notafinal:finalGrade,
      Nart:article,Ndef:defense,Nfinal:finalGrade,
      notart:article,notdef:defense,notafinal:finalGrade,
      estadoNota:finalGrade==null?"PENDIENTE":(finalGrade>=7?"APROBADO":"NO_APROBADO"),
      origen:"defart",updatedAt:new Date().toISOString()
    };
  }

  function saveDirect(changesList){
    changesList=Array.isArray(changesList)?changesList:[];
    if(!changesList.length){return Promise.resolve({ok:true,saved:0,total:0,errors:[],message:"No hay cambios pendientes."});}
    var current=connector();
    if(!current||typeof current.save!=="function"){
      return Promise.reject(new Error("ConDefart.save no está disponible."));
    }

    var notes=changesList.map(notaFromChange).filter(function(note){
      return note.idEstudiantePeriodo&&note.periodoId&&note.cedula;
    });
    if(!notes.length){return Promise.reject(new Error("No se pudieron construir notas completas."));}

    var saved=0;
    var errors=[];
    var chain=Promise.resolve();
    notes.forEach(function(note){
      chain=chain.then(function(){
        return current.save(note,{enqueue:true,source:"defart",origen:"defart"})
          .then(function(){saved+=1;})
          .catch(function(error){errors.push(error&&error.message?error.message:String(error));});
      });
    });

    return chain.then(function(){
      var result={
        ok:errors.length===0,saved:saved,total:changesList.length,errors:errors,
        direct:true,source:"ConDefart",message:saved+" cambio(s) guardado(s) mediante ConDefart."
      };
      try{window.dispatchEvent(new CustomEvent("bdlocal:defart-notas-saved",{detail:result}));}catch(error){}
      try{
        if(window.DefartServiceBridge&&typeof window.DefartServiceBridge.refresh==="function"){
          window.DefartServiceBridge.refresh();
        }
      }catch(error2){}
      return result;
    });
  }

  function install(){
    if(!window.DefartCore||typeof window.DefartCore.saveNotes!=="function"){return false;}
    if(window.DefartCore.__saveServiceBridge){return true;}
    previousSave=window.DefartCore.saveNotes;
    window.DefartCore.saveNotes=function(changesList){
      return saveDirect(changesList).then(function(result){
        if(result.ok||result.saved>0){return result;}
        throw new Error(result.errors&&result.errors.join(" | ")||"Guardado por ConDefart incompleto.");
      }).catch(function(error){
        try{console.warn("[DefartSaveServiceBridge] respaldo legacy",error);}catch(innerError){}
        return previousSave.call(window.DefartCore,changesList);
      });
    };
    window.DefartCore.__saveServiceBridge=true;
    return true;
  }

  window.DefartSaveServiceBridge={
    version:VERSION,install:install,saveDirect:saveDirect,
    notaFromChange:notaFromChange,splitCanonicalId:splitCanonicalId
  };
  install();
})(window);