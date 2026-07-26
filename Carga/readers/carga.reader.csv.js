(function(window){
  "use strict";

  var VERSION="2.0.1-full-async";
  var CHUNK_SIZE=250000;

  function text(value){return String(value==null?"":value);}
  function clean(value){return text(value).replace(/\u00a0/g," ").trim();}
  function emit(percent,message){try{window.dispatchEvent(new CustomEvent("carga:progress",{detail:{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"Procesando CSV",phase:"reading"}}));}catch(error){}}
  function safeHeader(value,index,used){
    var header=clean(value)||("Columna"+(index+1)),lower=header.toLowerCase();
    if(lower==="__proto__"||lower==="prototype"||lower==="constructor"){header="campo_"+(index+1);}
    var base=header,count=2,key=header.toLowerCase();
    while(used[key]){header=base+"_"+count;count+=1;key=header.toLowerCase();}
    used[key]=true;return header;
  }
  function detectDelimiter(source){
    var lines=text(source).slice(0,100000).split(/\r?\n/).filter(function(line){return line.trim();}).slice(0,12),totals={"\t":0,";":0,",":0};
    lines.forEach(function(line){var quoted=false;for(var i=0;i<line.length;i+=1){var ch=line.charAt(i);if(ch==='"'){if(quoted&&line.charAt(i+1)==='"'){i+=1;}else{quoted=!quoted;}}else if(!quoted&&Object.prototype.hasOwnProperty.call(totals,ch)){totals[ch]+=1;}}});
    if(totals["\t"]>=totals[";"]&&totals["\t"]>=totals[","]){return "\t";}return totals[";"]>totals[","]?";":",";
  }
  function parser(source,options,asyncMode){
    source=text(source);options=options||{};
    var delimiter=options.delimiter||detectDelimiter(source),length=source.length,index=0,field="",record=[],headers=null,rows=[],quoted=false;
    function pushField(){record.push(field);field="";}
    function finishRecord(){
      pushField();
      if(!headers){var used=Object.create(null);headers=record.map(function(value,i){return safeHeader(value,i,used);});}
      else if(record.some(function(value){return clean(value)!=="";})){var row=Object.create(null);headers.forEach(function(header,i){row[header]=record[i]==null?"":record[i];});rows.push(row);}
      record=[];
    }
    function processUntil(limit){
      while(index<limit){
        var ch=source.charAt(index);
        if(quoted){if(ch==='"'){if(source.charAt(index+1)==='"'){field+='"';index+=2;continue;}quoted=false;index+=1;continue;}field+=ch;index+=1;continue;}
        if(ch==='"'){quoted=true;index+=1;continue;}
        if(ch===delimiter){pushField();index+=1;continue;}
        if(ch==='\n'){finishRecord();index+=1;continue;}
        if(ch==='\r'){finishRecord();index+=source.charAt(index+1)==='\n'?2:1;continue;}
        field+=ch;index+=1;
      }
    }
    function finishAll(){if(field!==""||record.length){finishRecord();}emit(90,"CSV leído: "+rows.length+" filas");return rows;}
    if(!asyncMode){processUntil(length);return finishAll();}
    return new Promise(function(resolve,reject){(function step(){try{processUntil(Math.min(length,index+CHUNK_SIZE));emit(50+(index/Math.max(1,length))*40,"Leyendo CSV: "+rows.length+" filas");if(index<length){window.setTimeout(step,0);}else{resolve(finishAll());}}catch(error){reject(error);}})();});
  }
  function parse(source,options){return parser(source,options,false);}
  function parseAsync(source,options){return parser(source,options,true);}
  window.CargaReaderCSV={version:VERSION,parse:parse,parseAsync:parseAsync,detectDelimiter:detectDelimiter};
})(window);
