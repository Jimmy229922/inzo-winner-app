# تحليل شامل صفحة اختيار الفائزين (Winner Roulette)

## 1) نطاق التحليل
- الهدف: فهم سبب ثِقل صفحة **اختيار الفائزين لمسابقات الوكيل** والتأكد من الربط الكامل بين الفرونت إند والباك إند.
- القيد: **بدون تعديل أي كود** (تحليل فقط + خطة تحسين).
- تاريخ التحليل: 2026-04-16

---

## 2) الملفات التي تم تحليلها

### Frontend
- `frontend/js/main.js`
- `frontend/js/pages/winner-roulette.js` (Legacy)
- `frontend/js/pages/winner-roulette/main.js` (Modular)
- `frontend/js/pages/winner-roulette/api.js`
- `frontend/js/pages/winner-roulette/db.js`
- `frontend/pages/winner-roulette.html`
- `frontend/assets/css/winner-roulette.css`
- `frontend/dist/bundle.js`

### Backend
- `backend/src/app.js`
- `backend/src/routes/winner.routes.js`
- `backend/src/routes/agent.routes.js`
- `backend/src/routes/competition.routes.js`
- `backend/src/controllers/winner.controller.js`
- `backend/src/controllers/agent.controller.js`
- `backend/src/controllers/competition.controller.js`
- `backend/src/models/Winner.js`
- `backend/src/middleware/auth.middleware.js`
- `backend/src/api/middleware/auth.middleware.js`

---

## 3) مؤشرات مباشرة تفسر الثِقل

## 3.1 أحجام وكتلة كود كبيرة
- `frontend/dist/bundle.js` = **1,462,032 bytes** (~1.46 MB).
- `frontend/js/pages/winner-roulette.js` = **377,007 bytes**.
- عدد أسطر:
  - `frontend/dist/bundle.js`: **29,639**
  - `frontend/js/pages/winner-roulette.js`: **7,910**
  - `frontend/js/pages/winner-roulette/main.js`: **1,255**

**أثر ذلك:** Parse/Execute أعلى في المتصفح + تحميل مبدئي أكبر.

---

## 3.2 مسار Legacy هو الافتراضي حاليًا
- في `frontend/js/main.js:1156` يتم فحص تفعيل modular.
- إذا لم تتوفر `?modular=1` أو `localStorage('winnerRouletteMode') === 'modular'`، ينتقل لمسار Legacy (`frontend/js/main.js:1184`).
- تفعيل Modular حاليًا مشروط يدويًا (`frontend/js/main.js:1216`).

**النتيجة:** المستخدم غالبًا يدخل على نسخة Legacy الأكبر والأثقل افتراضيًا.

---

## 3.3 Legacy فيه حمل أعلى (Events/Calls/Intervals)
- في `frontend/js/pages/winner-roulette.js`:
  - `addEventListener(` ≈ **74** مرة.
  - `authedFetch(` ≈ **39** مرة.
  - `setInterval(` = **2**.
- Auto timers:
  - مزامنة دورية `_wrAutoSyncTimer` (`frontend/js/pages/winner-roulette.js:2138`)
  - حفظ دوري `_wrAutoSaveTimer` (`frontend/js/pages/winner-roulette.js:2170`)

**النتيجة:** نشاط خلفي مستمر + كثافة أعلى في listeners والنداءات.

---

## 3.4 استدعاءات بيانات ضخمة في Legacy
- `frontend/js/pages/winner-roulette.js:863`  
  `GET /api/competitions?limit=2000&sort=-createdAt`
- `frontend/js/pages/winner-roulette.js:870`  
  `GET /api/agents?limit=1000`
- نفس الاستدعاءات أيضًا بشكل متوازي (`frontend/js/pages/winner-roulette.js:909-910`).

**النتيجة:** حمل زائد على الشبكة والباك والـrender خصوصًا مع بيانات كبيرة.

---

## 3.5 إدارة backup/session في Legacy مكلفة
- حفظ backup متكرر في localStorage (`winnerRoulette_backup_*`) عند `safeImmediateSave`:
  - إنشاء backup (`frontend/js/pages/winner-roulette.js:462`)
  - مسح/فرز backups عبر loop على كل مفاتيح localStorage (`505`, `521`).

