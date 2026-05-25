/**
 * Count integrity rules (PRD §9).
 * Pure functions — no side-effects, easy to unit-test.
 */

export function computeMovementImpact(reason) {
  switch (reason) {
    case 'Death':
    case 'Sale':
      return { sourceImpact: -1, destImpact: 0 }
    case 'Birth':
      return { sourceImpact: 0, destImpact: 1 }
    case 'Transfer':
      return { sourceImpact: -1, destImpact: 1 }
    case 'Vet Referral':
    case 'Other':
    default:
      return { sourceImpact: 0, destImpact: 0 }
  }
}

export function computeSessionTotals(session, movements) {
  const amCount = session.fields['AM Count'] ?? 0
  let movedOut = 0
  let movedIn = 0

  for (const m of movements) {
    const impact = computeMovementImpact(m.fields['Reason'])
    if (impact.sourceImpact === -1) movedOut++
    if (impact.destImpact === 1) movedIn++
  }

  const expectedPM = amCount - movedOut + movedIn
  return { amCount, movedOut, movedIn, expectedPM }
}

export function validatePMCount(session, movements) {
  const pmCount = session.fields['PM Count']
  if (pmCount == null) return null
  const { expectedPM } = computeSessionTotals(session, movements)
  const variance = pmCount - (session.fields['AM Count'] ?? 0)
  const discrepancy = pmCount !== expectedPM
  return { variance, discrepancy, expectedPM }
}

export function computeFarmTotals(sessions, movementsMap, groups = []) {
  return sessions.map((sess) => {
    const moves = movementsMap[sess.id] || []
    const { amCount, movedOut, movedIn, expectedPM } = computeSessionTotals(sess, moves)
    const pmCount = sess.fields['PM Count'] ?? null
    const variance = pmCount != null ? pmCount - amCount : null
    const ok = pmCount == null ? null : pmCount >= amCount
    const groupRecord = groups.find((g) => g.id === sess.fields['Group']?.[0])
    return {
      sessionId: sess.id,
      groupName: groupRecord?.fields['Group Name'] || sess.fields['Group Name'] || '',
      amCount,
      movedOut,
      movedIn,
      pmCount,
      expectedPM,
      variance,
      ok,
    }
  })
}

export function farmGrandTotal(rows) {
  return {
    amCount: rows.reduce((s, r) => s + r.amCount, 0),
    movedOut: rows.reduce((s, r) => s + r.movedOut, 0),
    movedIn: rows.reduce((s, r) => s + r.movedIn, 0),
    pmCount: rows.every((r) => r.pmCount != null)
      ? rows.reduce((s, r) => s + (r.pmCount || 0), 0)
      : null,
  }
}
