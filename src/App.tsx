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

type Position = {
  code: string;
  buyPrice: number;
  shares: number;
  note?: string;
};

type Settings = {
  refreshSeconds: number;
  hotPercent: number;
  stableIndustryLock: boolean;
};

type TabKey = "home" | "top50" | "watch" | "favorite" | "more";

type PopupKey =
  | ""
  | "dashboard"
  | "industry"
  | "moneyUp"
  | "moneyDown"
  | "signal"
  | "sneaky"
  | "core"
  | "pullback"
  | "overheat"
  | "failed"
  | "amount"
  | "volume"
  | "top50"
  | "search"
  | "positions"
  | "data"
  | "settings";

type PriceDirection = "up" | "down" | "same" | "new";

type SneakyHistory = {
  code: string;
  sneakyRaw: boolean[];
  failRaw: boolean[];
  hotRaw: boolean[];
};

type MoneyHistory = {
  code: string;
  amountRaw: number[];
  volumeRaw: number[];
  priceRaw: number[];
};

type MoneyTrend =
  | "資金慢慢增加"
  | "資金突然放大"
  | "資金持平"
  | "資金開始減少"
  | "資金放大但股價不漲"
  | "尚未累積";

type SignalType =
  | "資金慢慢增加"
  | "資金突然放大"
  | "資金續航3/3"
  | "主線核心"
  | "回測買點"
  | "追高風險"
  | "出場警戒";

type SignalRecord = {
  id: string;
  dateKey: string;
  code: string;
  name: string;
  industry: string;
  signal: SignalType;
  startPrice: number;
  latestPrice: number;
  resultPercent: number;
  result: "等待" | "成功" | "失敗";
  reason: string;
};

type IndustryItem = {
  industry: string;
  count: number;
  totalAmount: number;
  totalVolume: number;
  avgChange: number;
  amountShare: number;
  volumeShare: number;
  coreCount: number;
  sneakyCount: number;
  failCount: number;
  overheatCount: number;
  score: number;
  strength: "強勢" | "續航" | "轉強" | "分歧" | "過熱" | "轉弱" | "觀察";
  status: "主線續航" | "主線剛轉強" | "資金分歧" | "主線退潮" | "短線過熱" | "觀察中";
  light: "綠燈" | "黃燈" | "紅燈" | "灰燈";
  reason: string;
  stocks: Stock[];
};

const API_URL = "/api/stocks";
const SEARCH_API_URL = "/api/search";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const WATCH_KEY = "taiwan-stock-radar-watch";
const POSITIONS_KEY = "taiwan-stock-radar-my-positions";
const SEARCH_HISTORY_KEY = "taiwan-stock-radar-search-history";
const SETTINGS_KEY = "taiwan-stock-radar-dashboard-v32-settings";
const CACHE_KEY = "taiwan-stock-radar-dashboard-v32-cache";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-dashboard-v32-locked";
const SNEAKY_HISTORY_KEY = "taiwan-stock-radar-dashboard-v32-sneaky-history";
const MONEY_HISTORY_KEY = "taiwan-stock-radar-dashboard-v32-money-history";
const SIGNAL_HISTORY_KEY = "taiwan-stock-radar-dashboard-v32-signal-history";

