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
  "6405"
];

function cleanNumber(value: any) {
  return String(value || "0")
    .replace(/<[^>]*>/g, "")
    .replaceAll(",", "")
    .replace("+", "")
    .replace("X", "")
    .trim();
}

function parseChange(value: any) {
  const text = cleanNumber(value);
  return Number(text || 0);
}

function getWatchCodesFromUrl(req: Request) {
  const url = new URL(req.url);
  const watch = url.searchParams.get("watch");

  if (!watch) {
    return defaultWatchListCodes;
  }

  const codes = watch
    .split(",")
    .map((code) => code.trim())
    .filter((code) => /^\d{4}$/.test(code));

  return codes.length > 0 ? codes : defaultWatchListCodes;
}

async function fetchTwseOld() {
  const response = await fetch(
    "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("TWSE 舊 API 失敗：" + response.status);
  }

  const raw = await response.json();
  const rows = raw.data || [];

  return rows
    .map((row: any[]) => ({
      Code: String(row[0] || ""),
      Name: String(row[1] || ""),
      TradeVolume: cleanNumber(row[2]),
      ClosingPrice: cleanNumber(row[7]),
      Change: parseChange(row[8]),
    }))
    .filter((s: any) => /^\d{4}$/.test(s.Code));
}

async function fetchTwseOpenApi() {
  const response = await fetch(
    "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("TWSE OpenAPI 失敗：" + response.status);
  }

  const rows = await response.json();

  return rows
    .map((item: any) => ({
      Code: String(item.Code || ""),
      Name: String(item.Name || ""),
      TradeVolume: cleanNumber(item.TradeVolume),
      ClosingPrice: cleanNumber(item.ClosingPrice),
      Change: parseChange(item.Change),
    }))
    .filter((s: any) => /^\d{4}$/.test(s.Code));
}

function addChangePercent(item: any) {
  const price = Number(cleanNumber(item.ClosingPrice));
  const change = Number(cleanNumber(item.Change));
  const previous = price - change;

  const changePercent =
    previous > 0 ? Number(((change / previous) * 100).toFixed(2)) : 0;

  return {
    ...item,
    ChangePercent: changePercent,
  };
}

export default async function handler(req: Request) {
  try {
    const watchListCodes = getWatchCodesFromUrl(req);

    let allStocks: any[] = [];

    try {
      allStocks = await fetchTwseOld();
    } catch (e1: any) {
      allStocks = await fetchTwseOpenApi();
    }

    const rankedStocks = allStocks
      .map(addChangePercent)
      .filter((s: any) => {
        return Number(s.ClosingPrice) > 0 && Number.isFinite(s.ChangePercent);
      })
      .sort((a: any, b: any) => b.ChangePercent - a.ChangePercent)
      .slice(0, 50);

    const watchList = watchListCodes
      .map((code) => allStocks.find((s: any) => s.Code === code))
      .filter(Boolean)
      .map(addChangePercent);

    return new Response(
      JSON.stringify({
        rankedStocks,
        watchList,
        watchListCodes,
        total: allStocks.length,
        updatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || "伺服器抓取台股資料失敗",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}