import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import type { ActiveTab } from "./components/Header";
import { PendulumModule } from "./components/PendulumModule";
import { ProjectileModule } from "./components/ProjectileModule";
import { OscillatorModule } from "./components/OscillatorModule";
import { VisionLabModule } from "./components/VisionLabModule";
import { checkBackendHealth } from "./api";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("pendulum");
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);

  useEffect(() => {
    checkBackendHealth().then(setIsBackendOnline);
    const interval = setInterval(() => {
      checkBackendHealth().then(setIsBackendOnline);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-layout">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isBackendOnline={isBackendOnline}
      />

      <main className="main-content">
        <div className="content-container">
          {activeTab === "pendulum" && <PendulumModule />}
          {activeTab === "projectile" && <ProjectileModule />}
          {activeTab === "oscillator" && <OscillatorModule />}
          {activeTab === "vision" && <VisionLabModule />}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-container">
          <p>
            <strong>PhysLab · Project Fénix</strong> · Modernización y Arquitectura Científica de Alto Rendimiento
          </p>
          <p className="footer-sub">
            Diseñado &amp; Construido por{" "}
            <a href="https://github.com/Dmgar" target="_blank" rel="noopener noreferrer">
              Dariem Garcia
            </a>{" "}
            · 2026
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
