(function(window){
  "use strict";

  var rows = [
    {
      periodoId:"Abril 2026 a Septiembre 2026",
      numeroIdentificacion:"0999999901",
      Nombres:"ESTUDIANTE PRUEBA UNO",
      CodigoCarrera:"TEST-001",
      NombreCarrera:"CARRERA DE PRUEBA",
      Sede:"Matriz",
      Modalidad:"Presencial",
      Academico:"CUMPLE",
      Financiero:"CUMPLE",
      Documentacion:"CUMPLE",
      Titulacion:"CUMPLE",
      Ingles:"CUMPLE",
      Notafinal:"9"
    },
    {
      periodoId:"Abril 2026 a Septiembre 2026",
      numeroIdentificacion:"0999999902",
      Nombres:"ESTUDIANTE PRUEBA DOS",
      CodigoCarrera:"TEST-001",
      NombreCarrera:"CARRERA DE PRUEBA",
      Sede:"Matriz",
      Modalidad:"Presencial",
      Academico:"NO CUMPLE",
      Financiero:"CUMPLE",
      Documentacion:"NO CUMPLE",
      Titulacion:"CUMPLE",
      Ingles:"CUMPLE",
      Notafinal:"6"
    }
  ];

  window.BDLTestData = {
    rows: rows,
    clone: function(){ return rows.map(function(row){ return Object.assign({}, row); }); }
  };
})(window);
