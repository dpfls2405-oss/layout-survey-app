// 운반강도 점수 계산 유틸
// - 운반난이도 지수: 중량 × (1 + (주의 + 형상 + 용적) ÷ 100)
// - 시간당 이동부하: Σ(구간별 이동거리 × 구간별 이동횟수) ÷ 근무시간
// - 종합 운반강도: 운반난이도 지수 × 시간당 이동부하

export const WORK_HOURS_PER_DAY = 8 // 1교대 표준 근무시간(시간/일) 기준

export function difficultyIndex(record) {
  const weight = parseFloat(record.weight) || 0
  const caution = parseFloat(record.caution) || 0
  const shape = parseFloat(record.shape) || 0
  const volume = parseFloat(record.volume) || 0
  if (weight <= 0) return null
  return weight * (1 + (caution + shape + volume) / 100)
}

export function dailyMoveLoad(record) {
  const moves = record.moves || []
  return moves.reduce((sum, m) => {
    const distance = parseFloat(m.distance) || 0
    const freq = parseFloat(m.freq) || 0
    return sum + distance * freq
  }, 0)
}

export function hourlyMoveLoad(record, hoursPerDay = WORK_HOURS_PER_DAY) {
  return dailyMoveLoad(record) / hoursPerDay
}

// 종합 운반강도 = 운반난이도 지수 × 시간당 이동부하
export function transportScore(record) {
  const diff = difficultyIndex(record)
  const load = hourlyMoveLoad(record)
  if (diff === null || load <= 0) return null
  return diff * load
}

export function formatScore(n) {
  if (n === null || n === undefined) return '-'
  if (n >= 1000) return n.toFixed(0)
  return n.toFixed(1)
}

// 품목 식별 키: 마스터 품목에 연결돼 있으면 itemId, 아니면 자재명+PartNo 조합
export function itemKey(record) {
  if (record.itemId) return `item-${record.itemId}`
  return `${record.materialName || ''}__${record.partNo || ''}`
}
