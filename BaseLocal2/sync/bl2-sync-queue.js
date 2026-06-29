(function(window){
  "use strict";
  var Q="REQ_BL2_SYNC_QUEUE_V1",S="REQ_BL2_SYNC_STATE_V1";
  function tx(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function tm(v){var n=Date.parse(tx(v));return Number.isFinite(n)?n:0;}
  function cp(v){try{return JSON.parse(JSON.stringify(v==null?null:v));}catch(e){return v;}}
  function rj(k,f){try{var x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(e){return f;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}return v;}
  function read(){var q=rj(Q,[]);return Array.isArray(q)?q:[];}
  function write(q){return wj(Q,(Array.isArray(q)?q:[]).slice(-8000));}
  function state(){return rj(S,{lastPushAt:"",lastPullAt:"",lastSyncAt:"",pending:0});}
  function saveState(p){return wj(S,Object.assign({},state(),p||{},{updatedAt:now()}));}
  function rowId(row,ent){row=row||{};if(ent==="periodo")return tx(row.id||row.periodoId||row.label||row.periodoLabel);return tx(row.cedula||row.numeroIdentificacion||row.Cedula||row.docId||row._docId||row.id);}
  function pending(){return read().filter(function(x){return x.estado!=="done"&&x.estado!=="omitido";});}
  function enqueue(ch){ch=ch||{};var ent=tx(ch.entity),act=tx(ch.action||"upsert"),eid=tx(ch.entityId||rowId(ch.data,ent));if(!ent||!eid)return null;var q=read(),id=[ent,eid,act].join("::"),item={id:id,entity:ent,entityId:eid,action:act,data:cp(ch.data||{}),estado:"pendiente",attempts:0,createdAt:ch.createdAt||now(),updatedAt:now(),source:ch.source||"local"};var i=q.findIndex(function(x){return x.id===id;});if(i>=0)q[i]=Object.assign({},q[i],item,{attempts:q[i].attempts||0,createdAt:q[i].createdAt||item.createdAt});else q.push(item);write(q);saveState({pending:pending().length});return item;}
  function enqueueMany(list){var out=[];(Array.isArray(list)?list:[]).forEach(function(x){var it=enqueue(x);if(it)out.push(it);});return out;}
  function enqueueSnapshotChanges(snap,opt){opt=opt||{};snap=snap||{};var since=tm(opt.since||state().lastPushAt||""),changes=[];(snap.periods||[]).forEach(function(p){var id=rowId(p,"periodo"),u=tm(p.updatedAt||p.actualizadoEn||(snap.meta&&snap.meta.updatedAt)||"");if(id&&(!since||!u||u>=since))changes.push({entity:"periodo",entityId:id,action:"upsert",data:p,source:opt.source||"snapshot"});});(snap.students||[]).forEach(function(s){var id=rowId(s,"estudiante"),u=tm(s.updatedAt||s.ultimaSincronizacion||s.actualizadoEn||(snap.meta&&snap.meta.updatedAt)||"");if(id&&(!since||!u||u>=since))changes.push({entity:"estudiante",entityId:id,action:"upsert",data:s,source:opt.source||"snapshot"});});return enqueueMany(changes);}
  function markDone(ids){var m={};(Array.isArray(ids)?ids:[ids]).forEach(function(id){m[id]=true;});write(read().filter(function(x){return !m[x.id];}));saveState({pending:pending().length,lastPushAt:now(),lastSyncAt:now()});}
  function markError(id,e){write(read().map(function(x){return x.id===id?Object.assign({},x,{estado:"error",attempts:(x.attempts||0)+1,errorMessage:e&&e.message?e.message:String(e||"Error"),updatedAt:now()}):x;}));saveState({pending:pending().length});}
  function clear(){write([]);saveState({pending:0});}
  function status(){return {ok:true,mode:"queue",total:read().length,pending:pending().length,state:state(),updatedAt:now()};}
  window.BL2SyncQueue={version:"2.0.0-alpha.1",read:read,write:write,state:state,saveState:saveState,enqueue:enqueue,enqueueMany:enqueueMany,enqueueSnapshotChanges:enqueueSnapshotChanges,pending:pending,markDone:markDone,markError:markError,clear:clear,status:status,rowId:rowId};
})(window);
