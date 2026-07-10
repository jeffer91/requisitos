/* =========================================================
Nombre completo: ficha.modalidad.js
Ruta o ubicación: /Requisitos/Ficha/ficha.modalidad.js
Función o funciones:
- Calcular y mostrar la modalidad de titulación del estudiante.
- Para períodos regulares permitir Examen Complexivo o Trabajo de Titulación.
- Para PVC fijar Artículo Académico.
- Guardar modalidadTitulacion en BaseLocal cuando sea posible.
- Mantener respaldo local si no existe repositorio disponible.
- Registrar evento manual de continuidad al cambiar modalidad cuando exista el servicio.
Con qué se conecta:
- ficha.core.js
- ficha.app.js
- ../Gestion/Excel/excel-local.repo.js
- ../BDLocal/continuity/events/cont.event.manual.js
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "REQ_FICHA_MODALIDAD_TITULACION_V1";

  var VALUES = {
    complexivo:"EXAMEN_COMPLEXIVO",
    trabajo:"TRABAJO_TITULACION",
    articulo:"ARTICULO_ACADEMICO"
  };

  var LABELS = {};
  LABELS[VALUES.complexivo] = "Examen Complexivo";
  LABELS[VALUES.trabajo] = "Trabajo de Titulación";
  LABELS[VALUES.articulo] = "Artículo Académico";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function rowId(row){
    row = row || {};

    return text(
      row._id ||
      row._cedula ||
      row.cedula ||
      row.numeroIdentificacion ||
      row.numeroidentificacion ||
      row.Cedula ||
      row.NumeroIdentificacion ||
      row.id ||
      row.docId ||
      row._docId
    );
  }

  function periodOf(row){
    row = row || {};

    return text(
      row._periodoNormalizado ||
      row._periodo ||
      row._periodoId ||
      row.periodoLabel ||
      row.periodoId ||
      row.ultimoPeriodoId ||
      row.periodId ||
      row.periodo ||
      row.Periodo
    );
  }

  function classifyPeriod(value){
    var raw = text(value);

    try{
      if(window.FichaCore && typeof window.FichaCore.requirementsForStudent === "function"){
        var fake = {_periodo:raw, periodo:raw, periodoLabel:raw, periodoId:raw};
        var approval = window.FichaCore.studentApproval ? window.FichaCore.studentApproval(fake) : null;

        if(approval && approval.periodType){
          return approval.periodType;
        }
      }
    }catch(error){}

    try{
      if(window.StatsRules && typeof window.StatsRules.classifyPeriod === "function"){
        return window.StatsRules.classifyPeriod(raw);
      }
    }catch(error2){}

    var n = norm(raw);
    var regular =
      (n.indexOf("octubre") >= 0 && n.indexOf("marzo") >= 0) ||
      (n.indexOf("abril") >= 0 && n.indexOf("septiembre") >= 0) ||
      /20\d{2}[-_/ ]?10.*20\d{2}[-_/ ]?03/.test(n) ||
      /20\d{2}[-_/ ]?04.*20\d{2}[-_/ ]?09/.test(n);

    return {
      id:regular ? "REGULAR" : "PVC",
      label:regular ? "Regular" : "PVC",
      isRegular:regular,
      isPVC:!regular,
      raw:raw
    };
  }

  function normalizeValue(value){
    var raw = text(value);
    var n = norm(raw);

    if(!raw){
      return "";
    }

    if(raw === VALUES.complexivo || n.indexOf("complexivo") >= 0){
      return VALUES.complexivo;
    }

    if(raw === VALUES.trabajo || n.indexOf("trabajo") >= 0 || n.indexOf("titulacion") >= 0 || n.indexOf("tesis") >= 0){
      return VALUES.trabajo;
    }

    if(raw === VALUES.articulo || n.indexOf("articulo") >= 0 || n.indexOf("academico") >= 0){
      return VALUES.articulo;
    }

    return raw;
  }

  function labelOf(value){
    value = normalizeValue(value);
    return LABELS[value] || text(value) || "Sin modalidad";
  }

  function storageKey(row){
    return [
      rowId(row),
      periodOf(row)
    ].join("|");
  }

  function readStorage(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    }catch(error){
      return {};
    }
  }

  function writeStorage(map){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    }catch(error){}
  }

  function savedFromStorage(row){
    var map = readStorage();
    return normalizeValue(map[storageKey(row)]);
  }

  function savedFromRow(row){
    row = row || {};

    return normalizeValue(
      row._modalidadTitulacion ||
      row.modalidadTitulacion ||
      row.ModalidadTitulacion ||
      row.modalidad ||
      row.Modalidad ||
      row.tipoTitulacion ||
      row.TipoTitulacion ||
      row._raw && (
        row._raw._modalidadTitulacion ||
        row._raw.modalidadTitulacion ||
        row._raw.ModalidadTitulacion ||
        row._raw.modalidad ||
        row._raw.Modalidad ||
        row._raw.tipoTitulacion ||
        row._raw.TipoTitulacion
      )
    );
  }

  function defaultFor(row){
    var type = classifyPeriod(periodOf(row));

    if(type.isPVC || type.id === "PVC"){
      return VALUES.articulo;
    }

    return VALUES.complexivo;
  }

  function options(row){
    var type = classifyPeriod(periodOf(row));

    if(type.isPVC || type.id === "PVC"){
      return [
        {
          value:VALUES.articulo,
          label:LABELS[VALUES.articulo],
          locked:true
        }
      ];
    }

    return [
      {
        value:VALUES.complexivo,
        label:LABELS[VALUES.complexivo],
        locked:false
      },
      {
        value:VALUES.trabajo,
        label:LABELS[VALUES.trabajo],
        locked:false
      }
    ];
  }

  function current(row){
    row = row || {};

    var type = classifyPeriod(periodOf(row));
    var locked = !!(type.isPVC || type.id === "PVC");
    var savedRow = savedFromRow(row);
    var savedLocal = savedFromStorage(row);
    var value = "";

    if(locked){
      value = VALUES.articulo;
    }else{
      value = savedRow || savedLocal || defaultFor(row);
    }

    return {
      value:value,
      label:labelOf(value),
      source:savedRow ? "guardado" : (savedLocal ? "local" : "automático"),
      locked:locked,
      periodType:type,
      options:options(row)
    };
  }

  function patchRow(row, value){
    if(!row){
      return;
    }

    row._modalidadTitulacion = value;
    row.modalidadTitulacion = value;

    if(row._raw && typeof row._raw === "object"){
      row._raw._modalidadTitulacion = value;
      row._raw.modalidadTitulacion = value;
    }
  }

  function saveStorage(row, value){
    var map = readStorage();
    map[storageKey(row)] = value;
    writeStorage(map);
  }

  function trySaveRepo(row, value){
    var id = rowId(row);
    var period = periodOf(row);
    var payload = {
      modalidadTitulacion:value,
      _modalidadTitulacion:value,
      actualizadoEn:new Date().toISOString()
    };

    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.updateStudent === "function"){
        window.BL2EstudiantesRepo.updateStudent(id, payload, {periodId:period});
        return true;
      }
    }catch(error){}

    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.actualizar === "function"){
        window.BL2EstudiantesRepo.actualizar(id, payload, {periodId:period});
        return true;
      }
    }catch(error2){}

    try{
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.updateStudent === "function"){
        window.ExcelLocalRepo.updateStudent(id, payload, {periodId:period});
        return true;
      }
    }catch(error3){}

    try{
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.updateStudentField === "function"){
        window.ExcelLocalRepo.updateStudentField(id, "modalidadTitulacion", value, {periodId:period});
        return true;
      }
    }catch(error4){}

    try{
      if(window.BL2DataEngine && typeof window.BL2DataEngine.updateStudent === "function"){
        window.BL2DataEngine.updateStudent(id, payload, {periodId:period});
        return true;
      }
    }catch(error5){}

    return false;
  }

  function registerEvent(row, value, source){
    var id = rowId(row);

    try{
      if(window.ContEventManual && typeof window.ContEventManual.record === "function"){
        window.ContEventManual.record({
          type:"ficha.modalidad",
          cedula:id,
          estudiante:id,
          periodo:periodOf(row),
          modalidadTitulacion:value,
          source:source || "Ficha",
          createdAt:new Date().toISOString()
        });
      }
    }catch(error){}

    try{
      if(window.BDLocalContinuity && typeof window.BDLocalContinuity.manual === "function"){
        window.BDLocalContinuity.manual({
          type:"ficha.modalidad",
          cedula:id,
          periodo:periodOf(row),
          modalidadTitulacion:value,
          createdAt:new Date().toISOString()
        });
      }
    }catch(error2){}
  }

  function save(row, value){
    row = row || {};

    var info = current(row);
    var selected = normalizeValue(value || info.value || defaultFor(row));

    if(info.locked){
      selected = VALUES.articulo;
    }

    var allowed = options(row).some(function(item){
      return item.value === selected;
    });

    if(!allowed){
      selected = defaultFor(row);
    }

    patchRow(row, selected);
    saveStorage(row, selected);

    var savedInRepo = trySaveRepo(row, selected);

    registerEvent(row, selected, savedInRepo ? "repo" : "localStorage");

    return {
      value:selected,
      label:labelOf(selected),
      source:savedInRepo ? "guardado" : "local",
      locked:info.locked,
      periodType:info.periodType,
      savedInRepo:savedInRepo
    };
  }

  window.FichaModalidad = {
    VALUES:VALUES,
    LABELS:LABELS,
    current:current,
    options:options,
    save:save,
    labelOf:labelOf,
    normalizeValue:normalizeValue,
    classifyPeriod:classifyPeriod
  };
})(window);