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
  getActiveUserId,
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
export function getWaterEntries(userId = getActiveUserId()): WaterEntry[] {
  const key = `${WATER_STORAGE_KEY}_${userId}`;
  const userEntries = readJson<WaterEntry[]>(key, []);
  if (userEntries.length > 0) {
    return userEntries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }
  return readJson<WaterEntry[]>(WATER_STORAGE_KEY, []).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function getWaterTotalMl(userId = getActiveUserId()) {
  return getWaterEntries(userId).reduce((sum, entry) => sum + entry.amountMl, 0);
}

export function getWaterTotalLiters(userId = getActiveUserId()) {
  return Math.round((getWaterTotalMl(userId) / 1000) * 10) / 10;
}

export function addWaterEntry(amountMl: number, note?: string, userId = getActiveUserId()): WaterEntry {
  const entry: WaterEntry = {
    id: `water_${Date.now()}`,
    amountMl,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
  };
  const next = [entry, ...getWaterEntries(userId)];
  writeJson(`${WATER_STORAGE_KEY}_${userId}`, next, "zivan-water-updated");
  writeJson(WATER_STORAGE_KEY, next, "zivan-water-updated");

  // Sync to Supabase for active user
  if (isSupabaseConfigured) {
    logWaterIntake(userId, amountMl, note);
  }

  return entry;
}

export function removeWaterEntry(id: string, userId = getActiveUserId()) {
  const next = getWaterEntries(userId).filter((entry) => entry.id !== id);
  writeJson(`${WATER_STORAGE_KEY}_${userId}`, next, "zivan-water-updated");
  writeJson(WATER_STORAGE_KEY, next, "zivan-water-updated");
}

export function subscribeWater(listener: (entries: WaterEntry[]) => void, userId = getActiveUserId()) {
  if (isSupabaseConfigured) {
    fetchWaterLogs(userId).then((remote) => {
      if (remote && remote.length > 0) {
        const mapped: WaterEntry[] = remote.map((w) => ({
          id: w.id || `water_${Date.now()}`,
          amountMl: w.amount_ml,
          note: w.note,
          at: w.logged_at,
        }));
        writeJson(`${WATER_STORAGE_KEY}_${userId}`, mapped, "zivan-water-updated");
        writeJson(WATER_STORAGE_KEY, mapped, "zivan-water-updated");
        listener(mapped);
      }
    });
  }

  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getWaterEntries(userId));
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${WATER_STORAGE_KEY}_${userId}` || event.key === WATER_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-water-updated", onCustom);
  window.addEventListener("zivan-auth-user-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-water-updated", onCustom);
    window.removeEventListener("zivan-auth-user-updated", onCustom);
  };
}

// ─── Fitness Band ─────────────────────────────────────────────────────────────
export function getFitnessBand(userId = getActiveUserId()): FitnessBand | null {
  const userBand = readJson<FitnessBand | null>(`${BAND_STORAGE_KEY}_${userId}`, null);
  if (userBand) return userBand;
  return readJson<FitnessBand | null>(BAND_STORAGE_KEY, null);
}

export function connectFitnessBand(optionId: string, userId = getActiveUserId()): FitnessBand {
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
  writeJson(`${BAND_STORAGE_KEY}_${userId}`, band, "zivan-band-updated");
  writeJson(BAND_STORAGE_KEY, band, "zivan-band-updated");
  updateLiveVitals({
    source: "band",
  }, userId);

  // Sync to Supabase for active user
  if (isSupabaseConfigured) {
    updateConnectedDevice({
      id: band.id,
      patient_id: userId,
      name: band.name,
      brand: band.brand,
      model: band.model,
      connected: true,
      battery_percent: band.batteryPercent,
    });
  }

  return band;
}

export function disconnectFitnessBand(userId = getActiveUserId()) {
  if (!canUseStorage()) return;
  const current = getFitnessBand(userId);
  if (current && isSupabaseConfigured) {
    updateConnectedDevice({
      id: current.id,
      patient_id: userId,
      name: current.name,
      brand: current.brand,
      model: current.model,
      connected: false,
      battery_percent: current.batteryPercent,
    });
  }
  localStorage.removeItem(`${BAND_STORAGE_KEY}_${userId}`);
  localStorage.removeItem(BAND_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("zivan-band-updated", { detail: null }));
}

export function subscribeFitnessBand(listener: (band: FitnessBand | null) => void, userId = getActiveUserId()) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getFitnessBand(userId));
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${BAND_STORAGE_KEY}_${userId}` || event.key === BAND_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-band-updated", onCustom);
  window.addEventListener("zivan-auth-user-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-band-updated", onCustom);
    window.removeEventListener("zivan-auth-user-updated", onCustom);
  };
}

