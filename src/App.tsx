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

type TabKey =
  | "top50"
  | "open910"
  | "tomorrow"
  | "observe"
  | "favorite"
  | "settings"
  | "industry"
  | "alert";

type SortKey = "change" | "priceLow" | "alert" | "industry" | "safe";

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

type Settings = {
  maxPrice: number;
  alertPercent: number;
  openPremiumPercent: number;
  excludeHot: boolean;
};

const API_URL = "/api/stocks";
const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const OBSERVE_KEY = "taiwan-stock-radar-observe";
const SETTINGS_KEY = "taiwan-stock-radar-settings";
const NOTES_KEY = "taiwan-stock-radar-notes";
const AUTO_REFRESH_SECONDS = 60;

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  openPremiumPercent: 3,
  excludeHot: true,
};

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
    raw.change !== undefined ? toNumber(raw.change) : previousClose > 0 ? price - previousClose : 0;

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
    industry: raw.industry && raw.industry !== "其他" ? String(raw.industry) : industryMap[code] ?? "其他",
    turnoverRate: raw.turnoverRate !== undefined && raw.turnoverRate !== null ? toNumber(raw.turnoverRate) : null,
    volumeRatio: raw.volumeRatio !== undefined && raw.volumeRatio !== null ? toNumber(raw.volumeRatio) : null,
    floatMarketCapYi:
      raw.floatMarketCapYi !== undefined && raw.floatMarketCapYi !== null ? toNumber(raw.floatMarketCapYi) : null,
  };
}

function isUnderPrice(stock: Stock, settings: Settings) {
  return stock.price > 0 && stock.price <= settings.maxPrice;
}

function getRisk(stock: Stock) {
  if (stock.changePercent >= 8 || (stock.turnoverRate ?? 0) >= 15) return "高";
  if (stock.changePercent >= 5 || (stock.turnoverRate ?? 0) >= 8) return "中";
  return "低";
}

function isHot(stock: Stock, settings: Settings) {
  return (
    stock.changePercent >= 8 ||
    (stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent + 2 ||
    getRisk(stock) === "高"
  );
}

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice && stock.volume > 0;
}

function isWeakening(stock: Stock) {
  if (stock.price < stock.openPrice) return true;
  if (stock.changePercent < 2) return true;
  if (stock.openPremiumPercent !== null && stock.openPremiumPercent >= 3 && stock.changePercent < stock.openPremiumPercent) {
    return true;
  }
  return false;
}

function getWeakeningText(stock: Stock) {
  if (stock.price < stock.openPrice) return "⚠️ 盤中轉弱：股價跌破開盤價";
  if (stock.changePercent < 2) return "⚠️ 盤中轉弱：漲幅低於2%";
  if (stock.openPremiumPercent !== null && stock.openPremiumPercent >= 3 && stock.changePercent < stock.openPremiumPercent) {
    return "⚠️ 盤中轉弱：漲幅低於開盤溢價";
  }
  return "✅ 尚未明顯轉弱";
}

function isAlert(stock: Stock, settings: Settings) {
  if (!isUnderPrice(stock, settings)) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;

  return (
    stock.changePercent >= settings.alertPercent ||
    (stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent ||
    (stock.volumeRatio ?? 0) >= 2
  );
}

function getIndustryRanking(stocks: Stock[]) {
  const map = new Map<string, { industry: string; count: number; avg: number; stocks: Stock[] }>();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const item = map.get(key) ?? { industry: key, count: 0, avg: 0, stocks: [] };
    item.count += 1;
    item.stocks.push(stock);
    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avg: item.stocks.reduce((sum, stock) => sum + stock.changePercent, 0) / Math.max(item.stocks.length, 1),
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);
}

