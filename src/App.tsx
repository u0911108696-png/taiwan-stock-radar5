import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  industry: string;
};

type IndustryGroup = {
  industry: string;
  total: number;
  avgChange: number;
  strength: number;
  stocks: Stock[];
};

const defaultWatchCodes = ["2330", "3042", "3714", "3481", "2356", "6168", "6405"];

const industryMap: Record<string, string> = {
  "2911": "百貨",
  "3042": "PCB",
  "3711": "半導體",
  "3714": "光電",
  "6168": "光電",
  "8374": "電機機械",
  "2356": "電腦週邊",
  "3481": "面板",
  "4722": "化工",
  "6405": "光電",
  "6278": "光電",

  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "2379": "半導體",
  "3661": "半導體",
  "2408": "半導體",

  "2317": "電子代工",
  "4938": "電子代工",
  "2354": "電子代工",
  "2382": "電腦週邊",
  "2357": "電腦週邊",
  "3231": "電腦週邊",
  "2301": "電腦週邊",
  "6669": "電腦週邊",
  "3017": "電腦週邊",

  "2308": "電子零組件",
  "2327": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",
  "2313": "PCB",
  "2367": "PCB",
  "4958": "PCB",

  "3008": "光電",
  "2409": "面板",
  "3406": "光電",

  "2345": "網通",
  "2412": "電信",
  "3045": "電信",
  "4904": "電信",

  "2880": "金融",
  "2881": "金融",
  "2882": "金融",
  "2883": "金融",
  "2884": "金融",
  "2885": "金融",
  "2886": "金融",
  "2887": "金融",
  "2888": "金融",
  "2889": "金融",
  "2890": "金融",
  "2891": "金融",
  "2892": "金融",
  "5871": "金融",
  "5876": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2605": "航運",
  "2606": "航運",
  "2610": "航空",
  "2618": "航空",

  "1301": "塑化",
  "1303": "塑化",
  "1326": "塑化",
  "6505": "塑化",
  "1717": "化工",
  "1722": "化工",
  "1723": "化工",

  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",
  "2023": "鋼鐵",
  "9958": "鋼鐵",

  "1101": "水泥",
  "1102": "水泥",
  "1103": "水泥",

  "2542": "營建",
  "2548": "營建",
  "2504": "營建",
  "2511": "營建",
  "2535": "營建",

  "2201": "汽車",
  "2204": "汽車",
  "2206": "汽車",
  "2207": "汽車",
  "2227": "汽車",

  "1216": "食品",
  "1227": "食品",
  "1231": "食品",
  "1232": "食品",

  "1707": "生技",
  "1760": "生技",
  "1783": "生技",
  "1795": "生技",
  "4142": "生技",

  "2707": "觀光",
  "2731": "觀光",
  "2912": "百貨",
  "5903": "百貨",
  "9910": "橡膠",
  "9921": "橡膠",
  "2105": "橡膠",
  "9904": "消費",
  "9907": "消費",
  "9914": "消費",
  "9926": "消費",
};

