const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const rawDb = new DatabaseSync(path.join(__dirname, 'monitor.db'));
rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

function normalizeParams(args) {
  return args.map(a => (a === undefined ? null : a));
}

function makeStmtCompat(stmt) {
  return {
    all(...args) {
      return stmt.all(...normalizeParams(args));
    },
    get(...args) {
      const rows = stmt.all(...normalizeParams(args));
      return rows.length > 0 ? rows[0] : undefined;
    },
    run(...args) {
      const info = stmt.run(...normalizeParams(args));
      return {
        lastInsertRowid: typeof info.lastInsertRowid === 'number'
          ? info.lastInsertRowid
          : Number(info.lastInsertRowid),
        changes: info.changes
      };
    }
  };
}

const db = {
  raw: rawDb,
  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    return makeStmtCompat(stmt);
  },
  exec(sql) {
    rawDb.exec(sql);
  },
  transaction(fn) {
    // node:sqlite doesn't support wrapped transactions directly on DatabaseSync;
    // emulate with BEGIN/COMMIT
    return function (...args) {
      rawDb.exec('BEGIN');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (e) {
        rawDb.exec('ROLLBACK');
        throw e;
      }
    };
  },
  close() {
    rawDb.close();
  }
};

module.exports = db;