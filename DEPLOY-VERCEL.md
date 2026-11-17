# النشر على Vercel + الموبايل والتابلت

<div dir="rtl">

## بالعربي — الخلاصة في ٣ خطوات

1. افتح [vercel.com/new](https://vercel.com/new) واختار مستودع GitHub
   `Anas-first-game` ثم اضغط **Deploy**. مفيش أي إعدادات مطلوبة: ملف
   `vercel.json` موجود في المستودع بيقول لـ Vercel إن ده موقع ثابت
   (مفيش Framework، مفيش Build، مفيش تثبيت حزم).
2. استنى حوالي دقيقة، وهتلاقي اللعبة شغالة على
   `https://<اسم-المشروع>.vercel.app`.
3. افتح الرابط من الموبايل أو التابلت — هيشتغل **وضع اللعب الفردي**
   (Solo) تلقائيًا مع أزرار اللمس. مش محتاج أي حاجة تانية.

> **ليه Solo؟** Vercel بيقدّم ملفات ثابتة بس، ومش بيشغّل سيرفر Node دائم
> بيفتح WebSocket. سيرفر اللعبة (`src/server/index.js` + Colyseus) لازم
> يشتغل على استضافة تانية بتشغّل عمليات Node باستمرار (Railway / Render /
> Fly.io / VPS / جهازك + Cloudflare Tunnel). لما السيرفر مش موجود،
> الكلاينت بيكتشف كده تلقائيًا وبيشتغل على المحاكاة المحلية
> (`src/LocalRoom.js`) وبيظهر شارة `OFFLINE — SOLO MODE`.

### تفعيل اللعب الجماعي (Multiplayer) مع Vercel

شغّل السيرفر في أي مكان بيوفر `wss://` (مثال: Railway → الرابط
`https://mygame.up.railway.app`)، وبعدين اختار طريقة واحدة من التلاتة:

| الطريقة | إزاي | مناسبة إمتى |
|---|---|---|
| `env.js` (الأفضل) | افتح `env.js` وغيّر السطر لـ `window.__OPENGAME__ = { wsUrl: 'wss://mygame.up.railway.app', bloom: false };` واعمل commit | سيرفر ثابت لكل الزوار |
| لينك شير | `https://<project>.vercel.app/?server=mygame.up.railway.app` | تجربة سريعة أو سيرفر مؤقت (Cloudflare quick tunnel) |
| خانة اللوجين | اكتب هوست السيرفر في خانة *game server* في شاشة الدخول | اللاعب بيدخل سيرفره بنفسه |

ترتيب الأولوية في `src/config.js`: `?server=` ← آخر قيمة محفوظة في
`localStorage` ← `env.js` ← نفس الأصل (same-origin) ← `ws://localhost:2567`.
الكلاينت بيرفع `ws://` لـ `wss://` تلقائيًا لو الصفحة شغالة على HTTPS
(وإلا المتصفح هيرفض الاتصال المختلط).

### نشر من الـ CLI (اختياري)

```bash
npm i -g vercel
vercel          # أول مرة: يربط المشروع (preview deployment)
vercel --prod   # النشر النهائي
```

### اللي موجود في `vercel.json`

- `framework: null`, `outputDirectory: "."` → المستودع نفسه هو الموقع،
  والصفحة الرئيسية `index.html`.
- `buildCommand` و`installCommand` مجرد `echo` → مفيش تثبيت لحزم السيرفر
  (`colyseus`, `uWebSockets.js`) على Vercel، فالنشر أسرع ومستقر.
- الكاش: `env.js` و`index.html` بـ `no-store` (نسخة قديمة من `env.js`
  معناها كل اللاعبين بيحاولوا يوصلوا لسيرفر ميت)، `/src/*` بـ
  `max-age=0, must-revalidate`، `/assets/vendor/*` بـ `immutable`،
  وباقي `/assets/*` يوم واحد.
- هيدرز أمان: `X-Content-Type-Options: nosniff`، `Referrer-Policy`،
  `Permissions-Policy` (بدون `X-Frame-Options` عشان اللعبة تفضل قابلة
  للتضمين في iframe).
- `.vercelignore` بيستبعد `test/`, `tools/`, `docs/`, `data/` وأدوات
  التطوير. **مش** بيستبعد `src/server/` لأن الكلاينت بيستورد منها أجزاء
  مشتركة (`schema`, `config`, `movement`) بتشغّل المحاكاة المحلية.

## الموبايل والتابلت

- زوايا الاستجابة: تابلت `≤1024px`، موبايل `≤600px`، وموبايل بالعرضي
  `orientation: landscape and max-height: 520px`.
- `viewport-fit=cover` + `env(safe-area-inset-*)` → الـ HUD والأزرار
  مش بيتغطّوا بالـ notch أو شريط الهوم.
- `overscroll-behavior: none` + `touch-action` → مفيش Pull-to-refresh ولا
  زووم باللمس أثناء تحريك الجويستيك، وحقول اللوجين بحجم 16px عشان
  iOS Safari ميـزوّمش الصفحة.
- الجويستيك بيبدأ من أي مكان في النص الشمال السفلي من الشاشة، وأزرار
  الضرب/المهارة/الصد في النص اليمين — كلها داخل مساحة الإبهام.
- الأداء: سقف `devicePixelRatio` على الموبايل/التابلت 1.5 (بدل 2) وخريطة
  الظل 1024 (بدل 2048)، ولو الـ FPS فضل أقل من 45 لمدة 3 ثواني الكلاينت
  ينزّل دقة الرسم درجة (ومبيرجعهاش تاني عشان مفيش تقليب).
- لو الشاشة صغيرة: بانل الحضور/الماتشات بيتشال (بيغطي ثلث الشاشة)،
  وشريط إعدادات المؤثرات بيتشال (مكانه بيغطي أزرار اللمس) — الصوت من
  زرار 🔇 والأداء بيتظبط تلقائي.

</div>

---

## English

### Deploy (one click, no build)

1. Go to [vercel.com/new](https://vercel.com/new), import
   `anasmahmoudam2007/Anas-first-game`, press **Deploy**.
2. Vercel reads the committed `vercel.json`: no framework preset, no build
   command, the repository root is the served output.
3. Open `https://<project>.vercel.app`. The client detects that no game
   server is reachable and starts the browser-local solo simulation
   (`src/LocalRoom.js`), with the touch overlay on phones/tablets.

Vercel serves static files only — the Colyseus server (`src/server/index.js`)
is a long-lived Node/WebSocket process and needs a host that runs Node
(Railway, Render, Fly.io, a VPS, or your machine + Cloudflare Tunnel).

### Multiplayer from a Vercel deployment

Host the server anywhere that gives you `wss://` (e.g.
`https://mygame.up.railway.app`), then use one of:

- **`env.js`** (default for all visitors):
  `window.__OPENGAME__ = { wsUrl: 'wss://mygame.up.railway.app', bloom: false };`
- **Share link**: `https://<project>.vercel.app/?server=mygame.up.railway.app`
- **Login field**: players type the host into the *game server* box.

Resolution order (`src/config.js`): `?server=` → remembered
`localStorage` value → `env.js` `wsUrl` → same origin → `ws://localhost:2567`.
`ws://` is upgraded to `wss://` on an HTTPS page so browsers never block the
socket as mixed content.

### Caching contract in `vercel.json`

| Path | Cache-Control | Why |
|---|---|---|
| `/env.js`, `/index.html`, `/` | `no-store, must-revalidate` | runtime config + entry point must never be stale |
| `/src/(.*)` | `public, max-age=0, must-revalidate` | unhashed ES modules; cheap 304s |
| `/assets/vendor/(.*)` | `public, max-age=31536000, immutable` | pinned vendored libs |
| `/assets/(.*)` | `public, max-age=86400` | models/textures |

Plus `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` and a restrictive `Permissions-Policy` on
every response. No `X-Frame-Options`, so previews/portals can embed the game.

### Mobile / tablet notes

- Breakpoints: tablet `≤1024px`, phone `≤600px`, landscape phone
  (`orientation: landscape and max-height: 520px`).
- `viewport-fit=cover` + `env(safe-area-inset-*)` keep the HUD, toasts and
  action buttons clear of notches and the iOS home indicator.
- `overscroll-behavior: none` + `touch-action` stop pull-to-refresh and
  double-tap zoom from interrupting a joystick drag; login inputs are 16px so
  iOS Safari does not zoom the page on focus.
- Touch controls auto-enable on coarse pointers / touch points (force with
  `?touch=1`).
- Adaptive quality: DPR ceiling 1.5 and 1024² shadow map on touch devices,
  and the pixel ratio steps down (never back up) if the measured frame rate
  stays under 45fps.
- On narrow screens the presence/live-matches panel and the desktop FX
  settings strip are hidden (they cover the playfield and the touch buttons);
  mute stays on the 🔊 button and quality adapts automatically.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `OFFLINE — SOLO MODE` badge forever | no server reachable — expected on a static deploy; set `env.js` `wsUrl` or use `?server=` |
| "Failed to load the game code (CDN unreachable?)" | jsdelivr blocked on the network; run `node tools/vendor-assets.mjs` and deploy with `VENDORED_ASSETS=1` (served from `/assets/vendor`) |
| Multiplayer connects then drops immediately | server page is HTTPS but the server URL is `ws://` → use `wss://` (behind a TLS reverse proxy or a tunnel) |
| Player can't move on a phone | touch overlay hidden by a desktop-only UA? open `?touch=1`, or confirm `pointer: coarse` matches in devtools device mode |
