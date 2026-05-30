import React, { useMemo, useState } from "react";

type TradePlan = {
  code: string;
  name: string;
  buyPrice: number;
  currentPrice: number;
  atr: number;
  position: number;
};

const DEFAULT_STOCKS: TradePlan[] = [
  {
    code: "2344",
    name: "華邦電",
    buyPrice: 31.5,
    currentPrice: 33.2,
    atr: 1.15,
    position: 1000,
  },
  {
    code: "2330",
    name: "台積電",
    buyPrice: 980,
    currentPrice: 1005,
    atr: 22,
    position: 1000,
  },
];

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function money(value: number) {
  return value.toLocaleString("zh-TW", {
    maximumFractionDigits: 2,
  });
}

function calcTradePlan(stock: TradePlan) {
  const { buyPrice, currentPrice, atr, position } = stock;

  const profitRate = ((currentPrice - buyPrice) / buyPrice) * 100;
  const profitMoney = (currentPrice - buyPrice) * position;

  const stopLoss5 = buyPrice * 0.95;
  const stopLoss8 = buyPrice * 0.92;

  const takeProfit10 = buyPrice * 1.1;
  const takeProfit15 = buyPrice * 1.15;
  const takeProfit20 = buyPrice * 1.2;

  const atrStop1 = currentPrice - atr * 2;
  const atrStop2 = currentPrice - atr * 2.5;
  const atrStop3 = currentPrice - atr * 3;

  const riskPrice = Math.max(stopLoss5, atrStop2);
  const riskRate = ((currentPrice - riskPrice) / currentPrice) * 100;

  let mainSignal = "觀察中";
  let signalLevel: "safe" | "warning" | "danger" = "safe";

  if (currentPrice <= stopLoss5) {
    mainSignal = "跌破停損線，風險偏高";
    signalLevel = "danger";
  } else if (currentPrice <= atrStop2) {
    mainSignal = "接近 ATR 移動停利，注意轉弱";
    signalLevel = "warning";
  } else if (profitRate >= 20) {
    mainSignal = "獲利超過 20%，建議用移動停利保護";
    signalLevel = "safe";
  } else if (profitRate >= 10) {
    mainSignal = "已達第一段停利區，可考慮分批";
    signalLevel = "safe";
  } else if (profitRate < 0) {
    mainSignal = "目前虧損，注意是否跌破停損";
    signalLevel = "warning";
  } else {
    mainSignal = "目前仍可續抱，等待突破或停利訊號";
    signalLevel = "safe";
  }

  const items = [
    {
      title: "1. 損益狀態",
      value: `${pct(profitRate)} / ${money(profitMoney)} 元`,
      note: profitRate >= 0 ? "目前是獲利狀態" : "目前是虧損狀態",
    },
    {
      title: "2. 固定 -5% 停損",
      value: money(stopLoss5),
      note: "短線防守價，跌破代表買點失敗機率增加",
    },
    {
      title: "3. 固定 -8% 停損",
      value: money(stopLoss8),
      note: "較寬鬆停損，適合波動較大的股票",
    },
    {
      title: "4. 第一停利 +10%",
      value: money(takeProfit10),
      note: "到這裡可以先出一部分，降低心理壓力",
    },
    {
      title: "5. 第二停利 +15%",
      value: money(takeProfit15),
      note: "強勢股常見第一段主升後的保守停利區",
    },
    {
      title: "6. 第三停利 +20%",
      value: money(takeProfit20),
      note: "漲幅較大時，不建議再追高，改用移動停利",
    },
    {
      title: "7. ATR 2倍停利線",
      value: money(atrStop1),
      note: "比較靈敏，適合短線交易",
    },
    {
      title: "8. ATR 2.5倍停利線",
      value: money(atrStop2),
      note: "平衡型移動停利線，適合大多數波段",
    },
    {
      title: "9. ATR 3倍停利線",
      value: money(atrStop3),
      note: "較寬鬆，適合想抱主升段的人",
    },
    {
      title: "10. 目前建議防守價",
      value: money(riskPrice),
      note: "系統取固定停損與 ATR 停利中較合理的位置",
    },
    {
      title: "11. 距離防守線",
      value: pct(riskRate),
      note: riskRate < 3 ? "距離很近，風險升高" : "目前還有緩衝空間",
    },
    {
      title: "12. 加倉觀察",
      value: currentPrice > buyPrice * 1.05 ? "可觀察" : "暫不建議",
      note: "至少獲利 5% 以上，再考慮加倉比較安全",
    },
    {
      title: "13. 追高風險",
      value: profitRate >= 12 ? "偏高" : "正常",
      note: profitRate >= 12 ? "漲幅已大，追高容易被洗出去" : "尚未明顯過熱",
    },
    {
      title: "14. 主線狀態",
      value: currentPrice > buyPrice ? "主線未失效" : "主線偏弱",
      note: "跌回買進價下方，要小心原本邏輯是否失效",
    },
    {
      title: "15. 停損提醒",
      value: currentPrice <= stopLoss5 ? "觸發" : "尚未觸發",
      note: "觸發後不建議凹單，先保護本金",
    },
    {
      title: "16. 停利提醒",
      value: profitRate >= 10 ? "已進入停利區" : "尚未到停利區",
      note: "進入停利區後，重點不是猜高點，而是守住利潤",
    },
    {
      title: "17. 移動停利提醒",
      value: currentPrice <= atrStop2 ? "接近出場" : "續抱觀察",
      note: "股價跌破 ATR 線，代表短線轉弱",
    },
    {
      title: "18. 部位風險",
      value: position >= 3000 ? "偏大" : "正常",
      note: "部位越大，越要嚴格執行停損停利",
    },
    {
      title: "19. 操作建議",
      value:
        signalLevel === "danger"
          ? "先停損或減碼"
          : signalLevel === "warning"
          ? "不要加碼，觀察支撐"
          : "可續抱並用 ATR 保護",
      note: "這是風控提醒，不是保證漲跌",
    },
    {
      title: "20. 今日結論",
      value: mainSignal,
      note: "每天開盤後更新價格，再重新判斷",
    },
  ];

  return {
    profitRate,
    profitMoney,
    stopLoss5,
    takeProfit10,
    takeProfit15,
    takeProfit20,
    atrStop2,
    riskPrice,
    mainSignal,
    signalLevel,
    items,
  };
}

