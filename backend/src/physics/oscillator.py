"""Harmonic, damped, and driven oscillator simulation engine with FFT spectrum."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Literal
import numpy as np
from scipy.integrate import solve_ivp


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
            regime_label = f"Subamortiguado (ζ = {zeta:.3f} < 1.0)"
            omega_d = float(omega0 * np.sqrt(1.0 - zeta**2))
        else:
            regime = "overdamped"
            regime_label = f"Sobreamortiguado (ζ = {zeta:.3f} > 1.0)"
            omega_d = 0.0

        def ode_system(t: float, state: np.ndarray) -> list:
            x_val, v_val = state
            # m * a + b * v + k * x = F0 * cos(omega_f * t)
            f_ext = p.driving_force * np.cos(p.driving_freq * t) if p.driving_force > 0 else 0.0
            a_val = (f_ext - b * v_val - k * x_val) / m
            return [v_val, a_val]

        t_eval = np.linspace(0, p.t_max, p.num_points)
        sol = solve_ivp(
            fun=ode_system,
            t_span=(0, p.t_max),
            y0=[p.x0, p.v0],
            t_eval=t_eval,
            method="RK45",
            rtol=1e-8,
            atol=1e-10,
        )

        t_arr = sol.t
        x_arr = sol.y[0]
        v_arr = sol.y[1]

        f_ext_arr = p.driving_force * np.cos(p.driving_freq * t_arr) if p.driving_force > 0 else 0.0
        a_arr = (f_ext_arr - b * v_arr - k * x_arr) / m

        # Energías
        kinetic = 0.5 * m * (v_arr ** 2)
        potential = 0.5 * k * (x_arr ** 2)
        total = kinetic + potential

        # 1. Curva de resonancia teórica (Amplitud en función de frecuencia forzada)
        freq_sweep = np.linspace(0.1, max(omega0 * 2.5, 10.0), 40)
        f0_val = max(p.driving_force, 1.0)
        res_curve = []
        for w in freq_sweep:
            denom = np.sqrt((omega0**2 - w**2)**2 + (2 * zeta * omega0 * w)**2)
            amp = float((f0_val / m) / max(denom, 1e-4))
            res_curve.append({"freq": round(float(w), 2), "amplitude": round(amp, 4)})

        # 2. FFT del desplazamiento
        dt = p.t_max / max(p.num_points - 1, 1)
        fft_vals = np.abs(np.fft.rfft(x_arr - np.mean(x_arr)))
        fft_freqs = np.fft.rfftfreq(len(x_arr), d=dt)
        # Normalizar espectro
        fft_norm = fft_vals / max(np.max(fft_vals), 1e-6)

        return OscillatorResult(
            params=asdict(p),
            t=[round(float(v), 4) for v in t_arr],
            x=[round(float(v), 4) for v in x_arr],
            v=[round(float(v), 4) for v in v_arr],
            a=[round(float(v), 4) for v in a_arr],
            kinetic_energy=[round(float(v), 5) for v in kinetic],
            potential_energy=[round(float(v), 5) for v in potential],
            total_energy=[round(float(v), 5) for v in total],
            omega_natural=round(float(omega0), 3),
            damping_ratio=round(float(zeta), 4),
            regime=regime,
            regime_label=regime_label,
            damped_frequency=round(float(omega_d), 3),
            resonance_curve=res_curve,
            fft_freqs=[round(float(f), 3) for f in fft_freqs[:40]],
            fft_amplitudes=[round(float(a), 4) for a in fft_norm[:40]],
        )
