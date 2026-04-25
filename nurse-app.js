// ================== DocBook Nurse Dashboard — Main App JS ==================
// يعتمد على: Firebase (معرّف في nurse.html), Tailwind, Lucide Icons

    // ================== Firebase Storage Layer ==================
    // مفاتيح مشتركة بين ملف الدكتور والممرضة
    const STORAGE_KEY          = 'doctorAppointments';
    const PATIENTS_STORAGE_KEY = 'doctorPatients';
    const CLOSED_DAYS_KEY      = 'closedDays';
    const SETTINGS_KEY         = 'appSettings';
    const NOTES_KEY            = 'sharedNotes';

    // ── Firestore helpers ──
    function getDb()    { return window.__db; }
    function getFb()    { return window.__fbFns; }
    function fbReady()  { return !!window.__fbReady && !!window.__db; }

    // ── localStorage fallback (للبيانات الثانوية مثل إحصائيات العداد) ──
    function lsGet(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
    }
    function lsSet(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
    }

    // ── notifyOtherTab: لا داعي مع Firebase (real-time) ──
    function notifyOtherTab(key) {
      // Firebase يتولى التزامن تلقائياً — لا شيء مطلوب هنا
    }

    // ── دوال Firebase المحورية ──

    async function fbSaveAppointment(appt) {
      if (!fbReady()) return;
      const { doc, setDoc, serverTimestamp } = getFb();
      appt.createdAt = appt.createdAt || Date.now();
      await setDoc(doc(getDb(), 'appointments', appt.id), appt);
    }

    async function fbUpdateAppointmentField(id, fields) {
      if (!fbReady()) return;
      const { doc, updateDoc } = getFb();
      await updateDoc(doc(getDb(), 'appointments', id), fields);
    }

    async function fbSavePatient(patient) {
      if (!fbReady()) return;
      const { doc, setDoc } = getFb();
      await setDoc(doc(getDb(), 'patients', patient.id), patient);
    }

    async function fbUpdatePatient(patientId, data) {
      if (!fbReady()) return;
      const { doc, updateDoc } = getFb();
      await updateDoc(doc(getDb(), 'patients', patientId), data);
    }

    async function fbDeletePatient(id) {
      if (!fbReady()) return;
      const { doc, deleteDoc } = getFb();
      await deleteDoc(doc(getDb(), 'patients', id));
    }

    async function fbSaveClosedDays(list) {
      if (!fbReady()) return;
      const { doc, setDoc } = getFb();
      await setDoc(doc(getDb(), 'settings', 'closedDays'), { days: list });
    }

    async function fbSaveSettings(s) {
      if (!fbReady()) return;
      const { doc, setDoc } = getFb();
      await setDoc(doc(getDb(), 'settings', 'appSettings'), s);
    }

    async function fbSendNurseAlert(payload) {
      if (!fbReady()) return;
      const { doc, setDoc } = getFb();
      await setDoc(doc(getDb(), 'settings', 'nurseAlert'), payload);
    }

    async function fbSaveNotes(notes) {
      if (!fbReady()) return;
      const { doc, setDoc } = getFb();
      await setDoc(doc(getDb(), 'settings', 'sharedNotes'), { notes });
    }

    // ================== Constants ==================
    const daysAr = ["الأحد","الإثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
    const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = toLocalISODate(today);
    const maxFutureDate = new Date(); maxFutureDate.setMonth(maxFutureDate.getMonth()+3); maxFutureDate.setHours(23,59,59,999);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30); thirtyDaysAgo.setHours(0,0,0,0);
    const thirtyDaysAgoStr = toLocalISODate(thirtyDaysAgo);

    let allRecords = [], allPatients = {}, closedDays = [];
    let currentDate = new Date(), selectedDayStr = todayStr, currentSection = 'appointments', appointmentsTab = 'pending';
    let searchQuery = '', patientSearchQuery = '', lastPendingCount = 0, lastAcceptedCount = 0;
    let dayDensity = {};
    let manualAppointmentData = { patientName:'', phone:'', birthDate:'', address:'', visitType:'', selectedDate:'', selectedSlot:'Morning', currentStep:1 };
    let visitManagementState = { patientId:null, patientName:'', patientPhone:'', patientBirthDate:'', patientAddress:'', currentStep:1, appointmentRecord:null, isAddedToPatients:false };
    let addVisitState = { patientId:null, patientName:'', patientPhone:'', patientBirthDate:'', patientAddress:'' };
    let deleteAppointmentId = null, currentChartPeriod = 'monthly';
    let settings = { title: 'لوحة الممرضة', logo: null };
    let currentArchiveTab = 'daily';

    // ================== Helpers ==================
    function toLocalISODate(date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
    function parseLocalISODate(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
    function normalizeDate(s) { if(!s) return ''; const [y,m,d]=(s+'').trim().substring(0,10).split('-').map(Number); if(!y||!m||!d) return (s+'').trim().substring(0,10); return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
    function formatDateAr(s) { if(!s) return '-'; const d=parseLocalISODate(normalizeDate(s)); return d.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'}); }
    function calculateAge(b) { if(!b) return null; const birth=new Date(b); let age=today.getFullYear()-birth.getFullYear(); const m=today.getMonth()-birth.getMonth(); if(m<0||(m===0&&today.getDate()<birth.getDate())) age--; return age; }
    function normalizePhone(p) { return (p||'').replace(/[^\d+]/g,''); }
    function escapeHtml(text) { const div=document.createElement('div'); div.textContent=text; return div.innerHTML; }

    function showToast(msg, type='info') {
      const toast=document.getElementById('toast');
      const content=document.getElementById('toastContent');
      const colors = { success: '#16a34a', error: '#dc2626', info: '#0d9488' };
      const icons  = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
      content.style.background = colors[type] || colors.info;
      content.style.color = 'white';
      content.className = '';
      content.innerHTML = `<i class="fas fa-${icons[type]||icons.info}"></i> ${msg}`;
      toast.classList.remove('hidden');
      setTimeout(()=>toast.classList.add('hidden'), 3000);
    }

    // ================== Firebase CRUD ==================
    function initializeFirebaseData() {
      // انتظار جاهزية Firebase
      function startListeners() {
        const db = getDb();
        const { collection, doc, onSnapshot, query } = getFb();

        // ── 1. Real-time listener: المواعيد ──
        onSnapshot(collection(db, 'appointments'), (snap) => {
          allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // تحويل تلقائي: Accepted وتاريخه انتهى → NoShow
          allRecords.forEach(r => {
            if (r.Status === 'Accepted') {
              const d = parseLocalISODate(normalizeDate(r.Date));
              if (d < today) {
                fbUpdateAppointmentField(r.id, { Status: 'NoShow' });
                r.Status = 'NoShow';
              }
            }
          });
          updateCounts(); calculateDensity(); renderCalendar();
          if (selectedDayStr) renderAgendaForDay(selectedDayStr);
          if (currentSection === 'appointments') renderBothAppointmentColumns();
        });

        // ── 2. Real-time listener: المرضى ──
        onSnapshot(collection(db, 'patients'), (snap) => {
          allPatients = {};
          snap.docs.forEach(d => { allPatients[d.id] = { id: d.id, ...d.data() }; });
          document.getElementById('totalPatientsCount').textContent = Object.keys(allPatients).length;
          if (currentSection === 'patients') renderPatientBook();
        });

        // ── 3. Real-time listener: الإعدادات (أيام مغلقة، إعدادات التطبيق، تنبيهات الدكتور) ──
        onSnapshot(collection(db, 'settings'), (snap) => {
          snap.docs.forEach(d => {
            const data = d.data();
            if (d.id === 'closedDays') {
              closedDays = data.days || [];
              renderCalendar();
              if (selectedDayStr) updateDayStatusBadge(selectedDayStr);
            }
            if (d.id === 'appSettings') {
              settings = data;
              applySettings();
            }
            if (d.id === 'nurseAlert') {
              // تنبيه من الدكتور — عرضه فوراً
              if (data?.type && data?.ts) {
                const lastSeen = parseInt(localStorage.getItem('lastAlertTs') || '0');
                if (data.ts > lastSeen) {
                  localStorage.setItem('lastAlertTs', data.ts);
                  window.showDoctorAlert(data.type);
                }
              }
            }
            if (d.id === 'sharedNotes') {
              if (document.getElementById('notesOverlay')?.style.display === 'flex') window.renderNotes();
            }
          });
        });
      }

      if (fbReady()) {
        startListeners();
      } else {
        document.addEventListener('firebase-ready', startListeners, { once: true });
      }
    }

    function saveAppointment(appointment) {
      appointment.id = appointment.id || ('appt_' + Date.now() + '_' + Math.random().toString(36).substr(2,6));
      fbSaveAppointment(appointment).catch(e => showToast('خطأ في الحفظ: ' + e.message, 'error'));
      // تحديث محلي فوري
      const idx = allRecords.findIndex(r => r.id === appointment.id);
      if (idx === -1) allRecords.push(appointment); else allRecords[idx] = appointment;
      showToast('تم الحفظ بنجاح','success');
      updateCounts(); calculateDensity(); renderCalendar();
      if (selectedDayStr) renderAgendaForDay(selectedDayStr);
      if (currentSection === 'appointments') renderBothAppointmentColumns();
    }
    function updateAppointmentStatus(id, status) {
      fbUpdateAppointmentField(id, { Status: status }).catch(e => showToast('خطأ في التحديث','error'));
      // تحديث محلي فوري
      const record = allRecords.find(r => r.id === id);
      if (record) {
        record.Status = status;
        showToast('تم تحديث الحالة','success');
        if (status==='Accepted') sendWhatsAppConfirmation(record.Phone,record.PatientName,record.Date,record.Slot,record.VisitType);
        else if (status==='Rejected') sendWhatsAppRejection(record.Phone,record.PatientName,record.Date);
        else if (status==='Cancelled') sendWhatsAppCancellation(record.Phone,record.PatientName,record.Date);
        updateCounts(); calculateDensity(); renderCalendar();
        if (selectedDayStr) renderAgendaForDay(selectedDayStr);
        if (currentSection === 'appointments') renderBothAppointmentColumns();
      }
    }
    function deleteAppointment(id) {
      fbUpdateAppointmentField(id, { Status: 'Cancelled' }).catch(e => showToast('خطأ في الإلغاء','error'));
      const record = allRecords.find(r => r.id === id);
      if (record) { record.Status = 'Cancelled'; }
      showToast('تم إلغاء الموعد','success');
      if (selectedDayStr) renderAgendaForDay(selectedDayStr);
    }
    function savePatient(patient) {
      const patientId = patient.id || ('p_'+Date.now()+'_'+Math.random().toString(36).substr(2,6));
      patient.id = patientId;
      fbSavePatient(patient).catch(e => showToast('خطأ في حفظ المريض','error'));
      allPatients[patientId] = patient;
      showToast('تمت إضافة المريض','success');
      document.getElementById('patientBookModal').classList.add('hidden');
      document.getElementById('totalPatientsCount').textContent = Object.keys(allPatients).length;
    }
    function updatePatient(patientId, updatedData) {
      fbUpdatePatient(patientId, updatedData).catch(e => showToast('خطأ في التحديث','error'));
      if (allPatients[patientId]) Object.assign(allPatients[patientId], updatedData);
      showToast('تم التحديث','success');
    }
    function deletePatient(id) {
      if(confirm('حذف المريض؟')) {
        fbDeletePatient(id).catch(e => showToast('خطأ في الحذف','error'));
        delete allPatients[id];
        showToast('تم الحذف','success');
        document.getElementById('totalPatientsCount').textContent = Object.keys(allPatients).length;
        if (currentSection === 'patients') renderPatientBook();
      }
    }
    function toggleDayClosed(dateStr, close) {
      const list = closedDays.slice();
      if (close) { if (!list.includes(dateStr)) list.push(dateStr); }
      else { const i=list.indexOf(dateStr); if(i>-1) list.splice(i,1); }
      fbSaveClosedDays(list).catch(e => showToast('خطأ في حفظ الأيام','error'));
      closedDays = list;
      renderCalendar();
      if (selectedDayStr) updateDayStatusBadge(selectedDayStr);
    }
    function saveSettingsToFirebase(newSettings) {
      fbSaveSettings(newSettings).catch(e => showToast('خطأ في حفظ الإعدادات','error'));
      showToast('تم حفظ الإعدادات','success');
    }

    // ================== WhatsApp ==================
    function sendWhatsAppConfirmation(phone,name,date,slot,type) { window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(`تم قبول موعدك ${formatDateAr(date)} ${slot==='Morning'?'صباحاً':'مساءً'}`)}`,'_blank'); }
    function sendWhatsAppRejection(phone,name,date) { window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(`نأسف، تم رفض موعدك ${formatDateAr(date)}`)}`,'_blank'); }
    function sendWhatsAppCancellation(phone,name,date) { window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(`تم إلغاء موعدك ${formatDateAr(date)}`)}`,'_blank'); }

    // ================== Settings ==================
    function applySettings() {
      document.getElementById('dashboardTitle').textContent = settings.title || 'لوحة الممرضة';
      const headerIcon = document.getElementById('headerLogoIcon');
      const headerImg  = document.getElementById('headerLogoImg');
      if (settings.logo) {
        headerIcon.classList.add('hidden');
        headerImg.src = settings.logo;
        headerImg.classList.remove('hidden');
      } else {
        headerIcon.classList.remove('hidden');
        headerImg.classList.add('hidden');
      }
    }
    function closeSettingsModal() { document.getElementById('settingsModal').classList.add('hidden'); }
    window.openSettingsModal = function() {
      document.getElementById('settingsTitleInput').value = settings.title || 'لوحة الممرضة';
      const previewImg  = document.getElementById('logoPreviewImg');
      const previewIcon = document.getElementById('logoPreviewIcon');
      const removeBtn   = document.getElementById('removeLogoBtn');
      if (settings.logo) {
        previewImg.src = settings.logo; previewImg.classList.remove('hidden');
        previewIcon.classList.add('hidden'); removeBtn.classList.remove('hidden');
      } else {
        previewImg.classList.add('hidden'); previewIcon.classList.remove('hidden'); removeBtn.classList.add('hidden');
      }
      document.getElementById('settingsModal').classList.remove('hidden');
    };
    function saveSettings() {
      const newTitle = document.getElementById('settingsTitleInput').value.trim();
      if (newTitle) settings.title = newTitle;
      saveSettingsToFirebase(settings);
      applySettings();
      closeSettingsModal();
    }
    window.removeLogo = function() {
      settings.logo = null;
      document.getElementById('logoPreviewImg').classList.add('hidden');
      document.getElementById('logoPreviewIcon').classList.remove('hidden');
      document.getElementById('removeLogoBtn').classList.add('hidden');
      document.getElementById('logoFileInput').value = '';
    };

    // ================== Day State ==================
    function isDayClosed(dateStr) { return closedDays.includes(dateStr); }
    function closeDay(dateStr) { toggleDayClosed(dateStr, true); }
    function openDay(dateStr) { toggleDayClosed(dateStr, false); }
    function updateDayStatusBadge(dateStr) {
      const badge=document.getElementById('dayStatusBadge');
      const closeIcon=document.getElementById('closeDayIcon');
      const openIcon=document.getElementById('openDayIcon');
      // Reset any custom inline styles from past-day display
      badge.style.background = '';
      badge.style.color = '';
      badge.style.border = '';
      if (isDayClosed(dateStr)) {
        badge.innerHTML='مغلق'; badge.className='day-status-badge closed';
        closeIcon.classList.add('hidden'); openIcon.classList.remove('hidden');
      } else {
        badge.innerHTML='مفتوح'; badge.className='day-status-badge open';
        closeIcon.classList.remove('hidden'); openIcon.classList.add('hidden');
      }
    }
    function updateCounts() {
      const pending  = allRecords.filter(r=>r.Status==='Pending').length;
      const accepted = allRecords.filter(r=>r.Status==='Accepted').length;
      document.getElementById('pendingTabCount').textContent  = pending;
      document.getElementById('acceptedTabCount').textContent = accepted;
      lastPendingCount = pending; lastAcceptedCount = accepted;
    }
    function calculateDensity() {
      dayDensity = {};
      allRecords.filter(r=>r.Status==='Accepted'||r.Status==='Visited'||r.Status==='NoShow').forEach(r=>{ const nd=normalizeDate(r.Date); dayDensity[nd]=(dayDensity[nd]||0)+1; });
    }

    // ================== Navigation ==================
    function setActiveSection(section, skipApptContent) {
      currentSection = section;
      document.querySelectorAll('.sidebar-item, .bottom-nav-item').forEach(el=>el.classList.remove('active'));
      const sectionMap = {
        appointments: ['sidebarAppointments','mobileAppointments','appointmentsSection'],
        patients:     ['sidebarPatients','mobilePatients','patientBookSection'],
        calendar:     ['sidebarCalendar','mobileCalendar','calendarSection'],

      };
      const allSections = ['appointmentsSection','patientBookSection','calendarSection'];
      allSections.forEach(s=>document.getElementById(s)?.classList.add('hidden'));
      const [side, mob, sec] = sectionMap[section] || [];
      document.getElementById(side)?.classList.add('active');
      document.getElementById(mob)?.classList.add('active');
      document.getElementById(sec)?.classList.remove('hidden');
      if (section==='appointments' && !skipApptContent) renderBothAppointmentColumns();
      if (section==='patients')     renderPatientBook();
      if (section==='calendar') { renderCalendar(); renderAgendaForDay(selectedDayStr); updateDayStatusBadge(selectedDayStr); }
    }
    window.goToManualForm = function() {
      if (window.innerWidth >= 768) {
        // Desktop: open floating overlay, don't switch sections
        openManualFormOverlay();
      } else {
        // Mobile: original behavior
        setActiveSection('appointments');
        setAppointmentsTab('manual');
      }
    };
    window.goToToday = function() {
      currentDate = new Date(today); selectedDayStr = todayStr;
      setActiveSection('calendar');
      renderCalendar(); renderAgendaForDay(todayStr); updateDayStatusBadge(todayStr);
    };
    function setAppointmentsTab(tab) {
      appointmentsTab = tab;
      // Dual view is always shown — tab logic only for mobile manual form
      if (tab === 'manual') {
        setActiveSection('appointments');
        openManualFormOverlay();
      } else {
        renderBothAppointmentColumns();
      }
    }

    // ================== Appointments ==================
    // ====== Appointments Sub-Nav ======
    let apptSubOpen = false;
    let activeApptTab = null; // null = لا شيء مختار

    window.toggleApptSubNav = function() {
      // Sidebar
      const sidebarSub  = document.getElementById('sidebarApptSub');
      const sidebarItem = document.getElementById('sidebarAppointments');
      if (sidebarSub)  sidebarSub.classList.toggle('open');
      if (sidebarItem) sidebarItem.classList.toggle('sub-open');
      // إظهار appointmentsSection مع pending فوراً
      if (!activeApptTab) activeApptTab = 'pending';
      setActiveSection('appointments', true);
      renderBothAppointmentColumns();
      switchApptTab(activeApptTab);
    };

    window.selectApptSub = function(tab) {
      activeApptTab = tab;
      apptSubOpen = false;
      // أغلق sub-nav
      const sidebarSub  = document.getElementById('sidebarApptSub');
      const sidebarItem = document.getElementById('sidebarAppointments');
      const mobSub      = document.getElementById('mobApptSubNav');
      if (sidebarSub)  sidebarSub.classList.remove('open');
      if (sidebarItem) sidebarItem.classList.remove('sub-open');
      if (mobSub)      mobSub.classList.remove('open');
      // Active states
      ['subPending','subAccepted','mobSubPending','mobSubAccepted'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
      });
      if (tab === 'pending') {
        document.getElementById('subPending')?.classList.add('active');
        document.getElementById('mobSubPending')?.classList.add('active');
      } else {
        document.getElementById('subAccepted')?.classList.add('active');
        document.getElementById('mobSubAccepted')?.classList.add('active');
      }
      // Sidebar item active
      if (sidebarItem) sidebarItem.classList.add('active');
      document.getElementById('mobileAppointments')?.classList.add('active');
      // أظهر القسم + render + الكارت الصح
      setActiveSection('appointments', true);
      renderBothAppointmentColumns();
      switchApptTab(tab);
    };

    // setActiveSection بدون إظهار محتوى (للـ sub-nav)
    function setActiveSectionNoContent() {
      setActiveSection('appointments', true); // skipApptContent=true
    }

    window.switchApptTab = function(tab) {
      const pendingCol  = document.querySelector('#appointmentsDualView .glass-card:nth-child(1)');
      const acceptedCol = document.querySelector('#appointmentsDualView .glass-card:nth-child(2)');
      if (tab === 'pending') {
        if (pendingCol)  pendingCol.classList.add('active');
        if (acceptedCol) acceptedCol.classList.remove('active');
      } else {
        if (pendingCol)  pendingCol.classList.remove('active');
        if (acceptedCol) acceptedCol.classList.add('active');
      }
      // Update inline tab bar
      const btnP = document.getElementById('apptTabBtnPending');
      const btnA = document.getElementById('apptTabBtnAccepted');
      const bdgP = document.getElementById('apptBadgePending');
      const bdgA = document.getElementById('apptBadgeAccepted');
      const BASE = 'flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:50px;border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:.82rem;transition:all .22s;';
      if (btnP && btnA) {
        if (tab === 'pending') {
          btnP.style.cssText = BASE + 'background:var(--primary);color:white;box-shadow:0 2px 12px rgba(13,148,136,.3);';
          btnA.style.cssText = BASE + 'background:transparent;color:var(--text-muted);';
          if (bdgP) { bdgP.style.background='rgba(255,255,255,.25)'; bdgP.style.color='white'; }
          if (bdgA) { bdgA.style.background='var(--border)'; bdgA.style.color='var(--text-muted)'; }
        } else {
          btnA.style.cssText = BASE + 'background:var(--primary);color:white;box-shadow:0 2px 12px rgba(13,148,136,.3);';
          btnP.style.cssText = BASE + 'background:transparent;color:var(--text-muted);';
          if (bdgA) { bdgA.style.background='rgba(255,255,255,.25)'; bdgA.style.color='white'; }
          if (bdgP) { bdgP.style.background='var(--border)'; bdgP.style.color='var(--text-muted)'; }
        }
      }
    };

    function applyActiveTab() {
      const pendingCol  = document.querySelector('#appointmentsDualView .glass-card:nth-child(1)');
      const acceptedCol = document.querySelector('#appointmentsDualView .glass-card:nth-child(2)');
      if (activeApptTab) {
        switchApptTab(activeApptTab);
      } else {
        // لا اختيار → أخفِ الكارتين
        if (pendingCol)  pendingCol.classList.remove('active');
        if (acceptedCol) acceptedCol.classList.remove('active');
      }
    }

    function renderAppointmentsView() {
      renderBothAppointmentColumns();
      applyActiveTab();
    }

    function renderBothAppointmentColumns() {
      const pendingContainer  = document.getElementById('pendingCardsContainer');
      const acceptedContainer = document.getElementById('acceptedCardsContainer');
      if (!pendingContainer || !acceptedContainer) return;

      // --- Pending ---
      let pending = allRecords.filter(r=>r.Status==='Pending').sort((a,b)=>(b.Date||'').localeCompare(a.Date||''));
      document.getElementById('pendingTabCount').textContent = pending.length;
      const bdgP = document.getElementById('apptBadgePending');
      if (bdgP) bdgP.textContent = pending.length;
      ['subBadgePending','mobSubBadgePending'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=pending.length; });
      pendingContainer.innerHTML = pending.length
        ? pending.map(r=>appointmentCardHTML(r,'Pending')).join('')
        : `<div style="text-align:center; padding:28px; color:var(--text-muted);">
            <i class="fas fa-check-circle" style="font-size:2rem; display:block; margin-bottom:8px; opacity:.4; color:var(--green);"></i>
            لا توجد طلبات جديدة</div>`;

      // --- Accepted --- (اليوم والمستقبل فقط)
      let accepted = allRecords.filter(r=>r.Status==='Accepted' && parseLocalISODate(normalizeDate(r.Date)) >= today).sort((a,b)=>(a.Date||'').localeCompare(b.Date||''));
      document.getElementById('acceptedTabCount').textContent = accepted.length;
      const bdgA = document.getElementById('apptBadgeAccepted');
      if (bdgA) bdgA.textContent = accepted.length;
      ['subBadgeAccepted','mobSubBadgeAccepted'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=accepted.length; });
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        accepted = accepted.filter(r=>(r.PatientName||'').toLowerCase().includes(q)||(r.Phone||'').includes(q)||(r.Date||'').includes(q));
      }
      acceptedContainer.innerHTML = accepted.length
        ? accepted.map(r=>appointmentCardHTML(r,'Accepted')).join('')
        : `<div style="text-align:center; padding:28px; color:var(--text-muted);">
            <i class="fas fa-calendar-xmark" style="font-size:2rem; display:block; margin-bottom:8px; opacity:.4;"></i>
            لا توجد مواعيد مؤكدة</div>`;
    }

    // Lucide-style inline SVG helpers for appointment cards
    const ICON = {
      phone: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.43 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
      whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`,
      check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      x: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      eye: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
      trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
      stethoscope: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
      calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      clock: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      tag: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    };

    function appointmentCardHTML(record, status) {
      const phone = normalizePhone(record.Phone);
      const visitType = record.VisitType||'غير محدد';
      const date = formatDateAr(record.Date);
      const slot = record.Slot==='Morning'?'صباحاً':(record.Slot==='Evening'?'مساءً':'غير معلوم');
      if (status==='Pending') {
        return `<div class="appt-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <p style="font-weight:700; font-size:1rem;">${escapeHtml(record.PatientName)}</p>
              <p style="font-size:.78rem; color:var(--primary); margin-top:3px;">${escapeHtml(record.Phone)}</p>
            </div>
            <div style="display:flex; gap:6px;">
              <a href="tel:${phone}" class="action-btn-small call-btn" title="اتصال">${ICON.phone}</a>
              <a href="https://wa.me/${phone}" target="_blank" class="action-btn-small whatsapp-btn" title="واتساب">${ICON.whatsapp}</a>
            </div>
          </div>
          <div style="font-size:.82rem; display:flex; flex-direction:column; gap:6px;">
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.tag}</span><span style="color:var(--text-muted);">نوع الزيارة:</span> <strong>${visitType}</strong></p>
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.calendar}</span><span style="color:var(--text-muted);">التاريخ:</span> <strong>${date}</strong></p>
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.clock}</span><span style="color:var(--text-muted);">الفترة:</span> <strong>${slot}</strong></p>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px;">
            <button class="appt-card-btn appt-card-btn--accept" onclick="acceptAppointment('${record.id}')">${ICON.check} قبول</button>
            <button class="appt-card-btn appt-card-btn--reject" onclick="rejectAppointment('${record.id}')">${ICON.x} رفض</button>
            <button class="appt-card-btn appt-card-btn--details" onclick="openModalById('${record.id}')">${ICON.eye} تفاصيل</button>
          </div>
        </div>`;
      } else {
        return `<div class="appt-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <p style="font-weight:700; font-size:1rem;">${escapeHtml(record.PatientName)}</p>
              <p style="font-size:.78rem; color:var(--primary); margin-top:3px;">${escapeHtml(record.Phone)}</p>
            </div>
            <div style="display:flex; gap:6px;">
              <a href="tel:${phone}" class="action-btn-small call-btn" title="اتصال">${ICON.phone}</a>
              <a href="https://wa.me/${phone}" target="_blank" class="action-btn-small whatsapp-btn" title="واتساب">${ICON.whatsapp}</a>
            </div>
          </div>
          <div style="font-size:.82rem; display:flex; flex-direction:column; gap:6px;">
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.tag}</span><span style="color:var(--text-muted);">نوع الزيارة:</span> <strong>${visitType}</strong></p>
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.calendar}</span><span style="color:var(--text-muted);">التاريخ:</span> <strong>${date}</strong></p>
            <p style="display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);opacity:.7;">${ICON.clock}</span><span style="color:var(--text-muted);">الفترة:</span> <strong>${slot}</strong></p>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px;">
            <button class="appt-card-btn appt-card-btn--details" onclick="openModalById('${record.id}')">${ICON.eye} تفاصيل</button>
            <button class="appt-card-btn appt-card-btn--cancel" onclick="cancelAppointment('${record.id}')">${ICON.trash} إلغاء</button>
          </div>
        </div>`;
      }
    }

    function acceptAppointment(id) { if(confirm('قبول الموعد؟')) updateAppointmentStatus(id,'Accepted'); }
    function rejectAppointment(id)  { if(confirm('رفض الطلب؟'))  updateAppointmentStatus(id,'Rejected'); }
    function cancelAppointment(id)  { if(confirm('إلغاء الموعد؟')) updateAppointmentStatus(id,'Cancelled'); }

    // ================== Patients ==================
    function renderPatientBook() {
      const grid = document.getElementById('patientsGrid');
      let patients = Object.values(allPatients);
      if (patientSearchQuery.trim()) {
        const q = patientSearchQuery.toLowerCase();
        patients = patients.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.phone||'').includes(q));
      }
      if (!patients.length) {
        grid.innerHTML = '<div style="grid-column:span 2;text-align:center;padding:32px;color:var(--text-muted);"><i class="fas fa-user-slash" style="font-size:2rem;display:block;margin-bottom:10px;opacity:.4;"></i>لا يوجد مرضى</div>';
        return;
      }
      grid.innerHTML = patients.map(p=>{
        const phone = normalizePhone(p.phone);
        return `<div class="patient-card">
          <div class="patient-name">${escapeHtml(p.name)}</div>
          <div class="patient-phone"><i class="fas fa-phone"></i>${escapeHtml(p.phone)}</div>
          <div style="font-size:.75rem; color:var(--primary); margin-top:4px; font-weight:600;">${p.totalVisits||0} زيارة</div>
          <div class="patient-actions">
            <button class="patient-action-btn primary" onclick="openAddVisitModal('${p.id}','${escapeHtml(p.name)}','${escapeHtml(p.phone)}','${p.birthDate||''}','${escapeHtml(p.address||'')}')"><i class="fas fa-plus"></i> زيارة</button>
            <button class="patient-action-btn secondary" onclick="openPatientDetailsModal('${p.id}')"><i class="fas fa-eye"></i> تفاصيل</button>
            <button class="patient-action-btn danger" onclick="deletePatient('${p.id}')"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>`;
      }).join('');
    }

    function openPatientDetailsModal(patientId) {
      const p = allPatients[patientId]; if(!p) return;
      document.getElementById('modalPatientName').textContent       = p.name;
      document.getElementById('modalPatientPhone').textContent      = p.phone;
      document.getElementById('modalPatientBirthDate').textContent  = p.birthDate ? formatDateAr(p.birthDate) : '-';
      const age = p.birthDate ? calculateAge(p.birthDate) : '-';
      document.getElementById('modalPatientAge').textContent        = age!=='-' ? age+' سنة' : '-';
      document.getElementById('modalPatientTotalVisits').textContent= p.totalVisits||0;
      document.getElementById('modalPatientAddress').textContent    = p.address||'-';
      document.getElementById('modalWhatsappBtn').href = `https://wa.me/${normalizePhone(p.phone)}`;
      document.getElementById('modalCallBtn').href     = `tel:${normalizePhone(p.phone)}`;
      const visits = (p.appointments||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      let html = visits.map((v,i)=>`<tr>
        <td style="padding:7px 8px; border-bottom:1px solid var(--bg);">${i+1}</td>
        <td style="padding:7px 8px; border-bottom:1px solid var(--bg);">${formatDateAr(v.date)}</td>
        <td style="padding:7px 8px; border-bottom:1px solid var(--bg);">${v.visitType||'-'}</td>
        <td style="padding:7px 8px; border-bottom:1px solid var(--bg);">${v.slot==='Morning'?'صباحاً':(v.slot==='Evening'?'مساءً':'غير معلوم')}</td>
        <td style="padding:7px 8px; border-bottom:1px solid var(--bg);">${v.durationStr ? '<span style="color:var(--primary);font-weight:700;">'+v.durationStr+'</span>' : '<span style="color:var(--text-muted);font-size:.75rem;">—</span>'}</td>
      </tr>`).join('');
      if(!visits.length) html='<tr><td colspan="4" style="text-align:center;padding:12px;color:var(--text-muted);">لا توجد زيارات</td></tr>';
      document.getElementById('modalVisitsTableBody').innerHTML = html;
      document.getElementById('patientDetailsModal').dataset.patientId = patientId;
      document.getElementById('patientDetailsModal').classList.remove('hidden');
    }
    window.closePatientDetailsModal = function() { document.getElementById('patientDetailsModal').classList.add('hidden'); };

    function openAddVisitModal(patientId,name,phone,birthDate,address) {
      addVisitState = { patientId, patientName:name, patientPhone:phone, patientBirthDate:birthDate, patientAddress:address };
      document.getElementById('addVisitPatientName').textContent = name;
      document.getElementById('addVisitDate').value  = todayStr;
      document.getElementById('addVisitSlot').value  = 'Morning';
      document.getElementById('addVisitModal').classList.remove('hidden');
    }
    window.openAddVisitModalFromModal = function() {
      const patientId = document.getElementById('patientDetailsModal').dataset.patientId;
      const p = allPatients[patientId];
      if(p) { openAddVisitModal(patientId,p.name,p.phone,p.birthDate,p.address); closePatientDetailsModal(); }
    };
    function submitAddVisit() {
      const p = allPatients[addVisitState.patientId]; if(!p) return;
      const type      = document.getElementById('addVisitType').value;
      const visitDate = document.getElementById('addVisitDate').value;
      const slot      = document.getElementById('addVisitSlot').value;
      if(!type)      { showToast('اختر نوع الزيارة','error'); return; }
      if(!visitDate) { showToast('اختر تاريخ الزيارة','error'); return; }
      if(!p.appointments) p.appointments=[];
      p.appointments.push({ date:visitDate, slot, visitType:type, dayName:daysAr[parseLocalISODate(visitDate).getDay()] });
      p.totalVisits = p.appointments.length;
      p.lastVisit   = visitDate;
      updatePatient(p.id, p);
      document.getElementById('addVisitModal').classList.add('hidden');
      showToast('تمت إضافة الزيارة','success');
    }

    function showVisitStep(step) {
      document.getElementById('visitStep1').style.display = step===1 ? 'flex' : 'none';
      document.getElementById('visitStep2').style.display = step===2 ? 'flex' : 'none';
      document.getElementById('visitStep3').style.display = step===3 ? 'flex' : 'none';
    }

    window.openVisitManagement = function(record) {
      visitManagementState = { patientId:null, patientName:record.PatientName, patientPhone:record.Phone, patientBirthDate:record.BirthDate, patientAddress:record.Address||'', currentStep:1, appointmentRecord:record, isAddedToPatients:false };
      document.getElementById('visitManagementPatientName').textContent = record.PatientName;
      document.getElementById('visitNewPatientName').value = record.PatientName;
      document.getElementById('visitNewPatientPhone').value = record.Phone;
      document.getElementById('visitNewPatientBirthDate').value = record.BirthDate||'';
      document.getElementById('visitNewPatientAddress').value = record.Address||'';
      document.getElementById('visitNewPatientDate').value = record.Date || todayStr;
      document.getElementById('visitNewPatientSlot').value = record.Slot || 'Morning';
      document.getElementById('existingPatientDate').value = record.Date || todayStr;
      document.getElementById('existingPatientSlot').value = record.Slot || 'Morning';
      document.getElementById('visitManagementModal').classList.remove('hidden');
      showVisitStep(1);
    };

    document.getElementById('firstVisitYes').addEventListener('click', ()=>{ showVisitStep(2); });

    document.getElementById('firstVisitNo').addEventListener('click', ()=>{
      document.getElementById('patientSearchInput').value = '';
      document.getElementById('patientSearchResults').innerHTML = '';
      showSearchView();
      showVisitStep(3);
    });

    document.getElementById('backToVisitStep1FromNew').addEventListener('click', ()=>{ showVisitStep(1); });

    document.getElementById('backToVisitStep1FromSearch').addEventListener('click', ()=>{ showVisitStep(1); });

    function showSearchView() {
      document.getElementById('patientSearchView').style.display = 'flex';
      document.getElementById('patientSearchView').style.flexDirection = 'column';
      document.getElementById('selectedPatientView').style.display = 'none';
      selectedVisitPatientId = null;
    }

    function showPatientDetailsView() {
      document.getElementById('patientSearchView').style.display = 'none';
      document.getElementById('selectedPatientView').style.display = 'flex';
      document.getElementById('selectedPatientView').style.flexDirection = 'column';
    }

    let selectedVisitPatientId = null;

    document.getElementById('patientSearchInput').addEventListener('input', (e)=>{
      const term = e.target.value.toLowerCase().trim();
      selectedVisitPatientId = null;
      if(!term) { document.getElementById('patientSearchResults').innerHTML=''; return; }
      const matches = Object.values(allPatients).filter(p=> p.name.toLowerCase().includes(term) || p.phone.includes(term));
      document.getElementById('patientSearchResults').innerHTML = matches.map(p=>`
        <div onclick="previewPatientForVisit('${p.id}')" style="padding:10px; background:var(--bg); border:1.5px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; transition:all .15s;" onmouseover="this.style.background='var(--primary-light)';this.style.borderColor='var(--primary)'" onmouseout="this.style.background='var(--bg)';this.style.borderColor='var(--border)'">
          <p style="font-weight:700; color:var(--text);">${escapeHtml(p.name)}</p>
          <p style="font-size:.75rem; color:var(--text-muted);">${escapeHtml(p.phone)}</p>
        </div>
      `).join('');
    });

    window.previewPatientForVisit = function(patientId) {
      const p = allPatients[patientId]; if(!p) return;
      selectedVisitPatientId = patientId;
      // Calculate age
      let ageStr = '-';
      if(p.birthDate) {
        const bd = parseLocalISODate(p.birthDate);
        const now = new Date();
        let age = now.getFullYear() - bd.getFullYear();
        if(now.getMonth() < bd.getMonth() || (now.getMonth()===bd.getMonth() && now.getDate()<bd.getDate())) age--;
        ageStr = age + ' سنة';
      }
      // Get first visit from appointments array
      let firstVisitStr = '-';
      if(p.firstVisit) {
        firstVisitStr = formatDateAr(p.firstVisit);
      } else if(p.appointments && p.appointments.length) {
        const sorted = [...p.appointments].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
        firstVisitStr = formatDateAr(sorted[0].date);
      }
      document.getElementById('selPatientName').textContent = p.name;
      document.getElementById('selPatientPhone').textContent = p.phone || '-';
      document.getElementById('selPatientAge').textContent = ageStr;
      document.getElementById('selPatientAddress').textContent = p.address || '-';
      document.getElementById('selPatientFirstVisit').textContent = firstVisitStr;
      document.getElementById('selPatientLastVisit').textContent = p.lastVisit ? formatDateAr(p.lastVisit) : 'لا توجد';
      document.getElementById('selPatientTotalVisits').textContent = (p.totalVisits || (p.appointments||[]).length || 0) + ' زيارة';
      showPatientDetailsView();
    };

    document.getElementById('submitExistingPatientVisit').addEventListener('click', ()=>{
      if(!selectedVisitPatientId) { showToast('اختر مريضاً من نتائج البحث أعلاه', 'info'); return; }
      selectPatientForVisit(selectedVisitPatientId);
    });

    function submitNewPatientVisit() {
      const name = document.getElementById('visitNewPatientName').value.trim();
      const phone = document.getElementById('visitNewPatientPhone').value.trim();
      const birth = document.getElementById('visitNewPatientBirthDate').value;
      const addr = document.getElementById('visitNewPatientAddress').value.trim();
      const type = document.getElementById('visitNewPatientVisitType').value;
      const slot = document.getElementById('visitNewPatientSlot').value;
      if(!name || !phone || !birth || !type) { showToast('املأ البيانات الأساسية','error'); return; }
      const visitDate = document.getElementById('visitNewPatientDate').value || todayStr;
      const patientId = 'p_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);
      const newPatient = {
        id:patientId, name, phone, birthDate:birth, address:addr,
        appointments:[{ date:visitDate, slot:slot, visitType:type, dayName:daysAr[parseLocalISODate(visitDate).getDay()] }],
        firstVisit:visitDate, lastVisit:visitDate, totalVisits:1
      };
      // حفظ المريض الجديد في Firebase
      const patients = Object.assign({}, allPatients);
      patients[patientId] = newPatient;
      fbSavePatient(newPatient).catch(e => console.error('Firebase patient save:', e));
      allPatients = patients;
      // تغيير حالة الموعد إلى "InProgress" (الزيارة جارية - لم تنتهِ بعد)
      const apptId = visitManagementState.appointmentRecord?.id;
      if(apptId) {
        const fields = { Status: 'InProgress', visitStartTime: Date.now(), linkedPatientId: patientId };
        fbUpdateAppointmentField(apptId, fields).catch(e => console.error('Firebase appt update:', e));
        const rec = allRecords.find(r => r.id === apptId);
        if(rec) { Object.assign(rec, fields); allRecords = allRecords.slice(); }
        // بدء العداد تلقائياً
        startVisitTimerAuto(apptId, patientId, visitDate);
      }
      document.getElementById('visitManagementModal').classList.add('hidden');
      showToast('تم نقل المريض إلى دفتر المرضى — العداد يعمل','success');
      updateCounts(); calculateDensity(); renderCalendar();
      if(selectedDayStr) renderAgendaForDay(selectedDayStr);
      if(currentSection === 'appointments') renderBothAppointmentColumns();
      setActiveSection('patients');
    }

    document.getElementById('submitNewPatientVisit').addEventListener('click', submitNewPatientVisit);

    window.selectPatientForVisit = function(patientId) {
      const p = allPatients[patientId]; if(!p) return;
      const visitDate = document.getElementById('existingPatientDate').value || todayStr;
      const slot = document.getElementById('existingPatientSlot').value || 'Morning';
      const type = visitManagementState.appointmentRecord?.VisitType || document.getElementById('visitNewPatientVisitType').value || 'مراجعة';
      p.appointments = p.appointments || [];
      p.appointments.push({ date:visitDate, slot:slot, visitType:type, dayName:daysAr[parseLocalISODate(visitDate).getDay()] });
      p.totalVisits = p.appointments.length;
      p.lastVisit = visitDate;
      // تحديث المريض في Firebase
      updatePatient(p.id, p);
      // تغيير حالة الموعد إلى "InProgress" (الزيارة جارية - لم تنتهِ بعد)
      const apptId2 = visitManagementState.appointmentRecord?.id;
      if(apptId2) {
        const fields2 = { Status: 'InProgress', visitStartTime: Date.now(), linkedPatientId: patientId };
        fbUpdateAppointmentField(apptId2, fields2).catch(e => console.error('Firebase appt update:', e));
        const rec2 = allRecords.find(r => r.id === apptId2);
        if(rec2) { Object.assign(rec2, fields2); }
        // بدء العداد تلقائياً
        startVisitTimerAuto(apptId2, patientId, visitDate);
      }
      document.getElementById('visitManagementModal').classList.add('hidden');
      showToast('تمت إضافة الزيارة للمريض — العداد يعمل','success');
      updateCounts(); calculateDensity(); renderCalendar();
      if(selectedDayStr) renderAgendaForDay(selectedDayStr);
      if(currentSection === 'appointments') renderBothAppointmentColumns();
      setActiveSection('patients');
    };

    // ================== Calendar ==================
    function renderCalendar() {
      const grid = document.getElementById('calendarGrid'); if(!grid) return;
      grid.innerHTML = '';
      const year=currentDate.getFullYear(), month=currentDate.getMonth();
      document.getElementById('currentMonth').textContent = `${monthsAr[month]} ${year}`;
      const firstDay = new Date(year,month,1).getDay();
      const daysInMonth = new Date(year,month+1,0).getDate();
      let startOffset = (firstDay+2)%7;
      for(let i=startOffset-1;i>=0;i--) {
        const d=document.createElement('div'); d.className='compact-calendar-day other-month'; d.textContent=''; grid.appendChild(d);
      }
      for(let d=1;d<=daysInMonth;d++) {
        const dateObj=new Date(year,month,d); dateObj.setHours(0,0,0,0);
        const dateStr=toLocalISODate(dateObj);
        const dayDiv=document.createElement('div'); dayDiv.className='compact-calendar-day'; dayDiv.textContent=d;
        if(dateObj < today) {
          dayDiv.classList.add('past-day');
          if(selectedDayStr===dateStr) dayDiv.classList.add('selected');
          dayDiv.style.cursor = 'pointer';
          dayDiv.addEventListener('click', ()=> {
            selectedDayStr = dateStr;
            renderCalendar();
            renderAgendaForDay(dateStr);
            updateDayStatusBadge(dateStr);
            document.getElementById('dayAgenda').classList.remove('hidden');
          });
        }
        else {
          if(dateObj.getTime()===today.getTime()) dayDiv.classList.add('today');
          if(selectedDayStr===dateStr) dayDiv.classList.add('selected');
          dayDiv.addEventListener('click',()=>selectDay(dateStr));
          const count=dayDensity[dateStr]||0;
          if(count>0) {
            const dot=document.createElement('div'); dot.className='compact-appointment-dot';
            if(count<=2) dot.classList.add('compact-dot-low');
            else if(count<=4) dot.classList.add('compact-dot-medium');
            else dot.classList.add('compact-dot-high');
            dayDiv.appendChild(dot);
          }
          if(isDayClosed(dateStr)) dayDiv.classList.add('closed-day');
        }
        grid.appendChild(dayDiv);
      }
    }
    function selectDay(dateStr) {
      selectedDayStr=dateStr; renderCalendar(); renderAgendaForDay(dateStr); updateDayStatusBadge(dateStr);
      document.getElementById('dayAgenda').classList.remove('hidden');
    }
    function getPastDayVisits(dateStr) {
      let visits = [];
      Object.values(allPatients).forEach(p => {
        (p.appointments || []).forEach(v => {
          const vDate = (v.date || v.Date || '').toString().trim().substring(0, 10);
          if (vDate === dateStr) {
            visits.push({
              patientName: p.name || p.PatientName || '',
              phone: p.phone || p.Phone || '',
              slot: v.slot || v.Slot || 'Morning',
              visitType: v.visitType || v.VisitType || '-'
            });
          }
        });
      });
      return visits;
    }
    function renderAgendaForDay(dateStr) {
      const isPast = parseLocalISODate(dateStr) < today;
      document.getElementById('agendaTitle').textContent = `${daysAr[parseLocalISODate(dateStr).getDay()]} — ${formatDateAr(dateStr)}`;

      if (isPast) {
        const visits      = getPastDayVisits(dateStr);
        const noShow      = allRecords.filter(r => r.Status === 'NoShow'    && normalizeDate(r.Date) === dateStr);
        const cancelledRec= allRecords.filter(r => (r.Status === 'Cancelled' || r.Status === 'Rejected') && normalizeDate(r.Date) === dateStr);
        const morning     = visits.filter(v => (v.slot || '').toLowerCase() !== 'evening');
        const evening     = visits.filter(v => (v.slot || '').toLowerCase() === 'evening');
        const noShowMorn  = noShow.filter(r => (r.Slot || 'Morning') === 'Morning');
        const noShowEve   = noShow.filter(r =>  r.Slot === 'Evening');
        const cancelMorn  = cancelledRec.filter(r => (r.Slot || 'Morning') === 'Morning');
        const cancelEve   = cancelledRec.filter(r =>  r.Slot === 'Evening');

        document.getElementById('agendaCount').textContent =
          `زيارات: ${visits.length}${noShow.length ? ' · لم يحضر: ' + noShow.length : ''}${cancelledRec.length ? ' · ملغاة: ' + cancelledRec.length : ''}`;
        document.getElementById('agendaMorningCount').textContent = morning.length + noShowMorn.length + cancelMorn.length;
        document.getElementById('agendaEveningCount').textContent = evening.length + noShowEve.length + cancelEve.length;
        document.getElementById('closeDayIcon').classList.add('hidden');
        document.getElementById('openDayIcon').classList.add('hidden');

        const badge = document.getElementById('dayStatusBadge');
        badge.style.cssText = 'background:var(--bg);color:var(--text-muted);border:1px solid var(--border);';
        badge.className = 'day-status-badge';
        badge.innerHTML = `<i class="fas fa-history" style="margin-left:4px;font-size:.75rem;"></i> سابق`;

        const pastCard = (v) => `
          <div class="agenda-card" style="border-color:#86efac; background:#f0fdf4; opacity:.85;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(v.patientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(v.phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#dcfce7;color:#16a34a;border:1px solid #86efac;">
                <i class="fas fa-check-circle" style="margin-left:3px;font-size:.65rem;"></i>تمت الزيارة
              </span>
            </div>
          </div>`;
        const noShowCard = (r) => `
          <div class="agenda-card" style="border-color:#fca5a5; background:#fef2f2; opacity:.85;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(r.PatientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(r.Phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;">
                <i class="fas fa-user-times" style="margin-left:3px;font-size:.65rem;"></i>لم يحضر
              </span>
            </div>
          </div>`;
        const cancelCard = (r) => `
          <div class="agenda-card" style="border-color:#fca5a5; background:#fef2f2; opacity:.85;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(r.PatientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(r.Phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;">
                <i class="fas fa-ban" style="margin-left:3px;font-size:.65rem;"></i>تم الإلغاء
              </span>
            </div>
          </div>`;
        const emptyMsg = (slot) => `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.82rem;">لا توجد مواعيد ${slot}</div>`;
        document.getElementById('agendaMorning').innerHTML =
          (morning.length    ? morning.map(pastCard).join('')   : '') +
          (noShowMorn.length ? noShowMorn.map(noShowCard).join('') : '') +
          (cancelMorn.length ? cancelMorn.map(cancelCard).join('') : '') +
          (!morning.length && !noShowMorn.length && !cancelMorn.length ? emptyMsg('صباحية') : '');
        document.getElementById('agendaEvening').innerHTML =
          (evening.length   ? evening.map(pastCard).join('')   : '') +
          (noShowEve.length ? noShowEve.map(noShowCard).join('') : '') +
          (cancelEve.length ? cancelEve.map(cancelCard).join('') : '') +
          (!evening.length && !noShowEve.length && !cancelEve.length ? emptyMsg('مسائية') : '');

      } else {
        const accepted    = allRecords.filter(r => r.Status === 'Accepted'   && normalizeDate(r.Date) === dateStr);
        const inProgress  = allRecords.filter(r => r.Status === 'InProgress' && normalizeDate(r.Date) === dateStr);
        const visited     = allRecords.filter(r => r.Status === 'Visited'    && normalizeDate(r.Date) === dateStr);
        const cancelled   = allRecords.filter(r => (r.Status === 'Cancelled' || r.Status === 'Rejected') && normalizeDate(r.Date) === dateStr);
        const morning          = accepted.filter(r    => (r.Slot || 'Morning') === 'Morning');
        const evening          = accepted.filter(r    =>  r.Slot === 'Evening');
        const inProgMorning    = inProgress.filter(r  => (r.Slot || 'Morning') === 'Morning');
        const inProgEvening    = inProgress.filter(r  =>  r.Slot === 'Evening');
        const visitedMorning   = visited.filter(r     => (r.Slot || 'Morning') === 'Morning');
        const visitedEvening   = visited.filter(r     =>  r.Slot === 'Evening');
        const cancelMorning    = cancelled.filter(r   => (r.Slot || 'Morning') === 'Morning');
        const cancelEvening    = cancelled.filter(r   =>  r.Slot === 'Evening');
        const totalAll = accepted.length + inProgress.length + visited.length + cancelled.length;
        document.getElementById('agendaCount').textContent =
          `مواعيد: ${accepted.length + inProgress.length + visited.length}${cancelled.length ? ' · ملغاة: ' + cancelled.length : ''}`;
        document.getElementById('agendaMorningCount').textContent = morning.length + inProgMorning.length + visitedMorning.length + cancelMorning.length;
        document.getElementById('agendaEveningCount').textContent = evening.length + inProgEvening.length + visitedEvening.length + cancelEvening.length;
        const emptyMsg = (slot) => `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.82rem;">لا توجد مواعيد ${slot}</div>`;
        const inProgressCardHTML = (r) => `
          <div class="agenda-card" style="border-color:#fbbf24; background:#fffbeb; border-width:2px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(r.PatientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(r.Phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#fef3c7;color:#92400e;border:1px solid #fbbf24;white-space:nowrap;">
                <i class="fas fa-spinner fa-spin" style="margin-left:3px;font-size:.65rem;"></i>جارية
              </span>
            </div>
            <div style="margin-top:8px;">
              <button onclick="endVisitNow('${r.id}')" style="
                width:100%;background:#16a34a;color:white;border:none;border-radius:8px;
                padding:7px 12px;font-weight:700;font-size:.82rem;font-family:inherit;cursor:pointer;
                display:flex;align-items:center;justify-content:center;gap:6px;
              "><i class="fas fa-check-circle"></i> إنهاء الزيارة</button>
            </div>
          </div>`;
        const visitedCardHTML = (r) => `
          <div class="agenda-card" style="border-color:#86efac; background:#f0fdf4; opacity:.85;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(r.PatientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(r.Phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#dcfce7;color:#16a34a;border:1px solid #86efac;">
                <i class="fas fa-check-circle" style="margin-left:3px;font-size:.65rem;"></i>تمت الزيارة
              </span>
            </div>
          </div>`;
        const cancelCardHTML = (r) => `
          <div class="agenda-card" style="border-color:#fca5a5; background:#fef2f2; opacity:.85;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p class="agenda-patient-name">${escapeHtml(r.PatientName)}</p>
                <p class="agenda-patient-phone">${escapeHtml(r.Phone)}</p>
              </div>
              <span style="font-size:.72rem;padding:3px 10px;border-radius:20px;font-weight:700;
                background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;">
                <i class="fas fa-ban" style="margin-left:3px;font-size:.65rem;"></i>تم الإلغاء
              </span>
            </div>
          </div>`;
        document.getElementById('agendaMorning').innerHTML =
          (morning.length      ? morning.map(r => agendaCardHTML(r)).join('') : '') +
          (inProgMorning.length? inProgMorning.map(inProgressCardHTML).join('') : '') +
          (visitedMorning.length ? visitedMorning.map(visitedCardHTML).join('') : '') +
          (cancelMorning.length  ? cancelMorning.map(cancelCardHTML).join('') : '') +
          (!morning.length && !inProgMorning.length && !visitedMorning.length && !cancelMorning.length ? emptyMsg('صباحية') : '');
        document.getElementById('agendaEvening').innerHTML =
          (evening.length      ? evening.map(r => agendaCardHTML(r)).join('') : '') +
          (inProgEvening.length? inProgEvening.map(inProgressCardHTML).join('') : '') +
          (visitedEvening.length ? visitedEvening.map(visitedCardHTML).join('') : '') +
          (cancelEvening.length  ? cancelEvening.map(cancelCardHTML).join('') : '') +
          (!evening.length && !inProgEvening.length && !visitedEvening.length && !cancelEvening.length ? emptyMsg('مسائية') : '');
        updateDayStatusBadge(dateStr);
      }
    }
    function showPastDayDetails(dateStr) {
      // جمع كل الزيارات الفعلية لهذا اليوم من دفتر المرضى فقط
      let actualVisits = [];
      Object.values(allPatients).forEach(p => {
        (p.appointments || []).forEach(v => {
          // مقارنة مرنة للتاريخ (date أو Date)
          const vDate = (v.date || v.Date || '').toString().trim().substring(0, 10);
          if (vDate === dateStr) {
            actualVisits.push({ slot: v.slot || v.Slot || 'Morning', visitType: v.visitType || v.VisitType });
          }
        });
      });

      const total   = actualVisits.length;
      const morning = actualVisits.filter(v => (v.slot||'').toLowerCase() !== 'evening').length;
      const evening = actualVisits.filter(v => (v.slot||'').toLowerCase() === 'evening').length;
      const cancelled = allRecords.filter(r =>
        (r.Status === 'Cancelled' || r.Status === 'Rejected') &&
        (r.Date || '').toString().trim().substring(0, 10) === dateStr
      ).length;

      document.getElementById('statInfoTitle').textContent = `تفاصيل ${formatDateAr(dateStr)}`;
      document.getElementById('statInfoDescription').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="background:var(--primary-light);border-radius:var(--radius-sm);padding:14px;text-align:center;">
            <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:2px;">إجمالي الزيارات الفعلية</p>
            <p style="font-size:2rem;font-weight:800;color:var(--text);font-family:'DM Mono',monospace;line-height:1;">${total}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:var(--amber-light);border-radius:var(--radius-sm);padding:11px;text-align:center;">
              <p style="font-size:.72rem;color:var(--text-muted);margin-bottom:2px;">صباحاً</p>
              <p style="font-size:1.5rem;font-weight:800;color:var(--text);font-family:'DM Mono',monospace;">${morning}</p>
            </div>
            <div style="background:#eff6ff;border-radius:var(--radius-sm);padding:11px;text-align:center;">
              <p style="font-size:.72rem;color:var(--text-muted);margin-bottom:2px;">مساءً</p>
              <p style="font-size:1.5rem;font-weight:800;color:var(--text);font-family:'DM Mono',monospace;">${evening}</p>
            </div>
          </div>
          <div style="background:var(--red-light);border-radius:var(--radius-sm);padding:11px;text-align:center;">
            <p style="font-size:.72rem;color:var(--text-muted);margin-bottom:2px;">ملغاة / مرفوضة</p>
            <p style="font-size:1.5rem;font-weight:800;color:var(--red);font-family:'DM Mono',monospace;">${cancelled}</p>
          </div>
          <p style="font-size:.68rem;color:var(--text-muted);text-align:center;opacity:.6;">${dateStr}</p>
        </div>`;
      document.getElementById('statInfoModal').classList.remove('hidden');
    }
    function agendaCardHTML(record) {
      const phone=normalizePhone(record.Phone);
      return `<div class="agenda-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <p class="agenda-patient-name">${escapeHtml(record.PatientName)}</p>
            <p class="agenda-patient-phone">${escapeHtml(record.Phone)}</p>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="agenda-action-btn manage" title="إدارة الزيارة" onclick='openVisitManagement(${JSON.stringify(record).replace(/'/g,"\\'")})'>${ICON.stethoscope}</button>
            <button class="agenda-action-btn details" title="تفاصيل" onclick="openModalById('${record.id}')">${ICON.eye}</button>
          </div>
        </div>
        <div style="margin-top:6px; font-size:.75rem; color:var(--primary); font-weight:600;">${record.VisitType}</div>
      </div>`;
    }

    window.openModalById = function(id) {
      const r=allRecords.find(r=>r.id===id); if(!r) return;
      
      // Update patient name
      document.getElementById('appDetailsName').textContent = r.PatientName;
      
      // Update phone
      const phone=r.Phone||'-';
      document.getElementById('appDetailsPhone').textContent = phone;
      document.getElementById('appDetailsPhoneInfo').textContent = phone;
      document.getElementById('appDetailsWhatsappBtn').href = `https://wa.me/${normalizePhone(phone)}`;
      document.getElementById('appDetailsCallBtn').href = `tel:${normalizePhone(phone)}`;
      
      // Update patient details
      document.getElementById('appDetailsBirthDate').textContent = r.BirthDate?formatDateAr(r.BirthDate):'-';
      const age = r.BirthDate?calculateAge(r.BirthDate):'-';
      document.getElementById('appDetailsAge').textContent = age!=='-'?age+' سنة':'-';
      document.getElementById('appDetailsAddress').textContent = r.Address||'-';
      
      // Update appointment details (hidden but still for reference)
      document.getElementById('appDetailsVisitType').textContent = r.VisitType||'-';
      const slotText = r.Slot==='Morning'?'صباحاً':(r.Slot==='Evening'?'مساءً':'غير معلوم');
      document.getElementById('appDetailsSlot').textContent = slotText;
      document.getElementById('appDetailsDate').textContent = r.Date?formatDateAr(r.Date):'-';
      
      // Update visible slot badge
      document.querySelectorAll('[id="slotBadge"]').forEach(el => el.textContent = slotText);
      
      // Update visit type badge
      document.querySelectorAll('[id="visitTypeBadge"]').forEach(el => el.textContent = r.VisitType||'-');
      
      deleteAppointmentId = id;
      const deleteBtn=document.getElementById('deleteAppointmentModalBtn');
      r.Status==='Accepted' ? deleteBtn.classList.remove('hidden') : deleteBtn.classList.add('hidden');
      document.getElementById('appointmentDetailsModal').classList.remove('hidden');
    };
    window.closeAppointmentDetailsModal = function() { document.getElementById('appointmentDetailsModal').classList.add('hidden'); };

    window.confirmDelete = function(id) {
      deleteAppointmentId = id;
      document.getElementById('confirmDeleteModal').classList.remove('hidden');
    };
    document.getElementById('confirmDeleteYes').addEventListener('click', function() {
      if(deleteAppointmentId) {
        deleteAppointment(deleteAppointmentId);
        document.getElementById('confirmDeleteModal').classList.add('hidden');
        document.getElementById('appointmentDetailsModal').classList.add('hidden');
        deleteAppointmentId = null;
      }
    });
    document.getElementById('confirmDeleteNo').addEventListener('click', function() {
      document.getElementById('confirmDeleteModal').classList.add('hidden'); deleteAppointmentId=null;
    });
    window.deleteAppointmentFromModal = function() {
      if(deleteAppointmentId) { document.getElementById('appointmentDetailsModal').classList.add('hidden'); confirmDelete(deleteAppointmentId); }
    };

    // ================== Manual Form ==================
    function updateManualSummaryFields() {
      document.getElementById('summaryPatientName').textContent = manualAppointmentData.patientName||'-';
      const age = manualAppointmentData.birthDate?calculateAge(manualAppointmentData.birthDate):'-';
      document.getElementById('summaryAge').textContent = age!=='-'?age+' سنة':'-';
      document.getElementById('confirmPatientName').textContent = manualAppointmentData.patientName||'-';
      document.getElementById('confirmPhone').textContent       = manualAppointmentData.phone||'-';
      document.getElementById('confirmVisitType').textContent   = manualAppointmentData.visitType||'-';
      document.getElementById('confirmDate').textContent        = manualAppointmentData.selectedDate?formatDateAr(manualAppointmentData.selectedDate):'-';
      document.getElementById('confirmSlot').textContent        = manualAppointmentData.selectedSlot==='Morning'?'صباحاً':'مساءً';
    }
    function setupManualForm() {
      document.getElementById('manualDateInput').min = todayStr;
      document.getElementById('manualDateInput').max = toLocalISODate(maxFutureDate);
      document.getElementById('manualBirthDate').max = todayStr;
      const slotMorning=document.getElementById('slotMorning'), slotEvening=document.getElementById('slotEvening');
      const newSlotMorning=slotMorning.cloneNode(true), newSlotEvening=slotEvening.cloneNode(true);
      slotMorning.parentNode.replaceChild(newSlotMorning, slotMorning);
      slotEvening.parentNode.replaceChild(newSlotEvening, slotEvening);
      document.getElementById('slotMorning').addEventListener('click',function(){
        document.getElementById('slotMorning').classList.add('selected');
        document.getElementById('slotEvening').classList.remove('selected');
        manualAppointmentData.selectedSlot='Morning'; updateManualSummaryFields();
      });
      document.getElementById('slotEvening').addEventListener('click',function(){
        document.getElementById('slotEvening').classList.add('selected');
        document.getElementById('slotMorning').classList.remove('selected');
        manualAppointmentData.selectedSlot='Evening'; updateManualSummaryFields();
      });
      document.getElementById('manualPatientName').addEventListener('input',function(e){ manualAppointmentData.patientName=e.target.value; updateManualSummaryFields(); });
      document.getElementById('manualPhone').addEventListener('input',function(e){ manualAppointmentData.phone=e.target.value; updateManualSummaryFields(); });
      document.getElementById('manualBirthDate').addEventListener('change',function(e){ manualAppointmentData.birthDate=e.target.value; updateManualSummaryFields(); });
      document.getElementById('manualAddress').addEventListener('input',function(e){ manualAppointmentData.address=e.target.value; });
      document.getElementById('manualVisitType').addEventListener('change',function(e){ manualAppointmentData.visitType=e.target.value; updateManualSummaryFields(); });
      document.getElementById('manualDateInput').addEventListener('change',function(e){ manualAppointmentData.selectedDate=e.target.value; updateManualSummaryFields(); });
      loadManualFormData();
    }
    function saveManualFormData() {
      manualAppointmentData.patientName   = document.getElementById('manualPatientName').value;
      manualAppointmentData.phone         = document.getElementById('manualPhone').value;
      manualAppointmentData.birthDate     = document.getElementById('manualBirthDate').value;
      manualAppointmentData.address       = document.getElementById('manualAddress').value;
      manualAppointmentData.visitType     = document.getElementById('manualVisitType').value;
      manualAppointmentData.selectedDate  = document.getElementById('manualDateInput').value;
    }
    function loadManualFormData() {
      document.getElementById('manualPatientName').value = manualAppointmentData.patientName||'';
      document.getElementById('manualPhone').value       = manualAppointmentData.phone||'';
      document.getElementById('manualBirthDate').value   = manualAppointmentData.birthDate||'';
      document.getElementById('manualAddress').value     = manualAppointmentData.address||'';
      document.getElementById('manualVisitType').value   = manualAppointmentData.visitType||'';
      document.getElementById('manualDateInput').value   = manualAppointmentData.selectedDate||'';
      if(manualAppointmentData.selectedSlot==='Morning') {
        document.getElementById('slotMorning').classList.add('selected');
        document.getElementById('slotEvening').classList.remove('selected');
      } else {
        document.getElementById('slotEvening').classList.add('selected');
        document.getElementById('slotMorning').classList.remove('selected');
      }
      updateManualSummaryFields();
    }
    function goToStep(step) {
      manualAppointmentData.currentStep = step;
      document.querySelectorAll('.form-step').forEach(s=>s.classList.remove('active'));
      document.getElementById(`step${step}`).classList.add('active');
      document.querySelectorAll('.step-dot').forEach((dot,i)=>{
        let n=i+1;
        const wrapper = dot.closest('.step-dot-wrapper');
        dot.classList.remove('active','completed');
        if(wrapper) wrapper.classList.remove('active','completed');
        if(n<step) { dot.classList.add('completed'); dot.innerHTML='<i class="fas fa-check" style="font-size:.75rem;"></i>'; if(wrapper) wrapper.classList.add('completed'); }
        else if(n===step) { dot.classList.add('active'); dot.textContent=n; if(wrapper) wrapper.classList.add('active'); }
        else dot.textContent=n;
      });
      // Update connectors
      document.querySelectorAll('.step-dot-connector').forEach((c,i)=>{
        c.classList.toggle('done', step > i+1);
      });
    }
    document.getElementById('nextToStep2')?.addEventListener('click',()=>{
      saveManualFormData();
      if(!manualAppointmentData.patientName||!manualAppointmentData.phone||!manualAppointmentData.birthDate||!manualAppointmentData.visitType){ showToast('املأ جميع الحقول','error'); return; }
      goToStep(2);
    });
    document.getElementById('backToStep1')?.addEventListener('click',()=>{ saveManualFormData(); goToStep(1); });
    document.getElementById('nextToStep3')?.addEventListener('click',()=>{
      saveManualFormData();
      if(!manualAppointmentData.selectedDate||isDayClosed(manualAppointmentData.selectedDate)){ showToast('اختر تاريخ صحيح','error'); return; }
      goToStep(3);
    });
    document.getElementById('backToStep2')?.addEventListener('click',()=>{ saveManualFormData(); goToStep(2); });
    document.getElementById('submitManualAppointment')?.addEventListener('click',()=>{
      saveManualFormData();
      if(!manualAppointmentData.patientName||!manualAppointmentData.phone||!manualAppointmentData.birthDate||!manualAppointmentData.visitType||!manualAppointmentData.selectedDate){ showToast('بيانات ناقصة','error'); return; }
      const appointment = {
        PatientName: manualAppointmentData.patientName,
        Phone: manualAppointmentData.phone,
        BirthDate: manualAppointmentData.birthDate,
        Address: manualAppointmentData.address,
        Age: calculateAge(manualAppointmentData.birthDate),
        Date: manualAppointmentData.selectedDate,
        Slot: manualAppointmentData.selectedSlot,
        VisitType: manualAppointmentData.visitType,
        Status: 'Accepted',
        DayName: daysAr[parseLocalISODate(manualAppointmentData.selectedDate).getDay()],
        CreatedAt: new Date().toISOString()
      };
      saveAppointment(appointment);
      showToast('تم تسجيل الموعد','success');
      setActiveSection('appointments');
    });

    // ================== Statistics ==================;
    window.closeStatInfoModal=function(){ document.getElementById('statInfoModal').classList.add('hidden'); };

    window.showDayDetails=function(){
      if(!selectedDayStr) return;
      const isPast = selectedDayStr < todayStr;
      const dateStr = selectedDayStr;
      let total, morningCount, eveningCount, cancelled;
      if (isPast) {
        const visits   = getPastDayVisits(dateStr);
        const noShow   = allRecords.filter(r => r.Status==='NoShow'   && normalizeDate(r.Date)===dateStr);
        const cancelRec= allRecords.filter(r => (r.Status==='Cancelled'||r.Status==='Rejected') && normalizeDate(r.Date)===dateStr);
        total        = visits.length + noShow.length + cancelRec.length;
        morningCount = visits.filter(v => (v.slot||'').toLowerCase() !== 'evening').length +
                       noShow.filter(r => (r.Slot||'Morning')==='Morning').length +
                       cancelRec.filter(r => (r.Slot||'Morning')==='Morning').length;
        eveningCount = visits.filter(v => (v.slot||'').toLowerCase() === 'evening').length +
                       noShow.filter(r => r.Slot==='Evening').length +
                       cancelRec.filter(r => r.Slot==='Evening').length;
        cancelled    = cancelRec.length;
      } else {
        const accepted = allRecords.filter(r => r.Status==='Accepted'  && normalizeDate(r.Date)===dateStr);
        const visitedR = allRecords.filter(r => r.Status==='Visited'   && normalizeDate(r.Date)===dateStr);
        const cancelRec= allRecords.filter(r => (r.Status==='Cancelled'||r.Status==='Rejected') && normalizeDate(r.Date)===dateStr);
        total        = accepted.length + visitedR.length + cancelRec.length;
        morningCount = accepted.filter(r => (r.Slot||'Morning')==='Morning').length +
                       visitedR.filter(r => (r.Slot||'Morning')==='Morning').length +
                       cancelRec.filter(r => (r.Slot||'Morning')==='Morning').length;
        eveningCount = accepted.filter(r => r.Slot==='Evening').length +
                       visitedR.filter(r => r.Slot==='Evening').length +
                       cancelRec.filter(r => r.Slot==='Evening').length;
        cancelled    = cancelRec.length;
      }
      document.getElementById('dayDetailsTitle').textContent = `تفاصيل ${formatDateAr(dateStr)}`;
      document.getElementById('dayDetailsContent').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:var(--primary-light);border-radius:var(--radius-sm);padding:14px;text-align:center;">
            <p style="font-size:.82rem;color:var(--text-muted);">${isPast?'إجمالي الزيارات':'إجمالي المواعيد'}</p>
            <p style="font-size:2rem;font-weight:800;font-family:'DM Mono',monospace;">${total}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:var(--amber-light);border-radius:var(--radius-sm);padding:12px;text-align:center;">
              <p style="font-size:.78rem;color:var(--text-muted);">صباحاً</p>
              <p style="font-size:1.6rem;font-weight:800;font-family:'DM Mono',monospace;">${morningCount}</p>
            </div>
            <div style="background:#eff6ff;border-radius:var(--radius-sm);padding:12px;text-align:center;">
              <p style="font-size:.78rem;color:var(--text-muted);">مساءً</p>
              <p style="font-size:1.6rem;font-weight:800;font-family:'DM Mono',monospace;">${eveningCount}</p>
            </div>
          </div>
          <div style="background:var(--red-light);border-radius:var(--radius-sm);padding:12px;text-align:center;">
            <p style="font-size:.78rem;color:var(--text-muted);">الملغاة / المرفوضة</p>
            <p style="font-size:1.6rem;font-weight:800;color:var(--red);font-family:'DM Mono',monospace;">${cancelled}</p>
          </div>
        </div>`;
      document.getElementById('dayDetailsModal').classList.remove('hidden');
    };
    window.closeDayDetailsModal=function(){ document.getElementById('dayDetailsModal').classList.add('hidden'); };

    // ================== DOMContentLoaded ==================
    document.addEventListener('DOMContentLoaded',()=>{
      initializeFirebaseData();
      applySettings();
      setActiveSection('calendar');
      document.getElementById('nurseHeaderDate').textContent = today.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

      // Nav listeners
      // sidebarAppointments يستخدم onclick مباشرة الآن
      document.getElementById('sidebarPatients').addEventListener('click',()=>setActiveSection('patients'));
      document.getElementById('sidebarCalendar').addEventListener('click',()=>setActiveSection('calendar'));
      // mobileAppointments يستخدم onclick مباشرة الآن
      document.getElementById('mobilePatients').addEventListener('click',()=>setActiveSection('patients'));
      document.getElementById('mobileCalendar').addEventListener('click',()=>setActiveSection('calendar'));

      document.getElementById('appointmentsPendingTab').addEventListener('click',()=>setAppointmentsTab('pending'));
      document.getElementById('appointmentsAcceptedTab').addEventListener('click',()=>setAppointmentsTab('accepted'));
      document.getElementById('searchInput').addEventListener('input',(e)=>{ searchQuery=e.target.value; renderBothAppointmentColumns(); });

      document.getElementById('addNewPatientBtn').addEventListener('click',()=>document.getElementById('patientBookModal').classList.remove('hidden'));
      document.getElementById('patientBookSearch').addEventListener('input',(e)=>{ patientSearchQuery=e.target.value; renderPatientBook(); });
      document.getElementById('cancelPatientBtn').addEventListener('click',()=>document.getElementById('patientBookModal').classList.add('hidden'));

      document.getElementById('submitPatientBookBtn').addEventListener('click',()=>{
        const name=document.getElementById('patientBookName').value.trim();
        const phone=document.getElementById('patientBookPhone').value.trim();
        const birth=document.getElementById('patientBookBirthDate').value;
        const addr=document.getElementById('patientBookAddress').value.trim();
        const type=document.getElementById('patientBookVisitType').value;
        const slot=document.getElementById('patientBookSlot').value;
        if(!name||!phone||!birth||!type){ showToast('املأ البيانات الأساسية','error'); return; }
        const patientId='p_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);
        const newPatient={id:patientId,name,phone,birthDate:birth,address:addr,
          appointments:[{date:todayStr,slot,visitType:type,dayName:daysAr[today.getDay()]}],
          firstVisit:todayStr,lastVisit:todayStr,totalVisits:1};
        savePatient(newPatient);
        document.getElementById('patientBookModal').classList.add('hidden');
        ['patientBookName','patientBookPhone','patientBookBirthDate','patientBookAddress','patientBookVisitType'].forEach(id=>document.getElementById(id).value='');
      });

      document.getElementById('cancelAddVisitBtn').addEventListener('click',()=>document.getElementById('addVisitModal').classList.add('hidden'));
      document.getElementById('submitAddVisitBtn').addEventListener('click',submitAddVisit);

      document.getElementById('prevMonthBtn').addEventListener('click',()=>{ currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); });
      document.getElementById('nextMonthBtn').addEventListener('click',()=>{ currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); });
      document.getElementById('closeDayIcon').addEventListener('click',()=>closeDay(selectedDayStr));
      document.getElementById('openDayIcon').addEventListener('click',()=>openDay(selectedDayStr));
      document.getElementById('showDayDetailsBtn').addEventListener('click',showDayDetails);

      // Close modals on backdrop click
      ['appointmentDetailsModal','patientDetailsModal','visitManagementModal','addVisitModal',
       'patientBookModal','confirmDeleteModal','statInfoModal','dayDetailsModal','settingsModal'].forEach(id=>{
        document.getElementById(id).addEventListener('click',(e)=>{
          if(e.target.id===id){
            if(id==='appointmentDetailsModal') closeAppointmentDetailsModal();
            else if(id==='patientDetailsModal') closePatientDetailsModal();
            else if(id==='statInfoModal') closeStatInfoModal();
            else if(id==='dayDetailsModal') closeDayDetailsModal();
            else document.getElementById(id).classList.add('hidden');
          }
        });
      });
      document.getElementById('closePatientDetailsModalBtn').addEventListener('click',()=>closePatientDetailsModal());

      // Logo upload
      document.getElementById('logoFileInput').addEventListener('change',function(e){
        const file=e.target.files[0]; if(!file) return;
        if(!file.type.startsWith('image/')){ showToast('الرجاء اختيار ملف صورة','error'); return; }
        if(file.size>2*1024*1024){ showToast('حجم الصورة يجب أن يكون أقل من 2 ميغابايت','error'); return; }
        const reader=new FileReader();
        reader.onload=function(ev){
          settings.logo=ev.target.result;
          const previewImg=document.getElementById('logoPreviewImg');
          const previewIcon=document.getElementById('logoPreviewIcon');
          const removeBtn=document.getElementById('removeLogoBtn');
          previewImg.src=ev.target.result; previewImg.classList.remove('hidden');
          previewIcon.classList.add('hidden'); removeBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });
    });

    // ================== Manual Form Overlay (desktop) ==================
    let oManualData = { patientName:'', phone:'', birthDate:'', address:'', visitType:'', selectedDate:'', selectedSlot:'Morning', currentStep:1 };

    function openManualFormOverlay() {
      oManualData = { patientName:'', phone:'', birthDate:'', address:'', visitType:'', selectedDate:'', selectedSlot:'Morning', currentStep:1 };
      // Reset fields
      ['oManualPatientName','oManualPhone','oManualBirthDate','oManualAddress'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('oManualVisitType').value = '';
      document.getElementById('oManualDateInput').value = '';
      document.getElementById('oManualDateInput').min = todayStr;
      document.getElementById('oManualDateInput').max = toLocalISODate(maxFutureDate);
      document.getElementById('oManualBirthDate').max = todayStr;
      document.getElementById('oSlotMorning').classList.add('selected');
      document.getElementById('oSlotEvening').classList.remove('selected');
      document.getElementById('oClosedDayWarning').classList.add('hidden');
      oUpdateSummary();
      oGoToStep(1);
      document.getElementById('manualFormOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeManualFormOverlay() {
      document.getElementById('manualFormOverlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    window.handleOverlayClick = function(e) {
      if (e.target.id === 'manualFormOverlay') closeManualFormOverlay();
    };

    function oGoToStep(step) {
      oManualData.currentStep = step;
      document.querySelectorAll('#manualFormPanel .form-step').forEach(s => s.classList.remove('active'));
      document.getElementById('overlayStep' + step).classList.add('active');
      ['overlayStep1Dot','overlayStep2Dot','overlayStep3Dot'].forEach((id, i) => {
        const dot = document.getElementById(id);
        const wrapper = document.getElementById(id.replace('Dot','Wrapper'));
        const n = i + 1;
        dot.classList.remove('active','completed');
        if(wrapper) wrapper.classList.remove('active','completed');
        if (n < step) { dot.classList.add('completed'); dot.innerHTML = '<i class="fas fa-check" style="font-size:.75rem;"></i>'; if(wrapper) wrapper.classList.add('completed'); }
        else if (n === step) { dot.classList.add('active'); dot.textContent = n; if(wrapper) wrapper.classList.add('active'); }
        else dot.textContent = n;
      });
      // Update connectors
      const c1 = document.getElementById('overlayConnector1');
      const c2 = document.getElementById('overlayConnector2');
      if(c1) c1.classList.toggle('done', step > 1);
      if(c2) c2.classList.toggle('done', step > 2);
    }

    function oUpdateSummary() {
      document.getElementById('oSummaryPatientName').textContent = oManualData.patientName || '-';
      const age = oManualData.birthDate ? calculateAge(oManualData.birthDate) : '-';
      document.getElementById('oSummaryAge').textContent = age !== '-' ? age + ' سنة' : '-';
      document.getElementById('oConfirmPatientName').textContent = oManualData.patientName || '-';
      document.getElementById('oConfirmPhone').textContent       = oManualData.phone || '-';
      document.getElementById('oConfirmVisitType').textContent   = oManualData.visitType || '-';
      document.getElementById('oConfirmDate').textContent        = oManualData.selectedDate ? formatDateAr(oManualData.selectedDate) : '-';
      document.getElementById('oConfirmSlot').textContent        = oManualData.selectedSlot === 'Morning' ? 'صباحاً' : 'مساءً';
    }

    document.addEventListener('DOMContentLoaded', function() {
      // Slot pickers
      document.getElementById('oSlotMorning').addEventListener('click', function() {
        this.classList.add('selected'); document.getElementById('oSlotEvening').classList.remove('selected');
        oManualData.selectedSlot = 'Morning'; oUpdateSummary();
      });
      document.getElementById('oSlotEvening').addEventListener('click', function() {
        this.classList.add('selected'); document.getElementById('oSlotMorning').classList.remove('selected');
        oManualData.selectedSlot = 'Evening'; oUpdateSummary();
      });
      // Live input
      ['oManualPatientName','oManualPhone','oManualBirthDate','oManualAddress'].forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
          const map = { oManualPatientName:'patientName', oManualPhone:'phone', oManualBirthDate:'birthDate', oManualAddress:'address' };
          oManualData[map[id]] = e.target.value;
          oUpdateSummary();
        });
      });
      document.getElementById('oManualVisitType').addEventListener('change', function(e) {
        oManualData.visitType = e.target.value; oUpdateSummary();
      });
      document.getElementById('oManualDateInput').addEventListener('change', function(e) {
        oManualData.selectedDate = e.target.value;
        const closed = isDayClosed(oManualData.selectedDate);
        document.getElementById('oClosedDayWarning').classList.toggle('hidden', !closed);
        oUpdateSummary();
      });

      // Step navigation
      document.getElementById('oNextToStep2').addEventListener('click', function() {
        oManualData.patientName = document.getElementById('oManualPatientName').value.trim();
        oManualData.phone       = document.getElementById('oManualPhone').value.trim();
        oManualData.birthDate   = document.getElementById('oManualBirthDate').value;
        oManualData.address     = document.getElementById('oManualAddress').value.trim();
        oManualData.visitType   = document.getElementById('oManualVisitType').value;
        if (!oManualData.patientName || !oManualData.phone || !oManualData.birthDate || !oManualData.visitType) {
          showToast('املأ جميع الحقول', 'error'); return;
        }
        oUpdateSummary(); oGoToStep(2);
      });
      document.getElementById('oBackToStep1').addEventListener('click', () => oGoToStep(1));
      document.getElementById('oNextToStep3').addEventListener('click', function() {
        oManualData.selectedDate = document.getElementById('oManualDateInput').value;
        if (!oManualData.selectedDate) { showToast('اختر تاريخ الموعد', 'error'); return; }
        if (isDayClosed(oManualData.selectedDate)) { showToast('هذا اليوم مغلق للحجز', 'error'); return; }
        oUpdateSummary(); oGoToStep(3);
      });
      document.getElementById('oBackToStep2').addEventListener('click', () => oGoToStep(2));
      document.getElementById('oSubmitManualAppointment').addEventListener('click', function() {
        const phone = normalizePhone(oManualData.phone);
        const appointment = {
          PatientName: oManualData.patientName, Phone: oManualData.phone,
          BirthDate: oManualData.birthDate, Address: oManualData.address,
          VisitType: oManualData.visitType, Date: oManualData.selectedDate,
          Slot: oManualData.selectedSlot, Status: 'Accepted',
          createdAt: new Date().toISOString(), source: 'manual'
        };
        saveAppointment(appointment);
        closeManualFormOverlay();
        showToast('تم تسجيل الموعد بنجاح', 'success');
      });

      // ESC key closes overlay
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeManualFormOverlay();
      });
    });



// ================== Desktop Speed Dial ==================
  (function(){
    const dial     = document.getElementById('desktopSpeedDial');
    const mainBtn  = document.getElementById('desktopFabMain');
    const pillAppt = document.getElementById('deskPillAppt');
    const pillNotes= document.getElementById('deskPillNotes');
    let dialOpen = false, isDragging = false, dragMoved = false;
    let startX, startY, origLeft, origBottom;

    function showDial() {
      dial.style.display = window.innerWidth >= 768 ? 'flex' : 'none';
    }
    showDial();
    window.addEventListener('resize', showDial);

    // Pills تحسب موقعها من موقع الزر الفعلي على الشاشة
    function positionDesktopPills() {
      const btnRect  = mainBtn.getBoundingClientRect();
      const pills    = document.getElementById('desktopPills');
      const onRight  = (btnRect.left + btnRect.width/2) > window.innerWidth / 2;

      // فوق الزر
      const pillsBottom = window.innerHeight - btnRect.top + 12;

      if (onRight) {
        // الزر على اليمين — Pills تمتد لليسار، محاذاة من اليمين
        pills.style.right = (window.innerWidth - btnRect.right) + 'px';
        pills.style.left  = 'auto';
        pills.style.alignItems = 'flex-end';
      } else {
        // الزر على اليسار — Pills تمتد لليمين، محاذاة من اليسار
        pills.style.left  = btnRect.left + 'px';
        pills.style.right = 'auto';
        pills.style.alignItems = 'flex-start';
      }
      pills.style.bottom = pillsBottom + 'px';
      pills.style.top    = 'auto';
    }

    // Drag
    mainBtn.addEventListener('mousedown', function(e) {
      isDragging = true; dragMoved = false;
      const rect = dial.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origLeft   = rect.left;
      origBottom = window.innerHeight - rect.bottom;
      dial.style.transition = 'none';
      mainBtn.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
      let newLeft   = Math.max(8, Math.min(window.innerWidth  - 68, origLeft   + dx));
      let newBottom = Math.max(8, Math.min(window.innerHeight - 68, origBottom - dy));
      dial.style.left   = newLeft + 'px';
      dial.style.bottom = newBottom + 'px';
      dial.style.right  = 'auto'; dial.style.top = 'auto';
    });
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      mainBtn.style.cursor = 'grab';
      if (dialOpen) positionDesktopPills();
    });

    window.toggleFabDial = function() {
      if (dragMoved) { dragMoved = false; return; }
      dialOpen = !dialOpen;
      if (dialOpen) positionDesktopPills();
      mainBtn.classList.toggle('open', dialOpen);
      pillAppt.classList.toggle('visible', dialOpen);
      pillNotes.classList.toggle('visible', dialOpen);
      document.getElementById('fabBackdrop').classList.toggle('active', dialOpen);
    };
    window.closeFabDial = function() {
      dialOpen = false;
      mainBtn.classList.remove('open');
      pillAppt.classList.remove('visible');
      pillNotes.classList.remove('visible');
      document.getElementById('fabBackdrop').classList.remove('active');
    };

    // Mobile
    let mobOpen = false;
    function positionMobPills() {
      const trigger = document.getElementById('mobFabTrigger');
      const pills   = document.getElementById('mobPills');
      const rect    = trigger.getBoundingClientRect();
      // ضع الـ pills فوق الزر وعلى نفس الجهة
      pills.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
      pills.style.right  = (window.innerWidth - rect.right) + 'px';
      pills.style.left   = 'auto';
    }
    window.toggleMobFab = function() {
      mobOpen = !mobOpen;
      const trigger = document.getElementById('mobFabTrigger');
      const pills   = document.getElementById('mobPills');
      if (mobOpen) positionMobPills();
      trigger.classList.toggle('open', mobOpen);
      pills.classList.toggle('active', mobOpen);
    };
    window.closeMobFab = function() {
      mobOpen = false;
      document.getElementById('mobFabTrigger').classList.remove('open');
      document.getElementById('mobPills').classList.remove('active');
    };
    document.addEventListener('click', function(e) {
      if (mobOpen && !e.target.closest('.mob-fab-container') && !e.target.closest('#mobPills')) closeMobFab();
      // أغلق sub-nav المواعيد
      if (apptSubOpen && !e.target.closest('#mobileAppointments') && !e.target.closest('#mobApptSubNav')
          && !e.target.closest('#sidebarAppointments') && !e.target.closest('#sidebarApptSub')) {
        apptSubOpen = false;
        document.getElementById('sidebarApptSub')?.classList.remove('open');
        document.getElementById('sidebarAppointments')?.classList.remove('sub-open');
        document.getElementById('mobApptSubNav')?.classList.remove('open');
      }
    });
  })();


// ================== Manual Form Overlay ==================
  <div id="manualFormOverlay" onclick="handleOverlayClick(event)">
    <div id="manualFormPanel">
      <button id="manualFormOverlayCloseBtn" onclick="closeManualFormOverlay()" title="إغلاق">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding-top:4px;">
        <div class="card-icon"><i class="fas fa-pen-to-square"></i></div>
        <div>
          <div class="card-title">تسجيل موعد يدوي</div>
          <div class="card-subtitle">للمرضى الذين يحجزون مباشرة في العيادة</div>
        </div>
      </div>

      <!-- Step indicator -->
      <div class="form-step-indicator" id="overlayStepIndicator">
        <div class="step-dot-wrapper active" id="overlayStep1Wrapper">
          <div class="step-dot active" id="overlayStep1Dot">1</div>
          <span class="step-dot-label">البيانات</span>
        </div>
        <div class="step-dot-connector" id="overlayConnector1"></div>
        <div class="step-dot-wrapper" id="overlayStep2Wrapper">
          <div class="step-dot" id="overlayStep2Dot">2</div>
          <span class="step-dot-label">الموعد</span>
        </div>
        <div class="step-dot-connector" id="overlayConnector2"></div>
        <div class="step-dot-wrapper" id="overlayStep3Wrapper">
          <div class="step-dot" id="overlayStep3Dot">3</div>
          <span class="step-dot-label">تأكيد</span>
        </div>
      </div>

      <!-- Step 1 -->
      <div id="overlayStep1" class="form-step active">
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div><label class="form-label">اسم المريض الكامل</label><input type="text" id="oManualPatientName" class="form-input" placeholder="أدخل الاسم الكامل"></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div><label class="form-label">رقم الهاتف</label><input type="tel" id="oManualPhone" class="form-input" placeholder="05xxxxxxxx"></div>
            <div><label class="form-label">تاريخ الميلاد</label><input type="date" id="oManualBirthDate" class="form-input"></div>
          </div>
          <div><label class="form-label">العنوان</label><input type="text" id="oManualAddress" class="form-input" placeholder="اختياري"></div>
          <div><label class="form-label">نوع الزيارة</label>
            <select id="oManualVisitType" class="form-input">
              <option value="">اختر نوع الزيارة</option>
              <option value="كشف جديد">كشف جديد</option>
              <option value="مراجعة">مراجعة</option>
              <option value="تحاليل">تحاليل</option>
            </select>
          </div>
        </div>
        <div class="form-navigation">
          <div></div>
          <button id="oNextToStep2" class="btn-primary">التالي <i class="fas fa-arrow-left"></i></button>
        </div>
      </div>

      <!-- Step 2 -->
      <div id="overlayStep2" class="form-step">
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div><label class="form-label">اختر تاريخ الموعد</label><input type="date" id="oManualDateInput" class="form-input"></div>
          <div><label class="form-label">الفترة</label>
            <div style="display:flex; gap:10px;">
              <div id="oSlotMorning" class="slot-option selected"><i class="fas fa-sun" style="color:#d97706;"></i><span>صباحاً</span></div>
              <div id="oSlotEvening" class="slot-option"><i class="fas fa-moon" style="color:#6366f1;"></i><span>مساءً</span></div>
            </div>
          </div>
          <div id="oClosedDayWarning" class="hidden" style="background:var(--red-light);color:var(--red);border-radius:var(--radius-sm);padding:10px 14px;font-size:.82rem;"><i class="fas fa-ban" style="margin-left:6px;"></i>هذا اليوم مغلق للحجز</div>
          <div class="form-summary">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="color:var(--text-muted); font-size:.82rem;">المريض:</span>
              <span id="oSummaryPatientName" style="font-weight:600;">-</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-size:.82rem;">العمر:</span>
              <span id="oSummaryAge" style="font-weight:600;">-</span>
            </div>
          </div>
        </div>
        <div class="form-navigation">
          <button id="oBackToStep1" class="btn-secondary"><i class="fas fa-arrow-right"></i> السابق</button>
          <button id="oNextToStep3" class="btn-primary">التالي <i class="fas fa-arrow-left"></i></button>
        </div>
      </div>

      <!-- Step 3 -->
      <div id="overlayStep3" class="form-step">
        <div style="background:var(--primary-light); border:1.5px solid var(--border-strong); border-radius:var(--radius); padding:18px; margin-bottom:16px;">
          <h3 style="font-weight:700; font-size:.95rem; margin-bottom:12px; color:var(--primary);">تأكيد الحجز</h3>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:.88rem;">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">الاسم:</span><span id="oConfirmPatientName" style="font-weight:600;"></span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">الهاتف:</span><span id="oConfirmPhone" style="font-weight:600;"></span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">النوع:</span><span id="oConfirmVisitType" style="font-weight:600;"></span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">التاريخ:</span><span id="oConfirmDate" style="font-weight:600;"></span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">الفترة:</span><span id="oConfirmSlot" style="font-weight:600;"></span></div>
          </div>
        </div>
        <div class="form-navigation">
          <button id="oBackToStep2" class="btn-secondary"><i class="fas fa-arrow-right"></i> السابق</button>
          <button id="oSubmitManualAppointment" class="btn-primary" style="background:linear-gradient(135deg,#059669,#10b981)!important;">تسجيل الموعد</button>
        </div>
      </div>

    </div>
  </div>

  <!-- ========== NOTES JAVASCRIPT ========== -->


// ================== Notes ==================
  // جلب الملاحظات من Firebase
  window.loadNotesData = async function(callback) {
    try {
      if (fbReady()) {
        const { doc, getDoc } = getFb();
        const snap = await getDoc(doc(getDb(), 'settings', 'sharedNotes'));
        const notes = snap.exists() ? (snap.data().notes || []) : [];
        callback(Array.isArray(notes) ? notes : []);
      } else {
        const notes = lsGet(NOTES_KEY, []);
        callback(Array.isArray(notes) ? notes : []);
      }
    } catch(e) { callback([]); }
  }

  // حفظ الملاحظات في Firebase
  window.saveNotesData = function(notes, callback) {
    try {
      fbSaveNotes(notes).then(() => {
        if (callback) callback();
        showToast('تم حفظ الملاحظة بنجاح', 'success');
      }).catch(e => showToast('فشل حفظ الملاحظة', 'error'));
    } catch(e) {
      showToast('فشل حفظ الملاحظة', 'error');
    }
  }

  window.openNotesOverlay = function() {
    const el = document.getElementById('notesOverlay');
    el.style.display = 'flex';
    // جلب البيانات أولاً ثم عرض الملاحظات
    window.loadNotesData(function(notes) {
      window.renderNotes();
      setTimeout(() => {
        const searchInput = document.getElementById('notesSearchInput');
        if (searchInput) searchInput.focus();
      }, 200);
    });
  };

  window.closeNotesOverlay = function() {
    document.getElementById('notesOverlay').style.display = 'none';
    window.hideAddNoteForm();
  };

  window.showAddNoteForm = function() {
    document.getElementById('addNoteForm').style.display = 'block';
    setTimeout(() => document.getElementById('noteTextInput').focus(), 50);
  };

  window.hideAddNoteForm = function() {
    document.getElementById('addNoteForm').style.display = 'none';
    document.getElementById('noteTextInput').value = '';
  };

  window.saveNote = function() {
    const text = document.getElementById('noteTextInput').value.trim();
    if (!text) {
      showToast('الرجاء إدخال ملاحظة', 'error');
      return;
    }

    window.loadNotesData(function(notes) {
      if (!notes) notes = [];
      const newNote = {
        id: Date.now(),
        text: text,
        pinned: false,
        date: new Date().toLocaleDateString('ar-EG')
      };
      notes.unshift(newNote);

      window.saveNotesData(notes, function() {
        window.hideAddNoteForm();
        window.renderNotes();
      });
    });
  };

  window.togglePin = function(id) {
    window.loadNotesData(function(notes) {
      if (!notes) notes = [];
      const note = notes.find(n => n.id === id);
      if (note) {
        note.pinned = !note.pinned;
        window.saveNotesData(notes, function() {
          window.renderNotes();
        });
      }
    });
  };

  window.deleteNote = function(id) {
    window.loadNotesData(function(notes) {
      if (!notes) notes = [];
      const filteredNotes = notes.filter(n => n.id !== id);
      window.saveNotesData(filteredNotes, function() {
        window.renderNotes();
      });
    });
  };

  window.renderNotes = function() {
    window.loadNotesData(function(notes) {
      if (!notes || !Array.isArray(notes)) notes = [];
      
      const q = (document.getElementById('notesSearchInput')?.value || '').trim().toLowerCase();
      let displayNotes = notes;
      if (q) {
        displayNotes = notes.filter(n => n && n.text && n.text.toLowerCase().includes(q));
      }

      displayNotes.sort((a, b) => {
        if (!a || !b) return 0;
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      });

      const total = notes.length;
      const countLabel = document.getElementById('notesCountLabel');
      if (countLabel) {
        countLabel.textContent = total === 0 ? 'لا توجد ملاحظات' : `${total} ملاحظة`;
      }

      const list = document.getElementById('notesList');
      const empty = document.getElementById('notesEmpty');
      
      if (!list) return;
      
      if (displayNotes.length === 0) {
        list.innerHTML = '';
        if (empty) {
          list.appendChild(empty);
          empty.style.display = 'block';
        }
        return;
      }
      if (empty) empty.style.display = 'none';
      
      list.innerHTML = displayNotes.map(n => {
        if (!n || !n.text) return '';
        return `
          <div class="note-card${n.pinned ? ' pinned' : ''}">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
              <p style="font-size:.88rem; line-height:1.65; color:var(--text); flex:1; white-space:pre-wrap; word-break:break-word;">${escapeHtml(n.text)}</p>
              <div style="display:flex; gap:2px; flex-shrink:0;">
                <button class="note-pin-btn" onclick="togglePin(${n.id})" title="${n.pinned ? 'إلغاء التثبيت' : 'تثبيت'}">${n.pinned ? '📌' : '📍'}</button>
                <button class="note-delete-btn" onclick="deleteNote(${n.id})" title="حذف"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div style="margin-top:8px; font-size:.7rem; color:var(--text-muted);">${n.date || ''}${n.pinned ? ' · <span style="color:#d97706;font-weight:700;">مثبتة</span>' : ''}</div>
          </div>
        `;
      }).join('');
    });
  };

  // حفظ الملاحظة باستخدام Ctrl+Enter
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeNotesOverlay();
    if (e.key === 'Enter' && e.ctrlKey && document.getElementById('addNoteForm').style.display !== 'none') window.saveNote();
  });

  function escapeHtml(text) { 
    const d = document.createElement('div'); 
    d.textContent = text; 
    return d.innerHTML; 
  }
  </script>

