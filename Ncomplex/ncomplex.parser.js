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

  function previousName(lines, emailIndex){
    for(var index = emailIndex - 1; index >= 0; index -= 1){
      var candidate = text(lines[index]);
      if(looksLikeName(candidate)){ return candidate; }
      if(isEmail(candidate)){ break; }
    }
    return "";
  }

  function gradeTokens(lines, startIndex, endIndex){
    var output = [];
    for(var index = startIndex; index < endIndex; index += 1){
      var line = text(lines[index]);
      if(normalized(line).indexOf("promedio general")===0){break;}
    if(!line || isNoiseLine(line)){ continue; }
      splitTabs(line).forEach(function(part){
        if(isGradeToken(part)){ output.push(part); }
      });
    }
    return output;
  }

  function findEmailIndexes(lines){
    var indexes = [];
    lines.forEach(function(line, index){
      splitTabs(line).forEach(function(part){
        if(isEmail(part)){ indexes.push({ index: index, email: normalizeEmail(part) }); }
      });
    });
    return indexes;
  }

  // Convierte encabezados reales de Moodle en claves estables, sin depender del orden.
  function moodleColumns(lines,end){
    var columns=[],counts={teSup:0,prSup:0};
    for(var i=0;i<end;i++){
      var k=normalized(lines[i]);
      if(k.indexOf("cuestionario")===0&&k.indexOf("componente")>=0){
        var kind=k.indexOf("teorico")>=0?"te":k.indexOf("practico")>=0?"pr":"";
        if(!kind)continue;
        var supplemental=k.indexOf("supletorio")>=0;
        if(supplemental){var key=kind+"Sup";counts[key]++;columns.push(key+Math.min(counts[key],2));}
        else columns.push(kind+(k.indexOf("version 2")>=0?"2":"1"));
      }else if(k.indexOf("media de calificaciones")===0&&k.indexOf("total teorico")>=0){
        columns.push("totalT");
      }else if(k.indexOf("media de calificaciones")===0&&k.indexOf("total practico")>=0){
        columns.push("totalP");
      }else if(k.indexOf("sumatotal del curso")===0||k.indexOf("suma total del curso")===0){
        columns.push("totalCurso");
      }
    }
    return columns;
  }

  // Esquemas: Moodle básico (5), clásico con supletorio (7) y multiversión (11).
  // Una posición desconocida nunca se asigna a otra calificación.
  function moodleRow(lines,emailEntry,nextIndex,rowNumber,columns){
    var tokens=gradeTokens(lines,emailEntry.index+1,nextIndex),warnings=[],issues=[];
    var layout=tokens.length===11?"moodle_11":tokens.length===7?"moodle_7":tokens.length===5?"moodle_5":"";
    if(!layout)issues.push("Estructura desconocida: "+tokens.length+" columnas; se requieren 5, 7 u 11.");
    if(!columns||columns.length!==tokens.length)issues.push("Encabezados Moodle incompletos o desalineados con las "+tokens.length+" columnas.");
    var required=layout==="moodle_5"?["te1","totalT","pr1","totalP","totalCurso"]:
      layout==="moodle_7"?["te1","teSup1","totalT","pr1","prSup1","totalP","totalCurso"]:
      layout==="moodle_11"?["te1","te2","teSup1","teSup2","totalT",
        "pr1","pr2","prSup1","prSup2","totalP","totalCurso"]:[];
    if(layout && (!columns||required.some(function(key){
      return columns.filter(function(col){return col===key;}).length!==1;
    })))issues.push("Encabezados de teórico, práctico y subtotales incompatibles con "+layout+".");
    function index(key,fallback){return columns&&columns.length===tokens.length?columns.indexOf(key):fallback;}
    function raw(i){return rawNumber(tokens[i]);}
    function noteAt(i,field){
      var v=raw(i);
      if(v!==null&&(v<0||v>100)){issues.push(field+" fuera de escala 0-100.");return null;}
      return scoreToTen(tokens[i]);
    }
    function version(a,b,field){
      var first=noteAt(a,field),second=b==null?null:noteAt(b,field+" versión 2");
      if(first!==null&&second!==null){issues.push("Dos notas activas en "+field+"; requiere selección de versión.");return null;}
      return first!==null?first:second;
    }
    var te=null,pr=null,tes=null,prs=null,totalT=null,totalP=null,totalCurso=null;
    if(layout==="moodle_11"){
      te=version(index("te1",0),index("te2",1),"Teórico ordinario");
      tes=version(index("teSup1",2),index("teSup2",3),"Teórico supletorio");
      totalT=noteAt(index("totalT",4),"Total teórico");
      pr=version(index("pr1",5),index("pr2",6),"Práctico ordinario");
      prs=version(index("prSup1",7),index("prSup2",8),"Práctico supletorio");
      totalP=noteAt(index("totalP",9),"Total práctico");
      totalCurso=noteAt(index("totalCurso",10),"Total curso");
    }else if(layout==="moodle_7"){
      te=noteAt(index("te1",0),"Teórico");tes=noteAt(index("teSup1",1),"Teórico supletorio");totalT=noteAt(index("totalT",2),"Total teórico");
      pr=noteAt(index("pr1",3),"Práctico");prs=noteAt(index("prSup1",4),"Práctico supletorio");totalP=noteAt(index("totalP",5),"Total práctico");totalCurso=noteAt(index("totalCurso",6),"Total curso");
    }else if(layout==="moodle_5"){
      // Formato ordinario: 5 columnas (teoría, subtotal, práctica, subtotal, curso).
      te=noteAt(index("te1",0),"Teórico");
      totalT=noteAt(index("totalT",1),"Subtotal teórico (40 %)");
      pr=noteAt(index("pr1",2),"Práctico");
      totalP=noteAt(index("totalP",3),"Subtotal práctico (60 %)");
      totalCurso=noteAt(index("totalCurso",4),"Total del curso");
      function checkSubtotal(label,actual,expected){
        if(actual!==null&&expected!==null&&Math.abs(actual-expected)>.015){
          issues.push(label+" de Moodle ("+actual.toFixed(2)+
            ") no coincide con el cálculo ("+expected.toFixed(2)+").");
        }
      }
      checkSubtotal("Teórico 40 %",totalT,te===null?null:Math.round(te*.4*100)/100);
      checkSubtotal("Práctico 60 %",totalP,pr===null?null:Math.round(pr*.6*100)/100);
      checkSubtotal("Total del curso",totalCurso,totalT===null||totalP===null?null:
        Math.round((totalT+totalP)*100)/100);
    }
    var ordinary=te!==null&&pr!==null?Math.round((te*.4+pr*.6)*100)/100:null;
    var sup=tes!==null&&prs!==null?Math.round((tes*.4+prs*.6)*100)/100:null;
    if((tes!==null||prs!==null)&&sup===null)issues.push("Supletorio incompleto: faltan componentes.");
    if(sup!==null&&ordinary!==null&&ordinary>=7)issues.push("Supletorio después de nota ordinaria aprobada: requiere conciliación.");
    var current=sup!==null&&(ordinary===null||ordinary<7)?sup:ordinary;
    if(totalCurso!==null&&current!==null&&Math.abs(totalCurso-current)>.025){
      var explanation="Total Moodle "+totalCurso.toFixed(2)+"/10 distinto del cálculo "+current.toFixed(2)+"/10; puede existir una media interna de versiones.";
      if(layout==="moodle_11"||layout==="moodle_5")issues.push(explanation);else warnings.push(explanation);
    }
    var studentName=previousName(lines,emailEntry.index);
    if(!studentName)issues.push("Nombre de estudiante no encontrado.");
    warnings=warnings.concat(issues);
    return {rowNumber:rowNumber,format:"moodle_gradebook",layout:layout,
      codigoTitulacion:"",cedula:"",correo:emailEntry.email,nombreCompleto:studentName,horario:"",
      notaTeorica:te,notaPractica:pr,notaTeoricaSupletorio:tes,notaPracticaSupletorio:prs,
      moodleTotalTeorico:totalT,moodleTotalPractico:totalP,moodleTotalCurso:totalCurso,
      rawValues:tokens.slice(),rawScores:tokens.map(rawNumber),
      rawText:lines.slice(Math.max(0,emailEntry.index-2),nextIndex).join("\n"),
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
    emails.forEach(function(e,i){result.rows.push(moodleRow(lines,e,i+1<emails.length?emails[i+1].index:lines.length,i+1,columns));});
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
    version: "2.1.0-moodle-5-7-11-columns",
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
