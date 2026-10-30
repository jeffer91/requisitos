/* Numeración oficial de actas: correlativo institucional mensual, asignación atómica en Firestore.
 * Única identidad por cédula y período; nunca se calcula el consecutivo en localStorage.
 * La pantalla operativa invoca este conector solo ante una acción explícita del usuario.
 */
(function(w,d){"use strict";
const VERSION="1.1.0",COUNTERS="actas_contadores",REGISTRY="actas_registro",NUMBERS="actas_numeros";
let loading=null;
function t(v){return String(v==null?"":v).trim();}
function ced(v){const s=t(v).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(s)?"0"+s:s;}
function period(v){return t(v).replace(/_+/g,"__");}
function validPeriod(v){return /^\d{4}-\d{2}__\d{4}-\d{2}$/.test(v);}
function identity(input){
 const c=ced(input&&input.cedula),p=period(input&&input.periodoId);
 if(!/^[0-9]{10}$/.test(c)||!validPeriod(p))throw Error("El acta necesita una cédula válida de diez dígitos y un período académico.");
 return p+"__"+c;
}
function monthNow(){
 const pieces=new Intl.DateTimeFormat("en-US",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit"}).formatToParts(new Date());
 const year=pieces.find(x=>x.type==="year")?.value,month=pieces.find(x=>x.type==="month")?.value;
 if(!/^\d{4}$/.test(year)||!/^(0[1-9]|1[0-2])$/.test(month))throw Error("No se pudo determinar el mes de registro.");
 return {year,month,key:year+"-"+month};
}
function code(year,cedula,month,next){
 if(!Number.isSafeInteger(next)||next<1||next>9999)throw Error("El consecutivo mensual agotó los cuatro dígitos. Requiere intervención del administrador.");
 return year+"-"+ced(cedula).slice(0,4)+"-"+month+"-"+String(next).padStart(4,"0");
}
function script(src){return new Promise((resolve,reject)=>{
 const full=new URL(src,d.baseURI).href,prev=Array.from(d.scripts||[]).find(x=>x.src===full);
 if(prev){const check=()=>{if(w.firebase&&w.firebase.firestore)resolve(true);else reject(Error("Firebase no se inicializó correctamente."));};prev.addEventListener("load",check,{once:true});if(w.firebase&&w.firebase.firestore)resolve(true);return;}
 const el=d.createElement("script");el.src=full;el.onload=()=>resolve(true);el.onerror=()=>reject(Error("No se pudo cargar Firebase: "+src));d.head.appendChild(el);
 });}
async function firestore(){
 if(w.db&&typeof w.db.runTransaction==="function")return w.db;
 if(w.BL2Sync&&typeof w.BL2Sync.ensureFirebase==="function"){
  try{const db=await w.BL2Sync.ensureFirebase();if(db&&typeof db.runTransaction==="function")return db;}catch(e){}
 }
 if(loading)return loading;
 loading=(async()=>{
  if(!w.firebase||!w.firebase.initializeApp)await script("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  if(!w.firebase.firestore)await script("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");
  if(!w.firebaseConfig)await script("../firebase-config.js");
  const f=w.firebase;
  if(!f.apps||!f.apps.length){
   const config=w.firebaseConfig||w.FIREBASE_CONFIG;
   if(!config||!config.projectId)throw Error("No se ha configurado el proyecto Firebase de ITSQMET.");
   f.initializeApp(config);
  }
  const db=f.firestore();if(!db||typeof db.runTransaction!=="function")throw Error("Firebase no admite transacciones.");
  w.db=w.db||db;return db;
 })().finally(()=>{loading=null;});
 return loading;
}
function asEntry(snap){
 if(!snap||!snap.exists)return null;
 const value=snap.data()||{};
 return Object.assign({},value,{id:snap.id});
}
function validExisting(row,input){
 if(!row||!/^\d{4}-\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(t(row.numeroActa)))throw Error("El registro central contiene un acta sin número válido. Requiere revisión.");
 if(row.periodoId!==period(input.periodoId)||row.cedula!==ced(input.cedula))throw Error("El acta central no coincide con el estudiante o período.");
 if(row.modalidad!==t(input.modalidad))throw Error("El acta ya está numerada con otra modalidad. Revisa el registro antes de continuar.");
 if(row.fechaEmision&&w.ActasIssueDate&&row.fechaEmision!==w.ActasIssueDate.forPeriod(input.periodoId).date)throw Error("La fecha de emisión registrada no coincide con la política académica actual. Se requiere conciliación, sin crear otro folio.");
 return row;
}
async function lookup(input){
 const db=await firestore(),id=identity(input);
 const snap=await db.collection(REGISTRY).doc(id).get({source:"server"});
 return snap.exists?validExisting(asEntry(snap),input):null;
}
async function list(periodoId){
 const p=period(periodoId);if(!validPeriod(p))return [];
 const db=await firestore();
 const snapshot=await db.collection(REGISTRY).where("periodoId","==",p).get({source:"server"});
 return snapshot.docs.map(asEntry);
}
async function getOrAssign(input){
 input=input||{};
 const id=identity(input),mode=t(input.modalidad);
 if(!["EXAMEN_COMPLEXIVO","TRABAJO_TITULACION"].includes(mode))throw Error("La modalidad debe ser COMPLEX o TRAB.");
 if(!w.ActasIssueDate)throw Error("No está disponible el calendario institucional de Actas.");
 const issue=w.ActasIssueDate.forPeriod(input.periodoId);
 if(input.fechaEmision&&input.fechaEmision!==issue.date)throw Error("La fecha enviada no corresponde al período académico.");
 if(!w.ActasIssueDate.mayRegister(input.periodoId))throw Error("Aún no corresponde numerar el acta. Fecha de emisión programada: "+issue.date+".");
 const db=await firestore(),month={year:issue.year,month:issue.month,key:issue.monthKey};
 const recordRef=db.collection(REGISTRY).doc(id),counterRef=db.collection(COUNTERS).doc(month.key);
 const timestamp=w.firebase&&w.firebase.firestore&&w.firebase.firestore.FieldValue&&w.firebase.firestore.FieldValue.serverTimestamp;
 const registered=await db.runTransaction(async tx=>{
  // Las lecturas anteceden a todas las escrituras; un segundo equipo reintenta el contador.
  const original=await tx.get(recordRef);
  if(original.exists)return validExisting(asEntry(original),input);
  const counter=await tx.get(counterRef);
  const current=counter.exists?Number(counter.data().ultimo)||0:0;
  if(!Number.isSafeInteger(current)||current<0)throw Error("Contador central inválido: no se asignó número.");
  const next=current+1,numeroActa=code(month.year,input.cedula,month.month,next);
  const numberRef=db.collection(NUMBERS).doc(numeroActa);
  const used=await tx.get(numberRef);
  if(used.exists)throw Error("Número ya reservado centralmente. Se suspendió la asignación para evitar duplicados.");
  const entry={identidad:id,numeroActa,periodoId:period(input.periodoId),cedula:ced(input.cedula),
   modalidad:mode,carrera:t(input.carrera).slice(0,170),nombre:t(input.nombre).slice(0,180),
   mesClave:month.key,consecutivo:next,fechaEmision:issue.date,estado:"REGISTRADA",fechaCliente:new Date().toISOString(),
   createdAt:timestamp?timestamp():new Date().toISOString()};
  tx.set(counterRef,{mesClave:month.key,ultimo:next,ultimaActa:numeroActa,ultimaIdentidad:id,updatedAt:timestamp?timestamp():new Date().toISOString()});
  tx.set(recordRef,entry);
  tx.set(numberRef,{numeroActa,identidad:id,mesClave:month.key,consecutivo:next,periodoId:entry.periodoId,cedula:entry.cedula,modalidad:mode});
  return Object.assign({id},entry);
 },{maxAttempts:8});
 return validExisting(registered,input);
}
function readableError(error){
 const message=t(error&&error.message||error);
 if(/permission-denied|insufficient permissions|missing or insufficient permissions/i.test(message))return "Firestore todavía no permite registrar actas: deben publicarse las reglas de numeración.";
 if(/offline|unavailable|network|failed to fetch/i.test(message))return "No hay conexión con el registro central. No se asignó ningún número; la descarga solo puede ser borrador.";
 return message||"No se pudo registrar el número de acta.";
}
w.ActasNumbering=Object.freeze({version:VERSION,identity,code,monthNow,lookup,list,getOrAssign,readableError});
})(window,document);
