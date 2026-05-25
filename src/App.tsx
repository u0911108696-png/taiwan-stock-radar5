import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  change?: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  industry: string;
  turnoverRate: number | null;
  volumeRatio: number | null;
  floatMarketCapYi: number | null;
};

type TabKey = "top50" | "watch" | "favorite" | "industry" | "alert";

type ApiResponse = {
  stocks?: Stock[];
  data?: Stock[];
  rankedStocks?: Stock[];
  watchList?: Stock[];
  updatedAt?: string;
  updatedAtTaiwan?: string;
  source?: string;
  message?: string;
};

const API_URL = "/api/stocks";
const FAVORITE_KEY = "taiwan-stock-radar-favorites";

const industryMap: Record<string, string> = {
  "1101": "水泥",
  "1102": "水泥",
  "1216": "食品",
  "1227": "食品",
  "1301": "塑化",
  "1303": "塑化",
  "6505": "塑化",
  "1717": "化工",
  "1722": "化工",
  "4722": "化工",
  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",
  "2201": "汽車",
  "2207": "汽車",
  "2227": "汽車",
  "2301": "電子",
  "2303": "半導體",
  "2308": "電源能源",
  "2313": "電子零組件",
  "2317": "電子代工",
  "2327": "電子零組件",
  "2330": "半導體",
  "2354": "電子",
  "2356": "電腦週邊",
  "2357": "電腦週邊",
  "2367": "電子零組件",
  "2379": "半導體",
  "2382": "電子代工",
  "2408": "半導體",
  "2409": "面板",
  "2454": "半導體",
  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航運",
  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2886": "金融",
  "2891": "金融",
  "2892": "金融",
  "3008": "光學",
  "3017": "電子零組件",
  "3034": "半導體",
  "3035": "半導體",
  "3037": "電子零組件",
  "3042": "光電",
  "3231": "電子代工",
  "3406": "光學",
  "3443": "半導體",
  "3481": "面板",
  "3711": "半導體",
  "3714": "半導體",
  "4966": "半導體",
  "6415": "半導體",
  "6669": "電子代工",
};

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-TW");
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function normalizeStock(raw: any): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const name = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);

  const price = toNumber(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = toNumber(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = toNumber(raw.openPrice ?? raw.open ?? raw.o ?? price);

  const change =
    raw.change !== undefined
      ? toNumber(raw.change)
      : previousClose > 0
        ? price - previousClose
        : 0;

  const changePercent =
    raw.changePercent !== undefined
      ? toNumber(raw.changePercent)
      : previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

  const openPremiumPercent =
    raw.openPremiumPercent !== undefined && raw.openPremiumPercent !== null
      ? toNumber(raw.openPremiumPercent)
      : previousClose > 0
        ? ((openPrice - previousClose) / previousClose) * 100
        : null;

  return {
    code,
    name,
    price,
    change,
    changePercent,
    volume: toNumber(raw.volume ?? raw.tradeVolume ?? raw.totalVolume ?? raw.v),
    openPrice,
    previousClose,
    openPremiumPercent,
    industry:
      raw.industry && raw.industry !== "其他"
        ? String(raw.industry)
        : industryMap[code] ?? "其他",
    turnoverRate:
      raw.turnoverRate !== undefined && raw.turnoverRate !== null
        ? toNumber(raw.turnoverRate)
        : null,
    volumeRatio:
      raw.volumeRatio !== undefined && raw.volumeRatio !== null
        ? toNumber(raw.volumeRatio)
        : null,
    floatMarketCapYi:
      raw.floatMarketCapYi !== undefined && raw.floatMarketCapYi !== null
        ? toNumber(raw.floatMarketCapYi)
        : null,
  };
}

function getRisk(stock: Stock) {
  if (stock.changePercent >= 8 || (stock.turnoverRate ?? 0) >= 15) return "高";
  if (stock.changePercent >= 5 || (stock.turnoverRate ?? 0) >= 8) return "中";
  return "低";
}

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice && stock.volume > 0;
}

function isAlert(stock: Stock) {
  return stock.changePercent >= 5 || (stock.openPremiumPercent ?? 0) >= 3 || (stock.volumeRatio ?? 0) >= 2;
}

