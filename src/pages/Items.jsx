import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, CheckCircle2, XCircle, FileSpreadsheet, ClipboardEdit } from 'lucide-react'
import { getAllItems, upsertItemsForModel, deleteItem, getAllRecords } from '../db'
import { parseBomFile } from '../utils/parseBom'

function formatRouteChain(item) {
  const routes = item.routes || []
  if (routes.length > 1) {
    const chain = [routes[0].from, ...routes.map(r => r.to)].filter(Boolean)
    return chain.join(' → ')
  }
  if (item.fromArea || item.toArea) {
    return `${item.fromArea || '?'} → ${item.toArea || '?'}`
  }
  return ''
}

export default function Items() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [items, setItems] = useState([])
  const [coverage, setCoverage] = useState({}) // itemId -> 조사 횟수
  const [preview, setPreview] = useState(null) // { items, modelName, skippedCount }
  const [modelNameInput, setModelNameInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const [allItems, allRecords] = await Promise.all([getAllItems(), getAllRecords()])
    setItems(allItems)
    const cov = {}
    for (const it of allItems) {
      cov[it.id] = allRecords.filter(r =>
        r.itemId === it.id ||
        (!r.itemId && r.materialName?.trim() === it.materialName?.trim() && (r.partNo || '').trim() === (it.partNo || '').trim())
      ).length
    }
    setCoverage(cov)
  }
  useEffect(() => { load() }, [])

  const handleFile = async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setParsing(true)
    try {
      const result = await parseBomFile(file)
      if (result.items.length === 0) {
        setError('가져올 품목이 없습니다. 자재명/품목명 열이 있는지 확인하세요.')
      } else {
        setPreview(result)
        setModelNameInput(result.modelName)
      }
    } catch (err) {
      setError('파일 분석 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setParsing(false)
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    const modelName = modelNameInput.trim()
    if (!modelName) { alert('모델명을 입력하세요'); return }
    const existingCount = items.filter(it => it.modelName === modelName).length
    if (existingCount > 0 && !confirm(`'${modelName}' 모델의 기존 품목 ${existingCount}건을 새 자료(${preview.items.length}건)로 교체할까요? 다른 모델의 품목은 유지됩니다.`)) return
    await upsertItemsForModel(modelName, preview.items)
    setPreview(null)
    load()
  }

  const cancelImport = () => setPreview(null)

  const handleDelete = async id => {
    if (!confirm('이 품목을 목록에서 삭제할까요?')) return
    await deleteItem(id)
    load()
  }

  const startSurvey = (item) => {
    navigate('/new', { state: { prefill: item } })
  }

  const surveyedCount = items.filter(it => coverage[it.id] > 0).length

  // 모델별 그룹핑
  const groups = []
  const groupMap = new Map()
  for (const it of items) {
    const key = it.modelName || '(모델 미지정)'
    if (!groupMap.has(key)) {
      const g = { modelName: key, items: [] }
      groupMap.set(key, g)
      groups.push(g)
    }
    groupMap.get(key).items.push(it)
  }

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span style={s.topTitle}>품목 마스터 (BOM)</span>
      </div>

      <div style={s.content} className="scrollable">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
        />
        <button style={s.uploadBtn} onClick={() => fileRef.current.click()} disabled={parsing}>
          <Upload size={18} />
          <span>{parsing ? '분석 중…' : '표준BOM 엑셀 업로드'}</span>
        </button>
        <p style={s.hint}>제품(모델) 단위 BOM 전개 파일을 업로드하세요. 품목명·Part No·이동경로(FROM/TO)를 자동 인식합니다.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        {preview && (
          <div style={s.previewBox}>
            <div style={s.previewHeader}>
              <FileSpreadsheet size={16} color="#4f8ef7" />
              <span style={{ fontWeight: 700 }}>{preview.items.length}건 인식</span>
              {preview.skippedCount > 0 && <span style={s.skippedTag}>자재명 없어 {preview.skippedCount}건 제외</span>}
            </div>
            <div style={s.fieldLabel}>모델명 (완제품 코드)</div>
            <input
              value={modelNameInput}
              onChange={e => setModelNameInput(e.target.value)}
              placeholder="예) CH6800RAH"
            />
            <div style={s.previewList}>
              {preview.items.slice(0, 8).map((it, i) => (
                <div key={i} style={s.previewRow}>
                  <span style={{ fontWeight: 600 }}>{it.materialName}</span>
                  <span style={s.previewSub}>
                    {[it.partNo, it.materialAccount].filter(Boolean).join(' · ')}
                    {formatRouteChain(it) && ` · ${formatRouteChain(it)}`}
                    {(it.routes || []).length > 1 && <span style={s.waypointTag}> 경유</span>}
                  </span>
                </div>
              ))}
              {preview.items.length > 8 && <div style={s.previewMore}>… 외 {preview.items.length - 8}건</div>}
            </div>
            <div style={s.previewActions}>
              <button style={s.confirmBtn} onClick={confirmImport}>
                <CheckCircle2 size={16} /> 가져오기
              </button>
              <button style={s.cancelBtn} onClick={cancelImport}>
                <XCircle size={16} /> 취소
              </button>
            </div>
          </div>
        )}

        <div style={s.statsRow}>
          <div style={s.statCard}>
            <span style={s.statNum}>{items.length}</span>
            <span style={s.statLabel}>전체 품목</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#3ecf8e' }}>{surveyedCount}</span>
            <span style={s.statLabel}>조사 완료</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#f75f5f' }}>{items.length - surveyedCount}</span>
            <span style={s.statLabel}>미조사</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={s.empty}>등록된 품목이 없습니다. BOM 엑셀을 업로드해 시작하세요.</div>
        ) : (
          <div style={s.groupList}>
            {groups.map(g => (
              <div key={g.modelName} style={s.group}>
                <div style={s.groupHeader}>
                  <span>{g.modelName}</span>
                  <span style={s.groupCount}>{g.items.length}건</span>
                </div>
                <div style={s.list}>
                  {g.items.map(it => (
                    <div key={it.id} style={s.itemCard}>
                      <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => startSurvey(it)}>
                        <div style={s.itemName}>{it.materialName}</div>
                        <div style={s.itemSub}>
                          {[it.partNo, it.materialAccount].filter(Boolean).join(' · ') || '-'}
                          {formatRouteChain(it) && ` · ${formatRouteChain(it)}`}
                          {(it.routes || []).length > 1 && <span style={s.waypointTag}> 경유</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {coverage[it.id] > 0 ? (
                          <span style={s.surveyedBadge}>조사 {coverage[it.id]}건</span>
                        ) : (
                          <span style={s.unsurveyedBadge}>미조사</span>
                        )}
                        <button style={s.surveyBtn} onClick={() => startSurvey(it)} title="조사 시작">
                          <ClipboardEdit size={14} />
                        </button>
                        <button style={s.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(it.id) }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
  uploadBtn: {
    background: '#4f8ef715', color: '#4f8ef7', border: '1.5px solid #4f8ef740',
    padding: '14px', borderRadius: '12px', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    fontSize: '15px', fontWeight: '600',
  },
  hint: { fontSize: '12px', color: '#5a6080', marginTop: '-8px' },
  errorBox: { background: '#f75f5f15', border: '1px solid #f75f5f40', color: '#f75f5f', fontSize: '13px', padding: '10px 12px', borderRadius: '8px' },
  previewBox: { background: '#1a1d27', border: '1.5px solid #4f8ef740', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' },
  previewHeader: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' },
  fieldLabel: { fontSize: '11px', fontWeight: '600', color: '#8b90a7' },
  skippedTag: { fontSize: '11px', color: '#f7954f', background: '#f7954f15', padding: '2px 8px', borderRadius: '6px' },
  previewList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  previewRow: { display: 'flex', flexDirection: 'column', fontSize: '13px', borderBottom: '1px solid #2e3347', paddingBottom: '6px' },
  previewSub: { fontSize: '11px', color: '#8b90a7' },
  previewMore: { fontSize: '12px', color: '#5a6080' },
  previewActions: { display: 'flex', gap: '8px' },
  confirmBtn: { flex: 1, background: '#3ecf8e', color: '#0f1117', fontWeight: 700, padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  cancelBtn: { flex: 1, background: '#22263a', color: '#8b90a7', fontWeight: 600, padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  statCard: { background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' },
  statNum: { fontSize: '20px', fontWeight: '700' },
  statLabel: { fontSize: '11px', color: '#8b90a7' },
  empty: { textAlign: 'center', color: '#5a6080', fontSize: '13px', padding: '24px 0' },
  groupList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  group: { display: 'flex', flexDirection: 'column', gap: '8px' },
  groupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: '#4f8ef7' },
  groupCount: { fontSize: '11px', color: '#8b90a7', fontWeight: '500' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  itemCard: { background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  itemName: { fontSize: '14px', fontWeight: '600' },
  itemSub: { fontSize: '11px', color: '#8b90a7', marginTop: '2px' },
  surveyedBadge: { fontSize: '11px', color: '#3ecf8e', background: '#3ecf8e15', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' },
  unsurveyedBadge: { fontSize: '11px', color: '#f75f5f', background: '#f75f5f15', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' },
  surveyBtn: { background: '#4f8ef715', color: '#4f8ef7', padding: '5px', borderRadius: '6px', display: 'flex', cursor: 'pointer' },
  deleteBtn: { background: '#f75f5f15', color: '#f75f5f', padding: '5px', borderRadius: '6px', display: 'flex' },
  waypointTag: { color: '#f7954f', background: '#f7954f15', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', marginLeft: '4px' },
}
