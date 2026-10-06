import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import db from './db';
export const preferenceStorage: StateStorage = {
  async getItem(name) {
    const row = await db.preferences.get(name);
    if (row) return row.value;
    const legacy = localStorage.getItem(name);
    if (legacy) await db.preferences.put({ id: name, value: legacy });
    return legacy;
  },
  async setItem(name, value) { await db.preferences.put({ id: name, value }); },
  async removeItem(name) { await db.preferences.delete(name); localStorage.removeItem(name); },
};
export const durableStorage = createJSONStorage(() => preferenceStorage);
