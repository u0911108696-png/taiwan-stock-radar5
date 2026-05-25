import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  industry: string;
  updatedAt?: string;
};

type TabKey = "home" | "top50" | "tomorrow" | "favorite" | "more";

type MoreView =
  | "menu"
  | "industry"
  | "breakout"
  | "pullback"
  | "alert"
  | "avoid"
  | "data"
  | "settings";

type PriceDirection = "up" | "down" | "same" | "new";
type MainMode = "保守" | "標準" | "積極";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  hotPercent: number;
  refreshSeconds: number;
  excludeHot: boolean;
  mainMode: MainMode;
  topOnlyMain: boolean;
  topOnlyLowPrice: boolean;
  topOnlyBreakout: boolean;
  topExcludeHot: boolean;
  industryTopOnly: boolean;
};

type ApiResponse = {
  stocks?: any[];
  data?: any[];
  rankedStocks?: any[];
  updatedAt?: string;
  updatedAtTaiwan?: string;
  source?: string;
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-main-v3-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-main-v3-last-success";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  hotPercent: 8,
  refreshSeconds: 30,
  excludeHot: true,
  mainMode: "標準",
  topOnlyMain: false,
  topOnlyLowPrice: false,
  topOnlyBreakout: false,
  topExcludeHot: false,
  industryTopOnly: false,
};

const industryMap: Record<string, string> = {
  "1101": "水泥", "1102": "水泥",
  "1216": "食品", "1227": "食品",
  "1301": "塑化", "1303": "塑化", "6505": "塑化",
  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵",
  "2201": "汽車", "2207": "汽車",
  "2301": "電子", "2303": "半導體", "2308": "電源能源",
  "2313": "電子零組件", "2317": "電子代工", "2327": "電子零組件",
  "2330": "半導體", "2354": "電子", "2356": "電腦週邊", "2357": "電腦週邊",
  "2367": "電子零組件", "2379": "半導體", "2382": "電子代工",
  "2408": "半導體", "2409": "面板", "2454": "半導體",
  "2603": "航運", "2609": "航運", "2615": "航運", "2618": "航運",
  "2881": "金融", "2882": "金融", "2884": "金融", "2886": "金融",
  "2891": "金融", "2892": "金融",
  "3008": "光學", "3017": "電子零組件",
  "3034": "半導體", "3035": "半導體", "3037": "電子零組件",
  "3042": "光電", "3231": "電子代工", "3406": "光學",
  "3443": "半導體", "3481": "面板",
  "3711": "半導體", "3714": "半導體",
  "4966": "半導體", "6415": "半導體", "6669": "電子代工",
};

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeParse<T>(text: string | null, fallback: T): T {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function nowText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-TW");
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const name = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);

  const price = n(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = n(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = n(raw.openPrice ?? raw.open ?? raw.o ?? price);

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
    name,
    price,
    changePercent,
    volume: n(raw.volume ?? raw.tradeVolume ?? raw.totalVolume ?? raw.v),
    openPrice,
    previousClose,
    openPremiumPercent,
    industry:
      raw.industry && raw.industry !== "其他"
        ? String(raw.industry)
        : industryMap[code] ?? "其他",
    updatedAt: String(raw.updatedAt ?? raw.time ?? raw.updateTime ?? updateTime),
  };
}

function isHot(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || (stock.openPremiumPercent ?? 0) >= 5;
}

function isWeak(stock: Stock) {
  return stock.price < stock.openPrice || stock.changePercent < 2;
}

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice;
}

function isPullback(stock: Stock, settings: Settings) {
  if (stock.openPrice <= 0) return false;
  const distance = Math.abs(stock.price - stock.openPrice) / stock.openPrice;
  return stock.changePercent >= 2 && distance <= 0.015 && !isHot(stock, settings);
}

function pullbackDistance(stock: Stock) {
  if (stock.openPrice <= 0) return 999;
  return Math.abs(stock.price - stock.openPrice) / stock.openPrice * 100;
}

function isAlert(stock: Stock, settings: Settings) {
  if (stock.price <= 0 || stock.price > settings.maxPrice) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;
  return stock.changePercent >= settings.alertPercent || (stock.openPremiumPercent ?? 0) >= 3;
}

