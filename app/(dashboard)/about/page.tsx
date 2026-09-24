import Card from "@/components/v2/Card";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "About AUD/THB Forecast",
    subtitle: "How this app calculates and sources everything it shows you.",
    methodology: "How the FX Score is calculated",
    methodologyIntro: "Core FX Score is a weighted average of 7 factors, each scored -100 (bearish AUD) to +100 (bullish AUD).",
    factors: [
      { name: "Price / Momentum", weight: "35%", note: "1H/4H momentum from this project's own live AUD/THB feed." },
      { name: "Cross Currency", weight: "20%", note: "AUD/USD × USD/THB, matched-time, cross-checks the Direct feed." },
      { name: "Relative Market", weight: "15%", note: "AU-US 2Y yield spread, USD/CNH, USD/SGD." },
      { name: "Commodity", weight: "8%", note: "Iron Ore and Brent -- AUD's terms-of-trade link." },
      { name: "Mean Reversion", weight: "5%", note: "Today's range position -- a price that moved far tends to snap back a little." },
      { name: "Macro / Policy", weight: "10%", note: "RBA/Fed policy, inflation, labour, growth." },
      { name: "Risk / VIXY", weight: "7%", note: "AUD is a risk currency -- sold for safety when markets get volatile." },
    ],
    dataSources: "Data Sources",
    sources: [
      { name: "FX Market Data", value: "Twelve Data" },
      { name: "AUD/THB Cross", value: "AUD/USD × USD/THB (matched-time)" },
      { name: "Relative Asian FX", value: "USD/CNH, USD/SGD, GBP/USD via Twelve Data" },
      { name: "AU 2Y Yield", value: "RBA via DBnomics" },
      { name: "US 2Y Yield", value: "Federal Reserve via DBnomics" },
      { name: "Iron Ore / Brent", value: "OilPriceAPI (live), EIA (historical reference)" },
      { name: "Gold", value: "Gold-API" },
      { name: "Risk / Volatility", value: "VIXY via Twelve Data" },
      { name: "Economic Calendar", value: "ForexFactory public weekly export" },
      { name: "News Signals", value: "Alpha Vantage News + Google Gemini" },
      { name: "AUD/THB Reference", value: "Yahoo Finance (unofficial, comparison only)" },
    ],
    regime: "Market Regime",
    regimeBody:
      "Each of the 7 factors above contributes score * weight / available weight to the final Core FX Score -- Score Explained (Analysis tab) shows which factor's contribution is largest right now, labeled MIXED when no single factor clearly leads (under 35% of the total). This is a real decomposition of the same number shown everywhere else, not a separate model.",
    prefund: "Prefund / Postfund Logic",
    prefundBody:
      "Action Bias reuses the exact same Core FX Score thresholds used everywhere else in this app: Core FX Score >= +15 reads as a Postfund lean, <= -15 as a Prefund lean, and anything between as no clear lean. This is informational only -- it describes the model's current signal, not a recommendation to act, and the underlying forecast's real correlation with Core FX Score is still weak (see Performance tab for real accuracy numbers).",
    limitations: "Limitations",
    limitationsBody: [
      "The Forecast engine (1H/4H/DAILY) fits a slope/intercept against real resolved forecasts and shrinks it toward the original naive assumption by how weak that real correlation is (R² 0.4%-2.7% across horizons as of 2026-09-24) -- not a confidently fitted statistical model. Track Record (Performance tab) is the only honest measure of how well it actually performs, and it currently sometimes performs at or below a naive \"no change\" baseline.",
      "Gold is tracked but not yet included in Core FX Score.",
      "This project's own AUD/THB price history only goes back to 2026-09-11 -- technical indicators, correlation, and event-reaction analysis all get more reliable as more real history accumulates, not less.",
      "No live news-narrative source is wired into this app -- News Signals is an experimental, separate context feed, not part of Core FX Score.",
    ],
    goal: "Our Goal",
    goalBody: "Give a clear, honest, real-data-only picture of what's actually moving AUD/THB and how reliable this project's own signals have been so far -- not to predict the future with false confidence.",
    notAdvice: "Not Financial Advice",
    notAdviceBody: "This website is for informational and research purposes only and does not constitute investment advice. FX markets involve real risk -- please use your own judgment and consult a licensed advisor before making financial decisions.",
  },
  th: {
    title: "เกี่ยวกับ AUD/THB Forecast",
    subtitle: "วิธีคำนวณและที่มาของข้อมูลทุกจุดในแอปนี้",
    methodology: "วิธีคำนวณ FX Score",
    methodologyIntro: "Core FX Score คือค่าเฉลี่ยถ่วงน้ำหนักจาก 7 ปัจจัย แต่ละตัวให้คะแนน -100 (ขาลง AUD) ถึง +100 (ขาขึ้น AUD)",
    factors: [
      { name: "ราคา / โมเมนตัม", weight: "35%", note: "โมเมนตัม 1H/4H จากฟีด AUD/THB จริงของระบบนี้" },
      { name: "Cross Currency", weight: "20%", note: "AUD/USD × USD/THB จับคู่เวลา ตรวจสอบฟีด Direct ซ้ำอีกทาง" },
      { name: "Relative Market", weight: "15%", note: "ส่วนต่างผลตอบแทนพันธบัตร AU-US 2 ปี, USD/CNH, USD/SGD" },
      { name: "สินค้าโภคภัณฑ์", weight: "8%", note: "แร่เหล็กและเบรนท์ -- ความเชื่อมโยงเชิง terms-of-trade ของ AUD" },
      { name: "Mean Reversion", weight: "5%", note: "ตำแหน่งราคาในกรอบวันนี้ -- ราคาที่วิ่งไกลมักดีดกลับมาบ้าง" },
      { name: "Macro / นโยบาย", weight: "10%", note: "นโยบาย RBA/Fed, เงินเฟ้อ, การจ้างงาน, การเติบโต" },
      { name: "ความเสี่ยง / VIXY", weight: "7%", note: "AUD เป็น risk currency -- ถูกขายเพื่อความปลอดภัยเมื่อตลาดผันผวน" },
    ],
    dataSources: "แหล่งข้อมูล",
    sources: [
      { name: "ข้อมูลตลาด FX", value: "Twelve Data" },
      { name: "AUD/THB แบบ Cross", value: "AUD/USD × USD/THB (จับคู่เวลา)" },
      { name: "ค่าเงินเอเชียที่เกี่ยวข้อง", value: "USD/CNH, USD/SGD, GBP/USD ผ่าน Twelve Data" },
      { name: "ผลตอบแทนพันธบัตรออสเตรเลีย 2 ปี", value: "RBA ผ่าน DBnomics" },
      { name: "ผลตอบแทนพันธบัตรสหรัฐ 2 ปี", value: "Federal Reserve ผ่าน DBnomics" },
      { name: "แร่เหล็ก / เบรนท์", value: "OilPriceAPI (เรียลไทม์), EIA (ข้อมูลย้อนหลังอ้างอิง)" },
      { name: "ทองคำ", value: "Gold-API" },
      { name: "ความเสี่ยง / ความผันผวน", value: "VIXY ผ่าน Twelve Data" },
      { name: "ปฏิทินเศรษฐกิจ", value: "ForexFactory (weekly export สาธารณะ)" },
      { name: "สัญญาณข่าว", value: "Alpha Vantage News + Google Gemini" },
      { name: "AUD/THB อ้างอิง", value: "Yahoo Finance (ไม่เป็นทางการ ใช้เปรียบเทียบเท่านั้น)" },
    ],
    regime: "Market Regime",
    regimeBody:
      "ปัจจัยทั้ง 7 ด้านบนแต่ละตัวมีส่วนสนับสนุนคะแนน = score * weight / น้ำหนักที่มีข้อมูล ต่อ Core FX Score สุดท้าย -- หน้า Score Explained (แท็บ Analysis) จะโชว์ว่าปัจจัยไหนมีสัดส่วนมากที่สุดตอนนี้ และจะขึ้น MIXED เมื่อไม่มีปัจจัยไหนเด่นชัด (ต่ำกว่า 35% ของทั้งหมด) นี่คือการแตกตัวเลขเดียวกับที่แสดงอยู่ทั่วหน้านี้ ไม่ใช่โมเดลแยกต่างหาก",
    prefund: "ตรรกะ Prefund / Postfund",
    prefundBody:
      "Action Bias ใช้ threshold ของ Core FX Score ตัวเดียวกับที่ใช้ทั้งแอป: Core FX Score >= +15 อ่านว่าเอนไปทาง Postfund, <= -15 อ่านว่าเอนไปทาง Prefund นอกนั้นถือว่ายังไม่มีทิศทางชัดเจน เป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำให้ลงมือทำ และความสัมพันธ์จริงระหว่าง forecast กับ Core FX Score ยังอ่อนอยู่ (ดูตัวเลขความแม่นยำจริงที่แท็บ Performance)",
    limitations: "ข้อจำกัด",
    limitationsBody: [
      "Forecast engine (1H/4H/DAILY) ปรับเทียบ (calibrate) ค่า slope/intercept จากผลพยากรณ์จริงที่มีผลแล้ว แล้วดึงเข้าใกล้สมมติฐานเดิมตามความอ่อนของความสัมพันธ์จริง (R² 0.4%-2.7% ในแต่ละกรอบเวลา ณ 2026-09-24) ไม่ใช่โมเดลที่ fit ทางสถิติแบบมั่นใจเต็มที่ Track Record (แท็บ Performance) คือตัวชี้วัดความแม่นยำจริงเพียงอย่างเดียวที่เชื่อถือได้ และตอนนี้บางช่วงเวลายังแม่นยำเท่ากับหรือแย่กว่าการเดา 'ไม่เปลี่ยนแปลง' ธรรมดา",
      "ทองคำถูกเก็บข้อมูลไว้แล้วแต่ยังไม่ถูกนำไปคิดคะแนน Core FX Score",
      "ประวัติราคา AUD/THB ของระบบนี้เริ่มเก็บตั้งแต่ 2026-09-11 เท่านั้น -- ตัวชี้วัดทางเทคนิค ความสัมพันธ์เชิงสถิติ และการวิเคราะห์ผลกระทบข่าว จะแม่นยำขึ้นเรื่อยๆ เมื่อมีข้อมูลจริงสะสมมากขึ้น",
      "ไม่มีแหล่งข่าวสดเชื่อมต่อกับแอปนี้ -- สัญญาณข่าวเป็นฟีดทดลองแยกต่างหาก ไม่ได้อยู่ใน Core FX Score",
    ],
    goal: "เป้าหมายของเรา",
    goalBody: "ให้ภาพที่ชัดเจน ซื่อตรง และอ้างอิงข้อมูลจริงเท่านั้นว่าอะไรกำลังขับเคลื่อน AUD/THB จริงๆ และสัญญาณของระบบนี้แม่นยำแค่ไหนที่ผ่านมา ไม่ใช่การทำนายอนาคตด้วยความมั่นใจปลอมๆ",
    notAdvice: "ไม่ใช่คำแนะนำทางการเงิน",
    notAdviceBody: "เว็บไซต์นี้จัดทำเพื่อการให้ข้อมูลและการวิจัยเท่านั้น ไม่ถือเป็นคำแนะนำการลงทุน ตลาด FX มีความเสี่ยงจริง โปรดใช้วิจารณญาณของตัวเองและปรึกษาที่ปรึกษาที่มีใบอนุญาตก่อนตัดสินใจทางการเงิน",
  },
} as const;

