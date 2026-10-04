/**
 * ==============================================================================
 * cbt-engine.js - EXAM UI & STATE CONTROLLER (V3 ISOLATED)
 * Menangani 8 Tipe Soal, Navigasi, Timer, State Persistence, & Analytics Data
 * ==============================================================================
 */

const CBTEngine = (function () {
  // --------------------------------------------------------------------------
  // 1. STATE MANAGEMENT (Tersimpan aman di sessionStorage)
  // --------------------------------------------------------------------------
  let Config = null;
  let UserData = null;
  
  let State = {
    currentIndex: 0,
    currentSubtestId: null,
    answers: {},       // Format: { "question_id": "jawaban" }
    doubt: {},         // Format: { "question_id": true/false }
    timeLogs: {},      // Format: { "question_id": detik (number) }
    questionOrder: [], // Urutan indeks soal (untuk pengacakan)
    optionsMap: {},    // Mapping pengacakan opsi per soal
    startTimestamp: 0,
    elapsedSeconds: 0,
    attemptId: 'ATT-' + Date.now().toString(36).toUpperCase()
  };

  let timerInterval = null;

  // --------------------------------------------------------------------------
  // 2. INISIALISASI ENGINE
  // --------------------------------------------------------------------------
  async function init() {
    console.log("[CBT-ENGINE] Memulai inisialisasi...");
    
    // Validasi Sesi Autentikasi
    const rawUser = sessionStorage.getItem('cbt_auth_user');
    if (!rawUser) {
      alert("Akses ditolak! Sesi tidak ditemukan. Silakan login kembali.");
      window.location.href = "../auth/auth.html";
      return;
    }
    UserData = JSON.parse(rawUser);

    // Ambil Data JSON Soal
    try {
      const response = await fetch(`../database-soal/${UserData.kodeKegiatan}.json`);
      if (!response.ok) throw new Error("Gagal memuat konfigurasi soal.");
      Config = await response.json();
    } catch (error) {
      alert("Terjadi kesalahan fatal saat memuat data ujian.");
      console.error(error);
      return;
    }

    // Load atau Buat State Baru (Persistence)
    const savedState = sessionStorage.getItem(`cbt_state_${UserData.kodeKegiatan}`);
    if (savedState) {
      State = JSON.parse(savedState);
    } else {
      setupInitialState();
    }

    // Render UI Awal
    renderHeader();
    renderSubtestTabs();
    renderGrid();
    loadQuestion(State.currentIndex);

    // Mulai Timer & Analytics Tracking
    startTimer();
  }

  function setupInitialState() {
    State.startTimestamp = Date.now();
    State.elapsedSeconds = 0;
    
    let questions = Config.questions || [];
    let initialOrder = questions.map((_, index) => index);

    // Implementasi Pengacakan Soal (Jika diaktifkan)
    if (Config.exam_rules?.randomize_questions) {
      // Logic shuffle sederhana (Fisher-Yates)
      for (let i = initialOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]];
      }
    }
    State.questionOrder = initialOrder;

    // Inisialisasi Analytics Timing & Options Shuffling
    questions.forEach((q, idx) => {
      State.timeLogs[q.question_id] = 0;
      
      // Jika opsi perlu diacak (Tipe 1A-1C, 2A, 5A)
      if (Config.exam_rules?.randomize_options && q.options && q.options.length > 0) {
        let optKeys = q.options.map(o => o.key);
        for (let i = optKeys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optKeys[i], optKeys[j]] = [optKeys[j], optKeys[i]];
        }
        State.optionsMap[q.question_id] = optKeys;
      }
    });

    saveState();
  }

  function saveState() {
    sessionStorage.setItem(`cbt_state_${UserData.kodeKegiatan}`, JSON.stringify(State));
  }

  // --------------------------------------------------------------------------
  // 3. UI RENDERERS (Header, Tabs, Grid, Questions)
  // --------------------------------------------------------------------------
  function renderHeader() {
    document.getElementById('disp-exam-title').textContent = Config.nama_kegiatan || "Ujian CBT";
    document.getElementById('disp-sub-title').textContent = Config.penyelenggara || "Briska Education";
    if (Config.logo) document.getElementById('cbt-brand-logo').src = Config.logo;
    
    document.getElementById('disp-user-name').textContent = UserData.namaLengkap || "Peserta";
    document.getElementById('disp-user-id').textContent = UserData.tokenRole || "REGULER";
  }

  function renderSubtestTabs() {
    const navBar = document.getElementById('subtest-nav-bar');
    const tabsContainer = document.getElementById('subtest-tabs-container');
    
    if (Config.sections && Config.sections.length > 1) {
      navBar.classList.remove('hidden');
      tabsContainer.innerHTML = Config.sections.map((sec, i) => `
        <div class="subtest-tab-item ${i === 0 ? 'active' : ''}">${sec.subtest_name}</div>
      `).join('');
    } else {
      navBar.classList.add('hidden');
    }
  }

  function renderGrid() {
    const grid = document.getElementById('number-grid');
    grid.innerHTML = '';
    
    State.questionOrder.forEach((realIndex, displayIndex) => {
      const q = Config.questions[realIndex];
      const qId = q.question_id;
      
      const btn = document.createElement('div');
      btn.id = `grid-circle-${displayIndex}`;
      btn.textContent = displayIndex + 1;
      btn.className = getGridClass(displayIndex, qId);
      
      btn.onclick = () => {
        State.currentIndex = displayIndex;
        loadQuestion(State.currentIndex);
      };
      
      grid.appendChild(btn);
    });
    
    updateGridStats();
  }

  function getGridClass(displayIndex, qId) {
    let classes = ['circle-btn'];
    if (displayIndex === State.currentIndex) classes.push('active');
    
    const ans = State.answers[qId];
    const isAnswered = ans !== undefined && ans !== null && ans !== "" && (Array.isArray(ans) ? ans.length > 0 : true);
    
    if (State.doubt[qId]) {
      classes.push('doubt');
    } else if (isAnswered) {
      classes.push('answered');
    } else {
      classes.push('unanswered');
    }
    
    return classes.join(' ');
  }

  function updateGridStats() {
    let answeredCount = 0;
    const total = State.questionOrder.length;
    
    State.questionOrder.forEach(realIndex => {
      const qId = Config.questions[realIndex].question_id;
      const ans = State.answers[qId];
      if (ans !== undefined && ans !== null && ans !== "" && (Array.isArray(ans) ? ans.length > 0 : true)) {
        answeredCount++;
      }
    });
    
    document.getElementById('answered-counter').textContent = `${answeredCount} / ${total}`;
    return { answeredCount, total };
  }

  // --------------------------------------------------------------------------
  // 4. MULTI-TYPE QUESTION RENDERER (Inti Engine)
  // --------------------------------------------------------------------------
  function loadQuestion(displayIndex) {
    const realIndex = State.questionOrder[displayIndex];
    const q = Config.questions[realIndex];
    const qId = q.question_id;
    
    // Update Header Soal
    document.getElementById('q-num').textContent = displayIndex + 1;
    
    // Metadata Badges (Learning Analytics Awareness)
    const badgesHtml = `
      ${q.section_name ? `<span class="badge-tag badge-section">📘 ${q.section_name}</span>` : ''}
      ${q.subtest_name ? `<span class="badge-tag badge-subtest">📌 ${q.subtest_name}</span>` : ''}
      ${q.level ? `<span class="badge-tag badge-level ${q.level === 'H' ? 'hard' : q.level === 'M' ? 'medium' : 'easy'}">🔥 LVL: ${q.level}</span>` : ''}
      <span class="badge-tag badge-tipe">📝 TIPE: ${q.tipe || '1A'}</span>
    `;
    document.getElementById('q-badges-container').innerHTML = badgesHtml;

    // Konten Soal & Gambar
    document.getElementById('q-text').innerHTML = q.soal;
    const imgBox = document.getElementById('q-image-container');
    if (q.gambar && q.gambar !== "") {
      imgBox.innerHTML = `<img src="${q.gambar}" class="img-soal" alt="Gambar Pendukung">`;
    } else {
      imgBox.innerHTML = '';
    }

    // Render Opsi Berdasarkan Tipe
    const optBox = document.getElementById('options-box');
    optBox.innerHTML = '';
    const tipe = (q.tipe || "1A").toUpperCase();
    const currentAns = State.answers[qId];

    if (["1A", "1B", "1C", "5A"].includes(tipe)) {
      // Single Choice (Radio)
      let optOrder = State.optionsMap[qId] || q.options.map(o => o.key);
      optOrder.forEach(key => {
        const optData = q.options.find(o => o.key === key);
        if (!optData) return;
        
        const isSelected = currentAns === key;
        const row = document.createElement('div');
        row.className = `option-row ${isSelected ? 'selected' : ''}`;
        row.innerHTML = `
          <input type="radio" style="pointer-events:none;" ${isSelected ? 'checked' : ''}>
          <span class="opt-key">${key}.</span>
          <span class="opt-val">${optData.text}</span>
        `;
        row.onclick = () => saveAnswer(qId, key);
        optBox.appendChild(row);
      });
    } 
    else if (tipe === "2A") {
      // Multiple Choice (Checkbox)
      let optOrder = State.optionsMap[qId] || q.options.map(o => o.key);
      let ansArr = Array.isArray(currentAns) ? currentAns : [];
      
      optOrder.forEach(key => {
        const optData = q.options.find(o => o.key === key);
        const isSelected = ansArr.includes(key);
        
        const row = document.createElement('div');
        row.className = `option-row ${isSelected ? 'selected' : ''}`;
        row.innerHTML = `
          <input type="checkbox" style="pointer-events:none;" ${isSelected ? 'checked' : ''}>
          <span class="opt-key">${key}.</span>
          <span class="opt-val">${optData.text}</span>
        `;
        row.onclick = () => {
          let updated = [...ansArr];
          if (updated.includes(key)) updated = updated.filter(k => k !== key);
          else updated.push(key);
          saveAnswer(qId, updated.length > 0 ? updated : null);
        };
        optBox.appendChild(row);
      });
    }
    else if (tipe === "3A" || tipe === "3B") {
      // Short Answer (Input Text/Number)
      const isMulti = tipe === "3B";
      optBox.innerHTML = `
        <div class="essay-container">
          <label style="font-weight:700; color:var(--text-muted);">Ketik Jawaban Anda:</label>
          ${isMulti ? 
            `<textarea id="input-short" class="essay-input-multi" placeholder="Ketik kata/frasa...">${currentAns || ''}</textarea>` : 
            `<input type="number" id="input-short" class="essay-input-single" placeholder="Masukkan angka..." value="${currentAns || ''}">`
          }
        </div>
      `;
      document.getElementById('input-short').oninput = (e) => {
        saveAnswer(qId, e.target.value.trim() !== "" ? e.target.value : null);
      };
    }
    else if (tipe === "4A") {
      // Matriks (True/False per baris)
      let ansArr = Array.isArray(currentAns) ? currentAns : [];
      let tableHtml = `<div class="matrix-container"><table class="matrix-table">
        <thead><tr><th style="text-align:left;">Pernyataan</th><th>Benar (B)</th><th>Salah (S)</th></tr></thead><tbody>`;
      
      q.options.forEach((opt, idx) => {
        const choice = ansArr[idx] || "";
        tableHtml += `
          <tr>
            <td>${idx+1}. ${opt.text}</td>
            <td class="matrix-radio-cell"><input type="radio" name="mtx_${qId}_${idx}" value="B" ${choice === 'B' ? 'checked' : ''} onchange="window.CBTEngine.saveMatrix('${qId}', ${idx}, 'B', ${q.options.length})"></td>
            <td class="matrix-radio-cell"><input type="radio" name="mtx_${qId}_${idx}" value="S" ${choice === 'S' ? 'checked' : ''} onchange="window.CBTEngine.saveMatrix('${qId}', ${idx}, 'S', ${q.options.length})"></td>
          </tr>
        `;
      });
      tableHtml += `</tbody></table></div>`;
      optBox.innerHTML = tableHtml;
    }

    // Update Toolbar Bawah (Ragu & Navigasi)
    document.getElementById('chk-doubt').checked = !!State.doubt[qId];
    document.getElementById('btn-prev').disabled = (displayIndex === 0);
    document.getElementById('btn-next').disabled = (displayIndex === State.questionOrder.length - 1);

    // Refresh Status Grid Visual
    document.querySelectorAll('.circle-btn').forEach((el, i) => {
      const iterQId = Config.questions[State.questionOrder[i]].question_id;
      el.className = getGridClass(i, iterQId);
    });

    // Panggil MathJax jika ada rumus
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([document.getElementById('q-text'), document.getElementById('options-box')])
        .catch(err => console.warn("MathJax Error:", err));
    }
  }

  // --------------------------------------------------------------------------
  // 5. INPUT HANDLERS & DATA BINDING
  // --------------------------------------------------------------------------
  function saveAnswer(qId, value) {
    if (value === null) delete State.answers[qId];
    else State.answers[qId] = value;
    
    saveState();
    if (document.getElementById('input-short')) {
       updateGridStats(); // Hindari re-render utuh agar cursor tidak hilang saat ngetik essay
       document.getElementById(`grid-circle-${State.currentIndex}`).className = getGridClass(State.currentIndex, qId);
    } else {
       loadQuestion(State.currentIndex); // Re-render untuk Radio/Checkbox styling
    }
  }

  function saveMatrix(qId, rowIdx, value, totalRows) {
    let currentArr = Array.isArray(State.answers[qId]) ? [...State.answers[qId]] : new Array(totalRows).fill("");
    currentArr[rowIdx] = value;
    State.answers[qId] = currentArr;
    saveState();
    updateGridStats();
    document.getElementById(`grid-circle-${State.currentIndex}`).className = getGridClass(State.currentIndex, qId);
  }

  function clearAnswer() {
    const qId = Config.questions[State.questionOrder[State.currentIndex]].question_id;
    delete State.answers[qId];
    saveState();
    loadQuestion(State.currentIndex);
  }

  function toggleDoubt() {
    const qId = Config.questions[State.questionOrder[State.currentIndex]].question_id;
    State.doubt[qId] = !State.doubt[qId];
    saveState();
    loadQuestion(State.currentIndex);
  }

  function navigasi(arah) {
    const nextIndex = State.currentIndex + arah;
    if (nextIndex >= 0 && nextIndex < State.questionOrder.length) {
      State.currentIndex = nextIndex;
      loadQuestion(State.currentIndex);
    }
  }

  function setFontSize(size) {
    const root = document.querySelector('.q-content-scroll');
    const sizes = { 'small': '14px', 'medium': '16px', 'large': '19px' };
    if (root) {
      root.style.setProperty('--cbt-font-size', sizes[size]);
    }
    document.querySelectorAll('.btn-font').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  }

  // --------------------------------------------------------------------------
  // 6. TIMING ENGINE (Real-time tracking per Question)
  // --------------------------------------------------------------------------
  function startTimer() {
    const durasiTotalSec = (Config.total_timer_menit || 120) * 60;
    
    timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - State.startTimestamp) / 1000);
      State.elapsedSeconds = elapsed;
      
      const sisaDetik = Math.max(0, durasiTotalSec - elapsed);
      updateTimerUI(sisaDetik);

      // Track durasi aktif per soal (Analytics Tier 2)
      const activeQId = Config.questions[State.questionOrder[State.currentIndex]].question_id;
      State.timeLogs[activeQId] = (State.timeLogs[activeQId] || 0) + 1;
      
      // Auto-save interval tiap 5 detik
      if (elapsed % 5 === 0) saveState();

      // Waktu Habis Global
      if (sisaDetik <= 0) {
        clearInterval(timerInterval);
        alert("⏰ Waktu ujian Anda telah habis! Sistem akan mengirim jawaban secara otomatis.");
        executeSubmit(true);
      }
    }, 1000);
  }

  function updateTimerUI(sisaDetik) {
    const jam = Math.floor(sisaDetik / 3600);
    const mnt = Math.floor((sisaDetik % 3600) / 60);
    const dtk = sisaDetik % 60;
    
    const display = `${String(jam).padStart(2,'0')}:${String(mnt).padStart(2,'0')}:${String(dtk).padStart(2,'0')}`;
    const timerEl = document.getElementById('timer-display');
    timerEl.textContent = display;
    
    if (sisaDetik <= 300) timerEl.classList.add('timer-warning'); // Merah kedip < 5 menit
    else timerEl.classList.remove('timer-warning');
  }

  // --------------------------------------------------------------------------
  // 7. SUBMISSION HANDLER (Decoupled Handoff)
  // --------------------------------------------------------------------------
  function openConfirmModal() {
    const stats = updateGridStats();
    document.getElementById('sum-total').textContent = stats.total;
    document.getElementById('sum-dijawab').textContent = stats.answeredCount;
    document.getElementById('sum-kosong').textContent = stats.total - stats.answeredCount;
    
    if (stats.answeredCount < stats.total) {
      document.getElementById('sum-warning-text').classList.remove('hidden');
    } else {
      document.getElementById('sum-warning-text').classList.add('hidden');
    }
    
    document.getElementById('modal-confirm').classList.remove('hidden');
  }

  function closeConfirmModal() {
    document.getElementById('modal-confirm').classList.add('hidden');
  }

  function executeSubmit(isAuto = false) {
    document.getElementById('modal-confirm').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('hidden');
    clearInterval(timerInterval);

    // Kumpulkan Raw Data Analytics untuk dilempar ke ScoringEngine
    const RawDataPayload = {
      student_id: UserData.username,
      attempt_id: State.attemptId,
      kode_ujian: Config.kode_ujian,
      timestamp_start: new Date(State.startTimestamp).toISOString(),
      timestamp_submit: new Date().toISOString(),
      duration_seconds: State.elapsedSeconds,
      exam_rules: Config.exam_rules || {},
      raw_answers: State.answers,
      doubt_state: State.doubt,
      time_logs_per_question: State.timeLogs,
      security_logs: (window.SecurityEngine && window.SecurityEngine.getLogs()) || []
    };

    // HANDOFF: Panggil Scoring Engine Murni (Terpisah di scoring.js)
    if (window.ScoringEngine && typeof window.ScoringEngine.calculateAndTransmit === 'function') {
      window.ScoringEngine.calculateAndTransmit(Config, UserData, RawDataPayload);
    } else {
      console.error("[CRITICAL] ScoringEngine tidak ditemukan!");
      alert("Terjadi kesalahan sistem: Engine Penilaian tidak merespons.");
    }
  }

  // Expose API ke Window (Untuk UI HTML Event Listeners)
  return {
    init,
    saveMatrix,
    clearAnswer,
    toggleDoubt,
    navigasi,
    setFontSize,
    bukaModalKonfirmasi: openConfirmModal,
    tutupModalKonfirmasi: closeConfirmModal,
    eksekusiSubmitUjian: () => executeSubmit(false)
  };

})();

// Jalankan Engine saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('cbt-exam-root')) {
    window.CBTEngine = CBTEngine;
    CBTEngine.init();
  }
});

// Alias Global untuk HTML event
window.clearAnswer = () => window.CBTEngine.clearAnswer();
window.toggleDoubt = () => window.CBTEngine.toggleDoubt();
window.navigasi = (arah) => window.CBTEngine.navigasi(arah);
window.setFontSize = (size) => window.CBTEngine.setFontSize(size);
window.bukaModalKonfirmasi = () => window.CBTEngine.bukaModalKonfirmasi();
window.tutupModalKonfirmasi = () => window.CBTEngine.tutupModalKonfirmasi();
window.eksekusiSubmitUjian = () => window.CBTEngine.eksekusiSubmitUjian();