function getIndustryRanking(stocks: Stock[], settings: Settings) {
  const map = new Map<
    string,
    {
      industry: string;
      count: number;
      avg: number;
      stocks: Stock[];
      breakoutCount: number;
      hotCount: number;
      weakCount: number;
      score: number;
    }
  >();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const item =
      map.get(key) ??
      {
        industry: key,
        count: 0,
        avg: 0,
        stocks: [],
        breakoutCount: 0,
        hotCount: 0,
        weakCount: 0,
        score: 0,
      };

    item.count += 1;
    item.stocks.push(stock);
    if (isBreakout(stock)) item.breakoutCount += 1;
    if (isHot(stock, settings)) item.hotCount += 1;
    if (isWeak(stock)) item.weakCount += 1;
    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avg =
        item.stocks.reduce((sum, stock) => sum + stock.changePercent, 0) /
        Math.max(item.stocks.length, 1);

      return {
        ...item,
        avg,
        score: item.count * 10 + avg * 3 + item.breakoutCount * 5 - item.hotCount * 2 - item.weakCount * 2,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function scoreStock(stock: Stock, mainIndustries: string[], settings: Settings) {
  let score = 0;

  if (mainIndustries.includes(stock.industry)) score += 30;
  if (stock.price > 0 && stock.price <= settings.maxPrice) score += 25;
  if (stock.changePercent >= 3 && stock.changePercent <= 7.5) score += 20;
  if (stock.price >= stock.openPrice) score += 15;
  if ((stock.openPremiumPercent ?? 0) >= 0 && (stock.openPremiumPercent ?? 0) <= 4) score += 10;
  if (isBreakout(stock)) score += 10;
  if (isPullback(stock, settings)) score += 8;

  if (isHot(stock, settings)) score -= 35;
  if (isWeak(stock)) score -= 25;

  if (settings.mainMode === "保守" && !mainIndustries.includes(stock.industry)) score -= 30;
  if (settings.mainMode === "保守" && stock.price > settings.maxPrice) score -= 30;
  if (settings.mainMode === "積極" && isBreakout(stock)) score += 15;

  return Math.max(0, Math.round(score));
}

function getMainRank(stock: Stock, mainIndustries: string[]) {
  const index = mainIndustries.indexOf(stock.industry);
  if (index === -1) return "";
  return `主流${index + 1}`;
}

function getStatus(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "過熱";
  if (isWeak(stock)) return "轉弱";
  if (isAlert(stock, settings)) return "警報";
  if (isBreakout(stock)) return "突破";
  if (isPullback(stock, settings)) return "回測";
  if (mainIndustries.includes(stock.industry)) return "主流";
  return "觀察";
}

function getConclusion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = scoreStock(stock, mainIndustries, settings);

  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock)) return "轉弱小心";
  if (!mainIndustries.includes(stock.industry) && settings.mainMode !== "積極") return "非主流先觀察";
  if (isPullback(stock, settings)) return "等回測";
  if (isBreakout(stock) && score >= 70) return "明日優先觀察";
  if (score >= 70) return "可列觀察";
  return "暫不追";
}

function getTomorrowGroup(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "不追高";
  if (isPullback(stock, settings)) return "等回測";
  if (scoreStock(stock, mainIndustries, settings) >= 70 && !isWeak(stock)) return "優先觀察";
  return "等回測";
}

function getPickReasons(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];

  if (mainIndustries.includes(stock.industry)) reasons.push("主流產業");
  if (stock.price > 0 && stock.price <= settings.maxPrice) reasons.push(`${settings.maxPrice}元內`);
  if (isBreakout(stock)) reasons.push("突破開盤");
  if (isPullback(stock, settings)) reasons.push("接近回測");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  if (!isWeak(stock)) reasons.push("未轉弱");

  return reasons.length ? reasons.join(" / ") : "暫無明確理由";
}

function getAvoidReason(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];

  if (isHot(stock, settings)) reasons.push("過熱");
  if (stock.price < stock.openPrice) reasons.push("跌破開盤");
  if (stock.changePercent < 2) reasons.push("漲幅低於2%");
  if (!mainIndustries.includes(stock.industry)) reasons.push("非主流");
  if (stock.price > settings.maxPrice) reasons.push(`超過${settings.maxPrice}元`);

  return reasons.length ? reasons.join(" / ") : "暫無明顯風險";
}

function getRewatchCondition(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "等漲幅降溫或回測開盤價再看";
  if (stock.price < stock.openPrice) return "重新站回開盤價再看";
  if (stock.changePercent < 2) return "漲幅重新站上2%再看";
  if (!mainIndustries.includes(stock.industry)) return "等產業轉強或成為主流再看";
  return "等回測開盤價並守住再看";
}

function getMarketSignal(top50: Stock[], alerts: Stock[], hotList: Stock[]) {
  const strongCount = top50.filter((stock) => stock.changePercent >= 3).length;

  if (hotList.length >= 15) {
    return {
      title: "🔴 過熱",
      text: "過熱股偏多，避免追高，等回測。",
      tone: "text-red-300",
    };
  }

  if (strongCount >= 20 && alerts.length >= 8) {
    return {
      title: "🟢 偏強",
      text: "強勢股多，優先看主流產業與突破股。",
      tone: "text-emerald-300",
    };
  }

  return {
    title: "🟡 普通",
    text: "盤勢普通，先看產業熱度，再挑高分股。",
    tone: "text-yellow-300",
  };
}

function getDirectionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 價格上升";
  if (direction === "down") return "↓ 價格下降";
  if (direction === "same") return "→ 價格持平";
  if (direction === "new") return "新資料";
  return "--";
}

function getDirectionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  return "text-cyan-300";
}

function getKLinks(code: string, name: string) {
  return {
    yahoo: `https://tw.stock.yahoo.com/quote/${code}.TW/technical-analysis`,
    tradingView: `https://www.tradingview.com/chart/?symbol=TWSE%3A${code}`,
    goodinfo: `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${code}`,
    google: `https://www.google.com/search?q=${code}+${encodeURIComponent(name)}+K線`,
  };
}

