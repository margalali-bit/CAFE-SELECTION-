const { getBrandLogoSvg } = require("./brand.cjs");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function receiptHTML(o) {
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>Café Sélection — #${o.number}</title><style>@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0 auto;color:#000;font:13px Tahoma,Arial}h1,p{text-align:center}.logo{text-align:center}.logo svg{width:110px;height:113px}h1{font:24px Georgia}table{width:100%;border-collapse:collapse}td,th{padding:6px 0;border-bottom:1px dashed #888;text-align:right}.total{font-size:19px;font-weight:bold}small{display:block;text-align:center}button{padding:12px}@media print{button{display:none}}</style><div class="logo">${getBrandLogoSvg("mono")}</div><p>TIZNIT · تيزنيت</p><hr><p>التذكرة #${o.number} · ${esc(o.business_day)}<br>${esc(new Date(o.created_at).toLocaleString("ar-MA", { timeZone: "Africa/Casablanca" }))}<br>النادل: ${esc(o.waiter)}<br>${o.payment === "credit" ? "على الحساب" : "نقداً"} ${o.status === "cancelled" ? "· ملغاة" : ""}</p><table><thead><tr><th>الصنف</th><th>الكمية</th><th>المجموع</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${((i.unit_price * i.quantity) / 100).toFixed(2)}</td></tr>`).join("")}</tbody></table><p class="total">المجموع ${(o.total / 100).toFixed(2)} د.م</p><hr>${o.wifi_ssid ? `<p>WiFi: ${esc(o.wifi_ssid)}<br>Code: ${esc(o.wifi_password || "")}</p>` : ""}<p>شكراً لزيارتكم<br>À bientôt chez Café Sélection</p><small>بدون TVA · نسخة من الطلب المسجل</small></html>`;
}
module.exports = { receiptHTML };
