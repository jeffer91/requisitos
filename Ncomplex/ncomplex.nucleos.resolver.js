/* Conciliación deliberada de conflictos: elegir BDLocal (se sube en la próxima
 * subida directa) o copiar a BDLocal la versión verificada de Firebase. */
(function(w){"use strict";
var entity="evaluaciones_nucleos";
function id(row){return row.periodoId+"__"+row.cedula+"__N"+row.nucleo;}
async function resolve(row,choice){
 if(!row||row.estadoSync!=="CONFLICTO")throw Error("El registro no está marcado como conflicto.");
 if(choice!=="local"&&choice!=="firebase")throw Error("Selecciona qué versión deseas conservar.");
 await w.NcomplexFirebaseAuth.requireUser();
 if(choice==="local")await w.NcomplexFirebaseAuth.requireWriter();
 await w.RequisitosFirebaseOperationCenter.ensure();
 var repo=w.RequisitosFirebaseRepository,local=w.NcomplexNucleosStore;
 var remote=await repo.getById(entity,id(row));
 if(!remote||!remote.data||!remote.data.dataHash)throw Error("La versión remota no está disponible para conciliación.");
 var current=(await local.list(row.periodoId)).find(function(r){return r.id===row.id;});
 if(!current||current.updatedAt!==row.updatedAt||current.sourceHash!==row.sourceHash)
  throw Error("Las notas locales cambiaron; recarga antes de conciliar.");
 var guard={updatedAt:row.updatedAt,sourceHash:row.sourceHash};
 if(choice==="local"){
  // Subida directa (igual que Carga): conservar BDLocal deja el registro
  // pendiente y la próxima subida escribe la nota local sobre la de Firebase.
  await local.update(row.id,{estadoSync:"PENDIENTE",remoteHash:remote.data.dataHash,
   cloudError:"Se conserva BDLocal; la próxima subida reemplazará la nota de Firebase.",
   conciliacionAt:new Date().toISOString()},guard);
  return {choice:choice,status:"PENDIENTE"};
 }
 var document=remote.data;
 var expected=w.RequisitosFirebaseValidator&&w.RequisitosFirebaseValidator.validate(entity,document,{documentId:id(row)});
 if(!expected||expected.ok!==true)throw Error("La versión Firebase no supera la validación institucional.");
 var fields=["periodoId","cedula","codigoCarrera","nombreCarrera","grupoInforme","nucleo","nombreNucleo",
  "cursoMoodle","evaluaciones","taller","prueba","casoEstudio","actividadesAdicionales","totalMoodle","estadoCarga","habilitado",
  "requisitosPendientes","observaciones","origen","sourceHash","importacionId","historialCambios"];
 var patch={};
 fields.forEach(function(k){if(document[k]!==undefined)patch[k]=document[k];});
 patch.estadoSync="SINCRONIZADO";patch.remoteHash=document.dataHash;
 patch.cloudError="";patch.lastSyncedAt=new Date().toISOString();
 patch.conciliacionAt=patch.lastSyncedAt;
 await local.update(row.id,patch,guard);
 return {choice:choice,status:"SINCRONIZADO"};
}
w.NcomplexNucleosResolver=Object.freeze({resolve:resolve});
})(window);
