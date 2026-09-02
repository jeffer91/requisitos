/* =========================================================
Nombre completo: cr-def.scheduler.js
Ruta: /Cr-def/cr-def.scheduler.js
Función:
- Generar cronogramas en bloques configurables.
- Validar fechas reales y tribunales completos.
- Respetar ocupación global aunque se genere con filtros.
- Detectar solapamientos reales de aula y tribunal.
========================================================= */
(function(window){
  "use strict";
  var config=window.CR_DEF_CONFIG||{},tpl=window.CR_DEF_TEMPLATES||{};
  var DURACION=Number(config.duracionMinutos||tpl.duration||30);

  function txt(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
  function norm(v){return txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return v;}}
  function pad(n){n=Number(n||0);return n<10?"0"+n:String(n);}
  function parseHora(v){var m=txt(v).replace(/\s+/g,"").match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;var h=Number(m[1]),min=Number(m[2]);return h>=0&&h<=23&&min>=0&&min<=59?h*60+min:null;}
  function fmtHora(min){return pad(Math.floor(min/60))+":"+pad(min%60);}
  function parseRange(value){var m=txt(value).match(/(\d{1,2}:\d{2})\s*(?:a|-|–)\s*(\d{1,2}:\d{2})/i);if(!m)return null;var start=parseHora(m[1]),end=parseHora(m[2]);return start!==null&&end!==null&&end>start?{start:start,end:end}:null;}
  function fecha(v){
    var raw=txt(v),y,m,d,a=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/),b=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(a){y=Number(a[1]);m=Number(a[2]);d=Number(a[3]);}else if(b){d=Number(b[1]);m=Number(b[2]);y=Number(b[3]);}else{return null;}
    var test=new Date(Date.UTC(y,m-1,d));if(test.getUTCFullYear()!==y||test.getUTCMonth()!==m-1||test.getUTCDate()!==d)return null;
    return {iso:y+"-"+pad(m)+"-"+pad(d),label:pad(d)+"/"+pad(m)+"/"+y};
  }
  function fechas(v){var seen={};return txt(v).split(/[\n,;]+/).map(fecha).filter(function(f){if(!f||seen[f.iso])return false;seen[f.iso]=true;return true;});}
  function fechasPorCarrera(v){var out={};txt(v).split(/\n+/).forEach(function(linea){linea=txt(linea);if(!linea)return;var parts=linea.split(/[=:|]/);if(parts.length<2)return;var carrera=norm(parts.shift()),list=fechas(parts.join(","));if(carrera&&list.length)out[carrera]=list;});return out;}
  function carreraKey(carrera){return tpl.detectCareerKey?tpl.detectCareerKey(carrera):norm(carrera);}
  function diasDe(row,opt){var byCareer=opt.porCarrera||{},candidates=[norm(row.carrera),norm(carreraKey(row.carrera))].filter(Boolean),keys=Object.keys(byCareer);for(var i=0;i<keys.length;i++){if(candidates.indexOf(norm(keys[i]))>=0)return byCareer[keys[i]];}return opt.globales||[];}
  function tribunal(id,carrera){var t=id&&tpl.tribunalPorId?tpl.tribunalPorId(id):null;if(!t&&tpl.tribunalesPorCarrera){var list=tpl.tribunalesPorCarrera(carrera)||[];t=list[0]||null;}return t||{tribunal1:"",tribunal2:"",tribunal3:""};}
  function tribunalCompleto(t){return !!(txt(t&&t.tribunal1)&&txt(t&&t.tribunal2)&&txt(t&&t.tribunal3));}
  function plantillas(row){var list=tpl.templatesPorCarrera?tpl.templatesPorCarrera(row.carrera):[];list=Array.isArray(list)?list.slice():[];var sede=norm(row.sede),filtradas=sede?list.filter(function(x){return norm(x.sede)===sede||norm(x.sede)==="mixto";}):[];return filtradas.length?filtradas:list;}
  function slots(row,opt){
    var dias=diasDe(row,opt),out=[],career=carreraKey(row.carrera);
    plantillas(row).forEach(function(p){
      (p.bloques||[]).forEach(function(b){
        if(Array.isArray(b.careerKeys)&&b.careerKeys.length&&b.careerKeys.indexOf(career)<0)return;
        var fixedDate=fecha(b.dia),diasBloque=fixedDate?[fixedDate]:dias,ini=parseHora(b.inicio),fin=parseHora(b.fin),dur=Number(p.duracionMinutos||DURACION),t=tribunal(b.tribunalId,row.carrera);
        if(!tribunalCompleto(t)||ini===null||fin===null||fin<=ini)return;
        diasBloque.forEach(function(d){for(var cur=ini;cur+dur<=fin;cur+=dur){out.push({diaISO:d.iso,dia:d.label,inicio:cur,fin:cur+dur,aula:txt(b.aula),sede:txt(p.sede||row.sede),hora:fmtHora(cur)+" a "+fmtHora(cur+dur),tribunal1:t.tribunal1,tribunal2:t.tribunal2,tribunal3:t.tribunal3,templateId:p.id,tribunalId:b.tribunalId||""});}});
      });
    });
    out.sort(function(a,b){return [a.diaISO,pad(a.inicio),a.aula||"ZZZ",a.templateId].join("|").localeCompare([b.diaISO,pad(b.inicio),b.aula||"ZZZ",b.templateId].join("|"),"es");});
    return out;
  }
  function rangeOf(row){if(row&&Number.isFinite(row.inicio)&&Number.isFinite(row.fin))return {start:row.inicio,end:row.fin};return parseRange(row&&row.hora);}
  function sameDay(a,b){return !!norm(a&&a.dia)&&norm(a&&a.dia)===norm(b&&b.dia);}
  function overlap(a,b){var ra=rangeOf(a),rb=rangeOf(b);return !!(ra&&rb&&ra.start<rb.end&&rb.start<ra.end);}
  function people(row){return [row&&row.tribunal1,row&&row.tribunal2,row&&row.tribunal3].map(norm).filter(Boolean);}
  function slotConflict(a,b){
    if(!a||!b||!sameDay(a,b)||!overlap(a,b))return false;
    var room=norm(a.sede)!=="virtual"&&norm(b.sede)!=="virtual"&&txt(a.aula)&&txt(b.aula)&&norm(a.sede)===norm(b.sede)&&norm(a.aula)===norm(b.aula);
    var pa=people(a),pb=people(b),person=pa.some(function(p){return pb.indexOf(p)>=0;});
    return room||person;
  }
  function conSlot(row,s){var r=clone(row);r.aula=s.aula;r.dia=s.dia;r.hora=s.hora;r.sede=s.sede||r.sede;r.tribunal1=s.tribunal1;r.tribunal2=s.tribunal2;r.tribunal3=s.tribunal3;r.estadoClave="programado";r.estado="Defensa programada";r.cronogramaEstado=r.cronogramaEstado||"BORRADOR";r.alertas=Array.isArray(r.alertas)?r.alertas.filter(function(x){return !/Sin cupo|Choque de|Configuración incompleta/i.test(txt(x));}):[];r.cronograma={templateId:s.templateId,tribunalId:s.tribunalId,fechaISO:s.diaISO,horaInicio:fmtHora(s.inicio),horaFin:fmtHora(s.fin),generadoEn:new Date().toISOString(),estado:r.cronogramaEstado};return r;}
  function sinCupo(row,reason){var r=clone(row);r.aula="";r.dia="";r.hora="";r.estadoClave="sin-cupo";r.estado="Sin defensa asignada";r.alertas=Array.isArray(r.alertas)?r.alertas.slice():[];var msg=reason||"Sin cupo configurado. Agrega otro día, aula u horario.";if(r.alertas.indexOf(msg)<0)r.alertas.push(msg);return r;}
  function tieneHorario(row){return !!(txt(row&&row.dia)&&txt(row&&row.hora));}
  function programable(row){return row&&["apto","supletorio","sin-cupo","programado","conflicto"].indexOf(row.estadoClave)>=0;}
  function clearConflict(row){row=clone(row);row.alertas=Array.isArray(row.alertas)?row.alertas.filter(function(x){return !/^Choque de /i.test(txt(x));}):[];if(row.estadoClave==="conflicto"&&tieneHorario(row)){row.estadoClave="programado";row.estado="Defensa programada";}return row;}
  function detectarConflictos(rows){
    rows=(Array.isArray(rows)?rows:[]).map(clearConflict);
    function marcar(i,msg){rows[i].alertas=Array.isArray(rows[i].alertas)?rows[i].alertas:[];if(rows[i].alertas.indexOf(msg)<0)rows[i].alertas.push(msg);rows[i].estadoClave="conflicto";rows[i].estado="Con conflicto";}
    for(var i=0;i<rows.length;i++){if(!tieneHorario(rows[i]))continue;for(var j=i+1;j<rows.length;j++){if(!tieneHorario(rows[j])||!sameDay(rows[i],rows[j])||!overlap(rows[i],rows[j]))continue;if(norm(rows[i].sede)!=="virtual"&&norm(rows[j].sede)!=="virtual"&&txt(rows[i].aula)&&txt(rows[j].aula)&&norm(rows[i].sede)===norm(rows[j].sede)&&norm(rows[i].aula)===norm(rows[j].aula)){marcar(i,"Choque de aula en horarios solapados.");marcar(j,"Choque de aula en horarios solapados.");}var pi=people(rows[i]),pj=people(rows[j]);if(pi.some(function(p){return pj.indexOf(p)>=0;})){marcar(i,"Choque de tribunal en horarios solapados.");marcar(j,"Choque de tribunal en horarios solapados.");}}}
    return rows;
  }
  function configurationReason(row){var list=plantillas(row);if(!list.length)return "No existe una plantilla de defensa para esta carrera y sede.";return "";}
  function generar(rows,opciones){
    opciones=opciones||{};var opt={globales:fechas(opciones.diasGlobal||""),porCarrera:fechasPorCarrera(opciones.diasCarrera||"")},sinDias=!opt.globales.length&&!Object.keys(opt.porCarrera).length;
    var occupied=(Array.isArray(opciones.existingRows)?opciones.existingRows:[]).filter(tieneHorario).map(clone);(rows||[]).forEach(function(row){if(programable(row)&&tieneHorario(row))occupied.push(clone(row));});
    var out=(rows||[]).map(function(row){
      if(!programable(row))return clone(row);if(tieneHorario(row))return clone(row);if(sinDias)return sinCupo(row,"No hay días de defensa configurados.");
      var lista=slots(row,opt);if(!lista.length)return sinCupo(row,configurationReason(row)||"Configuración incompleta: falta un tribunal de tres integrantes, una plantilla o un horario válido.");
      for(var i=0;i<lista.length;i++){if(!occupied.some(function(current){return slotConflict(lista[i],current);})){var assigned=conSlot(row,lista[i]);occupied.push(clone(assigned));return assigned;}}
      return sinCupo(row);
    });
    out=detectarConflictos(out);
    return {rows:out,resumen:{total:out.length,programados:out.filter(function(r){return r.estadoClave==="programado";}).length,sinCupo:out.filter(function(r){return r.estadoClave==="sin-cupo";}).length,conflictos:out.filter(function(r){return r.estadoClave==="conflicto";}).length,sinDias:sinDias},generatedAt:new Date().toISOString()};
  }
  window.CR_DEF_SCHEDULER=Object.freeze({generar:generar,fechas:fechas,fechasPorCarrera:fechasPorCarrera,slots:slots,detectarConflictos:detectarConflictos,slotConflict:slotConflict});
})(window);
