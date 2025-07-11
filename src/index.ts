export interface ValueTypes {
  ["BIGINT"]: number;
  ["INT"]: number;
  ["BOOLEAN"]: boolean;
  ["MONEY"]: number;
  ["TEXT"]: string;
}

export type ValueType = keyof ValueTypes;
export type AnyValueType = ValueTypes[ValueType];

interface ColumnSchema {
  name: string;
  type: ValueType;
  pk: boolean;
  nn: boolean;
  uq: boolean;
  df: ValueTypes[ValueType] | null | undefined;
};

interface ComputedTableSchema {
  name: string;
  columns: ColumnSchema[];
}

type PopL<Arr extends any[]> = Arr extends [...infer L, infer R] ? L : [];
type PopR<Arr extends any[]> = Arr extends [...infer L, infer R] ? R : never;

// shortcut to get JS type for last column
// also allow "null" if column not "NOT NULL"
type LT<I extends ComputedTableSchema> =
  ValueTypes[PopR<I["columns"]>["type"]] | (
    PopR<I["columns"]>["nn"] extends true ? never : null
  );

type _PKT<Cols extends any[]> =
  Cols extends [infer C, ...infer Rest] ?
    C extends ColumnSchema ?
      C["pk"] extends true ? ValueTypes[C["type"]]
      : _PKT<Rest>
    : never
  : never;

// get JS type for primary key
type PKT<I extends ComputedTableSchema> = _PKT<I["columns"]>;

interface TableSchema<I extends ComputedTableSchema> {
  Column<Name extends string, Type extends ValueType>(name: Name, type: Type): TableSchema<{
    name: I["name"],
    columns: [
      ...I["columns"],
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

  /// fucking mess but better performance

  // todo accept multiple pkeys
  PrimaryKey(): TableSchema<{
    name: I["name"],
    columns: [
      ...PopL<I["columns"]>,
      {
        name: PopR<I["columns"]>["name"],
        type: PopR<I["columns"]>["type"],
        pk: true,
        nn: true,
        uq: PopR<I["columns"]>["uq"],
        df: PopR<I["columns"]>["df"]
      }
    ]
  }>;

  NotNull(): TableSchema<{
    name: I["name"],
    columns: [
      ...PopL<I["columns"]>,
      {
        name: PopR<I["columns"]>["name"],
        type: PopR<I["columns"]>["type"],
        pk: PopR<I["columns"]>["pk"],
        nn: true,
        uq: PopR<I["columns"]>["uq"],
        df: PopR<I["columns"]>["df"]
      }
    ]
  }>;

  // todo allow to bind multiple columns for unique
  Unique(): TableSchema<{
    name: I["name"],
    columns: [
      ...PopL<I["columns"]>,
      {
        name: PopR<I["columns"]>["name"],
        type: PopR<I["columns"]>["type"],
        pk: PopR<I["columns"]>["pk"],
        nn: PopR<I["columns"]>["nn"],
        uq: true,
        df: PopR<I["columns"]>["df"]
      }
    ]
  }>;

  // todo allow generator functions
  Default<T extends LT<I>>(defaultValue: T): TableSchema<{
    name: I["name"],
    columns: [
      ...PopL<I["columns"]>,
      {
        name: PopR<I["columns"]>["name"],
        type: PopR<I["columns"]>["type"],
        pk: PopR<I["columns"]>["pk"],
        nn: PopR<I["columns"]>["nn"],
        uq: PopR<I["columns"]>["uq"],
        df: T
      }
    ]
  }>;
}

interface TableSchemaContructor {
  new<Name extends string> (name: Name): TableSchema<{ name: Name, columns: [] }>;
}

type GetComputed<T extends TableSchema<any>> =
  T extends TableSchema<infer I> ? I : never;

type GetComputedArr<T extends TableSchema<any>[], O extends ComputedTableSchema[] = []> =
  T extends [infer S, ...infer Rest] ?
    S extends TableSchema<infer I> ?
      Rest extends TableSchema<any>[] ?
      GetComputedArr<Rest, [...O, I]> : never : never
  : O;

type DatabaseDeclaration = {
  tables: {
    [name: string]: ComputedTableSchema;
  }
};

type MapItems<I extends readonly { name: string }[]> = {
  [K in I[number] as K["name"]]: K
};

interface DBTable<I extends ComputedTableSchema> {
  get(key: PKT<I>): void;
}

type Database<I extends DatabaseDeclaration> = {
  [K in keyof I["tables"]]: DBTable<I["tables"][K]>;
};

interface DatabaseContructor {
  new<const Tables extends TableSchema<any>[]> (tables: Tables): Database<{
    tables: MapItems<GetComputedArr<Tables>>
  }>;
}

class TableSchemaImpl {
  constructor(name: string) {

  }
}

export const TableSchema = TableSchemaImpl as TableSchemaContructor;

export class DatabaseImpl {
  constructor(tables: TableSchemaImpl[]) {

  }
}

export const Database = DatabaseImpl as DatabaseContructor;