const defaultSettings: Settings = {
  refreshSeconds: 30,
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

  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",

  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",

  "2357": "電腦週邊",
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

function todayKey() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function cleanCode(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function stockDisplayName(stock: { code: string; name?: string }) {
  return codeToChineseName[stock.code] || stock.name || stock.code;
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
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}億`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(0)}萬`;
  return `${sign}${abs.toFixed(0)}`;
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

function volumeState(stock: Stock, list: Stock[]) {
  const rank = volumeRankPercent(stock, list);
  if (rank >= 80) return "量能強";
  if (rank >= 50) return "量能普通";
  return "量能不足";
}

function atrValue(stock: Stock) {
  const range = Math.max(stock.highPrice - stock.lowPrice, stock.price * 0.012);
  return Math.max(range, stock.price * 0.008);
}

function atrStopLine(stock: Stock) {
  const atr = atrValue(stock);
  return Math.max(0, stock.highPrice - atr * 1.5);
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

function latestNumber(values: number[] | undefined) {
  if (!values || values.length === 0) return 0;
  return values[values.length - 1] || 0;
}

function previousNumber(values: number[] | undefined) {
  if (!values || values.length < 2) return 0;
  return values[values.length - 2] || 0;
}

function changePercentNumber(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return 0;
  return ((now - prev) / prev) * 100;
}

function moneyTrendChange(code: string, moneyHistory: Record<string, MoneyHistory>) {
  const history = moneyHistory[code];
  const nowAmount = latestNumber(history?.amountRaw);
  const prevAmount = previousNumber(history?.amountRaw);
  const nowVolume = latestNumber(history?.volumeRaw);
  const prevVolume = previousNumber(history?.volumeRaw);
  const nowPrice = latestNumber(history?.priceRaw);
  const prevPrice = previousNumber(history?.priceRaw);

  return {
    nowAmount,
    prevAmount,
    amountChangePercent: changePercentNumber(nowAmount, prevAmount),
    nowVolume,
    prevVolume,
    volumeChangePercent: changePercentNumber(nowVolume, prevVolume),
    nowPrice,
    prevPrice,
    priceChangePercent: changePercentNumber(nowPrice, prevPrice),
  };
}

function moneyTrendLabel(stock: Stock, moneyHistory: Record<string, MoneyHistory>): MoneyTrend {
  const history = moneyHistory[stock.code];

  if (!history || history.amountRaw.length < 2) return "尚未累積";

  const data = moneyTrendChange(stock.code, moneyHistory);
  const amountUp = data.amountChangePercent >= 15;
  const amountBigUp = data.amountChangePercent >= 45;
  const amountDown = data.amountChangePercent <= -15;
  const volumeUp = data.volumeChangePercent >= 12;
  const priceFlat = Math.abs(data.priceChangePercent) <= 0.35;

  if (amountBigUp && priceFlat) return "資金放大但股價不漲";
  if (amountBigUp && stock.price >= stock.openPrice) return "資金突然放大";
  if (amountUp && volumeUp && stock.price >= stock.openPrice) return "資金慢慢增加";
  if (amountDown || data.volumeChangePercent <= -20) return "資金開始減少";

  return "資金持平";
}

function moneyTrendTone(label: MoneyTrend | string) {
  if (label === "資金慢慢增加" || label === "資金突然放大") return "text-emerald-300";
  if (label === "資金放大但股價不漲") return "text-orange-300";
  if (label === "資金開始減少") return "text-red-300";
  return "text-slate-300";
}

function moneyTrendReason(stock: Stock, moneyHistory: Record<string, MoneyHistory>) {
  const label = moneyTrendLabel(stock, moneyHistory);
  const data = moneyTrendChange(stock.code, moneyHistory);

  if (label === "尚未累積") return "等待下一次更新後判斷。";

  const amountText = `${formatAmount(data.prevAmount)} → ${formatAmount(data.nowAmount)}（${formatPercent(data.amountChangePercent)}）`;
  const volumeText = `${formatAmount(data.prevVolume)} → ${formatAmount(data.nowVolume)}（${formatPercent(data.volumeChangePercent)}）`;
  const priceText = `${formatPrice(data.prevPrice)} → ${formatPrice(data.nowPrice)}（${formatPercent(data.priceChangePercent)}）`;

  if (label === "資金慢慢增加") return `成交金額增加，量能也增加。金額：${amountText}｜量：${volumeText}`;
  if (label === "資金突然放大") return `成交金額突然放大，股價仍守開盤價。金額：${amountText}`;
  if (label === "資金放大但股價不漲") return `資金放大但股價幾乎不動，要防爆量不漲。金額：${amountText}｜股價：${priceText}`;
  if (label === "資金開始減少") return `成交金額或量能開始下降。金額：${amountText}｜量：${volumeText}`;

  return `資金變化不大。金額：${amountText}`;
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

function sneakyMoneyScore(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const amountScore = amountRankPercent(stock, list);
  const volumeScore = volumeRankPercent(stock, list);
  const openPower = afterOpenPercent(stock);

  const mainBonus = mainIndustries.includes(stock.industry) ? 18 : 6;
  const notTooHotBonus = stock.changePercent >= 0.5 && stock.changePercent <= 5.5 ? 18 : -18;
  const priceHoldBonus = stock.price >= stock.openPrice && stock.price >= stock.previousClose ? 18 : -25;
  const volumeBonus = volumeScore >= 60 ? 16 : 0;
  const amountBonus = amountScore >= 60 ? 16 : 0;
  const quietBonus = stock.changePercent < 3.5 && amountScore >= 65 ? 12 : 0;
  const openBonus = openPower >= 0 && openPower <= 2.5 ? 10 : 0;
  const failPenalty = isFail(stock, list, settings) ? -40 : 0;
  const hotPenalty = isOverheat(stock, settings) ? -35 : 0;

  return amountBonus + volumeBonus + mainBonus + notTooHotBonus + priceHoldBonus + quietBonus + openBonus + failPenalty + hotPenalty;
}

function isSneakyMoney(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const score = sneakyMoneyScore(stock, list, mainIndustries, settings);

  return (
    score >= 55 &&
    stock.changePercent > 0 &&
    stock.changePercent <= 5.8 &&
    stock.price >= stock.openPrice &&
    stock.price >= stock.previousClose &&
    amountRankPercent(stock, list) >= 55 &&
    volumeRankPercent(stock, list) >= 50 &&
    !isFail(stock, list, settings) &&
    !isOverheat(stock, settings)
  );
}

function sneakyConfirmCount(code: string, sneakyHistory: Record<string, SneakyHistory>) {
  return stableCount(sneakyHistory[code]?.sneakyRaw);
}

function sneakyStatus(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings, sneakyHistory: Record<string, SneakyHistory>) {
  const count = Math.min(3, sneakyConfirmCount(stock.code, sneakyHistory));

  if (isFail(stock, list, settings)) return "流入後轉弱";
  if (isOverheat(stock, settings)) return "流入後過熱";
  if (count >= 3) return "資金續航 3/3";
  if (count === 2) return "資金續航 2/3";
  if (count === 1) return "資金初現 1/3";

  return "尚未確認";
}

function sneakyStatusTone(label: string) {
  if (label.includes("3/3")) return "text-emerald-300";
  if (label.includes("2/3")) return "text-cyan-300";
  if (label.includes("1/3")) return "text-yellow-300";
  if (label.includes("過熱")) return "text-orange-300";
  if (label.includes("轉弱")) return "text-red-300";
  return "text-slate-300";
}

function sneakyMoneyReason(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings, sneakyHistory?: Record<string, SneakyHistory>) {
  const reasons: string[] = [];
  const confirm = sneakyHistory ? sneakyConfirmCount(stock.code, sneakyHistory) : 0;

  if (confirm >= 3) reasons.push("連續流入3次");
  else if (confirm === 2) reasons.push("連續流入2次");
  else if (confirm === 1) reasons.push("剛出現流入");

  if (mainIndustries.includes(stock.industry)) reasons.push("主線產業內");
  else reasons.push("非主線但有資金跡象");

  if (amountRankPercent(stock, list) >= 70) reasons.push("成交金額靠前");
  else if (amountRankPercent(stock, list) >= 60) reasons.push("成交金額轉強");

  if (volumeRankPercent(stock, list) >= 70) reasons.push("量能明顯增加");
  else if (volumeRankPercent(stock, list) >= 60) reasons.push("量能開始增強");

  if (stock.price >= stock.openPrice) reasons.push("價格守開盤價");
  if (stock.changePercent > 0 && stock.changePercent <= 5.5) reasons.push("漲幅未過熱");
  if (!isFail(stock, list, settings)) reasons.push("未轉弱");

  return reasons.slice(0, 6).join("｜") || "資金尚未明確";
}

function pullbackRadar(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const main = mainIndustries.includes(stock.industry);
  const openGap = afterOpenPercent(stock);
  const pv = priceVolumeState(stock, list, settings);
  const amountStrong = amountRankPercent(stock, list) >= 60;

  if (!main) return "非主線";
  if (isFail(stock, list, settings)) return "回測失敗";
  if (isOverheat(stock, settings)) return "過熱等回測";
  if (stock.price < stock.openPrice) return "回測失敗";
  if (openGap >= 0 && openGap <= 1.5 && amountStrong && pv !== "轉弱退潮") return "回測買點";
  if (openGap > 1.5 && openGap <= 3.5 && amountStrong) return "接近買點";
  if (openGap > 3.5) return "尚未回測";

  return "觀察中";
}

function chaseRisk(stock: Stock, list: Stock[], settings: Settings) {
  const pv = priceVolumeState(stock, list, settings);

  if (pv === "低量假強" || pv === "爆量不漲") return "追高風險高";
  if (isOverheat(stock, settings)) return "追高風險高";
  if (afterOpenPercent(stock) >= 3 || openingPremium(stock) >= 4) return "追高風險中";
  if (stock.changePercent >= 5 && volumeState(stock, list) !== "量能強") return "追高風險中";

  return "追高風險低";
}

function exitAlert(stock: Stock, list: Stock[], settings: Settings, industryStatus?: string) {
  const stop = atrStopLine(stock);
  const pv = priceVolumeState(stock, list, settings);

  if (stock.price < stock.previousClose) return "跌破昨收，出場避開";
  if (stock.price < stock.openPrice) return "跌破開盤，出場觀察";
  if (stock.price < stop) return "跌破ATR線，減碼觀察";
  if (pv === "爆量不漲") return "爆量不漲，提高警覺";
  if (pv === "轉弱退潮") return "量價轉弱，出場觀察";
  if (industryStatus === "主線退潮") return "產業退潮，降低持股";
  if (isOverheat(stock, settings)) return "短線過熱，分批停利";

  return "續抱觀察";
}

function decisionText(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings, sneakyHistory?: Record<string, SneakyHistory>, moneyHistory?: Record<string, MoneyHistory>) {
  const confirm = sneakyHistory ? sneakyConfirmCount(stock.code, sneakyHistory) : 0;
  const moneyLabel = moneyHistory ? moneyTrendLabel(stock, moneyHistory) : "尚未累積";

  if (isFail(stock, list, settings)) return "主線失效";
  if (isOverheat(stock, settings)) return "過熱不追";
  if (isMoneyAttack(stock, list, mainIndustries, settings)) return "主線核心";
  if (moneyLabel === "資金慢慢增加" || moneyLabel === "資金突然放大") return "資金增加中";
  if (confirm >= 3 && isSneakyMoney(stock, list, mainIndustries, settings)) return "資金續航";
  if (isSneakyMoney(stock, list, mainIndustries, settings)) return "資金偷偷流入";
  if (pullbackRadar(stock, list, mainIndustries, settings) === "回測買點") return "回測買點";

  return "觀察中";
}

function signalTone(label: string) {
  if (label === "成功") return "text-emerald-300";
  if (label === "失敗") return "text-red-300";
  if (label === "等待") return "text-yellow-300";
  return "text-slate-300";
}

function signalIsBullish(signal: SignalType) {
  return ["資金慢慢增加", "資金突然放大", "資金續航3/3", "主線核心", "回測買點"].includes(signal);
}

function signalIsRisk(signal: SignalType) {
  return ["追高風險", "出場警戒"].includes(signal);
}

function signalResult(signal: SignalType, resultPercent: number): "等待" | "成功" | "失敗" {
  if (signalIsBullish(signal)) {
    if (resultPercent >= 1) return "成功";
    if (resultPercent <= -1) return "失敗";
    return "等待";
  }

  if (signalIsRisk(signal)) {
    if (resultPercent <= 0) return "成功";
    if (resultPercent >= 1.5) return "失敗";
    return "等待";
  }

  return "等待";
}

function signalReason(signal: SignalType, resultPercent: number) {
  const result = signalResult(signal, resultPercent);

  if (result === "等待") return "漲跌幅尚未明顯，繼續觀察。";
  if (signalIsBullish(signal) && result === "成功") return "訊號後股價上漲，暫時判定有效。";
  if (signalIsBullish(signal) && result === "失敗") return "訊號後股價下跌，需檢查是否追高或主線退潮。";
  if (signalIsRisk(signal) && result === "成功") return "警報後股價沒有續漲或轉弱，警報有效。";
  if (signalIsRisk(signal) && result === "失敗") return "警報後股價仍續漲，可能警報太早。";

  return "持續追蹤中。";
}

function signalHitRate(records: SignalRecord[], signal?: SignalType) {
  const filtered = signal ? records.filter((r) => r.signal === signal) : records;
  const done = filtered.filter((r) => r.result !== "等待");
  const success = done.filter((r) => r.result === "成功");

  return {
    total: filtered.length,
    done: done.length,
    success: success.length,
    rate: done.length > 0 ? (success.length / done.length) * 100 : 0,
  };
}

function strengthReason(item: IndustryItem) {
  if (item.strength === "強勢") return "資金集中、核心股明顯，屬於盤中最強主線。";
  if (item.strength === "續航") return "資金仍在，核心股有延續，適合只看核心股。";
  if (item.strength === "轉強") return "資金剛轉入，先觀察下一次更新是否延續。";
  if (item.strength === "分歧") return "有強股也有失效股，只挑量價同步個股。";
  if (item.strength === "過熱") return "短線漲太快，避免追高，等回測。";
  if (item.strength === "轉弱") return "失效股偏多，降低出手，避免硬追。";
  return "資金尚未明確集中，先觀察。";
}

function riskTone(label: string) {
  if (
    [
      "回測買點",
      "低風險觀察",
      "續抱觀察",
      "追高風險低",
      "可小幅加倉",
      "資金偷偷流入",
      "資金流入觀察",
      "資金續航",
      "資金續航觀察",
      "資金增溫觀察",
      "資金放大觀察",
    ].includes(label)
  )
    return "text-emerald-300";

  if (
    [
      "接近買點",
      "等確認",
      "追高風險中",
      "尚未回測",
      "觀察",
      "觀察中",
      "持有勿追",
      "資金初現 1/3",
      "資金持平",
    ].includes(label)
  )
    return "text-yellow-300";

  if (
    [
      "過熱等回測",
      "不追高",
      "短線過熱，分批停利",
      "分批停利",
      "高獲利分批",
      "流入後過熱",
      "資金放大但股價不漲",
      "爆量不漲警戒",
    ].includes(label)
  )
    return "text-orange-300";

  if (
    label.includes("出場") ||
    label.includes("跌破") ||
    label.includes("失敗") ||
    label.includes("高") ||
    label.includes("停損") ||
    label.includes("警戒") ||
    label.includes("轉弱") ||
    label.includes("減少")
  )
    return "text-red-300";

  return "text-slate-300";
}

function decisionTone(label: string) {
  if (["主線核心", "回測買點", "資金主攻", "強勢", "續航", "資金偷偷流入", "資金續航", "資金增加中"].includes(label)) return "text-emerald-300";
  if (["等回測", "觀察中", "接近買點", "轉強", "分歧"].includes(label)) return "text-yellow-300";
  if (["過熱不追", "分批停利", "短線過熱", "過熱"].includes(label)) return "text-orange-300";
  if (["主線失效", "出場避開", "轉弱退潮", "爆量不漲", "低量假強", "轉弱"].includes(label)) return "text-red-300";
  return "text-slate-300";
}

function flowTone(label: string) {
  if (label === "主線續航" || label === "綠燈" || label === "強勢" || label === "續航") return "text-emerald-300";
  if (label === "主線剛轉強" || label === "資金分歧" || label === "黃燈" || label === "轉強" || label === "分歧") return "text-yellow-300";
  if (label === "短線過熱" || label === "過熱") return "text-orange-300";
  if (label === "主線退潮" || label === "紅燈" || label === "轉弱") return "text-red-300";
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
function positionPlan(
  stock: Stock,
  position: Position | undefined,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  industryStatus?: string,
  sneakyHistory?: Record<string, SneakyHistory>,
  moneyHistory?: Record<string, MoneyHistory>
) {
  const buyPrice = position?.buyPrice || 0;
  const shares = position?.shares || 0;
  const hasPosition = buyPrice > 0;

  const atr = atrValue(stock);
  const atrLine = atrStopLine(stock);
  const pullback = pullbackRadar(stock, list, mainIndustries, settings);
  const chase = chaseRisk(stock, list, settings);
  const exit = exitAlert(stock, list, settings, industryStatus);
  const pv = priceVolumeState(stock, list, settings);
  const main = mainIndustries.includes(stock.industry);
  const confirm = sneakyHistory ? sneakyConfirmCount(stock.code, sneakyHistory) : 0;
  const moneyLabel = moneyHistory ? moneyTrendLabel(stock, moneyHistory) : "尚未累積";

  const pnlPercent = hasPosition ? ((stock.price - buyPrice) / buyPrice) * 100 : 0;
  const pnlAmount = hasPosition && shares > 0 ? (stock.price - buyPrice) * shares * 1000 : 0;

  const idealBuyLow = stock.openPrice;
  const idealBuyHigh = stock.openPrice * 1.015;
  const breakoutBuy = stock.openPrice * 1.005;
  const noChasePrice = stock.openPrice * 1.03;

  const personalStop1 = hasPosition ? Math.min(buyPrice * 0.98, stock.openPrice) : stock.openPrice;
  const personalStop2 = atrLine;
  const personalStop3 = stock.previousClose;

  const personalTakeProfit1 = hasPosition ? buyPrice * 1.03 : stock.openPrice * 1.03;
  const personalTakeProfit2 = hasPosition ? buyPrice * 1.05 : stock.openPrice * 1.05;
  const personalTakeProfit3 = hasPosition ? buyPrice * 1.08 : stock.openPrice * 1.08;

  const addPrice = Math.max(stock.highPrice, hasPosition ? buyPrice * 1.03 : stock.openPrice * 1.025);

  let buyText = "尚未輸入買進價，先看理想買點。";
  if (!hasPosition && pullback === "回測買點") buyText = "可列入低風險觀察區。";
  if (!hasPosition && moneyLabel === "資金慢慢增加") buyText = "資金慢慢增加，可加入觀察，等回測或突破確認。";
  if (!hasPosition && moneyLabel === "資金突然放大") buyText = "資金突然放大，先看股價有沒有跟上，不追高。";
  if (!hasPosition && moneyLabel === "資金放大但股價不漲") buyText = "資金放大但股價不漲，防爆量不漲。";
  if (!hasPosition && moneyLabel === "資金開始減少") buyText = "資金開始減少，先不要急著進場。";
  if (!hasPosition && confirm >= 3 && isSneakyMoney(stock, list, mainIndustries, settings)) buyText = "資金連續流入3次，可列入優先觀察，不追高。";
  else if (!hasPosition && isSneakyMoney(stock, list, mainIndustries, settings)) buyText = "資金有偷偷流入跡象，可加入觀察，不急著追。";
  if (!hasPosition && pullback === "接近買點") buyText = "接近買點，等量價確認。";
  if (!hasPosition && chase !== "追高風險低") buyText = "追高風險偏高，不追價。";
  if (hasPosition) buyText = `你的買進價 ${formatPrice(buyPrice)}，目前損益 ${formatPercent(pnlPercent)}。`;

  let stopText = "停損以開盤價、ATR線、昨收三層觀察。";
  if (moneyLabel === "資金開始減少") stopText = "資金開始減少，停損線要更嚴格。";
  if (hasPosition && stock.price < personalStop1) stopText = "跌破個人第一停損線，先減碼觀察。";
  if (stock.price < personalStop2) stopText = "跌破ATR移動停利線，保護獲利或降低風險。";
  if (stock.price < personalStop3) stopText = "跌破昨收，主線偏弱，出場避開。";

  let profitText = "用ATR移動停利，不猜最高點。";
  if (hasPosition && pnlPercent >= 3) profitText = "已有獲利，開始守移動停利。";
  if (hasPosition && pnlPercent >= 5) profitText = "獲利達第一段停利區，可分批保護獲利。";
  if (hasPosition && pnlPercent >= 8) profitText = "獲利偏大，避免貪高，分批停利更安全。";
  if (isOverheat(stock, settings)) profitText = "短線過熱，不追高，持有者可分批停利。";
  if (stock.price < atrLine) profitText = "跌破ATR線，獲利需保護。";

  const canAdd =
    hasPosition &&
    main &&
    pnlPercent > 1.5 &&
    pv === "量價同步" &&
    chase !== "追高風險高" &&
    stock.price >= addPrice &&
    amountRankPercent(stock, list) >= 70 &&
    volumeRankPercent(stock, list) >= 65 &&
    industryStatus !== "主線退潮" &&
    stock.price > atrLine &&
    moneyLabel !== "資金開始減少" &&
    moneyLabel !== "資金放大但股價不漲";

  let addText = "尚未達加倉條件。";
  if (!hasPosition) addText = "尚未輸入買進價，先不判斷加倉。";
  else if (canAdd) addText = "可小幅加倉，但仍要守ATR線。";
  else if (moneyLabel === "資金開始減少") addText = "資金開始減少，不加倉。";
  else if (moneyLabel === "資金放大但股價不漲") addText = "資金放大但股價不漲，先不加倉。";
  else if (pnlPercent < 0) addText = "成本以下，不建議加倉。";
  else if (!main) addText = "非前三主線，不建議加倉。";
  else if (chase === "追高風險高") addText = "追高風險高，不加倉。";
  else if (industryStatus === "主線退潮") addText = "產業退潮，不加倉。";
  else if (pv !== "量價同步") addText = "量價未同步，不加倉。";

  let action = "觀察";
  if (hasPosition && pnlPercent <= -3) action = "個人停損警戒";
  if (exit.includes("出場") || exit.includes("跌破")) action = "出場提醒";
  else if (moneyLabel === "資金開始減少") action = "資金減少警戒";
  else if (moneyLabel === "資金放大但股價不漲") action = "爆量不漲警戒";
  else if (moneyLabel === "資金慢慢增加") action = "資金增溫觀察";
  else if (moneyLabel === "資金突然放大") action = "資金放大觀察";
  else if (chase === "追高風險高") action = hasPosition ? "持有勿追" : "不追高";
  else if (!hasPosition && confirm >= 3 && isSneakyMoney(stock, list, mainIndustries, settings)) action = "資金續航觀察";
  else if (!hasPosition && isSneakyMoney(stock, list, mainIndustries, settings)) action = "資金流入觀察";
  else if (!hasPosition && pullback === "回測買點") action = "低風險觀察";
  else if (canAdd) action = "可小幅加倉";
  else if (hasPosition && pnlPercent >= 8) action = "高獲利分批";
  else if (hasPosition && pnlPercent >= 5) action = "分批停利";
  else if (hasPosition && pnlPercent > 0 && stock.price > atrLine) action = "續抱觀察";

  let batchTitle = "尚未進入分批停利";
  let batchStep1 = "尚未有明確獲利，先守停損。";
  let batchStep2 = "等獲利達 3%～5% 後，再考慮分批。";
  let batchStep3 = "若跌破開盤價、ATR線或昨收，降低持股。";
  let dangerText = "目前無明顯持倉危險。";

  if (!hasPosition) {
    batchTitle = "尚未輸入持倉";
    batchStep1 = "請先輸入買進價。";
    batchStep2 = "輸入後會自動計算分批停利。";
    batchStep3 = "張數可填可不填。";
    dangerText = "尚未建立個人風控。";
  } else if (moneyLabel === "資金開始減少") {
    batchTitle = "資金減少，先降低風險";
    batchStep1 = "第一步：不加倉。";
    batchStep2 = `第二步：守 ATR 線 ${formatPrice(atrLine)}。`;
    batchStep3 = "第三步：跌破開盤價或昨收就降低持股。";
    dangerText = "資金開始退場，保護本金與獲利。";
  } else if (pnlPercent < 0) {
    batchTitle = "虧損中，先不要加倉";
    batchStep1 = "第一步：守個人停損線。";
    batchStep2 = `跌破 ${formatPrice(personalStop1)} 先減碼觀察。`;
    batchStep3 = `跌破昨收 ${formatPrice(personalStop3)} 主線偏弱。`;
    dangerText = "成本以下不建議攤平加倉。";
  } else if (pnlPercent < 3) {
    batchTitle = "小獲利，先續抱觀察";
    batchStep1 = "第一步：不用急著停利。";
    batchStep2 = `守 ATR 線 ${formatPrice(atrLine)}。`;
    batchStep3 = "若轉弱或爆量不漲，再減碼。";
    dangerText = "還沒到明顯停利區。";
  } else if (pnlPercent < 5) {
    batchTitle = "獲利 3%+，開始守停利";
    batchStep1 = "第一段：可以先守，不一定急賣。";
    batchStep2 = `跌破 ATR 線 ${formatPrice(atrLine)} 可先出 1/3。`;
    batchStep3 = "若主線失效，剩餘部位降低。";
    dangerText = "不要再追高加碼。";
  } else if (pnlPercent < 8) {
    batchTitle = "獲利 5%+，可分批停利";
    batchStep1 = "第一段：可先停利 1/3。";
    batchStep2 = `第二段：跌破 ATR 線 ${formatPrice(atrLine)} 再出 1/3。`;
    batchStep3 = "最後一段：跌破開盤價或主線失效再出。";
    dangerText = "已進入保護獲利區。";
  } else {
    batchTitle = "獲利 8%+，避免貪高";
    batchStep1 = "第一段：建議先分批停利 1/3。";
    batchStep2 = `第二段：跌破 ATR 線 ${formatPrice(atrLine)} 再出 1/3。`;
    batchStep3 = "最後一段：跌破開盤價、昨收或主線失效，出場保護獲利。";
    dangerText = "獲利很大時，重點是守住，不是追更高。";
  }

  if (exit.includes("跌破") || exit.includes("出場")) {
    dangerText = `警戒：${exit}`;
  }

  return {
    hasPosition,
    buyPrice,
    shares,
    pnlPercent,
    pnlAmount,
    atr,
    atrLine,
    idealBuyLow,
    idealBuyHigh,
    breakoutBuy,
    noChasePrice,
    personalStop1,
    personalStop2,
    personalStop3,
    personalTakeProfit1,
    personalTakeProfit2,
    personalTakeProfit3,
    addPrice,
    buyText,
    stopText,
    profitText,
    addText,
    action,
    batchTitle,
    batchStep1,
    batchStep2,
    batchStep3,
    dangerText,
  };
}

function getIndustryRanking(
  list: Stock[],
  settings: Settings,
  lockedIndustries: string[],
  sneakyHistory: Record<string, SneakyHistory>,
  moneyHistory: Record<string, MoneyHistory>
): IndustryItem[] {
  const totalAmount = list.reduce((sum, s) => sum + estimatedAmount(s), 0);
  const totalVolume = list.reduce((sum, s) => sum + s.volume, 0);

  const map = new Map<string, IndustryItem>();

  list.forEach((stock) => {
    const item =
      map.get(stock.industry) ||
      ({
        industry: stock.industry,
        count: 0,
        totalAmount: 0,
        totalVolume: 0,
        avgChange: 0,
        amountShare: 0,
        volumeShare: 0,
        coreCount: 0,
        sneakyCount: 0,
        failCount: 0,
        overheatCount: 0,
        score: 0,
        strength: "觀察",
        status: "觀察中",
        light: "灰燈",
        reason: "",
        stocks: [],
      } as IndustryItem);

    item.count += 1;
    item.totalAmount += estimatedAmount(stock);
    item.totalVolume += stock.volume;
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);

    map.set(stock.industry, item);
  });

  const temp = Array.from(map.values()).map((item) => ({
    ...item,
    avgChange: item.avgChange / Math.max(1, item.count),
    amountShare: totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0,
    volumeShare: totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0,
  }));

  const mainIndustries =
    lockedIndustries.length > 0
      ? lockedIndustries
      : temp
          .sort((a, b) => b.totalAmount + b.totalVolume * 10 - (a.totalAmount + a.totalVolume * 10))
          .slice(0, 3)
          .map((i) => i.industry);

  return temp
    .map((item) => {
      let coreCount = 0;
      let sneakyCount = 0;
      let failCount = 0;
      let overheatCount = 0;

      item.stocks.forEach((stock) => {
        const moneyLabel = moneyTrendLabel(stock, moneyHistory);

        if (isMoneyAttack(stock, list, mainIndustries, settings)) coreCount += 1;
        if (sneakyConfirmCount(stock.code, sneakyHistory) >= 2 || moneyLabel === "資金慢慢增加" || moneyLabel === "資金突然放大") sneakyCount += 1;
        if (isFail(stock, list, settings)) failCount += 1;
        if (isOverheat(stock, settings)) overheatCount += 1;
      });

      const score =
        item.amountShare * 3 +
        item.volumeShare * 1.8 +
        Math.max(0, item.avgChange) * 5 +
        coreCount * 25 +
        sneakyCount * 18 -
        failCount * 22 -
        overheatCount * 8;

      let status: IndustryItem["status"] = "觀察中";
      let light: IndustryItem["light"] = "灰燈";
      let strength: IndustryItem["strength"] = "觀察";

      if (failCount >= Math.max(2, item.count * 0.35)) {
        status = "主線退潮";
        light = "紅燈";
        strength = "轉弱";
      } else if (overheatCount >= Math.max(2, item.count * 0.35)) {
        status = "短線過熱";
        light = "紅燈";
        strength = "過熱";
      } else if (coreCount > 0 && failCount > 0) {
        status = "資金分歧";
        light = "黃燈";
        strength = "分歧";
      } else if (coreCount >= 2 && item.amountShare >= 15 && score >= 80) {
        status = "主線續航";
        light = "綠燈";
        strength = "強勢";
      } else if (coreCount >= 1 && item.amountShare >= 10) {
        status = "主線續航";
        light = "綠燈";
        strength = "續航";
      } else if (sneakyCount >= 2 || item.amountShare >= 10 || item.avgChange >= 3) {
        status = "主線剛轉強";
        light = "黃燈";
        strength = "轉強";
      }

      const result = {
        ...item,
        coreCount,
        sneakyCount,
        failCount,
        overheatCount,
        score,
        status,
        light,
        strength,
        reason: "",
      };

      return {
        ...result,
        reason: strengthReason(result),
      };
    })
    .sort((a, b) => b.score - a.score);
}
function MiniCard({ title, value, sub, tone, onClick }: { title: string; value: string | number; sub: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left active:scale-95">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
    </button>
  );
}

function ActionCard({ title, sub, badge, tone, onClick }: { title: string; sub: string; badge: string | number; tone: string; onClick: () => void }) {
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

function DetailRow({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}

function ModalShell({ title, sub, children, onClose, z = 90 }: { title: string; sub?: string; children: ReactNode; onClose: () => void; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 px-3 py-6 backdrop-blur-sm" style={{ zIndex: z }} onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-3xl border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              {sub && <div className="text-xs font-bold text-slate-500">{sub}</div>}
              <div className="mt-1 text-2xl font-black text-white">{title}</div>
            </div>
            <button onClick={onClose} className="rounded-2xl bg-slate-800 px-3 py-2 text-lg font-black text-white">×</button>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function SimpleStockButton({ stock, label, tone, onClick }: { stock: Stock; label: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl bg-black/30 p-3 text-left active:scale-95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-base font-black text-white">{stockDisplayName(stock)}</div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-black ${tone}`}>{label}</div>
          <div className={stock.changePercent >= 0 ? "text-sm font-black text-red-300" : "text-sm font-black text-emerald-300"}>
            {formatPercent(stock.changePercent)}
          </div>
        </div>
      </div>
    </button>
  );
}

function IndustryCard({ item, rank, onClick }: { item: IndustryItem; rank: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 主線強弱排序</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${flowTone(item.strength)}`}>
            {item.light}｜{item.status}｜{item.strength}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-400">{item.reason}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-yellow-300">強弱 {item.score.toFixed(0)}</div>
          <div className="text-xs font-black text-slate-400">資金 {item.amountShare.toFixed(1)}%</div>
          <div className="text-xs font-black text-slate-400">均漲 {formatPercent(item.avgChange)}</div>
        </div>
      </div>
    </button>
  );
}

function SignalCard({ record }: { record: SignalRecord }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{record.dateKey}｜{record.code}</div>
          <div className="mt-1 text-lg font-black text-white">{record.name}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{record.industry}｜{record.signal}</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-black ${signalTone(record.result)}`}>{record.result}</div>
          <div className={record.resultPercent >= 0 ? "text-sm font-black text-red-300" : "text-sm font-black text-emerald-300"}>
            {formatPercent(record.resultPercent)}
          </div>
        </div>
      </div>
      <div className={`mt-3 rounded-2xl bg-black/40 p-3 text-xs font-bold ${signalTone(record.result)}`}>
        {record.reason}
      </div>
    </div>
  );
}

function StockCard({
  stock,
  rank,
  top50,
  mainIndustries,
  settings,
  sneakyHistory,
  moneyHistory,
  signalRecords,
  industryStatus,
  position,
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
  sneakyHistory: Record<string, SneakyHistory>;
  moneyHistory: Record<string, MoneyHistory>;
  signalRecords: SignalRecord[];
  industryStatus: string;
  position?: Position;
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
  const decision = decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory);
  const plan = positionPlan(stock, position, top50, mainIndustries, settings, industryStatus, sneakyHistory, moneyHistory);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const isFavorite = favoriteCodes.includes(stock.code);
  const isWatch = watchCodes.includes(stock.code);
  const status = sneakyStatus(stock, top50, mainIndustries, settings, sneakyHistory);
  const confirm = Math.min(3, sneakyConfirmCount(stock.code, sneakyHistory));
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);
  const moneyData = moneyTrendChange(stock.code, moneyHistory);
  const lastSignal = signalRecords.find((r) => r.code === stock.code);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stockDisplayName(stock)}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">{stock.industry}</div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>{formatPercent(stock.changePercent)}</div>
            <div className="mt-1 text-sm font-black text-white">{formatPrice(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
          <div className={`rounded-2xl bg-black/30 p-2 ${decisionTone(decision)}`}>主線判斷<br />{decision}</div>
          <div className={`rounded-2xl bg-black/30 p-2 ${moneyTrendTone(moneyLabel)}`}>資金趨勢<br />{moneyLabel.replace("資金", "")}</div>
          <div className={`rounded-2xl bg-black/30 p-2 ${sneakyStatusTone(status)}`}>續航確認<br />{status}</div>
          <div className={`rounded-2xl bg-black/30 p-2 ${riskTone(plan.action)}`}>我的計畫<br />{plan.action}</div>
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${moneyTrendTone(moneyLabel)}`}>
          成交金額：{formatAmount(moneyData.prevAmount)} → {formatAmount(moneyData.nowAmount)}｜{formatPercent(moneyData.amountChangePercent)}
          <br />
          續航：{"●".repeat(confirm)}{"○".repeat(Math.max(0, 3 - confirm))}
        </div>

        {lastSignal && (
          <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${signalTone(lastSignal.result)}`}>
            最近訊號：{lastSignal.signal}｜{lastSignal.result}｜{formatPercent(lastSignal.resultPercent)}
          </div>
        )}

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}｜{prevPrice ? `${prevPrice.toFixed(2)} → ${stock.price.toFixed(2)}` : "尚無上一筆"}｜更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))} className={`rounded-2xl py-2 text-sm font-black ${isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"}`}>
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
        </button>
        <button onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))} className={`rounded-2xl py-2 text-sm font-black ${isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"}`}>
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>
      </div>
    </div>
  );
}

