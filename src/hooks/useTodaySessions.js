import { useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useSessionStore } from '../store/sessionStore'
import { getSessionsForDate, createSession } from '../api/sessionsService'
import { getAllGroups } from '../api/groupsService'
import { getMovementsForSession } from '../api/movementsService'
import { getUpdatesForSession } from '../api/fieldUpdatesService'

const GROUPS = [
  'Annex Farm',
  'Main Farm',
  'Horsefield',
  'Paddock - Mothers',
  'Paddock - Kids',
  'Paddock - Males',
  'Sick/Vulnerable Flock',
]

// Accept an optional date string (yyyy-MM-dd). Defaults to today.
// Using a string prevents new Date() from creating a new object on every render
// and causing an infinite re-render loop.
export function useTodaySessions(dateStr = format(new Date(), 'yyyy-MM-dd')) {
  const { setSessions, setGroups, setMovementsForSession, setFieldUpdatesForSession, setLoading, setError } =
    useSessionStore()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const date = new Date(dateStr)
      const [groupRecords, existingSessions] = await Promise.all([
        getAllGroups(),
        getSessionsForDate(date),
      ])
      setGroups(groupRecords)

      let sessions = existingSessions

      // Auto-create sessions for any missing groups
      if (sessions.length < GROUPS.length) {
        const existingGroupIds = new Set(
          sessions.flatMap((s) => s.fields['Group'] || [])
        )
        const missingGroups = groupRecords.filter((g) => !existingGroupIds.has(g.id))

        const created = await Promise.all(
          missingGroups.map((g) =>
            createSession({
              Date: dateStr,
              Group: [g.id],
              'Session ID': `DAR-${dateStr.replace(/-/g, '')}-${g.fields['Group Name']?.slice(0, 3).toUpperCase()}`,
              Status: 'Open',
            })
          )
        )
        sessions = [...sessions, ...created]
      }

      setSessions(sessions)

      // Load movements and field updates for each session in parallel
      await Promise.all(
        sessions.map(async (sess) => {
          const [moves, updates] = await Promise.all([
            getMovementsForSession(sess.id),
            getUpdatesForSession(sess.id),
          ])
          setMovementsForSession(sess.id, moves)
          setFieldUpdatesForSession(sess.id, updates)
        })
      )
    } catch (err) {
      setError(err.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [dateStr]) // stable string dep — no infinite loop

  useEffect(() => {
    load()
  }, [load])

  return { reload: load }
}
