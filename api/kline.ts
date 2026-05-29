export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Only GET method is allowed",
    });
  }

  try {
    const codeRaw = String(req.query.code || "").trim();
    const code = codeRaw.replace(/\D/g, "").slice(0, 6);

    const daysRaw = Number(req.query.days || 30);
    const days = Number.isFinite(daysRaw)
      ? Math.max(7, Math.min(120, Math.floor(daysRaw)))
      : 30;

    if (!code) {
      return res.status(400).json({
        ok: false,
        message: "缺少股票代號 code",
        example: "/api/kline?code=2330&days=30",
      });
    }

    const symbols = [`${code}.TW`, `${code}.TWO`];

    let finalResult: any = null;
    let finalSymbol = "";
    let finalError = "";

    for (const symbol of symbols) {
      try {
        const result = await fetchYahooDailyK(symbol, days);

        if (result.klines.length >= 7) {
          finalResult = result;
          finalSymbol = symbol;
          break;
        }

        finalError = `資料不足：${symbol}`;
      } catch (err: any) {
        finalError = err?.message || `Yahoo 日K讀取失敗：${symbol}`;
      }
    }

    if (!finalResult) {
      return res.status(200).json({
        ok: false,
        code,
        source: "Yahoo Finance",
        message: finalError || "日K資料讀取失敗",
        klines: [],
        data: [],
      });
    }

    return res.status(200).json({
      ok: true,
      code,
      symbol: finalSymbol,
      source: "Yahoo Finance Daily K",
      days,
      count: finalResult.klines.length,
      updatedAt: new Date().toISOString(),
      klines: finalResult.klines,
      data: finalResult.klines,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      message: err?.message || "日K API 發生錯誤",
      klines: [],
      data: [],
    });
  }
}

async function fetchYahooDailyK(symbol: string, days: number) {
  const rangeDays = Math.max(days + 30, 60);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${rangeDays}d&interval=1d&events=history&includeAdjustedClose=true`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`);
  }

  const json = await response.json();

  const result = json?.chart?.result?.[0];

  if (!result) {
    const errorText = json?.chart?.error?.description || "Yahoo 無回傳 result";
    throw new Error(errorText);
  }

  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const opens: number[] = quote.open || [];
  const highs: number[] = quote.high || [];
  const lows: number[] = quote.low || [];
  const closes: number[] = quote.close || [];
  const volumes: number[] = quote.volume || [];

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
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter(Boolean)
    .slice(-days);

  return { klines };
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toTaiwanDate(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);

  return date.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  });
}