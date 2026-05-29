const nameToCode: Record<string, string> = {
  台積電: "2330",
  聯電: "2303",
  鴻海: "2317",
  聯發科: "2454",
  華邦電: "2344",
  南亞科: "2408",
  旺宏: "2337",
  群創: "3481",
  友達: "2409",
  廣達: "2382",
  緯創: "3231",
  仁寶: "2324",
  英業達: "2356",
  台達電: "2308",
  國泰金: "2882",
  富邦金: "2881",
  中信金: "2891",
  玉山金: "2884",
  長榮: "2603",
  陽明: "2609",
  萬海: "2615",
};

const industryMap: Record<string, string> = {
  "1101": "水泥", "1102": "水泥",
  "1216": "食品", "1227": "食品",
  "1301": "塑化", "1303": "塑化", "6505": "塑化",
  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵",
  "2201": "汽車", "2207": "汽車",
  "2301": "電子", "2303": "半導體", "2308": "電源能源",
  "2313": "電子零組件", "2317": "電子代工", "2324": "電腦週邊",
  "2330": "半導體", "2337": "記憶體", "2344": "記憶體",
  "2354": "電子", "2356": "電腦週邊", "2357": "電腦週邊",
  "2367": "電子零組件", "2379": "半導體", "2382": "電子代工",
  "2408": "記憶體", "2409": "面板", "2454": "半導體",
  "2603": "航運", "2609": "航運", "2615": "航運", "2618": "航運",
  "2881": "金融", "2882": "金融", "2884": "金融", "2886": "金融",
  "2891": "金融", "2892": "金融",
  "3008": "光學", "3017": "電子零組件",
  "3034": "半導體", "3035": "半導體", "3037": "電子零組件",
  "3042": "光電", "3231": "電子代工", "3406": "光學",
  "3443": "半導體", "3481": "面板",
  "3711": "半導體", "3714": "半導體",
  "4966": "半導體", "6415": "半導體", "6669": "電子代工",
};

function cleanCode(input: string) {
  return String(input || "").replace(/\D/g, "").slice(0, 6);
}

function resolveCode(q: string) {
  const keyword = String(q || "").trim();
  const code = cleanCode(keyword);

  if (code.length >= 4) return code;

  if (nameToCode[keyword]) return nameToCode[keyword];

  const found = Object.entries(nameToCode).find(([name]) => {
    return name.includes(keyword) || keyword.includes(name);
  });

  return found?.[1] || "";
}

function safeNumber(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function taiwanTimeText(timestampMs?: number) {
  const date = timestampMs ? new Date(timestampMs) : new Date();

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function fetchYahoo(symbol: string) {
  const safeSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${safeSymbol}?interval=1m&range=1d`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${symbol} status ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo ${symbol} no result`);
  }

  return result;
}

function parseYahoo(result: any, code: string, market: "TW" | "TWO") {
  const meta = result?.meta || {};
  const timestamps: number[] = Array.isArray(result?.timestamp) ? result.timestamp : [];

  const quote = result?.indicators?.quote?.[0] || {};
  const closes: Array<number | null> = Array.isArray(quote.close) ? quote.close : [];
  const opens: Array<number | null> = Array.isArray(quote.open) ? quote.open : [];
  const highs: Array<number | null> = Array.isArray(quote.high) ? quote.high : [];
  const lows: Array<number | null> = Array.isArray(quote.low) ? quote.low : [];
  const volumes: Array<number | null> = Array.isArray(quote.volume) ? quote.volume : [];

  let lastIndex = closes.length - 1;

  while (lastIndex >= 0) {
    const v = closes[lastIndex];
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) break;
    lastIndex -= 1;
  }

  if (lastIndex < 0) {
    throw new Error("Yahoo no valid price");
  }

  const price = safeNumber(closes[lastIndex], safeNumber(meta.regularMarketPrice, 0));
  const firstOpen = opens.find((v) => v !== null && v !== undefined && Number.isFinite(Number(v)));
  const openPrice = safeNumber(firstOpen, safeNumber(meta.regularMarketOpen, price));
  const previousClose = safeNumber(meta.chartPreviousClose, safeNumber(meta.previousClose, price));

  const highValues = highs.filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
  const lowValues = lows.filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);

  const highPrice = highValues.length > 0 ? Math.max(...highValues, price) : price;
  const lowPrice = lowValues.length > 0 ? Math.min(...lowValues, price) : price;

  const volume = volumes.reduce((sum, v) => sum + safeNumber(v, 0), 0);

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  const openPremiumPercent =
    previousClose > 0 ? ((openPrice - previousClose) / previousClose) * 100 : 0;

  const timestampMs = timestamps[lastIndex] ? timestamps[lastIndex] * 1000 : Date.now();

  return {
    code,
    symbol: `${code}.${market}`,
    name: String(meta.shortName || meta.longName || code).replace(".TW", "").replace(".TWO", ""),
    price,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    highPrice,
    lowPrice,
    industry: industryMap[code] || "其他",
    updatedAt: taiwanTimeText(timestampMs),
    source: "Yahoo Finance Search Safe",
  };
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const q = String(req.query?.q || req.query?.code || "").trim();
    const code = resolveCode(q);

    if (!code) {
      return res.status(200).json({
        ok: false,
        query: q,
        message: "請輸入股票代號，例如 2330、2344、3481；或常見名稱，例如 台積電、華邦電、群創。",
      });
    }

    const symbols = [
      { symbol: `${code}.TW`, market: "TW" as const },
      { symbol: `${code}.TWO`, market: "TWO" as const },
    ];

    const errors: string[] = [];

    for (const item of symbols) {
      try {
        const result = await fetchYahoo(item.symbol);
        const stock = parseYahoo(result, code, item.market);

        return res.status(200).json({
          ok: true,
          stock,
          updatedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        errors.push(`${item.symbol}: ${err?.message || String(err)}`);
      }
    }

    return res.status(200).json({
      ok: false,
      code,
      message: "查無此股票，請確認代號是否正確。",
      error: errors.join(" | "),
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      message: "查詢功能暫時失敗，請稍後再試。",
      error: err?.message || String(err),
    });
  }
}