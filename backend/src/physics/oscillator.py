"""Harmonic, damped, and driven oscillator simulation engine with FFT spectrum."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Literal
import numpy as np

try:
    from scipy.integrate import solve_ivp
    _HAS_SCIPY_INT = True
except Exception:
    _HAS_SCIPY_INT = False


def _rk4_oscillator_solve(fun, initial_state: List[float], t_eval: np.ndarray) -> np.ndarray:
    n_pts = len(t_eval)
    y = np.zeros((n_pts, 2), dtype=float)
    y[0] = initial_state

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


@dataclass
class OscillatorParams:
    mass: float = 1.0            # Masa m (kg)
    spring_k: float = 25.0       # Constante elástica k (N/m)
    damping_b: float = 0.6       # Coeficiente de amortiguamiento b (N*s/m)
    driving_force: float = 0.0   # Fuerza externa periódica F0 (N)
    driving_freq: float = 0.0    # Frecuencia de excitación omega_f (rad/s)
    x0: float = 0.5              # Desplazamiento inicial (m)
    v0: float = 0.0              # Velocidad inicial (m/s)
    t_max: float = 15.0          # Tiempo (s)
    num_points: int = 500


@dataclass
class OscillatorResult:
    params: Dict[str, Any]
    t: List[float]
    x: List[float]
    v: List[float]
    a: List[float]
    kinetic_energy: List[float]
    potential_energy: List[float]
    total_energy: List[float]
    omega_natural: float         # omega_0 (rad/s)
    damping_ratio: float         # zeta
    regime: Literal["underdamped", "critically_damped", "overdamped"]
    regime_label: str
    damped_frequency: float      # omega_d (rad/s)
    resonance_curve: List[Dict[str, float]] # Barrido espectral
    fft_freqs: List[float]       # Frecuencias FFT (Hz)
    fft_amplitudes: List[float]  # Magnitudes FFT


class OscillatorSimulator:
    """Simulador integral de oscilador armónico simple, amortiguado y forzado."""

    @classmethod
    def simulate(cls, p: OscillatorParams) -> OscillatorResult:
        m = max(p.mass, 1e-6)
        k = max(p.spring_k, 1e-6)
        b = max(p.damping_b, 0.0)

        # Frecuencia natural y factor de amortiguamiento
        omega0 = np.sqrt(k / m)
        zeta = b / (2.0 * np.sqrt(m * k))

        # Clasificación del régimen
        if np.isclose(zeta, 1.0, atol=0.04):
            regime = "critically_damped"
            regime_label = "Críticamente amortiguado (ζ ≈ 1.0)"
            omega_d = 0.0
        elif zeta < 1.0:
            regime = "underdamped"
            regime_label = "Subamortiguado (ζ < 1.0, oscilaciones armónicas)"
            omega_d = omega0 * np.sqrt(1.0 - (zeta**2))
        else:
            regime = "overdamped"
            regime_label = "Sobreamortiguado (ζ > 1.0, decaimiento aperiódico)"
            omega_d = 0.0

        # Ecuación diferencial: m*x'' + b*x' + k*x = F0*cos(omega_f*t)
        def osc_derivatives(t: float, state: np.ndarray) -> list:
            x, v = state
            f_ext = p.driving_force * np.cos(p.driving_freq * t)
            dxdt = v
            dvdt = (f_ext - b * v - k * x) / m
            return [dxdt, dvdt]

        t_eval = np.linspace(0, p.t_max, p.num_points)
        initial_state = [p.x0, p.v0]

        used_rk4 = True
        if _HAS_SCIPY_INT:
            try:
                sol = solve_ivp(
                    fun=osc_derivatives,
                    t_span=(0, p.t_max),
                    y0=initial_state,
                    t_eval=t_eval,
                    method="RK45",
                    rtol=1e-8,
                    atol=1e-10,
                )
                x_arr = sol.y[0]
                v_arr = sol.y[1]
                used_rk4 = False
            except Exception:
                used_rk4 = True

        if used_rk4:
            y_sol = _rk4_oscillator_solve(osc_derivatives, initial_state, t_eval)
            x_arr = y_sol[0]
            v_arr = y_sol[1]

        # Aceleración y Energías
        f_ext_arr = p.driving_force * np.cos(p.driving_freq * t_eval)
        a_arr = (f_ext_arr - b * v_arr - k * x_arr) / m

        k_energy = 0.5 * m * (v_arr**2)
        p_energy = 0.5 * k * (x_arr**2)
        tot_energy = k_energy + p_energy

        # FFT para espectro de frecuencias
        dt = p.t_max / max(p.num_points, 1)
        fft_vals = np.abs(np.fft.rfft(x_arr))
        fft_freqs = np.fft.rfftfreq(len(x_arr), d=dt)

        # Curva de resonancia teórica (amplitud en función de omega_f)
        omega_scan = np.linspace(0.1, omega0 * 2.5, 40)
        res_curve = []
        for w in omega_scan:
            denom = np.sqrt(((omega0**2 - w**2)**2) + ((2 * zeta * omega0 * w)**2))
            amp = (p.driving_force / m) / max(denom, 1e-4) if p.driving_force > 0 else 1.0 / max(denom, 1e-4)
            res_curve.append({"omega": round(float(w), 3), "amplitude": round(float(amp), 4)})

        return OscillatorResult(
            params=asdict(p),
            t=[round(float(v), 4) for v in t_eval],
            x=[round(float(v), 4) for v in x_arr],
            v=[round(float(v), 4) for v in v_arr],
            a=[round(float(v), 4) for v in a_arr],
            kinetic_energy=[round(float(v), 4) for v in k_energy],
            potential_energy=[round(float(v), 4) for v in p_energy],
            total_energy=[round(float(v), 4) for v in tot_energy],
            omega_natural=round(float(omega0), 4),
            damping_ratio=round(float(zeta), 4),
            regime=regime,
            regime_label=regime_label,
            damped_frequency=round(float(omega_d), 4),
            resonance_curve=res_curve,
            fft_freqs=[round(float(f), 3) for f in fft_freqs[:50]],
            fft_amplitudes=[round(float(a), 4) for a in fft_vals[:50]],
        )
