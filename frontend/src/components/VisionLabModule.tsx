import React, { useState, useEffect, useRef } from "react";
import type { TrackingDemoResponse } from "../types";
import { fetchTrackingDemo } from "../api";
import { Eye, Play, Pause, RotateCcw, Activity, Sparkles } from "lucide-react";

export const VisionLabModule: React.FC = () => {
  const [demoData, setDemoData] = useState<TrackingDemoResponse | null>(null);
  const [activeFrame, setActiveFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const trackerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    fetchTrackingDemo().then((res) => {
      setDemoData(res);
      setActiveFrame(0);
    });
  }, []);

  // Frame animation loop
  useEffect(() => {
    if (!isPlaying || !demoData) return;

    let lastTime = performance.now();
    const fps = demoData.tracking.fps || 30;
    const interval = 1000 / fps;

    const tick = (now: number) => {
      if (now - lastTime >= interval) {
        lastTime = now;
        setActiveFrame((prev) => (prev + 1) % demoData.tracking.points.length);
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, demoData]);

  // Dibujar Canvas del Rastreador de Visión Computacional
  useEffect(() => {
    const canvas = trackerCanvasRef.current;
    if (!canvas || !demoData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pt = demoData.tracking.points[activeFrame];
    if (!pt) return;

    // Fondo simulado de cámara de laboratorio
    ctx.fillStyle = "#071220";
    ctx.fillRect(0, 0, w, h);

    // Patrón de calibración de laboratorio (líneas de escala física)
    ctx.strokeStyle = "rgba(136, 146, 176, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      ctx.moveTo(x, 20); ctx.lineTo(x, h - 20);
    }
    for (let y = 30; y < h; y += 40) {
      ctx.moveTo(20, y); ctx.lineTo(w - 20, y);
    }
    ctx.stroke();

    // Regla de escala
    ctx.strokeStyle = "#64ffda";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, h - 25);
    ctx.lineTo(140, h - 25);
    ctx.stroke();
    ctx.fillStyle = "#64ffda";
    ctx.font = "10px monospace";
    ctx.fillText("Escala: 0.25 m", 42, h - 32);

    // Rastro de centroides detectados hasta el fotograma actual
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const trailStart = Math.max(0, activeFrame - 35);
    for (let i = trailStart; i <= activeFrame; i++) {
      const p = demoData.tracking.points[i];
      if (i === trailStart) ctx.moveTo(p.cx_px, p.cy_px);
      else ctx.lineTo(p.cx_px, p.cy_px);
    }
    ctx.stroke();

    // Caja delimitadora (Bounding Box) de OpenCV
    const bSize = pt.radius_px * 2.2;
    ctx.strokeStyle = "#64ffda";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pt.cx_px - bSize / 2, pt.cy_px - bSize / 2, bSize, bSize);

    // Centroide de momentos de masa
    ctx.fillStyle = "#ff7b72";
    ctx.beginPath();
    ctx.arc(pt.cx_px, pt.cy_px, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cruz de puntería (Crosshair)
    ctx.strokeStyle = "rgba(255, 123, 114, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.cx_px - 14, pt.cy_px); ctx.lineTo(pt.cx_px + 14, pt.cy_px);
    ctx.moveTo(pt.cx_px, pt.cy_px - 14); ctx.lineTo(pt.cx_px, pt.cy_px + 14);
    ctx.stroke();

    // Texto de telemetría de fotograma
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`Frame: ${pt.frame_idx} / ${demoData.tracking.total_frames}`, 24, 30);
    ctx.fillStyle = "#a8b2d1";
    ctx.font = "11px monospace";
    ctx.fillText(`t = ${pt.t.toFixed(2)}s | x = ${(pt.x_m * 100).toFixed(1)} cm`, 24, 46);
    ctx.fillText(`Centroide: (${pt.cx_px.toFixed(0)}, ${pt.cy_px.toFixed(0)}) px`, 24, 62);
  }, [demoData, activeFrame]);

  // Dibujar gráfica de filtro Savitzky-Golay vs Señal Ruidosa
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || !demoData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = demoData.tracking.points;
    const smooth = demoData.analysis.smooth_x;
    if (pts.length === 0 || smooth.length === 0) return;

    const padLeft = 45;
    const padRight = 20;
    const padY = h / 2;
    const plotW = w - padLeft - padRight;
    const scaleX = plotW / pts.length;
    const maxVal = Math.max(...pts.map((p) => Math.abs(p.x_m)), 0.1);
    const scaleY = (h * 0.38) / maxVal;

    // Eje cero
    ctx.strokeStyle = "rgba(136, 146, 176, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padY); ctx.lineTo(w - padRight, padY);
    ctx.stroke();

    // 1. Datos Experimentales Crudos (Con Ruido - Grisáceo/Cian tenue)
    ctx.strokeStyle = "rgba(136, 146, 176, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padLeft, padY - pts[0].x_m * scaleY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(padLeft + i * scaleX, padY - pts[i].x_m * scaleY);
    }
    ctx.stroke();

    // 2. Señal Filtrada Savitzky-Golay (Menta Nítido)
    ctx.strokeStyle = "#64ffda";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(padLeft, padY - smooth[0] * scaleY);
    for (let i = 1; i < smooth.length; i++) {
      ctx.lineTo(padLeft + i * scaleX, padY - smooth[i] * scaleY);
    }
    ctx.stroke();

    // 3. Picos detectados (Marcadores circulares)
    ctx.fillStyle = "#ff7b72";
    demoData.analysis.peaks_indices.forEach((idx) => {
      if (idx < smooth.length) {
        const px = padLeft + idx * scaleX;
        const py = padY - smooth[idx] * scaleY;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Cursor de fotograma actual
    const curX = padLeft + activeFrame * scaleX;
    ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, 10); ctx.lineTo(curX, h - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [demoData, activeFrame]);

  return (
    <div className="module-grid">
      <div className="visual-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Eye className="panel-icon" size={18} />
              <h2 className="panel-title">Pipeline de Visión por Computadora (OpenCV Moments)</h2>
            </div>
            <div className="canvas-controls">
              <button className="btn-icon" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="btn-icon" onClick={() => setActiveFrame(0)}>
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="canvas-wrapper">
            <canvas ref={trackerCanvasRef} width={640} height={340} className="physics-canvas" />
            <div className="canvas-legend">
              <span className="legend-item text-mint">
                <span className="legend-box"></span> Bounding Box HSV
              </span>
              <span className="legend-item text-coral">
                <span className="legend-dot"></span> Centroide M₁₀/M₀₀
              </span>
            </div>
          </div>

          <div className="subplot-box" style={{ marginTop: "1rem" }}>
            <div className="subplot-header">
              <span>Señal Experimental Filtrada (Savitzky-Golay + Peak Detection)</span>
              <small className="mono-sub">Filtro polinomial de convolución</small>
            </div>
            <canvas ref={chartCanvasRef} width={640} height={140} className="subplot-canvas" />
          </div>
        </div>

        {/* KPIs de Visión */}
        <div className="kpi-grid">
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Periodo Experimental T</span>
            <strong className="kpi-val text-mint">{demoData ? `${demoData.analysis.estimated_period} s` : "--"}</strong>
            <small className="kpi-sub">Delta promedio entre picos</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Frecuencia Extraída</span>
            <strong className="kpi-val text-cyan">{demoData ? `${demoData.analysis.estimated_frequency_hz} Hz` : "--"}</strong>
            <small className="kpi-sub">f = 1/T</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Coeficiente R² de Ajuste</span>
            <strong className="kpi-val text-purple">{demoData ? `${(demoData.analysis.r2_score * 100).toFixed(1)}%` : "--"}</strong>
            <small className="kpi-sub">Bondad de ajuste a EDO</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Tasa de Detección</span>
            <strong className="kpi-val">{demoData ? `${demoData.tracking.detection_rate_pct}%` : "--"}</strong>
            <small className="kpi-sub">30 FPS estables</small>
          </div>
        </div>
      </div>

      <div className="controls-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Sparkles className="panel-icon" size={18} />
              <h3 className="panel-title">Algoritmo de Extracción</h3>
            </div>
          </div>

          <div className="vision-steps-list">
            <div className="vision-step-item">
              <div className="step-num">01</div>
              <div>
                <strong>Segmentación en Espacio HSV</strong>
                <p>Conversión desde BGR a HSV para aislar el color del objeto independientemente de la iluminación ambiental.</p>
              </div>
            </div>

            <div className="vision-step-item">
              <div className="step-num">02</div>
              <div>
                <strong>Morfología &amp; Momentos Espaciales</strong>
                <p>Erosión y dilatación para remover ruido y cálculo analítico de centroides: x̄ = M₁₀ / M₀₀, ȳ = M₀₁ / M₀₀.</p>
              </div>
            </div>

            <div className="vision-step-item">
              <div className="step-num">03</div>
              <div>
                <strong>Calibración Métrica (PPM)</strong>
                <p>Transformación de coordenadas desde píxeles a metros según la distancia focal y el objeto de referencia.</p>
              </div>
            </div>

            <div className="vision-step-item">
              <div className="step-num">04</div>
              <div>
                <strong>Filtro Savitzky-Golay</strong>
                <p>Ajuste de polinomios locales por mínimos cuadrados preservando la forma de onda de picos y derivadas de velocidad.</p>
              </div>
            </div>
          </div>

          <div className="theory-card" style={{ marginTop: "1.2rem" }}>
            <div className="theory-header">
              <Activity size={14} /> Videos Experimentales Incluidos
            </div>
            <p className="theory-text">
              El repositorio cuenta con registros en video reales en <code>data/videos/</code> correspondientes a los ensayos de osciladores y péndulos ejecutados en laboratorio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
