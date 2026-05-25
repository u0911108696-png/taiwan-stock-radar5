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
  | "today"
  | "open910"
  | "top10"
  | "observe"
  | "favorite"
  | "weak"
  | "hot"
  | "industry"
  | "settings";

type SortKey = "score" | "change" | "priceLow" | "alert" | "industry" | "safe";
type ModeKey = "today" | "tomorrow";
type ViewKey = "compact" | "detail";
type FavGroup = "短線觀察" | "明天追蹤" | "長期關注";

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
  maxObserve: number;
  minChangePercent: number;
  minVolume: number;
  excludeIndustries: string[];
  mode: ModeKey;
  view: ViewKey;
};

const API_URL = "/api/stocks";
const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const OBSERVE_KEY = "taiwan-stock-radar-observe";
const SETTINGS_KEY = "taiwan-stock-radar-settings";
const NOTES_KEY = "taiwan-stock-radar-notes";
const GROUPS_KEY = "taiwan-stock-radar-groups";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-last-success";
const AUTO_REFRESH_SECONDS = 60;

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  openPremiumPercent: 3,
  excludeHot: true,
  maxObserve: 15,
  minChangePercent: 0,
  minVolume: 0,
  excludeIndustries: [],
  mode: "today",
  view: "detail",
};

const noteTemplates = ["等回測", "看續強", "不追高", "跌破開盤出場"];

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
  if (stock.price < stock.openPrice) return "⚠️ 股價跌破開盤價";
  if (stock.changePercent < 2) return "⚠️ 漲幅低於2%";
  if (stock.openPremiumPercent !== null && stock.openPremiumPercent >= 3 && stock.changePercent < stock.openPremiumPercent) {
    return "⚠️ 漲幅低於開盤溢價";
  }
  return "✅ 尚未明顯轉弱";
}

function isAlert(stock: Stock, settings: Settings) {
  if (!isUnderPrice(stock, settings)) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;
  if (settings.excludeIndustries.includes(stock.industry)) return false;
  if (stock.changePercent < settings.minChangePercent) return false;
  if (stock.volume < settings.minVolume) return false;

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
  if (settings.excludeIndustries.includes(stock.industry)) score -= 100;
  if (stock.volume < settings.minVolume) score -= 20;

  return Math.max(0, score);
}

function scoreLabel(score: number) {
  if (score >= 80) return "🟢 優先看";
  if (score >= 60) return "🟡 可觀察";
  return "⚪ 普通";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-yellow-300";
  return "text-slate-300";
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
  if (settings.excludeIndustries.includes(stock.industry)) return false;
  if (stock.volume < settings.minVolume) return false;

  return (
    stock.changePercent >= Math.max(2, settings.minChangePercent) &&
    stock.openPremiumPercent !== null &&
    stock.openPremiumPercent >= 0 &&
    stock.price >= stock.openPrice &&
    getRisk(stock) !== "高" &&
    mainIndustries.includes(stock.industry)
  );
}

function getReason(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];
  if (isUnderPrice(stock, settings)) reasons.push(`股價${settings.maxPrice}元內`);
  if (mainIndustries.includes(stock.industry)) reasons.push("主流產業");
  if (stock.changePercent >= 3) reasons.push("漲幅轉強");
  if (stock.price >= stock.openPrice) reasons.push("強於開盤");
  if ((stock.openPremiumPercent ?? 0) >= 0) reasons.push("溢價為正");
  if ((stock.volumeRatio ?? 0) >= 1.2) reasons.push("量能放大");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  return reasons.length > 0 ? reasons.slice(0, 4).join("、") : "尚未出現明顯優勢";
}

