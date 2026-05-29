import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
  highPrice: number;
  lowPrice: number;
  updatedAt?: string;
};

type TabKey = "home" | "top50" | "watch" | "favorite" | "more";

type PopupKey =
  | ""
  | "industry"
  | "core"
  | "pullback"
  | "overheat"
  | "failed"
  | "amount"
  | "volume"
  | "top50"
  | "search"
  | "data"
  | "settings";

type SignalHistory = {
  code: string;
  prices: number[];
  attackRaw: boolean[];
  entryRaw: boolean[];
  failRaw: boolean[];
  overheatRaw: boolean[];
  pullbackRaw: boolean[];
};

type Settings = {
  refreshSeconds: number;
  confirmTimes: number;
  noisePercent: number;
  hotPercent: number;
  stableIndustryLock: boolean;
};

type IndustryItem = {
  industry: string;
  count: number;
  totalAmount: number;
  totalVolume: number;
  avgChange: number;
  amountShare: number;
  volumeShare: number;
  attackCount: number;
  coreCount: number;
  failCount: number;
  overheatCount: number;
  score: number;
  status: "主線續航" | "主線剛轉強" | "資金分歧" | "主線退潮" | "短線過熱" | "觀察中";
  light: "綠燈" | "黃燈" | "紅燈" | "灰燈";
  stocks: Stock[];
};

type PriceDirection = "up" | "down" | "same" | "new";

const API_URL = "/api/stocks";
const SEARCH_API_URL = "/api/search";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const WATCH_KEY = "taiwan-stock-radar-watch";
const SETTINGS_KEY = "taiwan-stock-radar-mini-popup-settings";
const CACHE_KEY = "taiwan-stock-radar-mini-popup-cache";
const SIGNAL_KEY = "taiwan-stock-radar-mini-popup-signals";
const SEARCH_HISTORY_KEY = "taiwan-stock-radar-search-history";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-mini-popup-locked";

const defaultSettings: Settings = {
  refreshSeconds: 30,
  confirmTimes: 3,
  noisePercent: 0.3,
  hotPercent: 8,
  stableIndustryLock: true,
};

