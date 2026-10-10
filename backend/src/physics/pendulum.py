"""Nonlinear damped pendulum physics engine with numerical ODE integration."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple
import numpy as np
from scipy.integrate import solve_ivp
from scipy.signal import find_peaks


@dataclass
class PendulumParams:
    length: float = 1.0          # metros (L)
    gravity: float = 9.80665     # m/s^2 (g)
    mass: float = 0.25           # kg (m)
    damping: float = 0.05        # Coeficiente de amortiguamiento viscoso b (N*s/m)
    theta0_deg: float = 30.0     # Ángulo inicial en grados
    omega0: float = 0.0          # Velocidad angular inicial en rad/s
    t_max: float = 12.0          # Tiempo de simulación (s)
    num_points: int = 600        # Puntos de muestreo


@dataclass
class PendulumResult:
    params: Dict[str, Any]
    t: List[float]
    theta: List[float]           # rad
    theta_deg: List[float]       # grados
    omega: List[float]           # rad/s
    alpha: List[float]           # rad/s^2 (aceleración angular)
    x: List[float]               # Posición cartesiana X (m)
    y: List[float]               # Posición cartesiana Y (m)
    kinetic_energy: List[float]  # Joules
    potential_energy: List[float]# Joules
    total_energy: List[float]    # Joules
    period_theoretical_linear: float # T0 = 2*pi*sqrt(L/g)
    period_nonlinear_approx: float   # T corregido por amplitud inicial
    detected_period: float           # Estimado numéricamente por picos
    decay_ratio: float               # Razón de decaimiento logarítmico aproximado


class PendulumSimulator:
    """Simulador de dinámica pendular no lineal y conservativa/disipativa."""

    @staticmethod
    def derivatives(t: float, state: np.ndarray, L: float, g: float, m: float, b: float) -> list:
        theta, omega = state
        dtheta_dt = omega
        # d^2(theta)/dt^2 = - (b / (m * L^2)) * omega - (g / L) * sin(theta)
        # amortiguamiento angular equivalente: b_eff = b / m
        domega_dt = - (b / max(m, 1e-6)) * omega - (g / max(L, 1e-6)) * np.sin(theta)
        return [dtheta_dt, domega_dt]

    @classmethod
    def simulate(cls, p: PendulumParams) -> PendulumResult:
        theta0_rad = np.radians(p.theta0_deg)
        initial_state = [theta0_rad, p.omega0]
        t_eval = np.linspace(0, p.t_max, p.num_points)

        sol = solve_ivp(
            fun=lambda t, y: cls.derivatives(t, y, p.length, p.gravity, p.mass, p.damping),
            t_span=(0, p.t_max),
            y0=initial_state,
            t_eval=t_eval,
            method="RK45",
            rtol=1e-8,
            atol=1e-10,
        )

        t = sol.t
        theta = sol.y[0]
        omega = sol.y[1]

        # Aceleración angular
        alpha = - (p.damping / max(p.mass, 1e-6)) * omega - (p.gravity / max(p.length, 1e-6)) * np.sin(theta)

        # Coordenadas cartesianas (origen en pivote, y hacia abajo negativo)
        x = p.length * np.sin(theta)
        y = -p.length * np.cos(theta)

        # Energías
        v = p.length * omega
        kinetic = 0.5 * p.mass * (v ** 2)
        potential = p.mass * p.gravity * p.length * (1 - np.cos(theta))
        total_energy = kinetic + potential

        # Periodo teórico lineal: T0 = 2*pi*sqrt(L/g)
        t0_linear = 2.0 * np.pi * np.sqrt(p.length / p.gravity)

        # Corrección no lineal de Borda / Legendre para amplitudes finitas
        t_nonlinear = t0_linear * (1.0 + (1.0 / 16.0) * (theta0_rad ** 2) + (11.0 / 3072.0) * (theta0_rad ** 4))

        # Detección numérica de periodo mediante picos
        peaks, _ = find_peaks(theta, distance=max(5, int(p.num_points / (p.t_max / max(t0_linear, 0.1)) * 0.6)))
        if len(peaks) >= 2:
            peak_times = t[peaks]
            detected_period = float(np.mean(np.diff(peak_times)))
        else:
            detected_period = float(t_nonlinear)

        # Razón de decaimiento
        decay = float(np.max(np.abs(theta[-50:])) / max(abs(theta0_rad), 1e-6)) if p.damping > 0 else 1.0

        return PendulumResult(
            params=asdict(p),
            t=[round(float(val), 4) for val in t],
            theta=[round(float(val), 5) for val in theta],
            theta_deg=[round(float(np.degrees(val)), 3) for val in theta],
            omega=[round(float(val), 5) for val in omega],
            alpha=[round(float(val), 5) for val in alpha],
            x=[round(float(val), 4) for val in x],
            y=[round(float(val), 4) for val in y],
            kinetic_energy=[round(float(val), 5) for val in kinetic],
            potential_energy=[round(float(val), 5) for val in potential],
            total_energy=[round(float(val), 5) for val in total_energy],
            period_theoretical_linear=round(float(t0_linear), 4),
            period_nonlinear_approx=round(float(t_nonlinear), 4),
            detected_period=round(float(detected_period), 4),
            decay_ratio=round(float(decay), 4),
        )