function StockQuickModal({
  stock,
  top50,
  mainIndustries,
  settings,
  sneakyHistory,
  moneyHistory,
  signalRecords,
  industryStatus,
  position,
  onSavePosition,
  onDeletePosition,
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
  sneakyHistory: Record<string, SneakyHistory>;
  moneyHistory: Record<string, MoneyHistory>;
  signalRecords: SignalRecord[];
  industryStatus: string;
  position?: Position;
  onSavePosition: (position: Position) => void;
  onDeletePosition: (code: string) => void;
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
  const [buyPriceText, setBuyPriceText] = useState(position?.buyPrice ? String(position.buyPrice) : "");
  const [sharesText, setSharesText] = useState(position?.shares ? String(position.shares) : "");
  const [noteText, setNoteText] = useState(position?.note || "");

  const decision = decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory);
  const plan = positionPlan(stock, position, top50, mainIndustries, settings, industryStatus, sneakyHistory, moneyHistory);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const isFavorite = favoriteCodes.includes(stock.code);
  const isWatch = watchCodes.includes(stock.code);
  const pullback = pullbackRadar(stock, top50, mainIndustries, settings);
  const chase = chaseRisk(stock, top50, settings);
  const exit = exitAlert(stock, top50, settings, industryStatus);
  const pv = priceVolumeState(stock, top50, settings);
  const status = sneakyStatus(stock, top50, mainIndustries, settings, sneakyHistory);
  const confirm = Math.min(3, sneakyConfirmCount(stock.code, sneakyHistory));
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);
  const moneyData = moneyTrendChange(stock.code, moneyHistory);
  const moneyReason = moneyTrendReason(stock, moneyHistory);
  const lastSignal = signalRecords.find((r) => r.code === stock.code);

  function saveMyPosition() {
    const buyPrice = Number(buyPriceText);
    const shares = Number(sharesText || 0);

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      alert("請輸入正確買進價");
      return;
    }

    onSavePosition({
      code: stock.code,
      buyPrice,
      shares: Number.isFinite(shares) && shares > 0 ? shares : 0,
      note: noteText,
    });
  }

  return (
    <ModalShell title={stockDisplayName(stock)} sub={`${stock.code}｜${stock.industry}`} onClose={onClose} z={120}>
      <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
        <div className={`text-3xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>{formatPercent(stock.changePercent)}</div>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500">現價</div>
          <div className="text-xl font-black text-white">{formatPrice(stock.price)}</div>
        </div>
      </div>

      <section className="mt-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
        <div className="text-lg font-black text-cyan-100">輸入我的持倉</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={buyPriceText} onChange={(e) => setBuyPriceText(e.target.value)} placeholder="我的買進價" inputMode="decimal" className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none" />
          <input value={sharesText} onChange={(e) => setSharesText(e.target.value)} placeholder="張數，可不填" inputMode="decimal" className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none" />
        </div>
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="備註，可不填" className="mt-2 w-full rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-bold text-white outline-none" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={saveMyPosition} className="rounded-2xl bg-cyan-500 py-3 text-sm font-black text-white">儲存我的買點</button>
          <button onClick={() => onDeletePosition(stock.code)} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">刪除買點</button>
        </div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${riskTone(plan.action)}`}>
        <div className="text-xs font-bold text-slate-400">我的交易計畫</div>
        <div className="mt-1 text-3xl font-black">{plan.action}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          買點：{plan.buyText}
          <br />
          停損：{plan.stopText}
          <br />
          停利：{plan.profitText}
          <br />
          加倉：{plan.addText}
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-slate-900/80 p-4">
        <div className="text-lg font-black text-white">我的損益</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DetailRow label="我的買進價" value={plan.hasPosition ? formatPrice(plan.buyPrice) : "未輸入"} tone="text-yellow-300" />
          <DetailRow label="目前損益%" value={plan.hasPosition ? formatPercent(plan.pnlPercent) : "--"} tone={plan.pnlPercent >= 0 ? "text-red-300" : "text-emerald-300"} />
          <DetailRow label="張數" value={plan.shares || "--"} tone="text-cyan-300" />
          <DetailRow label="估算損益" value={plan.hasPosition && plan.shares > 0 ? formatAmount(plan.pnlAmount) : "--"} tone={plan.pnlAmount >= 0 ? "text-red-300" : "text-emerald-300"} />
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4">
        <div className="text-lg font-black text-emerald-100">資金增減趨勢</div>
        <div className={`mt-2 text-2xl font-black ${moneyTrendTone(moneyLabel)}`}>{moneyLabel}</div>
        <div className="mt-2 text-sm font-bold text-emerald-100">
          成交金額：{formatAmount(moneyData.prevAmount)} → {formatAmount(moneyData.nowAmount)}
          <br />
          金額變化：{formatPercent(moneyData.amountChangePercent)}
          <br />
          成交量變化：{formatPercent(moneyData.volumeChangePercent)}
        </div>
        <div className={`mt-3 rounded-2xl bg-black/40 p-3 text-sm font-black ${moneyTrendTone(moneyLabel)}`}>{moneyReason}</div>
      </section>

      <section className="mt-3 rounded-2xl border border-yellow-500/40 bg-yellow-950/30 p-4">
        <div className="text-lg font-black text-yellow-100">分批停利計畫</div>
        <div className={`mt-2 text-2xl font-black ${riskTone(plan.action)}`}>{plan.batchTitle}</div>
        <div className="mt-3 space-y-2 text-sm font-bold text-yellow-100">
          <div className="rounded-2xl bg-black/30 p-3">① {plan.batchStep1}</div>
          <div className="rounded-2xl bg-black/30 p-3">② {plan.batchStep2}</div>
          <div className="rounded-2xl bg-black/30 p-3">③ {plan.batchStep3}</div>
        </div>
        <div className={`mt-3 rounded-2xl bg-black/40 p-3 text-sm font-black ${riskTone(plan.dangerText)}`}>{plan.dangerText}</div>
      </section>

      <section className="mt-3 rounded-2xl bg-blue-950/30 p-4">
        <div className="text-lg font-black text-blue-100">買點 / 停損 / 加倉</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DetailRow label="回測買點" value={`${formatPrice(plan.idealBuyLow)}～${formatPrice(plan.idealBuyHigh)}`} tone="text-blue-300" />
          <DetailRow label="追高禁止" value={`高於 ${formatPrice(plan.noChasePrice)}`} tone="text-orange-300" />
          <DetailRow label="ATR停利線" value={formatPrice(plan.atrLine)} tone="text-cyan-300" />
          <DetailRow label="加倉參考" value={formatPrice(plan.addPrice)} tone="text-purple-300" />
        </div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${decisionTone(decision)}`}>
        <div className="text-xs font-bold text-slate-400">主線結論</div>
        <div className="mt-1 text-2xl font-black">{decision}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          回測雷達：{pullback}
          <br />
          追高風險：{chase}
          <br />
          出場提醒：{exit}
          <br />
          量價狀態：{pv}
          <br />
          續航確認：{status}｜{"●".repeat(confirm)}{"○".repeat(Math.max(0, 3 - confirm))}
        </div>
      </section>

      {lastSignal && (
        <section className="mt-3 rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4">
          <div className="text-lg font-black text-purple-100">最近訊號結果</div>
          <div className={`mt-2 text-2xl font-black ${signalTone(lastSignal.result)}`}>{lastSignal.result}</div>
          <div className="mt-2 text-sm font-bold text-purple-100">
            {lastSignal.signal}｜訊號後 {formatPercent(lastSignal.resultPercent)}
            <br />
            {lastSignal.reason}
          </div>
        </section>
      )}

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
        <button onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))} className={`rounded-2xl py-3 text-sm font-black ${isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"}`}>
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
        </button>
        <button onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))} className={`rounded-2xl py-3 text-sm font-black ${isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"}`}>
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
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [sneakyHistory, setSneakyHistory] = useState<Record<string, SneakyHistory>>({});
  const [moneyHistory, setMoneyHistory] = useState<Record<string, MoneyHistory>>({});
  const [signalRecords, setSignalRecords] = useState<SignalRecord[]>([]);

  const [tab, setTab] = useState<TabKey>("home");
  const [popup, setPopup] = useState<PopupKey>("");
  const [selectedCode, setSelectedCode] = useState("");
  const [industryPopup, setIndustryPopup] = useState("");

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [watchCodes, setWatchCodes] = useState<string[]>([]);

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
  const contentRef = useRef<HTMLDivElement | null>(null);

  function jumpToContent() {
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

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
    () => getIndustryRanking(top50, settings, settings.stableIndustryLock ? lockedIndustries : [], sneakyHistory, moneyHistory),
    [top50, settings, lockedIndustries, sneakyHistory, moneyHistory]
  );

  const selectedStock = useMemo(() => stocks.find((s) => s.code === selectedCode) || searchHistory.find((s) => s.code === selectedCode) || null, [stocks, searchHistory, selectedCode]);

  function stockIndustryStatus(stock: Stock) {
    return industryRanking.find((item) => item.industry === stock.industry)?.status || "觀察中";
  }

  const moneyUpList = useMemo(
    () =>
      top50
        .filter((stock) => ["資金慢慢增加", "資金突然放大"].includes(moneyTrendLabel(stock, moneyHistory)))
        .sort((a, b) => moneyTrendChange(b.code, moneyHistory).amountChangePercent - moneyTrendChange(a.code, moneyHistory).amountChangePercent),
    [top50, moneyHistory]
  );

  const moneyDownList = useMemo(
    () =>
      top50
        .filter((stock) => ["資金開始減少", "資金放大但股價不漲"].includes(moneyTrendLabel(stock, moneyHistory)))
        .sort((a, b) => moneyTrendChange(a.code, moneyHistory).amountChangePercent - moneyTrendChange(b.code, moneyHistory).amountChangePercent),
    [top50, moneyHistory]
  );

  const sneakyList = useMemo(
    () => top50.filter((stock) => isSneakyMoney(stock, top50, mainIndustries, settings)).sort((a, b) => sneakyMoneyScore(b, top50, mainIndustries, settings) - sneakyMoneyScore(a, top50, mainIndustries, settings)),
    [top50, mainIndustries, settings]
  );

  const sneakyStrongList = useMemo(() => sneakyList.filter((stock) => sneakyConfirmCount(stock.code, sneakyHistory) >= 3), [sneakyList, sneakyHistory]);

  const coreList = useMemo(
    () => top50.filter((stock) => decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory) === "主線核心"),
    [top50, mainIndustries, settings, sneakyHistory, moneyHistory]
  );

  const pullbackList = useMemo(
    () => top50.filter((stock) => ["回測買點", "接近買點"].includes(pullbackRadar(stock, top50, mainIndustries, settings))),
    [top50, mainIndustries, settings]
  );

  const overheatList = useMemo(() => top50.filter((stock) => chaseRisk(stock, top50, settings) === "追高風險高"), [top50, settings]);

  const failedList = useMemo(
    () =>
      top50.filter((stock) => {
        const exit = exitAlert(stock, top50, settings, stockIndustryStatus(stock));
        return decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory) === "主線失效" || exit.includes("出場") || exit.includes("跌破");
      }),
    [top50, mainIndustries, settings, industryRanking, sneakyHistory, moneyHistory]
  );

  const amountList = useMemo(() => [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)), [top50]);
  const volumeList = useMemo(() => [...top50].sort((a, b) => b.volume - a.volume), [top50]);

  const signalSummary = useMemo(() => {
    return {
      all: signalHitRate(signalRecords),
      money: signalHitRate(signalRecords, "資金慢慢增加"),
      bigMoney: signalHitRate(signalRecords, "資金突然放大"),
      sneaky3: signalHitRate(signalRecords, "資金續航3/3"),
      core: signalHitRate(signalRecords, "主線核心"),
      pullback: signalHitRate(signalRecords, "回測買點"),
      chase: signalHitRate(signalRecords, "追高風險"),
      exit: signalHitRate(signalRecords, "出場警戒"),
    };
  }, [signalRecords]);

  const positionRows = useMemo(() => {
    return Object.values(positions)
      .map((position) => {
        const stock = stocks.find((s) => s.code === position.code) || searchHistory.find((s) => s.code === position.code);
        if (!stock) return null;

        const plan = positionPlan(stock, position, top50.length > 0 ? top50 : [stock], mainIndustries, settings, stockIndustryStatus(stock), sneakyHistory, moneyHistory);

        return { stock, position, plan, pnlPercent: plan.pnlPercent, pnlAmount: plan.pnlAmount, action: plan.action, danger: plan.dangerText };
      })
      .filter(Boolean) as {
      stock: Stock;
      position: Position;
      plan: ReturnType<typeof positionPlan>;
      pnlPercent: number;
      pnlAmount: number;
      action: string;
      danger: string;
    }[];
  }, [positions, stocks, searchHistory, top50, mainIndustries, settings, industryRanking, sneakyHistory, moneyHistory]);

  const bestPosition = positionRows.length ? [...positionRows].sort((a, b) => b.pnlPercent - a.pnlPercent)[0] : null;
  const dangerPosition = positionRows.length ? positionRows.find((row) => row.action.includes("停損") || row.action.includes("出場") || row.action.includes("減少")) || positionRows[0] : null;

  const positionStats = useMemo(() => {
    const list = Object.values(positions);
    let totalPnl = 0;

    list.forEach((p) => {
      const stock = stocks.find((s) => s.code === p.code) || searchHistory.find((s) => s.code === p.code);
      if (stock && p.buyPrice > 0 && p.shares > 0) {
        totalPnl += (stock.price - p.buyPrice) * p.shares * 1000;
      }
    });

    return { count: list.length, totalPnl };
  }, [positions, stocks, searchHistory]);

  const watchStocks = useMemo(() => {
    const map = new Map<string, Stock>();

    watchCodes.forEach((code) => {
      const stock = stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code);
      if (stock) map.set(code, stock);
    });

    [...moneyUpList, ...sneakyStrongList, ...sneakyList, ...coreList, ...pullbackList].slice(0, 25).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [watchCodes, stocks, searchHistory, moneyUpList, sneakyStrongList, sneakyList, coreList, pullbackList]);

  const favoriteStocks = useMemo(() => favoriteCodes.map((code) => stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code)).filter(Boolean) as Stock[], [favoriteCodes, stocks, searchHistory]);

  const topIndustry = industryRanking[0];
  const secondIndustry = industryRanking[1];
  const thirdIndustry = industryRanking[2];
  const totalAmount = top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0);

  const attackList = useMemo(() => {
    return [...moneyUpList, ...sneakyStrongList, ...coreList, ...pullbackList]
      .filter((stock, index, arr) => arr.findIndex((item) => item.code === stock.code) === index)
      .filter((stock) => !isOverheat(stock, settings) && !isFail(stock, top50, settings))
      .slice(0, 5);
  }, [moneyUpList, sneakyStrongList, coreList, pullbackList, settings, top50]);

  const noChaseList = useMemo(() => overheatList.slice(0, 5), [overheatList]);
  const exitWatchList = useMemo(() => failedList.slice(0, 5), [failedList]);

  const marketMode = useMemo(() => {
    if (!topIndustry) return "等待資料";
    if (moneyDownList.length >= 6 || failedList.length >= 6) return "風險偏高";
    if (overheatList.length >= 8) return "只觀察";
    if (moneyUpList.length >= 5 && topIndustry.strength !== "轉弱" && topIndustry.strength !== "過熱") return "可進攻";
    if (sneakyStrongList.length >= 3) return "可進攻";
    return "只觀察";
  }, [topIndustry, moneyUpList, moneyDownList, failedList, overheatList, sneakyStrongList]);

  const marketModeTone = marketMode === "可進攻" ? "text-emerald-300" : marketMode === "風險偏高" ? "text-red-300" : "text-yellow-300";

  const dashboardReason = useMemo(() => {
    if (marketMode === "可進攻") return "資金有擴散跡象，優先看主線核心與資金續航股，不追高。";
    if (marketMode === "風險偏高") return "資金減少或出場警戒偏多，先保護持倉，少開新倉。";
    return "主線尚未完全確認，先觀察資金是否延續。";
  }, [marketMode]);

  const industrySelectedList = useMemo(() => {
    if (!industryPopup) return [];
    return sortList(top50.filter((stock) => stock.industry === industryPopup));
  }, [industryPopup, top50, mainIndustries, industryRanking, positions, sneakyHistory, moneyHistory]);

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
    setLockedIndustries(safeParse(localStorage.getItem(LOCKED_INDUSTRY_KEY), []));
    setPositions(safeParse(localStorage.getItem(POSITIONS_KEY), {}));
    setSneakyHistory(safeParse(localStorage.getItem(SNEAKY_HISTORY_KEY), {}));
    setMoneyHistory(safeParse(localStorage.getItem(MONEY_HISTORY_KEY), {}));
    setSignalRecords(safeParse(localStorage.getItem(SIGNAL_HISTORY_KEY), []));

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
  }, [settings.refreshSeconds, lastPriceMap, mainIndustries, sneakyHistory, moneyHistory, signalRecords]);

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

  function savePosition(position: Position) {
    const next = { ...positions, [position.code]: position };
    setPositions(next);
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
    saveFavorites([...favoriteCodes, position.code]);
  }

  function deletePosition(code: string) {
    const next = { ...positions };
    delete next[code];
    setPositions(next);
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
  }

  function updateSneakyHistory(list: Stock[]) {
    const topList = list.slice(0, 50);

    setSneakyHistory((old) => {
      const next = { ...old };

      topList.forEach((stock) => {
        const history = next[stock.code] || ({ code: stock.code, sneakyRaw: [], failRaw: [], hotRaw: [] } as SneakyHistory);
        next[stock.code] = {
          code: stock.code,
          sneakyRaw: [...history.sneakyRaw, isSneakyMoney(stock, topList, mainIndustries, settings)].slice(-6),
          failRaw: [...history.failRaw, isFail(stock, topList, settings)].slice(-6),
          hotRaw: [...history.hotRaw, isOverheat(stock, settings)].slice(-6),
        };
      });

      localStorage.setItem(SNEAKY_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateMoneyHistory(list: Stock[]) {
    const topList = list.slice(0, 50);

    setMoneyHistory((old) => {
      const next = { ...old };

      topList.forEach((stock) => {
        const history = next[stock.code] || ({ code: stock.code, amountRaw: [], volumeRaw: [], priceRaw: [] } as MoneyHistory);
        next[stock.code] = {
          code: stock.code,
          amountRaw: [...history.amountRaw, estimatedAmount(stock)].slice(-8),
          volumeRaw: [...history.volumeRaw, stock.volume].slice(-8),
          priceRaw: [...history.priceRaw, stock.price].slice(-8),
        };
      });

      localStorage.setItem(MONEY_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateSignalRecords(list: Stock[]) {
    const dateKey = todayKey();
    const topList = list.slice(0, 50);

    setSignalRecords((old) => {
      const map = new Map<string, SignalRecord>();

      old.forEach((record) => {
        const stock = list.find((s) => s.code === record.code);
        const latestPrice = stock?.price ?? record.latestPrice;
        const resultPercent = record.startPrice > 0 ? ((latestPrice - record.startPrice) / record.startPrice) * 100 : 0;
        const result = signalResult(record.signal, resultPercent);

        map.set(record.id, {
          ...record,
          latestPrice,
          resultPercent,
          result,
          reason: signalReason(record.signal, resultPercent),
        });
      });

      function addSignal(stock: Stock, signal: SignalType) {
        const id = `${dateKey}-${stock.code}-${signal}`;
        if (map.has(id)) return;

        map.set(id, {
          id,
          dateKey,
          code: stock.code,
          name: stockDisplayName(stock),
          industry: stock.industry,
          signal,
          startPrice: stock.price,
          latestPrice: stock.price,
          resultPercent: 0,
          result: "等待",
          reason: "今日剛出現訊號，等待後續股價驗證。",
        });
      }

      topList.forEach((stock) => {
        const moneyLabel = moneyTrendLabel(stock, moneyHistory);
        const decision = decisionText(stock, topList, mainIndustries, settings, sneakyHistory, moneyHistory);
        const pullback = pullbackRadar(stock, topList, mainIndustries, settings);
        const chase = chaseRisk(stock, topList, settings);
        const exit = exitAlert(stock, topList, settings, stockIndustryStatus(stock));

        if (moneyLabel === "資金慢慢增加") addSignal(stock, "資金慢慢增加");
        if (moneyLabel === "資金突然放大") addSignal(stock, "資金突然放大");
        if (sneakyConfirmCount(stock.code, sneakyHistory) >= 3) addSignal(stock, "資金續航3/3");
        if (decision === "主線核心") addSignal(stock, "主線核心");
        if (pullback === "回測買點") addSignal(stock, "回測買點");
        if (chase === "追高風險高") addSignal(stock, "追高風險");
        if (exit.includes("出場") || exit.includes("跌破") || exit.includes("減碼")) addSignal(stock, "出場警戒");
      });

      const next = Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 300);
      localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(next));
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

      const dataTime = json.updatedAtTaiwan || (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : nowText());

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

      updateSneakyHistory(normalized);
      updateMoneyHistory(normalized);
      updateSignalRecords(normalized);

      localStorage.setItem(CACHE_KEY, JSON.stringify({ stocks: normalized, lastSuccessAt: successTime, apiDataTime: dataTime, source: dataSource }));
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
      const ad = decisionText(a, top50, mainIndustries, settings, sneakyHistory, moneyHistory);
      const bd = decisionText(b, top50, mainIndustries, settings, sneakyHistory, moneyHistory);

      const weight = (d: string, code: string) => {
        let score = 0;
        const confirm = sneakyConfirmCount(code, sneakyHistory);
        const moneyLabel = moneyTrendLabel({ code } as Stock, moneyHistory);

        if (d === "主線核心") score += 1000;
        if (d === "資金增加中") score += 900;
        if (d === "資金續航") score += 850;
        if (d === "資金偷偷流入") score += 750;
        if (d === "回測買點") score += 650;
        if (moneyLabel === "資金慢慢增加") score += 500;
        if (moneyLabel === "資金突然放大") score += 450;
        if (moneyLabel === "資金開始減少") score -= 700;
        if (moneyLabel === "資金放大但股價不漲") score -= 350;
        score += Math.min(3, confirm) * 100;

        return score;
      };

      return weight(bd, b.code) + estimatedAmount(b) / 10000000 - (weight(ad, a.code) + estimatedAmount(a) / 10000000);
    });
  }

  function popupList(key: PopupKey) {
    if (key === "moneyUp") return sortList(moneyUpList);
    if (key === "moneyDown") return sortList(moneyDownList);
    if (key === "sneaky") return sortList(sneakyList);
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
    if (key === "moneyUp") return "資金慢慢增加";
    if (key === "moneyDown") return "資金減少警戒";
    if (key === "sneaky") return "資金偷偷流入續航";
    if (key === "core") return "主線核心股";
    if (key === "pullback") return "買點與回測雷達";
    if (key === "overheat") return "追高風險警報";
    if (key === "failed") return "停損與出場提醒";
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
      sneakyHistory,
      moneyHistory,
      signalRecords,
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

  function openStock(code: string) {
    setSelectedCode(code);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">20項盤中實戰儀表板版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">盤中主線雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                首頁集中顯示今天能不能做、主線在哪、哪些可看、哪些不要追。
              </p>
            </div>

            <button onClick={() => loadStocks()} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
          <div className="text-xs font-bold text-emerald-300">今日盤中實戰判斷</div>
          <div className={`mt-1 text-4xl font-black ${marketModeTone}`}>{marketMode}</div>
          <div className="mt-2 text-sm font-bold text-slate-300">{dashboardReason}</div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DetailRow label="最強主線" value={topIndustry ? `${topIndustry.industry}｜${topIndustry.strength}` : "--"} tone="text-yellow-300" />
            <DetailRow label="資金增加" value={`${moneyUpList.length} 檔`} tone="text-emerald-300" />
            <DetailRow label="不要追高" value={`${overheatList.length} 檔`} tone="text-orange-300" />
            <DetailRow label="出場警戒" value={`${failedList.length} 檔`} tone="text-red-300" />
          </div>

          <button onClick={() => setPopup("dashboard")} className="mt-4 w-full rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
            打開實戰儀表板
          </button>
        </section>

        <section className="mt-4 rounded-3xl border border-purple-500/40 bg-purple-950/20 p-5">
          <div className="text-xs font-bold text-purple-300">訊號命中率摘要</div>
          <div className="mt-1 text-xl font-black text-purple-100">
            整體命中率：{signalSummary.all.done > 0 ? `${signalSummary.all.rate.toFixed(0)}%` : "等待累積"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">
            已記錄 {signalSummary.all.total} 筆訊號｜已判斷 {signalSummary.all.done} 筆｜成功 {signalSummary.all.success} 筆
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-cyan-100">全個股查詢</div>
              <div className="mt-1 text-xs font-bold text-slate-400">查詢後點股票可輸入我的買進價。</div>
            </div>
            <button onClick={() => setPopup("search")} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">查詢</button>
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
              <div className="mt-1 text-xs font-bold text-cyan-300">50強估算成交金額：{formatAmount(totalAmount)}</div>
            </div>

            <button onClick={() => setPopup("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">主線統計</button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="優先觀察" value={attackList.length} sub="主線/資金/回測" tone="text-emerald-300" onClick={() => setPopup("dashboard")} />
          <MiniCard title="不要追高" value={noChaseList.length} sub="過熱警報" tone="text-orange-300" onClick={() => setPopup("overheat")} />
          <MiniCard title="出場警戒" value={exitWatchList.length} sub="跌破/轉弱" tone="text-red-300" onClick={() => setPopup("failed")} />
          <MiniCard title="持倉風險" value={dangerPosition ? stockDisplayName(dangerPosition.stock) : "--"} sub="點持倉總表" tone="text-cyan-300" onClick={() => setPopup("positions")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="實戰儀表板" sub="一眼看今天能不能做" badge="📊" tone="text-emerald-300" onClick={() => setPopup("dashboard")} />
          <ActionCard title="命中率追蹤" sub="看訊號準不準" badge={signalRecords.length} tone="text-purple-300" onClick={() => setPopup("signal")} />
          <ActionCard title="產業強弱排行" sub="看資金主線強弱" badge={industryRanking.length} tone="text-yellow-300" onClick={() => setPopup("industry")} />
          <ActionCard title="持倉總表" sub="損益 / 停利 / 風險" badge={positionStats.count} tone="text-cyan-300" onClick={() => setPopup("positions")} />
          <ActionCard title="今日50強" sub="漲幅排行" badge={top50.length} tone="text-red-300" onClick={() => setPopup("top50")} />
          <ActionCard title="設定" sub="更新頻率 / 重置紀錄" badge="⚙️" tone="text-purple-300" onClick={() => setPopup("settings")} />
        </section>

        <section ref={contentRef} className="mt-4 scroll-mt-4">
          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">今日優先觀察</h3>
                  <button onClick={() => setPopup("dashboard")} className="rounded-2xl bg-emerald-500/20 px-3 py-2 text-xs font-black text-emerald-200">看全部</button>
                </div>

                <div className="mt-3 space-y-3">
                  {attackList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有明確優先觀察股。</div>}
                  {attackList.map((stock) => (
                    <SimpleStockButton key={stock.code} stock={stock} label={decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory)} tone="text-emerald-300" onClick={() => openStock(stock.code)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-orange-500/40 bg-orange-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">今日不要追高</h3>
                  <button onClick={() => setPopup("overheat")} className="rounded-2xl bg-orange-500/20 px-3 py-2 text-xs font-black text-orange-200">看全部</button>
                </div>

                <div className="mt-3 space-y-3">
                  {noChaseList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前追高風險不高。</div>}
                  {noChaseList.map((stock) => (
                    <SimpleStockButton key={stock.code} stock={stock} label="不要追高" tone="text-orange-300" onClick={() => openStock(stock.code)} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "top50" && (
            <div className="space-y-3">
              {sortList(top50).map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "watch" && (
            <div className="space-y-3">
              {watchStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有觀察股票。</div>}
              {watchStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "favorite" && (
            <div className="space-y-3">
              {favoriteStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有自選股。</div>}
              {favoriteStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
              ))}
            </div>
          )}

          {tab === "more" && (
            <div className="grid grid-cols-2 gap-3">
              <ActionCard title="實戰儀表板" sub="盤中一眼判斷" badge="📊" tone="text-emerald-300" onClick={() => setPopup("dashboard")} />
              <ActionCard title="命中率追蹤" sub="驗證訊號準確度" badge={signalRecords.length} tone="text-purple-300" onClick={() => setPopup("signal")} />
              <ActionCard title="資金慢慢增加" sub="個股資金增溫" badge={moneyUpList.length} tone="text-emerald-300" onClick={() => setPopup("moneyUp")} />
              <ActionCard title="資金減少警戒" sub="退潮 / 爆量不漲" badge={moneyDownList.length} tone="text-red-300" onClick={() => setPopup("moneyDown")} />
              <ActionCard title="全個股查詢" sub="不限50強" badge="🔍" tone="text-cyan-300" onClick={() => setPopup("search")} />
              <ActionCard title="產業強弱排行" sub="主線強弱集中看" badge={industryRanking.length} tone="text-yellow-300" onClick={() => setPopup("industry")} />
            </div>
          )}
        </section>
      </div>

      {popup === "dashboard" && (
        <ModalShell title="盤中實戰儀表板" sub="今天能不能做、看誰、不追誰" onClose={() => setPopup("")}>
          <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-4">
            <div className="text-xs font-bold text-emerald-300">今日盤勢</div>
            <div className={`mt-1 text-4xl font-black ${marketModeTone}`}>{marketMode}</div>
            <div className="mt-2 text-sm font-bold text-slate-300">{dashboardReason}</div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DetailRow label="最強主線" value={topIndustry ? `${topIndustry.industry}｜${topIndustry.strength}` : "--"} tone="text-yellow-300" />
            <DetailRow label="第二主線" value={secondIndustry ? secondIndustry.industry : "--"} tone="text-cyan-300" />
            <DetailRow label="第三主線" value={thirdIndustry ? thirdIndustry.industry : "--"} tone="text-purple-300" />
            <DetailRow label="命中率" value={signalSummary.all.done > 0 ? `${signalSummary.all.rate.toFixed(0)}%` : "等待"} tone="text-purple-300" />
            <DetailRow label="持倉最高風險" value={dangerPosition ? stockDisplayName(dangerPosition.stock) : "--"} tone="text-red-300" />
            <DetailRow label="持倉最高獲利" value={bestPosition ? `${stockDisplayName(bestPosition.stock)} ${formatPercent(bestPosition.pnlPercent)}` : "--"} tone="text-red-300" />
          </div>

          <section className="mt-4">
            <div className="text-lg font-black text-emerald-100">今日優先觀察前5檔</div>
            <div className="mt-3 space-y-3">
              {attackList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有明確優先觀察股。</div>}
              {attackList.map((stock) => (
                <SimpleStockButton key={stock.code} stock={stock} label={decisionText(stock, top50, mainIndustries, settings, sneakyHistory, moneyHistory)} tone="text-emerald-300" onClick={() => openStock(stock.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-orange-100">今日不要追高前5檔</div>
            <div className="mt-3 space-y-3">
              {noChaseList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前追高風險不高。</div>}
              {noChaseList.map((stock) => (
                <SimpleStockButton key={stock.code} stock={stock} label="不要追高" tone="text-orange-300" onClick={() => openStock(stock.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-red-100">今日出場警戒前5檔</div>
            <div className="mt-3 space-y-3">
              {exitWatchList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前出場警戒不高。</div>}
              {exitWatchList.map((stock) => (
                <SimpleStockButton key={stock.code} stock={stock} label="出場警戒" tone="text-red-300" onClick={() => openStock(stock.code)} />
              ))}
            </div>
          </section>
        </ModalShell>
      )}

      {popup === "signal" && (
        <ModalShell title="訊號命中率追蹤" sub="看哪些訊號比較準" onClose={() => setPopup("")}>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="整體命中率" value={signalSummary.all.done > 0 ? `${signalSummary.all.rate.toFixed(0)}%` : "等待"} tone="text-purple-300" />
            <DetailRow label="已記錄訊號" value={`${signalSummary.all.total} 筆`} tone="text-white" />
            <DetailRow label="資金增加" value={signalSummary.money.done > 0 ? `${signalSummary.money.rate.toFixed(0)}%` : "等待"} tone="text-emerald-300" />
            <DetailRow label="突然放大" value={signalSummary.bigMoney.done > 0 ? `${signalSummary.bigMoney.rate.toFixed(0)}%` : "等待"} tone="text-emerald-300" />
            <DetailRow label="續航3/3" value={signalSummary.sneaky3.done > 0 ? `${signalSummary.sneaky3.rate.toFixed(0)}%` : "等待"} tone="text-cyan-300" />
            <DetailRow label="主線核心" value={signalSummary.core.done > 0 ? `${signalSummary.core.rate.toFixed(0)}%` : "等待"} tone="text-yellow-300" />
            <DetailRow label="回測買點" value={signalSummary.pullback.done > 0 ? `${signalSummary.pullback.rate.toFixed(0)}%` : "等待"} tone="text-blue-300" />
            <DetailRow label="追高警報" value={signalSummary.chase.done > 0 ? `${signalSummary.chase.rate.toFixed(0)}%` : "等待"} tone="text-orange-300" />
          </div>

          <div className="mt-4 space-y-3">
            {signalRecords.length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前尚未累積訊號紀錄，等 App 更新幾次後會開始出現。</div>}
            {signalRecords.map((record) => (
              <SignalCard key={record.id} record={record} />
            ))}
          </div>
        </ModalShell>
      )}

      {["moneyUp", "moneyDown", "sneaky", "core", "pullback", "overheat", "failed", "amount", "volume", "top50"].includes(popup) && (
        <ModalShell title={popupTitle(popup)} sub={`共 ${popupList(popup).length} 檔｜點股票看詳情`} onClose={() => setPopup("")}>
          <div className="space-y-3">
            {popupList(popup).length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前沒有符合條件的股票。</div>}
            {popupList(popup).map((stock, index) => (
              <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "industry" && (
        <ModalShell title="產業主線強弱排行" sub="依資金、量能、核心、資金增加排序" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {industryRanking.map((item, index) => (
              <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => setIndustryPopup(item.industry)} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "positions" && (
        <ModalShell title="持倉總表風險雷達" sub="你的買進價、損益、停利、停損集中看" onClose={() => setPopup("")}>
          <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow label="持倉檔數" value={`${positionStats.count} 檔`} tone="text-cyan-300" />
              <DetailRow label="持倉總損益" value={formatAmount(positionStats.totalPnl)} tone={positionStats.totalPnl >= 0 ? "text-red-300" : "text-emerald-300"} />
              <DetailRow label="最賺股票" value={bestPosition ? `${stockDisplayName(bestPosition.stock)} ${formatPercent(bestPosition.pnlPercent)}` : "--"} tone="text-red-300" />
              <DetailRow label="最高風險" value={dangerPosition ? `${stockDisplayName(dangerPosition.stock)}｜${dangerPosition.action}` : "--"} tone="text-yellow-300" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {positionRows.length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前還沒有輸入買進價。點股票後輸入「我的買進價」就會出現在這裡。</div>}
            {positionRows.map((row, index) => (
              <button key={row.stock.code} onClick={() => setSelectedCode(row.stock.code)} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500">#{index + 1}　{row.stock.code}｜{row.stock.industry}</div>
                    <div className="mt-1 text-2xl font-black text-white">{stockDisplayName(row.stock)}</div>
                    <div className={`mt-1 text-sm font-black ${riskTone(row.action)}`}>{row.action}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${row.pnlPercent >= 0 ? "text-red-300" : "text-emerald-300"}`}>{formatPercent(row.pnlPercent)}</div>
                    <div className={`text-xs font-black ${row.pnlAmount >= 0 ? "text-red-300" : "text-emerald-300"}`}>{formatAmount(row.pnlAmount)}</div>
                  </div>
                </div>
                <div className={`mt-3 rounded-2xl bg-black/40 p-3 text-sm font-black ${riskTone(row.danger)}`}>{row.danger}</div>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {industryPopup && (
        <ModalShell title={`${industryPopup} 主線個股`} sub="該產業內資金排序" onClose={() => setIndustryPopup("")} z={110}>
          <div className="space-y-3">
            {industrySelectedList.length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前沒有該產業股票。</div>}
            {industrySelectedList.map((stock, index) => (
              <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "search" && (
        <ModalShell title="全個股查詢" sub="輸入代號或中文名稱" onClose={() => setPopup("")}>
          <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="flex gap-2">
              <input value={queryText} onChange={(e) => setQueryText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchAnyStock(); }} placeholder="例如 華邦電、群創、2330" className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none" />
              <button onClick={searchAnyStock} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">{queryLoading ? "查詢中" : "查詢"}</button>
            </div>
            {queryMessage && <div className="mt-3 text-sm font-bold text-yellow-200">{queryMessage}</div>}
          </div>

          <div className="mt-4">
            <div className="text-lg font-black">最近查詢</div>
            <div className="mt-3 space-y-3">
              {searchHistory.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">尚無查詢紀錄。</div>}
              {searchHistory.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} industryStatus={stockIndustryStatus(stock)} position={positions[stock.code]} {...cardProps()} />
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {popup === "settings" && (
        <ModalShell title="設定" sub="主線確認與更新頻率" onClose={() => setPopup("")}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-lg font-black">即時更新頻率</div>
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

            <button onClick={() => saveSettings({ ...settings, stableIndustryLock: !settings.stableIndustryLock })} className={`w-full rounded-2xl py-3 text-lg font-black ${settings.stableIndustryLock ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>
              主流產業鎖定：{settings.stableIndustryLock ? "開啟" : "關閉"}
            </button>

            <button onClick={() => { setSignalRecords([]); localStorage.removeItem(SIGNAL_HISTORY_KEY); }} className="w-full rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
              重置訊號命中率紀錄
            </button>

            <button onClick={() => { setMoneyHistory({}); localStorage.removeItem(MONEY_HISTORY_KEY); }} className="w-full rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200">
              重置資金增減紀錄
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
            <div>資金增加：{moneyUpList.length} 檔</div>
            <div>資金減少警戒：{moneyDownList.length} 檔</div>
            <div>訊號紀錄：{signalRecords.length} 筆</div>
            <div>整體命中率：{signalSummary.all.done > 0 ? `${signalSummary.all.rate.toFixed(0)}%` : "等待"}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={loadStocks} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">立即更新</button>
          </div>
        </ModalShell>
      )}

      {selectedStock && (
        <StockQuickModal
          stock={selectedStock}
          top50={top50.length > 0 ? top50 : [selectedStock]}
          mainIndustries={mainIndustries}
          settings={settings}
          sneakyHistory={sneakyHistory}
          moneyHistory={moneyHistory}
          signalRecords={signalRecords}
          industryStatus={stockIndustryStatus(selectedStock)}
          position={positions[selectedStock.code]}
          onSavePosition={savePosition}
          onDeletePosition={deletePosition}
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
                jumpToContent();
              }}
              className={`rounded-2xl py-2 text-xs font-black ${tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"}`}
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