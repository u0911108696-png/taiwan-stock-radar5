export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "GET") {
      return res.status(200).json({
        ok: false,
        message: "Only GET method is allowed",
        klines: [],
        data: [],
      });
    }

    const code = String(req.query?.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const daysInput = Number(req.query?.days || 30);
    const days = Number.isFinite(daysInput)
      ? Math.max(7, Math.min(120, Math.floor(daysInput)))
      : 30;

    if (!code) {
      return res.status(200).json({
        ok: false,
        message: "缺少股票代號 code",
        example: "/api/kline?code=2330&days=30",
        klines: [],
        data: [],
      });
    }

    const symbols = [`${code}.TW`, `${code}.TWO`];

    let lastMessage = "尚未取得日K資料";

    for (const symbol of symbols) {
      const result = await getYahooKLineSafe(symbol, days);

      if (result.ok && result.klines.length >= 7) {
        return res.status(200).json({
          ok: true,
          code,
          symbol,
          source: "Yahoo Finance Daily K",
          days,
          count: result.klines.length,
          updatedAt: new Date().toISOString(),
          klines: result.klines,
          data: result.klines,
        });
      }

      lastMessage = result.message || `資料不足：${symbol}`;
    }

    return res.status(200).json({
      ok: false,
      code,
      source: "Yahoo Finance Daily K",
      message: lastMessage,
      klines: [],
      data: [],
    });
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      message: error?.message || "日K API 發生未知錯誤",
      klines: [],
      data: [],
    });
  }
}

async function getYahooKLineSafe(symbol: string, days: number) {
  try {
    const result = await fetchYahooDailyK(symbol, days);
    return {
      ok: result.klines.length >= 7,
      message: result.klines.length >= 7 ? "success" : "日K資料不足",
      klines: result.klines,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || "Yahoo 日K讀取失敗",
      klines: [],
    };
  }
}

async function fetchYahooDailyK(symbol: string, days: number) {
  const rangeDays = Math.max(days + 40, 90);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${rangeDays}d&interval=1d&events=history&includeAdjustedClose=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo HTTP ${response.status}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      const message =
        json?.chart?.error?.description ||
        json?.chart?.error?.code ||
        "Yahoo 無日K資料";
      throw new Error(message);
    }

    const timestamps: number[] = Array.isArray(result.timestamp)
      ? result.timestamp
      : [];

    const quote = result.indicators?.quote?.[0] || {};

    const opens: any[] = Array.isArray(quote.open) ? quote.open : [];
    const highs: any[] = Array.isArray(quote.high) ? quote.high : [];
    const lows: any[] = Array.isArray(quote.low) ? quote.low : [];
    const closes: any[] = Array.isArray(quote.close) ? quote.close : [];
    const volumes: any[] = Array.isArray(quote.volume) ? quote.volume : [];

    const klines = timestamps
      .map((time, index) => {
        const open = toNumber(opens[index]);
        const high = toNumber(highs[index]);
        const low = toNumber(lows[index]);
        const close = toNumber(closes[index]);
        const volume = toNumber(volumes[index]);

        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
          return null;
        }

        return {
          date: toTaiwanDate(time),
          open: round2(open),
          high: round2(high),
          low: round2(low),
          close: round2(close),
          volume,
        };
      })
      .filter(Boolean)
      .slice(-days);

    return { klines };
  } finally {
    clearTimeout(timeout);
  }
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toTaiwanDate(timestampSeconds: number) {
  try {
    const date = new Date(timestampSeconds * 1000);

    const year = date.toLocaleString("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
    });

    const month = date.toLocaleString("en-CA", {
      timeZone: "Asia/Taipei",
      month: "2-digit",
    });

    const day = date.toLocaleString("en-CA", {
      timeZone: "Asia/Taipei",
      day: "2-digit",
    });

    return `${year}-${month}-${day}`;
  } catch {
    return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
  }
}