/* =========================================================
Nombre completo: stats.filters.patch.js
Ruta: /Stats/stats.filters.patch.js
Función:
- Conectar el requisito seleccionado con Resumen, Requisitos, Carreras y Estudiantes.
- Hacer que el filtro Estado evalúe el requisito seleccionado.
- Incorporar Telegram como requisito virtual.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-connected-filters";

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function pct(value,total){return total?Math.round((Number(value||0)*10000)/Number(total||0))/100:0;}
  function keyOf(row){return text(row&&row._carrera)||text(row&&row.NombreCarrera)||text(row&&row.carrera)||"SIN CARRERA";}
  function telegramFields(row){
    row=row||{};
    var user=text(row._telegramUser||row.telegramUser||row.usuarioTelegram||row.telegram||"");
    var chatId=text(row._telegramChatId||row.telegramChatId||row.chatIdTelegram||row.chatId||"");
    return {user:user,chatId:chatId,has:!!(user||chatId)};
  }
  function telegramStatus(row){
    var telegram=telegramFields(row);
    return {
      key:"telegram",
      label:"Telegram",
      status:telegram.has?"cumple":"no_cumple",
      labelStatus:telegram.has?"Con Telegram":"Sin Telegram",
      cumple:telegram.has,
      applies:true,
      telegramUser:telegram.user,
      telegramChatId:telegram.chatId
    };
  }
  function isTelegram(key){return norm(key)==="telegram";}
  function groupOf(key){
    key=norm(key);
    if(key==="telegram"){return "telegram";}
    if(key==="aprobaciontitulacion"||key==="aprobacioncomplexivoproyecto"){return "final";}
    return "requisito";
  }
  function labelOf(core,key){
    if(isTelegram(key)){return "Telegram";}
    try{
      if(window.StatsRules&&typeof window.StatsRules.getRequirementByKey==="function"){
        var item=window.StatsRules.getRequirementByKey(key)||{};
        return text(item.label||item.key)||text(key);
      }
    }catch(error){}
    return text(key);
  }
  function statusFor(core,row,key){
    if(isTelegram(key)){return telegramStatus(row);}
    try{
      if(core&&typeof core.requirementStatus==="function"){
        return core.requirementStatus(row,key);
      }
    }catch(error){}
    return {key:key,label:labelOf(core,key),status:"no_cumple",labelStatus:"No cumple",cumple:false,applies:true};
  }
  function decorateRows(core,rows,key){
    return (Array.isArray(rows)?rows:[]).map(function(row){
      var copy=Object.assign({},row||{});
      var status=statusFor(core,copy,key);
      var telegram=telegramFields(copy);
      copy._selectedRequirementStatus=status;
      copy._telegramUser=telegram.user;
      copy._telegramChatId=telegram.chatId;
      copy._hasTelegram=telegram.has;
      return copy;
    });
  }
  function filterStatus(rows,status){
    status=text(status)==="pendiente"?"no_cumple":text(status);
    if(!status){return rows.slice();}
    return rows.filter(function(row){
      var selected=row&&row._selectedRequirementStatus||{};
      return text(selected.status)===status;
    });
  }
  function summary(rows,key,label,group){
    var item={key:key,label:label,group:group,total:rows.length,aplica:0,no_aplica:0,cumple:0,pendiente:0,no_cumple:0,avance:0};
    rows.forEach(function(row){
      var status=row&&row._selectedRequirementStatus||{};
      if(status.applies===false||status.status==="no_aplica"){item.no_aplica+=1;return;}
      item.aplica+=1;
      if(status.cumple||status.status==="cumple"){item.cumple+=1;}
      else{item.no_cumple+=1;}
    });
    item.avance=pct(item.cumple,item.aplica);
    return item;
  }
  function groupCareers(rows){
    var map=Object.create(null);
    rows.forEach(function(row){
      var key=keyOf(row);
      if(!map[key]){map[key]={key:key,label:key,total:0,cumple:0,pendiente:0,no_cumple:0,no_aplica:0,avance:0};}
      var item=map[key];
      var status=row&&row._selectedRequirementStatus||{};
      item.total+=1;
      if(status.applies===false||status.status==="no_aplica"){item.no_aplica+=1;}
      else if(status.cumple||status.status==="cumple"){item.cumple+=1;}
      else{item.no_cumple+=1;}
    });
    return Object.keys(map).map(function(key){
      var item=map[key];
      item.avance=pct(item.cumple,item.cumple+item.no_cumple);
      return item;
    }).sort(function(a,b){return b.total-a.total||a.key.localeCompare(b.key,"es");});
  }
  function uniqueCareers(rows){
    var map=Object.create(null);
    rows.forEach(function(row){var key=keyOf(row);if(key){map[key]=true;}});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }
  function appendTelegramFilter(data){
    data=data||{};
    data.requisitosFiltro=data.requisitosFiltro||{};
    data.requisitosFiltro.requisitos=Array.isArray(data.requisitosFiltro.requisitos)?data.requisitosFiltro.requisitos:[];
    data.requisitosFiltro.finales=Array.isArray(data.requisitosFiltro.finales)?data.requisitosFiltro.finales:[];
    data.requisitosFiltro.telegram=[{key:"telegram",label:"Telegram",group:"telegram"}];
    data.requisitosFiltro.all=(data.requisitosFiltro.requisitos||[]).concat(data.requisitosFiltro.finales||[]).concat(data.requisitosFiltro.telegram);
    return data;
  }
  function requirementSummaryForRows(core,rows,key){
    var decorated=decorateRows(core,rows,key);
    return summary(decorated,key,labelOf(core,key),groupOf(key));
  }
  function rebuildFinals(core,rows,current){
    var keys=["aprobaciontitulacion","aprobacioncomplexivoproyecto"];
    return keys.map(function(key){
      var decorated=decorateRows(core,rows,key);
      return summary(decorated,key,labelOf(core,key),"final");
    }).filter(function(item){return item.label;}).concat([]).slice(0,(Array.isArray(current)&&current.length)||2);
  }
  function install(){
    var core=window.StatsCore;
    if(!core||typeof core.resumen!=="function"||core.__connectedFiltersInstalled){return false;}
    var original=core.resumen;
    core.resumen=function(options){
      options=Object.assign({},options||{});
      var selectedKey=text(options.requirementKey||options.requisito||"");
      var requestedStatus=text(options.status||options.estado||"");
      var baseOptions=selectedKey?Object.assign({},options,{status:"",estado:""}):options;
      var data=appendTelegramFilter(original.call(core,baseOptions)||{});
      if(!selectedKey||data._requiresPeriod){return data;}

      var sourceRows=Array.isArray(data.rows)?data.rows:(Array.isArray(data.estudiantes)?data.estudiantes:[]);
      var decorated=decorateRows(core,sourceRows,selectedKey);
      var rows=filterStatus(decorated,requestedStatus);
      var selectedSummary=summary(rows,selectedKey,labelOf(core,selectedKey),groupOf(selectedKey));

      data.rows=rows;
      data.estudiantes=rows;
      data.total=rows.length;
      data.estados={cumple:selectedSummary.cumple,pendiente:0,no_cumple:selectedSummary.no_cumple};
      data.avanceGeneral=selectedSummary.avance;
      data.selectedRequirement={
        key:selectedKey,
        label:selectedSummary.label,
        group:selectedSummary.group,
        stats:selectedSummary,
        rows:rows
      };
      data.requisitos=[selectedSummary];
      data.carreras=groupCareers(rows);
      data.careerList=uniqueCareers(sourceRows);
      data.requisitosFinales=rebuildFinals(core,rows,data.requisitosFinales);
      if(typeof core.notasResumen==="function"){data.notasResumen=core.notasResumen(rows);}
      data.diagnostics=Object.assign({},data.diagnostics||{}, {
        connectedRequirementFilter:true,
        selectedRequirement:selectedKey,
        selectedStatus:requestedStatus,
        telegramVirtual:isTelegram(selectedKey)
      });
      return data;
    };
    core.telegramStatus=telegramStatus;
    core.hasTelegram=function(row){return telegramFields(row).has;};
    core.__connectedFiltersInstalled=true;
    return true;
  }

  window.StatsFiltersPatch={version:VERSION,install:install,telegramStatus:telegramStatus,hasTelegram:function(row){return telegramFields(row).has;}};
  install();
})(window);
