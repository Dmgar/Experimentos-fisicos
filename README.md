# PhysLab · Experimentos Físicos 🔥
### *Project Fénix — Monorepo de Simulación Computacional & Percepción Experimental*

![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.13-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-4.10+-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-64FFDA?style=for-the-badge)

---

## 🌟 Visión del Proyecto

**PhysLab** es el renacimiento integral de la iniciativa **Experimentos-físicos** bajo los estándares de ingeniería de **Project Fénix**. Transforma prototipos académicos y scripts aislados de Google Colab en un **Monorepo de alto rendimiento científico**, compuesto por:

1. **Backend Computacional (`backend/`)**: Motor de resolución numérica de Ecuaciones Diferenciales Ordinarias (EDO) con algoritmos adaptativos Runge-Kutta (`RK45`), integración de visión computacional con OpenCV y API REST moderna en **FastAPI**.
2. **Laboratorio Interactivo (`frontend/`)**: Interfaz visual de alta tasa de cuadros (60 FPS) construida en **React + TypeScript + Vite**, con renderizado en Canvas HTML5 para simular física en tiempo real, planos de fase, espectros de resonancia y seguimiento óptico.
3. **Colección Experimental (`notebooks/` y `data/`)**: Cuadernos Jupyter reproducibles y videos reales de laboratorio documentando osciladores y trayectorias.

---

## 🔬 Módulos Físicos Implementados

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHYSLAB SCIENTIFIC ENGINE                       │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│  🪐 Péndulo No      │  🚀 Balística con   │  〰️ Oscilador Armónico,    │
│     Lineal          │     Arrastre        │     Amortiguado & Forzado  │
│  m·L·θ'' + b·θ' +   │  F_drag =           │  m·x'' + b·x' + k·x =      │
│  m·g·sin(θ) = 0     │  -½·ρ·Cd·A·|v|·v    │  F₀·cos(ω_f·t)             │
├─────────────────────┴─────────────────────┴────────────────────────────┤
│  👁️ Visión Computacional & Filtrado de Señales                        │
│  - Segmentación HSV + Momentos de masa (M₁₀/M₀₀)                       │
│  - Filtrado de convolución Savitzky-Golay + Detección de picos         │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Péndulo Simple y No Lineal Amortiguado
- Ecuación diferencial completa sin aproximación de ángulos pequeños:
  $$\frac{d^2\theta}{dt^2} + \frac{b}{m}\frac{d\theta}{dt} + \frac{g}{L}\sin(\theta) = 0$$
- Solución numérica adaptativa con `scipy.integrate.solve_ivp`.
- Comparativa analítica entre el periodo lineal $T_0 = 2\pi\sqrt{L/g}$ y la corrección de Borda/Legendre para grandes amplitudes.
- Visualización interactiva del **Espacio de Fases** $(\theta, \omega)$ y balance instantáneo de energía cinética y potencial ($E = K + U$).

### 2. Balística y Tiro Parabólico con Resistencia Aerodinámica
- Modelo de arrastre cuadrático atmosférico con viento vectorial $\vec{w}$:
  $$m\frac{d\vec{v}}{dt} = m\vec{g} - \frac{1}{2}\rho C_d A |\vec{v} - \vec{w}|(\vec{v} - \vec{w})$$
- Comparación en tiempo real entre la parábola ideal en vacío y la trayectoria real con fricción de aire.
- Métricas instantáneas de pérdida por resistencia aerodinámica, tiempo de vuelo y altura máxima en el ápice.

### 3. Oscilador Armónico Simple, Amortiguado y Forzado
- Clasificación de régimen físico en tiempo real:
  - **Subamortiguado ($\zeta < 1$):** Oscilaciones con envolvente exponencial.
  - **Críticamente Amortiguado ($\zeta = 1$):** Retorno óptimo al equilibrio sin oscilación.
  - **Sobreamortiguado ($\zeta > 1$):** Decaimiento aperiódico lento.
  - **Resonancia Forzada:** Amplitud en función de la frecuencia de excitación $\omega_f$ y espectro FFT.

### 4. Percepción & Detección Óptica de Movimiento (OpenCV)
- Extracción de trayectoria en coordenadas físicas a partir de video experimental:
  - Aislamiento en espacio de color **HSV**.
  - Operaciones morfológicas y cálculo analítico de centroides mediante momentos de Hu.
  - Calibración métrica (Píxeles por Metro, PPM).
  - Suavizado polinomial con filtro **Savitzky-Golay** y algoritmo de detección de picos para inferir el periodo experimental y el coeficiente de amortiguamiento $R^2$.

---

## 📁 Arquitectura del Repositorio

```
Experimentos-fisicos/
├── backend/                  # Motor Científico en Python & FastAPI
│   ├── pyproject.toml        # Gestión de dependencias con uv
│   ├── requirements.txt      # Dependencias estándar de pip
│   ├── main.py               # Servidor FastAPI con Swagger (/docs)
│   ├── cli.py                # Interfaz CLI para simulaciones por terminal
│   ├── src/
│   │   ├── physics/          # Modelos físicos (pendulum, projectile, oscillator)
│   │   └── vision/           # Tracking OpenCV & Savitzky-Golay
│   └── tests/                # Suite de pruebas unitarias (100% passed)
│
├── frontend/                 # Laboratorio Web Interactivo (React + Vite)
│   ├── src/
│   │   ├── components/       # Simuladores Canvas a 60 FPS
│   │   ├── api.ts            # Cliente API con solvers locales de respaldo
│   │   └── index.css         # Sistema de diseño cósmico Fénix
│   ├── package.json
│   └── vite.config.ts
│
├── data/                     # Datos experimentales y registros en video
│   ├── videos/               # Grabaciones reales de laboratorio (.mp4)
│   └── samples/              # Fotogramas de calibración (.png)
│
└── notebooks/                # Cuadernos Jupyter reproducibles
    ├── 01_pendulo_simple_modelado.ipynb
    ├── 02_procesamiento_imagenes_tracking.ipynb
    └── 03_trayectoria_proyectiles_balistica.ipynb
```

---

## 🚀 Puesta en Marcha Rápida

### Prerrequisitos
- Python 3.11 o superior (`uv` recomendado)
- Node.js 18 o superior (`npm`)

### 1. Backend (FastAPI + SciPy + OpenCV)
```bash
cd backend

# En Windows / sistemas con control de aplicaciones (recomendado):
uv run python -m uvicorn main:app --reload --port 8000

# O con pip tradicional:
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
La documentación interactiva Swagger estará disponible en: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend (React 19 + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```
Abre en tu navegador: [http://localhost:5173](http://localhost:5173)

### 3. Pruebas Unitarias Automatizadas
```bash
cd backend
uv run python -m pytest tests/
```

### 4. Uso por Línea de Comandos (CLI)
```bash
cd backend
python cli.py pendulum --length 1.5 --gravity 9.81 --theta 45 --damping 0.04
python cli.py projectile --v0 45 --angle 40 --wind -10
python cli.py oscillator --mass 1.0 --k 30.0 --damping 0.5
```

---

## 👨‍💻 Autor

**Dariem Garcia**  
*Economist & Data Scientist · Universidad Tecnológica de Bolívar (UTB)*  
- Portafolio: [dmgar.github.io](https://dmgar.github.io)
- GitHub: [@Dmgar](https://github.com/Dmgar)
- LinkedIn: [linkedin.com/in/dariem-garcia](https://www.linkedin.com/in/dariem-garcia)

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