**النتيجة:** كلفة I/O وJSON وعمليات متكررة على localStorage.

---

## 3.6 مسار الاستعادة (Restore) ثقيل جدًا
- سحب restore data: `restore-data?skipValidation=true` (`2584`)
- ثم Validation إضافي منفصل: `validate-files` (`2740`)
- كثير من مراحل UI/توست/Animation/Timeouts في وضع الاستعادة.

**النتيجة:** بطء ملحوظ إذا الصفحة دخلت في سيناريو restore.

---

## 4) تدقيق الربط الكامل Frontend ↔ Backend

## 4.1 خريطة API (Modular)

| Frontend Caller | Endpoint | Backend Route/Controller | الحالة |
|---|---|---|---|
| `api.fetchAgents()` | `GET /api/agents?limit=1000` | `app.js -> /api/agents -> agent.routes -> getAllAgents` | يعمل، لكن limit كبير |
| `api.fetchCompetitions(agentId)` | `GET /api/competitions?agentId=...&limit=100` | `competition.routes -> getAllCompetitions` | يعمل |
| `api.fetchCompetitionById(id)` | `GET /api/competitions/:id` | `competition.routes -> getCompetitionById` | يعمل |
| `api.fetchWinners(agentId, competitionId)` | `GET /api/agents/:agentId/winners?competition_id=...` | `winner.routes -> winnerController.getWinnersByAgent` | يعمل |
| `api.importWinners(...)` | `POST /api/agents/:agentId/winners/import` | `winner.routes -> importWinnersForAgent` | يعمل |
| `api.uploadIdImage(...)` | `POST /api/winners/:id/id-image` | `winner.routes -> uploadWinnerIdImage` | يعمل |
| `api.uploadVideo(...)` | `POST /api/winners/:id/video` | `winner.routes -> uploadWinnerVideo` | يعمل |
| `api.validateWinnersImages(...)` | `POST /api/agents/validate-winners-images` | `agent.routes -> validateWinnersImages` | يعمل |
| `api.sendWinnersReport(...)` | `POST /api/agents/:id/send-winners-report` | `agent.routes -> sendWinnersReport` | يعمل |
| `api.sendWinnersDetails(...)` | `POST /api/agents/:id/send-winners-details` | `agent.routes -> sendWinnersDetails` | يعمل |
| `api.completeCompetition(id)` | `POST /api/competitions/:id/complete` | `competition.routes -> completeCompetition` | يعمل |

---

## 4.2 ملاحظات ربط مهمة (فجوات/مخاطر)

### A) ازدواجية مسار winners
- يوجد مساران GET متقاربان:
  - `winner.routes`: `GET /agents/:agentId/winners`
  - `agent.routes`: `GET /:id/winners`
- ومع ترتيب التركيب في `app.js`:
  - `app.use('/api', winnerRoutes)` قبل `app.use('/api/agents', ...)`

**المحصلة:** نفس URL `GET /api/agents/:id/winners` قد يكون ملتبس تنظيميًا، ويزيد صعوبة الصيانة.

---

### B) ازدواجية middleware مصادقة مختلفين
- `backend/src/middleware/auth.middleware.js`
- `backend/src/api/middleware/auth.middleware.js`

وكلاهما مستخدم في مسارات مختلفة.

**المخاطر:** اختلاف شكل `req.user`/رسائل الخطأ/سلوك التحقق، وتعقيد تتبع الأعطال.

---

### C) تعليق في app.js لا يطابق الواقع
- في `backend/src/app.js` يوجد تعليق أن Winners routes public GET.
- فعليًا `winner.routes` يضع `authenticate` على `GET /agents/:agentId/winners`.

**المخاطر:** فهم خاطئ أثناء التشغيل أو troubleshooting.

---

### D) اختلافات Contract في مخرجات winners
- `winner.controller.getWinnersByAgent` يرجع `competitions[]` مع `id/title/question/winners`.
- `agent.controller.getAgentWinners` يرجع `competitions[]` بصيغة مختلفة.

