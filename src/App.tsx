import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  changePercent: number;
  volume: number;
  industry: string;
  turnoverRate: number | null;
  volumeRatio: number | null;
  floatMarketCapYi: number | null;
};

type TabKey = "top50" | "watch" | "favorite" | "industry" | "alert";

type ApiResponse = {
  stocks?: Stock[];
  data?: Stock[];
  updatedAt?: string;
  source?: string;
  message?: string;
};

const API_URL = "/api/stocks";

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3711": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "4966": "半導體",
  "3529": "半導體",
  "3707": "半導體",
  "3715": "半導體",
  "8150": "半導體",
  "6415": "半導體",
  "2344": "半導體",

  "2317": "電子代工",
  "2382": "電子代工",
  "3231": "電子代工",
  "4938": "電子代工",
  "2356": "電子代工",
  "6669": "電子代工",

  "2308": "電源能源",
  "2313": "電子零組件",
  "2327": "電子零組件",
  "2368": "電子零組件",
  "2492": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",

  "3008": "光學",
  "3406": "光學",
  "3019": "光學",
  "3711": "光學",

  "2409": "面板",
  "3481": "面板",
  "6116": "面板",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航運",
  "2637": "航運",

  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",
  "2031": "鋼鐵",

  "1301": "塑化",
  "1303": "塑化",
  "1326": "塑化",
  "6505": "塑化",

  "2881": "金融",
  "2882": "金融",
  "2883": "金融",
  "2884": "金融",
  "2885": "金融",
  "2886": "金融",
  "2887": "金融",
  "2890": "金融",
  "2891": "金融",
  "2892": "金融",

  "1216": "食品",
  "1229": "食品",
  "1231": "食品",
  "1232": "食品",

  "2201": "汽車",
  "2204": "汽車",
  "2207": "汽車",
  "2227": "汽車",

  "5871": "金融服務",
  "9910": "橡膠",
  "9914": "美妝通路",
};

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function fmtPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-TW");
}

function normalizeStock(raw: any): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const previousClose = n(raw.previousClose ?? raw.yesterdayClose ?? raw.prevClose);
  const price = n(raw.price ?? raw.close ?? raw.lastPrice);
  const openPrice = n(raw.openPrice ?? raw.open ?? price);

  const changePercent =
    raw.changePercent !== undefined
      ? n(raw.changePercent)
      : previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

  const openPremiumPercent =
    raw.openPremiumPercent !== undefined && raw.openPremiumPercent !== null
      ? n(raw.openPremiumPercent)
      : previousClose > 0
        ? ((openPrice - previousClose) / previousClose) * 100
        : null;

  return {
    code,
    name: String(raw.name ?? raw.stockName ?? code),
    price,
    openPrice,
    previousClose,
    openPremiumPercent,
    changePercent,
    volume: n(raw.volume ?? raw.tradeVolume ?? raw.totalVolume),
    industry: raw.industry && raw.industry !== "其他" ? String(raw.industry) : industryMap[code] ?? "其他",
    turnoverRate: raw.turnoverRate !== undefined ? n(raw.turnoverRate) : null,
    volumeRatio: raw.volumeRatio !== undefined ? n(raw.volumeRatio) : null,
    floatMarketCapYi: raw.floatMarketCapYi !== undefined ? n(raw.floatMarketCapYi) : null,
  };
}

function scoreStock(s: Stock) {
  let score = 0;
  score += s.changePercent * 8;
  score += (s.openPremiumPercent ?? 0) * 3;
  score += Math.min(s.volumeRatio ?? 0, 10) * 5;
  score += Math.min(s.turnoverRate ?? 0, 20) * 2;
  if (s.price > s.openPrice) score += 5;
  if (s.changePercent >= 3) score += 10;
  if (s.changePercent >= 6) score += 8;
  return score;
}

function getRisk(s: Stock) {
  if (s.changePercent >= 8 || (s.turnoverRate ?? 0) >= 15) return "高";
  if (s.changePercent >= 5 || (s.turnoverRate ?? 0) >= 8) return "中";
  return "低";
}

function isBreakout(s: Stock) {
  return s.changePercent >= 3 && s.price >= s.openPrice && s.volume > 0;
}

function isAlert(s: Stock) {
  return s.changePercent >= 5 || (s.openPremiumPercent ?? 0) >= 3 || (s.volumeRatio ?? 0) >= 2;
}

