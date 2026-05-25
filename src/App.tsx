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
  | "mainStrong"
  | "mainWeak"
  | "mainPullback"
  | "lowMain"
  | "highScore"
  | "hotRadar"
  | "nonMainStrong"
  | "breakout"
  | "pullback"
  | "alert"
  | "avoid"
  | "data"
  | "settings";

type PriceDirection = "up" | "down" | "same" | "new";
type MainMode = "保守" | "標準" | "積極";
type WeakRule = "跌破開盤" | "跌破昨收" | "兩者都要";
type SortKey = "score" | "instant" | "change" | "price";
type TopFilter = "全部" | "即時轉強" | "即時轉弱" | "非主流強漲" | "主流" | "低價" | "未過熱";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  hotPercent: number;
  refreshSeconds: number;
  excludeHot: boolean;
  mainMode: MainMode;
  weakRule: WeakRule;
  dataSaver: boolean;
  topFilter: TopFilter;
};

type ApiResponse = {
  stocks?: any[];
  data?: any[];
  rankedStocks?: any[];
  updatedAt?: string;
  updatedAtTaiwan?: string;
  source?: string;
};

type IndustryItem = {
  industry: string;
  count: number;
  avg: number;
  stocks: Stock[];
  breakoutCount: number;
  hotCount: number;
  weakCount: number;
  realtimeStrongCount: number;
  score: number;
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-advanced-realtime-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-advanced-realtime-last-success";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  hotPercent: 8,
  refreshSeconds: 30,
  excludeHot: true,
  mainMode: "標準",
  weakRule: "跌破開盤",
  dataSaver: false,
  topFilter: "全部",
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

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice;
}

function isWeakByRule(stock: Stock, settings: Settings) {
  const belowOpen = stock.price < stock.openPrice;
  const belowPrev = stock.price < stock.previousClose;

  if (settings.weakRule === "跌破開盤") return belowOpen;
  if (settings.weakRule === "跌破昨收") return belowPrev;
  return belowOpen && belowPrev;
}

function isWeak(stock: Stock, settings: Settings) {
  return isWeakByRule(stock, settings) || stock.changePercent < 2;
}

function isPullback(stock: Stock, settings: Settings) {
  if (stock.openPrice <= 0) return false;
  const distance = Math.abs(stock.price - stock.openPrice) / stock.openPrice;
  return stock.changePercent >= 2 && distance <= 0.015 && !isHot(stock, settings);
}

