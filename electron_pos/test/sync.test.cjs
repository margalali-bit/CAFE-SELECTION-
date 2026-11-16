const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Service } = require("../src/main/service.cjs");
const { Sync } = require("../src/main/sync.cjs");
test("lost cloud ACK retains local event and retries in order without losing operations", async (t) => {
  const service = new Service(":memory:");
  t.after(() => service.close());
  service.setup({ name: "Owner", pin: "987654" });
  const admin = service.login({ name: "Owner", pin: "987654" }).token;
  service.saveCategory(admin, { name: "Tea" });
  const sync = new Sync(service, {});
  let fail = true;
  const remote = new Set(),
    seen = [];
  sync.client = {
    auth: { getSession: async () => ({ data: { session: {} } }) },
    rpc: async (name, args) => {
      seen.push(args.p_events.map((e) => e.seq));
      for (const event of args.p_events) remote.add(event.event_id);
      if (fail) {
        fail = false;
        return { error: new Error("lost response") };
      }
      return { error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ order: async () => ({ data: [], error: null }) }),
          }),
        }),
      }),
    }),
  };
  await sync.tick();
  assert.equal(
    service.db.prepare("SELECT COUNT(*) n FROM outbox WHERE synced=0").get().n,
    2,
  );
  await sync.tick();
  assert.equal(
    service.db.prepare("SELECT COUNT(*) n FROM outbox WHERE synced=0").get().n,
    0,
  );
  assert.equal(remote.size, 2);
  assert.deepEqual(seen, [
    [1, 2],
    [1, 2],
  ]);
  assert.equal(sync.status.state, "online");
});

test("bad cloud configuration or a service key never blocks local sales", (t) => {
  const service = new Service(":memory:");
  t.after(() => service.close());
  const base = {
    url: "http://invalid",
    key: "key",
    email: "pos",
    password: "password",
    cafe_id: "cafe",
    device_id: "device",
  };
  assert.equal(new Sync(service, base).status.configured, false);
  assert.equal(
    new Sync(service, {
      ...base,
      url: "https://example.supabase.co",
      key: "sb_secret_private",
    }).status.configured,
    false,
  );
  service.setup({ name: "Owner", pin: "123456" });
  assert(service.login({ name: "Owner", pin: "123456" }).token);
});
