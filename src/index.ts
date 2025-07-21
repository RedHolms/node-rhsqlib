// TODO FIXME refactor this shitty code

import assert from "assert";
import { openSqliteDatabase, type SqliteDatabase } from "./sqlite";
import { WeakRefMap } from "./WeakRefMap";

interface ColumnSchema {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  default?: any | (() => any);
}

export class TableSchema {
  name: string;
  columns: ColumnSchema[];

  constructor(name: string) {
    this.name = name;
    this.columns = [];
  }

  Column(name: string, type: string): this {
    this.columns.push({
      name, type,
      primaryKey: false,
      notNull: false,
      unique: false
    });
    return this;
  }

  PrimaryKey(): this {
    if (this.columns.length === 0)
      throw new Error("No columns");

    this.columns[this.columns.length - 1].primaryKey = true;

    return this;
  }

  NotNull(): this {
    if (this.columns.length === 0)
      throw new Error("No columns");

    this.columns[this.columns.length - 1].notNull = true;

    return this;
  }

  Unique(): this {
    if (this.columns.length === 0)
      throw new Error("No columns");

    this.columns[this.columns.length - 1].unique = true;

    return this;
  }

  Default(valueOrGenerator: any): this {
    if (this.columns.length === 0)
      throw new Error("No columns");

    this.columns[this.columns.length - 1].default = valueOrGenerator;

    return this;
  }
}

// used in cache map as unexisting of row
const NONE = Symbol();

class Table {
  db: Database;
  schema: TableSchema;
  colsMap: Map<string, ColumnSchema>;
  initPromise: Promise<void>;
  pkeyName: string;
  // pkey to row
  cache: WeakRefMap<any, any | typeof NONE>;

  constructor(db: Database, schema: TableSchema) {
    this.db = db;
    this.schema = schema;
    this.colsMap = new Map(
      schema.columns.map((col) => [col.name, col])
    );

    if (this.colsMap.size !== schema.columns.length)
      throw new Error("Duplicate columns in table " + this.schema.name);

    const pcol = this.schema.columns.find((col) => col.primaryKey);
    if (pcol === undefined)
      throw new Error("No primary key in table " + this.schema.name);

    this.pkeyName = pcol.name;
    this.cache = new WeakRefMap();

    this.initPromise = this.init();
  }

  async get(pKey: any) {
    const cached = this.cache.get(pKey);
    if (cached !== undefined)
      return cached === NONE ? undefined : cached;

    const result = await this.getBy(this.pkeyName, pKey);

    this.cache.set(pKey, result);
    return result;
  }

  async getBy(column: string, value: any) {
    const col = this.colsMap.get(column);

    if (col === undefined)
      throw new Error("no col " + column); // fixme lazy error msg

    const sqlValue = await this.serializeToSql(col, value);
    const rows = await this.query(`SELECT * FROM $tablename$ WHERE ${column}=?`, sqlValue);

    if (col.unique || col.primaryKey) {
      const row = rows[0];
      return row ? this.transformColumn(row) : undefined;
    }
    
    return rows.map((row) => this.transformColumn(row));
  }

  async list() {
    await this.initPromise;

    const result = await this.query("SELECT * FROM $tablename$");
    return result.map((col) => this.transformColumn(col));
  }

  async update(pKey: any, column: string, value: any) {
    const cached = this.cache.get(pKey);
    if (cached !== undefined) {
      if (cached === NONE)
        return;

      cached[column] = value;
    }

    await this.updateBy(this.pkeyName, pKey, column, value);
  }

  async updateBy(queryColumn: string, queryValue: any, column: string, value: any) {
    const qcol = this.colsMap.get(queryColumn);

    if (qcol === undefined)
      throw new Error("no col " + queryColumn); // fixme lazy error msg

    const col = this.colsMap.get(column);

    if (col === undefined)
      throw new Error("no col " + column); // fixme lazy error msg

    const sqlQValue = await this.serializeToSql(qcol, queryValue);
    const sqlValue = await this.serializeToSql(qcol, value);

    await this.query(`UPDATE $tablename$ SET ${column}=? WHERE ${queryColumn}=?`, sqlValue, sqlQValue);

    if (queryColumn !== this.pkeyName)
      this.invalidateCache();
  }

  delete(pKey: any) {
    this.cache.set(pKey, NONE);
    return this.deleteBy(this.pkeyName, pKey);
  }

  async deleteBy(column: string, value: any) {
    const col = this.colsMap.get(column);

    if (col === undefined)
      throw new Error("no col " + column); // fixme lazy error msg

    const sqlValue = await this.serializeToSql(col, value);
    await this.query(`DELETE FROM $tablename$ WHERE ${column}=?`, sqlValue);

    if (column !== this.pkeyName)
      this.invalidateCache();
  }

  async deleteAll() {
    this.invalidateCache();
    await this.query("DELETE FROM $tablename$");
  }

  async insert(init: any) {
    const values = [];

    for (const col of this.schema.columns)
      values.push(await this.serializeToSql(col, init[col.name]));

    let query = "INSERT INTO $tablename$ VALUES (";

    let sep = '';
    for (let count = values.length; count > 0; --count) {
      query += sep + "?";
      sep = ',';
    }

    query += ")";
    await this.query(query, ...values);

    // cache
    this.get(init[this.pkeyName]);
  }

  query(query: string, ...args: any[]): Promise<any[]> {
    return this.db.query(query.replaceAll("$tablename$", this.schema.name), ...args);
  }

