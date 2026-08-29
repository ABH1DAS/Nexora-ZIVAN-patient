import {
  AUTO_SOS_STORAGE_KEY,
  BAND_STORAGE_KEY,
  DEFAULT_AUTO_SOS,
  FITNESS_BAND_OPTIONS,
  VITALS_STORAGE_KEY,
  WATER_STORAGE_KEY,
  type AutoEmergencySettings,
  type FitnessBand,
  type LiveVitals,
  type WaterEntry,
} from "@/data/devices";
import { todayMetrics } from "@/data/healthData";
import {
  fetchWaterLogs,
  logWaterIntake,
  updateConnectedDevice,
  saveDailyMetrics,
  isSupabaseConfigured,
} from "@/lib/supabase";

export type EmergencyTriggerReason =
  | "HIGH_HEART_RATE"
  | "LOW_SPO2"
  | "FALL_DETECTED"
  | "MANUAL_SOS";

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T, eventName: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
}

// ─── Hydration / Water ──────────────────────────────────────────────────────────
export function getWaterEntries(): WaterEntry[] {
  return readJson<WaterEntry[]>(WATER_STORAGE_KEY, []).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function getWaterTotalMl() {
  return getWaterEntries().reduce((sum, entry) => sum + entry.amountMl, 0);
}

export function getWaterTotalLiters() {
  return Math.round((getWaterTotalMl() / 1000) * 10) / 10;
}

export function addWaterEntry(amountMl: number, note?: string): WaterEntry {
  const entry: WaterEntry = {
    id: `water_${Date.now()}`,
    amountMl,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
  };
  const next = [entry, ...getWaterEntries()];
  writeJson(WATER_STORAGE_KEY, next, "zivan-water-updated");

  // Sync to Supabase
  if (isSupabaseConfigured) {
    logWaterIntake("demo-user", amountMl, note);
  }

  return entry;
}

export function removeWaterEntry(id: string) {
  const next = getWaterEntries().filter((entry) => entry.id !== id);
  writeJson(WATER_STORAGE_KEY, next, "zivan-water-updated");
}

export function subscribeWater(listener: (entries: WaterEntry[]) => void) {
  if (isSupabaseConfigured) {
    fetchWaterLogs("demo-user").then((remote) => {
      if (remote && remote.length > 0) {
        const mapped: WaterEntry[] = remote.map((w) => ({
          id: w.id || `water_${Date.now()}`,
          amountMl: w.amount_ml,
          note: w.note,
          at: w.logged_at,
        }));
        writeJson(WATER_STORAGE_KEY, mapped, "zivan-water-updated");
        listener(mapped);
      }
    });
  }

  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getWaterEntries());
  const onStorage = (event: StorageEvent) => {
    if (event.key === WATER_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-water-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-water-updated", onCustom);
  };
}

// ─── Fitness Band ─────────────────────────────────────────────────────────────
export function getFitnessBand(): FitnessBand | null {
  return readJson<FitnessBand | null>(BAND_STORAGE_KEY, null);
}

export function connectFitnessBand(optionId: string): FitnessBand {
  const option =
    FITNESS_BAND_OPTIONS.find((item) => item.id === optionId) ??
    FITNESS_BAND_OPTIONS[0];
  const band: FitnessBand = {
    id: option.id,
    name: option.name,
    brand: option.brand,
    model: option.model,
    connected: true,
    batteryPercent: 86,
    lastSyncAt: new Date().toISOString(),
    monitoring: {
      heartRate: true,
      spo2: true,
      steps: true,
      sleep: true,
    },
  };
  writeJson(BAND_STORAGE_KEY, band, "zivan-band-updated");
  updateLiveVitals({
    source: "band",
  });

  // Sync to Supabase
  if (isSupabaseConfigured) {
    updateConnectedDevice({
      id: band.id,
      patient_id: "demo-user",
      name: band.name,
      brand: band.brand,
      model: band.model,
      connected: true,
      battery_percent: band.batteryPercent,
    });
  }

  return band;
}

export function disconnectFitnessBand() {
  if (!canUseStorage()) return;
  const current = getFitnessBand();
  if (current && isSupabaseConfigured) {
    updateConnectedDevice({
      id: current.id,
      patient_id: "demo-user",
      name: current.name,
      brand: current.brand,
      model: current.model,
      connected: false,
      battery_percent: current.batteryPercent,
    });
  }
  localStorage.removeItem(BAND_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("zivan-band-updated", { detail: null }));
}

export function subscribeFitnessBand(listener: (band: FitnessBand | null) => void) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getFitnessBand());
  const onStorage = (event: StorageEvent) => {
    if (event.key === BAND_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-band-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-band-updated", onCustom);
  };
}

