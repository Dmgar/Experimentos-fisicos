"""PhysLab API - High-Performance Physics Simulation & Perception Backend."""

from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.physics import (
    PendulumSimulator,
    PendulumParams,
    ProjectileSimulator,
    ProjectileParams,
    OscillatorSimulator,
    OscillatorParams,
)
from src.vision import VideoTracker, SignalProcessor

app = FastAPI(
    title="PhysLab Core API · Project Fénix",
    description="Motor computacional de simulación física, modelado de ecuaciones diferenciales ordinarias y análisis de visión computacional.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Request Models ---
class PendulumRequest(BaseModel):
    length: float = Field(1.0, ge=0.05, le=20.0, description="Longitud L (m)")
    gravity: float = Field(9.80665, ge=0.5, le=30.0, description="Gravedad g (m/s^2)")
    mass: float = Field(0.25, ge=0.01, le=50.0, description="Masa m (kg)")
    damping: float = Field(0.04, ge=0.0, le=5.0, description="Coeficiente de fricción b (N*s/m)")
    theta0_deg: float = Field(35.0, ge=-175.0, le=175.0, description="Ángulo inicial en grados")
    omega0: float = Field(0.0, ge=-20.0, le=20.0, description="Velocidad angular inicial (rad/s)")
    t_max: float = Field(12.0, ge=1.0, le=60.0, description="Tiempo de simulación (s)")
    num_points: int = Field(500, ge=50, le=2000)


class ProjectileRequest(BaseModel):
    v0: float = Field(32.0, ge=1.0, le=300.0, description="Velocidad inicial (m/s)")
    angle_deg: float = Field(45.0, ge=1.0, le=89.0, description="Ángulo de disparo (grados)")
    y0: float = Field(0.0, ge=0.0, le=200.0, description="Altura inicial (m)")
    gravity: float = Field(9.80665, ge=0.5, le=30.0, description="Gravedad (m/s^2)")
    mass: float = Field(0.2, ge=0.01, le=100.0, description="Masa (kg)")
    drag_coeff: float = Field(0.47, ge=0.0, le=2.0, description="Coeficiente de arrastre Cd")
    cross_area: float = Field(0.005, ge=0.0001, le=1.0, description="Área frontal transversal (m^2)")
    air_density: float = Field(1.225, ge=0.0, le=5.0, description="Densidad del aire (kg/m^3)")
    wind_x: float = Field(0.0, ge=-50.0, le=50.0, description="Viento en X (m/s)")
    num_points: int = Field(350, ge=50, le=1000)


class OscillatorRequest(BaseModel):
    mass: float = Field(1.0, ge=0.05, le=50.0, description="Masa m (kg)")
    spring_k: float = Field(30.0, ge=0.5, le=500.0, description="Constante k (N/m)")
    damping_b: float = Field(0.5, ge=0.0, le=20.0, description="Amortiguamiento b (N*s/m)")
    driving_force: float = Field(0.0, ge=0.0, le=100.0, description="Fuerza forzada F0 (N)")
    driving_freq: float = Field(0.0, ge=0.0, le=50.0, description="Frecuencia forzada omega_f (rad/s)")
    x0: float = Field(0.4, ge=-5.0, le=5.0, description="Desplazamiento inicial x0 (m)")
    v0: float = Field(0.0, ge=-20.0, le=20.0, description="Velocidad inicial v0 (m/s)")
    t_max: float = Field(15.0, ge=1.0, le=60.0)
    num_points: int = Field(500, ge=50, le=2000)


class SignalAnalysisRequest(BaseModel):
    times: List[float]
    displacements: List[float]
    expected_period_hint: Optional[float] = 1.2


# --- Endpoints ---
@app.get("/")
def root():
    return {
        "project": "PhysLab Core API",
        "initiative": "Project Fénix",
        "author": "Dariem Garcia",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "physlab-backend", "version": "1.0.0"}


@app.post("/api/simulation/pendulum")
def simulate_pendulum(req: PendulumRequest):
    try:
        params = PendulumParams(**req.model_dump())
        result = PendulumSimulator.simulate(params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en simulación de péndulo: {str(e)}")


@app.post("/api/simulation/projectile")
def simulate_projectile(req: ProjectileRequest):
    try:
        params = ProjectileParams(**req.model_dump())
        result = ProjectileSimulator.simulate(params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en simulación de proyectiles: {str(e)}")


@app.post("/api/simulation/oscillator")
def simulate_oscillator(req: OscillatorRequest):
    try:
        params = OscillatorParams(**req.model_dump())
        result = OscillatorSimulator.simulate(params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en simulación de oscilador: {str(e)}")


@app.post("/api/tracking/demo")
def tracking_demo():
    """Genera datos de seguimiento experimental sintético con ruido calibrado."""
    try:
        res = VideoTracker.track_synthetic_trajectory()
        # Procesar con Savitzky-Golay
        t = [p.t for p in res.points]
        x = [p.x_m for p in res.points]
        analysis = SignalProcessor.analyze_oscillations(t, x, expected_period_hint=1.25)
        return {
            "tracking": res,
            "analysis": analysis,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en demo de tracking: {str(e)}")


@app.post("/api/tracking/analyze")
def analyze_signal(req: SignalAnalysisRequest):
    if len(req.times) != len(req.displacements) or len(req.times) < 5:
        raise HTTPException(status_code=400, detail="Se requieren al menos 5 puntos de datos con longitudes iguales.")
    try:
        result = SignalProcessor.analyze_oscillations(
            times=req.times,
            displacements=req.displacements,
            expected_period_hint=req.expected_period_hint or 1.2,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en análisis de señal: {str(e)}")


@app.get("/api/experiments/presets")
def get_presets():
    """Escenarios físicos predefinidos para exploración rápida."""
    return {
        "pendulum": [
            {"id": "earth_simple", "label": "Tierra (g=9.81 m/s², L=1.0m, b=0.03)", "gravity": 9.80665, "length": 1.0, "damping": 0.03, "theta0": 30.0},
            {"id": "moon_pendulum", "label": "Luna (g=1.62 m/s², L=1.0m, vacío)", "gravity": 1.62, "length": 1.0, "damping": 0.0, "theta0": 45.0},
            {"id": "jupiter_pendulum", "label": "Júpiter (g=24.79 m/s², L=1.5m, alta densidad)", "gravity": 24.79, "length": 1.5, "damping": 0.12, "theta0": 25.0},
            {"id": "high_angle", "label": "Régimen no lineal extremo (θ0 = 120°)", "gravity": 9.80665, "length": 1.0, "damping": 0.04, "theta0": 120.0},
        ],
        "projectile": [
            {"id": "baseball_45", "label": "Pelota de Béisbol (v0=35 m/s, 45°, Cd=0.47)", "v0": 35.0, "angle": 45.0, "mass": 0.145, "drag": 0.47},
            {"id": "cannonball", "label": "Bala de Cañón (v0=90 m/s, 35°, m=5.0 kg)", "v0": 90.0, "angle": 35.0, "mass": 5.0, "drag": 0.47},
            {"id": "headwind", "label": "Viento en Contra (-15 m/s)", "v0": 40.0, "angle": 40.0, "wind_x": -15.0, "drag": 0.47},
        ],
        "oscillator": [
            {"id": "underdamped", "label": "Subamortiguado (Oscilaciones sinusoidales con decaimiento)", "m": 1.0, "k": 30.0, "b": 0.5},
            {"id": "critically_damped", "label": "Críticamente Amortiguado (Regreso óptimo a equilibrio sin oscilar)", "m": 1.0, "k": 30.0, "b": 10.95},
            {"id": "overdamped", "label": "Sobreamortiguado (Retorno lento aperiódico)", "m": 1.0, "k": 30.0, "b": 22.0},
            {"id": "resonance", "label": "Resonancia Forzada (F0=4.0N a frecuencia natural)", "m": 1.0, "k": 25.0, "b": 0.3, "f0": 4.0, "wf": 5.0},
        ],
    }