function getAlertReason(stock: Stock, settings: Settings) {
  const reasons: string[] = [];
  if (isUnderPrice(stock, settings)) reasons.push(`股價${settings.maxPrice}元內`);
  if (stock.changePercent >= settings.alertPercent) reasons.push(`漲幅>${settings.alertPercent}%`);
  if ((stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent) reasons.push(`溢價>${settings.openPremiumPercent}%`);
  if ((stock.volumeRatio ?? 0) >= 2) reasons.push("量能放大");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  return reasons.join("、") || "符合警報條件";
}

function getBuyChecklist(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = scoreStock(stock, mainIndustries, settings);
  if (isHot(stock, settings)) return "❌ 不追高：過熱";
  if (isWeakening(stock)) return "⚠️ 小心：盤中轉弱";
  if (score >= 80) return "✅ 優先觀察";
  if (score >= 60) return "🟡 可觀察";
  return "⚪ 暫不追";
}

function sortStocks(list: Stock[], sortKey: SortKey, mainIndustries: string[], settings: Settings) {
  const arr = [...list];

  if (sortKey === "priceLow") return arr.sort((a, b) => a.price - b.price);
  if (sortKey === "alert") {
    return arr.sort((a, b) => Number(isAlert(b, settings)) - Number(isAlert(a, settings)) || b.changePercent - a.changePercent);
  }
  if (sortKey === "industry") return arr.sort((a, b) => a.industry.localeCompare(b.industry) || b.changePercent - a.changePercent);
  if (sortKey === "safe") return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  if (sortKey === "score") return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));

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
  groups,
  onToggleExpand,
  onAddFavorite,
  onRemoveFavorite,
  onAddObserve,
  onRemoveObserve,
  onSaveNote,
  onSetGroup,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  observeCodes: string[];
  expandedCode: string;
  notes: Record<string, string>;
  groups: Record<string, FavGroup>;
  onToggleExpand: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddObserve: (code: string) => void;
  onRemoveObserve: (code: string) => void;
  onSaveNote: (code: string, note: string) => void;
  onSetGroup: (code: string, group: FavGroup) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isObserve = observeCodes.includes(stock.code);
  const isExpanded = expandedCode === stock.code;
  const score = scoreStock(stock, mainIndustries, settings);
  const compact = settings.view === "compact";

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
        <div className={`rounded-2xl bg-black/30 p-3 ${scoreColor(score)}`}>分數 {score}｜{scoreLabel(score)}</div>
      </div>

      {!compact && (
        <>
          <div className="mt-2 rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-200">
            買進前檢查：{getBuyChecklist(stock, mainIndustries, settings)}
          </div>

          {isWeakening(stock) && (
            <div className="mt-2 rounded-2xl border border-red-500 bg-red-950/40 p-3 text-sm font-black text-red-200">
              {getWeakeningText(stock)}
            </div>
          )}
        </>
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

          <button
            onClick={() => navigator.clipboard?.writeText(stock.code)}
            className="w-full rounded-2xl bg-slate-800 py-2 text-sm font-black text-slate-200"
          >
            複製股票代號：{stock.code}
          </button>

          <div className="rounded-2xl bg-slate-900 p-3 text-sm font-bold leading-6 text-slate-200">
            理由：{getReason(stock, mainIndustries, settings)}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["短線觀察", "明天追蹤", "長期關注"] as FavGroup[]).map((group) => (
              <button
                key={group}
                onClick={() => onSetGroup(stock.code, group)}
                className={`rounded-2xl py-2 text-xs font-black ${
                  groups[stock.code] === group ? "bg-yellow-500 text-black" : "bg-black/30 text-slate-300"
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {noteTemplates.map((text) => (
              <button
                key={text}
                onClick={() => onSaveNote(stock.code, text)}
                className="rounded-2xl bg-slate-800 py-2 text-xs font-black text-slate-200"
              >
                {text}
              </button>
            ))}
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
  const [tab, setTab] = useState<TabKey>("today");
  const [autoSeconds, setAutoSeconds] = useState(AUTO_REFRESH_SECONDS);
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [observeCodes, setObserveCodes] = useState<string[]>([]);
  const [favoriteInput, setFavoriteInput] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [mainOnly, setMainOnly] = useState(false);
  const [hideWeak, setHideWeak] = useState(false);
  const [expandedCode, setExpandedCode] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Record<string, FavGroup>>({});

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
      if (savedSettings) setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });

      const savedNotes = localStorage.getItem(NOTES_KEY);
      if (savedNotes) setNotes(JSON.parse(savedNotes));

      const savedGroups = localStorage.getItem(GROUPS_KEY);
      if (savedGroups) setGroups(JSON.parse(savedGroups));

      const last = localStorage.getItem(LAST_SUCCESS_KEY);
      if (last) {
        const parsed = JSON.parse(last);
        if (Array.isArray(parsed.stocks)) setStocks(parsed.stocks);
        if (parsed.apiDataTime) setApiDataTime(parsed.apiDataTime);
        if (parsed.source) setSource(parsed.source);
        if (parsed.lastSuccessAt) setLastSuccessAt(parsed.lastSuccessAt);
      }
    } catch {
      setFavoriteCodes([]);
      setObserveCodes([]);
      setSettings(defaultSettings);
      setNotes({});
      setGroups({});
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
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, settings.maxObserve);
    setObserveCodes(clean);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(clean));
  }

  function saveNote(code: string, note: string) {
    const next = { ...notes, [code]: note };
    setNotes(next);
    localStorage.setItem(NOTES_KEY, JSON.stringify(next));
  }

  function setGroup(code: string, group: FavGroup) {
    const next = { ...groups, [code]: group };
    setGroups(next);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
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

      const successTime = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      const dataTime =
        json.updatedAtTaiwan ||
        (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : new Date().toLocaleString("zh-TW"));
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);

      localStorage.setItem(
        LAST_SUCCESS_KEY,
        JSON.stringify({
          stocks: normalized,
          lastSuccessAt: successTime,
          apiDataTime: dataTime,
          source: dataSource,
        })
      );
    } catch (err: any) {
      setError(err?.message || "資料讀取失敗，已保留上次成功資料");
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

  const baseFiltered = useMemo(() => {
    return top50
      .filter((stock) => isUnderPrice(stock, settings))
      .filter((stock) => !settings.excludeIndustries.includes(stock.industry))
      .filter((stock) => stock.changePercent >= settings.minChangePercent)
      .filter((stock) => stock.volume >= settings.minVolume);
  }, [top50, settings]);

  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const filteredIndustries = useMemo(() => getIndustryRanking(baseFiltered), [baseFiltered]);
  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const industryFocusScore = useMemo(() => {
    if (top50.length === 0) return 0;
    const mainCount = industries.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
    return Math.round((mainCount / top50.length) * 100);
  }, [industries, top50]);

  const alerts = useMemo(() => baseFiltered.filter((stock) => isAlert(stock, settings)), [baseFiltered, settings]);
  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)).slice(0, 20), [top50, settings]);
  const weakList = useMemo(() => baseFiltered.filter(isWeakening).slice(0, 20), [baseFiltered]);

  const open910List = useMemo(() => {
    return baseFiltered
      .filter((stock) => isOpen910Candidate(stock, mainIndustries, settings))
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 15);
  }, [baseFiltered, mainIndustries, settings]);

  const top10List = useMemo(() => {
    return baseFiltered
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeakening(stock))
      .map((stock) => ({
        stock,
        score: scoreStock(stock, mainIndustries, settings),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.stock);
  }, [baseFiltered, mainIndustries, settings]);

  const tomorrowList = useMemo(() => {
    return baseFiltered
      .filter((stock) => stock.changePercent >= 2.5)
      .map((stock) => ({
        stock,
        score: scoreStock(stock, mainIndustries, settings),
      }))
      .filter((item) => item.score >= 35)
      .sort((a, b) => b.score - a.score || b.stock.changePercent - a.stock.changePercent)
      .slice(0, 15)
      .map((item) => item.stock);
  }, [baseFiltered, mainIndustries, settings]);

  const favoriteStocks = useMemo(() => {
    return favoriteCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [favoriteCodes, stocks]);

  const observeStocks = useMemo(() => {
    return observeCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [observeCodes, stocks]);

  const market = useMemo(() => {
    const strong = top50.filter((stock) => stock.changePercent >= 3).length;
    const weak = top50.filter((stock) => stock.changePercent < 0).length;

    if (strong >= 20 && alerts.length >= 10) {
      return {
        title: `✅ ${settings.maxPrice}元內強勢股活躍`,
        text: `警報股增加，短線資金可能集中在中低價強勢股。`,
        strategy: "先看主流產業，再看Top10、9:10與警報。",
      };
    }

    if (weak > strong) {
      return {
        title: "⚠️ 盤勢轉弱",
        text: "轉弱股偏多，降低追價。",
        strategy: "只看高分、主流、未過熱、未轉弱。",
      };
    }

    return {
      title: "🟡 盤勢普通",
      text: "市場中性，適合精選不要亂追。",
      strategy: "先看Top10，再看自選與觀察清單。",
    };
  }, [top50, alerts, settings]);

  const strongestIndustry = industries[0];
  const strongestFilteredIndustry = filteredIndustries[0];
  const strongestStock = top50[0];

  function applyFilters(list: Stock[]) {
    let result = [...list];

    const keyword = searchText.trim();
    if (keyword) {
      result = result.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (mainOnly) result = result.filter((stock) => mainIndustries.includes(stock.industry));
    if (hideWeak) result = result.filter((stock) => !isWeakening(stock));

    return sortStocks(result, sortKey, mainIndustries, settings);
  }

  const currentList = useMemo(() => {
    if (tab === "today") return applyFilters(top50);
    if (tab === "open910") return applyFilters(open910List);
    if (tab === "top10") return applyFilters(top10List);
    if (tab === "observe") return applyFilters(observeStocks);
    if (tab === "favorite") return applyFilters(favoriteStocks);
    if (tab === "weak") return applyFilters(weakList);
    if (tab === "hot") return applyFilters(hotList);
    return [];
  }, [
    tab,
    top50,
    open910List,
    top10List,
    observeStocks,
    favoriteStocks,
    weakList,
    hotList,
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
    groups,
    onToggleExpand: (code: string) => setExpandedCode(expandedCode === code ? "" : code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddObserve: addObserve,
    onRemoveObserve: removeObserve,
    onSaveNote: saveNote,
    onSetGroup: setGroup,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-40 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股即時雷達</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{settings.maxPrice}元策略雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                今日 / 明日模式、Top10、過熱、轉弱、主流產業、自選備註一次整合。
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
              <div className="text-xs text-slate-500">集中</div>
              <div className="text-2xl font-black text-yellow-300">{industryFocusScore}</div>
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

        <section className="mt-4 rounded-3xl border border-purple-500/60 bg-purple-950/20 p-5">
          <h2 className="text-xl font-black">🧭 今日 / 明日模式</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => saveSettings({ ...settings, mode: "today" })}
              className={`rounded-2xl py-3 text-sm font-black ${
                settings.mode === "today" ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
              }`}
            >
              今日盤中
            </button>
            <button
              onClick={() => saveSettings({ ...settings, mode: "tomorrow" })}
              className={`rounded-2xl py-3 text-sm font-black ${
                settings.mode === "tomorrow" ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
              }`}
            >
              收盤看明天
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="text-xl font-black">🔎 搜尋與快速篩選</h2>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號或名稱，例如 2330"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

          <div className="mt-3 grid grid-cols-5 gap-2 text-center">
            {[
              ["score", "分數"],
              ["change", "漲幅"],
              ["priceLow", "低價"],
              ["alert", "警報"],
              ["industry", "產業"],
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => setMainOnly(!mainOnly)}
              className={`rounded-2xl py-3 text-xs font-black ${
                mainOnly ? "bg-blue-500/30 text-blue-200" : "bg-black/30 text-slate-300"
              }`}
            >
              主流：{mainOnly ? "開" : "關"}
            </button>
            <button
              onClick={() => setHideWeak(!hideWeak)}
              className={`rounded-2xl py-3 text-xs font-black ${
                hideWeak ? "bg-emerald-500/30 text-emerald-200" : "bg-black/30 text-slate-300"
              }`}
            >
              排轉弱：{hideWeak ? "開" : "關"}
            </button>
            <button
              onClick={() => saveSettings({ ...settings, view: settings.view === "detail" ? "compact" : "detail" })}
              className="rounded-2xl bg-black/30 py-3 text-xs font-black text-slate-300"
            >
              {settings.view === "detail" ? "詳細" : "簡潔"}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">🏆 明天優先 Top10</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            依主流產業、股價上限、未過熱、未轉弱與觀察分數排序。
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => saveObserveCodes([...observeCodes, ...top10List.map((s) => s.code)])}
              className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
            >
              加入Top10
            </button>
            <button
              onClick={() => saveObserveCodes([...observeCodes, ...alerts.map((s) => s.code)])}
              className="rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200"
            >
              加入警報股
            </button>
          </div>

          <div className="mt-3 space-y-2 text-sm font-black text-cyan-100">
            {top10List.slice(0, 5).map((stock, index) => (
              <div key={stock.code} className="rounded-2xl bg-black/30 p-3">
                {index + 1}. {stock.code} {stock.name}｜{formatPercent(stock.changePercent)}｜分數{" "}
                {scoreStock(stock, mainIndustries, settings)}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-indigo-500/60 bg-indigo-950/20 p-5">
          <h2 className="text-xl font-black">🏭 主流產業與集中度</h2>
          <div className="mt-3 space-y-2 text-sm font-bold text-indigo-100">
            <div>今日主流：{mainIndustries.length > 0 ? mainIndustries.join("、") : "--"}</div>
            <div>產業集中度：{industryFocusScore} / 100</div>
            <div>{industryFocusScore >= 50 ? "✅ 資金集中" : "🟡 資金偏分散"}</div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
          <h2 className="text-xl font-black">🔥 過熱 / 轉弱專區</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab("hot")}
              className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200"
            >
              過熱 {hotList.length}
            </button>
            <button
              onClick={() => setTab("weak")}
              className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200"
            >
              轉弱 {weakList.length}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">📌 明天觀察清單</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab("observe")}
              className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
            >
              查看觀察 {observeCodes.length}/{settings.maxObserve}
            </button>
            <button
              onClick={() => saveObserveCodes([])}
              className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-300"
            >
              清空觀察
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-violet-600 bg-violet-950/30 p-5">
          <h2 className="text-xl font-black">🌙 收盤後重置流程</h2>
          <div className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-200">
            <div>1. 看主流產業：{mainIndustries.length > 0 ? mainIndustries.join("、") : "--"}</div>
            <div>2. 看過熱清單：{hotList.length} 檔，先不要追高</div>
            <div>3. 看明天Top10：{top10List.length} 檔</div>
            <div>4. 加入觀察清單：{observeCodes.length} 檔</div>
            <div>5. 清空不需要的舊觀察</div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-violet-600 bg-violet-950/30 p-5">
          <h2 className="text-xl font-black">🌙 收盤總結</h2>
          <div className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-200">
            <div>今日最強產業：{strongestIndustry?.industry ?? "--"}</div>
            <div>{settings.maxPrice}元內最強產業：{strongestFilteredIndustry?.industry ?? "--"}</div>
            <div>
              今日最強個股：
              {strongestStock ? `${strongestStock.code} ${strongestStock.name} ${formatPercent(strongestStock.changePercent)}` : "--"}
            </div>
            <div>Top10：{top10List.length}｜警報：{alerts.length}｜觀察：{observeCodes.length}｜過熱：{hotList.length}</div>
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
              {tab === "today" && "📊 今日50強"}
              {tab === "open910" && "⏰ 9:10開盤"}
              {tab === "top10" && "🏆 明天Top10"}
              {tab === "observe" && "📝 觀察清單"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "weak" && "⚠️ 轉弱股"}
              {tab === "hot" && "🔥 過熱股"}
              {tab === "industry" && "🏭 產業熱度"}
              {tab === "settings" && "⚙️ 條件設定"}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">點股票卡可展開細節、備註、分組、複製代號。</p>
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

              <div>
                <div className="mb-2 text-lg font-black">觀察上限</div>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20].map((p) => (
                    <button
                      key={p}
                      onClick={() => saveSettings({ ...settings, maxObserve: p })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.maxObserve === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {p}檔
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">最低漲幅</div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 2, 3, 5].map((p) => (
                    <button
                      key={p}
                      onClick={() => saveSettings({ ...settings, minChangePercent: p })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.minChangePercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">最低成交量</div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 500, 1000, 3000].map((v) => (
                    <button
                      key={v}
                      onClick={() => saveSettings({ ...settings, minVolume: v })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.minVolume === v ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">排除產業</div>
                <div className="grid grid-cols-3 gap-2">
                  {["金融", "航運", "鋼鐵"].map((name) => {
                    const active = settings.excludeIndustries.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() =>
                          saveSettings({
                            ...settings,
                            excludeIndustries: active
                              ? settings.excludeIndustries.filter((item) => item !== name)
                              : [...settings.excludeIndustries, name],
                          })
                        }
                        className={`rounded-2xl py-3 text-sm font-black ${
                          active ? "bg-red-500/50 text-white" : "bg-black/30 text-slate-300"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
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

                  <div className="mt-3 space-y-2 text-sm font-bold text-slate-400">
                    {item.stocks.slice(0, 5).map((stock, i) => (
                      <div key={stock.code}>
                        {i + 1}. {stock.code} {stock.name} {formatPercent(stock.changePercent)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-1 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-9 gap-1 text-center">
          {[
            ["today", "📊", "今日"],
            ["open910", "⏰", "9:10"],
            ["top10", "🏆", "Top"],
            ["observe", "📝", "觀察"],
            ["favorite", "⭐", "自選"],
            ["weak", "⚠️", "轉弱"],
            ["hot", "🔥", "過熱"],
            ["industry", "🏭", "產業"],
            ["settings", "⚙️", "設定"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as TabKey)}
              className={`rounded-2xl py-2 text-[9px] font-black ${
                tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"
              }`}
            >
              <div className="text-base">{icon}</div>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}