**المخاطر:** لو تم تغيير route resolution أو استدعاء endpoint مختلف، يحصل سلوك غير متوقع في الفرونت.

---

### E) تناقض منطقي حول `winners_count`
- في import:
  - يوجد تعليق واضح أن `winners_count` هدف المسابقة ولا يتم زيادته.
- في delete winner:
  - يتم إنقاص `winners_count`.

**المخاطر:** انحراف بيانات العدادات بمرور الوقت.

---

### F) completeCompetition يتوقع payload أوسع من المرسل فعليًا
- `competition.controller.completeCompetition` يقرأ `{ winners, noWinners, isRestoreMode }`.
- في Modular: `api.completeCompetition` يرسل POST بدون body مفصل.

**النتيجة:** يعمل فنيًا، لكن معلومات التدقيق/اللوج قد تكون أقل من الممكن.

---

## 5) لماذا الصفحة “تقيلة” بشكل عملي؟

السبب الجذري ليس نقطة واحدة، بل مزيج:
1. **Legacy default** بدل Modular.
2. **bundle كبير** + صفحة Legacy كبيرة جدًا.
3. **طلبات API كبيرة جدًا** (`2000` مسابقات + `1000` وكلاء).
4. **مؤقتات دورية** + حفظات متكررة + localStorage backup scanning.
5. **تعدد مسارات الربط** (legacy + modular + routes متكررة) يزيد التعقيد والكلفة الذهنية والتنفيذية.

---

## 6) Runbook تنفيذ كود فعلي (مراحل صغيرة متسلسلة)

> الهدف من هذا القسم: تنفيذ كل التحسينات على شكل خطوات صغيرة جدًا وآمنة، بحيث كل مرحلة تتنفذ وتُختبر قبل الانتقال للمرحلة التالية.

### قواعد التنفيذ الآمن قبل البداية
1. نفّذ **مرحلة واحدة فقط** في كل مرة.
2. بعد كل مرحلة: شغّل `node build.js` وتأكد أن الصفحة تفتح بدون أخطاء Console.
3. لا تجمع تغييرات backend كبيرة مع frontend كبيرة في نفس المرحلة.
4. في أي مرحلة يظهر فيها regression: ارجع آخر تعديل للمرحلة فقط ثم كمل.

---

## Phase 01: جعل Modular هو الافتراضي (مع Legacy للطوارئ)

### الهدف
تقليل الحمل مباشرة عبر توجيه أغلب المستخدمين للمسار الأخف (Modular) بدل Legacy.

### ملفات التعديل
- `frontend/js/main.js`

### تعديل الكود
حدّث دالة `isWinnerRouletteModularEnabled` لتكون الافتراضي `true`، واجعل التعطيل صريحًا عبر `legacy=1` أو `localStorage('winnerRouletteMode') = 'legacy'`.

```js
function isWinnerRouletteModularEnabled() {
  const hash = window.location.hash || '';
  const queryIdx = hash.indexOf('?');
  if (queryIdx !== -1) {
    const params = new URLSearchParams(hash.slice(queryIdx + 1));
    if (params.get('legacy') === '1') return false;
    if (params.get('modular') === '1') return true;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search || '');
    if (urlParams.get('legacy') === '1') return false;
    if (urlParams.get('modular') === '1') return true;
  } catch (_) {}

  try {
    const mode = localStorage.getItem('winnerRouletteMode');
    if (mode === 'legacy') return false;
    if (mode === 'modular') return true;
  } catch (_) {}

  return true;
}
```

### اختبار قبول المرحلة
1. افتح `#winner-roulette` بشكل عادي: لازم يدخل Modular.
2. افتح `#winner-roulette?legacy=1`: لازم يدخل Legacy.

---

## Phase 02: Fallback Legacy Lazy (تحميل عند الحاجة فقط)

### الهدف
الحفاظ على Legacy كخطة إنقاذ، لكن بدون تحميله مبكرًا لكل المستخدمين.

### ملفات التعديل
- `frontend/js/main.js`

### تعديل الكود
أضف helper لتحميل ملف Legacy وقت الفشل فقط:

