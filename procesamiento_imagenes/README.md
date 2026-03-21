# Procesamiento de Imágenes

## Descripción
Herramientas para extraer datos físicos a partir de imágenes y videos de experimentos. Este módulo permite rastrear objetos en movimiento y convertir coordenadas de píxeles a coordenadas físicas.

## Contenido
- `notebooks/`: Notebooks de procesamiento
  - `cp_de_imagen.ipynb` - Procesamiento de imágenes y extracción de trayectorias
- `prueba.png` - Imagen de prueba para validación del código

## Metodología
1. Carga de video o imagen
2. Preprocesamiento (filtrado, umbralización)
3. Detección de objetos por color o bordes
4. Extracción de coordenadas del centroide
5. Calibración espacial (píxeles → metros)
6. Exportación de datos para análisis posterior

## Funcionalidades principales
- Detección automática de objetos en movimiento
- Seguimiento de trayectorias
- Conversión de unidades
- Visualización de resultados

## Ejemplo de uso

```python

# Extraer trayectoria de un video

from tracker import track_object
coordenadas = track_object('video.mp4', objeto='pelota_roja')
