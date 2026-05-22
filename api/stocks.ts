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

    const data = rows.map((row: any[]) => {
      const sign = String(row[8] || "");
      const changeRaw = String(row[9] || "0")
        .replaceAll(",", "")
        .replace("X", "")
        .replace("+", "")
        .trim();

      const changeNumber = Number(changeRaw || 0);
      const change =
        sign.includes("-") || sign.includes("down")
          ? -Math.abs(changeNumber)
          : changeNumber;

      return {
        Code: String(row[0] || ""),
        Name: String(row[1] || ""),
        TradeVolume: String(row[2] || "0").replaceAll(",", ""),
        ClosingPrice: String(row[7] || "0").replaceAll(",", ""),
        Change: change
      };
    });

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
