/**
 * ==============================================================================
 * security.js - PROCTORING & ANTI-CHEAT ENGINE (V3 ISOLATED)
 * Tab Lock, Fullscreen Enforcement, Shortcut Blocking, & Strict 3x Counter
 * ==============================================================================
 */

const SecurityEngine = (function () {
  // --------------------------------------------------------------------------
  // 1. STATE & CONFIGURATION
  // --------------------------------------------------------------------------
  const MAX_WARNINGS = 3;
  let warningCount = 0;
  let warningLogs = [];
  let isWarningActive = false;
  let lastViolationTimestamp = 0;
  let blurDebounceTimer = null;
  let isProctoringActive = false; // Akan diaktifkan jika JSON exam_rules mengizinkan

  // Kunci Penyimpanan Terisolasi
  const SESSION_KEY_COUNT = 'cbt_security_warning_count';
  const SESSION_KEY_LOGS = 'cbt_security_logs';

  // --------------------------------------------------------------------------
  // 2. INISIALISASI & SINKRONISASI STATE
  // --------------------------------------------------------------------------
  function init(examRules = {}) {
    console.log("[SECURITY-ENGINE] Menginisialisasi sistem pengawasan proctoring...");

    // Cek Rule dari JSON (Fallback ke true untuk keamanan maksimal jika tidak didefinisikan)
    const blockCopyPaste = examRules.block_copy_paste !== false;
    isProctoringActive = examRules.enable_proctoring_tab_lock !== false;

    // Sinkronisasi dengan Session Storage (Jika halaman tak sengaja ter-refresh)
    const savedCount = parseInt(sessionStorage.getItem(SESSION_KEY_COUNT), 10);
    warningCount = !isNaN(savedCount) ? savedCount : 0;
    
    try {
      const savedLogs = sessionStorage.getItem(SESSION_KEY_LOGS);
      if (savedLogs) warningLogs = JSON.parse(savedLogs);
    } catch (e) {
      warningLogs = [];
    }

    // Terapkan Aturan Keamanan Dasar (Blokir Klik Kanan & Copy Paste)
    if (blockCopyPaste) {
      document.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("copy", (e) => e.preventDefault());
      document.addEventListener("cut", (e) => e.preventDefault());
      document.addEventListener("paste", (e) => e.preventDefault());
    }

    // Aktifkan Deteksi Keluar Tab / Kehilangan Fokus jika Proctoring Aktif
    if (isProctoringActive) {
      attachProctoringListeners();
    }
  }

  // --------------------------------------------------------------------------
  // 3. TEXT-TO-SPEECH (AUDIO PERINGATAN)
  // --------------------------------------------------------------------------
  function playVoiceWarning(text) {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.1; // Sedikit dinaikkan agar terdengar lebih tegas
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("[SECURITY-ENGINE] TTS gagal dimainkan:", e);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. PENANGANAN PELANGGARAN (CORE LOGIC)
  // --------------------------------------------------------------------------
  function triggerViolation(alasan) {
    const now = Date.now();
    
    // Cooldown 1.5 detik mencegah double-trigger (misal blur + visibilitychange berbarengan)
    if (now - lastViolationTimestamp < 1500) return;
    
    // Jangan proses jika modal keamanan sedang tampil atau ujian sudah submit
    if (isWarningActive || document.getElementById('loading-overlay').classList.contains('hidden') === false) return;

    isWarningActive = true;
    lastViolationTimestamp = now;
    warningCount += 1;

    // Catat Log
    const timestampISO = new Date().toISOString();
    warningLogs.push({
      peringatan_ke: warningCount,
      waktu: new Date().toLocaleTimeString('id-ID'),
      timestamp: timestampISO,
      alasan: alasan
    });

    // Simpan ke Session Storage
    sessionStorage.setItem(SESSION_KEY_COUNT, warningCount.toString());
    sessionStorage.setItem(SESSION_KEY_LOGS, JSON.stringify(warningLogs));

    // Eksekusi UI Modal Peringatan
    showSecurityModal(alasan);
  }

  function showSecurityModal(alasan) {
    const modal = document.getElementById('modal-security-warning');
    const titleEl = document.getElementById('sec-title');
    const reasonEl = document.getElementById('sec-reason');
    const countEl = document.getElementById('sec-count');
    const maxEl = document.getElementById('sec-max');
    const subtextEl = document.getElementById('sec-subtext');
    const btnAck = document.getElementById('btn-sec-ack');

    // Update Text Modal
    reasonEl.textContent = `Aktivitas Ilegal: ${alasan}`;
    countEl.textContent = warningCount;
    maxEl.textContent = MAX_WARNINGS;

    modal.classList.remove('hidden');

    if (warningCount >= MAX_WARNINGS) {
      // BATAS MAKSIMAL TERCAPAI - AUTO SUBMIT!
      titleEl.textContent = "UJIAN DIAKHIRI OTOMATIS!";
      subtextEl.textContent = "Batas toleransi kecurangan telah habis. Sistem sedang mengirim jawaban Anda ke server...";
      subtextEl.style.color = "#dc2626";
      subtextEl.style.fontWeight = "bold";
      
      btnAck.classList.add('hidden'); // Hilangkan tombol kembali
      
      playVoiceWarning("Batas toleransi habis! Ujian Anda otomatis diakhiri karena pelanggaran keamanan.");

      // Delay 3 detik agar peserta sadar, lalu panggil auto-submit
      setTimeout(() => {
        modal.classList.add('hidden');
        if (window.CBTEngine && typeof window.CBTEngine.eksekusiSubmitUjian === 'function') {
          window.CBTEngine.eksekusiSubmitUjian(true); // Parameter true menandakan auto-submit
        } else {
          alert("Force Submit Gagal Dijalankan!");
        }
      }, 3500);

    } else {
      // HANYA PERINGATAN (Belum Maksimal)
      titleEl.textContent = "PERINGATAN KECURANGAN!";
      subtextEl.textContent = "Jika mencapai batas maksimal 3x, ujian Anda akan dikunci dan disubmit otomatis.";
      subtextEl.style.color = "#7f1d1d";
      btnAck.classList.remove('hidden');

      playVoiceWarning(`Peringatan ke ${warningCount}. Dilarang berpindah halaman atau keluar dari aplikasi!`);
    }
  }

  function closeModal() {
    document.getElementById('modal-security-warning').classList.add('hidden');
    // Beri jeda sedikit agar tidak langsung memicu pelanggaran lagi setelah modal tertutup
    setTimeout(() => {
      isWarningActive = false;
      enforceFullscreen();
    }, 500);
  }

  // --------------------------------------------------------------------------
  // 5. EVENT LISTENERS PENGINTAI (PROCTORING)
  // --------------------------------------------------------------------------
  function attachProctoringListeners() {
    
    // A. Deteksi Pindah Tab / Membuka Window Lain
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !isWarningActive) {
        triggerViolation("Meninggalkan Tab Browser Ujian");
      }
    });

    // B. Deteksi Alt+Tab / Hilang Fokus Aplikasi
    window.addEventListener("blur", () => {
      clearTimeout(blurDebounceTimer);
      blurDebounceTimer = setTimeout(() => {
        if (!document.hasFocus() && !document.hidden && !isWarningActive) {
          triggerViolation("Fokus Layar Terlepas (Alt+Tab / Split Screen)");
        }
      }, 800);
    });

    window.addEventListener("focus", () => {
      clearTimeout(blurDebounceTimer);
    });

    // C. Deteksi Keluar Fullscreen (Jika browser mendukung)
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && !isWarningActive) {
        triggerViolation("Keluar dari Mode Layar Penuh (Fullscreen)");
      }
    });

    // D. Pemblokiran Shortcut Keyboard Terlarang
    document.addEventListener("keydown", (e) => {
      // 1. Blokir Inspect Element (F12)
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation("Mencoba Membuka DevTools (F12)");
        return false;
      }
      
      // 2. Blokir Inspect Element (Ctrl+Shift+I / J / C)
      if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
        e.preventDefault();
        triggerViolation("Mencoba Membuka Inspect Element");
        return false;
      }

      // 3. Blokir PrintScreen & Screenshot (Win+Shift+S)
      if (e.key === "PrintScreen" || e.keyCode === 44 || (e.metaKey && e.shiftKey && (e.key === "S" || e.key === "s"))) {
        e.preventDefault();
        triggerViolation("Mencoba Mengambil Tangkapan Layar (Screenshot)");
        return false;
      }
    });
  }

  // Utilitas Memaksa Fullscreen Kembali
  function enforceFullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        console.warn("Fullscreen dibatalkan oleh browser.");
      });
    }
  }

  // Getter Data untuk Payload Scoring
  function getLogs() {
    return warningLogs;
  }

  // Expose API
  return {
    init,
    tutupModal: closeModal,
    getLogs
  };

})();

// --------------------------------------------------------------------------
// 6. AUTO-INIT & BINDING KE HTML
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('cbt-exam-root')) {
    window.SecurityEngine = SecurityEngine;
    
    // Inisialisasi secara default. Jika butuh baca dari JSON, 
    // CBTEngine akan memanggil ulang SecurityEngine.init(Config.exam_rules)
    SecurityEngine.init({
      block_copy_paste: true,
      enable_proctoring_tab_lock: true 
    });
  }
});

// Alias Fungsi untuk Tombol di HTML Modal
window.tutupModalSecurity = () => {
  if (window.SecurityEngine) window.SecurityEngine.tutupModal();
};
