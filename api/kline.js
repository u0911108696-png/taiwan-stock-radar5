function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function cleanCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function fetchYahooChart(code, suffix) {
  const symbol = `${code}.${suffix}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${suffix} HTTP ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo ${suffix} 查無K線`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const candles = timestamps
    .map((ts, index) => {
      const open = toNumber(opens[index]);
      const high = toNumber(highs[index]);
      const low = toNumber(lows[index]);
      const close = toNumber(closes[index]);
      const volume = toNumber(volumes[index]);

      if (!open || !high || !low || !close) return null;

      return {
        time: new Date(ts * 1000).toLocaleDateString("sv-SE", {
          timeZone: "Asia/Taipei",
        }),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter(Boolean);

  if (candles.length === 0) {
    throw new Error(`Yahoo ${suffix} K線空資料`);
  }

  return {
    symbol,
    candles,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");

  const code = cleanCode(req.query.code || req.query.q || "");

  if (!code) {
    return res.status(200).json({
      ok: false,
      source: "kline v65",
      message: "請輸入股票代號",
      updatedAtTaiwan: taiwanNowText(),
      candles: [],
    });
  }

  try {
    let data;

    try {
      data = await fetchYahooChart(code, "TW");
    } catch {
      data = await fetchYahooChart(code, "TWO");
    }

    return res.status(200).json({
      ok: true,
      source: "Yahoo daily kline v65",
      updatedAtTaiwan: taiwanNowText(),
      code,
      symbol: data.symbol,
      count: data.candles.length,
      candles: data.candles,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      source: "kline v65 failed",
      message: "K線資料取得失敗",
      error: err?.message || String(err),
      updatedAtTaiwan: taiwanNowText(),
      code,
      candles: [],
    });
  }
}