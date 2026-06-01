const https = require("https");

const codes = [
  "2344", "3481", "6770", "3042", "2330",
  "2303", "2408", "2337", "2454", "2382",
  "3231", "6669", "2409", "2317", "2308",
  "2301", "2324", "2356", "2357", "2376",
  "2377", "3034", "3035", "3443", "3661",
  "2379", "6415", "3711", "8299", "2383",
  "3037", "3189", "8046", "2368", "3017",
  "3324", "3653", "1519", "1503", "1514",
  "1513", "2881", "2882", "2884", "2885",
  "2891", "2603", "2609", "2615", "2618"
];

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
  "2301": "光寶科",
  "2324": "仁寶",
  "2356": "英業達",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",
  "3034": "聯詠",
  "3035": "智原",
  "3443": "創意",
  "3661": "世芯-KY",
  "2379": "瑞昱",
  "6415": "矽力-KY",
  "3711": "日月光投控",
  "8299": "群聯",
  "2383": "台光電",
  "3037": "欣興",
  "3189": "景碩",
  "8046": "南電",
  "2368": "金像電",
  "3017": "奇鋐",
  "3324": "雙鴻",
  "3653": "健策",
  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
  "2881": "富邦金",
  "2882": "國泰金",
  "2884": "玉山金",
  "2885": "元大金",
  "2891": "中信金",
  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
  "2618": "長榮航"
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
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "3711": "半導體",
  "8299": "半導體",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",
  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",
  "2357": "電腦週邊",
  "2377": "電腦週邊",
  "2308": "電源能源",
  "2301": "電源能源",
  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",
  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",
  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",
  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2885": "金融",
  "2891": "金融",
  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空"
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
        timeout: 3500,
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

async function fetchOne(code) {
  for (const suffix of ["TW", "TWO"]) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.${suffix}?interval=1m&range=1d&t=${Date.now()}`;
    const json = await getJson(url);

    const result = json && json.chart && json.chart.result && json.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

    if (!meta || !quote) continue;

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

    if (!price || !previousClose) continue;

    const changePercent = ((price - previousClose) / previousClose) * 100;
    const openPremiumPercent =
      previousClose > 0 && openPrice > 0
        ? ((openPrice - previousClose) / previousClose) * 100
        : null;

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

async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const item = items[index];
      index += 1;

      const result = await worker(item);
      if (result) results.push(result);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const results = await runPool(codes, 5, fetchOne);

    const rankedStocks = results
      .filter((stock) => stock && stock.price > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 50);

    return res.status(200).json({
      ok: true,
      source: "api/realtime.js Yahoo stable 50",
      updatedAtTaiwan: now(),
      count: rankedStocks.length,
      rankedStocks,
      stocks: rankedStocks,
      data: rankedStocks,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      source: "api/realtime.js safe error",
      message: "realtime API 暫時失敗，但沒有崩潰",
      error: err && err.message ? err.message : String(err),
      updatedAtTaiwan: now(),
      count: 0,
      rankedStocks: [],
      stocks: [],
      data: [],
    });
  }
};