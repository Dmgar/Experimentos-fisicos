# Péndulo Simple

## Descripción
Análisis del movimiento pendular utilizando datos experimentales obtenidos de grabaciones en video.

## Contenido
- `notebooks/`: Notebooks de análisis
  - `ejercicio_pendulo_simple.ipynb` - Notebook principal con procesamiento de datos y ajuste de curvas
- `videos/`: Grabaciones originales de los experimentos

## Metodología
1. Captura de video del movimiento pendular
2. Extracción de coordenadas cuadro por cuadro
3. Cálculo del período de oscilación
4. Ajuste sinusoidal para determinar la frecuencia
5. Estimación de la gravedad local

## Ecuaciones utilizadas
- Período: \( T = 2\pi \sqrt{\frac{L}{g}} \)
- Posición angular: \( \theta(t) = \theta_0 \cos(\omega t + \phi) \)
- Frecuencia angular: \( \omega = \sqrt{\frac{g}{L}} \)

## Resultados esperados
- Determinación experimental de la aceleración de la gravedad
- Validación del modelo de péndulo simple para pequeñas oscilaciones

## Requisitos
```bash
pip install numpy matplotlib scipy jupyter
