/* =========================================================
Nombre completo: stats.sede.filter.js
Ruta: /Stats/stats.sede.filter.js
Función:
- Agregar el selector Sede a los filtros superiores de Stats.
- Filtrar todos los cálculos, gráficos, tablas y estudiantes por sede.
- Mantener la lista de sedes del período y matrícula seleccionados.
- Reiniciar la sede cuando cambia el período.
Con qué se conecta:
- Stats/stats.core.js.
- Stats/stats.app.js.
- BDLocal/conexiones/cone.stats.js.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-sede-filter";
  var selectedSede="";
  var lastPeriodId="";
  var lastSedeList=[];
  var installed=false;

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .toLowerCase();
  }
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function titleCase(value){
    value=text(value);
    if(!value){return "";}
    if(value!==value.toUpperCase()){return value;}
    return value.toLocaleLowerCase("es").replace(/(^|[\s\-/])([a-záéíóúüñ])/g,function(all,prefix,letter){
      return prefix+letter.toLocaleUpperCase("es");
    });
  }
  function siteOf(row){
    row=row||{};
    var matricula=row._matricula&&typeof row._matricula==="object"?row._matricula:{};
    return text(
      row._sede||row.sede||row.Sede||row.campus||row.Campus||
      matricula._sede||matricula.sede||matricula.Sede||"Sin sede"
    )||"Sin sede";
  }
  function siteList(rows){
    var map=Object.create(null);
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      var raw=siteOf(row);
      var key=norm(raw);
      if(!key){return;}
      if(!map[key]){map[key]=titleCase(raw);}
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){
      return a.localeCompare(b,"es",{sensitivity:"base"});
    });
  }
  function filterRows(rows){
    rows=Array.isArray(rows)?rows:[];
    var wanted=norm(selectedSede);
    if(!wanted){return rows.slice();}
    return rows.filter(function(row){return norm(siteOf(row))===wanted;});
  }
  function mapResult(result){
    if(Array.isArray(result)){
      lastSedeList=siteList(result);
      return filterRows(result);
    }
    result=result&&typeof result==="object"?result:{};
    var rows=Array.isArray(result.rows)
      ?result.rows
      :Array.isArray(result.estudiantes)
        ?result.estudiantes
        :Array.isArray(result.students)
          ?result.students
          :[];
    lastSedeList=siteList(rows);
    var filtered=filterRows(rows);
    return Object.assign({},result,{
      rows:filtered,
      estudiantes:filtered,
      students:filtered,
      total:filtered.length
    });
  }
  function maybe(value,mapper){
    return value&&typeof value.then==="function"?value.then(mapper):mapper(value);
  }
  function currentRepo(){return window.BDLocalStats||window.ConStats||null;}

  function wrapRepo(){
    var repo=currentRepo();
    if(!repo||repo.__statsSedeFilterWrapped){return !!repo;}
    ["students","getStudents","rows","getRows"].forEach(function(name){
      var original=repo[name];
      if(typeof original!=="function"){return;}
      repo[name]=function(){return maybe(original.apply(repo,arguments),function(rows){
        lastSedeList=siteList(rows);
        return filterRows(rows);
      });};
      repo[name].__statsSedeOriginal=original;
    });
    ["listStudents"].forEach(function(name){
      var original=repo[name];
      if(typeof original!=="function"){return;}
      repo[name]=function(){return maybe(original.apply(repo,arguments),mapResult);};
      repo[name].__statsSedeOriginal=original;
    });
    repo.__statsSedeFilterWrapped=true;
    return true;
  }

  function selectNode(){return document.getElementById("stats-sede");}
  function injectFilter(){
    var tools=document.querySelector(".stats-tools");
    if(!tools){return null;}
    var select=selectNode();
    if(select){return select;}
    var label=document.createElement("label");
    label.setAttribute("data-stats-sede-filter",VERSION);
    label.innerHTML='Sede<select id="stats-sede"><option value="">Todas</option></select>';
    var periodSelect=document.getElementById("stats-periodo");
    var periodLabel=periodSelect&&periodSelect.closest("label");
    if(periodLabel&&periodLabel.parentElement===tools){
      periodLabel.insertAdjacentElement("afterend",label);
    }else{
      tools.insertBefore(label,tools.firstChild);
    }
    select=selectNode();
    if(select){
      select.addEventListener("change",function(){
        selectedSede=text(select.value);
        if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){
          window.StatsCore.invalidate({reason:"sede-change",keepPeriods:true});
        }
        if(window.StatsApp&&typeof window.StatsApp.render==="function"){
          window.StatsApp.render({force:false,reason:"sede-change"});
        }
      });
    }
    return select;
  }
  function fillSelect(list){
    var select=injectFilter();
    if(!select){return;}
    list=Array.isArray(list)?list:[];
    var wanted=norm(selectedSede);
    var valid=!wanted||list.some(function(item){return norm(item)===wanted;});
    if(!valid){selectedSede="";wanted="";}
    select.innerHTML='<option value="">Todas</option>'+list.map(function(item){
      return '<option value="'+esc(item)+'"'+(norm(item)===wanted?' selected':'')+'>'+esc(item)+'</option>';
    }).join("");
    select.value=selectedSede;
  }

  function patchCore(){
    var core=window.StatsCore;
    if(!core||typeof core.resumen!=="function"||core.__sedeFilterPatched){return false;}
    var original=core.resumen;
    core.resumen=function(options){
      options=Object.assign({},options||{});
      var periodId=text(options.periodId||options.periodoId||"");
      if(lastPeriodId!==periodId){
        lastPeriodId=periodId;
        selectedSede="";
        var node=selectNode();
        if(node){node.value="";}
        if(typeof core.invalidate==="function"){
          core.invalidate({reason:"sede-period-change",keepPeriods:true});
        }
      }
      wrapRepo();
      var data=original.call(core,options)||{};
      data.sedeList=lastSedeList.slice();
      data.selectedSede=selectedSede;
      if(data.diagnostics&&typeof data.diagnostics==="object"){
        data.diagnostics.filters=Object.assign({},data.diagnostics.filters||{}, {sede:selectedSede});
      }
      fillSelect(data.sedeList);
      return data;
    };
    core.sites=function(){return lastSedeList.slice();};
    core.sedeOf=siteOf;
    core.__sedeFilterPatched=VERSION;
    return true;
  }

  function patchAppState(){
    var app=window.StatsApp;
    if(!app||typeof app.getState!=="function"||app.__sedeStatePatched){return false;}
    var original=app.getState;
    app.getState=function(){
      return Object.assign({},original.call(app)||{}, {sede:selectedSede});
    };
    app.__sedeStatePatched=VERSION;
    return true;
  }

  function install(){
    injectFilter();
    wrapRepo();
    patchCore();
    patchAppState();
    installed=true;
    return true;
  }

  window.StatsSedeFilter={
    version:VERSION,
    install:install,
    siteOf:siteOf,
    getSelected:function(){return selectedSede;},
    setSelected:function(value){
      selectedSede=text(value);
      var node=selectNode();
      if(node){node.value=selectedSede;}
      if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){
        window.StatsCore.invalidate({reason:"sede-api-change",keepPeriods:true});
      }
      if(window.StatsApp&&typeof window.StatsApp.render==="function"){
        window.StatsApp.render({force:false,reason:"sede-api-change"});
      }
    },
    status:function(){return {ok:installed,selected:selectedSede,sites:lastSedeList.slice()};}
  };

  install();
  window.addEventListener("stats:bootstrap-ready",function(){install();});
  window.setTimeout(function(){install();patchAppState();},0);
})(window,document);