export default function App() {
  const [stock, setStock] = useState<TradePlan>(DEFAULT_STOCKS[0]);

  const result = useMemo(() => calcTradePlan(stock), [stock]);

  const signalClass =
    result.signalLevel === "danger"
      ? "bg-red-500/15 text-red-300 border-red-400/40"
      : result.signalLevel === "warning"
      ? "bg-yellow-500/15 text-yellow-300 border-yellow-400/40"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-400/40";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl">
          <div className="mb-3 text-sm font-bold text-blue-300">
            台股個人持倉風控雷達
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            止盈止損・ATR 移動停利助手
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            輸入你的買進價、目前價、ATR 與持股張數，系統會自動計算停損、停利、移動停利與加倉風險。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="mb-4 text-xl font-black">輸入個人持倉</h2>

            <div className="grid gap-3">
              <label className="text-sm text-slate-300">
                股票代號
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.code}
                  onChange={(e) =>
                    setStock({ ...stock, code: e.target.value })
                  }
                />
              </label>

              <label className="text-sm text-slate-300">
                股票名稱
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.name}
                  onChange={(e) =>
                    setStock({ ...stock, name: e.target.value })
                  }
                />
              </label>

              <label className="text-sm text-slate-300">
                我的買進價
                <input
                  type="number"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.buyPrice}
                  onChange={(e) =>
                    setStock({ ...stock, buyPrice: toNumber(e.target.value) })
                  }
                />
              </label>

              <label className="text-sm text-slate-300">
                目前股價
                <input
                  type="number"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.currentPrice}
                  onChange={(e) =>
                    setStock({
                      ...stock,
                      currentPrice: toNumber(e.target.value),
                    })
                  }
                />
              </label>

              <label className="text-sm text-slate-300">
                ATR 波動值
                <input
                  type="number"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.atr}
                  onChange={(e) =>
                    setStock({ ...stock, atr: toNumber(e.target.value) })
                  }
                />
              </label>

              <label className="text-sm text-slate-300">
                持股股數
                <input
                  type="number"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
                  value={stock.position}
                  onChange={(e) =>
                    setStock({ ...stock, position: toNumber(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="mb-4 text-xl font-black">
              {stock.code} {stock.name}
            </h2>

            <div className={`mb-4 rounded-2xl border p-4 ${signalClass}`}>
              <div className="text-sm font-bold">系統判斷</div>
              <div className="mt-1 text-2xl font-black">
                {result.mainSignal}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">目前損益</div>
                <div
                  className={`mt-1 text-2xl font-black ${
                    result.profitRate >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {pct(result.profitRate)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">損益金額</div>
                <div
                  className={`mt-1 text-2xl font-black ${
                    result.profitMoney >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {money(result.profitMoney)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">停損價</div>
                <div className="mt-1 text-2xl font-black text-red-300">
                  {money(result.stopLoss5)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">ATR 停利線</div>
                <div className="mt-1 text-2xl font-black text-yellow-300">
                  {money(result.atrStop2)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">第一停利</div>
                <div className="mt-1 text-2xl font-black text-blue-300">
                  {money(result.takeProfit10)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4">
                <div className="text-xs text-slate-400">第二停利</div>
                <div className="mt-1 text-2xl font-black text-purple-300">
                  {money(result.takeProfit15)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="mb-4 text-xl font-black">20 項風控分析</h2>

          <div className="grid gap-3 md:grid-cols-2">
            {result.items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="text-sm font-black text-slate-200">
                  {item.title}
                </div>

                <div className="mt-2 text-xl font-black text-white">
                  {item.value}
                </div>

                <div className="mt-2 text-sm leading-6 text-slate-400">
                  {item.note}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-5">
          <h2 className="text-lg font-black text-blue-200">使用提醒</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            這個功能是幫你做交易計畫與風控提醒，不是保證獲利。真正下單前，還是要搭配成交量、K線位置、產業主線、大盤狀態一起看。
          </p>
        </div>
      </div>
    </div>
  );
}