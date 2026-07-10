/* =========================================================
Nombre completo: bl2.import.js
Ruta o ubicación: /BDLocal/bl2.import.js
Función o funciones:
- Leer XLSX, XLS, CSV, TXT, JSON y HTML.
- Usar SheetJS 0.20.3 instalado localmente.
- Limitar tamaño, filas y contenido antes de normalizar.
- Bloquear claves de contaminación de prototipos.
- Validar cédulas ecuatorianas antes de completar el cero inicial.
- Detectar requisitos, contactos, notas y duplicados del archivo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-secure-local-xlsx";
  var config=window.BL2Config||{};
  var utils=config.utils||{};
  var fields=config.fields||{};
  var status=config.status||{};
  var requirementValues=config.requirementValues||[];
  var MAX_FILE_BYTES=15*1024*1024;
  var MAX_ROWS=50000;
  var MAX_COLUMNS=500;
  var MAX_CELL_LENGTH=50000;
  var loadingXLSX=null;
  var scriptBase=document.currentScript&&document.currentScript.src||document.baseURI;
  var XLSX_LOCAL_URL;
  try{XLSX_LOCAL_URL=new URL("../node_modules/xlsx/dist/xlsx.full.min.js",scriptBase).href;}
  catch(error){XLSX_LOCAL_URL="../node_modules/xlsx/dist/xlsx.full.min.js";}

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return utils.nowISO?utils.nowISO():new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function normalizeKey(value){
    if(utils.normalizeKey){return utils.normalizeKey(value);}
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function normalizeBasic(value){
    if(utils.normalizeBasic){return utils.normalizeBasic(value);}
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  }
  function analyzeIdentification(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.analyzeIdentification==="function"){return rules.analyzeIdentification(value);}
    if(typeof utils.analyzeIdentification==="function"){return utils.analyzeIdentification(value);}
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return {original:text(value),raw:raw,canonical:raw,changed:false,missingLeadingZero:false,safeAutoCorrection:false,type:raw?"OTHER_IDENTIFICATION":"EMPTY"};
  }
  function normalizeCedula(value){return analyzeIdentification(value).canonical;}
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function makeStudentKey(cedula,periodoId){
    if(utils.makeStudentKey){return utils.makeStudentKey(cedula,canonicalPeriodId(periodoId));}
    return normalizeCedula(cedula)+"__"+canonicalPeriodId(periodoId);
  }
  function makeRequirementKey(cedula,periodoId,requisito){
    if(utils.makeRequirementKey){return utils.makeRequirementKey(cedula,canonicalPeriodId(periodoId),requisito);}
    return makeStudentKey(cedula,periodoId)+"__"+normalizeKey(requisito);
  }
  function isRequirementValue(value){return requirementValues.indexOf(normalizeBasic(value).toUpperCase())>=0;}

  function safeKey(key){
    key=text(key);
    return key!=="__proto__"&&key!=="prototype"&&key!=="constructor";
  }
  function safeCell(value){
    if(value==null){return "";}
    if(value instanceof Date){return value.toISOString();}
    if(typeof value==="object"){return text(JSON.stringify(value)).slice(0,MAX_CELL_LENGTH);}
    return String(value).slice(0,MAX_CELL_LENGTH);
  }
  function sanitizeRow(row){
    var output=Object.create(null);
    Object.keys(row||{}).slice(0,MAX_COLUMNS).forEach(function(key){if(safeKey(key)){output[text(key).slice(0,300)]=safeCell(row[key]);}});
    return output;
  }
  function sanitizeRows(rows){
    rows=Array.isArray(rows)?rows:[];
    if(rows.length>MAX_ROWS){throw new Error("El archivo supera el máximo de "+MAX_ROWS+" filas.");}
    return rows.map(sanitizeRow);
  }
  function validateFile(file){
    if(!file){throw new Error("No se recibió archivo.");}
    if(Number(file.size||0)>MAX_FILE_BYTES){throw new Error("El archivo supera el máximo permitido de 15 MB.");}
    return file;
  }
  function findValue(row,names){
    row=row||{};names=Array.isArray(names)?names:[];
    var map=Object.create(null);
    Object.keys(row).forEach(function(key){map[normalizeKey(key)]=key;});
    for(var i=0;i<names.length;i+=1){var wanted=normalizeKey(names[i]);if(map[wanted]!==undefined){return row[map[wanted]];}}
    return "";
  }
  function extension(fileName){var name=text(fileName).toLowerCase();var index=name.lastIndexOf(".");return index>=0?name.slice(index+1):"";}

  function readText(file){
    validateFile(file);
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(String(reader.result||""));};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer el archivo."));};
      reader.readAsText(file,"utf-8");
    });
  }
  function readArrayBuffer(file){
    validateFile(file);
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer el archivo XLSX."));};
      reader.readAsArrayBuffer(file);
    });
  }

  function ensureXLSX(){
    if(window.XLSX){return Promise.resolve(window.XLSX);}
    if(loadingXLSX){return loadingXLSX;}
    loadingXLSX=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===XLSX_LOCAL_URL;});
      if(existing){
        existing.addEventListener("load",function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));},{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=XLSX_LOCAL_URL;
      script.async=true;
      script.setAttribute("data-requisitos-dependency","sheetjs@0.20.3");
      script.onload=function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));};
      document.head.appendChild(script);
    }).catch(function(error){loadingXLSX=null;throw error;});
    return loadingXLSX;
  }

  function parseCSV(value){
    var raw=String(value||"").replace(/^\uFEFF/,"");
    var matrix=[],row=[],cell="",quoted=false;
    for(var i=0;i<raw.length;i+=1){
      var char=raw.charAt(i),next=raw.charAt(i+1);
      if(char==='"'&&quoted&&next==='"'){cell+='"';i+=1;continue;}
      if(char==='"'){quoted=!quoted;continue;}
      if(char===","&&!quoted){row.push(cell);cell="";continue;}
      if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&next==="\n"){i+=1;}row.push(cell);matrix.push(row);row=[];cell="";continue;}
      cell+=char;
    }
    row.push(cell);matrix.push(row);
    matrix=matrix.filter(function(item){return item.some(function(value){return text(value)!=="";});});
    if(!matrix.length){return [];}
    var headers=matrix[0].slice(0,MAX_COLUMNS).map(function(value,index){var key=text(value)||"Columna "+(index+1);return safeKey(key)?key:"Columna_segura_"+(index+1);});
    return sanitizeRows(matrix.slice(1).map(function(item){var output=Object.create(null);headers.forEach(function(header,index){output[header]=item[index]==null?"":item[index];});return output;}));
  }
  function parseJSON(raw){
    var parsed=JSON.parse(String(raw||"").trim());
    var rows=Array.isArray(parsed)?parsed:parsed&&Array.isArray(parsed.rows)?parsed.rows:parsed&&Array.isArray(parsed.data)?parsed.data:parsed&&parsed.tables&&Array.isArray(parsed.tables.estudiantes)?parsed.tables.estudiantes:parsed?[parsed]:[];
    return sanitizeRows(rows);
  }
  function parseHTML(raw){
    var parser=new DOMParser();
    var doc=parser.parseFromString(String(raw||""),"text/html");
    var tables=Array.prototype.slice.call(doc.querySelectorAll("table"));
    if(!tables.length){return [];}
    tables.sort(function(a,b){return b.querySelectorAll("tr").length-a.querySelectorAll("tr").length;});
    var matrix=Array.prototype.slice.call(tables[0].querySelectorAll("tr")).map(function(tr){return Array.prototype.slice.call(tr.children).slice(0,MAX_COLUMNS).map(function(cell){return safeCell(cell.textContent||cell.innerText||"").replace(/\s+/g," ");});}).filter(function(item){return item.some(function(value){return text(value)!=="";});});
    if(!matrix.length){return [];}
    var headerIndex=0;
    for(var i=0;i<Math.min(matrix.length,8);i+=1){if(matrix[i].filter(function(value){return text(value)!=="";}).length>=3){headerIndex=i;break;}}
    var headers=matrix[headerIndex].map(function(value,index){var key=text(value)||"Columna "+(index+1);return safeKey(key)?key:"Columna_segura_"+(index+1);});
    return sanitizeRows(matrix.slice(headerIndex+1).map(function(item){var output=Object.create(null);headers.forEach(function(header,index){output[header]=item[index]==null?"":item[index];});return output;}).filter(function(item){return Object.keys(item).some(function(key){return text(item[key])!=="";});}));
  }
  function parseXLSX(file){
    validateFile(file);
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        var workbook=XLSX.read(buffer,{type:"array",cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,bookDeps:false,sheetRows:MAX_ROWS+1});
        var firstSheet=workbook.SheetNames[0];
        if(!firstSheet){return [];}
        return sanitizeRows(XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet],{defval:"",raw:false,blankrows:false}).slice(0,MAX_ROWS));
      });
    });
  }

  function parseFile(file){
    validateFile(file);
    var ext=extension(file.name);
    if(ext==="xlsx"||ext==="xls"){
      return parseXLSX(file).then(function(rows){return {rows:rows,fileName:file.name,detectedType:ext};});
    }
    return readText(file).then(function(raw){
      var trimmed=text(raw),rows;
      if(ext==="json"||trimmed.charAt(0)==="{"||trimmed.charAt(0)==="["){rows=parseJSON(raw);}
      else if(ext==="html"||/<table|<html|<tr/i.test(trimmed.slice(0,1000))){rows=parseHTML(raw);}
      else{rows=parseCSV(raw);}
      return {rows:rows,fileName:file.name,detectedType:ext||"texto"};
    });
  }

  function normalizeRequirementValue(value){
    var normalized=normalizeBasic(value).toUpperCase();
    if(normalized==="CUMPLE"){return "CUMPLE";}
    if(normalized==="NO CUMPLE"||normalized==="NOCUMPLE"){return "NO CUMPLE";}
    if(normalized==="PENDIENTE"){return "PENDIENTE";}
    return text(value).toUpperCase();
  }
  function completenessScore(row){return Object.keys(row||{}).reduce(function(total,key){var value=row[key];return value!==null&&value!==undefined&&text(value)!==""?total+1:total;},0);}
  function chooseMoreComplete(a,b){return completenessScore(b)>=completenessScore(a)?b:a;}
  function detectRequirements(row,base){
    var list=[];
    Object.keys(row||{}).forEach(function(key){
      if(!safeKey(key)||!isRequirementValue(row[key])){return;}
      list.push({id:makeRequirementKey(base.cedula,base.periodoId,key),idEstudiantePeriodo:base.id,studentId:base.id,cedula:base.cedula,periodoId:base.periodoId,periodoLabel:base.periodoLabel,requisitoKey:normalizeKey(key),nombre:text(key).replace(/\s+/g," "),valor:normalizeRequirementValue(row[key]),estado:normalizeRequirementValue(row[key]),source:"excel",createdAt:nowISO(),updatedAt:nowISO()});
    });
    return list;
  }
  function detectContact(row,base){
    var telegramRules=window.BDLRulesPersona||{};
    var user=text(row.telegramUser||row._telegramUser||"");
    var chatId=text(row.telegramChatId||row._telegramChatId||"");
    if(telegramRules.normalizeTelegramUser){user=telegramRules.normalizeTelegramUser(user);}
    if(telegramRules.normalizeTelegramChatId){chatId=telegramRules.normalizeTelegramChatId(chatId);}
    return {id:base.id,idEstudiantePeriodo:base.id,studentId:base.id,cedula:base.cedula,numeroIdentificacion:base.cedula,periodoId:base.periodoId,periodoLabel:base.periodoLabel,CorreoInstitucional:text(findValue(row,["CorreoInstitucional","correoInstitucional"])),CorreoPersonal:text(findValue(row,["CorreoPersonal","correoPersonal","email","correo"])),Celular:text(findValue(row,["Celular","celular","Telefono","Teléfono","telefono"])),telegramUser:user,telegramChatId:chatId,_telegramUser:user,_telegramChatId:chatId,createdAt:nowISO(),updatedAt:nowISO()};
  }
  function detectNotes(row,base){
    var article=text(row.Notart||row.Nart||row.nart||row.NotaArt||row.notaArticulo||"");
    var defense=text(row.Notdef||row.Ndef||row.ndef||row.NotaDef||row.notaDefensa||"");
    var finalNote=text(row.Notafinal||row.NotaFinal||row.Nfin||row.nfin||row.notaFinal||"");
    if(!article&&!defense&&!finalNote){return null;}
    return {id:base.id,notaId:base.id,idEstudiantePeriodo:base.id,studentId:base.id,cedula:base.cedula,numeroIdentificacion:base.cedula,periodoId:base.periodoId,periodoLabel:base.periodoLabel,Notart:article,Notdef:defense,Notafinal:finalNote,source:"excel",createdAt:nowISO(),updatedAt:nowISO()};
  }

  function normalizeOneRow(row,options,result){
    row=sanitizeRow(row||{});options=options||{};result=result||{};
    var periodoId=canonicalPeriodId(options.periodoId);
    var periodoLabel=text(options.periodoLabel||options.periodoNombre||periodoId);
    if(!periodoId){result.errores.push("No hay período seleccionado. La carga fue bloqueada.");return null;}
    var rawCedula=findValue(row,fields.id||[]);
    var identity=analyzeIdentification(rawCedula);
    var cedula=identity.canonical;
    var nombres=text(findValue(row,fields.names||[]));
    var carrera=text(findValue(row,fields.career||[]));
    var codigoCarrera=text(findValue(row,fields.careerCode||[]));
    if(!cedula){result.errores.push("Registro sin identificación: "+JSON.stringify(row).slice(0,180));return null;}
    if(!nombres){result.errores.push("Registro sin nombres para identificación "+cedula+".");return null;}
    if(identity.missingLeadingZero&&identity.safeAutoCorrection){result.advertencias.push("Cédula ecuatoriana corregida con cero inicial: "+rawCedula+" → "+cedula);}
    else if(/^\d{9}$/.test(identity.raw||"")){result.advertencias.push("Identificación de nueve dígitos conservada porque no valida como cédula ecuatoriana: "+cedula);}
    if(cedula.length<9||cedula.length>10){result.advertencias.push("Identificación con longitud inusual; se conserva por posible documento extranjero: "+cedula);}
    var id=makeStudentKey(cedula,periodoId);
    var student=Object.assign({},row,{id:id,idEstudiantePeriodo:id,studentId:id,cedula:cedula,numeroIdentificacion:cedula,Nombres:nombres,nombres:nombres,CodigoCarrera:codigoCarrera||text(row.CodigoCarrera||row.codigoCarrera||""),NombreCarrera:carrera||text(row.NombreCarrera||row.nombreCarrera||""),Sede:text(row.Sede||row.sede||""),Modalidad:text(row.Modalidad||row.modalidad||""),HorarioComplexivo:text(row.HorarioComplexivo||row.horarioComplexivo||""),CorreoInstitucional:text(row.CorreoInstitucional||row.correoInstitucional||""),CorreoPersonal:text(row.CorreoPersonal||row.correoPersonal||row.email||row.correo||""),Celular:text(row.Celular||row.celular||row.Telefono||row.telefono||""),periodoId:periodoId,periodId:periodoId,periodoLabel:periodoLabel,ultimoPeriodoId:periodoId,estadoMatricula:text(row.estadoMatricula||row.EstadoMatricula||status.active||"ACTIVO"),division:text(row.division||row.Division||row["división"]||row["División"]||""),createdAt:text(row.createdAt)||nowISO(),updatedAt:nowISO(),original:clone(row)});
    student._requisitos=detectRequirements(row,student);
    student._contacto=detectContact(row,student);
    student._notas=detectNotes(row,student);
    return student;
  }

  function normalizeRows(rows,options){
    rows=sanitizeRows(rows);options=options||{};
    return new Promise(function(resolve,reject){
      var periodoId=canonicalPeriodId(options.periodoId);
      var periodoLabel=text(options.periodoLabel||options.periodoNombre||periodoId);
      if(!periodoId){reject(new Error("Seleccione primero un período antes de cargar."));return;}
      var result={ok:true,version:VERSION,periodoId:periodoId,periodoLabel:periodoLabel,totalEntrada:rows.length,students:[],duplicados:0,advertencias:[],errores:[],columnasDetectadas:{},createdAt:nowISO()};
      var byKey=Object.create(null);
      rows.forEach(function(row){
        Object.keys(row||{}).forEach(function(key){if(safeKey(key)){result.columnasDetectadas[key]=true;}});
        var normalized=normalizeOneRow(row,{periodoId:periodoId,periodoLabel:periodoLabel},result);
        if(!normalized){return;}
        if(byKey[normalized.id]){result.duplicados+=1;result.advertencias.push("Duplicado en archivo para "+normalized.cedula+". Se usa el registro más completo.");byKey[normalized.id]=chooseMoreComplete(byKey[normalized.id],normalized);}
        else{byKey[normalized.id]=normalized;}
      });
      result.students=Object.keys(byKey).map(function(key){return byKey[key];});
      if(result.errores.length&&!result.students.length){result.ok=false;}
      result.columnasDetectadas=Object.keys(result.columnasDetectadas).sort();
      resolve(result);
    });
  }

  function importFile(file,options){
    return parseFile(file).then(function(parsed){return normalizeRows(parsed.rows,options||{}).then(function(normalized){return Object.assign({},normalized,{fileName:parsed.fileName,detectedType:parsed.detectedType});});});
  }

  window.BL2Import={version:VERSION,parseFile:parseFile,importFile:importFile,normalizeRows:normalizeRows,parseCSV:parseCSV,parseJSON:parseJSON,parseHTML:parseHTML,parseXLSX:parseXLSX,normalizeCedula:normalizeCedula,isRequirementValue:isRequirementValue,ensureXLSX:ensureXLSX,limits:{maxFileBytes:MAX_FILE_BYTES,maxRows:MAX_ROWS,maxColumns:MAX_COLUMNS,maxCellLength:MAX_CELL_LENGTH},dependencyUrl:XLSX_LOCAL_URL};
})(window,document);