const codeToChineseName: Record<string, string> = {
  "2330": "台積電",
  "2303": "聯電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2344": "華邦電",
  "2408": "南亞科",
  "2337": "旺宏",
  "3481": "群創",
  "2409": "友達",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2324": "仁寶",
  "2356": "英業達",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",
  "2308": "台達電",
  "2301": "光寶科",
  "8299": "群聯",
  "3443": "創意",
  "3661": "世芯-KY",
  "3035": "智原",
  "3034": "聯詠",
  "2379": "瑞昱",
  "6415": "矽力-KY",
  "6770": "力積電",
  "3711": "日月光投控",
  "2383": "台光電",
  "3037": "欣興",
  "3189": "景碩",
  "8046": "南電",
  "2368": "金像電",
  "3017": "奇鋐",
  "3324": "雙鴻",
  "3653": "健策",
  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
  "2881": "富邦金",
  "2882": "國泰金",
  "2884": "玉山金",
  "2885": "元大金",
  "2891": "中信金",
  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "8299": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3035": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

  "2317": "電子代工",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2324": "電子代工",
  "2356": "電子代工",
  "2357": "電腦週邊",
  "2376": "AI伺服器",
  "2377": "電腦週邊",

  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",
  "2313": "PCB",
  "2367": "PCB",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",
  "2308": "電源能源",
  "2301": "電源能源",

  "3481": "面板",
  "2409": "面板",

  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",

  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2885": "金融",
  "2891": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
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

function nowText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function cleanCode(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function stockDisplayName(stock: { code: string; name?: string }) {
  return codeToChineseName[stock.code] || stock.name || stock.code;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-TW");
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}萬`;
  return value.toFixed(0);
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "")
    .replace(".TW", "")
    .replace(".TWO", "")
    .replace(/\D/g, "")
    .slice(0, 6);

  const rawName = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);
  const name = codeToChineseName[code] || rawName;

  const price = n(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = n(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = n(raw.openPrice ?? raw.open ?? raw.o ?? price);

  const highPrice = Math.max(n(raw.highPrice ?? raw.high ?? raw.h ?? price), price, openPrice, previousClose);
  const lowPrice = Math.min(n(raw.lowPrice ?? raw.low ?? raw.l ?? price), price, openPrice || price, previousClose || price);

  const changePercent =
    raw.changePercent !== undefined
      ? n(raw.changePercent)
      : previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

  const openPremiumPercent =
    raw.openPremiumPercent !== undefined && raw.openPremiumPercent !== null
      ? n(raw.openPremiumPercent)
      : previousClose > 0 && openPrice > 0
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
    industry: raw.industry && raw.industry !== "其他" ? String(raw.industry) : industryMap[code] ?? "其他",
    highPrice,
    lowPrice,
    updatedAt: String(raw.updatedAt ?? raw.time ?? raw.updateTime ?? updateTime),
  };
}

function openingPremium(stock: Stock) {
  return stock.openPremiumPercent ?? 0;
}

function afterOpenPercent(stock: Stock) {
  if (stock.openPrice <= 0) return 0;
  return ((stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function estimatedAmount(stock: Stock) {
  return Math.max(0, stock.price * stock.volume);
}

function amountRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function volumeRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => b.volume - a.volume);
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function rankPercent(rank: number, length: number) {
  if (rank >= 999 || length <= 1) return 0;
  return Math.round(((length - rank + 1) / length) * 100);
}

function amountRankPercent(stock: Stock, list: Stock[]) {
  return rankPercent(amountRankIndex(stock, list), list.length);
}

function volumeRankPercent(stock: Stock, list: Stock[]) {
  return rankPercent(volumeRankIndex(stock, list), list.length);
}

function priceMovePercent(stock: Stock, prevPrice?: number) {
  if (!prevPrice || prevPrice <= 0) return 0;
  return ((stock.price - prevPrice) / prevPrice) * 100;
}

function isMeaningfulMove(stock: Stock, prevPrice: number | undefined, settings: Settings) {
  if (!prevPrice) return true;
  return Math.abs(priceMovePercent(stock, prevPrice)) >= settings.noisePercent;
}

function volumeState(stock: Stock, list: Stock[]) {
  const rank = volumeRankPercent(stock, list);
  if (rank >= 80) return "量能強";
  if (rank >= 50) return "量能普通";
  return "量能不足";
}

function priceVolumeState(stock: Stock, list: Stock[], settings: Settings) {
  const vol = volumeState(stock, list);

  if (stock.price < stock.openPrice || stock.price < stock.previousClose) return "轉弱退潮";
  if (stock.changePercent >= 3 && vol === "量能強") return "量價同步";
  if (stock.changePercent >= settings.hotPercent && vol !== "量能強") return "低量假強";
  if (amountRankPercent(stock, list) >= 70 && stock.changePercent < 2.5) return "爆量不漲";
  return "觀察中";
}

function isOverheat(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || openingPremium(stock) >= 6 || afterOpenPercent(stock) >= 4;
}

function isFail(stock: Stock, list: Stock[], settings: Settings) {
  const pv = priceVolumeState(stock, list, settings);
  return pv === "轉弱退潮" || pv === "爆量不漲" || stock.price < stock.openPrice || stock.changePercent < 0;
}

function isMoneyAttack(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  return (
    mainIndustries.includes(stock.industry) &&
    amountRankPercent(stock, list) >= 70 &&
    volumeRankPercent(stock, list) >= 65 &&
    stock.price >= stock.openPrice &&
    priceVolumeState(stock, list, settings) === "量價同步" &&
    !isOverheat(stock, settings)
  );
}

function isPullback(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  return (
    mainIndustries.includes(stock.industry) &&
    amountRankPercent(stock, list) >= 60 &&
    stock.price >= stock.openPrice &&
    afterOpenPercent(stock) >= 1.5 &&
    afterOpenPercent(stock) <= 3.5 &&
    !isFail(stock, list, settings)
  );
}

function stableCount(values: boolean[] | undefined) {
  if (!values || values.length === 0) return 0;
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i]) count += 1;
    else break;
  }
  return count;
}

function decisionTone(label: string) {
  if (["主線核心", "可續抱", "資金主攻"].includes(label)) return "text-emerald-300";
  if (["等回測", "提高警覺", "主線剛轉強", "觀察中"].includes(label)) return "text-yellow-300";
  if (["過熱不追", "分批停利", "短線過熱"].includes(label)) return "text-orange-300";
  if (["主線失效", "出場避開", "轉弱退潮", "爆量不漲", "低量假強"].includes(label)) return "text-red-300";
  return "text-slate-300";
}

function flowTone(label: string) {
  if (label === "主線續航" || label === "綠燈") return "text-emerald-300";
  if (label === "主線剛轉強" || label === "資金分歧" || label === "黃燈") return "text-yellow-300";
  if (label === "短線過熱") return "text-orange-300";
  if (label === "主線退潮" || label === "紅燈") return "text-red-300";
  return "text-slate-300";
}

function directionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  return "text-cyan-300";
}

function directionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
  if (direction === "new") return "新資料";
  return "--";
}

function getIndustryRanking(
  list: Stock[],
  settings: Settings,
  signalMap: Record<string, SignalHistory>,
  lockedIndustries: string[]
): IndustryItem[] {
  const totalAmount = list.reduce((sum, s) => sum + estimatedAmount(s), 0);
  const totalVolume = list.reduce((sum, s) => sum + s.volume, 0);
  const rawMain = lockedIndustries.length ? lockedIndustries : [];

  const map = new Map<string, IndustryItem>();

  list.forEach((stock) => {
    const item =
      map.get(stock.industry) ||
      {
        industry: stock.industry,
        count: 0,
        totalAmount: 0,
        totalVolume: 0,
        avgChange: 0,
        amountShare: 0,
        volumeShare: 0,
        attackCount: 0,
        coreCount: 0,
        failCount: 0,
        overheatCount: 0,
        score: 0,
        status: "觀察中",
        light: "灰燈",
        stocks: [],
      };

    item.count += 1;
    item.totalAmount += estimatedAmount(stock);
    item.totalVolume += stock.volume;
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);

    map.set(stock.industry, item);
  });

  const temp = Array.from(map.values()).map((item) => {
    const avgChange = item.avgChange / Math.max(1, item.count);
    const amountShare = totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0;
    const volumeShare = totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0;

    return { ...item, avgChange, amountShare, volumeShare };
  });

  const mainIndustries =
    rawMain.length > 0
      ? rawMain
      : temp
          .sort((a, b) => b.totalAmount + b.totalVolume * 10 - (a.totalAmount + a.totalVolume * 10))
          .slice(0, 3)
          .map((i) => i.industry);

  return temp
    .map((item) => {
      let attackCount = 0;
      let coreCount = 0;
      let failCount = 0;
      let overheatCount = 0;

      item.stocks.forEach((stock) => {
        const history = signalMap[stock.code];
        const attack = isMoneyAttack(stock, list, mainIndustries, settings);
        const fail = isFail(stock, list, settings);
        const overheat = isOverheat(stock, settings);

        if (attack) attackCount += 1;
        if (attack && stableCount(history?.attackRaw) >= Math.max(1, settings.confirmTimes - 1)) coreCount += 1;
        if (fail) failCount += 1;
        if (overheat) overheatCount += 1;
      });

      const score =
        item.amountShare * 2.5 +
        item.volumeShare * 1.6 +
        Math.max(0, item.avgChange) * 5 +
        attackCount * 16 +
        coreCount * 22 -
        failCount * 18 -
        overheatCount * 8;

      let status: IndustryItem["status"] = "觀察中";
      let light: IndustryItem["light"] = "灰燈";

      if (failCount >= Math.max(2, item.count * 0.35)) {
        status = "主線退潮";
        light = "紅燈";
      } else if (overheatCount >= Math.max(2, item.count * 0.35)) {
        status = "短線過熱";
        light = "紅燈";
      } else if (attackCount > 0 && failCount > 0) {
        status = "資金分歧";
        light = "黃燈";
      } else if (coreCount >= 1 && item.amountShare >= 10) {
        status = "主線續航";
        light = "綠燈";
      } else if (attackCount >= 1 || item.amountShare >= 10) {
        status = "主線剛轉強";
        light = "黃燈";
      }

      return {
        ...item,
        attackCount,
        coreCount,
        failCount,
        overheatCount,
        score,
        status,
        light,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function getDecision(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings, history?: SignalHistory) {
  const attackStable = stableCount(history?.attackRaw) >= settings.confirmTimes;
  const failStable = stableCount(history?.failRaw) >= 2;
  const overheatStable = stableCount(history?.overheatRaw) >= 2;
  const pullbackStable = stableCount(history?.pullbackRaw) >= 2;

  if (failStable || isFail(stock, list, settings)) return "主線失效";
  if (overheatStable || isOverheat(stock, settings)) return "過熱不追";
  if (attackStable) return "主線核心";
  if (pullbackStable || isPullback(stock, list, mainIndustries, settings)) return "等回測";
  if (isMoneyAttack(stock, list, mainIndustries, settings)) return "資金主攻";
  return "觀察中";
}

function getHoldingDecision(decision: string) {
  if (decision === "主線核心" || decision === "資金主攻") return "可續抱";
  if (decision === "等回測" || decision === "觀察中") return "提高警覺";
  if (decision === "過熱不追") return "分批停利";
  if (decision === "主線失效") return "出場避開";
  return "提高警覺";
}

function getMainlineText(decision: string) {
  if (decision === "主線核心") return "資金、量能、價格同步，屬於主線核心股，只等合理位置。";
  if (decision === "資金主攻") return "資金正在攻擊，但還需要連續確認，先列入觀察。";
  if (decision === "等回測") return "位置偏高但主線仍在，不追高，等回測合理區。";
  if (decision === "過熱不追") return "短線漲幅或開盤溢價偏高，避免追高。";
  if (decision === "主線失效") return "量價轉弱或爆量不漲，主線失效，先避開。";
  return "主線尚未明確，先觀察產業資金是否延續。";
}

function buyZone(stock: Stock) {
  return {
    observe: `${formatPrice(stock.openPrice)} ～ ${formatPrice(stock.openPrice * 1.015)}`,
    breakout: formatPrice(stock.openPrice * 1.005),
    chase: `高於 ${formatPrice(stock.openPrice * 1.03)}`,
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
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
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

function IndustryCard({ item, rank, onClick }: { item: IndustryItem; rank: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 資金主線</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${flowTone(item.status)}`}>
            {item.light}｜{item.status}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-black text-yellow-300">{formatAmount(item.totalAmount)}</div>
          <div className="text-xs font-black text-slate-400">資金占比 {item.amountShare.toFixed(1)}%</div>
          <div className="text-xs font-black text-slate-400">分數 {item.score.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">主攻<br />{item.attackCount}</div>
        <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">核心<br />{item.coreCount}</div>
        <div className="rounded-2xl bg-black/30 p-2 text-orange-300">過熱<br />{item.overheatCount}</div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">失效<br />{item.failCount}</div>
      </div>
    </button>
  );
}

