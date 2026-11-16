const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { join } = require("node:path");
const { writeFileSync } = require("node:fs");
const { Service } = require("./service.cjs");
const { Sync } = require("./sync.cjs");
const { receiptHTML } = require("./receipt.cjs");
const methods = new Set([
  "setup",
  "login",
  "logout",
  "state",
  "saveCategory",
  "saveProduct",
  "saveUser",
  "saveSettings",
  "customer",
  "checkout",
  "receipt",
  "cancel",
  "closeShift",
  "confirmShift",
  "payment",
  "expense",
  "report",
]);
let service, window, sync, backupTimer;
const pendingBackups = new Set();
let quitting = false;
function trackedBackup(directory) {
  const pending = service.backup(directory);
  pendingBackups.add(pending);
  pending.then(
    () => pendingBackups.delete(pending),
    () => pendingBackups.delete(pending),
  );
  return pending;
}
async function receiptWindow(token, id, pdf = false) {
  const order = service.receipt(token, id);
  const w = new BrowserWindow({
    width: 430,
    height: 750,
    show: !pdf,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await w.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(receiptHTML(order)),
  );
  if (pdf) {
    try {
      const { filePath } = await dialog.showSaveDialog(window, {
        defaultPath: `CafeSelection-${order.business_day}-${order.number}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (filePath)
        writeFileSync(
          filePath,
          await w.webContents.printToPDF({
            printBackground: true,
            pageSize: {
              width: 3.15,
              height: Math.max(6.3, 4.4 + order.items.length * 0.48),
            },
          }),
        );
    } finally {
      w.close();
    }
  } else {
    const { response } = await dialog.showMessageBox(w, {
      message: "التذكرة جاهزة للعرض. هل تريد الطباعة؟",
      buttons: ["عرض فقط", "طباعة"],
      defaultId: 0,
    });
    if (response === 1)
      w.webContents.print(
        { silent: false, printBackground: true },
        (ok, reason) => {
          if (!ok)
            dialog.showErrorBox(
              "لم تتم الطباعة",
              reason || "أعد المحاولة من سجل الطلبات",
            );
        },
      );
  }
  return true;
}
app.whenReady().then(() => {
  service = new Service(join(app.getPath("userData"), "cafe-v2.sqlite"));
  sync = new Sync(service, {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    email: process.env.SUPABASE_DEVICE_EMAIL,
    password: process.env.SUPABASE_DEVICE_PASSWORD,
    cafe_id: process.env.CAFE_ID,
    device_id: process.env.DEVICE_ID,
  });
  sync.start();
  const dailyBackup = async () => {
    try {
      await trackedBackup(join(app.getPath("userData"), "backups"));
    } catch {
      dialog.showErrorBox(
        "النسخ الاحتياطي",
        "تعذر حفظ النسخة التلقائية؛ تحقق من مساحة القرص",
      );
    }
  };
  dailyBackup();
  backupTimer = setInterval(dailyBackup, 24 * 3600000);
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#171411",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  window.loadFile(join(__dirname, "../renderer/index.html"));
  window.maximize();
  ipcMain.handle("cafe:call", async (event, method, data = {}) => {
    try {
      if (event.sender !== window.webContents) throw Error("Untrusted sender");
      const args = data.args || {};
      const token = data.token;
      if (method === "info")
        return {
          ok: true,
          value: {
            setup: !service.db.prepare("SELECT 1 FROM users LIMIT 1").get(),
            sync: sync.status,
            version: app.getVersion(),
          },
        };
      if (method === "kiosk") {
        service.user(token);
        window.setFullScreen(!window.isFullScreen());
        return { ok: true, value: true };
      }
      if (method === "backup") {
        service.user(token, "admin");
        const { filePaths, canceled } = await dialog.showOpenDialog(window, {
          properties: ["openDirectory", "createDirectory"],
        });
        return {
          ok: true,
          value: canceled ? null : await trackedBackup(filePaths[0]),
        };
      }
      if (method === "print" || method === "pdf")
        return {
          ok: true,
          value: await receiptWindow(token, args.id, method === "pdf"),
        };
      if (method === "reportPdf") {
        const report = service.report(token, args);
        const { filePath } = await dialog.showSaveDialog(window, {
          defaultPath: `CafeSelection-Report-${report.period}.pdf`,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!filePath) return { ok: true, value: false };
        const pdfWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        try {
          await pdfWindow.loadURL(
            "data:text/html;charset=utf-8," +
              encodeURIComponent(require("./report.cjs").reportHTML(report)),
          );
          writeFileSync(
            filePath,
            await pdfWindow.webContents.printToPDF({
              pageSize: "A4",
              printBackground: true,
            }),
          );
        } finally {
          pdfWindow.destroy();
        }
        return { ok: true, value: true };
      }
      if (method === "excel") {
        const report = service.report(token, args);
        const { filePath } = await dialog.showSaveDialog(window, {
          defaultPath: `CafeSelection-${report.period}.xlsx`,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
        });
        if (filePath) {
          const Excel = require("exceljs"),
            book = new Excel.Workbook(),
            sheet = book.addWorksheet("التقرير", {
              views: [{ rightToLeft: true }],
            });
          sheet.addRow(["Café Sélection", report.period]);
          sheet.addRow([
            "المداخيل",
            report.revenue / 100,
            "المصاريف",
            report.expenses / 100,
            "الصافي",
            report.net / 100,
          ]);
          sheet.addRow([
            "اليوم",
            "النقدي",
            "تسديد الديون",
            "المصاريف",
            "الصافي",
            "على الحساب",
            "التذاكر",
          ]);
          for (const d of report.days)
            sheet.addRow([
              d.day,
              d.cash / 100,
              d.repaid / 100,
              d.expenses / 100,
              (d.cash + d.repaid - d.expenses) / 100,
              d.credit / 100,
              d.count,
            ]);
          sheet.columns.forEach((c) => (c.width = 21));
          const products = book.addWorksheet("المنتجات", {
            views: [{ rightToLeft: true }],
          });
          products.addRow(["المنتج", "الكمية", "إجمالي البيع"]);
          for (const p of report.top)
            products.addRow([p.name, p.quantity, p.total / 100]);
          products.columns.forEach((c) => (c.width = 25));
          await book.xlsx.writeFile(filePath);
        }
        return { ok: true, value: !!filePath };
      }
      if (!methods.has(method)) throw Error("عملية غير مدعومة");
      const value =
        method === "setup" || method === "login"
          ? service[method](args)
          : service[method](token, args);
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  sync?.stop();
  clearInterval(backupTimer);
  Promise.allSettled([...pendingBackups]).then(() => {
    quitting = true;
    service?.close();
    app.quit();
  });
});
