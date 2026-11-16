const { createClient } = require("@supabase/supabase-js");
class Sync {
  constructor(service, config) {
    this.service = service;
    this.config = config;
    this.status = {
      configured: false,
      state: "offline",
      last_success: null,
      error: null,
    };
    this.busy = false;
    this.lastDay = service.day();
    if (
      config.url &&
      config.key &&
      config.email &&
      config.password &&
      config.cafe_id &&
      config.device_id
    ) {
      try {
        if (!config.url.startsWith("https://"))
          throw Error("Supabase requires HTTPS");
        let role;
        try {
          role = JSON.parse(
            Buffer.from(config.key.split(".")[1] || "", "base64url").toString(),
          ).role;
        } catch {}
        if (config.key.startsWith("sb_secret_") || role === "service_role")
          throw Error("A server key cannot be used by the POS");
        this.client = createClient(config.url, config.key, {
          auth: { persistSession: false, autoRefreshToken: true },
        });
        this.status.configured = true;
      } catch {
        this.status.error = "إعدادات السحابة غير صالحة؛ يستمر العمل محلياً";
      }
    }
  }
  async tick() {
    if (!this.client || this.busy) return;
    this.busy = true;
    this.status.state = "syncing";
    try {
      if (this.service.day() !== this.lastDay) {
        this.service.event("business_day.started");
        this.lastDay = this.service.day();
      }
      if (
        !this.client.auth.getSession ||
        !(await this.client.auth.getSession()).data.session
      ) {
        const { error } = await this.client.auth.signInWithPassword({
          email: this.config.email,
          password: this.config.password,
        });
        if (error) throw error;
      }
      const pending = this.service.db
        .prepare("SELECT * FROM outbox WHERE synced=0 ORDER BY seq LIMIT 100")
        .all();
      if (pending.length) {
        const snapshot = this.service.snapshot(),
          seq = this.service.db
            .prepare("SELECT MAX(seq) AS n FROM outbox")
            .get().n;
        const { error } = await this.client.rpc("ingest_batch", {
          p_cafe: this.config.cafe_id,
          p_device: this.config.device_id,
          p_events: pending.map((e) => ({
            event_id: e.event_id,
            seq: e.seq,
            kind: e.kind,
          })),
          p_seq: seq,
          p_snapshot: snapshot,
        });
        if (error) throw error;
        this.service.db.transaction(() => {
          for (const e of pending)
            this.service.db
              .prepare("UPDATE outbox SET synced=1 WHERE event_id=?")
              .run(e.event_id);
        })();
      }
      const { data, error } = await this.client
        .from("commands")
        .select("id,kind,payload,requested_by")
        .eq("cafe_id", this.config.cafe_id)
        .eq("device_id", this.config.device_id)
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      for (const command of data) {
        let failure = null;
        try {
          this.service.applyCommand(command);
        } catch {
          failure =
            "Command rejected by local validation; review current state";
        }
        const { error } = await this.client.rpc("complete_command", {
          p_id: command.id,
          p_error: failure,
        });
        if (error) throw error;
      }
      this.status = {
        ...this.status,
        state: "online",
        last_success: new Date().toISOString(),
        error: null,
      };
    } catch {
      this.status.state = "offline";
      this.status.error =
        "تعذرت المزامنة؛ البيانات محفوظة محلياً وستعاد المحاولة";
    } finally {
      this.busy = false;
    }
  }
  start() {
    if (this.client) this.service.event("device.started");
    this.tick();
    this.timer = setInterval(() => this.tick(), 5000);
  }
  stop() {
    clearInterval(this.timer);
    this.client?.auth.stopAutoRefresh();
  }
}
module.exports = { Sync };
