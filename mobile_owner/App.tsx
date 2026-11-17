import "react-native-url-polyfill/auto";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  AppState,
} from "react-native";
import { useFonts } from "expo-font";
import { Cairo_400Regular, Cairo_700Bold } from "@expo-google-fonts/cairo";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { createClient, Session } from "@supabase/supabase-js";
import { queueCommand } from "./lib/commands";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  cafe = process.env.EXPO_PUBLIC_CAFE_ID || "";
const configured = !!url && !!key && !!cafe;
const client = configured
  ? createClient(url, key, {
      auth: {
        storage: {
          getItem: SecureStore.getItemAsync,
          setItem: SecureStore.setItemAsync,
          removeItem: SecureStore.deleteItemAsync,
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
type Product = {
  id: string;
  name: string;
  price: number;
  available: number;
  version: number;
  category_id: string;
};
type Order = {
  id: string;
  number: number;
  total: number;
  status: string;
  payment: string;
  business_day: string;
};
type Shift = {
  id: string;
  waiter: string;
  status: string;
  expected: number;
  delivered: number;
  difference: number;
};
type State = {
  settings: { debts_enabled: boolean };
  business_day: string;
  products: Product[];
  orders: Order[];
  expenses: { amount: number; business_day: string }[];
  debt_payments: { amount: number; business_day: string }[];
  customers: { id: string; name: string; balance: number }[];
  shifts: Shift[];
  updated_at: string;
};
type Command = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
};
const money = (n: number) => (n / 100).toFixed(2) + " د.م";
function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.4 }]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_700Bold,
    PlayfairDisplay_700Bold,
  });
  const [session, setSession] = useState<Session | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(""),
    [secret, setSecret] = useState(""),
    [verified, setVerified] = useState(false),
    [data, setData] = useState<State | null>(null),
    [commands, setCommands] = useState<Command[]>([]),
    [tab, setTab] = useState("اليوم"),
    [status, setStatus] = useState(""),
    [working, setWorking] = useState(false),
    [device, setDevice] = useState(""),
    [reason, setReason] = useState(""),
    [price, setPrice] = useState(""),
    [paymentAmount, setPaymentAmount] = useState("");
  const operationLock = useRef(false);
  const task = async (fn: () => Promise<void>) => {
    if (operationLock.current) return;
    operationLock.current = true;
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(
        "تعذر إتمام العملية",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      operationLock.current = false;
      setWorking(false);
    }
  };
  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    const listener = AppState.addEventListener("change", (state) =>
      state === "active"
        ? client.auth.startAutoRefresh()
        : client.auth.stopAutoRefresh(),
    );
    return () => {
      subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  useEffect(() => {
    setVerified(false);
    setData(null);
    setSecret("");
    if (!session || !client) return;
    void (async () => {
      const { data, error } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        setStatus(error.message);
        return;
      }
      setVerified(data.currentLevel === "aal2");
      if (data.currentLevel !== "aal2") {
        const factors = await client.auth.mfa.listFactors();
        const existing = factors.data?.totp.find(
          (f) => f.status === "verified",
        );
        if (existing) setFactor(existing.id);
        else {
          setFactor("");
          setStatus("أضف المصادقة الثنائية لحساب المالك");
        }
      }
    })();
  }, [session?.access_token]);
  const load = async () => {
    if (!client) return;
    const { data: state, error } = await client
      .from("cafe_state")
      .select("snapshot,updated_at,device_id")
      .eq("cafe_id", cafe)
      .maybeSingle();
    if (error) throw error;
    if (state) {
      setData({ ...state.snapshot, updated_at: state.updated_at });
      setDevice(state.device_id);
      setStatus(
        "آخر مزامنة: " + new Date(state.updated_at).toLocaleString("ar-MA"),
      );
    } else setStatus("لا توجد بيانات متزامنة بعد، أو الحساب غير مرتبط بالمقهى");
    const { data: queue, error: queueError } = await client
      .from("commands")
      .select("id,kind,status,error")
      .eq("cafe_id", cafe)
      .order("created_at", { ascending: false })
      .limit(20);
    if (queueError) throw queueError;
    setCommands(queue || []);
  };
  useEffect(() => {
    if (!verified || !client) return;
    const update = () =>
      load().catch(() =>
        setStatus("الاتصال منقطع · المعروض آخر بيانات مستلمة"),
      );
    update();
    const channel = client
      .channel("cafe-owner")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cafe_state",
          filter: `cafe_id=eq.${cafe}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "commands",
          filter: `cafe_id=eq.${cafe}`,
        },
        update,
      )
      .subscribe();
    const timer = setInterval(update, 10000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [verified]);
  const command = async (kind: string, payload: Record<string, unknown>) => {
    if (!client || !device || !session)
      throw Error("انتظر مزامنة جهاز المقهى أولاً");
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify({ kind, payload, cafe, user: session.user.id }),
    );
    const storageKey = "cafe-command-" + signature;
    await queueCommand(
      { storageKey, cafeId: cafe, deviceId: device, kind, payload },
      {
        storage: {
          get: SecureStore.getItemAsync,
          set: SecureStore.setItemAsync,
          remove: SecureStore.deleteItemAsync,
        },
        newId: Crypto.randomUUID,
        send: async (queued) => {
          const { error } = await client.from("commands").insert(queued);
          if (error && error.code !== "23505") throw error;
        },
        refresh: load,
      },
    );
    Alert.alert(
      "أُرسل الأمر",
      "بانتظار تطبيق جهاز المقهى؛ لا يعد منفذاً قبل تأكيده.",
    );
  };
  const login = () =>
    task(async () => {
      const { error } = await client!.auth.signInWithPassword({
        email,
        password,
      });
      setPassword("");
      if (error) throw error;
    });
  const enroll = () =>
    task(async () => {
      const old = await client!.auth.mfa.listFactors();
      for (const f of old.data?.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      ) || [])
        await client!.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await client!.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Cafe Selection Owner",
      });
      if (error) throw error;
      setFactor(data.id);
      setSecret(data.totp.secret);
    });
  const verify = () =>
    task(async () => {
      const { error } = await client!.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      setSecret("");
      setCode("");
      setVerified(true);
    });
  const notifications = () =>
    task(async () => {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted")
        throw Error("صلاحية الإشعارات مطلوبة");
      const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      if (!projectId)
        throw Error("يلزم إعداد EAS Project ID وبيانات FCM للبناء الفعلي");
      const push = await Notifications.getExpoPushTokenAsync({ projectId });
      const { error } = await client!
        .from("push_tokens")
        .upsert({ user_id: session!.user.id, token: push.data });
      if (error) throw error;
      Alert.alert(
        "تم التسجيل",
        "تحتاج الإشعارات أيضاً تشغيل عامل الخادم وإعداد FCM.",
      );
    });
  const logout = () =>
    task(async () => {
      if (client && session) {
        try {
          const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
          if (projectId) {
            const push = await Notifications.getExpoPushTokenAsync({
              projectId,
            });
            await client
              .from("push_tokens")
              .delete()
              .eq("user_id", session.user.id)
              .eq("token", push.data);
          }
        } catch {}
        await client.auth.signOut();
      }
      setData(null);
      setVerified(false);
    });
  const day = data?.business_day,
    orders =
      data?.orders.filter(
        (o) => o.status === "paid" && o.business_day === day,
      ) || [],
    cash = orders
      .filter((o) => o.payment === "cash")
      .reduce((n, o) => n + o.total, 0),
    repaid =
      data?.debt_payments
        .filter((p) => p.business_day === day)
        .reduce((n, p) => n + p.amount, 0) || 0,
    expenses =
      data?.expenses
        .filter((e) => e.business_day === day)
        .reduce((n, e) => n + e.amount, 0) || 0;
  if (!fontsLoaded && !fontError)
    return <View style={{ flex: 1, backgroundColor: "#0d0d0d" }} />;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Image
        source={require("./assets/selection-icon.png")}
        style={{
          width: 118,
          height: 118,
          alignSelf: "center",
          marginBottom: 8,
        }}
        accessibilityLabel="شعار café SELECTION TIZNIT"
      />
      <Text style={styles.brand}>café SELECTION</Text>
      <Text style={styles.sub}>TIZNIT · لوحة المالك</Text>
      {!configured ? (
        <View style={styles.card}>
          <Text style={styles.text}>
            أضف إعدادات Supabase العامة ومعرف المقهى قبل بناء التطبيق. لا تضع
            service_role داخل الهاتف.
          </Text>
        </View>
      ) : !session ? (
        <View style={styles.card}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <TextInput
            accessibilityLabel="البريد"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="البريد الإلكتروني"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            accessibilityLabel="كلمة المرور"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="كلمة المرور"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />
          <Button title="دخول" disabled={working} onPress={login} />
        </View>
      ) : !verified ? (
        <View style={styles.card}>
          <Text style={styles.title}>المصادقة الثنائية</Text>
          <Text style={styles.text}>
            استخدم تطبيق مصادقة TOTP. لا تشارك المفتاح مع أحد.
          </Text>
          {!factor && (
            <Button
              title="إعداد المصادقة"
              disabled={working}
              onPress={enroll}
            />
          )}{" "}
          {!!secret && (
            <Text selectable style={styles.text}>
              {secret}
            </Text>
          )}
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="رمز من 6 أرقام"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title="تأكيد"
            disabled={working || !factor}
            onPress={verify}
          />
          <Button title="خروج" onPress={logout} />
        </View>
      ) : (
        <>
          <Text style={styles.status}>{status}</Text>
          <View style={styles.tabs}>
            {[
              "اليوم",
              "الطلبات",
              "المنتجات",
              "الورديات",
              "الديون",
              "الإعدادات",
              "الأوامر",
            ].map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, tab === t && { borderColor: "#D4AF37" }]}
              >
                <Text style={styles.text}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "اليوم" && (
            <>
              {[
                ["المداخيل", cash + repaid],
                ["المصاريف", expenses],
                ["الصافي المسجل", cash + repaid - expenses],
              ].map(([title, value]) => (
                <View style={styles.card} key={String(title)}>
                  <Text style={styles.text}>{title}</Text>
                  <Text style={styles.value}>{money(Number(value))}</Text>
                </View>
              ))}
              <Text style={styles.text}>
                الطلبات: {orders.length} · اليوم التجاري {day}
              </Text>
              <Button
                title="تفعيل الإشعارات"
                disabled={working}
                onPress={notifications}
              />
            </>
          )}
          {tab === "الطلبات" && (
            <>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="سبب الإلغاء الإجباري"
                placeholderTextColor="#9ca3af"
              />
              {data?.orders.slice(0, 100).map((o) => (
                <View key={o.id} style={styles.card}>
                  <Text style={styles.title}>
                    #{o.number} · {money(o.total)}
                  </Text>
                  <Text style={styles.text}>
                    {o.business_day} ·{" "}
                    {o.payment === "cash" ? "نقدي" : "على الحساب"} ·{" "}
                    {o.status === "cancelled" ? "ملغى" : "مسجل"}
                  </Text>
                  {o.status === "paid" && (
                    <Button
                      title="طلب إلغاء"
                      disabled={working || !reason.trim()}
                      onPress={() =>
                        task(() => command("cancel", { id: o.id, reason }))
                      }
                    />
                  )}
                </View>
              ))}
            </>
          )}
          {tab === "المنتجات" && (
            <>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="ثمن جديد بالدرهم (اختياري)"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
              {data?.products.map((p) => (
                <View key={p.id} style={styles.card}>
                  <Text style={styles.title}>{p.name}</Text>
                  <Text style={styles.text}>
                    {money(p.price)} · {p.available ? "متاح" : "متوقف"}
                  </Text>
                  <Button
                    title={p.available ? "طلب إيقاف" : "طلب تفعيل"}
                    disabled={working}
                    onPress={() =>
                      task(() =>
                        command("product", {
                          ...p,
                          price: p.price / 100,
                          available: !p.available,
                        }),
                      )
                    }
                  />
                  <Button
                    title="طلب تغيير الثمن"
                    disabled={
                      working ||
                      !/^\d+(\.\d{1,2})?$/.test(price) ||
                      Number(price) <= 0
                    }
                    onPress={() =>
                      task(() =>
                        command("product", {
                          ...p,
                          price,
                          available: !!p.available,
                        }),
                      )
                    }
                  />
                </View>
              ))}
            </>
          )}
          {tab === "الورديات" &&
            data?.shifts.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.title}>{s.waiter}</Text>
                <Text style={styles.text}>
                  {s.status} · المفروض {money(s.expected || 0)} · المسلّم{" "}
                  {money(s.delivered || 0)} · الفرق {money(s.difference || 0)}
                </Text>
                {s.status === "closed" && (
                  <Button
                    title="طلب تأكيد الاستلام"
                    disabled={working}
                    onPress={() => task(() => command("confirm", { id: s.id }))}
                  />
                )}
              </View>
            ))}
          {tab === "الديون" && (
            <>
              <Text style={styles.text}>
                تسجيل التسديد من الهاتف يرسل أمراً للجهاز؛ لا يدخل المداخيل قبل
                تطبيقه. يؤرخ بيوم تطبيقه التجاري على الكاشير.
              </Text>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="المبلغ المقبوض بالدرهم"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
              {data?.customers.map((c) => (
                <View key={c.id} style={styles.card}>
                  <Text style={styles.title}>{c.name}</Text>
                  <Text style={styles.value}>{money(c.balance)}</Text>
                  <Button
                    title="طلب تسجيل التسديد"
                    disabled={
                      working ||
                      !/^\d+(\.\d{1,2})?$/.test(paymentAmount) ||
                      Number(paymentAmount) <= 0
                    }
                    onPress={() =>
                      task(() =>
                        command("payment", {
                          customer_id: c.id,
                          amount: paymentAmount,
                        }),
                      )
                    }
                  />
                </View>
              ))}
            </>
          )}
          {tab === "الإعدادات" && (
            <View style={styles.card}>
              <Text style={styles.text}>
                الطلبات على الحساب:{" "}
                {data?.settings.debts_enabled ? "مفعلة" : "معطلة"}
              </Text>
              <Button
                title={
                  data?.settings.debts_enabled
                    ? "طلب تعطيل الديون"
                    : "طلب تفعيل الديون"
                }
                disabled={working}
                onPress={() =>
                  task(() =>
                    command("settings", {
                      debts_enabled: !data?.settings.debts_enabled,
                    }),
                  )
                }
              />
            </View>
          )}
          {tab === "الأوامر" &&
            commands.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.text}>
                  {c.kind} ·{" "}
                  {c.status === "pending"
                    ? "بانتظار جهاز المقهى"
                    : c.status === "applied"
                      ? "تم التطبيق"
                      : "مرفوض — راجع الحالة الحالية"}
                </Text>
              </View>
            ))}
          <Button title="تحديث" disabled={working} onPress={() => task(load)} />
          <Button title="تسجيل الخروج" disabled={working} onPress={logout} />
        </>
      )}
      <Text style={styles.status}>
        البيانات المعروضة تصل بعد مزامنة الكاشير. انقطاع الشبكة يؤخر التحديثات
        والأوامر.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d0d0d" },
  container: { padding: 22, paddingTop: 60, paddingBottom: 50 },
  brand: {
    fontSize: 32,
    fontFamily: "PlayfairDisplay_700Bold",
    color: "#D4AF37",
    textAlign: "center",
  },
  sub: {
    fontFamily: "Cairo_400Regular",
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 28,
  },
  card: {
    backgroundColor: "#191919",
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 18,
    padding: 20,
    marginVertical: 8,
  },
  title: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    color: "#f3f4f6",
    textAlign: "right",
    marginBottom: 12,
  },
  text: {
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    color: "#e5e7eb",
    textAlign: "right",
    lineHeight: 26,
  },
  status: {
    fontFamily: "Cairo_400Regular",
    color: "#9ca3af",
    textAlign: "right",
    fontSize: 12,
    lineHeight: 21,
    marginVertical: 12,
  },
  value: {
    fontFamily: "Cairo_700Bold",
    fontSize: 29,
    color: "#D4AF37",
    textAlign: "right",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#D4AF37",
    padding: 15,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonText: {
    fontFamily: "Cairo_700Bold",
    color: "#211a13",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    fontFamily: "Cairo_400Regular",
    color: "#fff",
    backgroundColor: "#0d0d0d",
    padding: 14,
    borderWidth: 1,
    borderColor: "#383838",
    borderRadius: 10,
    marginVertical: 8,
    textAlign: "right",
  },
  tabs: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 10,
  },
});
