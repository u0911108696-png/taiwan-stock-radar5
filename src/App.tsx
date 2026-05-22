async function loadStocks() {
  try {
    setLoading(true);
    setError("");

    const res = await fetch("/api/stocks?t=" + Date.now(), {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("台股 API 連線失敗");
    }

    const data = await res.json();

    const list: Stock[] = data
      .map((item: any) => {
        const code = String(item.Code ?? "").trim();
        const name = String(item.Name ?? "").trim();

        const price = Number(
          String(item.ClosingPrice ?? "0").replaceAll(",", "")
        );

        const change = Number(
          String(item.Change ?? "0").replaceAll(",", "")
        );

        const previous = price - change;

        const changePercent =
          previous > 0 ? Number(((change / previous) * 100).toFixed(2)) : 0;

        return {
          code,
          name,
          price,
          changePercent,
          volume: Number(String(item.TradeVolume ?? "0").replaceAll(",", "")),
          industry: getIndustry(code),
        };
      })
      .filter((s: Stock) => {
        return s.code && s.name && Number.isFinite(s.price) && s.price > 0;
      })
      .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
      .slice(0, 50);

    setStocks(list);
  } catch (err: any) {
    setError(err.message || "資料載入失敗");
  } finally {
    setLoading(false);
  }
}