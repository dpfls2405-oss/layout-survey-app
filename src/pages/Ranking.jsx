import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, AlertTriangle } from 'lucide-react'
import { getAllRecords, getAllItems } from '../db'
import { difficultyIndex, hourlyMoveLoad, transportScore, formatScore, itemKey } from '../utils/transportScore'

export default function Ranking() {
  const navigate = useNavigate()
  const [ranked, setRanked] = useState([])
  const [uncovered, setUncovered] = useState([])
  const [hasItems, setHasItems] = useState(false)

  useEffect(() => {
    Promise.all([getAllRecords(), getAllItems()]).then(([records, items]) => {
      // 품목별로 최신 조사 1건만 대표값으로 사용
      const latestByItem = new Map()
      for (const r of records) {
        const key = itemKey(r)
        const prev = latestByItem.get(key)
        if (!prev || new Date(r.createdAt) > new Date(prev.record.createdAt)) {
          latestByItem.set(key, { record: r, surveyCount: (prev?.surveyCount || 0) + 1 })
        } else {
          latestByItem.set(key, { ...prev, surveyCount: prev.surveyCount + 1 })
        }
      }

      const rows = [...latestByItem.entries()].map(([key, { record: r, surveyCount }]) => ({
        key,
        materialName: r.materialName || '(자재명 없음)',
        partNo: r.partNo,
        modelName: r.modelName,
        shopName: r.shopName,
        diffIndex: difficultyIndex(r),
        load: hourlyMoveLoad(r),
        score: transportScore(r),
        recordId: r.id,
        createdAt: r.createdAt,
        surveyCount,
      }))
      rows.sort((a, b) => {
        if (a.score === null) return 1
        if (b.score === null) return -1
        return b.score - a.score
      })
      setRanked(rows)

      const coveredKeys = new Set(records.map(r => itemKey(r)))
      const coveredIds = new Set(records.filter(r => r.itemId).map(r => r.itemId))
      const missing = items.filter(it =>
        !coveredIds.has(it.id) && !coveredKeys.has(`${it.materialName || ''}__${it.partNo || ''}`)
      )
      setUncovered(missing)
      setHasItems(items.length > 0)
    })
  }, [])

  const maxScore = ranked.length && ranked[0].score ? ranked[0].score : 0

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span style={s.topTitle}>운반강도 랭킹</span>
      </div>

      <div style={s.content} className="scrollable">
        <div style={s.legendCard}>
          <Trophy size={16} color="#f7954f" />
          <span>점수가 높을수록 <b>이동 부담이 큰 품목</b> — 레이아웃 재배치 우선순위로 검토하세요.</span>
        </div>

        {ranked.length === 0 ? (
          <div style={s.empty}>아직 조사 기록이 없습니다.</div>
        ) : (
          <div style={s.list}>
            {ranked.map((row, i) => (
              <div key={row.key} style={s.card} onClick={() => navigate(`/records/${row.recordId}`)}>
                <div style={s.rank}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.cardTitle}>{row.materialName}</div>
                  <div style={s.cardSub}>
                    {[row.shopName, row.modelName, row.partNo].filter(Boolean).join(' · ') || '-'}
                    {row.surveyCount > 1 && <span style={s.multiTag}>조사 {row.surveyCount}건 (최신 기준)</span>}
                  </div>
                  {row.score !== null && (
                    <div style={s.barTrack}>
                      <div style={{ ...s.barFill, width: `${maxScore ? (row.score / maxScore) * 100 : 0}%` }} />
                    </div>
                  )}
                </div>
                <div style={s.scoreBox}>
                  <div style={s.scoreValue}>{formatScore(row.score)}</div>
                  <div style={s.scoreUnit}>점</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasItems && (
          <>
            <div style={s.sectionHeader}>
              <AlertTriangle size={14} color="#f75f5f" />
              <span>미조사 품목 ({uncovered.length}건)</span>
            </div>
            {uncovered.length === 0 ? (
              <div style={s.empty}>품목 마스터의 모든 품목이 조사되었습니다.</div>
            ) : (
              <div style={s.list}>
                {uncovered.map(it => (
                  <div key={it.id} style={s.uncoveredCard}>
                    <span style={{ fontWeight: 600 }}>{it.materialName}</span>
                    <span style={s.cardSub}>{[it.partNo, it.modelName, it.shopName].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { height: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px', borderBottom: '1px solid #2e3347' },
  backBtn: { background: 'transparent', color: '#e8eaf0', padding: '6px', borderRadius: '8px', display: 'flex' },
  topTitle: { flex: 1, fontSize: '15px', fontWeight: '600' },
  content: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  legendCard: {
    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8b90a7',
    background: '#f7954f0a', border: '1px solid #f7954f30', borderRadius: '10px', padding: '10px 12px',
  },
  empty: { textAlign: 'center', color: '#5a6080', fontSize: '13px', padding: '24px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px', padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
  },
  rank: {
    width: '26px', height: '26px', borderRadius: '8px', background: '#22263a', color: '#8b90a7',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0,
  },
  cardTitle: { fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSub: { fontSize: '11px', color: '#8b90a7', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '6px' },
  multiTag: { color: '#4f8ef7', background: '#4f8ef715', padding: '1px 6px', borderRadius: '5px' },
  barTrack: { height: '4px', background: '#22263a', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' },
  barFill: { height: '100%', background: 'linear-gradient(90deg, #f7954f, #f75f5f)' },
  scoreBox: { textAlign: 'right', flexShrink: 0 },
  scoreValue: { fontSize: '18px', fontWeight: '700', color: '#f7954f' },
  scoreUnit: { fontSize: '10px', color: '#5a6080' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#8b90a7', marginTop: '8px' },
  uncoveredCard: {
    background: '#1a1d27', border: '1.5px solid #f75f5f20', borderRadius: '10px', padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
}
