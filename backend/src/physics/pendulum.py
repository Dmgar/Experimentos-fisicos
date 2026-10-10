"""Nonlinear damped pendulum physics engine with numerical ODE integration."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple
import numpy as np

# Intentar importar scipy; si está restringido por directiva de SO, usar solver RK4 numérico
try:
    from scipy.integrate import solve_ivp
    _HAS_SCIPY_INT = True
except Exception:
    _HAS_SCIPY_INT = False


def _rk4_solve(fun, t_span: Tuple[float, float], y0: List[float], t_eval: np.ndarray) -> np.ndarray:
    """Integrador numérico Runge-Kutta de 4to orden (RK4) de alta precisión."""
    n_pts = len(t_eval)
    n_vars = len(y0)
    y = np.zeros((n_pts, n_vars), dtype=float)
    y[0] = y0

    for i in range(n_pts - 1):
        t = t_eval[i]
        dt = t_eval[i + 1] - t
        curr_y = y[i]

        k1 = np.array(fun(t, curr_y), dtype=float)
        k2 = np.array(fun(t + dt * 0.5, curr_y + dt * 0.5 * k1), dtype=float)
        k3 = np.array(fun(t + dt * 0.5, curr_y + dt * 0.5 * k2), dtype=float)
        k4 = np.array(fun(t + dt, curr_y + dt * k3), dtype=float)

        y[i + 1] = curr_y + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

    return y.T


def _find_peaks_np(arr: np.ndarray, distance: int = 5) -> np.ndarray:
    peaks = []
    for i in range(1, len(arr) - 1):
        if arr[i] > arr[i - 1] and arr[i] > arr[i + 1]:
            if not peaks or (i - peaks[-1]) >= distance:
                peaks.append(i)
    return np.array(peaks, dtype=int)


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
        domega_dt = - (b / max(m, 1e-6)) * omega - (g / max(L, 1e-6)) * np.sin(theta)
        return [dtheta_dt, domega_dt]

    @classmethod
    def simulate(cls, p: PendulumParams) -> PendulumResult:
        theta0_rad = np.radians(p.theta0_deg)
        initial_state = [theta0_rad, p.omega0]
        t_eval = np.linspace(0, p.t_max, p.num_points)

        fun = lambda t, y: cls.derivatives(t, y, p.length, p.gravity, p.mass, p.damping)

        if _HAS_SCIPY_INT:
            try:
                sol = solve_ivp(
                    fun=fun,
                    t_span=(0, p.t_max),
                    y0=initial_state,
                    t_eval=t_eval,
                    method="RK45",
                    rtol=1e-8,
                    atol=1e-10,
                )
                theta = sol.y[0]
                omega = sol.y[1]
            except Exception:
                sol_y = _rk4_solve(fun, (0, p.t_max), initial_state, t_eval)
                theta = sol_y[0]
                omega = sol_y[1]
        else:
            sol_y = _rk4_solve(fun, (0, p.t_max), initial_state, t_eval)
            theta = sol_y[0]
            omega = sol_y[1]

        # Aceleración angular
        alpha = - (p.damping / max(p.mass, 1e-6)) * omega - (p.gravity / max(p.length, 1e-6)) * np.sin(theta)

        # Posiciones en coordenadas cartesianas (origen en el pivote, Y apunta hacia abajo)
        x = p.length * np.sin(theta)
        y = p.length * (1.0 - np.cos(theta))

        # Energías
        v = p.length * omega
        k_energy = 0.5 * p.mass * (v ** 2)
        p_energy = p.mass * p.gravity * y
        e_total = k_energy + p_energy

        # Periodos teóricos
        t0 = 2.0 * np.pi * np.sqrt(p.length / max(p.gravity, 1e-6))
        # Corrección de Borda / Legendre por amplitud finita
        t_nonlinear = t0 * (1.0 + (1.0 / 16.0) * (theta0_rad ** 2) + (11.0 / 3072.0) * (theta0_rad ** 4))

        # Detección numérica de periodo
        min_dist = max(3, int((t0 * 0.6) / (p.t_max / p.num_points)))
        peaks = _find_peaks_np(theta, distance=min_dist)

        if len(peaks) >= 2:
            t_peaks = t_eval[peaks]
            periods = np.diff(t_peaks)
            detected_t = float(np.mean(periods))
            amps = theta[peaks]
            if len(amps) >= 2 and amps[0] > 1e-4:
                decay = float(amps[1] / amps[0])
            else:
                decay = 1.0
        else:
            detected_t = float(t_nonlinear)
            decay = 1.0

        return PendulumResult(
            params=asdict(p),
            t=[round(float(v), 4) for v in t_eval],
            theta=[round(float(v), 5) for v in theta],
            theta_deg=[round(float(np.degrees(v)), 3) for v in theta],
            omega=[round(float(v), 5) for v in omega],
            alpha=[round(float(v), 5) for v in alpha],
            x=[round(float(v), 4) for v in x],
            y=[round(float(v), 4) for v in y],
            kinetic_energy=[round(float(v), 5) for v in k_energy],
            potential_energy=[round(float(v), 5) for v in p_energy],
            total_energy=[round(float(v), 5) for v in e_total],
            period_theoretical_linear=round(t0, 4),
            period_nonlinear_approx=round(t_nonlinear, 4),
            detected_period=round(detected_t, 4),
            decay_ratio=round(decay, 4),
        )
