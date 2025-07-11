export interface ValueTypes {
  ["BIGINT"]: number;
  ["INT"]: number;
  ["BOOLEAN"]: boolean;
  ["MONEY"]: number;
  ["TEXT"]: string;
}

export type ValueType = keyof ValueTypes;

type ColT = {
  name: string;
  type: ValueType;
  pk: boolean;
  nn: boolean;
  uq: boolean;
  df: ValueTypes[ValueType] | null | undefined;
};

interface TableImplTArg {
  name: string;
  columns: ColT[];
}

type PopL<Arr extends any[]> = Arr extends [...infer L, infer R] ? L : [];
type PopR<Arr extends any[]> = Arr extends [...infer L, infer R] ? R : never;

type Equ<A,B> = A extends B ? B extends A ? true : false : false;

type ColPS<
  I extends TableImplTArg,
  P extends keyof ColT,
  T extends ColT[P],

  _R extends ColT = PopR<I["columns"]>
> = TableT<{
  name: I["name"],
  columns: [
    ...PopL<I["columns"]>,
    {
      [K in keyof ColT]:
        Equ<P,K> extends true ? T extends ColT[K] ? T : never : _R[K]
    }
  ]
}>;

interface TableT<I extends TableImplTArg> {
  Column<Name extends string, Type extends ValueType>(name: Name, type: Type): TableT<{
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

  PrimaryKey(): ColPS<I, "pk", true>;
  NotNull(): ColPS<I, "nn", true>;
  Unique(): ColPS<I, "uq", true>;
  Default<
    _R extends ColT = PopR<I["columns"]>,
    _T extends ValueTypes[_R["type"]] = ValueTypes[_R["type"]]
  >(defaultValue: _T): ColPS<I, "df", _T>;
}

// export class Table {
//   constructor(name: string) {

//   }
// }

interface TableContructor {
  new<Name extends string> (name: Name): TableT<{ name: Name, columns: [] }>;
}

class TableImpl {
  constructor(name: string) {

  }
}

export const Table = TableImpl as TableContructor;

export class Database {
  constructor(tables: TableImpl[]) {

  }
}
