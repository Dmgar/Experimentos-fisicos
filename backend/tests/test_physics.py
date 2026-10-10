"""Unit tests for PhysLab simulation engines."""

import numpy as np
import pytest
from src.physics import (
    PendulumSimulator,
    PendulumParams,
    ProjectileSimulator,
    ProjectileParams,
    OscillatorSimulator,
    OscillatorParams,
)
from src.vision import SignalProcessor


def test_pendulum_small_angle_period():
    # Para L = 1.0 m y g = 9.80665 m/s^2, T0 = 2.006 s
    p = PendulumParams(length=1.0, gravity=9.80665, theta0_deg=5.0, damping=0.0, t_max=10.0)
    res = PendulumSimulator.simulate(p)
    expected_t0 = 2.0 * np.pi * np.sqrt(1.0 / 9.80665)
    assert abs(res.period_theoretical_linear - expected_t0) < 1e-4
    assert abs(res.detected_period - expected_t0) < 0.05


def test_pendulum_energy_conservation_undamped():
    # Sin fricción, la energía total debe conservarse
    p = PendulumParams(length=1.0, gravity=9.80665, theta0_deg=20.0, damping=0.0, t_max=8.0)
    res = PendulumSimulator.simulate(p)
    e_init = res.total_energy[0]
    e_final = res.total_energy[-1]
    rel_error = abs(e_final - e_init) / max(e_init, 1e-6)
    assert rel_error < 0.01 # Conservación dentro del 1%


def test_projectile_vacuum_range():
    # v0 = 20 m/s, 45°, R = v0^2 / g = 400 / 9.80665 = 40.788 m
    p = ProjectileParams(v0=20.0, angle_deg=45.0, gravity=9.80665, drag_coeff=0.0)
    res = ProjectileSimulator.simulate(p)
    expected_range = (20.0**2) / 9.80665
    assert abs(res.range_ideal - expected_range) < 0.05
    # Con drag_coeff = 0, el alcance con arrastre debería ser muy similar al ideal
    assert abs(res.range_drag - expected_range) < 0.5


def test_oscillator_frequency_and_regimes():
    # m = 1.0 kg, k = 25.0 N/m -> omega_0 = 5.0 rad/s
    p_under = OscillatorParams(mass=1.0, spring_k=25.0, damping_b=0.5)
    res_under = OscillatorSimulator.simulate(p_under)
    assert abs(res_under.omega_natural - 5.0) < 1e-3
    assert res_under.regime == "underdamped"

    # b_critico = 2 * sqrt(m * k) = 2 * 5 = 10.0 N*s/m
    p_crit = OscillatorParams(mass=1.0, spring_k=25.0, damping_b=10.0)
    res_crit = OscillatorSimulator.simulate(p_crit)
    assert res_crit.regime == "critically_damped"

    p_over = OscillatorParams(mass=1.0, spring_k=25.0, damping_b=20.0)
    res_over = OscillatorSimulator.simulate(p_over)
    assert res_over.regime == "overdamped"


def test_signal_processor_smoothing():
    t = [i * 0.033 for i in range(100)]
    clean_sin = [np.sin(2 * np.pi * 1.0 * time) for time in t]
    noisy_sin = [val + np.random.normal(0, 0.05) for val in clean_sin]
    res = SignalProcessor.analyze_oscillations(t, noisy_sin, expected_period_hint=1.0)
    assert abs(res.estimated_period - 1.0) < 0.15
    assert res.r2_score > 0.70
