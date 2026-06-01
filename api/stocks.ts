export default function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return res.status(200).json({
    ok: true,
    source: "stocks safe mode",
    message: "stocks API 安全模式，避免舊資料覆蓋單檔即時資料",
    updatedAtTaiwan: new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Taipei",
      hour12: false,
    }),
    count: 0,
    rankedStocks: [],
    stocks: [],
    data: [],
  });
}