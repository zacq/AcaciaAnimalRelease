import { create } from 'zustand'

let nextId = 1

export const useAlertStore = create((set) => ({
  bannerAlerts: [],

  addAlert: (message, colour = 'red') =>
    set((s) => ({
      bannerAlerts: [...s.bannerAlerts, { id: nextId++, message, colour }],
    })),

  dismissBannerAlert: (id) =>
    set((s) => ({
      bannerAlerts: s.bannerAlerts.filter((a) => a.id !== id),
    })),

  clearAlerts: () => set({ bannerAlerts: [] }),
}))
