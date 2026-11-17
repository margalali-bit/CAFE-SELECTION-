const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const dir = mkdtempSync(join(tmpdir(), "cafe-html-"));
const server = spawn(process.execPath, ["src/main/preview.cjs"], {
  env: {
    ...process.env,
    PORT: "4174",
    CAFE_PREVIEW_DB: join(dir, "test.sqlite"),
  },
  stdio: "pipe",
});
server.on("exit", () => rmSync(dir, { recursive: true, force: true }));
(async () => {
  await new Promise((r) => server.stdout.once("data", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4174") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  const click = async (name, scope = page) => {
    await scope.getByRole("button", { name, exact: true }).click();
    await page.waitForFunction(() => document.body.dataset.busy !== "true");
  };
  const desk = () => page.locator("#desktop-container"),
    modal = () => page.locator("#modal-content");
  await page.addInitScript(() => {
    window.__printCount = 0;
    window.print = () => window.__printCount++;
  });
  await page.goto("http://127.0.0.1:4174");
  await page.locator("#setup-name").fill("Owner");
  await page.locator("#setup-pin").fill("982761");
  await click("إنشاء حساب المالك");
  await page
    .locator("#login-account")
    .selectOption({ label: "Owner · المالك" });
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.locator("#login-pin").fill("982761");
  await click("تسجيل الدخول");
  await click("استيراد قائمة الملف (20 منتجاً)", desk());
  await click("الأقسام والمنتجات", desk());
  assert.equal(
    await desk().getByRole("button", { name: "متوفر", exact: true }).count(),
    19,
  );
  await click("الندل وتقاريرهم", desk());
  await click("إضافة نادل جديد", desk());
  await page.locator("#new-waiter-name").fill("Waiter");
  await page.locator("#new-waiter-pin").fill("1234");
  await click("حفظ وإضافة النادل", modal());
  assert(!(await desk().innerText()).includes("1234"));
  await click("الإعدادات والواي فاي", desk());
  await click("معطّل", desk());
  await page.locator("#desk-wifi-ssid").fill("Selection Guest");
  await page.locator("#desk-wifi-pass").fill("guest-only-code");
  await click("حفظ كود الواي فاي", desk());
  await click("الديون", desk());
  await click("إضافة زبون", desk());
  await page.locator("#cust-name").fill("زبون اختبار");
  await page.locator("#cust-limit").fill("100");
  await click("حفظ الزبون", modal());
  await click("المصاريف", desk());
  await click("+ تسجيل مصروف", desk());
  await page.locator("#exp-amount-input").fill("5");
  await page.locator("#exp-note-input").fill("الحليب");
  await click("تسجيل المصروف", modal());
  await click("لوحة اليوم", desk());
  await click("عرض مزدوج حي");
  await page.evaluate(() =>
    document.getElementById("toast-container").replaceChildren(),
  );
  const phoneCard = page
    .locator("#android-app-content .grid-cols-2 > div")
    .first();
  assert(
    (await phoneCard.boundingBox()).width > 140,
    "Phone dashboard cards must remain readable inside the embedded frame",
  );
  await page.screenshot({
    path: join(__dirname, "../../docs/html-owner-split.png"),
    fullPage: true,
  });
  await click("شاشة المقهى (POS)");
  await click("تسجيل الخروج", desk());
  await page.locator("#login-account").selectOption({ label: "Waiter · نادل" });
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.locator("#login-pin").fill("1234");
  await click("تسجيل الدخول");
  await click("القهوة", desk());
  await click("قهوة إسبريسو 10.00 درهم", desk());
  await page.evaluate(() =>
    document.getElementById("toast-container").replaceChildren(),
  );
  await page.screenshot({
    path: join(__dirname, "../../docs/html-pos.png"),
    fullPage: true,
  });
  await click("دفع نقداً وإصدار التذكرة", desk());
  await modal().getByText("تذكرة رقم:", { exact: false }).waitFor();
  assert((await modal().innerText()).includes("Selection Guest"));
  assert(!(await modal().innerText()).includes("1234"));
  await click("طباعة 80mm", modal());
  await click("حفظ التذكرة PDF", modal());
  assert.equal(await page.evaluate(() => window.__printCount), 2);

  await click("إغلاق", modal());
  await click("المشروبات", desk());
  await click("أتاي مغربي بالنعناع 10.00 درهم", desk());
  await click("تسجيل على الحساب (دين)", desk());
  await modal()
    .getByRole("button", { name: /زبون اختبار/ })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await click("إغلاق", modal());
  await click("إغلاق الوردية", desk());
  await click("1", modal());
  await click("0", modal());
  await click("تأكيد إغلاق الوردية وعرض التقرير", modal());
  await click("خروج", desk());
  await page
    .locator("#login-account")
    .selectOption({ label: "Owner · المالك" });
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.locator("#login-pin").fill("982761");
  await click("تسجيل الدخول");
  assert((await desk().innerText()).includes("5.00 درهم"));
  await click("الورديات", desk());
  await click("تأكيد الاستلام", desk());
  await click("التقرير الشهري", desk());
  await desk()
    .getByText("إجمالي مداخيل الشهر", { exact: false })
    .first()
    .waitFor();
  await page.setViewportSize({ width: 1024, height: 768 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await browser.close();
  server.kill("SIGTERM");
  console.log(
    "HTML rebuild: offline assets, real SQLite setup, import 20 products, PIN privacy, owner/phone view, cash+credit, receipt WiFi, expenses, shifts, monthly report and touch layout passed",
  );
})().catch((e) => {
  server.kill("SIGTERM");
  console.error(e);
  process.exit(1);
});