function getIndustry(code: string) {
  const cleanCode = String(code).trim().replace(/\D/g, "").slice(0, 4);
  return industryMap[cleanCode] || "其他";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStock(item: any): Stock {
  const code = String(item.Code ?? "").trim();
  const name = String(item.Name ?? "").trim();

  const price = Number(String(item.ClosingPrice ?? "0").replaceAll(",", ""));
  const volume = Number(String(item.TradeVolume ?? "0").replaceAll(",", ""));

  let changePercent = Number(item.ChangePercent ?? 0);

  if (!Number.isFinite(changePercent) || changePercent === 0) {
    const change = Number(String(item.Change ?? "0").replaceAll(",", ""));
    const previous = price - change;
    changePercent =
      previous > 0 ? Number(((change / previous) * 100).toFixed(2)) : 0;
  }

  return {
    code,
    name,
    price,
    changePercent,
    volume,
    industry: getIndustry(code),
  };
}

function getStockTag(stock: Stock) {
  if (stock.changePercent >= 9.8) return "🚀 漲停強勢";
  if (stock.changePercent >= 7) return "🔥 強勢股";
  if (stock.changePercent >= 5) return "剛突破";
  return "";
}

function getWatchStatus(stock: Stock) {
  if (stock.changePercent >= 5) {
    return {
      text: "🟢 強勢",
      style: "text-green-300",
      group: "strong",
    };
  }

  if (stock.changePercent >= 0) {
    return {
      text: "🟡 觀察",
      style: "text-yellow-300",
      group: "watch",
    };
  }

  return {
    text: "🔴 轉弱",
    style: "text-red-300",
    group: "weak",
  };
}

function isLowVolume(stock: Stock) {
  return stock.volume > 0 && stock.volume < 300000;
}

function isVolumeHot(stock: Stock) {
  return stock.volume >= 3000000;
}

function buildIndustryGroups(stocks: Stock[]) {
  const map: Record<string, Stock[]> = {};

  stocks.forEach((s) => {
    map[s.industry] = map[s.industry] || [];
    map[s.industry].push(s);
  });

  return Object.entries(map)
    .map(([industry, groupStocks]) => {
      const avgChange =
        groupStocks.reduce((sum, s) => sum + s.changePercent, 0) /
        groupStocks.length;

      const strength = Number((groupStocks.length * avgChange * 10).toFixed(0));

      return {
        industry,
        total: groupStocks.length,
        avgChange: Number(avgChange.toFixed(2)),
        strength,
        stocks: groupStocks.sort((a, b) => b.changePercent - a.changePercent),
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

function loadSavedWatchCodes() {
  try {
    const saved = localStorage.getItem("watchCodes");
    if (!saved) return defaultWatchCodes;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaultWatchCodes;

    const codes = parsed
      .map((code) => String(code).trim())
      .filter((code) => /^\d{4}$/.test(code));

    return codes.length > 0 ? codes : defaultWatchCodes;
  } catch {
    return defaultWatchCodes;
  }
}

function openKLine(code: string) {
  const twseCode = String(code).trim().replace(/\D/g, "").slice(0, 4);
  window.open(
    `https://tw.tradingview.com/chart/?symbol=TWSE:${twseCode}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function StockLinks({ code }: { code: string }) {
  const twseCode = String(code).trim().replace(/\D/g, "").slice(0, 4);

  return (
    <div className="mt-3 flex gap-2">
      <a
        onClick={(e) => e.stopPropagation()}
        href={`https://tw.tradingview.com/chart/?symbol=TWSE:${twseCode}`}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-xl bg-slate-700 px-3 py-2 text-center text-xs font-bold text-white"
      >
        看K線
      </a>

      <a
        onClick={(e) => e.stopPropagation()}
        href={`https://tw.stock.yahoo.com/quote/${twseCode}.TW`}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-center text-xs font-bold text-white"
      >
        Yahoo股價
      </a>
    </div>
  );
}

function StockCard({ stock, rank }: { stock: Stock; rank?: number }) {
  return (
    <div
      onClick={() => openKLine(stock.code)}
      className="mb-3 cursor-pointer rounded-xl bg-slate-800 p-3 active:scale-[0.99]"
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold">
            {rank ? `#${rank} ` : ""}
            {stock.code} {stock.name}
          </div>

          <div className="mt-2 text-xl font-bold text-white">
            即時價 {stock.price}
          </div>

          <div className="mt-1 text-sm text-slate-400">
            {stock.industry}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={
              stock.changePercent >= 0
                ? "text-lg font-bold text-red-400"
                : "text-lg font-bold text-green-400"
            }
          >
            {stock.changePercent >= 0 ? "+" : ""}
            {stock.changePercent}%
          </div>

          {getStockTag(stock) && (
            <div className="mt-1 text-xs text-yellow-300">
              {getStockTag(stock)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        成交量：{stock.volume.toLocaleString()}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {isVolumeHot(stock) && (
          <span className="rounded-full bg-red-500/20 px-2 py-1 text-red-300">
            量能放大
          </span>
        )}

        {isLowVolume(stock) && (
          <span className="rounded-full bg-orange-500/20 px-2 py-1 text-orange-300">
            低成交量
          </span>
        )}
      </div>

      <StockLinks code={stock.code} />
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [watchListStocks, setWatchListStocks] = useState<Stock[]>([]);
  const [watchCodes, setWatchCodes] = useState<string[]>(defaultWatchCodes);
  const [newWatchCode, setNewWatchCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [nextRefresh, setNextRefresh] = useState(60);
  const [selectedIndustry, setSelectedIndustry] = useState("全部");
  const [searchText, setSearchText] = useState("");

  async function loadStocks(codes = watchCodes) {
    try {
      setLoading(true);
      setError("");

      const watchParam = codes.join(",");
      const res = await fetch(
        "/api/stocks?watch=" + encodeURIComponent(watchParam) + "&t=" + Date.now(),
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error("台股 API 連線失敗");
      }

      const data = await res.json();

      const rankedRaw = Array.isArray(data)
        ? data
        : Array.isArray(data.rankedStocks)
          ? data.rankedStocks
          : [];

      const watchRaw = Array.isArray(data.watchList) ? data.watchList : [];

      const rankedList: Stock[] = rankedRaw
        .map(normalizeStock)
        .filter((s: Stock) => {
          return s.code && s.name && Number.isFinite(s.price) && s.price > 0;
        })
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
        .slice(0, 50);

      const watchList: Stock[] = watchRaw
        .map(normalizeStock)
        .filter((s: Stock) => {
          return s.code && s.name && Number.isFinite(s.price) && s.price > 0;
        });

      setStocks(rankedList);
      setWatchListStocks(watchList);
      setUpdatedAt(formatTime(new Date()));
      setNextRefresh(60);
    } catch (err: any) {
      setError(err.message || "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }

  function saveWatchCodes(codes: string[]) {
    const cleanCodes = Array.from(
      new Set(
        codes
          .map((code) => String(code).trim())
          .filter((code) => /^\d{4}$/.test(code))
      )
    );

    setWatchCodes(cleanCodes);
    localStorage.setItem("watchCodes", JSON.stringify(cleanCodes));
    loadStocks(cleanCodes);
  }

  function addWatchCode() {
    const code = newWatchCode.trim().replace(/\D/g, "").slice(0, 4);

    if (!/^\d{4}$/.test(code)) {
      setError("請輸入 4 碼股票代號，例如 2330");
      return;
    }

    if (watchCodes.includes(code)) {
      setError(code + " 已經在觀察名單");
      return;
    }

    setNewWatchCode("");
    setError("");
    saveWatchCodes([...watchCodes, code]);
  }

  function removeWatchCode(code: string) {
    const nextCodes = watchCodes.filter((item) => item !== code);
    saveWatchCodes(nextCodes.length > 0 ? nextCodes : defaultWatchCodes);
  }

  function resetWatchCodes() {
    saveWatchCodes(defaultWatchCodes);
  }

  useEffect(() => {
    const savedCodes = loadSavedWatchCodes();
    setWatchCodes(savedCodes);
    loadStocks(savedCodes);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) {
          loadStocks(watchCodes);
          return 60;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [watchCodes]);

  const watchAlerts = useMemo(() => {
    const strong = watchListStocks.filter((s) => getWatchStatus(s).group === "strong");
    const watch = watchListStocks.filter((s) => getWatchStatus(s).group === "watch");
    const weak = watchListStocks.filter((s) => getWatchStatus(s).group === "weak");

    return { strong, watch, weak };
  }, [watchListStocks]);

  const industryGroups = useMemo(() => {
    return buildIndustryGroups(stocks);
  }, [stocks]);

  const mainIndustryGroups = useMemo(() => {
    return industryGroups.filter((g) => g.industry !== "其他");
  }, [industryGroups]);

  const otherGroup = useMemo(() => {
    return industryGroups.find((g) => g.industry === "其他");
  }, [industryGroups]);

  const topIndustries = mainIndustryGroups.slice(0, 3);
  const strongestIndustry = topIndustries[0];

  const filterButtons = useMemo(() => {
    const topNames = topIndustries.map((g) => g.industry);
    return ["全部", ...topNames, "其他"];
  }, [topIndustries]);

  const filteredStocks = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return stocks.filter((s) => {
      const matchIndustry =
        selectedIndustry === "全部" || s.industry === selectedIndustry;

      const matchSearch =
        !keyword ||
        s.code.toLowerCase().includes(keyword) ||
        s.name.toLowerCase().includes(keyword) ||
        s.industry.toLowerCase().includes(keyword);

      return matchIndustry && matchSearch;
    });
  }, [stocks, selectedIndustry, searchText]);

  const breakoutStocks = filteredStocks
    .filter((s) => s.changePercent >= 5)
    .slice(0, 10);

  const showNames = (items: Stock[]) => {
    if (items.length === 0) return "無";
    return items.map((s) => `${s.code} ${s.name}`).join("、");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">台股即時雷達</h1>

          <p className="mt-1 text-sm text-slate-400">
            今日漲幅排行前 50 名 / 產業熱度 / 剛突破股票
          </p>

          <div className="mt-3 rounded-xl bg-slate-900 p-3 text-xs text-slate-400">
            <div>資料更新時間：{updatedAt || "尚未更新"}</div>
            <div className="mt-1">自動更新倒數：{nextRefresh} 秒</div>
          </div>
        </header>

        <button
          onClick={() => loadStocks(watchCodes)}
          className="mb-4 w-full rounded-xl bg-red-500 py-3 font-bold text-white"
        >
          重新整理即時資料
        </button>

        {loading && (
          <div className="rounded-xl bg-slate-800 p-4 text-center">
            資料載入中...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-900 p-4 text-sm">
            錯誤：{error}
          </div>
        )}

        {!loading && (
          <>
            {strongestIndustry && (
              <section className="mb-5 rounded-2xl bg-gradient-to-br from-red-500/20 to-yellow-500/10 p-4">
                <div className="text-sm text-yellow-300">今日最強主流</div>

                <div className="mt-1 text-2xl font-bold">
                  {strongestIndustry.industry}
                </div>

                <div className="mt-2 text-sm text-slate-300">
                  {strongestIndustry.total} 檔進榜｜平均 +
                  {strongestIndustry.avgChange}%｜強度{" "}
                  {strongestIndustry.strength}
                </div>
              </section>
            )}

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">新增觀察股</h2>

              <div className="flex gap-2">
                <input
                  value={newWatchCode}
                  onChange={(e) => setNewWatchCode(e.target.value)}
                  placeholder="輸入代號，例如 2454"
                  inputMode="numeric"
                  className="min-w-0 flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />

                <button
                  onClick={addWatchCode}
                  className="rounded-xl bg-red-500 px-4 text-sm font-bold text-white"
                >
                  加入
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {watchCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm"
                  >
                    <span>{code}</span>
                    <button
                      onClick={() => removeWatchCode(code)}
                      className="text-slate-400"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  onClick={resetWatchCodes}
                  className="rounded-full bg-slate-700 px-3 py-2 text-sm text-slate-300"
                >
                  還原預設
                </button>
              </div>
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">今日觀察警報</h2>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-green-500/10 p-3">
                  <div className="font-bold text-green-300">
                    🟢 強勢｜{watchAlerts.strong.length} 檔
                  </div>
                  <div className="mt-1 text-slate-300">
                    {showNames(watchAlerts.strong)}
                  </div>
                </div>

                <div className="rounded-xl bg-yellow-500/10 p-3">
                  <div className="font-bold text-yellow-300">
                    🟡 觀察｜{watchAlerts.watch.length} 檔
                  </div>
                  <div className="mt-1 text-slate-300">
                    {showNames(watchAlerts.watch)}
                  </div>
                </div>

                <div className="rounded-xl bg-red-500/10 p-3">
                  <div className="font-bold text-red-300">
                    🔴 轉弱｜{watchAlerts.weak.length} 檔
                  </div>
                  <div className="mt-1 text-slate-300">
                    {showNames(watchAlerts.weak)}
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">我的觀察名單</h2>

              {watchListStocks.length === 0 ? (
                <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-400">
                  觀察名單資料載入中，或目前沒有資料。
                </div>
              ) : (
                watchListStocks.map((s) => {
                  const status = getWatchStatus(s);

                  return (
                    <div
                      key={s.code}
                      onClick={() => openKLine(s.code)}
                      className="mb-3 cursor-pointer rounded-xl bg-slate-800 p-3 active:scale-[0.99]"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <div className="font-bold">
                            {s.code} {s.name}
                          </div>

                          <div className="mt-2 text-xl font-bold text-white">
                            即時價 {s.price}
                          </div>

                          <div className="mt-1 text-sm text-slate-400">
                            {s.industry}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={
                              s.changePercent >= 0
                                ? "text-lg font-bold text-red-400"
                                : "text-lg font-bold text-green-400"
                            }
                          >
                            {s.changePercent >= 0 ? "+" : ""}
                            {s.changePercent}%
                          </div>

                          {getStockTag(s) && (
                            <div className="mt-1 text-xs text-yellow-300">
                              {getStockTag(s)}
                            </div>
                          )}

                          <div className={`mt-1 text-xs ${status.style}`}>
                            {status.text}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        成交量：{s.volume.toLocaleString()}
                      </div>

                      <StockLinks code={s.code} />
                    </div>
                  );
                })
              )}
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">快速篩選</h2>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {filterButtons.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedIndustry(name)}
                    className={
                      selectedIndustry === name
                        ? "whitespace-nowrap rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white"
                        : "whitespace-nowrap rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300"
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜尋代號 / 名稱 / 產業"
                  className="min-w-0 flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />

                {searchText && (
                  <button
                    onClick={() => setSearchText("")}
                    className="rounded-xl bg-slate-700 px-3 text-sm text-slate-200"
                  >
                    清除
                  </button>
                )}
              </div>

              <div className="mt-3 text-xs text-slate-400">
                目前顯示：{selectedIndustry} / {filteredStocks.length} 檔
                {searchText ? ` / 搜尋：${searchText}` : ""}
              </div>
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">前三大主流產業</h2>

              {topIndustries.length === 0 ? (
                <p className="text-sm text-slate-400">
                  目前前 50 名多數還未分類，請繼續補產業表。
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {topIndustries.map((item, index) => (
                    <button
                      key={item.industry}
                      onClick={() => setSelectedIndustry(item.industry)}
                      className="rounded-2xl bg-slate-800 p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">
                            #{index + 1}
                          </div>
                          <div className="text-xl font-bold">
                            {item.industry}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-red-400">
                            {item.total} 檔
                          </div>
                          <div className="text-xs text-slate-400">
                            平均 +{item.avgChange}%｜強度 {item.strength}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">產業分類雷達</h2>

              {mainIndustryGroups.map((group) => (
                <div
                  key={group.industry}
                  className="mb-4 rounded-2xl bg-slate-800 p-3"
                >
                  <button
                    onClick={() => setSelectedIndustry(group.industry)}
                    className="mb-3 flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <div className="text-lg font-bold text-yellow-300">
                        {group.industry}
                      </div>
                      <div className="text-xs text-slate-400">
                        {group.total} 檔 / 平均 +{group.avgChange}% / 強度{" "}
                        {group.strength}
                      </div>
                    </div>

                    <div className="text-sm font-bold text-red-400">
                      {group.total} 檔
                    </div>
                  </button>

                  {group.stocks.slice(0, 5).map((s) => (
                    <StockCard key={s.code} stock={s} />
                  ))}
                </div>
              ))}

              {otherGroup && (
                <button
                  onClick={() => setSelectedIndustry("其他")}
                  className="mt-4 w-full rounded-2xl bg-slate-800 p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-300">
                        其他
                      </div>
                      <div className="text-xs text-slate-500">
                        尚未分類，不列入前三大主流產業
                      </div>
                    </div>

                    <div className="font-bold text-slate-400">
                      {otherGroup.total} 檔
                    </div>
                  </div>
                </button>
              )}
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">
                剛突破股票｜{selectedIndustry}
              </h2>

              {breakoutStocks.length === 0 ? (
                <p className="text-sm text-slate-400">
                  目前沒有符合條件的股票
                </p>
              ) : (
                breakoutStocks.map((s) => (
                  <StockCard key={s.code} stock={s} />
                ))
              )}
            </section>

            <section className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">
                漲幅排行｜{selectedIndustry}
              </h2>

              {filteredStocks.length === 0 ? (
                <p className="text-sm text-slate-400">
                  沒有符合搜尋條件的股票
                </p>
              ) : (
                filteredStocks.map((s, index) => (
                  <StockCard key={s.code} stock={s} rank={index + 1} />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}