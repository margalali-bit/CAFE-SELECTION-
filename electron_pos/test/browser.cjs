const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const dir = mkdtempSync(join(tmpdir(), "cafe-browser-"));
const server = spawn(process.execPath, ["src/main/preview.cjs"], {
  env: { ...process.env, PORT: "4174", CAFE_PREVIEW_DB: dir + "/test.sqlite" },
  stdio: "pipe",
});
server.on("exit", () => rmSync(dir, { recursive: true, force: true }));
(async () => {
  await new Promise((resolve) => server.stdout.once("data", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174");
  await page.getByLabel("اسم المستخدم").fill("Owner");
  await page.getByLabel("رمز الدخول PIN").fill("982761");
  await page.getByRole("button", { name: "إنشاء المالك", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page
    .getByRole("button", { name: "المنتجات والفئات", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("اسم الفئة", { exact: true }).fill("مشروبات");
  await page.getByRole("button", { name: "حفظ الفئة", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("اسم المنتج", { exact: true }).fill("قهوة إسبريسو");
  await page.getByLabel("الثمن بالدرهم", { exact: true }).fill("12");
  await page.getByRole("button", { name: "إضافة المنتج", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("cell", { name: "قهوة إسبريسو", exact: true }).waitFor();
  await page.getByLabel("اسم المنتج", { exact: true }).fill("شاي مغربي");
  await page.getByLabel("الثمن بالدرهم", { exact: true }).fill("10");
  await page.getByRole("button", { name: "إضافة المنتج", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("cell", { name: "شاي مغربي", exact: true }).waitFor();
  await page.getByRole("button", { name: "طاقم العمل", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("اسم النادل", { exact: true }).fill("Waiter");
  await page.getByLabel("PIN من 4 إلى 12 رقماً", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "إضافة نادل", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByText("فعال", { exact: true }).first().waitFor();
  await page
    .getByRole("button", { name: "الإعدادات والتدقيق", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("تفعيل الطلبات على الحساب", { exact: true }).check();
  await page
    .getByRole("button", { name: "حفظ الإعدادات", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("button", { name: "ديون الزبائن", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("الاسم", { exact: true }).fill("زبون تجريبي");
  await page.getByRole("button", { name: "إضافة زبون", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByText("زبون تجريبي", { exact: true }).waitFor();
  await page.getByRole("button", { name: "المصاريف", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("العنوان", { exact: true }).fill("الحليب");
  await page.getByLabel("المبلغ بالدرهم", { exact: true }).fill("5");
  await page.getByRole("button", { name: "حفظ المصروف", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByText("الحليب", { exact: true }).waitFor();
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("اسم المستخدم").fill("Waiter");
  await page.getByLabel("رمز الدخول PIN").fill("1234");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("button", { name: /قهوة إسبريسو/ }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.screenshot({
    path: join(__dirname, "../../docs/pos-v2.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "حفظ الطلب وإصدار التذكرة", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("heading", { name: "تم حفظ الطلب #1" }).waitFor();
  await page
    .getByRole("button", { name: "طلب جديد", exact: true })
    .last()
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("button", { name: /شاي مغربي/ }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.locator("#pay-type").selectOption("credit");
  await page
    .locator("#customer-id")
    .selectOption({ label: "زبون تجريبي · المتبقي 0.00 د.م" });
  await page
    .getByRole("button", { name: "حفظ الطلب وإصدار التذكرة", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("heading", { name: "تم حفظ الطلب #2" }).waitFor();
  await page.getByRole("button", { name: "ورديتي", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page
    .getByLabel("المبلغ الفعلي المسلّم بالدرهم", { exact: true })
    .fill("12");
  await page.getByRole("button", { name: "إغلاق ورديتي", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByText("تنتظر التأكيد", { exact: true }).waitFor();
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByLabel("اسم المستخدم").fill("Owner");
  await page.getByLabel("رمز الدخول PIN").fill("982761");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("heading", { name: "نظرة عامة" }).waitFor();
  assert((await page.getByText("7.00 د.م", { exact: true }).count()) > 0);
  await page.screenshot({
    path: join(__dirname, "../../docs/dashboard-v2.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "تسوية الورديات", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page
    .getByRole("button", { name: "تأكيد الاستلام", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByText("مؤكدة", { exact: true }).waitFor();
  await page.getByRole("button", { name: "التقارير", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page.getByRole("combobox").selectOption("monthly");
  await page.getByRole("button", { name: "تحديث", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.busy !== "true");
  await page
    .getByRole("heading", { name: "تفاصيل المنتجات", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1024, height: 768 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await browser.close();
  server.kill("SIGTERM");
  console.log(
    "Browser: setup, categories, products, staff, settings, credit, expenses, cash/credit sales, receipt, close/confirm shift, monthly report and responsive layout passed",
  );
})().catch((e) => {
  server.kill("SIGTERM");
  console.error(e);
  process.exit(1);
});