function pullbackDistance(stock: Stock) {
  if (stock.openPrice <= 0) return 999;
  return (Math.abs(stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function previousPriceOf(stock: Stock, previousPriceMap: Record<string, number>) {
  return previousPriceMap[stock.code];
}

function instantChange(stock: Stock, previousPriceMap: Record<string, number>) {
  const prev = previousPriceOf(stock, previousPriceMap);
  if (!prev || prev <= 0) return 0;
  return stock.price - prev;
}

function instantPercent(stock: Stock, previousPriceMap: Record<string, number>) {
  const prev = previousPriceOf(stock, previousPriceMap);
  if (!prev || prev <= 0) return 0;
  return ((stock.price - prev) / prev) * 100;
}

function isAlert(stock: Stock, settings: Settings) {
  if (stock.price <= 0 || stock.price > settings.maxPrice) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;
  return stock.changePercent >= settings.alertPercent || (stock.openPremiumPercent ?? 0) >= 3;
}

function isRealtimeStrong(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  return (
    priceDirections[stock.code] === "up" &&
    stock.price >= stock.openPrice &&
    mainIndustries.includes(stock.industry) &&
    !isHot(stock, settings)
  );
}

function isRealtimeWeak(
  stock: Stock,
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  return (
    priceDirections[stock.code] === "down" ||
    stock.price < stock.openPrice ||
    stock.price < stock.previousClose ||
    isWeak(stock, settings)
  );
}

function getIndustryRanking(
  stocks: Stock[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  mainIndustriesForRealtime: string[] = []
): IndustryItem[] {
  const map = new Map<string, IndustryItem>();

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
        realtimeStrongCount: 0,
        score: 0,
      };

    item.count += 1;
    item.stocks.push(stock);
    if (isBreakout(stock)) item.breakoutCount += 1;
    if (isHot(stock, settings)) item.hotCount += 1;
    if (isWeak(stock, settings)) item.weakCount += 1;
    if (priceDirections[stock.code] === "up" && stock.price >= stock.openPrice) {
      item.realtimeStrongCount += 1;
    }

    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avg =
        item.stocks.reduce((sum, stock) => sum + stock.changePercent, 0) /
        Math.max(item.stocks.length, 1);

      const mainBonus = mainIndustriesForRealtime.includes(item.industry) ? 8 : 0;

      return {
        ...item,
        avg,
        score:
          item.count * 10 +
          avg * 3 +
          item.breakoutCount * 5 +
          item.realtimeStrongCount * 6 +
          mainBonus -
          item.hotCount * 3 -
          item.weakCount * 3,
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
  if (isWeak(stock, settings)) score -= 25;

  if (settings.mainMode === "保守" && !mainIndustries.includes(stock.industry)) score -= 30;
  if (settings.mainMode === "保守" && stock.price > settings.maxPrice) score -= 30;
  if (settings.mainMode === "積極" && isBreakout(stock)) score += 15;

  return Math.max(0, Math.round(score));
}

function instantScore(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  let score = 0;

  if (priceDirections[stock.code] === "up") score += 30;
  if (stock.price >= stock.openPrice) score += 25;
  if (mainIndustries.includes(stock.industry)) score += 20;
  if (!isHot(stock, settings)) score += 15;
  if (stock.volume > 0) score += 10;
  if (isBreakout(stock)) score += 10;
  if (isWeak(stock, settings)) score -= 30;
  if (isHot(stock, settings)) score -= 25;

  return Math.max(0, Math.round(score));
}

function mainRank(stock: Stock, mainIndustries: string[]) {
  const index = mainIndustries.indexOf(stock.industry);
  if (index === -1) return "";
  return `主流${index + 1}`;
}

function directionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
  if (direction === "new") return "新資料";
  return "--";
}

function directionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  return "text-cyan-300";
}

function statusText(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  if (isRealtimeStrong(stock, mainIndustries, settings, priceDirections)) return "即時轉強";
  if (isRealtimeWeak(stock, settings, priceDirections)) return "即時轉弱";
  if (isHot(stock, settings)) return "過熱";
  if (isWeak(stock, settings)) return "轉弱";
  if (isAlert(stock, settings)) return "警報";
  if (isBreakout(stock)) return "突破";
  if (isPullback(stock, settings)) return "回測";
  if (mainIndustries.includes(stock.industry)) return "主流";
  return "觀察";
}

function conclusion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = scoreStock(stock, mainIndustries, settings);

  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock, settings)) return "轉弱小心";
  if (!mainIndustries.includes(stock.industry) && settings.mainMode !== "積極") return "非主流先觀察";
  if (isPullback(stock, settings)) return "等回測";
  if (isBreakout(stock) && score >= 70) return "明日優先觀察";
  if (score >= 70) return "可列觀察";
  return "暫不追";
}

function tomorrowDecision(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  if (isHot(stock, settings)) return "過熱不追";
  if (isRealtimeWeak(stock, settings, priceDirections)) return "轉弱移除";
  if (isPullback(stock, settings)) return "主流回測";
  if (isRealtimeStrong(stock, mainIndustries, settings, priceDirections)) return "主流轉強";
  if (!mainIndustries.includes(stock.industry) && stock.changePercent >= settings.alertPercent) return "非主流強漲觀察";
  if (scoreStock(stock, mainIndustries, settings) >= 70) return "主流轉強";
  return "主流回測";
}

function pickReasons(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  const reasons: string[] = [];

  if (mainIndustries.includes(stock.industry)) reasons.push("主流");
  if (stock.price <= settings.maxPrice) reasons.push(`${settings.maxPrice}內`);
  if (priceDirections[stock.code] === "up") reasons.push("即時上升");
  if (isBreakout(stock)) reasons.push("突破開盤");
  if (isPullback(stock, settings)) reasons.push("接近回測");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  if (!isWeak(stock, settings)) reasons.push("未轉弱");

  return reasons.length ? reasons.join(" / ") : "暫無明確理由";
}

function removeReasons(stock: Stock, mainIndustries: string[], settings: Settings, priceDirections: Record<string, PriceDirection>) {
  const reasons: string[] = [];

  if (priceDirections[stock.code] === "down") reasons.push("即時下跌");
  if (stock.price < stock.openPrice) reasons.push("跌破開盤");
  if (stock.price < stock.previousClose) reasons.push("跌破昨收");
  if (isHot(stock, settings)) reasons.push("過熱");
  if (!mainIndustries.includes(stock.industry)) reasons.push("非主流");

  return reasons.length ? reasons.join(" / ") : "沒有明顯移除理由";
}