export const subscribeBand = subscribeFitnessBand;

// ─── Live Vitals ──────────────────────────────────────────────────────────────
export function getLiveVitals(userId = getActiveUserId()): LiveVitals {
  const fallback: LiveVitals = {
    heartRate: todayMetrics.heartRate,
    spo2: todayMetrics.spo2,
    steps: todayMetrics.steps,
    source: "demo",
    updatedAt: new Date().toISOString(),
  };
  const userVitals = readJson<LiveVitals>(`${VITALS_STORAGE_KEY}_${userId}`, fallback);
  if (userVitals && userVitals.heartRate) return userVitals;
  return readJson<LiveVitals>(VITALS_STORAGE_KEY, fallback);
}

export function setLiveVitals(vitals: LiveVitals, userId = getActiveUserId()) {
  writeJson(`${VITALS_STORAGE_KEY}_${userId}`, vitals, "zivan-vitals-updated");
  writeJson(VITALS_STORAGE_KEY, vitals, "zivan-vitals-updated");

  // Sync to Supabase for active user
  if (isSupabaseConfigured) {
    saveDailyMetrics({
      patient_id: userId,
      heart_rate: vitals.heartRate,
      spo2: vitals.spo2,
      steps: vitals.steps,
    });
  }
}

export function updateLiveVitals(patch: Partial<LiveVitals>, userId = getActiveUserId()) {
  const current = getLiveVitals(userId);
  const updated: LiveVitals = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  setLiveVitals(updated, userId);
}

export function subscribeVitals(listener: (vitals: LiveVitals) => void, userId = getActiveUserId()) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getLiveVitals(userId));
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${VITALS_STORAGE_KEY}_${userId}` || event.key === VITALS_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-vitals-updated", onCustom);
  window.addEventListener("zivan-auth-user-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-vitals-updated", onCustom);
    window.removeEventListener("zivan-auth-user-updated", onCustom);
  };
}

// ─── Auto Emergency Settings & Triggers ─────────────────────────────────────────
export function getAutoEmergencySettings(userId = getActiveUserId()): AutoEmergencySettings {
  const userSettings = readJson<AutoEmergencySettings>(`${AUTO_SOS_STORAGE_KEY}_${userId}`, DEFAULT_AUTO_SOS);
  if (userSettings && userSettings.heartRateLowBpm) return userSettings;
  return readJson<AutoEmergencySettings>(AUTO_SOS_STORAGE_KEY, DEFAULT_AUTO_SOS);
}

export function saveAutoEmergencySettings(settings: AutoEmergencySettings, userId = getActiveUserId()) {
  writeJson(`${AUTO_SOS_STORAGE_KEY}_${userId}`, settings, "zivan-auto-sos-updated");
  writeJson(AUTO_SOS_STORAGE_KEY, settings, "zivan-auto-sos-updated");
}

export function subscribeAutoEmergency(
  listener: (settings: AutoEmergencySettings) => void,
  userId = getActiveUserId()
) {
  if (!canUseStorage()) return () => undefined;
  const emit = () => listener(getAutoEmergencySettings(userId));
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${AUTO_SOS_STORAGE_KEY}_${userId}` || event.key === AUTO_SOS_STORAGE_KEY) emit();
  };
  const onCustom = () => emit();
  window.addEventListener("storage", onStorage);
  window.addEventListener("zivan-auto-sos-updated", onCustom);
  window.addEventListener("zivan-auth-user-updated", onCustom);
  emit();
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("zivan-auto-sos-updated", onCustom);
    window.removeEventListener("zivan-auth-user-updated", onCustom);
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
