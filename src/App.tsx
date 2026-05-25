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
  updatedAt?: string;
};

type TabKey = "home" | "top" | "observe" | "favorite" | "more";

type MoreView =
  | "menu"
  | "industry"
  | "settings"
  | "avoid"
  | "pullback"
  | "breakout"
  | "open910"
  | "today"
  | "data"
  | "stats"
  | "alerts";

type SortKey = "score" | "change" | "priceLow" | "industry";
type ObserveGroup = "明天優先" | "等回測" | "不追高";
type FavoriteGroup = "短線觀察" | "明天追蹤" | "長期關注";
type ResultStatus = "成功續強" | "失敗轉弱";
type PriceDirection = "up" | "down" | "same" | "new";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  openPremiumPercent: number;
  excludeHot: boolean;
  maxObserve: number;
  minChangePercent: number;
  minVolume: number;
  onlyActiveFavorite: boolean;
  refreshSeconds: number;
};

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
const OBSERVE_KEY = "taiwan-stock-radar-observe";
const SETTINGS_KEY = "taiwan-stock-radar-settings";
const OBSERVE_GROUP_KEY = "taiwan-stock-radar-observe-groups";
const FAVORITE_GROUP_KEY = "taiwan-stock-radar-favorite-groups";
const RESULT_KEY = "taiwan-stock-radar-results";
const PREVIOUS_RANK_KEY = "taiwan-stock-radar-prev-ranks";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-last-success";
const NOTES_KEY = "taiwan-stock-radar-notes";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  openPremiumPercent: 3,
  excludeHot: true,
  maxObserve: 15,
  minChangePercent: 0,
  minVolume: 0,
  onlyActiveFavorite: false,
  refreshSeconds: 30,
};

const noteTemplates = ["等回測", "看續強", "不追高", "跌破開盤出場"];

const industryMap: Record<string, string> = {
  "1101": "水泥", "1102": "水泥",
  "1216": "食品", "1227": "食品",
  "1301": "塑化", "1303": "塑化", "6505": "塑化",
  "1717": "化工", "1722": "化工",
  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵",
  "2201": "汽車", "2207": "汽車", "2227": "汽車",
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

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
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

function nowTimeText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function normalizeStock(raw: any, fallbackUpdatedAt?: string): Stock {
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
    updatedAt: String(raw.updatedAt ?? raw.time ?? raw.updateTime ?? fallbackUpdatedAt ?? nowTimeText()),
  };
}

function getTaiwanNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

function getMarketStatus() {
  const now = getTaiwanNow();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (day === 0 || day === 6) return "休市";
  if (minutes < 9 * 60) return "開盤前";
  if (minutes >= 9 * 60 && minutes <= 9 * 60 + 20) return "9:10觀察";
  if (minutes > 9 * 60 + 20 && minutes < 13 * 60 + 30) return "盤中";
  return "收盤後";
}

function getTimeTip() {
  const status = getMarketStatus();

  if (status === "開盤前") return "先等9:10，不要太早追。";
  if (status === "9:10觀察") return "現在看9:10清單。";
  if (status === "盤中") return "只看未過熱、未轉弱、高分股。";
  if (status === "收盤後") return "現在適合建立明天觀察清單。";
  return "休市可整理自選與觀察。";
}

function getOpen910Countdown() {
  const now = getTaiwanNow();
  const target = new Date(now);
  target.setHours(9, 10, 0, 0);

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "今天9:10已過";

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `距離9:10還有 ${mins}分${secs}秒`;
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

function isWeak(stock: Stock) {
  if (stock.price < stock.openPrice) return true;
  if (stock.changePercent < 2) return true;

  if (
    stock.openPremiumPercent !== null &&
    stock.openPremiumPercent >= 3 &&
    stock.changePercent < stock.openPremiumPercent
  ) {
    return true;
  }

  return false;
}

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice && stock.volume > 0;
}

function isPullbackCandidate(stock: Stock, settings: Settings) {
  if (!isUnderPrice(stock, settings)) return false;
  if (isHot(stock, settings)) return false;
  if (stock.changePercent < 2) return false;
  if (stock.openPrice <= 0) return false;

  const nearOpen = Math.abs(stock.price - stock.openPrice) / stock.openPrice <= 0.015;
  return nearOpen && stock.price >= stock.openPrice * 0.985;
}

function isAlert(stock: Stock, settings: Settings) {
  if (!isUnderPrice(stock, settings)) return false;
  if (settings.excludeHot && isHot(stock, settings)) return false;
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

function getScoreParts(stock: Stock, mainIndustries: string[], settings: Settings) {
  return [
    { label: `股價${settings.maxPrice}元內`, value: isUnderPrice(stock, settings) ? 25 : stock.price > settings.maxPrice ? -100 : 0 },
    { label: "主流產業", value: mainIndustries.includes(stock.industry) ? 25 : 0 },
    { label: "漲幅3%～7.5%", value: stock.changePercent >= 3 && stock.changePercent <= 7.5 ? 20 : 0 },
    { label: "強於開盤", value: stock.price >= stock.openPrice ? 15 : 0 },
    { label: "開盤溢價合理", value: (stock.openPremiumPercent ?? 0) >= 0 && (stock.openPremiumPercent ?? 0) <= settings.openPremiumPercent + 1 ? 10 : 0 },
    { label: "量能放大", value: (stock.volumeRatio ?? 0) >= 1.2 ? 10 : 0 },
    { label: "低風險", value: getRisk(stock) === "低" ? 10 : getRisk(stock) === "中" ? 5 : 0 },
    { label: "過熱扣分", value: isHot(stock, settings) ? -30 : 0 },
    { label: "轉弱扣分", value: isWeak(stock) ? -20 : 0 },
    { label: "量太低扣分", value: stock.volume < settings.minVolume ? -20 : 0 },
  ];
}

function scoreStock(stock: Stock, mainIndustries: string[], settings: Settings) {
  const total = getScoreParts(stock, mainIndustries, settings).reduce((sum, item) => sum + item.value, 0);
  return Math.max(0, total);
}

function scoreText(score: number) {
  if (score >= 80) return "🟢 優先";
  if (score >= 60) return "🟡 觀察";
  return "⚪ 普通";
}

function getStatusTag(stock: Stock, settings: Settings) {
  if (isHot(stock, settings)) return "過熱";
  if (isWeak(stock)) return "轉弱";
  if (isAlert(stock, settings)) return "警報";
  if (isBreakout(stock)) return "突破";
  if (isPullbackCandidate(stock, settings)) return "回測";
  return "觀察";
}

function getEntryType(stock: Stock, settings: Settings) {
  if (isHot(stock, settings)) return "過熱型";
  if (isWeak(stock)) return "轉弱型";
  if (isPullbackCandidate(stock, settings)) return "回測型";
  if (isBreakout(stock)) return "突破型";
  return "普通型";
}

function getActionConclusion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const score = scoreStock(stock, mainIndustries, settings);

  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock)) return "轉弱刪除";
  if (isPullbackCandidate(stock, settings)) return "等回測";
  if (score >= 80) return "可觀察";
  if (score >= 60) return "小心觀察";
  return "暫不追";
}

