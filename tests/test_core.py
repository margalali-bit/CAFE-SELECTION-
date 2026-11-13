import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import date
from pathlib import Path
from desktop_pos.database import Database, money


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.temp.name) / 'test.db')
        self.db.bootstrap('Owner', '982761')
        self.admin = self.db.login('Owner', '982761')
        self.db.add_waiter(self.admin, 'Waiter', '124679')
        self.waiter = self.db.login('Waiter', '124679')

    def tearDown(self):
        self.db.conn.close()
        self.temp.cleanup()

    def test_money(self):
        self.assertEqual(money('12.35'), 1235)
        for value in ['NaN', 'Infinity', '-1', '0', '0.001']:
            with self.assertRaises(ValueError):
                money(value)

    def test_permissions_and_hash(self):
        row = self.db.conn.execute("SELECT * FROM users WHERE name='Owner'").fetchone()
        self.assertNotEqual(row['pin_hash'], '982761')
        with self.assertRaises(PermissionError):
            self.db.add_expense(self.waiter, 'Milk', '10')
        with self.assertRaises(PermissionError):
            self.db.report(self.waiter, date.today())
        with self.assertRaises(PermissionError):
            self.db.bootstrap('Other', '123456')

    def test_checkout_report_and_outbox(self):
        product = self.db.add_product(self.admin, 'Tea', '10.25')
        self.db.checkout(self.waiter, {product: 2}, 'stable-request')
        with self.assertRaises(ValueError):
            self.db.checkout(self.waiter, {product: 2}, 'stable-request')
        self.db.add_expense(self.admin, 'Milk', '4.50')
        report = self.db.report(self.admin, date.today())
        self.assertEqual((report['revenue'], report['expenses'], report['net'], report['tickets']), (2050,450,1600,1))
        self.assertEqual(self.db.conn.execute('SELECT COUNT(*) FROM outbox').fetchone()[0], 2)
        self.assertEqual(len(self.db.report(self.admin, date(2024,2,5), True)['days']), 29)

    def test_atomic_failure_and_backup(self):
        product = self.db.add_product(self.admin, 'Tea', '10')
        with self.assertRaises(ValueError):
            self.db.checkout(self.waiter, {product: 1, 'missing': 1})
        self.assertEqual(self.db.conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0], 0)
        path = self.db.backup(self.admin, Path(self.temp.name) / 'backups')
        with closing(sqlite3.connect(path)) as copy:
            self.assertEqual(copy.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(copy.execute('SELECT COUNT(*) FROM users').fetchone()[0], 2)

    def test_pin_rotation_and_lockout(self):
        user_id = self.db._user(self.waiter)['id']
        self.db.change_pin(self.admin, user_id, '776655')
        with self.assertRaises(PermissionError):
            self.db.products(self.waiter)
        self.db.login('Waiter', '776655')
        for _ in range(5):
            with self.assertRaises(PermissionError):
                self.db.login('Waiter', '111111')
        with self.assertRaises(PermissionError):
            self.db.login('Waiter', '776655')


if __name__ == '__main__':
    unittest.main()
