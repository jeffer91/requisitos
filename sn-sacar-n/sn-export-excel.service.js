/* =========================================================
Nombre completo: sn-export-excel.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-export-excel.service.js
Modulo: Sacar N
Funcion o funciones:
- Preparar datos de exportacion Excel para Sacar N.
- Crear dos hojas logicas: Notas Proyecto y Errores.
- Generar un archivo compatible con Excel sin librerias externas.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-report.service.js
- sn-ui-events.service.js
========================================================= */
(function(window, document){
  "use strict";

  var cfg = window.SNConfig || {};
  var state = window.SNState || {};
  var report = window.SNReport || {};

  function texto(valor){ return String(valor == null ? "" : valor).replace(/\s+/g, " ").trim(); }
  function xml(valor){
    return texto(valor).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  }
  function esNumero(valor){ return /^\d+(\.\d+)?$/.test(texto(valor).replace(",", ".")); }
  function celda(valor, encabezado){
    var v = texto(valor);
    var style = encabezado ? ' ss:StyleID="Header"' : '';
    var tipo = (!encabezado && esNumero(v)) ? "Number" : "String";
    if(tipo === "Number"){ v = v.replace(",", "."); }
    return '<Cell' + style + '><Data ss:Type="' + tipo + '">' + xml(v) + '</Data></Cell>';
  }
  function fila(celdas, encabezado){ return '<Row>' + (celdas || []).map(function(c){ return celda(c, encabezado); }).join("") + '</Row>'; }
  function hoja(nombre, filas){ return '<Worksheet ss:Name="' + xml(nombre).slice(0,31) + '"><Table>' + filas.join("") + '</Table></Worksheet>'; }

  function filasNotas(snapshot){
    var estudiantes = Array.isArray(snapshot.estudiantes) ? snapshot.estudiantes : [];
    var filas = [fila(["Cédula","Estudiante","Carrera","Período","Promedio trabajo escrito","Promedio defensa oral","Calificación final","Estado","Observación","Fecha de extracción","Fuente"], true)];
    if(!estudiantes.length){ filas.push(fila(["Sin estudiantes cargados","","","","","","","","","",""])); return filas; }
    estudiantes.forEach(function(e){
      filas.push(fila([e.cedula,e.nombres,e.carrera,e.periodo,e.promedioTrabajoEscrito,e.promedioDefensaOral,e.calificacionFinalProyecto,e.estado,e.observacion,e.fechaExtraccion,e.fuente || "SISACAD"]));
    });
    return filas;
  }

  function filasErrores(reporte){
    var novedades = Array.isArray(reporte.novedades) ? reporte.novedades : [];
    var filas = [fila(["Cédula","Estudiante","Carrera","Período","Estado / error","Observación","Acción recomendada"], true)];
    if(!novedades.length){ filas.push(fila(["Sin errores o novedades","","","","","",""])); return filas; }
    novedades.forEach(function(n){ filas.push(fila([n.cedula,n.nombres,n.carrera,n.periodo,n.estado,n.observacion,n.accionRecomendada])); });
    return filas;
  }

  function construirLibro(snapshot){
    snapshot = snapshot || (state.get ? state.get() : {});
    var rep = report.construir ? report.construir(snapshot) : { novedades:[] };
    return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Pattern="Solid"/></Style></Styles>' +
      hoja("Notas Proyecto", filasNotas(snapshot)) + hoja("Errores", filasErrores(rep)) + '</Workbook>';
  }

  function nombreArchivo(){
    var d = new Date();
    function pad(n){ return String(n).padStart(2,"0"); }
    return "Notas_Proyecto_SISACAD_" + d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + "_" + pad(d.getHours()) + "-" + pad(d.getMinutes()) + ".xls";
  }

  function guardarArchivo(nombre, contenido){
    var archivo = new Blob([contenido], { type:"application/vnd.ms-excel;charset=utf-8" });
    var enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.setAttribute("download", nombre);
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
  }

  function exportar(){
    var snapshot = state.get ? state.get() : {};
    var estudiantes = Array.isArray(snapshot.estudiantes) ? snapshot.estudiantes : [];
    if(!estudiantes.length){
      if(state.setModulo && cfg.estadosModulo){ state.setModulo(cfg.estadosModulo.listo, "No hay estudiantes cargados para exportar."); }
      return { ok:false, error:"Sin estudiantes" };
    }
    var nombre = nombreArchivo();
    guardarArchivo(nombre, construirLibro(snapshot));
    if(state.setModulo && cfg.estadosModulo){ state.setModulo(cfg.estadosModulo.listo, "Excel generado: " + nombre); }
    return { ok:true, archivo:nombre, total:estudiantes.length };
  }

  window.SNExportExcel = { exportar:exportar, construirLibro:construirLibro };
})(window, document);