function scoreStock(stock: Stock, mainIndustries: string[], settings: Settings) {
  let score = 0;

  if (isUnderPrice(stock, settings)) score += 25;
  if (mainIndustries.includes(stock.industry)) score += 25;
  if (stock.changePercent >= 3 && stock.changePercent <= 7.5) score += 20;
  if (stock.price >= stock.openPrice) score += 15;
  if ((stock.openPremiumPercent ?? 0) >= 0 && (stock.openPremiumPercent ?? 0) <= settings.openPremiumPercent + 1) score += 10;
  if ((stock.volumeRatio ?? 0) >= 1.2) score += 10;
  if (getRisk(stock) === "低") score += 10;
  if (getRisk(stock) === "中") score += 5;

  if (isHot(stock, settings)) score -= 30;
  if (isWeakening(stock)) score -= 20;
  if (stock.price > settings.maxPrice) score -= 100;

  return Math.max(0, score);
}

function getHeatStatus(stock: Stock, settings: Settings) {
  if (isHot(stock, settings)) return "⚠️ 過熱勿追";
  if (stock.changePercent >= settings.alertPercent || (stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent) {
    return "🟠 小心追高";
  }
  if (stock.changePercent >= 2.5 && isUnderPrice(stock, settings)) return "✅ 可觀察";
  return "🟡 普通";
}

function isOpen910Candidate(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (!isUnderPrice(stock, settings)) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;

  return (
    stock.changePercent >= 2 &&
    stock.openPremiumPercent !== null &&
    stock.openPremiumPercent >= 0 &&
    stock.price >= stock.openPrice &&
    getRisk(stock) !== "高" &&
    mainIndustries.includes(stock.industry)
  );
}

function getTomorrowReasons(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];
  if (isUnderPrice(stock, settings)) reasons.push(`股價${settings.maxPrice}元內`);
  if (mainIndustries.includes(stock.industry)) reasons.push("主流產業");
  if (stock.changePercent >= 3) reasons.push("漲幅轉強");
  if (stock.price >= stock.openPrice) reasons.push("收盤強於開盤");
  if ((stock.openPremiumPercent ?? 0) >= 0) reasons.push("開盤溢價為正");
  if ((stock.volumeRatio ?? 0) >= 1.2) reasons.push("量能放大");
  if (!isHot(stock, settings)) reasons.push("沒有過熱");
  return reasons.length > 0 ? reasons.slice(0, 4).join("、") : "尚未出現明顯優勢";
}

