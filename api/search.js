const https = require("https");

const codeToChineseName = {
  "2330": "台積電",
  "2303": "聯電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2344": "華邦電",
  "2408": "南亞科",
  "2337": "旺宏",
  "3481": "群創",
  "2409": "友達",
  "6770": "力積電",
  "3042": "晶技",
};

const industryMap = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",
  "3481": "面板",
  "2409": "面板",
  "6770": "半導體",
  "3042": "其他",
};

function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function httpsJson(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        timeout: 7000,
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });

    req.on("error", () => {
      resolve(null);
    });
  });
}

function makeStock(raw) {
  const code = cleanCode(raw.code);
  const price = n(raw.price);
  const previousClose = n(raw.previousClose);
  const openPrice = n(raw.openPrice, price);
  const highPrice = Math.max(n(raw.highPrice, price), price, openPrice, previousClose);
  const lowPrice = Math.min(n(raw.lowPrice, price), price, openPrice || price, previousClose || price);
  const volume = n(raw.volume);

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  const openPremiumPercent =
    previousClose > 0 && openPrice > 0
      ? ((openPrice - previousClose) / previousClose) * 100
      : null;

  return {
    code,
    name: codeToChineseName[code] || raw.name || code,
    price,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: industryMap[code] || "其他",
    highPrice,
    lowPrice,
    updatedAt: raw.updatedAt || taiwanNowText(),
  };
}

async function fetchYahoo(code, suffix) {
  const symbol = `${code}.${suffix}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d&t=${Date.now()}`;

  const json = await httpsJson(url);
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  const meta = result && result.meta;
  const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

  if (!meta || !quote) return null;

  const closes = Array.isArray(quote.close)
    ? quote.close.filter((v) => Number.isFinite(Number(v)))
    : [];

  const opens = Array.isArray(quote.open)
    ? quote.open.filter((v) => Number.isFinite(Number(v)))
    : [];

  const highs = Array.isArray(quote.high)
    ? quote.high.filter((v) => Number.isFinite(Number(v)))
    : [];

  const lows = Array.isArray(quote.low)
    ? quote.low.filter((v) => Number.isFinite(Number(v)))
    : [];

  const volumes = Array.isArray(quote.volume)
    ? quote.volume.filter((v) => Number.isFinite(Number(v)))
    : [];

  const price = n(meta.regularMarketPrice || closes[closes.length - 1]);
  const previousClose = n(meta.previousClose || meta.chartPreviousClose);
  const openPrice = n(meta.regularMarketOpen || opens[0] || price);
  const highPrice = highs.length ? Math.max(...highs, price) : price;
  const lowPrice = lows.length ? Math.min(...lows, price) : price;
  const volume = n(
    meta.regularMarketVolume ||
      volumes.reduce((sum, v) => sum + Number(v), 0)
  );

  if (!price || !previousClose) return null;

  return makeStock({
    code,
    name: codeToChineseName[code],
    price,
    previousClose,
    openPrice,
    highPrice,
    lowPrice,
    volume,
    updatedAt: taiwanNowText(),
  });
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const q = cleanCode(req.query && req.query.q);

    if (!q) {
      return res.status(200).json({
        ok: false,
        message: "請輸入股票代號",
        updatedAtTaiwan: taiwanNowText(),
      });
    }

    let stock = await fetchYahoo(q, "TW");

    if (!stock) {
      stock = await fetchYahoo(q, "TWO");
    }

    if (!stock) {
      return res.status(200).json({
        ok: false,
        message: "即時資料暫時無法取得，但 API 沒有崩潰",
        code: q,
        updatedAtTaiwan: taiwanNowText(),
      });
    }

    return res.status(200).json({
      ok: true,
      source: "Yahoo realtime stable JS",
      updatedAtTaiwan: taiwanNowText(),
      stock,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      message: "API安全模式：資料暫時無法取得，但沒有崩潰",
      error: err && err.message ? err.message : String(err),
      updatedAtTaiwan: taiwanNowText(),
    });
  }
};