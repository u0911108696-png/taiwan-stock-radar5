import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  industry: string;
};

type TabKey = "top50" | "watch" | "industry" | "breakout" | "alert";
type SortKey = "change" | "volume" | "score";
type FilterKey = "all" | "strong" | "breakout" | "alert" | "lowVolume";
type ModeKey = "open" | "normal";

const defaultWatchCodes = ["2330", "3042", "3714", "3481", "2356", "6168", "6405"];

const industryMap: Record<string, string> = {
  "2911": "百貨", "3042": "PCB", "3711": "半導體", "3714": "光電",
  "6168": "光電", "8374": "電機機械", "2356": "電腦週邊", "3481": "面板",
  "4722": "化工", "6405": "光電", "6278": "光電",

  "2330": "半導體", "2303": "半導體", "2454": "半導體", "3034": "半導體",
  "3035": "半導體", "3443": "半導體", "2379": "半導體", "3661": "半導體",
  "2408": "半導體",

  "2317": "電子代工", "4938": "電子代工", "2354": "電子代工",
  "2382": "電腦週邊", "2357": "電腦週邊", "3231": "電腦週邊",
  "2301": "電腦週邊", "6669": "電腦週邊", "3017": "電腦週邊",

  "2308": "電子零組件", "2327": "電子零組件", "3037": "電子零組件",
  "8046": "電子零組件", "2313": "PCB", "2367": "PCB", "4958": "PCB",

  "3008": "光電", "2409": "面板", "3406": "光電",

  "2881": "金融", "2882": "金融", "2884": "金融", "2886": "金融",
  "2891": "金融", "2892": "金融", "5871": "金融", "5876": "金融",

  "2603": "航運", "2609": "航運", "2615": "航運", "2618": "航空",

  "1301": "塑化", "1303": "塑化", "6505": "塑化",
  "1717": "化工", "1722": "化工",

  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵",
  "1101": "水泥", "1102": "水泥",
  "2201": "汽車", "2207": "汽車", "2227": "汽車",
  "1216": "食品", "1227": "食品",
  "1707": "生技", "1760": "生技", "1783": "生技",
  "2912": "百貨", "5903": "百貨",
  "9904": "消費", "9907": "消費", "9914": "消費", "9926": "消費",
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

function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const isWeekday = day >= 1 && day <= 5;
  const preOpenStart = 8 * 60 + 30;
  const marketOpen = 9 * 60;
  const marketClose = 13 * 60 + 30;

  if (!isWeekday) {
    return {
      title: "⚠️ 非交易日",
      text: "目前可能是最近一次交易資料，請注意資料日期。",
      color: "border-yellow-900 bg-yellow-950/50 text-yellow-200",
    };
  }

  if (totalMinutes < preOpenStart) {
    return {
      title: "⚠️ 開盤前",
      text: "目前可能是昨日或最近一次交易資料。",
      color: "border-yellow-900 bg-yellow-950/50 text-yellow-200",
    };
  }

  if (totalMinutes >= preOpenStart && totalMinutes < marketOpen) {
    return {
      title: "⏳ 開盤前準備",
      text: "接近開盤，資料可能尚未完整更新。",
      color: "border-orange-900 bg-orange-950/50 text-orange-200",
    };
  }

  if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
    return {
      title: "✅ 今日盤中資料",
      text: "目前為台股盤中時間，資料較接近即時。",
      color: "border-green-900 bg-green-950/50 text-green-200",
    };
  }

  return {
    title: "⚠️ 收盤後",
    text: "目前可能是今日收盤或最近一次交易資料。",
    color: "border-slate-700 bg-slate-900 text-slate-300",
  };
}

