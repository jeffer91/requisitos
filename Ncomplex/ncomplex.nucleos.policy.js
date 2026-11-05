/* Política por etapa: núcleos 8 requisitos; complexivo 9.
 * NO APLICA es válido exclusivamente para núcleos, según TablaNucleosPolicy. */
(function(w){"use strict";
var all=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
function status(value){return String(value==null?"":value).trim().toUpperCase().replace(/_/g," ");}
function check(assessment,stage){
 var isNucleus=stage==="nucleos",req=assessment&&assessment.requirements;
 if(!Array.isArray(req))return {eligible:false,verified:false,missing:["Sin verificación de requisitos"],
   unknown:["Sin verificación de requisitos"],pending:[],total:isNucleus?8:9};
 var found=Object.create(null);
 req.forEach(function(r){found[r.key]=r;});
 var relevant=all.filter(function(k){return !isNucleus||k!=="titulacion";});
 var pending=[],unknown=[],complete=0;
 relevant.forEach(function(k){
  var row=found[k],v=status(row&&row.status),label=(row&&row.label||k)+" ("+(row&&row.status||"SIN DATO")+")";
  if(v==="CUMPLE"||(isNucleus&&v==="NO APLICA")){complete++;return;}
  if(!row||v==="SIN DATO"||v==="")unknown.push(label);else pending.push(label);
 });
 return {eligible:pending.length===0&&unknown.length===0,
  verified:unknown.length===0,missing:pending.concat(unknown),pending:pending,
  unknown:unknown,total:relevant.length,complete:complete};
}
w.NcomplexNucleosPolicy=Object.freeze({check:check});
})(window);
