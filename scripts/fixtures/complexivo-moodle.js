"use strict";
/* Libros de Moodle del Examen Complexivo con la MISMA estructura que los reales
 * (5, 7 y 11 columnas), pero con estudiantes y correos FICTICIOS.
 * Moodle escribe «NOMBRES APELLIDOS» y a veces pega las iniciales del avatar
 * («AQANA» = AQ + ANA); BDLocal guarda «APELLIDOS NOMBRES» y no tiene correos. */
const chrome=(title)=>[title,"Curso","Configuración","Participantes","Calificaciones","Informes","Más",
 "Menú de navegación del libro de calificaciones","Buscar usuarios","Buscar usuarios",
 "Una tabla con los nombres de los estudiantes en la primera columna, con actividades a calificar agrupadas por curso y categoría en la parte superior.",
 "Participantes\t",title+"Mostrando calificaciones y totales","TeóricoMostrando calificaciones y totales",
 "PrácticoMostrando calificaciones y totales"," ","Nombre / Apellido(s)","Dirección de correo"];
function book(title,columns,rows,average){
 const out=chrome(title).concat(columns);
 rows.forEach(([name,email,values])=>{out.push(name,email);out.push(...values);});
 out.push("Promedio general\t",...average);
 return out.join("\n");
}
const C7=["CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO","CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO -SUPLETORIO",
 "Media de calificacionesTotal Teórico","CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO -SUPLETORIO","Media de calificacionesTotal Práctico","SumaTotal del curso"];
const C11=["CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO","CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO (VERSION 2)",
 "CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO Supletorio","CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO -SUPLETORIO",
 "Media de calificacionesTotal Teórico","CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO (VERSiÓN 2))","CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO Supletorio",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO -SUPLETORIO","Media de calificacionesTotal Práctico","SumaTotal del curso"];
const C5=["CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO","Media de calificacionesTotal Teórico",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO","Media de calificacionesTotal Práctico","SumaTotal del curso"];
const basica=book("Examen Complexivo Educación Básica octubre marzo 2026]",C7,[
 ["AQANA LUCIA QUISPE ORTIZ","aordinaria@itsqmet.edu.ec",["68,00","-","27,20","80,00","-","48,00","75,20"]],        // ord 7,52
 ["BRUNO ESTEBAN SUAREZ PAZ","bsupletorio@itsqmet.edu.ec",["50,00","69,00","23,80","60,00","75,00","40,50","64,30"]], // sup 7,26 (Moodle 6,43)
 ["CMCIRO DANIEL MORA LEON","csolosuple@itsqmet.edu.ec",["-","85,00","34,00","-","85,00","51,00","85,00"]],     // sup 8,50
 ["DORA ELENA VACA RUIZ","donline@itsqmet.edu.ec",["92,00","-","36,80","90,00","-","54,00","90,80"]]               // ord 9,08, -L-
],["71,61","79,00","29,28","86,87","87,40","52,68","81,96"]);
const marketing=book("Examen Complexivo Marketing Digital y Comercio Electrónico octubre marzo 2026]",C7,[
 ["DMDIEGO DONATO MENA CASTRO","dmena.prueba@itsqmet.edu.ec",["84,00","-","33,60","10,00","80,00","27,00","60,60"]],  // supletorio incompleto
 ["EPELSA MARIA PAZ TORO","erequisitos@itsqmet.edu.ec",["90,00","-","36,00","90,00","-","54,00","90,00"]]   // bloqueada por requisitos
],["86,63","81,75","34,82","75,29","80,00","46,36","81,17"]);
const administracion=book("Examen Complexivo Administración octubre marzo 2026]",C11,[
 ["EDISON FABIAN MEJIA VERA","esuple@itsqmet.edu.ec",["72,00","-","96,00","-","33,60","50,00","-","95,00","-","43,50","77,10"]], // sup 9,54
 ["YMYAJAIRA LUZ MORALES MUÑOZ","yversion@itsqmet.edu.ec",["-","96,00","-","-","38,40","-","95,00","-","-","57,00","95,40"]],     // Versión 2 = sup 9,54
 ["FRFELIX ANDRES RIOS SOTO","fdoble@itsqmet.edu.ec",["-","90,00","88,00","-","35,60","-","90,00","-","-","54,00","89,60"]]    // dos supletorios teóricos → error
],["89,00","96,00","96,00","-","35,92","77,83","95,00","95,00","-","47,69","83,60"]);
const software=book("Examen Complexivo Desarrollo de Software octubre marzo 2026]",C5,[
 ["WAWALTER HUGO ARIAS LARA","wcero@itsqmet.edu.ec",["62,50","25,00","0,00","0,00","25,00"]],                 // ord 2,50 no aprobado
 ["CACARLA INES ARCOS NUÑEZ","cnorinde@itsqmet.edu.ec",["-","-","-","-","-"]],                              // no rindió
 ["JFJAIME ANDRES FALCON ALVAREZ","jblancos@itsqmet.edu.ec",["92,50"," ","37,00","56,00"," ","33,60","70,60"]],  // celdas en blanco de Moodle
 ["OTTO RENE PERIODO SOLIS","operiodo@itsqmet.edu.ec",["80,00","32,00","100,00","60,00","92,00"]]             // matriculado en otro período
],["79,77","31,91","47,64","28,58","60,49"]);
const bdlocalNames={"AQANA LUCIA QUISPE ORTIZ": "QUISPE ORTIZ ANA LUCIA", "BRUNO ESTEBAN SUAREZ PAZ": "SUAREZ PAZ BRUNO ESTEBAN", "CMCIRO DANIEL MORA LEON": "MORA LEON CIRO DANIEL", "DORA ELENA VACA RUIZ": "VACA RUIZ DORA ELENA", "DMDIEGO DONATO MENA CASTRO": "MENA CASTRO DIEGO DONATO", "EPELSA MARIA PAZ TORO": "PAZ TORO ELSA MARIA", "EDISON FABIAN MEJIA VERA": "MEJIA VERA EDISON FABIAN", "YMYAJAIRA LUZ MORALES MUÑOZ": "MORALES MUÑOZ YAJAIRA LUZ", "FRFELIX ANDRES RIOS SOTO": "RIOS SOTO FELIX ANDRES", "WAWALTER HUGO ARIAS LARA": "ARIAS LARA WALTER HUGO", "CACARLA INES ARCOS NUÑEZ": "ARCOS NUÑEZ CARLA INES", "JFJAIME ANDRES FALCON ALVAREZ": "FALCON ALVAREZ JAIME ANDRES", "OTTO RENE PERIODO SOLIS": "PERIODO SOLIS OTTO RENE"};
module.exports={bdlocalNames,basica,marketing,administracion,software,all:()=>[basica,marketing,administracion,software].join("\n\n\n\n")};
