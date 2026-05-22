export const config = {
  runtime: "edge",
};

function cleanNumber(value: any) {
  return String(value || "0")
    .replace(/<[^>]*>/g, "")
    .replaceAll(",", "")
    .replace("+", "")
    .replace("X", "")
    .trim();
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

  if (!response.ok) throw new Error("TWSE 舊 API 失敗：" + response.status);

  const raw = await response.json();
  const rows = raw.data || [];

  return rows
    .map((row: any[]) => ({
      Code: String(row[0] || ""),
      Name: String(row[1] || ""),
      TradeVolume: cleanNumber(row[2]),
      ClosingPrice: cleanNumber(row[7]),
      Change: Number(cleanNumber(row[8]) || 0),
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

  if (!response.ok) throw new Error("TWSE OpenAPI 失敗：" + response.status);

  const rows = await response.json();

  return rows
    .map((item: any) => ({
      Code: String(item.Code || ""),
      Name: String(item.Name || ""),
      TradeVolume: cleanNumber(item.TradeVolume),
      ClosingPrice: cleanNumber(item.ClosingPrice),
      Change: Number(cleanNumber(item.Change) || 0),
    }))
    .filter((s: any) => /^\d{4}$/.test(s.Code));
}

export default async function handler() {
  try {
    let data: any[] = [];

    try {
      data = await fetchTwseOld();
    } catch (e1: any) {
      data = await fetchTwseOpenApi();
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
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