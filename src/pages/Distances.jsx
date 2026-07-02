import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react'
import { getAllItems, getAllDistances, upsertDistance, deleteDistance } from '../db'

export default function Distances() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState([])
  const [saving, setSaving] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [areas, setAreas] = useState([])

  const load = async () => {
    const [items, distances] = await Promise.all([getAllItems(), getAllDistances()])

    // BOM 마스터에서 모든 고유 구간 추출
    const routeSet = new Map()
    for (const item of items) {
      const itemRoutes = item.routes || []
      if (itemRoutes.length > 0) {
        for (const r of itemRoutes) {
          if (r.from && r.to) {
            const key = `${r.from}__${r.to}`
            if (!routeSet.has(key)) routeSet.set(key, { from: r.from, to: r.to, items: [] })
            routeSet.get(key).items.push(item.materialName)
          }
        }
      } else if (item.fromArea && item.toArea) {
        const key = `${item.fromArea}__${item.toArea}`
        if (!routeSet.has(key)) routeSet.set(key, { from: item.fromArea, to: item.toArea, items: [] })
        routeSet.get(key).items.push(item.materialName)
      }
    }

    // distances DB에만 있는 수동 추가 구간도 포함
    const distMap = {}
    for (const d of distances) {
      distMap[d.routeKey] = d.distance
      if (!routeSet.has(d.routeKey)) {
        routeSet.set(d.routeKey, { from: d.fromArea, to: d.toArea, items: [] })
      }
    }

    const allRoutes = [...routeSet.entries()].map(([key, r]) => ({
      key,
      from: r.from,
      to: r.to,
      distance: distMap[key] ?? '',
      itemCount: r.items.length,
      itemNames: [...new Set(r.items)].slice(0, 3),
    }))
    allRoutes.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    setRoutes(allRoutes)

    // 자동완성용 구역 목록
    const areaSet = new Set()
    for (const item of items) {
      if (item.fromArea) areaSet.add(item.fromArea)
      if (item.toArea) areaSet.add(item.toArea)
      for (const r of (item.routes || [])) {
        if (r.from) areaSet.add(r.from)
        if (r.to) areaSet.add(r.to)
      }
    }
    setAreas([...areaSet].sort())
  }

  useEffect(() => { load() }, [])

  const handleDistanceChange = (key, value) => {
    setRoutes(prev => prev.map(r => r.key === key ? { ...r, distance: value } : r))
  }

  const handleSave = async (route) => {
    setSaving(route.key)
    await upsertDistance(route.from, route.to, route.distance)
    setTimeout(() => setSaving(null), 600)
  }

  const handleSaveAll = async () => {
    setSaving('__all__')
    for (const route of routes) {
      if (route.distance !== '' && route.distance !== null) {
        await upsertDistance(route.from, route.to, route.distance)
      }
    }
    setSaving(null)
  }

  const handleDelete = async (route) => {
    if (route.itemCount > 0) {
      alert('BOM에서 참조하는 구간은 삭제할 수 없습니다.')
      return
    }
    if (!confirm(`${route.from} → ${route.to} 구간을 삭제할까요?`)) return
    await deleteDistance(route.key)
    load()
  }

  const handleAddRoute = async () => {
    if (!newFrom.trim() || !newTo.trim()) { alert('출발지와 도착지를 입력하세요'); return }
    const key = `${newFrom.trim()}__${newTo.trim()}`
    if (routes.some(r => r.key === key)) { alert('이미 존재하는 구간입니다'); return }
    await upsertDistance(newFrom.trim(), newTo.trim(), 0)
    setNewFrom('')
    setNewTo('')
    setAdding(false)
    load()
  }

  const filledCount = routes.filter(r => r.distance !== '' && parseFloat(r.distance) > 0).length

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span style={s.topTitle}>이동거리 관리</span>
        <button style={s.saveAllBtn} onClick={handleSaveAll} disabled={saving === '__all__'}>
          <Save size={16} />
          <span>{saving === '__all__' ? '저장 중…' : '전체 저장'}</span>
        </button>
      </div>

      <div style={s.content} className="scrollable">
        <p style={s.hint}>BOM에서 추출된 모든 이동 구간의 거리(m)를 입력하세요. 조사 시 자동으로 반영됩니다.</p>

        <div style={s.statsRow}>
          <div style={s.statCard}>
            <span style={s.statNum}>{routes.length}</span>
            <span style={s.statLabel}>전체 구간</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#3ecf8e' }}>{filledCount}</span>
            <span style={s.statLabel}>입력 완료</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#f75f5f' }}>{routes.length - filledCount}</span>
            <span style={s.statLabel}>미입력</span>
          </div>
        </div>

        <datalist id="dist-area-list">
          {areas.map(a => <option key={a} value={a} />)}
        </datalist>

        {routes.length === 0 ? (
          <div style={s.empty}>BOM을 먼저 업로드하세요. 품목의 FROM/TO 구간이 자동으로 표시됩니다.</div>
        ) : (
          <div style={s.list}>
            {routes.map(route => (
              <div key={route.key} style={s.card}>
                <div style={s.routeRow}>
                  <span style={s.fromLabel}>{route.from}</span>
                  <ArrowRight size={14} color="#8b90a7" />
                  <span style={s.toLabel}>{route.to}</span>
                </div>
                {route.itemCount > 0 && (
                  <div style={s.itemHint}>
                    {route.itemNames.join(', ')}{route.itemCount > 3 ? ` 외 ${route.itemCount - 3}건` : ''} ({route.itemCount}개 품목)
                  </div>
                )}
                <div style={s.inputRow}>
                  <input
                    type="number"
                    value={route.distance}
                    onChange={e => handleDistanceChange(route.key, e.target.value)}
                    placeholder="거리 (m)"
                    style={s.distInput}
                    onBlur={() => handleSave(route)}
                  />
                  <span style={s.unit}>m</span>
                  {saving === route.key && <CheckCircle2 size={16} color="#3ecf8e" />}
                  {route.itemCount === 0 && (
                    <button style={s.deleteBtn} onClick={() => handleDelete(route)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div style={s.addForm}>
            <div style={s.addInputRow}>
              <input
                list="dist-area-list"
                value={newFrom}
                onChange={e => setNewFrom(e.target.value)}
                placeholder="출발지"
                style={s.addInput}
              />
              <ArrowRight size={14} color="#8b90a7" />
              <input
                list="dist-area-list"
                value={newTo}
                onChange={e => setNewTo(e.target.value)}
                placeholder="도착지"
                style={s.addInput}
              />
            </div>
            <div style={s.addActions}>
              <button style={s.confirmBtn} onClick={handleAddRoute}>
                <CheckCircle2 size={14} /> 추가
              </button>
              <button style={s.cancelBtn} onClick={() => setAdding(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button style={s.addBtn} onClick={() => setAdding(true)}>
            <Plus size={16} /> 구간 수동 추가
          </button>
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
  saveAllBtn: {
    background: '#3ecf8e20', color: '#3ecf8e', border: '1px solid #3ecf8e40',
    padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  content: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  hint: { fontSize: '12px', color: '#5a6080' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  statCard: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px',
    padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center',
  },
  statNum: { fontSize: '20px', fontWeight: '700' },
  statLabel: { fontSize: '11px', color: '#8b90a7' },
  empty: { textAlign: 'center', color: '#5a6080', fontSize: '13px', padding: '24px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '10px',
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  routeRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  fromLabel: { fontSize: '14px', fontWeight: '600', color: '#4f8ef7' },
  toLabel: { fontSize: '14px', fontWeight: '600', color: '#3ecf8e' },
  itemHint: { fontSize: '11px', color: '#5a6080' },
  inputRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  distInput: {
    flex: 1, padding: '8px 12px', background: '#22263a', border: '1px solid #2e3347',
    borderRadius: '8px', color: '#e8eaf0', fontSize: '14px',
  },
  unit: { fontSize: '13px', color: '#8b90a7', flexShrink: 0 },
  deleteBtn: { background: '#f75f5f15', color: '#f75f5f', padding: '6px', borderRadius: '6px', display: 'flex', flexShrink: 0 },
  addBtn: {
    background: '#22263a', color: '#4f8ef7', border: '1.5px dashed #4f8ef750',
    padding: '12px', borderRadius: '10px', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    fontSize: '14px', fontWeight: '500',
  },
  addForm: {
    background: '#1a1d27', border: '1.5px solid #4f8ef740', borderRadius: '12px',
    padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  addInputRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  addInput: { flex: 1, padding: '8px 10px', fontSize: '13px' },
  addActions: { display: 'flex', gap: '8px' },
  confirmBtn: {
    flex: 1, background: '#3ecf8e', color: '#0f1117', fontWeight: 700,
    padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
    fontSize: '13px',
  },
  cancelBtn: {
    flex: 1, background: '#22263a', color: '#8b90a7', fontWeight: 600,
    padding: '8px', borderRadius: '8px', fontSize: '13px', textAlign: 'center',
  },
}
