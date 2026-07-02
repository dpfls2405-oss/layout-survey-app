import * as XLSX from 'xlsx'

const FIELD_ALIASES = {
  materialName: ['자재명', '품목명', '품명', '자재', '품목', 'materialname', 'material', 'itemname', 'name'],
  partNo: ['품목코드', 'partno', 'part', '품번', '파트넘버', 'p/n', 'pn', 'partnumber'],
  fromArea: ['from', '출발지', '출발공정'],
  toArea: ['to', '도착지', '도착공정'],
  materialAccount: ['자재계정'],
  procurementType: ['조달구분'],
  bomLevel: ['bom단계', 'bom레벨', 'level'],
  shopName: ['shop명', 'shop', '샵명', '공정', '라인', 'line'],
}

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/[\s_\-/]/g, '')
}

function buildHeaderMap(headers) {
  const map = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeHeader)
    const match = headers.find(h => normalizedAliases.includes(normalizeHeader(h)))
    if (match) map[field] = match
  }
  return map
}

function pick(row, headerMap, field) {
  const header = headerMap[field]
  if (!header) return ''
  return String(row[header] ?? '').trim()
}

function parseModelFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '')
  const parts = base.split('_')
  if (parts.length >= 2) return parts[0]
  return ''
}

export async function parseBomFile(file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

  if (rows.length === 0) {
    return { items: [], modelName: '', headers: [], skippedCount: 0 }
  }

  const headers = Object.keys(rows[0])
  const headerMap = buildHeaderMap(headers)

  let modelName = ''
  let skippedCount = 0
  const filenameModel = parseModelFromFilename(file.name)

  // 1단계: 모든 행을 파싱 (중복 품목코드 허용)
  const rawItems = []
  for (const row of rows) {
    const materialName = pick(row, headerMap, 'materialName')
    const partNo = pick(row, headerMap, 'partNo')
    if (!materialName && partNo && !modelName) {
      modelName = partNo
      continue
    }
    if (!materialName) {
      skippedCount++
      continue
    }
    rawItems.push({
      materialName,
      partNo,
      fromArea: pick(row, headerMap, 'fromArea'),
      toArea: pick(row, headerMap, 'toArea'),
      materialAccount: pick(row, headerMap, 'materialAccount'),
      procurementType: pick(row, headerMap, 'procurementType'),
      bomLevel: pick(row, headerMap, 'bomLevel'),
      shopName: pick(row, headerMap, 'shopName'),
    })
  }

  // 2단계: 같은 품목코드가 여러 행이면 다구간 경로로 병합
  // 키트장 등 중간경유지를 거치는 자재는 BOM에 2행으로 나옴:
  //   bomLevel 1: 마감 → 키트장  (먼저 이동)
  //   bomLevel 0: 키트장 → Main 조립_2F  (나중에 이동)
  // → routes: [{from:'마감', to:'키트장'}, {from:'키트장', to:'Main 조립_2F'}]
  const grouped = new Map()
  for (const item of rawItems) {
    const key = item.partNo || item.materialName
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  }

  const items = []
  for (const [, group] of grouped) {
    if (group.length === 1) {
      const it = group[0]
      items.push({
        materialName: it.materialName,
        partNo: it.partNo,
        modelName: '',
        shopName: it.shopName,
        fromArea: it.fromArea,
        toArea: it.toArea,
        routes: (it.fromArea || it.toArea)
          ? [{ from: it.fromArea, to: it.toArea, bomLevel: it.bomLevel }]
          : [],
        materialAccount: it.materialAccount,
        procurementType: it.procurementType,
        bomLevel: it.bomLevel,
      })
    } else {
      // bomLevel 내림차순 정렬 → 높은 레벨(원재료 쪽)이 먼저 이동
      const sorted = [...group].sort((a, b) => {
        const la = parseInt(a.bomLevel) || 0
        const lb = parseInt(b.bomLevel) || 0
        return lb - la
      })
      const routes = sorted
        .filter(it => it.fromArea || it.toArea)
        .map(it => ({ from: it.fromArea, to: it.toArea, bomLevel: it.bomLevel }))

      const first = sorted[0]
      items.push({
        materialName: first.materialName,
        partNo: first.partNo,
        modelName: '',
        shopName: first.shopName,
        fromArea: routes.length > 0 ? routes[0].from : first.fromArea,
        toArea: routes.length > 0 ? routes[routes.length - 1].to : first.toArea,
        routes,
        materialAccount: first.materialAccount,
        procurementType: first.procurementType,
        bomLevel: first.bomLevel,
      })
    }
  }

  if (!modelName && filenameModel) modelName = filenameModel

  return { items, modelName, headers, headerMap, skippedCount }
}
