import { create } from 'zustand'

export const useSessionStore = create((set, get) => ({
  sessions: [],        // today's Daily Session records (one per group)
  groups: [],          // Groups table records
  movements: {},       // { [sessionId]: movement[] }
  fieldUpdates: {},    // { [sessionId]: update[] }
  selectedDate: new Date(),
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  setGroups: (groups) => set({ groups }),
  setMovementsForSession: (sessionId, movements) =>
    set((s) => ({ movements: { ...s.movements, [sessionId]: movements } })),
  setFieldUpdatesForSession: (sessionId, updates) =>
    set((s) => ({ fieldUpdates: { ...s.fieldUpdates, [sessionId]: updates } })),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateSessionLocally: (sessionId, fields) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, fields: { ...sess.fields, ...fields } } : sess
      ),
    })),

  addMovementLocally: (sessionId, movement) =>
    set((s) => {
      const existing = s.movements[sessionId] || []
      return { movements: { ...s.movements, [sessionId]: [...existing, movement] } }
    }),

  removeMovementLocally: (sessionId, movementId) =>
    set((s) => ({
      movements: {
        ...s.movements,
        [sessionId]: (s.movements[sessionId] || []).filter((m) => m.id !== movementId),
      },
    })),
}))