function StockCard({
  stock,
  rank,
  top50,
  mainIndustries,
  settings,
  signalMap,
  favoriteCodes,
  watchCodes,
  priceDirections,
  previousPriceMap,
  lastSuccessAt,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddWatch,
  onRemoveWatch,
}: {
  stock: Stock;
  rank: number;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  signalMap: Record<string, SignalHistory>;
  favoriteCodes: string[];
  watchCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  lastSuccessAt: string;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddWatch: (code: string) => void;
  onRemoveWatch: (code: string) => void;
}) {
  const history = signalMap[stock.code];
  const decision = getDecision(stock, top50, mainIndustries, settings, history);
  const holding = getHoldingDecision(decision);
  const pv = priceVolumeState(stock, top50, settings);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const isFavorite = favoriteCodes.includes(stock.code);
  const isWatch = watchCodes.includes(stock.code);
  const attackCount = stableCount(history?.attackRaw);
  const mainIndex = mainIndustries.indexOf(stock.industry);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stockDisplayName(stock)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry}
              {mainIndex >= 0 ? `｜第${mainIndex + 1}主線` : ""}
            </div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatPrice(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-black/30 p-2">
          <div className="flex items-center justify-between text-xs font-black text-slate-300">
            <span>主攻確認</span>
            <span>{Math.min(attackCount, settings.confirmTimes)}/{settings.confirmTimes}</span>
          </div>
          <div className="mt-1 text-lg tracking-widest text-emerald-300">
            {"●".repeat(Math.min(attackCount, settings.confirmTimes))}
            {"○".repeat(Math.max(0, settings.confirmTimes - Math.min(attackCount, settings.confirmTimes)))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
          <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">
            成交金額
            <br />
            {formatAmount(estimatedAmount(stock))}
          </div>
          <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
            金額/量排名
            <br />#{amountRankIndex(stock, top50)} / #{volumeRankIndex(stock, top50)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(decision)}`}>{decision}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(holding)}`}>持股：{holding}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(pv)}`}>{pv}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {getMainlineText(decision)}
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}
          <br />
          {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
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

function ModalShell({
  title,
  sub,
  children,
  onClose,
  z = 90,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  onClose: () => void;
  z?: number;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80 px-3 py-6 backdrop-blur-sm"
      style={{ zIndex: z }}
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-3xl border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              {sub && <div className="text-xs font-bold text-slate-500">{sub}</div>}
              <div className="mt-1 text-2xl font-black text-white">{title}</div>
            </div>

            <button onClick={onClose} className="rounded-2xl bg-slate-800 px-3 py-2 text-lg font-black text-white">
              ×
            </button>
          </div>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function StockQuickModal({
  stock,
  top50,
  mainIndustries,
  settings,
  signalMap,
  favoriteCodes,
  watchCodes,
  priceDirections,
  previousPriceMap,
  lastSuccessAt,
  onClose,
  onAddFavorite,
  onRemoveFavorite,
  onAddWatch,
  onRemoveWatch,
}: {
  stock: Stock;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  signalMap: Record<string, SignalHistory>;
  favoriteCodes: string[];
  watchCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  lastSuccessAt: string;
  onClose: () => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddWatch: (code: string) => void;
  onRemoveWatch: (code: string) => void;
}) {
  const history = signalMap[stock.code];
  const decision = getDecision(stock, top50, mainIndustries, settings, history);
  const holding = getHoldingDecision(decision);
  const pv = priceVolumeState(stock, top50, settings);
  const zone = buyZone(stock);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const isFavorite = favoriteCodes.includes(stock.code);
  const isWatch = watchCodes.includes(stock.code);

  return (
    <ModalShell title={stockDisplayName(stock)} sub={`${stock.code}｜${stock.industry}`} onClose={onClose} z={120}>
      <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
        <div className={`text-3xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
          {formatPercent(stock.changePercent)}
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500">現價</div>
          <div className="text-xl font-black text-white">{formatPrice(stock.price)}</div>
        </div>
      </div>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${decisionTone(decision)}`}>
        <div className="text-xs font-bold text-slate-400">主線結論</div>
        <div className="mt-1 text-3xl font-black">{decision}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">{getMainlineText(decision)}</div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${decisionTone(holding)}`}>
        <div className="text-xs font-bold text-slate-400">現在該怎麼做</div>
        <div className="mt-1 text-2xl font-black">{holding}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          停損：跌破開盤價、爆量不漲、主線失效。
          <br />
          停利：短線過熱、量放大但不再創高。
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-blue-950/30 p-4">
        <div className="text-lg font-black text-blue-100">買點區</div>
        <div className="mt-2 text-sm font-bold text-blue-100">
          理想觀察區：{zone.observe}
          <br />
          有效突破區：{zone.breakout}
          <br />
          追高風險區：{zone.chase}
          <br />
          開盤後：{formatPercent(afterOpenPercent(stock))}
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-yellow-950/30 p-4">
        <div className="text-lg font-black text-yellow-100">資金與量能</div>
        <div className="mt-2 text-sm font-bold text-yellow-100">
          成交金額：{formatAmount(estimatedAmount(stock))}
          <br />
          成交金額排名：#{amountRankIndex(stock, top50)}
          <br />
          成交量排名：#{volumeRankIndex(stock, top50)}
          <br />
          量價狀態：{pv}
        </div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${directionTone(direction)}`}>
        <div className="text-xs font-bold text-slate-400">即時股價</div>
        <div className="mt-1 text-xl font-black">{directionText(direction)}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          <br />
          開盤：{formatPrice(stock.openPrice)}｜昨收：{formatPrice(stock.previousClose)}
          <br />
          最高：{formatPrice(stock.highPrice)}｜最低：{formatPrice(stock.lowPrice)}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))}
          className={`rounded-2xl py-3 text-sm font-black ${
            isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
        </button>

        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`rounded-2xl py-3 text-sm font-black ${
            isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>
      </div>
    </ModalShell>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchHistory, setSearchHistory] = useState<Stock[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [tab, setTab] = useState<TabKey>("home");
  const [popup, setPopup] = useState<PopupKey>("");
  const [selectedCode, setSelectedCode] = useState("");
  const [industryPopup, setIndustryPopup] = useState("");

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [watchCodes, setWatchCodes] = useState<string[]>([]);
  const [signalMap, setSignalMap] = useState<Record<string, SignalHistory>>({});

  const [queryText, setQueryText] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryMessage, setQueryMessage] = useState("");

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
  const [lockedIndustries, setLockedIndustries] = useState<string[]>([]);

  const initedRef = useRef(false);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  const floatingMainIndustries = useMemo(() => {
    const map = new Map<string, { industry: string; amount: number; volume: number }>();

    top50.forEach((stock) => {
      const item = map.get(stock.industry) || { industry: stock.industry, amount: 0, volume: 0 };
      item.amount += estimatedAmount(stock);
      item.volume += stock.volume;
      map.set(stock.industry, item);
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount + b.volume * 10 - (a.amount + a.volume * 10))
      .slice(0, 3)
      .map((item) => item.industry);
  }, [top50]);

  const mainIndustries = useMemo(() => {
    if (settings.stableIndustryLock && lockedIndustries.length > 0) return lockedIndustries;
    return floatingMainIndustries;
  }, [settings.stableIndustryLock, lockedIndustries, floatingMainIndustries]);

  const industryRanking = useMemo(
    () => getIndustryRanking(top50, settings, signalMap, settings.stableIndustryLock ? lockedIndustries : []),
    [top50, settings, signalMap, lockedIndustries]
  );

  const selectedStock = useMemo(() => {
    return stocks.find((s) => s.code === selectedCode) || searchHistory.find((s) => s.code === selectedCode) || null;
  }, [stocks, searchHistory, selectedCode]);

  const coreList = useMemo(
    () =>
      top50
        .filter((stock) => getDecision(stock, top50, mainIndustries, settings, signalMap[stock.code]) === "主線核心")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings, signalMap]
  );

  const pullbackList = useMemo(
    () =>
      top50
        .filter((stock) => getDecision(stock, top50, mainIndustries, settings, signalMap[stock.code]) === "等回測")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings, signalMap]
  );

  const overheatList = useMemo(
    () =>
      top50
        .filter((stock) => getDecision(stock, top50, mainIndustries, settings, signalMap[stock.code]) === "過熱不追")
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, mainIndustries, settings, signalMap]
  );

  const failedList = useMemo(
    () =>
      top50
        .filter((stock) => getDecision(stock, top50, mainIndustries, settings, signalMap[stock.code]) === "主線失效")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings, signalMap]
  );

  const amountList = useMemo(() => [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)), [top50]);

  const volumeList = useMemo(() => [...top50].sort((a, b) => b.volume - a.volume), [top50]);

  const watchStocks = useMemo(() => {
    const map = new Map<string, Stock>();

    watchCodes.forEach((code) => {
      const stock = stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code);
      if (stock) map.set(code, stock);
    });

    [...coreList, ...pullbackList].slice(0, 20).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [watchCodes, stocks, searchHistory, coreList, pullbackList]);

  const favoriteStocks = useMemo(
    () =>
      favoriteCodes
        .map((code) => stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code))
        .filter(Boolean) as Stock[],
    [favoriteCodes, stocks, searchHistory]
  );

  const topIndustry = industryRanking[0];
  const secondIndustry = industryRanking[1];
  const thirdIndustry = industryRanking[2];
  const totalAmount = top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0);

  const marketStructure = useMemo(() => {
    if (!topIndustry) return "等待資料";
    if (failedList.length >= 8) return "主線退潮，先避開";
    if (overheatList.length >= 8) return "短線過熱，不追高";
    if (topIndustry.amountShare >= 25 && topIndustry.coreCount >= 2) return "資金集中，主線明確";
    if (industryRanking.slice(0, 3).filter((i) => i.status === "資金分歧").length >= 2) return "資金分歧，只挑核心";
    if (coreList.length >= 3) return "主線續航，看核心股";
    return "資金尚未集中";
  }, [topIndustry, failedList, overheatList, industryRanking, coreList]);

  const homeSentence = useMemo(() => {
    if (!topIndustry) return "目前尚未取得資料。";

    if (marketStructure === "資金集中，主線明確") {
      return `資金集中在 ${topIndustry.industry}，優先看主線核心股，過熱股不追。`;
    }
    if (marketStructure === "主線續航，看核心股") {
      return `${topIndustry.industry} 續航中，找量價同步、成交金額靠前的個股。`;
    }
    if (marketStructure === "資金分歧，只挑核心") {
      return `資金分歧，避開爆量不漲，只挑核心主攻股。`;
    }
    if (marketStructure === "短線過熱，不追高") {
      return `主線短線過熱，先等回測，不追高。`;
    }
    if (marketStructure === "主線退潮，先避開") {
      return `主線失效股偏多，降低出手，等資金重新集中。`;
    }

    return `目前第一主線是 ${topIndustry.industry}，但資金集中度還要再確認。`;
  }, [topIndustry, marketStructure]);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const merged = { ...defaultSettings, ...savedSettings };
    setSettings(merged);
    setAutoSeconds(merged.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setWatchCodes(safeParse(localStorage.getItem(WATCH_KEY), []));
    setSearchHistory(safeParse(localStorage.getItem(SEARCH_HISTORY_KEY), []));
    setSignalMap(safeParse(localStorage.getItem(SIGNAL_KEY), {}));
    setLockedIndustries(safeParse(localStorage.getItem(LOCKED_INDUSTRY_KEY), []));

    const cached = safeParse<any>(localStorage.getItem(CACHE_KEY), null);
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
  }, [settings.refreshSeconds, lastPriceMap, mainIndustries, signalMap]);

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

  function saveWatch(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 100);
    setWatchCodes(clean);
    localStorage.setItem(WATCH_KEY, JSON.stringify(clean));
  }

  function saveSearchHistory(next: Stock[]) {
    const unique = Array.from(new Map(next.map((stock) => [stock.code, { ...stock, name: stockDisplayName(stock) }])).values()).slice(0, 20);
    setSearchHistory(unique);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(unique));
  }

  function lockCurrentIndustries() {
    const list = industryRanking.slice(0, 3).map((item) => item.industry);
    setLockedIndustries(list);
    localStorage.setItem(LOCKED_INDUSTRY_KEY, JSON.stringify(list));
  }

  function clearLockedIndustries() {
    setLockedIndustries([]);
    localStorage.removeItem(LOCKED_INDUSTRY_KEY);
  }

  function resetSignals() {
    setSignalMap({});
    localStorage.removeItem(SIGNAL_KEY);
  }

  function updateSignals(list: Stock[], oldPrices: Record<string, number>) {
    const topList = list.slice(0, 50);
    const activeMain = settings.stableIndustryLock && lockedIndustries.length ? lockedIndustries : floatingMainIndustries;

    setSignalMap((old) => {
      const next = { ...old };

      topList.forEach((stock) => {
        const history =
          next[stock.code] ||
          ({
            code: stock.code,
            prices: [],
            attackRaw: [],
            entryRaw: [],
            failRaw: [],
            overheatRaw: [],
            pullbackRaw: [],
          } as SignalHistory);

        const meaningful = isMeaningfulMove(stock, oldPrices[stock.code], settings);
        const attack = meaningful && isMoneyAttack(stock, topList, activeMain, settings);
        const fail = isFail(stock, topList, settings);
        const overheat = isOverheat(stock, settings);
        const pullback = isPullback(stock, topList, activeMain, settings);
        const entry = attack && !fail && !overheat;

        next[stock.code] = {
          ...history,
          prices: [...history.prices, stock.price].slice(-10),
          attackRaw: [...history.attackRaw, attack].slice(-10),
          entryRaw: [...history.entryRaw, entry].slice(-10),
          failRaw: [...history.failRaw, fail].slice(-10),
          overheatRaw: [...history.overheatRaw, overheat].slice(-10),
          pullbackRaw: [...history.pullbackRaw, pullback].slice(-10),
        };
      });

      localStorage.setItem(SIGNAL_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function loadStocks() {
    try {
      setUpdating(true);
      setError("");
      setLastAttemptAt(nowText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API錯誤：${response.status}`);

      const json = await response.json();
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
        .map((raw: any) => normalizeStock(raw, dataTime))
        .filter((stock: Stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);

      if (normalized.length === 0) throw new Error("API回傳空資料");

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock: Stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE / Yahoo fallback";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCache(false);

      updateSignals(normalized, oldPriceMap);

      localStorage.setItem(
        CACHE_KEY,
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
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  async function searchAnyStock() {
    const q = queryText.trim();
    if (!q) {
      setQueryMessage("請先輸入股票代號或名稱。");
      return;
    }

    try {
      setQueryLoading(true);
      setQueryMessage("");

      const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(q)}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json();

      if (!json.ok || !json.stock) {
        setQueryMessage(json.message || "查無資料，請確認代號或名稱。");
        return;
      }

      const stock = normalizeStock(json.stock, json.stock.updatedAt || nowText());
      saveSearchHistory([stock, ...searchHistory]);

      setPreviousPriceMap((old) => ({ ...old, [stock.code]: old[stock.code] || stock.price }));
      setLastPriceMap((old) => ({ ...old, [stock.code]: stock.price }));
      setPriceDirections((old) => ({ ...old, [stock.code]: "new" }));

      setSelectedCode(stock.code);
      setQueryMessage(`已查到 ${stock.code} ${stockDisplayName(stock)}`);
    } catch (err: any) {
      setQueryMessage(err?.message || "查詢失敗，請稍後再試。");
    } finally {
      setQueryLoading(false);
    }
  }

  function sortList(list: Stock[]) {
    return [...list].sort((a, b) => {
      const ad = getDecision(a, top50, mainIndustries, settings, signalMap[a.code]);
      const bd = getDecision(b, top50, mainIndustries, settings, signalMap[b.code]);

      const weight = (d: string) => {
        if (d === "主線核心") return 1000;
        if (d === "資金主攻") return 800;
        if (d === "等回測") return 600;
        if (d === "觀察中") return 300;
        if (d === "過熱不追") return 100;
        return 0;
      };

      return weight(bd) + estimatedAmount(b) / 10000000 - (weight(ad) + estimatedAmount(a) / 10000000);
    });
  }

  function popupList(key: PopupKey) {
    if (key === "core") return sortList(coreList);
    if (key === "pullback") return sortList(pullbackList);
    if (key === "overheat") return sortList(overheatList);
    if (key === "failed") return sortList(failedList);
    if (key === "amount") return amountList;
    if (key === "volume") return volumeList;
    if (key === "top50") return sortList(top50);
    return [];
  }

  function popupTitle(key: PopupKey) {
    if (key === "core") return "主線核心股";
    if (key === "pullback") return "等回測股";
    if (key === "overheat") return "過熱不追";
    if (key === "failed") return "主線失效";
    if (key === "amount") return "成交金額排行";
    if (key === "volume") return "成交量排行";
    if (key === "top50") return "今日50強";
    return "";
  }

  function cardProps() {
    return {
      top50,
      mainIndustries,
      settings,
      signalMap,
      favoriteCodes,
      watchCodes,
      priceDirections,
      previousPriceMap,
      lastSuccessAt,
      onOpen: (code: string) => setSelectedCode(code),
      onAddFavorite: (code: string) => saveFavorites([...favoriteCodes, code]),
      onRemoveFavorite: (code: string) => saveFavorites(favoriteCodes.filter((item) => item !== code)),
      onAddWatch: (code: string) => saveWatch([...watchCodes, code]),
      onRemoveWatch: (code: string) => saveWatch(watchCodes.filter((item) => item !== code)),
    };
  }

  const industrySelectedList = useMemo(() => {
    if (!industryPopup) return [];
    return sortList(top50.filter((stock) => stock.industry === industryPopup));
  }, [industryPopup, top50, signalMap, mainIndustries]);

  const homeCoreList = useMemo(() => [...coreList, ...pullbackList].slice(0, 8), [coreList, pullbackList]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">主線快篩迷你彈窗版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">盤中主線雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                點快篩直接跳出清單，不用往下滑。
              </p>
            </div>

            <button onClick={() => loadStocks()} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-cyan-100">全個股查詢</div>
              <div className="mt-1 text-xs font-bold text-slate-400">保留查詢功能，但主畫面回到資金主線。</div>
            </div>
            <button onClick={() => setPopup("search")} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">
              查詢
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchAnyStock();
              }}
              placeholder="輸入股票代號或名稱"
              className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
            />
            <button onClick={searchAnyStock} className="rounded-2xl bg-cyan-500/80 px-4 py-3 text-sm font-black text-white">
              {queryLoading ? "查詢中" : "查"}
            </button>
          </div>

          {queryMessage && <div className="mt-2 text-sm font-bold text-yellow-200">{queryMessage}</div>}
        </section>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">
                即時股價狀態：{updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-cyan-300">
                50強估算成交金額：{formatAmount(totalAmount)}
              </div>
            </div>

            <button onClick={() => setPopup("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              主線統計
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">今日主線策略</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {topIndustry ? `${topIndustry.light}｜${topIndustry.industry}｜${topIndustry.status}` : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{homeSentence}</div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
            <button onClick={() => topIndustry && setIndustryPopup(topIndustry.industry)} className="rounded-2xl bg-black/30 p-2 text-yellow-200">
              第一主線
              <br />
              {topIndustry?.industry || "--"}
            </button>
            <button onClick={() => secondIndustry && setIndustryPopup(secondIndustry.industry)} className="rounded-2xl bg-black/30 p-2 text-cyan-200">
              第二主線
              <br />
              {secondIndustry?.industry || "--"}
            </button>
            <button onClick={() => thirdIndustry && setIndustryPopup(thirdIndustry.industry)} className="rounded-2xl bg-black/30 p-2 text-purple-200">
              第三主線
              <br />
              {thirdIndustry?.industry || "--"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="盤中型態" value={marketStructure} />
            <DetailRow label="資金集中度" value={topIndustry ? `${topIndustry.amountShare.toFixed(1)}%` : "--"} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="主線核心股" value={coreList.length} sub="資金+量價同步" tone="text-emerald-300" onClick={() => setPopup("core")} />
          <MiniCard title="等回測股" value={pullbackList.length} sub="主線內不追高" tone="text-yellow-300" onClick={() => setPopup("pullback")} />
          <MiniCard title="過熱不追" value={overheatList.length} sub="短線偏熱" tone="text-orange-300" onClick={() => setPopup("overheat")} />
          <MiniCard title="主線失效" value={failedList.length} sub="避開" tone="text-red-300" onClick={() => setPopup("failed")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="產業資金排行" sub="看錢往哪裡去" badge={industryRanking.length} tone="text-yellow-300" onClick={() => setPopup("industry")} />
          <ActionCard title="成交金額排行" sub="主力資金核心" badge={amountList.length} tone="text-yellow-300" onClick={() => setPopup("amount")} />
          <ActionCard title="今日50強" sub="漲幅排行" badge={top50.length} tone="text-red-300" onClick={() => setPopup("top50")} />
          <ActionCard title="設定" sub="確認次數 / 主線鎖定" badge="⚙️" tone="text-purple-300" onClick={() => setPopup("settings")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/90 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">主線快篩</h2>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                點一下直接跳出清單，不用往下滑。
              </p>
            </div>

            <div className="rounded-2xl bg-black/40 px-3 py-2 text-xs font-black text-yellow-300">
              迷你彈窗
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ["core", "💎", "核心"],
              ["amount", "💰", "資金"],
              ["volume", "📊", "成交量"],
              ["industry", "🏭", "產業"],
              ["pullback", "🎯", "回測"],
              ["overheat", "🔥", "過熱"],
              ["failed", "⚠️", "失效"],
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setPopup(key as PopupKey)}
                className="shrink-0 rounded-2xl bg-black/40 px-4 py-3 text-xs font-black text-slate-200 active:scale-95"
              >
                <div className="text-lg">{icon}</div>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "主線核心快選"}
              {tab === "top50" && "今日50強"}
              {tab === "watch" && "觀察清單"}
              {tab === "favorite" && "自選股"}
              {tab === "more" && "更多功能"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              主線：{industryRanking.slice(0, 3).map((item) => item.industry).join("、") || "--"}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">產業資金前三名</h3>
                  <button onClick={() => setPopup("industry")} className="rounded-2xl bg-yellow-500/20 px-3 py-2 text-xs font-black text-yellow-200">
                    看全部
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {industryRanking.slice(0, 3).map((item, index) => (
                    <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => setIndustryPopup(item.industry)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">主線核心快選</h3>
                  <button onClick={() => setPopup("core")} className="rounded-2xl bg-emerald-500/20 px-3 py-2 text-xs font-black text-emerald-200">
                    核心股
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {homeCoreList.length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前主線核心尚未明確。
                    </div>
                  )}
                  {homeCoreList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "top50" && (
            <div className="space-y-3">
              {sortList(top50).map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "watch" && (
            <div className="space-y-3">
              {watchStocks.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有觀察股票。
                </div>
              )}
              {watchStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "favorite" && (
            <div className="space-y-3">
              {favoriteStocks.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有自選股。
                </div>
              )}
              {favoriteStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "more" && (
            <div className="grid grid-cols-2 gap-3">
              <ActionCard title="全個股查詢" sub="不限50強" badge="🔍" tone="text-cyan-300" onClick={() => setPopup("search")} />
              <ActionCard title="主線核心股" sub="資金+量價同步" badge={coreList.length} tone="text-emerald-300" onClick={() => setPopup("core")} />
              <ActionCard title="等回測股" sub="主線內不追高" badge={pullbackList.length} tone="text-yellow-300" onClick={() => setPopup("pullback")} />
              <ActionCard title="主線失效" sub="避開" badge={failedList.length} tone="text-red-300" onClick={() => setPopup("failed")} />
              <ActionCard title="主線統計" sub="資料健康" badge="📡" tone="text-blue-300" onClick={() => setPopup("data")} />
              <ActionCard title="設定" sub="確認次數" badge="⚙️" tone="text-purple-300" onClick={() => setPopup("settings")} />
            </div>
          )}
        </section>
      </div>

      {["core", "pullback", "overheat", "failed", "amount", "volume", "top50"].includes(popup) && (
        <ModalShell title={popupTitle(popup)} sub={`共 ${popupList(popup).length} 檔｜點股票快看`} onClose={() => setPopup("")}>
          <div className="space-y-3">
            {popupList(popup).length === 0 && (
              <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">
                目前沒有符合條件的股票。
              </div>
            )}
            {popupList(popup).map((stock, index) => (
              <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "industry" && (
        <ModalShell title="產業資金排行" sub="點產業看該產業主攻股" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {industryRanking.map((item, index) => (
              <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => setIndustryPopup(item.industry)} />
            ))}
          </div>
        </ModalShell>
      )}

      {industryPopup && (
        <ModalShell title={`${industryPopup} 主攻股`} sub="該產業內資金排序" onClose={() => setIndustryPopup("")} z={110}>
          <div className="space-y-3">
            {industrySelectedList.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">
                目前沒有該產業股票。
              </div>
            )}
            {industrySelectedList.map((stock, index) => (
              <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "search" && (
        <ModalShell title="全個股查詢" sub="輸入代號或中文名稱" onClose={() => setPopup("")}>
          <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="flex gap-2">
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchAnyStock();
                }}
                placeholder="例如 華邦電、群創、2330"
                className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
              />
              <button onClick={searchAnyStock} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">
                {queryLoading ? "查詢中" : "查詢"}
              </button>
            </div>
            {queryMessage && <div className="mt-3 text-sm font-bold text-yellow-200">{queryMessage}</div>}
          </div>

          <div className="mt-4">
            <div className="text-lg font-black">最近查詢</div>
            <div className="mt-3 space-y-3">
              {searchHistory.length === 0 && (
                <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                  尚無查詢紀錄。
                </div>
              )}
              {searchHistory.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps()} />
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {popup === "settings" && (
        <ModalShell title="設定" sub="主線確認與更新頻率" onClose={() => setPopup("")}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-lg font-black">主攻確認次數</div>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => saveSettings({ ...settings, confirmTimes: num })}
                    className={`rounded-2xl py-3 text-sm font-black ${
                      settings.confirmTimes === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {num}次
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
              onClick={() => saveSettings({ ...settings, stableIndustryLock: !settings.stableIndustryLock })}
              className={`w-full rounded-2xl py-3 text-lg font-black ${
                settings.stableIndustryLock ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
              }`}
            >
              主流產業鎖定：{settings.stableIndustryLock ? "開啟" : "關閉"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={lockCurrentIndustries} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                鎖定目前前三主線
              </button>
              <button onClick={clearLockedIndustries} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                解除鎖定
              </button>
            </div>

            <button onClick={resetSignals} className="w-full rounded-2xl bg-red-500/20 py-3 text-lg font-black text-red-200">
              重置主線確認紀錄
            </button>
          </div>
        </ModalShell>
      )}

      {popup === "data" && (
        <ModalShell title="主線統計" sub="資料健康檢查" onClose={() => setPopup("")}>
          <div className="space-y-2 text-sm font-bold text-slate-300">
            <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
            <div>資料筆數：{stocks.length}</div>
            <div>50強筆數：{top50.length}</div>
            <div>最新資料時間：{apiDataTime || "讀取中"}</div>
            <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
            <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
            <div>資料來源：{source || "讀取中"}</div>
            <div>50強成交金額估算：{formatAmount(totalAmount)}</div>
            <div>第一主線：{topIndustry?.industry || "--"}</div>
            <div>第二主線：{secondIndustry?.industry || "--"}</div>
            <div>第三主線：{thirdIndustry?.industry || "--"}</div>
            <div>主線核心股數：{coreList.length}</div>
            <div>等回測股數：{pullbackList.length}</div>
            <div>過熱不追股數：{overheatList.length}</div>
            <div>主線失效股數：{failedList.length}</div>
            <div>盤中型態：{marketStructure}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={loadStocks} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
              立即更新
            </button>
            <button onClick={resetSignals} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
              重置紀錄
            </button>
          </div>
        </ModalShell>
      )}

      {selectedStock && (
        <StockQuickModal
          stock={selectedStock}
          top50={top50.length > 0 ? top50 : [selectedStock]}
          mainIndustries={mainIndustries}
          settings={settings}
          signalMap={signalMap}
          favoriteCodes={favoriteCodes}
          watchCodes={watchCodes}
          priceDirections={priceDirections}
          previousPriceMap={previousPriceMap}
          lastSuccessAt={lastSuccessAt}
          onClose={() => setSelectedCode("")}
          onAddFavorite={(code) => saveFavorites([...favoriteCodes, code])}
          onRemoveFavorite={(code) => saveFavorites(favoriteCodes.filter((item) => item !== code))}
          onAddWatch={(code) => saveWatch([...watchCodes, code])}
          onRemoveWatch={(code) => saveWatch(watchCodes.filter((item) => item !== code))}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "首頁"],
            ["top50", "🔥", "50強"],
            ["watch", "📌", "觀察"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setPopup("");
                setIndustryPopup("");
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