export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "TWSE API 連線失敗",
        status: response.status,
      });
    }

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "伺服器抓取台股資料失敗",
    });
  }
}
