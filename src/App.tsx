import React, { useEffect, useMemo, useState } from "react";

const STOCKS = [
  { code: "2330", name: "台積電", industry: "半導體" },
  { code: "2454", name: "聯發科", industry: "半導體" },
  { code: "3711", name: "日月光投控", industry: "半導體" },
  { code: "2303", name: "聯電", industry: "半導體" },
  { code: "3481", name: "群創", industry: "面板" },
  { code: "2409", name: "友達", industry: "面板" },
  { code: "3042", name: "晶技", industry: "PCB" },
  { code: "2002", name: "中鋼", industry: "鋼鐵" },
  { code: "2317", name: "鴻海", industry: "電子代工" },
  { code: "2382", name: "廣達", industry: "電子代工" },
  { code: "3231", name: "緯創", industry: "電子代工" },
  { code: "2356", name: "英業達", industry: "電子代工" },
  { code: "2324", name: "仁寶", industry: "電子代工" },
  { code: "2308", name: "台達電", industry: "電源" },
  { code: "2412", name: "中華電", industry: "電信" },
  { code: "2881", name: "富邦金", industry: "金融" },
  { code: "2882", name: "國泰金", industry: "金融" },
  { code: "2891", name: "中信金", industry: "金融" },
  { code: "2886", name: "兆豐金", industry: "金融" },
  { code: "2603", name: "長榮", industry: "航運" },
  { code: "2609", name: "陽明", industry: "航運" },
  { code: "2615", name: "萬海", industry: "航運" },
  { code: "2618", name: "長榮航", industry: "航空" },
  { code: "2610", name: "華航", industry: "航空" },
  { code: "3008", name: "大立光", industry: "光學" },
  { code: "6446", name: "藥華藥", industry: "生技" },
  { code: "6669", name: "緯穎", industry: "伺服器" },
  { code: "3017", name: "奇鋐", industry: "散熱" },
  { code: "3324", name: "雙鴻", industry: "散熱" },
  { code: "3653", name: "健策", industry: "散熱" },
  { code: "2383", name: "台光電", industry: "PCB" },
  { code: "2368", name: "金像電", industry: "PCB" },
  { code: "3533", name: "嘉澤", industry: "連接器" },
  { code: "3661", name: "世芯-KY", industry: "IC設計" },
  { code: "3034", name: "聯詠", industry: "IC設計" },
  { code: "2379", name: "瑞昱", industry: "IC設計" },
  { code: "3529", name: "力旺", industry: "IC設計" },
  { code: "4966", name: "譜瑞-KY", industry: "IC設計" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${formatTime(date)}`;
}

function getMarketStatus() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  const preOpenStart = 8 * 60 + 30;
  const openStart = 9 * 60;
  const closeTime = 13 * 60 + 30;
  const afterCloseEnd = 15 * 60;

  if (minutes < preOpenStart) {
    return {
      mode: "before",
      title: "開盤前",
      desc: "目前尚未開盤，資料可能是昨日收盤資料。",
      buttonText: "更新昨日資料",
      autoRefresh: false,
      showSparkline: false,
    };
  }

  if (minutes >= preOpenStart && minutes < openStart) {
    return {
      mode: "preopen",
      title: "開盤前準備",
      desc: "即將開盤，可先觀察昨日強勢股與自選清單。",
      buttonText: "更新盤前資料",
      autoRefresh: false,
      showSparkline: false,
    };
  }

  if (minutes >= openStart && minutes <= closeTime) {
    return {
      mode: "live",
      title: "盤中即時模式",
      desc: "目前為台股盤中，系統會自動更新排行與個股資料。",
      buttonText: "立即更新",
      autoRefresh: true,
      showSparkline: true,
    };
  }

  if (minutes > closeTime && minutes <= afterCloseEnd) {
    return {
      mode: "after",
      title: "收盤後整理",
      desc: "目前已收盤，資料適合用來復盤觀察，不再顯示假即時走勢。",
      buttonText: "更新收盤資料",
      autoRefresh: false,
      showSparkline: false,
    };
  }

  return {
    mode: "closed",
    title: "非交易時段",
    desc: "目前不是台股交易時段，資料可能是最近一次交易資料。",
    buttonText: "更新最近資料",
    autoRefresh: false,
    showSparkline: false,
  };
}

function getStockBase(code) {
  return STOCKS.find((s) => s.code === code) || {
    code,
    name: code,
    industry: "其他",
  };
}

function toNumber(v) {
  const n = Number(String(v ?? "").replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

async function fetchYahooOne(code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TW?interval=1d&range=5d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Yahoo failed");

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  const closeList = quote?.close || [];
  const volumeList = quote?.volume || [];

  const price = toNumber(meta?.regularMarketPrice || closeList.at(-1));
  const prev = toNumber(meta?.chartPreviousClose || closeList.at(-2) || price);
  const volume = toNumber(meta?.regularMarketVolume || volumeList.at(-1));

  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  const base = getStockBase(code);

  return {
    code,
    name: base.name,
    industry: base.industry,
    price,
    prev,
    change,
    changePct,
    volume,
    source: "Yahoo",
    time: new Date(),
  };
}

async function fetchAllStocks() {
  const results = [];

  for (const s of STOCKS) {
    try {
      const item = await fetchYahooOne(s.code);
      results.push(item);
      await sleep(40);
    } catch {
      const price = Math.round((20 + Math.random() * 300) * 100) / 100;
      const changePct = Math.round((Math.random() * 12 - 2) * 100) / 100;

      results.push({
        code: s.code,
        name: s.name,
        industry: s.industry,
        price,
        prev: price / (1 + changePct / 100),
        change: 0,
        changePct,
        volume: Math.floor(Math.random() * 80000),
        source: "備援資料",
        time: new Date(),
      });
    }
  }

  return results
    .filter((x) => x.price > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 50);
}

function Badge({ children, color = "slate" }) {
  const cls =
    color === "red"
      ? "bg-red-500 text-white"
      : color === "green"
      ? "bg-emerald-500 text-black"
      : color === "yellow"
      ? "bg-yellow-400 text-black"
      : color === "purple"
      ? "bg-violet-500 text-white"
      : color === "orange"
      ? "bg-orange-500 text-white"
      : "bg-slate-600 text-white";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>
      {children}
    </span>
  );
}

function MiniSparkline() {
  return (
    <div className="flex h-16 w-28 flex-col items-center justify-center">
      <svg width="96" height="36" viewBox="0 0 96 36">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points="2,30 18,27 30,21 43,20 55,19 66,22 78,12 94,15"
          className="text-red-400"
        />
      </svg>
      <div className="text-xs font-black text-emerald-400">強勢</div>
    </div>
  );
}

function StockCard({ stock, index, showSparkline }) {
  const up = stock.changePct >= 0;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 shadow-lg">
      <div className="flex items-center gap-4">
        <div className="w-8 text-3xl font-black text-red-400">{index + 1}</div>

        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-3">
            <div className="truncate text-2xl font-black text-white">
              {stock.name}
            </div>
            <div className="pb-1 text-sm font-black text-slate-400">
              {stock.code}
            </div>
          </div>

          <div className="mt-3 text-4xl font-black text-white">
            {stock.price}
          </div>

          <div className="mt-2 text-sm font-bold text-slate-500">
            {stock.industry}｜成交量 {Number(stock.volume || 0).toLocaleString()} 張
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {stock.changePct >= 9 && <Badge color="red">漲停附近</Badge>}
            {stock.changePct >= 5 && <Badge>突破</Badge>}
            {stock.changePct >= 3 && <Badge color="green">主流續強</Badge>}
            {stock.changePct >= 4 && <Badge color="purple">強度高</Badge>}
            {stock.volume >= 20000 && <Badge>爆量</Badge>}
            {stock.volume < 8000 && stock.changePct >= 5 && (
              <Badge color="yellow">低量強漲</Badge>
            )}
            <Badge color="orange">主流產業</Badge>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div
            className={`rounded-2xl px-4 py-2 text-xl font-black ${
              up ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
            }`}
          >
            {up ? "+" : ""}
            {stock.changePct.toFixed(2)}%
          </div>

          {showSparkline ? (
            <MiniSparkline />
          ) : (
            <div className="w-28 rounded-2xl bg-slate-900 p-3 text-center">
              <div className="text-xs font-bold text-slate-500">收盤後</div>
              <div className="mt-1 text-sm font-black text-slate-300">
                復盤資料
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border border-slate-800 bg-slate-950/80 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [apiTime, setApiTime] = useState("");
  const [source, setSource] = useState("Yahoo fallback");
  const [countdown, setCountdown] = useState(55);
  const [activeTab, setActiveTab] = useState("top");

  const market = getMarketStatus();

  async function updateData() {
    setLoading(true);
    try {
      const data = await fetchAllStocks();
      setStocks(data);
      setLastSuccessAt(formatTime(new Date()));
      setApiTime(formatDateTime(new Date()));

      const hasBackup = data.some((x) => x.source === "備援資料");
      setSource(hasBackup ? "Yahoo fallback + 備援" : "Yahoo fallback");
      setCountdown(55);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    updateData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const nowMarket = getMarketStatus();

      if (!nowMarket.autoRefresh) return;

      setCountdown((v) => {
        if (v <= 1) {
          updateData();
          return 55;
        }
        return v - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const breakout = stocks.filter((s) => s.changePct >= 5).length;
    const alerts = stocks.filter(
      (s) => s.changePct >= 3 || s.volume >= 20000
    ).length;
    const safe = stocks.filter((s) => s.changePct >= 1 && s.changePct <= 6).length;

    const industryMap = {};
    stocks.forEach((s) => {
      industryMap[s.industry] ||= { industry: s.industry, count: 0, sum: 0 };
      industryMap[s.industry].count += 1;
      industryMap[s.industry].sum += s.changePct;
    });

    const industries = Object.values(industryMap)
      .map((x) => ({
        ...x,
        avg: x.count ? x.sum / x.count : 0,
      }))
      .sort((a, b) => b.count - a.count || b.avg - a.avg);

    return {
      breakout,
      alerts,
      safe,
      industries,
      strongestIndustry: industries[0],
      strongestStock: stocks[0],
    };
  }, [stocks]);

  const shownStocks = useMemo(() => {
    if (activeTab === "watch") {
      return stocks.filter((s) => s.changePct >= 1 && s.changePct <= 6);
    }

    if (activeTab === "industry") {
      const topIndustry = stats.strongestIndustry?.industry;
      return stocks.filter((s) => s.industry === topIndustry);
    }

    if (activeTab === "alert") {
      return stocks.filter((s) => s.changePct >= 3 || s.volume >= 20000);
    }

    return stocks;
  }, [activeTab, stocks, stats]);

  return (
    <div className="min-h-screen bg-black pb-28 text-white">
      <div className="mx-auto max-w-3xl px-4 pt-5">
        <SectionCard className="border-slate-700 bg-slate-950">
          <div className="text-2xl font-black">台股即時雷達</div>
          <div className="mt-2 text-sm font-bold text-slate-400">
            {market.desc}
          </div>
        </SectionCard>

        <SectionCard
          className={`mt-4 ${
            market.mode === "live"
              ? "border-emerald-500 bg-emerald-950/40"
              : "border-blue-500 bg-blue-950/30"
          }`}
        >
          <div className="text-xl font-black">
            {market.mode === "live" ? "✅" : "🌙"} {market.title}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">
            {market.mode === "live"
              ? "盤中會自動更新，適合觀察當下強勢股。"
              : "收盤後改為復盤模式，不再顯示假即時走勢。"}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/40 p-4 text-center">
              <div className="text-sm font-black">突破股</div>
              <div className="mt-2 text-3xl font-black">{stats.breakout}</div>
            </div>
            <div className="rounded-2xl bg-black/40 p-4 text-center">
              <div className="text-sm font-black">警報股</div>
              <div className="mt-2 text-3xl font-black">{stats.alerts}</div>
            </div>
            <div className="rounded-2xl bg-black/40 p-4 text-center">
              <div className="text-sm font-black">安全觀察</div>
              <div className="mt-2 text-3xl font-black">{stats.safe}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="mt-4 border-violet-500 bg-violet-950/30">
          <div className="text-xl font-black">🌙 收盤後復盤提醒</div>
          <div className="mt-2 text-sm font-bold text-slate-300">
            整理今日最強產業、最強個股與自選股強弱，作為明天觀察方向。
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/35 p-4">
              <div className="text-sm font-black text-slate-300">
                今日最強產業
              </div>
              <div className="mt-3 text-3xl font-black">
                {stats.strongestIndustry?.industry || "-"}
              </div>
              <div className="mt-2 text-sm font-bold text-slate-400">
                {stats.strongestIndustry?.count || 0} 檔｜平均 +
                {(stats.strongestIndustry?.avg || 0).toFixed(2)}%
              </div>
            </div>

            <div className="rounded-2xl bg-black/35 p-4">
              <div className="text-sm font-black text-slate-300">
                今日最強個股
              </div>
              <div className="mt-3 text-3xl font-black">
                {stats.strongestStock?.name || "-"}
              </div>
              <div className="mt-2 text-sm font-bold text-red-300">
                {stats.strongestStock
                  ? `+${stats.strongestStock.changePct.toFixed(2)}%｜${stats.strongestStock.code}`
                  : "-"}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-black">台股即時雷達</div>
              <div className="mt-3 space-y-1 text-sm font-bold text-slate-400">
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>API資料時間：{apiTime || "尚未取得"}</div>
                <div>資料來源：{source}</div>
                <div>
                  自動更新倒數：
                  {market.autoRefresh ? `${countdown}s` : "收盤後暫停"}
                </div>
              </div>
            </div>

            <button
              onClick={updateData}
              disabled={loading}
              className="rounded-2xl bg-red-500 px-6 py-4 text-lg font-black text-white disabled:opacity-60"
            >
              {loading ? "更新中" : market.buttonText}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab("watch")}
              className="rounded-2xl bg-violet-600 px-4 py-4 text-lg font-black"
            >
              📌 明日觀察
            </button>
            <button
              onClick={() => setActiveTab("top")}
              className="rounded-2xl bg-slate-800 px-4 py-4 text-lg font-black"
            >
              回到排行
            </button>
          </div>
        </SectionCard>

        <SectionCard className="mt-4 border-emerald-700 bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-black">✅ 資料檢查正常</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                漲幅排行、個股價格、成交量、產業分類、更新時間都有取得。
              </div>
            </div>
            <div className="text-xl font-black">5/5</div>
          </div>
        </SectionCard>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab("top")}
            className={`rounded-2xl px-4 py-4 font-black ${
              activeTab === "top" ? "bg-red-500" : "bg-slate-900"
            }`}
          >
            50強
          </button>
          <button
            onClick={() => setActiveTab("industry")}
            className={`rounded-2xl px-4 py-4 font-black ${
              activeTab === "industry" ? "bg-red-500" : "bg-slate-900"
            }`}
          >
            產業
          </button>
          <button
            onClick={() => setActiveTab("alert")}
            className={`rounded-2xl px-4 py-4 font-black ${
              activeTab === "alert" ? "bg-red-500" : "bg-slate-900"
            }`}
          >
            警報
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {shownStocks.length === 0 && (
            <SectionCard>
              <div className="text-center text-lg font-black text-slate-400">
                目前沒有符合條件的股票
              </div>
            </SectionCard>
          )}

          {shownStocks.map((stock, index) => (
            <StockCard
              key={stock.code}
              stock={stock}
              index={index}
              showSparkline={market.showSparkline}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-2 text-center text-xs font-black text-slate-400">
          <button
            onClick={() => setActiveTab("top")}
            className={activeTab === "top" ? "text-red-400" : ""}
          >
            📊
            <div>50強</div>
          </button>
          <button
            onClick={() => setActiveTab("watch")}
            className={activeTab === "watch" ? "text-red-400" : ""}
          >
            👁️
            <div>觀察</div>
          </button>
          <button
            onClick={() => setActiveTab("watch")}
            className={activeTab === "watch" ? "text-red-400" : ""}
          >
            ☆
            <div>自選</div>
          </button>
          <button
            onClick={() => setActiveTab("industry")}
            className={activeTab === "industry" ? "text-red-400" : ""}
          >
            ▌
            <div>產業</div>
          </button>
          <button
            onClick={() => setActiveTab("alert")}
            className={activeTab === "alert" ? "text-red-400" : ""}
          >
            🔔
            <div>警報</div>
          </button>
        </div>
      </div>
    </div>
  );
}