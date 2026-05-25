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

type TabKey = "home" | "top" | "observe" | "favorite" | "more";
type MoreView =
  | "menu"
  | "industry"
  | "settings"
  | "avoid"
  | "pullback"
  | "breakout"
  | "open910"
  | "stats"
  | "clear";

type SortKey = "score" | "change" | "priceLow" | "industry";
type ObserveGroup = "明天優先" | "等回測" | "不追高";
type FavoriteGroup = "短線觀察" | "明天追蹤" | "長期關注";
type ResultStatus = "成功續強" | "失敗轉弱";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  openPremiumPercent: number;
  excludeHot: boolean;
  maxObserve: number;
  minChangePercent: number;
  minVolume: number;
  onlyActiveFavorite: boolean;
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
const AUTO_REFRESH_SECONDS = 60;

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const OBSERVE_KEY = "taiwan-stock-radar-observe";
const SETTINGS_KEY = "taiwan-stock-radar-settings";
const OBSERVE_GROUP_KEY = "taiwan-stock-radar-observe-groups";
const FAVORITE_GROUP_KEY = "taiwan-stock-radar-favorite-groups";
const RESULT_KEY = "taiwan-stock-radar-results";
const PREVIOUS_RANK_KEY = "taiwan-stock-radar-prev-ranks";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-last-success";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  openPremiumPercent: 3,
  excludeHot: true,
  maxObserve: 15,
  minChangePercent: 0,
  minVolume: 0,
  onlyActiveFavorite: false,
};

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
  if (status === "9:10觀察") return "現在看9:10清單，優先看主流未過熱。";
  if (status === "盤中") return "只看未過熱、未轉弱、高分股。";
  if (status === "收盤後") return "現在適合建立明天觀察清單。";
  return "休市可整理自選與觀察清單。";
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
  if (isWeak(stock)) score -= 20;
  if (stock.price > settings.maxPrice) score -= 100;
  if (stock.volume < settings.minVolume) score -= 20;

  return Math.max(0, score);
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

function sortStocks(list: Stock[], sortKey: SortKey, mainIndustries: string[], settings: Settings) {
  const arr = [...list];

  if (sortKey === "priceLow") return arr.sort((a, b) => a.price - b.price);
  if (sortKey === "industry") return arr.sort((a, b) => a.industry.localeCompare(b.industry) || b.changePercent - a.changePercent);
  if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);

  return arr.sort((a, b) => scoreStock(b, mainIndustries, settings) - scoreStock(a, mainIndustries, settings));
}

function DataBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function SectionButton({
  title,
  sub,
  onClick,
}: {
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95"
    >
      <div className="text-lg font-black text-white">{title}</div>
      <div className="mt-1 text-sm font-bold text-slate-400">{sub}</div>
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
  observeGroups,
  favoriteGroups,
  resultMap,
  previousRanks,
  expandedCode,
  onToggleExpand,
  onAddFavorite,
  onRemoveFavorite,
  onAddObserve,
  onRemoveObserve,
  onSetObserveGroup,
  onSetFavoriteGroup,
  onSetResult,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  observeCodes: string[];
  observeGroups: Record<string, ObserveGroup>;
  favoriteGroups: Record<string, FavoriteGroup>;
  resultMap: Record<string, ResultStatus>;
  previousRanks: Record<string, number>;
  expandedCode: string;
  onToggleExpand: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddObserve: (code: string) => void;
  onRemoveObserve: (code: string) => void;
  onSetObserveGroup: (code: string, group: ObserveGroup) => void;
  onSetFavoriteGroup: (code: string, group: FavoriteGroup) => void;
  onSetResult: (code: string, result: ResultStatus) => void;
}) {
  const isUp = stock.changePercent >= 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isObserve = observeCodes.includes(stock.code);
  const isExpanded = expandedCode === stock.code;
  const score = scoreStock(stock, mainIndustries, settings);
  const previousRank = previousRanks[stock.code];
  const newEntry = !previousRank;
  const rankUp = previousRank ? previousRank - rank : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 shadow-lg">
      <button onClick={() => onToggleExpand(stock.code)} className="w-full text-left">
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

          <div className={`text-right text-xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>
            {formatPercent(stock.changePercent)}
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
        <span className="rounded-full bg-slate-800 px-3 py-1">{getStatusTag(stock, settings)}</span>
        <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">分數 {score}</span>
        <span className="rounded-full bg-yellow-950 px-3 py-1 text-yellow-200">{scoreText(score)}</span>
        {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        {isObserve && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">觀察</span>}
      </div>

      <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
        {getShortReason(stock, mainIndustries, settings)}
      </div>

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
              <div className="text-xs text-slate-500">溢價</div>
              <div className="font-bold">{formatPercent(stock.openPremiumPercent)}</div>
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

          {isObserve && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(["明天優先", "等回測", "不追高"] as ObserveGroup[]).map((group) => (
                  <button
                    key={group}
                    onClick={() => onSetObserveGroup(stock.code, group)}
                    className={`rounded-2xl py-2 text-xs font-black ${
                      observeGroups[stock.code] === group
                        ? "bg-cyan-500 text-black"
                        : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSetResult(stock.code, "成功續強")}
                  className="rounded-2xl bg-emerald-500/20 py-2 text-sm font-black text-emerald-200"
                >
                  成功續強
                </button>

                <button
                  onClick={() => onSetResult(stock.code, "失敗轉弱")}
                  className="rounded-2xl bg-red-500/20 py-2 text-sm font-black text-red-200"
                >
                  失敗轉弱
                </button>
              </div>
            </>
          )}

          {isFavorite && (
            <div className="grid grid-cols-3 gap-2">
              {(["短線觀察", "明天追蹤", "長期關注"] as FavoriteGroup[]).map((group) => (
                <button
                  key={group}
                  onClick={() => onSetFavoriteGroup(stock.code, group)}
                  className={`rounded-2xl py-2 text-xs font-black ${
                    favoriteGroups[stock.code] === group
                      ? "bg-yellow-500 text-black"
                      : "bg-black/30 text-slate-300"
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          )}

          {resultMap[stock.code] && (
            <div className="rounded-2xl bg-black/30 p-3 text-sm font-black text-yellow-200">
              觀察結果：{resultMap[stock.code]}
            </div>
          )}
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
          {isObserve ? "📌 移除觀察" : "📌 加入觀察"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingCachedData, setUsingCachedData] = useState(false);

  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [apiDataTime, setApiDataTime] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  const [tab, setTab] = useState<TabKey>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [autoSeconds, setAutoSeconds] = useState(AUTO_REFRESH_SECONDS);

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [observeCodes, setObserveCodes] = useState<string[]>([]);
  const [observeGroups, setObserveGroups] = useState<Record<string, ObserveGroup>>({});
  const [favoriteGroups, setFavoriteGroups] = useState<Record<string, FavoriteGroup>>({});
  const [resultMap, setResultMap] = useState<Record<string, ResultStatus>>({});
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [favoriteInput, setFavoriteInput] = useState("");

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [mainOnly, setMainOnly] = useState(false);
  const [onlyWatchable, setOnlyWatchable] = useState(false);
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [onlyLowPrice, setOnlyLowPrice] = useState(false);
  const [hideHot, setHideHot] = useState(false);
  const [hideWeak, setHideWeak] = useState(false);

  const [expandedCode, setExpandedCode] = useState("");

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITE_KEY);
      if (savedFavorites) setFavoriteCodes(JSON.parse(savedFavorites));

      const savedObserve = localStorage.getItem(OBSERVE_KEY);
      if (savedObserve) setObserveCodes(JSON.parse(savedObserve));

      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });

      const savedObserveGroups = localStorage.getItem(OBSERVE_GROUP_KEY);
      if (savedObserveGroups) setObserveGroups(JSON.parse(savedObserveGroups));

      const savedFavoriteGroups = localStorage.getItem(FAVORITE_GROUP_KEY);
      if (savedFavoriteGroups) setFavoriteGroups(JSON.parse(savedFavoriteGroups));

      const savedResult = localStorage.getItem(RESULT_KEY);
      if (savedResult) setResultMap(JSON.parse(savedResult));

      const savedRanks = localStorage.getItem(PREVIOUS_RANK_KEY);
      if (savedRanks) setPreviousRanks(JSON.parse(savedRanks));

      const last = localStorage.getItem(LAST_SUCCESS_KEY);
      if (last) {
        const parsed = JSON.parse(last);
        if (Array.isArray(parsed.stocks)) {
          setStocks(parsed.stocks);
          setUsingCachedData(true);
        }
        if (parsed.apiDataTime) setApiDataTime(parsed.apiDataTime);
        if (parsed.source) setSource(parsed.source);
        if (parsed.lastSuccessAt) setLastSuccessAt(parsed.lastSuccessAt);
      }
    } catch {
      setSettings(defaultSettings);
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

  function saveObserveGroups(next: Record<string, ObserveGroup>) {
    setObserveGroups(next);
    localStorage.setItem(OBSERVE_GROUP_KEY, JSON.stringify(next));
  }

  function saveFavoriteGroups(next: Record<string, FavoriteGroup>) {
    setFavoriteGroups(next);
    localStorage.setItem(FAVORITE_GROUP_KEY, JSON.stringify(next));
  }

  function saveResultMap(next: Record<string, ResultStatus>) {
    setResultMap(next);
    localStorage.setItem(RESULT_KEY, JSON.stringify(next));
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

  function addActiveFavoritesToObserve() {
    const active = favoriteStocksRaw
      .filter((stock) => isAlert(stock, settings) || isBreakout(stock) || scoreStock(stock, mainIndustries, settings) >= 60)
      .map((stock) => stock.code);

    saveObserveCodes([...observeCodes, ...active]);
    setTab("observe");
  }

  async function loadStocks() {
    try {
      setError("");

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

      const normalized = list
        .map(normalizeStock)
        .filter((stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      if (stocks.length > 0) {
        const oldRanks: Record<string, number> = {};
        stocks.slice(0, 50).forEach((stock, index) => {
          oldRanks[stock.code] = index + 1;
        });
        setPreviousRanks(oldRanks);
        localStorage.setItem(PREVIOUS_RANK_KEY, JSON.stringify(oldRanks));
      }

      const successTime = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      const dataTime =
        json.updatedAtTaiwan ||
        (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : new Date().toLocaleString("zh-TW"));
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
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
  }, [stocks]);

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
  const avoidList = useMemo(() => {
    return Array.from(new Map([...hotList, ...weakList].map((stock) => [stock.code, stock])).values());
  }, [hotList, weakList]);

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
    return baseFiltered.filter((stock) => isPullbackCandidate(stock, settings)).slice(0, 15);
  }, [baseFiltered, settings]);

  const breakoutList = useMemo(() => {
    return baseFiltered
      .filter((stock) => isBreakout(stock))
      .filter((stock) => !isHot(stock, settings))
      .filter((stock) => mainIndustries.includes(stock.industry))
      .slice(0, 15);
  }, [baseFiltered, settings, mainIndustries]);

  const nonMainStrongList = useMemo(() => {
    return baseFiltered
      .filter((stock) => !mainIndustries.includes(stock.industry))
      .filter((stock) => stock.changePercent >= 5)
      .filter((stock) => !isHot(stock, settings))
      .slice(0, 10);
  }, [baseFiltered, mainIndustries, settings]);

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
    };
  }, [favoriteStocksRaw, favoriteCodes, top50, settings]);

  const observeSuccessRate = useMemo(() => {
    const total = observeSummary.success + observeSummary.fail;
    if (total === 0) return "--";
    return `${Math.round((observeSummary.success / total) * 100)}%`;
  }, [observeSummary]);

  const dataStatus = useMemo(() => {
    if (error) return "API錯誤";
    if (usingCachedData) return "使用快取";
    if (!apiDataTime) return "讀取中";
    const year = String(getTaiwanNow().getFullYear());
    if (!apiDataTime.includes(year)) return "可能過舊";
    return "正常";
  }, [error, usingCachedData, apiDataTime]);

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
    if (tab === "home") return applyFilters(top50);
    if (tab === "top") return applyFilters(top10List);
    if (tab === "observe") return applyFilters(observeStocks);
    if (tab === "favorite") return applyFilters(favoriteStocks);

    if (tab === "more") {
      if (moreView === "avoid") return applyFilters(avoidList);
      if (moreView === "pullback") return applyFilters(pullbackList);
      if (moreView === "breakout") return applyFilters(breakoutList);
      if (moreView === "open910") return applyFilters(open910List);
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

  const groupedObserve = useMemo(() => {
    const groups: Record<ObserveGroup, Stock[]> = {
      明天優先: [],
      等回測: [],
      不追高: [],
    };

    observeStocks.forEach((stock) => {
      const group = observeGroups[stock.code] || "明天優先";
      groups[group].push(stock);
    });

    return groups;
  }, [observeStocks, observeGroups]);

  const groupedFavorite = useMemo(() => {
    const groups: Record<FavoriteGroup, Stock[]> = {
      短線觀察: [],
      明天追蹤: [],
      長期關注: [],
    };

    favoriteStocks.forEach((stock) => {
      const group = favoriteGroups[stock.code] || "短線觀察";
      groups[group].push(stock);
    });

    return groups;
  }, [favoriteStocks, favoriteGroups]);

  const cardProps = {
    mainIndustries,
    settings,
    favoriteCodes,
    observeCodes,
    observeGroups,
    favoriteGroups,
    resultMap,
    previousRanks,
    expandedCode,
    onToggleExpand: (code: string) => setExpandedCode(expandedCode === code ? "" : code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddObserve: addObserve,
    onRemoveObserve: removeObserve,
    onSetObserveGroup: (code: string, group: ObserveGroup) => {
      const next = { ...observeGroups, [code]: group };
      setObserveGroups(next);
      localStorage.setItem(OBSERVE_GROUP_KEY, JSON.stringify(next));
    },
    onSetFavoriteGroup: (code: string, group: FavoriteGroup) => {
      const next = { ...favoriteGroups, [code]: group };
      setFavoriteGroups(next);
      localStorage.setItem(FAVORITE_GROUP_KEY, JSON.stringify(next));
    },
    onSetResult: (code: string, result: ResultStatus) => {
      const next = { ...resultMap, [code]: result };
      setResultMap(next);
      localStorage.setItem(RESULT_KEY, JSON.stringify(next));
    },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股正式版 2.0</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">今日儀表板</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                更短首頁、必看3檔、不要碰、回測、突破、自選與觀察總覽。
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95"
            >
              立即<br />更新
            </button>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2 text-center">
            <DataBadge label="燈號" value={signal.title.replace("：", "")} tone="text-yellow-300 text-sm" />
            <DataBadge label="主流" value={mainIndustries[0] || "--"} tone="text-cyan-300 text-sm" />
            <DataBadge label="Top" value={top10List.length} tone="text-cyan-300" />
            <DataBadge label="警報" value={alerts.length} tone="text-orange-300" />
            <DataBadge label="勝率" value={observeSuccessRate} tone="text-yellow-300" />
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-900 bg-blue-950/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">資料狀態：{dataStatus}</div>
              <div className="mt-1 text-sm font-bold text-slate-300">
                {getMarketStatus()}｜{getTimeTip()}
              </div>
            </div>

            <button
              onClick={loadStocks}
              className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200"
            >
              重試
            </button>
          </div>

          <div className="mt-3 space-y-1 text-xs font-bold text-slate-400">
            <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
            <div>API資料時間：{apiDataTime || "讀取中"}</div>
            <div>9:10倒數：{getOpen910Countdown()}</div>
          </div>

          {loading && (
            <div className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">
              資料讀取中...
            </div>
          )}

          {(usingCachedData || error) && (
            <div className="mt-3 rounded-2xl border border-yellow-500 bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
              ⚠️ 目前可能使用上次成功資料，請按重試確認最新行情。
            </div>
          )}
        </section>

        <section className={`mt-4 rounded-3xl border p-5 ${signal.color}`}>
          <h2 className="text-xl font-black">{signal.title}</h2>
          <p className="mt-2 text-sm font-bold leading-6">{signal.text}</p>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">今日必看 3 檔</h2>

          <div className="mt-3 space-y-2">
            {mustWatch3.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">
                目前沒有符合條件。
              </div>
            )}

            {mustWatch3.map((stock, index) => (
              <div key={stock.code} className="rounded-2xl bg-black/30 p-3 text-sm font-black text-cyan-100">
                {index + 1}. {stock.code} {stock.name}｜{formatPercent(stock.changePercent)}｜分數{" "}
                {scoreStock(stock, mainIndustries, settings)}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-red-500/60 bg-red-950/20 p-5">
          <h2 className="text-xl font-black">不要碰清單</h2>
          <p className="mt-2 text-sm font-bold text-slate-300">
            過熱、轉弱、漲太多、跌破開盤的股票先避開。
          </p>

          <button
            onClick={() => {
              setTab("more");
              setMoreView("avoid");
            }}
            className="mt-4 w-full rounded-2xl bg-red-500/20 py-3 text-lg font-black text-red-200"
          >
            查看不要碰 {avoidList.length} 檔
          </button>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
          <h2 className="text-xl font-black">🔎 搜尋與快速篩選</h2>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號或名稱，例如 2330"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

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
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">觀察清單總覽</h2>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
            <div className="rounded-2xl bg-black/30 p-3">成功<br />{observeSummary.success}</div>
            <div className="rounded-2xl bg-black/30 p-3">失敗<br />{observeSummary.fail}</div>
            <div className="rounded-2xl bg-black/30 p-3">仍可看<br />{observeSummary.stillGood}</div>
            <div className="rounded-2xl bg-black/30 p-3">掉出<br />{observeSummary.dropped}</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={removeWeakObserve}
              className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200"
            >
              移除轉弱觀察
            </button>

            <button
              onClick={removeHotObserve}
              className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200"
            >
              移除過熱觀察
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/60 bg-yellow-950/20 p-5">
          <h2 className="text-xl font-black">自選股總覽</h2>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
            <div className="rounded-2xl bg-black/30 p-3">警報<br />{favoriteSummary.alert}</div>
            <div className="rounded-2xl bg-black/30 p-3">轉強<br />{favoriteSummary.strong}</div>
            <div className="rounded-2xl bg-black/30 p-3">轉弱<br />{favoriteSummary.weak}</div>
            <div className="rounded-2xl bg-black/30 p-3">掉出<br />{favoriteSummary.dropped}</div>
          </div>

          <button
            onClick={addActiveFavoritesToObserve}
            className="mt-3 w-full rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200"
          >
            把自選轉強加入觀察
          </button>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/60 bg-cyan-950/20 p-5">
          <h2 className="text-xl font-black">收盤後一鍵流程</h2>
          <p className="mt-2 text-sm font-bold text-slate-200">
            清空舊觀察 → 加入 Top10 → 加入警報股 → 切到觀察頁。
          </p>

          <button
            onClick={() => buildTomorrowList([...top10List.map((s) => s.code), ...alerts.map((s) => s.code)])}
            className="mt-4 w-full rounded-2xl bg-cyan-500/20 py-3 text-lg font-black text-cyan-200 active:scale-95"
          >
            建立明天觀察清單
          </button>
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SectionButton title="🏭 產業" sub="主流產業Top3" onClick={() => setMoreView("industry")} />
              <SectionButton title="⚙️ 設定" sub="條件與股價上限" onClick={() => setMoreView("settings")} />
              <SectionButton title="🚫 不碰" sub={`${avoidList.length} 檔`} onClick={() => setMoreView("avoid")} />
              <SectionButton title="↩️ 回測" sub={`${pullbackList.length} 檔`} onClick={() => setMoreView("pullback")} />
              <SectionButton title="🚀 突破" sub={`${breakoutList.length} 檔`} onClick={() => setMoreView("breakout")} />
              <SectionButton title="⏰ 9:10" sub={`${open910List.length} 檔`} onClick={() => setMoreView("open910")} />
              <SectionButton title="📈 統計" sub={`勝率 ${observeSuccessRate}`} onClick={() => setMoreView("stats")} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "📊 今日清單"}
              {tab === "top" && "🏆 Top10"}
              {tab === "observe" && "📝 觀察清單"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "menu" && "☰ 更多"}
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "settings" && "⚙️ 條件設定"}
              {tab === "more" && moreView === "avoid" && "🚫 不要碰"}
              {tab === "more" && moreView === "pullback" && "↩️ 回測觀察"}
              {tab === "more" && moreView === "breakout" && "🚀 突破確認"}
              {tab === "more" && moreView === "open910" && "⏰ 9:10清單"}
              {tab === "more" && moreView === "stats" && "📈 統計"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              卡片已壓縮，點開才顯示完整細節。
            </p>
          </div>

          {tab === "more" && moreView === "settings" && (
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
                      <div key={stock.code}>
                        {i + 1}. {stock.code} {stock.name} {formatPercent(stock.changePercent)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <div className="text-lg font-black">非主流但很強</div>
                <div className="mt-3 space-y-2 text-sm font-bold text-cyan-100">
                  {nonMainStrongList.length === 0 && <div>目前沒有</div>}
                  {nonMainStrongList.map((stock, index) => (
                    <div key={stock.code}>
                      {index + 1}. {stock.code} {stock.name}｜{stock.industry}｜{formatPercent(stock.changePercent)}
                    </div>
                  ))}
                </div>
              </div>
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
              </div>
            </div>
          )}

          {tab === "observe" && (
            <div className="space-y-5">
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
              </div>

              {(["明天優先", "等回測", "不追高"] as ObserveGroup[]).map((group) => {
                const groupStocks = groupedObserve[group];

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
                        <StockCard
                          key={stock.code}
                          stock={stock}
                          rank={index + 1}
                          {...cardProps}
                        />
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
                <h3 className="text-xl font-black">加入自選股</h3>

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
              </div>

              {(["短線觀察", "明天追蹤", "長期關注"] as FavoriteGroup[]).map((group) => {
                const groupStocks = groupedFavorite[group];

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
                        <StockCard
                          key={stock.code}
                          stock={stock}
                          rank={index + 1}
                          {...cardProps}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab !== "observe" &&
            tab !== "favorite" &&
            !(tab === "more" && ["settings", "industry", "stats", "menu"].includes(moreView)) && (
              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                    目前沒有符合條件的股票。
                  </div>
                )}

                {currentList.map((stock, index) => (
                  <StockCard
                    key={`${stock.code}-${index}`}
                    stock={stock}
                    rank={index + 1}
                    {...cardProps}
                  />
                ))}
              </div>
            )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "今日"],
            ["top", "🏆", "Top"],
            ["observe", "📝", "觀察"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as TabKey)}
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