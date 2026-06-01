import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  "6770": "力積電",
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
  "3042": "晶技",
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
  "3042": "其他",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

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

  "3481": "面板",
  "2409": "面板",

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

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanCode(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function makeStock(data: {
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
    data.previousClose > 0
      ? ((data.price - data.previousClose) / data.previousClose) * 100
      : 0;

  const openPremiumPercent =
    data.previousClose > 0 && data.openPrice > 0
      ? ((data.openPrice - data.previousClose) / data.previousClose) * 100
      : null;

  return {
    code: data.code,
    name: codeToChineseName[data.code] || data.name || data.code,
    price: data.price,
    changePercent,
    volume: data.volume,
    openPrice: data.openPrice || data.price,
    previousClose: data.previousClose,
    openPremiumPercent,
    industry: industryMap[data.code] || "其他",
    highPrice: Math.max(data.highPrice, data.price, data.openPrice, data.previousClose),
    lowPrice: Math.min(data.lowPrice || data.price, data.price, data.openPrice || data.price, data.previousClose || data.price),
    updatedAt: data.updatedAt || taiwanNowText(),
  };
}

async function fetchTwseMis(code: string, market: "tse" | "otc") {
  const ex = `${market}_${code}.tw`;
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex)}&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://mis.twse.com.tw/stock/index.jsp",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`TWSE MIS ${market} failed`);

  const json: any = await response.json();
  const item = Array.isArray(json?.msgArray) ? json.msgArray[0] : null;

  if (!item) throw new Error(`TWSE MIS ${market} empty`);

  const price = num(item.z);
  const previousClose = num(item.y);
  const openPrice = num(item.o, price);
  const highPrice = num(item.h, price);
  const lowPrice = num(item.l, price);
  const volume = num(item.v);

  if (!price || !previousClose) throw new Error(`TWSE MIS ${market} invalid`);

  return makeStock({
    code,
    name: item.n || codeToChineseName[code],
    price,
    previousClose,
    openPrice,
    highPrice,
    lowPrice,
    volume,
    updatedAt: `${item.d || ""} ${item.t || ""}`.trim() || taiwanNowText(),
  });
}

async function fetchYahooChart(code: string, suffix: "TW" | "TWO") {
  const symbol = `${code}.${suffix}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&t=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Yahoo ${suffix} failed`);

  const json: any = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  if (!meta || !quote) throw new Error(`Yahoo ${suffix} empty`);

  const closes = Array.isArray(quote.close) ? quote.close.filter((v: any) => Number.isFinite(Number(v))) : [];
  const opens = Array.isArray(quote.open) ? quote.open.filter((v: any) => Number.isFinite(Number(v))) : [];
  const highs = Array.isArray(quote.high) ? quote.high.filter((v: any) => Number.isFinite(Number(v))) : [];
  const lows = Array.isArray(quote.low) ? quote.low.filter((v: any) => Number.isFinite(Number(v))) : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume.filter((v: any) => Number.isFinite(Number(v))) : [];

  const price = num(meta.regularMarketPrice || closes[closes.length - 1]);
  const previousClose = num(meta.previousClose || meta.chartPreviousClose);
  const openPrice = num(meta.regularMarketOpen || opens[0] || price);
  const highPrice = num(meta.regularMarketDayHigh || Math.max(...highs, price));
  const lowPrice = num(meta.regularMarketDayLow || Math.min(...lows, price));
  const volume = num(meta.regularMarketVolume || volumes.reduce((sum: number, v: number) => sum + Number(v), 0));

  if (!price || !previousClose) throw new Error(`Yahoo ${suffix} invalid`);

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

async function getRealtimeStock(code: string) {
  const errors: string[] = [];

  try {
    return await fetchTwseMis(code, "tse");
  } catch (err: any) {
    errors.push(err?.message || "tse failed");
  }

  try {
    return await fetchTwseMis(code, "otc");
  } catch (err: any) {
    errors.push(err?.message || "otc failed");
  }

  try {
    return await fetchYahooChart(code, "TW");
  } catch (err: any) {
    errors.push(err?.message || "yahoo TW failed");
  }

  try {
    return await fetchYahooChart(code, "TWO");
  } catch (err: any) {
    errors.push(err?.message || "yahoo TWO failed");
  }

  throw new Error(errors.join(" | "));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const q = cleanCode(req.query.q);

  if (!q) {
    return res.status(400).json({
      ok: false,
      message: "請輸入股票代號",
      updatedAtTaiwan: taiwanNowText(),
    });
  }

  try {
    const stock = await getRealtimeStock(q);

    return res.status(200).json({
      ok: true,
      source: "TWSE MIS realtime / Yahoo fallback",
      updatedAtTaiwan: taiwanNowText(),
      stock,
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      message: "即時資料暫時無法取得",
      error: err?.message || String(err),
      updatedAtTaiwan: taiwanNowText(),
    });
  }
}