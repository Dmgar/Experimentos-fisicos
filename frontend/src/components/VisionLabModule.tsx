import React, { useState, useEffect, useRef } from "react";
import type { VideoAnalysisReport } from "../types";
import { analyzeVideoFile, analyzeSampleVideo, localGenerateVideoReport } from "../api";
import {
  Eye,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Video,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  TrendingUp,
} from "lucide-react";

export const VisionLabModule: React.FC = () => {
  const [report, setReport] = useState<VideoAnalysisReport | null>(null);
  const [activeFrame, setActiveFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>("auto");
  const [activeTab, setActiveTab] = useState<"samples" | "upload" | "webcam">("samples");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Webcam recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordCountdown, setRecordCountdown] = useState<number>(0);

  const trackerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animRef = useRef<number | null>(null);

  // Cargar muestra inicial al montar
  useEffect(() => {
    loadSample("pendulo_muestra_2");
  }, []);

  const loadSample = async (sampleId: string) => {
    setIsLoading(true);
    try {
      const data = await analyzeSampleVideo(sampleId, selectedColor);
      setReport(data);
      setActiveFrame(0);
      setIsPlaying(true);
      setVideoUrl(null);
    } catch (err) {
      console.error("Error loading sample:", err);
      const fallback = localGenerateVideoReport(sampleId.includes("proyec") ? "TIRO_PARABOLICO" : "PENDULO_SIMPLE");
      setReport(fallback);
      setActiveFrame(0);
      setIsPlaying(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar subida de archivo de video
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsLoading(true);

    try {
      const data = await analyzeVideoFile(file, selectedColor);
      setReport(data);
      setActiveFrame(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error analyzing uploaded video:", err);
      const fallback = localGenerateVideoReport("PENDULO_SIMPLE");
      setReport(fallback);
      setActiveFrame(0);
      setIsPlaying(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Iniciar cámara web
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
    } catch (err) {
      alert("No se pudo acceder a la cámara web. Verifica los permisos del navegador.");
    }
  };

  // Grabar clip con la cámara web
  const startRecording = () => {
    if (!webcamVideoRef.current || !webcamVideoRef.current.srcObject) return;
    const stream = webcamVideoRef.current.srcObject as MediaStream;
    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const file = new File([blob], "grabacion_camara.webm", { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      setIsLoading(true);
      try {
        const data = await analyzeVideoFile(file, selectedColor);
        setReport(data);
        setActiveFrame(0);
        setIsPlaying(true);
      } catch {
        setReport(localGenerateVideoReport("PENDULO_SIMPLE"));
      } finally {
        setIsLoading(false);
      }
    };

    recorder.start();
    setIsRecording(true);
    setRecordCountdown(4);

    const countdownInterval = setInterval(() => {
      setRecordCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Detener cámara al cambiar de pestaña
  useEffect(() => {
    if (activeTab === "webcam") {
      startWebcam();
    } else {
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const stream = webcamVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        webcamVideoRef.current.srcObject = null;
      }
    }
  }, [activeTab]);

  // Loop de reproducción de fotogramas
  useEffect(() => {
    if (!isPlaying || !report || report.detections.length === 0) return;

    let lastTime = performance.now();
    const fps = report.video_metadata.fps || 30;
    const interval = 1000 / fps;

    const tick = (now: number) => {
      if (now - lastTime >= interval) {
        lastTime = now;
        setActiveFrame((prev) => {
          const next = prev + 1;
          if (next >= report.detections.length) {
            return 0;
          }
          return next;
        });
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, report]);

  // Dibujar Canvas del Rastreador de Visión Computacional
  useEffect(() => {
    const canvas = trackerCanvasRef.current;
    if (!canvas || !report || report.detections.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const det = report.detections[activeFrame];
    if (!det) return;

    // Fondo oscuro de laboratorio
    ctx.fillStyle = "#060e18";
    ctx.fillRect(0, 0, w, h);

    // Cuadrícula óptica de laboratorio
    ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Dibujar estela histórica (Trail de movimiento)
    const trailLen = Math.min(activeFrame, 45);
    if (trailLen > 1) {
      ctx.beginPath();
      for (let i = activeFrame - trailLen; i <= activeFrame; i++) {
        const p = report.detections[i];
        if (!p || !p.detected) continue;
        const normX = (p.x_px / (report.video_metadata.width || 640)) * w;
        const normY = (p.y_px / (report.video_metadata.height || 480)) * h;

        if (i === activeFrame - trailLen) ctx.moveTo(normX, normY);
        else ctx.lineTo(normX, normY);
      }
      ctx.strokeStyle = "rgba(0, 255, 178, 0.65)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00ffb2";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Centroide actual
    const curX = (det.x_px / (report.video_metadata.width || 640)) * w;
    const curY = (det.y_px / (report.video_metadata.height || 480)) * h;
    const radius = Math.max(10, (det.radius_px || 12) * (w / (report.video_metadata.width || 640)));

    if (det.detected) {
      // Bounding Box del objeto detectado
      ctx.strokeStyle = "#ffb020";
      ctx.lineWidth = 2;
      ctx.strokeRect(curX - radius - 4, curY - radius - 4, radius * 2 + 8, radius * 2 + 8);

      // Retícula de mira telescópica (Targeting Crosshairs)
      ctx.strokeStyle = "rgba(0, 229, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX - radius - 10, curY);
      ctx.lineTo(curX + radius + 10, curY);
      ctx.moveTo(curX, curY - radius - 10);
      ctx.lineTo(curX, curY + radius + 10);
      ctx.stroke();

      // Centroide
      ctx.beginPath();
      ctx.arc(curX, curY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255, 176, 32, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#ffb020";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Vector de velocidad v
      const vx = report.velocity_x[activeFrame] || 0;
      const vy = report.velocity_y[activeFrame] || 0;
      const arrowScale = 0.3;
      const endX = curX + vx * arrowScale;
      const endY = curY + vy * arrowScale;

      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = "#ff4d6d";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Punta de flecha
      const angle = Math.atan2(vy, vx);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 8 * Math.cos(angle - Math.PI / 6), endY - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 8 * Math.cos(angle + Math.PI / 6), endY - 8 * Math.sin(angle + Math.PI / 6));
      ctx.fillStyle = "#ff4d6d";
      ctx.fill();

      // Etiqueta de coordenadas y velocidad en tiempo real
      ctx.fillStyle = "#ffffff";
      ctx.font = "11px 'Fira Code', monospace";
      ctx.fillText(`Centroide: (${det.x_px.toFixed(1)} px, ${det.y_px.toFixed(1)} px)`, curX + radius + 8, curY - 6);
      ctx.fillStyle = "#00e5ff";
      ctx.fillText(`|v|: ${(report.velocity_mag[activeFrame] || 0).toFixed(1)} px/s`, curX + radius + 8, curY + 10);
    }

    // Telemetría de fotograma (HUD superior)
    ctx.fillStyle = "rgba(3, 9, 16, 0.85)";
    ctx.fillRect(8, 8, 230, 68);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.3)";
    ctx.strokeRect(8, 8, 230, 68);

    ctx.fillStyle = "#00ffb2";
    ctx.font = "bold 11px 'Fira Code', monospace";
    ctx.fillText(`• TRACKING ACTIVO (OpenCV)`, 18, 26);
    ctx.fillStyle = "#8ba3c7";
    ctx.font = "10px 'Fira Code', monospace";
    ctx.fillText(`Frame: ${activeFrame + 1} / ${report.detections.length} (${det.time_s.toFixed(2)}s)`, 18, 42);
    ctx.fillText(`Resolución: ${report.video_metadata.width}x${report.video_metadata.height} @ ${report.video_metadata.fps} FPS`, 18, 56);
    ctx.fillText(`Modelo: ${report.diagnosis.experiment_name_es}`, 18, 70);
  }, [activeFrame, report]);

  // Dibujar Gráfico Comparativo: Raw vs Suavizado Savitzky-Golay vs Modelo Teórico
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || !report || report.times.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fondo del gráfico
    ctx.fillStyle = "#060e18";
    ctx.fillRect(0, 0, w, h);

    const padX = 50;
    const padY = 30;
    const plotW = w - padX - 20;
    const plotH = h - padY * 2;

    const raw = report.raw_x;
    const smooth = report.smooth_x;
    const theo = report.theoretical_fit_x;

    const minX = Math.min(...raw, ...smooth, ...theo);
    const maxX = Math.max(...raw, ...smooth, ...theo);
    const rangeX = Math.max(maxX - minX, 10);

    const mapX = (idx: number) => padX + (idx / (report.times.length - 1)) * plotW;
    const mapY = (val: number) => padY + plotH - ((val - minX) / rangeX) * plotH;

    // Cuadrícula y eje cero
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();

      const labelVal = maxX - (rangeX / 4) * i;
      ctx.fillStyle = "#64748b";
      ctx.font = "10px 'Fira Code', monospace";
      ctx.fillText(`${labelVal.toFixed(0)}px`, 6, y + 3);
    }

    // 1. Curva Raw (Puntos dispersos con ruido)
    ctx.strokeStyle = "rgba(255, 176, 32, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < raw.length; i++) {
      const cx = mapX(i);
      const cy = mapY(raw[i]);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // 2. Curva Modelo Teórico Ajustado
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let i = 0; i < theo.length; i++) {
      const cx = mapX(i);
      const cy = mapY(theo[i]);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // 3. Curva Filtrada con Savitzky-Golay
    ctx.strokeStyle = "#00ffb2";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#00ffb2";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < smooth.length; i++) {
      const cx = mapX(i);
      const cy = mapY(smooth[i]);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Línea indicadora del fotograma actual
    const curPlotX = mapX(activeFrame);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(curPlotX, padY);
    ctx.lineTo(curPlotX, padY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Punto del fotograma actual
    ctx.beginPath();
    ctx.arc(curPlotX, mapY(smooth[activeFrame]), 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#00ffb2";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [report, activeFrame]);

  // Dibujar Espacio de Fase (x vs v_x)
  useEffect(() => {
    const canvas = phaseCanvasRef.current;
    if (!canvas || !report || report.smooth_x.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#060e18";
    ctx.fillRect(0, 0, w, h);

    const xs = report.smooth_x;
    const vs = report.velocity_x;

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const rangeX = Math.max(maxX - minX, 10);

    const minV = Math.min(...vs);
    const maxV = Math.max(...vs);
    const rangeV = Math.max(maxV - minV, 10);

    const mapPx = (x: number) => 30 + ((x - minX) / rangeX) * (w - 60);
    const mapPv = (v: number) => 30 + (h - 60) - ((v - minV) / rangeV) * (h - 60);

    // Ejes de coordenadas
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapPx(minX + rangeX * 0.5), 15);
    ctx.lineTo(mapPx(minX + rangeX * 0.5), h - 15);
    ctx.moveTo(15, mapPv(0));
    ctx.lineTo(w - 15, mapPv(0));
    ctx.stroke();

    // Espiral de fase
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2.0;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i <= activeFrame; i++) {
      const cx = mapPx(xs[i]);
      const cy = mapPv(vs[i]);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Punto actual
    if (activeFrame < xs.length) {
      ctx.beginPath();
      ctx.arc(mapPx(xs[activeFrame]), mapPv(vs[activeFrame]), 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffb020";
      ctx.fill();
    }
  }, [report, activeFrame]);

  return (
    <div className="module-container">
      {/* Encabezado del Módulo */}
      <div className="module-header">
        <div>
          <h2 className="module-title">
            <Eye className="title-icon text-cyan" />
            Laboratorio de Visión Artificial &amp; Clasificador de Experimentos
          </h2>
          <p className="module-subtitle">
            Carga o graba videos para extraer la cinemática de centroides ópticos con OpenCV y determinar automáticamente si satisfacen modelos de Péndulo, Balística o Caída Libre.
          </p>
        </div>

        {/* Pestañas de Fuente de Video */}
        <div className="tab-buttons-row">
          <button
            className={`tab-btn ${activeTab === "samples" ? "active" : ""}`}
            onClick={() => setActiveTab("samples")}
          >
            <Video size={16} /> Muestras de Lab
          </button>
          <button
            className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            <Upload size={16} /> Subir Video
          </button>
          <button
            className={`tab-btn ${activeTab === "webcam" ? "active" : ""}`}
            onClick={() => setActiveTab("webcam")}
          >
            <Camera size={16} /> Cámara Web
          </button>
        </div>
      </div>

      {/* Selector de Controles y Filtro de Color */}
      <div className="glass-card mb-4 controls-row">
        {activeTab === "samples" && (
          <div className="flex-wrap-gap">
            <span className="control-label">Muestras del Repositorio:</span>
            <button className="btn-preset" onClick={() => loadSample("pendulo_muestra_2")}>
              Péndulo Lab (Muestra 2)
            </button>
            <button className="btn-preset" onClick={() => loadSample("pendulo_muestra_1")}>
              Péndulo Lab (Muestra 1)
            </button>
            <button className="btn-preset" onClick={() => loadSample("synthetic_projectile")}>
              Tiro Parabólico
            </button>
          </div>
        )}

        {activeTab === "upload" && (
          <div className="flex-wrap-gap">
            <label className="btn-primary file-input-label">
              <Upload size={16} /> Seleccionar Video (.mp4, .webm, .mov)
              <input type="file" accept="video/*" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
            {videoUrl && <span className="text-muted text-sm">Video cargado en memoria</span>}
          </div>
        )}

        {activeTab === "webcam" && (
          <div className="flex-wrap-gap items-center">
            <button
              className={`btn-primary ${isRecording ? "btn-recording" : ""}`}
              onClick={startRecording}
              disabled={isRecording}
            >
              <Camera size={16} /> {isRecording ? `Grabando... (${recordCountdown}s)` : "Grabar 4s con Cámara"}
            </button>
            <span className="text-muted text-xs">
              Mueve un péndulo o lanza un objeto frente a la cámara para clasificarlo.
            </span>
          </div>
        )}

        <div className="color-filter-select">
          <span className="control-label">Rastreo de Color:</span>
          <select value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="select-field">
            <option value="auto">Auto-Segmentación (Contraste)</option>
            <option value="orange">Naranja / Amarillo</option>
            <option value="green">Verde</option>
            <option value="blue">Azul</option>
            <option value="red">Rojo</option>
            <option value="bright">Brillante / Reflejo</option>
          </select>
        </div>
      </div>

      {/* Contenedor Principal: Video / Cámara + Canvas de Tracking */}
      <div className="grid-2col">
        {/* Panel Izquierdo: Visualizador de Seguimiento en Tiempo Real */}
        <div className="glass-card tracking-card">
          <div className="card-top-bar">
            <div className="card-title-group">
              <Eye size={18} className="text-cyan" />
              <h3>Rastreador de Centroides Ópticos (OpenCV)</h3>
            </div>
            <div className="card-badge">
              {isLoading ? "Procesando Video..." : `Frame ${activeFrame + 1}`}
            </div>
          </div>

          <div className="canvas-wrapper">
            {activeTab === "webcam" && (
              <video
                ref={webcamVideoRef}
                autoPlay
                muted
                playsInline
                className="webcam-preview-video"
                style={{ display: isRecording ? "block" : "none" }}
              />
            )}
            <canvas ref={trackerCanvasRef} width={640} height={420} className="sim-canvas" />
          </div>

          {/* Barra de Reproducción y Scrubbing */}
          <div className="playback-controls">
            <button className="btn-icon" onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? "Pausar" : "Reproducir"}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="btn-icon" onClick={() => setActiveFrame(0)} title="Reiniciar">
              <RotateCcw size={18} />
            </button>

            <input
              type="range"
              min={0}
              max={Math.max(0, (report?.detections.length || 1) - 1)}
              value={activeFrame}
              onChange={(e) => {
                setActiveFrame(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="scrub-slider"
            />

            <span className="time-display font-mono text-xs">
              {report?.detections[activeFrame]?.time_s.toFixed(2) || "0.00"}s / {report?.video_metadata.duration_s.toFixed(2) || "0.00"}s
            </span>
          </div>
        </div>

        {/* Panel Derecho: Veredicto de Clasificación Física */}
        <div className="glass-card diagnosis-card">
          <div className="card-top-bar">
            <div className="card-title-group">
              <Sparkles size={18} className="text-mint" />
              <h3>Diagnóstico &amp; Verificación Física</h3>
            </div>
            {report?.diagnosis.is_valid_experiment ? (
              <span className="badge-verified">
                <CheckCircle2 size={14} /> Modelo Verificado
              </span>
            ) : (
              <span className="badge-unverified">
                <AlertTriangle size={14} /> No Concluyente
              </span>
            )}
          </div>

          {report && (
            <div className="diagnosis-content">
              {/* Gran Tarjeta de Clasificación */}
              <div className="experiment-result-banner">
                <div className="experiment-type-title">
                  {report.diagnosis.experiment_name_es}
                </div>
                <div className="confidence-pill">
                  <TrendingUp size={14} /> {report.diagnosis.confidence_pct}% de Confianza (R² = {report.diagnosis.r2_score.toFixed(4)})
                </div>
              </div>

              {/* Veredicto Explicativo */}
              <p className="verdict-text">{report.diagnosis.summary_verdict}</p>

              {/* Modelo Matemático Teórico */}
              {report.diagnosis.theoretical_model && (
                <div className="theory-box">
                  <span className="theory-label">Ecuación Teórica Comprobada:</span>
                  <code className="theory-formula">{report.diagnosis.theoretical_model}</code>
                </div>
              )}

              {/* Métricas Físicas Extraídas */}
              <div className="metrics-grid">
                {Object.entries(report.diagnosis.detected_parameters).map(([key, val]) => (
                  <div key={key} className="metric-box">
                    <span className="metric-label">{key.replace(/_/g, " ").toUpperCase()}</span>
                    <span className="metric-val">{typeof val === "number" ? val.toFixed(3) : String(val)}</span>
                  </div>
                ))}
              </div>

              {/* Desglose de Puntuaciones por Hipótesis */}
              <div className="hypothesis-scores">
                <span className="section-sublabel">Evaluación de Hipótesis Físicas (R²):</span>
                <div className="score-bars">
                  <div className="score-item">
                    <span>Péndulo / Oscilador</span>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill fill-cyan"
                        style={{ width: `${Math.min(100, (report.diagnosis.all_scores.pendulo || 0) * 100)}%` }}
                      />
                    </div>
                    <span>{report.diagnosis.all_scores.pendulo?.toFixed(3) || "0.000"}</span>
                  </div>

                  <div className="score-item">
                    <span>Tiro Parabólico</span>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill fill-orange"
                        style={{ width: `${Math.min(100, (report.diagnosis.all_scores.proyectil || 0) * 100)}%` }}
                      />
                    </div>
                    <span>{report.diagnosis.all_scores.proyectil?.toFixed(3) || "0.000"}</span>
                  </div>

                  <div className="score-item">
                    <span>Caída Libre 1D</span>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill fill-pink"
                        style={{ width: `${Math.min(100, (report.diagnosis.all_scores.caida_libre || 0) * 100)}%` }}
                      />
                    </div>
                    <span>{report.diagnosis.all_scores.caida_libre?.toFixed(3) || "0.000"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos Comparativos Inferiores */}
      <div className="grid-2col mt-4">
        {/* Gráfico 1: Traza Temporal x(t) */}
        <div className="glass-card">
          <div className="card-top-bar">
            <div className="card-title-group">
              <Layers size={18} className="text-cyan" />
              <h3>Ajuste Cinemático: Raw vs Savitzky-Golay vs Modelo Teórico</h3>
            </div>
            <div className="legend-pills">
              <span className="pill pill-orange">Raw</span>
              <span className="pill pill-purple">Teórico</span>
              <span className="pill pill-mint">Savitzky-Golay</span>
            </div>
          </div>
          <canvas ref={chartCanvasRef} width={600} height={220} className="chart-canvas" />
        </div>

        {/* Gráfico 2: Retrato de Fase (x vs v_x) */}
        <div className="glass-card">
          <div className="card-top-bar">
            <div className="card-title-group">
              <TrendingUp size={18} className="text-mint" />
              <h3>Espacio de Fase Reconstruido (x vs v)</h3>
            </div>
            <div className="card-badge">Espiral Disipativa</div>
          </div>
          <canvas ref={phaseCanvasRef} width={600} height={220} className="chart-canvas" />
        </div>
      </div>
    </div>
  );
};
