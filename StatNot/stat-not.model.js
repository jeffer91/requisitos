/* Stat Not: clasificación y agregación pura sobre la regla oficial de Defensas. */
(function(window){
  "use strict";
  function text(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function pick(row,names){for(var i=0;i<names.length;i++){if(text(row&&row[names[i]])){return text(row[names[i]]);}}return "";}
  function pct(a,b){return b?Math.round((a/b)*1000)/10:0;}
  function avg(values){values=(values||[]).filter(function(v){return Number.isFinite(v);});return values.length?Math.round(values.reduce(function(a,b){return a+b;},0)/values.length*100)/100:null;}
  function decorate(row){
    row=row||{};var rule=window.BDLDefenseEligibility;if(!rule||typeof rule.evaluate!=="function"){throw new Error("BDLDefenseEligibility no está disponible.");}
    var e=rule.evaluate(row),rawNotes=typeof rule.notes==="function"?rule.notes(row):{};
    var failedArt=e.nart!==null&&e.nart<7;
    var failedDef=e.nart!==null&&e.nart>=7&&e.ndef!==null&&e.ndef<7;
    var approved=e.noteState==="APROBADO";
    var failed=failedArt||failedDef||e.noteState==="NO_APROBADO";
    var missingArt=e.nart===null;
    var missingDef=e.canDef&&e.ndef===null;
    var missingFinal=rawNotes.nfin===null&&e.nart!==null&&e.nart>=7&&e.ndef!==null&&e.ndef>=7;
    return Object.assign({},row,{
      _snEval:e,
      _snCedula:pick(row,["cedula","numeroIdentificacion","NumeroIdentificacion","identificacion"]),
      _snNombre:pick(row,["nombreCompleto","Nombres","nombres","nombre","estudiante"])||"Sin nombre",
      _snCarrera:pick(row,["carrera","NombreCarrera","nombreCarrera","Carrera","_carrera"])||"Sin carrera",
      _snDivision:pick(row,["division","Division","_division"])||"Sin división",
      _snSede:pick(row,["sede","Sede","_sede"])||"Sin sede",
      _snNart:e.nart,_snNdef:e.ndef,_snNfin:e.nfin,
      _snRequirementsLoaded:e.requirementsLoaded,_snRequirementsOk:e.requirementsOk,
      _snEligible:e.canDef===true,_snApproved:approved,_snFailed:failed,
      _snFailedArt:failedArt,_snFailedDef:failedDef,_snSupplement:failedArt||failedDef,
      _snMissingArt:missingArt,_snMissingDef:missingDef,_snMissingFinal:missingFinal,
      _snMissingNotes:missingArt||missingDef,
      _snComplete:approved,
      _snBlocked:!e.requirementsLoaded||!e.requirementsOk,
      _snState:e.stateLabel||"—"
    });
  }
  function summarize(items){
    items=Array.isArray(items)?items:[];
    function count(key){return items.filter(function(x){return !!x[key];}).length;}
    var evaluated=items.filter(function(x){return x._snApproved||x._snFailed;}).length;
    var approved=count("_snApproved");
    return {
      total:items.length,requirementsComplete:items.filter(function(x){return x._snRequirementsLoaded&&x._snRequirementsOk;}).length,
      requirementsIncomplete:items.filter(function(x){return x._snRequirementsLoaded&&!x._snRequirementsOk;}).length,
      requirementsNotLoaded:items.filter(function(x){return !x._snRequirementsLoaded;}).length,
      eligible:count("_snEligible"),approved:approved,failed:count("_snFailed"),failedArt:count("_snFailedArt"),failedDef:count("_snFailedDef"),
      missingNotes:count("_snMissingNotes"),missingArt:count("_snMissingArt"),missingDef:count("_snMissingDef"),missingFinal:count("_snMissingFinal"),
      supplement:count("_snSupplement"),supplementArt:count("_snFailedArt"),supplementDef:count("_snFailedDef"),complete:count("_snComplete"),
      withArt:items.filter(function(x){return x._snNart!==null;}).length,withDef:items.filter(function(x){return x._snNdef!==null;}).length,withFinal:items.filter(function(x){return x._snNfin!==null;}).length,
      evaluated:evaluated,approvalPct:pct(approved,evaluated),advancePct:pct(count("_snComplete"),items.length),
      avgArt:avg(items.map(function(x){return x._snNart;})),avgDef:avg(items.map(function(x){return x._snNdef;})),avgFinal:avg(items.map(function(x){return x._snNfin;}))
    };
  }
  function groups(items,key){
    var map=Object.create(null);(items||[]).forEach(function(item){var label=text(item[key])||"Sin dato";(map[label]||(map[label]=[])).push(item);});
    return Object.keys(map).map(function(label){return {label:label,items:map[label],summary:summarize(map[label])};}).sort(function(a,b){return a.label.localeCompare(b.label,"es",{sensitivity:"base"});});
  }
  function matchState(item,state){
    if(!state)return true;
    if(state==="eligible")return item._snEligible;
    if(state==="approved")return item._snApproved;
    if(state==="failed")return item._snFailed;
    if(state==="pending")return item._snMissingNotes;
    if(state==="supplement")return item._snSupplement;
    if(state==="blocked")return item._snBlocked;
    if(state==="complete")return item._snComplete;
    if(state==="missingArt")return item._snMissingArt;
    if(state==="missingDef")return item._snMissingDef;
    return true;
  }
  window.StatNotModel={version:"1.0.0",text:text,norm:norm,pct:pct,decorate:decorate,summarize:summarize,groups:groups,matchState:matchState};
})(window);
