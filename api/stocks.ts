export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json,text/plain,*/*",
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "TWSE API 連線失敗",
        status: response.status,
      });
    }

    const raw = await response.json();

    const data = (raw.data || []).map((row: any[]) => ({
      Code: row[0],
      Name: row[1],
      TradeVolume: String(row[2] || "0").replaceAll(",", ""),
      ClosingPrice: String(row[7] || "0").replaceAll(",", ""),
      Change: String(row[9] || "0")
        .replaceAll(",", "")
        .replace("X", "")
        .replace("+", ""),
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "伺服器抓取台股資料失敗",
    });
  }
}
