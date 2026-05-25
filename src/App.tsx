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

type TabKey = "home" | "top" | "observe" | "favorite" | "more";

type MoreView =
  | "menu"
  | "today"
  | "alerts"
  | "industry"
  | "avoid"
  | "pullback"
  | "breakout"
  | "open910"
  | "stats"
  | "settings"
  | "data"
  | "buyRadar"
  | "sellRadar";

type PriceDirection = "up" | "down" | "same" | "new";
type ObserveGroup = "明天優先" | "等回測" | "不追高";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  excludeHot: boolean;
  refreshSeconds: number;
  favoriteOnlyActive: boolean;
  pullbackRangePercent: number;
  stopLossPercent: number;
  hotPercent: number;
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
const OBSERVE_KEY = "taiwan-stock-radar-observe";
const SETTINGS_KEY = "taiwan-stock-radar-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-last-success";
const NOTE_KEY = "taiwan-stock-radar-notes";
const GROUP_KEY = "taiwan-stock-radar-groups";
const RANK_KEY = "taiwan-stock-radar-ranks";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  excludeHot: true,
  refreshSeconds: 30,
  favoriteOnlyActive: false,
  pullbackRangePercent: 1.5,
  stopLossPercent: 1,
  hotPercent: 8,
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
  "3008": "光學", "3017": "電子零組件", "3034": "半導體",
  "3035": "半導體", "3037": "電子零組件", "3042": "光電",
  "3231": "電子代工", "3406": "光學", "3443": "半導體",
  "3481": "面板", "3711": "半導體", "3714": "半導體",
  "4966": "半導體", "6415": "半導體", "6669": "電子代工",
};

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

function safeParse<T>(text: string | null, fallback: T): T {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
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

function getTaiwanNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

function getMarketStatus() {
  const now = getTaiwanNow();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  if (day === 0 || day === 6) return "休市";
  if (mins < 9 * 60) return "開盤前";
  if (mins <= 9 * 60 + 20) return "9:10觀察";
  if (mins < 13 * 60 + 30) return "盤中";
  return "收盤後";
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
  const nearOpen = Math.abs(stock.price - stock.openPrice) / stock.openPrice <= settings.pullbackRangePercent / 100;
  return stock.changePercent >= 2 && nearOpen && !isHot(stock, settings);
}

function isAlert(stock: Stock, settings: Settings) {
  if (stock.price <= 0 || stock.price > settings.maxPrice) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;

  return stock.changePercent >= settings.alertPercent || (stock.openPremiumPercent ?? 0) >= 3;
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
      avg:
        item.stocks.reduce((sum, stock) => sum + stock.changePercent, 0) /
        Math.max(item.stocks.length, 1),
    }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);
}

function getScoreParts(stock: Stock, mainIndustries: string[], settings: Settings) {
  return [
    { label: `股價${settings.maxPrice}元內`, value: stock.price > 0 && stock.price <= settings.maxPrice ? 25 : -50 },
    { label: "主流產業", value: mainIndustries.includes(stock.industry) ? 25 : 0 },
    { label: "漲幅3%～7.5%", value: stock.changePercent >= 3 && stock.changePercent <= 7.5 ? 20 : 0 },
    { label: "強於開盤", value: stock.price >= stock.openPrice ? 15 : 0 },
    { label: "開盤溢價合理", value: (stock.openPremiumPercent ?? 0) >= 0 && (stock.openPremiumPercent ?? 0) <= 4 ? 10 : 0 },
    { label: "過熱扣分", value: isHot(stock, settings) ? -30 : 0 },
    { label: "轉弱扣分", value: isWeak(stock) ? -20 : 0 },
  ];
}

function scoreStock(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = getScoreParts(stock, mainIndustries, settings).reduce((sum, item) => sum + item.value, 0);
  return Math.max(0, score);
}

function getStatus(stock: Stock, settings: Settings) {
  if (isHot(stock, settings)) return "過熱";
  if (isWeak(stock)) return "轉弱";
  if (isAlert(stock, settings)) return "警報";
  if (isBreakout(stock)) return "突破";
  if (isPullback(stock, settings)) return "回測";
  return "觀察";
}

function getEntryType(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "過熱型";
  if (isWeak(stock)) return "轉弱型";
  if (isPullback(stock, settings)) return "回測型";
  if (isBreakout(stock)) return "突破型";
  if (mainIndustries.includes(stock.industry) && stock.changePercent >= 2) return "轉強型";
  return "普通型";
}

function getBuyLabel(stock: Stock, mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock)) return "暫不進場";
  if (isPullback(stock, settings)) return "回測買點";
  if (isBreakout(stock)) return "突破買點";
  if (mainIndustries.includes(stock.industry) && stock.price >= stock.openPrice && stock.changePercent >= 2) return "轉強買點";
  return "等待買點";
}

