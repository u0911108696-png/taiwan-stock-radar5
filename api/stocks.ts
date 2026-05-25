export const config = {
  runtime: "edge",
};

const defaultWatchListCodes = [
  "2330",
  "3042",
  "3714",
  "3481",
  "2356",
  "6168",
  "6405",
];

type StockItem = {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  industry: string;
  turnoverRate: number | null;
  volumeRatio: number | null;
  floatMarketCapYi: number | null;

  // 真實小走勢圖資料
  sparkline: number[];
};

const stockNameMap: Record<string, string> = {
  "1101": "台泥",
  "1102": "亞泥",
  "1216": "統一",
  "1227": "佳格",
  "1301": "台塑",
  "1303": "南亞",
  "6505": "台塑化",

  "1717": "長興",
  "1722": "台肥",
  "4722": "國精化",

  "2002": "中鋼",
  "2014": "中鴻",
  "2027": "大成鋼",

  "2201": "裕隆",
  "2207": "和泰車",
  "2227": "裕日車",

  "2301": "光寶科",
  "2303": "聯電",
  "2308": "台達電",
  "2313": "華通",
  "2317": "鴻海",
  "2327": "國巨",
  "2330": "台積電",
  "2354": "鴻準",
  "2356": "英業達",
  "2357": "華碩",
  "2367": "燿華",
  "2379": "瑞昱",
  "2382": "廣達",
  "2408": "南亞科",
  "2409": "友達",
  "2454": "聯發科",

  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
  "2618": "長榮航",

  "2881": "富邦金",
  "2882": "國泰金",
  "2884": "玉山金",
  "2886": "兆豐金",
  "2891": "中信金",
  "2892": "第一金",
  "2911": "麗嬰房",
  "2912": "統一超",

  "3008": "大立光",
  "3017": "奇鋐",
  "3034": "聯詠",
  "3035": "智原",
  "3037": "欣興",
  "3042": "晶技",
  "3231": "緯創",
  "3406": "玉晶光",
  "3443": "創意",
  "3481": "群創",
  "3661": "世芯-KY",
  "3711": "日月光投控",
  "3714": "富采",

  "4938": "和碩",
  "4958": "臻鼎-KY",
  "5871": "中租-KY",
  "5876": "上海商銀",
  "5903": "全家",
  "6168": "宏齊",
  "6278": "台表科",
  "6405": "悅城",
  "6669": "緯穎",
  "8046": "南電",
  "8374": "羅昇",

  "9904": "寶成",
  "9907": "統一實",
  "9914": "美利達",
  "9926": "新海",
};

const stockIndustryMap: Record<string, string> = {
  "1101": "水泥",
  "1102": "水泥",

  "1216": "食品",
  "1227": "食品",

  "1301": "塑化",
  "1303": "塑化",
  "6505": "塑化",

  "1717": "化工",
  "1722": "化工",
  "4722": "化工",

  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",

  "2201": "汽車",
  "2207": "汽車",
  "2227": "汽車",

  "2301": "電腦週邊",
  "2356": "電腦週邊",
  "2357": "電腦週邊",
  "2382": "電腦週邊",
  "3231": "電腦週邊",
  "6669": "電腦週邊",

  "2303": "半導體",
  "2330": "半導體",
  "2379": "半導體",
  "2408": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3711": "半導體",

  "2308": "電子零組件",
  "2327": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",

  "2313": "PCB",
  "3042": "PCB",
  "2367": "PCB",
  "4958": "PCB",

  "2317": "電子代工",
  "2354": "電子代工",
  "4938": "電子代工",

  "2409": "面板",
  "3481": "面板",

  "3008": "光電",
  "3406": "光電",
  "3714": "光電",
  "6168": "光電",
  "6278": "光電",
  "6405": "光電",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",

  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2886": "金融",
  "2891": "金融",
  "2892": "金融",
  "5871": "金融",
  "5876": "金融",

  "2911": "百貨",
  "2912": "百貨",
  "5903": "百貨",

  "9904": "消費",
  "9907": "消費",
  "9914": "消費",
  "9926": "消費",

  "1707": "生技",
  "1760": "生技",
  "1783": "生技",

  "8374": "電機機械",
};