function getStockLinks(code: string) {
  const twseCode = String(code).trim().replace(/\D/g, "").slice(0, 4);

  return {
    kline: `https://tw.tradingview.com/chart/?symbol=TWSE:${twseCode}`,
    yahoo: `https://tw.stock.yahoo.com/quote/${twseCode}.TW`,
  };
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

function isAlertStock(stock: Stock) {
  return (
    stock.changePercent >= 7 ||
    stockScore(stock) >= 85 ||
    volumeLots(stock.volume) >= 10000
  );
}

function sortStocks(list: Stock[], sortKey: SortKey) {
  const copied = [...list];

  if (sortKey === "volume") return copied.sort((a, b) => b.volume - a.volume);
  if (sortKey === "score") return copied.sort((a, b) => stockScore(b) - stockScore(a));

  return copied.sort((a, b) => b.changePercent - a.changePercent);
}

function filterByQuick(list: Stock[], filterKey: FilterKey) {
  if (filterKey === "strong") return list.filter((s) => s.changePercent >= 9.8);
  if (filterKey === "breakout") return list.filter((s) => s.changePercent >= 5);
  if (filterKey === "alert") return list.filter(isAlertStock);
  if (filterKey === "lowVolume") return list.filter((s) => s.volume > 0 && s.volume < 300000);
  return list;
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

function buildIndustryGroups(stocks: Stock[], sortKey: SortKey) {
  const map: Record<string, Stock[]> = {};

  stocks.forEach((s) => {
    map[s.industry] = map[s.industry] || [];
    map[s.industry].push(s);
  });

  return Object.entries(map)
    .map(([industry, groupStocks]) => {
      const avgChange =
        groupStocks.reduce((sum, s) => sum + s.changePercent, 0) / groupStocks.length;

      const strength = Math.round(groupStocks.length * avgChange * 10);

      return {
        industry,
        total: groupStocks.length,
        avgChange: Number(avgChange.toFixed(2)),
        strength,
        stocks: sortStocks(groupStocks, sortKey),
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

function getTradeAdvice(stock: Stock) {
  const advice: string[] = [];

  if (stock.changePercent >= 9.8) {
    advice.push("🔥 強勢追蹤：漲幅接近漲停，屬於今日強勢股");
    advice.push("⚠️ 注意風險：漲幅已高，避免盲目追高");
    advice.push("📌 觀察重點：是否持續鎖住高檔、成交量是否放大");
  } else if (stock.changePercent >= 7) {
    advice.push("🚨 警報股：漲幅超過 7%，短線動能強");
    advice.push("⚠️ 注意風險：若量能不足，容易拉高震盪");
    advice.push("📌 觀察重點：是否能守住高點附近");
  } else if (stock.changePercent >= 5) {
    advice.push("⚡ 突破股：漲幅超過 5%，可列入觀察");
    advice.push("📌 觀察重點：是否放量突破、是否有同產業一起轉強");
  } else if (stock.changePercent >= 0) {
    advice.push("🟡 觀察股：目前沒有明顯轉弱");
    advice.push("📌 觀察重點：是否有量能增加、是否往強勢區靠近");
  } else {
    advice.push("🔴 轉弱股：目前漲幅為負，先保守觀察");
    advice.push("⚠️ 注意風險：不要急著追，等轉強訊號再看");
  }

  if (volumeLots(stock.volume) < 300) {
    advice.push("⚠️ 成交量偏低：流動性較差，進出要小心");
  }

  if (stockScore(stock) >= 85) {
    advice.push("✅ 強度高：符合警報條件，可優先追蹤");
  }

  return advice;
}

function getAlertReasons(stock: Stock, strongIndustryNames: string[]) {
  const reasons: string[] = [];

  if (stock.changePercent >= 9.8) reasons.push("漲幅接近漲停");
  else if (stock.changePercent >= 7) reasons.push("漲幅超過 7%");
  else if (stock.changePercent >= 5) reasons.push("漲幅超過 5%，屬於突破股");

  if (volumeLots(stock.volume) >= 10000) reasons.push("成交量超過 1 萬張");
  else if (volumeLots(stock.volume) >= 3000) reasons.push("成交量放大");

  if (stockScore(stock) >= 85) reasons.push("強度分數達警報區");
  if (strongIndustryNames.includes(stock.industry)) reasons.push("屬於今日強勢產業");

  if (reasons.length === 0) reasons.push("目前屬於一般觀察");

  return reasons;
}

function MiniLine() {
  return (
    <div className="mt-1 h-6 w-16">
      <svg viewBox="0 0 100 36" className="h-full w-full">
        <polyline
          points="4,29 18,27 32,19 46,19 58,17 70,24 82,12 96,14"
          fill="none"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function StockRow({
  stock,
  rank,
  onClick,
  compact = false,
}: {
  stock: Stock;
  rank: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const status = stockStatus(stock);

  return (
    <button
      onClick={onClick}
      className="mb-2 w-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-black p-3 text-left active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-6 text-xl font-black text-red-500">{rank}</div>

          <div className="min-w-0">
            <div className="truncate text-lg font-black text-white">
              {stock.name}
              <span className="ml-2 text-xs text-slate-400">{stock.code}</span>
            </div>

            <div className={compact ? "mt-1 text-xl font-black text-white" : "mt-1 text-2xl font-black text-white"}>
              {stock.price.toFixed(stock.price >= 100 ? 0 : 2)}
            </div>

            <div className="mt-1 text-xs font-bold text-slate-500">
              {stock.industry}｜成交量 {volumeLots(stock.volume).toLocaleString()} 張
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
            {stock.changePercent >= 0 ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </div>

          <MiniLine />

          <div
            className={
              status === "強勢"
                ? "text-xs font-bold text-green-400"
                : status === "突破"
                  ? "text-xs font-bold text-yellow-400"
                  : status === "轉弱"
                    ? "text-xs font-bold text-slate-400"
                    : "text-xs font-bold text-orange-300"
            }
          >
            {status}
          </div>
        </div>
      </div>
    </button>
  );
}

function StockDetail({
  stock,
  onBack,
  isWatch,
  onToggleWatch,
  sameIndustryStocks,
  alertReasons,
}: {
  stock: Stock;
  onBack: () => void;
  isWatch: boolean;
  onToggleWatch: () => void;
  sameIndustryStocks: Stock[];
  alertReasons: string[];
}) {
  const status = stockStatus(stock);
  const links = getStockLinks(stock.code);
  const tradeAdvice = getTradeAdvice(stock);

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
          >
            ← 返回
          </button>

          <button
            onClick={onToggleWatch}
            className={
              isWatch
                ? "rounded-xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200"
                : "rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white"
            }
          >
            {isWatch ? "移除自選" : "加入自選"}
          </button>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-black p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-black">{stock.name}</div>
              <div className="mt-1 text-slate-400">
                {stock.code}｜{stock.industry}
              </div>
            </div>

            <div className="rounded-xl bg-red-500 px-3 py-2 text-lg font-black">
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-bold text-slate-500">即時價</div>
            <div className="text-6xl font-black">
              {stock.price.toFixed(stock.price >= 100 ? 0 : 2)}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">成交量</div>
              <div className="mt-1 text-2xl font-black">
                {volumeLots(stock.volume).toLocaleString()} 張
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">強度</div>
              <div className="mt-1 text-2xl font-black text-red-400">
                {stockScore(stock)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">狀態</div>
              <div
                className={
                  status === "強勢"
                    ? "mt-1 text-2xl font-black text-green-400"
                    : status === "突破"
                      ? "mt-1 text-2xl font-black text-yellow-400"
                      : status === "轉弱"
                        ? "mt-1 text-2xl font-black text-slate-400"
                        : "mt-1 text-2xl font-black text-orange-300"
                }
              >
                {status}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">自選</div>
              <div className="mt-1 text-2xl font-black">
                {isWatch ? "已加入" : "未加入"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href={links.kline}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-slate-800 px-4 py-3 text-center text-sm font-black text-white"
            >
              看 K 線
            </a>

            <a
              href={links.yahoo}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-red-500 px-4 py-3 text-center text-sm font-black text-white"
            >
              Yahoo 股價
            </a>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">操作提醒</div>

            <div className="space-y-2">
              {tradeAdvice.map((item) => (
                <div
                  key={item}
                  className="rounded-xl bg-black/40 px-3 py-2 text-sm font-bold text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">警報原因</div>

            <div className="space-y-2">
              {alertReasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-xl bg-black/40 px-3 py-2 text-sm font-bold text-slate-200"
                >
                  ✅ {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">
              同產業強勢股｜{stock.industry}
            </div>

            {sameIndustryStocks.length === 0 ? (
              <div className="text-sm text-slate-400">
                目前沒有其他同產業強勢股
              </div>
            ) : (
              sameIndustryStocks.map((s, index) => (
                <div
                  key={s.code}
                  className="mb-2 flex items-center justify-between rounded-xl bg-black/40 px-3 py-2"
                >
                  <div>
                    <div className="font-black">
                      {index + 1}. {s.name}{" "}
                      <span className="text-xs text-slate-400">{s.code}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      即時價 {s.price.toFixed(s.price >= 100 ? 0 : 2)}
                    </div>
                  </div>

                  <div className="font-black text-red-400">
                    +{s.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastFailAt, setLastFailAt] = useState("");
  const [lastFailReason, setLastFailReason] = useState("");
  const [nextRefresh, setNextRefresh] = useState(60);
  const [tab, setTab] = useState<TabKey>("top50");
  const [expandedIndustry, setExpandedIndustry] = useState<string>("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [mode, setMode] = useState<ModeKey>("normal");
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function loadStocks(codes = watchCodes, manual = false) {
    try {
      if (manual) setRefreshing(true);
      if (stocks.length === 0) setLoading(true);

      setError("");
      setLastFailReason("");

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

      if (rankedList.length === 0) {
        throw new Error("API 有回應，但沒有取得有效股票資料");
      }

      setStocks(rankedList);
      setWatchListStocks(watchList);
      setLastSuccessAt(formatTime(new Date()));
      setNextRefresh(60);
    } catch (err: any) {
      const message = err?.message || "資料載入失敗";

      setError(message);
      setLastFailAt(formatTime(new Date()));
      setLastFailReason(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    loadStocks(cleanCodes, true);
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

  function toggleSelectedStockWatch(stock: Stock) {
    if (watchCodes.includes(stock.code)) removeWatchCode(stock.code);
    else saveWatchCodes([...watchCodes, stock.code]);
  }

  function applyOpenMode() {
    setMode("open");
    setTab("alert");
    setFilterKey("alert");
    setSortKey("score");
    setSearchText("");
  }

  function applyNormalMode() {
    setMode("normal");
    setTab("top50");
    setFilterKey("all");
    setSortKey("change");
    setSearchText("");
  }

  function filterStocksBySearch(list: Stock[]) {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return list;

    return list.filter((s) => {
      return (
        s.code.toLowerCase().includes(keyword) ||
        s.name.toLowerCase().includes(keyword) ||
        s.industry.toLowerCase().includes(keyword)
      );
    });
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

  const marketStatus = getMarketStatus();

  const sortedStocks = useMemo(() => sortStocks(stocks, sortKey), [stocks, sortKey]);

  const sortedWatchListStocks = useMemo(
    () => sortStocks(watchListStocks, sortKey),
    [watchListStocks, sortKey]
  );

  const industryGroups = useMemo(
    () => buildIndustryGroups(sortedStocks, sortKey),
    [sortedStocks, sortKey]
  );

  const mainIndustryGroups = useMemo(
    () => industryGroups.filter((g) => g.industry !== "其他"),
    [industryGroups]
  );

  const topIndustries = mainIndustryGroups.slice(0, 5);
  const topIndustryNames = topIndustries.map((g) => g.industry);

  const alertStocks = sortStocks(stocks.filter(isAlertStock), sortKey);
  const breakoutStocks = sortStocks(stocks.filter((s) => s.changePercent >= 5), sortKey);

  const tabStocks = useMemo(() => {
    if (tab === "top50") return sortedStocks;
    if (tab === "watch") return sortedWatchListStocks;
    if (tab === "breakout") return breakoutStocks;
    if (tab === "alert") return alertStocks;
    return sortedStocks;
  }, [tab, sortedStocks, sortedWatchListStocks, breakoutStocks, alertStocks]);

  const filteredTabStocks = useMemo(() => {
    return filterStocksBySearch(filterByQuick(tabStocks, filterKey));
  }, [tabStocks, searchText, filterKey]);

  const filteredIndustryGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    const groups = mainIndustryGroups.map((group) => {
      const filteredStocks = filterByQuick(group.stocks, filterKey);
      const matchIndustry = group.industry.toLowerCase().includes(keyword);

      if (!keyword) {
        return {
          ...group,
          stocks: filteredStocks,
          total: filteredStocks.length,
        };
      }

      const searchedStocks = filteredStocks.filter((s) => {
        return (
          s.code.toLowerCase().includes(keyword) ||
          s.name.toLowerCase().includes(keyword) ||
          s.industry.toLowerCase().includes(keyword)
        );
      });

      return {
        ...group,
        stocks: matchIndustry ? filteredStocks : searchedStocks,
        total: matchIndustry ? filteredStocks.length : searchedStocks.length,
      };
    });

    return groups.filter((group) => {
      if (keyword && group.industry.toLowerCase().includes(keyword)) return true;
      return group.stocks.length > 0;
    });
  }, [mainIndustryGroups, searchText, filterKey]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "top50", label: "50強", icon: "📊" },
    { key: "watch", label: "自選", icon: "☆" },
    { key: "industry", label: "產業", icon: "▮" },
    { key: "breakout", label: "突破", icon: "⚡" },
    { key: "alert", label: "警報", icon: "🔔" },
  ];

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "change", label: "漲幅" },
    { key: "volume", label: "成交量" },
    { key: "score", label: "強度" },
  ];

  const filterButtons: { key: FilterKey; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "strong", label: "強勢" },
    { key: "breakout", label: "突破" },
    { key: "alert", label: "警報" },
    { key: "lowVolume", label: "低量" },
  ];

  if (selectedStock) {
    const sameIndustryStocks = sortStocks(
      stocks.filter((s) => s.industry === selectedStock.industry && s.code !== selectedStock.code),
      sortKey
    ).slice(0, 5);

    const alertReasons = getAlertReasons(selectedStock, topIndustryNames);

    return (
      <StockDetail
        stock={selectedStock}
        onBack={() => setSelectedStock(null)}
        isWatch={watchCodes.includes(selectedStock.code)}
        onToggleWatch={() => toggleSelectedStockWatch(selectedStock)}
        sameIndustryStocks={sameIndustryStocks}
        alertReasons={alertReasons}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-md px-3 py-4">
        <div className={`mb-3 rounded-2xl border p-3 ${marketStatus.color}`}>
          <div className="text-sm font-black">{marketStatus.title}</div>
          <div className="mt-1 text-xs font-bold">{marketStatus.text}</div>
        </div>

        <header className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-wide">台股即時雷達</h1>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功更新：{lastSuccessAt || "尚未成功"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                自動更新倒數：{nextRefresh}s
              </div>
            </div>

            <button
              onClick={() => loadStocks(watchCodes, true)}
              disabled={refreshing}
              className={
                refreshing
                  ? "rounded-xl bg-slate-700 px-4 py-3 text-sm font-black text-slate-300"
                  : "rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white"
              }
            >
              {refreshing ? "更新中" : "立即更新"}
            </button>
          </div>
        </header>

        {lastFailReason && stocks.length > 0 && (
          <div className="mb-3 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-3 text-sm font-bold text-yellow-200">
            ⚠️ 本次更新失敗，仍顯示上一次成功資料。
            <div className="mt-1 text-xs">
              失敗時間：{lastFailAt}｜原因：{lastFailReason}
            </div>
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={applyOpenMode}
            className={
              mode === "open"
                ? "rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
            }
          >
            開盤模式
          </button>

          <button
            onClick={applyNormalMode}
            className={
              mode === "normal"
                ? "rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
            }
          >
            盤中模式
          </button>
        </div>

        <div className="mb-3">
          <div className="flex gap-2">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜尋代號 / 名稱 / 產業"
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />

            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="rounded-xl bg-slate-800 px-3 text-xs font-black text-slate-300"
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setMode("normal");
                setTab(item.key);
              }}
              className={
                tab === item.key
                  ? "whitespace-nowrap rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white"
                  : "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-black text-slate-200"
        >
          {showAdvanced ? "收起進階篩選 ▲" : "展開進階篩選 ▼"}
        </button>

        {showAdvanced && (
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-2 text-xs font-black text-slate-400">排序方式</div>

            <div className="mb-3 flex gap-2 overflow-x-auto">
              {sortButtons.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSortKey(item.key)}
                  className={
                    sortKey === item.key
                      ? "whitespace-nowrap rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white"
                      : "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300"
                  }
                >
                  {item.label}排序
                </button>
              ))}
            </div>

            <div className="mb-2 text-xs font-black text-slate-400">快速篩選</div>

            <div className="flex gap-2 overflow-x-auto">
              {filterButtons.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilterKey(item.key)}
                  className={
                    filterKey === item.key
                      ? "whitespace-nowrap rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white"
                      : "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "open" && (
          <div className="mb-3 rounded-2xl border border-red-900 bg-red-950/50 p-3 text-sm font-bold text-red-100">
            開盤模式：目前只看警報股，並依強度排序。
          </div>
        )}

        {loading && (
          <div className="mb-3 rounded-2xl bg-slate-900 p-3 text-center">
            資料載入中...
          </div>
        )}

        {error && stocks.length === 0 && (
          <div className="mb-3 rounded-2xl bg-red-950 p-3 text-sm font-bold text-red-200">
            錯誤：{error}
          </div>
        )}

        {tab === "top50" && !searchText && filterKey === "all" && topIndustries.length > 0 && (
          <section className="mb-3 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-black text-white">👑 今日最強主流 TOP 5</div>
              <div className="text-lg">🏆</div>
            </div>

            <div className="space-y-1.5">
              {topIndustries.map((item, index) => (
                <div key={item.industry} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 text-xl font-black text-orange-300">{index + 1}</div>
                    <div className="text-lg font-black text-white">{item.industry}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-black text-white">{item.total}檔</div>
                    <div className="text-xs font-black text-red-100">
                      平均 +{item.avgChange}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "watch" && (
          <section className="mb-3 rounded-2xl bg-slate-900 p-3">
            <h2 className="mb-2 text-base font-black">自選股新增 / 刪除</h2>

            <div className="flex gap-2">
              <input
                value={newWatchCode}
                onChange={(e) => setNewWatchCode(e.target.value)}
                placeholder="輸入代號，例如 2454"
                inputMode="numeric"
                className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />

              <button
                onClick={addWatchCode}
                className="rounded-xl bg-red-500 px-3 text-sm font-black text-white"
              >
                加入
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {watchCodes.map((code) => (
                <div
                  key={code}
                  className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold"
                >
                  <span>{code}</span>
                  <button onClick={() => removeWatchCode(code)} className="text-slate-400">
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={resetWatchCodes}
                className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300"
              >
                還原預設
              </button>
            </div>
          </section>
        )}

        {tab === "industry" ? (
          <section>
            <h2 className="mb-3 text-lg font-black">
              產業排行 TOP 10
              {(searchText || filterKey !== "all") && (
                <span className="ml-2 text-xs text-slate-400">
                  / 結果 {filteredIndustryGroups.length} 類
                </span>
              )}
            </h2>

            {filteredIndustryGroups.slice(0, 10).length === 0 ? (
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                沒有符合條件的產業或股票
              </div>
            ) : (
              filteredIndustryGroups.slice(0, 10).map((group, index) => {
                const isOpen =
                  expandedIndustry === group.industry ||
                  Boolean(searchText) ||
                  filterKey !== "all";

                return (
                  <div
                    key={group.industry}
                    className="mb-2 rounded-2xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <button
                      onClick={() =>
                        setExpandedIndustry(
                          isOpen && !searchText && filterKey === "all" ? "" : group.industry
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-xl font-black text-red-400">
                            {index + 1}
                          </div>

                          <div>
                            <div className="text-2xl font-black text-white">
                              {group.industry}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              平均 +{group.avgChange}%｜強度 {group.strength}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-black text-red-400">
                            {group.total}
                          </div>
                          <div className="text-xs text-slate-400">
                            檔 {isOpen ? "▲" : "▼"}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-3 rounded-2xl bg-black/40 p-2">
                        <div className="mb-2 text-sm font-black text-slate-300">
                          {group.industry} 個股
                        </div>

                        {group.stocks.map((stock, stockIndex) => (
                          <StockRow
                            key={stock.code}
                            stock={stock}
                            rank={stockIndex + 1}
                            compact
                            onClick={() => setSelectedStock(stock)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ) : (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-black">
                {tab === "top50" && "漲幅排行 TOP 50"}
                {tab === "watch" && "自選股"}
                {tab === "breakout" && "突破股"}
                {tab === "alert" && "警報股"}
              </h2>

              <span className="text-xs font-bold text-slate-400">
                {tab === "top50" ? `${filteredTabStocks.length} / 50` : `${filteredTabStocks.length} 檔`}
              </span>
            </div>

            {filteredTabStocks.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                目前沒有符合條件的股票
              </div>
            ) : (
              filteredTabStocks.slice(0, 50).map((stock, index) => (
                <StockRow
                  key={stock.code}
                  stock={stock}
                  rank={index + 1}
                  compact={tab !== "top50"}
                  onClick={() => setSelectedStock(stock)}
                />
              ))
            )}
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSelectedStock(null);
                setMode("normal");
                setTab(item.key);
              }}
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