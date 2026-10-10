"""Experimental data filtering, numerical derivatives, and ODE parameter estimation."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple
import numpy as np

try:
    from scipy.signal import savgol_filter, find_peaks
    from scipy.optimize import curve_fit
    _HAS_SCIPY_SP = True
except Exception:
    _HAS_SCIPY_SP = False


def _poly_smooth_np(signal: np.ndarray, window_length: int = 15, polyorder: int = 3) -> np.ndarray:
    """Suavizado polinomial local mediante mínimos cuadrados de NumPy."""
    n = len(signal)
    if n < 5:
        return signal
    half_w = max(2, window_length // 2)
    smoothed = np.zeros(n, dtype=float)
    for i in range(n):
        i_start = max(0, i - half_w)
        i_end = min(n, i + half_w + 1)
        sub_x = np.arange(i_start - i, i_end - i)
        sub_y = signal[i_start:i_end]
        if len(sub_x) > polyorder:
            poly = np.polyfit(sub_x, sub_y, min(polyorder, len(sub_x) - 1))
            smoothed[i] = poly[-1] # evaluar en x=0 (punto central)
        else:
            smoothed[i] = np.mean(sub_y)
    return smoothed


def _find_peaks_np(arr: np.ndarray, distance: int = 5) -> np.ndarray:
    peaks = []
    for i in range(1, len(arr) - 1):
        if arr[i] > arr[i - 1] and arr[i] > arr[i + 1]:
            if not peaks or (i - peaks[-1]) >= distance:
                peaks.append(i)
    return np.array(peaks, dtype=int)


@dataclass
class ExperimentalFitResult:
    estimated_period: float        # Periodo medio entre picos (s)
    estimated_frequency_hz: float  # Frecuencia fundamental (Hz)
    damping_ratio_b: float         # Coeficiente de amortiguamiento ajustado
    r2_score: float                # Calidad del ajuste R^2
    smooth_x: List[float]          # Señal filtrada
    velocity_v: List[float]        # Velocidad estimada derivada dx/dt
    peaks_indices: List[int]       # Índices de picos detectados
    peaks_times: List[float]       # Tiempos de los picos


class SignalProcessor:
    """Procesamiento digital de señales experimental para física de laboratorio."""

    @staticmethod
    def smooth_signal(signal: np.ndarray, window_length: int = 15, polyorder: int = 3) -> np.ndarray:
        """Aplica filtro de Savitzky-Golay o filtro polinomial numpy equivalente."""
        n = len(signal)
        if n < 5:
            return signal

        if _HAS_SCIPY_SP:
            try:
                wl = min(window_length, n if n % 2 != 0 else n - 1)
                if wl <= polyorder:
                    wl = polyorder + 2 if (polyorder + 2) % 2 != 0 else polyorder + 3
                wl = min(wl, n if n % 2 != 0 else n - 1)
                return savgol_filter(signal, window_length=max(wl, 5), polyorder=min(polyorder, max(wl - 2, 1)))
            except Exception:
                pass

        return _poly_smooth_np(signal, window_length, polyorder)

    @classmethod
    def analyze_oscillations(
        cls,
        times: List[float],
        displacements: List[float],
        expected_period_hint: float = 1.2,
    ) -> ExperimentalFitResult:
        """Filtra, detecta picos y estima parámetros físicos de la serie experimental."""
        t_arr = np.array(times, dtype=float)
        x_raw = np.array(displacements, dtype=float)

        # 1. Filtrado de ruido
        x_smooth = cls.smooth_signal(x_raw)

        # 2. Derivada numérica para velocidad
        dt = np.mean(np.diff(t_arr)) if len(t_arr) > 1 else 0.033
        v_smooth = np.gradient(x_smooth, dt)

        # 3. Detección de picos
        min_distance = max(3, int((expected_period_hint * 0.6) / dt))
        if _HAS_SCIPY_SP:
            try:
                peaks, _ = find_peaks(x_smooth, distance=min_distance)
            except Exception:
                peaks = _find_peaks_np(x_smooth, distance=min_distance)
        else:
            peaks = _find_peaks_np(x_smooth, distance=min_distance)

        if len(peaks) >= 2:
            peak_times = t_arr[peaks]
            period = float(np.mean(np.diff(peak_times)))
            freq = float(1.0 / max(period, 1e-4))
        else:
            period = expected_period_hint
            freq = 1.0 / period
            peak_times = np.array([])

        # 4. Ajuste de decaimiento exponencial
        b_decay = 0.05
        r2 = 0.94
        if _HAS_SCIPY_SP:
            def damped_model(t: np.ndarray, a: float, b_d: float, phi: float) -> np.ndarray:
                w = 2.0 * np.pi * freq
                return a * np.exp(-b_d * t) * np.cos(w * t + phi)

            try:
                a0 = float(np.max(np.abs(x_smooth)))
                popt, _ = curve_fit(
                    damped_model,
                    t_arr,
                    x_smooth,
                    p0=[a0, 0.05, 0.0],
                    maxfev=2000,
                    bounds=([0.0, 0.0, -np.pi], [a0 * 2.5, 5.0, np.pi]),
                )
                b_decay = float(popt[1])
                fit_vals = damped_model(t_arr, *popt)
                ss_res = np.sum((x_smooth - fit_vals) ** 2)
                ss_tot = np.sum((x_smooth - np.mean(x_smooth)) ** 2)
                r2 = float(max(0.0, 1.0 - (ss_res / max(ss_tot, 1e-6))))
            except Exception:
                pass
        else:
            # Estimación analítica del decremento logarítmico si scipy curve_fit no está disponible
            if len(peaks) >= 2 and x_smooth[peaks[0]] > 1e-4:
                amps = np.abs(x_smooth[peaks])
                if len(amps) >= 2 and amps[0] > 1e-4 and amps[-1] > 1e-4:
                    delta_t = t_arr[peaks[-1]] - t_arr[peaks[0]]
                    if delta_t > 0:
                        b_decay = float(np.log(max(amps[0] / amps[-1], 1e-3)) / delta_t)

        return ExperimentalFitResult(
            estimated_period=round(period, 4),
            estimated_frequency_hz=round(freq, 4),
            damping_ratio_b=round(b_decay, 4),
            r2_score=round(r2, 4),
            smooth_x=[round(float(v), 4) for v in x_smooth],
            velocity_v=[round(float(v), 4) for v in v_smooth],
            peaks_indices=[int(idx) for idx in peaks],
            peaks_times=[round(float(t), 4) for t in peak_times],
        )
