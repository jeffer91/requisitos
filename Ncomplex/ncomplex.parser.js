/* =========================================================
Nombre completo: ncomplex.parser.js
Ruta o ubicación: /Ncomplex/ncomplex.parser.js
Función o funciones:
- Leer el texto bruto copiado desde el libro de calificaciones de Moodle.
- Ignorar encabezados, iniciales, controles "Ocultar" y promedios generales.
- Reconocer estudiantes mediante nombre y correo, aun cuando no exista cédula.
- Convertir calificaciones de escala 0-100 a la escala institucional 0-10.
- Mantener compatibilidad con el formato tabular anterior basado en cédula.
========================================================= */
(function(window){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var Calculator = window.NcomplexCalculator || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalized(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeCedula(value){
    var central = window.BDLRulesEvaluacionesTitulacion;
    if(central && typeof central.normalizeCedula === "function"){
      return central.normalizeCedula(value);
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizeEmail(value){
    return text(value).toLowerCase().replace(/^mailto:/, "");
  }

  function splitTabs(line){
    return String(line == null ? "" : line)
      .split("\t")
      .map(function(value){ return text(value); });
  }

  function aliasKey(header){
    var value = normalized(header);
    var aliases = Config.headerAliases || {};
    var keys = Object.keys(aliases);
    for(var i = 0; i < keys.length; i += 1){
      var key = keys[i];
      var list = aliases[key] || [];
      if(list.some(function(alias){ return normalized(alias) === value; })){
        return key;
      }
    }
    return "column_" + value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function findHeader(lines){
    for(var index = 0; index < lines.length; index += 1){
      var key = normalized(lines[index]);
      if(
        key.indexOf("cedula") >= 0 &&
        key.indexOf("nombre completo") >= 0 &&
        key.indexOf("horario") >= 0
      ){
        return index;
      }
    }
    return -1;
  }

  function looksLikeRowStart(line){
    var parts = splitTabs(line);
    if(parts.length < 4){ return false; }
    return /^\d+$/.test(parts[0]) && /^\d{9,10}$/.test(parts[1].replace(/\D/g, ""));
  }

  function collectChunks(lines, startIndex){
    var chunks = [];
    var current = null;

    for(var index = startIndex; index < lines.length; index += 1){
      var line = String(lines[index] == null ? "" : lines[index]);
      if(!text(line)){ continue; }

      if(looksLikeRowStart(line)){
        if(current){ chunks.push(current); }
        current = { firstLine: line, continuation: [] };
      }else if(current){
        current.continuation.push(line);
      }
    }

    if(current){ chunks.push(current); }
    return chunks;
  }

  function valuesFromChunk(chunk){
    var first = splitTabs(chunk.firstLine);
    var values = first.slice(0, 4);
    var remaining = first.slice(4);

    chunk.continuation.forEach(function(line){
      splitTabs(line).forEach(function(part){
        if(part !== "" || remaining.length){ remaining.push(part); }
      });
    });

    return values.concat(remaining);
  }

  function mapColumns(headers, values){
    var result = {};
    headers.forEach(function(header, index){
      result[header.key] = values[index] == null ? "" : values[index];
      result[header.original] = values[index] == null ? "" : values[index];
    });
    return result;
  }

  function parseRow(chunk, headers, rowNumber){
    var values = valuesFromChunk(chunk);
    var mapped = mapColumns(headers, values);
    var note = typeof Calculator.parse === "function"
      ? Calculator.parse
      : function(value){
          var number = Number(text(value).replace(/,/g, "."));
          return Number.isFinite(number) ? number : null;
        };

    var cedula = normalizeCedula(mapped.cedula || values[1]);
    var item = {
      rowNumber: rowNumber,
      format: "tabla_cedula",
      codigoTitulacion: text(mapped.codigoTitulacion || values[0]),
      cedula: cedula,
      correo: normalizeEmail(mapped.correo || mapped.email || ""),
      nombreCompleto: text(mapped.nombreCompleto || values[2]),
      horario: text(mapped.horario || values[3]),
      notaTeorica: note(mapped.nota1),
      notaPractica: note(mapped.nota2),
      notaSupletorio: note(mapped.supletorioComplexivo),
      notaTrabajoTitulacion: note(mapped.trabajoTitulacion),
      trabajoPromedioAcumulado: note(mapped.trabajoPromedioAcumulado),
      rawColumns: mapped,
      rawValues: values,
      rawText: [chunk.firstLine].concat(chunk.continuation).join("\n"),
      warnings: []
    };

    if(!item.cedula){ item.warnings.push("Cédula vacía."); }
    if(item.cedula && !/^\d{10}$/.test(item.cedula)){
      item.warnings.push("La identificación no tiene 10 dígitos.");
    }
    if(!item.nombreCompleto){ item.warnings.push("Nombre no detectado."); }

    var hasComplexivo = item.notaTeorica != null || item.notaPractica != null || item.notaSupletorio != null;
    var hasWork = item.notaTrabajoTitulacion != null;
    item.suggestedModality = hasWork && !hasComplexivo
      ? (Config.modalidades && Config.modalidades.TRABAJO)
      : (Config.modalidades && Config.modalidades.COMPLEXIVO);

    return item;
  }

  function isEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text(value));
  }

  function isNoiseLine(value){
    var key = normalized(value);
    if(!key){ return true; }
    if(key === "ocultar"){ return true; }
    if(key === "teorico" || key === "practico"){ return true; }
    if(key === "nombre / apellido(s)" || key === "nombre/apellido(s)"){ return true; }
    if(key === "direccion de correo" || key === "correo electronico"){ return true; }
    if(key.indexOf("mostrando calificaciones y totales") >= 0){ return true; }
    if(key.indexOf("promedio general") === 0){ return true; }
    if(key.indexOf("cuestionario") === 0){ return true; }
    if(key.indexOf("media de calificaciones") === 0){ return true; }
    if(key.indexOf("sumatotal del curso") === 0 || key.indexOf("suma total del curso") === 0){ return true; }
    if(key.indexOf("examen complexivo") === 0){ return true; }
    return false;
  }

  function isInitials(value){
    var raw = text(value);
    return /^[A-ZÁÉÍÓÚÜÑ]{1,3}$/.test(raw);
  }

  function isGradeToken(value){
    var raw = text(value).replace(/\s+/g, "");
    return raw === "-" || /^\d{1,3}(?:[.,]\d+)?$/.test(raw);
  }

  function rawNumber(value){
    var raw = text(value).replace(/\s+/g, "");
    if(!raw || raw === "-"){ return null; }
    var number = Number(raw.replace(/,/g, "."));
    return Number.isFinite(number) ? number : null;
  }

  function scoreToTen(value){
    var number = rawNumber(value);
    if(number == null){ return null; }
    if(number < 0 || number > 100){return null;}
    var converted = number / 10;
    return Math.round(converted * 100) / 100;
  }

  function looksLikeName(value){
    var raw = text(value);
    if(!raw || isNoiseLine(raw) || isInitials(raw) || isEmail(raw) || isGradeToken(raw)){ return false; }
    if(/[0-9@]/.test(raw)){ return false; }
    var words = raw.split(/\s+/).filter(Boolean);
    return words.length >= 2 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw);
  }

  function previousName(lines,emailEntry){
    var emailIndex=emailEntry.index;
    var pieces=splitTabs(lines[emailIndex]);
    if(pieces.length>1){
      for(var p=(emailEntry.partIndex||0)-1;p>=0;p--){
        if(looksLikeName(pieces[p]))return pieces[p];
      }
    }
    for(var index=emailIndex-1;index>=0;index--){
      var candidate=text(lines[index]);
      if(looksLikeName(candidate)){return candidate;}
      if(isEmail(candidate)){break;}
    }
    return "";
  }

  function gradeTokens(lines,emailEntry,nextEntry){
    var output=[],start=emailEntry.index,end=nextEntry.index;
    for(var index=start;index<end;index++){
      var line=text(lines[index]);
      if(normalized(line).indexOf("promedio general")===0)break;
      if(!line||isNoiseLine(line))continue;
      var parts=splitTabs(line);
      // Moodle en TSV coloca nombre, correo y notas en la misma fila.
      if(index===start){
        if(parts.length<=1)continue;
        parts=parts.slice((emailEntry.partIndex||0)+1);
      }
      // TSV conserva columnas vacías; las notas en líneas verticales
      // conservan los guiones como datos explícitos, no como ceros.
      if(parts.length>1){
        parts.forEach(function(part){
          if(part===""||isGradeToken(part))output.push(part);
        });
      }else if(isGradeToken(parts[0])){
        output.push(parts[0]);
      }
    }
    return output;
  }

  function findEmailIndexes(lines){
    var indexes=[];
    lines.forEach(function(line,index){
      splitTabs(line).forEach(function(part,partIndex){
        if(isEmail(part))indexes.push({index:index,partIndex:partIndex,email:normalizeEmail(part)});
      });
    });
    return indexes;
  }

  // El esquema se obtiene de los encabezados y NO de una cantidad fija de notas.
  // Permite versiones adicionales, supletorios opcionales y orden de columnas variable.
  function moodleColumns(lines,end){
    var columns=[],supplementaryCounts={te:0,pr:0},unknownCount=0;
    for(var i=0;i<end;i++){
      splitTabs(lines[i]).forEach(function(part){
        var header=normalized(part),component="";
        var isActivity=/^(cuestionario|quiz|actividad|evaluacion|examen|tarea)\b/.test(header) ||
          /^cuestionario(?=componente)/.test(header);
        if(isActivity){
          component=/teorico/.test(header)?"te":/practico/.test(header)?"pr":"";
          if(component){
            var supplementary=/supletorio|recuperacion|repechaje/.test(header);
            var versionMatch=header.match(/version\s*(\d+)|(?:^|[\s(])v\s*(\d+)(?:\b|[)])/);
            var version=versionMatch?Number(versionMatch[1]||versionMatch[2]):1;
            if(supplementary){
              supplementaryCounts[component]++;
              columns.push(component+"Sup"+supplementaryCounts[component]);
            }else if(version>=1 && version<=99){
              columns.push(component+version);
            }else{
              columns.push("unknown"+(++unknownCount));
            }
          }else{
            // Una actividad desconocida ocupa una columna: no mover las notas.
            columns.push("unknown"+(++unknownCount));
          }
        }else if(/total\s*teorico|subtotal\s*teorico/.test(header)){
          columns.push("totalT");
        }else if(/total\s*practico|subtotal\s*practico/.test(header)){
          columns.push("totalP");
        }else if(/(?:suma\s*total|total\s*del\s*curso|calificacion\s*final\s*del\s*curso)/.test(header)){
          columns.push("totalCurso");
        }
      });
    }
    return columns;
  }

  function moodleRow(lines,emailEntry,nextEntry,rowNumber,columns){
    var tokens=gradeTokens(lines,emailEntry,nextEntry),issues=[],warnings=[];
    var count=Array.isArray(columns)?columns.length:0;
    var layout=count===5?"moodle_5":count===7?"moodle_7":count===11?"moodle_11":"moodle_dinamico";
    var aligned=count>0&&count===tokens.length;
    if(!aligned)issues.push("Desalineación: "+tokens.length+" valores frente a "+count+
      " encabezados. Revise si hay notas o columnas vacías.");
    var positions=Object.create(null);
    (columns||[]).forEach(function(key,index){
      if(!positions[key])positions[key]=[];
      positions[key].push(index);
    });
    if(!Object.keys(positions).some(function(key){return /^te\d+$/.test(key);}) ||
       !Object.keys(positions).some(function(key){return /^pr\d+$/.test(key);}))
      issues.push("No se identificaron ambos componentes: teórico y práctico.");
    function at(index,description){
      if(!aligned||index<0||index>=tokens.length)return null;
      var value=rawNumber(tokens[index]);
      if(value!==null&&(value<0||value>100)){
        issues.push(description+" fuera de escala 0–100: "+text(tokens[index]));
        return null;
      }
      return scoreToTen(tokens[index]);
    }
    function single(key,label){
      var indexes=positions[key]||[],chosen=[];
      indexes.forEach(function(index){
        var grade=at(index,label);
        if(grade!==null)chosen.push(grade);
      });
      if(chosen.length>1)issues.push(label+": más de una calificación activa en columnas repetidas.");
      return chosen.length===1?chosen[0]:null;
    }
    function component(prefix,supplementary,label){
      var keys=Object.keys(positions).filter(function(key){
        return supplementary?
          key.indexOf(prefix+"Sup")===0:
          new RegExp("^"+prefix+"[0-9]+$").test(key);
      });
      var active=[];
      keys.forEach(function(key){
        var note=single(key,label+" "+key);
        if(note!==null)active.push({key:key,note:note});
      });
      if(active.length>1)issues.push(label+": versiones simultáneas con notas; seleccione la aplicable.");
      return active.length===1?active[0].note:null;
    }
    (columns||[]).forEach(function(key,index){
      if(/^unknown\d+$/.test(key)&&aligned&&rawNumber(tokens[index])!==null)
        issues.push("Actividad sin encabezado académico reconocido en la columna "+(index+1)+".");
    });
    var te=component("te",false,"Teórico ordinario");
    var pr=component("pr",false,"Práctico ordinario");
    var tes=component("te",true,"Teórico supletorio");
    var prs=component("pr",true,"Práctico supletorio");
    var totalT=single("totalT","Subtotal teórico");
    var totalP=single("totalP","Subtotal práctico");
    var totalCurso=single("totalCurso","Total del curso");
    var ordinary=te!==null&&pr!==null?Math.round((te*.4+pr*.6)*100)/100:null;
    var supl=tes!==null&&prs!==null?Math.round((tes*.4+prs*.6)*100)/100:null;

    if((tes!==null||prs!==null)&&supl===null)
      issues.push("Supletorio incompleto: faltan componentes.");
    if(supl!==null&&ordinary!==null&&ordinary>=7)
      issues.push("Supletorio registrado junto con una nota ordinaria aprobatoria.");

    function checkSubtotal(label,actual,expected){
      if(actual!==null&&expected!==null&&Math.abs(actual-expected)>.025)
        issues.push(label+" de Moodle ("+actual.toFixed(2)+") no coincide con el cálculo ("+
          expected.toFixed(2)+").");
    }
    // Sin supletorio, los subtotales Moodle permiten verificar los pesos 40/60.
    if(tes===null&&prs===null){
      checkSubtotal("Teórico 40 %",totalT,te===null?null:Math.round(te*.4*100)/100);
      checkSubtotal("Práctico 60 %",totalP,pr===null?null:Math.round(pr*.6*100)/100);
    }
    if(totalCurso!==null&&totalT!==null&&totalP!==null&&tes===null&&prs===null)
      checkSubtotal("Total del curso",totalCurso,Math.round((totalT+totalP)*100)/100);

    var applied=supl!==null&&(ordinary===null||ordinary<7)?supl:ordinary;
    if(totalCurso!==null&&applied!==null&&Math.abs(totalCurso-applied)>.025){
      var discrepancy="Total Moodle "+totalCurso.toFixed(2)+
        "/10 distinto del resultado académico calculado "+applied.toFixed(2)+"/10.";
      // Compatibilidad con el libro Moodle clásico de 7 columnas, donde
      // categorías promedian intentos y el total NO equivale al supletorio.
      if(count===7&&supl!==null)warnings.push(discrepancy);
      else issues.push(discrepancy);
    }
    var name=previousName(lines,emailEntry);
    if(!name)issues.push("No se encontró el nombre del estudiante.");
    warnings=warnings.concat(issues);
    return {
      rowNumber:rowNumber,format:"moodle_gradebook",layout:layout,
      codigoTitulacion:"",cedula:"",correo:emailEntry.email,nombreCompleto:name,horario:"",
      notaTeorica:te,notaPractica:pr,
      notaTeoricaSupletorio:tes,notaPracticaSupletorio:prs,
      moodleTotalTeorico:totalT,moodleTotalPractico:totalP,moodleTotalCurso:totalCurso,
      rawValues:tokens.slice(),rawScores:tokens.map(rawNumber),
      columnRoles:(columns||[]).slice(),
      rawText:lines.slice(Math.max(0,emailEntry.index-2),nextEntry.index).join("\n"),
      issues:issues,warnings:warnings,blocked:issues.length>0,
      suggestedModality:Config.modalidades&&Config.modalidades.COMPLEXIVO
    };
  }

  function parseMoodle(lines,source){
    var emails=findEmailIndexes(lines);
    var result={ok:false,format:"moodle_gradebook",headers:[],rows:[],errors:[],warnings:[],rawText:source,total:0};
    if(!emails.length){result.errors.push("No se detectaron correos institucionales.");return result;}
    var columns=moodleColumns(lines,emails[0].index);
    result.headers=columns.slice();
    emails.forEach(function(e,i){
      var next=i+1<emails.length?emails[i+1]:{index:lines.length};
      result.rows.push(moodleRow(lines,e,next,i+1,columns));
    });
    result.total=result.rows.length;
    var blocked=result.rows.filter(function(r){return r.blocked;}).length;
    if(blocked)result.warnings.push(blocked+" estudiante(s) bloqueado(s) hasta resolver discrepancias.");
    result.ok=result.total>0;
    return result;
  }

  function parseTabular(lines, source, headerIndex){
    var result = {
      ok: false,
      format: "tabla_cedula",
      headers: [],
      rows: [],
      errors: [],
      warnings: [],
      rawText: source,
      total: 0
    };

    var headerValues = splitTabs(lines[headerIndex]);
    result.headers = headerValues.map(function(header){
      return { original: text(header), key: aliasKey(header) };
    });

    var chunks = collectChunks(lines, headerIndex + 1);
    if(!chunks.length){
      result.errors.push("No se detectaron filas de estudiantes después del encabezado.");
      return result;
    }

    result.rows = chunks.map(function(chunk, index){
      return parseRow(chunk, result.headers, index + 1);
    });
    result.total = result.rows.length;

    var invalid = result.rows.filter(function(row){ return !row.cedula; }).length;
    if(invalid){ result.warnings.push(invalid + " fila(s) no tienen una cédula reconocible."); }

    result.ok = result.rows.some(function(row){ return !!row.cedula; });
    return result;
  }

  // Permite pegar una tabla Markdown de Moodle con hipervínculos, además del texto plano.
  function markdownCell(value){
    return text(value)
      .replace(/\\&/g,"&")
      .replace(/!\[[^\]]*\]\([^)]*\)/g,"")
      .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
      .replace(/\*\*/g,"")
      .replace(/^image(?=[A-ZÁÉÍÓÚÜÑ])/,"")
      .replace(/\(\s*image\s*\)/gi,"")
      .trim();
  }

  function expandMarkdownMoodle(source){
    return source.split("\n").map(function(line){
      if(!/^\s*\|.*\|\s*$/.test(line)){return line;}
      var cells=line.trim().slice(1,-1).split("|").map(markdownCell);
      if(cells.every(function(c){return /^:?-{3,}:?$/.test(c);})){return "";}
      return cells.join("\n");
    }).join("\n");
  }

  function parse(input){
    var source = String(input == null ? "" : input)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ");

    if(!text(source)){
      return {
        ok: false,
        format: "",
        headers: [],
        rows: [],
        errors: ["No hay texto para analizar."],
        warnings: [],
        rawText: source,
        total: 0
      };
    }

    var lines = expandMarkdownMoodle(source).split("\n");
    var headerIndex = findHeader(lines);
    if(headerIndex >= 0){
      return parseTabular(lines, source, headerIndex);
    }

    if(findEmailIndexes(lines).length){
      return parseMoodle(lines, source);
    }

    return {
      ok: false,
      format: "",
      headers: [],
      rows: [],
      errors: [
        "No se reconoció el formato. Pegue la tabla completa de Moodle o una tabla con Cédula, Nombre Completo y Horario."
      ],
      warnings: [],
      rawText: source,
      total: 0
    };
  }

  window.NcomplexParser = {
    version: "2.2.0-moodle-dynamic-schema",
    parse: parse,
    parseMoodle: parseMoodle,
    normalizeCedula: normalizeCedula,
    normalizeEmail: normalizeEmail,
    scoreToTen: scoreToTen,
    findHeader: findHeader,
    looksLikeRowStart: looksLikeRowStart,
    findEmailIndexes: findEmailIndexes
  };
})(window);
