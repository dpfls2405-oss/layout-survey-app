import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, ChevronRight, MapPin } from 'lucide-react'
import { getAllRecords, deleteRecord, exportAllData } from '../db'
import { transportScore, formatScore } from '../utils/transportScore'

export default function RecordsList() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])

  const load = () => getAllRecords().then(r => setRecords(r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
  useEffect(() => { load() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('이 조사를 삭제할까요?')) return
    await deleteRecord(id)
    load()
  }

  const handleExport = async () => {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `layout-survey-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = iso => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span style={styles.topTitle}>조사 기록</span>
        <button style={styles.exportBtn} onClick={handleExport} title="JSON 내보내기">
          <Download size={18} />
        </button>
      </div>

      {records.length === 0 ? (
        <div style={styles.empty}>
          <MapPin size={40} color="#3a3f55" />
          <p style={{ color: '#5a6080', marginTop: '12px', fontSize: '14px' }}>아직 조사 기록이 없습니다</p>
        </div>
      ) : (
        <div style={styles.list} className="scrollable">
          {records.map(r => {
            const score = transportScore(r)
            const moves = r.moves || []
            const firstMove = moves[0] || {}
            return (
              <div
                key={r.id}
                style={styles.card}
                onClick={() => navigate(`/records/${r.id}`)}
              >
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.cardTitle}>{r.materialName || '(자재명 없음)'}</div>
                    <div style={styles.cardSub}>{r.shopName} {r.modelName ? `· ${r.modelName}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {score !== null && <div style={styles.indexBadge}>{formatScore(score)}점</div>}
                    <ChevronRight size={16} color="#5a6080" />
                  </div>
                </div>
                <div style={styles.cardMeta}>
                  {firstMove.from && firstMove.to && (
                    <span style={styles.metaChip}>
                      📍 {firstMove.from} → {firstMove.to}
                    </span>
                  )}
                  {r.transportMethod && (
                    <span style={styles.metaChip}>{r.transportMethod}</span>
                  )}
                  {(r.photos || []).length > 0 && (
                    <span style={styles.metaChip}>📷 {r.photos.length}장</span>
                  )}
                </div>
                <div style={styles.cardFooter}>
                  <span style={{ fontSize: '11px', color: '#5a6080' }}>{formatDate(r.createdAt)}</span>
                  <button
                    style={styles.deleteBtn}
                    onClick={e => handleDelete(e, r.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { height: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px', borderBottom: '1px solid #2e3347' },
  backBtn: { background: 'transparent', color: '#e8eaf0', padding: '6px', borderRadius: '8px', display: 'flex' },
  topTitle: { flex: 1, fontSize: '15px', fontWeight: '600' },
  exportBtn: { background: '#22263a', color: '#8b90a7', padding: '7px', borderRadius: '8px', display: 'flex' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  card: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px', padding: '14px',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px',
    transition: 'border-color 0.15s',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontSize: '16px', fontWeight: '600' },
  cardSub: { fontSize: '12px', color: '#8b90a7', marginTop: '2px' },
  indexBadge: { background: '#f7954f20', color: '#f7954f', fontSize: '12px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  metaChip: { fontSize: '11px', color: '#8b90a7', background: '#22263a', padding: '3px 8px', borderRadius: '6px' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #2e3347', paddingTop: '8px', marginTop: '2px' },
  deleteBtn: { background: '#f75f5f15', color: '#f75f5f', padding: '5px', borderRadius: '6px', display: 'flex' },
}
