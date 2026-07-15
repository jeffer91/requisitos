/* Ncomplex: reglas de evaluaciones de titulación. */
(function(window){
  "use strict";
  var VERSION="1.0.0-ncomplex";
  var MOD_COMPLEXIVO="EXAMEN_COMPLEXIVO";
  var MOD_TRABAJO="TRABAJO_TITULACION";
  var Config=window.BL2Config||{};
  function text(v){return String(v==null?"":v).trim();}
  function round(v){return Math.round(Number(v)*100)/100;}
  function note(v){var raw=text(v).replace(/,/g,".");if(!raw){return null;}var n=Number(raw);return Number.isFinite(n)?round(Math.max(0,Math.min(10,n))):null;}
  function cedula(v){var p=window.BDLRulesPersona;if(p&&typeof p.normalizeCedula==="function"){return p.normalizeCedula(v);}var u=Config.utils||{};if(typeof u.normalizeCedula==="function"){return u.normalizeCedula(v);}var raw=text(v).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function period(v){v=text(v);var m=v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:v.replace(/_+/g,"__");}
  function makeId(periodoId,id){periodoId=period(periodoId);id=cedula(id);return periodoId&&id?id+"__"+periodoId:"";}
  function modality(v){var k=text(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"_");return ["TRABAJO_TITULACION","TRABAJO_DE_TITULACION","TRABAJO","PROYECTO","ARTICULO"].indexOf(k)>=0?MOD_TRABAJO:MOD_COMPLEXIVO;}
  function weighted(a,b,wa,wb){a=note(a);b=note(b);return a==null||b==null?null:round(a*wa+b*wb);}
  function complexivo(a,b){return weighted(a,b,0.40,0.60);}
  function trabajo(a,b){return weighted(a,b,0.60,0.40);}
  function first(row,names){for(var i=0;i<names.length;i+=1){var v=row[names[i]];if(v!==undefined&&v!==null&&text(v)!==""){return v;}}return null;}
  function build(input,context){
    var row=Object.assign({},input||{}),ctx=context||{};
    var periodoId=period(row.periodoId||row.periodId||ctx.periodoId||ctx.periodId||"");
    var id=cedula(row.cedula||row.numeroIdentificacion||ctx.cedula||"");
    var mode=modality(row.modalidadTitulacion||row.modalidad||ctx.modalidadTitulacion||(Config.ncomplex&&Config.ncomplex.defaultModality));
    var pass=Number(row.notaMinimaAprobacion||ctx.notaMinimaAprobacion||(Config.ncomplex&&Config.ncomplex.passingGrade)||7);if(!Number.isFinite(pass)){pass=7;}
    var nt=note(first(row,["notaTeorica","teorico","nota1","Nota 1"]));
    var np=note(first(row,["notaPractica","practico","nota2","Nota 2"]));
    var nc=complexivo(nt,np);if(nc==null){nc=note(first(row,["notaComplexivo","complexivo"]));}
    var nts=note(first(row,["notaTeoricaSupletorio","teoricoSupletorio"]));
    var nps=note(first(row,["notaPracticaSupletorio","practicoSupletorio"]));
    var ns=complexivo(nts,nps);if(ns==null){ns=note(first(row,["notaSupletorio","supletorioComplexivo","Supletorio Complexivo"]));}
    var ne=note(first(row,["notaEscrito","escrito","trabajoEscrito"]));
    var nd=note(first(row,["notaDefensaTrabajo","defensaTrabajo","defensa"]));
    var nw=trabajo(ne,nd);if(nw==null){nw=note(first(row,["notaTrabajoTitulacion","trabajoTitulacion","Trabajo Titulación"]));}
    var op=text(row.oportunidadAplicada||ctx.oportunidadAplicada).toUpperCase();if(op!=="SUPLETORIO"&&op!=="ORDINARIA"){op=nc!=null&&nc<pass&&ns!=null?"SUPLETORIO":"ORDINARIA";}
    var oficial=mode===MOD_TRABAJO?nw:(op==="SUPLETORIO"?ns:nc);
    var any=[nt,np,nc,nts,nps,ns,ne,nd,nw].some(function(v){return v!=null;});
    var estado=!any?"SIN_NOTAS":oficial==null?"INCOMPLETO":oficial>=pass?"APROBADO":"NO_APROBADO";
    var canonical=makeId(periodoId,id),now=new Date().toISOString();
    return Object.assign({},row,{id:canonical,evaluacionId:canonical,idEstudiantePeriodo:canonical,studentId:canonical,periodoId:periodoId,periodId:periodoId,cedula:id,numeroIdentificacion:id,modalidadTitulacion:mode,notaTeorica:nt,notaPractica:np,notaComplexivo:nc,notaTeoricaSupletorio:nts,notaPracticaSupletorio:nps,notaSupletorio:ns,notaEscrito:ne,notaDefensaTrabajo:nd,notaTrabajoTitulacion:nw,notaOficial:oficial,oportunidadAplicada:op,notaMinimaAprobacion:pass,estadoEvaluacion:estado,codigoTitulacion:text(row.codigoTitulacion||row["Código Titulación"]),horarioOrigen:text(row.horarioOrigen||row.Horario),importacionId:text(row.importacionId||ctx.importacionId),origen:text(row.origen||ctx.origen||"ncomplex"),createdAt:text(row.createdAt)||now,updatedAt:text(row.updatedAt)||now,_bdlEvaluacionValid:!!canonical,_bdlEvaluacionError:canonical?"":"La evaluación necesita período y cédula."});
  }
  function apply(payload,ctx){return Array.isArray(payload)?payload.map(function(r){return build(r,ctx);}):build(payload,ctx);}
  if(window.BDLRules&&typeof window.BDLRules.register==="function"){window.BDLRules.register("evaluaciones_titulacion.normalize",apply);window.BDLRules.register("ncomplex.normalize",apply);}
  window.BDLRulesEvaluacionesTitulacion={version:VERSION,MOD_COMPLEXIVO:MOD_COMPLEXIVO,MOD_TRABAJO:MOD_TRABAJO,parseNota:note,normalizeCedula:cedula,canonicalPeriodId:period,makeId:makeId,modality:modality,complexivo:complexivo,trabajo:trabajo,build:build,apply:apply};
})(window);
