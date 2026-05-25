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
  | "industry"
  | "settings"
  | "data"
  | "buyRadar"
  | "sellRadar"
  | "waitRadar"
  | "breakoutRadar"
  | "noEntryRadar"
  | "holdRadar"
  | "exitRadar"
  | "profitRank"
  | "lossRank"
  | "stats";

type PriceDirection = "up" | "down" | "same" | "new";
type ObserveGroup = "明天優先" | "等回測" | "不追高" | "持有追蹤";
type EntryMode = "保守" | "標準" | "積極";
type HoldStatus = "續抱" | "觀察" | "減碼" | "出場";

type Settings = {
  maxPrice: number;
  alertPercent: number;
  excludeHot: boolean;
  refreshSeconds: number;
  favoriteOnlyActive: boolean;
  pullbackRangePercent: number;
  stopLossPercent: number;
  hotPercent: number;
  entryMode: EntryMode;
  holdStopLossPercent: number;
  holdTakeProfitPercent: number;
  trailingProfit: boolean;
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
const HOLD_KEY = "taiwan-stock-radar-holds";
const ENTRY_PRICE_KEY = "taiwan-stock-radar-entry-prices";

const defaultSettings: Settings = {
  maxPrice: 200,
  alertPercent: 5,
  excludeHot: true,
  refreshSeconds: 30,
  favoriteOnlyActive: false,
  pullbackRangePercent: 1.5,
  stopLossPercent: 1,
  hotPercent: 8,
  entryMode: "標準",
  holdStopLossPercent: 3,
  holdTakeProfitPercent: 8,
  trailingProfit: true,
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

function requiredEntryCount(settings: Settings) {
  if (settings.entryMode === "保守") return 5;
  if (settings.entryMode === "積極") return 3;
  return 4;
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
  const nearOpen =
    Math.abs(stock.price - stock.openPrice) / stock.openPrice <=
    settings.pullbackRangePercent / 100;
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

function getEntryConditions(stock: Stock, mainIndustries: string[], settings: Settings) {
  return [
    { label: "站上開盤價", ok: stock.price >= stock.openPrice },
    { label: "漲幅2%～6%", ok: stock.changePercent >= 2 && stock.changePercent <= 6 },
    { label: "未過熱", ok: !isHot(stock, settings) },
    { label: "主流產業", ok: mainIndustries.includes(stock.industry) },
    { label: "沒跌破昨收", ok: stock.price >= stock.previousClose },
    { label: `股價${settings.maxPrice}元內`, ok: stock.price > 0 && stock.price <= settings.maxPrice },
  ];
}

function getNoEntryReason(stock: Stock, settings: Settings) {
  if (stock.price > settings.maxPrice) return `股價超過${settings.maxPrice}元`;
  if (isHot(stock, settings)) return "過熱，不追高";
  if (stock.price < stock.openPrice) return "跌破開盤價";
  if (stock.changePercent < 2) return "漲幅低於2%";
  if (stock.price < stock.previousClose) return "跌破昨收";
  return "";
}

function getEntryTiming(stock: Stock, mainIndustries: string[], settings: Settings) {
  const noReason = getNoEntryReason(stock, settings);
  if (noReason) return "不進場";

  const count = getEntryConditions(stock, mainIndustries, settings).filter((item) => item.ok).length;
  const required = requiredEntryCount(settings);

  if (isPullback(stock, settings)) return "等回測";
  if (isBreakout(stock) && count >= required) return "可進場";
  if (count >= required) return "可觀察";
  return "等訊號";
}

function getEntryLight(stock: Stock, mainIndustries: string[], settings: Settings) {
  const timing = getEntryTiming(stock, mainIndustries, settings);

  if (timing === "可進場" || timing === "可觀察") {
    return { label: "🟢 綠燈", text: "可觀察進場", tone: "text-emerald-300" };
  }

  if (timing === "等回測" || timing === "等訊號") {
    return { label: "🟡 黃燈", text: timing === "等回測" ? "等回測進場" : "等更明確訊號", tone: "text-yellow-300" };
  }

  return { label: "🔴 紅燈", text: "不要進場", tone: "text-red-300" };
}

function getBuySuggestion(stock: Stock, mainIndustries: string[], settings: Settings) {
  const timing = getEntryTiming(stock, mainIndustries, settings);
  const noReason = getNoEntryReason(stock, settings);

  if (timing === "不進場") return `不要進場：${noReason}`;
  if (timing === "等回測") return `等價格回到開盤價 ±${settings.pullbackRangePercent}% 並守住開盤。`;
  if (timing === "可進場") return "突破條件符合，可觀察進場，但不追過熱。";
  if (timing === "可觀察") return "條件多數符合，可列入進場觀察。";
  return "還沒到進場時機，等站上開盤或轉強。";
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
  const timing = getEntryTiming(stock, mainIndustries, settings);
  if (timing === "可進場") return "可觀察進場";
  if (timing === "可觀察") return "可觀察";
  if (timing === "等回測") return "等回測";
  if (timing === "不進場") return "不要進場";
  return "等待訊號";
}

function getProfitPercent(stock: Stock, entryPrice: number) {
  if (!entryPrice || entryPrice <= 0) return null;
  return ((stock.price - entryPrice) / entryPrice) * 100;
}

function getHoldStopLoss(entryPrice: number, settings: Settings) {
  if (!entryPrice || entryPrice <= 0) return 0;
  return entryPrice * (1 - settings.holdStopLossPercent / 100);
}

function getHoldTakeProfit(entryPrice: number, settings: Settings) {
  if (!entryPrice || entryPrice <= 0) return 0;
  return entryPrice * (1 + settings.holdTakeProfitPercent / 100);
}

function getTrailingStop(stock: Stock, entryPrice: number, settings: Settings) {
  if (!settings.trailingProfit || !entryPrice || entryPrice <= 0) return 0;

  const profit = getProfitPercent(stock, entryPrice);
  if (profit === null || profit < settings.holdTakeProfitPercent) return 0;

  return Math.max(entryPrice * 1.01, stock.openPrice, stock.previousClose);
}

function getHoldStatus(stock: Stock, entryPrice: number, mainIndustries: string[], settings: Settings): HoldStatus {
  const profit = getProfitPercent(stock, entryPrice);
  const stopLoss = getHoldStopLoss(entryPrice, settings);
  const takeProfit = getHoldTakeProfit(entryPrice, settings);
  const trailingStop = getTrailingStop(stock, entryPrice, settings);
  const timing = getEntryTiming(stock, mainIndustries, settings);

  if (entryPrice > 0 && stock.price <= stopLoss) return "出場";
  if (trailingStop > 0 && stock.price < trailingStop) return "出場";
  if (stock.price < stock.previousClose || stock.changePercent < 2) return "出場";
  if (timing === "不進場") return "出場";

  if (entryPrice > 0 && stock.price >= takeProfit) return "減碼";
  if (isHot(stock, settings)) return "減碼";
  if (stock.price < stock.openPrice) return "減碼";

  if (
    stock.price >= stock.openPrice &&
    stock.price >= stock.previousClose &&
    stock.changePercent >= 2 &&
    !isHot(stock, settings)
  ) {
    return "續抱";
  }

  return "觀察";
}

function getHoldSuggestion(stock: Stock, entryPrice: number, mainIndustries: string[], settings: Settings) {
  const status = getHoldStatus(stock, entryPrice, mainIndustries, settings);
  const profit = getProfitPercent(stock, entryPrice);

  if (!entryPrice || entryPrice <= 0) return "請先輸入我的進場價，才能計算持有損益與停損停利。";
  if (status === "出場") return "出場提醒：跌破停損線、轉弱或進場條件失敗。";
  if (status === "減碼") return "可考慮減碼：已達停利區、過熱或跌破開盤。";
  if (status === "續抱") return `續抱：目前損益 ${formatPercent(profit)}，仍守住主要條件。`;
  return "觀察：尚未明顯轉強或轉弱，先看是否守住開盤與昨收。";
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

function getDistanceToEntry(stock: Stock, settings: Settings) {
  if (stock.openPrice <= 0) return 999;
  const buyLow = stock.openPrice * (1 - settings.pullbackRangePercent / 100);
  const buyHigh = stock.openPrice * (1 + settings.pullbackRangePercent / 100);

  if (stock.price >= buyLow && stock.price <= buyHigh) return 0;
  if (stock.price > buyHigh) return Math.abs(stock.price - buyHigh) / buyHigh;
  return Math.abs(stock.price - buyLow) / buyLow;
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
  settings,
  mainIndustries,
  favoriteCodes,
  observeCodes,
  holdCodes,
  entryPrices,
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
  holdCodes: string[];
  entryPrices: Record<string, number>;
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
  const isHold = holdCodes.includes(stock.code);
  const score = scoreStock(stock, mainIndustries, settings);
  const direction = priceDirections[stock.code];
  const oldRank = previousRanks[stock.code];
  const rankText = !oldRank ? "新進" : oldRank > rank ? `↑${oldRank - rank}` : oldRank < rank ? `↓${rank - oldRank}` : "持平";
  const entryLight = getEntryLight(stock, mainIndustries, settings);
  const timing = getEntryTiming(stock, mainIndustries, settings);
  const entryPrice = entryPrices[stock.code] || 0;
  const holdStatus = getHoldStatus(stock, entryPrice, mainIndustries, settings);
  const profit = getProfitPercent(stock, entryPrice);

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
            <div className={`text-xl font-black ${isUp ? "text-red-400" : "text-emerald-400"}`}>{formatPercent(stock.changePercent)}</div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full bg-slate-800 px-3 py-1">{getStatus(stock, settings)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${entryLight.tone}`}>{timing}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">分數 {score}</span>
          {isHold && <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">持有：{holdStatus}</span>}
          {isHold && profit !== null && (
            <span className={`rounded-full bg-black/30 px-3 py-1 ${profit >= 0 ? "text-red-300" : "text-emerald-300"}`}>
              損益 {formatPercent(profit)}
            </span>
          )}
          <span className={`rounded-full bg-black/30 px-3 py-1 ${getDirectionTone(direction)}`}>{getDirectionText(direction)}</span>
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
          {isObserve && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">觀察</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          {isHold
            ? `持有：${holdStatus}｜${getHoldSuggestion(stock, entryPrice, mainIndustries, settings)}`
            : `進場：${entryLight.label} ${entryLight.text}｜賣點：${getSellSuggestion(stock, settings)}`}
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
  const [holdCodes, setHoldCodes] = useState<string[]>([]);
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>({});
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
    setHoldCodes(safeParse(localStorage.getItem(HOLD_KEY), []));
    setEntryPrices(safeParse(localStorage.getItem(ENTRY_PRICE_KEY), {}));
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

  function saveHoldCodes(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setHoldCodes(clean);
    localStorage.setItem(HOLD_KEY, JSON.stringify(clean));
  }

  function saveEntryPrice(code: string, price: number) {
    const next = { ...entryPrices, [code]: price };
    setEntryPrices(next);
    localStorage.setItem(ENTRY_PRICE_KEY, JSON.stringify(next));
  }

  function addHold(code: string, price?: number) {
    const clean = cleanCode(code);
    if (!clean) return;

    saveHoldCodes([...holdCodes, clean]);

    if (price && price > 0) {
      saveEntryPrice(clean, price);
    }

    const nextGroups = { ...groups, [clean]: "持有追蹤" as ObserveGroup };
    setGroups(nextGroups);
    localStorage.setItem(GROUP_KEY, JSON.stringify(nextGroups));
  }

  function removeHold(code: string) {
    saveHoldCodes(holdCodes.filter((item) => item !== code));
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

  const buyRadarList = useMemo(
    () =>
      top50
        .filter((stock) => stock.price > 0 && stock.price <= settings.maxPrice)
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => !isWeak(stock))
        .filter((stock) => ["可進場", "可觀察", "等回測"].includes(getEntryTiming(stock, mainIndustries, settings)))
        .sort((a, b) => getDistanceToEntry(a, settings) - getDistanceToEntry(b, settings))
        .slice(0, 30),
    [top50, mainIndustries, settings]
  );

  const waitRadarList = useMemo(
    () =>
      top50
        .filter((stock) => stock.price > stock.openPrice * (1 + settings.pullbackRangePercent / 100))
        .filter((stock) => !isHot(stock, settings))
        .filter((stock) => scoreStock(stock, mainIndustries, settings) >= 50)
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

  const holdStocks = useMemo(
    () => holdCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [holdCodes, stocks]
  );

  const holdExitList = useMemo(
    () =>
      holdStocks.filter((stock) =>
        ["出場", "減碼"].includes(getHoldStatus(stock, entryPrices[stock.code] || 0, mainIndustries, settings))
      ),
    [holdStocks, entryPrices, mainIndustries, settings]
  );

  const profitRankList = useMemo(
    () =>
      [...holdStocks]
        .filter((stock) => (entryPrices[stock.code] || 0) > 0)
        .sort((a, b) => (getProfitPercent(b, entryPrices[b.code]) || -999) - (getProfitPercent(a, entryPrices[a.code]) || -999)),
    [holdStocks, entryPrices]
  );

  const lossRankList = useMemo(
    () =>
      [...holdStocks]
        .filter((stock) => (entryPrices[stock.code] || 0) > 0)
        .sort((a, b) => (getProfitPercent(a, entryPrices[a.code]) || 999) - (getProfitPercent(b, entryPrices[b.code]) || 999)),
    [holdStocks, entryPrices]
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
        ["可進場", "可觀察", "等回測"].includes(getEntryTiming(stock, mainIndustries, settings))
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
    if (tab === "top") return sortList(top10);
    if (tab === "observe") return sortList(observeStocks);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "today") return sortList(top50);
      if (moreView === "industry") return [];
      if (moreView === "buyRadar") return sortList(buyRadarList);
      if (moreView === "waitRadar") return sortList(waitRadarList);
      if (moreView === "sellRadar") return sortList(sellRadarList);
      if (moreView === "holdRadar") return sortList(holdStocks);
      if (moreView === "exitRadar") return sortList(holdExitList);
      if (moreView === "profitRank") return profitRankList;
      if (moreView === "lossRank") return lossRankList;
    }

    return [];
  }, [
    tab,
    moreView,
    top10,
    observeStocks,
    favoriteStocks,
    top50,
    buyRadarList,
    waitRadarList,
    sellRadarList,
    holdStocks,
    holdExitList,
    profitRankList,
    lossRankList,
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

  const cardProps = {
    settings,
    mainIndustries,
    favoriteCodes,
    observeCodes,
    holdCodes,
    entryPrices,
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
    const isHold = holdCodes.includes(selectedStock.code);

    const entryPrice = entryPrices[selectedStock.code] || 0;
    const profit = getProfitPercent(selectedStock, entryPrice);
    const holdStatus = getHoldStatus(selectedStock, entryPrice, mainIndustries, settings);
    const stopLoss = getHoldStopLoss(entryPrice, settings);
    const takeProfit = getHoldTakeProfit(entryPrice, settings);
    const trailingStop = getTrailingStop(selectedStock, entryPrice, settings);

    const entryLight = getEntryLight(selectedStock, mainIndustries, settings);
    const entryTiming = getEntryTiming(selectedStock, mainIndustries, settings);
    const conditions = getEntryConditions(selectedStock, mainIndustries, settings);
    const passCount = conditions.filter((item) => item.ok).length;
    const requiredCount = requiredEntryCount(settings);

    const buyLow = selectedStock.openPrice * (1 - settings.pullbackRangePercent / 100);
    const buyHigh = selectedStock.openPrice * (1 + settings.pullbackRangePercent / 100);

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
                  {getStatus(selectedStock, settings)}｜分數 {score}
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
              <div className="text-xs font-bold text-slate-500">現在進場判斷</div>
              <div className={`mt-1 text-2xl font-black ${entryLight.tone}`}>
                {entryLight.label} {entryLight.text}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                條件符合 {passCount}/{conditions.length}，{settings.entryMode}模式需要 {requiredCount} 個條件。
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-emerald-500/50 bg-emerald-950/20 p-5">
            <h2 className="text-xl font-black">進場後持有追蹤</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="持有狀態" value={isHold ? holdStatus : "未持有追蹤"} />
              <DetailRow label="目前損益" value={profit === null ? "--" : formatPercent(profit)} />
              <DetailRow label="我的進場價" value={entryPrice > 0 ? `${entryPrice.toFixed(2)} 元` : "尚未輸入"} />
              <DetailRow label="目前股價" value={`${selectedStock.price.toFixed(2)} 元`} />
              <DetailRow label="停損線" value={stopLoss > 0 ? `${stopLoss.toFixed(2)} 元` : "--"} />
              <DetailRow label="停利線" value={takeProfit > 0 ? `${takeProfit.toFixed(2)} 元` : "--"} />
              <DetailRow label="移動停利" value={trailingStop > 0 ? `${trailingStop.toFixed(2)} 元` : settings.trailingProfit ? "尚未啟動" : "關閉"} />
              <DetailRow label="持有建議" value={getHoldSuggestion(selectedStock, entryPrice, mainIndustries, settings)} />
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={entryPrice > 0 ? String(entryPrice) : ""}
                onChange={(e) => saveEntryPrice(selectedStock.code, n(e.target.value))}
                inputMode="decimal"
                placeholder="輸入我的進場價"
                className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
              />

              <button
                onClick={() => addHold(selectedStock.code, entryPrice || selectedStock.price)}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black"
              >
                加入持有
              </button>
            </div>

            <button
              onClick={() => removeHold(selectedStock.code)}
              className="mt-3 w-full rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200"
            >
              移出持有追蹤
            </button>
          </section>

          <section className="mt-4 rounded-3xl border border-cyan-500/50 bg-cyan-950/20 p-5">
            <h2 className="text-xl font-black">進場價位</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <DetailRow label="現在判斷" value={entryTiming} />
              <DetailRow label="進場建議" value={getBuySuggestion(selectedStock, mainIndustries, settings)} />
              <DetailRow label="回測低" value={`${buyLow.toFixed(2)} 元`} />
              <DetailRow label="回測高" value={`${buyHigh.toFixed(2)} 元`} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-yellow-500/50 bg-yellow-950/20 p-5">
            <h2 className="text-xl font-black">持有續抱條件</h2>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
              {[
                ["站上開盤價", selectedStock.price >= selectedStock.openPrice],
                ["未跌破昨收", selectedStock.price >= selectedStock.previousClose],
                ["漲幅2%以上", selectedStock.changePercent >= 2],
                ["未過熱轉弱", !isHot(selectedStock, settings) && !isWeak(selectedStock)],
                ["未跌破停損", stopLoss > 0 ? selectedStock.price > stopLoss : true],
                ["未觸發出場", holdStatus !== "出場"],
              ].map(([label, ok]: any) => (
                <div key={label} className={`rounded-2xl p-3 ${ok ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                  {ok ? "✅" : "❌"} {label}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-red-500/50 bg-red-950/20 p-5">
            <h2 className="text-xl font-black">減碼 / 出場條件</h2>

            <div className="mt-3 space-y-2 text-sm font-black text-red-100">
              {holdStatus === "出場" && <div className="rounded-2xl bg-black/30 p-3">🚨 出場提醒：跌破停損、轉弱或進場條件失敗。</div>}
              {holdStatus === "減碼" && <div className="rounded-2xl bg-black/30 p-3">⚠️ 減碼提醒：達停利區、過熱或跌破開盤。</div>}
              {selectedStock.price < selectedStock.openPrice && <div className="rounded-2xl bg-black/30 p-3">⚠️ 跌破開盤價</div>}
              {selectedStock.price < selectedStock.previousClose && <div className="rounded-2xl bg-black/30 p-3">⚠️ 跌破昨收</div>}
              {profit !== null && profit <= -settings.holdStopLossPercent && <div className="rounded-2xl bg-black/30 p-3">🚨 跌破停損百分比</div>}
              {profit !== null && profit >= settings.holdTakeProfitPercent && <div className="rounded-2xl bg-black/30 p-3">✅ 達停利區，可考慮分批</div>}
              {holdStatus === "續抱" && <div className="rounded-2xl bg-black/30 p-3">目前仍符合續抱條件。</div>}
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
              <button onClick={() => setObserveGroup(selectedStock.code, "持有追蹤")} className="rounded-2xl bg-emerald-500/20 py-3 text-xs font-black text-emerald-200">持有追蹤</button>
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
              <div className="text-sm font-bold text-slate-400">台股進場後追蹤管理版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">今日儀表板</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">{signal.text}</p>
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
          <MiniCard title="持有雷達" value={holdStocks.length} sub="正在追蹤" tone="text-emerald-300" onClick={() => goMore("holdRadar")} />
          <MiniCard title="出場雷達" value={holdExitList.length} sub="減碼 / 出場" tone="text-red-300" onClick={() => goMore("exitRadar")} />
          <MiniCard title="獲利排行" value={profitRankList.length} sub="持有獲利" tone="text-red-300" onClick={() => goMore("profitRank")} />
          <MiniCard title="虧損排行" value={lossRankList.length} sub="持有虧損" tone="text-emerald-300" onClick={() => goMore("lossRank")} />
          <MiniCard title="最接近進場" value={buyRadarList.length} sub="進場雷達" tone="text-cyan-300" onClick={() => goMore("buyRadar")} />
          <MiniCard title="賣點雷達" value={sellRadarList.length} sub="跌破 / 過熱" tone="text-red-300" onClick={() => goMore("sellRadar")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="今日50強" sub="完整清單" badge={top50.length} tone="text-red-300" onClick={() => goMore("today")} />
          <ActionCard title="Top10" sub="高分觀察" badge={top10.length} tone="text-cyan-300" onClick={() => setTab("top")} />
          <ActionCard title="觀察" sub="觀察清單" badge={observeCodes.length} tone="text-cyan-300" onClick={() => setTab("observe")} />
          <ActionCard title="自選" sub="自選清單" badge={favoriteCodes.length} tone="text-yellow-300" onClick={() => setTab("favorite")} />
          <ActionCard title="設定" sub="停損 / 停利" badge="⚙️" tone="text-purple-300" onClick={() => goMore("settings")} />
          <ActionCard title="統計" sub="持有與出場" badge="看" tone="text-blue-300" onClick={() => goMore("stats")} />
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
              <ActionCard title="持有雷達" sub="持有追蹤" badge={holdStocks.length} tone="text-emerald-300" onClick={() => setMoreView("holdRadar")} />
              <ActionCard title="出場雷達" sub="減碼 / 出場" badge={holdExitList.length} tone="text-red-300" onClick={() => setMoreView("exitRadar")} />
              <ActionCard title="獲利排行" sub="持有損益" badge={profitRankList.length} tone="text-red-300" onClick={() => setMoreView("profitRank")} />
              <ActionCard title="虧損排行" sub="持有損益" badge={lossRankList.length} tone="text-emerald-300" onClick={() => setMoreView("lossRank")} />
              <ActionCard title="買點雷達" sub="接近進場" badge={buyRadarList.length} tone="text-cyan-300" onClick={() => setMoreView("buyRadar")} />
              <ActionCard title="賣點雷達" sub="跌破 / 過熱" badge={sellRadarList.length} tone="text-red-300" onClick={() => setMoreView("sellRadar")} />
              <ActionCard title="今日50強" sub="完整清單" badge={top50.length} tone="text-red-300" onClick={() => setMoreView("today")} />
              <ActionCard title="產業" sub="產業熱度" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="持有參數" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
              <ActionCard title="資料" sub="API狀態" badge={dataStatus} tone="text-blue-300" onClick={() => setMoreView("data")} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "首頁卡片"}
              {tab === "top" && "🏆 Top10"}
              {tab === "observe" && "📝 觀察清單"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "today" && "📊 今日50強"}
              {tab === "more" && moreView === "buyRadar" && "🟢 買點雷達"}
              {tab === "more" && moreView === "sellRadar" && "🔴 賣點雷達"}
              {tab === "more" && moreView === "holdRadar" && "🟢 持有雷達"}
              {tab === "more" && moreView === "exitRadar" && "🔴 出場雷達"}
              {tab === "more" && moreView === "profitRank" && "📈 獲利排行"}
              {tab === "more" && moreView === "lossRank" && "📉 虧損排行"}
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "stats" && "📈 統計"}
              {tab === "more" && moreView === "data" && "📡 資料狀態"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              進場後追蹤管理版：進場後看續抱、減碼、出場。
            </p>
          </div>

          {tab === "observe" && (
            <div className="space-y-5">
              {(["持有追蹤", "明天優先", "等回測", "不追高"] as ObserveGroup[]).map((group) => {
                const groupStocks =
                  group === "持有追蹤"
                    ? holdStocks
                    : observeStocks.filter((stock) => (groups[stock.code] || "明天優先") === group);

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
            <div className="space-y-3">
              {favoriteStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">目前沒有自選股</div>}
              {favoriteStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">持有停損</div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 5].map((p) => (
                    <button key={p} onClick={() => saveSettings({ ...settings, holdStopLossPercent: p })} className={`rounded-2xl py-3 text-sm font-black ${settings.holdStopLossPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      -{p}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">持有停利</div>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 8, 10].map((p) => (
                    <button key={p} onClick={() => saveSettings({ ...settings, holdTakeProfitPercent: p })} className={`rounded-2xl py-3 text-sm font-black ${settings.holdTakeProfitPercent === p ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                      +{p}%
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => saveSettings({ ...settings, trailingProfit: !settings.trailingProfit })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${settings.trailingProfit ? "bg-emerald-500/30 text-emerald-200" : "bg-red-500/30 text-red-200"}`}
              >
                移動停利：{settings.trailingProfit ? "開啟" : "關閉"}
              </button>

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
            </div>
          )}

          {tab === "more" && moreView === "stats" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">統計中心</div>
              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>今日50強：{top50.length}</div>
                <div>持有追蹤：{holdStocks.length}</div>
                <div>出場 / 減碼：{holdExitList.length}</div>
                <div>獲利排行：{profitRankList.length}</div>
                <div>虧損排行：{lossRankList.length}</div>
                <div>觀察股：{observeCodes.length}</div>
                <div>自選股：{favoriteCodes.length}</div>
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