const candidateStockCodes = [
  "1101",
  "1102",
  "1216",
  "1227",
  "1301",
  "1303",
  "6505",
  "1717",
  "1722",
  "4722",
  "2002",
  "2014",
  "2027",
  "2201",
  "2207",
  "2227",

  "2301",
  "2303",
  "2308",
  "2313",
  "2317",
  "2327",
  "2330",
  "2354",
  "2356",
  "2357",
  "2367",
  "2379",
  "2382",
  "2408",
  "2409",
  "2454",

  "2603",
  "2609",
  "2615",
  "2618",

  "2881",
  "2882",
  "2884",
  "2886",
  "2891",
  "2892",
  "2911",
  "2912",

  "3008",
  "3017",
  "3034",
  "3035",
  "3037",
  "3042",
  "3231",
  "3406",
  "3443",
  "3481",
  "3661",
  "3711",
  "3714",

  "4938",
  "4958",
  "5871",
  "5876",
  "5903",
  "6168",
  "6278",
  "6405",
  "6669",
  "8046",
  "8374",

  "9904",
  "9907",
  "9914",
  "9926",
];

function toNumber(value: any): number {
  if (value === null || value === undefined || value === "" || value === "-") {
    return 0;
  }

  const n = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanCode(code: string) {
  return String(code || "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 4);
}

function getStockName(code: string, fallback = "") {
  const clean = cleanCode(code);
  return stockNameMap[clean] || fallback.replace(".TW", "").trim() || clean;
}

function getIndustry(code: string) {
  return stockIndustryMap[cleanCode(code)] || "其他";
}

function uniqueCodes(codes: string[]) {
  return Array.from(
    new Set(
      codes
        .map(cleanCode)
        .filter((code) => /^\d{4}$/.test(code))
    )
  );
}

function getWatchCodesFromRequest(req: Request) {
  const url = new URL(req.url);
  const watch = url.searchParams.get("watch") || "";

  const watchCodes = uniqueCodes(watch.split(","));

  if (watchCodes.length === 0) return defaultWatchListCodes;

  return watchCodes;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function nowText() {
  return new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function makeSparklineFallback(price: number, previousClose: number) {
  if (price <= 0) return [];

  const base = previousClose > 0 ? previousClose : price;
  const mid = (base + price) / 2;

  return [
    Number(base.toFixed(2)),
    Number(mid.toFixed(2)),
    Number(price.toFixed(2)),
  ];
}

function makeEmptyStock(code: string): StockItem {
  const clean = cleanCode(code);

  return {
    code: clean,
    name: getStockName(clean),
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    openPrice: 0,
    previousClose: 0,
    openPremiumPercent: null,
    industry: getIndustry(clean),
    turnoverRate: null,
    volumeRatio: null,
    floatMarketCapYi: null,
    sparkline: [],
  };
}
async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        accept: "application/json,text/plain,*/*",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });

    return res;
  } finally {
    clearTimeout(timer);
  }
}

function buildTwseExCh(codes: string[]) {
  return uniqueCodes(codes)
    .map((code) => `tse_${code}.tw`)
    .join("|");
}

function normalizeTwseItem(item: any): StockItem | null {
  const code = cleanCode(item?.c || item?.ch || "");

  if (!/^\d{4}$/.test(code)) return null;

  const price = toNumber(item?.z);
  const openPrice = toNumber(item?.o);
  const previousClose = toNumber(item?.y);
  const volume = toNumber(item?.v) * 1000;

  if (price <= 0 || previousClose <= 0) return null;

  const change = price - previousClose;
  const changePercent = Number(((change / previousClose) * 100).toFixed(2));

  let openPremiumPercent: number | null = null;

  if (openPrice > 0 && previousClose > 0) {
    openPremiumPercent = Number(
      (((openPrice - previousClose) / previousClose) * 100).toFixed(2)
    );
  }

  return {
    code,
    name: getStockName(code, String(item?.n || "")),
    price,
    change: Number(change.toFixed(2)),
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: getIndustry(code),
    turnoverRate: null,
    volumeRatio: null,
    floatMarketCapYi: null,
    sparkline: makeSparklineFallback(price, previousClose),
  };
}