function getFavoriteStatus(stock: Stock) {
  if (isAlert(stock)) return "🔔 有警報";
  if (isBreakout(stock)) return "⭐ 突破轉強";
  if (stock.changePercent >= 3) return "👁️ 轉強觀察";
  if (stock.changePercent < 0) return "🟢 轉弱";
  return "🟡 普通";
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
  const map = new Map<
    string,
    {
      industry: string;
      count: number;
      avg: number;
      stocks: Stock[];
    }
  >();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const item = map.get(key) ?? {
      industry: key,
      count: 0,
      avg: 0,
      stocks: [],
    };

    item.count += 1;
    item.stocks.push(stock);
    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avg:
        item.stocks.reduce((sum, stock) => sum + stock.changePercent, 0) /
        Math.max(item.stocks.length, 1),
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);
}

function StockCard({
  stock,
  rank,
  favoriteCodes,
  onAddFavorite,
  onRemoveFavorite,
}: {
  stock: Stock;
  rank: number;
  favoriteCodes: string[];
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">
            #{rank}　{stock.code}
          </div>
          <div className="mt-1 text-xl font-black text-white">{stock.name}</div>
          <div className="mt-1 text-sm font-bold text-slate-400">{stock.industry}</div>
        </div>

        <div className={`text-right text-2xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>
          {formatPercent(stock.changePercent)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">股價</div>
          <div className="font-bold text-white">{formatNumber(stock.price)}</div>
        </div>

        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">開盤溢價</div>
          <div className={`font-bold ${(stock.openPremiumPercent ?? 0) >= 0 ? "text-red-300" : "text-emerald-300"}`}>
            {formatPercent(stock.openPremiumPercent)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 p-2">
          <div className="text-xs text-slate-500">風險</div>
          <div className="font-bold text-yellow-300">{getRisk(stock)}</div>
        </div>
      </div>

      <button
        onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
        className={`mt-3 w-full rounded-2xl py-2 text-sm font-black active:scale-95 ${
          isFavorite
            ? "bg-yellow-500/20 text-yellow-300"
            : "bg-slate-800 text-slate-200"
        }`}
      >
        {isFavorite ? "★ 已加入自選，點我移除" : "☆ 加入自選"}
      </button>
    </div>
  );
}

function FavoriteCard({
  stock,
  onRemoveFavorite,
}: {
  stock: Stock;
  onRemoveFavorite: (code: string) => void;
}) {
  const isUp = stock.changePercent >= 0;

  return (
    <div className="rounded-2xl border border-yellow-500/50 bg-yellow-950/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-yellow-300">{stock.code}</div>
          <div className="mt-1 text-2xl font-black text-white">{stock.name}</div>
          <div className="mt-1 text-sm font-bold text-slate-400">{stock.industry}</div>
        </div>

        <div className={`text-right text-2xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>
          {formatPercent(stock.changePercent)}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-yellow-100">
        {getFavoriteStatus(stock)}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-xs text-slate-500">股價</div>
          <div className="font-bold">{formatNumber(stock.price)}</div>
        </div>

        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-xs text-slate-500">開盤溢價</div>
          <div className="font-bold">{formatPercent(stock.openPremiumPercent)}</div>
        </div>

        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-xs text-slate-500">風險</div>
          <div className="font-bold text-yellow-300">{getRisk(stock)}</div>
        </div>
      </div>

      <button
        onClick={() => onRemoveFavorite(stock.code)}
        className="mt-3 w-full rounded-2xl bg-red-500/20 py-2 text-sm font-black text-red-300 active:scale-95"
      >
        移除自選
      </button>
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
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [favoriteInput, setFavoriteInput] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoriteCodes(parsed.map(String));
        }
      }
    } catch {
      setFavoriteCodes([]);
    }
  }, []);

  function saveFavoriteCodes(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function addFavorite(code: string) {
    const cleaned = cleanCode(code);
    if (!cleaned) return;
    saveFavoriteCodes([...favoriteCodes, cleaned]);
    setFavoriteInput("");
    setTab("favorite");
  }

  function removeFavorite(code: string) {
    saveFavoriteCodes(favoriteCodes.filter((item) => item !== code));
  }

  async function loadStocks() {
    try {
      setError("");

      const response = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API 錯誤：${response.status}`);
      }

      const json: ApiResponse = await response.json();

      const list = Array.isArray(json.rankedStocks)
        ? json.rankedStocks
        : Array.isArray(json.stocks)
          ? json.stocks
          : Array.isArray(json.data)
            ? json.data
            : [];

      const normalized = list
        .map(normalizeStock)
        .filter((stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      setStocks(normalized);
      setLastSuccessAt(new Date().toLocaleTimeString("zh-TW", { hour12: false }));
      setApiDataTime(
        json.updatedAtTaiwan ||
          (json.updatedAt
            ? new Date(json.updatedAt).toLocaleString("zh-TW")
            : new Date().toLocaleString("zh-TW"))
      );
      setSource(json.source || "TWSE MIS + Yahoo fallback");
    } catch (err: any) {
      setError(err?.message || "資料讀取失敗");
      setStocks([]);
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
      setAutoSeconds((seconds) => {
        if (seconds <= 1) {
          loadStocks();
          return 60;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const watch = useMemo(() => top50.filter((stock) => getRisk(stock) !== "高").slice(0, 30), [top50]);
  const breakout = useMemo(() => top50.filter(isBreakout).slice(0, 30), [top50]);
  const alerts = useMemo(() => top50.filter(isAlert), [top50]);
  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const market = useMemo(() => getMarketMode(top50), [top50]);

  const favoriteStocks = useMemo(() => {
    return favoriteCodes
      .map((code) => stocks.find((stock) => stock.code === code))
      .filter(Boolean) as Stock[];
  }, [favoriteCodes, stocks]);

  const missingFavoriteCodes = useMemo(() => {
    return favoriteCodes.filter((code) => !stocks.some((stock) => stock.code === code));
  }, [favoriteCodes, stocks]);

  const favoriteAlerts = useMemo(() => {
    return favoriteStocks.filter((stock) => isAlert(stock) || isBreakout(stock) || stock.changePercent >= 3);
  }, [favoriteStocks]);

  const strongestIndustry = industries[0];
  const strongestStock = top50[0];

  const displayedStocks = useMemo(() => {
    if (tab === "top50") return top50;
    if (tab === "watch") return watch;
    if (tab === "alert") return alerts;
    return [];
  }, [tab, top50, watch, alerts]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-40 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股即時雷達</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">50強漲幅排行</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                每 60 秒自動更新，盤中看強勢股、自選股、產業熱度與警報股。
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
              立即<br />更新
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">50強</div>
              <div className="text-2xl font-black text-red-400">{top50.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">自選轉強</div>
              <div className="text-2xl font-black text-yellow-300">{favoriteAlerts.length}</div>
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

          {loading && (
            <div className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">
              資料讀取中...
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-2xl border border-red-500 bg-red-950/60 p-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-emerald-600 bg-emerald-950/30 p-5">
          <h2 className="text-xl font-black">{market.title}</h2>

          <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
            {market.text}
          </p>

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

        <section className="mt-4 rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
          <h2 className="text-xl font-black">⭐ 自選股快查</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            輸入股票代號加入自選，例如 2330、2454、3711。
          </p>

          <div className="mt-4 flex gap-2">
            <input
              value={favoriteInput}
              onChange={(e) => setFavoriteInput(cleanCode(e.target.value))}
              inputMode="numeric"
              placeholder="輸入股票代號"
              className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
            />

            <button
              onClick={() => addFavorite(favoriteInput)}
              className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-black active:scale-95"
            >
              加入
            </button>
          </div>

          <div className="mt-3 text-sm font-bold text-slate-400">
            目前自選：{favoriteCodes.length} 檔｜轉強提醒：{favoriteAlerts.length} 檔
          </div>

          <button
            onClick={() => setTab("favorite")}
            className="mt-4 w-full rounded-2xl bg-yellow-500/20 py-3 text-lg font-black text-yellow-200 active:scale-95"
          >
            查看我的自選股
          </button>
        </section>

        <section className="mt-4 rounded-3xl border border-violet-600 bg-violet-950/30 p-5">
          <h2 className="text-xl font-black">🌙 收盤後復盤提醒</h2>

          <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
            整理今日最強產業、最強個股與自選股強弱，作為明天觀察方向。
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/30 p-4">
              <div className="text-sm font-bold text-slate-300">今日最強產業</div>
              <div className="mt-2 text-2xl font-black">
                {strongestIndustry?.industry ?? "--"}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-400">
                {strongestIndustry
                  ? `${strongestIndustry.count} 檔｜平均 ${formatPercent(strongestIndustry.avg)}`
                  : "--"}
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 p-4">
              <div className="text-sm font-bold text-slate-300">今日最強個股</div>
              <div className="mt-2 text-2xl font-black">
                {strongestStock?.name ?? "--"}
              </div>
              <div className="mt-2 text-sm font-bold text-red-300">
                {strongestStock
                  ? `${formatPercent(strongestStock.changePercent)}｜${strongestStock.code}`
                  : "--"}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">🔔 提醒中心</h2>
              <p className="mt-1 text-sm font-bold text-slate-400">
                目前共有 {alerts.length} 個提醒，點我展開。
              </p>
            </div>

            <div className="rounded-2xl bg-red-500 px-4 py-3 text-2xl font-black">
              {alerts.length}
            </div>
          </div>

          <button
            onClick={() => setTab("alert")}
            className="mt-4 w-full rounded-2xl bg-indigo-500 py-3 text-lg font-black text-white active:scale-95"
          >
            📌 直接查看警報清單
          </button>
        </section>

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "top50" && "📊 今日漲幅50強"}
              {tab === "watch" && "👁️ 安全觀察"}
              {tab === "favorite" && "⭐ 我的自選股"}
              {tab === "industry" && "🏭 產業熱度"}
              {tab === "alert" && "🔔 警報股"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              漲數字紅色，跌數字綠色。
            </p>
          </div>

          {tab === "favorite" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-yellow-500/40 bg-yellow-950/20 p-4">
                <div className="text-lg font-black">加入自選股</div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={favoriteInput}
                    onChange={(e) => setFavoriteInput(cleanCode(e.target.value))}
                    inputMode="numeric"
                    placeholder="輸入股票代號"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
                  />

                  <button
                    onClick={() => addFavorite(favoriteInput)}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-black active:scale-95"
                  >
                    加入
                  </button>
                </div>
              </div>

              {favoriteCodes.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有自選股，先輸入股票代號加入。
                </div>
              )}

              {favoriteStocks.map((stock) => (
                <FavoriteCard
                  key={stock.code}
                  stock={stock}
                  onRemoveFavorite={removeFavorite}
                />
              ))}

              {missingFavoriteCodes.map((code) => (
                <div
                  key={code}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xl font-black">{code}</div>
                      <div className="mt-1 text-sm font-bold text-slate-400">
                        今日50強資料中沒有這檔，可能不是今日強勢股，或 API 尚未取得。
                      </div>
                    </div>

                    <button
                      onClick={() => removeFavorite(code)}
                      className="rounded-2xl bg-red-500/20 px-4 py-2 text-sm font-black text-red-300"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "industry" && (
            <div className="space-y-3">
              {industries.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有產業資料
                </div>
              )}

              {industries.map((item, index) => (
                <div
                  key={item.industry}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                      <div className="text-2xl font-black">{item.industry}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-yellow-300">
                        {item.count} 檔
                      </div>
                      <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                        平均 {formatPercent(item.avg)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm font-bold text-slate-400">
                    {item.stocks
                      .slice(0, 5)
                      .map((stock) => `${stock.name} ${formatPercent(stock.changePercent)}`)
                      .join("、")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab !== "industry" && tab !== "favorite" && (
            <div className="space-y-3">
              {displayedStocks.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有符合條件的股票
                </div>
              )}

              {displayedStocks.map((stock, index) => (
                <StockCard
                  key={`${stock.code}-${index}`}
                  stock={stock}
                  rank={index + 1}
                  favoriteCodes={favoriteCodes}
                  onAddFavorite={addFavorite}
                  onRemoveFavorite={removeFavorite}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          <button
            onClick={() => setTab("top50")}
            className={`rounded-2xl py-2 text-xs font-black ${
              tab === "top50" ? "bg-slate-800 text-red-400" : "text-slate-400"
            }`}
          >
            <div className="text-2xl">📊</div>
            50強
          </button>

          <button
            onClick={() => setTab("watch")}
            className={`rounded-2xl py-2 text-xs font-black ${
              tab === "watch" ? "bg-slate-800 text-yellow-300" : "text-slate-400"
            }`}
          >
            <div className="text-2xl">👁️</div>
            觀察
          </button>

          <button
            onClick={() => setTab("favorite")}
            className={`rounded-2xl py-2 text-xs font-black ${
              tab === "favorite" ? "bg-slate-800 text-yellow-300" : "text-slate-400"
            }`}
          >
            <div className="text-2xl">⭐</div>
            自選
          </button>

          <button
            onClick={() => setTab("industry")}
            className={`rounded-2xl py-2 text-xs font-black ${
              tab === "industry" ? "bg-slate-800 text-blue-300" : "text-slate-400"
            }`}
          >
            <div className="text-2xl">🏭</div>
            產業
          </button>

          <button
            onClick={() => setTab("alert")}
            className={`rounded-2xl py-2 text-xs font-black ${
              tab === "alert" ? "bg-slate-800 text-orange-300" : "text-slate-400"
            }`}
          >
            <div className="text-2xl">🔔</div>
            警報
          </button>
        </div>
      </nav>
    </div>
  );
}