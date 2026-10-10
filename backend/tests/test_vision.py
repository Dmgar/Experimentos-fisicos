"""Tests for computer vision video processing and physical model classification."""

import pytest
import numpy as np
from fastapi.testclient import TestClient
from main import app
from src.vision import VideoExperimentAnalyzer, PhysicalExperimentDiagnosis

client = TestClient(app)


def test_synthetic_pendulum_classification():
    report = VideoExperimentAnalyzer.generate_sample_analysis_report(
        experiment_type="PENDULO_SIMPLE",
        num_frames=150,
        fps=30.0
    )
    assert report.diagnosis.is_valid_experiment is True
    assert report.diagnosis.experiment_type == "PENDULO_SIMPLE"
    assert report.diagnosis.confidence_pct >= 80.0
    assert "periodo_experimental_s" in report.diagnosis.detected_parameters
    assert len(report.times) == 150
    assert len(report.raw_x) == 150
    assert len(report.theoretical_fit_x) == 150


def test_synthetic_projectile_classification():
    report = VideoExperimentAnalyzer.generate_sample_analysis_report(
        experiment_type="TIRO_PARABOLICO",
        num_frames=120,
        fps=30.0
    )
    assert report.diagnosis.is_valid_experiment is True
    assert report.diagnosis.experiment_type == "TIRO_PARABOLICO"
    assert report.diagnosis.confidence_pct >= 75.0
    assert "tiempo_apice_estimado_s" in report.diagnosis.detected_parameters


def test_api_analyze_sample():
    response = client.post("/api/vision/analyze-sample", json={"sample_id": "pendulo_muestra_2", "target_color": "auto"})
    assert response.status_code == 200
    data = response.json()
    assert "diagnosis" in data
    assert "detections" in data
    assert "times" in data
    assert len(data["times"]) > 0
    assert data["diagnosis"]["confidence_pct"] > 0


def test_api_classify_points_endpoint():
    # Enviar oscilaciones sintéticas
    t = np.linspace(0, 5.0, 100).tolist()
    x = (200.0 + 80.0 * np.sin(2 * np.pi * 0.9 * np.array(t))).tolist()
    y = (300.0 + 20.0 * np.cos(2 * np.pi * 0.9 * np.array(t))).tolist()

    response = client.post(
        "/api/vision/classify-points",
        json={"times": t, "x_coords": x, "y_coords": y, "fps": 30.0}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["diagnosis"]["experiment_type"] == "PENDULO_SIMPLE"
    assert data["diagnosis"]["is_valid_experiment"] is True
