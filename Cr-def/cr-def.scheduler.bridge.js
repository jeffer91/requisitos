/* =========================================================
Nombre completo: cr-def.scheduler.bridge.js
Ruta: /Cr-def/cr-def.scheduler.bridge.js
Función:
- Generar solo las filas visibles sin olvidar la ocupación del resto.
- Bloquear generación con cache académica desactualizada.
- Persistir el borrador generado en BDLocal y mantener cache rápida.
========================================================= */
(function(window,document){
  "use strict";
  function $(selector){return document.querySelector(selector);}
  function txt(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function esc(value){return txt(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function setAlert(kind,title,message){var box=$("[data-cr-alerta-principal]");if(box){box.className="cr-alert cr-alert--"+(kind||"info");box.innerHTML="<strong>"+esc(title||"Aviso")+"</strong> "+esc(message||"");}}
  function app(){return window.CR_DEF_APP||null;}
  function state(){return app()&&app().state?app().state:null;}
  function rowMatches(row,st){st=st||{};var filtros=st.filtros||{},haystack=norm([row.aula,row.dia,row.hora,row.sede,row.cedula,row.nombre,row.carrera,row.notaArticulo,row.tribunal1,row.tribunal2,row.tribunal3,row.estado,(row.alertas||[]).join(" ")].join(" "));if(st.busqueda&&haystack.indexOf(norm(st.busqueda))===-1)return false;if(filtros.carrera&&norm(row.carrera)!==norm(filtros.carrera))return false;if(filtros.sede&&norm(row.sede)!==norm(filtros.sede))return false;if(filtros.estado){if(filtros.estado==="sin-cupo")return !txt(row.dia)||!txt(row.hora);return norm(row.estadoClave)===norm(filtros.estado);}return true;}
  function isGenerable(row){return row&&["apto","supletorio","sin-cupo","programado","conflicto"].indexOf(row.estadoClave)>=0;}
  function rowKey(row){return txt(row.id)||[row.periodoId,row.cedula,row.intento||1].map(txt).join("__");}
  function visibleRows(){var st=state();return st&&Array.isArray(st.rows)?st.rows.filter(function(row){return isGenerable(row)&&rowMatches(row,st);}):[];}
  function setButtonState(){var btn=$("[data-cr-generar]"),st=state();if(!btn)return;btn.disabled=!(st&&st.periodo&&!st.cacheStale&&visibleRows().length&&window.CR_DEF_SCHEDULER&&typeof window.CR_DEF_SCHEDULER.generar==="function");}
  function mergeRows(original,generated){var map={};generated.forEach(function(row){map[rowKey(row)]=row;});return original.map(function(row){return map[rowKey(row)]||row;});}
  function occupiedOutsideTarget(all,target){var keys={};target.forEach(function(row){keys[rowKey(row)]=true;});return all.filter(function(row){return !keys[rowKey(row)];});}
  function saveCache(rows){var st=state();if(!st||!st.periodo||!window.CR_DEF_CACHE||typeof window.CR_DEF_CACHE.savePeriodCache!=="function")return;window.CR_DEF_CACHE.savePeriodCache(st.periodo,{rows:rows,firma:st.firmaActual||null,source:"scheduler",resumen:{total:rows.length,programados:rows.filter(function(row){return row.estadoClave==="programado";}).length,sinCupo:rows.filter(function(row){return row.estadoClave==="sin-cupo";}).length,conflictos:rows.filter(function(row){return row.estadoClave==="conflicto";}).length}});}
  function persist(rows){return window.CR_DEF_DATA&&typeof window.CR_DEF_DATA.guardarCronograma==="function"?window.CR_DEF_DATA.guardarCronograma(rows):Promise.resolve([]);}
  function generar(){
    var st=state();if(!st||!Array.isArray(st.rows)||!window.CR_DEF_SCHEDULER)return;
    if(st.cacheStale){setAlert("warn","Actualización requerida.","BDLocal cambió. Actualiza los estudiantes aptos antes de generar.");return;}
    var target=visibleRows();if(!target.length){setAlert("warn","Sin estudiantes visibles.","No hay estudiantes aptos dentro de los filtros actuales.");return;}
    var diasGlobal=txt($("[data-cr-dias-globales]")&&$("[data-cr-dias-globales]").value),diasCarrera=txt($("[data-cr-dias-carrera]")&&$("[data-cr-dias-carrera]").value);
    var result=window.CR_DEF_SCHEDULER.generar(target,{diasGlobal:diasGlobal,diasCarrera:diasCarrera,existingRows:occupiedOutsideTarget(st.rows,target)});
    var merged=mergeRows(st.rows,result.rows||[]);if(typeof window.CR_DEF_SCHEDULER.detectarConflictos==="function")merged=window.CR_DEF_SCHEDULER.detectarConflictos(merged);
    st.rows=merged;if(app()&&typeof app().setRows==="function")app().setRows(merged);saveCache(merged);setButtonState();
    var r=result.resumen||{},message="Programadas: "+Number(r.programados||0)+" · Sin cupo: "+Number(r.sinCupo||0)+" · Conflictos: "+Number(r.conflictos||0)+".";
    setAlert(r.conflictos?"warn":"info","Cronograma generado.",message+" Guardando borrador...");
    persist(result.rows||[]).then(function(saved){setAlert(r.conflictos?"warn":"info","Cronograma generado y guardado.",message+" Registros persistidos: "+Number(saved&&saved.length||0)+".");}).catch(function(error){setAlert("warn","Cronograma generado, pero no se pudo persistir.",message+" "+(error&&error.message?error.message:String(error)));});
  }
  function bind(){var btn=$("[data-cr-generar]");if(btn&&!btn.__crSchedulerBound){btn.__crSchedulerBound=true;btn.addEventListener("click",generar);}window.setInterval(setButtonState,700);setButtonState();window.CR_DEF_SCHEDULER_BRIDGE={generar:generar,visibleRows:visibleRows,setButtonState:setButtonState};}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})(window,document);
