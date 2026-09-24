/* =========================================================
Nombre completo: stats.defenses.js
Ruta: /Stats/stats.defenses.js
Función:
- Mostrar por carrera quién falta completar el proceso de defensa.
- Reutilizar BDLDefenseEligibility, la misma regla de Defensas y Cr-def.
- Separar requisitos, artículo, defensa, supletorios y completos.
- Permitir abrir el detalle de estudiantes desde cada conteo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-career-defense-tracking";
  var state={
    mode:"pending",
    career:"",
    data:null
  };

  var MODES={
    all:{label:"Todos"},
    pending:{label:"Pendientes"},
    requirements:{label:"Requisitos"},
    article:{label:"Falta Art"},
    defense:{label:"Falta Def"},
    supplement:{label:"Supletorio"},
    supplementArt:{label:"Supletorio Art"},
    supplementDef:{label:"Supletorio Def"},
    complete:{label:"Completos"}
  };

  var QUICK_MODES=[
    "all",
    "pending",
    "requirements",
    "article",
    "defense",
    "supplement",
    "complete"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function fmt(value){
    return value===null||value===undefined||text(value)===""?"—":esc(value);
  }
  function rowsOf(data){
    if(!data){return [];}
    if(data.selectedRequirement&&Array.isArray(data.selectedRequirement.rows)){
      return data.selectedRequirement.rows;
    }
    if(Array.isArray(data.rows)){return data.rows;}
    if(Array.isArray(data.estudiantes)){return data.estudiantes;}
    return [];
  }
  function nameOf(row){
    return text(row&&row._nombres)||
      text(row&&row._bl2Nombre)||
      text(row&&row.Nombres)||
      text(row&&row.nombres)||
      text(row&&row.nombre)||
      "Sin nombre";
  }
  function idOf(row){
    return text(row&&row._cedula)||
      text(row&&row._bl2Id)||
      text(row&&row.cedula)||
      text(row&&row.numeroIdentificacion)||
      "";
  }
  function careerOf(row){
    return text(row&&row._carrera)||
      text(row&&row._bl2Carrera)||
      text(row&&row.NombreCarrera)||
      text(row&&row.nombreCarrera)||
      text(row&&row.carrera)||
      "SIN CARRERA";
  }
  function notesStatus(){
    try{
      if(window.StatsDataPatch&&typeof window.StatsDataPatch.status==="function"){
        return window.StatsDataPatch.status()||{};
      }
    }catch(error){}
    return {phase:"idle",notes:0,error:"",loadedAt:""};
  }
  function selectedPeriod(){
    try{
      if(window.StatsApp&&typeof window.StatsApp.getState==="function"){
        return text(window.StatsApp.getState().periodId||"");
      }
    }catch(error){}
    var node=el("stats-periodo");
    return text(node&&node.value||"");
  }
  function readiness(){
    var periodId=selectedPeriod();
    var status=notesStatus();

    if(!periodId){
      return {ready:false,kind:"idle",message:"Selecciona un período."};
    }

    if(status.phase==="error"){
      return {
        ready:false,
        kind:"error",
        message:"No se pudieron cargar las notas.",
        detail:text(status.error)
      };
    }

    if(
      status.phase==="loading" ||
      text(status.currentPeriod)!==text(periodId)
    ){
      return {
        ready:false,
        kind:"loading",
        message:"Cargando notas del período..."
      };
    }

    if(status.phase!=="ready"){
      return {
        ready:false,
        kind:"loading",
        message:"Preparando notas del período..."
      };
    }

    return {
      ready:true,
      kind:"ready",
      message:"Notas conectadas · "+Number(status.notes||0)+" registros",
      loadedAt:text(status.loadedAt)
    };
  }
  function evaluate(row){
    var engine=window.BDLDefenseEligibility;

    if(engine&&typeof engine.evaluate==="function"){
      return engine.evaluate(row||{});
    }

    var n=row&&row._notas||{};
    var nart=n.nart==null?null:Number(n.nart);
    var ndef=n.ndef==null?null:Number(n.ndef);
    var nfin=n.nfin==null?null:Number(n.nfin);
    var reqOk=!!(row&&row._estado&&row._estado.id==="cumple");
    var stateLabel="Pendiente Art";

    if(nart!==null&&nart<7){stateLabel="Supletorio Art";}
    else if(!reqOk){stateLabel="Sin requisitos";}
    else if(nart===null){stateLabel="Pendiente Art";}
    else if(ndef===null){stateLabel="Pendiente Def";}
    else if(ndef<7){stateLabel="Supletorio Def";}
    else{stateLabel="Completo";}

    return {
      requirementsLoaded:true,
      requirementsOk:reqOk,
      missingRequirements:[],
      nart:nart,
      ndef:ndef,
      nfin:nfin,
      stateLabel:stateLabel
    };
  }
  function decorate(row){
    var d=evaluate(row);
    return {
      row:row,
      nombre:nameOf(row),
      cedula:idOf(row),
      carrera:careerOf(row),
      estado:text(d.stateLabel)||"Pendiente Art",
      nart:d.nart===undefined?null:d.nart,
      ndef:d.ndef===undefined?null:d.ndef,
      nfin:d.nfin===undefined?null:d.nfin,
      faltantes:Array.isArray(d.missingRequirements)?d.missingRequirements.slice():[],
      requirementsLoaded:d.requirementsLoaded!==false,
      requirementsOk:!!d.requirementsOk
    };
  }
  function matchesMode(item,mode){
    mode=MODES[mode]?mode:"pending";
    if(mode==="all"){return true;}
    if(mode==="pending"){return item.estado!=="Completo";}
    if(mode==="requirements"){
      return item.estado==="Requisitos no cargados"||item.estado==="Sin requisitos";
    }
    if(mode==="article"){return item.estado==="Pendiente Art";}
    if(mode==="defense"){return item.estado==="Pendiente Def";}
    if(mode==="supplement"){
      return item.estado==="Supletorio Art"||item.estado==="Supletorio Def";
    }
    if(mode==="supplementArt"){return item.estado==="Supletorio Art";}
    if(mode==="supplementDef"){return item.estado==="Supletorio Def";}
    if(mode==="complete"){return item.estado==="Completo";}
    return true;
  }
  function reasonOf(item){
    if(item.estado==="Requisitos no cargados"){
      return "Requisitos todavía no cargados";
    }
    if(item.estado==="Sin requisitos"){
      return item.faltantes.length
        ? "Falta: "+item.faltantes.join(", ")
        : "Requisitos incompletos";
    }
    if(item.estado==="Pendiente Art"){return "Falta N-ART";}
    if(item.estado==="Supletorio Art"){return "N-ART menor a 7";}
    if(item.estado==="Pendiente Def"){return "Falta N-DEF";}
    if(item.estado==="Supletorio Def"){return "N-DEF menor a 7";}
    return "Proceso completo";
  }
  function grouped(items){
    var map=Object.create(null);

    items.forEach(function(item){
      var key=item.carrera;
      if(!map[key]){
        map[key]={
          carrera:key,
          total:0,
          requirements:0,
          pendingArt:0,
          supArt:0,
          pendingDef:0,
          supDef:0,
          complete:0
        };
      }

      var g=map[key];
      g.total+=1;

      if(item.estado==="Requisitos no cargados"||item.estado==="Sin requisitos"){
        g.requirements+=1;
      }else if(item.estado==="Pendiente Art"){
        g.pendingArt+=1;
      }else if(item.estado==="Supletorio Art"){
        g.supArt+=1;
      }else if(item.estado==="Pendiente Def"){
        g.pendingDef+=1;
      }else if(item.estado==="Supletorio Def"){
        g.supDef+=1;
      }else if(item.estado==="Completo"){
        g.complete+=1;
      }
    });

    return Object.keys(map).map(function(key){return map[key];})
      .sort(function(a,b){
        var ap=a.total-a.complete;
        var bp=b.total-b.complete;
        return bp-ap||b.total-a.total||a.carrera.localeCompare(b.carrera,"es");
      });
  }
  function countButton(value,career,mode,cls){
    var disabled=Number(value||0)===0;
    return '<button type="button" class="stats-defense-count '+esc(cls||"")+'"'+
      ' data-defense-career="'+esc(career)+'" data-defense-mode="'+esc(mode)+'"'+
      (disabled?' disabled':'')+'>'+Number(value||0)+'</button>';
  }
  function careerTable(groups){
    if(!groups.length){
      return '<div class="empty">No hay carreras con los filtros actuales.</div>';
    }

    return '<div class="stats-defense-career-wrap"><table class="stats-defense-career-table">'+
      '<thead><tr>'+
      '<th>Carrera</th><th>Total</th><th>Req.</th><th>P. Art</th><th>S. Art</th><th>P. Def</th><th>S. Def</th><th>Completo</th>'+
      '</tr></thead><tbody>'+
      groups.map(function(g){
        return '<tr>'+
          '<td><button type="button" class="stats-defense-career-name" data-defense-career="'+esc(g.carrera)+'" data-defense-mode="pending">'+esc(g.carrera)+'</button></td>'+
          '<td><strong>'+g.total+'</strong></td>'+
          '<td>'+countButton(g.requirements,g.carrera,"requirements","is-req")+'</td>'+
          '<td>'+countButton(g.pendingArt,g.carrera,"article","is-pending")+'</td>'+
          '<td>'+countButton(g.supArt,g.carrera,"supplementArt","is-sup")+'</td>'+
          '<td>'+countButton(g.pendingDef,g.carrera,"defense","is-pending")+'</td>'+
          '<td>'+countButton(g.supDef,g.carrera,"supplementDef","is-sup")+'</td>'+
          '<td>'+countButton(g.complete,g.carrera,"complete","is-ok")+'</td>'+
        '</tr>';
      }).join("")+
      '</tbody></table></div>';
  }
  function modeButtons(){
    return '<div class="stats-defense-modes">'+
      QUICK_MODES.map(function(key){
        var m=MODES[key];
        return '<button type="button" data-defense-filter="'+esc(key)+'" class="'+(state.mode===key?"is-active":"")+'">'+esc(m.label)+'</button>';
      }).join("")+
      '</div>';
  }
  function detailRows(items){
    var rows=items.filter(function(item){
      if(state.career&&item.carrera!==state.career){return false;}
      return matchesMode(item,state.mode);
    }).sort(function(a,b){
      return a.carrera.localeCompare(b.carrera,"es")||
        a.estado.localeCompare(b.estado,"es")||
        a.nombre.localeCompare(b.nombre,"es");
    });

    var title=(state.career?state.career+" · ":"")+(MODES[state.mode]||MODES.pending).label;
    var titleNode=el("stats-defense-detail-title");
    var metaNode=el("stats-defense-detail-meta");
    if(titleNode){titleNode.textContent=title;}
    if(metaNode){metaNode.textContent=rows.length+" estudiantes";}

    if(!rows.length){
      return '<div class="empty">No hay estudiantes en esta categoría.</div>';
    }

    return '<div class="stats-defense-detail-wrap"><table class="stats-defense-detail-table">'+
      '<thead><tr><th>#</th><th>Estudiante</th><th>Cédula</th><th>Carrera</th><th>N-ART</th><th>N-DEF</th><th>N-FIN</th><th>Estado</th><th>Motivo</th></tr></thead><tbody>'+
      rows.map(function(item,index){
        return '<tr>'+
          '<td>'+(index+1)+'</td>'+
          '<td><strong>'+esc(item.nombre)+'</strong></td>'+
          '<td>'+esc(item.cedula)+'</td>'+
          '<td>'+esc(item.carrera)+'</td>'+
          '<td>'+fmt(item.nart)+'</td>'+
          '<td>'+fmt(item.ndef)+'</td>'+
          '<td>'+fmt(item.nfin)+'</td>'+
          '<td><span class="stats-defense-state '+(item.estado==="Completo"?"is-ok":item.estado.indexOf("Supletorio")===0?"is-sup":"is-pending")+'">'+esc(item.estado)+'</span></td>'+
          '<td>'+esc(reasonOf(item))+'</td>'+
        '</tr>';
      }).join("")+
      '</tbody></table></div>';
  }
  function renderStatus(info){
    var node=el("stats-defense-notes-status");
    if(!node){return;}
    node.className="stats-defense-notes-status is-"+info.kind;
    node.textContent=info.message;
    node.title=info.detail||info.loadedAt||"";

    var retry=el("stats-defense-retry");
    if(retry){
      retry.hidden=info.kind!=="error";
    }
  }
  function render(data){
    state.data=data||{};
    var info=readiness();
    renderStatus(info);

    var careersNode=el("stats-defense-careers");
    var studentsNode=el("stats-defense-students");
    var controlsNode=el("stats-defense-controls");
    var totalNode=el("stats-defense-total");
    var pendingNode=el("stats-defense-pending");
    var completeNode=el("stats-defense-complete");

    if(!careersNode||!studentsNode){return;}

    if(!info.ready){
      careersNode.innerHTML='<div class="empty">'+esc(info.message)+(info.detail?'<small>'+esc(info.detail)+'</small>':'')+'</div>';
      studentsNode.innerHTML='<div class="empty">El detalle aparecerá cuando las notas estén disponibles.</div>';
      if(controlsNode){controlsNode.innerHTML=modeButtons();}
      if(totalNode){totalNode.textContent="0";}
      if(pendingNode){pendingNode.textContent="0";}
      if(completeNode){completeNode.textContent="0";}
      return;
    }

    var items=rowsOf(data).map(decorate);
    var groups=grouped(items);
    var total=items.length;
    var complete=items.filter(function(item){return item.estado==="Completo";}).length;

    if(state.career&&!groups.some(function(g){return g.carrera===state.career;})){
      state.career="";
    }

    if(totalNode){totalNode.textContent=String(total);}
    if(pendingNode){pendingNode.textContent=String(total-complete);}
    if(completeNode){completeNode.textContent=String(complete);}
    if(controlsNode){controlsNode.innerHTML=modeButtons();}

    careersNode.innerHTML=careerTable(groups);
    studentsNode.innerHTML=detailRows(items);
  }
  function setSelection(mode,career){
    state.mode=MODES[mode]?mode:"pending";
    state.career=text(career||"");
    render(state.data||{});
  }
  function bind(){
    var root=el("stats-defensas-section");
    if(!root||root.getAttribute("data-defense-bound")==="1"){return;}

    root.setAttribute("data-defense-bound","1");
    root.addEventListener("click",function(event){
      var filter=event.target.closest("[data-defense-filter]");
      if(filter){
        setSelection(filter.getAttribute("data-defense-filter"),state.career);
        return;
      }

      var count=event.target.closest("[data-defense-mode]");
      if(count){
        setSelection(
          count.getAttribute("data-defense-mode"),
          count.getAttribute("data-defense-career")||""
        );
        return;
      }

      if(event.target.closest("#stats-defense-clear-career")){
        setSelection(state.mode,"");
      }
    });

    var retry=el("stats-defense-retry");
    if(retry){
      retry.addEventListener("click",function(){
        if(window.StatsDataPatch&&typeof window.StatsDataPatch.reload==="function"){
          retry.disabled=true;
          Promise.resolve(window.StatsDataPatch.reload()).finally(function(){
            retry.disabled=false;
          });
        }
      });
    }
  }

  function boot(){bind();}
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }

  window.StatsDefenses={
    version:VERSION,
    render:render,
    evaluate:evaluate,
    decorate:decorate,
    grouped:grouped,
    setSelection:setSelection,
    getState:function(){return Object.assign({},state);}
  };
})(window,document);
