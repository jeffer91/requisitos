/* =========================================================
Nombre completo: coo.report.compliance-fix.js
Ruta o ubicación: /Requisitos/Coordi/coo.report.compliance-fix.js
Función o funciones:
- Corregir el resumen general de cumplimiento de Coordi.
- Recalcular cada requisito con el valor real de cada estudiante.
- Evitar que el valor del último estudiante se aplique a todo el período.
- Mantener sin cambios los reportes específicos por requisito.
Con qué se conecta:
- Coordi/coo.report.js.
- Coordi/coo.data.js.
- Stats/stats.rules.js.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-student-values";
  var report=window.COOReport||null;

  function arr(value){return Array.isArray(value)?value:[];}
  function text(value){return String(value==null?"":value).trim();}

  function keyOf(item){
    item=item||{};
    var raw=item.key||item.requisitoKey||item.requirementKey||item.id||item.campo||item.field||"";
    try{
      if(window.COOData&&window.COOData.helpers&&typeof window.COOData.helpers.canonicalRequirementKey==="function"){
        return window.COOData.helpers.canonicalRequirementKey(raw);
      }
    }catch(error){}
    return text(raw);
  }

  function valueInfo(row,item){
    try{
      if(report&&report.helpers&&typeof report.helpers.valueInfo==="function"){
        return report.helpers.valueInfo(row||{}, {
          key:keyOf(item),
          label:text(item&&item.label),
          source:"compliance-fix"
        })||{exists:false,value:""};
      }
    }catch(error){}
    return {exists:false,value:""};
  }

  function applies(row,item){
    try{
      return report&&typeof report.requirementApplies==="function"
        ?report.requirementApplies(row||{}, {key:keyOf(item),label:text(item&&item.label),source:"compliance-fix"})
        :true;
    }catch(error){
      return true;
    }
  }

  function statusOf(value){
    try{
      if(report&&typeof report.cellStatus==="function"){
        return report.cellStatus(value);
      }
    }catch(error){}
    return "no_cumple";
  }

  function recalculate(rows,catalog){
    rows=arr(rows);
    return arr(catalog).map(function(item){
      var result={
        key:keyOf(item),
        label:text(item&&item.label)||keyOf(item),
        total:0,
        cumplen:0,
        noCumplen:0,
        porcentaje:0
      };

      rows.forEach(function(row){
        if(!applies(row,result)){return;}

        var current=valueInfo(row,result);
        var status=statusOf(current.value);

        if(status==="no_aplica"){return;}

        result.total+=1;
        if(status==="cumple"){
          result.cumplen+=1;
        }else{
          result.noCumplen+=1;
        }
      });

      result.porcentaje=result.total
        ?Math.round((result.cumplen/result.total)*1000)/10
        :0;

      return result;
    }).filter(function(item){return item.total>0;});
  }

  function fixReport(result){
    result=result||{};
    var fixed=recalculate(result.rows,result.compliance);

    result.compliance=fixed;
    if(result.global&&typeof result.global==="object"){
      result.global.cumplimiento=fixed;
    }

    result.diagnostics=result.diagnostics||{};
    result.diagnostics.complianceFix={
      ok:true,
      version:VERSION,
      strategy:"student-requirement-value",
      rows:arr(result.rows).length,
      requirements:fixed.length
    };

    return result;
  }

  function apply(){
    if(!report){throw new Error("COOReport no está disponible.");}
    if(report.__complianceFixApplied===VERSION){return report;}

    var originalBuild=report.build;
    var originalBuildFromRows=report.buildFromRows;
    var originalBuildCompliance=report.buildCompliance;

    if(typeof originalBuild==="function"){
      report.build=function(options){
        return Promise.resolve(originalBuild.call(report,options||{})).then(fixReport);
      };
    }

    if(typeof originalBuildFromRows==="function"){
      report.buildFromRows=function(dataResult,options){
        return fixReport(originalBuildFromRows.call(report,dataResult||{},options||{}));
      };
    }

    if(typeof originalBuildCompliance==="function"){
      report.buildCompliance=function(rows){
        var catalog=originalBuildCompliance.call(report,arr(rows));
        return recalculate(rows,catalog);
      };
    }

    report.__complianceFixApplied=VERSION;
    report.complianceFixVersion=VERSION;
    return report;
  }

  window.COOReportComplianceFix={
    version:VERSION,
    apply:apply,
    recalculate:recalculate,
    fixReport:fixReport
  };

  apply();

  try{
    window.dispatchEvent(new CustomEvent("coordi:compliance-fix-ready",{
      detail:{ok:true,version:VERSION}
    }));
  }catch(error){}
})(window);
