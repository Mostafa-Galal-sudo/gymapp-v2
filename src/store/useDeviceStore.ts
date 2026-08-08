import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HRZone {
  name: string;
  min: number;
  max: number;
  color: string;
  minutes: number;
}

export interface DeviceSession {
  id: string;
  date: number; // timestamp
  deviceName: string;
  duration: number; // seconds
  avgHR: number;
  maxHR: number;
  minHR: number;
  hrData: { time: number; hr: number }[]; // time in seconds from start
  zones: HRZone[];
}

interface DeviceState {
  isConnected: boolean;
  deviceName: string | null;
  currentHR: number | null;
  sessionActive: boolean;
  sessionStart: number | null;
  liveHRData: { time: number; hr: number }[];
  sessions: DeviceSession[];

  setConnected: (deviceName: string) => void;
  setDisconnected: () => void;
  setCurrentHR: (hr: number) => void;
  startSession: () => void;
  endSession: () => DeviceSession | null;
  clearSessions: () => void;
  importData: (data: any) => void;
}

export const HR_ZONES: Omit<HRZone, 'minutes'>[] = [
  { name: 'Rest',     min: 0,   max: 100, color: '#60a5fa' },
  { name: 'Fat Burn', min: 100, max: 130, color: '#34d399' },
  { name: 'Cardio',   min: 130, max: 160, color: '#fbbf24' },
  { name: 'Peak',     min: 160, max: 999, color: '#f87171' },
];

const calculateZones = (hrData: { time: number; hr: number }[]): HRZone[] => {
  const zones = HR_ZONES.map(z => ({ ...z, minutes: 0 }));
  if (hrData.length < 2) return zones;

  for (let i = 1; i < hrData.length; i++) {
    const hr = hrData[i].hr;
    const dt = (hrData[i].time - hrData[i - 1].time) / 60; // minutes
    const zone = zones.find(z => hr >= z.min && hr < z.max);
    if (zone) zone.minutes += dt;
  }

  return zones.map(z => ({ ...z, minutes: Math.round(z.minutes * 10) / 10 }));
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      deviceName: null,
      currentHR: null,
      sessionActive: false,
      sessionStart: null,
      liveHRData: [],
      sessions: [],

      setConnected: (deviceName) => set({ isConnected: true, deviceName }),

      setDisconnected: () => set({
        isConnected: false,
        deviceName: null,
        currentHR: null,
        sessionActive: false,
        sessionStart: null,
        liveHRData: [],
      }),

      setCurrentHR: (hr) => set((state) => {
        const now = Date.now();
        const newPoint = state.sessionActive && state.sessionStart
          ? { time: Math.floor((now - state.sessionStart) / 1000), hr }
          : null;
        return {
          currentHR: hr,
          liveHRData: newPoint ? [...state.liveHRData, newPoint] : state.liveHRData,
        };
      }),

      startSession: () => set({ sessionActive: true, sessionStart: Date.now(), liveHRData: [] }),

      endSession: () => {
        const state = get();
        if (!state.sessionActive || !state.sessionStart) return null;

        const hrData = state.liveHRData;
        const hrs = hrData.map(d => d.hr);
        const avgHR = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
        const maxHR = hrs.length ? Math.max(...hrs) : 0;
        const minHR = hrs.length ? Math.min(...hrs) : 0;
        const duration = Math.floor((Date.now() - state.sessionStart) / 1000);
        const zones = calculateZones(hrData);

        const session: DeviceSession = {
          id: Math.random().toString(36).substring(2, 9),
          date: state.sessionStart,
          deviceName: state.deviceName || 'Unknown',
          duration,
          avgHR,
          maxHR,
          minHR,
          hrData,
          zones,
        };

        set((s) => ({
          sessions: [...s.sessions, session],
          sessionActive: false,
          sessionStart: null,
          liveHRData: [],
        }));

        return session;
      },

      clearSessions: () => set({ sessions: [] }),

      importData: (data) => set({ sessions: data.sessions || [] }),
    }),
    { name: 'omnibody-device-storage' }
  )
);
