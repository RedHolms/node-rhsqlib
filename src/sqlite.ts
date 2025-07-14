import sqlite3 from "sqlite3";
import { open as dbopen } from "sqlite";
import { Database as SqliteDatabaseHandle } from "sqlite";

export enum SqliteError {
  SUCCESS,
  CONSTRAINT,
  NO_TABLE,
  UNKNOWN = -1
}

export type SqliteDatabaseResult = any[];

export class SqliteDatabaseError extends Error {
  declare readonly code: number;

  constructor(code: number, info: string) {
    super(info);
    this.code = code;
  }
}

export class SqliteDatabaseUnknownError extends SqliteDatabaseError {
  constructor(info: string) {
    super(SqliteError.UNKNOWN, info);
  }
}

export class SqliteDatabaseConstaintError extends SqliteDatabaseError {
  readonly constraintName: string;
  readonly tableName: string;
  readonly fieldName: string;

  constructor(constraintName: string, tableName: string, fieldName: string) {
    super(SqliteError.CONSTRAINT, `SQLError.CONSTRAINT: ${constraintName}: ${tableName}.${fieldName}`);

    this.constraintName = constraintName;
    this.tableName = tableName;
    this.fieldName = fieldName;
  }
}

export class SqliteDatabaseNoTableError extends SqliteDatabaseError {
  readonly tableName: string;

  constructor(tableName: string) {
    super(SqliteError.NO_TABLE, `SQLError.NO_TABLE: ${tableName}`);

    this.tableName = tableName;
  }
}

interface SqliteRawSQLError {
  errno?: string;
  code?: string;
}

export class SqliteDatabase {
  declare private handle: SqliteDatabaseHandle | null;

  constructor(handle: SqliteDatabaseHandle) {
    this.handle = handle;
  }

  private handleQueryError(error: SqliteRawSQLError): never {
    if (error.errno === undefined || error.code === undefined)
      // invalid error type
      throw error;

    const strError = String(error);

    switch (error.code) {
      case "SQLITE_CONSTRAINT": {
        const match =
          (/Error: SQLITE_CONSTRAINT: ([A-Z ]+) constraint failed: (.*)/g).exec(strError);

        if (match === null)
          break;

        const constraintName = match[1];
        const [ tableName, fieldName ] = match[2].split(".");

        throw new SqliteDatabaseConstaintError(constraintName, tableName, fieldName);
      }
      case "SQLITE_ERROR": {
        const match =
          (/Error: SQLITE_ERROR: no such table: (.*)/g).exec(strError);

        if (match !== null)
          throw new SqliteDatabaseNoTableError(match[1]);

        break;
      }
      default:
        console.error("Unknown db error code: ", error.code);
    }

    throw new SqliteDatabaseUnknownError(strError);
  }

  async query(query: string, ...args: unknown[]): Promise<SqliteDatabaseResult> {
    if (this.handle === null)
      throw Error("Database already closed");
    
    try {
      return await this.handle.all(query, args);
    }
    catch (error: unknown) {
      this.handleQueryError(error as SqliteRawSQLError);
    }
  }

  async close() {
    await this.handle?.close();
    this.handle = null;
  }
}

export async function openSqliteDatabase(name: string): Promise<SqliteDatabase> {
  return new SqliteDatabase(
    await dbopen({
      filename: name + ".sqlite",
      driver: sqlite3.Database
    })
  );
}
