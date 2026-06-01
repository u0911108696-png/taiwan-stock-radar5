function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(200).json({
      ok: true,
      source: "stocks safe mode - use cache and search realtime",
      message: "stocks API 已進入安全模式，不再覆蓋單檔即時資料",
      updatedAtTaiwan: taiwanNowText(),
      count: 0,
      rankedStocks: [],
      stocks: [],
      data: [],
    });
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      source: "stocks safe mode",
      message: "stocks API 安全模式",
      error: err?.message || String(err),
      updatedAtTaiwan: taiwanNowText(),
      rankedStocks: [],
      stocks: [],
      data: [],
    });
  }
}