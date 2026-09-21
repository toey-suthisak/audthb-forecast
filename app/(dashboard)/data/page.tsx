import Card from "@/components/v2/Card";
import BadgeChip from "@/components/v2/BadgeChip";
import DonutGauge from "@/components/v2/DonutGauge";
import { getLocale } from "@/lib/i18n-server";
import { getDashboardData } from "@/lib/dashboard-data";
import { getDataHealth, type DataRow } from "@/lib/data-health-data";
import type { ChipTone } from "@/components/v2/BadgeChip";

export const dynamic = "force-dynamic";

const STR = {
  en: {
    title: "Data & Source Monitor",
    subtitle: "Check the freshness and completeness of every data feed behind this dashboard.",
    dataHealth: "Data Health",
    dataHealthNote: "Coverage is the share of the model's data that's actually available right now, not the accuracy of any score.",
    dataAlerts: "Data Alerts",
    sourceStatus: "Source Status",
    operational: "Operational",
    degraded: "Degraded",
    colData: "Data",
    colValue: "Value (Latest)",
    colUpdated: "Last Updated",
    colSource: "Source",
    colStatus: "Status",
    never: "--",
  },
  th: {
    title: "ข้อมูล & แหล่งข้อมูล",
    subtitle: "ตรวจสอบความสดใหม่และความครบถ้วนของฟีดข้อมูลทุกตัวที่อยู่เบื้องหลังแดชบอร์ดนี้",
    dataHealth: "ความสมบูรณ์ของข้อมูล",
    dataHealthNote: "ความครบถ้วนคือสัดส่วนข้อมูลที่โมเดลมีอยู่จริงตอนนี้ ไม่ใช่ความแม่นยำของคะแนนใดๆ",
    dataAlerts: "การแจ้งเตือนข้อมูล",
    sourceStatus: "สถานะแหล่งข้อมูล",
    operational: "ทำงานปกติ",
    degraded: "มีปัญหา",
    colData: "ข้อมูล",
    colValue: "ค่าล่าสุด",
    colUpdated: "อัปเดตล่าสุด",
    colSource: "แหล่งข้อมูล",
    colStatus: "สถานะ",
    never: "--",
  },
} as const;

function statusTone(status: string): ChipTone {
  if (status === "FRESH" || status === "HIGH" || status === "GOOD") return "emerald";
  if (status === "DELAYED" || status === "MEDIUM" || status === "MARKET_CLOSED") return "amber";
  if (status === "STALE" || status === "MISSING" || status === "LOW" || status === "INVALID") return "red";
  return "slate";
}

function formatUpdated(row: DataRow, locale: "en" | "th"): string {
  if (!row.updatedAt) return STR[locale].never;
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.updatedAt)) return row.updatedAt;
  return new Date(row.updatedAt).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function DataPage() {
  const locale = await getLocale();
  const t = STR[locale];
  const dashboard = await getDashboardData();
  const health = await getDataHealth(dashboard, locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-v2-foreground">{t.title}</h1>
        <p className="text-sm text-v2-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title={t.colData} className="lg:col-span-2" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-v2-muted border-b border-v2-border">
                  <th className="px-5 py-2.5 font-medium">{t.colData}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colValue}</th>
                  <th className="px-5 py-2.5 font-medium hidden sm:table-cell">{t.colUpdated}</th>
                  <th className="px-5 py-2.5 font-medium hidden md:table-cell">{t.colSource}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {health.rows.map((row) => (
                  <tr key={row.key} className="border-b border-v2-border last:border-b-0">
                    <td className="px-5 py-2.5 text-v2-foreground font-medium">{row.label}</td>
                    <td className="px-5 py-2.5 font-mono text-v2-foreground">{row.value ?? "--"}</td>
                    <td className="px-5 py-2.5 text-v2-muted hidden sm:table-cell">{formatUpdated(row, locale)}</td>
                    <td className="px-5 py-2.5 text-v2-muted hidden md:table-cell">{row.source}</td>
                    <td className="px-5 py-2.5">
                      <BadgeChip label={row.status} tone={statusTone(row.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t.dataHealth}>
            <div className="flex items-center gap-4">
              <DonutGauge value={health.coveragePct} max={100} label={health.coveragePct.toFixed(1)} sublabel="/100" />
              <p className="text-xs text-v2-muted leading-relaxed">{t.dataHealthNote}</p>
            </div>
          </Card>

          <Card title={t.dataAlerts}>
            <ul className="space-y-2">
              {health.alerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-v2-muted leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {alert}
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t.sourceStatus}>
            <div className="space-y-2">
              {health.sources.map((source) => (
                <div key={source.name} className="flex items-center justify-between text-sm">
                  <span className="text-v2-foreground">{source.name}</span>
                  <BadgeChip
                    label={source.operational ? t.operational : t.degraded}
                    tone={source.operational ? "emerald" : "red"}
                    dot
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
