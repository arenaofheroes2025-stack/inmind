export type RollResult = {
  total: number
  raw: number
  outcome: 'critical-fail' | 'fail' | 'partial' | 'success' | 'critical'
  characterName?: string
}

export function rollD20(modifier = 0, difficulty = 12): RollResult {
  const raw = Math.floor(Math.random() * 20) + 1
  const total = raw + modifier

  // Natural 1 is always critical fail, natural 20 is always critical success
  let outcome: RollResult['outcome']
  if (raw === 1) {
    outcome = 'critical-fail'
  } else if (raw === 20) {
    outcome = 'critical'
  } else {
    const diff = total - difficulty
    if (diff < -5) outcome = 'critical-fail'
    else if (diff < 0) outcome = 'fail'
    else if (diff === 0 || diff === 1) outcome = 'partial'
    else if (diff < 8) outcome = 'success'
    else outcome = 'critical'
  }

  return { total, raw, outcome }
}
