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

type TabKey = "top50" | "watch" | "industry" | "breakout" | "alert";

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

  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2886": "金融",
  "2891": "金融",
  "2892": "金融",
  "5871": "金融",
  "5876": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",

  "1301": "塑化",
  "1303": "塑化",
  "6505": "塑化",
  "1717": "化工",
  "1722": "化工",

  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",

  "1101": "水泥",
  "1102": "水泥",

  "2201": "汽車",
  "2207": "汽車",
  "2227": "汽車",

  "1216": "食品",
  "1227": "食品",

  "1707": "生技",
  "1760": "生技",
  "1783": "生技",

  "2912": "百貨",
  "5903": "百貨",
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
    second: "2-digit",
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

function volumeLots(volume: number) {
  return Math.round(volume / 1000);
}

function stockScore(stock: Stock) {
  let score = 50;

  if (stock.changePercent >= 9.8) score += 35;
  else if (stock.changePercent >= 7) score += 25;
  else if (stock.changePercent >= 5) score += 15;
  else if (stock.changePercent >= 3) score += 8;
  else if (stock.changePercent < 0) score -= 20;

  if (volumeLots(stock.volume) >= 10000) score += 10;
  else if (volumeLots(stock.volume) >= 3000) score += 6;

  return Math.max(0, Math.min(99, score));
}

