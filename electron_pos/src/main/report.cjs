const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => (n / 100).toFixed(2) + " د.م";
function reportHTML(r) {
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font:13px Tahoma,Arial;color:#241c13}h1{font:28px Georgia;color:#70542e;text-align:center}h2{text-align:center}table{border-collapse:collapse;width:100%;margin:22px 0}thead{display:table-header-group}tr{break-inside:avoid}td,th{padding:10px 6px;border-bottom:1px solid #ddd;text-align:right}th{background:#30251b;color:#f4d49d}.summary{display:flex;justify-content:space-between;border:1px solid #ae9569;padding:20px}.note{color:#777;font-size:11px}</style><h1>Café Sélection · Tiznit</h1><h2>التقرير المالي — ${esc(r.period)}</h2><div class="summary"><span>المداخيل: ${money(r.revenue)}</span><span>المصاريف: ${money(r.expenses)}</span><span>الصافي: ${money(r.net)}</span></div><p>الطلبات: ${r.count} · على الحساب: ${money(r.credit)} · تسديدات الديون: ${money(r.repaid)}</p><table><thead><tr><th>اليوم</th><th>نقدي</th><th>تسديد</th><th>مصاريف</th><th>صافي</th></tr></thead><tbody>${r.days.map((d) => `<tr><td>${esc(d.day)}</td><td>${money(d.cash)}</td><td>${money(d.repaid)}</td><td>${money(d.expenses)}</td><td>${money(d.cash + d.repaid - d.expenses)}</td></tr>`).join("")}</tbody></table><h2>تفاصيل المنتجات</h2><table><thead><tr><th>المنتج</th><th>الكمية</th><th>مجموع البيع</th></tr></thead><tbody>${r.top.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.quantity}</td><td>${money(p.total)}</td></tr>`).join("")}</tbody></table><p class="note">الصافي = المبيعات النقدية + تسديدات الديون − المصاريف المسجلة. ليس ربحاً محاسبياً نهائياً. اليوم التجاري بتوقيت المغرب.</p></html>`;
}
module.exports = { reportHTML };