function MiniCard({
  title,
  value,
  sub,
  tone,
  onClick,
}: {
  title: string;
  value: string | number;
  sub: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left active:scale-95"
    >
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
    </button>
  );
}

function ActionCard({
  title,
  sub,
  badge,
  tone,
  onClick,
}: {
  title: string;
  sub: string;
  badge: string | number;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-white">{title}</div>
          <div className="mt-1 text-sm font-bold text-slate-400">{sub}</div>
        </div>
        <div className={`rounded-2xl bg-black/40 px-3 py-2 text-lg font-black ${tone}`}>
          {badge}
        </div>
      </div>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function StockCard({
  stock,
  rank,
  mainIndustries,
  settings,
  favoriteCodes,
  tomorrowCodes,
  priceDirections,
  showReason,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddTomorrow,
  onRemoveTomorrow,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  tomorrowCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  showReason?: boolean;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddTomorrow: (code: string) => void;
  onRemoveTomorrow: (code: string) => void;
}) {
  const score = scoreStock(stock, mainIndustries, settings);
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const direction = priceDirections[stock.code];
  const mainRank = getMainRank(stock, mainIndustries);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry} {mainRank && `｜${mainRank}`}
            </div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full bg-slate-800 px-3 py-1">
            {getStatus(stock, mainIndustries, settings)}
          </span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">
            分數 {score}
          </span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${getDirectionTone(direction)}`}>
            {getDirectionText(direction)}
          </span>
          {mainRank && (
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-200">{mainRank}</span>
          )}
          {isTomorrow && (
            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>
          )}
          {isFavorite && (
            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>
          )}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          結論：{getConclusion(stock, mainIndustries, settings)}
        </div>

        {showReason && (
          <div className="mt-2 rounded-2xl bg-cyan-950/30 p-2 text-xs font-bold text-cyan-100">
            理由：{getPickReasons(stock, mainIndustries, settings)}
          </div>
        )}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isTomorrow ? onRemoveTomorrow(stock.code) : onAddTomorrow(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isTomorrow ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isTomorrow ? "📌 移除觀察" : "📌 明日觀察"}
        </button>

        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [tab, setTab] = useState<TabKey>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [tomorrowCodes, setTomorrowCodes] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState("");

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<"score" | "change" | "price">("score");
  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [error, setError] = useState("");

  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState("");
  const [apiDataTime, setApiDataTime] = useState("");
  const [source, setSource] = useState("");
  const [autoSeconds, setAutoSeconds] = useState(defaultSettings.refreshSeconds);

  const [lastPriceMap, setLastPriceMap] = useState<Record<string, number>>({});
  const [priceDirections, setPriceDirections] = useState<Record<string, PriceDirection>>({});

  useEffect(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    setSettings(mergedSettings);
    setAutoSeconds(mergedSettings.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setTomorrowCodes(safeParse(localStorage.getItem(TOMORROW_KEY), []));

    const cached = safeParse<any>(localStorage.getItem(LAST_SUCCESS_KEY), null);

    if (cached && Array.isArray(cached.stocks)) {
      setStocks(cached.stocks);
      setUsingCache(true);

      const prices: Record<string, number> = {};
      cached.stocks.forEach((stock: Stock) => {
        prices[stock.code] = stock.price;
      });
      setLastPriceMap(prices);

      if (cached.lastSuccessAt) setLastSuccessAt(cached.lastSuccessAt);
      if (cached.apiDataTime) setApiDataTime(cached.apiDataTime);
      if (cached.source) setSource(cached.source);
    }
  }, []);

  function saveSettings(next: Settings) {
    setSettings(next);
    setAutoSeconds(next.refreshSeconds);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function saveFavorites(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function saveTomorrow(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 50);
    setTomorrowCodes(clean);
    localStorage.setItem(TOMORROW_KEY, JSON.stringify(clean));
  }

  function addFavorite(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    saveFavorites([...favoriteCodes, clean]);
  }

  function removeFavorite(code: string) {
    saveFavorites(favoriteCodes.filter((item) => item !== code));
  }

  function addTomorrow(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    saveTomorrow([...tomorrowCodes, clean]);
  }

  function removeTomorrow(code: string) {
    saveTomorrow(tomorrowCodes.filter((item) => item !== code));
  }

  async function loadStocks() {
    try {
      setUpdating(true);
      setError("");
      setLastAttemptAt(nowText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`API錯誤：${response.status}`);
      }

      const json: ApiResponse = await response.json();

      const list = Array.isArray(json.rankedStocks)
        ? json.rankedStocks
        : Array.isArray(json.stocks)
          ? json.stocks
          : Array.isArray(json.data)
            ? json.data
            : [];

      const dataTime =
        json.updatedAtTaiwan ||
        (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : nowText());

      const normalized = list
        .map((raw) => normalizeStock(raw, dataTime))
        .filter((stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      if (normalized.length === 0) {
        throw new Error("API回傳空資料");
      }

      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock) => {
        const oldPrice = lastPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCache(false);

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
      setUsingCache(true);
      setError(err?.message || "資料更新失敗，已保留上次成功資料");
    } finally {
      setLoading(false);
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    if (settings.refreshSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setAutoSeconds((sec) => {
        if (sec <= 1) {
          loadStocks();
          return settings.refreshSeconds;
        }
        return sec - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [settings.refreshSeconds, lastPriceMap]);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  const industries = useMemo(() => getIndustryRanking(top50, settings), [top50, settings]);

  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)), [top50, settings]);
  const weakList = useMemo(() => top50.filter(isWeak), [top50]);

  const alertList = useMemo(
    () =>
      top50
        .filter((stock) => isAlert(stock, settings))
        .filter((stock) => stock.price <= settings.maxPrice)
        .filter((stock) => !isWeak(stock))
        .filter((stock) => !isHot(stock, settings)),
    [top50, settings]
  );

  const avoidList = useMemo(() => {
    return top50.filter((stock) => {
      if (isHot(stock, settings)) return true;
      if (isWeak(stock)) return true;
      if (!mainIndustries.includes(stock.industry)) return true;
      if (stock.price > settings.maxPrice) return true;
      return false;
    });
  }, [top50, mainIndustries, settings]);

  const breakoutList = useMemo(
    () =>
      top50
        .filter(isBreakout)
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => settings.mainMode === "積極" || mainIndustries.includes(stock.industry))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
        .slice(0, 30),
    [top50, mainIndustries, settings]
  );

  const mainBreakoutList = useMemo(
    () => breakoutList.filter((stock) => mainIndustries.includes(stock.industry)),
    [breakoutList, mainIndustries]
  );

  const otherBreakoutList = useMemo(
    () => breakoutList.filter((stock) => !mainIndustries.includes(stock.industry)),
    [breakoutList, mainIndustries]
  );

  const pullbackList = useMemo(
    () =>
      top50
        .filter((stock) => isPullback(stock, settings))
        .filter((stock) => settings.mainMode === "積極" || mainIndustries.includes(stock.industry))
        .sort((a, b) => pullbackDistance(a) - pullbackDistance(b))
        .slice(0, 30),
    [top50, mainIndustries, settings]
  );

  const tomorrowAutoList = useMemo(() => {
    let list = top50
      .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeak(stock));

    if (settings.mainMode === "保守") {
      list = list.filter((stock) => mainIndustries.includes(stock.industry));
    }

    if (settings.mainMode === "標準") {
      list = list.filter((stock) => mainIndustries.includes(stock.industry) || isBreakout(stock));
    }

    return list
      .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
      .slice(0, 20);
  }, [top50, mainIndustries, settings]);

  const todayMustWatch = useMemo(() => tomorrowAutoList.slice(0, 3), [tomorrowAutoList]);

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const tomorrowStocksManual = useMemo(
    () => tomorrowCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [tomorrowCodes, stocks]
  );

  const tomorrowCombined = useMemo(() => {
    const map = new Map<string, Stock>();
    [...tomorrowStocksManual, ...tomorrowAutoList].forEach((stock) => map.set(stock.code, stock));
    return Array.from(map.values());
  }, [tomorrowStocksManual, tomorrowAutoList]);

  const tomorrowPriority = useMemo(
    () => tomorrowCombined.filter((stock) => getTomorrowGroup(stock, mainIndustries, settings) === "優先觀察"),
    [tomorrowCombined, mainIndustries, settings]
  );

  const tomorrowPullback = useMemo(
    () => tomorrowCombined.filter((stock) => getTomorrowGroup(stock, mainIndustries, settings) === "等回測"),
    [tomorrowCombined, mainIndustries, settings]
  );

  const tomorrowNoChase = useMemo(
    () => tomorrowCombined.filter((stock) => getTomorrowGroup(stock, mainIndustries, settings) === "不追高"),
    [tomorrowCombined, mainIndustries, settings]
  );

  const signal = useMemo(() => getMarketSignal(top50, alertList, hotList), [top50, alertList, hotList]);

  const mainConcentration = useMemo(() => {
    const count = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    const percent = top50.length ? (count / top50.length) * 100 : 0;

    if (percent >= 45) return { label: "高", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-emerald-300" };
    if (percent >= 30) return { label: "中", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-yellow-300" };
    return { label: "低", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-red-300" };
  }, [top50, mainIndustries]);

  const todaySentence = useMemo(() => {
    const main = mainIndustries[0] || "主流產業";
    if (hotList.length >= 15) return `今日${main}偏強，但過熱股多，明天開高不要追。`;
    if (breakoutList.length >= 8) return `今日${main}最強，先看主流突破股，不追過熱股。`;
    return `今日先看${mainIndustries.slice(0, 3).join("、") || "主流產業"}，只挑未過熱高分股。`;
  }, [mainIndustries, hotList, breakoutList]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "快取";
    if (lastSuccessAt) return "正常";
    return "讀取中";
  }, [updating, error, usingCache, lastSuccessAt]);

  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.code === selectedCode) || null,
    [stocks, selectedCode]
  );

  const selectedRank = useMemo(() => {
    if (!selectedStock) return null;
    const index = top50.findIndex((stock) => stock.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, top50]);

  const sameIndustryStocks = useMemo(() => {
    if (!selectedStock) return [];
    return top50
      .filter((stock) => stock.industry === selectedStock.industry && stock.code !== selectedStock.code)
      .slice(0, 5);
  }, [selectedStock, top50]);

  function filterTop50(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topOnlyMain) arr = arr.filter((stock) => mainIndustries.includes(stock.industry));
      if (settings.topOnlyLowPrice) arr = arr.filter((stock) => stock.price <= settings.maxPrice);
      if (settings.topOnlyBreakout) arr = arr.filter(isBreakout);
      if (settings.topExcludeHot) arr = arr.filter((stock) => !isHot(stock, settings));
    }

    return arr;
  }

  function sortList(list: Stock[]) {
    let arr = filterTop50(list);

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);

    return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return sortList(top50);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "breakout") return sortList(breakoutList);
      if (moreView === "pullback") return sortList(pullbackList);
      if (moreView === "alert") return sortList(alertList);
      if (moreView === "avoid") return sortList(avoidList);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    breakoutList,
    pullbackList,
    alertList,
    avoidList,
    searchText,
    sortKey,
    mainIndustries,
    settings,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  function openLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addTomorrowAutoTop() {
    const codes = tomorrowAutoList.map((stock) => stock.code);
    saveTomorrow([...tomorrowCodes, ...codes]);
    setTab("tomorrow");
  }

  function addTodayMustWatch() {
    const codes = todayMustWatch.map((stock) => stock.code);
    saveTomorrow([...tomorrowCodes, ...codes]);
    setTab("tomorrow");
  }

  function organizeTomorrow() {
    const keep = tomorrowCombined
      .filter((stock) => !isHot(stock, settings))
      .map((stock) => stock.code);

    saveTomorrow(keep);
  }

  function clearHotTomorrow() {
    const hotCodes = new Set(tomorrowCombined.filter((stock) => isHot(stock, settings)).map((stock) => stock.code));
    saveTomorrow(tomorrowCodes.filter((code) => !hotCodes.has(code)));
  }

  function clearTomorrow() {
    saveTomorrow([]);
  }

  function saveSettings(next: Settings) {
    setSettings(next);
    setAutoSeconds(next.refreshSeconds);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function saveFavorites(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function saveTomorrow(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 50);
    setTomorrowCodes(clean);
    localStorage.setItem(TOMORROW_KEY, JSON.stringify(clean));
  }

  function addFavorite(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    saveFavorites([...favoriteCodes, clean]);
  }

  function removeFavorite(code: string) {
    saveFavorites(favoriteCodes.filter((item) => item !== code));
  }

  function addTomorrow(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    saveTomorrow([...tomorrowCodes, clean]);
  }

  function removeTomorrow(code: string) {
    saveTomorrow(tomorrowCodes.filter((item) => item !== code));
  }

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    tomorrowCodes,
    priceDirections,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddTomorrow: addTomorrow,
    onRemoveTomorrow: removeTomorrow,
  };

  if (selectedStock) {
    const links = getKLinks(selectedStock.code, selectedStock.name);
    const score = scoreStock(selectedStock, mainIndustries, settings);
    const direction = priceDirections[selectedStock.code];
    const isFavorite = favoriteCodes.includes(selectedStock.code);
    const isTomorrow = tomorrowCodes.includes(selectedStock.code);
    const isMainLine =
      mainIndustries.includes(selectedStock.industry) &&
      selectedRank !== null &&
      !isHot(selectedStock, settings) &&
      !isWeak(selectedStock);

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
          <button
            onClick={() => setSelectedCode("")}
            className="mb-4 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200"
          >
            ← 返回上一頁
          </button>

          <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-400">
                  {selectedStock.code}｜{selectedStock.industry}
                </div>
                <h1 className="mt-1 text-3xl font-black">{selectedStock.name}</h1>
                <div className="mt-2 text-sm font-bold text-slate-300">
                  50強排名：{selectedRank ? `第 ${selectedRank} 名` : "不在50強"}
                </div>
              </div>

              <div className={`text-right text-3xl font-black ${selectedStock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPercent(selectedStock.changePercent)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl p-4 ${isMainLine ? "bg-emerald-950/40" : "bg-red-950/30"}`}>
              <div className="text-xs font-bold text-slate-400">是否符合主線</div>
              <div className={`mt-1 text-2xl font-black ${isMainLine ? "text-emerald-300" : "text-red-300"}`}>
                {isMainLine ? "符合主線" : "不符合主線"}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {getPickReasons(selectedStock, mainIndustries, settings)}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">主線判斷</div>
              <div className="mt-1 text-2xl font-black text-yellow-200">
                {getConclusion(selectedStock, mainIndustries, settings)}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                分數 {score}｜狀態 {getStatus(selectedStock, mainIndustries, settings)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <DetailRow label="目前股價" value={formatNumber(selectedStock.price)} />
              <DetailRow label="股價方向" value={getDirectionText(direction)} />
              <DetailRow label="開盤價" value={formatNumber(selectedStock.openPrice)} />
              <DetailRow label="昨收價" value={formatNumber(selectedStock.previousClose)} />
              <DetailRow label="成交量" value={formatNumber(selectedStock.volume)} />
              <DetailRow label="產業" value={selectedStock.industry} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-cyan-500/50 bg-cyan-950/20 p-5">
            <h2 className="text-xl font-black">主線分數拆解</h2>

            <div className="mt-3 space-y-2 text-sm font-bold">
              {[
                ["主流產業", mainIndustries.includes(selectedStock.industry) ? "+30" : "0"],
                [`股價${settings.maxPrice}內`, selectedStock.price <= settings.maxPrice ? "+25" : "0"],
                ["漲幅3%～7.5%", selectedStock.changePercent >= 3 && selectedStock.changePercent <= 7.5 ? "+20" : "0"],
                ["突破開盤", selectedStock.price >= selectedStock.openPrice ? "+15" : "0"],
                ["剛突破", isBreakout(selectedStock) ? "+10" : "0"],
                ["回測加分", isPullback(selectedStock, settings) ? "+8" : "0"],
                ["過熱扣分", isHot(selectedStock, settings) ? "-35" : "0"],
                ["轉弱扣分", isWeak(selectedStock) ? "-25" : "0"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between rounded-2xl bg-black/30 p-3">
                  <span className="text-slate-300">{label}</span>
                  <span className={String(value).startsWith("-") ? "text-red-300" : "text-emerald-300"}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-yellow-500/50 bg-yellow-950/20 p-5">
            <h2 className="text-xl font-black">明天劇本</h2>

            <div className="mt-3 space-y-2 text-sm font-black text-yellow-100">
              <div className="rounded-2xl bg-black/30 p-3">1. 開高太多不追，等回測開盤價。</div>
              <div className="rounded-2xl bg-black/30 p-3">2. 回測開盤價守住，可列觀察。</div>
              <div className="rounded-2xl bg-black/30 p-3">3. 跌破開盤價，先移出觀察。</div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
            <h2 className="text-xl font-black">K線入口</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => openLink(links.yahoo)} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">Yahoo K線</button>
              <button onClick={() => openLink(links.tradingView)} className="rounded-2xl bg-blue-500/20 py-3 text-sm font-black text-blue-200">TradingView</button>
              <button onClick={() => openLink(links.goodinfo)} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">Goodinfo</button>
              <button onClick={() => openLink(links.google)} className="rounded-2xl bg-slate-700 py-3 text-sm font-black text-slate-200">Google搜尋</button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">一鍵加入</h2>

            {isTomorrow && (
              <div className="mb-3 rounded-2xl bg-cyan-950/40 p-3 text-sm font-black text-cyan-100">
                加入理由：{getPickReasons(selectedStock, mainIndustries, settings)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => (isTomorrow ? removeTomorrow(selectedStock.code) : addTomorrow(selectedStock.code))}
                className={`rounded-2xl py-3 text-sm font-black ${
                  isTomorrow ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
                }`}
              >
                {isTomorrow ? "📌 移除明日觀察" : "📌 加入明日觀察"}
              </button>

              <button
                onClick={() => (isFavorite ? removeFavorite(selectedStock.code) : addFavorite(selectedStock.code))}
                className={`rounded-2xl py-3 text-sm font-black ${
                  isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
                }`}
              >
                {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-indigo-500/50 bg-indigo-950/20 p-5">
            <h2 className="text-xl font-black">同產業強勢股</h2>

            <div className="mt-3 space-y-2 text-sm font-bold text-indigo-100">
              {sameIndustryStocks.length === 0 && <div>目前沒有同產業資料。</div>}

              {sameIndustryStocks.map((stock, index) => (
                <button
                  key={stock.code}
                  onClick={() => setSelectedCode(stock.code)}
                  className="w-full rounded-2xl bg-black/30 p-3 text-left"
                >
                  {index + 1}. {stock.code} {stock.name}｜{formatPercent(stock.changePercent)}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股主線優化新增版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">主流產業雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                50強 → 主流產業 → 今日必看 → 明日觀察。
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">資料狀態：{dataStatus}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜倒數：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}s`}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              詳情
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="盤勢燈號" value={signal.title} sub={signal.text} tone={signal.tone} onClick={() => setTab("top50")} />
          <MiniCard title="主流集中度" value={mainConcentration.label} sub={mainConcentration.text} tone={mainConcentration.tone} onClick={() => goMore("industry")} />
          <MiniCard title="今日主流" value={mainIndustries[0] || "--"} sub={mainIndustries.slice(0, 3).join("、") || "尚無資料"} tone="text-cyan-300" onClick={() => goMore("industry")} />
          <MiniCard title="今日必看" value={todayMustWatch.length} sub="精選3檔" tone="text-yellow-300" onClick={() => setTab("home")} />
          <MiniCard title="明日觀察" value={tomorrowCombined.length} sub="自動 + 手動" tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <MiniCard title="不要追" value={avoidList.length} sub="過熱 / 轉弱 / 非主流" tone="text-red-300" onClick={() => goMore("avoid")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="text-xl font-black">今日操作順序</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black text-slate-200">
            <div className="rounded-2xl bg-black/30 p-3">1. 先看主流產業</div>
            <div className="rounded-2xl bg-black/30 p-3">2. 看今日必看3檔</div>
            <div className="rounded-2xl bg-black/30 p-3">3. 看突破 / 回測</div>
            <div className="rounded-2xl bg-black/30 p-3">4. 加入明日觀察</div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="50強" sub="今日漲幅排行" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="產業熱度" sub="檔數 + 平均漲幅 + 突破" badge={industries.length} tone="text-cyan-300" onClick={() => goMore("industry")} />
          <ActionCard title="低價警報" sub={`${settings.maxPrice}元內未過熱`} badge={alertList.length} tone="text-orange-300" onClick={() => goMore("alert")} />
          <ActionCard title="回測觀察" sub="接近開盤價±1.5%" badge={pullbackList.length} tone="text-lime-300" onClick={() => goMore("pullback")} />
          <ActionCard title="突破股" sub="主流突破優先" badge={breakoutList.length} tone="text-orange-300" onClick={() => goMore("breakout")} />
          <ActionCard title="自選股" sub="個人追蹤" badge={favoriteStocks.length} tone="text-yellow-300" onClick={() => setTab("favorite")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">點股票卡片可看個股詳情與K線。</p>
            </div>

            <button onClick={() => setShowFilters(!showFilters)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">
              篩選
            </button>
          </div>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號或名稱，例如 2330"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["score", "分數"],
                  ["change", "漲幅"],
                  ["price", "低價"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key as any)}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      sortKey === key ? "bg-indigo-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "top50" && (
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => saveSettings({ ...settings, topOnlyMain: !settings.topOnlyMain })}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      settings.topOnlyMain ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    主流
                  </button>
                  <button
                    onClick={() => saveSettings({ ...settings, topOnlyLowPrice: !settings.topOnlyLowPrice })}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      settings.topOnlyLowPrice ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {settings.maxPrice}內
                  </button>
                  <button
                    onClick={() => saveSettings({ ...settings, topOnlyBreakout: !settings.topOnlyBreakout })}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      settings.topOnlyBreakout ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    突破
                  </button>
                  <button
                    onClick={() => saveSettings({ ...settings, topExcludeHot: !settings.topExcludeHot })}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      settings.topExcludeHot ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    未過熱
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="產業熱度" sub="前三大產業展開" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="突破股" sub="主流 / 非主流" badge={breakoutList.length} tone="text-orange-300" onClick={() => setMoreView("breakout")} />
              <ActionCard title="回測觀察" sub="接近開盤價" badge={pullbackList.length} tone="text-lime-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="低價警報" sub="低價強勢警報" badge={alertList.length} tone="text-orange-300" onClick={() => setMoreView("alert")} />
              <ActionCard title="不要碰" sub="附原因與再觀察條件" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoid")} />
              <ActionCard title="設定" sub="主線模式" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="資料狀態" sub="API與快取" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
              <ActionCard title="加入今日必看" sub="3檔加入觀察" badge="📌" tone="text-cyan-300" onClick={addTodayMustWatch} />
              <ActionCard title="一鍵整理" sub="加入明日觀察" badge="📌" tone="text-cyan-300" onClick={addTomorrowAutoTop} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "今日重點"}
              {tab === "top50" && "📊 今日50強"}
              {tab === "tomorrow" && "📌 明日觀察"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "breakout" && "🚀 突破股"}
              {tab === "more" && moreView === "pullback" && "↩️ 回測觀察"}
              {tab === "more" && moreView === "alert" && "🚨 低價強勢警報"}
              {tab === "more" && moreView === "avoid" && "🚫 不要碰"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料狀態"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              今日一句話：{todaySentence}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
                <h3 className="text-xl font-black">今日主流結論</h3>
                <div className="mt-2 text-sm font-bold leading-6 text-cyan-100">
                  今日主流集中在：{mainIndustries.slice(0, 3).join("、") || "尚無資料"}。  
                  主流集中度：{mainConcentration.label}，{mainConcentration.text}。
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">今日必看 3 檔</h3>

                <div className="mt-3 space-y-3">
                  {todayMustWatch.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                  ))}

                  {todayMustWatch.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-sm font-bold text-slate-400">
                      目前沒有符合條件的今日必看股票。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">今日風險提醒</h3>
                <div className="mt-2 text-sm font-bold text-red-100">
                  過熱股 {hotList.length} 檔，轉弱股 {weakList.length} 檔。明天開高不要追，優先等回測開盤價。
                </div>
              </section>
            </div>
          )}

          {tab === "top50" && (
            <div className="mb-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
              <h3 className="text-xl font-black">50強產業小統計</h3>
              <div className="mt-2 text-sm font-bold text-cyan-100">
                {industries.slice(0, 3).map((item) => `${item.industry} ${item.count}檔`).join("｜") || "尚無資料"}
              </div>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">明日觀察整理</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  優先 {tomorrowPriority.length}｜等回測 {tomorrowPullback.length}｜不追高 {tomorrowNoChase.length}
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-yellow-100">
                  明天開盤提醒：開高不追｜回測開盤可觀察｜跌破開盤先移除
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={organizeTomorrow} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                    一鍵整理
                  </button>
                  <button onClick={clearHotTomorrow} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                    清除過熱
                  </button>
                  <button onClick={addTodayMustWatch} className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
                    加入今日必看
                  </button>
                  <button onClick={clearTomorrow} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                    一鍵清空
                  </button>
                </div>
              </section>

              {[
                ["優先觀察", tomorrowPriority],
                ["等回測", tomorrowPullback],
                ["不追高", tomorrowNoChase],
              ].map(([title, list]: any) => (
                <section key={title}>
                  <h3 className="mb-2 text-xl font-black">{title}</h3>
                  <div className="space-y-3">
                    {list.length === 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                        目前沒有股票
                      </div>
                    )}
                    {list.map((stock: Stock, index: number) => (
                      <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              <button
                onClick={() => saveSettings({ ...settings, industryTopOnly: !settings.industryTopOnly })}
                className={`w-full rounded-2xl py-3 text-sm font-black ${
                  settings.industryTopOnly ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-200"
                }`}
              >
                只看前三大產業：{settings.industryTopOnly ? "開" : "關"}
              </button>

              {(settings.industryTopOnly ? industries.slice(0, 3) : industries.slice(0, 12)).map((item, index) => (
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
                      <div className="text-xs font-black text-cyan-300">
                        突破 {item.breakoutCount}｜過熱 {item.hotCount}｜轉弱 {item.weakCount}
                      </div>
                      <div className="text-xs font-black text-yellow-300">
                        強度 {item.score.toFixed(0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm font-bold text-slate-400">
                    {item.stocks.slice(0, 8).map((stock, i) => (
                      <button key={stock.code} onClick={() => setSelectedCode(stock.code)} className="block w-full text-left">
                        {i + 1}. {stock.code} {stock.name} {formatPercent(stock.changePercent)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "breakout" && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xl font-black">主流突破</h3>
                <div className="space-y-3">
                  {mainBreakoutList.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                      目前沒有主流突破
                    </div>
                  )}
                  {mainBreakoutList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xl font-black">非主流突破</h3>
                <div className="space-y-3">
                  {otherBreakoutList.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                      目前沒有非主流突破
                    </div>
                  )}
                  {otherBreakoutList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">主線模式</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["保守", "標準", "積極"] as MainMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => saveSettings({ ...settings, mainMode: mode })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.mainMode === mode ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs font-bold text-slate-400">
                  保守：只看主流 + 低價 + 未過熱｜標準：主流優先｜積極：突破股優先
                </div>
              </div>

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
                <div className="mb-2 text-lg font-black">過熱漲幅</div>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 8, 9].map((p) => (
                    <button
                      key={p}
                      onClick={() => saveSettings({ ...settings, hotPercent: p })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.hotPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">自動更新</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    [15, "15秒"],
                    [30, "30秒"],
                    [60, "60秒"],
                    [0, "手動"],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value) })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.refreshSeconds === Number(value) ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {label}
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

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料狀態：{dataStatus}</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>API資料時間：{apiDataTime || "讀取中"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>自動更新頻率：{settings.refreshSeconds === 0 ? "手動" : `${settings.refreshSeconds}秒`}</div>
                <div>自動更新倒數：{settings.refreshSeconds === 0 ? "--" : `${autoSeconds}s`}</div>
              </div>

              {(usingCache || error) && (
                <div className="mt-3 rounded-2xl border border-yellow-500 bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
                  ⚠️ {error || "目前可能使用上次成功資料"}
                </div>
              )}

              <button onClick={loadStocks} className="mt-4 w-full rounded-2xl bg-blue-500/20 py-3 text-lg font-black text-blue-200">
                重新讀取資料
              </button>
            </div>
          )}

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["industry", "settings", "data", "menu", "breakout"].includes(moreView)) && (
              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                    目前沒有符合條件的股票。
                  </div>
                )}

                {currentList.map((stock, index) => (
                  <div key={`${stock.code}-${index}`}>
                    <StockCard
                      stock={stock}
                      rank={index + 1}
                      showReason={tab === "more" && (moreView === "alert" || moreView === "pullback")}
                      {...cardProps}
                    />

                    {tab === "more" && moreView === "pullback" && (
                      <div className="mt-1 rounded-2xl bg-lime-950/40 p-3 text-xs font-black text-lime-100">
                        回測接近度：距離開盤價 {pullbackDistance(stock).toFixed(2)}%
                      </div>
                    )}

                    {tab === "more" && moreView === "alert" && (
                      <div className="mt-1 rounded-2xl bg-orange-950/40 p-3 text-xs font-black text-orange-100">
                        警報原因：{getPickReasons(stock, mainIndustries, settings)}
                      </div>
                    )}

                    {tab === "more" && moreView === "avoid" && (
                      <div className="mt-1 rounded-2xl bg-red-950/40 p-3 text-xs font-black text-red-100">
                        原因：{getAvoidReason(stock, mainIndustries, settings)}
                        <br />
                        可重新觀察：{getRewatchCondition(stock, mainIndustries, settings)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "首頁"],
            ["top50", "🔥", "50強"],
            ["tomorrow", "📌", "觀察"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setTab(key as TabKey);
              }}
              className={`rounded-2xl py-2 text-xs font-black ${
                tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"
              }`}
            >
              <div className="text-xl">{icon}</div>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}