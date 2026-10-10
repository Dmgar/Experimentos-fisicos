import React, { useState, useEffect, useRef } from "react";
import type { ProjectileParams, ProjectileResult } from "../types";
import { fetchProjectileSimulation } from "../api";
import { Play, Sliders, Wind, Target, Info } from "lucide-react";

export const ProjectileModule: React.FC = () => {
  const [params, setParams] = useState<ProjectileParams>({
    v0: 38.0,
    angle_deg: 45.0,
    y0: 0.0,
    gravity: 9.80665,
    mass: 0.145,
    drag_coeff: 0.47,
    cross_area: 0.0042,
    air_density: 1.225,
    wind_x: 0.0,
    num_points: 350,
  });

  const [simResult, setSimResult] = useState<ProjectileResult | null>(null);
  const [progress, setProgress] = useState<number>(1.0); // 0.0 a 1.0 para animar el vuelo
  const [isFiring, setIsFiring] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    fetchProjectileSimulation(params).then((res) => {
      setSimResult(res);
      setProgress(1.0);
    });
  }, [params]);

  const fireCannon = () => {
    setIsFiring(true);
    setProgress(0.0);
    const start = performance.now();
    const duration = 2200; // ms

    const animateFlight = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1.0);
      setProgress(p);

      if (p < 1.0) {
        animRef.current = requestAnimationFrame(animateFlight);
      } else {
        setIsFiring(false);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animateFlight);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simResult) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dimensiones y escalado
    const maxRange = Math.max(simResult.range_ideal, simResult.range_drag, 20);
    const maxHeight = Math.max(simResult.max_height_ideal, simResult.max_height_drag, 10);

    const padLeft = 60;
    const padBottom = 50;
    const padTop = 40;
    const padRight = 40;

    const plotW = w - padLeft - padRight;
    const plotH = h - padBottom - padTop;

    const scaleX = plotW / (maxRange * 1.08);
    const scaleY = plotH / (maxHeight * 1.25);

    const toCanvasX = (x: number) => padLeft + x * scaleX;
    const toCanvasY = (y: number) => h - padBottom - y * scaleY;

    // Cuadrícula y ejes
    ctx.strokeStyle = "rgba(136, 146, 176, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let xVal = 0; xVal <= maxRange; xVal += Math.ceil(maxRange / 6 / 10) * 10) {
      const cx = toCanvasX(xVal);
      ctx.moveTo(cx, padTop); ctx.lineTo(cx, h - padBottom);
      ctx.fillStyle = "#697793";
      ctx.font = "10px monospace";
      ctx.fillText(`${xVal}m`, cx - 10, h - padBottom + 18);
    }
    for (let yVal = 0; yVal <= maxHeight; yVal += Math.ceil(maxHeight / 4 / 5) * 5) {
      const cy = toCanvasY(yVal);
      ctx.moveTo(padLeft, cy); ctx.lineTo(w - padRight, cy);
      ctx.fillStyle = "#697793";
      ctx.font = "10px monospace";
      ctx.fillText(`${yVal}m`, padLeft - 38, cy + 3);
    }
    ctx.stroke();

    // Terreno (Suelo)
    ctx.strokeStyle = "rgba(100, 255, 218, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padLeft - 10, h - padBottom);
    ctx.lineTo(w - padRight + 10, h - padBottom);
    ctx.stroke();

    // 1. Curva Ideal (Vacío) - Punteada
    ctx.strokeStyle = "rgba(240, 246, 252, 0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasY(params.y0));
    for (let i = 0; i < simResult.x_ideal.length; i++) {
      ctx.lineTo(toCanvasX(simResult.x_ideal[i]), toCanvasY(simResult.y_ideal[i]));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Curva Real (Con arrastre aerodinámico)
    const countDrag = Math.floor(simResult.x_drag.length * progress);
    if (countDrag > 1) {
      const grad = ctx.createLinearGradient(padLeft, 0, w - padRight, 0);
      grad.addColorStop(0, "#64ffda");
      grad.addColorStop(0.5, "#38bdf8");
      grad.addColorStop(1, "#a855f7");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(100, 255, 218, 0.4)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(simResult.x_drag[0]), toCanvasY(simResult.y_drag[0]));
      for (let i = 1; i < countDrag; i++) {
        ctx.lineTo(toCanvasX(simResult.x_drag[i]), toCanvasY(simResult.y_drag[i]));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Proyectil en cabeza
      const headX = toCanvasX(simResult.x_drag[countDrag - 1]);
      const headY = toCanvasY(simResult.y_drag[countDrag - 1]);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(headX, headY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Marcadores de impacto
    const impIdealX = toCanvasX(simResult.range_ideal);
    const impDragX = toCanvasX(simResult.range_drag);
    const groundY = toCanvasY(0);

    // Marcador Ideal
    ctx.fillStyle = "#a8b2d1";
    ctx.beginPath();
    ctx.arc(impIdealX, groundY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`Vacío: ${simResult.range_ideal}m`, impIdealX - 35, groundY - 12);

    // Marcador Real
    ctx.fillStyle = "#64ffda";
    ctx.beginPath();
    ctx.arc(impDragX, groundY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`Real: ${simResult.range_drag}m`, impDragX - 30, groundY + 34);

    // Cañón en el origen
    const thetaRad = (params.angle_deg * Math.PI) / 180;
    const cannonLen = 28;
    const originX = toCanvasX(0);
    const originY = toCanvasY(params.y0);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + Math.cos(thetaRad) * cannonLen, originY - Math.sin(thetaRad) * cannonLen);
    ctx.stroke();

    ctx.fillStyle = "#64ffda";
    ctx.beginPath();
    ctx.arc(originX, originY, 6, 0, Math.PI * 2);
    ctx.fill();
  }, [simResult, progress, params]);

  return (
    <div className="module-grid">
      <div className="visual-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Target className="panel-icon" size={18} />
              <h2 className="panel-title">Trayectoria Balística Comparada</h2>
            </div>
            <div className="canvas-controls">
              <button className="btn-mint-sm" onClick={fireCannon} disabled={isFiring}>
                <Play size={14} /> {isFiring ? "Lanzando..." : "Disparar Cañón"}
              </button>
            </div>
          </div>

          <div className="canvas-wrapper">
            <canvas ref={canvasRef} width={640} height={380} className="physics-canvas" />
            <div className="canvas-legend">
              <span className="legend-item text-mint">
                <span className="legend-line line-solid"></span> Con arrastre aerodinámico
              </span>
              <span className="legend-item text-muted">
                <span className="legend-line line-dashed"></span> En vacío ideal
              </span>
            </div>
          </div>
        </div>

        {/* KPIs Balísticos */}
        <div className="kpi-grid">
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Alcance Real</span>
            <strong className="kpi-val text-mint">{simResult ? `${simResult.range_drag} m` : "--"}</strong>
            <small className="kpi-sub">Con fricción de aire</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Alcance en Vacío</span>
            <strong className="kpi-val">{simResult ? `${simResult.range_ideal} m` : "--"}</strong>
            <small className="kpi-sub">Teórico sin arrastre</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Pérdida por Arrastre</span>
            <strong className="kpi-val text-cyan">{simResult ? `-${simResult.drag_loss_pct}%` : "--"}</strong>
            <small className="kpi-sub">Disipación por atmósfera</small>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Ápex (Altura Máx)</span>
            <strong className="kpi-val text-purple">{simResult ? `${simResult.max_height_drag} m` : "--"}</strong>
            <small className="kpi-sub">Vértice de trayectoria</small>
          </div>
        </div>
      </div>

      <div className="controls-column">
        <div className="panel-card glass-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Sliders className="panel-icon" size={18} />
              <h3 className="panel-title">Parámetros de Disparo</h3>
            </div>
          </div>

          <div className="controls-form">
            <div className="control-group">
              <div className="control-label-row">
                <label>Velocidad Inicial (v₀)</label>
                <span className="control-value">{params.v0} m/s</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="1"
                value={params.v0}
                onChange={(e) => setParams({ ...params, v0: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Ángulo de Elevación (α)</label>
                <span className="control-value">{params.angle_deg}°</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                step="1"
                value={params.angle_deg}
                onChange={(e) => setParams({ ...params, angle_deg: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Coeficiente de Arrastre (C_d)</label>
                <span className="control-value">{params.drag_coeff}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.2"
                step="0.02"
                value={params.drag_coeff}
                onChange={(e) => setParams({ ...params, drag_coeff: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Viento Horizontal (w_x)</label>
                <span className="control-value">{params.wind_x} m/s</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={params.wind_x}
                onChange={(e) => setParams({ ...params, wind_x: parseFloat(e.target.value) })}
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label>Masa del Proyectil (m)</label>
                <span className="control-value">{params.mass} kg</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="5.0"
                step="0.05"
                value={params.mass}
                onChange={(e) => setParams({ ...params, mass: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="presets-box">
            <span className="presets-title">
              <Wind size={14} /> Perfiles Balísticos:
            </span>
            <div className="presets-buttons">
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, v0: 38, angle_deg: 45, drag_coeff: 0.47, mass: 0.145, wind_x: 0 })}
              >
                ⚾ Pelota de Béisbol
              </button>
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, v0: 95, angle_deg: 35, drag_coeff: 0.47, mass: 4.5, wind_x: 0 })}
              >
                💣 Bala de Cañón
              </button>
              <button
                className="preset-btn"
                onClick={() => setParams({ ...params, v0: 45, angle_deg: 40, drag_coeff: 0.5, mass: 0.2, wind_x: -12 })}
              >
                💨 Viento en Contra (-12 m/s)
              </button>
            </div>
          </div>

          <div className="theory-card">
            <div className="theory-header">
              <Info size={14} /> Fuerza de Arrastre Cuadrática
            </div>
            <code className="theory-formula">
              F_drag = -½ · ρ · C_d · A · |v - w| · (v - w)
            </code>
            <p className="theory-text">
              A velocidades de tiro reales, el arrastre es proporcional al cuadrado de la velocidad relativa respecto a la masa de aire, deformando la parábola simétrica clásica en una curva asimétrica balística.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