function getChaseRisk(stock: Stock, settings: Settings) {
  let risk = 0;

  if (stock.changePercent >= 8) risk += 3;
  else if (stock.changePercent >= 5) risk += 2;
  else if (stock.changePercent >= 3) risk += 1;

  if ((stock.openPremiumPercent ?? 0) >= settings.openPremiumPercent + 2) risk += 2;
  if (isHot(stock, settings)) risk += 2;
  if (isWeak(stock)) risk += 1;

  if (risk >= 5) return "高";
  if (risk >= 3) return "中";
  return "低";
}

function getTomorrowPlan(stock: Stock, mainIndustries: string[], settings: Settings) {
  const conclusion = getActionConclusion(stock, mainIndustries, settings);

  if (conclusion === "不追高") return "明天若開高不追，等回測開盤價或昨收附近。";
  if (conclusion === "轉弱刪除") return "明天若仍跌破開盤或漲幅低於2%，先移出觀察。";
  if (conclusion === "等回測") return "明天觀察是否守住開盤價附近，站回後再看續強。";
  if (conclusion === "可觀察") return "明天先看9:10是否續強，未過熱才列優先。";
  return "明天只觀察，不追高，等更明確轉強。";
}

function getShortReason(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];

  if (mainIndustries.includes(stock.industry)) reasons.push("主流");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  if (stock.price >= stock.openPrice) reasons.push("強於開盤");
  if (scoreStock(stock, mainIndustries, settings) >= 80) reasons.push("高分");

  return reasons.length ? reasons.join(" / ") : "普通";
}

function getSignal(top50: Stock[], alerts: Stock[], hotList: Stock[]) {
  const strong = top50.filter((s) => s.changePercent >= 3).length;

  if (hotList.length >= 15) {
    return {
      title: "🔴 紅燈",
      text: "過熱偏多，先不要追高。",
      color: "border-red-500 bg-red-950/30 text-red-100",
    };
  }

  if (strong >= 20 && alerts.length >= 8) {
    return {
      title: "🟢 綠燈",
      text: "資金偏強，先看主流產業與Top10。",
      color: "border-emerald-500 bg-emerald-950/30 text-emerald-100",
    };
  }

  return {
    title: "🟡 黃燈",
    text: "盤勢普通，只看高分股。",
    color: "border-yellow-500 bg-yellow-950/30 text-yellow-100",
  };
}

function getTodaySentence(signalTitle: string, mainIndustries: string[], hotCount: number) {
  if (signalTitle.includes("綠")) return `今日主流偏強，先看 ${mainIndustries.slice(0, 2).join("、") || "Top10"}，不追過熱。`;
  if (signalTitle.includes("紅")) return `今日過熱股 ${hotCount} 檔，先保守，等回測。`;
  return "今日盤勢普通，只看高分股與主流產業。";
}

function sortStocks(list: Stock[], sortKey: SortKey, mainIndustries: string[], settings: Settings) {
  const arr = [...list];

  if (sortKey === "priceLow") return arr.sort((a, b) => a.price - b.price);
  if (sortKey === "industry") return arr.sort((a, b) => a.industry.localeCompare(b.industry) || b.changePercent - a.changePercent);
  if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);

  return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
}

