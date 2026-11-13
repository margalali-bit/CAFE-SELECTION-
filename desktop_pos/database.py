"""Offline accounting core. Amounts are integer Moroccan centimes."""
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4


def money(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount != amount.quantize(Decimal('.01')):
            raise ValueError('أدخل مبلغاً موجباً بمنزلتين عشريتين كحد أقصى')
        return int(amount * 100)
    except InvalidOperation as exc:
        raise ValueError('مبلغ غير صالح') from exc


class Database:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys=ON')
        self.conn.execute('PRAGMA journal_mode=WAL')
        self.conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, salt TEXT NOT NULL,
          pin_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','waiter')),
          active INTEGER NOT NULL DEFAULT 1, failures INTEGER NOT NULL DEFAULT 0,
          locked_until REAL NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
          price_cents INTEGER NOT NULL CHECK(price_cents>0), available INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
          total_cents INTEGER NOT NULL CHECK(total_cents>0),
          status TEXT NOT NULL CHECK(status IN ('paid','cancelled')), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS order_items (
          order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id),
          name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0),
          unit_cents INTEGER NOT NULL CHECK(unit_cents>0), PRIMARY KEY(order_id,product_id));
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
          amount_cents INTEGER NOT NULL CHECK(amount_cents>0), notes TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox (
          event_id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
          created_at TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS orders_date ON orders(created_at);
        CREATE INDEX IF NOT EXISTS expenses_date ON expenses(created_at);
        ''')
        self._sessions = {}

    @staticmethod
    def _hash(pin, salt):
        return hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()

    def _admin(self, session):
        return self._user(session, 'admin')

    def _user(self, session, role=None):
        user = self.conn.execute('SELECT id,name,role FROM users WHERE id=? AND active=1',
                                 (self._sessions.get(session),)).fetchone()
        if not user or (role and user['role'] != role):
            raise PermissionError('ليست لديك صلاحية لهذه العملية')
        return dict(user)

    def bootstrap(self, name, pin):
        if self.conn.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            raise PermissionError('تم إعداد المالك مسبقاً')
        self._create_user(name, pin, 'admin')

    def _create_user(self, name, pin, role):
        if not name.strip() or not pin.isascii() or not pin.isdigit() or not 6 <= len(pin) <= 12:
            raise ValueError('الاسم مطلوب وPIN من 6 إلى 12 رقماً')
        salt = secrets.token_hex(16)
        with self.conn:
            self.conn.execute('INSERT INTO users(id,name,salt,pin_hash,role) VALUES(?,?,?,?,?)',
                              (str(uuid4()), name.strip(), salt, self._hash(pin, salt), role))

    def add_waiter(self, session, name, pin):
        self._admin(session)
        self._create_user(name, pin, 'waiter')

    def change_pin(self, session, user_id, pin):
        self._admin(session)
        if not pin.isascii() or not pin.isdigit() or not 6 <= len(pin) <= 12:
            raise ValueError('PIN من 6 إلى 12 رقماً')
        salt = secrets.token_hex(16)
        with self.conn:
            self.conn.execute('UPDATE users SET salt=?,pin_hash=?,failures=0,locked_until=0 WHERE id=?',
                              (salt, self._hash(pin, salt), user_id))
        self._sessions = {k: v for k, v in self._sessions.items() if v != user_id}

    def login(self, name, pin):
        user = self.conn.execute('SELECT * FROM users WHERE name=? AND active=1', (name,)).fetchone()
        if not user or user['locked_until'] > time.time():
            raise PermissionError('بيانات الدخول غير صحيحة أو الحساب مقفل مؤقتاً')
        if not hmac.compare_digest(user['pin_hash'], self._hash(pin, user['salt'])):
            failures = user['failures'] + 1
            with self.conn:
                self.conn.execute('UPDATE users SET failures=?,locked_until=? WHERE id=?',
                                  (failures, time.time() + 60 if failures >= 5 else 0, user['id']))
            raise PermissionError('بيانات الدخول غير صحيحة')
        with self.conn:
            self.conn.execute('UPDATE users SET failures=0,locked_until=0 WHERE id=?', (user['id'],))
        token = secrets.token_urlsafe(32)
        self._sessions[token] = user['id']
        return token

    def logout(self, session):
        self._sessions.pop(session, None)

    def add_product(self, session, name, price):
        self._admin(session)
        if not name.strip():
            raise ValueError('اسم المنتج مطلوب')
        product_id = str(uuid4())
        with self.conn:
            self.conn.execute('INSERT INTO products VALUES(?,?,?,1)', (product_id, name.strip(), money(price)))
        return product_id

    def products(self, session):
        self._user(session)
        return [dict(r) for r in self.conn.execute('SELECT * FROM products WHERE available=1 ORDER BY name')]

    def _event(self, kind, entity_id, payload):
        self.conn.execute('INSERT INTO outbox VALUES(?,?,?,?,0)',
                          (entity_id, kind, json.dumps(payload, ensure_ascii=False), datetime.now().isoformat()))

    def checkout(self, session, cart, request_id=None):
        user = self._user(session)
        if not cart or any(type(q) is not int or q <= 0 for q in cart.values()):
            raise ValueError('السلة فارغة أو الكمية غير صالحة')
        order_id = request_id or str(uuid4())
        with self.conn:
            existing = self.conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
            if existing:
                raise ValueError('تم تسجيل هذا الطلب مسبقاً؛ لا تعاود الدفع')
            items = []
            for product_id, quantity in cart.items():
                p = self.conn.execute('SELECT * FROM products WHERE id=? AND available=1', (product_id,)).fetchone()
                if not p:
                    raise ValueError('أحد المنتجات غير متاح؛ حدّث السلة')
                items.append(dict(product_id=product_id, name=p['name'], quantity=quantity, unit_cents=p['price_cents']))
            total = sum(i['quantity'] * i['unit_cents'] for i in items)
            created = datetime.now().astimezone().isoformat()
            self.conn.execute('INSERT INTO orders VALUES(?,?,?,?,?)', (order_id, user['id'], total, 'paid', created))
            self.conn.executemany('INSERT INTO order_items VALUES(?,?,?,?,?)',
                                 [(order_id, i['product_id'], i['name'], i['quantity'], i['unit_cents']) for i in items])
            self._event('order.created', order_id, dict(id=order_id, user_id=user['id'], total_cents=total,
                                                       created_at=created, status='paid', items=items))
        return order_id

    def add_expense(self, session, title, amount, notes=''):
        user = self._admin(session)
        if not title.strip():
            raise ValueError('عنوان المصروف مطلوب')
        payload = dict(id=str(uuid4()), user_id=user['id'], title=title.strip(), amount_cents=money(amount),
                       notes=notes, created_at=datetime.now().astimezone().isoformat())
        with self.conn:
            self.conn.execute('INSERT INTO expenses VALUES(:id,:user_id,:title,:amount_cents,:notes,:created_at)', payload)
            self._event('expense.created', payload['id'], payload)

    def report(self, session, selected, monthly=False):
        self._admin(session)
        start = selected.replace(day=1) if monthly else selected
        end = ((start.replace(day=28) + timedelta(days=4)).replace(day=1) if monthly else start + timedelta(days=1))
        # Business dates are recorded using the POS local timezone (Africa/Casablanca).
        bounds = (start.isoformat(), end.isoformat())
        revenue = self.conn.execute("SELECT COALESCE(SUM(total_cents),0),COUNT(*) FROM orders WHERE status='paid' AND created_at>=? AND created_at<?", bounds).fetchone()
        expense = self.conn.execute('SELECT COALESCE(SUM(amount_cents),0) FROM expenses WHERE created_at>=? AND created_at<?', bounds).fetchone()[0]
        days = []
        current = start
        while current < end:
            key = current.isoformat()
            rev = self.conn.execute("SELECT COALESCE(SUM(total_cents),0) FROM orders WHERE status='paid' AND substr(created_at,1,10)=?", (key,)).fetchone()[0]
            exp = self.conn.execute('SELECT COALESCE(SUM(amount_cents),0) FROM expenses WHERE substr(created_at,1,10)=?', (key,)).fetchone()[0]
            days.append((key, rev, exp, rev-exp))
            current += timedelta(days=1)
        return dict(revenue=revenue[0], expenses=expense, net=revenue[0]-expense, tickets=revenue[1], days=days)

    def backup(self, session, directory):
        self._admin(session)
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / f'cafe-{datetime.now():%Y%m%d-%H%M%S}-{uuid4().hex[:8]}.db'
        with sqlite3.connect(target) as destination:
            self.conn.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('فشل التحقق من النسخة الاحتياطية')
        return target
