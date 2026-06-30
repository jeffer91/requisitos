# Ayuda de BL

BL es el centro local de trabajo y continuidad.

Uso simple:

1. Trabaja normalmente en la app.
2. Todo se guarda primero en BDLocal.
3. Firebase se usa como nube principal cuando funciona.
4. Si Firebase falla, Supabase protege datos manuales y críticos.
5. Excel sirve para cierre del día y respaldo portable.
6. Google Sheets sirve para reportes y revisión visible.

Regla principal:

No debes preocuparte por cada sincronización. El motor automático debe detectar fallos, cambiar la ruta de protección y avisar solo cuando cambie el estado general.
