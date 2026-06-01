const https = require("https");

const codes = ["2344", "3481", "6770", "3042", "2330", "2303", "2408", "2337", "2454", "2382", "3231", "6669", "2409", "2317", "2308"];

const names = {
  "2344": "華邦電",
  "3481": "群創",
  "6770": "力積電",
  "3042": "晶技",
  "2330": "台積電",
  "2303": "聯電",
  "2408": "南亞科",
  "2337": "旺宏",
  "2454": "聯發科",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2409": "友達",
  "2317": "鴻海",
  "2308": "台達電",
};

const industries = {
  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",
  "3481": "面板",
  "2409": "面板",
  "6770": "半導體",
  "3042": "其他",
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2317": "電子代工",
  "2308": "電源能源",
};

function now() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function n(v, f = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : f;
}

function getJson(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        timeout: 5000,
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

    req.on("error", () => resolve(null));
  });
}

async function fetchOne(code) {
  for (const suffix of ["TW", "TWO"]) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.${suffix}?interval=1m&range=1d&t=${Date.now()}`;
    const json = await getJson(url);

    const result = json && json.chart && json.chart.result && json.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

    if (!meta || !quote) continue;

    const closes = Array.isArray(quote.close) ? quote.close.filter((v) => Number.isFinite(Number(v))) : [];
    const opens = Array.isArray(quote.open) ? quote.open.filter((v) => Number.isFinite(Number(v))) : [];
    const highs = Array.isArray(quote.high) ? quote.high.filter((v) => Number.isFinite(Number(v))) : [];
    const lows = Array.isArray(quote.low) ? quote.low.filter((v) => Number.isFinite(Number(v))) : [];
    const volumes = Array.isArray(quote.volume) ? quote.volume.filter((v) => Number.isFinite(Number(v))) : [];

    const price = n(meta.regularMarketPrice || closes[closes.length - 1]);
    const previousClose = n(meta.previousClose || meta.chartPreviousClose);
    const openPrice = n(meta.regularMarketOpen || opens[0] || price);
    const highPrice = highs.length ? Math.max(...highs, price) : price;
    const lowPrice = lows.length ? Math.min(...lows, price) : price;
    const volume = n(meta.regularMarketVolume || volumes.reduce((sum, v) => sum + Number(v), 0));

    if (!price || !previousClose) continue;

    const changePercent = ((price - previousClose) / previousClose) * 100;
    const openPremiumPercent = previousClose > 0 && openPrice > 0 ? ((openPrice - previousClose) / previousClose) * 100 : null;

    return {
      code,
      name: names[code] || code,
      price,
      changePercent,
      volume,
      openPrice,
      previousClose,
      openPremiumPercent,
      industry: industries[code] || "其他",
      highPrice: Math.max(highPrice, price, openPrice, previousClose),
      lowPrice: Math.min(lowPrice || price, price, openPrice || price, previousClose || price),
      updatedAt: now(),
    };
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const results = [];

  for (const code of codes) {
    const stock = await fetchOne(code);
    if (stock) results.push(stock);
  }

  const rankedStocks = results.sort((a, b) => b.changePercent - a.changePercent);

  return res.status(200).json({
    ok: true,
    source: "api/realtime.js Yahoo stable",
    updatedAtTaiwan: now(),
    count: rankedStocks.length,
    rankedStocks,
    stocks: rankedStocks,
    data: rankedStocks,
  });
};