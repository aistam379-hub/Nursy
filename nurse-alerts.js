// ================== DocBook Nurse — Doctor Alerts & Timer ==================

  (function(){

    // ─── مفاتيح ───
    const NURSE_ALERT_KEY  = 'nurseAlert';
    const CUSTOM_ALERT_KEY = 'nurseCustomAlert';
    const TIMER_STATS_KEY  = 'visitTimerStats';

    // ─── إعدادات التنبيه ───
    const ALERT_CONFIG = {
      next:   { icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`, title: 'أدخل المريض التالي',  sub: 'تنبيه من الدكتور', cls: 'type-next'   },
      enter:  { icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`, title: 'ادخلي للغرفة',        sub: 'الدكتور يناديك',   cls: 'type-enter'  },
      custom: { icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, title: '',                     sub: '',                  cls: 'type-custom' },
    };

    let alertTimer = null;

    // ─── صوت التنبيه ───
    function playAlertSound(type) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);

        if (type === 'next') {
          // ثلاث نبضات صاعدة
          [0, 0.18, 0.36].forEach((t, i) => {
            const o = ctx.createOscillator();
            o.connect(gain);
            o.type = 'sine';
            o.frequency.setValueAtTime([520, 660, 800][i], ctx.currentTime + t);
            gain.gain.setValueAtTime(0.55, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.14);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.15);
          });
        } else if (type === 'enter') {
          // نبضتان قصيرتان حادتان
          [0, 0.28].forEach(t => {
            const o = ctx.createOscillator();
            o.connect(gain);
            o.type = 'square';
            o.frequency.setValueAtTime(480, ctx.currentTime + t);
            gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.22);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.24);
          });
        } else {
          // نغمة مميزة للمخصص
          const o = ctx.createOscillator();
          o.connect(gain);
          o.type = 'triangle';
          o.frequency.setValueAtTime(350, ctx.currentTime);
          o.frequency.linearRampToValueAtTime(560, ctx.currentTime + 0.25);
          o.frequency.linearRampToValueAtTime(420, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          o.start(ctx.currentTime);
          o.stop(ctx.currentTime + 0.65);
        }
        setTimeout(() => ctx.close(), 1500);
      } catch(e) {}
    }

    // ─── عرض بانر التنبيه ───
    window.showDoctorAlert = function(type) {
      const cfg = ALERT_CONFIG[type];
      if (!cfg) return;

      // قراءة الزر المخصص من localStorage
      const customData = JSON.parse(localStorage.getItem(CUSTOM_ALERT_KEY) || 'null') || { label: 'تنبيه مخصص', desc: 'تنبيه من الدكتور' };
      const title = type === 'custom' ? customData.label : cfg.title;
      const sub   = type === 'custom' ? customData.desc  : cfg.sub;

      document.getElementById('alertBannerIcon').innerHTML  = cfg.icon;
      document.getElementById('alertBannerTitle').textContent = title;
      document.getElementById('alertBannerSub').textContent   = sub;

      const inner = document.getElementById('alertBannerInner');
      inner.className = 'alert-banner-inner ' + cfg.cls;

      document.getElementById('doctorAlertBanner').classList.add('show');
      playAlertSound(type);

      clearTimeout(alertTimer);
      alertTimer = setTimeout(() => closeDoctorAlert(), 5000);
    };

    window.closeDoctorAlert = function() {
      clearTimeout(alertTimer);
      document.getElementById('doctorAlertBanner').classList.remove('show');
    };

    // ─── استقبال تنبيهات الدكتور عبر Firebase Real-time ───
    // (يتم التعامل معها في initializeFirebaseData → onSnapshot لـ settings)
    // الاستقبال عبر localStorage كـ fallback للتوافق مع المتصفح نفسه
    window.addEventListener('storage', function(e) {
      if (e.key === 'nurseAlert' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.type) showDoctorAlert(data.type);
        } catch(err) {}
      }
    });
    // BroadcastChannel للمتصفح نفسه فقط
    try {
      const bc = new BroadcastChannel('nurseAlerts');
      bc.onmessage = (e) => { if (e.data?.type) showDoctorAlert(e.data.type); };
    } catch(e) {}

    // ════════════════════════════════
    //   عداد وقت الكشف
    // ════════════════════════════════
    let timerInterval = null;
    let timerSeconds  = 0;
    let timerRunning  = false;

    // تحميل إحصائيات العداد
    let timerStats = JSON.parse(localStorage.getItem(TIMER_STATS_KEY) || '{"count":0,"totalSec":0}');

    function formatTime(sec) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function updateTimerDisplay() {
      const el = document.getElementById('timerDisplay');
      if (!el) return;
      el.textContent = formatTime(timerSeconds);
      // تلوين حسب المدة
      el.className = 'timer-display running';
      if (timerSeconds >= 900) el.className = 'timer-display danger';      // 15 دقيقة+
      else if (timerSeconds >= 600) el.className = 'timer-display warning'; // 10 دقائق+
    }

    function updateAvgDisplay() {
      const el = document.getElementById('timerAvgVal');
      if (!el) return;
      if (timerStats.count === 0) { el.textContent = '—'; return; }
      const avg = Math.round(timerStats.totalSec / timerStats.count);
      el.textContent = formatTime(avg) + ' (' + timerStats.count + ' كشف)';
    }
    updateAvgDisplay();

    // ─── عداد تلقائي مرتبط بموعد ───
    let activeTimerApptId    = null;
    let activeTimerPatientId = null;
    let activeTimerDate      = null;

    window.startVisitTimerAuto = function(apptId, patientId, visitDate) {
      // إيقاف أي عداد قديم
      if(timerRunning) { clearInterval(timerInterval); timerRunning = false; }
      activeTimerApptId    = apptId;
      activeTimerPatientId = patientId;
      activeTimerDate      = visitDate;
      timerRunning = true;
      timerSeconds = 0;
      updateTimerDisplay();
      const startBtn = document.getElementById('timerStartBtn');
      const stopBtn  = document.getElementById('timerStopBtn');
      if(startBtn) startBtn.classList.add('hidden');
      if(stopBtn)  stopBtn.classList.remove('hidden');
      timerInterval = setInterval(() => { timerSeconds++; updateTimerDisplay(); }, 1000);
    };

    // زر إنهاء الزيارة من كارت الروزنامة
    window.endVisitNow = function(apptId) {
      const rec = allRecords.find(r => r.id === apptId);
      if(!rec) return;
      const durationSec = timerRunning && activeTimerApptId === apptId
        ? timerSeconds
        : (rec.visitStartTime ? Math.round((Date.now() - rec.visitStartTime) / 1000) : 0);
      // إيقاف العداد إذا كان يعمل لهذا الموعد
      if(timerRunning && activeTimerApptId === apptId) {
        clearInterval(timerInterval);
        timerRunning = false;
        activeTimerApptId = null;
        const startBtn = document.getElementById('timerStartBtn');
        const stopBtn  = document.getElementById('timerStopBtn');
        if(stopBtn)  stopBtn.classList.add('hidden');
        if(startBtn) startBtn.classList.remove('hidden');
        const display = document.getElementById('timerDisplay');
        if(display) { display.textContent = formatTime(durationSec) + ' ✓'; display.className = 'timer-display'; }
        setTimeout(() => {
          if(display) { display.textContent = '00:00'; display.className = 'timer-display'; }
          timerSeconds = 0;
        }, 3000);
      }
      // حفظ مدة الزيارة في بيانات المريض (آخر زيارة)
      if(rec.linkedPatientId && durationSec > 0) {
        const p = allPatients[rec.linkedPatientId];
        if(p && p.appointments && p.appointments.length) {
          const lastAppt = p.appointments[p.appointments.length - 1];
          lastAppt.durationSec = durationSec;
          lastAppt.durationStr = formatTime(durationSec);
          fbSavePatient(p).catch(e => console.error('Firebase patient update:', e));
        }
      }
      // حفظ في إحصائيات العداد العامة
      if(durationSec >= 30) {
        timerStats.count++;
        timerStats.totalSec += durationSec;
        localStorage.setItem(TIMER_STATS_KEY, JSON.stringify(timerStats));
        updateAvgDisplay();
      }
      // تغيير حالة الموعد إلى Visited
      rec.Status = 'Visited';
      rec.visitEndTime = Date.now();
      rec.visitDurationSec = durationSec;
      fbUpdateAppointmentField(apptId, { Status: 'Visited', visitEndTime: rec.visitEndTime, visitDurationSec: durationSec })
        .catch(e => console.error('Firebase visit end:', e));
      showToast('تمت الزيارة — المدة: ' + formatTime(durationSec), 'success');
      updateCounts(); calculateDensity(); renderCalendar();
      if(selectedDayStr) renderAgendaForDay(selectedDayStr);
      if(currentSection === 'appointments') renderBothAppointmentColumns();
    };

    window.startVisitTimer = function() {
      if (timerRunning) return;
      timerRunning = true;
      timerSeconds = 0;
      updateTimerDisplay();
      document.getElementById('timerStartBtn').classList.add('hidden');
      document.getElementById('timerStopBtn').classList.remove('hidden');
      timerInterval = setInterval(() => {
        timerSeconds++;
        updateTimerDisplay();
      }, 1000);
    };

    window.stopVisitTimer = function() {
      if (!timerRunning) return;
      clearInterval(timerInterval);
      timerRunning = false;

      // حفظ في الإحصائيات
      if (timerSeconds >= 30) { // تجاهل الأقل من 30 ثانية
        timerStats.count++;
        timerStats.totalSec += timerSeconds;
        localStorage.setItem(TIMER_STATS_KEY, JSON.stringify(timerStats));
        updateAvgDisplay();
      }

      // إعادة الزر
      const display = document.getElementById('timerDisplay');
      if (display) {
        display.className = 'timer-display';
        display.textContent = formatTime(timerSeconds) + ' ✓';
      }
      setTimeout(() => {
        if (display) { display.textContent = '00:00'; display.className = 'timer-display'; }
        timerSeconds = 0;
      }, 3000);

      document.getElementById('timerStopBtn').classList.add('hidden');
      document.getElementById('timerStartBtn').classList.remove('hidden');
    };

  })();
  