```js
let legacyRouletteScriptPromise = null;

function loadLegacyWinnerRouletteScript() {
  if (window.winnerRouletteInit) return Promise.resolve();
  if (legacyRouletteScriptPromise) return legacyRouletteScriptPromise;

  legacyRouletteScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `/js/pages/winner-roulette.js?t=${Date.now()}`;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return legacyRouletteScriptPromise;
}
```

وفي fallback داخل `renderWinnerRoulettePage`:

```js
await loadLegacyWinnerRouletteScript();
if (typeof window.winnerRouletteInit === 'function') {
  window.winnerRouletteInit();
}
```

### اختبار قبول المرحلة
1. اكسر Modular مؤقتًا (مثال: rename init function) وتأكد fallback يعمل.
2. رجّع التعديل بعد الاختبار.

---

## Phase 03: إزالة Legacy من bundle الرئيسي

### الهدف
تقليل حجم parse/execute عند فتح الموقع.

### ملفات التعديل
- `build.js`

### تعديل الكود
احذف `js/pages/winner-roulette.js` من مصفوفة `jsFiles`.

> مهم: هذه المرحلة لا تنفذ قبل نجاح Phase 02.

### اختبار قبول المرحلة
1. شغّل `node build.js`.
2. افتح `#winner-roulette` (Modular يعمل).
3. افتح `#winner-roulette?legacy=1` (Legacy lazy يعمل بعد تحميل script).

---

## Phase 04: تخفيف استدعاءات Legacy الكبيرة جدًا (2000/1000)

### الهدف
خفض الضغط على الشبكة والـrender في مسار Legacy لحين التخلص منه نهائيًا.

### ملفات التعديل
- `frontend/js/pages/winner-roulette.js`

### تعديل الكود
استبدل الاستدعاءات الضخمة:

```js
// قبل
authedFetch('/api/competitions?limit=2000&sort=-createdAt')
authedFetch('/api/agents?limit=1000')

// بعد (مرحلة انتقالية آمنة)
authedFetch('/api/competitions?limit=300&sort=-createdAt')
authedFetch('/api/agents?limit=300&sort=name_asc')
```

### اختبار قبول المرحلة
1. افتح Legacy وتأكد قائمة الوكلاء تظهر.
2. قارن زمن فتح الصفحة قبل/بعد.

---

## Phase 05: تقليل تحميل agents في Modular + دعم بحث تدريجي

### الهدف
منع سحب 1000 وكيل في كل مرة.

### ملفات التعديل
- `frontend/js/pages/winner-roulette/api.js`
- `frontend/js/pages/winner-roulette/main.js`

### تعديل الكود
في `api.js`:

```js
export async function fetchAgents({ page = 1, limit = 50, search = '' } = {}) {
  const authedFetch = getAuthedFetch();
  const q = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await authedFetch(`/api/agents?page=${page}&limit=${limit}&sort=name_asc${q}`);
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to fetch agents'));
  const payload = await response.json();
  return {
    agents: normalizeArrayResponse(payload, ['data', 'agents']),
    totalPages: payload.totalPages || 1,
    currentPage: payload.currentPage || page
  };
}
```

وفي `main.js` (modular) أضف input بحث للوكيل + pagination بسيط.

### اختبار قبول المرحلة
1. كتابة 2-3 أحرف في البحث تظهر نتائج أسرع.
2. عدم وجود freeze عند فتح الصفحة.

---

## Phase 06: فرض limit آمن في backend للـ agents

### الهدف
تأمين الـAPI من أي client يطلب limit ضخم.

### ملفات التعديل
- `backend/src/controllers/agent.controller.js`

### تعديل الكود
داخل `getAllAgents`:

```js
const rawPage = Number(req.query.page || 1);
const rawLimit = Number(req.query.limit || 10);
const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 10;

const search = (req.query.search || req.query.q || '').trim();
if (search) {
  query.name = { $regex: search, $options: 'i' };
}
```

### اختبار قبول المرحلة
1. `GET /api/agents?limit=99999` يجب أن يرجع بحد أقصى 200.
2. `search` و `q` كلاهما يعملان.

