export const CARDS = ['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕']

export const PEER_PREFIX = 'scrum-poker-v1-'

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createRoomCode(length = 4) {
  let code = ''
  const chars = ROOM_CODE_CHARS
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function numericVotes(votes) {
  return votes
    .map((v) => {
      if (v === '½') return 0.5
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    })
    .filter((n) => n !== null)
}

export function averageLabel(votes) {
  const nums = numericVotes(votes)
  if (!nums.length) return '—'
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1)
}
