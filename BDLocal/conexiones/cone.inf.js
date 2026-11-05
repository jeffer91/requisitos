/* ConInf · lectura estricta de BDLocal.
 * No importa módulos de escritura, no ejecuta migraciones ni sincronizaciones.
 * Abre SOLO una base existente y usa transacciones 'readonly'. */
(function(window){
 "use strict";
 var DB_NAME="REQUISITOS_BL2";
 var STORES=["periodos","matriculas_periodo","personas","estudiantes","requisitos_estudiante",
   "requisitos","evaluaciones_titulacion","notas_titulacion","notas","nucleos_estructurantes","evaluaciones_nucleos","settings"];
 var state={reads:0,ready:false,source:"",lastError:"",lastReadAt:"",stores:[]};
 function copy(a){return JSON.parse(JSON.stringify(a||[]));}
 function text(v){return String(v==null?"":v).trim();}
 function existingDB(){
   var factory=window.indexedDB;
   if(!factory||typeof factory.databases!=="function"){
     return Promise.reject(new Error("No está disponible la detección segura de bases existentes; se evita crear una base nueva."));
   }
   return factory.databases().then(function(databases){
     if(!databases.some(function(db){return db.name===DB_NAME;})){
       throw new Error("No existe una base BDLocal en este perfil de Electron.");
     }
     return new Promise(function(resolve,reject){
       var req=factory.open(DB_NAME); // SIN versión: no se actualiza el esquema.
       req.onupgradeneeded=function(){try{req.transaction.abort();}catch(e){}};
       req.onsuccess=function(){resolve(req.result);};
       req.onerror=function(){reject(req.error||new Error("La base de datos no se pudo abrir."));};
       req.onblocked=function(){reject(new Error("La base de datos está bloqueada."));};
     });
   });
 }
 function tables(db){
   var names=STORES.filter(function(name){return db.objectStoreNames.contains(name);});
   if(!names.length){return Promise.reject(new Error("BDLocal no contiene tablas reconocidas."));}
   return new Promise(function(resolve,reject){
     var found={},tx;
     try{tx=db.transaction(names,"readonly");}
     catch(err){reject(err);return;}
     names.forEach(function(name){
       var request=tx.objectStore(name).getAll();
       request.onsuccess=function(){found[name]=request.result||[];};
     });
     tx.oncomplete=function(){resolve(found);};
     tx.onabort=function(){reject(tx.error||new Error("Se canceló la transacción de lectura."));};
     tx.onerror=function(){reject(tx.error||new Error("No fue posible leer las tablas."));};
   });
 }
 function canonical(value){
   var v=text(value),m=v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
   return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:v.replace(/_+/g,"__");
 }
 function periodOf(row){
   return canonical(row.periodoId||row.periodId||row.periodoCanonicoId||row._periodoId||
     row._bl2PeriodoId||row.ultimoPeriodoId||"");
 }
 function filter(rows,period){
   period=canonical(period);return period?rows.filter(function(row){return periodOf(row)===period;}):rows;
 }
 function snapshot(raw,period){
   function entries(primary,legacy){
     var a=raw[primary]||[];
     return a.length?a:(raw[legacy]||[]);
   }
   var students=entries("matriculas_periodo","estudiantes");
   var requirements=entries("requisitos_estudiante","requisitos");
   var notes=(raw.notas_titulacion||[]).concat(raw.notas||[]);
   var byNucleus=Object.create(null);
   (raw.evaluaciones_nucleos||[]).forEach(function(row){
     if(row&&row.id)byNucleus[row.id]=row;
   });
   (raw.settings||[]).forEach(function(entry){
     if(!entry||typeof entry.key!=="string"||entry.key.indexOf("ncomplex:nucleo:")!==0)return;
     var row=entry.value;
     if(!row||typeof row!=="object"||row.id!==entry.key.slice("ncomplex:nucleo:".length))return;
     var prior=byNucleus[row.id];
     if(!prior||text(row.updatedAt)>=text(prior.updatedAt))byNucleus[row.id]=row;
   });
   var nucleusRows=Object.keys(byNucleus).map(function(k){return byNucleus[k];});
   return {
     source:"BDLocal IndexedDB readonly",readOnly:true,periodoId:canonical(period),
     periods:copy(raw.periodos||[]),
     students:copy(filter(students,period)),
     persons:copy(raw.personas||[]),
     requirements:copy(filter(requirements,period)),
     evaluations:copy(filter(raw.evaluaciones_titulacion||[],period)),
     notes:copy(filter(notes,period)),
     nuclei:copy(filter(nucleusRows.concat(raw.nucleos_estructurantes||[]),period)),
     availableStores:Object.keys(raw),generatedAt:new Date().toISOString()
   };
 }
 function cacheFallback(period,error){
   var topWindow;try{topWindow=window.top;}catch(e){topWindow=null;}
   var utils=window.BDLocalConUtils||(topWindow&&topWindow.BDLocalConUtils);
   if(!utils||typeof utils.readCache!=="function")throw error;
   var cache=utils.readCache()||{},rows=cache.students||[],req=cache.requirements||[];
   if(!rows.length&&!req.length)throw error;
   return {
     source:"Caché central BDLocal (solo lectura)",readOnly:true,periodoId:canonical(period),
     periods:copy(cache.periods||[]),students:copy(filter(rows,period)),persons:[],
     requirements:copy(filter(req,period)),evaluations:[],notes:[],nuclei:[],
     availableStores:["cache"],generatedAt:new Date().toISOString(),limited:true
   };
 }
 function read(options){
   options=options||{};var period=canonical(options.periodoId||options.periodId||"");
   if(!period)return Promise.reject(new Error("Inf requiere un período institucional válido para consultar estudiantes."));
   state.reads++;
   return existingDB().then(function(db){
     return tables(db).then(function(raw){db.close();return snapshot(raw,period);})
       .catch(function(error){db.close();throw error;});
   }).catch(function(error){return cacheFallback(period,error);})
     .then(function(result){
       state.ready=true;state.source=result.source;state.lastError="";
       state.lastReadAt=result.generatedAt;state.stores=result.availableStores.slice();
       return result;
     }).catch(function(error){
       state.lastError=error.message||String(error);throw error;
     });
 }
 function periods(){
   return existingDB().then(function(db){
     if(!db.objectStoreNames.contains("periodos")){db.close();return [];}
     return new Promise(function(resolve,reject){
       var tx=db.transaction(["periodos"],"readonly");
       var request=tx.objectStore("periodos").getAll(),rows=[];
       request.onsuccess=function(){rows=request.result||[];};
       tx.oncomplete=function(){db.close();resolve(copy(rows));};
       tx.onerror=function(){db.close();reject(tx.error||new Error("No se pudieron leer períodos."));};
       tx.onabort=function(){db.close();reject(tx.error||new Error("Lectura de períodos cancelada."));};
     });
   }).catch(function(e){
     var topWindow;try{topWindow=window.top;}catch(err){topWindow=null;}
     var u=window.BDLocalConUtils||(topWindow&&topWindow.BDLocalConUtils);
     return u&&typeof u.readCache==="function"?copy((u.readCache()||{}).periods||[]):[];
   });
 }
 function status(){return {
   ok:!state.lastError,ready:state.ready,canRead:true,canWrite:false,
   source:state.source,screen:"inf",reads:state.reads,
   lastReadAt:state.lastReadAt,lastError:state.lastError,availableStores:state.stores.slice()
 }; }
 var api=Object.freeze({version:"1.0.0-readonly",source:"ConInf",screen:"inf",
    read:read,listPeriods:periods,ready:function(){return Promise.resolve(status());},status:status});
 window.ConInf=api;
 if(window.BDLocalConeRegistry&&typeof window.BDLocalConeRegistry.register==="function"){
   window.BDLocalConeRegistry.register("inf",{
     label:"Inf",global:"ConInf",file:"cone.inf.js",canRead:true,canWrite:false,
     operations:["ready","read","status","listPeriods"],
     pathHints:["/inf/","inf.html"],
     tables:STORES,aliases:["informes_titulacion"]
   });
 }
 if(window.BDLocalConexiones&&typeof window.BDLocalConexiones.register==="function"){
   window.BDLocalConexiones.register("inf",api);
 }
})(window);
