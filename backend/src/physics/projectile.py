"""Ballistic projectile motion engine: vacuum kinematics vs aerodynamic drag."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple
import numpy as np

try:
    from scipy.integrate import solve_ivp
    _HAS_SCIPY_INT = True
except Exception:
    _HAS_SCIPY_INT = False


def _rk4_projectile_solve(fun, t_max: float, initial_state: List[float], dt: float = 0.005) -> Tuple[np.ndarray, np.ndarray]:
    """Integrador RK4 con detección de colisión con el suelo (y <= 0)."""
    t_list = [0.0]
    states = [list(initial_state)]
    curr_t = 0.0
    curr_s = np.array(initial_state, dtype=float)

    while curr_t < t_max:
        k1 = np.array(fun(curr_t, curr_s), dtype=float)
        k2 = np.array(fun(curr_t + dt * 0.5, curr_s + dt * 0.5 * k1), dtype=float)
        k3 = np.array(fun(curr_t + dt * 0.5, curr_s + dt * 0.5 * k2), dtype=float)
        k4 = np.array(fun(curr_t + dt, curr_s + dt * k4 if False else curr_s + dt * k3), dtype=float)

        next_s = curr_s + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        curr_t += dt

        # Si colisiona con el suelo tras haber despegado
        if next_s[1] <= 0.0 and curr_t > 0.02:
            next_s[1] = 0.0
            t_list.append(curr_t)
            states.append(list(next_s))
            break

        t_list.append(curr_t)
        states.append(list(next_s))
        curr_s = next_s

    return np.array(t_list), np.array(states).T


@dataclass
class ProjectileParams:
    v0: float = 28.0             # Velocidad inicial (m/s)
    angle_deg: float = 45.0      # Ángulo de lanzamiento (grados)
    y0: float = 0.0              # Altura inicial (m)
    gravity: float = 9.80665     # Aceleración gravitacional (m/s^2)
    mass: float = 0.15           # Masa del proyectil en kg
    drag_coeff: float = 0.47     # Coeficiente de forma Cd
    cross_area: float = 0.0042   # Área frontal en m^2
    air_density: float = 1.225   # Densidad del aire (kg/m^3)
    wind_x: float = 0.0          # Velocidad del viento horizontal en m/s
    num_points: int = 350


@dataclass
class ProjectileResult:
    params: Dict[str, Any]
    t_drag: List[float]
    x_drag: List[float]
    y_drag: List[float]
    vx_drag: List[float]
    vy_drag: List[float]
    v_drag: List[float]
    range_drag: float
    max_height_drag: float
    flight_time_drag: float
    t_ideal: List[float]
    x_ideal: List[float]
    y_ideal: List[float]
    range_ideal: float
    max_height_ideal: float
    flight_time_ideal: float
    drag_loss_pct: float


class ProjectileSimulator:
    """Simulador de trayectorias balísticas con ecuaciones de arrastre cuadrático."""

    @classmethod
    def simulate(cls, p: ProjectileParams) -> ProjectileResult:
        theta = np.radians(p.angle_deg)
        vx0 = p.v0 * np.cos(theta)
        vy0 = p.v0 * np.sin(theta)

        # 1. Solución analítica en vacío (Ideal)
        t_flight_ideal = float((vy0 + np.sqrt(max(0.0, vy0**2 + 2 * p.gravity * p.y0))) / p.gravity)
        range_ideal = float(vx0 * t_flight_ideal)
        max_h_ideal = float(p.y0 + (vy0**2) / (2 * p.gravity))

        t_eval_ideal = np.linspace(0, t_flight_ideal, p.num_points)
        x_ideal = vx0 * t_eval_ideal
        y_ideal = np.maximum(0.0, p.y0 + vy0 * t_eval_ideal - 0.5 * p.gravity * (t_eval_ideal**2))

        # 2. Solución numérica con resistencia aerodinámica cuadrática y viento
        k_drag = 0.5 * p.air_density * p.drag_coeff * p.cross_area

        def drag_derivatives(t: float, state: np.ndarray) -> list:
            x, y, vx, vy = state
            v_rel_x = vx - p.wind_x
            v_rel_y = vy
            v_rel = np.sqrt(v_rel_x**2 + v_rel_y**2)

            f_drag_x = - (k_drag / max(p.mass, 1e-6)) * v_rel * v_rel_x
            f_drag_y = - (k_drag / max(p.mass, 1e-6)) * v_rel * v_rel_y - p.gravity
            return [vx, vy, f_drag_x, f_drag_y]

        initial_state = [0.0, p.y0, vx0, vy0]
        t_max_est = t_flight_ideal * 1.5

        used_rk4 = True
        if _HAS_SCIPY_INT:
            try:
                def hit_ground(t, state):
                    return state[1]
                hit_ground.terminal = True
                hit_ground.direction = -1

                t_eval = np.linspace(0, t_max_est, p.num_points * 2)
                sol = solve_ivp(
                    fun=drag_derivatives,
                    t_span=(0, t_max_est),
                    y0=initial_state,
                    t_eval=t_eval,
                    events=hit_ground,
                    method="RK45",
                    rtol=1e-7,
                    atol=1e-9,
                )
                t_arr = sol.t
                x_arr = sol.y[0]
                y_arr = np.maximum(0.0, sol.y[1])
                vx_arr = sol.y[2]
                vy_arr = sol.y[3]
                used_rk4 = False
            except Exception:
                used_rk4 = True

        if used_rk4:
            t_rk, y_rk = _rk4_projectile_solve(drag_derivatives, t_max_est, initial_state, dt=t_flight_ideal / p.num_points)
            t_arr = t_rk
            x_arr = y_rk[0]
            y_arr = np.maximum(0.0, y_rk[1])
            vx_arr = y_rk[2]
            vy_arr = y_rk[3]

        range_drag = float(x_arr[-1])
        max_h_drag = float(np.max(y_arr))
        flight_t_drag = float(t_arr[-1])
        v_mag = np.sqrt(vx_arr**2 + vy_arr**2)

        # Pérdida de alcance porcentual
        drag_loss = max(0.0, ((range_ideal - range_drag) / max(range_ideal, 1e-6)) * 100.0)

        # Remuestrear a num_points
        indices = np.linspace(0, len(t_arr) - 1, min(p.num_points, len(t_arr))).astype(int)

        return ProjectileResult(
            params=asdict(p),
            t_drag=[round(float(v), 4) for v in t_arr[indices]],
            x_drag=[round(float(v), 3) for v in x_arr[indices]],
            y_drag=[round(float(v), 3) for v in y_arr[indices]],
            vx_drag=[round(float(v), 3) for v in vx_arr[indices]],
            vy_drag=[round(float(v), 3) for v in vy_arr[indices]],
            v_drag=[round(float(v), 3) for v in v_mag[indices]],
            range_drag=round(range_drag, 3),
            max_height_drag=round(max_h_drag, 3),
            flight_time_drag=round(flight_t_drag, 3),
            t_ideal=[round(float(v), 4) for v in t_eval_ideal],
            x_ideal=[round(float(v), 3) for v in x_ideal],
            y_ideal=[round(float(v), 3) for v in y_ideal],
            range_ideal=round(range_ideal, 3),
            max_height_ideal=round(max_h_ideal, 3),
            flight_time_ideal=round(t_flight_ideal, 3),
            drag_loss_pct=round(drag_loss, 2),
        )
