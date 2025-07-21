import type { PopL, PopR, MapItems, Equ, UndefinedToOptional } from "./utils";

// map SQL type to JS type
export interface ValueTypes {
  ["BOOLEAN"]:  boolean;
  ["INT"]:      number;
  ["BIGINT"]:   number;
  ["MONEY"]:    number;
  ["TEXT"]:     string;
  ["DATETIME"]: Date;
}

// Any SQL type
export type ValueType = keyof ValueTypes;

///
/// Table schema
///

interface ColumnSchema {
  name: string;
  type: ValueType;
  pk: boolean;
  nn: boolean;
  uq: boolean;
  df: ValueTypes[ValueType] | null
    | (() => ValueTypes[ValueType] | Promise<ValueTypes[ValueType]> | null)
    | undefined;
}

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

// shortcut to get JS type for last column
// also allow "null" if column not "NOT NULL"
type LT<S extends TableSchema> =
  ValueTypes[PopR<S["columns"]>["type"]] | (
    PopR<S["columns"]>["nn"] extends true ? never : null
  );

type _PKT_<Cols extends any[]> =
  Cols extends [infer C, ...infer Rest]
  ? C extends ColumnSchema
    ? C["pk"] extends true
      ? ValueTypes[C["type"]]
      : _PKT_<Rest>
    : never
  : never;

// get JS type for primary key
type PKT<S extends TableSchema> = _PKT_<S["columns"]>;

// get JS type for given column
type CTP<Col extends ColumnSchema> =
  Col["nn"] extends true
  ? ValueTypes[Col["type"]]
  : ValueTypes[Col["type"]] | null;

// get JS object for row
type ROW<S extends TableSchema> = {
  [Col in S["columns"][number] as Col["name"]]: CTP<Col>;
};

// get JS object that can be used for initialization of row
type ROWINIT<S extends TableSchema> = UndefinedToOptional<{
  [Col in S["columns"][number] as Col["name"]]:
    CTP<Col> | (Equ<Col["df"], undefined> extends true ? never : undefined);
}>;

// get built table schema from builder
type GetBuilt<T extends TableSchemaBuilder<any>> =
  T extends TableSchemaBuilder<infer S> ? S : never;

type GetBuiltFromArray<
  Arr extends TableSchemaBuilder<any>[],
  Out extends TableSchema[] = []
> =
  Arr extends [infer T, ...infer Rest]
  ? T extends TableSchemaBuilder<infer S>
    ? Rest extends TableSchemaBuilder<any>[]
      ? GetBuiltFromArray<Rest, [...Out, S]>
      : never
    : never
  : Out;

/// fucking mess but better performance when doing it this way
///  instead of some scaleable smart way
interface TableSchemaBuilder<S extends TableSchema> {
  Column<Name extends string, Type extends ValueType>(name: Name, type: Type): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...S["columns"],
      {
        name: Name,
        type: Type,
        pk: false,
        nn: false,
        uq: false,
        df: undefined
      }
    ]
  }>;

  // todo accept multiple pkeys
  PrimaryKey(): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: true,
        nn: true,
        uq: true,
        df: PopR<S["columns"]>["df"]
      }
    ]
  }>;

  NotNull(): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: PopR<S["columns"]>["pk"],
        nn: true,
        uq: PopR<S["columns"]>["uq"],
        df: PopR<S["columns"]>["df"]
      }
    ]
  }>;

  // todo allow to bind multiple columns for unique
  Unique(): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: PopR<S["columns"]>["pk"],
        nn: PopR<S["columns"]>["nn"],
        uq: true,
        df: PopR<S["columns"]>["df"]
      }
    ]
  }>;

  Default<T extends LT<S>>(defaultValue: T): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: PopR<S["columns"]>["pk"],
        nn: PopR<S["columns"]>["nn"],
        uq: PopR<S["columns"]>["uq"],
        df: T
      }
    ]
  }>;

  Default<T extends LT<S>>(generator: () => T): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: PopR<S["columns"]>["pk"],
        nn: PopR<S["columns"]>["nn"],
        uq: PopR<S["columns"]>["uq"],
        df: T
      }
    ]
  }>;

  Default<T extends LT<S>>(generator: () => Promise<T>): TableSchemaBuilder<{
    name: S["name"],
    columns: [
      ...PopL<S["columns"]>,
      {
        name: PopR<S["columns"]>["name"],
        type: PopR<S["columns"]>["type"],
        pk: PopR<S["columns"]>["pk"],
        nn: PopR<S["columns"]>["nn"],
        uq: PopR<S["columns"]>["uq"],
        df: T
      }
    ]
  }>;
}

///
/// Database
///

interface DatabaseSchema {
  tables: {
    [name: string]: TableSchema;
  }
}

interface DatabaseTable<
  S extends TableSchema,
  
  // columns map
  _CM extends { [name: string]: ColumnSchema } = MapItems<S["columns"]>
> {
  // get row by primary key
  get(pKey: PKT<S>): Promise<ROW<S> | undefined>;

  // get row(s) by column
  // returns list if column is not unique or single value (or undefined) otherwise
  getBy<ColName extends keyof _CM>(
    column: ColName,
    value: ValueTypes[_CM[ColName]["type"]]
  ): Promise<
    _CM[ColName]["uq"] extends true
    ? ROW<S> | undefined
    : ROW<S>[]
  >;

  // get all rows
  // TODO paginate and return iterator
  list(): Promise<ROW<S>[]>;

  // edit cell by primary key
  // returns modified value or undefined if row doesn't exists
  update<ColName extends keyof _CM>(
    pKey: PKT<S>,
    column: ColName,
    value: ValueTypes[_CM[ColName]["type"]]
  ): Promise<void>;

  // edit cell(s) by column
  // returns modified value or undefined if row doesn't exists
  updateBy<
    QColName extends keyof _CM,
    ColName extends keyof _CM
  >(
    queryColumn: QColName,
    queryValue: ValueTypes[_CM[QColName]["type"]],
    column: ColName,
    value: ValueTypes[_CM[ColName]["type"]]
  ): Promise<void>;

  // delete row by pkey
  // returns true if row was existing
  delete(pKey: PKT<S>): Promise<void>;

  // delete row(s) by column
  // returns true if any row was existing
  deleteBy<ColName extends keyof _CM>(
    column: ColName,
    value: ValueTypes[_CM[ColName]["type"]]
  ): Promise<void>;

  // delete all rows
  deleteAll(): Promise<void>;

  // insert row
  insert(init: ROWINIT<S>): Promise<void>;

  // execute raw SQL query
  // "$tablename$" substring in the query will be replaced
  //  with the table name
  query(query: string, ...args: any[]): Promise<any[]>;
}

type Database<I extends DatabaseSchema> = {
  [K in keyof I["tables"]]: DatabaseTable<I["tables"][K]>;
} & {
  // execute raw SQL query
  query(query: string, ...args: any[]): Promise<any[]>;
};

interface TableSchemaBuilderContructor {
  new<Name extends string> (name: Name): TableSchemaBuilder<{ name: Name, columns: [] }>;
}
export var TableSchema: TableSchemaBuilderContructor;

interface DatabaseContructor {
  new<const Schemas extends TableSchemaBuilder<any>[]> (tableSchemas: Schemas): Database<{
    tables: MapItems<GetBuiltFromArray<Schemas>>
  }>;
}
export var Database: DatabaseContructor;
