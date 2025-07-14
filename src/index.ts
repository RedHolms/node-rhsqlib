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
  private initPromise: Promise<void>;

  constructor(db: Database, schema: TableSchema) {
    this.initPromise = (async () => {
      
    })();
  }
}

const kDBHandle = Symbol("DatabaseHandle");
const kDBInitPromise = Symbol("DatabaseInitPromise");

export class Database {
  [name: string]: Table;

  declare [kDBHandle]: SqliteDatabase;
  [kDBInitPromise]: Promise<void>;

  constructor(schemas: TableSchema[]) {
    for (const schema of schemas)
      this[schema.name] = new Table(this, schema);

    this[kDBInitPromise] = 
      openSqliteDatabase("database")
        .then( (db) => void (this[kDBHandle] = db) );
  }
  
  async query(query: string, ...args: any[]): Promise<any[]> {
    await this[kDBInitPromise];
    return this[kDBHandle].query(query, ...args);
  }
}
