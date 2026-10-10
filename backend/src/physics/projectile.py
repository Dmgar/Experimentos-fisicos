"""Ballistic projectile motion engine: vacuum kinematics vs aerodynamic drag."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import numpy as np
from scipy.integrate import solve_ivp


@dataclass
class ProjectileParams:
    v0: float = 28.0             # Velocidad inicial (m/s)
    angle_deg: float = 45.0      # Ángulo de lanzamiento (grados)
    y0: float = 0.0              # Altura inicial (m)
    gravity: float = 9.80665     # Aceleración gravitacional (m/s^2)
    mass: float = 0.15           # Masa del proyectil en kg (ej. pelota de béisbol)
    drag_coeff: float = 0.47     # Coeficiente de forma Cd (esfera ~ 0.47)
    cross_area: float = 0.0042   # Área frontal en m^2 (radio ~ 3.7 cm)
    air_density: float = 1.225   # Densidad del aire a nivel del mar (kg/m^3)
    wind_x: float = 0.0          # Velocidad del viento horizontal en m/s
    num_points: int = 350


@dataclass
class ProjectileResult:
    params: Dict[str, Any]
    # Trayectoria con resistencia del aire
    t_drag: List[float]
    x_drag: List[float]
    y_drag: List[float]
    vx_drag: List[float]
    vy_drag: List[float]
    v_drag: List[float]
    range_drag: float
    max_height_drag: float
    flight_time_drag: float
    # Trayectoria ideal (vacío)
    t_ideal: List[float]
    x_ideal: List[float]
    y_ideal: List[float]
    range_ideal: float
    max_height_ideal: float
    flight_time_ideal: float
    drag_loss_pct: float         # Porcentaje de alcance perdido por fricción


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

        # 2. Solución numérica con arrastre (Drag)
        # Constante de resistencia aerodinámica k = 0.5 * rho * Cd * A
        k_drag = 0.5 * p.air_density * p.drag_coeff * p.cross_area

        def derivatives(t: float, state: np.ndarray) -> list:
            x, y, vx, vy = state
            # Velocidad relativa respecto al viento
            v_rel_x = vx - p.wind_x
            v_rel_y = vy
            v_rel = np.hypot(v_rel_x, v_rel_y)

            # Fuerza de arrastre cuadrática F = k * v^2
            f_drag_x = -k_drag * v_rel * v_rel_x
            f_drag_y = -k_drag * v_rel * v_rel_y

            ax = f_drag_x / max(p.mass, 1e-5)
            ay = -p.gravity + (f_drag_y / max(p.mass, 1e-5))
            return [vx, vy, ax, ay]

        def hit_ground(t: float, state: np.ndarray) -> float:
            return state[1] # y = 0
        hit_ground.terminal = True
        hit_ground.direction = -1

        t_max_est = max(t_flight_ideal * 1.5, 5.0)
        sol = solve_ivp(
            fun=derivatives,
            t_span=(0, t_max_est),
            y0=[0.0, p.y0, vx0, vy0],
            events=hit_ground,
            method="RK45",
            rtol=1e-7,
            atol=1e-9,
            dense_output=True,
        )

        t_flight_drag = float(sol.t[-1])
        t_eval_drag = np.linspace(0, t_flight_drag, p.num_points)
        y_sol = sol.sol(t_eval_drag)

        x_d = y_sol[0]
        y_d = np.maximum(0.0, y_sol[1])
        vx_d = y_sol[2]
        vy_d = y_sol[3]
        v_mag_d = np.hypot(vx_d, vy_d)

        range_drag = float(x_d[-1])
        max_h_drag = float(np.max(y_d))
        drag_loss = float(max(0.0, (1.0 - (range_drag / max(range_ideal, 1e-4))) * 100.0))

        return ProjectileResult(
            params=asdict(p),
            t_drag=[round(float(v), 4) for v in t_eval_drag],
            x_drag=[round(float(v), 3) for v in x_d],
            y_drag=[round(float(v), 3) for v in y_d],
            vx_drag=[round(float(v), 3) for v in vx_d],
            vy_drag=[round(float(v), 3) for v in vy_d],
            v_drag=[round(float(v), 3) for v in v_mag_d],
            range_drag=round(range_drag, 2),
            max_height_drag=round(max_h_drag, 2),
            flight_time_drag=round(t_flight_drag, 2),
            t_ideal=[round(float(v), 4) for v in t_eval_ideal],
            x_ideal=[round(float(v), 3) for v in x_ideal],
            y_ideal=[round(float(v), 3) for v in y_ideal],
            range_ideal=round(range_ideal, 2),
            max_height_ideal=round(max_h_ideal, 2),
            flight_time_ideal=round(t_flight_ideal, 2),
            drag_loss_pct=round(drag_loss, 1),
        )
