import React, { useState, useEffect, useRef } from "react";
import type { OscillatorParams, OscillatorResult } from "../types";
import { fetchOscillatorSimulation } from "../api";
import { Play, Pause, RotateCcw, Sliders, Waves, Info, Zap } from "lucide-react";

export const OscillatorModule: React.FC = () => {
  const [params, setParams] = useState<OscillatorParams>({
    mass: 1.0,
    spring_k: 28.0,
    damping_b: 0.6,
    driving_force: 0.0,
    driving_freq: 0.0,
    x0: 0.45,
    v0: 0.0,
    t_max: 15.0,
    num_points: 500,
  });

  const [simResult, setSimResult] = useState<OscillatorResult | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const timeIndexRef = useRef<number>(0);

  useEffect(() => {
    fetchOscillatorSimulation(params).then((res) => {
      setSimResult(res);
      timeIndexRef.current = 0;
    });
  }, [params]);

  // Canvas animación del resorte y la masa
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simResult || simResult.x.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        timeIndexRef.current += dt * (simResult.params.num_points / params.t_max);
        if (timeIndexRef.current >= simResult.x.length) {
          timeIndexRef.current = 0;
        }
      }

      const idx = Math.min(Math.floor(timeIndexRef.current), simResult.x.length - 1);
      const curX = simResult.x[idx];

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const wallX = 60;
      const baseY = h / 2;
      const eqX = w / 2 + 30; // Posición de equilibrio
      const scaleX = 180;     // Píxeles por metro
      const blockX = eqX + curX * scaleX;
      const blockW = 60;
      const blockH = 50;

      // Pared fija izquierda
      ctx.fillStyle = "rgba(136, 146, 176, 0.4)";
      ctx.fillRect(wallX - 16, baseY - 65, 16, 130);
      ctx.strokeStyle = "rgba(204, 214, 246, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(wallX - 16, baseY - 65, 16, 130);

      // Línea de equilibrio punteada
      ctx.strokeStyle = "rgba(100, 255, 218, 0.3)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(eqX + blockW / 2, baseY - 80);
      ctx.lineTo(eqX + blockW / 2, baseY + 80);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#64ffda";
      ctx.font = "10px monospace";
      ctx.fillText("x = 0 (Equilibrio)", eqX + blockW / 2 - 38, baseY - 90);

      // Dibujar resorte helicoidal (zigzag elástico)
      const springStartX = wallX;
      const springEndX = blockX;
      const coils = 14;
      const coilW = (springEndX - springStartX) / coils;
      const coilH = 18;

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(springStartX, baseY - 12);
      for (let i = 0; i < coils; i++) {
        const segX = springStartX + i * coilW;
        const offset = i % 2 === 0 ? -coilH : coilH;
        ctx.lineTo(segX + coilW / 2, baseY - 12 + offset);
      }
      ctx.lineTo(springEndX, baseY - 12);
      ctx.stroke();

      // Amortiguador de pistón inferior (dashpot)
      const damperY = baseY + 28;
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      // Cilindro
      ctx.strokeRect(wallX, damperY - 8, (eqX - wallX) * 0.7, 16);
      // Vástago y pistón
      ctx.beginPath();
      ctx.moveTo(wallX + (eqX - wallX) * 0.5, damperY);
      ctx.lineTo(blockX, damperY);
      ctx.stroke();

      // Masa oscilante
      const grad = ctx.createLinearGradient(blockX, baseY - blockH / 2, blockX + blockW, baseY + blockH / 2);
      grad.addColorStop(0, "#172a45");
      grad.addColorStop(1, "#0d1b2a");

      ctx.fillStyle = grad;
      ctx.strokeStyle = "#64ffda";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(100, 255, 218, 0.35)";
      ctx.shadowBlur = 12;
      ctx.fillRect(blockX, baseY - blockH / 2, blockW, blockH);
      ctx.strokeRect(blockX, baseY - blockH / 2, blockW, blockH);
      ctx.shadowBlur = 0;

      // Texto de masa
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`${params.mass} kg`, blockX + 12, baseY + 4);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [simResult, isPlaying, params]);

  // Dibujar curva de desplazamiento temporal x(t)
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !simResult || simResult.x.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padY = h / 2;
    const scaleY = (h * 0.4) / Math.max(Math.abs(params.x0), 0.2);
    const scaleX = w / simResult.x.length;

    // Eje cero
    ctx.strokeStyle = "rgba(136, 146, 176, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, padY); ctx.lineTo(w, padY);
    ctx.stroke();

    // Curva x(t)
    ctx.beginPath();
    ctx.moveTo(0, padY - simResult.x[0] * scaleY);
    for (let i = 1; i < simResult.x.length; i++) {
      ctx.lineTo(i * scaleX, padY - simResult.x[i] * scaleY);
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#64ffda");
    grad.addColorStop(1, "#a855f7");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [simResult, params]);

  return (
    <div className="module-grid">
      <div className="visual-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Waves className="panel-icon" size={18} />
              <h2 className="panel-title">Masa-Resorte con Amortiguamiento y Forzamiento</h2>
            </div>
            <div className="canvas-controls">
              <button
                className="btn-icon"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pausar" : "Reanudar"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="btn-icon" onClick={() => (timeIndexRef.current = 0)} title="Reiniciar">
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <div className="canvas-wrapper">
            <canvas ref={canvasRef} width={640} height={320} className="physics-canvas" />
            <div className="canvas-overlay-badges">
              <span className={`regime-badge ${simResult?.regime || "underdamped"}`}>
                {simResult?.regime_label || "Calculando..."}
              </span>
            </div>
          </div>

          <div className="subplot-box" style={{ marginTop: "1rem" }}>
            <div className="subplot-header">
              <span>Desplazamiento Temporal x(t)</span>
              <small className="mono-sub">Decaimiento exponencial</small>
            </div>
            <canvas ref={waveCanvasRef} width={640} height={120} className="subplot-canvas" />
          </div>
        </div>

        {/* KPIs del Oscilador */}
        <div className="kpi-grid">
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Frecuencia Natural (ω₀)</span>
            <strong className="kpi-val text-mint">{simResult ? `${simResult.omega_natural} rad/s` : "--"}</strong>
            <small className="kpi-sub">√(k/m)</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Factor de Amortiguamiento (ζ)</span>
            <strong className="kpi-val text-cyan">{simResult ? simResult.damping_ratio : "--"}</strong>
            <small className="kpi-sub">b / (2√(mk))</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Frecuencia Amortiguada (ω_d)</span>
            <strong className="kpi-val text-purple">
              {simResult?.damped_frequency ? `${simResult.damped_frequency} rad/s` : "Aperiódico"}
            </strong>
            <small className="kpi-sub">ω₀√(1 - ζ²)</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Energía Total Inicial</span>
            <strong className="kpi-val">{simResult ? `${simResult.total_energy[0]} J` : "--"}</strong>
            <small className="kpi-sub">½ k x₀²</small>
          </div>
        </div>
      </div>

      <div className="controls-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Sliders className="panel-icon" size={18} />
              <h3 className="panel-title">Parámetros del Oscilador</h3>
            </div>
          </div>

          <div className="controls-form">
            <div className="control-group">
              <div className="control-label-row">
                <label>Masa del Bloque (m)</label>
                <span className="control-value">{params.mass} kg</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={params.mass}
                onChange={(e) => setParams({ ...params, mass: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Constante del Resorte (k)</label>
                <span className="control-value">{params.spring_k} N/m</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={params.spring_k}
                onChange={(e) => setParams({ ...params, spring_k: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Amortiguamiento del Pistón (b)</label>
                <span className="control-value">{params.damping_b} N·s/m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="18.0"
                step="0.1"
                value={params.damping_b}
                onChange={(e) => setParams({ ...params, damping_b: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Desplazamiento Inicial (x₀)</label>
                <span className="control-value">{params.x0} m</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={params.x0}
                onChange={(e) => setParams({ ...params, x0: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Fuerza Externa Periódica (F₀)</label>
                <span className="control-value">{params.driving_force} N</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="25.0"
                step="0.5"
                value={params.driving_force}
                onChange={(e) => setParams({ ...params, driving_force: parseFloat(e.target.value) })}
              />
            </div>

            {params.driving_force > 0 && (
              <div className="control-group">
                <div className="control-label-row">
                  <label>Frecuencia de Excitación (ω_f)</label>
                  <span className="control-value">{params.driving_freq} rad/s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="20.0"
                  step="0.2"
                  value={params.driving_freq}
                  onChange={(e) => setParams({ ...params, driving_freq: parseFloat(e.target.value) })}
                />
              </div>
            )}
          </div>

          <div className="presets-box">
            <span className="presets-title">
              <Zap size={14} /> Regímenes Físicos:
            </span>
            <div className="presets-buttons">
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, mass: 1.0, spring_k: 25.0, damping_b: 0.5, driving_force: 0 })}
              >
                🌊 Subamortiguado (ζ &lt; 1)
              </button>
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, mass: 1.0, spring_k: 25.0, damping_b: 10.0, driving_force: 0 })}
              >
                ⚖️ Crítico (ζ = 1.0)
              </button>
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, mass: 1.0, spring_k: 25.0, damping_b: 22.0, driving_force: 0 })}
              >
                🧱 Sobreamortiguado (ζ &gt; 1)
              </button>
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, mass: 1.0, spring_k: 25.0, damping_b: 0.25, driving_force: 4.5, driving_freq: 5.0 })}
              >
                💥 Resonancia Forzada
              </button>
            </div>
          </div>

          <div className="theory-card">
            <div className="theory-header">
              <Info size={14} /> Clasificación de EDO de Segundo Orden
            </div>
            <code className="theory-formula">
              m·x'' + b·x' + k·x = F₀·cos(ω_f·t)
            </code>
            <p className="theory-text">
              El discriminante de la ecuación característica Δ = b² - 4mk define si el sistema oscila de forma armónica disipativa, regresa a equilibrio en tiempo mínimo o exhibe decaimiento exponencial puro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
