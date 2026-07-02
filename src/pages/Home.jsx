import { useNavigate } from 'react-router-dom'
import { ClipboardList, PlusCircle, BarChart2, Trophy, FileSpreadsheet, Ruler } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAllRecords } from '../db'

export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, today: 0 })

  useEffect(() => {
    getAllRecords().then(records => {
      const today = new Date().toDateString()
      setStats({
        total: records.length,
        today: records.filter(r => new Date(r.createdAt).toDateString() === today).length
      })
    })
  }, [])

  return (
    <div style={styles.wrap}>
      {/* 헤더 */}
      <div style={styles.header}>
        <div style={styles.badge}>레이아웃 분석</div>
        <h1 style={styles.title}>운반강도 조사</h1>
        <p style={styles.sub}>From-To Chart · 자재특성 · 물류현황</p>
      </div>

      {/* 통계 카드 */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statNum}>{stats.today}</span>
          <span style={styles.statLabel}>오늘 조사</span>
        </div>
        <div style={{ ...styles.statCard, borderColor: '#4f8ef720' }}>
          <span style={styles.statNum}>{stats.total}</span>
          <span style={styles.statLabel}>전체 누적</span>
        </div>
      </div>

      {/* 메인 버튼 */}
      <button style={styles.primaryBtn} onClick={() => navigate('/new')}>
        <PlusCircle size={22} />
        <span>새 조사 시작</span>
      </button>

      {/* 안내 카드 */}
      <div style={styles.guideCard}>
        <p style={styles.guideTitle}>조사 항목</p>
        <div style={styles.guideItems}>
          {[
            ['①', '자재 특성', 'Part No, 공급단위, 운반수단'],
            ['②', '이동 경로 (From→To)', '출발지 · 도착지 · 거리 · 횟수'],
            ['③', '운반강도', '중량 · 형상 · 용적 · 주의 지수'],
            ['④', '현장 사진', '자재 포장 · 운반 장면 촬영'],
          ].map(([num, title, desc]) => (
            <div key={num} style={styles.guideItem}>
              <span style={styles.guideNum}>{num}</span>
              <div>
                <div style={styles.guideName}>{title}</div>
                <div style={styles.guideDesc}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 조사 목록 버튼 */}
      <button style={styles.secondaryBtn} onClick={() => navigate('/records')}>
        <BarChart2 size={18} />
        <span>조사 기록 보기</span>
      </button>

      <div style={styles.rowBtns3}>
        <button style={styles.rowBtn} onClick={() => navigate('/ranking')}>
          <Trophy size={16} />
          <span>운반강도 랭킹</span>
        </button>
        <button style={styles.rowBtn} onClick={() => navigate('/items')}>
          <FileSpreadsheet size={16} />
          <span>품목 마스터</span>
        </button>
        <button style={styles.rowBtn} onClick={() => navigate('/distances')}>
          <Ruler size={16} />
          <span>이동거리</span>
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    padding: '48px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: { marginBottom: '4px' },
  badge: {
    display: 'inline-block',
    background: '#4f8ef720',
    color: '#4f8ef7',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: '20px',
    marginBottom: '12px',
    border: '1px solid #4f8ef740',
  },
  title: { fontSize: '28px', fontWeight: '700', lineHeight: 1.2, marginBottom: '6px' },
  sub: { fontSize: '13px', color: '#8b90a7' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  statCard: {
    background: '#1a1d27',
    border: '1.5px solid #f7954f20',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statNum: { fontSize: '28px', fontWeight: '700', color: '#f7954f' },
  statLabel: { fontSize: '12px', color: '#8b90a7' },
  primaryBtn: {
    background: '#4f8ef7',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    padding: '16px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    boxShadow: '0 4px 20px #4f8ef740',
  },
  guideCard: {
    background: '#1a1d27',
    border: '1.5px solid #2e3347',
    borderRadius: '14px',
    padding: '18px',
  },
  guideTitle: { fontSize: '12px', color: '#5a6080', fontWeight: '600', marginBottom: '12px', letterSpacing: '0.05em' },
  guideItems: { display: 'flex', flexDirection: 'column', gap: '12px' },
  guideItem: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  guideNum: { fontSize: '11px', color: '#4f8ef7', fontWeight: '700', background: '#4f8ef715', padding: '3px 7px', borderRadius: '6px', whiteSpace: 'nowrap', marginTop: '2px' },
  guideName: { fontSize: '14px', fontWeight: '600', marginBottom: '2px' },
  guideDesc: { fontSize: '12px', color: '#8b90a7' },
  secondaryBtn: {
    background: '#1a1d27',
    color: '#8b90a7',
    fontSize: '14px',
    fontWeight: '500',
    padding: '14px',
    borderRadius: '12px',
    border: '1.5px solid #2e3347',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
  },
  rowBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  rowBtns3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  rowBtn: {
    background: '#1a1d27',
    color: '#8b90a7',
    fontSize: '12.5px',
    fontWeight: '500',
    padding: '12px',
    borderRadius: '12px',
    border: '1.5px solid #2e3347',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
}
