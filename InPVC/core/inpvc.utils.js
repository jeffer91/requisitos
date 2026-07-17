/* Utilidades compartidas de InPVC. */
(function(window){
  "use strict";
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function number(value){if(value===null||value===undefined||text(value)===""){return null;}var n=Number(text(value).replace(",","."));return Number.isFinite(n)?Math.round(n*100)/100:null;}
  function pct(value,total){return total?Math.round((value*10000)/total)/100:0;}
  function note(value){var n=number(value);return n==null?"—":n.toLocaleString("es-EC",{minimumFractionDigits:2,maximumFractionDigits:2});}
  function reportCode(value){var match=text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?"UTET-INF-01-PRO-95-"+match[1]+"-"+match[2]:"";}
  function slug(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"seccion";}
  function download(blob,filename){var url=URL.createObjectURL(blob);var link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();setTimeout(function(){URL.revokeObjectURL(url);link.remove();},800);}
  function table(headers,rows,caption){
    rows=Array.isArray(rows)?rows:[];var html=caption?'<p class="inpvc-caption">'+esc(caption)+'</p>':"";
    html+='<div class="inpvc-table-wrap"><table><thead><tr>'+headers.map(function(h){return '<th>'+esc(h.label)+'</th>';}).join("")+'</tr></thead><tbody>';
    if(!rows.length){html+='<tr><td colspan="'+headers.length+'">Sin registros.</td></tr>';}
    else{html+=rows.map(function(row){return '<tr>'+headers.map(function(h){var value=typeof h.value==="function"?h.value(row):row[h.key];return '<td>'+esc(value==null||value===""?"—":value)+'</td>';}).join("")+'</tr>';}).join("");}
    return html+'</tbody></table></div>';
  }
  function barChart(title,items){
    items=Array.isArray(items)?items:[];var max=Math.max.apply(Math,[1].concat(items.map(function(item){return Number(item.value||0);})));return '<figure class="inpvc-chart"><figcaption>'+esc(title)+'</figcaption><div class="inpvc-bars">'+items.map(function(item){var width=Math.max(2,Math.round((Number(item.value||0)/max)*100));return '<div class="inpvc-bar-row"><span>'+esc(item.label)+'</span><div><i style="width:'+width+'%"></i></div><strong>'+esc(item.display==null?item.value:item.display)+'</strong></div>';}).join("")+'</div></figure>';
  }
  function registerSection(definition){window.InPVCSections=window.InPVCSections||[];window.InPVCSections.push(definition);}
  window.InPVCUtils={text:text,esc:esc,number:number,pct:pct,note:note,reportCode:reportCode,slug:slug,download:download,table:table,barChart:barChart,registerSection:registerSection};
})(window);