export default async function AboutPage() {
  const locale = await getLocale();
  const t = STR[locale];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-v2-foreground">{t.title}</h1>
        <p className="text-sm text-v2-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={t.methodology}>
          <p className="text-sm text-v2-muted mb-4">{t.methodologyIntro}</p>
          <ol className="space-y-3">
            {t.factors.map((f, i) => (
              <li key={f.name} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-v2-foreground">
                    {f.name} <span className="text-v2-muted font-normal">-- {f.weight}</span>
                  </p>
                  <p className="text-xs text-v2-muted mt-0.5">{f.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card title={t.regime}>
            <p className="text-sm text-v2-muted leading-relaxed">{t.regimeBody}</p>
          </Card>
          <Card title={t.prefund}>
            <p className="text-sm text-v2-muted leading-relaxed">{t.prefundBody}</p>
          </Card>
        </div>
      </div>

      <Card title={t.dataSources}>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {t.sources.map((s) => (
            <p key={s.name} className="flex justify-between gap-3 py-1 border-b border-v2-border last:border-b-0 sm:border-none">
              <span className="text-v2-muted">{s.name}</span>
              <span className="text-v2-foreground text-right">{s.value}</span>
            </p>
          ))}
        </div>
      </Card>

      <Card title={t.limitations}>
        <ul className="space-y-2 list-disc list-inside text-sm text-v2-muted">
          {t.limitationsBody.map((line, i) => (
            <li key={i} className="leading-relaxed">{line}</li>
          ))}
        </ul>
      </Card>

      <div className="grid sm:grid-cols-2 gap-6">
        <Card title={t.goal} className="bg-blue-50/50 dark:bg-blue-500/5">
          <p className="text-sm text-v2-muted leading-relaxed">{t.goalBody}</p>
        </Card>
        <Card title={t.notAdvice} className="bg-amber-50/50 dark:bg-amber-500/5">
          <p className="text-sm text-v2-muted leading-relaxed">{t.notAdviceBody}</p>
        </Card>
      </div>
    </div>
  );
}
