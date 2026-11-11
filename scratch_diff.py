import sqlite3
c1 = set(r[0] for r in sqlite3.connect('avd_crm.db').execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())
c2 = set(r[0] for r in sqlite3.connect('backend/avd_crm.db').execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())
print('In backend but not root:', c2 - c1)
