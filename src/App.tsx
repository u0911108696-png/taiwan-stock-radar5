import { useEffect, useMemo, useState } from "react";
import "./App.css";

type StockItem = {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  openPrice?: number;
  previousClose?: number;
  openPremiumPercent?: number;
  industry?: string;
  turnoverRate?: number;
  volumeRatio?: number;
  floatMarketCapYi?: number;
};

type UpdateStatus = "idle" | "loading" | "success" | "error";

const AUTO_REFRESH_SECONDS = 30;

function formatTime() {
  return new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function safeNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: any, digits = 2) {
  const n = safeNumber(value);
  return n.toFixed(digits);
}

function getChangeClass(value: any) {
  const n = safeNumber(value);
  if (n > 0) return "text-red";
  if (n < 0) return "text-green";
  return "text-gray";
}

function getStatusText(status: UpdateStatus) {
  if (status === "idle") return "等待更新";
  if (status === "loading") return "更新中";
  if (status === "success") return "更新成功";
  return "更新失敗";
}

function getStatusClass(status: UpdateStatus) {
  if (status === "loading") return "status-loading";
  if (status === "success") return "status-success";
  if (status === "error") return "status-error";
  return "status-idle";
}

export default function App() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateError, setUpdateError] = useState("");
  const [nextUpdateIn, setNextUpdateIn] = useState(AUTO_REFRESH_SECONDS);

  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState<"top" | "industry" | "breakout">("top");

  const loadStocks = async () => {
  const attemptTime = formatTime();

  setLoading(true);
  setUpdateStatus("loading");
  setLastAttemptAt(attemptTime);
  setUpdateError("");

  try {
    const res = await fetch(`/api/stocks?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`API 回應錯誤：${res.status}`);
    }

    const json = await res.json();

    const list: StockItem[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.stocks)
        ? json.stocks
        : Array.isArray(json?.data)
          ? json.data
          : [];

    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("API 有回應，但沒有取得股票資料");
    }

    const cleanList = list.map((item) => ({
      code: String(item.code || ""),
      name: String(item.name || ""),
      price: safeNumber(item.price),
      change: safeNumber(item.change),
      changePercent: safeNumber(item.changePercent),
      volume: safeNumber(item.volume),
      openPrice: safeNumber(item.openPrice),
      previousClose: safeNumber(item.previousClose),
      openPremiumPercent: safeNumber(item.openPremiumPercent),
      industry: item.industry || "其他",
      turnoverRate: safeNumber(item.turnoverRate),
      volumeRatio: safeNumber(item.volumeRatio),
      floatMarketCapYi: safeNumber(item.floatMarketCapYi),
    }));

    setStocks(cleanList);
    setLastSuccessAt(formatTime());
    setUpdateStatus("success");
    setNextUpdateIn(AUTO_REFRESH_SECONDS);
  } catch (error: any) {
    console.error("股票資料更新失敗：", error);

    setUpdateStatus("error");
    setUpdateError(
      error?.message || "資料來源暫時無法取得，已保留上一筆成功資料"
    );

    // 重要：這裡不要 setStocks([])
    // 這樣 API 失敗時，畫面會保留上一筆成功資料
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadStocks();

    const updateTimer = window.setInterval(() => {
      loadStocks();
    }, AUTO_REFRESH_SECONDS * 1000);

    const countdownTimer = window.setInterval(() => {
      setNextUpdateIn((prev) => {
        if (prev <= 1) return AUTO_REFRESH_SECONDS;
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(updateTimer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  const filteredStocks = useMemo(() => {
    const q = keyword.trim();

    const list = stocks
      .filter((s) => {
        if (!q) return true;
        return s.code.includes(q) || s.name.includes(q);
      })
      .sort((a, b) => safeNumber(b.changePercent) - safeNumber(a.changePercent));

    return list;
  }, [stocks, keyword]);

  const topStocks = useMemo(() => {
    return filteredStocks.slice(0, 50);
  }, [filteredStocks]);

  const industryRanking = useMemo(() => {
    const map = new Map<string, { industry: string; count: number; stocks: StockItem[] }>();

    topStocks.forEach((stock) => {
      const industry = stock.industry || "其他";

      if (!map.has(industry)) {
        map.set(industry, {
          industry,
          count: 0,
          stocks: [],
        });
      }

      const item = map.get(industry)!;
      item.count += 1;
      item.stocks.push(stock);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [topStocks]);

  const breakoutStocks = useMemo(() => {
    return topStocks.filter((stock) => {
      const changePercent = safeNumber(stock.changePercent);
      const volumeRatio = safeNumber(stock.volumeRatio);
      const volume = safeNumber(stock.volume);

      return changePercent >= 2 && volume > 500 && volumeRatio >= 1;
    });
  }, [topStocks]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">Taiwan Stock Radar</div>
          <h1>台股即時雷達</h1>
          <p>漲幅排行、產業熱度、突破股觀察</p>
        </div>

        <button
          className="refresh-btn"
          onClick={loadStocks}
          disabled={loading}
        >
          {loading ? "更新中..." : "手動更新"}
        </button>
      </header>

      <section className="update-card">
        <div className="update-top">
          <div>
            <div className="update-title">即時更新狀態</div>
            <div className="update-subtitle">
              自動每 {AUTO_REFRESH_SECONDS} 秒更新一次
            </div>
          </div>

          <div className={`status-pill ${getStatusClass(updateStatus)}`}>
            {getStatusText(updateStatus)}
          </div>
        </div>

        <div className="update-grid">
          <div className="update-box">
            <span>最後成功更新</span>
            <strong>{lastSuccessAt || "尚未成功"}</strong>
          </div>

          <div className="update-box">
            <span>最近嘗試更新</span>
            <strong>{lastAttemptAt || "尚未嘗試"}</strong>
          </div>

          <div className="update-box">
            <span>下一次自動更新</span>
            <strong>{nextUpdateIn} 秒後</strong>
          </div>

          <div className="update-box">
            <span>目前資料筆數</span>
            <strong>{stocks.length} 檔</strong>
          </div>
        </div>

        {updateStatus === "loading" && (
          <div className="notice notice-loading">
            正在取得最新資料...
          </div>
        )}

        {updateStatus === "success" && (
          <div className="notice notice-success">
            資料更新成功，已顯示最新取得資料。
          </div>
        )}

        {updateStatus === "error" && (
          <div className="notice notice-error">
            更新失敗：{updateError || "資料來源暫時無法取得，已保留上一筆成功資料"}
          </div>
        )}
      </section>

      <section className="search-card">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜尋股票代號或名稱，例如 2330 / 台積電"
        />
      </section>

      <nav className="tabs">
        <button
          className={activeTab === "top" ? "active" : ""}
          onClick={() => setActiveTab("top")}
        >
          漲幅排行
        </button>

        <button
          className={activeTab === "industry" ? "active" : ""}
          onClick={() => setActiveTab("industry")}
        >
          產業排行
        </button>

        <button
          className={activeTab === "breakout" ? "active" : ""}
          onClick={() => setActiveTab("breakout")}
        >
          突破股
        </button>
      </nav>

      {activeTab === "top" && (
        <section className="panel">
          <div className="section-title">
            <h2>今日漲幅排行前 50</h2>
            <span>{topStocks.length} 檔</span>
          </div>

          <StockList stocks={topStocks} />
        </section>
      )}

      {activeTab === "industry" && (
        <section className="panel">
          <div className="section-title">
            <h2>產業熱度排行</h2>
            <span>依前 50 檔統計</span>
          </div>

          <div className="industry-list">
            {industryRanking.length === 0 && (
              <EmptyState text="目前沒有產業資料" />
            )}

            {industryRanking.map((item, index) => (
              <div className="industry-card" key={item.industry}>
                <div className="industry-head">
                  <div>
                    <strong>
                      #{index + 1} {item.industry}
                    </strong>
                    <span>{item.count} 檔</span>
                  </div>
                </div>

                <div className="mini-stocks">
                  {item.stocks.slice(0, 8).map((stock) => (
                    <span key={stock.code}>
                      {stock.code} {stock.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "breakout" && (
        <section className="panel">
          <div className="section-title">
            <h2>剛突破觀察股</h2>
            <span>{breakoutStocks.length} 檔</span>
          </div>

          <StockList stocks={breakoutStocks} />
        </section>
      )}

      <footer className="footer">
        資料僅供觀察，不是投資建議。若更新失敗，畫面會保留上一筆成功資料。
      </footer>
    </div>
  );
}

function StockList({ stocks }: { stocks: StockItem[] }) {
  if (!stocks || stocks.length === 0) {
    return <EmptyState text="目前沒有符合條件的股票" />;
  }

  return (
    <div className="stock-list">
      {stocks.map((stock, index) => {
        const changeClass = getChangeClass(stock.changePercent);

        return (
          <div className="stock-card" key={`${stock.code}-${index}`}>
            <div className="rank">#{index + 1}</div>

            <div className="stock-main">
              <div className="stock-name">
                <strong>{stock.name || "未命名"}</strong>
                <span>{stock.code}</span>
              </div>

              <div className="stock-meta">
                <span>{stock.industry || "其他"}</span>
                <span>量 {formatNumber(stock.volume, 0)}</span>
              </div>
            </div>

            <div className="stock-price">
              <strong className={changeClass}>
                {formatNumber(stock.price, 2)}
              </strong>

              <span className={changeClass}>
                {safeNumber(stock.changePercent) > 0 ? "+" : ""}
                {formatNumber(stock.changePercent, 2)}%
              </span>

              <small className={changeClass}>
                {safeNumber(stock.change) > 0 ? "+" : ""}
                {formatNumber(stock.change, 2)}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty">
      {text}
    </div>
  );
}