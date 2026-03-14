/**
 * 1군 등록 현황 싱크 스크립트
 *
 * KBO 공식 사이트에서 1군 등록 선수를 크롤링하고 DB에 반영.
 * 시즌 중 Daily로 실행하여 registered 필드를 최신 상태로 유지.
 *
 * 사용법:
 *   npx tsx scripts/sync-register.ts                          # 로컬 (최신 날짜)
 *   npx tsx scripts/sync-register.ts 20260401                 # 특정 날짜
 *   npx tsx scripts/sync-register.ts https://...workers.dev   # 프로덕션
 *   npx tsx scripts/sync-register.ts 20260401 https://...     # 날짜 + 프로덕션
 */
import { crawlRegisterAll } from "./crawl-register";
import { sendTelegram } from "./lib/telegram";
import "dotenv/config";

const args = process.argv.slice(2);
const dateArg = args.find(a => /^\d{8}$/.test(a));
const urlArg = args.find(a => a.startsWith("http"));
const API_URL = urlArg || "http://localhost:3000";
const SYNC_SECRET = process.env.SYNC_SECRET;

if (!SYNC_SECRET) {
  console.error("SYNC_SECRET이 .env에 설정되어 있지 않습니다.");
  process.exit(1);
}

async function main() {
  console.log("=== 1군 등록 현황 싱크 ===\n");

  const { date, players } = await crawlRegisterAll(dateArg);
  console.log(`\n날짜: ${date}, 등록 선수: ${players.length}명`);

  if (players.length === 0) {
    console.log("등록 선수가 없습니다 (비시즌일 수 있음). 싱크 스킵.");
    return;
  }

  // 크롤링 실패 감지: 시즌 중 최소 100명 이상 예상
  if (players.length < 50) {
    console.warn(`⚠️ 등록 선수가 ${players.length}명으로 비정상적으로 적습니다. 크롤링 오류 가능성.`);
    await sendTelegram(`⚠️ <b>[sync-register] 경고</b>\n등록 선수 ${players.length}명 — 비정상적으로 적음.`);
  }

  // Workers 서브리퀘스트 제한 회피를 위해 배치 전송
  const BATCH_SIZE = 150;
  const batches = [];
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    batches.push(players.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n${API_URL}/sync/register 로 전송 중... (${batches.length}개 배치, 각 ${BATCH_SIZE}명)`);

  const allUnmatched: string[] = [];
  let totalMatched = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  배치 ${i + 1}/${batches.length} (${batch.length}명)...`);

    const res = await fetch(`${API_URL}/sync/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET!,
      },
      body: JSON.stringify({ players: batch, partial: batches.length > 1, batchIndex: i, totalBatches: batches.length }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      console.error(`Non-JSON response (${res.status}): ${text.substring(0, 300)}`);
      await sendTelegram(`🚨 <b>[sync-register] 실패</b>\nAPI Non-JSON 응답 (${res.status}) 배치 ${i + 1}`);
      process.exit(1);
    }

    if (!res.ok) {
      console.error(`\n싱크 실패 (배치 ${i + 1}):`, res.status, data);
      await sendTelegram(`🚨 <b>[sync-register] 싱크 실패</b>\n배치 ${i + 1}/${batches.length} HTTP ${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
      process.exit(1);
    }

    if (data.unmatchedList?.length > 0) allUnmatched.push(...data.unmatchedList);
    if (data.matched) totalMatched += data.matched;
  }

  console.log(`\n싱크 완료: 총 ${totalMatched}명 매칭`);
  if (allUnmatched.length > 0) {
    console.log("\n매칭 실패 선수:");
    for (const name of allUnmatched) {
      console.log(`  - ${name}`);
    }
  }
}

main().catch(async (e) => {
  console.error(e);
  await sendTelegram(`🚨 <b>[sync-register] 실패</b>\n${String(e).substring(0, 200)}`);
  process.exit(1);
});
