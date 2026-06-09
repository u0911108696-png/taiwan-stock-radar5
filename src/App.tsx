import { useEffect, useMemo, useRef, useState } from "react";

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
  priceSource?: string;
  stableNote?: string;
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
};

type TabKey = "home" | "top50" | "portfolio" | "favorite" | "more";
type PopupKey = "" | "search" | "alerts" | "settings" | "entry" | "avoid";

type MoneyHistory = {
  code: string;
  amountRaw: number[];
  volumeRaw: number[];
  priceRaw: number[];
};

type HighWinCandidate = {
  stock: Stock;
  score: number;
  level: "明日主攻" | "觀察";
  reasons: string[];
  warning: string;
};

type StealthCandidate = {
  stock: Stock;
  score: number;
  reasons: string[];
  volumeRatio: number;
  moneyLabel: string;
};

type AlertItem = {
  id: string;
  level: "紅燈" | "黃燈" | "綠燈";
  type: string;
  stock: Stock;
  message: string;
  priority: number;
};

const API_URL = "/api/realtime";
const SEARCH_API_URL = "/api/search";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const POSITIONS_KEY = "taiwan-stock-radar-my-positions";
const SEARCH_HISTORY_KEY = "taiwan-stock-radar-search-history";
const SETTINGS_KEY = "taiwan-stock-radar-v120-settings";
const CACHE_KEY = "taiwan-stock-radar-v120-cache";
const MONEY_HISTORY_KEY = "taiwan-stock-radar-v120-money-history";

const defaultSettings: Settings = {
  refreshSeconds: 15,
  hotPercent: 8,
};

const codeToChineseName: Record<string, string> = {
  "2330": "台積電",
  "2303": "聯電",
  "2316": "楠梓電",
  "2344": "華邦電",
  "2317": "鴻海",
  "2454": "聯發科",
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
  "2618": "長榮航",
  "3042": "晶技",
  "2327": "國巨",
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",
  "8299": "半導體",
  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",
  "3481": "面板",
  "2409": "面板",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",
  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",
  "2357": "電腦週邊",
  "2377": "電腦週邊",
  "2308": "電源能源",
  "2301": "電源能源",
  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",
  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",
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
  "2618": "航空",
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

function estimatedAmount(stock: Stock) {
  return Math.max(0, stock.price * stock.volume);
}

function getRise(stock: Stock) {
  return n(stock.changePercent);
}

function getVolumeRatio(stock: any) {
  return n(stock.volumeRatio ?? stock.volRatio ?? stock.volumeRate ?? stock.amountRatio, 1);
}

function getCloseStrength(stock: Stock) {
  if (!stock.price || !stock.highPrice) return 0.95;
  return Math.min(1, stock.price / stock.highPrice);
}

function sourceLabel(source?: string) {
  if (!source) return "資料源 --";
  if (source.includes("TWSE")) return "TWSE即時";
  if (source.includes("Yahoo")) return "Yahoo補價";
  return source;
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "")
    .replace(".TW", "")
    .replace(".TWO", "")
    .replace(/\D/g, "")
    .slice(0, 6);

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
    previousClose > 0 && openPrice > 0 ? ((openPrice - previousClose) / previousClose) * 100 : null;

  const rawName = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);

  return {
    code,
    name: codeToChineseName[code] || rawName,
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
    priceSource: String(raw.priceSource ?? raw.source ?? ""),
    stableNote: String(raw.stableNote ?? ""),
  };
}

function stableMergeStock(next: Stock, old?: Stock): Stock {
  if (!old || !old.price) return { ...next, stableNote: next.stableNote || "正常更新" };
  if (!next.price || next.price <= 0) return { ...old, stableNote: "新價無效，保留上一筆" };

  const gap = Math.abs(next.price - old.price) / old.price;
  if (gap >= 0.12) return { ...old, stableNote: "跳價過大，保留上一筆" };

  return { ...next, stableNote: next.stableNote || "正常更新" };
}

