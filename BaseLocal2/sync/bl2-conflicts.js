(function(window){
  "use strict";
  function tx(v){return String(v==null?"":v).trim();}
  function tm(v){var n=Date.parse(tx(v));return Number.isFinite(n)?n:0;}
  function clone(v){try{return JSON.parse(JSON.stringify(v==null?null:v));}catch(e){return v;}}
  function rowId(row,entity){row=row||{};if(entity==="periodo")return tx(row.id||row.periodoId||row.label||row.periodoLabel);return tx(row.cedula||row.numeroIdentificacion||row.Cedula||row.docId||row._docId||row.id);}
  function rowTime(row){row=row||{};return tm(row.updatedAt||row.ultimaSincronizacion||row.actualizadoEn||row.createdAt||row.creadoEn||"");}
  function newer(local,remote){var l=rowTime(local),r=rowTime(remote);if(l===r)return "same";return l>r?"local":"remote";}
  function mergeRows(localRows,remoteRows,entity){var map={};(remoteRows||[]).forEach(function(r){var id=rowId(r,entity);if(id)map[id]=clone(r);});(localRows||[]).forEach(function(l){var id=rowId(l,entity);if(!id)return;var r=map[id];if(!r||newer(l,r)==="local")map[id]=clone(l);});return Object.keys(map).map(function(k){return map[k];});}
  function mergeSnapshots(local,remote){local=local||{};remote=remote||{};return {meta:Object.assign({},remote.meta||{},local.meta||{},{updatedAt:new Date().toISOString(),source:"bl2_conflict_merge"}),periods:mergeRows(local.periods||[],remote.periods||[],"periodo"),students:mergeRows(local.students||[],remote.students||[],"estudiante"),history:(local.history||[]).concat(remote.history||[]),diagnostics:(local.diagnostics||[]).concat(remote.diagnostics||[])};}
  function detect(local,remote,entity){var out=[];var rm={};(remote||[]).forEach(function(r){var id=rowId(r,entity);if(id)rm[id]=r;});(local||[]).forEach(function(l){var id=rowId(l,entity),r=rm[id];if(id&&r&&rowTime(l)&&rowTime(r)&&rowTime(l)!==rowTime(r))out.push({entity:entity,entityId:id,winner:newer(l,r),localUpdatedAt:l.updatedAt||l.ultimaSincronizacion||"",remoteUpdatedAt:r.updatedAt||r.ultimaSincronizacion||""});});return out;}
  function status(){return {ok:true,mode:"conflicts",updatedAt:new Date().toISOString()};}
  window.BL2Conflicts={version:"2.0.0-alpha.1",rowId:rowId,rowTime:rowTime,newer:newer,mergeRows:mergeRows,mergeSnapshots:mergeSnapshots,detect:detect,status:status};
})(window);
