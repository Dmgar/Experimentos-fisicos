"""PhysLab CLI - Command Line Physics Simulation Interface."""

import argparse
import sys
from src.physics import PendulumSimulator, PendulumParams, ProjectileSimulator, ProjectileParams, OscillatorSimulator, OscillatorParams


def run_pendulum(args):
    print(f"\n[PhysLab] Simulando Péndulo: L={args.length}m, g={args.gravity}m/s², θ0={args.theta}°, b={args.damping}")
    p = PendulumParams(
        length=args.length,
        gravity=args.gravity,
        theta0_deg=args.theta,
        damping=args.damping,
        t_max=args.time,
    )
    res = PendulumSimulator.simulate(p)
    print("------------------------------------------------------------")
    print(f" Periodo Teórico Lineal (T0):    {res.period_theoretical_linear:.4f} s")
    print(f" Periodo No Lineal Corregido:    {res.period_nonlinear_approx:.4f} s")
    print(f" Periodo Estimado Numérico:      {res.detected_period:.4f} s")
    print(f" Razón de Decaimiento de Amp:    {res.decay_ratio:.4f}")
    print(f" Energía Mecánica Inicial:       {res.total_energy[0]:.4f} J")
    print(f" Energía Mecánica Final:         {res.total_energy[-1]:.4f} J")
    print("------------------------------------------------------------\n")


def run_projectile(args):
    print(f"\n[PhysLab] Simulando Proyectil: v0={args.v0}m/s, θ={args.angle}°, viento={args.wind}m/s")
    p = ProjectileParams(
        v0=args.v0,
        angle_deg=args.angle,
        wind_x=args.wind,
    )
    res = ProjectileSimulator.simulate(p)
    print("------------------------------------------------------------")
    print(f" Alcance en Vacío (Ideal):        {res.range_ideal:.2f} m")
    print(f" Alcance con Arrastre (Real):     {res.range_drag:.2f} m")
    print(f" Pérdida por Resistencia Aire:   {res.drag_loss_pct:.1f} %")
    print(f" Altura Máxima (Ápex con Drag):  {res.max_height_drag:.2f} m")
    print(f" Tiempo de Vuelo:                {res.flight_time_drag:.2f} s")
    print("------------------------------------------------------------\n")


def run_oscillator(args):
    print(f"\n[PhysLab] Simulando Oscilador: m={args.mass}kg, k={args.k}N/m, b={args.damping}")
    p = OscillatorParams(
        mass=args.mass,
        spring_k=args.k,
        damping_b=args.damping,
    )
    res = OscillatorSimulator.simulate(p)
    print("------------------------------------------------------------")
    print(f" Frecuencia Natural (ω0):        {res.omega_natural:.3f} rad/s")
    print(f" Factor de Amortiguamiento (ζ):  {res.damping_ratio:.4f}")
    print(f" Régimen Físico:                 {res.regime_label}")
    if res.damped_frequency > 0:
        print(f" Frecuencia Amortiguada (ωd):    {res.damped_frequency:.3f} rad/s")
    print(f" Energía Inicial:                {res.total_energy[0]:.4f} J")
    print(f" Energía Final:                  {res.total_energy[-1]:.4f} J")
    print("------------------------------------------------------------\n")


def main():
    parser = argparse.ArgumentParser(description="PhysLab CLI - Simulación computacional de física")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Pendulum
    pen_parser = subparsers.add_parser("pendulum", help="Simulación de péndulo simple y amortiguado")
    pen_parser.add_argument("--length", "-L", type=float, default=1.0, help="Longitud en metros")
    pen_parser.add_argument("--gravity", "-g", type=float, default=9.80665, help="Gravedad en m/s^2")
    pen_parser.add_argument("--theta", "-t", type=float, default=30.0, help="Ángulo inicial en grados")
    pen_parser.add_argument("--damping", "-b", type=float, default=0.04, help="Coeficiente de fricción")
    pen_parser.add_argument("--time", type=float, default=10.0, help="Tiempo de simulación (s)")

    # Projectile
    proj_parser = subparsers.add_parser("projectile", help="Simulación de tiro parabólico y balística")
    proj_parser.add_argument("--v0", "-v", type=float, default=30.0, help="Velocidad inicial en m/s")
    proj_parser.add_argument("--angle", "-a", type=float, default=45.0, help="Ángulo de disparo en grados")
    proj_parser.add_argument("--wind", "-w", type=float, default=0.0, help="Viento horizontal en m/s")

    # Oscillator
    osc_parser = subparsers.add_parser("oscillator", help="Simulación de oscilador masa-resorte")
    osc_parser.add_argument("--mass", "-m", type=float, default=1.0, help="Masa en kg")
    osc_parser.add_argument("--k", "-k", type=float, default=30.0, help="Constante elástica en N/m")
    osc_parser.add_argument("--damping", "-b", type=float, default=0.5, help="Amortiguamiento en N*s/m")

    args = parser.parse_args()
    if args.command == "pendulum":
        run_pendulum(args)
    elif args.command == "projectile":
        run_projectile(args)
    elif args.command == "oscillator":
        run_oscillator(args)


if __name__ == "__main__":
    main()
