import React, { useState, useEffect, useRef } from "react";
import type { PendulumParams, PendulumResult } from "../types";
import { fetchPendulumSimulation } from "../api";
import { Play, Pause, RotateCcw, Sliders, Zap, Info, Compass } from "lucide-react";

export const PendulumModule: React.FC = () => {
  const [params, setParams] = useState<PendulumParams>({
    length: 1.0,
    gravity: 9.80665,
    mass: 0.35,
    damping: 0.04,
    theta0_deg: 35.0,
    omega0: 0.0,
    t_max: 12.0,
    num_points: 600,
  });

  const [simResult, setSimResult] = useState<PendulumResult | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeIndexRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  // Cargar simulación
  useEffect(() => {
    let isCancelled = false;
    fetchPendulumSimulation(params).then((res) => {
      if (!isCancelled) {
        setSimResult(res);
        timeIndexRef.current = 0;
        trailRef.current = [];
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [params]);

  // Render Loop en Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simResult || simResult.theta.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        const stepRate = simResult.params.num_points || 600;
        const totalDuration = simResult.params.t_max || 12;
        const speedMultiplier = (stepRate / totalDuration) * 1.0;
        timeIndexRef.current += dt * speedMultiplier;
        if (timeIndexRef.current >= simResult.theta.length) {
          timeIndexRef.current = 0;
          trailRef.current = [];
        }
      }

      const idx = Math.min(Math.floor(timeIndexRef.current), simResult.theta.length - 1);
      const th = simResult.theta[idx];
      const omega = simResult.omega[idx];

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Fondo tenue y cuadrícula
      ctx.strokeStyle = "rgba(100, 255, 218, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 40) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();

      const originX = w / 2;
      const originY = 70;
      const pixelScale = (h * 0.65) / Math.max(params.length, 0.5);
      const bobX = originX + Math.sin(th) * params.length * pixelScale;
      const bobY = originY + Math.cos(th) * params.length * pixelScale;

      // Registrar rastro
      trailRef.current.push({ x: bobX, y: bobY });
      if (trailRef.current.length > 45) trailRef.current.shift();

      // Dibujar rastro
      if (trailRef.current.length > 2) {
        ctx.beginPath();
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }
        ctx.strokeStyle = "rgba(100, 255, 218, 0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Arco de referencia vertical
      ctx.strokeStyle = "rgba(136, 146, 176, 0.2)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, originY + params.length * pixelScale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arco de ángulo
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.beginPath();
      ctx.arc(originX, originY, 40, Math.PI / 2, Math.PI / 2 + th, th < 0);
      ctx.stroke();

      // Varilla rígida
      ctx.strokeStyle = "rgba(204, 214, 246, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      // Pivote
      ctx.fillStyle = "#64ffda";
      ctx.beginPath();
      ctx.arc(originX, originY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Vector de velocidad
      const vScale = 12;
      const vx = -Math.cos(th) * omega * vScale;
      const vy = Math.sin(th) * omega * vScale;
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.lineTo(bobX + vx, bobY + vy);
      ctx.stroke();

      // Masa pendular (Bob) con brillo
      const radius = Math.max(12, Math.min(26, params.mass * 24));
      const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, radius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, "#64ffda");
      grad.addColorStop(1, "#0a5554");

      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(100, 255, 218, 0.5)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(bobX, bobY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simResult, isPlaying, params]);

  // Dibujar Espacio de Fases (theta vs omega)
  useEffect(() => {
    const canvas = phaseCanvasRef.current;
    if (!canvas || !simResult || simResult.theta.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Ejes
    ctx.strokeStyle = "rgba(136, 146, 176, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();

    // Rótulos de ejes
    ctx.fillStyle = "#8892b0";
    ctx.font = "10px monospace";
    ctx.fillText("θ (rad)", w - 45, cy - 6);
    ctx.fillText("ω (rad/s)", cx + 8, 14);

    // Órbita de fase
    const maxTh = Math.max(...simResult.theta.map(Math.abs), 0.5);
    const maxW = Math.max(...simResult.omega.map(Math.abs), 1.0);
    const scaleX = (w * 0.42) / maxTh;
    const scaleY = (h * 0.42) / maxW;

    ctx.beginPath();
    ctx.moveTo(cx + simResult.theta[0] * scaleX, cy - simResult.omega[0] * scaleY);
    for (let i = 1; i < simResult.theta.length; i++) {
      ctx.lineTo(cx + simResult.theta[i] * scaleX, cy - simResult.omega[i] * scaleY);
    }
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#64ffda");
    grad.addColorStop(0.5, "#38bdf8");
    grad.addColorStop(1, "#a855f7");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }, [simResult]);

  const setPreset = (preset: Partial<PendulumParams>) => {
    setParams((prev) => ({ ...prev, ...preset }));
  };

  return (
    <div className="module-grid">
      {/* Columna Izquierda: Lienzo Principal & Espacio de Fases */}
      <div className="visual-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Compass className="panel-icon" size={18} />
              <h2 className="panel-title">Simulador Físico en Tiempo Real</h2>
            </div>
            <div className="canvas-controls">
              <button
                className="btn-icon"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pausar" : "Reanudar"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                className="btn-icon"
                onClick={() => {
                  timeIndexRef.current = 0;
                  trailRef.current = [];
                }}
                title="Reiniciar ciclo"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="canvas-wrapper">
            <canvas ref={canvasRef} width={640} height={420} className="physics-canvas" />
            <div className="canvas-overlay-badges">
              <span className="badge-tech">RK45 Adaptive ODE</span>
              <span className="badge-tech">Euler-Lagrange</span>
            </div>
          </div>

          <div className="module-subplots">
            <div className="subplot-box">
              <div className="subplot-header">
                <span>Espacio de Fases (θ vs ω)</span>
                <small className="mono-sub">Espiral disipativa</small>
              </div>
              <canvas ref={phaseCanvasRef} width={300} height={160} className="subplot-canvas" />
            </div>

            <div className="subplot-box">
              <div className="subplot-header">
                <span>Métricas Energéticas (J)</span>
                <small className="mono-sub">E = K + U</small>
              </div>
              <div className="energy-meter-box">
                <div className="energy-row">
                  <span>Cinética (K):</span>
                  <strong className="text-cyan">
                    {simResult?.kinetic_energy[0] !== undefined ? `${simResult.kinetic_energy[Math.floor(timeIndexRef.current) || 0]} J` : "0.0 J"}
                  </strong>
                </div>
                <div className="energy-row">
                  <span>Potencial (U):</span>
                  <strong className="text-mint">
                    {simResult?.potential_energy[0] !== undefined ? `${simResult.potential_energy[Math.floor(timeIndexRef.current) || 0]} J` : "0.0 J"}
                  </strong>
                </div>
                <div className="energy-row border-top">
                  <span>Total (E):</span>
                  <strong className="text-purple">
                    {simResult?.total_energy[0] !== undefined ? `${simResult.total_energy[Math.floor(timeIndexRef.current) || 0]} J` : "0.0 J"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Analítico */}
        <div className="kpi-grid">
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Periodo Lineal T₀</span>
            <strong className="kpi-val">{simResult ? `${simResult.period_theoretical_linear} s` : "--"}</strong>
            <small className="kpi-sub">2π√(L/g) [θ « 1]</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Periodo No Lineal</span>
            <strong className="kpi-val text-mint">{simResult ? `${simResult.period_nonlinear_approx} s` : "--"}</strong>
            <small className="kpi-sub">Corrección de Borda/Legendre</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Amortiguamiento</span>
            <strong className="kpi-val text-cyan">{params.damping > 0 ? `${(params.damping / params.mass).toFixed(3)} s⁻¹` : "Conservativo"}</strong>
            <small className="kpi-sub">Decaimiento γ = b/m</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Energía Mecánica</span>
            <strong className="kpi-val text-purple">{simResult ? `${simResult.total_energy[0]} J` : "--"}</strong>
            <small className="kpi-sub">Estado inicial</small>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Panel de Parámetros & Escenarios */}
      <div className="controls-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Sliders className="panel-icon" size={18} />
              <h3 className="panel-title">Parámetros del Sistema</h3>
            </div>
          </div>

          <div className="controls-form">
            <div className="control-group">
              <div className="control-label-row">
                <label>Longitud de la Varilla (L)</label>
                <span className="control-value">{params.length} m</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.05"
                value={params.length}
                onChange={(e) => setParams({ ...params, length: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Ángulo Inicial (θ₀)</label>
                <span className="control-value">{params.theta0_deg}°</span>
              </div>
              <input
                type="range"
                min="5"
                max="160"
                step="1"
                value={params.theta0_deg}
                onChange={(e) => setParams({ ...params, theta0_deg: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Aceleración de Gravedad (g)</label>
                <span className="control-value">{params.gravity} m/s²</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="25.0"
                step="0.1"
                value={params.gravity}
                onChange={(e) => setParams({ ...params, gravity: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Coeficiente de Fricción (b)</label>
                <span className="control-value">{params.damping} N·s/m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.25"
                step="0.005"
                value={params.damping}
                onChange={(e) => setParams({ ...params, damping: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Masa del Péndulo (m)</label>
                <span className="control-value">{params.mass} kg</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="2.0"
                step="0.05"
                value={params.mass}
                onChange={(e) => setParams({ ...params, mass: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="presets-box">
            <span className="presets-title">
              <Zap size={14} /> Escenarios Predefinidos:
            </span>
            <div className="presets-buttons">
              <button
                className="preset-btn"
                onClick={() => setPreset({ gravity: 9.80665, length: 1.0, theta0_deg: 30, damping: 0.03 })}
              >
                🌍 Tierra Estándar
              </button>
              <button
                className="preset-btn"
                onClick={() => setPreset({ gravity: 1.62, length: 1.0, theta0_deg: 45, damping: 0.0 })}
              >
                🌑 Luna (Vacío)
              </button>
              <button
                className="preset-btn"
                onClick={() => setPreset({ gravity: 24.79, length: 1.2, theta0_deg: 25, damping: 0.08 })}
              >
                🪐 Júpiter
              </button>
              <button
                className="preset-btn"
                onClick={() => setPreset({ gravity: 9.80665, length: 1.0, theta0_deg: 130, damping: 0.04 })}
              >
                🔥 Gran Amplitud (130°)
              </button>
            </div>
          </div>

          <div className="theory-card">
            <div className="theory-header">
              <Info size={14} /> Ecuación Diferencial No Lineal
            </div>
            <code className="theory-formula">
              m·L·θ'' + b·θ' + m·g·sin(θ) = 0
            </code>
            <p className="theory-text">
              Para amplitudes grandes, la aproximación de ángulos pequeños sin(θ) ≈ θ falla significativamente. El periodo real aumenta conforme el ángulo inicial crece hacia π rad.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