  invalidateCache() {
    this.cache.clear();
  }

  // js value to sql value
  private async serializeToSql(col: ColumnSchema, init: any | undefined): Promise<any> {
    const {
      name, type, notNull,
      primaryKey,
      // :-(
      default: _default
    } = col;

    let value;
    if (typeof init === "undefined") {
      if (_default) {
        if (typeof _default === "function")
          value = await _default();
        else
          value = _default;
      }
      else {
        if (notNull || primaryKey)
          throw new Error("no value for " + name); // fixme laxy error msg

        value = null;
      }
    }
    else {
      value = init;
    }

    let result = value;

    if (value !== null) {
      switch (type) {
        case "BOOLEAN":
          result = value ? 1 : 0;
          break;
        case "INT":
        case "BIGINT":
        case "MONEY":
        case "TEXT":
          break;
        case "DATETIME":
          result = (value as Date).toUTCString();
          break;
      }
    }

    return result;
  }

  private transformColumn(raw: any): any {
    const result: any = {};

    for (const col of this.schema.columns) {
      const { name, type } = col;

      if (!Object.hasOwn(raw, name))
        throw new Error(name);//fixme lazy error msg

      const rawValue = raw[name];
      let value = rawValue;

      switch (type) {
        case "BOOLEAN":
          value = !!rawValue;
          break;
        case "INT":
        case "BIGINT":
        case "MONEY":
        case "TEXT":
          break;
        case "DATETIME":
          value = Date.parse(rawValue);
          break;
      }

      result[name] = value;
    }

    return result;
  }

  private genColDef(column: ColumnSchema): string {
    let result = `${column.name} ${column.type} `;

    if (column.primaryKey)
      result += "PRIMARY KEY ";
    if (column.unique)
      result += "UNIQUE ";
    if (column.notNull)
      result += "NOT NULL ";
    if (column.default)
      // "default" is done in JS
      void 0;

    return result;
  }

  private async createTable() {
    const { name, columns } = this.schema;

    let query = `CREATE TABLE IF NOT EXISTS ${name} (`;
    
    let sep = '';
    for (const column of columns) {
      query += sep;
      sep = ',';

      query += this.genColDef(column);
    }
    query += ")";

    await this.db.query(query);
  }

  private async init() {
    const { name, columns } = this.schema;

    const tableInfo = await this.db.query(`PRAGMA table_info(${name});`);
    if (tableInfo.length === 0)
      return await this.createTable();

    // check the table

    let info: string | undefined = undefined;

    for (let i = 0; i < tableInfo.length; ++i) {
      const sqlColumn = tableInfo[i];
      assert(sqlColumn.cid === i);

      const column = columns[sqlColumn.cid];

      if (column === undefined) {
        info = `No column #${sqlColumn.cid} (sql name: ${sqlColumn.name})`;
        break;
      }

      if (column.name !== sqlColumn.name) {
        info = `Column #${sqlColumn.cid} name is different (` +
          `sql name: ${sqlColumn.name}, ` +
          `js name: ${column.name})`;
        break;
      }

      if (column.type !== sqlColumn.type) {
        info = `Column #${sqlColumn.cid} type is different (` +
          `name: ${sqlColumn.name}, ` +
          `sql type: ${sqlColumn.type}, ` +
          `js type: ${column.type})`;
        break;
      }

      if (column.primaryKey !== !!sqlColumn.pk) {
        info = `Column #${sqlColumn.cid} PRIMARY KEY flag is different (` +
          `name: ${sqlColumn.name}, ` +
          `sql flag: ${!!sqlColumn.pk}, ` +
          `js flag: ${column.primaryKey})`;
        break;
      }

      if (column.notNull !== !!sqlColumn.notnull) {
        info = `Column #${sqlColumn.cid} NOT NULL flag is different (` +
          `name: ${sqlColumn.name}, ` +
          `sql flag: ${!!sqlColumn.pk}, ` +
          `js flag: ${column.primaryKey})`;
        break;
      }

      //TODO check UNIQUE
    }

    if (info !== undefined) {
      // can't safely continue
      console.error("[RHSQLIB] Trying to UNSAFELY modify table %s", name);
      console.error("[RHSQLIB] %s", info);
      console.error("[RHSQLIB] To prevent error we can't continue. Open database file in sqlite CLI and modify table there");
      console.error("[RHSQLIB] Program will now exit");
      process.exit(1);
    }

    // add new columns
    for (let i = tableInfo.length; i < columns.length; ++i) {
      const column = columns[i];
      const def = this.genColDef(column);

      console.warn("[RHSQLIB] Adding new column %s to table %s ( %s )", column.name, name, def);

      await this.db.query(`ALTER TABLE ${name} ADD COLUMN ${def}`);
    }
  }
}

const kDBHandle = Symbol("DatabaseHandle");
const kDBInitPromise = Symbol("DatabaseInitPromise");

export class Database {
  declare [kDBHandle]: SqliteDatabase;
  [kDBInitPromise]: Promise<void>;

  constructor(schemas: TableSchema[]) {
    this[kDBInitPromise] =
      openSqliteDatabase("database")
        .then( (db) => void (this[kDBHandle] = db) );

    for (const schema of schemas)
      (this as any)[schema.name] = new Table(this, schema);
  }
  
  async query(query: string, ...args: any[]): Promise<any[]> {
    await this[kDBInitPromise];
    return this[kDBHandle].query(query, ...args);
  }
}

export default {
  Database, TableSchema
};
