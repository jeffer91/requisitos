# BDLocal/connections/firebase

Conector Firebase.

Rol:

- nube principal
- sincronización normal
- respaldo online principal
- recuperación desde otra PC

Regla:

Firebase es importante, pero no debe bloquear la app. Si falla, el motor de continuidad debe saltar a Supabase o respaldo local/Excel.

Estado actual: carpeta preparada. El código Firebase actual aún vive en BDLocal/sync/ por compatibilidad.
