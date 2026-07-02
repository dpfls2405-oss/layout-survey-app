// 이미지 압축 유틸
// - 긴 변을 maxSide(기본 1600px)로 축소
// - JPEG 품질 quality(기본 0.75)로 재인코딩
// - 결과: { dataUrl, blob, originalSize, compressedSize, ratio }

const DEFAULTS = {
  maxSide: 1600,
  quality: 0.75,
  mimeType: 'image/jpeg',
}

export async function compressImage(file, opts = {}) {
  const { maxSide, quality, mimeType } = { ...DEFAULTS, ...opts }
  const originalSize = file.size

  // 파일을 이미지로 디코드
  const bitmap = await loadBitmap(file)
  const { width: w, height: h } = bitmap

  // 비율 유지하면서 긴 변을 maxSide로
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const targetW = Math.round(w * scale)
  const targetH = Math.round(h * scale)

  // Canvas로 그리기
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  // 모바일 사진은 EXIF orientation이 들어있을 수 있어 createImageBitmap이 자동 처리해줌
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  if (bitmap.close) bitmap.close()

  // Blob으로 추출
  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, mimeType, quality)
  })

  // dataUrl 변환 (IndexedDB 저장용)
  const dataUrl = await blobToDataUrl(blob)

  return {
    dataUrl,
    blob,
    width: targetW,
    height: targetH,
    originalSize,
    compressedSize: blob.size,
    ratio: blob.size / originalSize,
  }
}

function loadBitmap(file) {
  // createImageBitmap이 EXIF orientation 자동 처리해서 가로/세로 정상화
  if (window.createImageBitmap) {
    return window.createImageBitmap(file, { imageOrientation: 'from-image' })
      .catch(() => loadViaImage(file)) // 일부 구형 브라우저 fallback
  }
  return loadViaImage(file)
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = err => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 사람이 읽기 쉬운 용량 표시
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
