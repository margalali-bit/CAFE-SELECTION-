"use strict";
const app = document.getElementById("app"),
  toastEl = document.getElementById("toast");
let token = null,
  state = null,
  page = "",
  cart = {},
  category = "",
  filterDate = "",
  reportMonthly = false,
  requestId = null,
  lastReceipt = null,
  info = {},
  busy = false;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => (n / 100).toFixed(2) + " د.م";
const labels = {
  cash: "نقداً",
  credit: "على الحساب",
  paid: "مسجل",
  cancelled: "ملغى",
  open: "مفتوحة",
  closed: "تنتظر التأكيد",
  confirmed: "مؤكدة",
};
const uid = () => crypto.randomUUID();
async function call(method, args = {}) {
  let result;
  if (window.cafe) result = await window.cafe.call(method, { token, args });
  else {
    const r = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, token, args }),
    });
    result = await r.json();
  }
  if (!result.ok) throw Error(result.error);
  return result.value;
}
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 5000);
}
async function run(fn) {
  if (busy) return;
  busy = true;
  document.body.dataset.busy = "true";
  try {
    await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    document.body.dataset.busy = "false";
  }
}
function on(id, event, fn) {
  document.getElementById(id)?.addEventListener(event, (e) => run(() => fn(e)));
}
function button(text, action, id = "", cls = "") {
  return `<button ${id ? `id="${id}"` : ""} ${action ? `data-action="${action}"` : ""} class="${cls}">${esc(text)}</button>`;
}
function field(label, id, type = "text", value = "", attrs = "") {
  return `<label>${label}<input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
}
function table(headers, rows) {
  return `<div class="scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${headers.length}" class="empty">لا توجد بيانات</td></tr>`}</tbody></table></div>`;
}
function row(values) {
  return `<tr>${values.map((v) => `<td>${v}</td>`).join("")}</tr>`;
}
function stats(r) {
  return `<div class="stats">${[
    ["المداخيل النقدية", money(r.revenue)],
    ["المصاريف", money(r.expenses)],
    ["الصافي المسجل", money(r.net)],
    ["عدد الطلبات", r.count],
  ]
    .map(([l, v]) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`)
    .join("")}</div>`;
}
async function auth() {
  info = await call("info");
  app.innerHTML = `<div class="auth"><div class="brand">Café Sélection<small>TIZNIT · تيزنيت</small></div><div class="panel"><h1>${info.setup ? "إعداد حساب المالك" : "أهلاً بعودتك"}</h1><form id="login-form">${field("اسم المستخدم", "username", "text", "", 'required autocomplete="username"')}${field("رمز الدخول PIN", "pin", "password", "", 'required inputmode="numeric" pattern="[0-9]{4,12}" maxlength="12" autocomplete="off" class="pin"')}<div class="pad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "مسح", "0", "⌫"].map((v) => `<button type="button" data-key="${v}">${v}</button>`).join("")}</div><button class="gold">${info.setup ? "إنشاء المالك" : "دخول"}</button><small>لا توجد رموز افتراضية. يقفل الحساب مؤقتاً بعد خمس محاولات خاطئة.</small></form></div></div>`;
  document.querySelectorAll("[data-key]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = document.getElementById("pin"),
          v = b.dataset.key;
        p.value =
          v === "مسح"
            ? ""
            : v === "⌫"
              ? p.value.slice(0, -1)
              : (p.value + v).slice(0, 12);
      }),
  );
  on("login-form", "submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("username").value,
      pin: document.getElementById("pin").value,
    };
    if (info.setup) await call("setup", data);
    const session = await call("login", data);
    token = session.token;
    page = session.user.role === "admin" ? "dashboard" : "pos";
    await refresh();
  });
}
async function refresh() {
  state = await call("state");
  info = await call("info");
  await render();
}
function frame(body) {
  const admin = state.user.role === "admin";
  const tabs = admin
    ? [
        ["dashboard", "نظرة عامة"],
        ["orders", "الطلبات"],
        ["shifts", "تسوية الورديات"],
        ["debts", "ديون الزبائن"],
        ["expenses", "المصاريف"],
        ["reports", "التقارير"],
        ["products", "المنتجات والفئات"],
        ["users", "طاقم العمل"],
        ["settings", "الإعدادات والتدقيق"],
      ]
    : [
        ["pos", "طلب جديد"],
        ["orders", "طلباتي"],
        ["shifts", "ورديتي"],
        ...(state.settings.debts_enabled ? [["debts", "على الحساب"]] : []),
      ];
  app.innerHTML = `<header><div class="brand">Café Sélection<small>TIZNIT · تيزنيت</small></div><div class="row"><span class="badge">${info.sync?.configured ? (info.sync.state === "online" ? "متصل بالسحابة" : "المزامنة تنتظر الاتصال") : "محلي · السحابة غير مهيأة"}</span><span>${esc(state.user.name)} · ${admin ? "المالك" : "النادل"}</span>${button("ملء الشاشة", null, "kiosk")}${button("خروج", null, "logout")}</div></header><div class="shell"><nav>${tabs.map(([id, title]) => `<button data-page="${id}" class="${page === id ? "active" : ""}">${title}</button>`).join("")}<div class="spacer"></div><small>اليوم التجاري<br>${esc(state.business_day)}</small></nav><main class="content">${body}</main></div>`;
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          page = b.dataset.page;
          await refresh();
        })),
  );
  on("logout", "click", async () => {
    await call("logout");
    token = null;
    state = null;
    cart = {};
    requestId = null;
    await auth();
  });
  on("kiosk", "click", async () => {
    if (window.cafe) await call("kiosk");
    else if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  });
}
const title = (a, b = "") =>
  `<div class="section-title"><h1>${a}</h1><p>${b}</p></div>`;
