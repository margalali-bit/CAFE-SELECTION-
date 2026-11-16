# تشغيل Café Sélection v2

## سطح المكتب

ثبت Node.js 24 ثم من مجلد `electron_pos`:

```powershell
npm ci
npm start
```

ينزّل Electron ويجهز SQLite المتوافق معه. إنشاء المالك يتم عند أول تشغيل، ولا توجد حسابات أو قائمة أسعار افتراضية. أضف فئات ومنتجات ونادلاً، ثم سجل الخروج وادخل بالنادل لبدء البيع. المالك لا يسجل مبيعات وفق الوثيقة. زر ملء الشاشة متاح بعد الدخول. المعلومات في مجلد Electron userData، وعادةً `%APPDATA%\cafe-selection-pos\cafe-v2.sqlite` على Windows. قاعدة Python القديمة مستقلة ومحفوظة؛ لا تستورد بياناتها تلقائياً.

تعيين البيئة للسحابة اختياري. مثال PowerShell (أدخل القيم محلياً، ولا ترسل كلمة المرور في المحادثة):

```powershell
$env:SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
$env:SUPABASE_ANON_KEY = 'PUBLIC-PUBLISHABLE-KEY'
$env:SUPABASE_DEVICE_EMAIL = 'DEVICE-EMAIL'
$env:SUPABASE_DEVICE_PASSWORD = 'DEVICE-PASSWORD'
$env:CAFE_ID = 'CAFE-UUID'
$env:DEVICE_ID = 'DEVICE-UUID'
npm start
```

ملف `.env.example` مرجع فقط؛ التطبيق لا يحمل `.env` تلقائياً. تشغيل ملف exe يرث المتغيرات من النظام/الطرفية التي أطلقته. عند غياب الإعدادات يعمل محلياً. لا تضع service_role على الكمبيوتر أو الهاتف. لا تُرفع كلمات مرور النادل إلى Supabase.

## معاينة في المتصفح

```powershell
cd electron_pos
npm ci --ignore-scripts
npm rebuild better-sqlite3
npm run preview
```

افتح `http://127.0.0.1:4173`. هذه الواجهة تستخدم SQLite فعلياً وليست localStorage. تُحفظ قاعدة المعاينة في `electron_pos/preview-data.sqlite`، مستقلة عن قاعدة Electron. المعاينة تربط loopback فقط ولا تُنشر كخادم إنتاج. الطباعة في المعاينة تستخدم نافذة المتصفح؛ التصدير Excel والنسخ من Electron. لا تغير البيانات الأصلية القديمة.

## الاختبارات والبناء

```powershell
cd electron_pos
npm ci --ignore-scripts
npm rebuild better-sqlite3
npm test
```

SQLite له ربط أصلي مختلف بين Node وElectron. بعد الاختبارات وقبل `npm start` أو بناء exe:

```powershell
node node_modules/electron/install.js
npx electron-builder install-app-deps
npm run build:win -- --publish never
```

Actions `Electron Windows POS` ينتج مثبّت NSIS وملف portable. هما غير موقعين بشهادة ناشر. يلزم اختبار أول تشغيل والطابعة على حاسوب المقهى قبل اعتماد النسخة للمبيعات الفعلية.

اختبار المتصفح المعزول على Linux:

```sh
CHROMIUM_PATH=/usr/bin/chromium node test/browser.cjs
```

ينشئ بيانات مؤقتة لا تؤثر على بيانات الكاشير. اختبار PostgreSQL مضمّن داخل `npm test`، دون اتصال خارجي.

## إعداد Supabase

1. أنشئ مشروعاً وشغل `supabase/migrations/202611160001_cafe.sql` عبر SQL Editor أو Supabase CLI. لا تشغله على جداول تحمل الأسماء نفسها دون مراجعة وترحيل منفصل.
2. أنشئ حساب المالك وحساباً مختلفاً لجهاز المقهى في Auth. لا تضع حساب الجهاز في `cafe_members`.
3. من SQL Editor بصلاحية الإدارة، أنشئ المقهى وسجل العضوية والجهاز. استبدل UUIDs بالقيم الحقيقية:

