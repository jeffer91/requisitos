/* =========================================================
Nombre completo: sn-selectors.config.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-selectors.config.js
Modulo: Sacar N
Funcion o funciones:
- Centralizar textos y rutas visuales que se buscaran dentro de SISACAD.
- Preparar navegacion hacia Registro Notas Proyecto sin modificar informacion academica.
- Evitar que los textos de SISACAD queden repartidos en muchos archivos.
Con que se conecta:
- sn-sisacad-navigation.service.js
- electron/main.js
========================================================= */
(function(window){
  "use strict";

  window.SNSelectorsConfig = {
    menuIngreso: [
      "Ingreso",
      "INGRESO"
    ],
    registroNotasProyecto: [
      "Registro Notas Proyecto",
      "Registro de Notas Proyecto",
      "Registro Notas Proyecto de Titulacion",
      "Registro Notas Proyecto de Titulación",
      "Notas Proyecto",
      "Notas Proyecto de Titulacion",
      "Notas Proyecto de Titulación"
    ],
    textosSesion: [
      "usuario",
      "contraseña",
      "contrasena",
      "iniciar sesion",
      "iniciar sesión",
      "login",
      "ingresar"
    ],
    textosPantallaRegistro: [
      "Registro Notas Proyecto",
      "PROMEDIO TRABAJO ESCRITO",
      "PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACION",
      "PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACIÓN",
      "CALIFICACION FINAL DEL PROYECTO DE TITULACION",
      "CALIFICACIÓN FINAL DEL PROYECTO DE TITULACIÓN"
    ]
  };
})(window);
