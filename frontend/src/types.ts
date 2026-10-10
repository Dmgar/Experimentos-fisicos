export interface PendulumParams {
  length: number;
  gravity: number;
  mass: number;
  damping: number;
  theta0_deg: number;
  omega0: number;
  t_max: number;
  num_points: number;
}

export interface PendulumResult {
  params: PendulumParams;
  t: number[];
  theta: number[];
  theta_deg: number[];
  omega: number[];
  alpha: number[];
  x: number[];
  y: number[];
  kinetic_energy: number[];
  potential_energy: number[];
  total_energy: number[];
  period_theoretical_linear: number;
  period_nonlinear_approx: number;
  detected_period: number;
  decay_ratio: number;
}

export interface ProjectileParams {
  v0: number;
  angle_deg: number;
  y0: number;
  gravity: number;
  mass: number;
  drag_coeff: number;
  cross_area: number;
  air_density: number;
  wind_x: number;
  num_points: number;
}

export interface ProjectileResult {
  params: ProjectileParams;
  t_drag: number[];
  x_drag: number[];
  y_drag: number[];
  vx_drag: number[];
  vy_drag: number[];
  v_drag: number[];
  range_drag: number;
  max_height_drag: number;
  flight_time_drag: number;
  t_ideal: number[];
  x_ideal: number[];
  y_ideal: number[];
  range_ideal: number;
  max_height_ideal: number;
  flight_time_ideal: number;
  drag_loss_pct: number;
}

export interface OscillatorParams {
  mass: number;
  spring_k: number;
  damping_b: number;
  driving_force: number;
  driving_freq: number;
  x0: number;
  v0: number;
  t_max: number;
  num_points: number;
}

export interface OscillatorResult {
  params: OscillatorParams;
  t: number[];
  x: number[];
  v: number[];
  a: number[];
  kinetic_energy: number[];
  potential_energy: number[];
  total_energy: number[];
  omega_natural: number;
  damping_ratio: number;
  regime: "underdamped" | "critically_damped" | "overdamped";
  regime_label: string;
  damped_frequency: number;
  resonance_curve: { freq: number; amplitude: number }[];
  fft_freqs: number[];
  fft_amplitudes: number[];
}

export interface TrackingPoint {
  frame_idx: number;
  t: number;
  cx_px: number;
  cy_px: number;
  x_m: number;
  y_m: number;
  radius_px: number;
}

export interface TrackingDemoResponse {
  tracking: {
    total_frames: number;
    detected_frames: number;
    detection_rate_pct: number;
    fps: number;
    duration_s: number;
    points: TrackingPoint[];
    calibration_ppm: number;
  };
  analysis: {
    estimated_period: number;
    estimated_frequency_hz: number;
    damping_ratio_b: number;
    r2_score: number;
    smooth_x: number[];
    velocity_v: number[];
    peaks_indices: number[];
    peaks_times: number[];
  };
}
