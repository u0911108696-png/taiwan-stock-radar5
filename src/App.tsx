import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  industry: string;
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "2317": "電子代工",
  "2382": "電腦週邊",
  "3231": "電腦週邊",
  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2891": "金融",
  "1301": "塑化",
  "1303": "塑化",
  "2002": "鋼鐵",
  "2308": "電子零組件",
  "2357": "電腦週邊",
  "2412": "電信",
  "3008": "光電",
};

function getIndustry(code: string) {
  return industryMap[code] ?? "其他";
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStocks() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");

      if (!res.ok) {
        throw new Error("TWSE API 連線失敗");
      }

      const data = await res.json();

      const list: Stock[] = data
        .map((item: any) => {
          const code = String(item.Code ?? "");
          const price = Number(item.ClosingPrice || 0);
          const change = Number(item.Change || 0);
          const previous = price - change;
          const changePercent =
            previous > 0 ? Number(((change / previous) * 100).toFixed(2)) : 0;

          return {
            code,
            name: String(item.Name ?? ""),
            price,
            changePercent,
            volume: Number(item.TradeVolume || 0),
            industry: getIndustry(code),
          };
        })
        .filter((s: Stock) => s.code && s.name && s.price > 0)
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
        .slice(0, 50);

      setStocks(list);
    } catch (err: any) {
      setError(err.message || "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStocks();
  }, []);

  const industryRanking = useMemo(() => {
    const count: Record<string, number> = {};
    stocks.forEach((s) => {
      count[s.industry] = (count[s.industry] || 0) + 1;
    });

    return Object.entries(count)
      .map(([industry, total]) => ({ industry, total }))
      .sort((a, b) => b.total - a.total);
  }, [stocks]);

  const topIndustries = industryRanking.slice(0, 3);

  const breakoutStocks = stocks.filter((s) => s.changePercent >= 5).slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">台股即時雷達</h1>
          <p className="mt-1 text-sm text-slate-400">
            今日漲幅排行前 50 名 / 產業熱度 / 剛突破股票
          </p>
        </header>

        <button
          onClick={loadStocks}
          className="mb-4 w-full rounded-xl bg-red-500 py-3 font-bold text-white"
        >
          重新整理即時資料
        </button>

        {loading && (
          <div className="rounded-xl bg-slate-800 p-4 text-center">
            資料載入中...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-900 p-4 text-sm">
            錯誤：{error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">前三大熱門產業</h2>
              <div className="grid grid-cols-3 gap-2">
                {topIndustries.map((item) => (
                  <div key={item.industry} className="rounded-xl bg-slate-800 p-3 text-center">
                    <div className="text-sm text-slate-300">{item.industry}</div>
                    <div className="mt-1 text-xl font-bold text-red-400">
                      {item.total}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">產業熱度排行</h2>
              {industryRanking.map((item, index) => (
                <div
                  key={item.industry}
                  className="mb-2 flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2"
                >
                  <span>
                    {index + 1}. {item.industry}
                  </span>
                  <span className="font-bold text-red-400">{item.total} 檔</span>
                </div>
              ))}
            </section>

            <section className="mb-5 rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">剛突破股票</h2>
              {breakoutStocks.length === 0 ? (
                <p className="text-sm text-slate-400">目前沒有符合條件的股票</p>
              ) : (
                breakoutStocks.map((s) => (
                  <div
                    key={s.code}
                    className="mb-2 rounded-xl bg-slate-800 px-3 py-2"
                  >
                    <div className="flex justify-between">
                      <span className="font-bold">
                        {s.code} {s.name}
                      </span>
                      <span className="text-red-400">+{s.changePercent}%</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {s.industry} / 成交價 {s.price}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-bold">今日漲幅排行前 50</h2>
              {stocks.map((s, index) => (
                <div
                  key={s.code}
                  className="mb-3 rounded-xl bg-slate-800 p-3"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold">
                        #{index + 1} {s.code} {s.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {s.industry}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-400">
                        +{s.changePercent}%
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {s.price}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    成交量：{s.volume.toLocaleString()}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}