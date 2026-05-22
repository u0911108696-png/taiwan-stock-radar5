const stockList = [
  "2330", "2317", "2454", "2303", "2308", "2382", "2357", "3231", "3008", "2412",
  "2603", "2609", "2615", "2881", "2882", "2884", "2891", "1301", "1303", "2002",
  "2327", "2379", "3661", "3034", "3035", "3443", "3711", "2345", "3017", "6669",
  "1101", "1102", "1216", "2207", "2301", "2408", "2409", "2618", "3037", "3189",
  "3293", "3653", "3702", "4938", "5871", "5876", "6505", "8046", "8454", "9910"
];

export default async function handler(req: any, res: any) {
  try {
    const symbols = stockList.map((code) => `${code}.TW`).join(",");

    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Yahoo 台股 API 連線失敗",
        status: response.status,
      });
    }

    const raw = await response.json();
    const result = raw.quoteResponse?.result || [];

    const data = result.map((item: any) => {
      const code = String(item.symbol || "").replace(".TW", "");

      return {
        Code: code,
        Name: item.shortName || item.longName || code,
        TradeVolume: item.regularMarketVolume || 0,
        ClosingPrice: item.regularMarketPrice || 0,
        Change: item.regularMarketChange || 0,
      };
    });

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "伺服器抓取 Yahoo 台股資料失敗",
    });
  }
}