async function fetchTwseQuotes(codes: string[]) {
  const cleanCodes = uniqueCodes(codes);
  const chunks = chunkArray(cleanCodes, 40);
  const map = new Map<string, StockItem>();

  for (const chunk of chunks) {
    const exCh = buildTwseExCh(chunk);

    if (!exCh) continue;

    const url =
      "https://mis.twse.com.tw/stock/api/getStockInfo.jsp" +
      "?ex_ch=" +
      encodeURIComponent(exCh) +
      "&json=1&delay=0&_=" +
      Date.now();

    try {
      const res = await fetchWithTimeout(url);

      if (!res.ok) continue;

      const data = await res.json();
      const items = Array.isArray(data?.msgArray) ? data.msgArray : [];

      for (const item of items) {
        const normalized = normalizeTwseItem(item);

        if (normalized && normalized.price > 0) {
          map.set(normalized.code, normalized);
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(map.values());
}

function normalizeYahooQuoteItem(item: any): StockItem | null {
  const symbol = String(item?.symbol || "");
  const code = cleanCode(symbol);

  if (!/^\d{4}$/.test(code)) return null;

  const price = toNumber(item.regularMarketPrice);
  const change = toNumber(item.regularMarketChange);
  const changePercent = toNumber(item.regularMarketChangePercent);
  const volume = toNumber(item.regularMarketVolume);
  const openPrice = toNumber(item.regularMarketOpen);
  const previousClose = toNumber(item.regularMarketPreviousClose);

  if (price <= 0) return null;

  let openPremiumPercent: number | null = null;

  if (openPrice > 0 && previousClose > 0) {
    openPremiumPercent = Number(
      (((openPrice - previousClose) / previousClose) * 100).toFixed(2)
    );
  }

  return {
    code,
    name: getStockName(code, String(item.shortName || item.longName || "")),
    price,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: getIndustry(code),
    turnoverRate: null,
    volumeRatio: null,
    floatMarketCapYi: null,
    sparkline: makeSparklineFallback(price, previousClose),
  };
}

function buildYahooSymbols(codes: string[]) {
  return uniqueCodes(codes).map((code) => `${code}.TW`);
}

async function fetchYahooQuotesFromHost(codes: string[], host: string) {
  const cleanCodes = uniqueCodes(codes);
  const chunks = chunkArray(cleanCodes, 35);
  const allResults: StockItem[] = [];

  for (const chunk of chunks) {
    const symbols = buildYahooSymbols(chunk).join(",");

    const url =
      `https://${host}/v7/finance/quote?symbols=` +
      encodeURIComponent(symbols) +
      "&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketOpen,regularMarketPreviousClose,shortName,longName,symbol" +
      "&t=" +
      Date.now();

    try {
      const res = await fetchWithTimeout(url);

      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.quoteResponse?.result;

      if (!Array.isArray(result)) continue;

      for (const item of result) {
        const normalized = normalizeYahooQuoteItem(item);

        if (normalized) allResults.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return allResults;
}

async function fetchYahooQuotes(codes: string[]) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  const map = new Map<string, StockItem>();

  for (const host of hosts) {
    const results = await fetchYahooQuotesFromHost(codes, host);

    results.forEach((item) => {
      if (!map.has(item.code)) map.set(item.code, item);
    });

    if (map.size >= Math.min(uniqueCodes(codes).length, 30)) {
      break;
    }
  }

  return Array.from(map.values());
}

async function fetchYahooSparkline(code: string) {
  const clean = cleanCode(code);

  if (!/^\d{4}$/.test(clean)) return [];

  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  for (const host of hosts) {
    const url =
      `https://${host}/v8/finance/chart/${clean}.TW` +
      `?range=1d&interval=5m&includePrePost=false&t=${Date.now()}`;

    try {
      const res = await fetchWithTimeout(url, 6000);

      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const closes = result?.indicators?.quote?.[0]?.close;

      if (!Array.isArray(closes)) continue;

      const cleanCloses = closes
        .map((value: any) => toNumber(value))
        .filter((value: number) => value > 0);

      if (cleanCloses.length >= 2) {
        return cleanCloses.slice(-18).map((value: number) => Number(value.toFixed(2)));
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function attachSparklines(stocks: StockItem[]) {
  const limited = stocks.slice(0, 50);

  const sparklineResults = await Promise.all(
    limited.map(async (stock) => {
      const sparkline = await fetchYahooSparkline(stock.code);

      return {
        code: stock.code,
        sparkline:
          sparkline.length >= 2
            ? sparkline
            : makeSparklineFallback(stock.price, stock.previousClose),
      };
    })
  );

  const sparklineMap = new Map<string, number[]>();

  sparklineResults.forEach((item) => {
    sparklineMap.set(item.code, item.sparkline);
  });

  return stocks.map((stock) => ({
    ...stock,
    sparkline:
      sparklineMap.get(stock.code) ||
      stock.sparkline ||
      makeSparklineFallback(stock.price, stock.previousClose),
  }));
}

async function fetchBestQuotes(codes: string[]) {
  const twse = await fetchTwseQuotes(codes);
  const twseCodes = new Set(twse.map((item) => item.code));

  const missingCodes = uniqueCodes(codes).filter((code) => !twseCodes.has(code));
  const yahoo = missingCodes.length > 0 ? await fetchYahooQuotes(missingCodes) : [];

  const map = new Map<string, StockItem>();

  yahoo.forEach((item) => {
    if (item.price > 0) {
      map.set(item.code, {
        ...item,
        name: getStockName(item.code, item.name),
        industry: getIndustry(item.code),
      });
    }
  });

  twse.forEach((item) => {
    if (item.price > 0) {
      map.set(item.code, {
        ...item,
        name: getStockName(item.code, item.name),
        industry: getIndustry(item.code),
      });
    }
  });

  return Array.from(map.values());
}

function mergeByCode(primary: StockItem[], fallback: StockItem[]) {
  const map = new Map<string, StockItem>();

  fallback.forEach((item) => {
    if (item.price > 0) {
      map.set(item.code, {
        ...item,
        name: getStockName(item.code, item.name),
        industry: getIndustry(item.code),
      });
    }
  });

  primary.forEach((item) => {
    if (item.price > 0) {
      map.set(item.code, {
        ...item,
        name: getStockName(item.code, item.name),
        industry: getIndustry(item.code),
      });
    }
  });

  return Array.from(map.values());
}

function sortTopGainers(stocks: StockItem[]) {
  return [...stocks]
    .filter((stock) => stock.price > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
}
function buildFallbackRanking(watchList: StockItem[]) {
  return watchList
    .filter((stock) => stock.price > 0)
    .map((stock) => ({
      ...stock,
      name: getStockName(stock.code, stock.name),
      industry: getIndustry(stock.code),
      sparkline:
        stock.sparkline && stock.sparkline.length >= 2
          ? stock.sparkline
          : makeSparklineFallback(stock.price, stock.previousClose),
    }))
    .sort((a, b) => b.changePercent - a.changePercent);
}

function padRankingToFifty(rankedStocks: StockItem[], watchList: StockItem[]) {
  const map = new Map<string, StockItem>();

  rankedStocks.forEach((stock) => {
    if (stock.price > 0) {
      map.set(stock.code, {
        ...stock,
        name: getStockName(stock.code, stock.name),
        industry: getIndustry(stock.code),
        sparkline:
          stock.sparkline && stock.sparkline.length >= 2
            ? stock.sparkline
            : makeSparklineFallback(stock.price, stock.previousClose),
      });
    }
  });

  watchList.forEach((stock) => {
    if (stock.price > 0 && !map.has(stock.code)) {
      map.set(stock.code, {
        ...stock,
        name: getStockName(stock.code, stock.name),
        industry: getIndustry(stock.code),
        sparkline:
          stock.sparkline && stock.sparkline.length >= 2
            ? stock.sparkline
            : makeSparklineFallback(stock.price, stock.previousClose),
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 50);
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "surrogate-control": "no-store",
    },
  });
}

export default async function handler(req: Request) {
  const watchCodes = getWatchCodesFromRequest(req);
  const errors: string[] = [];

  try {
    let rankingQuotes: StockItem[] = [];

    try {
      rankingQuotes = await fetchBestQuotes(candidateStockCodes);
    } catch (error: any) {
      errors.push(error?.message || "rankingQuotes failed");
      rankingQuotes = [];
    }

    let freshWatchList: StockItem[] = [];

    try {
      freshWatchList = await fetchBestQuotes(watchCodes);
    } catch (error: any) {
      errors.push(error?.message || "freshWatchList failed");
      freshWatchList = watchCodes.map(makeEmptyStock);
    }

    const mergedRanking = mergeByCode(freshWatchList, rankingQuotes);

    let rankedStocks = sortTopGainers(mergedRanking).slice(0, 50);

    if (rankedStocks.length === 0) {
      rankedStocks = buildFallbackRanking(freshWatchList).slice(0, 50);
    }

    rankedStocks = padRankingToFifty(rankedStocks, freshWatchList);

    const watchList = watchCodes.map((code) => {
      const found =
        freshWatchList.find((stock) => stock.code === code) ||
        rankedStocks.find((stock) => stock.code === code) ||
        makeEmptyStock(code);

      return {
        ...found,
        name: getStockName(found.code, found.name),
        industry: getIndustry(found.code),
        sparkline:
          found.sparkline && found.sparkline.length >= 2
            ? found.sparkline
            : makeSparklineFallback(found.price, found.previousClose),
      };
    });

    // 加上真實走勢 sparkline
    rankedStocks = await attachSparklines(rankedStocks);
    const watchListWithSparkline = await attachSparklines(watchList);

    const hasRanking = rankedStocks.length > 0;
    const hasWatchList = watchListWithSparkline.some((stock) => stock.price > 0);

    return jsonResponse({
      ok: hasRanking || hasWatchList,
      source: "TWSE MIS + Yahoo chart sparkline fallback",
      updatedAt: new Date().toISOString(),
      updatedAtTaiwan: nowText(),
      cache: "no-store",
      rankedStocks,
      watchList: watchListWithSparkline,
      meta: {
        rankedCount: rankedStocks.length,
        watchCount: watchListWithSparkline.length,
        watchCodes,
        hasRanking,
        hasWatchList,
        errors,
        note:
          "股價優先使用證交所 MIS；小走勢 sparkline 使用 Yahoo chart 5m。若抓不到走勢，才用現價與昨收產生簡化線。",
      },
    });
  } catch (error: any) {
    const fallbackWatchList = watchCodes.map(makeEmptyStock);

    return jsonResponse({
      ok: false,
      source: "fallback",
      error: error?.message || "股票資料取得失敗",
      updatedAt: new Date().toISOString(),
      updatedAtTaiwan: nowText(),
      cache: "no-store",
      rankedStocks: [],
      watchList: fallbackWatchList,
      meta: {
        rankedCount: 0,
        watchCount: fallbackWatchList.length,
        watchCodes,
        errors: [error?.message || "unknown error"],
        note:
          "API 發生錯誤，但仍回傳 200，避免 App 畫面整個壞掉。請稍後再按立即更新。",
      },
    });
  }
}