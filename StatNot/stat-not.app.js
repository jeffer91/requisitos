/* Interfaz de Stat Not. Solo lectura; toda elegibilidad proviene de BDLDefenseEligibility. */
(function(window,document){
  "use strict";
  var state={periods:[],base:[],filtered:[],quick:"",search:"",started:false};
  function el(id){return document.getElementById(id);}
  function text(v){return window.StatNotModel.text(v);}
  function esc(v){return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
  function num(v){return v===null||v===undefined?"—":String(Math.round(Number(v)*100)/100).replace(".",",");}
  function percent(v){return (Number(v)||0).toLocaleString("es-EC",{maximumFractionDigits:1})+"%";}
  function con(){return window.ConStatNot;}
  function model(){return window.StatNotModel;}
  function value(id){return el(id)?el(id).value:"";}
  function status(message,type){var node=el("statnot-status");if(node){node.textContent=message;node.className="statnot-status "+(type||"");}}
  function periodId(p){return text(p&&(p.id||p.periodoId||p.periodId||p.codigo||p.value));}
  function periodLabel(p){return text(p&&(p.nombre||p.label||p.periodo||p.NombrePeriodo||p.descripcion||p.name||periodId(p)))||"Período";}
  function isActivePeriod(p){var v=text(p&&(p.estado||p.status||p.activo||p.active)).toLowerCase();return p&&(p.activo===true||p.active===true||v==="activo"||v==="true"||v==="1");}
  function studentHaystack(x){return model().norm([x._snCedula,x._snNombre,x._snCarrera,x._snDivision,x._snSede].join(" "));}
  function unique(items,key){var map=Object.create(null);(items||[]).forEach(function(x){var v=text(x[key]);if(v)map[v]=true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es",{sensitivity:"base"});});}
  function setOptions(node,values,allLabel,keep){if(!node)return;var previous=keep===undefined?node.value:keep;node.innerHTML='<option value="">'+esc(allLabel)+"</option>"+values.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+"</option>";}).join("");if(values.indexOf(previous)>=0)node.value=previous;}
  function kpi(label,valueValue,sub,cls){return '<article class="statnot-kpi '+(cls||"")+'"><span>'+esc(label)+'</span><strong>'+esc(valueValue)+'</strong><small>'+esc(sub||"")+'</small></article>';}
  function renderKpis(id,cards){var node=el(id);if(node)node.innerHTML=cards.join("");}
  function bar(label,count,total,cls,display){var p=model().pct(count,total);return '<div class="statnot-bar-row"><span class="statnot-bar-label" title="'+esc(label)+'">'+esc(label)+'</span><div class="statnot-bar-track"><div class="statnot-bar-fill '+(cls||"")+'" style="width:'+Math.min(100,p)+'%"></div></div><span class="statnot-bar-value">'+esc(display||percent(p))+'</span></div>';}
  function wrapTable(head,rows,empty){return '<div class="statnot-table-wrap"><table class="statnot-table"><thead><tr>'+head.map(function(h){return '<th class="'+(h.num?'num':'')+'">'+esc(h.label)+'</th>';}).join("")+'</tr></thead><tbody>'+(rows.length?rows.join(""):'<tr><td colspan="'+head.length+'" class="statnot-empty">'+esc(empty||"Sin datos para los filtros seleccionados.")+'</td></tr>')+'</tbody></table></div>';}
  function detailButton(value,kind,career){return '<button type="button" class="statnot-count" data-detail="'+esc(kind)+'" data-career="'+encodeURIComponent(career||"")+'">'+esc(String(value))+'</button>';}
  function progress(p){return '<div class="statnot-progress"><div class="statnot-progress-track"><i style="width:'+Math.min(100,Number(p)||0)+'%"></i></div><span>'+esc(percent(p))+'</span></div>';}

  function decorateRows(rows){return (Array.isArray(rows)?rows:[]).map(function(row){try{return model().decorate(row);}catch(error){return null;}}).filter(Boolean);}
  function localFilter(){
    var sede=value("statnot-sede"),division=value("statnot-division"),career=value("statnot-carrera"),statusValue=value("statnot-estado");
    state.filtered=state.base.filter(function(x){
      return (!sede||x._snSede===sede)&&(!division||x._snDivision===division)&&(!career||x._snCarrera===career)&&model().matchState(x,statusValue);
    });
    renderAll();
  }
  function renderDynamicFilters(){setOptions(el("statnot-sede"),unique(state.base,"_snSede"),"Todas");setOptions(el("statnot-division"),unique(state.base,"_snDivision"),"Todas");setOptions(el("statnot-carrera"),unique(state.base,"_snCarrera"),"Todas");}
  function loadStudents(){
    var pid=value("statnot-period"),matricula=value("statnot-matricula");
    if(!pid){state.base=[];state.filtered=[];renderAll();status("Seleccione un período para analizar notas.","is-info");return Promise.resolve();}
    status("Analizando notas y elegibilidad del período...","is-info");el("statnot-refresh").disabled=true;
    return con().listStudents({periodoId:pid,matricula:matricula}).then(function(rows){state.base=decorateRows(rows);renderDynamicFilters();localFilter();status("Listo: "+state.filtered.length+" estudiantes en la vista actual.","is-ok");}).catch(function(error){state.base=[];state.filtered=[];renderAll();status("No se pudieron leer las notas: "+(error.message||String(error)),"is-warn");}).finally(function(){el("statnot-refresh").disabled=false;});
  }
  function loadPeriods(){
    return con().listPeriods().then(function(periods){
      state.periods=Array.isArray(periods)?periods:[];var node=el("statnot-period");node.innerHTML=state.periods.map(function(p){return '<option value="'+esc(periodId(p))+'">'+esc(periodLabel(p))+'</option>';}).join("");
      if(!state.periods.length){node.innerHTML='<option value="">Sin períodos</option>';return;}
      var active=state.periods.find(isActivePeriod);node.value=periodId(active||state.periods[0]);
    });
  }

  function renderSummary(){
    var s=model().summarize(state.filtered),total=s.total;
    renderKpis("statnot-summary-kpis",[
      kpi("Total estudiantes",s.total,"Universo filtrado"),kpi("Req. completos",s.requirementsComplete,"Listos por requisitos","is-blue"),kpi("Habilitados N-DEF",s.eligible,"Req. completos + N-ART ≥ 7","is-blue"),kpi("Aprobados",s.approved,"Proceso aprobado","is-good"),
      kpi("Reprobados",s.failed,"Requieren supletorio","is-bad"),kpi("Faltan notas",s.missingNotes,"N-ART o N-DEF habilitada","is-warn"),kpi("Completos",s.complete,"Defensa aprobada","is-good"),kpi("Avance",percent(s.advancePct),s.complete+" de "+s.total,"is-blue")
    ]);
    el("statnot-general-bars").innerHTML=[bar("Aprobados",s.approved,total,"is-good"),bar("Reprobados",s.failed,total,"is-bad"),bar("Faltan notas",s.missingNotes,total,"is-warn"),bar("Req. pendientes",s.requirementsIncomplete+s.requirementsNotLoaded,total,"")].join("");
    el("statnot-coverage-bars").innerHTML=[bar("N-ART",s.withArt,total,"is-good"),bar("N-DEF",s.withDef,total,"is-good"),bar("N-FIN",s.withFinal,total,"is-good")].join("");
    var top=model().groups(state.filtered,"_snCarrera").sort(function(a,b){return b.summary.missingNotes-a.summary.missingNotes;}).slice(0,8);
    el("statnot-top-pending").innerHTML=top.length?'<div class="statnot-bars">'+top.map(function(g){return bar(g.label,g.summary.missingNotes,Math.max(1,g.summary.total),"is-warn",g.summary.missingNotes+" / "+g.summary.total);}).join("")+'</div>':'<div class="statnot-empty">Sin carreras para mostrar.</div>';
    var selected=state.periods.find(function(p){return periodId(p)===value("statnot-period");});el("statnot-scope").textContent=(selected?periodLabel(selected):"Sin período")+" · "+s.total+" estudiantes";
  }
  function renderCareers(){
    var groups=model().groups(state.filtered,"_snCarrera"),s=model().summarize(state.filtered);
    renderKpis("statnot-career-kpis",[kpi("Carreras",groups.length,"Con estudiantes"),kpi("Habilitados N-DEF",s.eligible,"En todas las carreras","is-blue"),kpi("Faltan notas",s.missingNotes,"Pendientes reales","is-warn"),kpi("Avance general",percent(s.advancePct),s.complete+" completos","is-good")]);
    var head=[{label:"Carrera"},{label:"Total",num:1},{label:"Hab. N-DEF",num:1},{label:"Falta N-ART",num:1},{label:"Falta N-DEF",num:1},{label:"Aprobados",num:1},{label:"Reprob./Sup.",num:1},{label:"Completos",num:1},{label:"Avance"}];
    var rows=groups.map(function(g){var x=g.summary,c=g.label;return '<tr><td class="statnot-name">'+esc(c)+'</td><td class="num">'+detailButton(x.total,"all",c)+'</td><td class="num">'+detailButton(x.eligible,"eligible",c)+'</td><td class="num">'+detailButton(x.missingArt,"missingArt",c)+'</td><td class="num">'+detailButton(x.missingDef,"missingDef",c)+'</td><td class="num">'+detailButton(x.approved,"approved",c)+'</td><td class="num">'+detailButton(x.failed,"failed",c)+'</td><td class="num">'+detailButton(x.complete,"complete",c)+'</td><td>'+progress(x.advancePct)+'</td></tr>';});
    el("statnot-careers-table").innerHTML=wrapTable(head,rows);
  }
  function renderCoverage(){
    var s=model().summarize(state.filtered),total=s.total;
    renderKpis("statnot-coverage-kpis",[kpi("Con N-ART",s.withArt,percent(model().pct(s.withArt,total)),"is-good"),kpi("Sin N-ART",s.missingArt,"N-ART siempre puede registrarse","is-warn"),kpi("Con N-DEF",s.withDef,percent(model().pct(s.withDef,total)),"is-good"),kpi("Falta N-DEF",s.missingDef,"Solo habilitados","is-warn"),kpi("Con N-FIN",s.withFinal,percent(model().pct(s.withFinal,total)),"is-good"),kpi("Notas completas",s.complete,percent(s.advancePct),"is-blue")]);
    el("statnot-coverage-detail-bars").innerHTML=[bar("N-ART registrado",s.withArt,total,"is-good"),bar("N-DEF registrado",s.withDef,total,"is-good"),bar("N-FIN disponible",s.withFinal,total,"is-good"),bar("Proceso completo",s.complete,total,"is-good")].join("");
    var head=[{label:"Carrera"},{label:"Total",num:1},{label:"N-ART",num:1},{label:"N-DEF",num:1},{label:"N-FIN",num:1},{label:"Falta ART",num:1},{label:"Falta DEF hab.",num:1},{label:"Completo"}];
    var rows=model().groups(state.filtered,"_snCarrera").map(function(g){var x=g.summary;return '<tr><td class="statnot-name">'+esc(g.label)+'</td><td class="num">'+x.total+'</td><td class="num">'+x.withArt+' <span class="statnot-sub">'+percent(model().pct(x.withArt,x.total))+'</span></td><td class="num">'+x.withDef+' <span class="statnot-sub">'+percent(model().pct(x.withDef,x.total))+'</span></td><td class="num">'+x.withFinal+'</td><td class="num">'+detailButton(x.missingArt,"missingArt",g.label)+'</td><td class="num">'+detailButton(x.missingDef,"missingDef",g.label)+'</td><td>'+progress(x.advancePct)+'</td></tr>';});
    el("statnot-coverage-table").innerHTML=wrapTable(head,rows);
  }
  function renderApproval(){
    var s=model().summarize(state.filtered);
    renderKpis("statnot-approval-kpis",[kpi("Evaluados",s.evaluated,"Con resultado"),kpi("Aprobados",s.approved,percent(s.approvalPct),"is-good"),kpi("Reprob. N-ART",s.failedArt,"N-ART < 7","is-bad"),kpi("Reprob. N-DEF",s.failedDef,"N-DEF < 7","is-bad"),kpi("% aprobación",percent(s.approvalPct),"Sobre evaluados","is-blue"),kpi("Promedio N-FIN",num(s.avgFinal),"Final disponible","is-blue")]);
    var groups=model().groups(state.filtered,"_snCarrera").filter(function(g){return g.summary.evaluated>0;}).sort(function(a,b){return b.summary.approvalPct-a.summary.approvalPct;});
    el("statnot-approval-bars").innerHTML=groups.length?groups.map(function(g){return bar(g.label,g.summary.approved,g.summary.evaluated,g.summary.approvalPct>=70?"is-good":"is-warn",percent(g.summary.approvalPct)+" · "+g.summary.approved+"/"+g.summary.evaluated);}).join(""):'<div class="statnot-empty">Todavía no hay estudiantes evaluados.</div>';
  }
  function renderPending(){
    var s=model().summarize(state.filtered),groups=model().groups(state.filtered,"_snCarrera");
    renderKpis("statnot-pending-kpis",[kpi("Req. incompletos",s.requirementsIncomplete,"Requisitos cargados","is-warn"),kpi("Req. no cargados",s.requirementsNotLoaded,"Sin lectura de requisitos","is-warn"),kpi("Falta N-ART",s.missingArt,"N-ART no depende de requisitos","is-warn"),kpi("Falta N-DEF",s.missingDef,"Solo habilitados","is-warn"),kpi("Falta N-FIN",s.missingFinal,"Calculable con ART + DEF"),kpi("Faltan notas",s.missingNotes,"Estudiantes únicos","is-bad")]);
    var head=[{label:"Carrera"},{label:"Total",num:1},{label:"Req. incompletos",num:1},{label:"Req. no cargados",num:1},{label:"Falta N-ART",num:1},{label:"Falta N-DEF hab.",num:1},{label:"Faltan notas",num:1}];
    var rows=groups.map(function(g){var x=g.summary;return '<tr><td class="statnot-name">'+esc(g.label)+'</td><td class="num">'+x.total+'</td><td class="num">'+detailButton(x.requirementsIncomplete,"reqIncomplete",g.label)+'</td><td class="num">'+detailButton(x.requirementsNotLoaded,"reqNotLoaded",g.label)+'</td><td class="num">'+detailButton(x.missingArt,"missingArt",g.label)+'</td><td class="num">'+detailButton(x.missingDef,"missingDef",g.label)+'</td><td class="num">'+detailButton(x.missingNotes,"pending",g.label)+'</td></tr>';});
    el("statnot-pending-table").innerHTML=wrapTable(head,rows);
  }
  function renderSupplements(){
    var s=model().summarize(state.filtered),groups=model().groups(state.filtered,"_snCarrera");
    renderKpis("statnot-supp-kpis",[kpi("Supletorio N-ART",s.supplementArt,"N-ART < 7","is-bad"),kpi("Supletorio N-DEF",s.supplementDef,"N-DEF < 7","is-bad"),kpi("Total supletorios",s.supplement,"Estudiantes únicos","is-warn"),kpi("Incidencia",percent(model().pct(s.supplement,s.total)),"Sobre total filtrado","is-blue")]);
    var head=[{label:"Carrera"},{label:"Total",num:1},{label:"Sup. N-ART",num:1},{label:"Sup. N-DEF",num:1},{label:"Supletorios",num:1},{label:"% carrera"}];
    var rows=groups.filter(function(g){return g.summary.supplement>0;}).map(function(g){var x=g.summary;return '<tr><td class="statnot-name">'+esc(g.label)+'</td><td class="num">'+x.total+'</td><td class="num">'+detailButton(x.supplementArt,"failedArt",g.label)+'</td><td class="num">'+detailButton(x.supplementDef,"failedDef",g.label)+'</td><td class="num">'+detailButton(x.supplement,"supplement",g.label)+'</td><td>'+progress(model().pct(x.supplement,x.total))+'</td></tr>';});
    el("statnot-supp-table").innerHTML=wrapTable(head,rows,"No hay supletorios con estos filtros.");
  }
  function stateClass(x){return x._snApproved?"is-good":(x._snFailed?"is-bad":(x._snMissingNotes||x._snBlocked?"is-warn":""));}
  function studentTable(items){
    var head=[{label:"Cédula"},{label:"Estudiante"},{label:"Carrera"},{label:"Requisitos"},{label:"N-ART",num:1},{label:"N-DEF",num:1},{label:"N-FIN",num:1},{label:"Estado"}];
    var rows=items.map(function(x){var req=!x._snRequirementsLoaded?"No cargados":(x._snRequirementsOk?"Completos":"Incompletos");return '<tr><td>'+esc(x._snCedula||"—")+'</td><td><span class="statnot-name">'+esc(x._snNombre)+'</span><span class="statnot-sub">'+esc(x._snSede+" · "+x._snDivision)+'</span></td><td>'+esc(x._snCarrera)+'</td><td><span class="statnot-state '+(x._snRequirementsOk?"is-good":"is-warn")+'">'+esc(req)+'</span></td><td class="num">'+esc(num(x._snNart))+'</td><td class="num">'+esc(num(x._snNdef))+'</td><td class="num">'+esc(num(x._snNfin))+'</td><td><span class="statnot-state '+stateClass(x)+'">'+esc(x._snState)+'</span></td></tr>';});
    return wrapTable(head,rows);
  }
  function renderStudents(){
    var query=model().norm(state.search),items=state.filtered.filter(function(x){return model().matchState(x,state.quick)&&(!query||studentHaystack(x).indexOf(query)>=0);});
    el("statnot-student-count").textContent=items.length+" estudiantes";el("statnot-students-table").innerHTML=studentTable(items);
  }
  function renderAll(){renderSummary();renderCareers();renderCoverage();renderApproval();renderPending();renderSupplements();renderStudents();}

  function detailPredicate(kind){
    if(kind==="all")return function(){return true;};
    if(kind==="reqIncomplete")return function(x){return x._snRequirementsLoaded&&!x._snRequirementsOk;};
    if(kind==="reqNotLoaded")return function(x){return !x._snRequirementsLoaded;};
    var map={eligible:"eligible",approved:"approved",failed:"failed",missingArt:"missingArt",missingDef:"missingDef",pending:"pending",complete:"complete",supplement:"supplement"};
    if(kind==="failedArt")return function(x){return x._snFailedArt;};if(kind==="failedDef")return function(x){return x._snFailedDef;};
    return function(x){return model().matchState(x,map[kind]||"");};
  }
  function detailLabel(kind){return {all:"Todos",eligible:"Habilitados N-DEF",approved:"Aprobados",failed:"Reprobados",missingArt:"Falta N-ART",missingDef:"Falta N-DEF habilitada",pending:"Faltan notas",complete:"Completos",supplement:"Supletorios",failedArt:"Supletorio N-ART",failedDef:"Supletorio N-DEF",reqIncomplete:"Requisitos incompletos",reqNotLoaded:"Requisitos no cargados"}[kind]||"Detalle";}
  function openDetail(kind,career){var items=state.filtered.filter(function(x){return (!career||x._snCarrera===career)&&detailPredicate(kind)(x);});el("statnot-modal-eyebrow").textContent=career||"Vista filtrada";el("statnot-modal-title").textContent=detailLabel(kind);el("statnot-modal-body").innerHTML='<div class="statnot-modal-summary">'+items.length+' estudiantes</div>'+studentTable(items);el("statnot-modal").hidden=false;el("statnot-modal").setAttribute("aria-hidden","false");}
  function closeModal(){el("statnot-modal").hidden=true;el("statnot-modal").setAttribute("aria-hidden","true");}
  function showSection(name){document.querySelectorAll("[data-statnot-panel]").forEach(function(n){var active=n.getAttribute("data-statnot-panel")===name;n.classList.toggle("is-active",active);n.hidden=!active;});document.querySelectorAll("[data-statnot-section]").forEach(function(n){n.classList.toggle("is-active",n.getAttribute("data-statnot-section")===name);});}
  function bind(){
    document.querySelectorAll("[data-statnot-section]").forEach(function(btn){btn.addEventListener("click",function(){showSection(btn.getAttribute("data-statnot-section"));});});
    ["statnot-sede","statnot-division","statnot-carrera","statnot-estado"].forEach(function(id){el(id).addEventListener("change",localFilter);});
    ["statnot-period","statnot-matricula"].forEach(function(id){el(id).addEventListener("change",loadStudents);});
    el("statnot-refresh").addEventListener("click",function(){status("Actualizando lectura local...","is-info");con().refresh().then(loadStudents).catch(function(error){status(error.message||String(error),"is-warn");});});
    el("statnot-search").addEventListener("input",function(){state.search=this.value;renderStudents();});
    el("statnot-quick-filters").addEventListener("click",function(event){var btn=event.target.closest("[data-quick]");if(!btn)return;state.quick=btn.getAttribute("data-quick");this.querySelectorAll("[data-quick]").forEach(function(n){n.classList.toggle("is-active",n===btn);});renderStudents();});
    document.addEventListener("click",function(event){var btn=event.target.closest("[data-detail]");if(btn){openDetail(btn.getAttribute("data-detail"),decodeURIComponent(btn.getAttribute("data-career")||""));return;}if(event.target.closest("[data-close-modal]")||event.target===el("statnot-modal"))closeModal();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape")closeModal();});
  }
  function start(){if(state.started)return Promise.resolve();state.started=true;bind();return loadPeriods().then(loadStudents);}
  window.StatNotApp={version:"1.0.0",start:start,state:state,render:renderAll};
})(window,document);
