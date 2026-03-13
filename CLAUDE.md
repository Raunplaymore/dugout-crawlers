# DugOut Crawlers

KBO 선수 데이터 크롤링 모음 — 덕아웃 서비스(`my-favorite-squad`)와 분리된 독립 repo.

## 구조

```
scripts/
  crawl-matchup.ts    -- 투수 vs 타자 맞대결 (GitHub Actions 자동화)
  crawl-players.ts    -- KBO 선수 기본 정보 (타자/투수 기록 페이지)
  crawl-roster.ts     -- KBO 선수 검색 페이지 로스터
  crawl-defense.ts    -- 수비 기록 (그룹 캐싱)
  crawl-register.ts   -- 1군 등록 현황
  crawl-daily.ts      -- 일일 맞대결 업데이트 (당일 경기 팀만 대상)
  resolve-namuwiki.ts -- 나무위키 URL 해결 (3단계 탐색 + confidence)
  sync.ts             -- 선수 데이터 → API 동기화 (master script)
  sync-register.ts    -- 등록 현황 → API 동기화
  upload-d1.ts        -- 맞대결 데이터 → Cloudflare D1 업로드 (--upsert 지원)
```

## 서비스 연동

- API 호출로만 통신: `SYNC_SECRET` 헤더 + `API_URL` 환경변수
- 프로덕션 API: `https://api.lineup.prmtwiki.com`
- 주요 엔드포인트: `/sync/players`, `/sync/register`, `/sync/namu`

## Commands

- `npm run crawl:matchup` -- 맞대결 전체 크롤링 (시즌 초 1회)
- `npm run crawl:matchup:team -- LG` -- 팀별 맞대결
- `npm run crawl:daily` -- 일일 맞대결 업데이트 (`--date`, `--dry-run` 옵션)
- `npm run crawl:players` -- 선수 기본 정보
- `npm run crawl:defense` -- 수비 기록
- `npm run crawl:register` -- 1군 등록
- `npm run sync` -- 선수 데이터 동기화 (`--roster`, `--defense` 옵션)
- `npm run sync:register` -- 등록 현황 동기화
- `npm run resolve:namu` -- 나무위키 URL (`--recheck` 옵션)
- `npm run upload:matchup` -- D1 업로드 (`--upsert`, `--file` 옵션)

## GitHub Actions

- `crawl.yml`: 전체 맞대결 크롤링 (매일 KST 00:00, 10팀 병렬 매트릭스)
- `crawl-daily.yml`: 일일 맞대결 업데이트 (매일 KST 23:00, 당일 경기 팀만)
- `sync-entry.yml`: 선수 등록 현황 (매주 월 KST 09:00)
- `sync-defense.yml`: 수비 포지션 (수동)
- `resolve-namu.yml`: 나무위키 URL (수동)
- Secrets 필요: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_DATABASE_ID`, `SYNC_SECRET`

## 환경변수 (.env)

```
SYNC_SECRET=...
API_URL=https://api.lineup.prmtwiki.com
```

## 주의사항

- 크롤링 대상: `koreabaseball.com` — 요청 간격 2초 이상 유지
- 캐시 파일(`.json`)은 `.gitignore`에 포함, 커밋하지 않음
- `sync.ts`의 `--skip N` 옵션으로 배치 재개 가능
