/* =========================================================
Nombre completo: cr-def.scheduler.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.scheduler.js
Función o funciones:
- Generar cronograma automático de defensas para estudiantes aptos.
- Usar bloques de 30 minutos y plantillas quemadas.
- No inventar días: usa únicamente los días escritos en la pantalla.
- Marcar sin cupo si faltan días, aulas u horarios.
- Evitar doble asignación de la misma aula en el mismo día y hora.
- Conservar defensas ya programadas para no duplicarlas.
- Detectar cruces de aula y tribunal.
Con qué se conecta:
- cr-def.config.js
- cr-def.templates.js
- cr-def.js
- cr-def.scheduler.bridge.js
========================================================= */
(function(window){
  "use strict";

  var config = window.CR_DEF_CONFIG || {};
  var tpl = window.CR_DEF_TEMPLATES || {};
  var DURACION = Number(config.duracionMinutos || tpl.duration || 30);

  function txt(v){ return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function norm(v){ return txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function compact(v){ return norm(v).replace(/_/g, ""); }
  function clone(v){ try{ return JSON.parse(JSON.stringify(v)); }catch(e){ return v; } }
  function pad(n){ n = Number(n || 0); return n < 10 ? "0" + n : String(n); }

  function parseHora(v){
    var m = txt(v).replace(/\s+/g, "").match(/^(\d{1,2}):(\d{1,2})$/);
    if(!m){ return null; }
    var h = Number(m[1]);
    var min = Number(m[2]);
    if(h < 0 || h > 23 || min < 0 || min > 59){ return null; }
    return h * 60 + min;
  }

  function fmtHora(min){
    min = Number(min || 0);
    return pad(Math.floor(min / 60)) + ":" + pad(min % 60);
  }

  function fecha(v){
    var raw = txt(v);
    var a = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(a){ return { iso: a[1] + "-" + pad(a[2]) + "-" + pad(a[3]), label: pad(a[3]) + "/" + pad(a[2]) + "/" + a[1] }; }
    var b = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(b){ return { iso: b[3] + "-" + pad(b[2]) + "-" + pad(b[1]), label: pad(b[1]) + "/" + pad(b[2]) + "/" + b[3] }; }
    return null;
  }

  function fechas(v){
    var seen = {};
    return txt(v).split(/[\n,;]+/).map(fecha).filter(function(f){
      if(!f || seen[f.iso]){ return false; }
      seen[f.iso] = true;
      return true;
    });
  }

  function fechasPorCarrera(v){
    var out = {};
    txt(v).split(/\n+/).forEach(function(linea){
      linea = txt(linea);
      if(!linea){ return; }
      var parts = linea.split(/[=:|]/);
      if(parts.length < 2){ return; }
      var carrera = norm(parts.shift());
      var list = fechas(parts.join(","));
      if(carrera && list.length){ out[carrera] = list; }
    });
    return out;
  }

  function carreraKey(carrera){
    return tpl.detectCareerKey ? tpl.detectCareerKey(carrera) : norm(carrera);
  }

  function diasDe(row, opt){
    var byCareer = opt.porCarrera || {};
    var candidates = [
      norm(row.carrera),
      compact(row.carrera),
      norm(carreraKey(row.carrera)),
      compact(carreraKey(row.carrera))
    ].filter(Boolean);

    var keys = Object.keys(byCareer);
    for(var i = 0; i < keys.length; i += 1){
      var key = keys[i];
      if(candidates.indexOf(norm(key)) >= 0 || candidates.indexOf(compact(key)) >= 0){
        return byCareer[key];
      }
    }

    return opt.globales || [];
  }

  function tribunal(id, carrera){
    var t = id && tpl.tribunalPorId ? tpl.tribunalPorId(id) : null;
    if(!t && tpl.tribunalesPorCarrera){
      var list = tpl.tribunalesPorCarrera(carrera) || [];
      t = list[0] || null;
    }
    return t || { tribunal1:"", tribunal2:"", tribunal3:"" };
  }

  function plantillas(row){
    var list = tpl.templatesPorCarrera ? tpl.templatesPorCarrera(row.carrera) : [];
    list = Array.isArray(list) ? list.slice() : [];
    var sede = norm(row.sede);
    var filtradas = sede ? list.filter(function(x){ return norm(x.sede) === sede || norm(x.sede) === "mixto"; }) : [];
    return filtradas.length ? filtradas : list;
  }

  function slots(row, opt){
    var dias = diasDe(row, opt);
    var out = [];
    plantillas(row).forEach(function(p){
      (p.bloques || []).forEach(function(b){
        var fixedDate = fecha(b.dia);
        var diasBloque = fixedDate ? [fixedDate] : dias;
        var ini = parseHora(b.inicio);
        var fin = parseHora(b.fin);
        var dur = Number(p.duracionMinutos || DURACION);
        if(ini == null || fin == null || fin <= ini){ return; }
        diasBloque.forEach(function(d){
          for(var cur = ini; cur + dur <= fin; cur += dur){
            var t = tribunal(b.tribunalId, row.carrera);
            out.push({
              key:[d.iso, cur, cur + dur, p.sede || row.sede, b.aula || "", b.tribunalId || "", p.id].join("|"),
              diaISO:d.iso,
              dia:d.label,
              inicio:cur,
              aula:txt(b.aula),
              sede:txt(p.sede || row.sede),
              hora:fmtHora(cur) + " a " + fmtHora(cur + dur),
              tribunal1:t.tribunal1 || "",
              tribunal2:t.tribunal2 || "",
              tribunal3:t.tribunal3 || "",
              templateId:p.id,
              tribunalId:b.tribunalId || ""
            });
          }
        });
      });
    });
    out.sort(function(a, b){ return [a.diaISO, pad(a.inicio), a.aula || "ZZZ", a.templateId].join("|").localeCompare([b.diaISO, pad(b.inicio), b.aula || "ZZZ", b.templateId].join("|"), "es"); });
    return out;
  }

  function ocupacionSlot(s){
    var extraSinAula = txt(s.aula) ? "" : [s.templateId, s.tribunalId].join("|");
    return [s.dia, s.hora, s.sede, s.aula || "SIN_AULA", extraSinAula].map(norm).join("|");
  }

  function ocupacionRow(r){
    var cr = r && r.cronograma ? r.cronograma : {};
    var extraSinAula = txt(r.aula) ? "" : [cr.templateId || "", cr.tribunalId || ""].join("|");
    return [r.dia, r.hora, r.sede, r.aula || "SIN_AULA", extraSinAula].map(norm).join("|");
  }

  function conSlot(row, s){
    var r = clone(row);
    r.aula = s.aula;
    r.dia = s.dia;
    r.hora = s.hora;
    r.sede = s.sede || r.sede;
    r.tribunal1 = s.tribunal1;
    r.tribunal2 = s.tribunal2;
    r.tribunal3 = s.tribunal3;
    r.estadoClave = "programado";
    r.estado = "Defensa programada";
    r.alertas = Array.isArray(r.alertas) ? r.alertas.filter(function(x){ return txt(x).indexOf("Sin cupo") === -1; }) : [];
    r.cronograma = { templateId:s.templateId, tribunalId:s.tribunalId, generadoEn:new Date().toISOString() };
    return r;
  }

  function sinCupo(row){
    var r = clone(row);
    r.aula = "";
    r.dia = "";
    r.hora = "";
    r.estadoClave = "sin-cupo";
    r.estado = "Sin defensa asignada";
    r.alertas = Array.isArray(r.alertas) ? r.alertas.slice() : [];
    if(!r.alertas.some(function(x){ return txt(x).indexOf("Sin cupo") >= 0; })){
      r.alertas.push("Sin cupo configurado. Agrega otro día, aula u horario.");
    }
    return r;
  }

  function tieneHorario(row){ return !!(txt(row.dia) && txt(row.hora)); }
  function programable(row){ return row && ["apto", "supletorio", "sin-cupo", "programado"].indexOf(row.estadoClave) >= 0; }

  function detectarConflictos(rows){
    var aulas = {};
    var personas = {};
    rows.forEach(function(r, i){
      if(!tieneHorario(r)){ return; }
      var kHora = norm(r.dia) + "|" + norm(r.hora);
      if(norm(r.sede) !== "virtual" && txt(r.aula)){
        var ka = kHora + "|" + norm(r.sede) + "|" + norm(r.aula);
        (aulas[ka] = aulas[ka] || []).push(i);
      }
      [r.tribunal1, r.tribunal2, r.tribunal3].map(norm).filter(Boolean).forEach(function(p){
        (personas[kHora + "|" + p] = personas[kHora + "|" + p] || []).push(i);
      });
    });

    function marcar(i, msg){
      rows[i].alertas = Array.isArray(rows[i].alertas) ? rows[i].alertas : [];
      if(rows[i].alertas.indexOf(msg) < 0){ rows[i].alertas.push(msg); }
      rows[i].estadoClave = "conflicto";
      rows[i].estado = "Con conflicto";
    }

    Object.keys(aulas).forEach(function(k){ if(aulas[k].length > 1){ aulas[k].forEach(function(i){ marcar(i, "Choque de aula en el mismo día y hora."); }); } });
    Object.keys(personas).forEach(function(k){ if(personas[k].length > 1){ personas[k].forEach(function(i){ marcar(i, "Choque de tribunal en el mismo día y hora."); }); } });
    return rows;
  }

  function generar(rows, opciones){
    opciones = opciones || {};
    var opt = {
      globales: fechas(opciones.diasGlobal || ""),
      porCarrera: fechasPorCarrera(opciones.diasCarrera || "")
    };
    var sinDias = !opt.globales.length && !Object.keys(opt.porCarrera).length;
    var usados = {};

    (Array.isArray(rows) ? rows : []).forEach(function(row){
      if(programable(row) && tieneHorario(row)){
        usados[ocupacionRow(row)] = true;
      }
    });

    var out = (Array.isArray(rows) ? rows : []).map(function(row){
      if(!programable(row)){ return clone(row); }
      if(tieneHorario(row)){ return clone(row); }
      if(sinDias){ return sinCupo(row); }
      var lista = slots(row, opt);
      for(var i = 0; i < lista.length; i += 1){
        var key = ocupacionSlot(lista[i]);
        if(!usados[key]){
          usados[key] = true;
          return conSlot(row, lista[i]);
        }
      }
      return sinCupo(row);
    });

    out = detectarConflictos(out);

    return {
      rows: out,
      resumen: {
        total: out.length,
        programados: out.filter(function(r){ return r.estadoClave === "programado"; }).length,
        sinCupo: out.filter(function(r){ return r.estadoClave === "sin-cupo"; }).length,
        conflictos: out.filter(function(r){ return r.estadoClave === "conflicto"; }).length,
        sinDias: sinDias
      },
      generatedAt: new Date().toISOString()
    };
  }

  window.CR_DEF_SCHEDULER = Object.freeze({
    generar: generar,
    fechas: fechas,
    fechasPorCarrera: fechasPorCarrera,
    slots: slots
  });
})(window);