---

## Phase 07: إزالة ازدواجية endpoint الفائزين

### الهدف
جعل source of truth واحد للفائزين لتفادي تضارب contracts.

### ملفات التعديل
- `backend/src/routes/agent.routes.js`

### تعديل الكود
احذف السطر التالي:

```js
router.get('/:id/winners', agentController.getAgentWinners);
```

وسيظل endpoint الرسمي:

```js
GET /api/agents/:agentId/winners
```

من `winner.routes.js`.

### اختبار قبول المرحلة
1. شاشة الروليت تسحب الفائزين طبيعي.
2. أي صفحة كانت تستخدم endpoint القديم لا تتأثر (نفس URL ما زال موجود من winner routes).

---

## Phase 08: تنظيف تركيب routes وتعليق app.js

### الهدف
تقليل الالتباس أثناء الصيانة و troubleshooting.

### ملفات التعديل
- `backend/src/app.js`

### تعديل الكود
صحّح التعليق حول winners لأنه ليس public فعليًا.

```js
// Winners routes are authenticated in winner.routes.js via authenticate middleware.
app.use('/api', winnerRoutes);
```

### اختبار قبول المرحلة
1. لا تغيير سلوكي.
2. قراءة `app.js` تصبح واضحة لزملاء الفريق.

---

## Phase 09: توحيد auth middleware بدون كسر الاستيرادات الحالية

### الهدف
نسخة مصادقة واحدة وسلوك موحد لـ `req.user`.

### ملفات التعديل
- `backend/src/middleware/auth.unified.js` (جديد)
- `backend/src/middleware/auth.middleware.js`
- `backend/src/api/middleware/auth.middleware.js`

### تعديل الكود
1) أنشئ `auth.unified.js` وفيه `authenticate` فقط.
2) خلّي الملفين القديمين مجرد wrappers:

```js
// backend/src/middleware/auth.middleware.js
const { authenticate } = require('./auth.unified');
module.exports = authenticate;
module.exports.authenticate = authenticate;
```

```js
// backend/src/api/middleware/auth.middleware.js
const { authenticate } = require('../../middleware/auth.unified');
module.exports = { authenticate };
```

### اختبار قبول المرحلة
1. كل endpoints المؤمنة تشتغل بنفس السلوك.
2. لا فرق في شكل `req.user` بين مسار وآخر.

---

## Phase 10: إصلاح تضارب winners_count نهائيًا

### الهدف
منع انحراف عدادات المسابقة (target vs actual).

### ملفات التعديل
- `backend/src/controllers/winner.controller.js`

### تعديل الكود
في `deleteWinner` احذف أي decrement على:
- `winners_count`
- `trading_winners_count`
- `deposit_winners_count`

لأن هذه القيم تمثل target/config وليس current live count.

استبدلها فقط بتحديث timestamp/metadata إن لزم.

### اختبار قبول المرحلة
1. حذف فائز لا يغيّر target winners في المسابقة.
2. `current_winners_count` يظل محسوبًا من `Winner.countDocuments`.

---

## Phase 11: توافق payload في completeCompetition

### الهدف
تحسين logging/snapshot consistency بدون تغيير behavior.

### ملفات التعديل
- `frontend/js/pages/winner-roulette/api.js`
- `frontend/js/pages/winner-roulette/main.js`

### تعديل الكود
في `api.js`:

```js
export async function completeCompetition(competitionId, payload = {}) {
  const authedFetch = getAuthedFetch();
  const response = await authedFetch(`/api/competitions/${encodeURIComponent(competitionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winners: payload.winners || [],
      noWinners: !!payload.noWinners,
      isRestoreMode: !!payload.isRestoreMode
    })
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to approve competition'));
  return response.json();
}
```

وفي `main.js` مرّر payload حقيقي عند الاعتماد.

### اختبار قبول المرحلة
1. اعتماد مسابقة بفائزين/بدون فائزين يظهر في logs بشكل أدق.
2. لا تأثير سلبي على المسار الحالي.

---

## Phase 12: تقليل polling وتكلفة autosave في Legacy

### الهدف
تقليل الاستهلاك الخلفي والـjank في Legacy.

### ملفات التعديل
- `frontend/js/pages/winner-roulette.js`

### تعديل الكود
1) ارفع `autoSync` من 25 ثانية إلى 60 ثانية.
2) امنع كتابة backup كل مرة في `safeImmediateSave` عبر throttle:

```js
let lastBackupAt = 0;
const BACKUP_MIN_INTERVAL_MS = 15000;

