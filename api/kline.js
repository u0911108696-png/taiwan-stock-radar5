module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const code = String((req.query && req.query.code) || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const daysInput = Number((req.query && req.query.days) || 30);
    const days = Number.isFinite(daysInput)
      ? Math.max(7, Math.min(120, Math.floor(daysInput)))
      : 30;

    if (!code) {
      return res.status(200).json({
        ok: false,
        code: "",
        days,
        source: "Yahoo Finance Daily K",
        message: "缺少股票代號 code",
        klines: [],
        data: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const twResult = await fetchYahooKLine(`${code}.TW`, days);

    if (twResult.ok && twResult.klines.length >= 7) {
      return res.status(200).json({
        ok: true,
        code,
        symbol: `${code}.TW`,
        days,
        source: "Yahoo Finance Daily K",
        count: twResult.klines.length,
        klines: twResult.klines,
        data: twResult.klines,
        updatedAt: new Date().toISOString(),
      });
    }

    const twoResult = await fetchYahooKLine(`${code}.TWO`, days);

    if (twoResult.ok && twoResult.klines.length >= 7) {
      return res.status(200).json({
        ok: true,
        code,
        symbol: `${code}.TWO`,
        days,
        source: "Yahoo Finance Daily K",
        count: twoResult.klines.length,
        klines: twoResult.klines,
        data: twoResult.klines,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: false,
      code,
      days,
      source: "Yahoo Finance Daily K",
      message: twResult.message || twoResult.message || "Yahoo 日K資料不足，使用簡化ATR備援。",
      klines: [],
      data: [],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      source: "Yahoo Finance Daily K Safe",
      message: error && error.message ? error.message : "日K API 安全錯誤，使用簡化ATR備援。",
      klines: [],
      data: [],
      updatedAt: new Date().toISOString(),
    });
  }
};

async function fetchYahooKLine(symbol, days) {
  try {
    const rangeDays = Math.max(days + 45, 90);

    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?range=" +
      rangeDays +
      "d&interval=1d&events=history&includeAdjustedClose=true";

    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, 6000);

    let response;

    try {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response || !response.ok) {
      return {
        ok: false,
        message: "Yahoo HTTP " + (response ? response.status : "no response"),
        klines: [],
      };
    }

    const json = await response.json();
    const result = json && json.chart && json.chart.result && json.chart.result[0];

    if (!result) {
      const msg =
        json &&
        json.chart &&
        json.chart.error &&
        (json.chart.error.description || json.chart.error.code);

      return {
        ok: false,
        message: msg || "Yahoo 無日K資料",
        klines: [],
      };
    }

    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote =
      result.indicators &&
      result.indicators.quote &&
      result.indicators.quote[0]
        ? result.indicators.quote[0]
        : {};

    const opens = Array.isArray(quote.open) ? quote.open : [];
    const highs = Array.isArray(quote.high) ? quote.high : [];
    const lows = Array.isArray(quote.low) ? quote.low : [];
    const closes = Array.isArray(quote.close) ? quote.close : [];
    const volumes = Array.isArray(quote.volume) ? quote.volume : [];

    const klines = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = toNumber(opens[i]);
      const high = toNumber(highs[i]);
      const low = toNumber(lows[i]);
      const close = toNumber(closes[i]);
      const volume = toNumber(volumes[i]);

      if (open > 0 && high > 0 && low > 0 && close > 0) {
        klines.push({
          date: toTaiwanDate(timestamps[i]),
          open: round2(open),
          high: round2(high),
          low: round2(low),
          close: round2(close),
          volume: Math.round(volume),
        });
      }
    }

    const sliced = klines.slice(-days);

    return {
      ok: sliced.length >= 7,
      message: sliced.length >= 7 ? "success" : "日K資料不足",
      klines: sliced,
    };
  } catch (error) {
    return {
      ok: false,
      message: error && error.message ? error.message : "Yahoo 日K讀取失敗",
      klines: [],
    };
  }
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toTaiwanDate(timestampSeconds) {
  try {
    const date = new Date(timestampSeconds * 1000);
    const taiwan = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));

    const y = taiwan.getFullYear();
    const m = String(taiwan.getMonth() + 1).padStart(2, "0");
    const d = String(taiwan.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  } catch {
    return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
  }
}