function buildIndustryRanking(list: Stock[]) {
  const map = new Map<string, { industry: string; count: number; amount: number; avgChange: number }>();

  list.forEach((stock) => {
    const old = map.get(stock.industry) || {
      industry: stock.industry,
      count: 0,
      amount: 0,
      avgChange: 0,
    };

    old.count += 1;
    old.amount += estimatedAmount(stock);
    old.avgChange += stock.changePercent;
    map.set(stock.industry, old);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avgChange: item.avgChange / Math.max(1, item.count),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function moneyTrendLabel(stock: Stock, moneyHistory: Record<string, MoneyHistory>) {
  const history = moneyHistory[stock.code];
  if (!history || history.amountRaw.length < 2) return "尚未累積";

  const nowAmount = history.amountRaw[history.amountRaw.length - 1] || 0;
  const prevAmount = history.amountRaw[history.amountRaw.length - 2] || 0;
  const nowVolume = history.volumeRaw[history.volumeRaw.length - 1] || 0;
  const prevVolume = history.volumeRaw[history.volumeRaw.length - 2] || 0;

  const amountChange = prevAmount > 0 ? ((nowAmount - prevAmount) / prevAmount) * 100 : 0;
  const volumeChange = prevVolume > 0 ? ((nowVolume - prevVolume) / prevVolume) * 100 : 0;

  if (amountChange >= 45 && Math.abs(stock.price - stock.openPrice) / Math.max(1, stock.price) < 0.005) {
    return "資金放大但股價不漲";
  }

  if (amountChange >= 45 && stock.price >= stock.openPrice) return "資金突然放大";
  if (amountChange >= 15 && volumeChange >= 10 && stock.price >= stock.openPrice) return "資金慢慢增加";
  if (amountChange <= -15 || volumeChange <= -20) return "資金開始減少";
  return "資金持平";
}

function buildHighWinCandidates(
  stocks: Stock[],
  industryRanking: ReturnType<typeof buildIndustryRanking>,
  moneyHistory: Record<string, MoneyHistory>
): HighWinCandidate[] {
  const mainIndustries = industryRanking.slice(0, 3).map((item) => item.industry);

  return stocks
    .map((stock) => {
      let score = 0;
      const reasons: string[] = [];

      const rise = getRise(stock);
      const volumeRatio = getVolumeRatio(stock);
      const closeStrength = getCloseStrength(stock);
      const amountValue = estimatedAmount(stock);
      const money = moneyTrendLabel(stock, moneyHistory);

      if (stock.price > 0 && stock.price <= 300) {
        score += 20;
        reasons.push("股價300以下");
      } else {
        score -= 100;
        reasons.push("股價超過300剔除");
      }

      if (mainIndustries.includes(stock.industry)) {
        score += 25;
        reasons.push(`主線產業：${stock.industry}`);
      } else {
        reasons.push("非前三主線");
      }

      if (rise >= 1.5 && rise <= 6.5) {
        score += 18;
        reasons.push("漲幅強但未過熱");
      } else if (rise > 0 && rise < 1.5) {
        score += 8;
        reasons.push("小漲轉強");
      } else if (rise > 6.5) {
        score -= 25;
        reasons.push("漲幅偏熱");
      } else {
        score -= 30;
        reasons.push("今日未轉強");
      }

      if (volumeRatio >= 1.1 && volumeRatio <= 3.5) {
        score += 20;
        reasons.push(`量能健康 ${volumeRatio.toFixed(1)}倍`);
      } else if (volumeRatio > 3.5) {
        score -= 10;
        reasons.push("爆量偏熱");
      } else {
        reasons.push("量能普通");
      }

      if (closeStrength >= 0.97) {
        score += 15;
        reasons.push("收盤接近高點");
      } else if (closeStrength >= 0.94) {
        score += 8;
        reasons.push("收盤位置尚可");
      } else {
        score -= 18;
        reasons.push("尾盤轉弱");
      }

      if (amountValue >= 300000000) {
        score += 18;
        reasons.push("成交金額有支撐");
      } else if (amountValue >= 100000000) {
        score += 10;
        reasons.push("成交金額尚可");
      }

      if (stock.price >= stock.openPrice) {
        score += 10;
        reasons.push("守開盤價");
      } else {
        score -= 35;
        reasons.push("跌破開盤價");
      }

      if (stock.price >= stock.previousClose) {
        score += 8;
        reasons.push("守昨收");
      } else {
        score -= 35;
        reasons.push("跌破昨收");
      }

      if (money === "資金慢慢增加") {
        score += 16;
        reasons.push("資金慢慢增加");
      } else if (money === "資金突然放大") {
        score += 8;
        reasons.push("資金突然放大");
      } else if (money === "資金開始減少") {
        score -= 35;
        reasons.push("資金開始減少");
      } else if (money === "資金放大但股價不漲") {
        score -= 30;
        reasons.push("爆量不漲");
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      return {
        stock,
        score: finalScore,
        level: finalScore >= 90 ? "明日主攻" : "觀察",
        reasons: reasons.slice(0, 5),
        warning:
          finalScore >= 90
            ? "明天9:10後確認站穩開盤價與量能延續；開高超過3%不追。"
            : "65分以上列觀察；明天只等9:10確認，不追高。",
      } as HighWinCandidate;
    })
    .filter((item) => item.score >= 65 && item.stock.price > 0 && item.stock.price <= 300)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function buildRejectedCandidates(
  stocks: Stock[],
  highWinList: HighWinCandidate[],
  industryRanking: ReturnType<typeof buildIndustryRanking>,
  moneyHistory: Record<string, MoneyHistory>
): HighWinCandidate[] {
  const picked = new Set(highWinList.map((item) => item.stock.code));
  const mainIndustries = industryRanking.slice(0, 3).map((item) => item.industry);

  return stocks
    .filter((stock) => !picked.has(stock.code))
    .map((stock) => {
      let score = 0;
      const reasons: string[] = [];
      const reject: string[] = [];

      const rise = getRise(stock);
      const volumeRatio = getVolumeRatio(stock);
      const money = moneyTrendLabel(stock, moneyHistory);

      if (stock.price > 300) reject.push("股價超過300");
      else score += 20;

      if (mainIndustries.includes(stock.industry)) score += 20;
      else reject.push("非前三主線");

      if (rise <= 0) reject.push("今日未轉強");
      else if (rise > 6.5) reject.push("漲幅偏熱");
      else score += 18;

      if (volumeRatio < 1.1) reject.push("量能不足");
      else if (volumeRatio > 3.5) reject.push("爆量偏熱");
      else score += 16;

      if (stock.price < stock.openPrice) reject.push("跌破開盤價");
      else score += 10;

      if (stock.price < stock.previousClose) reject.push("跌破昨收");
      else score += 8;

      if (money === "資金開始減少") reject.push("資金開始減少");
      if (money === "資金放大但股價不漲") reject.push("爆量不漲");

      reasons.push(...reject);

      return {
        stock,
        score: Math.max(0, Math.min(100, Math.round(score))),
        level: "觀察",
        reasons: reasons.slice(0, 4),
        warning: reject.slice(0, 3).join("｜") || "條件不足",
      } as HighWinCandidate;
    })
    .filter((item) => item.score < 65 || item.warning)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildStealthMoneyList(
  stocks: Stock[],
  industryRanking: ReturnType<typeof buildIndustryRanking>,
  moneyHistory: Record<string, MoneyHistory>
): StealthCandidate[] {
  const hotIndustries = industryRanking.slice(0, 5).map((item) => item.industry);

  return stocks
    .map((stock) => {
      let score = 0;
      const reasons: string[] = [];

      const rise = getRise(stock);
      const volumeRatio = getVolumeRatio(stock);
      const closeStrength = getCloseStrength(stock);
      const amount = estimatedAmount(stock);
      const money = moneyTrendLabel(stock, moneyHistory);

      if (rise >= 0 && rise <= 4.5) {
        score += 25;
        reasons.push("漲幅不大，還沒過熱");
      } else if (rise > 4.5 && rise <= 6) {
        score += 8;
        reasons.push("已轉強但略熱");
      } else {
        score -= 25;
        reasons.push("漲幅不符合偷偷變多");
      }

      if (volumeRatio >= 1.1 && volumeRatio <= 2.8) {
        score += 25;
        reasons.push(`量比 ${volumeRatio.toFixed(1)}，慢慢增溫`);
      } else if (volumeRatio > 2.8) {
        score -= 10;
        reasons.push("量比過大，可能已發動");
      } else {
        score += 5;
        reasons.push("量能尚在觀察");
      }

      if (amount >= 100000000) {
        score += 18;
        reasons.push("成交金額有支撐");
      }

      if (closeStrength >= 0.95) {
        score += 12;
        reasons.push("收盤位置偏強");
      }

      if (hotIndustries.includes(stock.industry)) {
        score += 15;
        reasons.push(`主線產業：${stock.industry}`);
      }

      if (money === "資金慢慢增加" || money === "資金突然放大") {
        score += 15;
        reasons.push(money);
      }

      return {
        stock,
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons: reasons.slice(0, 4),
        volumeRatio,
        moneyLabel: money,
      };
    })
    .filter((item) => item.score >= 55 && getRise(item.stock) >= 0 && getRise(item.stock) <= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildAlerts(stocks: Stock[], settings: Settings, moneyHistory: Record<string, MoneyHistory>): AlertItem[] {
  return stocks
    .flatMap((stock) => {
      const alerts: AlertItem[] = [];
      const money = moneyTrendLabel(stock, moneyHistory);

      if (stock.price < stock.openPrice) {
        alerts.push({
          id: `${stock.code}-open`,
          level: "紅燈",
          type: "跌破開盤",
          stock,
          message: `跌破開盤價 ${formatPrice(stock.openPrice)}，先不要追。`,
          priority: 95,
        });
      }

      if (stock.changePercent >= settings.hotPercent) {
        alerts.push({
          id: `${stock.code}-hot`,
          level: "黃燈",
          type: "短線過熱",
          stock,
          message: "短線漲幅偏大，開高不要追。",
          priority: 70,
        });
      }

      if (money === "資金開始減少") {
        alerts.push({
          id: `${stock.code}-moneyDown`,
          level: "紅燈",
          type: "資金減少",
          stock,
          message: "資金開始減少，先保守。",
          priority: 88,
        });
      }

      if (money === "資金慢慢增加" || money === "資金突然放大") {
        alerts.push({
          id: `${stock.code}-moneyUp`,
          level: "綠燈",
          type: "資金增加",
          stock,
          message: "資金增溫，可加入觀察。",
          priority: 55,
        });
      }

      return alerts;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 80);
}

function tonePercent(value: number) {
  return value >= 0 ? "text-red-300" : "text-emerald-300";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-cyan-400/25 bg-slate-950/85 p-4 shadow-[0_0_35px_rgba(34,211,238,0.1)] ${className}`}>
      {children}
    </section>
  );
}

function Detail({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-black/35 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}

function StockButton({ stock, label, tone, onClick }: { stock: Stock; label: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl border border-white/10 bg-black/35 p-3 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-lg font-black text-white">{stockDisplayName(stock)}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-200">{sourceLabel(stock.priceSource)}</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">{stock.updatedAt || "--"}</span>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-black ${tone}`}>{label}</div>
          <div className={`mt-1 text-xl font-black ${tonePercent(stock.changePercent)}`}>{formatPercent(stock.changePercent)}</div>
          <div className="text-xs font-black text-slate-400">{formatPrice(stock.price)}</div>
        </div>
      </div>
    </button>
  );
}

function Modal({
  title,
  sub,
  children,
  onClose,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-3 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-cyan-400/30 bg-slate-950 p-4 shadow-[0_0_45px_rgba(34,211,238,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-[2rem] border-b border-cyan-400/20 bg-slate-950/95 px-4 py-3 backdrop-blur">
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

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchHistory, setSearchHistory] = useState<Stock[]>([]);
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [moneyHistory, setMoneyHistory] = useState<Record<string, MoneyHistory>>({});
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [tab, setTab] = useState<TabKey>("home");
  const [popup, setPopup] = useState<PopupKey>("");
  const [selectedCode, setSelectedCode] = useState("");

  const [queryText, setQueryText] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [error, setError] = useState("");
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [source, setSource] = useState("");
  const [autoSeconds, setAutoSeconds] = useState(defaultSettings.refreshSeconds);

  const initedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const industryRanking = useMemo(() => buildIndustryRanking(top50), [top50]);

  const highWinTomorrowList = useMemo(
    () => buildHighWinCandidates(top50, industryRanking, moneyHistory),
    [top50, industryRanking, moneyHistory]
  );

  const highWinRejectedList = useMemo(
    () => buildRejectedCandidates(top50, highWinTomorrowList, industryRanking, moneyHistory),
    [top50, highWinTomorrowList, industryRanking, moneyHistory]
  );

  const stealthMoneyWatchList = useMemo(
    () => buildStealthMoneyList(top50, industryRanking, moneyHistory),
    [top50, industryRanking, moneyHistory]
  );

  const allAlerts = useMemo(() => buildAlerts(top50, settings, moneyHistory), [top50, settings, moneyHistory]);
  const redAlerts = useMemo(() => allAlerts.filter((a) => a.level === "紅燈"), [allAlerts]);
  const yellowAlerts = useMemo(() => allAlerts.filter((a) => a.level === "黃燈"), [allAlerts]);
  const greenAlerts = useMemo(() => allAlerts.filter((a) => a.level === "綠燈"), [allAlerts]);

  const favoriteStocks = useMemo(
    () =>
      favoriteCodes
        .map((code) => stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code))
        .filter(Boolean) as Stock[],
    [favoriteCodes, stocks, searchHistory]
  );

  const selectedStock = useMemo(
    () => stocks.find((s) => s.code === selectedCode) || searchHistory.find((s) => s.code === selectedCode) || null,
    [selectedCode, stocks, searchHistory]
  );

  const marketMode = useMemo(() => {
    if (!top50.length) return "等待資料";
    if (redAlerts.length >= 5) return "風險偏高";
    if (highWinTomorrowList.length >= 3) return "可觀察機會";
    return "只觀察";
  }, [top50, redAlerts, highWinTomorrowList]);

  const mainIndustry = industryRanking[0]?.industry || "尚未明確";
  const totalAmount = top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0);

  function jumpToContent() {
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function saveFavorites(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function savePositions(next: Record<string, Position>) {
    setPositions(next);
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
  }

  function saveSearchHistory(next: Stock[]) {
    const unique = Array.from(new Map(next.map((stock) => [stock.code, { ...stock, name: stockDisplayName(stock) }])).values()).slice(0, 20);
    setSearchHistory(unique);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(unique));
  }

  function saveSettings(next: Settings) {
    setSettings(next);
    setAutoSeconds(next.refreshSeconds);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function updateMoneyHistory(list: Stock[]) {
    const topList = list.slice(0, 50);

    setMoneyHistory((old) => {
      const next = { ...old };

      topList.forEach((stock) => {
        const history = next[stock.code] || {
          code: stock.code,
          amountRaw: [],
          volumeRaw: [],
          priceRaw: [],
        };

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

  async function loadStocks() {
    try {
      setUpdating(true);
      setError("");

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

      const oldMap = new Map(stocks.map((s) => [s.code, s]));

      const normalized = list
        .map((raw: any) => normalizeStock(raw, dataTime))
        .filter((stock: Stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .map((stock: Stock) => stableMergeStock(stock, oldMap.get(stock.code)))
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);

      if (normalized.length === 0) throw new Error("API回傳空資料");

      const successTime = nowText();
      const dataSource = json.source || "api/realtime";

      setStocks(normalized);
      setLastSuccessAt(successTime);
      setSource(dataSource);
      setUsingCache(false);
      updateMoneyHistory(normalized);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          stocks: normalized,
          lastSuccessAt: successTime,
          source: dataSource,
        })
      );
    } catch (err: any) {
      setError(err?.message || "資料更新失敗");
      setUsingCache(true);
    } finally {
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  async function refreshOneStock(codeOrName: string) {
    const q = cleanCode(codeOrName) || codeOrName.trim();
    if (!q) return null;

    try {
      const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(q)}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json();

      if (!json.ok || !json.stock) return null;

      const rawStock = normalizeStock(json.stock, json.stock.updatedAt || json.updatedAtTaiwan || nowText());
      const oldStock = stocks.find((s) => s.code === rawStock.code) || searchHistory.find((s) => s.code === rawStock.code);
      const stock = stableMergeStock(rawStock, oldStock);

      setStocks((old) => {
        const exists = old.some((s) => s.code === stock.code);
        const next = exists ? old.map((s) => (s.code === stock.code ? stock : s)) : [stock, ...old];
        return next.sort((a, b) => b.changePercent - a.changePercent);
      });

      saveSearchHistory([stock, ...searchHistory]);
      setLastSuccessAt(nowText());

      return stock;
    } catch {
      return null;
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

      const stock = await refreshOneStock(q);

      if (!stock) {
        setQueryMessage("查無資料，請確認代號或名稱。");
        return;
      }

      setSelectedCode(stock.code);
      setQueryMessage(`已查到 ${stock.code} ${stockDisplayName(stock)}`);
    } finally {
      setQueryLoading(false);
    }
  }

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    setSettings({ ...defaultSettings, ...savedSettings });
    setAutoSeconds(savedSettings.refreshSeconds || defaultSettings.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setPositions(safeParse(localStorage.getItem(POSITIONS_KEY), {}));
    setSearchHistory(safeParse(localStorage.getItem(SEARCH_HISTORY_KEY), []));
    setMoneyHistory(safeParse(localStorage.getItem(MONEY_HISTORY_KEY), {}));

    const cached = safeParse<any>(localStorage.getItem(CACHE_KEY), null);
    if (cached && Array.isArray(cached.stocks)) {
      setStocks(cached.stocks);
      setUsingCache(true);
      if (cached.lastSuccessAt) setLastSuccessAt(cached.lastSuccessAt);
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
  }, [settings.refreshSeconds, stocks]);

  useEffect(() => {
    if (!selectedCode) return;

    const timer = window.setInterval(() => {
      refreshOneStock(selectedCode);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [selectedCode]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(239,68,68,0.14),transparent_25%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_30%)]" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-36 pt-10">
        <header className="rounded-[2rem] border border-cyan-400/30 bg-slate-950/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[0.25em] text-cyan-300">TW STOCK RADAR v120</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">盤中主線雷達</h1>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
                穩定版｜明日主攻前10｜資金偷偷變多8檔｜先穩定不白畫面
              </p>
            </div>

            <button
              onClick={loadStocks}
              className="shrink-0 rounded-[1.4rem] border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm font-black text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.25)] active:scale-95"
            >
              {updating ? "更新中" : "立即"}
              <br />
              更新
            </button>
          </div>
        </header>

        <Card className="mt-4 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black tracking-[0.2em] text-cyan-300">MAIN DECISION</div>
              <div
                className={
                  marketMode === "風險偏高"
                    ? "mt-2 text-4xl font-black text-red-300"
                    : marketMode === "可觀察機會"
                      ? "mt-2 text-4xl font-black text-emerald-300"
                      : "mt-2 text-4xl font-black text-yellow-300"
                }
              >
                {marketMode}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-right">
              <div className="text-xs font-bold text-slate-500">即時狀態</div>
              <div className="mt-1 text-sm font-black text-cyan-300">
                {updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-cyan-400/20 bg-black/35 p-3">
            <div className="text-xs font-bold text-slate-500">現在動作</div>
            <div className="mt-1 text-2xl font-black text-white">
              {redAlerts.length > 0 ? "先看紅燈風險，再看機會" : "可觀察機會，但不追高"}
            </div>
            <div className="mt-2 text-sm font-bold text-slate-300">
              明日主攻只做觀察，明天 9:10 後確認站穩開盤價與量能再決定。
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Detail label="最強主線" value={mainIndustry} tone="text-yellow-300" />
            <Detail label="明日主攻" value={`${highWinTomorrowList.length} 檔`} tone="text-emerald-300" />
            <Detail label="偷偷變多" value={`${stealthMoneyWatchList.length} 檔`} tone="text-orange-300" />
            <Detail label="成交金額" value={formatAmount(totalAmount)} tone="text-cyan-300" />
          </div>
        </Card>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-red-400/40 bg-red-950/25 p-3 text-left">
            <div className="text-xs font-black text-red-300">RED</div>
            <div className="mt-1 text-4xl font-black text-red-200">{redAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">先避開</div>
          </button>

          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-yellow-400/40 bg-yellow-950/20 p-3 text-left">
            <div className="text-xs font-black text-yellow-300">YELLOW</div>
            <div className="mt-1 text-4xl font-black text-yellow-200">{yellowAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">等確認</div>
          </button>

          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-emerald-400/40 bg-emerald-950/20 p-3 text-left">
            <div className="text-xs font-black text-emerald-300">GREEN</div>
            <div className="mt-1 text-4xl font-black text-emerald-200">{greenAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">可觀察</div>
          </button>
        </section>

        <Card className="mt-4 border-blue-400/30 bg-blue-950/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-blue-100">資料狀態：{error ? error : usingCache ? "使用上次成功資料" : "正常"}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
            </div>
            <div className="text-right text-xs font-bold text-cyan-300">{source || "api/realtime"}</div>
          </div>
        </Card>

        <section className="mt-4 grid grid-cols-4 gap-2">
          <button onClick={() => setPopup("entry")} className="rounded-[1.4rem] border border-emerald-400/20 bg-emerald-950/20 p-3 text-left">
            <div className="text-sm font-black text-emerald-100">進場</div>
            <div className="mt-1 text-xs font-bold text-slate-400">主攻清單</div>
          </button>
          <button onClick={() => setPopup("avoid")} className="rounded-[1.4rem] border border-red-400/20 bg-red-950/20 p-3 text-left">
            <div className="text-sm font-black text-red-100">避開</div>
            <div className="mt-1 text-xs font-bold text-slate-400">紅燈風險</div>
          </button>
          <button onClick={() => setPopup("search")} className="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-950/20 p-3 text-left">
            <div className="text-sm font-black text-cyan-100">查詢</div>
            <div className="mt-1 text-xs font-bold text-slate-400">全個股</div>
          </button>
          <button onClick={() => setPopup("settings")} className="rounded-[1.4rem] border border-purple-400/20 bg-purple-950/20 p-3 text-left">
            <div className="text-sm font-black text-purple-100">設定</div>
            <div className="mt-1 text-xs font-bold text-slate-400">更新頻率</div>
          </button>
        </section>

        <section ref={contentRef} className="mt-4 scroll-mt-4">
          {tab === "home" && (
            <div className="space-y-4">
              <Card className="border-emerald-400/30 bg-emerald-500/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-emerald-300">HIGH WIN TOMORROW</div>
                    <div className="text-2xl font-black text-white">明日主攻前10名</div>
                    <div className="mt-1 text-xs font-bold text-slate-300">v120 穩定版：先移除昨日續航，避免白畫面。</div>
                  </div>

                  <div className="rounded-2xl bg-black/40 px-3 py-2 text-right">
                    <div className="text-xs font-black text-slate-400">符合</div>
                    <div className="text-2xl font-black text-emerald-200">{highWinTomorrowList.length}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {highWinTomorrowList.length === 0 && (
                    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm font-black text-yellow-200">
                      明日不硬做：目前沒有達到65分以上的高勝率候選。
                    </div>
                  )}

                  {highWinTomorrowList.length === 0 && highWinRejectedList.length > 0 && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3">
                      <div className="text-sm font-black text-red-200">剔除原因</div>
                      <div className="mt-2 space-y-2">
                        {highWinRejectedList.slice(0, 5).map((item) => (
                          <button key={item.stock.code} onClick={() => setSelectedCode(item.stock.code)} className="w-full rounded-xl bg-black/30 px-3 py-2 text-left">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-base font-black text-white">
                                  {item.stock.code} {stockDisplayName(item.stock)}
                                </div>
                                <div className="mt-1 text-xs font-bold text-red-200">{item.warning}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-400">原始分</div>
                                <div className="text-xl font-black text-yellow-200">{item.score}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {highWinTomorrowList.map((item, index) => (
                    <button key={item.stock.code} onClick={() => setSelectedCode(item.stock.code)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-400">
                            #{index + 1}｜{item.level}
                          </div>
                          <div className="text-lg font-black text-white">
                            {item.stock.code} {stockDisplayName(item.stock)}
                          </div>
                          <div className="mt-1 text-xs font-bold text-emerald-200">
                            {item.stock.industry}｜股價 {formatPrice(item.stock.price)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-slate-400">勝率分</div>
                          <div className={item.score >= 90 ? "text-2xl font-black text-red-300" : "text-2xl font-black text-yellow-200"}>{item.score}</div>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {item.reasons.slice(0, 4).map((reason) => (
                          <div key={reason} className="text-xs font-bold text-slate-300">
                            ・{reason}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 rounded-xl bg-yellow-400/10 p-2 text-xs font-black text-yellow-200">{item.warning}</div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="border-orange-400/30 bg-orange-500/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-orange-300">STEALTH MONEY</div>
                    <div className="text-2xl font-black text-white">資金偷偷變多</div>
                    <div className="mt-1 text-xs font-bold text-slate-300">v120 改成直式清單，8檔全部看得到。</div>
                  </div>

                  <div className="rounded-xl bg-black/40 px-3 py-2 text-right">
                    <div className="text-xs font-black text-slate-400">偷偷</div>
                    <div className="text-2xl font-black text-orange-200">{stealthMoneyWatchList.length}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {stealthMoneyWatchList.length === 0 && (
                    <div className="rounded-xl bg-black/30 p-3 text-sm font-bold text-slate-400">目前沒有明顯資金偷偷變多的個股。</div>
                  )}

                  {stealthMoneyWatchList.slice(0, 8).map((item, index) => (
                    <button key={item.stock.code} onClick={() => setSelectedCode(item.stock.code)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-400">#{index + 1}｜偷增</div>
                          <div className="mt-1 text-lg font-black text-white">
                            {item.stock.code} {stockDisplayName(item.stock)}
                          </div>
                          <div className="mt-1 text-xs font-bold text-orange-200">
                            {item.stock.industry}｜{item.moneyLabel}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-slate-400">分數</div>
                          <div className="text-2xl font-black text-orange-200">{item.score}</div>
                          <div className="text-xs font-bold text-slate-400">量比 {item.volumeRatio.toFixed(1)}</div>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {item.reasons.map((reason) => (
                          <div key={reason} className="text-xs font-bold text-slate-300">
                            ・{reason}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="border-cyan-400/30 bg-cyan-500/10">
                <div className="text-xs font-black text-cyan-300">MAIN INDUSTRY</div>
                <div className="mt-1 text-2xl font-black text-white">資金主線產業</div>

                <div className="mt-3 space-y-2">
                  {industryRanking.length === 0 && <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">尚未有產業資料。</div>}

                  {industryRanking.map((item, index) => (
                    <div key={item.industry} className="flex items-center justify-between rounded-2xl bg-black/30 p-3">
                      <div>
                        <div className="text-sm font-black text-white">
                          #{index + 1} {item.industry}
                        </div>
                        <div className="text-xs font-bold text-slate-400">{item.count}檔｜均漲 {formatPercent(item.avgChange)}</div>
                      </div>
                      <div className="text-right text-sm font-black text-cyan-200">{formatAmount(item.amount)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "top50" && (
            <div className="space-y-3">
              {top50.map((stock, index) => (
                <StockButton
                  key={stock.code}
                  stock={stock}
                  label={`#${index + 1}`}
                  tone={stock.changePercent >= 0 ? "text-red-300" : "text-emerald-300"}
                  onClick={() => setSelectedCode(stock.code)}
                />
              ))}
            </div>
          )}

          {tab === "portfolio" && (
            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30">
                <div className="text-xs font-black tracking-[0.2em] text-cyan-300">MY PORTFOLIO</div>
                <div className="mt-2 text-3xl font-black text-white">我的庫存股</div>
                <div className="mt-2 text-sm font-bold text-slate-400">點個股輸入買進價與張數，這裡會顯示即時損益。</div>
              </Card>

              <div className="space-y-3">
                {Object.values(positions).length === 0 && (
                  <div className="rounded-[1.6rem] border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有庫存股。</div>
                )}

                {Object.values(positions).map((position) => {
                  const stock = stocks.find((s) => s.code === position.code) || searchHistory.find((s) => s.code === position.code);
                  if (!stock) return null;

                  const sharesUnit = position.shares * 1000;
                  const cost = position.buyPrice * sharesUnit;
                  const marketValue = stock.price * sharesUnit;
                  const pnl = marketValue - cost;
                  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

                  return (
                    <button key={position.code} onClick={() => setSelectedCode(position.code)} className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-orange-300">現股</div>
                          <div className="mt-1 text-xl font-black text-white">{stockDisplayName(stock)}</div>
                          <div className="mt-1 text-xs font-bold text-slate-400">{stock.code}｜成本 {formatPrice(position.buyPrice)}｜{position.shares}張</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-black ${pnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>{formatAmount(pnl)}</div>
                          <div className={`text-xs font-black ${pnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>{formatPercent(pnlPercent)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "favorite" && (
            <div className="space-y-3">
              {favoriteStocks.length === 0 && <div className="rounded-[1.6rem] border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有自選股。</div>}

              {favoriteStocks.map((stock) => (
                <StockButton key={stock.code} stock={stock} label="自選" tone="text-yellow-300" onClick={() => setSelectedCode(stock.code)} />
              ))}
            </div>
          )}

          {tab === "more" && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPopup("alerts")} className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-left">
                <div className="text-lg font-black text-white">警報中心</div>
                <div className="mt-1 text-xs font-bold text-slate-400">紅黃綠燈</div>
              </button>
              <button onClick={() => setPopup("entry")} className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-left">
                <div className="text-lg font-black text-white">明日主攻</div>
                <div className="mt-1 text-xs font-bold text-slate-400">前10名</div>
              </button>
              <button onClick={() => setPopup("avoid")} className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-left">
                <div className="text-lg font-black text-white">不要碰</div>
                <div className="mt-1 text-xs font-bold text-slate-400">先避開</div>
              </button>
              <button onClick={() => setPopup("search")} className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-left">
                <div className="text-lg font-black text-white">全個股查詢</div>
                <div className="mt-1 text-xs font-bold text-slate-400">代號 / 中文</div>
              </button>
              <button onClick={() => setPopup("settings")} className="rounded-3xl border border-purple-400/30 bg-purple-500/10 p-4 text-left">
                <div className="text-lg font-black text-white">設定</div>
                <div className="mt-1 text-xs font-bold text-slate-400">更新頻率</div>
              </button>
            </div>
          )}
        </section>
      </div>

      {popup === "entry" && (
        <Modal title="明日主攻前10名" sub="v120穩定版" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {highWinTomorrowList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有明日主攻候選。</div>}
            {highWinTomorrowList.map((item, index) => (
              <StockButton key={item.stock.code} stock={item.stock} label={`#${index + 1}｜${item.score}分`} tone="text-emerald-300" onClick={() => setSelectedCode(item.stock.code)} />
            ))}
          </div>
        </Modal>
      )}

      {popup === "avoid" && (
        <Modal title="不要碰清單" sub="紅燈風險優先避開" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {redAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有明顯紅燈風險。</div>}
            {redAlerts.map((alert) => (
              <StockButton key={alert.id} stock={alert.stock} label={alert.type} tone="text-red-300" onClick={() => setSelectedCode(alert.stock.code)} />
            ))}
          </div>
        </Modal>
      )}

      {popup === "alerts" && (
        <Modal title="盤中警報中心" sub="紅燈先處理，綠燈只觀察" onClose={() => setPopup("")}>
          <div className="grid grid-cols-3 gap-2">
            <Detail label="紅燈" value={redAlerts.length} tone="text-red-300" />
            <Detail label="黃燈" value={yellowAlerts.length} tone="text-yellow-300" />
            <Detail label="綠燈" value={greenAlerts.length} tone="text-emerald-300" />
          </div>

          <div className="mt-4 space-y-3">
            {allAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有警報。</div>}
            {allAlerts.map((alert) => (
              <button key={alert.id} onClick={() => setSelectedCode(alert.stock.code)} className="w-full rounded-2xl border border-white/10 bg-black/35 p-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className={
                        alert.level === "紅燈"
                          ? "text-sm font-black text-red-300"
                          : alert.level === "黃燈"
                            ? "text-sm font-black text-yellow-300"
                            : "text-sm font-black text-emerald-300"
                      }
                    >
                      {alert.level}｜{alert.type}
                    </div>
                    <div className="mt-1 text-lg font-black text-white">
                      {alert.stock.code} {stockDisplayName(alert.stock)}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-300">{alert.message}</div>
                  </div>
                  <div className={`text-right text-lg font-black ${tonePercent(alert.stock.changePercent)}`}>{formatPercent(alert.stock.changePercent)}</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {popup === "search" && (
        <Modal title="全個股查詢" sub="輸入代號或中文名稱" onClose={() => setPopup("")}>
          <div className="rounded-[1.8rem] border border-cyan-500/40 bg-cyan-950/20 p-4">
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

          <div className="mt-4 space-y-3">
            {searchHistory.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">尚無查詢紀錄。</div>}
            {searchHistory.map((stock) => (
              <StockButton key={stock.code} stock={stock} label="查詢紀錄" tone="text-cyan-300" onClick={() => setSelectedCode(stock.code)} />
            ))}
          </div>
        </Modal>
      )}

      {popup === "settings" && (
        <Modal title="設定" sub="更新頻率" onClose={() => setPopup("")}>
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
                  <button
                    key={String(value)}
                    onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value) })}
                    className={
                      settings.refreshSeconds === Number(value)
                        ? "rounded-2xl bg-cyan-500 py-3 text-sm font-black text-white"
                        : "rounded-2xl bg-black/30 py-3 text-sm font-black text-slate-300"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setMoneyHistory({});
                localStorage.removeItem(MONEY_HISTORY_KEY);
              }}
              className="w-full rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200"
            >
              重置資金增減紀錄
            </button>
          </div>
        </Modal>
      )}

      {selectedStock && (
        <Modal title={stockDisplayName(selectedStock)} sub={`${selectedStock.code}｜${selectedStock.industry}`} onClose={() => setSelectedCode("")}>
          <div className="rounded-[1.8rem] border border-cyan-400/30 bg-gradient-to-br from-slate-950 to-cyan-950/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-cyan-300">REALTIME PRICE</div>
                <div className="mt-1 text-4xl font-black text-white">{formatPrice(selectedStock.price)}</div>
              </div>

              <div className="text-right">
                <div className={`text-3xl font-black ${tonePercent(selectedStock.changePercent)}`}>{formatPercent(selectedStock.changePercent)}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">{selectedStock.updatedAt || lastSuccessAt || "--"}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Detail label="開盤價" value={formatPrice(selectedStock.openPrice)} tone="text-cyan-300" />
              <Detail label="昨收" value={formatPrice(selectedStock.previousClose)} tone="text-slate-300" />
              <Detail label="最高" value={formatPrice(selectedStock.highPrice)} tone="text-red-300" />
              <Detail label="最低" value={formatPrice(selectedStock.lowPrice)} tone="text-emerald-300" />
              <Detail label="成交量" value={formatAmount(selectedStock.volume)} tone="text-yellow-300" />
              <Detail label="成交金額" value={formatAmount(estimatedAmount(selectedStock))} tone="text-cyan-300" />
            </div>
          </div>

          <div className="mt-3 rounded-[1.6rem] border border-emerald-500/40 bg-emerald-950/20 p-4">
            <div className="text-lg font-black text-emerald-100">資金狀態</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">{moneyTrendLabel(selectedStock, moneyHistory)}</div>
            <div className="mt-2 text-sm font-bold text-slate-300">
              提醒：資金流入只是觀察條件，不等於立刻買；明天 9:10 後確認。
            </div>
          </div>

          <PositionEditor
            stock={selectedStock}
            position={positions[selectedStock.code]}
            onSave={(position) => {
              const next = { ...positions, [position.code]: position };
              savePositions(next);
              saveFavorites([...favoriteCodes, position.code]);
            }}
            onDelete={(code) => {
              const next = { ...positions };
              delete next[code];
              savePositions(next);
            }}
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                favoriteCodes.includes(selectedStock.code)
                  ? saveFavorites(favoriteCodes.filter((code) => code !== selectedStock.code))
                  : saveFavorites([...favoriteCodes, selectedStock.code])
              }
              className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200"
            >
              {favoriteCodes.includes(selectedStock.code) ? "★ 移除自選" : "☆ 加入自選"}
            </button>

            <button onClick={() => refreshOneStock(selectedStock.code)} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
              更新這檔
            </button>
          </div>
        </Modal>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-400/20 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "首頁"],
            ["top50", "50強"],
            ["portfolio", "庫存"],
            ["favorite", "自選"],
            ["more", "更多"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setPopup("");
                setTab(key as TabKey);
                jumpToContent();
              }}
              className={
                tab === key
                  ? "rounded-2xl border border-cyan-400/30 bg-cyan-500/15 py-3 text-xs font-black text-cyan-200"
                  : "rounded-2xl py-3 text-xs font-black text-slate-400"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function PositionEditor({
  stock,
  position,
  onSave,
  onDelete,
}: {
  stock: Stock;
  position?: Position;
  onSave: (position: Position) => void;
  onDelete: (code: string) => void;
}) {
  const [buyPriceText, setBuyPriceText] = useState(position?.buyPrice ? String(position.buyPrice) : "");
  const [sharesText, setSharesText] = useState(position?.shares ? String(position.shares) : "");
  const [noteText, setNoteText] = useState(position?.note || "");

  function save() {
    const buyPrice = Number(buyPriceText);
    const shares = Number(sharesText || 0);

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      alert("請輸入正確買進價");
      return;
    }

    onSave({
      code: stock.code,
      buyPrice,
      shares: Number.isFinite(shares) && shares > 0 ? shares : 0,
      note: noteText,
    });
  }

  return (
    <section className="mt-3 rounded-[1.6rem] border border-cyan-500/40 bg-cyan-950/20 p-4">
      <div className="text-lg font-black text-cyan-100">輸入我的持倉</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          value={buyPriceText}
          onChange={(e) => setBuyPriceText(e.target.value)}
          placeholder="我的買進價"
          inputMode="decimal"
          className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none"
        />
        <input
          value={sharesText}
          onChange={(e) => setSharesText(e.target.value)}
          placeholder="張數，可不填"
          inputMode="decimal"
          className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none"
        />
      </div>

      <input
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="備註，可不填"
        className="mt-2 w-full rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-bold text-white outline-none"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={save} className="rounded-2xl bg-cyan-500 py-3 text-sm font-black text-white">
          儲存我的買點
        </button>
        <button onClick={() => onDelete(stock.code)} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
          刪除買點
        </button>
      </div>
    </section>
  );
}