function getBuySuggestion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const label = getBuyLabel(stock, mainIndustries, settings);

  if (label === "不追高") return "漲幅偏大，不追高，等回測。";
  if (label === "暫不進場") return "轉弱或跌破開盤，先不進場。";
  if (label === "回測買點") return "可觀察開盤價附近是否守住。";
  if (label === "突破買點") return "突破後可觀察是否續強，不要追過熱。";
  if (label === "轉強買點") return "站上開盤且主流產業，可列入觀察。";
  return "尚未到好買點，等待更明確訊號。";
}

function getSellSuggestion(stock: Stock, settings: Settings) {
  const stopLossByOpen = stock.openPrice * (1 - settings.stopLossPercent / 100);
  const stopLossByPrev = stock.previousClose * (1 - settings.stopLossPercent / 100);

  if (stock.price < stopLossByOpen) return "跌破開盤停損區，賣點提醒。";
  if (stock.price < stopLossByPrev) return "跌破昨收停損區，偏弱。";
  if (stock.changePercent < 2) return "漲幅縮小到2%以下，移出觀察。";
  if (isHot(stock, settings)) return "已接近過熱，分批停利或不追。";
  return "未跌破主要賣點，可續看。";
}

function getConclusion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = scoreStock(stock, mainIndustries, settings);
  const buyLabel = getBuyLabel(stock, mainIndustries, settings);

  if (buyLabel === "不追高") return "不追高";
  if (buyLabel === "暫不進場") return "轉弱小心";
  if (buyLabel === "回測買點") return "等回測";
  if (score >= 80) return "可觀察";
  if (score >= 60) return "小心觀察";
  return "暫不追";
}

