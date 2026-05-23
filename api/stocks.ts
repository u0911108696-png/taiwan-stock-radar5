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
    .trim();

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function getWatchCodesFromUrl(req: Request) {
  const url = new URL(req.url);
  const watch = url.searchParams.get("watch");

  if (!watch) return defaultWatchListCodes;

  const codes = watch
    .split(",")
    .map((code) => code.trim())
    .filter((code) => /^\d{4}$/.test(code));

  return codes.length > 0 ? codes : defaultWatchListCodes;
}

function taiwanDateString(daysAgo = 0) {
  const taiwanNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  taiwanNow.setUTCDate(taiwanNow.getUTCDate() - daysAgo);

  const year = taiwanNow.getUTCFullYear();
  const month = String(taiwanNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(taiwanNow.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

async function fetchTwseDaily(date: string) {
  const url =
    "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX" +
    `?date=${date}&type=ALLBUT0999&response=json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("TWSE API 連線失敗");
  }

  const data = await res.json();

  if (!data || data.stat !== "OK" || !Array.isArray(data.tables)) {
    throw new Error("TWSE 尚未提供該日資料");
  }

  const table = data.tables.find((item: any) => {
    const fields = item.fields || [];
    return (
      fields.includes("證券代號") &&
      fields.includes("證券名稱") &&
      fields.includes("開盤價") &&
      fields.includes("收盤價")
    );
  });

  if (!table || !Array.isArray(table.data)) {
    throw new Error("找不到每日收盤行情表");
  }

  return table;
}

async function getLatestTwseTable() {
  let lastError = "";

  for (let i = 0; i < 12; i++) {
    const date = taiwanDateString(i);

    try {
      const table = await fetchTwseDaily(date);
      return {
        date,
        table,
      };
    } catch (error: any) {
      lastError = error?.message || "資料取得失敗";
    }
  }

  throw new Error(lastError || "找不到最近交易日資料");
}

function rowToObject(fields: string[], row: any[]) {
  const obj: Record<string, any> = {};

  fields.forEach((field, index) => {
    obj[field] = row[index];
  });

  return obj;
}

function normalizeStock(fields: string[], row: any[]) {
  const item = rowToObject(fields, row);

  const code = cleanText(item["證券代號"]);
  const name = cleanText(item["證券名稱"]);

  const volume = toNumber(item["成交股數"]);
  const openPrice = toNumber(item["開盤價"]);
  const highPrice = toNumber(item["最高價"]);
  const lowPrice = toNumber(item["最低價"]);
  const closingPrice = toNumber(item["收盤價"]);

  const signText = cleanText(item["漲跌(+/-)"]);
  const changeValue = toNumber(item["漲跌價差"]);

  let signedChange = changeValue;

  if (signText.includes("-")) {
    signedChange = -changeValue;
  }

  const previousClose =
    closingPrice > 0 ? Number((closingPrice - signedChange).toFixed(2)) : 0;

  const changePercent =
    previousClose > 0
      ? Number(((signedChange / previousClose) * 100).toFixed(2))
      : 0;

  const openPremiumPercent =
    openPrice > 0 && previousClose > 0
      ? Number((((openPrice - previousClose) / previousClose) * 100).toFixed(2))
      : null;

  return {
    Code: code,
    Name: name,

    ClosingPrice: closingPrice,
    OpeningPrice: openPrice,
    HighPrice: highPrice,
    LowPrice: lowPrice,
    PreviousClose: previousClose,

    Change: Number(signedChange.toFixed(2)),
    ChangePercent: changePercent,
    OpenPremiumPercent: openPremiumPercent,

    TradeVolume: volume,
  };
}

export default async function handler(req: Request) {
  try {
    const watchCodes = getWatchCodesFromUrl(req);

    const { date, table } = await getLatestTwseTable();

    const fields: string[] = table.fields || [];
    const rows: any[][] = table.data || [];

    const allStocks = rows
      .map((row) => normalizeStock(fields, row))
      .filter((stock) => {
        return (
          /^\d{4}$/.test(stock.Code) &&
          stock.Name &&
          stock.ClosingPrice > 0
        );
      });

    const rankedStocks = allStocks
      .filter((stock) => stock.ChangePercent > 0)
      .sort((a, b) => b.ChangePercent - a.ChangePercent)
      .slice(0, 50);

    const watchList = watchCodes
      .map((code) => allStocks.find((stock) => stock.Code === code))
      .filter(Boolean);

    return Response.json(
      {
        ok: true,
        source: "TWSE",
        date,
        rankedStocks,
        watchList,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return Response.json(
      {
        ok: false,
        message: error?.message || "台股資料取得失敗",
        rankedStocks: [],
        watchList: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}