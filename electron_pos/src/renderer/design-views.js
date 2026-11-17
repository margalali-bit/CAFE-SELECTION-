// Visual templates adapted from the user-supplied HTML. No demo database or authentication code.
function formatMoney(amount) {
  return Number(amount || 0).toFixed(2) + " درهم";
}
function formatTime(isoString) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  return d.toLocaleTimeString("ar-MA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function getBrandLogoSvg(variant = "gold", sizeClass = "w-24 h-24") {
  const isMono = variant === "mono";
  const uid = "logo_" + Math.random().toString(36).slice(2, 7);
  const strokeMain = isMono ? "#111111" : `url(#${uid}_grad)`;
  const fillStar = isMono ? "#111111" : "#FFF8DC";
  const fillCupStar = isMono ? "#111111" : `url(#${uid}_grad)`;
  const cupFill = isMono ? "rgba(0,0,0,0.06)" : "rgba(212,175,55,0.12)";
  return `
        <svg class="${sizeClass} mx-auto" viewBox="0 0 180 185" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${
            !isMono
              ? `
          <defs>
            <linearGradient id="${uid}_grad" x1="40" y1="15" x2="140" y2="165" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFF3C4"/>
              <stop offset="35%" stop-color="#E6C252"/>
              <stop offset="70%" stop-color="#C59B27"/>
              <stop offset="100%" stop-color="#8A6B12"/>
            </linearGradient>
          </defs>`
              : ""
          }
          <!-- S Ribbon Upper & Lower Curves -->
          <path d="M116 25C92 14 66 22 65 40C64 58 118 60 118 83C118 102 96 112 72 109C56 107 48 96 50 81C52 69 64 61 84 61" stroke="${strokeMain}" stroke-width="7.5" stroke-linecap="round"/>
          <path d="M107 34C95 30 85 35 85 43C85 50 93 53 99 53" stroke="${strokeMain}" stroke-width="3.2" stroke-linecap="round"/>
          <!-- Coffee Cup -->
          <path d="M64 71H106C106 90 96 101 85 101C74 101 64 90 64 71Z" stroke="${strokeMain}" stroke-width="4.2" fill="${cupFill}"/>
          <!-- Cup Handle -->
          <path d="M106 75H113C117.5 75 120.5 78.5 120.5 82.5C120.5 86.5 117.5 90 113 90H104" stroke="${strokeMain}" stroke-width="4" stroke-linecap="round"/>
          <!-- Decorative Outer Swirl & Bottom Point -->
          <path d="M58 68C51 81 57 98 75 107L82 115L85 107" stroke="${strokeMain}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- 4-Point Diamond Star Inside Cup -->
          <path d="M85 78L87.8 84.2L94 87L87.8 89.8L85 96L82.2 89.8L76 87L82.2 84.2L85 78Z" fill="${fillCupStar}"/>
          <!-- Top Right Sparkle Star on Tip of S -->
          <path d="M119 11L121.5 20.5L131 23L121.5 25.5L119 35L116.5 25.5L107 23L116.5 20.5L119 11Z" fill="${fillStar}"/>
          <line x1="110" y1="14" x2="128" y2="32" stroke="${fillStar}" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="128" y1="14" x2="110" y2="32" stroke="${fillStar}" stroke-width="1.2" stroke-linecap="round"/>
          <!-- Typography: café SELECTION TIZNIT -->
          <text x="90" y="133" text-anchor="middle" fill="${isMono ? "#111111" : "#E6C252"}" font-family="'Playfair Display', Georgia, serif" font-size="18" font-weight="600" letter-spacing="1">café</text>
          <text x="90" y="156" text-anchor="middle" fill="${isMono ? "#111111" : "#F3E5AB"}" font-family="'Playfair Display', Georgia, serif" font-size="22" font-weight="700" letter-spacing="2.5">SELECTION</text>
          <line x1="36" y1="171" x2="62" y2="171" stroke="${isMono ? "#333333" : "#C59B27"}" stroke-width="1.2"/>
          <text x="90" y="175" text-anchor="middle" fill="${isMono ? "#111111" : "#D4AF37"}" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="3.5">TIZNIT</text>
          <line x1="118" y1="171" x2="144" y2="171" stroke="${isMono ? "#333333" : "#C59B27"}" stroke-width="1.2"/>
        </svg>
      `;
}
function getTodayMetrics() {
  const today = getCurrentBusinessDay();
  const todayOrders = db.orders.filter((o) => o.businessDay === today);
  const validOrders = todayOrders.filter((o) => o.status === "paid");
  const cashSales = validOrders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((sum, o) => sum + o.total, 0);
  const debtSales = validOrders
    .filter((o) => o.paymentMethod === "debt")
    .reduce((sum, o) => sum + o.total, 0);
  const debtCollections = db.debtPayments
    .filter((p) => p.businessDay === today)
    .reduce((sum, p) => sum + p.amount, 0);
  const totalRevenue = cashSales + debtCollections;
  const totalExpenses = db.expenses
    .filter((e) => e.businessDay === today)
    .reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const itemMap = Object.create(null);
  validOrders.forEach((o) => {
    o.items.forEach((it) => {
      itemMap[it.name] = (itemMap[it.name] || 0) + it.qty;
    });
  });
  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return {
    today,
    validOrdersCount: validOrders.length,
    cancelledOrdersCount: todayOrders.filter((o) => o.status === "cancelled")
      .length,
    cashSales,
    debtSales,
    debtCollections,
    totalRevenue,
    totalExpenses,
    netProfit,
    topItems,
  };
}
function getAnalyticsData() {
  const validOrders = db.orders.filter((o) => o.status === "paid");
  const totalAllRevenue = validOrders.reduce((s, o) => s + o.total, 0);
  const productStatsMap = Object.create(null);
  validOrders.forEach((o) => {
    o.items.forEach((it) => {
      if (!productStatsMap[it.name]) {
        productStatsMap[it.name] = {
          name: it.name,
          qty: 0,
          revenue: 0,
        };
      }
      productStatsMap[it.name].qty += it.qty;
      productStatsMap[it.name].revenue += it.price * it.qty;
    });
  });
  const productStats = Object.values(productStatsMap).sort(
    (a, b) => b.revenue - a.revenue,
  );
  let orangeJuiceQty = 0;
  let orangeJuiceRevenue = 0;
  validOrders.forEach((o) => {
    o.items.forEach((it) => {
      if (it.name.includes("برتقال") || it.productId === "p8") {
        orangeJuiceQty += it.qty;
        orangeJuiceRevenue += it.price * it.qty;
      }
    });
  });
  const orangeExpensesList = db.expenses.filter(
    (e) =>
      e.category === "شراء البرتقال" ||
      e.category.includes("برتقال") ||
      (e.note && e.note.includes("برتقال")),
  );
  const orangePurchaseCost = orangeExpensesList.reduce(
    (s, e) => s + e.amount,
    0,
  );
  const orangeNetProfit = orangeJuiceRevenue - orangePurchaseCost;
  const orangeMarginPct =
    orangeJuiceRevenue > 0
      ? Math.round((orangeNetProfit / orangeJuiceRevenue) * 100)
      : 0;
  const daysSet = new Set([
    getCurrentBusinessDay(),
    ...db.orders.map((o) => o.businessDay),
    ...db.expenses.map((e) => e.businessDay),
    ...db.debtPayments.map((p) => p.businessDay),
  ]);
  const dailyStats = Array.from(daysSet)
    .sort((a, b) => b.localeCompare(a))
    .map((day) => {
      const dayOrders = validOrders.filter((o) => o.businessDay === day);
      const dayCash = dayOrders
        .filter((o) => o.paymentMethod === "cash")
        .reduce((s, o) => s + o.total, 0);
      const dayDebtSales = dayOrders
        .filter((o) => o.paymentMethod === "debt")
        .reduce((s, o) => s + o.total, 0);
      const dayDebtCol = db.debtPayments
        .filter((p) => p.businessDay === day)
        .reduce((s, p) => s + p.amount, 0);
      const dayRev = dayCash + dayDebtCol;
      const dayExp = db.expenses
        .filter((e) => e.businessDay === day)
        .reduce((s, e) => s + e.amount, 0);
      return {
        day,
        ordersCount: dayOrders.length,
        revenue: dayRev,
        debtSales: dayDebtSales,
        expenses: dayExp,
        netProfit: dayRev - dayExp,
      };
    });
  const hourCounts = Object.create(null);
  validOrders.forEach((o) => {
    const h = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Casablanca",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(o.createdAt)),
    );
    const label = `${String(h).padStart(2, "0")}:00`;
    hourCounts[label] = (hourCounts[label] || 0) + 1;
  });
  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  const peakHour =
    sortedHours.length > 0
      ? `${sortedHours[0][0]} (${sortedHours[0][1]} طلبات)`
      : "لا توجد بيانات";
  const avgTicket =
    validOrders.length > 0 ? totalAllRevenue / validOrders.length : 0;
  const cancelRate =
    db.orders.length > 0
      ? (
          (db.orders.filter((o) => o.status === "cancelled").length /
            db.orders.length) *
          100
        ).toFixed(1)
      : "0.0";
  return {
    productStats,
    totalAllRevenue,
    orangeJuiceQty,
    orangeJuiceRevenue,
    orangePurchaseCost,
    orangeNetProfit,
    orangeMarginPct,
    dailyStats,
    peakHour,
    avgTicket,
    cancelRate,
  };
}
function getOpenShiftForWaiter(waiterId) {
  return db.shifts.find((s) => s.waiterId === waiterId && s.status === "open");
}
function getAnyOpenShift() {
  return db.shifts.find((s) => s.status === "open");
}
function recalculateShiftTotals(shiftId) {
  const shift = db.shifts.find((s) => s.id === shiftId);
  if (!shift) return;
  const shiftOrders = db.orders.filter(
    (o) => o.shiftId === shiftId && o.status === "paid",
  );
  shift.expectedCash = shiftOrders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((sum, o) => sum + o.total, 0);
  shift.onAccountTotal = shiftOrders
    .filter((o) => o.paymentMethod === "debt")
    .reduce((sum, o) => sum + o.total, 0);
  if (shift.handedCash !== null && shift.handedCash !== undefined) {
    shift.difference = shift.handedCash - shift.expectedCash;
  }
}
window.openDebtCustomerPicker = function () {
  if (!db.settings.debtsEnabled) return;
  if (uiState.cart.length === 0) {
    showToast("السلة فارغة!", "error");
    return;
  }
  const total = uiState.cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gold-400">تسجيل الطلب على الحساب (${formatMoney(total)})</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <div class="space-y-2 max-h-72 overflow-y-auto mb-4">
            ${db.customers
              .map((c) => {
                const canTake = c.balance + total <= c.limit;
                return `
                <button onclick="${canTake ? `closeModal(); processCheckout('debt', '${c.id}')` : ""}" ${!canTake ? "disabled" : ""} class="w-full text-right p-3 rounded-xl border transition flex items-center justify-between ${canTake ? "bg-charcoal-800 hover:bg-charcoal-700 border-charcoal-600" : "bg-charcoal-900 border-red-900/40 opacity-50 cursor-not-allowed"}">
                  <div>
                    <div class="font-bold text-white">${c.name}</div>
                    <div class="text-xs text-gray-400">الدين الحالي: ${formatMoney(c.balance)} / الحد: ${formatMoney(c.limit)}</div>
                  </div>
                  <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${canTake ? "bg-gold-500/20 text-gold-400" : "bg-red-500/20 text-red-400"}">
                    ${canTake ? "اختيار" : "تجاوز الحد"}
                  </span>
                </button>
              `;
              })
              .join("")}
          </div>
          ${
            db.settings.whoAddsCustomers === "both"
              ? `
            <button onclick="openAddCustomerModal()" class="w-full py-2.5 rounded-xl border border-dashed border-gold-500/50 text-gold-400 hover:bg-gold-500/10 text-sm font-semibold">
              <i class="fa-solid fa-user-plus ml-1"></i> إضافة زبون جديد
            </button>
          `
              : ""
          }
        </div>
      `);
};
window.receiptDesign = function (orderId) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return;
  const customer = order.customerId
    ? db.customers.find((c) => c.id === order.customerId)
    : null;
  openModal(`
        <div class="p-5 flex flex-col items-center">
          <div id="printable-receipt" class="thermal-paper w-full max-w-[310px] p-5 text-center rounded-t-lg text-xs">
            <div class="w-24 h-24 mx-auto mb-1">
              ${getBrandLogoSvg("mono", "w-full h-full")}
            </div>
            <div class="border-t border-b border-dashed border-gray-400 py-1.5 my-2 text-[11px] flex justify-between">
              <span>تذكرة رقم: <strong>#${order.dailyNumber}</strong></span>
              <span>${formatTime(order.createdAt)}</span>
            </div>
            <div class="text-right text-[11px] mb-2 space-y-0.5">
              <div>التاريخ: ${order.businessDay}</div>
              <div>النادل: ${order.waiterName}</div>
              <div>الدفع: <strong>${order.paymentMethod === "cash" ? "نقداً" : `على الحساب (${customer ? customer.name : ""})`}</strong></div>
              ${order.status === "cancelled" ? `<div class="text-red-700 font-bold">*** ملغاة: ${order.cancelReason} ***</div>` : ""}
            </div>
            <div class="border-t border-dashed border-gray-400 pt-2 space-y-1.5 text-right">
              ${order.items
                .map(
                  (it) => `
                <div class="flex justify-between">
                  <span>${it.qty}x ${it.name}</span>
                  <span>${(it.price * it.qty).toFixed(2)}</span>
                </div>
              `,
                )
                .join("")}
            </div>
            <div class="border-t-2 border-gray-800 mt-3 pt-2 flex justify-between text-sm font-bold">
              <span>المجموع:</span>
              <span>${formatMoney(order.total)}</span>
            </div>
            ${
              db.settings.wifiSSID
                ? `
              <div class="mt-3 pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-800">
                <div class="font-bold">WiFi: ${db.settings.wifiSSID}</div>
                <div>Code: <span class="font-mono font-bold">${db.settings.wifiPassword || ""}</span></div>
              </div>
            `
                : ""
            }
            <div class="mt-3 text-[11px] font-semibold">شكراً لزيارتكم — نتمنى لكم يوماً سعيداً</div>
          </div>

          <div class="flex gap-3 w-full max-w-[310px] mt-5">
            <button onclick="window.print()" class="flex-1 py-2.5 rounded-xl gold-btn flex items-center justify-center gap-2 text-sm">
              <i class="fa-solid fa-print"></i> طباعة 80mm
            </button>
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 text-white font-semibold text-sm">
              إغلاق
            </button>
          </div>
        </div>
      `);
};
window.openCloseShiftModal = function (shiftId) {
  const shift = db.shifts.find((s) => s.id === shiftId);
  if (!shift) return;
  recalculateShiftTotals(shiftId);
  window._closingCashInput = "";
  openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-bold text-gold-400">إغلاق الوردية وتسليم الحصيلة</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <div class="bg-charcoal-900 border border-charcoal-700 rounded-xl p-3 mb-4 text-xs space-y-1">
            <div class="flex justify-between"><span class="text-gray-400">النادل:</span><strong class="text-white">${shift.waiterName}</strong></div>
            <div class="flex justify-between"><span class="text-gray-400">المبيعات على الحساب (منفصلة):</span><span class="text-amber-400 font-bold">${formatMoney(shift.onAccountTotal)}</span></div>
          </div>
          <label class="block text-xs text-gray-300 mb-1.5">أدخل المبلغ النقدي الفعلي الموجود في الصندوق (درهم):</label>
          <input id="handed-cash-display" type="text" readonly value="0" class="w-full bg-charcoal-950 border border-gold-500/50 rounded-xl px-4 py-3 text-center text-2xl font-bold text-gold-400 mb-3" dir="ltr" />
          <div class="grid grid-cols-3 gap-2 mb-4" dir="ltr">
            ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "."]
              .map(
                (k) => `
              <button onclick="appendCloseShiftDigit('${k}')" class="h-11 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-600 text-white font-bold text-lg">${k}</button>
            `,
              )
              .join("")}
          </div>
          <button onclick="confirmCloseShift('${shift.id}')" class="w-full py-3 rounded-xl gold-btn text-base">
            تأكيد إغلاق الوردية وعرض التقرير
          </button>
        </div>
      `);
};
window.appendCloseShiftDigit = function (k) {
  if (k === "C") window._closingCashInput = "";
  else if (k === "." && window._closingCashInput.includes(".")) return;
  else window._closingCashInput += k;
  const el = document.getElementById("handed-cash-display");
  if (el) el.value = window._closingCashInput || "0";
};
window.openShiftReportModal = function (shiftId) {
  const shift = db.shifts.find((s) => s.id === shiftId);
  if (!shift) return;
  recalculateShiftTotals(shiftId);
  const shiftOrders = db.orders.filter(
    (o) => o.shiftId === shiftId && o.status === "paid",
  );
  const diff = shift.difference ?? 0;
  const diffLabel =
    diff === 0
      ? "متطابق تماماً"
      : diff > 0
        ? `زيادة (+${formatMoney(diff)})`
        : `عجز (${formatMoney(diff)})`;
  openModal(`
        <div class="p-6">
          <div id="printable-receipt" class="bg-charcoal-900 border border-gold-500/40 rounded-2xl p-5 space-y-3 text-sm">
            <div class="text-center border-b border-charcoal-700 pb-3">
              <div class="w-16 h-16 mx-auto mb-1">${getBrandLogoSvg("gold", "w-full h-full")}</div>
              <h3 class="text-base font-bold text-gold-400">تقرير نهاية الوردية</h3>
              <p class="text-xs text-gray-400">${shift.businessDay}</p>
            </div>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between"><span class="text-gray-400">النادل:</span><strong class="text-white">${shift.waiterName}</strong></div>
              <div class="flex justify-between"><span class="text-gray-400">وقت البداية:</span><span>${formatTime(shift.startTime)}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">وقت الإغلاق:</span><span>${formatTime(shift.endTime)}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">عدد الطلبات المنفذة:</span><strong>${shiftOrders.length} طلبات</strong></div>
              <div class="border-t border-charcoal-700 pt-2 flex justify-between text-emerald-400 font-bold">
                <span>المبلغ المقبوض نقداً (المفروض):</span>
                <span>${formatMoney(shift.expectedCash)}</span>
              </div>
              <div class="flex justify-between text-amber-400">
                <span>مبيعات على الحساب (غير نقدية):</span>
                <span>${formatMoney(shift.onAccountTotal)}</span>
              </div>
              ${
                shift.handedCash !== null
                  ? `
                <div class="flex justify-between text-white font-bold">
                  <span>المبلغ الفعلي المسلّم:</span>
                  <span>${formatMoney(shift.handedCash)}</span>
                </div>
                <div class="flex justify-between font-bold ${diff === 0 ? "text-emerald-400" : diff > 0 ? "text-blue-400" : "text-red-400"}">
                  <span>الفرق في الصندوق:</span>
                  <span>${diffLabel}</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
          <div class="flex gap-3 mt-4">
            <button onclick="window.print()" class="flex-1 py-2.5 rounded-xl gold-btn text-sm font-bold"><i class="fa-solid fa-print ml-1"></i> طباعة التقرير</button>
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-white text-sm font-semibold">إغلاق</button>
          </div>
        </div>
      `);
};
window.openCancelOrderModal = function (orderId) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order || order.status === "cancelled") return;
  openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-bold text-red-400">إلغاء الطلبية #${order.dailyNumber}</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <p class="text-xs text-gray-400 mb-3">الطلب المدفوع لا يُحذف أبداً من السجل. يرجى كتابة سبب الإلغاء الإجباري:</p>
          <input id="cancel-reason-input" type="text" placeholder="مثال: خطأ في إدخال الصنف / تراجع الزبون..." class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-4 py-3 text-sm text-white mb-4" />
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200 font-semibold">تراجع</button>
            <button onclick="confirmCancelOrder('${order.id}')" class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">تأكيد الإلغاء</button>
          </div>
        </div>
      `);
};
window.openAddWaiterModal = function () {
  openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gold-400">إضافة نادل جديد</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <div class="space-y-3 mb-5">
            <div>
              <label class="block text-xs text-gray-400 mb-1">اسم النادل</label>
              <input id="new-waiter-name" type="text" placeholder="مثال: كريم" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">رمز الدخول السري (4 إلى 12 رقماً)</label>
              <input id="new-waiter-pin" type="password" maxlength="12" placeholder="مثال: 3333" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white text-center tracking-widest font-bold" dir="ltr" />
            </div>
          </div>
          <button onclick="saveNewWaiter()" class="w-full py-3 rounded-xl gold-btn font-bold">حفظ وإضافة النادل</button>
        </div>
      `);
};
window.openChangeWaiterPinModal = function (userId) {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return;
  openModal(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-gold-400 mb-3">تغيير رمز PIN للنادل: ${u.name}</h3>
          <input id="edit-waiter-pin" type="password" maxlength="12" value="" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-bold text-white mb-4" dir="ltr" />
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200">إلغاء</button>
            <button onclick="saveWaiterPin('${u.id}')" class="flex-1 py-2.5 rounded-xl gold-btn font-bold">حفظ الرمز</button>
          </div>
        </div>
      `);
};
window.openAddCustomerModal = function () {
  openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gold-400">إضافة زبون جديد</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <div class="space-y-3 mb-5">
            <div>
              <label class="block text-xs text-gray-400 mb-1">اسم الزبون</label>
              <input id="cust-name" type="text" placeholder="الاسم الكامل" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">رقم الهاتف</label>
              <input id="cust-phone" type="text" placeholder="06..." class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">الحد الأقصى للدين (درهم)</label>
              <input id="cust-limit" type="number" value="${db.settings.defaultDebtLimit}" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
            </div>
          </div>
          <button onclick="saveNewCustomer()" class="w-full py-3 rounded-xl gold-btn font-bold">حفظ الزبون</button>
        </div>
      `);
};
window.openDebtPaymentModal = function (customerId) {
  const c = db.customers.find((x) => x.id === customerId);
  if (!c) return;
  openModal(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-gold-400 mb-1">تسجيل تسديد دين</h3>
          <p class="text-xs text-gray-400 mb-4">الزبون: <strong class="text-white">${c.name}</strong> • الدين الحالي: <strong class="text-amber-400">${formatMoney(c.balance)}</strong></p>
          <input id="debt-pay-amount" type="number" step="0.5" max="${c.balance}" value="${c.balance}" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-4 py-3 text-center text-xl font-bold text-emerald-400 mb-4" dir="ltr" />
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200">إلغاء</button>
            <button onclick="confirmDebtPayment('${c.id}')" class="flex-1 py-2.5 rounded-xl gold-btn font-bold">تأكيد التسديد</button>
          </div>
        </div>
      `);
};
window.openCategoryModal = function (catId = null) {
  const cat = catId ? db.categories.find((c) => c.id === catId) : null;
  openModal(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-gold-400 mb-4">${cat ? "تعديل القسم" : "إضافة قسم جديد"}</h3>
          <input id="cat-name-input" type="text" value="${cat ? cat.name : ""}" placeholder="اسم القسم (مثال: العصائر الطازجة)" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-4 py-3 text-sm text-white mb-4" />
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200">إلغاء</button>
            <button onclick="saveCategory('${catId || ""}')" class="flex-1 py-2.5 rounded-xl gold-btn font-bold">حفظ</button>
          </div>
        </div>
      `);
};
window.openProductModal = function (prodId = null) {
  const prod = prodId ? db.products.find((p) => p.id === prodId) : null;
  openModal(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-gold-400 mb-4">${prod ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
          <div class="space-y-3 mb-5">
            <div>
              <label class="block text-xs text-gray-400 mb-1">اسم المنتج</label>
              <input id="prod-name-input" type="text" value="${prod ? prod.name : ""}" placeholder="مثال: عصير برتقال طازج" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">القسم</label>
              <select id="prod-cat-input" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white">
                ${db.categories.map((c) => `<option value="${c.id}" ${prod && prod.categoryId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">السعر (درهم)</label>
              <input id="prod-price-input" type="number" step="0.5" value="${prod ? prod.price : ""}" placeholder="15" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
            </div>
          </div>
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200">إلغاء</button>
            <button onclick="saveProduct('${prodId || ""}')" class="flex-1 py-2.5 rounded-xl gold-btn font-bold">حفظ المنتج</button>
          </div>
        </div>
      `);
};
window.openAddExpenseModal = function () {
  openModal(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-gold-400 mb-4">تسجيل مصروف جديد</h3>
          <div class="space-y-3 mb-5">
            <div>
              <label class="block text-xs text-gray-400 mb-1">فئة المصروف</label>
              <select id="exp-cat-input" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white">
                <option value="شراء البرتقال">شراء البرتقال (للعصير الطازج)</option>
                <option value="مشتريات ومواد أولية">مشتريات ومواد أولية (بن، حليب، سكر...)</option>
                <option value="ماء وكهرباء وإنترنت">ماء وكهرباء وإنترنت</option>
                <option value="صيانة وتجهيزات">صيانة وتجهيزات</option>
                <option value="أجور ومصاريف أخرى">أجور ومصاريف أخرى</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">المبلغ (درهم)</label>
              <input id="exp-amount-input" type="number" step="0.5" placeholder="50" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">ملاحظة</label>
              <input id="exp-note-input" type="text" placeholder="تفاصيل المصروف..." class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" />
            </div>
          </div>
          <div class="flex gap-3">
            <button onclick="closeModal()" class="flex-1 py-2.5 rounded-xl bg-charcoal-700 text-gray-200">إلغاء</button>
            <button onclick="saveNewExpense()" class="flex-1 py-2.5 rounded-xl gold-btn font-bold">تسجيل المصروف</button>
          </div>
        </div>
      `);
};
function renderWaiterPOS() {
  const waiter = uiState.currentUser;
  const myShift = getOpenShiftForWaiter(waiter.id);
  const anyOpenShift = getAnyOpenShift();
  const lockedByOtherWaiter =
    anyOpenShift && anyOpenShift.waiterId !== waiter.id;
  const cartTotal = uiState.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const filteredProducts = db.products.filter(
    (p) => p.categoryId === uiState.selectedCategory,
  );
  return `
        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <!-- Left/Main Area: Categories & Touch Product Grid -->
          <div class="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto">
            <!-- Waiter Top Bar -->
            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-500/40 text-gold-400 flex items-center justify-center font-bold">
                  <i class="fa-solid fa-user-tie"></i>
                </div>
                <div>
                  <div class="font-bold text-white text-sm">النادل: ${waiter.name}</div>
                  <div class="text-xs text-gray-400">
                    ${myShift ? `<span class="text-emerald-400">● وردية مفتوحة (${formatTime(myShift.startTime)})</span>` : lockedByOtherWaiter ? `<span class="text-red-400">● مقفلة: وردية ${anyOpenShift.waiterName} نشطة</span>` : '<span class="text-gray-400">● تبدأ الوردية تلقائياً عند أول طلب</span>'}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${
                  myShift
                    ? `
                  <button onclick="openCloseShiftModal('${myShift.id}')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold">
                    <i class="fa-solid fa-lock ml-1"></i> إغلاق الوردية
                  </button>
                `
                    : ""
                }
                <button onclick="logoutUser()" class="px-3.5 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-600 text-gray-300 text-xs font-semibold">
                  <i class="fa-solid fa-right-from-bracket ml-1"></i> خروج
                </button>
              </div>
            </div>

            ${
              lockedByOtherWaiter
                ? `
              <div class="bg-red-950/60 border border-red-500/50 rounded-2xl p-4 mb-4 text-red-200 text-sm flex items-center gap-3">
                <i class="fa-solid fa-triangle-exclamation text-2xl text-red-400"></i>
                <div>
                  <div class="font-bold">لا يمكن تسجيل طلبات حالياً!</div>
                  <div class="text-xs text-red-300">وردية النادل <strong>${anyOpenShift.waiterName}</strong> ما زالت مفتوحة. يجب إغلاقها أولاً قبل فتح وردية جديدة.</div>
                </div>
              </div>
            `
                : ""
            }

            <!-- Category Tabs -->
            <div class="flex gap-2 overflow-x-auto pb-2 mb-3 shrink-0">
              ${db.categories
                .map(
                  (cat) => `
                <button onclick="selectCategory('${cat.id}')" class="px-4 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ${uiState.selectedCategory === cat.id ? "gold-btn" : "bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-700 text-gray-300"}">
                  <i class="fa-solid ${cat.icon || "fa-mug-hot"}"></i>
                  <span>${cat.name}</span>
                </button>
              `,
                )
                .join("")}
            </div>

            <!-- Products Touch Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              ${filteredProducts
                .map(
                  (prod) => `
                <button onclick="addToCart('${prod.id}')" ${!prod.available ? "disabled" : ""} class="p-4 rounded-2xl border text-right flex flex-col justify-between min-h-[105px] transition active:scale-95 ${prod.available ? "bg-charcoal-850 hover:bg-charcoal-800 border-charcoal-700 hover:border-gold-500/50" : "bg-charcoal-950 border-charcoal-800 opacity-45 cursor-not-allowed"}">
                  <div class="font-bold text-white text-sm leading-snug">${prod.name}</div>
                  <div class="flex items-center justify-between mt-3 pt-2 border-t border-charcoal-800">
                    <span class="text-gold-400 font-extrabold text-sm">${formatMoney(prod.price)}</span>
                    ${!prod.available ? '<span class="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">غير متوفر</span>' : '<span class="w-7 h-7 rounded-lg bg-gold-500/15 text-gold-400 flex items-center justify-center text-xs"><i class="fa-solid fa-plus"></i></span>'}
                  </div>
                </button>
              `,
                )
                .join("")}
            </div>
          </div>

          <!-- Right Sidebar: Cart & Checkout -->
          <div class="w-full lg:w-[360px] bg-charcoal-850 border-t lg:border-t-0 lg:border-r border-charcoal-700 p-4 flex flex-col justify-between shrink-0">
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex items-center justify-between pb-3 border-b border-charcoal-700 mb-3">
                <h3 class="font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-receipt text-gold-400"></i>
                  <span>الطلب الحالي</span>
                </h3>
                ${uiState.cart.length > 0 ? `<button onclick="clearCart()" class="text-xs text-red-400 hover:text-red-300">إفراغ السلة</button>` : ""}
              </div>

              <div class="flex-1 overflow-y-auto space-y-2 pr-1">
                ${
                  uiState.cart.length === 0
                    ? `
                  <div class="h-48 flex flex-col items-center justify-center text-gray-500 text-sm">
                    <i class="fa-solid fa-basket-shopping text-3xl mb-2 opacity-40"></i>
                    <span>اضغط على الأصناف لإضافتها</span>
                  </div>
                `
                    : uiState.cart
                        .map(
                          (item) => `
                  <div class="bg-charcoal-900 border border-charcoal-700 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-white text-xs truncate">${item.name}</div>
                      <div class="text-[11px] text-gold-400">${formatMoney(item.price * item.qty)}</div>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button onclick="updateCartQty('${item.productId}', -1)" class="w-8 h-8 rounded-lg bg-charcoal-800 hover:bg-red-950/60 text-gray-200 font-bold">-</button>
                      <span class="w-6 text-center font-bold text-sm">${item.qty}</span>
                      <button onclick="updateCartQty('${item.productId}', 1)" class="w-8 h-8 rounded-lg bg-charcoal-800 hover:bg-gold-500/20 text-gold-400 font-bold">+</button>
                    </div>
                  </div>
                `,
                        )
                        .join("")
                }
              </div>
            </div>

            <div class="border-t border-charcoal-700 pt-3 mt-3 space-y-3">
              <div class="flex items-center justify-between text-lg font-extrabold">
                <span class="text-gray-300">المجموع:</span>
                <span class="text-gold-400">${formatMoney(cartTotal)}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button onclick="processCheckout('cash')" ${uiState.cart.length === 0 || lockedByOtherWaiter ? "disabled" : ""} class="col-span-2 py-3.5 rounded-2xl gold-btn text-base flex items-center justify-center gap-2">
                  <i class="fa-solid fa-money-bill-wave"></i>
                  <span>دفع نقداً وإصدار التذكرة</span>
                </button>
                ${
                  db.settings.debtsEnabled
                    ? `
                  <button onclick="openDebtCustomerPicker()" ${uiState.cart.length === 0 || lockedByOtherWaiter ? "disabled" : ""} class="col-span-2 py-2.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-amber-500/40 text-amber-300 font-bold text-xs disabled:opacity-40">
                    <i class="fa-solid fa-book ml-1"></i> تسجيل على الحساب (دين)
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      `;
}
function renderOwnerDesktopDashboard() {
  const tabs = [
    {
      id: "dashboard",
      label: "لوحة اليوم",
      icon: "fa-chart-pie",
    },
    {
      id: "analytics",
      label: "الإحصائيات والتقييم",
      icon: "fa-chart-line",
    },
    {
      id: "shifts",
      label: "الورديات",
      icon: "fa-clock-rotate-left",
    },
    {
      id: "staff",
      label: "الندل وتقاريرهم",
      icon: "fa-users-gear",
    },
    {
      id: "monthly",
      label: "التقرير الشهري",
      icon: "fa-calendar-days",
    },
    {
      id: "debts",
      label: "الديون",
      icon: "fa-hand-holding-dollar",
    },
    {
      id: "menu",
      label: "الأقسام والمنتجات",
      icon: "fa-mug-hot",
    },
    {
      id: "expenses",
      label: "المصاريف",
      icon: "fa-file-invoice-dollar",
    },
    {
      id: "settings",
      label: "الإعدادات والواي فاي",
      icon: "fa-sliders",
    },
  ];
  return `
        <div class="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-5">
          <!-- Owner Header -->
          <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-gold-500/20 border border-gold-500/50 text-gold-400 flex items-center justify-center text-lg">
                <i class="fa-solid fa-crown"></i>
              </div>
              <div>
                <h2 class="font-bold text-white text-base">لوحة إدارة المالك — ${uiState.currentUser.name}</h2>
                <p class="text-xs text-gray-400">صلاحيات كاملة لإدارة المقهى ومراقبة المداخيل والورديات</p>
              </div>
            </div>
            <button onclick="logoutUser()" class="px-4 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-600 text-gray-300 text-xs font-bold">
              <i class="fa-solid fa-right-from-bracket ml-1"></i> تسجيل الخروج
            </button>
          </div>

          <!-- Navigation Tabs -->
          <div class="flex gap-2 overflow-x-auto pb-1">
            ${tabs
              .map(
                (t) => `
              <button onclick="setOwnerDesktopTab('${t.id}')" class="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${uiState.ownerDesktopTab === t.id ? "gold-btn" : "bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-700 text-gray-300"}">
                <i class="fa-solid ${t.icon}"></i>
                <span>${t.label}</span>
              </button>
            `,
              )
              .join("")}
          </div>

          <!-- Tab Body -->
          <div>${renderOwnerSectionContent(uiState.ownerDesktopTab, "desk")}</div>
        </div>
      `;
}
function renderOwnerSectionContent(tab, prefix = "desk") {
  const m = getTodayMetrics();
  const today = getCurrentBusinessDay();
  if (tab === "dashboard") {
    const todayOrders = db.orders.filter((o) => o.businessDay === today);
    return `
          <div class="space-y-5">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="bg-charcoal-850 border border-gold-500/40 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">الربح الصافي اليوم</div>
                <div class="text-xl sm:text-2xl font-extrabold text-gold-400">${formatMoney(m.netProfit)}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">المداخيل الفعلية (نقد + تسديد)</div>
                <div class="text-xl sm:text-2xl font-extrabold text-emerald-400">${formatMoney(m.totalRevenue)}</div>
                <div class="text-[11px] text-gray-500 mt-1">نقدي: ${formatMoney(m.cashSales)} | تسديد: ${formatMoney(m.debtCollections)}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">مصاريف اليوم</div>
                <div class="text-xl sm:text-2xl font-extrabold text-red-400">${formatMoney(m.totalExpenses)}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">الطلبات / على الحساب</div>
                <div class="text-xl sm:text-2xl font-extrabold text-white">${m.validOrdersCount} طلبات</div>
                <div class="text-[11px] text-amber-400 mt-1">على الحساب: ${formatMoney(m.debtSales)}</div>
              </div>
            </div>

            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
              <h3 class="font-bold text-white text-sm mb-3">طلبات اليوم التجاري (${today})</h3>
              <div class="space-y-2">
                ${todayOrders
                  .map(
                    (o) => `
                  <div class="bg-charcoal-900 border border-charcoal-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span class="font-bold text-gold-400">#${o.dailyNumber}</span>
                      <span class="text-white font-semibold mr-2">${o.waiterName}</span>
                      <span class="text-gray-400 mr-2">${formatTime(o.createdAt)}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] mr-2 ${o.paymentMethod === "cash" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}">
                        ${o.paymentMethod === "cash" ? "نقداً" : "على الحساب"}
                      </span>
                      ${o.status === "cancelled" ? `<span class="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 mr-1">ملغاة: ${o.cancelReason}</span>` : ""}
                    </div>
                    <div class="flex items-center gap-2">
                      <strong class="text-white text-sm">${formatMoney(o.total)}</strong>
                      <button onclick="openReceiptModal('${o.id}')" class="px-2.5 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-gray-300">التذكرة</button>
                      ${o.status === "paid" ? `<button onclick="openCancelOrderModal('${o.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400">إلغاء</button>` : ""}
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        `;
  }
  if (tab === "analytics") {
    const an = getAnalyticsData();
    return `
          <div class="space-y-5">
            <!-- Orange Juice Revenue vs Orange Purchase Expenses Comparison -->
            <div class="bg-gradient-to-br from-charcoal-850 to-amber-950/20 border border-amber-500/40 rounded-2xl p-4 sm:p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-bold text-amber-300 text-sm sm:text-base flex items-center gap-2">
                  <i class="fa-solid fa-lemon text-amber-400"></i>
                  <span>مقارنة مصاريف شراء البرتقال بإجمالي مبيعات عصير البرتقال</span>
                </h3>
                <span class="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold">فرق البيع والتكلفة: ${an.orangeMarginPct}%</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="bg-charcoal-900/90 border border-charcoal-700 rounded-xl p-3.5">
                  <span class="text-gray-400 block mb-1">إجمالي مبيعات عصير البرتقال</span>
                  <strong class="text-lg text-emerald-400">${formatMoney(an.orangeJuiceRevenue)}</strong>
                  <span class="text-[11px] text-gray-400 block mt-1">عدد الكؤوس المباعة: ${an.orangeJuiceQty} كأس</span>
                </div>
                <div class="bg-charcoal-900/90 border border-charcoal-700 rounded-xl p-3.5">
                  <span class="text-gray-400 block mb-1">مصاريف شراء البرتقال</span>
                  <strong class="text-lg text-red-400">${formatMoney(an.orangePurchaseCost)}</strong>
                  <span class="text-[11px] text-gray-400 block mt-1">من سجل المصاريف (فئة شراء البرتقال)</span>
                </div>
                <div class="bg-charcoal-900/90 border border-gold-500/40 rounded-xl p-3.5">
                  <span class="text-gray-400 block mb-1">فرق المبيعات وتكلفة البرتقال</span>
                  <strong class="text-lg ${an.orangeNetProfit >= 0 ? "text-gold-400" : "text-red-400"}">${formatMoney(an.orangeNetProfit)}</strong>
                  <span class="text-[11px] text-gray-400 block mt-1">${an.orangeNetProfit >= 0 ? "قبل بقية التكاليف والتحصيل" : "التكلفة تتجاوز المبيعات حالياً"}</span>
                </div>
              </div>
            </div>

            <!-- Management KPIs -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">متوسط قيمة التذكرة</div>
                <div class="text-lg font-extrabold text-white">${formatMoney(an.avgTicket)}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">ساعة الذروة في المقهى</div>
                <div class="text-lg font-extrabold text-gold-400">${an.peakHour}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400 mb-1">نسبة إلغاء الطلبات</div>
                <div class="text-lg font-extrabold text-amber-400">${an.cancelRate}%</div>
              </div>
            </div>

            <!-- Statistics by Product & Days -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <h4 class="font-bold text-white text-sm mb-3">الإحصائيات حسب المنتج (الأكثر مبيعاً (النقد والديون))</h4>
                <div class="space-y-2.5 max-h-80 overflow-y-auto">
                  ${an.productStats
                    .map((p) => {
                      const pct =
                        an.totalAllRevenue > 0
                          ? Math.round((p.revenue / an.totalAllRevenue) * 100)
                          : 0;
                      return `
                      <div class="bg-charcoal-900 border border-charcoal-800 rounded-xl p-3 text-xs">
                        <div class="flex justify-between font-bold mb-1">
                          <span class="text-white">${p.name} (${p.qty} وحدة)</span>
                          <span class="text-gold-400">${formatMoney(p.revenue)} (${pct}%)</span>
                        </div>
                        <div class="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
                          <div class="h-full bg-gold-500 rounded-full" style="width: ${pct}%"></div>
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>

              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <h4 class="font-bold text-white text-sm mb-3">الإحصائيات حسب الأيام التجارية</h4>
                <div class="space-y-2 max-h-80 overflow-y-auto">
                  ${an.dailyStats
                    .map(
                      (d) => `
                    <div class="bg-charcoal-900 border border-charcoal-800 rounded-xl p-3 text-xs space-y-1">
                      <div class="flex justify-between font-bold">
                        <span class="text-white">${d.day} (${d.ordersCount} طلبات)</span>
                        <span class="${d.netProfit >= 0 ? "text-gold-400" : "text-red-400"}">الصافي: ${formatMoney(d.netProfit)}</span>
                      </div>
                      <div class="flex justify-between text-gray-400 text-[11px]">
                        <span>المداخيل: <strong class="text-emerald-400">${formatMoney(d.revenue)}</strong></span>
                        <span>المصاريف: <strong class="text-red-400">${formatMoney(d.expenses)}</strong></span>
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>
        `;
  }
  if (tab === "shifts") {
    return `
          <div class="space-y-3">
            ${db.shifts
              .map((sh) => {
                recalculateShiftTotals(sh.id);
                const statusBadge =
                  sh.status === "open"
                    ? '<span class="px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">مفتوحة الآن</span>'
                    : sh.status === "closed"
                      ? '<span class="px-2.5 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300">بانتظار تأكيد الاستلام</span>'
                      : '<span class="px-2.5 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">مؤكدة ومصفاة</span>';
                return `
                <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <strong class="text-white text-base">${sh.waiterName}</strong>
                      ${statusBadge}
                      <span class="text-xs text-gray-400">${sh.businessDay}</span>
                    </div>
                    <div class="text-xs text-gray-400">
                      المفروض نقداً: <strong class="text-emerald-400">${formatMoney(sh.expectedCash)}</strong>
                      • على الحساب: <strong class="text-amber-400">${formatMoney(sh.onAccountTotal)}</strong>
                      ${sh.handedCash !== null ? `• المسلّم: <strong class="text-white">${formatMoney(sh.handedCash)}</strong> • الفرق: <strong class="${sh.difference >= 0 ? "text-emerald-400" : "text-red-400"}">${formatMoney(sh.difference)}</strong>` : ""}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button onclick="openShiftReportModal('${sh.id}')" class="px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-xs text-gray-200 font-semibold">
                      <i class="fa-solid fa-file-lines ml-1"></i> تقرير الوردية
                    </button>
                    ${
                      sh.status === "closed"
                        ? `
                      <button onclick="confirmShiftReceipt('${sh.id}')" class="px-3.5 py-2 rounded-xl gold-btn text-xs font-bold">
                        <i class="fa-solid fa-check-double ml-1"></i> تأكيد الاستلام
                      </button>
                    `
                        : ""
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `;
  }
  if (tab === "staff") {
    const waiters = db.users.filter((u) => u.role === "waiter" && !u.archived);
    return `
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-white">إدارة الندل وتقارير المقبوضات</h3>
              <button onclick="openAddWaiterModal()" class="px-4 py-2 rounded-xl gold-btn text-xs font-bold">
                <i class="fa-solid fa-user-plus ml-1"></i> إضافة نادل جديد
              </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${waiters
                .map((w) => {
                  const allCash = db.orders
                    .filter(
                      (o) =>
                        o.waiterId === w.id &&
                        o.status === "paid" &&
                        o.paymentMethod === "cash",
                    )
                    .reduce((s, o) => s + o.total, 0);
                  const todayCash = db.orders
                    .filter(
                      (o) =>
                        o.waiterId === w.id &&
                        o.businessDay === today &&
                        o.status === "paid" &&
                        o.paymentMethod === "cash",
                    )
                    .reduce((s, o) => s + o.total, 0);
                  const allDebt = db.orders
                    .filter(
                      (o) =>
                        o.waiterId === w.id &&
                        o.status === "paid" &&
                        o.paymentMethod === "debt",
                    )
                    .reduce((s, o) => s + o.total, 0);
                  const hasOpenShift = db.shifts.some(
                    (s) => s.waiterId === w.id && s.status === "open",
                  );
                  const hasUnconfirmedShift = db.shifts.some(
                    (s) => s.waiterId === w.id && s.status === "closed",
                  );
                  const canDelete = !hasOpenShift && !hasUnconfirmedShift;
                  const lockReason = hasOpenShift
                    ? "ورديته مفتوحة حالياً"
                    : hasUnconfirmedShift
                      ? "بانتظار تأكيد حساب ورديته"
                      : "";
                  return `
                  <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="font-bold text-white text-base">${w.name}</span>
                        <span class="text-xs text-gray-400 mr-2">PIN: <strong class="text-gold-400">••••</strong></span>
                      </div>
                      <span class="px-2.5 py-0.5 rounded-full text-xs ${w.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}">
                        ${w.active ? "نشط" : "معطّل"}
                      </span>
                    </div>
                    ${
                      !canDelete
                        ? `
                      <div class="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2.5 py-1">
                        <i class="fa-solid fa-shield-halved ml-1"></i> لا يمكن الأرشفة أو التعطيل: ${lockReason}
                      </div>
                    `
                        : ""
                    }
                    <div class="grid grid-cols-3 gap-2 bg-charcoal-900 p-3 rounded-xl text-xs">
                      <div>
                        <span class="text-gray-400 block">قبض اليوم</span>
                        <strong class="text-emerald-400">${formatMoney(todayCash)}</strong>
                      </div>
                      <div>
                        <span class="text-gray-400 block">إجمالي النقدي</span>
                        <strong class="text-white">${formatMoney(allCash)}</strong>
                      </div>
                      <div>
                        <span class="text-gray-400 block">على الحساب</span>
                        <strong class="text-amber-400">${formatMoney(allDebt)}</strong>
                      </div>
                    </div>
                    <div class="flex gap-2 pt-1">
                      <button onclick="openChangeWaiterPinModal('${w.id}')" class="flex-1 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-xs text-gray-200">تغيير PIN</button>
                      <button onclick="toggleWaiterActive('${w.id}')" class="px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-xs text-amber-300">${w.active ? "تعطيل" : "تفعيل"}</button>
                      <button onclick="deleteWaiter('${w.id}')" class="px-3 py-2 rounded-xl text-xs ${canDelete ? "bg-red-950/50 hover:bg-red-900/60 text-red-400" : "bg-charcoal-900 text-gray-600 cursor-not-allowed"}" title="${canDelete ? "أرشفة النادل" : lockReason}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
  }
  if (tab === "monthly") {
    const month = uiState.selectedReportMonth;
    const mCash = db.orders
      .filter(
        (o) =>
          o.businessDay.startsWith(month) &&
          o.status === "paid" &&
          o.paymentMethod === "cash",
      )
      .reduce((s, o) => s + o.total, 0);
    const mDebtCol = db.debtPayments
      .filter((p) => p.businessDay.startsWith(month))
      .reduce((s, p) => s + p.amount, 0);
    const mRev = mCash + mDebtCol;
    const mExp = db.expenses
      .filter((e) => e.businessDay.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
    const mNet = mRev - mExp;
    return `
          <div class="space-y-4">
            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <h3 class="font-bold text-white">التقرير الشهري لمداخيل ومصاريف المقهى</h3>
              <input type="month" value="${month}" onchange="changeSelectedReportMonth(this.value)" class="bg-charcoal-950 border border-charcoal-600 rounded-xl px-3 py-2 text-xs text-white" dir="ltr" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400">إجمالي مداخيل الشهر</div>
                <div class="text-xl font-extrabold text-emerald-400 mt-1">${formatMoney(mRev)}</div>
              </div>
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
                <div class="text-xs text-gray-400">إجمالي مصاريف الشهر</div>
                <div class="text-xl font-extrabold text-red-400 mt-1">${formatMoney(mExp)}</div>
              </div>
              <div class="bg-charcoal-850 border border-gold-500/40 rounded-2xl p-4">
                <div class="text-xs text-gray-400">الربح الصافي للشهر</div>
                <div class="text-xl font-extrabold text-gold-400 mt-1">${formatMoney(mNet)}</div>
              </div>
            </div>
          </div>
        `;
  }
  if (tab === "debts") {
    return `
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-white">ديون الزبائن</h3>
              <button onclick="openAddCustomerModal()" class="px-4 py-2 rounded-xl gold-btn text-xs font-bold">
                <i class="fa-solid fa-user-plus ml-1"></i> إضافة زبون
              </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${db.customers
                .map(
                  (c) => `
                <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div class="font-bold text-white">${c.name}</div>
                    <div class="text-xs text-gray-400">${c.phone || "بدون هاتف"} • الحد: ${formatMoney(c.limit)}</div>
                    <div class="text-sm font-extrabold text-amber-400 mt-1">المتبقي: ${formatMoney(c.balance)}</div>
                  </div>
                  ${
                    c.balance > 0
                      ? `
                    <button onclick="openDebtPaymentModal('${c.id}')" class="px-3.5 py-2 rounded-xl gold-btn text-xs font-bold">تسجيل تسديد</button>
                  `
                      : '<span class="text-xs text-emerald-400">خالص</span>'
                  }
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `;
  }
  if (tab === "menu") {
    return `
          <div class="space-y-5">
            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
              <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-white text-sm">الأقسام</h3>
                <button onclick="openCategoryModal()" class="px-3 py-1.5 rounded-xl gold-btn text-xs font-bold">+ قسم جديد</button>
              </div>
              <div class="flex flex-wrap gap-2">
                ${db.categories
                  .map(
                    (c) => `
                  <div class="bg-charcoal-900 border border-charcoal-700 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                    <span class="font-bold text-white">${c.name}</span>
                    <button onclick="openCategoryModal('${c.id}')" class="text-gold-400"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteCategory('${c.id}')" class="text-red-400"><i class="fa-solid fa-trash"></i></button>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>

            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4">
              <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-white text-sm">المنتجات والأسعار</h3>
                <button onclick="openProductModal()" class="px-3 py-1.5 rounded-xl gold-btn text-xs font-bold">+ منتج جديد</button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                ${db.products
                  .map((p) => {
                    const cat = db.categories.find(
                      (c) => c.id === p.categoryId,
                    );
                    return `
                    <div class="bg-charcoal-900 border border-charcoal-800 rounded-xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <div class="font-bold text-white">${p.name}</div>
                        <div class="text-gray-400">${cat ? cat.name : ""} • <strong class="text-gold-400">${formatMoney(p.price)}</strong></div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button onclick="toggleProductAvailable('${p.id}')" class="px-2 py-1 rounded ${p.available ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}">${p.available ? "متوفر" : "نفذ"}</button>
                        <button onclick="openProductModal('${p.id}')" class="px-2 py-1 rounded bg-charcoal-800 text-gold-400"><i class="fa-solid fa-pen"></i></button>
                      </div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        `;
  }
  if (tab === "expenses") {
    return `
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-white">سجل المصاريف</h3>
              <button onclick="openAddExpenseModal()" class="px-4 py-2 rounded-xl gold-btn text-xs font-bold">+ تسجيل مصروف</button>
            </div>
            <div class="space-y-2">
              ${db.expenses
                .map(
                  (e) => `
                <div class="bg-charcoal-850 border border-charcoal-700 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <strong class="text-white">${e.category}</strong>
                    <span class="text-gray-400 mr-2">${e.note}</span>
                    <div class="text-[11px] text-gray-500">${e.businessDay}</div>
                  </div>
                  <strong class="text-red-400 text-sm">${formatMoney(e.amount)}</strong>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `;
  }
  if (tab === "settings") {
    return `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 space-y-3">
              <h3 class="font-bold text-white text-sm">بيانات الواي فاي (تُطبع تلقائياً على التذكرة)</h3>
              <div>
                <label class="block text-xs text-gray-400 mb-1">اسم الشبكة (WiFi SSID)</label>
                <input id="${prefix}-wifi-ssid" type="text" value="${db.settings.wifiSSID || ""}" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">كود الواي فاي (Password)</label>
                <input id="${prefix}-wifi-pass" type="text" value="${db.settings.wifiPassword || ""}" class="w-full bg-charcoal-950 border border-charcoal-600 rounded-xl px-3.5 py-2.5 text-sm text-white" dir="ltr" />
              </div>
              <button onclick="saveWifiSettings('${prefix}')" class="w-full py-2.5 rounded-xl gold-btn text-xs font-bold">حفظ كود الواي فاي</button>
            </div>

            <div class="bg-charcoal-850 border border-charcoal-700 rounded-2xl p-4 space-y-4">
              <h3 class="font-bold text-white text-sm">التحكم في الصلاحيات والديون</h3>
              <div class="flex items-center justify-between bg-charcoal-900 p-3 rounded-xl">
                <div>
                  <div class="font-bold text-white text-xs">نظام ديون الزبائن (على الحساب)</div>
                  <div class="text-[11px] text-gray-400">إظهار أو إخفاء خيار الدين لدى الندل</div>
                </div>
                <button onclick="toggleDebtsSystem()" class="px-4 py-2 rounded-xl text-xs font-bold ${db.settings.debtsEnabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"}">
                  ${db.settings.debtsEnabled ? "مفعّل" : "معطّل"}
                </button>
              </div>
            </div>
          </div>
        `;
  }
  return "";
}
function renderAndroidDesign() {
  const container = document.getElementById("android-app-content");
  if (!container) return;
  const unreadCount = db.notifications.filter((n) => n.unread).length;
  const androidTabs = [
    {
      id: "home",
      label: "اليوم",
      icon: "fa-house",
    },
    {
      id: "analytics",
      label: "الإحصائيات",
      icon: "fa-chart-line",
    },
    {
      id: "shifts",
      label: "الورديات",
      icon: "fa-clock-rotate-left",
    },
    {
      id: "staff",
      label: "الندل",
      icon: "fa-users-gear",
    },
    {
      id: "monthly",
      label: "الشهري",
      icon: "fa-calendar-days",
    },
    {
      id: "debts",
      label: "الديون",
      icon: "fa-hand-holding-dollar",
    },
    {
      id: "menu",
      label: "القائمة",
      icon: "fa-mug-hot",
    },
    {
      id: "expenses",
      label: "المصاريف",
      icon: "fa-file-invoice-dollar",
    },
    {
      id: "settings",
      label: "الإعدادات",
      icon: "fa-sliders",
    },
  ];
  let bodyHtml = "";
  if (uiState.androidTab === "alerts") {
    bodyHtml = `
          <div class="space-y-2.5">
            <h4 class="font-bold text-gold-400 text-xs mb-2">الإشعارات والتنبيهات الفورية</h4>
            ${db.notifications
              .map(
                (n) => `
              <div class="bg-charcoal-850 border border-charcoal-700 rounded-xl p-3 text-xs">
                <div class="flex justify-between font-bold text-white mb-1">
                  <span>${n.title}</span>
                  <span class="text-[10px] text-gray-400">${formatTime(n.time)}</span>
                </div>
                <p class="text-gray-300 text-[11px]">${n.body}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        `;
  } else {
    const mappedTab =
      uiState.androidTab === "home" ? "dashboard" : uiState.androidTab;
    bodyHtml = renderOwnerSectionContent(mappedTab, "mob");
  }
  mount(
    container,
    `
        <!-- Android App Top Header -->
        <div class="bg-charcoal-950 px-3.5 py-2.5 border-b border-charcoal-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-black border border-gold-500/40 p-0.5">
              ${getBrandLogoSvg("gold", "w-full h-full")}
            </div>
            <div>
              <div class="font-bold text-white text-xs">${uiState.currentUser?.name || "المالك"}</div>
              <div class="text-[10px] text-emerald-400">معاينة مصرح بها لواجهة الهاتف</div>
            </div>
          </div>
          <button onclick="setAndroidTab('alerts')" class="relative w-9 h-9 rounded-xl bg-charcoal-850 border border-charcoal-700 text-gold-400 flex items-center justify-center">
            <i class="fa-solid fa-bell text-sm"></i>
            ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">${unreadCount}</span>` : ""}
          </button>
        </div>

        <!-- Scrollable Responsive Navigation Strip -->
        <div class="bg-charcoal-950/80 px-2 py-2 border-b border-charcoal-800 flex gap-1.5 overflow-x-auto shrink-0">
          ${androidTabs
            .map(
              (t) => `
            <button onclick="setAndroidTab('${t.id}')" class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition ${uiState.androidTab === t.id ? "gold-btn" : "bg-charcoal-850 text-gray-300 border border-charcoal-700"}">
              <i class="fa-solid ${t.icon}"></i>
              <span>${t.label}</span>
            </button>
          `,
            )
            .join("")}
        </div>

        <!-- Android Scrollable Body -->
        <div class="flex-1 overflow-y-auto p-3">
          ${bodyHtml}
        </div>
      `,
  );
}
