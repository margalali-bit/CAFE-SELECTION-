"use strict";
let raw = null,
  info = {},
  token = null,
  busy = false,
  selectedAccount = null,
  requestId = null;
let db = {
  settings: {},
  users: [],
  categories: [],
  products: [],
  customers: [],
  orders: [],
  shifts: [],
  debtPayments: [],
  expenses: [],
  auditLog: [],
  notifications: [],
};
let uiState = {
  workspaceMode: "desktop",
  currentUser: null,
  pinInput: "",
  selectedCategory: "",
  cart: [],
  ownerDesktopTab: "dashboard",
  androidTab: "home",
  selectedReportMonth: "",
  lastReceiptOrder: null,
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const actions = Object.create(null);
async function call(method, args = {}) {
  const result = window.cafe
    ? await window.cafe.call(method, { token, args })
    : await (
        await fetch("/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, token, args }),
        })
      ).json();
  if (!result.ok) throw Error(result.error);
  return result.value;
}
async function run(fn) {
  if (busy) return;
  busy = true;
  document.body.dataset.busy = "true";
  try {
    await fn();
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    busy = false;
    document.body.dataset.busy = "false";
  }
}
// Bind a small fixed grammar of template actions, never eval/Function or inline JS.
async function dispatch(source, element) {
  for (const part of source
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const match = /^(?:window\.)?([A-Za-z][\w]*)\((.*)\)$/.exec(part);
    if (!match || !actions[match[1]]) throw Error("عملية واجهة غير معتمدة");
    const args = [];
    let rest = match[2].trim();
    while (rest) {
      const m =
        /^(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?)|(this\.value))(?:\s*,\s*|$)/.exec(
          rest,
        );
      if (!m) throw Error("وسيط واجهة غير صالح");
      args.push(
        m[1] ?? m[2] ?? (m[3] !== undefined ? Number(m[3]) : element.value),
      );
      rest = rest.slice(m[0].length);
    }
    await actions[match[1]](...args);
  }
}
function mount(element, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll("*")) {
    if (node.tagName === "I" || node.tagName === "SVG")
      node.setAttribute("aria-hidden", "true");
    for (const attr of [...node.attributes]) {
      if (attr.name.startsWith("on")) {
        node.removeAttribute(attr.name);
        const type = attr.name.slice(2);
        node.addEventListener(type, (e) => {
          e.preventDefault();
          run(() => dispatch(attr.value, node));
        });
      }
      if (attr.name === "style") {
        node.removeAttribute("style");
        node.style.cssText = attr.value;
      }
    }
    if (
      node.tagName === "LABEL" &&
      !node.htmlFor &&
      node.nextElementSibling?.id
    )
      node.htmlFor = node.nextElementSibling.id;
  }
  element.replaceChildren(template.content);
}
function showToast(message, type = "info") {
  const item = document.createElement("div");
  item.className =
    "pointer-events-auto bg-charcoal-850 border border-gold-500 rounded-xl px-5 py-4 shadow-2xl text-sm " +
    (type === "error" ? "text-red-300" : "text-gold-300");
  item.setAttribute("role", "status");
  item.textContent = message;
  document.getElementById("toast-container").append(item);
  setTimeout(() => item.remove(), 4500);
}
function openModal(html) {
  mount(document.getElementById("modal-content"), html);
  document.getElementById("modal-backdrop").classList.replace("hidden", "flex");
}
function closeModal() {
  document.getElementById("modal-backdrop").classList.replace("flex", "hidden");
}
function input(id) {
  return document.getElementById(id)?.value || "";
}
function getCurrentBusinessDay() {
  return (
    raw?.business_day ||
    info.business_day ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  );
}
function adapt(s) {
  const users = s.users || [s.user];
  const person = (id) =>
    users.find((u) => u.id === id)?.name ||
    info.accounts?.find((u) => u.id === id)?.name ||
    "";
  const settings = s.settings || {};
  db = {
    settings: {
      debtsEnabled: settings.debts_enabled,
      defaultDebtLimit: settings.default_credit_limit / 100 || 0,
      whoAddsCustomers: settings.waiter_add_customers ? "both" : "owner",
      whoRecordsPayments: settings.waiter_record_payments ? "both" : "owner",
      businessDayStartHour: settings.day_start,
      wifiSSID: esc(settings.wifi_ssid),
      wifiPassword: esc(settings.wifi_password),
    },
    users: users.map((u) => ({
      ...u,
      name: esc(u.name),
      role: u.role === "admin" ? "owner" : "waiter",
      active: !!u.active,
    })),
    categories: s.categories.map((c) => ({
      ...c,
      name: esc(c.name),
      icon: /قهوة/.test(c.name)
        ? "fa-mug-hot"
        : /فطور/.test(c.name)
          ? "fa-bread-slice"
          : /حلوي/.test(c.name)
            ? "fa-cookie-bite"
            : "fa-glass-water",
    })),
    products: s.products.map((p) => ({
      ...p,
      name: esc(p.name),
      categoryId: p.category_id,
      price: p.price / 100,
      available: !!p.available,
    })),
    customers: s.customers.map((c) => ({
      ...c,
      name: esc(c.name),
      phone: esc(c.phone),
      limit: c.credit_limit / 100,
      balance: c.balance / 100,
    })),
    orders: s.orders.map((o) => ({
      ...o,
      dailyNumber: o.number,
      businessDay: o.business_day,
      shiftId: o.shift_id,
      waiterId: o.user_id,
      waiterName: esc(person(o.user_id)),
      total: o.total / 100,
      paymentMethod: o.payment === "credit" ? "debt" : "cash",
      customerId: o.customer_id,
      cancelReason: esc(o.cancel_reason),
      cancelledBy: esc(person(o.cancelled_by)),
      createdAt: o.created_at,
      items: (s.order_items || [])
        .filter((i) => i.order_id === o.id)
        .map((i) => ({
          productId: i.product_id,
          name: esc(i.name),
          price: i.unit_price / 100,
          qty: i.quantity,
        })),
    })),
    shifts: s.shifts.map((sh) => ({
      ...sh,
      waiterId: sh.user_id,
      waiterName: esc(sh.waiter || person(sh.user_id)),
      businessDay: sh.business_day,
      startTime: sh.opened_at,
      endTime: sh.closed_at,
      expectedCash: sh.expected / 100,
      handedCash: sh.delivered == null ? null : sh.delivered / 100,
      difference: sh.difference == null ? null : sh.difference / 100,
      onAccountTotal:
        s.orders
          .filter(
            (o) =>
              o.shift_id === sh.id &&
              o.payment === "credit" &&
              o.status === "paid",
          )
          .reduce((a, o) => a + o.total, 0) / 100,
    })),
    debtPayments: (s.debt_payments || []).map((p) => ({
      ...p,
      customerId: p.customer_id,
      amount: p.amount / 100,
      businessDay: p.business_day,
      date: p.created_at,
      recordedBy: esc(person(p.user_id)),
    })),
    expenses: (s.expenses || []).map((e) => ({
      ...e,
      amount: e.amount / 100,
      category: esc(e.category),
      note: esc(e.notes || e.title),
      businessDay: e.business_day,
      date: e.created_at,
    })),
    auditLog: (s.audit || []).map((a) => ({
      id: a.id,
      action: esc(a.action),
      detail: esc(a.entity_id || ""),
      user: esc(person(a.user_id)),
      timestamp: a.created_at,
      type: "info",
    })),
    notifications: [],
  };
  uiState.currentUser = {
    ...s.user,
    name: esc(s.user.name),
    role: s.user.role === "admin" ? "owner" : "waiter",
  };
  if (
    !uiState.selectedCategory ||
    !db.categories.some((c) => c.id === uiState.selectedCategory)
  )
    uiState.selectedCategory = db.categories[0]?.id || "";
  if (!uiState.selectedReportMonth)
    uiState.selectedReportMonth = s.business_day.slice(0, 7);
}
async function refresh() {
  info = await call("info");
  if (token) {
    raw = await call("state");
    adapt(raw);
  }
  renderAll();
}
function syncStatus() {
  const label = document.getElementById("business-day-label");
  label.textContent = "اليوم التجاري: " + getCurrentBusinessDay();
  const status = document.getElementById("sync-indicator");
  status.textContent = !info.sync?.configured
    ? "محلي · السحابة غير مهيأة"
    : info.sync.state === "online"
      ? "متصل بالسحابة · " + (raw?.pending || 0) + " بانتظار الإقرار"
      : "محلي · تنتظر العمليات عودة الاتصال";
  status.className =
    "text-[11px] " +
    (info.sync?.state === "online" ? "text-emerald-400" : "text-amber-300");
}
function renderLoginScreen() {
  if (info.setup)
    return `<div class="max-w-md w-full m-auto p-6"><div class="bg-charcoal-850 border border-charcoal-700 p-7 rounded-3xl">${getBrandLogoSvg()}<h1 class="text-xl font-bold text-gold-400 text-center mb-6">إعداد حساب المالك</h1><label for="setup-name" class="text-xs text-gray-400">اسم المالك</label><input id="setup-name" class="form-input mt-2 mb-4" autocomplete="username"><label for="setup-pin" class="text-xs text-gray-400">PIN من 4 إلى 12 رقماً</label><input id="setup-pin" class="form-input mt-2 mb-4" type="password" inputmode="numeric" maxlength="12"><button onclick="setupOwner()" class="gold-btn w-full py-3 rounded-xl">إنشاء حساب المالك</button><p class="text-xs text-gray-500 mt-4">لا توجد حسابات افتراضية أو مبيعات تجريبية في قاعدة التشغيل.</p></div></div>`;
  return `<div class="flex-1 flex items-center justify-center p-5"><div class="w-full max-w-md rounded-3xl border border-charcoal-700 bg-charcoal-850 p-7 text-center shadow-2xl"><div class="w-32 h-32 mx-auto mb-4 rounded-3xl bg-black border border-gold-500/40">${getBrandLogoSvg("gold", "w-full h-full")}</div><h1 class="text-lg font-bold text-white mb-2">مرحباً بك في Café Sélection</h1><p class="text-xs text-gray-400 mb-4">اختر الحساب، ثم أدخل رمز PIN السري</p><select id="login-account" onchange="selectAccount(this.value)" aria-label="الحساب" class="form-input mb-4"><option value="">اختر الحساب</option>${(info.accounts || []).map((u) => `<option value="${u.id}" ${selectedAccount === u.id ? "selected" : ""}>${esc(u.name)} · ${u.role === "admin" ? "المالك" : "نادل"}</option>`).join("")}</select><input id="login-pin" aria-label="رمز PIN" type="password" inputmode="numeric" maxlength="12" value="${uiState.pinInput}" class="form-input text-center tracking-widest text-2xl mb-5" oninput="setPinInput(this.value)"><div class="grid grid-cols-3 gap-3" dir="ltr">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => `<button onclick="pressPinDigit('${k}')" class="h-14 rounded-2xl bg-charcoal-800 border border-charcoal-600 text-xl font-bold">${k}</button>`).join("")}</div><button onclick="submitPinLogin()" class="gold-btn w-full rounded-xl py-3 mt-5 font-bold">تسجيل الدخول</button><p class="mt-4 text-[11px] text-gray-500">الرموز محمية بتجزئة scrypt، وقفل مؤقت بعد خمس محاولات خاطئة.</p></div></div>`;
}
function renderDesktopContainer() {
  mount(
    document.getElementById("desktop-container"),
    !uiState.currentUser
      ? renderLoginScreen()
      : uiState.currentUser.role === "owner"
        ? renderOwnerDesktopDashboard()
        : renderWaiterPOS(),
  );
  if (uiState.currentUser?.role === "owner") addOwnerTools();
  else if (uiState.currentUser) {
    const section = document.createElement("div");
    section.className = "p-4";
    mount(
      section,
      `<h3 class="text-sm font-bold text-gray-300 mb-3">طلباتي الأخيرة</h3>${db.orders
        .slice(0, 12)
        .map(
          (o) =>
            `<div class="flex gap-3 items-center text-xs mb-2"><span>#${o.dailyNumber} · ${formatMoney(o.total)}</span><button onclick="openReceiptModal('${o.id}')" class="border border-charcoal-600 rounded-lg p-2">التذكرة</button>${o.status === "paid" ? `<button onclick="openCancelOrderModal('${o.id}')" class="text-red-400 p-2">إلغاء</button>` : "<span>ملغى</span>"}</div>`,
        )
        .join("")}`,
    );
    document.getElementById("desktop-container").append(section);
  }
}
function renderAll() {
  syncStatus();
  renderDesktopContainer();
  if (uiState.currentUser?.role === "owner") renderAndroidDesign();
  else
    mount(
      document.getElementById("android-app-content"),
      '<div class="m-auto p-6 text-center text-gray-400 text-sm"><i class="fa-solid fa-lock text-3xl text-gold-500 mb-4"></i><p>تتطلب معاينة هاتف المالك تسجيل الدخول بحساب المالك.</p></div>',
    );
}
function addOwnerTools() {
  const tools = document.createElement("div");
  tools.className = "px-5 pb-4 flex flex-wrap items-center gap-3";
  mount(
    tools,
    `<button onclick="backupData()" class="px-4 py-2 rounded-xl border border-charcoal-600 text-sm">نسخ احتياطي</button><button onclick="exportReport('excel')" class="px-4 py-2 rounded-xl border border-gold-500/40 text-sm text-gold-400">تصدير Excel</button><button onclick="exportReport('pdf')" class="px-4 py-2 rounded-xl border border-gold-500/40 text-sm text-gold-400">تصدير PDF</button>${raw.products.length === 0 ? '<button onclick="importReferenceMenu()" class="gold-btn px-4 py-2 rounded-xl text-sm">استيراد قائمة الملف (20 منتجاً)</button>' : ""}<span class="text-[11px] text-gray-500">معاينة الهاتف داخل النافذة لا تتصل بهاتف فعلي. التحكم البعيد يتطلب إعداد Supabase.</span>`,
  );
  document.getElementById("desktop-container").append(tools);
  if (uiState.ownerDesktopTab === "settings") {
    const more = document.createElement("div");
    more.className =
      "mx-5 mb-5 border border-charcoal-700 bg-charcoal-850 rounded-xl p-4";
    mount(
      more,
      `<h3 class="font-bold mb-3">إعدادات اليوم والصلاحيات</h3><div class="grid grid-cols-2 gap-4"><label class="text-xs">بداية اليوم (ساعة)<input id="day-start" class="form-input mt-2" type="number" min="0" max="23" value="${raw.settings.day_start}"></label><label class="text-xs">حد الدين الافتراضي بالدرهم<input id="credit-limit" class="form-input mt-2" type="number" step="0.01" min="0" value="${raw.settings.default_credit_limit / 100}"></label><label class="text-xs"><input type="checkbox" id="can-add" ${raw.settings.waiter_add_customers ? "checked" : ""}> السماح للنادل بإضافة الزبائن</label><label class="text-xs"><input type="checkbox" id="can-pay" ${raw.settings.waiter_record_payments ? "checked" : ""}> السماح للنادل بتسجيل التسديد</label></div><button onclick="saveExtraSettings()" class="gold-btn p-3 rounded-xl mt-4">حفظ الصلاحيات</button>`,
    );
    document.getElementById("desktop-container").append(more);
  }
}
function expose(name, fn) {
  actions[name] = fn;
  if (name !== "print") window[name] = fn;
}
expose("closeModal", closeModal);
expose("setWorkspaceMode", (mode) => {
  if (!["desktop", "android", "split"].includes(mode)) return;
  uiState.workspaceMode = mode;
  const desktop = document.getElementById("desktop-container"),
    phone = document.getElementById("android-container");
  desktop.classList.toggle("hidden", mode === "android");
  phone.classList.toggle("hidden", mode === "desktop");
  phone.classList.toggle("flex", mode !== "desktop");
  phone.classList.toggle("xl:w-[440px]", mode === "split");
  phone.classList.toggle("flex-1", mode === "android");
  for (const id of ["desktop", "android", "split"]) {
    document
      .getElementById("mode-btn-" + id)
      .classList.remove("bg-gold-500", "text-charcoal-950");
    document
      .getElementById("mode-btn-" + id)
      .classList.toggle("gold-btn", id === mode);
  }
  renderAll();
});
expose("toggleFullScreen", async () =>
  window.cafe
    ? call("kiosk")
    : document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen(),
);
expose("setupOwner", async () => {
  await call("setup", { name: input("setup-name"), pin: input("setup-pin") });
  await refresh();
  showToast("تم إعداد المالك. اختر حسابك لتسجيل الدخول.");
});
expose("selectAccount", (id) => {
  selectedAccount = id;
  uiState.pinInput = "";
  renderDesktopContainer();
});
expose("setPinInput", (value) => {
  uiState.pinInput = value.replace(/[^0-9]/g, "").slice(0, 12);
});
expose("pressPinDigit", (k) => {
  if (k === "C") uiState.pinInput = "";
  else if (k === "⌫") uiState.pinInput = uiState.pinInput.slice(0, -1);
  else if (uiState.pinInput.length < 12) uiState.pinInput += k;
  renderDesktopContainer();
});
expose("submitPinLogin", async () => {
  const account = info.accounts.find((u) => u.id === selectedAccount);
  if (!account) throw Error("اختر الحساب أولاً");
  const pin = uiState.pinInput;
  uiState.pinInput = "";
  const field = document.getElementById("login-pin");
  if (field) field.value = "";
  const session = await call("login", { name: account.name, pin });
  token = session.token;
  requestId = null;
  await refresh();
});
expose("logoutUser", async () => {
  await call("logout");
  token = null;
  raw = null;
  db = {
    settings: {},
    users: [],
    categories: [],
    products: [],
    customers: [],
    orders: [],
    shifts: [],
    debtPayments: [],
    expenses: [],
    auditLog: [],
    notifications: [],
  };
  uiState.lastReceiptOrder = null;
  uiState.currentUser = null;
  uiState.cart = [];
  uiState.pinInput = "";
  selectedAccount = null;
  requestId = null;
  closeModal();
  await refresh();
});
expose("selectCategory", (id) => {
  uiState.selectedCategory = id;
  renderDesktopContainer();
});
expose("setOwnerDesktopTab", (tab) => {
  if (raw?.user.role !== "admin") throw Error("للمالك فقط");
  uiState.ownerDesktopTab = tab;
  renderAll();
});
expose("setAndroidTab", (tab) => {
  if (raw?.user.role !== "admin") throw Error("للمالك فقط");
  uiState.androidTab = tab;
  renderAll();
});
expose("changeSelectedReportMonth", (value) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return;
  uiState.selectedReportMonth = value;
  renderAll();
});
expose("addToCart", (id) => {
  const p = raw.products.find((p) => p.id === id && p.available);
  if (!p) return;
  const item = uiState.cart.find((i) => i.productId === id);
  if (item) item.qty++;
  else
    uiState.cart.push({
      productId: id,
      name: esc(p.name),
      price: p.price / 100,
      version: p.version,
      qty: 1,
    });
  requestId = null;
  renderDesktopContainer();
});
expose("updateCartQty", (id, delta) => {
  const i = uiState.cart.find((i) => i.productId === id);
  if (i) i.qty += delta;
  uiState.cart = uiState.cart.filter((i) => i.qty > 0);
  requestId = null;
  renderDesktopContainer();
});
expose("clearCart", () => {
  uiState.cart = [];
  requestId = null;
  renderDesktopContainer();
});
expose("processCheckout", async (method, customerId = null) => {
  if (!uiState.cart.length) throw Error("السلة فارغة");
  const order = await call("checkout", {
    request_id: requestId || (requestId = crypto.randomUUID()),
    payment: method === "debt" ? "credit" : "cash",
    customer_id: customerId,
    items: uiState.cart.map((i) => ({
      product_id: i.productId,
      quantity: i.qty,
      version: i.version,
    })),
  });
  uiState.cart = [];
  requestId = null;
  await refresh();
  await actions.openReceiptModal(order.id);
});
expose("openReceiptModal", async (id) => {
  await call("receipt", { id });
  uiState.lastReceiptOrder = { id };
  window.receiptDesign(id);
  const bar = document.createElement("div");
  bar.className = "p-4 text-center";
  mount(
    bar,
    '<button onclick="saveReceiptPDF()" class="text-xs text-gold-400 border border-gold-500/40 p-3 rounded-xl">حفظ التذكرة PDF</button>',
  );
  document.getElementById("modal-content").append(bar);
});
expose("print", async () => {
  if (window.cafe && uiState.lastReceiptOrder?.id)
    await call("print", { id: uiState.lastReceiptOrder.id });
  else window.print();
});
expose("saveReceiptPDF", async () =>
  window.cafe
    ? call("pdf", { id: uiState.lastReceiptOrder.id })
    : window.print(),
);
expose("confirmCloseShift", async () => {
  const shiftId = await call("closeShift", {
    delivered: window._closingCashInput || "0",
  });
  closeModal();
  await refresh();
  actions.openShiftReportModal(shiftId);
  showToast("أغلقت الوردية وتنتظر تأكيد المالك");
});
expose("confirmShiftReceipt", async (id) => {
  await call("confirmShift", { id });
  closeModal();
  await refresh();
});
expose("confirmCancelOrder", async (id) => {
  await call("cancel", { id, reason: input("cancel-reason-input") });
  closeModal();
  await refresh();
});
expose("saveNewWaiter", async () => {
  await call("saveUser", {
    name: input("new-waiter-name"),
    pin: input("new-waiter-pin"),
  });
  closeModal();
  await refresh();
});
expose("saveWaiterPin", async (id) => {
  const u = raw.users.find((u) => u.id === id);
  await call("saveUser", {
    ...u,
    active: !!u.active,
    pin: input("edit-waiter-pin"),
  });
  closeModal();
  await refresh();
});
expose("toggleWaiterActive", async (id) => {
  const u = raw.users.find((u) => u.id === id);
  await call("saveUser", { ...u, active: !u.active });
  await refresh();
});
expose("deleteWaiter", async (id) => {
  await call("archiveUser", { id });
  await refresh();
  showToast("أرشف الحساب مع الحفاظ على سجل طلباته");
});
expose("saveNewCustomer", async () => {
  await call("customer", {
    name: input("cust-name"),
    phone: input("cust-phone"),
    limit: input("cust-limit"),
  });
  closeModal();
  await refresh();
});
let paymentRequest = null;
expose("confirmDebtPayment", async (id) => {
  const amount = input("debt-pay-amount"),
    key = id + ":" + amount;
  if (paymentRequest?.key !== key)
    paymentRequest = { key, id: crypto.randomUUID() };
  await call("payment", {
    request_id: paymentRequest.id,
    customer_id: id,
    amount,
  });
  paymentRequest = null;
  closeModal();
  await refresh();
});
expose("saveCategory", async (id) => {
  await call("saveCategory", {
    id: id || undefined,
    name: input("cat-name-input"),
  });
  closeModal();
  await refresh();
});
expose("deleteCategory", async (id) => {
  await call("removeCategory", { id });
  await refresh();
});
expose("saveProduct", async (id) => {
  const old = raw.products.find((p) => p.id === id);
  await call("saveProduct", {
    id: id || undefined,
    version: old?.version,
    available: old ? !!old.available : true,
    name: input("prod-name-input"),
    category_id: input("prod-cat-input"),
    price: input("prod-price-input"),
  });
  closeModal();
  await refresh();
});
expose("toggleProductAvailable", async (id) => {
  const p = raw.products.find((p) => p.id === id);
  await call("saveProduct", {
    ...p,
    price: p.price / 100,
    available: !p.available,
  });
  await refresh();
});
expose("saveNewExpense", async () => {
  const category = input("exp-cat-input"),
    notes = input("exp-note-input");
  await call("expense", {
    title: notes || category,
    category,
    notes,
    amount: input("exp-amount-input"),
  });
  closeModal();
  await refresh();
});
expose("saveWifiSettings", async (prefix) => {
  await call("saveSettings", {
    wifi_ssid: input(prefix + "-wifi-ssid"),
    wifi_password: input(prefix + "-wifi-pass"),
  });
  await refresh();
  showToast("تم حفظ بيانات شبكة الضيوف للتذاكر الجديدة");
});
expose("toggleDebtsSystem", async () => {
  await call("saveSettings", { debts_enabled: !raw.settings.debts_enabled });
  await refresh();
});
expose("saveExtraSettings", async () => {
  const value = input("credit-limit");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error("حد دين غير صالح");
  await call("saveSettings", {
    day_start: Number(input("day-start")),
    default_credit_limit: Math.round(Number(value) * 100),
    waiter_add_customers: document.getElementById("can-add").checked,
    waiter_record_payments: document.getElementById("can-pay").checked,
  });
  await refresh();
});
expose("backupData", async () => {
  if (!window.cafe) throw Error("النسخ الاحتياطي متاح في تطبيق Windows");
  const path = await call("backup");
  if (path) showToast("تم حفظ النسخة وفحص سلامتها");
});
expose("exportReport", async (type) => {
  const monthly = uiState.ownerDesktopTab === "monthly",
    date = monthly ? uiState.selectedReportMonth + "-01" : raw.business_day;
  if (window.cafe) {
    await call(type === "pdf" ? "reportPdf" : "excel", { date, monthly });
    return;
  }
  const r = await call("report", { date, monthly });
  if (type === "pdf") {
    const printable = document.createElement("section");
    printable.id = "printable-report";
    mount(
      printable,
      `<h1>café SELECTION · TIZNIT</h1><h2>التقرير المالي ${esc(r.period)}</h2><p>المداخيل: ${formatMoney(r.revenue / 100)} · المصاريف: ${formatMoney(r.expenses / 100)} · الصافي: ${formatMoney(r.net / 100)}</p><table><thead><tr><th>اليوم</th><th>نقدي</th><th>تسديد</th><th>مصاريف</th><th>صافي</th></tr></thead><tbody>${r.days.map((d) => `<tr><td>${esc(d.day)}</td><td>${formatMoney(d.cash / 100)}</td><td>${formatMoney(d.repaid / 100)}</td><td>${formatMoney(d.expenses / 100)}</td><td>${formatMoney((d.cash + d.repaid - d.expenses) / 100)}</td></tr>`).join("")}</tbody></table>`,
    );
    document.body.append(printable);
    try {
      window.print();
    } finally {
      printable.remove();
    }
    return;
  }
  const rows = [
    ["اليوم", "النقدي", "تسديد", "مصاريف", "صافي"],
    ...r.days.map((d) => [
      d.day,
      d.cash / 100,
      d.repaid / 100,
      d.expenses / 100,
      (d.cash + d.repaid - d.expenses) / 100,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + rows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "CafeSelection-" + r.period + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
// Only the modal/layout functions are reused from the attachment, never its mutations.
for (const key of [
  "openDebtCustomerPicker",
  "openCloseShiftModal",
  "appendCloseShiftDigit",
  "openShiftReportModal",
  "openCancelOrderModal",
  "openAddWaiterModal",
  "openChangeWaiterPinModal",
  "openAddCustomerModal",
  "openDebtPaymentModal",
  "openCategoryModal",
  "openProductModal",
  "openAddExpenseModal",
])
  actions[key] = window[key];
expose("importReferenceMenu", async () => {
  const current = await call("state");
  const ids = new Map(current.categories.map((c) => [c.name, c.id]));
  for (const c of referenceCatalog.categories)
    if (!ids.has(c.name))
      ids.set(c.name, await call("saveCategory", { name: c.name }));
  for (const p of referenceCatalog.products) {
    const cat = referenceCatalog.categories.find((c) => c.id === p.categoryId);
    if (
      !current.products.some(
        (existing) =>
          existing.name === p.name &&
          existing.category_id === ids.get(cat.name),
      )
    )
      await call("saveProduct", {
        name: p.name,
        price: p.price,
        category_id: ids.get(cat.name),
        available: p.available,
      });
  }
  await refresh();
  showToast("استوردت قائمة الملف فقط. راجع الأسعار قبل اعتمادها.");
});
document
  .querySelectorAll("header i")
  .forEach((i) => i.setAttribute("aria-hidden", "true"));
// Existing static header also uses the safe action dispatcher.
for (const node of document.querySelectorAll("[onclick]")) {
  const source = node.getAttribute("onclick");
  node.removeAttribute("onclick");
  node.addEventListener("click", () => run(() => dispatch(source, node)));
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && !token && !info.setup) run(actions.submitPinLogin);
});
setInterval(() => {
  const node = document.getElementById("android-clock");
  if (node)
    node.textContent = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (
    !token ||
    busy ||
    document.activeElement?.matches("input,select") ||
    !document.getElementById("modal-backdrop").classList.contains("hidden")
  )
    return;
  run(async () => {
    const next = await call("state");
    info = await call("info");
    if (JSON.stringify(next) !== JSON.stringify(raw)) {
      raw = next;
      adapt(raw);
      renderAll();
    } else syncStatus();
  });
}, 5000);
run(refresh);
