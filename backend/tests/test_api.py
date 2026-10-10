"""API integration tests using FastAPI TestClient."""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_pendulum_api():
    payload = {
        "length": 1.2,
        "gravity": 9.81,
        "theta0_deg": 25.0,
        "damping": 0.05,
        "t_max": 5.0,
        "num_points": 100,
    }
    res = client.post("/api/simulation/pendulum", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "theta" in data
    assert "kinetic_energy" in data
    assert "period_theoretical_linear" in data
    assert len(data["t"]) == 100


def test_projectile_api():
    payload = {
        "v0": 30.0,
        "angle_deg": 45.0,
        "drag_coeff": 0.47,
        "num_points": 80,
    }
    res = client.post("/api/simulation/projectile", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["range_ideal"] > 0
    assert data["range_drag"] > 0
    assert "x_drag" in data


def test_oscillator_api():
    payload = {
        "mass": 1.5,
        "spring_k": 35.0,
        "damping_b": 0.4,
        "t_max": 6.0,
        "num_points": 100,
    }
    res = client.post("/api/simulation/oscillator", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["regime"] == "underdamped"
    assert "resonance_curve" in data


def test_presets_api():
    res = client.get("/api/experiments/presets")
    assert res.status_code == 200
    presets = res.json()
    assert "pendulum" in presets
    assert "projectile" in presets
    assert "oscillator" in presets