function getMarketMode(stocks: Stock[]) {
  const strong = stocks.filter((s) => s.changePercent >= 3).length;
  const weak = stocks.filter((s) => s.changePercent < 0).length;
  const alert = stocks.filter(isAlert).length;

  if (strong >= 20 && alert >= 25) {
    return {
      title: "✅ 大盤偏強",
      text: "強勢股與警報股數量偏多，可以優先看主流產業、主流續強與突破股。",
      strategy: "可積極觀察主流股，但仍避免追高過熱股。",
    };
  }

  if (weak > strong) {
    return {
      title: "⚠️ 盤勢轉弱",
      text: "下跌或轉弱個股偏多，先降低追價，觀察資金是否回到主流產業。",
      strategy: "保守觀察，等待突破股重新放量。",
    };
  }

  return {
    title: "🟡 盤勢普通",
    text: "市場強弱中性，適合觀察族群輪動與低位階轉強股。",
    strategy: "先看產業熱度，再挑突破與安全觀察股。",
  };
}

function getIndustryRanking(stocks: Stock[]) {
  const map = new Map<string, { industry: string; count: number; avg: number; stocks: Stock[] }>();

  stocks.forEach((s) => {
    const key = s.industry || "其他";
    const item = map.get(key) ?? { industry: key, count: 0, avg: 0, stocks: [] };
    item.count += 1;
    item.stocks.push(s);
    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avg: item.stocks.reduce((sum, s) => sum + s.changePercent, 0) / Math.max(item.stocks.length, 1),
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);
}

function StockCard({ stock, rank }: { stock: Stock; rank: number }) {
  const up = stock.changePercent >= 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">#{rank}　{stock.code}</div>
          <div className="mt-1 text-xl font-black text-white">{stock.name}</div>
          <div className="mt-1 text-sm text-slate-400">{stock.industry}</div>
        </div>

        <div className={`text-right text-2xl font-black ${up ? "text-red-400" : "text-emerald-400"}`}>
          {fmtPercent(stock.changePercent)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">股價</div>
          <div className="font-bold text-white">{fmtNumber(stock.price)}</div>
        </div>
        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">開盤溢價</div>
          <div className={`font-bold ${(stock.openPremiumPercent ?? 0) >= 0 ? "text-red-300" : "text-emerald-300"}`}>
            {fmtPercent(stock.openPremiumPercent)}
          </div>
        </div>
        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">風險</div>
          <div className="font-bold text-yellow-300">{getRisk(stock)}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [apiDataTime, setApiDataTime] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("top50");
  const [autoSeconds, setAutoSeconds] = useState(60);

  async function loadStocks() {
    try {
      setError("");
      const res = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`API 錯誤：${res.status}`);
      }

      const json: ApiResponse = await res.json();
      const list = Array.isArray(json.stocks) ? json.stocks : Array.isArray(json.data) ? json.data : [];

      const normalized = list
        .map(normalizeStock)
        .filter((s) => s.code && s.name && Number.isFinite(s.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      setStocks(normalized);
      setLastSuccessAt(new Date().toLocaleTimeString("zh-TW", { hour12: false }));
      setApiDataTime(json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : new Date().toLocaleString("zh-TW"));
      setSource(json.source || "TWSE MIS + Yahoo fallback");
    } catch (e: any) {
      setError(e?.message || "資料讀取失敗");
    } finally {
      setLoading(false);
      setAutoSeconds(60);
    }
  }

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAutoSeconds((s) => {
        if (s <= 1) {
          loadStocks();
          return 60;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const watch = useMemo(() => top50.filter((s) => getRisk(s) !== "高").slice(0, 30), [top50]);
  const breakout = useMemo(() => top50.filter(isBreakout).slice(0, 30), [top50]);
  const alerts = useMemo(() => top50.filter(isAlert), [top50]);
  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const market = useMemo(() => getMarketMode(top50), [top50]);

  const strongestIndustry = industries[0];
  const strongestStock = top50[0];

  const displayedStocks = useMemo(() => {
    if (tab === "top50") return top50;
    if (tab === "watch") return watch;
    if (tab === "favorite") return breakout;
    if (tab === "alert") return alerts;
    return [];
  }, [tab, top50, watch, breakout, alerts]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-12">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股即時雷達</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">50強漲幅排行</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                每 60 秒自動更新，盤中看強勢股、突破股、產業熱度與警報股。
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
              立即更新
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">50強</div>
              <div className="text-2xl font-black text-red-400">{top50.length}</div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">突破股</div>
              <div className="text-2xl font-black text-yellow-300">{breakout.length}</div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">警報股</div>
              <div className="text-2xl font-black text-orange-300">{alerts.length}</div>
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-900 bg-blue-950/40 p-5">
          <div className="text-lg font-black">資料狀態</div>
          <div className="mt-2 space-y-1 text-sm font-bold text-slate-300">
            <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
            <div>API資料時間：{apiDataTime || "讀取中"}</div>
            <div>資料來源：{source || "讀取中"}</div>
            <div>自動更新倒數：{autoSeconds}s</div>
          </div>

          {loading && <div className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">資料讀取中...</div>}

          {error && (
            <div className="mt-3 rounded-2xl border border-red-500 bg-red-950/60 p-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-emerald-600 bg-emerald-950/30 p-5">
          <h2 className="text-xl font-black">{market.title}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-200">{market.text}</p>
          <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-emerald-100">
            策略：{market.strategy}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-sm font-bold text-slate-300">突破股</div>
              <div className="mt-1 text-2xl font-black">{breakout.length}</div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-sm font-bold text-slate-300">警報股</div>
              <div className="mt-1 text-2xl font-black">{alerts.length}</div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-sm font-bold text-slate-300">安全觀察</div>
              <div className="mt-1 text-2xl font-black">{watch.length}</div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-violet-600 bg-violet-950/30 p-5">
          <h2 className="text-xl font-black">🌙 收盤後復盤提醒</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
            整理今日最強產業、最強個股與自選股強弱，作為明天觀察方向。
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/30 p-4">
              <div className="text-sm font-bold text-slate-300">今日最強產業</div>
              <div className="mt-2 text-2xl font-black">{strongestIndustry?.industry ?? "--"}</div>
              <div className="mt-2 text-sm font-bold text-slate-400">
                {strongestIndustry ? `${strongestIndustry.count} 檔｜平均 ${fmtPercent(strongestIndustry.avg)}` : "--"}
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 p-4">
              <div className="text-sm font-bold text-slate-300">今日最強個股</div>
              <div className="mt-2 text-2xl font-black">{strongestStock?.name ?? "--"}</div>
              <div className="mt-2 text-sm font-bold text-red-300">
                {strongestStock ? `${fmtPercent(strongestStock.changePercent)}｜${strongestStock.code}` : "--"}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">🔔 提醒中心</h2>
              <p className="mt-1 text-sm font-bold text-slate-400">目前共有 {alerts.length} 個提醒，點我展開。</p>
            </div>

            <div className="rounded-2xl bg-red-500 px-4 py-3 text-2xl font-black">{alerts.length}</div>
          </div>

          <button
            onClick={() => setTab("alert")}
            className="mt-4 w-full rounded-2xl bg-indigo-500 py-3 text-lg font-black text-white active:scale-95"
          >
            📌 直接查看警報清單
          </button>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">
                {tab === "top50" && "📊 今日漲幅50強"}
                {tab === "watch" && "👁️ 安全觀察"}
                {tab === "favorite" && "⭐ 突破觀察"}
                {tab === "industry" && "🏭 產業熱度"}
                {tab === "alert" && "🔔 警報股"}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                漲數字紅色，跌數字綠色。
              </p>
            </div>
          </div>

          {tab === "industry" ? (
            <div className="space-y-3">
              {industries.map((item, index) => (
                <div key={item.industry} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                      <div className="text-2xl font-black">{item.industry}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-yellow-300">{item.count} 檔</div>
                      <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                        平均 {fmtPercent(item.avg)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm font-bold text-slate-400">
                    {item.stocks
                      .slice(0, 5)
                      .map((s) => `${s.name} ${fmtPercent(s.changePercent)}`)
                      .join("、")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedStocks.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有符合條件的股票
                </div>
              )}

              {displayedStocks.map((stock, index) => (
                <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} />
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          <button onClick={() => setTab("top50")} className={`rounded-2xl py-2 text-xs font-black ${tab === "top50" ? "bg-slate-800 text-red-400" : "text-slate-400"}`}>
            <div className="text-2xl">📊</div>
            50強
          </button>

          <button onClick={() => setTab("watch")} className={`rounded-2xl py-2 text-xs font-black ${tab === "watch" ? "bg-slate-800 text-yellow-300" : "text-slate-400"}`}>
            <div className="text-2xl">👁️</div>
            觀察
          </button>

          <button onClick={() => setTab("favorite")} className={`rounded-2xl py-2 text-xs font-black ${tab === "favorite" ? "bg-slate-800 text-yellow-300" : "text-slate-400"}`}>
            <div className="text-2xl">⭐</div>
            突破
          </button>

          <button onClick={() => setTab("industry")} className={`rounded-2xl py-2 text-xs font-black ${tab === "industry" ? "bg-slate-800 text-blue-300" : "text-slate-400"}`}>
            <div className="text-2xl">🏭</div>
            產業
          </button>

          <button onClick={() => setTab("alert")} className={`rounded-2xl py-2 text-xs font-black ${tab === "alert" ? "bg-slate-800 text-orange-300" : "text-slate-400"}`}>
            <div className="text-2xl">🔔</div>
            警報
          </button>
        </div>
      </nav>
    </div>
  );
}