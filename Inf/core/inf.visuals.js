/* Visualizaciones estructurales sin calificaciones simuladas. */
(function(window,document){
"use strict";
var NS="http://www.w3.org/2000/svg";
function svg(tag,attrs,label){
 var node=document.createElementNS(NS,tag);
 Object.keys(attrs||{}).forEach(function(k){node.setAttribute(k,String(attrs[k]));});
 if(label!==undefined)node.textContent=String(label);
 return node;
}
function textLines(node,x,y,value,max,width,opts){
 var words=String(value).split(/\s+/),lines=[],current="";
 words.forEach(function(word){
  if((current+" "+word).trim().length>max&&current){lines.push(current);current=word;}
  else current=(current+" "+word).trim();
 });
 if(current)lines.push(current);
 var visible=lines.slice(0,width||4);
 visible.forEach(function(line,i){
   var child=svg("tspan",{x:x,dy:i?16:0},line);node.appendChild(child);
 });
 if(lines.length>visible.length)node.appendChild(svg("title",{},value));
 node.setAttribute("x",x);node.setAttribute("y",y);
 Object.keys(opts||{}).forEach(function(k){node.setAttribute(k,opts[k]);});
 return node;
}
function centerTitle(root,value){
 var lines=[],chunk="";
 value.split(/\s+/).forEach(function(w){
  if((chunk+" "+w).trim().length>22&&chunk){lines.push(chunk);chunk=w;}
  else chunk=(chunk+" "+w).trim();
 });
 if(chunk)lines.push(chunk);
 var start=230-(lines.length-1)*10;
 lines.forEach(function(l,i){root.appendChild(svg("text",{x:380,y:start+i*20,"text-anchor":"middle","font-family":"Arial","font-size":17,"font-weight":"bold",fill:"#fff"},l.toUpperCase()));});
}
function coreDiagram(career){
 var root=svg("svg",{viewBox:"0 0 760 485",role:"img","aria-label":"Diagrama de núcleos de "+career.career});
 root.appendChild(svg("title",{},"Cuatro núcleos de "+career.career));
 [[380,113,380,190],[500,235,612,235],[380,282,380,357],[153,235,260,235]].forEach(function(p){
  root.appendChild(svg("line",{x1:p[0],y1:p[1],x2:p[2],y2:p[3],stroke:"#8196a8","stroke-width":4,"stroke-dasharray":"6 8"}));
 });
 root.appendChild(svg("rect",{x:260,y:190,width:240,height:92,rx:18,fill:"#34465c"}));
 centerTitle(root,career.career);
 root.appendChild(svg("text",{x:380,y:264,"text-anchor":"middle",fill:"#fff","font-family":"Arial","font-size":15},"4 núcleos"));
 var places=[{x:380,y:65,labelY:145,cx:380,fill:"#dbe9fb",stroke:"#3d80c7"},
 {x:655,y:235,labelY:321,cx:600,fill:"#d5f2e8",stroke:"#339e87"},
 {x:380,y:412,labelY:327,cx:380,fill:"#ffe9c6",stroke:"#dd9d35"},
 {x:105,y:235,labelY:320,cx:150,fill:"#e9dcfa",stroke:"#9b65c8"}];
 career.nuclei.forEach(function(n,i){
  var p=places[i];
  root.appendChild(svg("circle",{cx:p.x,cy:p.y,r:48,fill:p.fill,stroke:p.stroke,"stroke-width":2.5}));
  root.appendChild(svg("text",{x:p.x,y:p.y-2,"text-anchor":"middle","font-family":"Arial","font-size":19,fill:"#263b55"},"Núcleo"));
  root.appendChild(svg("text",{x:p.x,y:p.y+22,"text-anchor":"middle","font-family":"Arial","font-size":19,fill:"#263b55","font-weight":"bold"},n.number));
  var label=svg("text",{"text-anchor":"middle","font-family":"Arial","font-size":15,fill:"#2c3b4d"});
  textLines(label,p.cx,p.labelY,n.name,26,3);
  root.appendChild(label);
 });
 return root;
}
function gantt(rows,title){
 var clean=rows.filter(function(r){return window.InfSchedules.day(r.start)!==null&&window.InfSchedules.day(r.end)!==null&&window.InfSchedules.day(r.start)<=window.InfSchedules.day(r.end);});
 var width=1110,labelW=340,height=Math.max(130,84+clean.length*29);
 var root=svg("svg",{viewBox:"0 0 "+width+" "+height,role:"img","aria-label":"Cronograma Gantt: "+title});
 root.appendChild(svg("title",{},"Cronograma de "+title));
 if(!clean.length){
  root.appendChild(svg("text",{x:16,y:40,fill:"#778391","font-size":18},"Completa las fechas para visualizar el cronograma."));
  return root;
 }
 var lo=Math.min.apply(null,clean.map(r=>window.InfSchedules.day(r.start)));
 var hi=Math.max.apply(null,clean.map(r=>window.InfSchedules.day(r.end)));
 var span=Math.max(86400000,hi-lo+86400000),plot=width-labelW-22;
 function px(date){return labelW+(date-lo)/span*plot;}
 root.appendChild(svg("text",{x:14,y:23,fill:"#254e76","font-size":17,"font-family":"Arial","font-weight":"bold"},title));
 var first=new Date(lo),tick=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1));
 var months=0;
 while(tick.getTime()<=hi&&months<30){
  if(tick.getTime()>=lo){
   var xt=px(tick.getTime());
   root.appendChild(svg("line",{x1:xt,x2:xt,y1:42,y2:height-10,stroke:"#e1e9f0"}));
   root.appendChild(svg("text",{x:xt+3,y:39,"font-size":12,fill:"#60738b"},("0"+(tick.getUTCMonth()+1)).slice(-2)+"/"+tick.getUTCFullYear()));
  }
  tick=new Date(Date.UTC(tick.getUTCFullYear(),tick.getUTCMonth()+1,1));months++;
 }
 clean.forEach(function(r,i){
  var y=57+i*29;
  if(i%2===0)root.appendChild(svg("rect",{x:0,y:y-15,width:width,height:28,fill:"#f0f5f9"}));
  var name=r.activity.length>44?r.activity.slice(0,43)+"…":r.activity;
  root.appendChild(svg("text",{x:12,y:y+3,"font-size":13,fill:"#2b4158"},name));
  var start=window.InfSchedules.day(r.start),end=window.InfSchedules.day(r.end);
  var color=/^Fase 1/.test(r.phase)?"#477eae":/^Fase 2/.test(r.phase)?"#569b87":/^Fase 3/.test(r.phase)?"#b38749":"#527ca6";
  var x=px(start),barW=Math.max(5,(end-start+86400000)/span*plot);
  root.appendChild(svg("rect",{x:x,y:y-12,width:barW,height:18,rx:4,fill:color}));
  root.appendChild(svg("title",{},r.activity+" · "+r.start+" a "+r.end+" · "+(r.status||"NO_VERIFICADO")));
 });
 return root;
}
window.InfVisuals=Object.freeze({coreDiagram:coreDiagram,gantt:gantt});
})(window,document);
