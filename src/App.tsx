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

type TabKey = "top50" | "watch" | "alert" | "industry" | "breakout" | "main";

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

function getStrengthLabel(stock: Stock) {
  const score = stockScore(stock);

  if (score >= 90) return { text: "🔥 超強勢", color: "text-red-300 border-red-400/50 bg-red-500/10" };
  if (score >= 80) return { text: "🚀 強勢", color: "text-cyan-300 border-cyan-400/50 bg-cyan-500/10" };
  if (score >= 65) return { text: "🟢 轉強", color: "text-green-300 border-green-400/50 bg-green-500/10" };
  if (score >= 50) return { text: "🟡 觀察", color: "text-yellow-300 border-yellow-400/50 bg-yellow-500/10" };
  return { text: "🔴 轉弱", color: "text-red-300 border-red-400/50 bg-red-500/10" };
}

function getStockTags(stock: Stock) {
  const tags: string[] = [];

  if (stock.changePercent >= 9.8) tags.push("漲停強勢");
  if (stock.changePercent >= 7) tags.push("漲幅 7%+");
  if (stock.changePercent >= 5) tags.push("剛突破");
  if (volumeLots(stock.volume) >= 10000) tags.push("巨量 1萬張+");
  if (volumeLots(stock.volume) >= 3000) tags.push("量能放大");
  if (stockScore(stock) >= 85) tags.push("強勢警報");
  if (stock.volume > 0 && stock.volume < 300000) tags.push("低量小心");

  return tags;
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
        className="flex-1 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-center text-xs font-bold text-cyan-200"
      >
        看K線
      </a>

      <a
        onClick={(e) => e.stopPropagation()}
        href={`https://tw.stock.yahoo.com/quote/${twseCode}.TW`}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-2 text-center text-xs font-bold text-red-100"
      >
        Yahoo股價
      </a>
    </div>
  );
}

