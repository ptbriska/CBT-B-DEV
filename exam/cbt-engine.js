/**
 * ==============================================================================
 * cbt-engine.js - EXAM UI & STATE CONTROLLER (FIXED LATEX MATHJAX RENDER)
 * ==============================================================================
 */

const CBTEngine = (function () {
  let Config = null;
  let UserData = null;
  
  let State = {
    currentIndex: 0,
    currentSubtestId: null,
    answers: {},
    doubt: {},
    timeLogs: {},
    questionOrder: [],
    optionsMap: {},
    startTimestamp: 0,
    elapsedSeconds: 0,
    attemptId: 'ATT-' + Date.now().toString(36).toUpperCase()
  };

  let timerInterval = null;

  /**
   * Helper Pembersih Teks LaTeX
   * Menjamin garis miring ganda (\\) diubah menjadi (\) jika datang dari JSON mentah
   * TANPA merusak atau menambah spasi liar di dalam tanda $...$
   */
  function formatLatexText(str) {
    if (!str || typeof str !== 'string') return '';
    // Pastikan tidak ada double escape berlebih dari parsing JSON
    return str.replace(/\\\\/g, '\\');
  }

  async function init() {
    console.log("[CBT-ENGINE] Memulai inisialisasi...");
    
    const rawUser = sessionStorage.getItem('cbt_auth_user');
    if (!rawUser) {
      alert("Akses ditolak! Sesi tidak ditemukan. Silakan login kembali.");
      window.location.href = "../auth/auth.html";
      return;
    }
    UserData = JSON.parse(rawUser);

    try {
      const response = await fetch(`../database-soal/${UserData.kodeKegiatan}.json`);
      if (!response.ok) throw new Error("Gagal memuat konfigurasi soal.");
      Config = await response.json();
    } catch (error) {
      alert("Terjadi kesalahan fatal saat memuat data ujian.");
      console.error(error);
      return;
    }

    const savedState = sessionStorage.getItem(`cbt_state_${UserData.kodeKegiatan}`);
    if (savedState) {
      State = JSON.parse(savedState);
    } else {
      setupInitialState();
    }

    renderHeader();
    renderSubtestTabs();
    renderGrid();
    loadQuestion(State.currentIndex);

    startTimer();
  }

  function setupInitialState() {
    State.startTimestamp = Date.now();
    State.elapsedSeconds = 0;
    
    let questions = Config.questions || [];
    let initialOrder = questions.map((_, index) => index);

    if (Config.exam_rules?.randomize_questions) {
      for (let i = initialOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]];
      }
    }
    State.questionOrder = initialOrder;

    questions.forEach((q) => {
      State.timeLogs[q.question_id] = 0;
      
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
  // 4. LOAD QUESTION & MATHJAX TRIGGER
  // --------------------------------------------------------------------------
  function loadQuestion(displayIndex) {
    const realIndex = State.questionOrder[displayIndex];
    const q = Config.questions[realIndex];
    const qId = q.question_id;
    
    document.getElementById('q-num').textContent = displayIndex + 1;
    
    const badgesHtml = `
      ${q.section_name ? `<span class="badge-tag badge-section">📘 ${q.section_name}</span>` : ''}
      ${q.subtest_name ? `<span class="badge-tag badge-subtest">📌 ${q.subtest_name}</span>` : ''}
      ${q.level ? `<span class="badge-tag badge-level ${q.level === 'H' ? 'hard' : q.level === 'M' ? 'medium' : 'easy'}">🔥 LVL: ${q.level}</span>` : ''}
      <span class="badge-tag badge-tipe">📝 TIPE: ${q.tipe || '1A'}</span>
    `;
    document.getElementById('q-badges-container').innerHTML = badgesHtml;

    // Render Teks Soal murni tanpa manipulasi regex perusak
    document.getElementById('q-text').innerHTML = formatLatexText(q.soal);

    const imgBox = document.getElementById('q-image-container');
    if (q.gambar && q.gambar !== "") {
      imgBox.innerHTML = `<img src="${q.gambar}" class="img-soal" alt="Gambar Pendukung">`;
    } else {
      imgBox.innerHTML = '';
    }

    // Render Opsi Berdasarkan Tipe Soal
    const optBox = document.getElementById('options-box');
    optBox.innerHTML = '';
    const tipe = (q.tipe || "1A").toUpperCase();
    const currentAns = State.answers[qId];

    if (["1A", "1B", "1C", "5A"].includes(tipe)) {
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
          <span class="opt-val">${formatLatexText(optData.text)}</span>
        `;
        row.onclick = () => saveAnswer(qId, key);
        optBox.appendChild(row);
      });
    } 
    else if (tipe === "2A") {
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
          <span class="opt-val">${formatLatexText(optData.text)}</span>
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
      let ansArr = Array.isArray(currentAns) ? currentAns : [];
      let tableHtml = `<div class="matrix-container"><table class="matrix-table">
        <thead><tr><th style="text-align:left;">Pernyataan</th><th>Benar (B)</th><th>Salah (S)</th></tr></thead><tbody>`;
      
      q.options.forEach((opt, idx) => {
        const choice = ansArr[idx] || "";
        tableHtml += `
          <tr>
            <td>${idx+1}. ${formatLatexText(opt.text)}</td>
            <td class="matrix-radio-cell"><input type="radio" name="mtx_${qId}_${idx}" value="B" ${choice === 'B' ? 'checked' : ''} onchange="window.CBTEngine.saveMatrix('${qId}', ${idx}, 'B', ${q.options.length})"></td>
            <td class="matrix-radio-cell"><input type="radio" name="mtx_${qId}_${idx}" value="S" ${choice === 'S' ? 'checked' : ''} onchange="window.CBTEngine.saveMatrix('${qId}', ${idx}, 'S', ${q.options.length})"></td>
          </tr>
        `;
      });
      tableHtml += `</tbody></table></div>`;
      optBox.innerHTML = tableHtml;
    }

    // Update Navigasi
    document.getElementById('chk-doubt').checked = !!State.doubt[qId];
    document.getElementById('btn-prev').disabled = (displayIndex === 0);
    document.getElementById('btn-next').disabled = (displayIndex === State.questionOrder.length - 1);

    document.querySelectorAll('.circle-btn').forEach((el, i) => {
      const iterQId = Config.questions[State.questionOrder[i]].question_id;
      el.className = getGridClass(i, iterQId);
    });

    // PANGGIL MATHJAX TYPESETPROMISE SECARA EKSPLISIT
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetClear(); // Clear cache typeset sebelumnya
      window.MathJax.typesetPromise([
        document.getElementById('q-text'), 
        document.getElementById('options-box')
      ]).catch(err => console.warn("MathJax Typeset Error:", err));
    }
  }

  function saveAnswer(qId, value) {
    if (value === null) delete State.answers[qId];
    else State.answers[qId] = value;
    
    saveState();
    if (document.getElementById('input-short')) {
       updateGridStats();
       document.getElementById(`grid-circle-${State.currentIndex}`).className = getGridClass(State.currentIndex, qId);
    } else {
       loadQuestion(State.currentIndex);
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

  function startTimer() {
    const durasiTotalSec = (Config.total_timer_menit || 120) * 60;
    
    timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - State.startTimestamp) / 1000);
      State.elapsedSeconds = elapsed;
      
      const sisaDetik = Math.max(0, durasiTotalSec - elapsed);
      updateTimerUI(sisaDetik);

      const activeQId = Config.questions[State.questionOrder[State.currentIndex]].question_id;
      State.timeLogs[activeQId] = (State.timeLogs[activeQId] || 0) + 1;
      
      if (elapsed % 5 === 0) saveState();

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
    if (timerEl) timerEl.textContent = display;
    
    if (sisaDetik <= 300) timerEl?.classList.add('timer-warning');
    else timerEl?.classList.remove('timer-warning');
  }

  function openExitModal() {
    document.getElementById('modal-exit')?.classList.remove('hidden');
  }

  function closeExitModal() {
    document.getElementById('modal-exit')?.classList.add('hidden');
  }

  function executeExitWithoutSubmit() {
    if (timerInterval) clearInterval(timerInterval);
    
    sessionStorage.removeItem(`cbt_state_${UserData.kodeKegiatan}`);
    sessionStorage.removeItem('cbt_security_warning_count');
    sessionStorage.removeItem('cbt_security_logs');
    
    window.location.replace('../guide/guidetest.html');
  }

  function openConfirmModal() {
    const stats = updateGridStats();
    document.getElementById('sum-total').textContent = stats.total;
    document.getElementById('sum-dijawab').textContent = stats.answeredCount;
    document.getElementById('sum-kosong').textContent = stats.total - stats.answeredCount;
    
    if (stats.answeredCount < stats.total) {
      document.getElementById('sum-warning-text')?.classList.remove('hidden');
    } else {
      document.getElementById('sum-warning-text')?.classList.add('hidden');
    }
    
    document.getElementById('modal-confirm')?.classList.remove('hidden');
  }

  function closeConfirmModal() {
    document.getElementById('modal-confirm')?.classList.add('hidden');
  }

  function executeSubmit(isAuto = false) {
    document.getElementById('modal-confirm')?.classList.add('hidden');
    document.getElementById('loading-overlay')?.classList.remove('hidden');
    clearInterval(timerInterval);

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

    if (window.ScoringEngine && typeof window.ScoringEngine.calculateAndTransmit === 'function') {
      window.ScoringEngine.calculateAndTransmit(Config, UserData, RawDataPayload);
    } else {
      console.error("[CRITICAL] ScoringEngine tidak ditemukan!");
      alert("Terjadi kesalahan sistem: Engine Penilaian tidak merespons.");
    }
  }

  return {
    init,
    saveMatrix,
    clearAnswer,
    toggleDoubt,
    navigasi,
    setFontSize,
    bukaModalKeluar: openExitModal,
    tutupModalKeluar: closeExitModal,
    eksekusiKeluarUjian: executeExitWithoutSubmit,
    bukaModalKonfirmasi: openConfirmModal,
    tutupModalKonfirmasi: closeConfirmModal,
    eksekusiSubmitUjian: () => executeSubmit(false)
  };

})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('cbt-exam-root')) {
    window.CBTEngine = CBTEngine;
    CBTEngine.init();
  }
});

window.clearAnswer = () => window.CBTEngine.clearAnswer();
window.toggleDoubt = () => window.CBTEngine.toggleDoubt();
window.navigasi = (arah) => window.CBTEngine.navigasi(arah);
window.setFontSize = (size) => window.CBTEngine.setFontSize(size);
window.bukaModalKeluar = () => window.CBTEngine.bukaModalKeluar();
window.tutupModalKeluar = () => window.CBTEngine.tutupModalKeluar();
window.eksekusiKeluarUjian = () => window.CBTEngine.eksekusiKeluarUjian();
window.bukaModalKonfirmasi = () => window.CBTEngine.bukaModalKonfirmasi();
window.tutupModalKonfirmasi = () => window.CBTEngine.tutupModalKonfirmasi();
window.eksekusiSubmitUjian = () => window.CBTEngine.eksekusiSubmitUjian();