function getKLinks(code: string, name: string) {
  const twCode = `${code}.TW`;

  return {
    yahoo: `https://tw.stock.yahoo.com/quote/${twCode}/technical-analysis`,
    tradingView: `https://www.tradingview.com/chart/?symbol=TWSE%3A${code}`,
    goodinfo: `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${code}`,
    google: `https://www.google.com/search?q=${code}+${encodeURIComponent(name)}+K線`,
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

function StockCard({
  stock,
  rank,
  mainIndustries,
  settings,
  favoriteCodes,
  observeCodes,
  previousRanks,
  priceDirections,
  onOpenDetail,
  onAddFavorite,
  onRemoveFavorite,
  onAddObserve,
  onRemoveObserve,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  observeCodes: string[];
  previousRanks: Record<string, number>;
  priceDirections: Record<string, PriceDirection>;
  onOpenDetail: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddObserve: (code: string) => void;
  onRemoveObserve: (code: string) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isObserve = observeCodes.includes(stock.code);
  const score = scoreStock(stock, mainIndustries, settings);
  const previousRank = previousRanks[stock.code];
  const newEntry = !previousRank;
  const rankUp = previousRank ? previousRank - rank : 0;
  const direction = priceDirections[stock.code];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 shadow-lg">
      <button onClick={() => onOpenDetail(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-400">
              #{rank}　{stock.code}
              {newEntry && <span className="ml-2 text-cyan-300">新</span>}
              {rankUp > 0 && <span className="ml-2 text-lime-300">↑{rankUp}</span>}
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
          <span className="rounded-full bg-slate-800 px-3 py-1">{getStatusTag(stock, settings)}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{getEntryType(stock, settings)}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">分數 {score}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${getDirectionTone(direction)}`}>
            {getDirectionText(direction)}
          </span>
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
          {isObserve && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">觀察</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          結論：{getActionConclusion(stock, mainIndustries, settings)}｜更新：{stock.updatedAt || "--"}
        </div>
      </button>

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
          {isObserve ? "📌 移除觀察" : "📌 加入觀察"}
        </button>
      </div>
    </div>
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

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);

  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState("");
  const [apiDataTime, setApiDataTime] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  const [tab, setTab] = useState<TabKey>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [autoSeconds, setAutoSeconds] = useState(defaultSettings.refreshSeconds);

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [observeCodes, setObserveCodes] = useState<string[]>([]);
  const [observeGroups, setObserveGroups] = useState<Record<string, ObserveGroup>>({});
  const [favoriteGroups, setFavoriteGroups] = useState<Record<string, FavoriteGroup>>({});
  const [resultMap, setResultMap] = useState<Record<string, ResultStatus>>({});
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceDirections, setPriceDirections] = useState<Record<string, PriceDirection>>({});
  const [lastPriceMap, setLastPriceMap] = useState<Record<string, number>>({});

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [favoriteInput, setFavoriteInput] = useState("");

  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [mainOnly, setMainOnly] = useState(false);
  const [onlyWatchable, setOnlyWatchable] = useState(false);
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [onlyLowPrice, setOnlyLowPrice] = useState(false);
  const [hideHot, setHideHot] = useState(false);
  const [hideWeak, setHideWeak] = useState(false);

  const [selectedCode, setSelectedCode] = useState("");

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITE_KEY);
      if (savedFavorites) setFavoriteCodes(JSON.parse(savedFavorites));

      const savedObserve = localStorage.getItem(OBSERVE_KEY);
      if (savedObserve) setObserveCodes(JSON.parse(savedObserve));

      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = { ...defaultSettings, ...JSON.parse(savedSettings) };
        setSettings(parsed);
        setAutoSeconds(parsed.refreshSeconds);
      }

      const savedObserveGroups = localStorage.getItem(OBSERVE_GROUP_KEY);
      if (savedObserveGroups) setObserveGroups(JSON.parse(savedObserveGroups));

      const savedFavoriteGroups = localStorage.getItem(FAVORITE_GROUP_KEY);
      if (savedFavoriteGroups) setFavoriteGroups(JSON.parse(savedFavoriteGroups));

      const savedResult = localStorage.getItem(RESULT_KEY);
      if (savedResult) setResultMap(JSON.parse(savedResult));

      const savedRanks = localStorage.getItem(PREVIOUS_RANK_KEY);
      if (savedRanks) setPreviousRanks(JSON.parse(savedRanks));

      const savedNotes = localStorage.getItem(NOTES_KEY);
      if (savedNotes) setNotes(JSON.parse(savedNotes));

      const last = localStorage.getItem(LAST_SUCCESS_KEY);
      if (last) {
        const parsed = JSON.parse(last);

        if (Array.isArray(parsed.stocks)) {
          setStocks(parsed.stocks);
          setUsingCachedData(true);

          const prices: Record<string, number> = {};
          parsed.stocks.forEach((stock: Stock) => {
            prices[stock.code] = stock.price;
          });
          setLastPriceMap(prices);
        }

        if (parsed.apiDataTime) setApiDataTime(parsed.apiDataTime);
        if (parsed.source) setSource(parsed.source);
        if (parsed.lastSuccessAt) setLastSuccessAt(parsed.lastSuccessAt);
      }
    } catch {
      setSettings(defaultSettings);
      setAutoSeconds(defaultSettings.refreshSeconds);
    }
  }, []);

  function saveSettings(next: Settings) {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setAutoSeconds(next.refreshSeconds);
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

  function saveObserveGroups(next: Record<string, ObserveGroup>) {
    setObserveGroups(next);
    localStorage.setItem(OBSERVE_GROUP_KEY, JSON.stringify(next));
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
    setTab("favorite");
    setFavoriteInput("");
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

  function setObserveGroupNow(code: string, group: ObserveGroup) {
    const next = { ...observeGroups, [code]: group };
    saveObserveGroups(next);
  }

  function setObserveByGroup(code: string, group: ObserveGroup) {
    saveObserveCodes([...observeCodes, code]);
    setObserveGroupNow(code, group);
  }

  function buildTomorrowList(codes: string[]) {
    saveObserveCodes(codes);
    setTab("observe");
  }

  function removeWeakObserve() {
    const weakCodes = new Set(observeStocks.filter(isWeak).map((s) => s.code));
    saveObserveCodes(observeCodes.filter((code) => !weakCodes.has(code)));
  }

  function removeHotObserve() {
    const hotCodes = new Set(observeStocks.filter((s) => isHot(s, settings)).map((s) => s.code));
    saveObserveCodes(observeCodes.filter((code) => !hotCodes.has(code)));
  }

  function organizeObserveList() {
    const keepCodes: string[] = [];
    const nextGroups = { ...observeGroups };

    observeStocks.forEach((stock) => {
      if (isWeak(stock)) return;

      keepCodes.push(stock.code);

      if (isHot(stock, settings)) {
        nextGroups[stock.code] = "不追高";
      } else if (isPullbackCandidate(stock, settings)) {
        nextGroups[stock.code] = "等回測";
      } else if (scoreStock(stock, mainIndustries, settings) >= 80) {
        nextGroups[stock.code] = "明天優先";
      }
    });

    saveObserveCodes(keepCodes);
    saveObserveGroups(nextGroups);
  }

  function addActiveFavoritesToObserve() {
    const active = favoriteStocksRaw
      .filter((stock) => isAlert(stock, settings) || isBreakout(stock) || scoreStock(stock, mainIndustries, settings) >= 60)
      .map((stock) => stock.code);

    saveObserveCodes([...observeCodes, ...active]);
    setTab("observe");
  }

  async function loadStocks(manual = false) {
    try {
      setError("");
      setUpdating(true);
      setLastAttemptAt(nowTimeText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });

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

      const dataTime =
        json.updatedAtTaiwan ||
        (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : nowTimeText());

      const normalized = list
        .map((raw) => normalizeStock(raw, dataTime))
        .filter((stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      if (normalized.length === 0) {
        throw new Error("API 回傳空資料");
      }

      if (stocks.length > 0) {
        const oldRanks: Record<string, number> = {};
        stocks.slice(0, 50).forEach((stock, index) => {
          oldRanks[stock.code] = index + 1;
        });
        setPreviousRanks(oldRanks);
        localStorage.setItem(PREVIOUS_RANK_KEY, JSON.stringify(oldRanks));
      }

      const nextDirections: Record<string, PriceDirection> = {};
      const nextPriceMap: Record<string, number> = {};

      normalized.forEach((stock) => {
        const oldPrice = lastPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) {
          nextDirections[stock.code] = "new";
        } else if (stock.price > oldPrice) {
          nextDirections[stock.code] = "up";
        } else if (stock.price < oldPrice) {
          nextDirections[stock.code] = "down";
        } else {
          nextDirections[stock.code] = "same";
        }
      });

      const successTime = nowTimeText();
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCachedData(false);

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
      setUsingCachedData(true);
      setError(err?.message || "資料讀取失敗，已保留上次成功資料");
    } finally {
      setLoading(false);
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  useEffect(() => {
    loadStocks(true);
  }, []);

  useEffect(() => {
    if (settings.refreshSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setAutoSeconds((seconds) => {
        if (seconds <= 1) {
          loadStocks(false);
          return settings.refreshSeconds;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [settings.refreshSeconds, stocks, lastPriceMap]);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const industries = useMemo(() => getIndustryRanking(top50), [top50]);
  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const baseFiltered = useMemo(() => {
    return top50
      .filter((stock) => isUnderPrice(stock, settings))
      .filter((stock) => stock.changePercent >= settings.minChangePercent)
      .filter((stock) => stock.volume >= settings.minVolume);
  }, [top50, settings]);

  const alerts = useMemo(() => baseFiltered.filter((stock) => isAlert(stock, settings)), [baseFiltered, settings]);
  const hotList = useMemo(() => top50.filter((stock) => isHot(stock, settings)), [top50, settings]);
  const weakList = useMemo(() => baseFiltered.filter(isWeak), [baseFiltered]);

  const realTime200Alerts = useMemo(() => {
    return top50
      .filter((stock) => stock.price > 0 && stock.price <= 200)
      .filter((stock) => isAlert(stock, settings))
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeak(stock))
      .slice(0, 30);
  }, [top50, settings]);

  const observeRealtimeAlerts = useMemo(() => {
    return observeStocks.filter((stock) => isAlert(stock, settings) || isWeak(stock) || isHot(stock, settings) || stock.price < stock.openPrice);
  }, [observeStocks, settings]);

  const favoriteRealtimeAlerts = useMemo(() => {
    return favoriteStocksRaw.filter((stock) => isAlert(stock, settings) || isWeak(stock) || stock.changePercent >= 3);
  }, [favoriteStocksRaw, settings]);

  const avoidList = useMemo(() => {
    return Array.from(new Map([...hotList, ...weakList].map((stock) => [stock.code, stock])).values());
  }, [hotList, weakList]);

  const avoidHotList = useMemo(() => hotList, [hotList]);
  const avoidWeakList = useMemo(() => weakList, [weakList]);
  const avoidBelowOpenList = useMemo(() => baseFiltered.filter((s) => s.price < s.openPrice), [baseFiltered]);
  const avoidTooHighList = useMemo(() => top50.filter((s) => s.changePercent >= 8), [top50]);

  const open910List = useMemo(() => {
    return baseFiltered
      .filter((stock) => stock.changePercent >= 2)
      .filter((stock) => stock.openPremiumPercent !== null && stock.openPremiumPercent >= 0)
      .filter((stock) => stock.price >= stock.openPrice)
      .filter((stock) => mainIndustries.includes(stock.industry))
      .filter((stock) => !(settings.excludeHot && isHot(stock, settings)))
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 15);
  }, [baseFiltered, mainIndustries, settings]);

  const top10List = useMemo(() => {
    return baseFiltered
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => !isWeak(stock))
      .map((stock) => ({
        stock,
        score: scoreStock(stock, mainIndustries, settings),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.stock);
  }, [baseFiltered, mainIndustries, settings]);

  const mustWatch3 = useMemo(() => top10List.slice(0, 3), [top10List]);

  const stableTop10 = useMemo(() => {
    return top10List.filter((stock) => getRisk(stock) === "低" || stock.changePercent <= 5);
  }, [top10List]);

  const activeTop10 = useMemo(() => {
    return top10List.filter((stock) => stock.changePercent >= 5 || isAlert(stock, settings));
  }, [top10List, settings]);

  const pullbackList = useMemo(() => {
    return baseFiltered
      .filter((stock) => isPullbackCandidate(stock, settings))
      .sort((a, b) => {
        const aDistance = Math.abs(a.price - a.openPrice) / Math.max(a.openPrice, 1);
        const bDistance = Math.abs(b.price - b.openPrice) / Math.max(b.openPrice, 1);
        return aDistance - bDistance;
      })
      .slice(0, 15);
  }, [baseFiltered, settings]);

  const breakoutList = useMemo(() => {
    return baseFiltered
      .filter((stock) => isBreakout(stock))
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => mainIndustries.includes(stock.industry))
      .sort((a, b) => {
        const aScore = scoreStock(a, mainIndustries, settings) + a.changePercent;
        const bScore = scoreStock(b, mainIndustries, settings) + b.changePercent;
        return bScore - aScore;
      })
      .slice(0, 15);
  }, [baseFiltered, settings, mainIndustries]);

  const observeStocks = useMemo(() => {
    return observeCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [observeCodes, stocks]);

  const favoriteStocksRaw = useMemo(() => {
    return favoriteCodes.map((code) => stocks.find((stock) => stock.code === code)).filter(Boolean) as Stock[];
  }, [favoriteCodes, stocks]);

  const favoriteStocks = useMemo(() => {
    if (!settings.onlyActiveFavorite) return favoriteStocksRaw;

    return favoriteStocksRaw.filter((stock) => {
      const inTop50 = top50.some((item) => item.code === stock.code);
      return isAlert(stock, settings) || isWeak(stock) || stock.changePercent >= 3 || !inTop50;
    });
  }, [favoriteStocksRaw, settings, top50]);

  const signal = useMemo(() => getSignal(top50, alerts, hotList), [top50, alerts, hotList]);

  const observeSummary = useMemo(() => {
    const success = Object.values(resultMap).filter((value) => value === "成功續強").length;
    const fail = Object.values(resultMap).filter((value) => value === "失敗轉弱").length;
    const stillGood = observeStocks.filter((stock) => scoreStock(stock, mainIndustries, settings) >= 60 && !isWeak(stock)).length;
    const dropped = observeCodes.filter((code) => !top50.some((stock) => stock.code === code)).length;

    return { success, fail, stillGood, dropped };
  }, [resultMap, observeStocks, observeCodes, top50, mainIndustries, settings]);

  const favoriteSummary = useMemo(() => {
    return {
      alert: favoriteStocksRaw.filter((stock) => isAlert(stock, settings)).length,
      strong: favoriteStocksRaw.filter((stock) => stock.changePercent >= 3 && !isWeak(stock)).length,
      weak: favoriteStocksRaw.filter(isWeak).length,
      dropped: favoriteCodes.filter((code) => !top50.some((stock) => stock.code === code)).length,
      keep: favoriteStocksRaw.filter((stock) => scoreStock(stock, mainIndustries, settings) >= 60 && !isWeak(stock)).length,
      remove: favoriteStocksRaw.filter((stock) => isWeak(stock) || isHot(stock, settings)).length,
    };
  }, [favoriteStocksRaw, favoriteCodes, top50, settings, mainIndustries]);

  const observeSuccessRate = useMemo(() => {
    const total = observeSummary.success + observeSummary.fail;
    if (total === 0) return "--";
    return `${Math.round((observeSummary.success / total) * 100)}%`;
  }, [observeSummary]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCachedData) return "快取";
    if (!apiDataTime) return "讀取中";

    const year = String(getTaiwanNow().getFullYear());
    if (!apiDataTime.includes(year)) return "過舊";

    return "正常";
  }, [error, usingCachedData, apiDataTime, updating]);

  const apiHealth = useMemo(() => {
    if (updating) return "API更新中";
    if (error) return "API失敗";
    if (usingCachedData) return "使用快取";
    if (lastSuccessAt) return "API正常";
    return "尚未成功";
  }, [updating, error, usingCachedData, lastSuccessAt]);

  const selectedStock = useMemo(() => {
    if (!selectedCode) return null;
    return stocks.find((stock) => stock.code === selectedCode) || null;
  }, [selectedCode, stocks]);

  const selectedRank = useMemo(() => {
    if (!selectedStock) return null;
    const index = top50.findIndex((stock) => stock.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, top50]);

  const selectedIndustryRank = useMemo(() => {
    if (!selectedStock) return null;

    const sameIndustry = top50
      .filter((stock) => stock.industry === selectedStock.industry)
      .sort((a, b) => b.changePercent - a.changePercent);

    const index = sameIndustry.findIndex((stock) => stock.code === selectedStock.code);
    return index >= 0 ? index + 1 : null;
  }, [selectedStock, top50]);

  const sameIndustryTop3 = useMemo(() => {
    if (!selectedStock) return [];

    return top50
      .filter((stock) => stock.industry === selectedStock.industry && stock.code !== selectedStock.code)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3);
  }, [selectedStock, top50]);

  const selectedIndustryAverage = useMemo(() => {
    if (!selectedStock) return 0;
    const same = top50.filter((stock) => stock.industry === selectedStock.industry);
    return same.reduce((sum, stock) => sum + stock.changePercent, 0) / Math.max(same.length, 1);
  }, [selectedStock, top50]);

  function applyFilters(list: Stock[]) {
    let result = [...list];

    const keyword = searchText.trim();

    if (keyword) {
      result = result.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (mainOnly) result = result.filter((stock) => mainIndustries.includes(stock.industry));
    if (onlyWatchable) result = result.filter((stock) => scoreStock(stock, mainIndustries, settings) >= 60);
    if (onlyPriority) result = result.filter((stock) => scoreStock(stock, mainIndustries, settings) >= 80);
    if (onlyLowPrice) result = result.filter((stock) => stock.price > 0 && stock.price <= 100);
    if (hideHot) result = result.filter((stock) => !isHot(stock, settings));
    if (hideWeak) result = result.filter((stock) => !isWeak(stock));

    return sortStocks(result, sortKey, mainIndustries, settings);
  }

  const currentList = useMemo(() => {
    if (tab === "top") return applyFilters(top10List);
    if (tab === "observe") return applyFilters(observeStocks);
    if (tab === "favorite") return applyFilters(favoriteStocks);

    if (tab === "more") {
      if (moreView === "today") return applyFilters(top50);
      if (moreView === "avoid") return applyFilters(avoidList);
      if (moreView === "pullback") return applyFilters(pullbackList);
      if (moreView === "breakout") return applyFilters(breakoutList);
      if (moreView === "open910") return applyFilters(open910List);
      if (moreView === "alerts") return applyFilters(realTime200Alerts);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    top10List,
    observeStocks,
    favoriteStocks,
    avoidList,
    pullbackList,
    breakoutList,
    open910List,
    realTime200Alerts,
    searchText,
    mainOnly,
    onlyWatchable,
    onlyPriority,
    onlyLowPrice,
    hideHot,
    hideWeak,
    sortKey,
    mainIndustries,
    settings,
  ]);

  function goMore(view: MoreView) {
    setTab("more");
    setMoreView(view);
  }

  function openLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    observeCodes,
    previousRanks,
    priceDirections,
    onOpenDetail: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddObserve: addObserve,
    onRemoveObserve: removeObserve,
  };

  if (selectedStock) {
    const score = scoreStock(selectedStock, mainIndustries, settings);
    const links = getKLinks(selectedStock.code, selectedStock.name);
    const isFavorite = favoriteCodes.includes(selectedStock.code);
    const isObserve = observeCodes.includes(selectedStock.code);
    const previousRank = previousRanks[selectedStock.code];
    const rankChange = previousRank && selectedRank ? previousRank - selectedRank : null;
    const conclusion = getActionConclusion(selectedStock, mainIndustries, settings);
    const entryType = getEntryType(selectedStock, settings);
    const chaseRisk = getChaseRisk(selectedStock, settings);
    const openLow = selectedStock.openPrice * 0.985;
    const openHigh = selectedStock.openPrice * 1.015;
    const direction = priceDirections[selectedStock.code];

    const checks = [
      { label: `股價${settings.maxPrice}元內`, ok: isUnderPrice(selectedStock, settings) },
      { label: "主流產業", ok: mainIndustries.includes(selectedStock.industry) },
      { label: "未過熱", ok: !isHot(selectedStock, settings) },
      { label: "未轉弱", ok: !isWeak(selectedStock) },
      { label: "警報", ok: isAlert(selectedStock, settings) },
      { label: "高分", ok: score >= 80 },
      { label: "已在觀察", ok: isObserve },
    ];

    const riskTexts: string[] = [];
    if (isHot(selectedStock, settings)) riskTexts.push("過熱勿追");
    if (isWeak(selectedStock)) riskTexts.push("盤中轉弱");
    if ((selectedStock.openPremiumPercent ?? 0) >= settings.openPremiumPercent + 2) riskTexts.push("開盤溢價偏高");
    if (selectedStock.price < selectedStock.openPrice) riskTexts.push("跌破開盤價");
    if (selectedStock.changePercent >= 8) riskTexts.push("漲幅過大");

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
                  {entryType}｜分數 {score}｜{scoreText(score)}
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
              <div className="mt-1 text-2xl font-black text-yellow-200">{conclusion}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">{getTomorrowPlan(selectedStock, mainIndustries, settings)}</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <DetailRow label="開盤" value={formatNumber(selectedStock.openPrice)} />
              <DetailRow label="昨收" value={formatNumber(selectedStock.previousClose)} />
              <DetailRow label="量" value={formatNumber(selectedStock.volume)} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
            <h2 className="text-xl font-black">即時更新控制</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => loadStocks(true)}
                className="rounded-2xl bg-blue-500/20 py-3 text-sm font-black text-blue-200"
              >
                更新這檔 / 全站
              </button>
              <button
                onClick={() => openLink(links.yahoo)}
                className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200"
              >
                開K線確認
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-blue-100">
              自動更新：{settings.refreshSeconds === 0 ? "手動" : `${settings.refreshSeconds}秒`}｜
              倒數：{settings.refreshSeconds === 0 ? "--" : `${autoSeconds}s`}｜
              API：{apiHealth}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-cyan-500/50 bg-cyan-950/20 p-5">
            <h2 className="text-xl font-black">進階摘要</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="進場型態" value={entryType} />
              <DetailRow label="追高風險" value={chaseRisk} />
              <DetailRow label="50強排名" value={selectedRank ? `第 ${selectedRank} 名` : "不在50強"} />
              <DetailRow label="產業排名" value={selectedIndustryRank ? `${selectedStock.industry} 第 ${selectedIndustryRank}` : "--"} />
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-cyan-100">
              同產業平均：{formatPercent(selectedIndustryAverage)}｜
              {selectedStock.changePercent >= selectedIndustryAverage ? "強於同產業平均" : "弱於同產業平均"}
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-cyan-100">
              排名變化：
              {rankChange === null
                ? "無前次資料"
                : rankChange > 0
                  ? `上升 ${rankChange} 名`
                  : rankChange < 0
                    ? `下降 ${Math.abs(rankChange)} 名`
                    : "持平"}
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
            <h2 className="text-xl font-black">價位劇本</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="回測開盤價" value={`${selectedStock.openPrice.toFixed(2)} 元附近`} />
              <DetailRow label="昨收參考" value={`${selectedStock.previousClose.toFixed(2)} 元附近`} />
              <DetailRow label="觀察區低" value={`${openLow.toFixed(2)} 元`} />
              <DetailRow label="觀察區高" value={`${openHigh.toFixed(2)} 元`} />
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-yellow-100">
              明天劇本：{getTomorrowPlan(selectedStock, mainIndustries, settings)}
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-black text-red-100">
              停損提醒：跌破開盤價、跌破昨收、漲幅縮小到2%以下都要小心。
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-yellow-500/50 bg-yellow-950/20 p-5">
            <h2 className="text-xl font-black">買進前檢查表</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {checks.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl p-3 text-sm font-black ${
                    item.ok ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
                  }`}
                >
                  {item.ok ? "✅" : "❌"} {item.label}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-red-500/50 bg-red-950/20 p-5">
            <h2 className="text-xl font-black">風險提醒</h2>
            <div className="mt-3 space-y-2 text-sm font-bold text-red-100">
              {riskTexts.length === 0 && <div>目前沒有明顯高風險提醒。</div>}
              {riskTexts.map((text) => (
                <div key={text} className="rounded-2xl bg-black/30 p-3">
                  ⚠️ {text}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
            <h2 className="text-xl font-black">K線入口</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => openLink(links.yahoo)} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">
                Yahoo K線
              </button>
              <button onClick={() => openLink(links.tradingView)} className="rounded-2xl bg-blue-500/20 py-3 text-sm font-black text-blue-200">
                TradingView
              </button>
              <button onClick={() => openLink(links.goodinfo)} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
                Goodinfo
              </button>
              <button onClick={() => openLink(links.google)} className="rounded-2xl bg-slate-700 py-3 text-sm font-black text-slate-200">
                Google搜尋
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">一鍵分組操作</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={() => setObserveByGroup(selectedStock.code, "明天優先")}
                className="rounded-2xl bg-cyan-500/20 py-3 text-xs font-black text-cyan-200"
              >
                明天優先
              </button>
              <button
                onClick={() => setObserveByGroup(selectedStock.code, "等回測")}
                className="rounded-2xl bg-lime-500/20 py-3 text-xs font-black text-lime-200"
              >
                等回測
              </button>
              <button
                onClick={() => setObserveByGroup(selectedStock.code, "不追高")}
                className="rounded-2xl bg-red-500/20 py-3 text-xs font-black text-red-200"
              >
                不追高
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => (isFavorite ? removeFavorite(selectedStock.code) : addFavorite(selectedStock.code))}
                className={`rounded-2xl py-3 text-sm font-black ${
                  isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
                }`}
              >
                {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(selectedStock.code)}
                className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200"
              >
                複製代號
              </button>
            </div>

            {isObserve && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const next = { ...resultMap, [selectedStock.code]: "成功續強" as ResultStatus };
                    setResultMap(next);
                    localStorage.setItem(RESULT_KEY, JSON.stringify(next));
                  }}
                  className="rounded-2xl bg-emerald-500/20 py-2 text-sm font-black text-emerald-200"
                >
                  成功續強
                </button>
                <button
                  onClick={() => {
                    const next = { ...resultMap, [selectedStock.code]: "失敗轉弱" as ResultStatus };
                    setResultMap(next);
                    localStorage.setItem(RESULT_KEY, JSON.stringify(next));
                  }}
                  className="rounded-2xl bg-red-500/20 py-2 text-sm font-black text-red-200"
                >
                  失敗轉弱
                </button>
              </div>
            )}
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">個股備註</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {noteTemplates.map((text) => (
                <button
                  key={text}
                  onClick={() => saveNote(selectedStock.code, text)}
                  className="rounded-2xl bg-slate-800 py-2 text-sm font-black text-slate-200"
                >
                  {text}
                </button>
              ))}
            </div>

            <textarea
              value={notes[selectedStock.code] || ""}
              onChange={(e) => saveNote(selectedStock.code, e.target.value)}
              placeholder="輸入備註，例如：等回測、看續強、不追高"
              className="mt-3 min-h-[90px] w-full rounded-2xl border border-slate-700 bg-black/40 p-3 text-sm font-bold text-white outline-none"
            />
          </section>

          <section className="mt-4 rounded-3xl border border-indigo-500/50 bg-indigo-950/20 p-5">
            <h2 className="text-xl font-black">同產業前三強</h2>
            <div className="mt-3 space-y-2 text-sm font-bold text-indigo-100">
              {sameIndustryTop3.length === 0 && <div>目前沒有同產業資料。</div>}
              {sameIndustryTop3.map((stock, index) => (
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
              <div className="text-sm font-bold text-slate-400">台股即時股價版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">今日儀表板</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {getTodaySentence(signal.title, mainIndustries, hotList.length)}
              </p>
            </div>

            <button
              onClick={() => loadStocks(true)}
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
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

            <button
              onClick={() => goMore("data")}
              className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200"
            >
              詳情
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard
            title="燈號"
            value={signal.title}
            sub={signal.text}
            tone={signal.title.includes("綠") ? "text-emerald-300" : signal.title.includes("紅") ? "text-red-300" : "text-yellow-300"}
            onClick={() => goMore("today")}
          />

          <MiniCard
            title="主流產業"
            value={mainIndustries[0] || "--"}
            sub={mainIndustries.slice(0, 3).join("、") || "尚無資料"}
            tone="text-cyan-300"
            onClick={() => goMore("industry")}
          />

          <MiniCard
            title="Top10"
            value={top10List.length}
            sub="點我看今日 Top"
            tone="text-cyan-300"
            onClick={() => setTab("top")}
          />

          <MiniCard
            title="即時警報"
            value={realTime200Alerts.length}
            sub="200元內 + 未過熱"
            tone="text-orange-300"
            onClick={() => goMore("alerts")}
          />

          <MiniCard
            title="觀察警報"
            value={observeRealtimeAlerts.length}
            sub="觀察股異動"
            tone="text-red-300"
            onClick={() => setTab("observe")}
          />

          <MiniCard
            title="自選警報"
            value={favoriteRealtimeAlerts.length}
            sub="自選股異動"
            tone="text-yellow-300"
            onClick={() => setTab("favorite")}
          />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="今日必看" sub="最優先 3 檔" badge={mustWatch3.length} tone="text-cyan-300" onClick={() => setTab("top")} />
          <ActionCard title="不要碰" sub={`過熱 ${hotList.length}｜轉弱 ${weakList.length}`} badge={avoidList.length} tone="text-red-300" onClick={() => goMore("avoid")} />
          <ActionCard title="回測觀察" sub="等回測可觀察" badge={pullbackList.length} tone="text-lime-300" onClick={() => goMore("pullback")} />
          <ActionCard title="突破確認" sub="主流突破股" badge={breakoutList.length} tone="text-orange-300" onClick={() => goMore("breakout")} />
          <ActionCard title="9:10" sub={`${getMarketStatus()}｜${getOpen910Countdown()}`} badge={open910List.length} tone="text-purple-300" onClick={() => goMore("open910")} />
          <ActionCard title="觀察" sub={`成功 ${observeSummary.success}｜失敗 ${observeSummary.fail}`} badge={observeCodes.length} tone="text-cyan-300" onClick={() => setTab("observe")} />
          <ActionCard title="自選" sub={`警報 ${favoriteSummary.alert}｜轉強 ${favoriteSummary.strong}`} badge={favoriteCodes.length} tone="text-yellow-300" onClick={() => setTab("favorite")} />
          <ActionCard title="收盤流程" sub="建立明天觀察" badge="GO" tone="text-emerald-300" onClick={() => buildTomorrowList([...top10List.map((s) => s.code), ...alerts.map((s) => s.code)])} />
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
            <>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ["score", "分數"],
                  ["change", "漲幅"],
                  ["priceLow", "低價"],
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
                {[
                  ["主流", mainOnly, setMainOnly],
                  ["可觀察", onlyWatchable, setOnlyWatchable],
                  ["優先看", onlyPriority, setOnlyPriority],
                  ["100內", onlyLowPrice, setOnlyLowPrice],
                  ["未過熱", hideHot, setHideHot],
                  ["未轉弱", hideWeak, setHideWeak],
                ].map(([label, value, setter]: any) => (
                  <button
                    key={label}
                    onClick={() => setter(!value)}
                    className={`rounded-2xl py-3 text-[11px] font-black ${
                      value ? "bg-cyan-500/30 text-cyan-200" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="今日50強" sub="完整清單" badge={top50.length} tone="text-red-300" onClick={() => setMoreView("today")} />
              <ActionCard title="即時警報" sub="200元內警報" badge={realTime200Alerts.length} tone="text-orange-300" onClick={() => setMoreView("alerts")} />
              <ActionCard title="產業" sub="主流產業Top3" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="更新頻率與條件" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="不要碰" sub="過熱與轉弱" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoid")} />
              <ActionCard title="回測" sub="等回測觀察" badge={pullbackList.length} tone="text-lime-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="突破" sub="突破確認股" badge={breakoutList.length} tone="text-orange-300" onClick={() => setMoreView("breakout")} />
              <ActionCard title="9:10" sub="開盤觀察" badge={open910List.length} tone="text-purple-300" onClick={() => setMoreView("open910")} />
              <ActionCard title="統計" sub="勝率與結果" badge={observeSuccessRate} tone="text-yellow-300" onClick={() => setMoreView("stats")} />
              <ActionCard title="資料" sub="API與快取狀態" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "首頁卡片"}
              {tab === "top" && "🏆 Top 分類"}
              {tab === "observe" && "📝 觀察清單"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "menu" && "☰ 更多"}
              {tab === "more" && moreView === "today" && "📊 今日50強"}
              {tab === "more" && moreView === "alerts" && "🚨 即時200元內警報"}
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "settings" && "⚙️ 條件設定"}
              {tab === "more" && moreView === "avoid" && "🚫 不要碰"}
              {tab === "more" && moreView === "pullback" && "↩️ 回測觀察"}
              {tab === "more" && moreView === "breakout" && "🚀 突破確認"}
              {tab === "more" && moreView === "open910" && "⏰ 9:10清單"}
              {tab === "more" && moreView === "stats" && "📈 統計"}
              {tab === "more" && moreView === "data" && "📡 資料狀態"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              股價會依設定頻率自動更新；是否真正即時取決於你的 /api/stocks 資料來源。
            </p>
          </div>

          {tab === "top" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-xl font-black">今日必看 3 檔</h3>
                <div className="space-y-3">
                  {mustWatch3.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-black">積極 Top10</h3>
                <div className="space-y-3">
                  {activeTop10.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                      目前沒有股票
                    </div>
                  )}

                  {activeTop10.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-black">穩健 Top10</h3>
                <div className="space-y-3">
                  {stableTop10.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                      目前沒有股票
                    </div>
                  )}

                  {stableTop10.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "observe" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">觀察股即時警報</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  目前 {observeRealtimeAlerts.length} 檔觀察股有警報 / 轉弱 / 過熱。
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const alertCodes = observeStocks.filter((stock) => isAlert(stock, settings)).map((stock) => stock.code);
                    saveObserveCodes(alertCodes);
                  }}
                  className="rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200"
                >
                  只留警報股
                </button>

                <button
                  onClick={() => {
                    const highCodes = observeStocks
                      .filter((stock) => scoreStock(stock, mainIndustries, settings) >= 80)
                      .map((stock) => stock.code);
                    saveObserveCodes(highCodes);
                  }}
                  className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
                >
                  只留高分股
                </button>

                <button onClick={removeWeakObserve} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                  移除轉弱
                </button>

                <button onClick={removeHotObserve} className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
                  移除過熱
                </button>

                <button onClick={organizeObserveList} className="col-span-2 rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">
                  一鍵整理觀察清單
                </button>
              </div>

              {(["明天優先", "等回測", "不追高"] as ObserveGroup[]).map((group) => {
                const groupStocks = observeStocks.filter((stock) => (observeGroups[stock.code] || "明天優先") === group);

                return (
                  <div key={group}>
                    <h3 className="mb-2 text-xl font-black">{group}</h3>

                    <div className="space-y-3">
                      {groupStocks.length === 0 && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                          目前沒有股票
                        </div>
                      )}

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
              <div className="rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">自選即時狀態</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm font-black">
                  <div className="rounded-2xl bg-black/30 p-3">可留<br />{favoriteSummary.keep}</div>
                  <div className="rounded-2xl bg-black/30 p-3">警報<br />{favoriteRealtimeAlerts.length}</div>
                  <div className="rounded-2xl bg-black/30 p-3">該刪除<br />{favoriteSummary.remove}</div>
                </div>

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

                <button onClick={addActiveFavoritesToObserve} className="mt-3 w-full rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
                  把自選轉強加入觀察
                </button>
              </div>

              {(["短線觀察", "明天追蹤", "長期關注"] as FavoriteGroup[]).map((group) => {
                const groupStocks = favoriteStocks.filter((stock) => (favoriteGroups[stock.code] || "短線觀察") === group);

                return (
                  <div key={group}>
                    <h3 className="mb-2 text-xl font-black">{group}</h3>

                    <div className="space-y-3">
                      {groupStocks.length === 0 && (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                          目前沒有股票
                        </div>
                      )}

                      {groupStocks.map((stock, index) => (
                        <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                      ))}
                    </div>
                  </div>
                );
              })}
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

              <button
                onClick={() => saveSettings({ ...settings, onlyActiveFavorite: !settings.onlyActiveFavorite })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.onlyActiveFavorite ? "bg-emerald-500/30 text-emerald-200" : "bg-black/30 text-slate-300"
                }`}
              >
                自選只顯示有動作：{settings.onlyActiveFavorite ? "開啟" : "關閉"}
              </button>

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

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industries.slice(0, 8).map((item, index) => (
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

          {tab === "more" && moreView === "stats" && (
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
              <div className="text-xl font-black">觀察勝率：{observeSuccessRate}</div>
              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>成功續強：{observeSummary.success}</div>
                <div>失敗轉弱：{observeSummary.fail}</div>
                <div>仍可觀察：{observeSummary.stillGood}</div>
                <div>掉出50強：{observeSummary.dropped}</div>
                <div>觀察即時警報：{observeRealtimeAlerts.length}</div>
                <div>自選即時警報：{favoriteRealtimeAlerts.length}</div>
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
                <div>9:10倒數：{getOpen910Countdown()}</div>
              </div>

              {(usingCachedData || error) && (
                <div className="mt-3 rounded-2xl border border-yellow-500 bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
                  ⚠️ 目前可能使用上次成功資料，請按立即更新確認最新行情。
                </div>
              )}

              <button onClick={() => loadStocks(true)} className="mt-4 w-full rounded-2xl bg-blue-500/20 py-3 text-lg font-black text-blue-200">
                重新讀取資料
              </button>
            </div>
          )}

          {tab === "more" && moreView === "avoid" && (
            <div className="space-y-5">
              {[
                ["過熱勿追", avoidHotList],
                ["盤中轉弱", avoidWeakList],
                ["跌破開盤", avoidBelowOpenList],
                ["漲幅過大", avoidTooHighList],
              ].map(([title, list]: any) => (
                <div key={title}>
                  <h3 className="mb-2 text-xl font-black">{title}</h3>
                  <div className="space-y-3">
                    {list.length === 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                        目前沒有股票
                      </div>
                    )}
                    {list.map((stock: Stock, index: number) => (
                      <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab !== "home" &&
            tab !== "top" &&
            tab !== "observe" &&
            tab !== "favorite" &&
            !(tab === "more" && ["settings", "industry", "stats", "data", "menu", "avoid"].includes(moreView)) && (
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