/* =========================================================
Nombre completo: carga.firebase-indexfree.js
Ruta: /Carga/carga.firebase-indexfree.js
Función:
- Evitar que la carga directa de Firebase dependa de índices compuestos no desplegados.
- Para matriculas, requisitos y notas con periodoId, consultar solo por igualdad de periodoId.
- Ordenar y paginar en memoria usando updatedAt + documentId para conservar el contrato del repositorio.
- Mantener esta adaptación limitada a la pantalla Carga.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-period-equality-query";
  var PERIOD_SCOPED={matriculas:true,requisitos:true,notas:true};
  var installed=false;

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function nowISO(){return new Date().toISOString();}
  function tuple(item){return {updatedAt:text(item&&item.data&&item.data.updatedAt),documentId:text(item&&item.documentId)};}
  function fallbackCompare(a,b){
    a=a||{};b=b||{};
    var date=text(a.updatedAt).localeCompare(text(b.updatedAt));
    return date!==0?date:text(a.documentId).localeCompare(text(b.documentId));
  }
  function snapshotRows(snapshot){
    var rows=[];
    if(!snapshot){return rows;}
    function add(doc){
      var data=doc&&typeof doc.data==="function"?doc.data():doc&&doc.data||{};
      rows.push({documentId:text(doc&&doc.id),data:clone(data||{})});
    }
    if(Array.isArray(snapshot.docs)){snapshot.docs.forEach(add);return rows;}
    if(typeof snapshot.forEach==="function"){snapshot.forEach(add);}
    return rows;
  }

  function install(){
    var repo=window.RequisitosFirebaseRepository;
    if(!repo||typeof repo.list!=="function"||typeof repo.ensureFirestore!=="function"){return false;}
    if(repo.__cargaIndexFreeInstalled){installed=true;return true;}

    var originalList=repo.list.bind(repo);
    repo.list=function(entity,options){
      entity=text(entity).toLowerCase();
      options=Object.assign({},options||{});
      var periodoId=text(options.periodoId||"");
      if(!PERIOD_SCOPED[entity]||!periodoId){return originalList(entity,options);}

      var limit=Math.max(1,Math.min(1000,Number(options.limit||250)));
      var includeDeleted=options.includeDeleted===true;
      var cursor=typeof repo.normalizeCursor==="function"?repo.normalizeCursor(options):{
        updatedAt:text(options.cursor&&options.cursor.updatedAt||options.updatedAfter||options.since||""),
        documentId:text(options.cursor&&options.cursor.documentId||options.afterDocumentId||"")
      };
      var compare=typeof repo.compareTuple==="function"?repo.compareTuple:fallbackCompare;

      return repo.ensureFirestore().then(function(firestore){
        var query=firestore.collection(repo.collectionName(entity));
        if(!query||typeof query.where!=="function"){throw new Error("Firestore no permite consultar "+repo.collectionName(entity)+" por período.");}
        return query.where("periodoId","==",periodoId).get();
      }).then(function(snapshot){
        var all=snapshotRows(snapshot).sort(function(a,b){return compare(tuple(a),tuple(b));});
        var eligible=all.filter(function(item){
          if(cursor.updatedAt&&compare(tuple(item),cursor)<=0){return false;}
          return includeDeleted||item.data.eliminado!==true;
        });
        var documents=eligible.slice(0,limit);
        var last=documents.length?tuple(documents[documents.length-1]):cursor;
        return {
          ok:true,
          entity:entity,
          collection:repo.collectionName(entity),
          incremental:!!cursor.updatedAt,
          periodoId:periodoId,
          cursorBefore:clone(cursor),
          cursorAfter:clone(last),
          total:documents.length,
          documents:documents,
          hasMore:eligible.length>documents.length,
          readAt:nowISO(),
          version:VERSION,
          indexFree:true
        };
      }).catch(function(error){
        var message=error&&error.message?error.message:String(error);
        if(/requires an index|create_composite|failed-precondition/i.test(message)){
          throw new Error("La consulta simple por período también fue rechazada por Firestore. Revise la indexación automática de periodoId en "+repo.collectionName(entity)+".");
        }
        throw error;
      });
    };

    repo.__cargaIndexFreeInstalled=true;
    repo.__cargaIndexFreeVersion=VERSION;
    installed=true;
    try{window.dispatchEvent(new CustomEvent("carga:firebase-indexfree-ready",{detail:{ok:true,version:VERSION,at:nowISO()}}));}catch(error){}
    return true;
  }

  function retry(attempt){
    attempt=Math.max(0,Number(attempt||0));
    if(install()){return;}
    if(attempt<300){window.setTimeout(function(){retry(attempt+1);},50);}
  }

  window.CargaFirebaseIndexFree={version:VERSION,install:install,status:function(){return {version:VERSION,installed:installed};}};
  window.addEventListener("requisitos:firebase-repository-ready",function(){install();});
  retry(0);
})(window);
