# دليل نشر منصة "مناسبتـي" على Netlify 🚀

تم تجهيز المشروع بالكامل ليعمل بسلاسة وتوافق تام مع منصة **Netlify** باستخدام إعدادات `Next.js 14 App Router` والمكوّن الإضافي الرسمي `@netlify/plugin-nextjs`.

## متطلبات النسخة الحالية

المستودع المرتبط هو `hkudaish/munasbti` والفرع الإنتاجي `main`، والموقع المرتبط `https://munasabit.netlify.app`.

قبل النشر اضبط المتغيرات في Netlify مع إتاحتها للبناء والدوال:

- `DATABASE_URL`: اتصال PostgreSQL سحابي باستخدام TLS؛ اتصال localhost لا يعمل داخل دوال Netlify.
- `CHANNEL_ENCRYPTION_KEY`: مفتاح AES بطول 64 خانة hexadecimal، محفوظ كسر على الخادم. عند نقل إعدادات قنوات مشفّرة يجب الاحتفاظ بمفتاحها الأصلي.
- `NEXT_PUBLIC_APP_URL`: `https://munasabit.netlify.app` لتوليد روابط الدعوات الصحيحة.
- `GEOAPIFY_API_KEY`: اختياري؛ يضاف لتفعيل اختيار المدينة عبر GPS.

لا تحفظ هذه الأسرار أو نسخ قاعدة البيانات في Git. على قاعدة موجودة راجع ترحيلات SQL الإضافية بالترتيب في `prisma/sql` ولا تعاود تنفيذ ترحيل سبق تطبيقه. النشر وحده لا ينشئ الجداول ولا ينقل بيانات قاعدة محلية. راجع [دليل الدعوات](docs/INVITATION_DATABASE.md) و[التغطية الجغرافية](docs/GEOGRAPHIC_COVERAGE.md).

عند استخدام Netlify Database، يقرأ Prisma اتصال الفرع الحالي عبر `@netlify/database` أثناء الطلب، وتوجد تهيئة القاعدة الجديدة في `netlify/database/migrations`. يطبق Netlify هذه الترحيلات قبل نشر النسخة. اتصال API المحلي للإنتاج قد يكون للقراءة فقط حسب دور الحساب؛ لا تستخدمه بديلاً لاتصال التطبيق الذي يوفره Netlify. بيانات الحسابات وإعداداتها تنقل بصورة خاصة، ولا تتضمنها ملفات تهيئة المخطط المنشورة.

تسمح ترويسة `SAMEORIGIN` بإطار معاينة التغطية داخل لوحة مدير النظام على نطاق الموقع نفسه.

---

## 📁 الملفات المُعدة للنشر

1. **[netlify.toml](file:///d:/EventsApp/netlify.toml)**: يتضمن أمر البناء `npm run build`، مجلد الإخراج `.next`، المكون `@netlify/plugin-nextjs`، إصدار Node.js `22` وترويسات الحماية والأمان.
2. **[package.json](file:///d:/EventsApp/package.json)**: يحتوي على جميع الحزم والاعتماديات الأساسية مثل `lucide-react`, `canvas-confetti`, `tailwind-merge` والمكوّن الإضافي لـ Netlify.
3. **[.gitignore](file:///d:/EventsApp/.gitignore)**: تم استبعاد ملفات الكاش ومجلدات `.next` و `node_modules` وملفات البيئة المحلية.

---

## 🛠️ خيارات النشر (3 طرق سهلة وسريعة)

### الخيار الأول: الربط التلقائي عبر GitHub / GitLab (الموصى به) ⭐

1. قم بإنشاء مستودع جديد على **GitHub** (مثلاً: `munasbti`).
2. ارفع ملفات المشروع:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Munasabati Saudi Events Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/munasbti.git
   git push -u origin main
   ```
3. توجه إلى [لوحة تحكم Netlify](https://app.netlify.com).
4. اضغط على **"Add new site"** ثم **"Import an existing project"**.
5. اختر **GitHub** وحدد المستودع.
6. سيتعرف Netlify تلقائياً على ملف `netlify.toml` ويملأ الإعدادات:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Node Version**: `22`
7. اضغط **"Deploy Site"**، وسيتم نشر الموقع وتزويدك برابط فوري مع شهادة SSL مجانية.

---

### الخيار الثاني: النشر المباشر عبر Netlify CLI

إذا كنت تفضل النشر السريع من الطرفية مباشرة دون الحاجة لـ Git:

1. افتح موجه الأوامر داخل مجلد المشروع:
   ```bash
   cd d:\EventsApp
   ```
2. سجل الدخول إلى Netlify (يفتح المتصفح للموافقة مرة واحدة):
   ```bash
   npx netlify-cli login
   ```
3. قم ببناء ونشر النسخة الحية:
   ```bash
   npx netlify-cli deploy --build --prod
   ```
4. اتبع المطالبات البسيطة لاختيار إنشاء موقع جديد (Create a new site) وسيقوم برفع المشروع فوراً وإعطائك رابط الموقع المباشر (Production URL).

---

## 🔍 اختبار الجاهزية والتحقق محلياً

تم بناء المشروع والتحقق من جميع المسارات بنجاح:

```bash
npm run build
```

✅ **المسارات التي تم التحقق من عملها (200 OK):**
- `/` - الصفحة الرئيسية الاحتفالية
- `/plan` - معالج التخطيط الذكي (7 خطوات)
- `/occasion/occ-001` - مساحة عمل المناسبة (الضيوف، الميزانية، الطاولات، الدعوات، المهام، قائمة الأمنيات)
- `/marketplace` - سوق الخدمات والموردين (10 مدن سعودية)
- `/service/srv-001` - صفحة تفاصيل الخدمة والحجز
- `/packages` - الباقات الذكية ومخصص الباقات
- `/rfq` - نظام طلب ومقارنة عروض الأسعار
- `/inspiration` - منصة الإلهام والأفكار المجتمعية
- `/invite/INV-ROYAL-789` - بطاقة الدعوة الرقمية وتأكيد الحضور (RSVP)
- `/scan` - قارئ الباركود والدخول السريع عند بوابة الحفل
- `/vendor` - بوابة ومكتب أعمال الموردين
- `/admin` - لوحة التحكم الشاملة
