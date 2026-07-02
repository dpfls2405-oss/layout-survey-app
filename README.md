# 레이아웃 운반강도 조사 앱

공장 현장 작업자가 모바일로 레이아웃 분석(From-To Chart, 자재 특성, 운반강도)을 조사할 수 있는 웹앱.

## 기능

- **4단계 입력 플로우**: 자재 특성 → 이동 경로 → 운반강도 → 현장 사진
- **운반난이도 지수 자동 계산**: `중량 × (1 + (주의 + 형상 + 용적) ÷ 100)`
- **종합 운반강도 자동 계산**: `운반난이도 지수 × 시간당 이동부하(Σ(구간거리×횟수)÷8시간)` — 거리·횟수·난이도를 종합해 품목별 운반강도를 산출, 레이아웃 재배치 우선순위 판단에 사용
- **품목 마스터 (BOM) 업로드**: 엑셀/CSV로 품목 목록을 업로드해 자재명 자동완성 및 조사 진행률(조사완료/미조사) 관리
- **운반강도 랭킹**: 품목별 종합 운반강도를 랭킹으로 확인, 미조사 품목도 함께 표시
- **사진 자동 압축**: 긴 변 1600px / JPEG 0.75 → 평균 85~95% 용량 절감
- **로컬 저장**: IndexedDB 기반 오프라인 동작
- **JSON 내보내기**: 조사 기록 일괄 다운로드

## 기술 스택

- React 18 + Vite
- React Router (HashRouter)
- IndexedDB (`idb`)
- SheetJS (`xlsx`) — BOM 엑셀/CSV 파싱
- Lucide React (아이콘)

## 로컬 실행

```bash
npm install
npm run dev    # http://localhost:5173
```

## 빌드

```bash
npm run build  # → dist/
npm run preview
```

## 배포

### Vercel (권장)

1. GitHub에 push
2. [vercel.com](https://vercel.com)에서 New Project → 이 repo 선택
3. Framework: Vite 자동 감지 → Deploy
4. 모바일에서 발급된 URL 접속

### 정적 호스팅 (Netlify, GitHub Pages 등)

`npm run build` 후 `dist/` 폴더 통째로 업로드.
GitHub Pages 사용 시 `vite.config.js`의 `base: './'` 그대로 두면 됨.

## 향후 확장

- [ ] Supabase 연동 (사진 → Storage, 데이터 → DB)
- [ ] From-To Chart Excel 내보내기
- [ ] 다중 작업자 동기화
