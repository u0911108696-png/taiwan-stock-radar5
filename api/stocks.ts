import * as https from "https";

type StockPayload = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  industry: string;
  highPrice: number;
  lowPrice: number;
  updatedAt: string;
};

const codeToChineseName: Record<string, string> = {
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

  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2324": "仁寶",
  "2356": "英業達",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",

  "2308": "台達電",
  "2301": "光寶科",

  "8299": "群聯",
  "3443": "創意",
  "3661": "世芯-KY",
  "3035": "智原",
  "3034": "聯詠",
  "2379": "瑞昱",
  "6415": "矽力-KY",
  "3711": "日月光投控",

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
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "8299": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3035": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

  "3481": "面板",
  "2409": "面板",

  "3042": "其他",

  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",

  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",

  "2357": "電腦週邊",
  "2377": "電腦週邊",

  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",

  "2308": "電源能源",
  "2301": "電源能源",

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
};

const stockUniverse = Object.keys(codeToChineseName);

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function httpsJson(url: string): Promise<any> {
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
function makeStock(raw: {
  code: string;
  name?: string;
  price: number;
  previousClose: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  updatedAt?: string;
}): StockPayload {
  const changePercent =
    raw.previousClose > 0 ? ((raw.price - raw.previousClose) / raw.previousClose) * 100 : 0;

  const openPremiumPercent =
    raw.previousClose > 0 && raw.openPrice > 0
      ? ((raw.openPrice - raw.previousClose) / raw.previousClose) * 100
      : null;

  return {
    code: raw.code,
    name: codeToChineseName[raw.code] || raw.name || raw.code,
    price: raw.price,
    changePercent,
    volume: raw.volume,
    openPrice: raw.openPrice || raw.price,
    previousClose: raw.previousClose,
    openPremiumPercent,
    industry: industryMap[raw.code] || "其他",
    highPrice: Math.max(raw.highPrice, raw.price, raw.openPrice, raw.previousClose),
    lowPrice: Math.min(raw.lowPrice || raw.price, raw.price, raw.openPrice || raw.price, raw.previousClose || raw.price),
    updatedAt: raw.updatedAt || taiwanNowText(),
  };
}

async function fetchYahoo(code: string, suffix: "TW" | "TWO") {
  const symbol = `${code}.${suffix}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d&t=${Date.now()}`;

  const json = await httpsJson(url);
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  if (!meta || !quote) return null;

  const closes = Array.isArray(quote.close)
    ? quote.close.filter((v: any) => Number.isFinite(Number(v)))
    : [];

  const opens = Array.isArray(quote.open)
    ? quote.open.filter((v: any) => Number.isFinite(Number(v)))
    : [];

  const highs = Array.isArray(quote.high)
    ? quote.high.filter((v: any) => Number.isFinite(Number(v)))
    : [];

  const lows = Array.isArray(quote.low)
    ? quote.low.filter((v: any) => Number.isFinite(Number(v)))
    : [];

  const volumes = Array.isArray(quote.volume)
    ? quote.volume.filter((v: any) => Number.isFinite(Number(v)))
    : [];

  const price = n(meta.regularMarketPrice || closes[closes.length - 1]);
  const previousClose = n(meta.previousClose || meta.chartPreviousClose);
  const openPrice = n(meta.regularMarketOpen || opens[0] || price);
  const highPrice = highs.length ? Math.max(...highs, price) : price;
  const lowPrice = lows.length ? Math.min(...lows, price) : price;
  const volume = n(
    meta.regularMarketVolume ||
      volumes.reduce((sum: number, v: number) => sum + Number(v), 0)
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

async function fetchOneStock(code: string) {
  let stock = await fetchYahoo(code, "TW");

  if (!stock) {
    stock = await fetchYahoo(code, "TWO");
  }

  return stock;
}

async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | null>
) {
  const results: R[] = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = items[index];
      index += 1;

      const result = await worker(current);

      if (result) {
        results.push(result);
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}
export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const results = await runPool<string, StockPayload>(
      stockUniverse,
      6,
      async (code) => {
        return await fetchOneStock(code);
      }
    );

    const rankedStocks = results
      .filter((stock) => stock.price > 0 && Number.isFinite(stock.changePercent))
      .sort((a, b) => b.changePercent - a.changePercent);

    return res.status(200).json({
      ok: true,
      source: "Yahoo realtime stable stocks",
      updatedAtTaiwan: taiwanNowText(),
      count: rankedStocks.length,
      rankedStocks,
      stocks: rankedStocks,
      data: rankedStocks,
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      source: "Yahoo realtime stable stocks",
      message: "stocks API 安全模式：資料暫時無法取得，但沒有崩潰",
      error: err?.message || String(err),
      updatedAtTaiwan: taiwanNowText(),
      rankedStocks: [],
      stocks: [],
      data: [],
    });
  }
}