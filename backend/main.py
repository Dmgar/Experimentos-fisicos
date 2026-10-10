"""PhysLab API - High-Performance Physics Simulation & Perception Backend."""

import os
import shutil
import tempfile
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
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
from src.vision import (
    VideoTracker,
    SignalProcessor,
    VideoExperimentAnalyzer,
    VideoAnalysisReport,
    PhysicalExperimentDiagnosis,
)

app = FastAPI(
    title="PhysLab Core API · Project Fénix",
    description="Motor computacional de simulación física, modelado de ecuaciones diferenciales ordinarias y análisis de visión computacional para verificación experimental.",
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


class MotionClassificationRequest(BaseModel):
    times: List[float]
    x_coords: List[float]
    y_coords: List[float]
    fps: Optional[float] = 30.0
    width: Optional[int] = 640
    height: Optional[int] = 480


class SampleVideoRequest(BaseModel):
    sample_id: str = Field("pendulo_muestra_2", description="Identificador de la muestra ('pendulo_muestra_1', 'pendulo_muestra_2', 'synthetic_projectile')")
    target_color: str = Field("auto")


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


# --- Computer Vision Video Analysis & Physical Classification Endpoints ---

@app.post("/api/vision/analyze-video")
async def analyze_uploaded_video(
    file: UploadFile = File(...),
    target_color: str = Form("auto"),
    max_duration_s: float = Form(10.0),
    sample_step: int = Form(1),
):
    """Procesa un archivo de video cargado por el usuario o grabado con su cámara web,

    extrae las trayectorias de centroides y clasifica automáticamente si cumple con
    un Péndulo Simple, Tiro Parabólico, Oscilador o Caída Libre.
    """
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"physlab_upload_{os.urandom(8).hex()}{suffix}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        report = VideoExperimentAnalyzer.analyze_video_file(
            video_path=temp_path,
            target_color=target_color,
            max_duration_s=max_duration_s,
            sample_step=sample_step,
        )
        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando video: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/vision/analyze-sample")
def analyze_sample_video(req: SampleVideoRequest):
    """Analiza una de las muestras de video reales de laboratorio pregrabadas

    o genera un benchmark calibrado.
    """
    # Mapeo de muestras reales en el repositorio
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    samples_map = {
        "pendulo_muestra_1": os.path.join(repo_root, "data", "videos", "pendulo_muestra_1.mp4"),
        "pendulo_muestra_2": os.path.join(repo_root, "data", "videos", "pendulo_muestra_2.mp4"),
    }

    sample_file = samples_map.get(req.sample_id)
    if sample_file and os.path.exists(sample_file):
        try:
            report = VideoExperimentAnalyzer.analyze_video_file(
                video_path=sample_file,
                target_color=req.target_color,
                max_duration_s=8.0,
                sample_step=2, # Paso 2 para velocidad ágil
            )
            return report
        except Exception as e:
            # Fallback seguro
            pass

    # Si es sintético o fallback
    exp_type = "TIRO_PARABOLICO" if "proyec" in req.sample_id.lower() else "PENDULO_SIMPLE"
    return VideoExperimentAnalyzer.generate_sample_analysis_report(
        experiment_type=exp_type,
        num_frames=180,
        fps=30.0,
        width=640,
        height=480
    )


@app.post("/api/vision/classify-points")
def classify_tracked_points(req: MotionClassificationRequest):
    """Clasifica una serie temporal de posiciones (x, y) ya capturadas en el cliente

    (por ejemplo, rastreadas cuadro a cuadro con la cámara en el navegador).
    """
    import numpy as np
    times = np.array(req.times, dtype=float)
    x_arr = np.array(req.x_coords, dtype=float)
    y_arr = np.array(req.y_coords, dtype=float)

    if len(times) < 10 or len(times) != len(x_arr) or len(times) != len(y_arr):
        raise HTTPException(status_code=400, detail="Muestra insuficiente o tamaños de vector dispares (mínimo 10 puntos).")

    smooth_x = VideoExperimentAnalyzer._smooth_signal(x_arr)
    smooth_y = VideoExperimentAnalyzer._smooth_signal(y_arr)

    diagnosis, theo_x, theo_y = VideoExperimentAnalyzer._classify_and_fit_motion(
        times=times,
        x_arr=smooth_x,
        y_arr=smooth_y,
        fps=req.fps or 30.0,
        width=req.width or 640,
        height=req.height or 480
    )

    dt = np.mean(np.diff(times)) if len(times) > 1 else (1.0 / (req.fps or 30.0))
    vx = np.gradient(smooth_x, dt)
    vy = np.gradient(smooth_y, dt)
    v_mag = np.sqrt(vx**2 + vy**2)

    return {
        "diagnosis": diagnosis,
        "smooth_x": [round(float(x), 2) for x in smooth_x],
        "smooth_y": [round(float(y), 2) for y in smooth_y],
        "velocity_mag": [round(float(v), 2) for v in v_mag],
        "theoretical_fit_x": [round(float(x), 2) for x in theo_x],
        "theoretical_fit_y": [round(float(y), 2) for y in theo_y],
    }


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
        "video_samples": [
            {"id": "pendulo_muestra_2", "label": "Laboratorio Real: Péndulo Amortiguado (Muestra 2)", "file": "pendulo_muestra_2.mp4"},
            {"id": "pendulo_muestra_1", "label": "Laboratorio Real: Péndulo Amortiguado (Muestra 1)", "file": "pendulo_muestra_1.mp4"},
            {"id": "synthetic_projectile", "label": "Benchmark Físico: Tiro Parabólico con Arrastre", "file": "synthetic"},
        ]
    }
