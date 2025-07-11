// this what i want to reach
// everything should have type checking and caching
// also allow multiple SQL backends (sqlite, postgresql, mysql, etc.)

import sqlib from "..";

const UsersSchema =
  new sqlib.TableSchema("users")
    .Column("id",                         "BIGINT" ).PrimaryKey()
    .Column("banned",                     "BOOLEAN").NotNull().Default(false)
    .Column("role",                       "INT"    ).NotNull().Default(0)
    .Column("regDate",                    "BIGINT" ).NotNull()
    .Column("balance",                    "MONEY"  ).NotNull().Default(0)
    .Column("clientPrice",                "MONEY"  ).NotNull().Default(0)
    .Column("clientAllowNegativeBalance", "BOOLEAN").NotNull().Default(false)
    .Column("gotAccessBy",                "BIGINT" ).NotNull()
    .Column("username",                   "TEXT"   ).NotNull().Unique();

const masterDb = new sqlib.Database([ UsersSchema ]);

// // by id
masterDb.users.get(42);

// // returns list (becuase role NOT unique and not pkey)
// masterDb.users.getBy("role");

// // returns one or undefined
// masterDb.users.getBy("username");

// // same as just users.get(...)
// masterDb.users.getBy("id", 42);

// masterDb.users.list();

// masterDb.users.update(42, "role", 2);
// masterDb.users.updateBy("id", 42, "role", 4);

// masterDb.users.delete(42);
// masterDb.users.deleteBy("id", 42);

// // must contain all not-null cols without default value
// masterDb.users.insert({
//   id: 42,
//   regDate: Date.now(),
//   gotAccessBy: 43,
//   username: "coolguy55"
// });
