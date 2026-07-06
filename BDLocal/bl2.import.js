/* =========================================================
Archivo: bl2.import.js
Ruta: /BDLocal/bl2.import.js
Función:
- Leer archivos XLSX, CSV, TXT, JSON y HTML.
- Normalizar estudiantes para BL2.
- Corregir cédulas de 9 dígitos agregando 0.
- Guardar con advertencia cédulas menores a 9 o mayores a 10.
- Detectar requisitos por valores CUMPLE / NO CUMPLE / PENDIENTE.
- Resolver duplicados usando el registro más completo.
========================================================= */
(function(window, document){
  "use strict";

  var config = window.BL2Config || {};
  var utils = config.utils || {};
  var fields = config.fields || {};
  var status = config.status || {};
  var requirementValues = config.requirementValues || [];

  var XLSX_CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var xlsxLoading = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeKey(value){
    if(utils.normalizeKey){
      return utils.normalizeKey(value);
    }

    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeBasic(value){
    if(utils.normalizeBasic){
      return utils.normalizeBasic(value);
    }

    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeCedula(value){
    if(utils.normalizeCedula){
      return utils.normalizeCedula(value);
    }

    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function makeStudentKey(cedula, periodoId){
    if(utils.makeStudentKey){
      return utils.makeStudentKey(cedula, periodoId);
    }
    return normalizeCedula(cedula) + "__" + text(periodoId);
  }

  function makeRequirementKey(cedula, periodoId, requisito){
    if(utils.makeRequirementKey){
      return utils.makeRequirementKey(cedula, periodoId, requisito);
    }
    return makeStudentKey(cedula, periodoId) + "__" + normalizeKey(requisito);
  }

  function isRequirementValue(value){
    var normalized = normalizeBasic(value).toUpperCase();
    return requirementValues.indexOf(normalized) >= 0;
  }

  function findValue(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];

    var keys = Object.keys(row);
    var map = {};

    keys.forEach(function(key){
      map[normalizeKey(key)] = key;
    });

    for(var i = 0; i < names.length; i += 1){
      var wanted = normalizeKey(names[i]);
      if(map[wanted] !== undefined){
        return row[map[wanted]];
      }
    }

    return "";
  }

  function extension(fileName){
    var name = text(fileName).toLowerCase();
    var idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1) : "";
  }

  function readText(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();

      reader.onload = function(){
        resolve(String(reader.result || ""));
      };

      reader.onerror = function(){
        reject(reader.error || new Error("No se pudo leer el archivo."));
      };

      reader.readAsText(file, "utf-8");
    });
  }

  function readArrayBuffer(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();

      reader.onload = function(){
        resolve(reader.result);
      };

      reader.onerror = function(){
        reject(reader.error || new Error("No se pudo leer el archivo XLSX."));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  function ensureXLSX(){
    if(window.XLSX){
      return Promise.resolve(window.XLSX);
    }

    if(xlsxLoading){
      return xlsxLoading;
    }

    xlsxLoading = new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = XLSX_CDN;
      script.async = true;

      script.onload = function(){
        if(window.XLSX){
          resolve(window.XLSX);
        }else{
          reject(new Error("La librería XLSX no quedó disponible."));
        }
      };

      script.onerror = function(){
        reject(new Error("No se pudo cargar la librería XLSX."));
      };

      document.head.appendChild(script);
    });

    return xlsxLoading;
  }

  function parseCSV(textValue){
    var raw = String(textValue || "").replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;

    for(var i = 0; i < raw.length; i += 1){
      var char = raw.charAt(i);
      var next = raw.charAt(i + 1);

      if(char === '"' && inQuotes && next === '"'){
        cell += '"';
        i += 1;
        continue;
      }

      if(char === '"'){
        inQuotes = !inQuotes;
        continue;
      }

      if(char === "," && !inQuotes){
        row.push(cell);
        cell = "";
        continue;
      }

      if((char === "\n" || char === "\r") && !inQuotes){
        if(char === "\r" && next === "\n"){
          i += 1;
        }

        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell);
    rows.push(row);

    rows = rows.filter(function(r){
      return r.some(function(v){ return text(v) !== ""; });
    });

    if(!rows.length){
      return [];
    }

    var headers = rows[0].map(function(h, index){
      return text(h) || ("Columna " + (index + 1));
    });

    return rows.slice(1).map(function(r){
      var obj = {};
      headers.forEach(function(h, index){
        obj[h] = r[index] == null ? "" : text(r[index]);
      });
      return obj;
    });
  }

  function parseJSON(raw){
    var parsed = JSON.parse(String(raw || "").trim());

    if(Array.isArray(parsed)){
      return parsed;
    }

    if(parsed && Array.isArray(parsed.rows)){
      return parsed.rows;
    }

    if(parsed && Array.isArray(parsed.data)){
      return parsed.data;
    }

    if(parsed && parsed.tables && Array.isArray(parsed.tables.estudiantes)){
      return parsed.tables.estudiantes;
    }

    return parsed ? [parsed] : [];
  }

  function parseHTML(raw){
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(raw || ""), "text/html");
    var tables = Array.prototype.slice.call(doc.querySelectorAll("table"));

    if(!tables.length){
      return [];
    }

    tables.sort(function(a, b){
      return b.querySelectorAll("tr").length - a.querySelectorAll("tr").length;
    });

    var trs = Array.prototype.slice.call(tables[0].querySelectorAll("tr"));
    var matrix = trs.map(function(tr){
      return Array.prototype.slice.call(tr.children).map(function(cell){
        return text(cell.textContent || cell.innerText || "").replace(/\s+/g, " ");
      });
    }).filter(function(row){
      return row.some(function(value){ return text(value) !== ""; });
    });

    if(!matrix.length){
      return [];
    }

    var headerIndex = 0;

    for(var i = 0; i < Math.min(matrix.length, 8); i += 1){
      var filled = matrix[i].filter(function(v){ return text(v) !== ""; }).length;
      if(filled >= 3){
        headerIndex = i;
        break;
      }
    }

    var headers = matrix[headerIndex].map(function(value, index){
      return text(value) || ("Columna " + (index + 1));
    });

    return matrix.slice(headerIndex + 1).map(function(row){
      var obj = {};
      headers.forEach(function(h, index){
        obj[h] = row[index] == null ? "" : row[index];
      });
      return obj;
    }).filter(function(row){
      return Object.keys(row).some(function(key){ return text(row[key]) !== ""; });
    });
  }

  function parseXLSX(file){
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        var workbook = XLSX.read(buffer, { type: "array" });
        var firstSheet = workbook.SheetNames[0];

        if(!firstSheet){
          return [];
        }

        var sheet = workbook.Sheets[firstSheet];
        return XLSX.utils.sheet_to_json(sheet, { defval: "" });
      });
    });
  }

  function parseFile(file){
    if(!file){
      return Promise.reject(new Error("No se recibió archivo."));
    }

    var ext = extension(file.name);

    if(ext === "xlsx" || ext === "xls"){
      return parseXLSX(file).then(function(rows){
        return {
          rows: rows,
          fileName: file.name,
          detectedType: ext
        };
      });
    }

    return readText(file).then(function(raw){
      var trimmed = text(raw);
      var rows = [];

      if(ext === "json" || trimmed.charAt(0) === "{" || trimmed.charAt(0) === "["){
        rows = parseJSON(raw);
      }else if(ext === "html" || /<table|<html|<tr/i.test(trimmed.slice(0, 1000))){
        rows = parseHTML(raw);
      }else{
        rows = parseCSV(raw);
      }

      return {
        rows: rows,
        fileName: file.name,
        detectedType: ext || "texto"
      };
    });
  }

  function normalizeRequirementName(name){
    return text(name)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeRequirementValue(value){
    var normalized = normalizeBasic(value).toUpperCase();

    if(normalized === "CUMPLE"){
      return "CUMPLE";
    }

    if(normalized === "NO CUMPLE" || normalized === "NOCUMPLE"){
      return "NO CUMPLE";
    }

    if(normalized === "PENDIENTE"){
      return "PENDIENTE";
    }

    return text(value).toUpperCase();
  }

  function completenessScore(row){
    row = row || {};
    return Object.keys(row).reduce(function(total, key){
      var value = row[key];
      if(value !== null && value !== undefined && text(value) !== ""){
        return total + 1;
      }
      return total;
    }, 0);
  }

  function chooseMoreComplete(a, b){
    return completenessScore(b) >= completenessScore(a) ? b : a;
  }

  function detectRequirements(row, base){
    row = row || {};
    base = base || {};

    var requisitos = [];
    var periodoId = base.periodoId;
    var cedula = base.cedula;
    var studentId = base.id;

    Object.keys(row).forEach(function(key){
      var value = row[key];

      if(isRequirementValue(value)){
        requisitos.push({
          id: makeRequirementKey(cedula, periodoId, key),
          studentId: studentId,
          cedula: cedula,
          periodoId: periodoId,
          periodoLabel: base.periodoLabel,
          nombre: normalizeRequirementName(key),
          valor: normalizeRequirementValue(value),
          source: "excel",
          createdAt: nowISO(),
          updatedAt: nowISO()
        });
      }
    });

    return requisitos;
  }

  function detectContact(row, base){
    var institucional = text(findValue(row, ["CorreoInstitucional", "correoInstitucional"]));
    var personal = text(findValue(row, ["CorreoPersonal", "correoPersonal", "email", "correo"]));
    var celular = text(findValue(row, ["Celular", "celular", "Telefono", "Teléfono", "telefono"]));
    var telegramUser = text(row.telegramUser || row._telegramUser || "");
    var telegramChatId = text(row.telegramChatId || row._telegramChatId || "");

    return {
      id: base.id,
      studentId: base.id,
      cedula: base.cedula,
      periodoId: base.periodoId,
      periodoLabel: base.periodoLabel,
      CorreoInstitucional: institucional,
      CorreoPersonal: personal,
      Celular: celular,
      telegramUser: telegramUser,
      telegramChatId: telegramChatId,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  }

  function detectNotes(row, base){
    var nart = text(row.Notart || row.Nart || row.nart || row.NotaArt || row.notaArticulo || "");
    var ndef = text(row.Notdef || row.Ndef || row.ndef || row.NotaDef || row.notaDefensa || "");
    var nfin = text(row.Notafinal || row.NotaFinal || row.Nfin || row.nfin || row.notaFinal || "");

    if(!nart && !ndef && !nfin){
      return null;
    }

    return {
      id: base.id,
      studentId: base.id,
      cedula: base.cedula,
      periodoId: base.periodoId,
      periodoLabel: base.periodoLabel,
      Notart: nart,
      Notdef: ndef,
      Notafinal: nfin,
      source: "excel",
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  }

  function normalizeOneRow(row, options, result){
    row = row || {};
    options = options || {};
    result = result || {};

    var periodoId = text(options.periodoId);
    var periodoLabel = text(options.periodoLabel || options.periodoNombre || periodoId);

    if(!periodoId){
      result.errores.push("No hay período seleccionado. La carga fue bloqueada.");
      return null;
    }

    var rawCedula = findValue(row, fields.id || []);
    var cedula = normalizeCedula(rawCedula);

    var nombres = text(findValue(row, fields.names || []));
    var carrera = text(findValue(row, fields.career || []));
    var codigoCarrera = text(findValue(row, fields.careerCode || []));

    if(!cedula){
      result.errores.push("Registro sin cédula: " + JSON.stringify(row).slice(0, 180));
      return null;
    }

    if(!nombres){
      result.errores.push("Registro sin nombres para cédula " + cedula + ".");
      return null;
    }

    if(/^\d{9}$/.test(text(rawCedula).replace(/[^\d]/g, ""))){
      result.advertencias.push("Cédula corregida con 0 inicial: " + rawCedula + " → " + cedula);
    }

    if(cedula.length < 9 || cedula.length > 10){
      result.advertencias.push("Cédula/documento con longitud inusual, se guarda por posible extranjero: " + cedula);
    }

    var id = makeStudentKey(cedula, periodoId);

    var student = Object.assign({}, row, {
      id: id,
      cedula: cedula,
      numeroIdentificacion: cedula,
      Nombres: nombres,
      nombres: nombres,
      CodigoCarrera: codigoCarrera || text(row.CodigoCarrera || row.codigoCarrera || ""),
      NombreCarrera: carrera || text(row.NombreCarrera || row.nombreCarrera || ""),
      Sede: text(row.Sede || row.sede || ""),
      Modalidad: text(row.Modalidad || row.modalidad || ""),
      HorarioComplexivo: text(row.HorarioComplexivo || row.horarioComplexivo || ""),
      CorreoInstitucional: text(row.CorreoInstitucional || row.correoInstitucional || ""),
      CorreoPersonal: text(row.CorreoPersonal || row.correoPersonal || row.email || row.correo || ""),
      Celular: text(row.Celular || row.celular || row.Telefono || row.telefono || ""),
      periodoId: periodoId,
      periodoLabel: periodoLabel,
      ultimoPeriodoId: periodoId,
      estadoMatricula: text(row.estadoMatricula || row.EstadoMatricula || status.active || "ACTIVO"),
      division: text(row.division || row.Division || row.división || row.División || ""),
      createdAt: text(row.createdAt) || nowISO(),
      updatedAt: nowISO(),
      original: clone(row)
    });

    student._requisitos = detectRequirements(row, student);
    student._contacto = detectContact(row, student);
    student._notas = detectNotes(row, student);

    return student;
  }

  function normalizeRows(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    return new Promise(function(resolve, reject){
      var periodoId = text(options.periodoId);
      var periodoLabel = text(options.periodoLabel || options.periodoNombre || periodoId);

      if(!periodoId){
        reject(new Error("Seleccione primero un período antes de cargar."));
        return;
      }

      var result = {
        ok: true,
        periodoId: periodoId,
        periodoLabel: periodoLabel,
        totalEntrada: rows.length,
        students: [],
        duplicados: 0,
        advertencias: [],
        errores: [],
        columnasDetectadas: {},
        createdAt: nowISO()
      };

      var byKey = {};

      rows.forEach(function(row){
        Object.keys(row || {}).forEach(function(key){
          result.columnasDetectadas[key] = true;
        });

        var normalized = normalizeOneRow(row, options, result);
        if(!normalized){
          return;
        }

        if(byKey[normalized.id]){
          result.duplicados += 1;
          result.advertencias.push("Duplicado en Excel para " + normalized.cedula + ". Se usa el registro más completo.");

          byKey[normalized.id] = chooseMoreComplete(byKey[normalized.id], normalized);
        }else{
          byKey[normalized.id] = normalized;
        }
      });

      result.students = Object.keys(byKey).map(function(key){
        return byKey[key];
      });

      if(result.errores.length && !result.students.length){
        result.ok = false;
      }

      result.columnasDetectadas = Object.keys(result.columnasDetectadas).sort();

      resolve(result);
    });
  }

  function importFile(file, options){
    options = options || {};

    return parseFile(file).then(function(parsed){
      return normalizeRows(parsed.rows, options).then(function(normalized){
        return Object.assign({}, normalized, {
          fileName: parsed.fileName,
          detectedType: parsed.detectedType
        });
      });
    });
  }

  window.BL2Import = {
    parseFile: parseFile,
    importFile: importFile,
    normalizeRows: normalizeRows,

    parseCSV: parseCSV,
    parseJSON: parseJSON,
    parseHTML: parseHTML,
    parseXLSX: parseXLSX,

    normalizeCedula: normalizeCedula,
    isRequirementValue: isRequirementValue
  };
})(window, document);