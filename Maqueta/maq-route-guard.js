/* =========================================================
Nombre completo: maq-route-guard.js
Ruta o ubicación: /Maqueta/maq-route-guard.js
Función o funciones:
- Proteger el menú principal contra rutas que todavía no existen.
- Marcar Títulos Estudiante, Administrador y Coordinador como pendientes.
- Evitar que el router abra iframes rotos o páginas 404.
- Mantener un diagnóstico simple de las rutas protegidas.
Con qué se conecta:
- maq-modulos-registry.js
- maq-core.js
- maq-menu.js
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-route-integrity";
  var pending=[
    {
      id:"titulos_estudiante",
      nombre:"Títulos - Estudiante",
      expectedRoute:"../Titulos/public/ta-titulo-articulo-estudiante.html",
      reason:"La pantalla todavía no existe en el repositorio."
    },
    {
      id:"titulos_admin",
      nombre:"Títulos - Administrador",
      expectedRoute:"../Titulos/electron/admin/ta-titulo-articulo-administrador.html",
      reason:"La pantalla todavía no existe en el repositorio."
    },
    {
      id:"titulos_coordinador",
      nombre:"Títulos - Coordinador",
      expectedRoute:"../Titulos/public/ta-titulo-articulo-coordinador.html",
      reason:"La pantalla todavía no existe en el repositorio."
    }
  ];

  function registry(){
    return window.MAQ_MODULOS_REGISTRY||null;
  }

  function apply(){
    var current=registry();
    if(!current||typeof current.registrar!=="function"){
      return false;
    }

    pending.forEach(function(item){
      current.registrar({
        id:item.id,
        nombre:item.nombre,
        ruta:item.expectedRoute,
        estado:"pendiente"
      });
    });

    try{
      window.dispatchEvent(new CustomEvent("maq:route-guard-ready",{
        detail:status()
      }));
    }catch(error){}

    return true;
  }

  function status(){
    return {
      ok:true,
      version:VERSION,
      protectedRoutes:pending.map(function(item){
        return {
          id:item.id,
          route:item.expectedRoute,
          state:"pendiente",
          reason:item.reason
        };
      })
    };
  }

  window.MAQ_ROUTE_GUARD={
    version:VERSION,
    apply:apply,
    status:status
  };

  apply();
})(window);
