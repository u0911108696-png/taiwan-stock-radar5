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
  if (value === null || value === undefined || value === "") return 0;

  const n = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanCode(code: string) {
  return String(code || "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 4);
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

function buildYahooSymbols(codes: string[]) {
  return codes.map((code) => `${cleanCode(code)}.TW`);
}

function nowText() {
  return new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}
async function fetchYahooQuotes(codes: string[]) {
  const cleanCodes = uniqueCodes(codes);
  const chunks = chunkArray(cleanCodes, 40);
  const allResults: StockItem[] = [];

  for (const chunk of chunks) {
    const symbols = buildYahooSymbols(chunk).join(",");

    const url =
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
      encodeURIComponent(symbols) +
      "&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketOpen,regularMarketPreviousClose,shortName,longName,symbol" +
      "&t=" +
      Date.now();

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });

    if (!res.ok) {
      throw new Error("Yahoo 台股資料取得失敗");
    }

    const data = await res.json();
    const result = data?.quoteResponse?.result;

    if (!Array.isArray(result)) continue;

    for (const item of result) {
      const symbol = String(item.symbol || "");
      const code = cleanCode(symbol);

      if (!/^\d{4}$/.test(code)) continue;

      const price = toNumber(item.regularMarketPrice);
      const change = toNumber(item.regularMarketChange);
      const changePercent = toNumber(item.regularMarketChangePercent);
      const volume = toNumber(item.regularMarketVolume);
      const openPrice = toNumber(item.regularMarketOpen);
      const previousClose = toNumber(item.regularMarketPreviousClose);

      if (price <= 0) continue;

      let openPremiumPercent: number | null = null;

      if (openPrice > 0 && previousClose > 0) {
        openPremiumPercent = Number(
          (((openPrice - previousClose) / previousClose) * 100).toFixed(2)
        );
      }

      allResults.push({
        code,
        name:
          String(item.shortName || item.longName || "")
            .replace(".TW", "")
            .trim() || code,
        price,
        change,
        changePercent: Number(changePercent.toFixed(2)),
        volume,
        openPrice,
        previousClose,
        openPremiumPercent,
        industry: getIndustry(code),

        turnoverRate: null,
        volumeRatio: null,
        floatMarketCapYi: null,
      });
    }
  }

  return allResults;
}

async function fetchYahooChartQuote(code: string): Promise<StockItem | null> {
  const clean = cleanCode(code);

  if (!/^\d{4}$/.test(clean)) return null;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${clean}.TW` +
    `?range=1d&interval=1m&includePrePost=false&t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache",
        expires: "0",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) return null;

    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];

    const closes = Array.isArray(quote.close) ? quote.close : [];
    const volumes = Array.isArray(quote.volume) ? quote.volume : [];
    const opens = Array.isArray(quote.open) ? quote.open : [];

    let latestPrice = 0;
    let latestVolume = 0;

    for (let i = closes.length - 1; i >= 0; i--) {
      const close = toNumber(closes[i]);

      if (close > 0) {
        latestPrice = close;
        break;
      }
    }

    latestVolume = volumes.reduce((sum: number, item: any) => sum + toNumber(item), 0);

    const previousClose = toNumber(meta.previousClose);
    const regularPrice = toNumber(meta.regularMarketPrice);
    const price = latestPrice > 0 ? latestPrice : regularPrice;

    if (price <= 0) return null;

    const change = previousClose > 0 ? price - previousClose : 0;
    const changePercent =
      previousClose > 0 ? Number(((change / previousClose) * 100).toFixed(2)) : 0;

    let openPrice = 0;

    for (let i = 0; i < opens.length; i++) {
      const open = toNumber(opens[i]);

      if (open > 0) {
        openPrice = open;
        break;
      }
    }

    let openPremiumPercent: number | null = null;

    if (openPrice > 0 && previousClose > 0) {
      openPremiumPercent = Number(
        (((openPrice - previousClose) / previousClose) * 100).toFixed(2)
      );
    }

    return {
      code: clean,
      name: String(meta.shortName || meta.longName || clean).replace(".TW", "").trim(),
      price,
      change: Number(change.toFixed(2)),
      changePercent,
      volume: latestVolume,
      openPrice,
      previousClose,
      openPremiumPercent,
      industry: getIndustry(clean),

      turnoverRate: null,
      volumeRatio: null,
      floatMarketCapYi: null,
    };
  } catch {
    return null;
  }
}

async function fetchFreshWatchList(codes: string[]) {
  const cleanCodes = uniqueCodes(codes);

  const chartResults = await Promise.all(
    cleanCodes.map((code) => fetchYahooChartQuote(code))
  );

  const validChartResults = chartResults.filter(Boolean) as StockItem[];

  const missingCodes = cleanCodes.filter(
    (code) => !validChartResults.some((item) => item.code === code)
  );

  if (missingCodes.length === 0) return validChartResults;

  const quoteFallback = await fetchYahooQuotes(missingCodes);

  const map = new Map<string, StockItem>();

  validChartResults.forEach((item) => map.set(item.code, item));
  quoteFallback.forEach((item) => map.set(item.code, item));

  return Array.from(map.values());
}

function mergeByCode(primary: StockItem[], fallback: StockItem[]) {
  const map = new Map<string, StockItem>();

  fallback.forEach((item) => map.set(item.code, item));
  primary.forEach((item) => map.set(item.code, item));

  return Array.from(map.values());
}

function sortTopGainers(stocks: StockItem[]) {
  return [...stocks]
    .filter((stock) => stock.price > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
}
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",

      // 關鍵：避免 Vercel / 瀏覽器快取
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "surrogate-control": "no-store",
    },
  });
}

export default async function handler(req: Request) {
  try {
    const watchCodes = getWatchCodesFromRequest(req);

    // 1. 先抓候選股票，用來做漲幅排行
    const rankingQuotes = await fetchYahooQuotes(candidateStockCodes);

    // 2. 再針對自選股用 1 分 K chart 抓最新資料
    // 這個比 quote 更接近即時，解決個股頁不更新問題
    const freshWatchList = await fetchFreshWatchList(watchCodes);

    // 3. 若自選股剛好也在候選清單裡，用較新的 chart 資料覆蓋
    const mergedRanking = mergeByCode(freshWatchList, rankingQuotes);

    const rankedStocks = sortTopGainers(mergedRanking).slice(0, 50);

    const watchList = watchCodes
      .map((code) => {
        return (
          freshWatchList.find((stock) => stock.code === code) ||
          rankedStocks.find((stock) => stock.code === code) ||
          null
        );
      })
      .filter(Boolean) as StockItem[];

    const response = {
      ok: true,
      source: "Yahoo Finance",
      updatedAt: new Date().toISOString(),
      updatedAtTaiwan: nowText(),
      cache: "no-store",
      rankedStocks,
      watchList,
      meta: {
        rankedCount: rankedStocks.length,
        watchCount: watchList.length,
        watchCodes,
        note: "watchList 使用 Yahoo chart 1m 資料，較接近即時；rankedStocks 使用 Yahoo quote 資料。",
      },
    };

    return jsonResponse(response);
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: error?.message || "股票資料取得失敗",
        updatedAt: new Date().toISOString(),
        updatedAtTaiwan: nowText(),
        rankedStocks: [],
        watchList: [],
      },
      500
    );
  }
}