function stockStatus(stock: Stock) {
  if (stock.changePercent >= 9.8) return "強勢";
  if (stock.changePercent >= 5) return "突破";
  if (stock.changePercent >= 0) return "觀察";
  return "轉弱";
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

      const strength = Math.round(groupStocks.length * avgChange * 10);

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

function StockCard({ stock, rank }: { stock: Stock; rank?: number }) {
  const status = stockStatus(stock);

  return (
    <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {rank && (
              <div className="text-lg font-black text-red-400">{rank}</div>
            )}

            <div>
              <div className="text-lg font-black text-white">
                {stock.name}
                <span className="ml-2 text-sm text-slate-400">{stock.code}</span>
              </div>

              <div className="mt-1 text-sm text-slate-400">
                {stock.industry}｜成交量 {volumeLots(stock.volume).toLocaleString()} 張
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
            {stock.changePercent >= 0 ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </div>

          <div
            className={
              status === "強勢"
                ? "mt-2 text-xs font-bold text-green-400"
                : status === "突破"
                  ? "mt-2 text-xs font-bold text-yellow-400"
                  : status === "轉弱"
                    ? "mt-2 text-xs font-bold text-slate-400"
                    : "mt-2 text-xs font-bold text-orange-300"
            }
          >
            {status}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500">即時價</div>
          <div className="text-3xl font-black text-white">
            {stock.price.toFixed(stock.price >= 100 ? 0 : 2)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-bold text-slate-500">強度</div>
          <div className="text-2xl font-black text-red-400">
            {stockScore(stock)}
          </div>
        </div>
      </div>
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
  const [tab, setTab] = useState<TabKey>("top50");

  async function loadStocks(codes = watchCodes) {
    try {
      setLoading(true);
      setError("");

      const watchParam = codes.join(",");
      const res = await fetch(
        "/api/stocks?watch=" + encodeURIComponent(watchParam) + "&t=" + Date.now(),
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error("台股 API 連線失敗");

      const data = await res.json();

      const rankedRaw = Array.isArray(data)
        ? data
        : Array.isArray(data.rankedStocks)
          ? data.rankedStocks
          : [];

      const watchRaw = Array.isArray(data.watchList) ? data.watchList : [];

      const rankedList: Stock[] = rankedRaw
        .map(normalizeStock)
        .filter((s: Stock) => s.code && s.name && Number.isFinite(s.price) && s.price > 0)
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
        .slice(0, 50);

      const watchList: Stock[] = watchRaw
        .map(normalizeStock)
        .filter((s: Stock) => s.code && s.name && Number.isFinite(s.price) && s.price > 0);

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
      setError(code + " 已經在自選名單");
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

  const industryGroups = useMemo(() => buildIndustryGroups(stocks), [stocks]);
  const mainIndustryGroups = useMemo(
    () => industryGroups.filter((g) => g.industry !== "其他"),
    [industryGroups]
  );

  const strongestIndustry = mainIndustryGroups[0];

  const strongStocks = stocks.filter((s) => stockStatus(s) === "強勢");
  const watchStocks = stocks.filter((s) => stockStatus(s) === "觀察");
  const alertStocks = stocks
    .filter((s) => s.changePercent >= 7 || stockScore(s) >= 85 || volumeLots(s.volume) >= 10000)
    .sort((a, b) => stockScore(b) - stockScore(a));

  const lowVolumeStocks = stocks.filter((s) => s.volume > 0 && s.volume < 300000);
  const breakoutStocks = stocks.filter((s) => s.changePercent >= 5);

  const tabStocks = useMemo(() => {
    if (tab === "top50") return stocks;
    if (tab === "watch") return watchListStocks;
    if (tab === "breakout") return breakoutStocks;
    if (tab === "alert") return alertStocks;
    return stocks;
  }, [tab, stocks, watchListStocks, breakoutStocks, alertStocks]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "top50", label: "50強", icon: "📊" },
    { key: "watch", label: "自選", icon: "☆" },
    { key: "industry", label: "產業", icon: "▮" },
    { key: "breakout", label: "突破", icon: "⚡" },
    { key: "alert", label: "警報", icon: "🔔" },
  ];

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-wide">
                台股即時雷達
              </h1>
              <div className="mt-2 text-sm font-bold text-slate-400">
                更新 {updatedAt || "尚未更新"}｜下次 {nextRefresh}s
              </div>
            </div>

            <button
              onClick={() => loadStocks(watchCodes)}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-700 bg-slate-900 text-xl"
            >
              ↻
            </button>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? "whitespace-nowrap rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white"
                  : "whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-slate-300"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mb-4 rounded-2xl bg-slate-900 p-4 text-center">
            資料載入中...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl bg-red-950 p-4 text-sm font-bold text-red-200">
            錯誤：{error}
          </div>
        )}

        {strongestIndustry && (
          <section className="mb-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 p-5 shadow-lg shadow-red-950/40">
            <div className="text-sm font-bold text-red-100">👑 今日最強主流</div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-5xl font-black">{strongestIndustry.industry}</div>
              <div className="text-2xl font-black">{strongestIndustry.total} 檔</div>
            </div>
            <div className="mt-3 text-lg font-black text-white">
              平均漲幅 +{strongestIndustry.avgChange}%
            </div>
          </section>
        )}

        {tab === "watch" && (
          <section className="mb-4 rounded-2xl bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-black">自選股新增 / 刪除</h2>

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
                className="rounded-xl bg-red-500 px-4 text-sm font-black text-white"
              >
                加入
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {watchCodes.map((code) => (
                <div
                  key={code}
                  className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm font-bold"
                >
                  <span>{code}</span>
                  <button onClick={() => removeWatchCode(code)} className="text-slate-400">
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={resetWatchCodes}
                className="rounded-full bg-slate-700 px-3 py-2 text-sm font-bold text-slate-300"
              >
                還原預設
              </button>
            </div>
          </section>
        )}

        {tab === "industry" ? (
          <section>
            <h2 className="mb-3 text-xl font-black">產業排行</h2>

            {mainIndustryGroups.map((group, index) => (
              <div
                key={group.industry}
                className="mb-3 rounded-2xl bg-slate-900 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                    <div className="text-3xl font-black">{group.industry}</div>
                    <div className="mt-1 text-sm font-bold text-slate-400">
                      平均漲幅{" "}
                      <span className="text-red-400">+{group.avgChange}%</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-black text-red-400">
                      {group.total}
                    </div>
                    <div className="text-sm font-bold text-slate-400">檔</div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">
                {tab === "top50" && "漲幅排行 TOP 50"}
                {tab === "watch" && "自選股"}
                {tab === "breakout" && "突破股"}
                {tab === "alert" && "警報股"}
              </h2>

              <span className="text-sm font-bold text-slate-400">
                {tabStocks.length} 檔
              </span>
            </div>

            {tabStocks.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                目前沒有符合條件的股票
              </div>
            ) : (
              tabStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} />
              ))
            )}
          </section>
        )}

        {tab === "top50" && (
          <section className="mt-5">
            <h2 className="mb-3 text-xl font-black">強勢指標統計</h2>

            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-2xl border border-green-900 bg-green-950 p-3 text-center">
                <div className="text-sm font-bold text-green-300">強勢股</div>
                <div className="mt-1 text-3xl font-black text-green-300">
                  {strongStocks.length}
                </div>
                <div className="text-xs text-green-400">檔</div>
              </div>

              <div className="rounded-2xl border border-yellow-900 bg-yellow-950 p-3 text-center">
                <div className="text-sm font-bold text-yellow-300">觀察股</div>
                <div className="mt-1 text-3xl font-black text-yellow-300">
                  {watchStocks.length}
                </div>
                <div className="text-xs text-yellow-400">檔</div>
              </div>

              <div className="rounded-2xl border border-red-900 bg-red-950 p-3 text-center">
                <div className="text-sm font-bold text-red-300">警報股</div>
                <div className="mt-1 text-3xl font-black text-red-300">
                  {alertStocks.length}
                </div>
                <div className="text-xs text-red-400">檔</div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-center">
                <div className="text-sm font-bold text-slate-300">低量股</div>
                <div className="mt-1 text-3xl font-black text-slate-300">
                  {lowVolumeStocks.length}
                </div>
                <div className="text-xs text-slate-400">檔</div>
              </div>
            </div>
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? "rounded-xl px-1 py-2 text-xs font-black text-red-500"
                  : "rounded-xl px-1 py-2 text-xs font-bold text-slate-400"
              }
            >
              <div className="text-xl">{item.icon}</div>
              <div>{item.label}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}