import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Keeps backtest_daily_rates (see
// supabase/migrations/20260920_create_backtest_daily_rates.sql) topped up
// with RBA's F11.1 daily series -- the same free CSV the original
// historical backfill used, now fetched automatically instead of by hand.
//
// RBA's endpoint sits behind Akamai bot detection that blocks curl and
// plain HTTP clients outright (verified: curl with full browser headers
// still gets HTTP 403), but a Node fetch() with an ordinary browser
// User-Agent passes -- verified manually before wiring this cron up.
// Vercel's Node runtime fetch behaves the same way curl doesn't, so this
// is expected to keep working, but RBA could tighten detection further
// at any time with no warning; a failure here just means the backtest's
// data stays a few days stale until it's noticed, not silent bad data.
const RBA_CSV_URL = "https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv";

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// RBA's "DD-Mon-YYYY" format (e.g. "18-Sep-2026") -- parsed by hand
// rather than via `new Date()`, which would depend on the runtime's
// locale/timezone for a non-ISO string like this.
function parseRbaDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1]}`;
}

type ParsedRow = { rate_date: string; aud_usd: number; aud_thb: number };

// Column layout is fixed by RBA's own header row: Title(date), A$1=USD,
// Trade-weighted Index, A$1=CNY, A$1=JPY, A$1=EUR, A$1=KRW, A$1=GBP,
// A$1=SGD, A$1=INR, A$1=THB, ... -- so USD is index 1 and THB is index
// 10 (0-indexed, date first). Data rows start right after the "Series
// ID" header line; everything before that is metadata (frequency, units,
// source, publication date).
function parseRbaCsv(csv: string): ParsedRow[] {
  const lines = csv.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
  const seriesIdIndex = lines.findIndex((l) => l.startsWith("Series ID"));
  if (seriesIdIndex === -1) return [];

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(seriesIdIndex + 1)) {
    const fields = line.split(",");
    const rateDate = parseRbaDate(fields[0] ?? "");
    const audUsd = Number(fields[1]);
    const audThb = Number(fields[10]);
    if (rateDate && Number.isFinite(audUsd) && Number.isFinite(audThb)) {
      rows.push({ rate_date: rateDate, aud_usd: audUsd, aud_thb: audThb });
    }
  }
  return rows;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("backtest_daily_rates")
      .select("rate_date")
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      return NextResponse.json(
        { updated: 0, error: `Failed to read current max date: ${latestError.message}` },
        { status: 500 },
      );
    }

    const response = await fetch(RBA_CSV_URL, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/csv,application/csv,*/*",
        Referer: "https://www.rba.gov.au/statistics/tables/",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { updated: 0, error: `RBA CSV fetch failed: HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const rows = parseRbaCsv(await response.text());

    if (rows.length === 0) {
      return NextResponse.json(
        { updated: 0, error: "Parsed zero rows from RBA CSV -- format may have changed" },
        { status: 502 },
      );
    }

    const newRows = latest ? rows.filter((r) => r.rate_date > latest.rate_date) : rows;

    if (newRows.length === 0) {
      return NextResponse.json({
        updated: 0,
        message: "No new rows -- already up to date",
        latestDate: latest?.rate_date ?? null,
      });
    }

    const { error: upsertError } = await supabaseAdmin
      .from("backtest_daily_rates")
      .upsert(
        newRows.map((r) => ({ ...r, source: "RBA F11.1" })),
        { onConflict: "rate_date" },
      );

    if (upsertError) {
      return NextResponse.json({ updated: 0, error: `Upsert failed: ${upsertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      updated: newRows.length,
      previousLatestDate: latest?.rate_date ?? null,
      newLatestDate: newRows[newRows.length - 1].rate_date,
    });
  } catch (error) {
    console.error("Backtest update error:", error);
    return NextResponse.json(
      { updated: 0, error: "Backtest update failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
