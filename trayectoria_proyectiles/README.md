# Trayectoria de Proyectiles

## Descripción
Simulación numérica y análisis de trayectorias parabólicas de proyectiles, incluyendo efectos de resistencia del aire (opcional).

## Contenido
- `notebooks/`: Notebooks de simulación
  - `TrajecPro.ipynb` - Simulación de trayectorias con diferentes parámetros
- `videos/`: Grabaciones de lanzamientos experimentales (si están disponibles)

## Metodología
1. Modelado de ecuaciones de movimiento
2. Simulación numérica usando Euler o Runge-Kutta
3. Visualización de trayectorias
4. Comparación con datos experimentales

## Ecuaciones utilizadas
- Movimiento horizontal: \( x(t) = x_0 + v_{0x}t \)
- Movimiento vertical: \( y(t) = y_0 + v_{0y}t - \frac{1}{2}gt^2 \)
- Alcance máximo: \( R = \frac{v_0^2 \sin(2\theta)}{g} \)

## Resultados esperados
- Visualización de trayectorias para diferentes ángulos y velocidades
- Determinación del ángulo óptimo para máximo alcance

## Requisitos

```bash
pip install numpy matplotlib scipy jupyter
