import { createClient } from "npm:@supabase/supabase-js@2";
// Invoke from a trusted schedule with x-worker-secret; never from a desktop/mobile client.
Deno.serve(async (request) => {
  const secret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (!secret || request.headers.get("x-worker-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: jobs, error } = await db
    .from("notification_jobs")
    .select("*")
    .is("sent_at", null)
    .lt("attempts", 10)
    .order("created_at")
    .limit(30);
  if (error) return new Response("Queue unavailable", { status: 503 });
  for (const job of jobs || []) {
    const { data: members, error: memberError } = await db
      .from("cafe_members")
      .select("user_id")
      .eq("cafe_id", job.cafe_id);
    if (memberError) continue;
    const { data: tokens, error: tokenError } = await db
      .from("push_tokens")
      .select("token")
      .in(
        "user_id",
        (members || []).map((m) => m.user_id),
      );
    if (tokenError || !tokens?.length) continue;
    await db
      .from("notification_jobs")
      .update({ attempts: job.attempts + 1 })
      .eq("id", job.id);
    const titles: Record<string, string> = {
      "order.created": "طلب جديد في Café Sélection",
      "order.cancelled": "تم إلغاء طلب",
      "shift.closed": "وردية تنتظر تأكيد الاستلام",
    };
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.token,
            title: titles[job.kind],
            body: "افتح تطبيق المالك لمراجعة التفاصيل",
            data: { event_id: job.id, cafe_id: job.cafe_id },
            sound: "default",
          })),
        ),
      });
      const result = await response.json();
      if (
        response.ok &&
        Array.isArray(result.data) &&
        result.data.every((r: { status: string }) => r.status === "ok")
      )
        await db
          .from("notification_jobs")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", job.id);
    } catch {
      /* persisted retry on next scheduled invocation */
    }
  }
  return Response.json({ processed: jobs?.length || 0 });
});
