export const config = {
  runtime: "edge",
};

export default async function handler() {
  try {
    const url =
      "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "TWSE API 連線失敗",
          status: response.status
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const raw = await response.json();
    const rows = raw.data || [];

    const data = rows
      .map((row: any[]) => {
        const code = String(row[0] || "");
        const name = String(row[1] || "");

        const changeText = String(row[8] || "0")
          .replace(/<[^>]*>/g, "")
          .replaceAll(",", "")
          .replace("X", "")
          .replace("+", "")
          .trim();

        return {
          Code: code,
          Name: name,
          TradeVolume: String(row[2] || "0").replaceAll(",", ""),
          ClosingPrice: String(row[7] || "0").replaceAll(",", ""),
          Change: Number(changeText || 0)
        };
      })
      .filter((s: any) => /^\d{4}$/.test(s.Code));

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || "伺服器抓取 TWSE 台股資料失敗"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}