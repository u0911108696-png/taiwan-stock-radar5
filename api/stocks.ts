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
  "3017": "電腦週邊",

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

  "2313": "PCB",
  "2367": "PCB",
  "3042": "PCB",
  "4958": "PCB",

  "2308": "電子零組件",
  "2327": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",

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

function cleanText(value: any) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replaceAll(",", "")
    .replaceAll("&nbsp;", "")
    .replaceAll(" ", "")
    .trim();
}

function toNumber(value: any) {
  const text = cleanText(value)
    .replace("+", "")
    .replace("X", "")
    .replace("--", "")
    .replace("---", "")
    .trim();

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function round2(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function getIndustry(code: string) {
  return stockIndustryMap[code] || "其他";
}

function getWatchCodesFromUrl(req: Request) {
  try {
    const url = new URL(req.url);
    const watch = url.searchParams.get("watch");

    if (!watch) return defaultWatchListCodes;

    const codes = watch
      .split(",")
      .map((code) => code.trim().replace(/\D/g, "").slice(0, 4))
      .filter((code) => /^\d{4}$/.test(code));

    return codes.length > 0 ? Array.from(new Set(codes)) : defaultWatchListCodes;
  } catch {
    return defaultWatchListCodes;
  }
}

function parseTwseOpenApiStock(row: any): StockItem | null {
  const code = cleanText(
    row.Code ??
      row.code ??
      row["Code"] ??
      row["證券代號"]
  );

  const name = cleanText(
    row.Name ??
      row.name ??
      row["Name"] ??
      row["證券名稱"]
  );

  if (!/^\d{4}$/.test(code)) return null;
  if (!name) return null;

  const price = toNumber(
    row.ClosingPrice ??
      row.Close ??
      row.close ??
      row["ClosingPrice"] ??
      row["收盤價"]
  );

  const openPrice = toNumber(
    row.OpeningPrice ??
      row.OpenPrice ??
      row.open ??
      row.Open ??
      row["OpeningPrice"] ??
      row["開盤價"]
  );

  const previousClose = toNumber(
    row.PreviousClose ??
      row.previousClose ??
      row.YesterdayClose ??
      row.ReferencePrice ??
      row["PreviousClose"] ??
      row["昨收價"] ??
      row["參考價"]
  );

  const change = toNumber(
    row.Change ??
      row.change ??
      row.PriceChange ??
      row["Change"] ??
      row["漲跌價差"]
  );

  const volume = toNumber(
    row.TradeVolume ??
      row.volume ??
      row.Volume ??
      row["TradeVolume"] ??
      row["成交股數"]
  );

  let finalPreviousClose = previousClose;

  if (finalPreviousClose <= 0 && price > 0) {
    finalPreviousClose = price - change;
  }

  let changePercent = 0;

  if (finalPreviousClose > 0 && price > 0) {
    changePercent = round2(((price - finalPreviousClose) / finalPreviousClose) * 100);
  }

  let openPremiumPercent: number | null = null;

  if (openPrice > 0 && finalPreviousClose > 0) {
    openPremiumPercent = round2(((openPrice - finalPreviousClose) / finalPreviousClose) * 100);
  }

  if (price <= 0 || !Number.isFinite(changePercent)) return null;

  return {
    code,
    name,
    price,
    change,
    changePercent,
    volume,
    openPrice,
    previousClose: finalPreviousClose,
    openPremiumPercent,
    industry: getIndustry(code),

    turnoverRate: null,
    volumeRatio: null,
    floatMarketCapYi: null,
  };
}

async function fetchTwseOpenApiRanking() {
  const urls = [
    "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
    "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "application/json,text/plain,*/*",
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) continue;

      const rows = data
        .map(parseTwseOpenApiStock)
        .filter(Boolean) as StockItem[];

      const validRows = rows
        .filter((stock) => stock.price > 0 && stock.name)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 50);

      if (validRows.length > 0) {
        return validRows;
      }
    } catch {
      // 換下一個來源
    }
  }

  return [];
}
function parseYahooQuote(item: any): StockItem | null {
  const symbol = cleanText(item.symbol ?? "");
  const code = symbol
    .replace(".TW", "")
    .replace(".TWO", "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (!/^\d{4}$/.test(code)) return null;

  const name = cleanText(
    item.longName ??
      item.shortName ??
      item.displayName ??
      item.symbol ??
      code
  );

  const price = toNumber(
    item.regularMarketPrice ??
      item.postMarketPrice ??
      item.preMarketPrice
  );

  const openPrice = toNumber(item.regularMarketOpen);
  const previousClose = toNumber(item.regularMarketPreviousClose);
  const change = toNumber(item.regularMarketChange);

  let changePercent = toNumber(item.regularMarketChangePercent);

  if ((!Number.isFinite(changePercent) || changePercent === 0) && previousClose > 0 && price > 0) {
    changePercent = round2(((price - previousClose) / previousClose) * 100);
  }

  const volume = toNumber(item.regularMarketVolume);

  const averageVolume = toNumber(
    item.averageDailyVolume3Month ??
      item.averageDailyVolume10Day ??
      item.averageVolume
  );

  const volumeRatio =
    averageVolume > 0 && volume > 0 ? round2(volume / averageVolume) : null;

  const marketCap = toNumber(item.marketCap);

  const floatMarketCapYi =
    marketCap > 0 ? round2(marketCap / 100000000) : null;

  let turnoverRate: number | null = null;

  const sharesOutstanding = toNumber(
    item.sharesOutstanding ??
      item.floatShares
  );

  if (sharesOutstanding > 0 && volume > 0) {
    turnoverRate = round2((volume / sharesOutstanding) * 100);
  }

  let openPremiumPercent: number | null = null;

  if (openPrice > 0 && previousClose > 0) {
    openPremiumPercent = round2(((openPrice - previousClose) / previousClose) * 100);
  }

  if (price <= 0) return null;

  return {
    code,
    name,
    price,
    change,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: getIndustry(code),

    turnoverRate,
    volumeRatio,
    floatMarketCapYi,
  };
}

async function fetchYahooQuotes(codes: string[]) {
  const cleanCodes = Array.from(
    new Set(
      codes
        .map((code) => String(code).trim().replace(/\D/g, "").slice(0, 4))
        .filter((code) => /^\d{4}$/.test(code))
    )
  );

  if (cleanCodes.length === 0) return [];

  const symbols = cleanCodes
    .flatMap((code) => [`${code}.TW`, `${code}.TWO`])
    .join(",");

  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
    encodeURIComponent(symbols);

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();
    const result = data?.quoteResponse?.result;

    if (!Array.isArray(result)) return [];

    const map = new Map<string, StockItem>();

    result.forEach((item: any) => {
      const stock = parseYahooQuote(item);
      if (!stock) return;

      const old = map.get(stock.code);

      if (!old) {
        map.set(stock.code, stock);
        return;
      }

      if (stock.price > 0 && (stock.volume > old.volume || old.price <= 0)) {
        map.set(stock.code, stock);
      }
    });

    return Array.from(map.values());
  } catch {
    return [];
  }
}

function mergeStockData(base: StockItem, extra?: StockItem) {
  if (!extra) return base;

  const price = extra.price > 0 ? extra.price : base.price;
  const previousClose = extra.previousClose > 0 ? extra.previousClose : base.previousClose;
  const openPrice = extra.openPrice > 0 ? extra.openPrice : base.openPrice;
  const volume = extra.volume > 0 ? extra.volume : base.volume;

  let change = extra.change !== 0 ? extra.change : base.change;
  let changePercent = extra.changePercent !== 0 ? extra.changePercent : base.changePercent;

  if (previousClose > 0 && price > 0) {
    change = round2(price - previousClose);
    changePercent = round2(((price - previousClose) / previousClose) * 100);
  }

  let openPremiumPercent: number | null = base.openPremiumPercent;

  if (openPrice > 0 && previousClose > 0) {
    openPremiumPercent = round2(((openPrice - previousClose) / previousClose) * 100);
  }

  return {
    ...base,
    name: extra.name || base.name,
    price,
    change,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,

    turnoverRate:
      extra.turnoverRate !== null && extra.turnoverRate !== undefined
        ? extra.turnoverRate
        : base.turnoverRate,

    volumeRatio:
      extra.volumeRatio !== null && extra.volumeRatio !== undefined
        ? extra.volumeRatio
        : base.volumeRatio,

    floatMarketCapYi:
      extra.floatMarketCapYi !== null && extra.floatMarketCapYi !== undefined
        ? extra.floatMarketCapYi
        : base.floatMarketCapYi,
  };
}

async function enrichWithYahoo(stocks: StockItem[]) {
  const codes = stocks.map((stock) => stock.code);
  const yahooStocks = await fetchYahooQuotes(codes);

  if (yahooStocks.length === 0) return stocks;

  const yahooMap = new Map<string, StockItem>();

  yahooStocks.forEach((stock) => {
    yahooMap.set(stock.code, stock);
  });

  return stocks.map((stock) => {
    return mergeStockData(stock, yahooMap.get(stock.code));
  });
}

async function buildWatchList(codes: string[], rankedStocks: StockItem[]) {
  const rankedMap = new Map<string, StockItem>();

  rankedStocks.forEach((stock) => {
    rankedMap.set(stock.code, stock);
  });

  const yahooStocks = await fetchYahooQuotes(codes);
  const yahooMap = new Map<string, StockItem>();

  yahooStocks.forEach((stock) => {
    yahooMap.set(stock.code, stock);
  });

  return codes
    .map((code) => {
      const ranked = rankedMap.get(code);
      const yahoo = yahooMap.get(code);

      if (ranked && yahoo) return mergeStockData(ranked, yahoo);
      if (yahoo) return yahoo;
      if (ranked) return ranked;

      return null;
    })
    .filter(Boolean) as StockItem[];
}

function buildFallbackStocks() {
  const fallback: StockItem[] = [
    {
      code: "2330",
      name: "台積電",
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      openPrice: 0,
      previousClose: 0,
      openPremiumPercent: null,
      industry: "半導體",
      turnoverRate: null,
      volumeRatio: null,
      floatMarketCapYi: null,
    },
    {
      code: "3042",
      name: "晶技",
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      openPrice: 0,
      previousClose: 0,
      openPremiumPercent: null,
      industry: "PCB",
      turnoverRate: null,
      volumeRatio: null,
      floatMarketCapYi: null,
    },
    {
      code: "3714",
      name: "富采",
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      openPrice: 0,
      previousClose: 0,
      openPremiumPercent: null,
      industry: "光電",
      turnoverRate: null,
      volumeRatio: null,
      floatMarketCapYi: null,
    },
  ];

  return fallback;
}

function responseJson(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "access-control-allow-origin": "*",
    },
  });
}

export default async function handler(req: Request) {
  try {
    const watchCodes = getWatchCodesFromUrl(req);

    let rankedStocks = await fetchTwseOpenApiRanking();

    if (rankedStocks.length > 0) {
      rankedStocks = await enrichWithYahoo(rankedStocks);
    }

    rankedStocks = rankedStocks
      .filter((stock) => stock.price > 0 && stock.name)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 50);

    const watchList = await buildWatchList(watchCodes, rankedStocks);

    if (rankedStocks.length === 0) {
      const fallback = buildFallbackStocks();

      return responseJson({
        ok: false,
        source: "fallback",
        message: "TWSE OpenAPI 沒有取得有效資料，請稍後再試。",
        rankedStocks: fallback,
        watchList,
        updatedAt: new Date().toISOString(),
      });
    }

    return responseJson({
      ok: true,
      source: "twse_openapi_stock_day_all",
      message: "台股資料取得成功",
      rankedStocks,
      watchList,
      fields: {
        turnoverRate: "換手率，單位 %",
        volumeRatio: "量比",
        floatMarketCapYi: "流通市值，單位：億；若 Yahoo 無流通市值，會以市值欄位估算",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return responseJson(
      {
        ok: false,
        source: "error",
        message: error?.message || "API 發生錯誤",
        rankedStocks: [],
        watchList: [],
        updatedAt: new Date().toISOString(),
      },
      500
    );
  }
}