function getAlertReason(stock: Stock, settings: Settings) {
  const reasons: string[] = [];
  if (isUnderPrice(stock, settings)) reasons.push(`股價${settings.maxPrice}元內`);
  if (stock.changePercent >= settings.alertPercent) reasons.push(`漲幅大於${settings.alertPercent}%`);
  if ((stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent) reasons.push(`開盤溢價大於${settings.openPremiumPercent}%`);
  if ((stock.volumeRatio ?? 0) >= 2) reasons.push("量能放大");
  if (!isHot(stock, settings)) reasons.push("沒有過熱");
  return reasons.join("、") || "符合警報條件";
}

function getBuyChecklist(stock: Stock, mainIndustries: string[], settings: Settings) {
  const checks = [
    isUnderPrice(stock, settings),
    mainIndustries.includes(stock.industry),
    !isHot(stock, settings),
    (stock.openPremiumPercent ?? 0) <= settings.openPremiumPercent + 1,
    isAlert(stock, settings) || isBreakout(stock),
    !isWeakening(stock),
  ];

  const score = checks.filter(Boolean).length;

  if (isHot(stock, settings)) return "❌ 不追高：過熱";
  if (isWeakening(stock)) return "⚠️ 小心：盤中轉弱";
  if (score >= 5) return "✅ 可觀察";
  if (score >= 3) return "🟠 小心觀察";
  return "⚪ 暫不追";
}

function getMarketMode(top50: Stock[], alerts: Stock[], settings: Settings) {
  const strong = top50.filter((stock) => stock.changePercent >= 3).length;
  const weak = top50.filter((stock) => stock.changePercent < 0).length;

  if (strong >= 20 && alerts.length >= 10) {
    return {
      title: `✅ ${settings.maxPrice}元內強勢股活躍`,
      text: `${settings.maxPrice}元內警報股數量增加，短線資金可能集中在中低價強勢股。`,
      strategy: "優先看9:10開盤、警報、觀察與主流產業。",
    };
  }

  if (weak > strong) {
    return {
      title: "⚠️ 盤勢轉弱",
      text: "下跌或轉弱個股偏多，先降低追價，觀察資金是否回到強勢股。",
      strategy: "保守觀察，等待股票重新轉強。",
    };
  }

  return {
    title: "🟡 盤勢普通",
    text: "市場強弱中性，適合觀察族群輪動與低位階轉強股。",
    strategy: "先看主流產業，再看9:10開盤與明日觀察。",
  };
}

function sortStocks(list: Stock[], sortKey: SortKey, mainIndustries: string[], settings: Settings) {
  const arr = [...list];

  if (sortKey === "priceLow") return arr.sort((a, b) => a.price - b.price);
  if (sortKey === "alert") {
    return arr.sort((a, b) => Number(isAlert(b, settings)) - Number(isAlert(a, settings)) || b.changePercent - a.changePercent);
  }
  if (sortKey === "industry") return arr.sort((a, b) => a.industry.localeCompare(b.industry) || b.changePercent - a.changePercent);
  if (sortKey === "safe") {
    return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  }

  return arr.sort((a, b) => b.changePercent - a.changePercent);
}

function StockCard({
  stock,
  rank,
  mainIndustries,
  settings,
  favoriteCodes,
  observeCodes,
  expandedCode,
  notes,
  onToggleExpand,
  onAddFavorite,
  onRemoveFavorite,
  onAddObserve,
  onRemoveObserve,
  onSaveNote,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  observeCodes: string[];
  expandedCode: string;
  notes: Record<string, string>;
  onToggleExpand: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddObserve: (code: string) => void;
  onRemoveObserve: (code: string) => void;
  onSaveNote: (code: string, note: string) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isObserve = observeCodes.includes(stock.code);
  const isExpanded = expandedCode === stock.code;
  const score = scoreStock(stock, mainIndustries, settings);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-lg">
      <button onClick={() => onToggleExpand(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">#{rank}　{stock.code}</div>
            <div className="mt-1 text-xl font-black text-white">{stock.name}</div>
            <div className="mt-1 text-sm font-bold text-slate-400">{stock.industry}</div>
          </div>

          <div className={`text-right text-2xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>
            {formatPercent(stock.changePercent)}
          </div>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
        <div className="rounded-2xl bg-black/30 p-3 text-yellow-100">{getHeatStatus(stock, settings)}</div>
        <div className="rounded-2xl bg-black/30 p-3 text-cyan-100">分數 {score}</div>
      </div>

      <div className="mt-2 rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-200">
        買進前檢查：{getBuyChecklist(stock, mainIndustries, settings)}
      </div>

      {isWeakening(stock) && (
        <div className="mt-2 rounded-2xl border border-red-500 bg-red-950/40 p-3 text-sm font-black text-red-200">
          {getWeakeningText(stock)}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-700 bg-black/30 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-900 p-2">
              <div className="text-xs text-slate-500">股價</div>
              <div className={`font-bold ${isUnderPrice(stock, settings) ? "text-white" : "text-orange-300"}`}>
                {formatNumber(stock.price)}
              </div>
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

          <div className="rounded-2xl bg-slate-900 p-3 text-sm font-bold leading-6 text-slate-200">
            理由：{getTomorrowReasons(stock, mainIndustries, settings)}
          </div>

          <textarea
            value={notes[stock.code] ?? ""}
            onChange={(e) => onSaveNote(stock.code, e.target.value)}
            placeholder="自選備註，例如：等回測開盤價、觀察是否續強、不要追高"
            className="min-h-[80px] w-full rounded-2xl border border-slate-700 bg-black/40 p-3 text-sm font-bold text-white outline-none"
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black active:scale-95 ${
            isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>

        <button
          onClick={() => (isObserve ? onRemoveObserve(stock.code) : onAddObserve(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black active:scale-95 ${
            isObserve ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isObserve ? "📌 移除觀察" : "📌 明天觀察"}
        </button>
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
  const [autoSeconds, setAutoSeconds] = useState(AUTO_REFRESH_SECONDS);
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [observeCodes, setObserveCodes] = useState<string[]>([]);
  const [favoriteInput, setFavoriteInput] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [mainOnly, setMainOnly] = useState(false);
  const [hideWeak, setHideWeak] = useState(false);
  const [expandedCode, setExpandedCode] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITE_KEY);
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) setFavoriteCodes(parsed.map(String).map(cleanCode).filter(Boolean));
      }

      const savedObserve = localStorage.getItem(OBSERVE_KEY);
      if (savedObserve) {
        const parsed = JSON.parse(savedObserve);
        if (Array.isArray(parsed)) setObserveCodes(parsed.map(String).map(cleanCode).filter(Boolean));
      }

      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }

      const savedNotes = localStorage.getItem(NOTES_KEY);
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes);
        if (parsed && typeof parsed === "object") setNotes(parsed);
      }
    } catch {
      setFavoriteCodes([]);
      setObserveCodes([]);
      setSettings(defaultSettings);
      setNotes({});
    }
  }, []);

  function saveSettings(next: Settings) {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function saveFavoriteCodes(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function saveObserveCodes(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setObserveCodes(clean);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(clean));
  }

  function saveNote(code: string, note: string) {
    const next = { ...notes, [code]: note };
    setNotes(next);
    localStorage.setItem(NOTES_KEY, JSON.stringify(next));
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

  function addObserve(code: string) {
    const cleaned = cleanCode(code);
    if (!cleaned) return;
    saveObserveCodes([...observeCodes, cleaned]);
    setTab("observe");
  }

  function removeObserve(code: string) {
    saveObserveCodes(observeCodes.filter((item) => item !== code));
  }

  function clearObserve() {
    saveObserveCodes([]);
    setTab("observe");
  }

  async function loadStocks() {
    try {
      setError("");

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API 錯誤：${response.status}`);

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
          (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : new Date().toLocaleString("zh-TW"))
      );
      setSource(json.source || "TWSE MIS + Yahoo fallback");
    } catch (err: any) {
      setError(err?.message || "資料讀取失敗");
      setStocks([]);
    } finally {
      setLoading(false);
      setAutoSeconds(AUTO_REFRESH_SECONDS);
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
          return AUTO_REFRESH_SECONDS;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const filteredTop50 = useMemo(() => top50.filter((stock) => isUnderPrice(stock, settings)), [top50, settings]);

  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const filteredIndustries = useMemo(() => getIndustryRanking(filteredTop50), [filteredTop50]);
  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const alerts = useMemo(() => filteredTop50.filter((stock) => isAlert(stock, settings)), [filteredTop50, settings]);
  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)).slice(0, 20), [top50, settings]);
  const weakList = useMemo(() => filteredTop50.filter(isWeakening).slice(0, 20), [filteredTop50]);

  const open910List = useMemo(() => {
    return filteredTop50
      .filter((stock) => isOpen910Candidate(stock, mainIndustries, settings))
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 15);
  }, [filteredTop50, mainIndustries, settings]);

  const tomorrowList = useMemo(() => {
    return filteredTop50
      .filter((stock) => stock.changePercent >= 2.5)
      .filter((stock) => getRisk(stock) !== "高")
      .map((stock) => ({
        stock,
        score: scoreStock(stock, mainIndustries, settings),
      }))
      .filter((item) => item.score >= 35)
      .sort((a, b) => b.score - a.score || b.stock.changePercent - a.stock.changePercent)
      .slice(0, 15)
      .map((item) => item.stock);
  }, [filteredTop50, mainIndustries, settings]);

  const top10List = useMemo(() => {
    return filteredTop50
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeakening(stock))
      .map((stock) => ({
        stock,
        score: scoreStock(stock, mainIndustries, settings),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.stock);
  }, [filteredTop50, mainIndustries, settings]);

  const favoriteStocks = useMemo(() => {
    return favoriteCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [favoriteCodes, stocks]);

  const observeStocks = useMemo(() => {
    return observeCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [observeCodes, stocks]);

  const favoriteAlerts = useMemo(() => {
    return favoriteStocks.filter(
      (stock) => isUnderPrice(stock, settings) && (isAlert(stock, settings) || isBreakout(stock) || stock.changePercent >= 3)
    );
  }, [favoriteStocks, settings]);

  const market = useMemo(() => getMarketMode(top50, alerts, settings), [top50, alerts, settings]);
  const strongestIndustry = industries[0];
  const strongestFilteredIndustry = filteredIndustries[0];
  const strongestStock = top50[0];

  function applyFilters(list: Stock[]) {
    let result = [...list];

    const keyword = searchText.trim();
    if (keyword) {
      result = result.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (mainOnly) {
      result = result.filter((stock) => mainIndustries.includes(stock.industry));
    }

    if (hideWeak) {
      result = result.filter((stock) => !isWeakening(stock));
    }

    return sortStocks(result, sortKey, mainIndustries, settings);
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return applyFilters(top50);
    if (tab === "open910") return applyFilters(open910List);
    if (tab === "tomorrow") return applyFilters(tomorrowList);
    if (tab === "observe") return applyFilters(observeStocks);
    if (tab === "favorite") return applyFilters(favoriteStocks);
    if (tab === "alert") return applyFilters(alerts);
    return [];
  }, [
    tab,
    top50,
    open910List,
    tomorrowList,
    observeStocks,
    favoriteStocks,
    alerts,
    searchText,
    mainOnly,
    hideWeak,
    sortKey,
    mainIndustries,
    settings,
  ]);

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    observeCodes,
    expandedCode,
    notes,
    onToggleExpand: (code: string) => setExpandedCode(expandedCode === code ? "" : code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddObserve: addObserve,
    onRemoveObserve: removeObserve,
    onSaveNote: saveNote,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-40 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股即時雷達</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{settings.maxPrice}元內策略雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                搜尋、排序、Top10、過熱清單、自選備註、明天觀察一次整合。
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
              立即<br />更新
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">50強</div>
              <div className="text-2xl font-black text-red-400">{top50.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">Top10</div>
              <div className="text-2xl font-black text-cyan-300">{top10List.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">警報</div>
              <div className="text-2xl font-black text-orange-300">{alerts.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-3">
              <div className="text-xs text-slate-500">過熱</div>
              <div className="text-2xl font-black text-yellow-300">{hotList.length}</div>
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
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="text-xl font-black">🔎 搜尋與篩選</h2>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號或名稱，例如 2330"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

          <div className="mt-3 grid grid-cols-5 gap-2 text-center">
            {[
              ["change", "漲幅"],
              ["priceLow", "低價"],
              ["alert", "警報"],
              ["industry", "產業"],
              ["safe", "分數"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key as SortKey)}
                className={`rounded-2xl py-3 text-xs font-black ${
                  sortKey === key ? "bg-indigo-500 text-white" : "bg-black/30 text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMainOnly(!mainOnly)}
              className={`rounded-2xl py-3 text-sm font-black ${
                mainOnly ? "bg-blue-500/30 text-blue-200" : "bg-black/30 text-slate-300"
              }`}
            >
              只看主流產業：{mainOnly ? "開" : "關"}
            </button>

            <button
              onClick={() => setHideWeak(!hideWeak)}
              className={`rounded-2xl py-3 text-sm font-black ${
                hideWeak ? "bg-emerald-500/30 text-emerald-200" : "bg-black/30 text-slate-300"
              }`}
            >
              排除轉弱：{hideWeak ? "開" : "關"}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">🏆 明天優先 Top10</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            依主流產業、股價上限、未過熱、未轉弱與觀察分數排序。
          </p>

          <div className="mt-3 space-y-2 text-sm font-black text-cyan-100">
            {top10List.slice(0, 5).map((stock, index) => (
              <div key={stock.code} className="rounded-2xl bg-black/30 p-3">
                {index + 1}. {stock.code} {stock.name}｜{formatPercent(stock.changePercent)}｜分數{" "}
                {scoreStock(stock, mainIndustries, settings)}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
          <h2 className="text-xl font-black">🔥 過熱勿追清單</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            這些股票雖然強，但目前容易追高，先等回檔或重新整理。
          </p>
          <div className="mt-3 text-sm font-bold text-yellow-100">
            過熱股：{hotList.length} 檔｜轉弱股：{weakList.length} 檔
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">📌 明天觀察清單</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            可從任一股票卡加入，收盤後可一鍵清空重建。
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab("observe")}
              className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
            >
              查看觀察 {observeCodes.length}
            </button>

            <button
              onClick={clearObserve}
              className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-300"
            >
              清空觀察
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-violet-600 bg-violet-950/30 p-5">
          <h2 className="text-xl font-black">🌙 收盤總結</h2>
          <div className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-200">
            <div>今日主流產業：{mainIndustries.length > 0 ? mainIndustries.join("、") : "--"}</div>
            <div>今日最強產業：{strongestIndustry?.industry ?? "--"}</div>
            <div>{settings.maxPrice}元內最強產業：{strongestFilteredIndustry?.industry ?? "--"}</div>
            <div>
              今日最強個股：
              {strongestStock ? `${strongestStock.code} ${strongestStock.name} ${formatPercent(strongestStock.changePercent)}` : "--"}
            </div>
            <div>Top10：{top10List.length} 檔｜警報：{alerts.length} 檔｜觀察：{observeCodes.length} 檔｜過熱：{hotList.length} 檔</div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
          <h2 className="text-xl font-black">⭐ 自選股快查</h2>

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
        </section>

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "top50" && "📊 今日漲幅50強"}
              {tab === "open910" && "⏰ 9:10開盤模式"}
              {tab === "tomorrow" && `📌 ${settings.maxPrice}元內明日觀察`}
              {tab === "observe" && "📝 明天觀察清單"}
              {tab === "favorite" && "⭐ 我的自選股"}
              {tab === "settings" && "⚙️ 條件設定"}
              {tab === "industry" && "🏭 產業熱度"}
              {tab === "alert" && `🔔 ${settings.maxPrice}元內警報股`}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              點股票卡片可展開詳細資訊與備註。
            </p>
          </div>

          {tab === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">股價上限</div>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 150, 200, 300].map((price) => (
                    <button
                      key={price}
                      onClick={() => saveSettings({ ...settings, maxPrice: price })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.maxPrice === price ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {price}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">警報漲幅</div>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 7].map((p) => (
                    <button
                      key={p}
                      onClick={() => saveSettings({ ...settings, alertPercent: p })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.alertPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">開盤溢價</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 3, 5].map((p) => (
                    <button
                      key={p}
                      onClick={() => saveSettings({ ...settings, openPremiumPercent: p })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.openPremiumPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => saveSettings({ ...settings, excludeHot: !settings.excludeHot })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.excludeHot ? "bg-emerald-500/30 text-emerald-200" : "bg-red-500/30 text-red-200"
                }`}
              >
                排除過熱股：{settings.excludeHot ? "開啟" : "關閉"}
              </button>
            </div>
          )}

          {tab !== "settings" && tab !== "industry" && (
            <div className="space-y-3">
              {currentList.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有符合條件的股票。
                </div>
              )}

              {currentList.map((stock, index) => (
                <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} {...cardProps} />
              ))}
            </div>
          )}

          {tab === "industry" && (
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
                        平均 {formatPercent(item.avg)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-400">
                    {item.stocks.slice(0, 5).map((stock) => `${stock.name} ${formatPercent(stock.changePercent)}`).join("、")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-1 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-8 gap-1 text-center">
          {[
            ["top50", "📊", "50"],
            ["open910", "⏰", "9:10"],
            ["tomorrow", "📌", "明日"],
            ["observe", "📝", "觀察"],
            ["favorite", "⭐", "自選"],
            ["settings", "⚙️", "設定"],
            ["industry", "🏭", "產業"],
            ["alert", "🔔", "警報"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as TabKey)}
              className={`rounded-2xl py-2 text-[10px] font-black ${
                tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"
              }`}
            >
              <div className="text-lg">{icon}</div>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}