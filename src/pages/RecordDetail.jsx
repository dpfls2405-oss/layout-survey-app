import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getAllRecords } from '../db'
import { difficultyIndex, hourlyMoveLoad, transportScore, formatScore, WORK_HOURS_PER_DAY } from '../utils/transportScore'

function Section({ title, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)

  useEffect(() => {
    getAllRecords().then(records => {
      const r = records.find(r => String(r.id) === String(id))
      setRecord(r)
    })
  }, [id])

  if (!record) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#5a6080' }}>
      불러오는 중…
    </div>
  )

  const diffIndex = difficultyIndex(record)
  const load = hourlyMoveLoad(record)
  const score = transportScore(record)

  const formatDate = iso => new Date(iso).toLocaleString('ko-KR')

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span style={s.topTitle}>{record.materialName || '조사 상세'}</span>
        <span style={{ fontSize: '11px', color: '#5a6080' }}>{formatDate(record.createdAt)}</span>
      </div>

      <div style={s.content} className="scrollable">

        {/* 종합 운반강도 강조 */}
        {score !== null && (
          <div style={s.indexHero}>
            <div style={s.indexLabel}>종합 운반강도</div>
            <div style={s.indexValue}>{formatScore(score)}</div>
            <div style={s.indexFormula}>
              난이도 {diffIndex.toFixed(1)} × 시간당 이동부하 {load.toFixed(1)} (m·회/시간)
            </div>
          </div>
        )}
        {score === null && diffIndex !== null && (
          <div style={s.indexHero}>
            <div style={s.indexLabel}>운반난이도 지수</div>
            <div style={s.indexValue}>{diffIndex.toFixed(1)}</div>
            <div style={s.indexFormula}>이동 경로(거리·횟수)를 입력하면 종합 운반강도가 계산됩니다</div>
          </div>
        )}

        <Section title="① 자재 특성">
          <Row label="Model명" value={record.modelName} />
          <Row label="자재명" value={record.materialName} />
          <Row label="Part No" value={record.partNo} />
          <Row label="공급 보조수단" value={record.supplyMethod} />
          <Row label="공급 단위" value={record.supplyUnit && `${record.supplyUnit} 개/단위`} />
          <Row label="공급 수량" value={record.supplyQty && `${record.supplyQty} 개/회`} />
          <Row label="공급 주기" value={record.supplyFreq && `${record.supplyFreq} 회/일`} />
          <Row label="총 소요량" value={record.totalDemand && `${record.totalDemand} 개/일`} />
          <Row label="운반 수단" value={record.transportMethod} />
          <Row label="평균 재고수량" value={record.avgStock} />
          <Row label="회수물 처리" value={record.returnFreq && `${record.returnFreq} 회/일`} />
          <Row label="회수물 처리수단" value={record.returnMethod} />
          {record.packagingPhoto && (
            <div style={s.packSection}>
              <div style={s.packLabel}>자재포장형태</div>
              <img src={record.packagingPhoto.dataUrl} alt="자재포장형태" style={s.packPhoto} />
            </div>
          )}
        </Section>

        <Section title="② 이동 경로 (From → To)">
          {(record.moves || []).map((m, i) => (
            <div key={i} style={s.moveBlock}>
              <div style={s.movePath}>
                <span style={s.moveFrom}>{m.from || '-'}</span>
                <ArrowRight size={14} color="#8b90a7" />
                <span style={s.moveTo}>{m.to || '-'}</span>
              </div>
              <div style={s.moveDetails}>
                {m.distance && <span>{m.distance}m</span>}
                {m.time && <span>{m.time}초</span>}
                {m.freq && <span>{m.freq}회/일</span>}
              </div>
              {m.note && <div style={s.moveNote}>{m.note}</div>}
            </div>
          ))}
        </Section>

        <Section title="③ 운반강도">
          <Row label="단위 중량" value={record.weight && `${record.weight} kg`} />
          <Row label="주의 지수" value={record.caution} />
          <Row label="형상 지수" value={record.shape} />
          <Row label="용적 지수" value={record.volume} />
          <Row label="포장 SIZE" value={record.packSize} />
          <Row label="적재수량" value={record.stackConfig} />
          {record.issues && (
            <div style={s.issues}>
              <div style={s.issuesLabel}>문제점</div>
              <div style={s.issuesText}>{record.issues}</div>
            </div>
          )}
        </Section>

        {(record.photos || []).length > 0 && (
          <Section title="④ 현장 사진">
            <div style={s.photos}>
              {record.photos.map(ph => (
                <div key={ph.id} style={s.photoWrap}>
                  <img src={ph.dataUrl} alt={ph.caption} style={s.photo} />
                  {ph.caption && <div style={s.photoCaption}>{ph.caption}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { height: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px', borderBottom: '1px solid #2e3347' },
  backBtn: { background: 'transparent', color: '#e8eaf0', padding: '6px', borderRadius: '8px', display: 'flex' },
  topTitle: { flex: 1, fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  content: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },

  indexHero: {
    background: 'linear-gradient(135deg, #f7954f18, #f7954f08)',
    border: '1.5px solid #f7954f40', borderRadius: '14px', padding: '20px', textAlign: 'center',
  },
  indexLabel: { fontSize: '11px', color: '#f7954f', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '6px' },
  indexValue: { fontSize: '48px', fontWeight: '700', color: '#f7954f', lineHeight: 1 },
  indexFormula: { fontSize: '12px', color: '#8b90a7', marginTop: '8px', fontFamily: 'monospace' },

  section: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  sectionTitle: { fontSize: '12px', fontWeight: '700', color: '#4f8ef7', marginBottom: '2px', letterSpacing: '0.03em' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  rowLabel: { fontSize: '12px', color: '#8b90a7', whiteSpace: 'nowrap' },
  rowValue: { fontSize: '13px', fontWeight: '500', textAlign: 'right' },

  moveBlock: {
    background: '#22263a', borderRadius: '8px', padding: '10px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  movePath: { display: 'flex', alignItems: 'center', gap: '8px' },
  moveFrom: { fontSize: '14px', fontWeight: '600', color: '#4f8ef7' },
  moveTo: { fontSize: '14px', fontWeight: '600', color: '#3ecf8e' },
  moveDetails: { display: 'flex', gap: '10px', fontSize: '12px', color: '#8b90a7' },
  moveNote: { fontSize: '12px', color: '#f7954f', fontStyle: 'italic' },

  issues: { background: '#f75f5f0a', border: '1px solid #f75f5f20', borderRadius: '8px', padding: '10px' },
  issuesLabel: { fontSize: '11px', color: '#f75f5f', fontWeight: '600', marginBottom: '4px' },
  issuesText: { fontSize: '13px', color: '#e8eaf0', whiteSpace: 'pre-wrap' },

  packSection: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' },
  packLabel: { fontSize: '12px', color: '#f7954f', fontWeight: '600' },
  packPhoto: { width: '100%', borderRadius: '8px', objectFit: 'cover', maxHeight: '200px' },

  photos: { display: 'flex', flexDirection: 'column', gap: '10px' },
  photoWrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
  photo: { width: '100%', borderRadius: '8px', objectFit: 'cover' },
  photoCaption: { fontSize: '12px', color: '#8b90a7', padding: '0 2px' },
}
