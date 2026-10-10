"""Video and image object tracking using OpenCV color thresholding and contour moments."""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
import cv2


@dataclass
class TrackingPoint:
    frame_idx: int
    t: float             # segundos
    cx_px: float         # Centroide X en píxeles
    cy_px: float         # Centroide Y en píxeles
    x_m: float           # Posición X en metros calibrados
    y_m: float           # Posición Y en metros calibrados
    radius_px: float     # Radio aparente del objeto detectado


@dataclass
class TrackingResult:
    total_frames: int
    detected_frames: int
    detection_rate_pct: float
    fps: float
    duration_s: float
    points: List[TrackingPoint]
    calibration_ppm: float # Píxeles por metro


class VideoTracker:
    """Rastreador de centroides para experimentos de física mediante OpenCV."""

    @staticmethod
    def process_frame_hsv(
        frame: np.ndarray,
        lower_hsv: Tuple[int, int, int] = (0, 70, 50),
        upper_hsv: Tuple[int, int, int] = (25, 255, 255),
        min_radius: float = 3.0,
    ) -> Optional[Tuple[float, float, float]]:
        """Extrae (cx, cy, radius) del objeto de interés en el fotograma."""
        blurred = cv2.GaussianBlur(frame, (11, 11), 0)
        hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array(lower_hsv), np.array(upper_hsv))
        mask = cv2.erode(mask, None, iterations=2)
        mask = cv2.dilate(mask, None, iterations=2)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        # Tomar el contorno más grande
        largest = max(contours, key=cv2.contourArea)
        ((x, y), radius) = cv2.minEnclosingCircle(largest)

        if radius >= min_radius:
            M = cv2.moments(largest)
            if M["m00"] > 0:
                cx = float(M["m10"] / M["m00"])
                cy = float(M["m01"] / M["m00"])
                return (cx, cy, float(radius))
        return None

    @classmethod
    def track_synthetic_trajectory(
        cls,
        num_frames: int = 180,
        fps: float = 30.0,
        frequency_hz: float = 0.8,
        amplitude_m: float = 0.35,
        damping: float = 0.08,
        ppm: float = 400.0,
        origin_y_px: float = 240.0,
        origin_x_px: float = 320.0,
    ) -> TrackingResult:
        """Genera una trayectoria física calibrada representativa con ruido gaussiano para pruebas."""
        t_total = num_frames / fps
        points = []

        for i in range(num_frames):
            t = i / fps
            # Movimiento armónico amortiguado representativo de un péndulo o resorte
            decay = np.exp(-damping * t)
            x_m = amplitude_m * np.sin(2 * np.pi * frequency_hz * t) * decay
            y_m = amplitude_m * 0.4 * (1.0 - np.cos(2 * np.pi * frequency_hz * t)) * decay

            # Ruido experimental
            noise_x = np.random.normal(0, 0.003)
            noise_y = np.random.normal(0, 0.003)

            x_noisy = x_m + noise_x
            y_noisy = y_m + noise_y

            cx_px = origin_x_px + (x_noisy * ppm)
            cy_px = origin_y_px + (y_noisy * ppm)

            points.append(
                TrackingPoint(
                    frame_idx=i,
                    t=round(float(t), 4),
                    cx_px=round(float(cx_px), 2),
                    cy_px=round(float(cy_px), 2),
                    x_m=round(float(x_noisy), 4),
                    y_m=round(float(y_noisy), 4),
                    radius_px=14.0,
                )
            )

        return TrackingResult(
            total_frames=num_frames,
            detected_frames=num_frames,
            detection_rate_pct=100.0,
            fps=fps,
            duration_s=round(t_total, 2),
            points=points,
            calibration_ppm=ppm,
        )