async function render() {
  if (page === "pos") return pos();
  if (page === "dashboard") return dashboard();
  if (page === "orders") return orders();
  if (page === "shifts") return shifts();
  if (page === "debts") return debts();
  if (page === "expenses") return expenses();
  if (page === "reports") return reports();
  if (page === "products") return products();
  if (page === "users") return users();
  if (page === "settings") return settings();
}
function pos() {
  frame(
    `${title("طلب جديد", "اختر الفئة ثم الأصناف · فتح الوردية تلقائي عند أول طلب")}<div class="pos"><div><div class="filters">${button("الكل", "category:", "", category ? "" : "active")}${state.categories.map((c) => button(c.name, "category:" + c.id, "", category === c.id ? "active" : "")).join("")}</div><div class="products">${
      state.products
        .filter((p) => p.available && (!category || p.category_id === category))
        .map(
          (p) =>
            `<button class="product" data-action="add:${p.id}"><span class="symbol">${/شاي/.test(p.name) ? '<img src="assets/teapot.svg" width="48" height="43" alt="براد شاي مغربي">' : /قهوة/.test(p.name) ? "☕" : "◇"}</span><b>${esc(p.name)}</b><span class="price">${money(p.price)}</span></button>`,
        )
        .join("") ||
      '<div class="empty">لا توجد منتجات. يضيف المالك القائمة من لوحة الإدارة.</div>'
    }</div></div><aside class="panel"><h2>سلة الطلبية</h2>${
      Object.entries(cart)
        .map(([id, q]) => {
          const p = state.products.find((p) => p.id === id);
          return p
            ? `<div class="cart-item"><div class="between"><span>${esc(p.name)}</span><b>${money(p.price * q)}</b></div><div class="qty">${button("−", "minus:" + id)}<span>${q}</span>${button("+", "add:" + id)}</div></div>`
            : "";
        })
        .join("") || '<div class="empty">السلة فارغة</div>'
    }<div class="between total"><span>المجموع</span><b>${money(Object.entries(cart).reduce((a, [id, q]) => a + (state.products.find((p) => p.id === id)?.price || 0) * q, 0))}</b></div><label>طريقة الدفع<select id="pay-type"><option value="cash">نقداً</option>${state.settings.debts_enabled ? '<option value="credit">على الحساب</option>' : ""}</select></label>${state.settings.debts_enabled ? `<label>الزبون (للطلب على الحساب)<select id="customer-id"><option value="">اختر الزبون</option>${state.customers.map((c) => `<option value="${c.id}">${esc(c.name)} · المتبقي ${money(c.balance)}</option>`).join("")}</select></label>` : ""}<button class="gold full" id="checkout" ${Object.keys(cart).length ? "" : "disabled"}>حفظ الطلب وإصدار التذكرة</button>${button("إفراغ السلة", null, "clear", "full")}<p class="hint">يُحفظ الطلب محلياً أولاً. تعطل الطباعة لا يلغي البيع.</p></aside></div>`,
  );
  actions(async (type, id) => {
    if (type === "category") category = id;
    else if (type === "add") {
      cart[id] = (cart[id] || 0) + 1;
      requestId = null;
    } else if (type === "minus") {
      if (--cart[id] <= 0) delete cart[id];
      requestId = null;
    }
    pos();
  });
  on("clear", "click", () => {
    cart = {};
    requestId = null;
    pos();
  });
  on("checkout", "click", async () => {
    const data = {
      request_id: requestId || (requestId = uid()),
      payment: document.getElementById("pay-type").value,
      customer_id: document.getElementById("customer-id")?.value,
      items: Object.entries(cart).map(([id, quantity]) => ({
        product_id: id,
        quantity,
        version: state.products.find((p) => p.id === id)?.version,
      })),
    };
    lastReceipt = await call("checkout", data);
    cart = {};
    requestId = null;
    state = await call("state");
    receipt(lastReceipt);
  });
}
function actions(fn) {
  document.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () =>
        run(() => {
          const [type, ...parts] = b.dataset.action.split(":");
          return fn(type, parts.join(":"));
        })),
  );
}
function receipt(o) {
  frame(
    `${title("تم حفظ الطلب #" + o.number, "يمكن إعادة الطباعة من سجل الطلبات دون تسجيل بيع جديد")}<div class="row">${button("طلب جديد", null, "new-order", "gold")}${button("طباعة", null, "print")}${button("حفظ PDF", null, "pdf")}</div><div class="receipt"><h2>Café Sélection</h2><p>TIZNIT · تيزنيت</p><p>التذكرة #${o.number}<br>${esc(o.business_day)}<br>النادل: ${esc(o.waiter)}<br>${labels[o.payment]}</p>${table(
      ["الصنف", "الكمية", "المجموع"],
      o.items.map((i) =>
        row([esc(i.name), i.quantity, money(i.unit_price * i.quantity)]),
      ),
    )}<p><b>المجموع ${money(o.total)}</b></p><p>شكراً لزيارتكم · À bientôt</p></div>`,
  );
  on("new-order", "click", () => {
    page = "pos";
    pos();
  });
  on("print", "click", async () => {
    if (window.cafe) await call("print", { id: o.id });
    else window.print();
  });
  on("pdf", "click", async () => {
    if (window.cafe) await call("pdf", { id: o.id });
    else window.print();
  });
}
async function dashboard() {
  const r = await call("report", { date: state.business_day });
  frame(
    `${title("نظرة عامة", "قراءة مالية لليوم التجاري بتوقيت المغرب")}${stats(r)}<div class="grid2"><div class="panel"><h2>الأكثر مبيعاً</h2>${table(
      ["المنتج", "الكمية", "المبيعات"],
      r.top
        .slice(0, 8)
        .map((p) => row([esc(p.name), p.quantity, money(p.total)])),
    )}</div><div class="panel"><h2>حركة النقد</h2><div class="spacer"></div>${table(
      ["البيان", "المبلغ"],
      [
        ["مبيعات نقدية", r.cash],
        ["تسديد ديون", r.repaid],
        ["مبيعات على الحساب (غير محصلة)", r.credit],
      ].map(([l, v]) => row([l, money(v)])),
    )}<p class="hint">الصافي = النقدي + تسديد الديون − المصاريف. ليس ربحاً محاسبياً نهائياً.</p><p class="hint">${state.pending} عملية تنتظر المزامنة. آخر اتصال: ${esc(info.sync?.last_success || "لم يتم بعد")}</p></div></div><div class="spacer"></div><div class="panel"><h2>المداخيل النقدية بالساعة · توقيت المغرب</h2>${table(
      ["الساعة", "المبلغ"],
      r.hourly.map((h) => row([esc(h.hour) + ":00", money(h.total)])),
    )}</div>`,
  );
}
function orders() {
  frame(
    `${title(state.user.role === "admin" ? "سجل الطلبات" : "طلباتي", "الطلبات لا تُحذف. الإلغاء يتطلب سبباً ويحفظ في سجل التدقيق.")}${table(
      ["التذكرة", "اليوم", "المبلغ", "الدفع", "الحالة", "العمليات"],
      state.orders
        .slice(0, 300)
        .map((o) =>
          row([
            "#" + o.number,
            esc(o.business_day),
            money(o.total),
            labels[o.payment],
            labels[o.status],
            button("عرض / طباعة", "receipt:" + o.id) +
              (o.status === "paid"
                ? button("إلغاء", "cancel:" + o.id, "", "danger")
                : esc(o.cancel_reason || "")),
          ]),
        ),
    )}`,
  );
  actions(async (type, id) => {
    if (type === "receipt") receipt(await call("receipt", { id }));
    if (type === "cancel") {
      const reason = prompt("سبب الإلغاء (إجباري)");
      if (reason) {
        await call("cancel", { id, reason });
        await refresh();
      }
    }
  });
}
function shifts() {
  const admin = state.user.role === "admin";
  frame(
    `${title("تسوية الورديات", "المفروض = الطلبات النقدية غير الملغاة. الفرق = المسلم − المفروض.")}${!admin ? `<form id="close-form" class="inline">${field("المبلغ الفعلي المسلّم بالدرهم", "delivered", "number", "", 'min="0" step="0.01" required')}<button class="gold">إغلاق ورديتي</button></form>` : ""}${table(
      ["النادل", "البداية", "الحالة", "المفروض", "المسلم", "الفرق", ""],
      state.shifts.map((s) =>
        row([
          esc(s.waiter),
          esc(new Date(s.opened_at).toLocaleString("ar-MA")),
          labels[s.status],
          s.expected == null ? "—" : money(s.expected),
          s.delivered == null ? "—" : money(s.delivered),
          s.difference == null ? "—" : money(s.difference),
          admin && s.status === "closed"
            ? button("تأكيد الاستلام", "confirm:" + s.id, "", "gold")
            : "—",
        ]),
      ),
    )}<p class="hint">تسديدات الديون مسجلة منفصلة عن حصيلة مبيعات الوردية. الإلغاء بعد إغلاق وردية يعيدها للمراجعة.</p>`,
  );
  on("close-form", "submit", async (e) => {
    e.preventDefault();
    await call("closeShift", {
      delivered: document.getElementById("delivered").value,
    });
    toast("أغلقت الوردية وتنتظر تأكيد المالك");
    await refresh();
  });
  actions(async (_, id) => {
    await call("confirmShift", { id });
    await refresh();
  });
}
function debts() {
  const admin = state.user.role === "admin",
    s = state.settings;
  frame(
    `${title("ديون الزبائن", s.debts_enabled ? "مفعلة · الطلب على الحساب لا يدخل المداخيل قبل التسديد" : "طلبات جديدة على الحساب معطلة · يمكن تسديد الأرصدة السابقة")}${admin || s.waiter_add_customers ? `<div class="panel"><h2>زبون جديد</h2><form id="customer-form" class="inline">${field("الاسم", "customer-name", "text", "", "required")}${field("الهاتف", "phone")}${admin ? field("حد الدين بالدرهم", "limit", "number", s.default_credit_limit / 100, 'min="0" step="0.01" required') : ""}<button>إضافة زبون</button></form></div>` : ""}<div class="spacer"></div>${table(
      ["الزبون", "الهاتف", "حد الدين", "المتبقي", ""],
      state.customers.map((c) =>
        row([
          esc(c.name),
          esc(c.phone),
          money(c.credit_limit),
          money(c.balance),
          (admin || s.waiter_record_payments) && c.balance > 0
            ? button("تسجيل تسديد", "repay:" + c.id)
            : "—",
        ]),
      ),
    )}`,
  );
  on("customer-form", "submit", async (e) => {
    e.preventDefault();
    await call("customer", {
      name: document.getElementById("customer-name").value,
      phone: document.getElementById("phone").value,
      limit: document.getElementById("limit")?.value,
    });
    await refresh();
  });
  actions(async (_, id) => {
    const amount = prompt("المبلغ المسدد بالدرهم");
    if (amount) {
      await call("payment", { request_id: uid(), customer_id: id, amount });
      toast("تم تسجيل التسديد بتاريخ اليوم التجاري");
      await refresh();
    }
  });
}
function expenses() {
  frame(
    `${title("المصاريف", "تسجيل المشتريات والأجور والفواتير بالدرهم")}<div class="panel"><form id="expense-form" class="inline">${field("العنوان", "expense-title", "text", "", "required")}${field("الفئة", "expense-category", "text", "مشتريات", "required")}${field("المبلغ بالدرهم", "expense-amount", "number", "", 'min="0.01" step="0.01" required')}${field("ملاحظات", "notes")}<button class="gold">حفظ المصروف</button></form></div><div class="spacer"></div>${table(
      ["العنوان", "الفئة", "المبلغ", "اليوم التجاري"],
      state.expenses.map((e) =>
        row([
          esc(e.title),
          esc(e.category),
          money(e.amount),
          esc(e.business_day),
        ]),
      ),
    )}`,
  );
  on("expense-form", "submit", async (e) => {
    e.preventDefault();
    await call("expense", {
      title: document.getElementById("expense-title").value,
      category: document.getElementById("expense-category").value,
      amount: document.getElementById("expense-amount").value,
      notes: document.getElementById("notes").value,
    });
    await refresh();
  });
}
async function reports() {
  if (!filterDate) filterDate = state.business_day;
  const r = await call("report", { date: filterDate, monthly: reportMonthly });
  frame(
    `${title("التقارير اليومية والشهرية", "الإيراد يُحسب في يوم التحصيل. كل المبالغ بالدرهم.")}<div class="row"><input id="report-date" type="date" value="${filterDate}" class="short"><select id="report-type" class="short"><option value="daily" ${!reportMonthly ? "selected" : ""}>يومي</option><option value="monthly" ${reportMonthly ? "selected" : ""}>شهري</option></select>${button("تحديث", null, "report-refresh", "gold")}${button("تصدير Excel", null, "excel")}${button("تصدير PDF", null, "report-pdf")}</div>${stats(r)}<div class="panel">${table(
      ["اليوم", "نقدي", "تسديد الديون", "المصاريف", "الصافي", "على الحساب"],
      r.days.map((d) =>
        row([
          esc(d.day),
          money(d.cash),
          money(d.repaid),
          money(d.expenses),
          money(d.cash + d.repaid - d.expenses),
          money(d.credit),
        ]),
      ),
    )}</div><div class="spacer"></div><div class="panel"><h2>تفاصيل المنتجات</h2>${table(
      ["المنتج", "الكمية", "إجمالي البيع"],
      r.top.map((p) => row([esc(p.name), p.quantity, money(p.total)])),
    )}</div>`,
  );
  on("report-refresh", "click", async () => {
    filterDate = document.getElementById("report-date").value;
    reportMonthly = document.getElementById("report-type").value === "monthly";
    await reports();
  });
  on("report-pdf", "click", async () => {
    if (window.cafe)
      await call("reportPdf", { date: filterDate, monthly: reportMonthly });
    else window.print();
  });
  on("excel", "click", async () => {
    if (window.cafe) {
      await call("excel", { date: filterDate, monthly: reportMonthly });
      toast("انتهت عملية التصدير");
    } else {
      const rows = [
        ["اليوم", "نقدي", "تسديد", "مصاريف", "صافي"],
        ...r.days.map((d) => [
          d.day,
          d.cash / 100,
          d.repaid / 100,
          d.expenses / 100,
          (d.cash + d.repaid - d.expenses) / 100,
        ]),
      ];
      const a = document.createElement("a"),
        url = URL.createObjectURL(
          new Blob(["\ufeff" + rows.map((r) => r.join(",")).join("\n")], {
            type: "text/csv;charset=utf-8",
          }),
        );
      a.href = url;
      a.download = "CafeSelection.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}
function products() {
  frame(
    `${title("المنتجات والفئات", "الأسعار تتغير للمبيعات الجديدة فقط. يحتفظ كل طلب بسعره وقت البيع.")}<div class="grid2"><div class="panel"><h2>إضافة فئة</h2><form id="category-form" class="inline">${field("اسم الفئة", "category-name", "text", "", "required")}<button>حفظ الفئة</button></form></div><div class="panel"><h2>إضافة منتج</h2><form id="product-form">${field("اسم المنتج", "product-name", "text", "", "required")}<div class="row"><label>الفئة<select id="product-category">${state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>${field("الثمن بالدرهم", "product-price", "number", "", 'min="0.01" step="0.01" required')}</div><button class="gold">إضافة المنتج</button></form></div></div><div class="spacer"></div>${table(
      ["المنتج", "الثمن", "التوفر", ""],
      state.products.map((p) =>
        row([
          esc(p.name),
          money(p.price),
          p.available ? "متاح" : "متوقف",
          button("تغيير السعر", "price:" + p.id) +
            button(p.available ? "إيقاف" : "تفعيل", "toggle:" + p.id),
        ]),
      ),
    )}`,
  );
  on("category-form", "submit", async (e) => {
    e.preventDefault();
    await call("saveCategory", {
      name: document.getElementById("category-name").value,
    });
    await refresh();
  });
  on("product-form", "submit", async (e) => {
    e.preventDefault();
    await call("saveProduct", {
      name: document.getElementById("product-name").value,
      category_id: document.getElementById("product-category").value,
      price: document.getElementById("product-price").value,
    });
    await refresh();
  });
  actions(async (type, id) => {
    const p = state.products.find((p) => p.id === id);
    if (type === "price") {
      const price = prompt("الثمن الجديد بالدرهم", p.price / 100);
      if (price === null) return;
      await call("saveProduct", { ...p, price });
    } else
      await call("saveProduct", {
        ...p,
        price: p.price / 100,
        available: !p.available,
      });
    await refresh();
  });
}
function users() {
  frame(
    `${title("طاقم العمل", "رموز PIN لا تُعرض ولا تُحفظ كنص مكشوف. تغيير الرمز ينهي جلسات الحساب.")}<div class="panel"><form id="user-form" class="inline">${field("اسم النادل", "waiter-name", "text", "", "required")}${field("PIN من 4 إلى 12 رقماً", "waiter-pin", "password", "", 'required pattern="[0-9]{4,12}" inputmode="numeric"')}<button class="gold">إضافة نادل</button></form></div><div class="spacer"></div>${table(
      ["الاسم", "الدور", "الحالة", ""],
      state.users.map((u) =>
        row([
          esc(u.name),
          u.role === "admin" ? "مالك" : "نادل",
          u.active ? "فعال" : "معطل",
          button("تغيير PIN", "pin:" + u.id) +
            (u.role === "waiter"
              ? button(u.active ? "تعطيل" : "تفعيل", "active:" + u.id)
              : ""),
        ]),
      ),
    )}<p class="hint">اختيار اسم المستخدم قبل PIN يتيح رموزاً مستقلة ويقلل البحث في الحسابات.</p>`,
  );
  on("user-form", "submit", async (e) => {
    e.preventDefault();
    await call("saveUser", {
      name: document.getElementById("waiter-name").value,
      pin: document.getElementById("waiter-pin").value,
    });
    await refresh();
  });
  actions(async (type, id) => {
    const u = state.users.find((u) => u.id === id);
    if (type === "pin") {
      const pin = prompt("PIN الجديد؛ لن يُعرض بعد حفظه");
      if (pin === null) return;
      await call("saveUser", { ...u, active: !!u.active, pin });
      if (id === state.user.id) {
        token = null;
        return auth();
      }
    } else await call("saveUser", { ...u, active: !u.active });
    await refresh();
  });
}
function settings() {
  const s = state.settings;
  frame(
    `${title("الإعدادات وسجل التدقيق", "تعديلات حساسة محفوظة مع هوية منفذها")}<div class="grid2"><div class="panel"><form id="settings-form">${[
      ["debts_enabled", "تفعيل الطلبات على الحساب"],
      ["waiter_add_customers", "السماح للنادل بإضافة زبون"],
      ["waiter_record_payments", "السماح للنادل بتسجيل التسديد"],
    ]
      .map(
        ([id, l]) =>
          `<label class="check"><input type="checkbox" id="${id}" ${s[id] ? "checked" : ""}>${l}</label>`,
      )
      .join(
        "",
      )}${field("حد الدين الافتراضي بالدرهم", "default-limit", "number", s.default_credit_limit / 100, 'min="0" step="0.01" required')}${field("ساعة بداية اليوم التجاري (المغرب)", "day-start", "number", s.day_start, 'min="0" max="23" required')}<button class="gold">حفظ الإعدادات</button></form></div><div class="panel"><h2>حماية البيانات</h2><p class="hint">نسخة محلية تلقائية عند التشغيل وكل 24 ساعة. احفظ نسخة إضافية خارج جهاز المقهى. ملف SQLite غير مشفر؛ احمِ حساب Windows والقرص.</p>${button("نسخ احتياطي الآن", null, "backup", "full")}<p class="hint">المزامنة: ${info.sync?.configured ? esc(info.sync.state) : "تحتاج إعداد Supabase وحساب جهاز مستقل"}. لا تضع service_role في التطبيق.</p></div></div><div class="spacer"></div>${table(
      ["الوقت", "العملية", "الحساب"],
      state.audit.map((a) =>
        row([
          esc(a.created_at),
          esc(a.action),
          esc(state.users.find((u) => u.id === a.user_id)?.name || "النظام"),
        ]),
      ),
    )} `,
  );
  on("settings-form", "submit", async (e) => {
    e.preventDefault();
    await call("saveSettings", {
      debts_enabled: document.getElementById("debts_enabled").checked,
      waiter_add_customers: document.getElementById("waiter_add_customers")
        .checked,
      waiter_record_payments: document.getElementById("waiter_record_payments")
        .checked,
      default_credit_limit: Math.round(
        Number(document.getElementById("default-limit").value) * 100,
      ),
      day_start: Number(document.getElementById("day-start").value),
    });
    await refresh();
  });
  on("backup", "click", async () => {
    const path = await call("backup");
    if (path) toast("تم إنشاء النسخة وفحصها: " + path);
  });
}
// Poll only while no form is being edited. SQLite remains the source of truth.
setInterval(async () => {
  if (!token || busy || document.activeElement?.matches("input,select")) return;
  try {
    const next = await call("state");
    if (
      page === "pos" &&
      JSON.stringify(next.products) !== JSON.stringify(state.products)
    ) {
      state = next;
      pos();
      toast("تم تحديث القائمة؛ راجع السلة قبل الحفظ");
    }
  } catch {}
}, 5000);
run(auth);