function getSignal(top50: Stock[], alerts: Stock[], hotList: Stock[]) {
  const strongCount = top50.filter((s) => s.changePercent >= 3).length;

  if (hotList.length >= 15) {
    return { title: "🔴 紅燈", text: "過熱股偏多，先不要追高。", tone: "text-red-300" };
  }

  if (strongCount >= 20 && alerts.length >= 8) {
    return { title: "🟢 綠燈", text: "盤面偏強，先看主流與高分股。", tone: "text-emerald-300" };
  }

  return { title: "🟡 黃燈", text: "盤勢普通，只看高分股。", tone: "text-yellow-300" };
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
  settings,
  mainIndustries,
  favoriteCodes,
  observeCodes,
  previousRanks,
  priceDirections,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddObserve,
  onRemoveObserve,
}: {
  stock: Stock;
  rank: number;
  settings: Settings;
  mainIndustries: string[];
  favoriteCodes: string[];
  observeCodes: string[];
  previousRanks: Record<string, number>;
  priceDirections: Record<string, PriceDirection>;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddObserve: (code: string) => void;
  onRemoveObserve: (code: string) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isObserve = observeCodes.includes(stock.code);
  const score = scoreStock(stock, mainIndustries, settings);
  const direction = priceDirections[stock.code];
  const oldRank = previousRanks[stock.code];
  const rankText = !oldRank ? "新進" : oldRank > rank ? `↑${oldRank - rank}` : oldRank < rank ? `↓${rank - oldRank}` : "持平";
  const buyLabel = getBuyLabel(stock, mainIndustries, settings);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-400">
              #{rank}　{stock.code}　<span className="text-cyan-300">{rankText}</span>
            </div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">{stock.industry}</div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full bg-slate-800 px-3 py-1">{getStatus(stock, settings)}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{buyLabel}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">分數 {score}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${getDirectionTone(direction)}`}>
            {getDirectionText(direction)}
          </span>
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
          {isObserve && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">觀察</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          買點：{buyLabel}｜賣點：{getSellSuggestion(stock, settings)}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>

        <button
          onClick={() => (isObserve ? onRemoveObserve(stock.code) : onAddObserve(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isObserve ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isObserve ? "📌 移除觀察" : "📌 加入觀察"}
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
  const [observeCodes, setObserveCodes] = useState<string[]>([]);
  const [groups, setGroups] = useState<Record<string, ObserveGroup>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});

  const [selectedCode, setSelectedCode] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<"score" | "change" | "price">("score");

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
    setObserveCodes(safeParse(localStorage.getItem(OBSERVE_KEY), []));
    setNotes(safeParse(localStorage.getItem(NOTE_KEY), {}));
    setGroups(safeParse(localStorage.getItem(GROUP_KEY), {}));
    setPreviousRanks(safeParse(localStorage.getItem(RANK_KEY), {}));

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

  async function loadStocks() {
    try {
      setUpdating(true);
      setError("");
      setLastAttemptAt(nowText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });

      if (!response.ok) throw new Error(`API錯誤：${response.status}`);

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

      if (normalized.length === 0) throw new Error("API回傳空資料");

      if (stocks.length > 0) {
        const nextRanks: Record<string, number> = {};
        stocks.slice(0, 50).forEach((stock, index) => {
          nextRanks[stock.code] = index + 1;
        });
        setPreviousRanks(nextRanks);
        localStorage.setItem(RANK_KEY, JSON.stringify(nextRanks));
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
  }, [settings.refreshSeconds, lastPriceMap, stocks]);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const alerts = useMemo(() => top50.filter((stock) => isAlert(stock, settings)), [top50, settings]);
  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)), [top50, settings]);
  const weakList = useMemo(() => top50.filter(isWeak), [top50]);
  const avoidList = useMemo(() => Array.from(new Map([...hotList, ...weakList].map((s) => [s.code, s])).values()), [hotList, weakList]);

  const pullbackList = useMemo(() => top50.filter((stock) => isPullback(stock, settings)).slice(0, 20), [top50, settings]);

  const breakoutList = useMemo(
    () =>
      top50
        .filter(isBreakout)
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
        .slice(0, 20),
    [top50, mainIndustries, settings]
  );

  const open910List = useMemo(
    () =>
      top50
        .filter((stock) => stock.changePercent >= 2)
        .filter((stock) => stock.price >= stock.openPrice)
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => !isHot(stock, settings))
        .slice(0, 15),
    [top50, mainIndustries, settings]
  );

  const top10 = useMemo(
    () =>
      top50
        .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => !isWeak(stock))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
        .slice(0, 10),
    [top50, mainIndustries, settings]
  );

  const mustWatch3 = useMemo(() => top10.slice(0, 3), [top10]);

  const canEntryList = useMemo(
    () =>
      top10.filter((stock) =>
        ["突破買點", "轉強買點"].includes(getBuyLabel(stock, mainIndustries, settings))
      ),
    [top10, mainIndustries, settings]
  );

  const waitPullbackTopList = useMemo(
    () =>
      top10.filter((stock) =>
        getBuyLabel(stock, mainIndustries, settings) === "回測買點" ||
        getBuyLabel(stock, mainIndustries, settings) === "等待買點"
      ),
    [top10, mainIndustries, settings]
  );

  const noChaseTopList = useMemo(
    () => top50.filter((stock) => getBuyLabel(stock, mainIndustries, settings) === "不追高").slice(0, 10),
    [top50, mainIndustries, settings]
  );

  const realTime200Alerts = useMemo(
    () =>
      top50
        .filter((stock) => stock.price > 0 && stock.price <= 200)
        .filter((stock) => isAlert(stock, settings))
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => !isWeak(stock))
        .slice(0, 30),
    [top50, settings]
  );

  const buyRadarList = useMemo(
    () =>
      top50
        .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => !isWeak(stock))
        .filter((stock) =>
          ["突破買點", "回測買點", "轉強買點"].includes(getBuyLabel(stock, mainIndustries, settings))
        )
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
        .slice(0, 30),
    [top50, mainIndustries, settings]
  );

  const sellRadarList = useMemo(
    () =>
      top50
        .filter((stock) => isWeak(stock) || stock.price < stock.openPrice || stock.price < stock.previousClose || isHot(stock, settings))
        .slice(0, 30),
    [top50, settings]
  );

  const observeStocks = useMemo(
    () => observeCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [observeCodes, stocks]
  );

  const favoriteStocksRaw = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const observeAlerts = useMemo(
    () => observeStocks.filter((stock) => isAlert(stock, settings) || isWeak(stock) || isHot(stock, settings)),
    [observeStocks, settings]
  );

  const observeBuyAlerts = useMemo(
    () =>
      observeStocks.filter((stock) =>
        ["突破買點", "回測買點", "轉強買點"].includes(getBuyLabel(stock, mainIndustries, settings))
      ),
    [observeStocks, mainIndustries, settings]
  );

  const observeSellAlerts = useMemo(
    () => observeStocks.filter((stock) => isWeak(stock) || stock.price < stock.openPrice || stock.price < stock.previousClose),
    [observeStocks]
  );

  const favoriteAlerts = useMemo(
    () => favoriteStocksRaw.filter((stock) => isAlert(stock, settings) || isWeak(stock) || stock.changePercent >= 3),
    [favoriteStocksRaw, settings]
  );

  const favoriteStocks = useMemo(() => {
    if (!settings.favoriteOnlyActive) return favoriteStocksRaw;
    return favoriteStocksRaw.filter(
      (stock) =>
        isAlert(stock, settings) ||
        isWeak(stock) ||
        stock.changePercent >= 3 ||
        ["突破買點", "回測買點", "轉強買點"].includes(getBuyLabel(stock, mainIndustries, settings))
    );
  }, [favoriteStocksRaw, settings, mainIndustries]);

  const signal = useMemo(() => getSignal(top50, alerts, hotList), [top50, alerts, hotList]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "快取";
    if (lastSuccessAt) return "正常";
    return "讀取中";
  }, [updating, error, usingCache, lastSuccessAt]);

  const apiHealth = useMemo(() => {
    if (updating) return "API更新中";
    if (error) return "API失敗";
    if (usingCache) return "使用快取";
    if (lastSuccessAt) return "API正常";
    return "尚未成功";
  }, [updating, error, usingCache, lastSuccessAt]);

  const selectedStock = useMemo(() => stocks.find((stock) => stock.code === selectedCode) || null, [stocks, selectedCode]);

  const selectedRank = useMemo(() => {
    if (!selectedStock) return null;
    const index = top50.findIndex((stock) => stock.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, top50]);

  const selectedIndustryRank = useMemo(() => {
    if (!selectedStock) return null;
    const sameIndustry = top50.filter((s) => s.industry === selectedStock.industry);
    const index = sameIndustry.findIndex((s) => s.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, top50]);

  const sameIndustryTop3 = useMemo(() => {
    if (!selectedStock) return [];
    return top50
      .filter((stock) => stock.industry === selectedStock.industry && stock.code !== selectedStock.code)
      .slice(0, 3);
  }, [selectedStock, top50]);

  function sortList(list: Stock[]) {
    let arr = [...list];

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);

    return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  }

  const currentList = useMemo(() => {
    if (tab === "observe") return sortList(observeStocks);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "today") return sortList(top50);
      if (moreView === "alerts") return sortList(realTime200Alerts);
      if (moreView === "avoid") return sortList(avoidList);
      if (moreView === "pullback") return sortList(pullbackList);
      if (moreView === "breakout") return sortList(breakoutList);
      if (moreView === "open910") return sortList(open910List);
      if (moreView === "buyRadar") return sortList(buyRadarList);
      if (moreView === "sellRadar") return sortList(sellRadarList);
    }

    return [];
  }, [
    tab,
    moreView,
    observeStocks,
    favoriteStocks,
    top50,
    realTime200Alerts,
    avoidList,
    pullbackList,
    breakoutList,
    open910List,
    buyRadarList,
    sellRadarList,
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

  function addFavorite(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    const next = Array.from(new Set([...favoriteCodes, clean]));
    setFavoriteCodes(next);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
  }

  function removeFavorite(code: string) {
    const next = favoriteCodes.filter((item) => item !== code);
    setFavoriteCodes(next);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
  }

  function addObserve(code: string) {
    const clean = cleanCode(code);
    if (!clean) return;
    const next = Array.from(new Set([...observeCodes, clean])).slice(0, 30);
    setObserveCodes(next);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(next));
  }

  function removeObserve(code: string) {
    const next = observeCodes.filter((item) => item !== code);
    setObserveCodes(next);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(next));
  }

  function setObserveGroup(code: string, group: ObserveGroup) {
    addObserve(code);
    const next = { ...groups, [code]: group };
    setGroups(next);
    localStorage.setItem(GROUP_KEY, JSON.stringify(next));
  }

  function organizeObserve() {
    const keep: string[] = [];
    const nextGroups = { ...groups };

    observeStocks.forEach((stock) => {
      if (isWeak(stock)) return;

      keep.push(stock.code);

      if (isHot(stock, settings)) nextGroups[stock.code] = "不追高";
      else if (isPullback(stock, settings)) nextGroups[stock.code] = "等回測";
      else if (scoreStock(stock, mainIndustries, settings) >= 80) nextGroups[stock.code] = "明天優先";
    });

    setObserveCodes(keep);
    setGroups(nextGroups);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(keep));
    localStorage.setItem(GROUP_KEY, JSON.stringify(nextGroups));
  }

  function removeWeakObserve() {
    const weakCodes = new Set(observeStocks.filter(isWeak).map((s) => s.code));
    const next = observeCodes.filter((code) => !weakCodes.has(code));
    setObserveCodes(next);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(next));
  }

  function addActiveFavoritesToObserve() {
    const codes = favoriteStocksRaw
      .filter((stock) => isAlert(stock, settings) || stock.changePercent >= 3)
      .map((stock) => stock.code);

    const next = Array.from(new Set([...observeCodes, ...codes])).slice(0, 30);
    setObserveCodes(next);
    localStorage.setItem(OBSERVE_KEY, JSON.stringify(next));
    setTab("observe");
  }

  const cardProps = {
    settings,
    mainIndustries,
    favoriteCodes,
    observeCodes,
    previousRanks,
    priceDirections,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddObserve: addObserve,
    onRemoveObserve: removeObserve,
  };

  if (selectedStock) {
    const score = scoreStock(selectedStock, mainIndustries, settings);
    const direction = priceDirections[selectedStock.code];
    const links = getKLinks(selectedStock.code, selectedStock.name);
    const isFavorite = favoriteCodes.includes(selectedStock.code);
    const isObserve = observeCodes.includes(selectedStock.code);

    const buyLabel = getBuyLabel(selectedStock, mainIndustries, settings);
    const entryType = getEntryType(selectedStock, mainIndustries, settings);

    const buyLow = selectedStock.openPrice * (1 - settings.pullbackRangePercent / 100);
    const buyHigh = selectedStock.openPrice * (1 + settings.pullbackRangePercent / 100);
    const stopByOpen = selectedStock.openPrice * (1 - settings.stopLossPercent / 100);
    const stopByPrev = selectedStock.previousClose * (1 - settings.stopLossPercent / 100);

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
                  {getStatus(selectedStock, settings)}｜{entryType}｜分數 {score}
                </div>
              </div>

              <div className={`text-right text-3xl font-black ${selectedStock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPercent(selectedStock.changePercent)}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">即時股價</div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <div className="text-3xl font-black text-white">{formatNumber(selectedStock.price)}</div>
                  <div className={`mt-1 text-sm font-black ${getDirectionTone(direction)}`}>
                    {getDirectionText(direction)}
                  </div>
                </div>

                <div className="text-right text-xs font-bold text-slate-400">
                  <div>更新：{selectedStock.updatedAt || lastSuccessAt || "--"}</div>
                  <div>資料：{dataStatus}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">操作結論</div>
              <div className="mt-1 text-2xl font-black text-yellow-200">
                {getConclusion(selectedStock, mainIndustries, settings)}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {getBuySuggestion(selectedStock, mainIndustries, settings)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <DetailRow label="開盤" value={formatNumber(selectedStock.openPrice)} />
              <DetailRow label="昨收" value={formatNumber(selectedStock.previousClose)} />
              <DetailRow label="量" value={formatNumber(selectedStock.volume)} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-emerald-500/50 bg-emerald-950/20 p-5">
            <h2 className="text-xl font-black">進場買點</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="買點標籤" value={buyLabel} />
              <DetailRow label="進場型態" value={entryType} />
              <DetailRow label="回測買點低" value={`${buyLow.toFixed(2)} 元`} />
              <DetailRow label="回測買點高" value={`${buyHigh.toFixed(2)} 元`} />
              <DetailRow label="突破買點" value={`${selectedStock.openPrice.toFixed(2)} 元以上續強`} />
              <DetailRow label="轉強買點" value={`站回開盤 ${selectedStock.openPrice.toFixed(2)} 元`} />
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-emerald-100">
              進場建議：{getBuySuggestion(selectedStock, mainIndustries, settings)}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-red-500/50 bg-red-950/20 p-5">
            <h2 className="text-xl font-black">賣點 / 停損 / 停利</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="開盤停損" value={`${stopByOpen.toFixed(2)} 元`} />
              <DetailRow label="昨收停損" value={`${stopByPrev.toFixed(2)} 元`} />
              <DetailRow label="移出觀察" value="漲幅低於2%" />
              <DetailRow label="停利提醒" value={`漲幅接近${settings.hotPercent}%`} />
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-red-100">
              賣出建議：{getSellSuggestion(selectedStock, settings)}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-cyan-500/50 bg-cyan-950/20 p-5">
            <h2 className="text-xl font-black">進階摘要</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="50強排名" value={selectedRank ? `第 ${selectedRank} 名` : "不在50強"} />
              <DetailRow label="產業排名" value={selectedIndustryRank ? `${selectedStock.industry} 第 ${selectedIndustryRank}` : "--"} />
              <DetailRow label="追高風險" value={isHot(selectedStock, settings) ? "高" : selectedStock.changePercent >= 5 ? "中" : "低"} />
              <DetailRow label="狀態" value={getStatus(selectedStock, settings)} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-indigo-500/50 bg-indigo-950/20 p-5">
            <h2 className="text-xl font-black">分數拆解</h2>
            <div className="mt-3 space-y-2 text-sm font-bold">
              {getScoreParts(selectedStock, mainIndustries, settings).map((item) => (
                <div key={item.label} className="flex justify-between rounded-2xl bg-black/30 p-3">
                  <span className="text-slate-300">{item.label}</span>
                  <span className={item.value >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {item.value > 0 ? "+" : ""}
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-yellow-500/50 bg-yellow-950/20 p-5">
            <h2 className="text-xl font-black">買進前檢查表</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
              {[
                [`股價${settings.maxPrice}內`, selectedStock.price <= settings.maxPrice],
                ["主流產業", mainIndustries.includes(selectedStock.industry)],
                ["未過熱", !isHot(selectedStock, settings)],
                ["未轉弱", !isWeak(selectedStock)],
                ["有買點", !["不追高", "暫不進場", "等待買點"].includes(buyLabel)],
                ["在觀察", isObserve],
              ].map(([label, ok]: any) => (
                <div key={label} className={`rounded-2xl p-3 ${ok ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                  {ok ? "✅" : "❌"} {label}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-yellow-500/50 bg-yellow-950/20 p-5">
            <h2 className="text-xl font-black">明日操作劇本</h2>
            <div className="mt-3 space-y-2 text-sm font-black text-yellow-100">
              <div className="rounded-2xl bg-black/30 p-3">1. 開高太多不追，等回測買點區。</div>
              <div className="rounded-2xl bg-black/30 p-3">2. 守住開盤價並續強，才列優先觀察。</div>
              <div className="rounded-2xl bg-black/30 p-3">3. 跌破開盤停損區或昨收停損區，移出觀察。</div>
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
            <h2 className="text-xl font-black">一鍵操作</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => setObserveGroup(selectedStock.code, "明天優先")} className="rounded-2xl bg-cyan-500/20 py-3 text-xs font-black text-cyan-200">明天優先</button>
              <button onClick={() => setObserveGroup(selectedStock.code, "等回測")} className="rounded-2xl bg-lime-500/20 py-3 text-xs font-black text-lime-200">等回測</button>
              <button onClick={() => setObserveGroup(selectedStock.code, "不追高")} className="rounded-2xl bg-red-500/20 py-3 text-xs font-black text-red-200">不追高</button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => (isFavorite ? removeFavorite(selectedStock.code) : addFavorite(selectedStock.code))} className={`rounded-2xl py-3 text-sm font-black ${isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"}`}>
                {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
              </button>

              <button onClick={() => (isObserve ? removeObserve(selectedStock.code) : addObserve(selectedStock.code))} className={`rounded-2xl py-3 text-sm font-black ${isObserve ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"}`}>
                {isObserve ? "📌 移除觀察" : "📌 加入觀察"}
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">個股備註</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["等回測", "看續強", "不追高", "跌破開盤出場"].map((text) => (
                <button
                  key={text}
                  onClick={() => {
                    const next = { ...notes, [selectedStock.code]: text };
                    setNotes(next);
                    localStorage.setItem(NOTE_KEY, JSON.stringify(next));
                  }}
                  className="rounded-2xl bg-slate-800 py-2 text-sm font-black text-slate-200"
                >
                  {text}
                </button>
              ))}
            </div>

            <textarea
              value={notes[selectedStock.code] || ""}
              onChange={(e) => {
                const next = { ...notes, [selectedStock.code]: e.target.value };
                setNotes(next);
                localStorage.setItem(NOTE_KEY, JSON.stringify(next));
              }}
              placeholder="輸入備註"
              className="mt-3 min-h-[90px] w-full rounded-2xl border border-slate-700 bg-black/40 p-3 text-sm font-bold text-white outline-none"
            />
          </section>

          <section className="mt-4 rounded-3xl border border-indigo-500/50 bg-indigo-950/20 p-5">
            <h2 className="text-xl font-black">同產業前三強</h2>
            <div className="mt-3 space-y-2 text-sm font-bold text-indigo-100">
              {sameIndustryTop3.length === 0 && <div>目前沒有同產業資料。</div>}
              {sameIndustryTop3.map((stock, index) => (
                <button key={stock.code} onClick={() => setSelectedCode(stock.code)} className="w-full rounded-2xl bg-black/30 p-3 text-left">
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
              <div className="text-sm font-bold text-slate-400">台股進出場買賣點版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">今日儀表板</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {signal.text}
              </p>
            </div>

            <button onClick={loadStocks} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">即時更新：{dataStatus}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                API：{apiHealth}｜倒數：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}s`}｜來源：{source || "--"}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              詳情
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="盤勢燈號" value={signal.title} sub={signal.text} tone={signal.tone} onClick={() => goMore("today")} />
          <MiniCard title="買點雷達" value={buyRadarList.length} sub="接近買點" tone="text-emerald-300" onClick={() => goMore("buyRadar")} />
          <MiniCard title="賣點雷達" value={sellRadarList.length} sub="跌破 / 過熱" tone="text-red-300" onClick={() => goMore("sellRadar")} />
          <MiniCard title="今日必看" value={mustWatch3.length} sub="最優先3檔" tone="text-cyan-300" onClick={() => setTab("top")} />
          <MiniCard title="主流產業" value={mainIndustries[0] || "--"} sub={mainIndustries.slice(0, 3).join("、") || "尚無資料"} tone="text-cyan-300" onClick={() => goMore("industry")} />
          <MiniCard title="即時警報" value={realTime200Alerts.length} sub="200元內 + 未過熱" tone="text-orange-300" onClick={() => goMore("alerts")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="今日50強" sub="完整清單" badge={top50.length} tone="text-red-300" onClick={() => goMore("today")} />
          <ActionCard title="不要碰" sub={`過熱 ${hotList.length}｜轉弱 ${weakList.length}`} badge={avoidList.length} tone="text-red-300" onClick={() => goMore("avoid")} />
          <ActionCard title="回測觀察" sub="等回測可觀察" badge={pullbackList.length} tone="text-lime-300" onClick={() => goMore("pullback")} />
          <ActionCard title="突破確認" sub="強於開盤" badge={breakoutList.length} tone="text-orange-300" onClick={() => goMore("breakout")} />
          <ActionCard title="9:10觀察" sub={getMarketStatus()} badge={open910List.length} tone="text-purple-300" onClick={() => goMore("open910")} />
          <ActionCard title="統計" sub="觀察與自選" badge="看" tone="text-blue-300" onClick={() => goMore("stats")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋</h2>
              <p className="text-xs font-bold text-slate-500">點股票卡片可進個股詳情。</p>
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
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["score", "分數"],
                ["change", "漲幅"],
                ["price", "低價"],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setSortKey(key as any)} className={`rounded-2xl py-3 text-xs font-black ${sortKey === key ? "bg-indigo-500 text-white" : "bg-black/30 text-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="買點雷達" sub="接近買點股票" badge={buyRadarList.length} tone="text-emerald-300" onClick={() => setMoreView("buyRadar")} />
              <ActionCard title="賣點雷達" sub="跌破 / 過熱" badge={sellRadarList.length} tone="text-red-300" onClick={() => setMoreView("sellRadar")} />
              <ActionCard title="今日50強" sub="完整清單" badge={top50.length} tone="text-red-300" onClick={() => setMoreView("today")} />
              <ActionCard title="即時警報" sub="200元內警報" badge={realTime200Alerts.length} tone="text-orange-300" onClick={() => setMoreView("alerts")} />
              <ActionCard title="產業" sub="產業熱度排行" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="更新頻率與買賣點參數" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="不要碰" sub="過熱與轉弱" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoid")} />
              <ActionCard title="回測" sub="等回測觀察" badge={pullbackList.length} tone="text-lime-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="突破" sub="突破確認股" badge={breakoutList.length} tone="text-orange-300" onClick={() => setMoreView("breakout")} />
              <ActionCard title="9:10" sub="開盤觀察" badge={open910List.length} tone="text-purple-300" onClick={() => setMoreView("open910")} />
              <ActionCard title="統計" sub="觀察與自選" badge="📈" tone="text-blue-300" onClick={() => setMoreView("stats")} />
              <ActionCard title="資料" sub="API與快取狀態" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "首頁卡片"}
              {tab === "top" && "🏆 Top 進場分類"}
              {tab === "observe" && "📝 觀察清單"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "today" && "📊 今日50強"}
              {tab === "more" && moreView === "alerts" && "🚨 即時200元內警報"}
              {tab === "more" && moreView === "buyRadar" && "🟢 買點雷達"}
              {tab === "more" && moreView === "sellRadar" && "🔴 賣點雷達"}
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "avoid" && "🚫 不要碰"}
              {tab === "more" && moreView === "pullback" && "↩️ 回測觀察"}
              {tab === "more" && moreView === "breakout" && "🚀 突破確認"}
              {tab === "more" && moreView === "open910" && "⏰ 9:10觀察"}
              {tab === "more" && moreView === "stats" && "📈 統計"}
              {tab === "more" && moreView === "data" && "📡 資料狀態"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              進出場買賣點版：找強股 → 看買點 → 看賣點 → 放進觀察。
            </p>
          </div>

          {tab === "top" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-xl font-black">可進場觀察</h3>
                <div className="space-y-3">
                  {canEntryList.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有股票</div>}
                  {canEntryList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-black">等回測 / 等買點</h3>
                <div className="space-y-3">
                  {waitPullbackTopList.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有股票</div>}
                  {waitPullbackTopList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-black">不追高</h3>
                <div className="space-y-3">
                  {noChaseTopList.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有股票</div>}
                  {noChaseTopList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "observe" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">觀察股買賣點</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  接近買點 {observeBuyAlerts.length} 檔｜跌破賣點 {observeSellAlerts.length} 檔
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={organizeObserve} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">一鍵整理</button>
                  <button onClick={removeWeakObserve} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">清除轉弱</button>
                </div>
              </div>

              {(["明天優先", "等回測", "不追高"] as ObserveGroup[]).map((group) => {
                const groupStocks = observeStocks.filter((stock) => (groups[stock.code] || "明天優先") === group);

                return (
                  <div key={group}>
                    <h3 className="mb-2 text-xl font-black">{group}</h3>
                    <div className="space-y-3">
                      {groupStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有股票</div>}
                      {groupStocks.map((stock, index) => (
                        <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "favorite" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-4">
                <h3 className="text-xl font-black">自選股買賣點</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm font-black">
                  <div className="rounded-2xl bg-black/30 p-3">全部<br />{favoriteCodes.length}</div>
                  <div className="rounded-2xl bg-black/30 p-3">警報<br />{favoriteAlerts.length}</div>
                  <div className="rounded-2xl bg-black/30 p-3">顯示<br />{favoriteStocks.length}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveSettings({ ...settings, favoriteOnlyActive: !settings.favoriteOnlyActive })}
                    className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200"
                  >
                    只看有動作：{settings.favoriteOnlyActive ? "開" : "關"}
                  </button>

                  <button onClick={addActiveFavoritesToObserve} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                    轉強加入觀察
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    id="favorite-input"
                    inputMode="numeric"
                    placeholder="輸入股票代號"
                    onChange={(e) => {
                      e.currentTarget.value = cleanCode(e.currentTarget.value);
                    }}
                    className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
                  />

                  <button
                    onClick={() => {
                      const input = document.getElementById("favorite-input") as HTMLInputElement | null;
                      if (input?.value) {
                        addFavorite(input.value);
                        input.value = "";
                      }
                    }}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-black"
                  >
                    加入
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {favoriteStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有自選股</div>}
                {favoriteStocks.map((stock, index) => (
                  <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industries.slice(0, 10).map((item, index) => (
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
                    {item.stocks.slice(0, 3).map((stock, i) => (
                      <button key={stock.code} onClick={() => setSelectedCode(stock.code)} className="block w-full text-left">
                        {i + 1}. {stock.code} {stock.name} {formatPercent(stock.changePercent)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">自動更新頻率</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    [15, "15秒"],
                    [30, "30秒"],
                    [60, "60秒"],
                    [0, "手動"],
                  ].map(([value, label]) => (
                    <button key={String(value)} onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value) })} className={`rounded-2xl py-3 text-sm font-black ${settings.refreshSeconds === Number(value) ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">股價上限</div>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 150, 200, 300].map((price) => (
                    <button key={price} onClick={() => saveSettings({ ...settings, maxPrice: price })} className={`rounded-2xl py-3 text-sm font-black ${settings.maxPrice === price ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      {price}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">回測買點範圍</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 1.5, 2].map((p) => (
                    <button key={p} onClick={() => saveSettings({ ...settings, pullbackRangePercent: p })} className={`rounded-2xl py-3 text-sm font-black ${settings.pullbackRangePercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      ±{p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">停損跌破</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 1.5, 2].map((p) => (
                    <button key={p} onClick={() => saveSettings({ ...settings, stopLossPercent: p })} className={`rounded-2xl py-3 text-sm font-black ${settings.stopLossPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">過熱漲幅</div>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 8, 9].map((p) => (
                    <button key={p} onClick={() => saveSettings({ ...settings, hotPercent: p })} className={`rounded-2xl py-3 text-sm font-black ${settings.hotPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => saveSettings({ ...settings, excludeHot: !settings.excludeHot })} className={`w-full rounded-2xl py-3 text-lg font-black ${settings.excludeHot ? "bg-emerald-500/30 text-emerald-200" : "bg-red-500/30 text-red-200"}`}>
                排除過熱股：{settings.excludeHot ? "開啟" : "關閉"}
              </button>
            </div>
          )}

          {tab === "more" && moreView === "stats" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">統計中心</div>
              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>今日50強：{top50.length}</div>
                <div>買點雷達：{buyRadarList.length}</div>
                <div>賣點雷達：{sellRadarList.length}</div>
                <div>即時警報：{realTime200Alerts.length}</div>
                <div>觀察股：{observeCodes.length}</div>
                <div>觀察接近買點：{observeBuyAlerts.length}</div>
                <div>觀察跌破賣點：{observeSellAlerts.length}</div>
                <div>自選股：{favoriteCodes.length}</div>
                <div>自選警報：{favoriteAlerts.length}</div>
                <div>過熱股：{hotList.length}</div>
                <div>轉弱股：{weakList.length}</div>
              </div>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料狀態：{dataStatus}</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API健康：{apiHealth}</div>
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
            tab !== "top" &&
            tab !== "observe" &&
            tab !== "favorite" &&
            !(tab === "more" && ["industry", "settings", "stats", "data", "menu"].includes(moreView)) && (
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "首頁"],
            ["top", "🏆", "Top"],
            ["observe", "📝", "觀察"],
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