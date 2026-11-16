const { test } = require("node:test");
const assert = require("node:assert/strict");
test("Android repayment keeps its UUID after lost response and app restart", async () => {
  const { queueCommand } = await import("../../mobile_owner/lib/commands.ts");
  const persisted = new Map(),
    remote = new Map();
  let fail = true,
    ids = 0;
  const storage = {
    get: async (k) => persisted.get(k) || null,
    set: async (k, v) => persisted.set(k, v),
    remove: async (k) => persisted.delete(k),
  };
  const send = async (c) => {
    remote.set(c.id, c);
    if (fail) {
      fail = false;
      throw Error("response lost");
    }
  };
  const deps = {
    storage,
    send,
    newId: () => String(++ids),
    refresh: async () => {},
  };
  const input = {
    storageKey: "repayment-hash",
    cafeId: "cafe",
    deviceId: "pos",
    kind: "payment",
    payload: { customer_id: "customer", amount: "20" },
  };
  await assert.rejects(() => queueCommand(input, deps));
  assert.equal(remote.size, 1);
  assert.equal(persisted.size, 1);
  const id = await queueCommand(input, { ...deps });
  assert.equal(id, "1");
  assert.equal(remote.size, 1);
  assert.equal(persisted.size, 0);
  assert.equal(remote.get(id).payload.request_id, "mobile-1");
});