```sql
insert into public.cafes(name) values ('Café Sélection · Tiznit') returning id;
insert into public.cafe_members(cafe_id,user_id) values ('CAFE-UUID','OWNER-AUTH-UUID');
insert into public.devices(cafe_id,auth_user_id) values ('CAFE-UUID','DEVICE-AUTH-UUID') returning id;
```

4. ضع endpoint وpublishable/anon key وحساب الجهاز ومعرف المقهى والجهاز في بيئة الكمبيوتر. مفتاح anon ليس بديلاً عن الدخول ولا يعطل RLS.
5. حساب المالك يحتاج TOTP aal2. تطبيق الهاتف يوفر التسجيل والتحقق. فعّل البريد وسياسة كلمة المرور في Supabase. اختبر أن مستخدماً آخر لا يرى حالة المقهى.
6. يوجد جهاز كاشير واحد لكل مقهى في هذه النسخة. لا تعيد تعيين الجهاز أو عدادات outbox أو تستعد نسخة قديمة دون مصالحة الحالة السحابية. لا مفاتيح حقيقية في المستودع.

## Android

```sh
cd mobile_owner
npm ci
```

انسخ `.env.example` إلى `.env` محلياً وضع القيم العامة فقط. ثم:

```sh
npm run check
npx expo start
```

استخدام الإشعارات البعيدة يتطلب build أصلياً؛ Expo Go لا يكفي. Actions يبني APK مستقل (إصدار release بمفتاح تطوير Expo الافتراضي)، للاختبار المباشر، وليس للنشر في المتجر. متغيرات GitHub Repository Variables:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CAFE_ID`.
- `EAS_PROJECT_ID` عند إعداد الإشعارات.

متغيرات EXPO_PUBLIC عامة ومضمنة في APK، لذلك لا تستخدم مفاتيح الخدمة أو كلمة مرور الجهاز فيها. الهاتف يخزن جلسة المصادقة في SecureStore ويقرأ بعد TOTP. مع إعدادات ناقصة تظهر شاشة إعداد واضحة بدلاً من بيانات تجريبية.

## الإشعارات

اربط مشروع Expo ببيانات FCM v1 لحسابك، وضع project UUID في إعداداته، وامنح التطبيق صلاحية الإشعارات. انشر Edge Function `notify` بعد وضع `NOTIFICATION_WORKER_SECRET` في Supabase Secrets. دالة `notify` تعطّل تحقق JWT لأنها تتحقق من سر عامل منفصل؛ لا تستدعها من العميل. استدعها عبر schedule موثوق كل دقيقة مع ترويسة `x-worker-secret`. `SUPABASE_SERVICE_ROLE_KEY` تستخدم داخل الدالة فقط.

الإشعار يرسل عبر Expo Push Service الذي يوصل إلى FCM. يسجل التطبيق رمز الجهاز بعد ضغط «تفعيل الإشعارات». الجدول يسجل order.created/order.cancelled/shift.closed مرة واحدة لكل حدث؛ الشبكة قد تعيد إرسال التنبيه نفسه عند ضياع الاستجابة. تابع سجلات الدالة وإيصالات Expo قبل الاعتماد على التنبيهات. لم تُنشر الدالة أو تُختبر على هاتف فعلي في بيئة التطوير هذه.

لبناء الإشعارات الأصلي على GitHub، أضف ملف Firebase Android `google-services.json` كسر `GOOGLE_SERVICES_JSON`. يُكتب في مجلد العامل المؤقت فقط، وapp.config.js يمرر مساره إلى Expo. إعداد FCM server في Expo لا يغني عن تهيئة Firebase داخل APK.
