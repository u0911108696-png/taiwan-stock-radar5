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
  | "hidden"
  | "data"
  | "settings"
  | "realtimeUp"
  | "realtimeDown"
  | "realtimeBreakout";

type PriceDirection = "up" | "down" | "same" | "new";
type MainMode = "保守" | "標準" | "積極";
type TopQuickFilter = "全部" | "主流" | "突破" | "回測" | "低價" | "未過熱" | "剛上升" | "剛下跌";
type SortKey = "score" | "change" | "price" | "realtimeUp";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  hotPercent: number;
  refreshSeconds: number;
  excludeHot: boolean;
  mainMode: MainMode;
  compactHome: boolean;
  topQuickFilter: TopQuickFilter;
  dataSaver: boolean;
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
  score: number;
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-realtime-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-realtime-last-success";
const HIDDEN_KEY = "taiwan-stock-radar-hidden";
const RANK_KEY = "taiwan-stock-radar-rank-memory";
const INDUSTRY_RANK_KEY = "taiwan-stock-radar-industry-rank-memory";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  hotPercent: 8,
  refreshSeconds: 30,
  excludeHot: true,
  mainMode: "標準",
  compactHome: false,
  topQuickFilter: "全部",
  dataSaver: false,
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
  return (Math.abs(stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function isAlert(stock: Stock, settings: Settings) {
  if (stock.price <= 0 || stock.price > settings.maxPrice) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;
  return stock.changePercent >= settings.alertPercent || (stock.openPremiumPercent ?? 0) >= 3;
}

function getIndustryRanking(stocks: Stock[], settings: Settings): IndustryItem[] {
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
        score:
          item.count * 10 +
          avg * 3 +
          item.breakoutCount * 5 -
          item.hotCount * 2 -
          item.weakCount * 2,
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
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
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

function getRankChange(code: string, currentRank: number, previousRanks: Record<string, number>) {
  const oldRank = previousRanks[code];

  if (!oldRank) return "新進";
  if (oldRank > currentRank) return `上升${oldRank - currentRank}`;
  if (oldRank < currentRank) return `下降${currentRank - oldRank}`;
  return "持平";
}

function getIndustryChange(industry: string, currentRank: number, previousIndustryRanks: Record<string, number>) {
  const oldRank = previousIndustryRanks[industry];

  if (!oldRank) return "新進";
  if (oldRank > currentRank) return `上升${oldRank - currentRank}`;
  if (oldRank < currentRank) return `下降${currentRank - oldRank}`;
  return "持平";
}

function getStockRole(stock: Stock, sameIndustryStocks: Stock[], mainIndustries: string[], settings: Settings) {
  if (isHot(stock, settings)) return "過熱股";
  if (isWeak(stock)) return "轉弱股";
  if (isPullback(stock, settings)) return "回測股";

  const topSame = sameIndustryStocks[0];

  if (topSame && topSame.code === stock.code) return "產業龍頭";
  if (mainIndustries.includes(stock.industry) && stock.changePercent >= 3) return "主流強勢股";
  if (isBreakout(stock)) return "突破股";

  return "觀察股";
}

function getPreviousPrice(code: string, previousPriceMap: Record<string, number>) {
  return previousPriceMap[code];
}

function getPriceChangeValue(stock: Stock, previousPriceMap: Record<string, number>) {
  const previous = getPreviousPrice(stock.code, previousPriceMap);
  if (previous === undefined || previous <= 0) return 0;
  return stock.price - previous;
}

function getPriceChangePercent(stock: Stock, previousPriceMap: Record<string, number>) {
  const previous = getPreviousPrice(stock.code, previousPriceMap);
  if (previous === undefined || previous <= 0) return 0;
  return ((stock.price - previous) / previous) * 100;
}

function getRealtimeSummary(priceDirections: Record<string, PriceDirection>) {
  const values = Object.values(priceDirections);
  const up = values.filter((v) => v === "up").length;
  const down = values.filter((v) => v === "down").length;
  const same = values.filter((v) => v === "same").length;
  const changed = up + down;

  if (values.length === 0) return { title: "尚未比對", text: "等待下一次更新", up, down, same, changed };
  if (changed === 0) return { title: "資料有更新", text: "但股價未變動", up, down, same, changed };
  return { title: "股價有變動", text: `上升 ${up}｜下跌 ${down}｜持平 ${same}`, up, down, same, changed };
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
  sub: string | number;
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
  previousPriceMap,
  previousRanks,
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
  previousRanks: Record<string, number>;
  lastSuccessAt: string;
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
  const rankChange = getRankChange(stock.code, rank, previousRanks);
  const previousPrice = getPreviousPrice(stock.code, previousPriceMap);
  const changeValue = getPriceChangeValue(stock, previousPriceMap);
  const changePercent = getPriceChangePercent(stock, previousPriceMap);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">
              #{rank}　{stock.code}　<span className="text-cyan-300">{rankChange}</span>
            </div>
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

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${getDirectionTone(direction)}`}>
          即時：{getDirectionText(direction)}　
          {previousPrice !== undefined ? `上一筆 ${previousPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          {previousPrice !== undefined && (
            <>
              {" ｜ "}
              {changeValue > 0 ? "+" : ""}
              {changeValue.toFixed(2)}
              {" / "}
              {formatPercent(changePercent)}
            </>
          )}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
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
  const [hiddenCodes, setHiddenCodes] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState("");

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [showMustWatchAll, setShowMustWatchAll] = useState(false);

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
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const [previousIndustryRanks, setPreviousIndustryRanks] = useState<Record<string, number>>({});
  const [lastChangedCount, setLastChangedCount] = useState(0);

  useEffect(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    setSettings(mergedSettings);
    setAutoSeconds(mergedSettings.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setTomorrowCodes(safeParse(localStorage.getItem(TOMORROW_KEY), []));
    setHiddenCodes(safeParse(localStorage.getItem(HIDDEN_KEY), []));
    setPreviousRanks(safeParse(localStorage.getItem(RANK_KEY), {}));
    setPreviousIndustryRanks(safeParse(localStorage.getItem(INDUSTRY_RANK_KEY), {}));

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

  function saveHidden(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setHiddenCodes(clean);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(clean));
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

  function hideStock(code: string) {
    saveHidden([...hiddenCodes, code]);
  }

  function unhideStock(code: string) {
    saveHidden(hiddenCodes.filter((item) => item !== code));
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

      if (stocks.length > 0) {
        const ranks: Record<string, number> = {};
        stocks.slice(0, 50).forEach((stock, index) => {
          ranks[stock.code] = index + 1;
        });
        setPreviousRanks(ranks);
        localStorage.setItem(RANK_KEY, JSON.stringify(ranks));

        const oldIndustryRanks: Record<string, number> = {};
        getIndustryRanking(stocks.slice(0, 50), settings).forEach((item, index) => {
          oldIndustryRanks[item.industry] = index + 1;
        });
        setPreviousIndustryRanks(oldIndustryRanks);
        localStorage.setItem(INDUSTRY_RANK_KEY, JSON.stringify(oldIndustryRanks));
      }

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};
      let changedCount = 0;

      normalized.forEach((stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) {
          nextDirections[stock.code] = "new";
        } else if (stock.price > oldPrice) {
          nextDirections[stock.code] = "up";
          changedCount += 1;
        } else if (stock.price < oldPrice) {
          nextDirections[stock.code] = "down";
          changedCount += 1;
        } else {
          nextDirections[stock.code] = "same";
        }
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastChangedCount(changedCount);
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

  const visibleStocks = useMemo(
    () => stocks.filter((stock) => !hiddenCodes.includes(stock.code)),
    [stocks, hiddenCodes]
  );

  const top50 = useMemo(() => visibleStocks.slice(0, 50), [visibleStocks]);

  const industries = useMemo(() => getIndustryRanking(top50, settings), [top50, settings]);

  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)), [top50, settings]);
  const weakList = useMemo(() => top50.filter(isWeak), [top50]);

  const realtimeUpList = useMemo(
    () =>
      top50
        .filter((stock) => priceDirections[stock.code] === "up")
        .sort((a, b) => getPriceChangePercent(b, previousPriceMap) - getPriceChangePercent(a, previousPriceMap)),
    [top50, priceDirections, previousPriceMap]
  );

  const realtimeDownList = useMemo(
    () =>
      top50
        .filter((stock) => priceDirections[stock.code] === "down")
        .sort((a, b) => getPriceChangePercent(a, previousPriceMap) - getPriceChangePercent(b, previousPriceMap)),
    [top50, priceDirections, previousPriceMap]
  );

  const realtimeBreakoutList = useMemo(
    () =>
      top50
        .filter((stock) => priceDirections[stock.code] === "up")
        .filter((stock) => stock.price >= stock.openPrice)
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))
        .slice(0, 30),
    [top50, priceDirections, mainIndustries, settings]
  );

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

  const cleanBreakoutList = useMemo(
    () =>
      top50
        .filter((stock) => mainIndustries.includes(stock.industry))
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => stock.price <= settings.maxPrice)
        .filter((stock) => stock.price >= stock.openPrice)
        .filter(isBreakout)
        .slice(0, 20),
    [top50, mainIndustries, settings]
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

  const bestPullbackList = useMemo(
    () =>
      pullbackList
        .filter((stock) => stock.price >= stock.previousClose)
        .filter((stock) => mainIndustries.includes(stock.industry))
        .slice(0, 20),
    [pullbackList, mainIndustries]
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

  const todayMustWatch10 = useMemo(() => tomorrowAutoList.slice(0, 10), [tomorrowAutoList]);
  const todayMustWatch = useMemo(
    () => (showMustWatchAll ? todayMustWatch10 : todayMustWatch10.slice(0, 3)),
    [showMustWatchAll, todayMustWatch10]
  );

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => visibleStocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, visibleStocks]
  );

  const tomorrowStocksManual = useMemo(
    () => tomorrowCodes.map((code) => visibleStocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [tomorrowCodes, visibleStocks]
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

  const tomorrowRealtimeStrong = useMemo(
    () =>
      tomorrowCombined
        .filter((stock) => priceDirections[stock.code] === "up" || stock.price >= stock.openPrice)
        .filter((stock) => !isWeak(stock)),
    [tomorrowCombined, priceDirections]
  );

  const tomorrowRealtimeWeak = useMemo(
    () =>
      tomorrowCombined
        .filter((stock) => priceDirections[stock.code] === "down" || stock.price < stock.openPrice || stock.price < stock.previousClose),
    [tomorrowCombined, priceDirections]
  );

  const signal = useMemo(() => getMarketSignal(top50, alertList, hotList), [top50, alertList, hotList]);

  const realtimeSummary = useMemo(() => getRealtimeSummary(priceDirections), [priceDirections]);

  const mainConcentration = useMemo(() => {
    const count = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    const percent = top50.length ? (count / top50.length) * 100 : 0;

    if (percent >= 45) return { label: "高", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-emerald-300" };
    if (percent >= 30) return { label: "中", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-yellow-300" };
    return { label: "低", text: `前三大產業佔 ${percent.toFixed(0)}%`, tone: "text-red-300" };
  }, [top50, mainIndustries]);

  const todaySentence = useMemo(() => {
    const main = mainIndustries[0] || "主流產業";
    if (hotList.length >= 15) return `資金集中在${main}，但過熱股多，明天開高不要追。`;
    if (realtimeBreakoutList.length >= 5) return `資金集中在${main}，即時突破股增加，優先觀察未過熱主流股。`;
    if (cleanBreakoutList.length >= 5) return `資金集中在${main}，優先看乾淨突破股。`;
    return `資金集中在${mainIndustries.slice(0, 3).join("、") || "主流產業"}，只挑未過熱高分股。`;
  }, [mainIndustries, hotList, cleanBreakoutList, realtimeBreakoutList]);

  const tradeSuitability = useMemo(() => {
    if (hotList.length >= 15) return { label: "不適合追高", tone: "text-red-300" };
    if (bestPullbackList.length >= 5) return { label: "等回測", tone: "text-yellow-300" };
    if (realtimeBreakoutList.length >= 5) return { label: "即時轉強", tone: "text-red-300" };
    if (cleanBreakoutList.length >= 5) return { label: "適合觀察", tone: "text-emerald-300" };
    return { label: "小心觀察", tone: "text-yellow-300" };
  }, [hotList, bestPullbackList, cleanBreakoutList, realtimeBreakoutList]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "使用快取";
    if (lastSuccessAt) return "即時正常";
    return "讀取中";
  }, [updating, error, usingCache, lastSuccessAt]);

  const selectedStock = useMemo(
    () => visibleStocks.find((stock) => stock.code === selectedCode) || null,
    [visibleStocks, selectedCode]
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

  function filterTop50(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topQuickFilter === "主流") arr = arr.filter((stock) => mainIndustries.includes(stock.industry));
      if (settings.topQuickFilter === "突破") arr = arr.filter(isBreakout);
      if (settings.topQuickFilter === "回測") arr = arr.filter((stock) => isPullback(stock, settings));
      if (settings.topQuickFilter === "低價") arr = arr.filter((stock) => stock.price <= settings.maxPrice);
      if (settings.topQuickFilter === "未過熱") arr = arr.filter((stock) => !isHot(stock, settings));
      if (settings.topQuickFilter === "剛上升") arr = arr.filter((stock) => priceDirections[stock.code] === "up");
      if (settings.topQuickFilter === "剛下跌") arr = arr.filter((stock) => priceDirections[stock.code] === "down");
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
    if (sortKey === "realtimeUp") {
      return arr.sort((a, b) => getPriceChangePercent(b, previousPriceMap) - getPriceChangePercent(a, previousPriceMap));
    }

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
      if (moreView === "hidden") return stocks.filter((stock) => hiddenCodes.includes(stock.code));
      if (moreView === "realtimeUp") return sortList(realtimeUpList);
      if (moreView === "realtimeDown") return sortList(realtimeDownList);
      if (moreView === "realtimeBreakout") return sortList(realtimeBreakoutList);
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
    stocks,
    hiddenCodes,
    realtimeUpList,
    realtimeDownList,
    realtimeBreakoutList,
    searchText,
    sortKey,
    mainIndustries,
    settings,
    previousPriceMap,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  function openLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addTodayMustWatch() {
    const codes = todayMustWatch10.map((stock) => stock.code);
    saveTomorrow([...tomorrowCodes, ...codes]);
    setTab("tomorrow");
  }

  function addCurrentListToTomorrow() {
    const codes = currentList.map((stock) => stock.code);
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

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    tomorrowCodes,
    priceDirections,
    previousPriceMap,
    previousRanks,
    lastSuccessAt,
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
    const role = getStockRole(selectedStock, sameIndustryStocks, mainIndustries, settings);
    const previousPrice = previousPriceMap[selectedStock.code];
    const instantChange = getPriceChangeValue(selectedStock, previousPriceMap);
    const instantChangePercent = getPriceChangePercent(selectedStock, previousPriceMap);

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

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">即時股價變動</div>
              <div className={`mt-1 text-2xl font-black ${getDirectionTone(direction)}`}>
                {getDirectionText(direction)}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {previousPrice !== undefined
                  ? `上一筆 ${previousPrice.toFixed(2)} → 現在 ${selectedStock.price.toFixed(2)}｜${instantChange > 0 ? "+" : ""}${instantChange.toFixed(2)}｜${formatPercent(instantChangePercent)}`
                  : "尚無上一筆股價，等待下一次更新比對。"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                更新：{selectedStock.updatedAt || lastSuccessAt || "--"}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl p-4 ${isMainLine ? "bg-emerald-950/40" : "bg-red-950/30"}`}>
              <div className="text-xs font-bold text-slate-400">是否符合主線</div>
              <div className={`mt-1 text-2xl font-black ${isMainLine ? "text-emerald-300" : "text-red-300"}`}>
                {isMainLine ? "符合主線" : "不符合主線"}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                今日角色：{role}
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
              <DetailRow label="同產業排名" value={selectedIndustryRank ? `${selectedStock.industry} 第 ${selectedIndustryRank}` : "--"} />
              <DetailRow label="今日角色" value={role} />
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
              <div className="text-sm font-bold text-slate-400">台股即時股價強化版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">主流產業即時雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                50強 → 主流產業 → 即時股價變動 → 明日觀察。
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
              <div className="text-lg font-black">即時股價狀態：{dataStatus}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次更新：
                {settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-cyan-300">
                {realtimeSummary.title}｜{realtimeSummary.text}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              健康檢查
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="即時變動" value={realtimeSummary.changed} sub={realtimeSummary.text} tone="text-cyan-300" onClick={() => goMore("realtimeUp")} />
          <MiniCard title="即時上升" value={realtimeUpList.length} sub="這次更新股價上升" tone="text-red-300" onClick={() => goMore("realtimeUp")} />
          <MiniCard title="即時下跌" value={realtimeDownList.length} sub="這次更新股價下跌" tone="text-emerald-300" onClick={() => goMore("realtimeDown")} />
          <MiniCard title="即時突破" value={realtimeBreakoutList.length} sub="上升 + 主流 + 突破" tone="text-yellow-300" onClick={() => goMore("realtimeBreakout")} />
          <MiniCard title="資金方向" value={mainIndustries[0] || "--"} sub={todaySentence} tone="text-cyan-300" onClick={() => goMore("industry")} />
          <MiniCard title="適合操作嗎" value={tradeSuitability.label} sub="依即時突破 / 過熱判斷" tone={tradeSuitability.tone} onClick={() => setTab("home")} />
        </section>

        {!settings.compactHome && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">主流強度條</h2>

            <div className="mt-4 space-y-3">
              {industries.slice(0, 3).map((item, index) => {
                const maxScore = Math.max(industries[0]?.score || 1, 1);
                const width = Math.min(100, Math.max(8, (item.score / maxScore) * 100));

                return (
                  <div key={item.industry}>
                    <div className="mb-1 flex justify-between text-xs font-black text-slate-300">
                      <span>#{index + 1} {item.industry}</span>
                      <span>強度 {item.score.toFixed(0)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="50強" sub="今日漲幅排行" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="乾淨突破" sub="主流 + 低價 + 未過熱" badge={cleanBreakoutList.length} tone="text-orange-300" onClick={() => goMore("breakout")} />
          <ActionCard title="最佳回測" sub="接近開盤 / 未跌昨收" badge={bestPullbackList.length} tone="text-lime-300" onClick={() => goMore("pullback")} />
          <ActionCard title="低價警報" sub={`${settings.maxPrice}元內未過熱`} badge={alertList.length} tone="text-orange-300" onClick={() => goMore("alert")} />
          <ActionCard title="明日觀察" sub={`轉強 ${tomorrowRealtimeStrong.length}｜轉弱 ${tomorrowRealtimeWeak.length}`} badge={tomorrowCombined.length} tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <ActionCard title="自選股" sub="即時提醒" badge={favoriteStocks.length} tone="text-yellow-300" onClick={() => setTab("favorite")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">點股票卡片可看即時股價與K線。</p>
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
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                ["score", "分數"],
                ["change", "漲幅"],
                ["price", "低價"],
                ["realtimeUp", "剛上升"],
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
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="即時上升雷達" sub="這次更新上升" badge={realtimeUpList.length} tone="text-red-300" onClick={() => setMoreView("realtimeUp")} />
              <ActionCard title="即時下跌雷達" sub="這次更新下跌" badge={realtimeDownList.length} tone="text-emerald-300" onClick={() => setMoreView("realtimeDown")} />
              <ActionCard title="突破即時雷達" sub="上升 + 主流 + 突破" badge={realtimeBreakoutList.length} tone="text-yellow-300" onClick={() => setMoreView("realtimeBreakout")} />
              <ActionCard title="產業熱度" sub="變化 / 龍頭" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="突破股" sub="乾淨突破優先" badge={cleanBreakoutList.length} tone="text-orange-300" onClick={() => setMoreView("breakout")} />
              <ActionCard title="回測觀察" sub="最佳回測" badge={bestPullbackList.length} tone="text-lime-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="低價警報" sub="分等級" badge={alertList.length} tone="text-orange-300" onClick={() => setMoreView("alert")} />
              <ActionCard title="不要碰" sub="可暫時隱藏" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoid")} />
              <ActionCard title="設定" sub="即時更新頻率 / 省流量" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="資料健康檢查" sub="API / 快取 / 筆數" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
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
              {tab === "more" && moreView === "hidden" && "🙈 已隱藏"}
              {tab === "more" && moreView === "realtimeUp" && "📈 即時上升雷達"}
              {tab === "more" && moreView === "realtimeDown" && "📉 即時下跌雷達"}
              {tab === "more" && moreView === "realtimeBreakout" && "⚡ 突破即時雷達"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              今日一句話：{todaySentence}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
                <h3 className="text-xl font-black">即時股價摘要</h3>
                <div className="mt-2 text-sm font-bold leading-6 text-cyan-100">
                  {realtimeSummary.title}：{realtimeSummary.text}。  
                  最後成功更新：{lastSuccessAt || "尚未成功"}。
                </div>
              </section>

              {!settings.compactHome && (
                <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                  <h3 className="text-xl font-black">今天適合操作嗎</h3>
                  <div className={`mt-2 text-2xl font-black ${tradeSuitability.tone}`}>
                    {tradeSuitability.label}
                  </div>
                  <div className="mt-2 text-sm font-bold text-yellow-100">
                    判斷依據：過熱股 {hotList.length}｜即時突破 {realtimeBreakoutList.length}｜乾淨突破 {cleanBreakoutList.length}
                  </div>
                </section>
              )}

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black">今日必看</h3>
                  <button
                    onClick={() => setShowMustWatchAll(!showMustWatchAll)}
                    className="rounded-2xl bg-yellow-500/20 px-3 py-2 text-xs font-black text-yellow-200"
                  >
                    {showMustWatchAll ? "收合3檔" : "展開10檔"}
                  </button>
                </div>

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
            </div>
          )}

          {tab === "top50" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">快速切換</h3>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {(["全部", "主流", "突破", "回測", "低價", "未過熱", "剛上升", "剛下跌"] as TopQuickFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => saveSettings({ ...settings, topQuickFilter: filter })}
                      className={`rounded-2xl py-3 text-xs font-black ${
                        settings.topQuickFilter === filter ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <button
                  onClick={addCurrentListToTomorrow}
                  className="mt-3 w-full rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
                >
                  一鍵加入目前清單到明日觀察
                </button>
              </section>

              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                    目前沒有符合條件的股票。
                  </div>
                )}

                {currentList.map((stock, index) => (
                  <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">觀察股即時提醒</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  觀察股轉強 {tomorrowRealtimeStrong.length}｜觀察股轉弱 {tomorrowRealtimeWeak.length}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={organizeTomorrow} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                    收盤後整理
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
                ["觀察股轉強", tomorrowRealtimeStrong],
                ["觀察股轉弱", tomorrowRealtimeWeak],
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
                      <StockCard key={`${title}-${stock.code}`} stock={stock} rank={index + 1} showReason {...cardProps} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industries.slice(0, 12).map((item, index) => {
                const leader = item.stocks
                  .slice()
                  .sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings))[0];
                const change = getIndustryChange(item.industry, index + 1, previousIndustryRanks);

                return (
                  <div key={item.industry} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-500">#{index + 1}｜{change}</div>
                        <div className="text-2xl font-black">{item.industry}</div>
                        <div className="mt-1 text-xs font-black text-cyan-300">
                          龍頭：{leader ? `${leader.code} ${leader.name}` : "--"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black text-yellow-300">{item.count} 檔</div>
                        <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                          平均 {formatPercent(item.avg)}
                        </div>
                        <div className="text-xs font-black text-cyan-300">
                          突破 {item.breakoutCount}｜過熱 {item.hotCount}｜轉弱 {item.weakCount}
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
                );
              })}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <button
                onClick={() => saveSettings({ ...settings, compactHome: !settings.compactHome })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.compactHome ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                首頁精簡模式：{settings.compactHome ? "開啟" : "關閉"}
              </button>

              <button
                onClick={() => saveSettings({ ...settings, dataSaver: !settings.dataSaver, refreshSeconds: settings.dataSaver ? 30 : 0 })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.dataSaver ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                省流量模式：{settings.dataSaver ? "開啟" : "關閉"}
              </button>

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
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料健康檢查：{dataStatus}</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>可見筆數：{visibleStocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>是否使用快取：{usingCache ? "是" : "否"}</div>
                <div>更新失敗原因：{error || "無"}</div>
                <div>這次股價變動：{lastChangedCount} 檔</div>
                <div>即時上升：{realtimeUpList.length}</div>
                <div>即時下跌：{realtimeDownList.length}</div>
                <div>即時突破：{realtimeBreakoutList.length}</div>
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
            tab !== "top50" &&
            !(tab === "more" && ["industry", "settings", "data", "menu"].includes(moreView)) && (
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
                      showReason={tab === "more" && (moreView === "alert" || moreView === "pullback" || moreView === "breakout" || moreView === "realtimeBreakout")}
                      {...cardProps}
                    />

                    {tab === "more" && moreView === "pullback" && (
                      <div className="mt-1 rounded-2xl bg-lime-950/40 p-3 text-xs font-black text-lime-100">
                        回測接近度：距離開盤價 {pullbackDistance(stock).toFixed(2)}%
                      </div>
                    )}

                    {tab === "more" && moreView === "alert" && (
                      <div className="mt-1 rounded-2xl bg-orange-950/40 p-3 text-xs font-black text-orange-100">
                        警報等級：
                        {stock.changePercent >= settings.hotPercent
                          ? "過熱警報"
                          : stock.changePercent >= settings.alertPercent + 2
                            ? "強警報"
                            : "普通警報"}
                      </div>
                    )}

                    {tab === "more" && moreView === "avoid" && (
                      <div className="mt-1 rounded-2xl bg-red-950/40 p-3 text-xs font-black text-red-100">
                        原因：{getAvoidReason(stock, mainIndustries, settings)}
                        <br />
                        可重新觀察：{getRewatchCondition(stock, mainIndustries, settings)}
                        <button
                          onClick={() => hideStock(stock.code)}
                          className="mt-2 w-full rounded-xl bg-red-500/20 py-2 text-xs font-black text-red-200"
                        >
                          暫時隱藏
                        </button>
                      </div>
                    )}

                    {tab === "more" && moreView === "hidden" && (
                      <button
                        onClick={() => unhideStock(stock.code)}
                        className="mt-1 w-full rounded-2xl bg-slate-800 py-3 text-xs font-black text-slate-200"
                      >
                        恢復顯示
                      </button>
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