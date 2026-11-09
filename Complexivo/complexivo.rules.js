/* =========================================================
Nombre completo: complexivo.rules.js
Ruta: /Complexivo/complexivo.rules.js
Función:
- Reglas oficiales del Examen Complexivo (las calcula la app, no Moodle):
    Ordinario  = 40 % teórico + 60 % práctico
    Supletorio = 40 % teórico + 60 % práctico (del supletorio)
- Ordinario y supletorio NUNCA se mezclan.
- Si pierde el ordinario (o no lo rindió) debe rendir los DOS componentes del
  supletorio; si falta uno, el resultado queda incompleto y no se publica.
- Se aprueba con 7,00.
========================================================= */
(function(root){
  "use strict";

  var VERSION="1.0.0";
  var PASSING=7;

  function round(value){return Math.round((value+Number.EPSILON)*100)/100;}
  function has(v){return v!==null&&v!==undefined&&Number.isFinite(v);}
  function weighted(t,p){return round(t*0.4+p*0.6);}

  function evaluate(fila){
    var o=fila.ordinaria||{},s=fila.supletorio||{};
    var ordComplete=has(o.teorico)&&has(o.practico),ordAny=has(o.teorico)||has(o.practico);
    var supComplete=has(s.teorico)&&has(s.practico),supAny=has(s.teorico)||has(s.practico);
    var out={notaOrdinaria:ordComplete?weighted(o.teorico,o.practico):null,
      notaSupletorio:supComplete?weighted(s.teorico,s.practico):null,
      notaOficial:null,oportunidadAplicada:"",estadoEvaluacion:"SIN_NOTAS",publicable:false,observaciones:[]};

    if(!ordAny&&!supAny){out.observaciones.push("No rindió el examen.");return out;}

    if(ordComplete&&out.notaOrdinaria>=PASSING){
      out.notaOficial=out.notaOrdinaria;out.oportunidadAplicada="ORDINARIA";out.estadoEvaluacion="APROBADO";out.publicable=true;
      if(supAny){out.observaciones.push("Aprobó el ordinario; las notas de supletorio no se consideran.");}
      return out;
    }
    if(supComplete){
      out.notaOficial=out.notaSupletorio;out.oportunidadAplicada="SUPLETORIO";
      out.estadoEvaluacion=out.notaSupletorio>=PASSING?"APROBADO":"NO_APROBADO";out.publicable=true;
      if(!ordComplete){out.observaciones.push(ordAny?"Ordinario incompleto; vale el supletorio.":"Sin ordinario; vale el supletorio.");}
      return out;
    }
    if(supAny){
      out.oportunidadAplicada="SUPLETORIO";out.estadoEvaluacion="INCOMPLETO";
      out.observaciones.push("Supletorio incompleto: debe rendir teórico y práctico (falta "+(has(s.teorico)?"el práctico":"el teórico")+").");
      return out;
    }
    if(ordComplete){
      out.notaOficial=out.notaOrdinaria;out.oportunidadAplicada="ORDINARIA";out.estadoEvaluacion="NO_APROBADO";out.publicable=true;
      out.observaciones.push("Perdió el ordinario: debe rendir supletorio teórico y práctico.");
      return out;
    }
    out.oportunidadAplicada="ORDINARIA";out.estadoEvaluacion="INCOMPLETO";
    out.observaciones.push("Ordinario incompleto: falta "+(has(o.teorico)?"el práctico":"el teórico")+".");
    return out;
  }

  var api={version:VERSION,passing:PASSING,evaluate:evaluate,weighted:weighted};
  root.ComplexivoRules=api;
  if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
