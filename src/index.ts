import assert from "assert";
import { openSqliteDatabase, type SqliteDatabase } from "./sqlite";

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

class Table {
  db: Database;
  schema: TableSchema;
  initPromise: Promise<void>;

  constructor(db: Database, schema: TableSchema) {
    this.db = db;
    this.schema = schema;
    this.initPromise = this.init();
  }

  private genColDef(column: ColumnSchema): string {
    let result = `${column.name} ${column.type} `;

    if (column.primaryKey) {
      result += "PRIMARY KEY ";
    }
    else {
      if (column.unique)
        result += "UNIQUE ";
      if (column.notNull)
        result += "NOT NULL ";
      if (column.default)
        // "default" is done in JS
        void 0;
    }

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
