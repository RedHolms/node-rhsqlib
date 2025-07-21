import sqlib from "..";
import assert from "assert";

async function test() {
  const UsersSchema =
    new sqlib.TableSchema("users")
      .Column("id",       "BIGINT"  ).PrimaryKey()
      .Column("regDate",  "DATETIME").NotNull().Default(() => new Date())
      .Column("username", "TEXT"    ).NotNull().Unique()
      .Column("address",  "TEXT"    ).Default(null)
      .Column("age",      "INT"     ).NotNull();

  const db = new sqlib.Database([ UsersSchema ]);

  assert((await db.users.list()).length === 0);

  await db.users.insert({
    id: 0,
    username: "coolguy",
    age: 18
  });

  await db.users.insert({
    id: 1,
    username: "fineguy",
    address: "NewYork city",
    age: 21
  });

  await db.users.insert({
    id: 2,
    username: "anotherguy",
    age: 21
  });

  assert((await db.users.list()).length === 3);

  let user = await db.users.get(0);
  assert(user !== undefined && user.id === 0 && user.username === "coolguy");

  user = await db.users.getBy("username", "fineguy");
  assert(user !== undefined && user.id === 1 && user.username === "fineguy");

  let list = await db.users.getBy("age", 21);
  assert(list.length === 2);

  user = await db.users.update(2, "age", 19);
  assert(user !== undefined && user.username === "anotherguy");

  user = await db.users.updateBy("username", "nonexistingguy", "age", 20);
  assert(user === undefined);

  console.log("fine");
}

test();
