# DocBook — لوحة الممرضة

## هيكل الملفات

```
📁 docbook-nurse/
├── nurse.html          ← الصفحة الرئيسية (HTML نظيف)
├── nurse-style.css     ← كل الـ CSS (1785 سطر)
├── nurse-app.js        ← المنطق الرئيسي (Firebase, مواعيد, مرضى, تقويم)
├── nurse-alerts.js     ← تنبيهات الدكتور + العداد
├── nurse-login.js      ← نظام تسجيل الدخول
├── manifest.json       ← PWA Manifest
├── service-worker.js   ← Service Worker (Cache Strategy)
├── icon-192.png        ← ⚠️ أضفه يدوياً (192×192)
└── icon-512.png        ← ⚠️ أضفه يدوياً (512×512)
```

## تجهيز أيقونات PWA

حمّل الصورة من الرابط:
https://i.postimg.cc/P5RD9Fpf/WA-1777132166001.jpg

ثم حوّلها إلى حجمين:
- **icon-192.png** → 192×192 بكسل
- **icon-512.png** → 512×512 بكسل

يمكنك استخدام: https://squoosh.app أو أي أداة تحويل صور

## Service Worker — استراتيجية الكاش

| النوع | الاستراتيجية |
|-------|--------------|
| Firebase / CDN خارجي | Network Only |
| HTML / CSS / JS / صور | Cache First + Stale While Revalidate |
| طلبات أخرى | Network First |

## كلمة مرور الممرضة

`nurse123` (غيّرها في `nurse-login.js` السطر الأول)
