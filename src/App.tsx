import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  industry: string;
};

const industryMap: Record<string, string> = {  "2911": "百貨",
  "3042": "PCB",
  "3711": "半導體",
  "3714": "光電",
  "6168": "光電",
  "8374": "電機機械",
  "2356": "電腦週邊",
  "3481": "面板",
  "4722": "化工",
  "6405": "光電",
  // 半導體
  "2330": "半導體", "2303": "半導體", "2454": "半導體", "3034": "半導體",
  "3035": "半導體", "3443": "半導體", "3711": "半導體", "2379": "半導體",
  "3661": "半導體", "6415": "半導體", "6531": "半導體", "6756": "半導體",
  "8016": "半導體", "5347": "半導體", "2408": "半導體", "8261": "半導體",

  // 電子代工 / EMS
  "2317": "電子代工", "4938": "電子代工", "2354": "電子代工", "3702": "電子代工",
  "2324": "電子代工", "3481": "電子代工", "2382": "電腦週邊", "2357": "電腦週邊",
  "3231": "電腦週邊", "2301": "電腦週邊", "6669": "電腦週邊", "3017": "電腦週邊",
  "2376": "電腦週邊", "2377": "電腦週邊", "2395": "電腦週邊", "8155": "電腦週邊",

  // AI / 伺服器 / 散熱
  "2383": "AI伺服器", "3324": "AI伺服器", "2368": "AI伺服器", "6230": "AI伺服器",
  "6274": "AI伺服器", "8210": "AI伺服器", "3013": "散熱", "2421": "散熱",
  "3323": "散熱", "3653": "散熱",

  // 電子零組件
  "2308": "電子零組件", "2327": "電子零組件", "2492": "電子零組件", "3037": "電子零組件",
  "3044": "電子零組件", "8046": "電子零組件", "5434": "電子零組件", "6176": "電子零組件",
  "6269": "電子零組件", "2457": "電子零組件", "2313": "PCB", "2367": "PCB",
  "3042": "PCB", "4958": "PCB", "6191": "PCB", "6213": "PCB",

  // 光電 / 面板
  "3008": "光電", "2409": "面板", "3481": "面板", "6116": "面板",
  "3673": "光電", "3406": "光電", "3019": "光電", "6278": "光電",

  // 通訊 / 網通
  "2412": "電信", "3045": "電信", "4904": "電信", "2345": "網通",
  "2419": "網通", "3380": "網通", "6285": "網通", "3596": "網通",

  // 金融
  "2880": "金融", "2881": "金融", "2882": "金融", "2883": "金融",
  "2884": "金融", "2885": "金融", "2886": "金融", "2887": "金融",
  "2888": "金融", "2889": "金融", "2890": "金融", "2891": "金融",
  "2892": "金融", "5871": "金融", "5876": "金融", "2801": "金融",
  "2812": "金融", "2834": "金融", "2845": "金融",

  // 航運 / 航空
  "2603": "航運", "2609": "航運", "2615": "航運", "2605": "航運",
  "2606": "航運", "2610": "航空", "2618": "航空", "2617": "航運",

  // 塑化 / 化工
  "1301": "塑化", "1303": "塑化", "1326": "塑化", "6505": "塑化",
  "1314": "塑化", "1717": "化工", "1722": "化工", "1723": "化工",
  "4720": "化工",

  // 鋼鐵
  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵", "2023": "鋼鐵",
  "2031": "鋼鐵", "5009": "鋼鐵", "9958": "鋼鐵",

  // 水泥 / 營建 / 資產
  "1101": "水泥", "1102": "水泥", "1103": "水泥",
  "2542": "營建", "2548": "營建", "2504": "營建", "2511": "營建",
  "2535": "營建", "2538": "營建", "2520": "營建", "2515": "營建",

  // 汽車 / 車用
  "2201": "汽車", "2204": "汽車", "2206": "汽車", "2207": "汽車",
  "2227": "汽車", "2231": "汽車", "2233": "汽車", "6288": "車用電子",

  // 食品 / 生技 / 醫療
  "1216": "食品", "1227": "食品", "1231": "食品", "1232": "食品",
  "1707": "生技", "1760": "生技", "1783": "生技", "1795": "生技",
  "4142": "生技", "4743": "生技", "6547": "生技", "4105": "醫療",

  // 觀光 / 百貨 / 其他
  "2707": "觀光", "2731": "觀光", "2748": "觀光", "2727": "觀光",
  "2912": "百貨", "5903": "百貨", "8454": "文創", "9910": "橡膠",
  "9921": "橡膠", "2105": "橡膠", "9939": "油電燃氣", "9904": "消費",
  "9907": "消費", "9914": "消費", "9926": "消費"
};
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

      const res = await fetch("/api/stocks");
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