function realtimeSentence(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  if (isRealtimeStrong(stock, mainIndustries, settings, priceDirections)) {
    return "股價剛上升，仍站上開盤，主線偏強。";
  }

  if (isRealtimeWeak(stock, settings, priceDirections)) {
    return "股價轉弱或跌破關鍵價，先保守觀察。";
  }

  if (priceDirections[stock.code] === "same") return "股價暫時持平，等待下一次更新確認。";
  if (priceDirections[stock.code] === "new") return "新資料，等待下一筆更新比對。";

  return "目前未出現明確即時訊號。";
}

function kLinks(code: string, name: string) {
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
    <button onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left active:scale-95">
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
    <button onClick={onClick} className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-white">{title}</div>
          <div className="mt-1 text-sm font-bold text-slate-400">{sub}</div>
        </div>
        <div className={`rounded-2xl bg-black/40 px-3 py-2 text-lg font-black ${tone}`}>{badge}</div>
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
  previousPriceMap,
  lastSuccessAt,
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
  previousPriceMap: Record<string, number>;
  lastSuccessAt: string;
  showReason?: boolean;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddTomorrow: (code: string) => void;
  onRemoveTomorrow: (code: string) => void;
}) {
  const baseScore = scoreStock(stock, mainIndustries, settings);
  const liveScore = instantScore(stock, mainIndustries, settings, priceDirections);
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const direction = priceDirections[stock.code];
  const mr = mainRank(stock, mainIndustries);
  const prevPrice = previousPriceOf(stock, previousPriceMap);
  const diff = instantChange(stock, previousPriceMap);
  const diffPercent = instantPercent(stock, previousPriceMap);
  const st = statusText(stock, mainIndustries, settings, priceDirections);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry} {mr && `｜${mr}`}
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
          <span className="rounded-full bg-slate-800 px-3 py-1">{st}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">主線 {baseScore}</span>
          <span className="rounded-full bg-orange-950 px-3 py-1 text-orange-200">即時 {liveScore}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {mr && <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-200">{mr}</span>}
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          結論：{conclusion(stock, mainIndustries, settings)}
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}　
          {prevPrice !== undefined ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          {prevPrice !== undefined && (
            <>
              {" ｜ "}
              {diff > 0 ? "+" : ""}
              {diff.toFixed(2)}
              {" / "}
              {formatPercent(diffPercent)}
            </>
          )}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>

        {showReason && (
          <div className="mt-2 rounded-2xl bg-cyan-950/30 p-2 text-xs font-bold text-cyan-100">
            保留原因：{pickReasons(stock, mainIndustries, settings, priceDirections)}
            <br />
            移除原因：{removeReasons(stock, mainIndustries, settings, priceDirections)}
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
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [customMaxPrice, setCustomMaxPrice] = useState("");

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
  const [previousPriceMap, setPreviousPriceMap] = useState<Record<string, number>>({});
  const [priceDirections, setPriceDirections] = useState<Record<string, PriceDirection>>({});

  useEffect(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    setSettings(mergedSettings);
    setAutoSeconds(mergedSettings.refreshSeconds);
    setCustomMaxPrice(String(mergedSettings.maxPrice));

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
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 80);
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

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
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
    if (settings.refreshSeconds <= 0 || settings.dataSaver) return;

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
  }, [settings.refreshSeconds, settings.dataSaver, lastPriceMap]);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  const baseIndustries = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections),
    [top50, settings, priceDirections]
  );

  const mainIndustries = useMemo(
    () => baseIndustries.slice(0, 3).map((item) => item.industry),
    [baseIndustries]
  );

  const industries = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections, mainIndustries),
    [top50, settings, priceDirections, mainIndustries]
  );

  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)), [top50, settings]);

  const mainStrongList = useMemo(
    () =>
      top50
        .filter((stock) => isRealtimeStrong(stock, mainIndustries, settings, priceDirections))
        .sort((a, b) => instantScore(b, mainIndustries, settings, priceDirections) - instantScore(a, mainIndustries, settings, priceDirections)),
    [top50, mainIndustries, settings, priceDirections]
  );

  const mainWeakList = useMemo(
    () =>
      top50
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => isRealtimeWeak(stock, settings, priceDirections)),
    [top50, mainIndustries, settings, priceDirections]
  );

  const nonMainStrongList = useMemo(
    () =>
      top50
        .filter((stock) => !mainIndustries.includes(stock.industry))
        .filter((stock) => stock.changePercent >= settings.alertPercent)
        .filter((stock) => priceDirections[stock.code] === "up" || isBreakout(stock))
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, mainIndustries, settings, priceDirections]
  );

  const mainPullbackList = useMemo(
    () =>
      top50
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => isPullback(stock, settings))
        .filter((stock) => stock.price >= stock.previousClose)
        .sort((a, b) => pullbackDistance(a) - pullbackDistance(b)),
    [top50, mainIndustries, settings]
  );

  const lowMainList = useMemo(
    () =>
      top50
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings)),
    [top50, mainIndustries, settings]
  );

  const highScoreList = useMemo(
    () =>
      top50
        .filter((stock) => scoreStock(stock, mainIndustries, settings) >= 70)
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings)),
    [top50, mainIndustries, settings]
  );

  const hotRadarList = useMemo(
    () =>
      top50
        .filter((stock) => isHot(stock, settings))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, settings]
  );

  const breakoutList = useMemo(
    () =>
      top50
        .filter(isBreakout)
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings)),
    [top50, mainIndustries, settings]
  );

  const pullbackList = useMemo(
    () =>
      top50
        .filter((stock) => isPullback(stock, settings))
        .sort((a, b) => pullbackDistance(a) - pullbackDistance(b)),
    [top50, settings]
  );

  const alertList = useMemo(
    () =>
      top50
        .filter((stock) => isAlert(stock, settings))
        .filter((stock) => !isWeak(stock, settings))
        .filter((stock) => !isHot(stock, settings)),
    [top50, settings]
  );

  const avoidList = useMemo(
    () =>
      top50.filter((stock) => {
        if (isHot(stock, settings)) return true;
        if (isWeak(stock, settings)) return true;
        if (!mainIndustries.includes(stock.industry)) return true;
        if (stock.price > settings.maxPrice) return true;
        return false;
      }),
    [top50, mainIndustries, settings]
  );

  const tomorrowAutoList = useMemo(() => {
    let list = top50
      .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeak(stock, settings));

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

  const tomorrowMainStrong = useMemo(
    () => tomorrowCombined.filter((stock) => tomorrowDecision(stock, mainIndustries, settings, priceDirections) === "主流轉強"),
    [tomorrowCombined, mainIndustries, settings, priceDirections]
  );

  const tomorrowMainPullback = useMemo(
    () => tomorrowCombined.filter((stock) => tomorrowDecision(stock, mainIndustries, settings, priceDirections) === "主流回測"),
    [tomorrowCombined, mainIndustries, settings, priceDirections]
  );

  const tomorrowNonMainStrong = useMemo(
    () => tomorrowCombined.filter((stock) => tomorrowDecision(stock, mainIndustries, settings, priceDirections) === "非主流強漲觀察"),
    [tomorrowCombined, mainIndustries, settings, priceDirections]
  );

  const tomorrowHot = useMemo(
    () => tomorrowCombined.filter((stock) => tomorrowDecision(stock, mainIndustries, settings, priceDirections) === "過熱不追"),
    [tomorrowCombined, mainIndustries, settings, priceDirections]
  );

  const tomorrowWeakRemove = useMemo(
    () => tomorrowCombined.filter((stock) => tomorrowDecision(stock, mainIndustries, settings, priceDirections) === "轉弱移除"),
    [tomorrowCombined, mainIndustries, settings, priceDirections]
  );

  const fundFlowText = useMemo(() => {
    const mainCount = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    const ratio = top50.length ? mainCount / top50.length : 0;

    if (ratio >= 0.45) return "資金集中";
    if (ratio >= 0.3) return "資金偏集中";
    return "資金擴散";
  }, [top50, mainIndustries]);

  const marketScore = useMemo(() => {
    const mainCount = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    const mainRatio = top50.length ? (mainCount / top50.length) * 100 : 0;

    let score = 40;
    score += Math.min(25, mainRatio * 0.5);
    score += Math.min(20, mainStrongList.length * 4);
    score += Math.min(15, breakoutList.length);
    score -= Math.min(25, hotList.length * 1.5);
    score -= Math.min(25, mainWeakList.length * 3);

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [top50, mainIndustries, mainStrongList, breakoutList, hotList, mainWeakList]);

  const todayMode = useMemo(() => {
    if (hotList.length >= 15) return { label: "不追高", tone: "text-red-300" };
    if (mainWeakList.length >= 8) return { label: "保守觀察", tone: "text-yellow-300" };
    if (mainPullbackList.length >= 5) return { label: "等回測", tone: "text-yellow-300" };
    if (mainStrongList.length >= 5 && marketScore >= 70) return { label: "積極觀察", tone: "text-red-300" };
    return { label: "保守觀察", tone: "text-cyan-300" };
  }, [hotList, mainWeakList, mainPullbackList, mainStrongList, marketScore]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "使用快取";
    if (lastSuccessAt) return "即時正常";
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
      .filter((stock) => stock.industry === selectedStock.industry)
      .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  }, [selectedStock, top50, mainIndustries, settings]);

  const selectedIndustryRank = useMemo(() => {
    if (!selectedStock) return null;
    const index = sameIndustryStocks.findIndex((stock) => stock.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, sameIndustryStocks]);

  function filterTopList(list: Stock[]) {
    if (tab !== "top50") return list;

    if (settings.topFilter === "即時轉強") {
      return list.filter((stock) => isRealtimeStrong(stock, mainIndustries, settings, priceDirections));
    }

    if (settings.topFilter === "即時轉弱") {
      return list.filter((stock) => isRealtimeWeak(stock, settings, priceDirections));
    }

    if (settings.topFilter === "非主流強漲") {
      return list.filter((stock) => !mainIndustries.includes(stock.industry) && stock.changePercent >= settings.alertPercent);
    }

    if (settings.topFilter === "主流") {
      return list.filter((stock) => mainIndustries.includes(stock.industry));
    }

    if (settings.topFilter === "低價") {
      return list.filter((stock) => stock.price <= settings.maxPrice);
    }

    if (settings.topFilter === "未過熱") {
      return list.filter((stock) => !isHot(stock, settings));
    }

    return list;
  }

  function sortList(list: Stock[]) {
    let arr = filterTopList([...list]);

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);
    if (sortKey === "instant") {
      return arr.sort((a, b) => instantScore(b, mainIndustries, settings, priceDirections) - instantScore(a, mainIndustries, settings, priceDirections));
    }

    return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return sortList(top50);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "industry") return [];
      if (moreView === "mainStrong") return sortList(mainStrongList);
      if (moreView === "mainWeak") return sortList(mainWeakList);
      if (moreView === "mainPullback") return sortList(mainPullbackList);
      if (moreView === "lowMain") return sortList(lowMainList);
      if (moreView === "highScore") return sortList(highScoreList);
      if (moreView === "hotRadar") return sortList(hotRadarList);
      if (moreView === "nonMainStrong") return sortList(nonMainStrongList);
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
    mainStrongList,
    mainWeakList,
    mainPullbackList,
    lowMainList,
    highScoreList,
    hotRadarList,
    nonMainStrongList,
    breakoutList,
    pullbackList,
    alertList,
    avoidList,
    searchText,
    sortKey,
    mainIndustries,
    settings,
    priceDirections,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  function openLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function removeWeakTomorrow() {
    const removeSet = new Set(tomorrowWeakRemove.map((stock) => stock.code));
    saveTomorrow(tomorrowCodes.filter((code) => !removeSet.has(code)));
  }

  function keepOnlyMainTomorrow() {
    const keep = tomorrowCombined
      .filter((stock) => mainIndustries.includes(stock.industry))
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => stock.price <= settings.maxPrice)
      .map((stock) => stock.code);

    saveTomorrow(keep);
  }

  function clearTomorrow() {
    saveTomorrow([]);
  }

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    tomorrowCodes,
    priceDirections,
    previousPriceMap,
    lastSuccessAt,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddTomorrow: addTomorrow,
    onRemoveTomorrow: removeTomorrow,
  };

  if (selectedStock) {
    const links = kLinks(selectedStock.code, selectedStock.name);
    const direction = priceDirections[selectedStock.code];
    const isFavorite = favoriteCodes.includes(selectedStock.code);
    const isTomorrow = tomorrowCodes.includes(selectedStock.code);
    const prevPrice = previousPriceMap[selectedStock.code];
    const diff = instantChange(selectedStock, previousPriceMap);
    const diffPercent = instantPercent(selectedStock, previousPriceMap);
    const decision = tomorrowDecision(selectedStock, mainIndustries, settings, priceDirections);
    const suggestion =
      decision === "轉弱移除" || decision === "過熱不追"
        ? `建議移除：${removeReasons(selectedStock, mainIndustries, settings, priceDirections)}`
        : `可觀察：${pickReasons(selectedStock, mainIndustries, settings, priceDirections)}`;

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
          <button onClick={() => setSelectedCode("")} className="mb-4 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">
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

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">即時判斷一句話</div>
              <div className={`mt-1 text-xl font-black ${directionTone(direction)}`}>
                {realtimeSentence(selectedStock, mainIndustries, settings, priceDirections)}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {prevPrice !== undefined
                  ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${selectedStock.price.toFixed(2)}｜${diff > 0 ? "+" : ""}${diff.toFixed(2)}｜${formatPercent(diffPercent)}`
                  : "尚無上一筆股價，等待下一次更新比對。"}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-yellow-950/30 p-4">
              <div className="text-xs font-bold text-yellow-300">明日觀察判斷</div>
              <div className="mt-1 text-2xl font-black text-yellow-100">{decision}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">{suggestion}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <DetailRow label="主線分數" value={scoreStock(selectedStock, mainIndustries, settings)} />
              <DetailRow label="即時強度分" value={instantScore(selectedStock, mainIndustries, settings, priceDirections)} />
              <DetailRow label="同產業排名" value={selectedIndustryRank ? `${selectedStock.industry} 第 ${selectedIndustryRank}` : "--"} />
              <DetailRow label="狀態" value={statusText(selectedStock, mainIndustries, settings, priceDirections)} />
              <DetailRow label="目前股價" value={formatNumber(selectedStock.price)} />
              <DetailRow label="股價方向" value={directionText(direction)} />
              <DetailRow label="開盤價" value={formatNumber(selectedStock.openPrice)} />
              <DetailRow label="昨收價" value={formatNumber(selectedStock.previousClose)} />
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
                進入明日觀察原因：{pickReasons(selectedStock, mainIndustries, settings, priceDirections)}
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
              <div className="text-sm font-bold text-slate-400">台股即時主線進階判斷版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">即時主線雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                即時股價 → 主流產業 → 轉強 / 轉弱 → 明日觀察。
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
              <div className="text-lg font-black">即時股價狀態：{dataStatus}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：
                {settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              健康檢查
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="今日主線分數" value={marketScore} sub={`${todayMode.label}｜${fundFlowText}`} tone={todayMode.tone} onClick={() => setTab("home")} />
          <MiniCard title="今日適合模式" value={todayMode.label} sub="依主流/過熱/轉弱判斷" tone={todayMode.tone} onClick={() => setTab("home")} />
          <MiniCard title="主流轉強" value={mainStrongList.length} sub="股價上升 + 站上開盤" tone="text-red-300" onClick={() => goMore("mainStrong")} />
          <MiniCard title="主流轉弱" value={mainWeakList.length} sub="下跌 / 跌破開盤 / 跌破昨收" tone="text-emerald-300" onClick={() => goMore("mainWeak")} />
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">最強主流產業排行</h2>

          <div className="mt-3 space-y-3">
            {industries.slice(0, 3).map((item, index) => (
              <button
                key={item.industry}
                onClick={() => goMore("industry")}
                className="w-full rounded-2xl bg-black/30 p-3 text-left"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500">#{index + 1}</div>
                    <div className="text-xl font-black text-white">{item.industry}</div>
                    <div className="mt-1 text-xs font-bold text-cyan-200">
                      即時轉強 {item.realtimeStrongCount}｜突破 {item.breakoutCount}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-yellow-300">強度 {item.score.toFixed(0)}</div>
                    <div className="text-xs font-black text-slate-400">平均 {formatPercent(item.avg)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {mainWeakList.length >= 6 && (
          <section className="mt-4 rounded-3xl border border-red-500/40 bg-red-950/30 p-5">
            <h2 className="text-xl font-black text-red-200">主流轉弱提醒</h2>
            <div className="mt-2 text-sm font-bold text-red-100">
              主流產業內轉弱股增加，先不要追高，等回測或重新站回開盤。
            </div>
          </section>
        )}

        {hotList.length >= 10 && (
          <section className="mt-4 rounded-3xl border border-red-500/40 bg-red-950/30 p-5">
            <h2 className="text-xl font-black text-red-200">今日不追高提醒</h2>
            <div className="mt-2 text-sm font-bold text-red-100">
              過熱股偏多，明天開高不要追，優先等回測開盤價。
            </div>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="50強" sub="分數 / 即時 / 漲幅 / 低價" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="明日觀察" sub={`轉強 ${tomorrowMainStrong.length}｜移除 ${tomorrowWeakRemove.length}`} badge={tomorrowCombined.length} tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <ActionCard title="主流回測雷達" sub="主流 + 接近開盤 + 未跌昨收" badge={mainPullbackList.length} tone="text-lime-300" onClick={() => goMore("mainPullback")} />
          <ActionCard title="低價主流雷達" sub={`${settings.maxPrice}內 + 主流 + 未過熱`} badge={lowMainList.length} tone="text-cyan-300" onClick={() => goMore("lowMain")} />
          <ActionCard title="高分觀察雷達" sub="主線分數70以上" badge={highScoreList.length} tone="text-yellow-300" onClick={() => goMore("highScore")} />
          <ActionCard title="過熱警示雷達" sub="漲幅過大 / 溢價過高" badge={hotRadarList.length} tone="text-red-300" onClick={() => goMore("hotRadar")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">點股票卡片可看即時判斷。</p>
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
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["score", "主線"],
                  ["instant", "即時"],
                  ["change", "漲幅"],
                  ["price", "低價"],
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

              {tab === "top50" && (
                <div className="grid grid-cols-3 gap-2">
                  {(["全部", "即時轉強", "即時轉弱", "非主流強漲", "主流", "低價", "未過熱"] as TopFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => saveSettings({ ...settings, topFilter: filter })}
                      className={`rounded-2xl py-3 text-xs font-black ${
                        settings.topFilter === filter ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="主流轉強" sub="主流 + 上升 + 未過熱" badge={mainStrongList.length} tone="text-red-300" onClick={() => setMoreView("mainStrong")} />
              <ActionCard title="主流轉弱" sub="下跌 / 跌破關鍵價" badge={mainWeakList.length} tone="text-emerald-300" onClick={() => setMoreView("mainWeak")} />
              <ActionCard title="主流回測" sub="接近開盤價" badge={mainPullbackList.length} tone="text-lime-300" onClick={() => setMoreView("mainPullback")} />
              <ActionCard title="低價主流" sub={`${settings.maxPrice}內`} badge={lowMainList.length} tone="text-cyan-300" onClick={() => setMoreView("lowMain")} />
              <ActionCard title="高分觀察" sub="70分以上" badge={highScoreList.length} tone="text-yellow-300" onClick={() => setMoreView("highScore")} />
              <ActionCard title="過熱警示" sub="獨立警示" badge={hotRadarList.length} tone="text-red-300" onClick={() => setMoreView("hotRadar")} />
              <ActionCard title="非主流強漲" sub="可能新題材" badge={nonMainStrongList.length} tone="text-yellow-300" onClick={() => setMoreView("nonMainStrong")} />
              <ActionCard title="產業熱度" sub="集中 / 擴散判斷" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="自訂股價 / 轉弱條件" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="資料健康" sub="API / 快取 / 筆數" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
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
              {tab === "more" && moreView === "mainStrong" && "📈 主流轉強雷達"}
              {tab === "more" && moreView === "mainWeak" && "📉 主流轉弱雷達"}
              {tab === "more" && moreView === "mainPullback" && "↩️ 主流回測雷達"}
              {tab === "more" && moreView === "lowMain" && "💰 低價主流雷達"}
              {tab === "more" && moreView === "highScore" && "⭐ 高分觀察雷達"}
              {tab === "more" && moreView === "hotRadar" && "🔥 過熱警示雷達"}
              {tab === "more" && moreView === "nonMainStrong" && "⚡ 非主流強漲"}
              {tab === "more" && moreView === "breakout" && "🚀 突破股"}
              {tab === "more" && moreView === "pullback" && "↩️ 回測觀察"}
              {tab === "more" && moreView === "alert" && "🚨 警報股"}
              {tab === "more" && moreView === "avoid" && "🚫 不要碰"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              資金狀態：{fundFlowText}｜主流：{mainIndustries.slice(0, 3).join("、") || "--"}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">主流轉強前5檔</h3>
                <div className="mt-3 space-y-3">
                  {mainStrongList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯主流轉強股。
                    </div>
                  )}
                  {mainStrongList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">主流轉弱提醒</h3>
                <div className="mt-3 space-y-3">
                  {mainWeakList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯主流轉弱股。
                    </div>
                  )}
                  {mainWeakList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} showReason {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">明日優先順序</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  1主流轉強 → 2主流回測 → 3非主流強漲觀察 → 4過熱不追 → 5轉弱移除
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={removeWeakTomorrow} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                    一鍵移除轉弱
                  </button>
                  <button onClick={keepOnlyMainTomorrow} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                    一鍵保留主流
                  </button>
                  <button onClick={clearTomorrow} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                    一鍵清空
                  </button>
                </div>
              </section>

              {[
                ["1 主流轉強", tomorrowMainStrong],
                ["2 主流回測", tomorrowMainPullback],
                ["3 非主流強漲觀察", tomorrowNonMainStrong],
                ["4 過熱不追", tomorrowHot],
                ["5 轉弱移除", tomorrowWeakRemove],
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
                      <StockCard key={`${title}-${stock.code}`} stock={stock} rank={index + 1} showReason {...cardProps} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
                <h3 className="text-xl font-black">資金擴散 / 集中判斷</h3>
                <div className="mt-2 text-2xl font-black text-cyan-300">{fundFlowText}</div>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  前三大產業：{mainIndustries.slice(0, 3).join("、") || "--"}
                </div>
              </div>

              {industries.slice(0, 12).map((item, index) => (
                <div key={item.industry} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                      <div className="text-2xl font-black">{item.industry}</div>
                      <div className="mt-1 text-xs font-bold text-cyan-300">
                        即時轉強 {item.realtimeStrongCount}｜突破 {item.breakoutCount}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-yellow-300">{item.count} 檔</div>
                      <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                        平均 {formatPercent(item.avg)}
                      </div>
                      <div className="text-xs font-black text-slate-400">
                        過熱 {item.hotCount}｜轉弱 {item.weakCount}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">低價上限自訂</div>
                <div className="flex gap-2">
                  <input
                    value={customMaxPrice}
                    onChange={(e) => setCustomMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="例如 180"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
                  />
                  <button
                    onClick={() => {
                      const value = n(customMaxPrice, settings.maxPrice);
                      if (value > 0) saveSettings({ ...settings, maxPrice: value });
                    }}
                    className="rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white"
                  >
                    套用
                  </button>
                </div>
                <div className="mt-2 text-xs font-bold text-slate-400">目前低價上限：{settings.maxPrice}</div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">快速股價上限</div>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 150, 200, 300].map((price) => (
                    <button
                      key={price}
                      onClick={() => {
                        setCustomMaxPrice(String(price));
                        saveSettings({ ...settings, maxPrice: price });
                      }}
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
                <div className="mb-2 text-lg font-black">轉弱條件</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["跌破開盤", "跌破昨收", "兩者都要"] as WeakRule[]).map((rule) => (
                    <button
                      key={rule}
                      onClick={() => saveSettings({ ...settings, weakRule: rule })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.weakRule === rule ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {rule}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">即時更新頻率</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    [15, "15秒"],
                    [30, "30秒"],
                    [60, "60秒"],
                    [0, "手動"],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value), dataSaver: Number(value) === 0 })}
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
                onClick={() => saveSettings({ ...settings, dataSaver: !settings.dataSaver, refreshSeconds: settings.dataSaver ? 30 : 0 })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.dataSaver ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                省流量模式：{settings.dataSaver ? "開啟" : "關閉"}
              </button>

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
              </div>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料健康檢查：{dataStatus}</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>是否使用快取：{usingCache ? "是" : "否"}</div>
                <div>更新失敗原因：{error || "無"}</div>
                <div>主流轉強：{mainStrongList.length}</div>
                <div>主流轉弱：{mainWeakList.length}</div>
                <div>自動更新頻率：{settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${settings.refreshSeconds}秒`}</div>
                <div>下一次更新：{settings.dataSaver || settings.refreshSeconds === 0 ? "--" : `${autoSeconds}s`}</div>
              </div>

              {(usingCache || error) && (
                <div className="mt-3 rounded-2xl border border-yellow-500 bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
                  ⚠️ {error || "目前使用上次成功資料，畫面不會清空。"}
                </div>
              )}

              <button onClick={loadStocks} className="mt-4 w-full rounded-2xl bg-blue-500/20 py-3 text-lg font-black text-blue-200">
                重新讀取資料
              </button>
            </div>
          )}

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["industry", "settings", "data", "menu"].includes(moreView)) && (
              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                    目前沒有符合條件的股票。
                  </div>
                )}

                {currentList.map((stock, index) => (
                  <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} showReason {...cardProps} />
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