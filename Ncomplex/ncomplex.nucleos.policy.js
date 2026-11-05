/* Política por etapa: núcleos 8 requisitos; complexivo 9.
 * NO APLICA es válido exclusivamente para núcleos, según TablaNucleosPolicy. */
(function(w){"use strict";
var all=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
function status(value){return String(value==null?"":value).trim().toUpperCase().replace(/_/g," ");}
function check(assessment,stage){
 var isNucleus=stage==="nucleos",req=assessment&&assessment.requirements;
 if(!Array.isArray(req))return {eligible:false,missing:["Sin verificación de requisitos"],total:isNucleus?8:9};
 var found=Object.create(null);
 req.forEach(function(r){found[r.key]=r;});
 var relevant=all.filter(function(k){return !isNucleus||k!=="titulacion";});
 var missing=relevant.filter(function(k){
  var row=found[k],v=status(row&&row.status);
  return !(v==="CUMPLE"||(isNucleus&&v==="NO APLICA"));
 }).map(function(k){var row=found[k];return (row&&row.label||k)+" ("+(row&&row.status||"SIN DATO")+")";});
 return {eligible:missing.length===0,missing:missing,total:relevant.length,complete:relevant.length-missing.length};
}
w.NcomplexNucleosPolicy=Object.freeze({check:check});
})(window);