export const subscribeBand = subscribeFitnessBand;

// ─── Live Vitals ──────────────────────────────────────────────────────────────
export function getLiveVitals(): LiveVitals {
  const fallback: LiveVitals = {
    heartRate: todayMetrics.heartRate,
    spo2: todayMetrics.spo2,
    steps: todayMetrics.steps,
    source: "demo",
    updatedAt: new Date().toISOString(),
  };
  return readJson<LiveVitals>(VITALS_STORAGE_KEY, fallback);
}

export function setLiveVitals(vitals: LiveVitals) {
  writeJson(VITALS_STORAGE_KEY, vitals, "zivan-vitals-updated");

  // Sync to Supabase
  if (isSupabaseConfigured) {
    saveDailyMetrics({
      patient_id: "demo-user",
      heart_rate: vitals.heartRate,
      spo2: vitals.spo2,
      steps: vitals.steps,
    });
  }
}

export function updateLiveVitals(patch: Partial<LiveVitals>) {
  const current = getLiveVitals();
  const updated: LiveVitals = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  setLiveVitals(updated);
}

export function subscribeVitals(listener: (vitals: LiveVitals) => void) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getLiveVitals());
  const onStorage = (event: StorageEvent) => {
    if (event.key === VITALS_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-vitals-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-vitals-updated", onCustom);
  };
}

// ─── Auto Emergency Settings & Triggers ─────────────────────────────────────────
export function getAutoEmergencySettings(): AutoEmergencySettings {
  return readJson<AutoEmergencySettings>(AUTO_SOS_STORAGE_KEY, DEFAULT_AUTO_SOS);
}

export function saveAutoEmergencySettings(settings: AutoEmergencySettings) {
  writeJson(AUTO_SOS_STORAGE_KEY, settings, "zivan-auto-sos-updated");
}

export function subscribeAutoEmergency(
  listener: (settings: AutoEmergencySettings) => void,
) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getAutoEmergencySettings());
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTO_SOS_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-auto-sos-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-auto-sos-updated", onCustom);
  };
}

export const subscribeAutoEmergencySettings = subscribeAutoEmergency;

export function evaluateEmergencyTriggers(
  vitals: LiveVitals,
  settings: AutoEmergencySettings,
  _band?: FitnessBand | null
): EmergencyTriggerReason | null {
  if (!settings.enabled) return null;

  if (vitals.heartRate <= settings.heartRateLowBpm || vitals.heartRate >= 140) {
    return "HIGH_HEART_RATE";
  }
  if (vitals.spo2 <= settings.spo2LowPercent) {
    return "LOW_SPO2";
  }
  return null;
}

export function triggerReasonLabel(reason: EmergencyTriggerReason): string {
  switch (reason) {
    case "HIGH_HEART_RATE":
      return "Tachycardia Alert (High Heart Rate Detected)";
    case "LOW_SPO2":
      return "Hypoxia Alert (Critical SpO2 Level Detected)";
    case "FALL_DETECTED":
      return "High-Impact Fall Detected by Smart Sensor";
    case "MANUAL_SOS":
      return "Manual 1-Tap Emergency SOS Triggered";
    default:
      return "Medical Emergency Detected";
  }
}