function RadarCard({ stock, rank }: { stock: Stock; rank?: number }) {
  const score = stockScore(stock);
  const label = getStrengthLabel(stock);
  const tags = getStockTags(stock);

  return (
    <div
      onClick={() => openKLine(stock.code)}
      className="mb-4 cursor-pointer rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-4 shadow-lg shadow-cyan-950/20 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {rank && (
              <span className="text-sm font-bold text-slate-400">
                #{String(rank).padStart(2, "0")}
              </span>
            )}

            <span className="text-xl font-black text-white">{stock.name}</span>

            <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${label.color}`}>
              {label.text}
            </span>
          </div>

          <div className="mt-1 text-sm text-slate-400">
            {stock.code} ・ {stock.industry}
          </div>
        </div>

        <div className="relative grid h-14 w-14 place-items-center rounded-full border-4 border-cyan-400/70 bg-cyan-400/10 text-lg font-black text-cyan-200">
          {score}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="text-4xl font-black tracking-wide text-white">
            {stock.price.toFixed(stock.price >= 100 ? 0 : 2)}
          </div>

          <div
            className={
              stock.changePercent >= 0
                ? "mt-1 text-lg font-black text-red-400"
                : "mt-1 text-lg font-black text-green-400"
            }
          >
            {stock.changePercent >= 0 ? "▲" : "▼"} {Math.abs(stock.changePercent).toFixed(2)}%
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-slate-400">成交量</div>
          <div className="text-lg font-black text-white">
            {volumeLots(stock.volume).toLocaleString()} 張
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-200"
          >
            {tag}
          </span>
        ))}
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
  const [tab, setTab] = useState<TabKey>("top50");
  const [searchText, setSearchText] = useState("");

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

  const industryGroups = useMemo(() => buildIndustryGroups(stocks), [stocks]);
  const mainIndustryGroups = useMemo(
    () => industryGroups.filter((g) => g.industry !== "其他"),
    [industryGroups]
  );

  const strongestIndustry = mainIndustryGroups[0];

  const alertStocks = useMemo(() => {
    return stocks
      .filter((s) => s.changePercent >= 7 || stockScore(s) >= 85 || volumeLots(s.volume) >= 10000)
      .sort((a, b) => stockScore(b) - stockScore(a));
  }, [stocks]);

  const breakoutStocks = useMemo(() => {
    return stocks.filter((s) => s.changePercent >= 5).slice(0, 30);
  }, [stocks]);

  const mainForceStocks = useMemo(() => {
    return [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 30);
  }, [stocks]);

  const instant20 = useMemo(() => {
    return watchListStocks.length > 0 ? watchListStocks : stocks.slice(0, 20);
  }, [watchListStocks, stocks]);

  const tabStocks = useMemo(() => {
    if (tab === "top50") return stocks;
    if (tab === "watch") return instant20;
    if (tab === "alert") return alertStocks;
    if (tab === "breakout") return breakoutStocks;
    if (tab === "main") return mainForceStocks;
    return stocks;
  }, [tab, stocks, instant20, alertStocks, breakoutStocks, mainForceStocks]);

  const filteredTabStocks = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return tabStocks;

    return tabStocks.filter((s) => {
      return (
        s.code.toLowerCase().includes(keyword) ||
        s.name.toLowerCase().includes(keyword) ||
        s.industry.toLowerCase().includes(keyword)
      );
    });
  }, [tabStocks, searchText]);

  const strongCount = stocks.filter((s) => stockScore(s) >= 85).length;

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "top50", label: "漲幅50強", icon: "📈" },
    { key: "watch", label: "即時20", icon: "🛰️" },
    { key: "alert", label: "警報50", icon: "🚨" },
    { key: "industry", label: "強勢產業", icon: "🔥" },
    { key: "breakout", label: "剛突破", icon: "⚡" },
    { key: "main", label: "主力", icon: "💎" },
  ];

  return (
    <div className="min-h-screen bg-[#030712] pb-24 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black tracking-wider text-white">
              🔴 TW STRENGTH RADAR
            </h1>

            <button
              onClick={() => loadStocks(watchCodes)}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200"
            >
              掃描樣本 {stocks.length}
            </button>
          </div>

          <div className="mt-2 text-xs text-slate-400">
            資料日 2026-05-23 ・ 更新{" "}
            <span className="font-bold text-cyan-300">{updatedAt || "尚未更新"}</span> ・ 下次{" "}
            <span className="font-bold text-cyan-300">{nextRefresh}s</span>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-cyan-400/10 bg-slate-950/80 p-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? "whitespace-nowrap rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950"
                  : "whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-slate-300"
              }
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-cyan-400/10 bg-slate-900 p-3">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋代號 / 名稱 / 產業"
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="mb-4 rounded-2xl border border-cyan-400/10 bg-slate-900 p-3">
          <div className="mb-2 text-sm font-bold text-cyan-200">新增觀察股</div>

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
                className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm"
              >
                <span>{code}</span>
                <button onClick={() => removeWatchCode(code)} className="text-slate-400">
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
        </div>

        {loading && (
          <div className="mb-4 rounded-2xl bg-slate-800 p-4 text-center">
            資料載入中...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl bg-red-900 p-4 text-sm">
            錯誤：{error}
          </div>
        )}

        {strongestIndustry && (
          <section className="mb-5 rounded-3xl border border-red-400/10 bg-gradient-to-br from-red-500/20 to-cyan-500/10 p-4">
            <div className="text-sm font-bold text-yellow-300">今日最強主流</div>
            <div className="mt-1 text-3xl font-black">{strongestIndustry.industry}</div>
            <div className="mt-2 text-sm text-slate-300">
              {strongestIndustry.total} 檔進榜｜平均 +{strongestIndustry.avgChange}%｜強度{" "}
              {strongestIndustry.strength}
            </div>
          </section>
        )}

        <section>
          {tab === "industry" ? (
            <>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-2xl font-black">強勢產業</h2>
                <span className="text-sm text-slate-400">依強度排序</span>
              </div>

              {mainIndustryGroups.map((group, index) => (
                <div
                  key={group.industry}
                  className="mb-4 rounded-3xl border border-cyan-400/10 bg-slate-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-400">#{index + 1}</div>
                      <div className="text-3xl font-black text-white">{group.industry}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        平均 +{group.avgChange}%｜強度 {group.strength}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-black text-red-400">
                        {group.total}
                      </div>
                      <div className="text-sm text-slate-400">檔</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {group.stocks.slice(0, 3).map((s, i) => (
                      <RadarCard key={s.code} stock={s} rank={i + 1} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-2xl font-black">
                  {tabs.find((t) => t.key === tab)?.label}
                </h2>

                <span className="text-sm text-slate-400">
                  強勢 {strongCount} 檔
                </span>
              </div>

              {filteredTabStocks.length === 0 ? (
                <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                  目前沒有符合條件的股票
                </div>
              ) : (
                filteredTabStocks.map((stock, index) => (
                  <RadarCard key={stock.code} stock={stock} rank={index + 1} />
                ))
              )}
            </>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-cyan-400/10 bg-slate-950/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? "rounded-xl bg-cyan-400/20 px-1 py-2 text-xs font-black text-cyan-200"
                  : "rounded-xl px-1 py-2 text-xs font-bold text-slate-400"
              }
            >
              <div className="text-lg">{item.icon}</div>
              <div>{item.label.replace("漲幅", "").replace("強勢", "")}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}