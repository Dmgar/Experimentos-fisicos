import React from "react";
import { Atom, Flame, Orbit, Crosshair, Waves, Eye } from "lucide-react";

export type ActiveTab = "pendulum" | "projectile" | "oscillator" | "vision";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isBackendOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, isBackendOnline }) => {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand-group">
          <div className="brand-logo">
            <Atom className="logo-icon" />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">PhysLab</h1>
              <span className="fenix-pill">
                <Flame className="fenix-flame-icon" size={13} /> Project Fénix
              </span>
            </div>
            <p className="brand-sub">Simulación Computacional &amp; Percepción Experimental</p>
          </div>
        </div>

        <nav className="module-nav" role="tablist">
          <button
            className={`nav-tab-btn ${activeTab === "pendulum" ? "active" : ""}`}
            onClick={() => onTabChange("pendulum")}
            role="tab"
            aria-selected={activeTab === "pendulum"}
          >
            <Orbit size={16} />
            <span>Péndulo No Lineal</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "projectile" ? "active" : ""}`}
            onClick={() => onTabChange("projectile")}
            role="tab"
            aria-selected={activeTab === "projectile"}
          >
            <Crosshair size={16} />
            <span>Tiro &amp; Balística</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "oscillator" ? "active" : ""}`}
            onClick={() => onTabChange("oscillator")}
            role="tab"
            aria-selected={activeTab === "oscillator"}
          >
            <Waves size={16} />
            <span>Oscilador Armónico</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "vision" ? "active" : ""}`}
            onClick={() => onTabChange("vision")}
            role="tab"
            aria-selected={activeTab === "vision"}
          >
            <Eye size={16} />
            <span>Visión &amp; Tracking</span>
          </button>
        </nav>

        <div className="header-actions">
          <div className={`status-pill ${isBackendOnline ? "status-online" : "status-local"}`} title={isBackendOnline ? "API FastAPI conectada" : "Motor físico local en navegador activo"}>
            <span className="status-dot"></span>
            <span className="status-label">{isBackendOnline ? "FastAPI Online" : "Motor JS Activo"}</span>
          </div>

          <a
            href="https://github.com/Dmgar/Experimentos-fisicos"
            target="_blank"
            rel="noopener noreferrer"
            className="github-btn"
            aria-label="Ver repositorio en GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
              <path d="M9 18c-4.51 2-5-2-7-2"></path>
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
