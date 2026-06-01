# Horario Pro

Aplicacion estatica para crear horarios academicos, detectar cruces, editar materias, exportar a Excel/PDF y guardar/cargar avances.

## Ejecutar local

Puedes abrir `index.html` directamente o servir la carpeta con Node.

```powershell
node server.js
```

Luego abre `http://localhost:4173`.

## Publicar en Render

1. Sube este proyecto a GitHub.
2. En Render crea un **Static Site**.
3. Build Command: dejar vacio.
4. Publish Directory: `.`.

La aplicacion no necesita backend ni base de datos. El avance se guarda en el navegador y tambien puede descargarse como `avance-horario.json`.
