import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Camera, X, Plus, Trash2, Loader2, Link2, Package } from 'lucide-react'
import { saveRecord, savePhoto, getAllItems, getDistanceMap } from '../db'
import { compressImage, formatBytes } from '../utils/compressImage'
import { difficultyIndex, hourlyMoveLoad, transportScore, formatScore, WORK_HOURS_PER_DAY } from '../utils/transportScore'

const STEPS = ['자재 특성', '이동 경로', '운반강도', '현장 사진']

const TRANSPORT_METHODS = ['지게차', '대차', '인력', '컨베이어', '크레인', '전동차', '기타']
const AREA_LIST = [
  '자재창고-1', '자재창고-2', '수입검사', '부품창고', '가공Line',
  '총조립Line', '대형물 적치장', '반제품 적치장', '출하장', '기타'
]

function Field({ label, required, children }) {
  return (
    <div style={fStyles.field}>
      <label style={fStyles.label}>
        {label}
        {required && <span style={{ color: '#f75f5f', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#8b90a7', letterSpacing: '0.04em' },
}

// ──────────────── Step 1: 자재 특성 ────────────────
function Step1({ data, setData, items, distanceMap }) {
  const u = (k, v) => setData(p => ({ ...p, [k]: v }))
  const packPhotoRef = useRef()
  const [packPhotoProcessing, setPackPhotoProcessing] = useState(false)

  const handleMaterialName = v => {
    const matched = items.find(it => it.materialName.trim().toLowerCase() === v.trim().toLowerCase())
    setData(p => {
      const noMovesYet = !p.moves || p.moves.length === 0 || (!p.moves[0].from && !p.moves[0].to)
      let moves = p.moves
      if (matched && noMovesYet) {
        const routes = matched.routes || []
        if (routes.length > 0) {
          moves = routes.map(r => {
            const distKey = `${r.from}__${r.to}`
            return {
              from: r.from || '', to: r.to || '',
              distance: distanceMap[distKey] || '',
              time: '', freq: '', note: '',
            }
          })
        } else if (matched.fromArea || matched.toArea) {
          const distKey = `${matched.fromArea}__${matched.toArea}`
          moves = [{ from: matched.fromArea || '', to: matched.toArea || '', distance: distanceMap[distKey] || '', time: '', freq: '', note: '' }]
        }
      }
      return {
        ...p,
        materialName: v,
        itemId: matched ? matched.id : undefined,
        partNo: matched && !p.partNo ? matched.partNo : p.partNo,
        modelName: matched && !p.modelName ? matched.modelName : p.modelName,
        moves,
      }
    })
  }

  const handlePackPhoto = async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPackPhotoProcessing(true)
    try {
      const result = await compressImage(file, { maxSide: 1200, quality: 0.7 })
      u('packagingPhoto', {
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
      })
    } catch (err) {
      alert('사진 처리 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setPackPhotoProcessing(false)
    }
  }

  return (
    <div style={sStyles.stepWrap}>
      <Field label="Model명">
        <input value={data.modelName || ''} onChange={e => u('modelName', e.target.value)} placeholder="예) CS-777" />
      </Field>
      <Field label="자재명" required>
        <input
          list="material-master-list"
          value={data.materialName || ''}
          onChange={e => handleMaterialName(e.target.value)}
          placeholder="예) CDT"
        />
        <datalist id="material-master-list">
          {[...new Set(items.map(it => it.materialName))].map(name => <option key={name} value={name} />)}
        </datalist>
        {data.itemId && (
          <div style={sStyles.linkedBadge}>
            <Link2 size={11} /> 품목 마스터 연동됨
          </div>
        )}
      </Field>
      <Field label="Part No">
        <input value={data.partNo || ''} onChange={e => u('partNo', e.target.value)} placeholder="예) 112-882A" />
      </Field>
      <div style={sStyles.row2}>
        <Field label="공급 보조수단">
          <select value={data.supplyMethod || ''} onChange={e => u('supplyMethod', e.target.value)}>
            <option value="">선택</option>
            {['Pallet', '대차', '직납', '랙', '컨테이너', '기타'].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="공급 단위 (개/단위)">
          <input type="number" value={data.supplyUnit || ''} onChange={e => u('supplyUnit', e.target.value)} placeholder="예) 14" />
        </Field>
      </div>
      <div style={sStyles.row2}>
        <Field label="공급 수량 (개/회)">
          <input type="number" value={data.supplyQty || ''} onChange={e => u('supplyQty', e.target.value)} placeholder="예) 42" />
        </Field>
        <Field label="공급 주기 (회/일)">
          <input type="number" value={data.supplyFreq || ''} onChange={e => u('supplyFreq', e.target.value)} placeholder="예) 36" />
        </Field>
      </div>
      <Field label="총 소요량 (개/일)">
        <input type="number" value={data.totalDemand || ''} onChange={e => u('totalDemand', e.target.value)} placeholder="예) 1500" />
      </Field>
      <div style={sStyles.row2}>
        <Field label="운반 수단">
          <select value={data.transportMethod || ''} onChange={e => u('transportMethod', e.target.value)}>
            <option value="">선택</option>
            {TRANSPORT_METHODS.map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="평균 재고수량">
          <input type="number" value={data.avgStock || ''} onChange={e => u('avgStock', e.target.value)} placeholder="예) 126" />
        </Field>
      </div>
      <div style={sStyles.row2}>
        <Field label="회수물 처리 (회/일)">
          <input type="number" value={data.returnFreq || ''} onChange={e => u('returnFreq', e.target.value)} placeholder="예) 18" />
        </Field>
        <Field label="회수물 처리수단">
          <select value={data.returnMethod || ''} onChange={e => u('returnMethod', e.target.value)}>
            <option value="">선택</option>
            {TRANSPORT_METHODS.map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ borderTop: '1px solid #2e3347', paddingTop: '16px' }}>
        <Field label="자재포장형태 사진">
          <input
            ref={packPhotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePackPhoto}
            style={{ display: 'none' }}
          />
          {data.packagingPhoto ? (
            <div style={sStyles.packPhotoWrap}>
              <div style={{ position: 'relative' }}>
                <img src={data.packagingPhoto.dataUrl} alt="자재포장형태" style={sStyles.packPhotoImg} />
                <button style={sStyles.packPhotoRemove} onClick={() => u('packagingPhoto', null)}>
                  <X size={14} />
                </button>
                <div style={sStyles.packPhotoMeta}>
                  {data.packagingPhoto.width}×{data.packagingPhoto.height} · {formatBytes(data.packagingPhoto.compressedSize)}
                </div>
              </div>
              <button style={sStyles.packPhotoRetake} onClick={() => packPhotoRef.current.click()}>
                <Camera size={14} /> 다시 촬영
              </button>
            </div>
          ) : (
            <button style={sStyles.packPhotoBtn} onClick={() => packPhotoRef.current.click()} disabled={packPhotoProcessing}>
              {packPhotoProcessing ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> 압축 중…</>
              ) : (
                <><Package size={18} /> <Camera size={16} /> 포장형태 촬영</>
              )}
            </button>
          )}
        </Field>
      </div>
    </div>
  )
}

// ──────────────── Step 2: 이동 경로 ────────────────
function Step2({ data, setData, areaList }) {
  const moves = data.moves || [{ from: '', to: '', distance: '', time: '', freq: '', note: '' }]
  const update = (idx, key, val) => {
    const next = moves.map((m, i) => i === idx ? { ...m, [key]: val } : m)
    setData(p => ({ ...p, moves: next }))
  }
  const add = () => setData(p => ({ ...p, moves: [...(p.moves || []), { from: '', to: '', distance: '', time: '', freq: '', note: '' }] }))
  const remove = idx => setData(p => ({ ...p, moves: (p.moves || []).filter((_, i) => i !== idx) }))

  return (
    <div style={sStyles.stepWrap}>
      <p style={{ fontSize: '13px', color: '#8b90a7', marginBottom: '4px' }}>이동 구간을 모두 입력하세요. 구간이 여러 개면 추가하세요.</p>
      <datalist id="area-master-list">
        {areaList.map(v => <option key={v} value={v} />)}
      </datalist>
      {moves.map((m, idx) => (
        <div key={idx} style={sStyles.moveCard}>
          <div style={sStyles.moveHeader}>
            <span style={sStyles.moveBadge}>구간 {idx + 1}</span>
            {moves.length > 1 && (
              <button style={sStyles.removeBtn} onClick={() => remove(idx)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div style={sStyles.row2}>
            <Field label="From (출발지)" required>
              <input list="area-master-list" value={m.from} onChange={e => update(idx, 'from', e.target.value)} placeholder="예) 자재창고-1" />
            </Field>
            <Field label="To (도착지)" required>
              <input list="area-master-list" value={m.to} onChange={e => update(idx, 'to', e.target.value)} placeholder="예) 총조립Line" />
            </Field>
          </div>
          <div style={sStyles.row2}>
            <Field label="이동거리 (m)">
              <input type="number" value={m.distance} onChange={e => update(idx, 'distance', e.target.value)} placeholder="예) 70" />
            </Field>
            <Field label="이동시간 (초)">
              <input type="number" value={m.time} onChange={e => update(idx, 'time', e.target.value)} placeholder="예) 30" />
            </Field>
          </div>
          <Field label="이동 횟수 (회/일)">
            <input type="number" value={m.freq} onChange={e => update(idx, 'freq', e.target.value)} placeholder="예) 36" />
          </Field>
          <Field label="특이사항">
            <input value={m.note} onChange={e => update(idx, 'note', e.target.value)} placeholder="예) 타 부품 지게차와 충돌 위험" />
          </Field>
        </div>
      ))}
      <button style={sStyles.addBtn} onClick={add}>
        <Plus size={16} /> 구간 추가
      </button>
    </div>
  )
}

// ──────────────── Step 3: 운반강도 ────────────────
function Step3({ data, setData }) {
  const u = (k, v) => setData(p => ({ ...p, [k]: v }))
  const index = difficultyIndex(data)
  const load = hourlyMoveLoad(data)
  const score = transportScore(data)

  return (
    <div style={sStyles.stepWrap}>
      <div style={sStyles.formulaCard}>
        <span style={{ fontSize: '11px', color: '#8b90a7' }}>운반난이도 지수</span>
        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#e8eaf0', marginTop: '4px' }}>
          지수 = 중량 × (1 + (주의 + 형상 + 용적) ÷ 100)
        </div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#f7954f', marginTop: '8px' }}>
          {index !== null ? index.toFixed(1) : '-'} <span style={{ fontSize: '13px', color: '#8b90a7', fontWeight: '400' }}>점</span>
        </div>
      </div>

      <div style={sStyles.formulaCard}>
        <span style={{ fontSize: '11px', color: '#8b90a7' }}>종합 운반강도 (난이도 × 시간당 이동부하)</span>
        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#e8eaf0', marginTop: '4px' }}>
          점수 = 운반난이도 지수 × [Σ(구간거리×횟수) ÷ {WORK_HOURS_PER_DAY}시간]
        </div>
        <div style={{ fontSize: '11px', color: '#5a6080', marginTop: '4px' }}>
          시간당 이동부하: {load.toFixed(1)} m·회/시간 (② 이동 경로 입력값 기준)
        </div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#4f8ef7', marginTop: '8px' }}>
          {formatScore(score)} <span style={{ fontSize: '13px', color: '#8b90a7', fontWeight: '400' }}>점</span>
        </div>
      </div>

      <Field label="단위 중량 (kg)" required>
        <input type="number" step="0.1" value={data.weight || ''} onChange={e => u('weight', e.target.value)} placeholder="예) 75" />
      </Field>
      <p style={{ fontSize: '11px', color: '#5a6080', marginTop: '-8px' }}>Weight: 50~100 사이로 선정</p>

      <div style={sStyles.row2}>
        <Field label="주의 지수 (W/T)">
          <input type="number" step="1" value={data.caution || ''} onChange={e => u('caution', e.target.value)} placeholder="0~100" />
        </Field>
        <Field label="형상 지수 (W/T)">
          <input type="number" step="1" value={data.shape || ''} onChange={e => u('shape', e.target.value)} placeholder="0~100" />
        </Field>
      </div>
      <Field label="용적 지수 (W/T)">
        <input type="number" step="1" value={data.volume || ''} onChange={e => u('volume', e.target.value)} placeholder="0~100" />
      </Field>

      <div style={{ borderTop: '1px solid #2e3347', paddingTop: '16px' }}>
        <Field label="포장 SIZE (L×W×H, mm)">
          <input value={data.packSize || ''} onChange={e => u('packSize', e.target.value)} placeholder="예) 600×400×300" />
        </Field>
        <Field label="적재수량 (수량×단×열)">
          <input value={data.stackConfig || ''} onChange={e => u('stackConfig', e.target.value)} placeholder="예) 14×1×1" />
        </Field>
      </div>

      <Field label="문제점 요약">
        <textarea rows={3} value={data.issues || ''} onChange={e => u('issues', e.target.value)} placeholder="예) 타 부품 공급 시 지게차와 충돌 가능&#10;통로 협소로 대차 운반 어려움" />
      </Field>
    </div>
  )
}

// ──────────────── Step 4: 사진 ────────────────
function Step4({ data, setData }) {
  const fileRef = useRef()
  const [processing, setProcessing] = useState(0) // 압축 중인 파일 개수
  const photos = data.photos || []

  const handleCapture = async e => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return

    setProcessing(files.length)

    // 순차 압축 (모바일에서 동시 압축은 메모리 부담)
    for (const file of files) {
      try {
        const result = await compressImage(file, { maxSide: 1600, quality: 0.75 })
        setData(p => ({
          ...p,
          photos: [...(p.photos || []), {
            id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            dataUrl: result.dataUrl,
            caption: '',
            width: result.width,
            height: result.height,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
          }]
        }))
      } catch (err) {
        console.error('이미지 압축 실패:', err)
        alert('사진 처리 실패: ' + (err.message || '알 수 없는 오류'))
      } finally {
        setProcessing(c => c - 1)
      }
    }
  }

  const removePhoto = id => setData(p => ({ ...p, photos: p.photos.filter(ph => ph.id !== id) }))
  const updateCaption = (id, caption) => setData(p => ({
    ...p,
    photos: p.photos.map(ph => ph.id === id ? { ...ph, caption } : ph)
  }))

  // 총 용량 / 절감량
  const totalOrig = photos.reduce((s, p) => s + (p.originalSize || 0), 0)
  const totalComp = photos.reduce((s, p) => s + (p.compressedSize || 0), 0)
  const savedPct = totalOrig > 0 ? Math.round((1 - totalComp / totalOrig) * 100) : 0

  return (
    <div style={sStyles.stepWrap}>
      <p style={{ fontSize: '13px', color: '#8b90a7' }}>자재 포장 형태, 운반 장면, 문제 현장 등을 촬영하세요.</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleCapture}
      />
      <button style={sStyles.cameraBtn} onClick={() => fileRef.current.click()} disabled={processing > 0}>
        {processing > 0 ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>압축 중… ({processing}장 남음)</span>
          </>
        ) : (
          <>
            <Camera size={20} />
            <span>사진 촬영 / 갤러리에서 선택</span>
          </>
        )}
      </button>

      {photos.length > 0 && (
        <div style={sStyles.compressStats}>
          <div>
            <span style={{ color: '#3ecf8e', fontWeight: 700 }}>{photos.length}장</span>
            <span style={{ color: '#5a6080', margin: '0 6px' }}>·</span>
            <span style={{ color: '#8b90a7' }}>{formatBytes(totalComp)}</span>
          </div>
          {savedPct > 0 && (
            <span style={sStyles.saveBadge}>
              {savedPct}% 절감 ({formatBytes(totalOrig)} → {formatBytes(totalComp)})
            </span>
          )}
        </div>
      )}

      {photos.length === 0 && processing === 0 && (
        <div style={sStyles.emptyPhoto}>
          <Camera size={32} color="#3a3f55" />
          <span style={{ fontSize: '13px', color: '#5a6080', marginTop: '8px' }}>사진 없음 (선택 사항)</span>
        </div>
      )}

      <div style={sStyles.photoGrid}>
        {photos.map(ph => (
          <div key={ph.id} style={sStyles.photoItem}>
            <div style={{ position: 'relative' }}>
              <img src={ph.dataUrl} alt="" style={sStyles.photoImg} />
              <button style={sStyles.photoRemove} onClick={() => removePhoto(ph.id)}>
                <X size={14} />
              </button>
              {ph.compressedSize && (
                <div style={sStyles.photoMeta}>
                  {ph.width}×{ph.height} · {formatBytes(ph.compressedSize)}
                </div>
              )}
            </div>
            <input
              value={ph.caption}
              onChange={e => updateCaption(ph.id, e.target.value)}
              placeholder="설명 (선택)"
              style={{ fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────── 메인 ────────────────
export default function NewRecord() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({})
  const [items, setItems] = useState([])
  const [distanceMap, setDistanceMap] = useState({})

  useEffect(() => {
    Promise.all([getAllItems(), getDistanceMap()]).then(([allItems, dMap]) => {
      setItems(allItems)
      setDistanceMap(dMap)
      const prefill = location.state?.prefill
      if (prefill) {
        const routes = prefill.routes || []
        let moves
        if (routes.length > 0) {
          moves = routes.map(r => ({
            from: r.from || '', to: r.to || '',
            distance: dMap[`${r.from}__${r.to}`] || '',
            time: '', freq: '', note: '',
          }))
        } else if (prefill.fromArea || prefill.toArea) {
          const dk = `${prefill.fromArea}__${prefill.toArea}`
          moves = [{ from: prefill.fromArea || '', to: prefill.toArea || '', distance: dMap[dk] || '', time: '', freq: '', note: '' }]
        }
        setData({
          materialName: prefill.materialName || '',
          partNo: prefill.partNo || '',
          modelName: prefill.modelName || '',
          itemId: prefill.id,
          moves,
        })
      }
    })
  }, [])

  const areaList = [...new Set([
    ...AREA_LIST,
    ...items.flatMap(it => [it.fromArea, it.toArea]).filter(Boolean),
  ])]

  const validate = () => {
    if (step === 0) {
      if (!data.materialName?.trim()) return '자재명을 입력하세요'
    }
    if (step === 1) {
      const moves = data.moves || [{}]
      if (!moves[0].from || !moves[0].to) return '출발지와 도착지를 선택하세요'
    }
    return null
  }

  const next = () => {
    const err = validate()
    if (err) { alert(err); return }
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  const prev = () => {
    if (step > 0) setStep(s => s - 1)
    else navigate(-1)
  }

  const submit = async () => {
    setSaving(true)
    try {
      const record = { ...data, type: 'layout-survey' }
      await saveRecord(record)
      navigate('/records', { replace: true })
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <div style={pStyles.wrap}>
      {/* 상단 네비 */}
      <div style={pStyles.topBar}>
        <button style={pStyles.backBtn} onClick={prev}>
          <ArrowLeft size={20} />
        </button>
        <span style={pStyles.topTitle}>새 조사</span>
        <span style={pStyles.stepCounter}>{step + 1} / {STEPS.length}</span>
      </div>

      {/* 진행 바 */}
      <div style={pStyles.progressTrack}>
        <div style={{ ...pStyles.progressFill, width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* 스텝 탭 */}
      <div style={pStyles.tabs}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            style={{
              ...pStyles.tab,
              color: i === step ? '#4f8ef7' : i < step ? '#3ecf8e' : '#5a6080',
              borderBottom: i === step ? '2px solid #4f8ef7' : '2px solid transparent',
            }}
            onClick={() => i <= step && setStep(i)}
          >
            {i < step ? <Check size={12} /> : null}
            <span style={{ fontSize: '11px', fontWeight: i === step ? 700 : 500 }}>{s}</span>
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div style={pStyles.content} className="scrollable">
        <h2 style={pStyles.stepTitle}>{STEPS[step]}</h2>
        {step === 0 && <Step1 data={data} setData={setData} items={items} distanceMap={distanceMap} />}
        {step === 1 && <Step2 data={data} setData={setData} areaList={areaList} />}
        {step === 2 && <Step3 data={data} setData={setData} />}
        {step === 3 && <Step4 data={data} setData={setData} />}
      </div>

      {/* 하단 버튼 */}
      <div style={pStyles.bottomBar}>
        {isLast ? (
          <button style={pStyles.submitBtn} onClick={submit} disabled={saving}>
            {saving ? '저장 중…' : <><Check size={18} /> 조사 완료 · 저장</>}
          </button>
        ) : (
          <button style={pStyles.nextBtn} onClick={next}>
            다음 <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

const pStyles = {
  wrap: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' },
  topBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '12px', borderBottom: '1px solid #2e3347' },
  backBtn: { background: 'transparent', color: '#e8eaf0', padding: '6px', borderRadius: '8px', display: 'flex' },
  topTitle: { flex: 1, fontSize: '15px', fontWeight: '600' },
  stepCounter: { fontSize: '12px', color: '#8b90a7', background: '#22263a', padding: '3px 10px', borderRadius: '20px' },
  progressTrack: { height: '3px', background: '#2e3347' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #4f8ef7, #3ecf8e)', transition: 'width 0.3s ease' },
  tabs: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #2e3347' },
  tab: { background: 'transparent', padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', padding: '20px 16px' },
  stepTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '20px' },
  bottomBar: { padding: '12px 16px', borderTop: '1px solid #2e3347', background: '#0f1117' },
  nextBtn: {
    width: '100%', padding: '15px', background: '#4f8ef7', color: '#fff',
    fontSize: '16px', fontWeight: '600', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: '0 4px 16px #4f8ef740',
  },
  submitBtn: {
    width: '100%', padding: '15px', background: '#3ecf8e', color: '#0f1117',
    fontSize: '16px', fontWeight: '700', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: '0 4px 16px #3ecf8e40',
  },
}

const sStyles = {
  stepWrap: { display: 'flex', flexDirection: 'column', gap: '16px' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  moveCard: {
    background: '#1a1d27', border: '1.5px solid #2e3347', borderRadius: '12px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  moveHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  moveBadge: { fontSize: '11px', fontWeight: '700', color: '#f7954f', background: '#f7954f15', padding: '3px 8px', borderRadius: '6px' },
  removeBtn: { background: '#f75f5f15', color: '#f75f5f', padding: '5px', borderRadius: '6px', display: 'flex' },
  addBtn: {
    background: '#22263a', color: '#4f8ef7', border: '1.5px dashed #4f8ef750',
    padding: '12px', borderRadius: '10px', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    fontSize: '14px', fontWeight: '500',
  },
  linkedBadge: {
    display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content',
    fontSize: '11px', color: '#3ecf8e', background: '#3ecf8e15', padding: '2px 8px', borderRadius: '6px',
  },
  formulaCard: {
    background: '#f7954f08', border: '1.5px solid #f7954f30', borderRadius: '12px', padding: '14px',
    display: 'flex', flexDirection: 'column',
  },
  cameraBtn: {
    background: '#4f8ef715', color: '#4f8ef7', border: '1.5px solid #4f8ef740',
    padding: '14px', borderRadius: '12px', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    fontSize: '15px', fontWeight: '600',
  },
  emptyPhoto: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' },
  photoGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  photoItem: { display: 'flex', flexDirection: 'column', gap: '6px' },
  photoImg: { width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px' },
  photoRemove: {
    position: 'absolute', top: '8px', right: '8px',
    background: '#0f1117cc', color: '#f75f5f', border: 'none',
    borderRadius: '50%', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  photoMeta: {
    position: 'absolute', bottom: '8px', left: '8px',
    background: '#0f1117cc', color: '#e8eaf0',
    fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
    fontFamily: 'monospace',
  },
  compressStats: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#22263a', borderRadius: '8px', padding: '10px 12px',
    fontSize: '12px',
  },
  saveBadge: {
    background: '#3ecf8e15', color: '#3ecf8e',
    fontSize: '11px', fontWeight: '600',
    padding: '4px 8px', borderRadius: '6px',
  },
  packPhotoBtn: {
    background: '#f7954f10', color: '#f7954f', border: '1.5px dashed #f7954f40',
    padding: '14px', borderRadius: '12px', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    fontSize: '14px', fontWeight: '600',
  },
  packPhotoWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  packPhotoImg: { width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px' },
  packPhotoRemove: {
    position: 'absolute', top: '8px', right: '8px',
    background: '#0f1117cc', color: '#f75f5f', border: 'none',
    borderRadius: '50%', width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  packPhotoMeta: {
    position: 'absolute', bottom: '8px', left: '8px',
    background: '#0f1117cc', color: '#e8eaf0',
    fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
    fontFamily: 'monospace',
  },
  packPhotoRetake: {
    background: '#22263a', color: '#8b90a7', border: '1px solid #2e3347',
    padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },
}
