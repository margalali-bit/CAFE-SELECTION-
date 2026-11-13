import os
import sys
from datetime import date
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QLineEdit, QMessageBox, QInputDialog, QComboBox, QDateEdit,
    QTableWidget, QTableWidgetItem, QFileDialog)
from .database import Database

THEME = '''QWidget {background:#1E1B18;color:#E6E1DC;font-size:16px;}
QPushButton {background:#3A322C;border:1px solid #C5A059;border-radius:8px;padding:14px;}
QPushButton:hover {background:#806538;} QLineEdit,QComboBox,QDateEdit {padding:10px;background:#2D2822;}
QLabel#brand {font-size:28px;color:#C5A059;}'''


class Window(QWidget):
    def __init__(self, db):
        super().__init__()
        self.db, self.session, self.cart = db, None, {}
        self.setWindowTitle('Café Sélection — تيزنيت')
        self.resize(1100, 760)
        self.layout = QVBoxLayout(self)
        self.login_screen()

    def reset(self):
        while self.layout.count():
            item = self.layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        brand = QLabel('Café Sélection | تيزنيت')
        brand.setObjectName('brand')
        self.layout.addWidget(brand)

    def button(self, text, callback):
        button = QPushButton(text)
        button.clicked.connect(lambda: self.safe(callback))
        self.layout.addWidget(button)

    def safe(self, action):
        try:
            action()
        except Exception as exc:
            QMessageBox.warning(self, 'تعذر إتمام العملية', str(exc))

    def login_screen(self):
        self.reset()
        self.first_run = not self.db.conn.execute('SELECT 1 FROM users LIMIT 1').fetchone()
        self.layout.addWidget(QLabel('إنشاء حساب المالك لأول تشغيل' if self.first_run else 'تسجيل الدخول'))
        self.name, self.pin = QLineEdit(), QLineEdit()
        self.name.setPlaceholderText('اسم المستخدم')
        self.pin.setPlaceholderText('PIN من 6 إلى 12 رقماً')
        self.pin.setEchoMode(QLineEdit.Password)
        self.pin.setMaxLength(12)
        self.layout.addWidget(self.name)
        self.layout.addWidget(self.pin)
        self.button('دخول / حفظ حساب المالك', self.login)

    def login(self):
        if self.first_run:
            self.db.bootstrap(self.name.text(), self.pin.text())
        self.session = self.db.login(self.name.text(), self.pin.text())
        self.pos()

    def logout(self):
        self.db.logout(self.session)
        self.session, self.cart = None, {}
        self.login_screen()

    def pos(self):
        self.reset()
        user = self.db._user(self.session)
        self.layout.addWidget(QLabel('المستخدم: ' + user['name']))
        if user['role'] == 'admin':
            self.button('لوحة المالك والمصاريف والتقارير', self.admin)
        self.button('تسجيل الخروج', self.logout)
        self.product = QComboBox()
        for p in self.db.products(self.session):
            self.product.addItem(f"{p['name']} — {p['price_cents']/100:.2f} د.م", p['id'])
        self.layout.addWidget(self.product)
        self.button('إضافة المنتج إلى السلة', self.add_cart)
        self.cart_label = QLabel()
        self.layout.addWidget(self.cart_label)
        self.render_cart()
        self.button('إفراغ السلة', self.clear_cart)
        self.button('تسجيل الطلب المدفوع محلياً', self.checkout)
        self.layout.addWidget(QLabel('الطباعة والمزامنة السحابية غير مفعّلتين في هذه المرحلة'))

    def add_cart(self):
        product_id = self.product.currentData()
        if product_id:
            self.cart[product_id] = self.cart.get(product_id, 0) + 1
            self.render_cart()

    def render_cart(self):
        products = {p['id']: p for p in self.db.products(self.session)}
        lines, total = [], 0
        for key, qty in self.cart.items():
            if key in products:
                p = products[key]
                total += qty * p['price_cents']
                lines.append(f"{p['name']} × {qty}")
        self.cart_label.setText('\n'.join(lines) + f'\nالمجموع: {total/100:.2f} د.م')

    def clear_cart(self):
        self.cart.clear()
        self.render_cart()

    def checkout(self):
        order_id = self.db.checkout(self.session, self.cart)
        self.clear_cart()
        QMessageBox.information(self, 'تم الحفظ المحلي', f'رقم الطلب: {order_id}')

    def ask(self, title, secret=False):
        value, ok = QInputDialog.getText(self, title, title,
            QLineEdit.Password if secret else QLineEdit.Normal)
        if not ok:
            raise ValueError('تم إلغاء العملية')
        return value

    def admin(self):
        self.db._admin(self.session)
        self.reset()
        self.button('العودة للكاشير', self.pos)
        self.button('إضافة منتج', lambda: self.db.add_product(self.session, self.ask('اسم المنتج'), self.ask('الثمن بالدرهم')))
        self.button('إضافة مصروف', self.expense)
        self.button('إضافة نادل', lambda: self.db.add_waiter(self.session, self.ask('اسم النادل'), self.ask('PIN جديد', True)))
        self.button('تغيير PIN مستخدم', self.change_pin)
        self.button('نسخ احتياطي آمن', self.backup)
        self.period = QComboBox()
        self.period.addItems(['يومي', 'شهري'])
        self.selected = QDateEdit()
        self.selected.setCalendarPopup(True)
        self.selected.setDate(date.today())
        self.layout.addWidget(self.period)
        self.layout.addWidget(self.selected)
        self.summary = QLabel()
        self.layout.addWidget(self.summary)
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(['اليوم', 'المداخيل', 'المصاريف', 'الصافي'])
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.layout.addWidget(self.table)
        self.button('تحديث التقرير', self.report)
        self.button('تصدير Excel', self.export)
        self.report()

    def expense(self):
        self.db.add_expense(self.session, self.ask('عنوان المصروف'), self.ask('المبلغ بالدرهم'), self.ask('ملاحظات'))
        self.report()

    def change_pin(self):
        users = self.db.conn.execute('SELECT id,name FROM users ORDER BY name').fetchall()
        name, ok = QInputDialog.getItem(self, 'المستخدم', 'اختر الحساب', [u['name'] for u in users], 0, False)
        if ok:
            user_id = next(u['id'] for u in users if u['name'] == name)
            own = user_id == self.db._user(self.session)['id']
            self.db.change_pin(self.session, user_id, self.ask('PIN جديد', True))
            if own:
                self.logout()

    def report(self):
        self.current_report = self.db.report(self.session, self.selected.date().toPython(), self.period.currentIndex() == 1)
        r = self.current_report
        self.summary.setText(f"المداخيل: {r['revenue']/100:.2f} | المصاريف: {r['expenses']/100:.2f} | الصافي: {r['net']/100:.2f} د.م | التذاكر: {r['tickets']}")
        self.table.setRowCount(len(r['days']))
        for row, values in enumerate(r['days']):
            for col, value in enumerate(values):
                self.table.setItem(row, col, QTableWidgetItem(str(value) if col == 0 else f'{value/100:.2f}'))

    def export(self):
        from openpyxl import Workbook
        self.report()
        path, _ = QFileDialog.getSaveFileName(self, 'حفظ Excel', 'CafeSelection.xlsx', 'Excel (*.xlsx)')
        if not path:
            return
        if not path.lower().endswith('.xlsx'):
            path += '.xlsx'
        workbook = Workbook()
        sheet = workbook.active
        sheet.sheet_view.rightToLeft = True
        sheet.append(['Café Sélection', 'المبالغ بالدرهم'])
        sheet.append(['اليوم', 'المداخيل', 'المصاريف', 'الصافي'])
        for day, rev, exp, net in self.current_report['days']:
            sheet.append([day, rev/100, exp/100, net/100])
        workbook.save(path)

    def backup(self):
        folder = QFileDialog.getExistingDirectory(self, 'مجلد النسخ الاحتياطي')
        if folder:
            path = self.db.backup(self.session, folder)
            QMessageBox.information(self, 'تم النسخ والتحقق', str(path))


def main():
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.RightToLeft)
    app.setStyleSheet(THEME)
    root = Path(os.getenv('LOCALAPPDATA', str(Path.home()))) / 'CafeSelection'
    db = Database(root / 'cafe.db')
    window = Window(db)
    window.show()
    result = app.exec()
    db.conn.close()
    return result


if __name__ == '__main__':
    sys.exit(main())