if (Date.now() - lastBackupAt >= BACKUP_MIN_INTERVAL_MS) {
  localStorage.setItem(backupKey, JSON.stringify(backupData));
  cleanupOldBackups();
  lastBackupAt = Date.now();
}
```

3) اربط `visibilitychange` مرة واحدة فقط (flag) حتى لا تتكرر listeners مع إعادة فتح الصفحة.

### اختبار قبول المرحلة
1. لا يوجد تضخم مفاتيح `winnerRoulette_backup_*` بسرعة.
2. CPU أقل أثناء بقاء الصفحة مفتوحة طويلًا.

---

## Phase 13: فهارس MongoDB المطلوبة للروليت

### الهدف
تسريع queries الأساسية ومنع تكرار `order_number` داخل نفس المسابقة.

### ملفات التعديل
- `backend/src/models/Winner.js`

### تعديل الكود

```js
winnerSchema.index({ agent_id: 1, competition_id: 1, selected_at: -1 });
winnerSchema.index({ competition_id: 1, createdAt: -1 });
winnerSchema.index(
  { competition_id: 1, order_number: 1 },
  {
  unique: true,
  partialFilterExpression: { order_number: { $type: 'number' } }
  }
);
```

### اختبار قبول المرحلة
1. import winners لا يسمح order_number مكرر لنفس المسابقة.
2. زمن استعلامات winners ينخفض في المسابقات الكبيرة.

---

## Phase 14: غلق مسار Legacy نهائيًا (بعد الاستقرار)

### الهدف
إزالة عبء الصيانة المزدوجة والتعارض المستقبلي.

### ملفات التعديل
- `frontend/js/main.js`
- `frontend/js/pages/winner-roulette.js` (أرشفة/حذف لاحق)
- `build.js`

### تعديل الكود
1. احتفظ بflag طوارئ أسبوعين فقط.
2. بعد الاستقرار: احذف fallback Legacy نهائيًا.
3. احذف الملف من build ومن أي dynamic loader.

### اختبار قبول المرحلة
1. كل سيناريوهات الروليت تعمل على Modular فقط.
2. حجم `bundle.js` ينخفض بوضوح.

---

## Phase 15: Contract Tests خفيفة لمنع أي رجوع للخلف

### الهدف
تثبيت السلوك بعد كل هذا التقسيم.

### ملفات التعديل
- `backend` tests (أو smoke scripts)
- `frontend` smoke checklist

### الحد الأدنى المطلوب
1. `GET /api/agents/:agentId/winners?competition_id=...` يرجع shape ثابت.
2. `POST /api/agents/:agentId/winners/import` مع `competition_id` يعمل دائمًا.
3. `POST /api/competitions/:id/complete` يمرر snapshot/log metadata.

---

## 7) Checklist تنفيذ لكل مرحلة (لا تنتقل بدونها)
1. `node build.js` ينجح.
2. فتح `#winner-roulette` بدون أخطاء Console.
3. اختيار Agent + Competition بدون lag واضح.
4. إضافة فائز + رفع فيديو + رفع هوية + حفظ.
5. إرسال Report + Details.
6. اعتماد المسابقة ثم Refresh والتحقق من الاتساق.

---

## 8) ترتيب التنفيذ المقترح (مختصر)
1. Phase 01 → 02 → 03
2. Phase 04 → 05 → 06
3. Phase 07 → 08 → 09
4. Phase 10 → 11
5. Phase 12 → 13
6. Phase 14 → 15

> لو عايز أقل ريسك ممكن: نفذ أول 6 مراحل فقط أولًا، واشتغل عليها يوم تشغيل كامل، وبعدها كمل باقي المراحل.

