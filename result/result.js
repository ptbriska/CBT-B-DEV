/**
 * ==============================================================================
 * result.js - RESULT SUMMARY & TEASER CONTROLLER (V3 ISOLATED)
 * Mengelola Tampilan Nilai Akhir, Teaser 3 Soal, & Paywall Token Pembahasan
 * ==============================================================================
 */

(function () {
  let ResultData = null;
  let ConfigJSON = null;

  async function initResultPage() {
    console.log("[RESULT-MODULE] Menginisialisasi halaman hasil...");

    // 1. Ambil data hasil kalkulasi dari SessionStorage
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('cbt_last_result'));
    if (keys.length === 0) {
      alert("Data hasil ujian tidak ditemukan. Anda akan diarahkan kembali.");
      window.location.href = "../guide/guidetest.html";
      return;
    }

    const rawResult = sessionStorage.getItem(keys[0]);
    ResultData = JSON.parse(rawResult);

    // 2. Load JSON konfigurasi soal untuk mengambil teks pembahasan lengkap
    try {
      const response = await fetch(`../database-soal/${ResultData.kode_ujian}.json`);
      if (response.ok) {
        ConfigJSON = await response.json();
      }
    } catch (e) {
      console.warn("Gagal memuat JSON konfigurasi soal untuk preview pembahasan.", e);
    }

    // 3. Render Komponen Tampilan
    renderKopAndUser();
    renderScoreSummary();
    renderSecurityLogs();
    renderTeaserPreview();

    // 4. Trigger MathJax jika ada rumus
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(err => console.warn("MathJax Error:", err));
    }
  }

  function renderKopAndUser() {
    if (ConfigJSON) {
      document.getElementById('res-lembaga').textContent = ConfigJSON.lembaga || "BRISKA EDUCATION CORPORATION";
      document.getElementById('res-nama-kegiatan').textContent = ConfigJSON.nama_kegiatan || ResultData.kode_ujian;
      document.getElementById('res-alamat').textContent = ConfigJSON.alamat_lembaga || "";
      if (ConfigJSON.logo) document.getElementById('res-logo').src = ConfigJSON.logo;
    }

    const userDataRaw = sessionStorage.getItem('cbt_auth_user');
    const userData = userDataRaw ? JSON.parse(userDataRaw) : {};

    document.getElementById('res-user-name').textContent = userData.namaLengkap || ResultData.student_id;
    document.getElementById('res-user-id').textContent = ResultData.student_id;
    document.getElementById('res-kode-ujian').textContent = ResultData.kode_ujian;
    document.getElementById('res-timestamp').textContent = new Date(ResultData.timestamp_submit).toLocaleString('id-ID');
  }

  function renderScoreSummary() {
    document.getElementById('res-total-score').textContent = ResultData.skor_akhir;
    document.getElementById('res-max-score').textContent = ResultData.skor_maksimal;
    document.getElementById('res-accuracy').textContent = ResultData.akurasi_persen + "%";

    document.getElementById('res-count-benar').textContent = ResultData.benar;
    document.getElementById('res-count-salah').textContent = ResultData.salah;
    document.getElementById('res-count-kosong').textContent = ResultData.kosong;

    // Format Durasi
    const sec = ResultData.duration_seconds || 0;
    const mnt = Math.floor(sec / 60);
    const dtk = sec % 60;
    document.getElementById('res-duration').textContent = `${mnt}m ${dtk}s`;
  }

  function renderSecurityLogs() {
    const secLogs = ResultData.security_logs || [];
    const banner = document.getElementById('sec-warning-banner');
    if (secLogs.length > 0) {
      banner.classList.remove('hidden');
      const text = secLogs.map(l => `[#${l.peringatan_ke || 1}] ${l.alasan || 'Pelanggaran'}`).join(' ; ');
      document.getElementById('res-sec-logs-text').textContent = text;
    } else {
      banner.classList.add('hidden');
    }
  }

  function renderTeaserPreview() {
    const responses = ResultData.rincian_jawaban || [];
    const questionsList = ConfigJSON ? (ConfigJSON.questions || []) : [];
    const teaserContainer = document.getElementById('teaser-soal-list');
    teaserContainer.innerHTML = '';

    // Ambil maksimal 3 soal pertama untuk teaser
    const teaserResponses = responses.slice(0, 3);
    const totalSoal = responses.length;
    document.getElementById('res-sisa-soal-count').textContent = Math.max(0, totalSoal - 3);

    // Set Link WA Admin
    const waKode = encodeURIComponent(ResultData.kode_ujian);
    document.getElementById('link-wa-admin').href = `https://wa.me/6285711000363?text=Halo%20Admin,%20saya%20mau%20beli%20Token%20Pembahasan%20untuk%20kode%20ujian%20${waKode}`;

    teaserResponses.forEach((resp, idx) => {
      const qConfig = questionsList.find(q => q.question_id === resp.question_id) || {};
      const soalText = qConfig.soal || `Soal No. ${resp.question_order}`;
      const pembahasanText = qConfig.pembahasan || "Belum ada pembahasan tertulis.";

      const card = document.createElement('div');
      card.className = 'card-teaser-soal';
      card.innerHTML = `
        <div class="teaser-badges">
          <span class="badge-meta">Soal No. ${resp.question_order}</span>
          <span class="badge-meta">Tipe: ${resp.tipe}</span>
          <span class="badge-meta">Level: ${resp.difficulty}</span>
          <span class="badge-meta" style="color:${resp.is_correct ? 'var(--success)' : 'var(--danger)'}">
            ${resp.is_correct ? '✓ BENAR' : '❌ SALAH'}
          </span>
        </div>
        <div class="soal-text-body">${soalText}</div>
        <div class="box-jawaban-comparison">
          <div><strong>Jawaban Anda:</strong> ${resp.selected_answer || '<span style="color:var(--danger)">Tidak Dijawab</span>'}</div>
          <div><strong>Kunci Jawaban:</strong> <span style="color:var(--success); font-weight:bold;">${resp.correct_answer}</span></div>
        </div>
        <div class="box-pembahasan">
          <strong>💡 Pembahasan:</strong><br>${pembahasanText}
        </div>
      `;
      teaserContainer.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // PAYWALL TOKEN VERIFICATION HANDLER
  // --------------------------------------------------------------------------
  window.verifikasiTokenPembahasan = function () {
    const inputEl = document.getElementById('input-token-pembahasan');
    if (!inputEl) return;

    const typedToken = inputEl.value.trim().toUpperCase();
    const targetToken = ConfigJSON ? (ConfigJSON.token_pembahasan || "").trim().toUpperCase() : "";

    if (!typedToken) {
      alert("⚠️ Silakan masukkan token pembahasan terlebih dahulu.");
      return;
    }

    if (targetToken !== "" && typedToken === targetToken) {
      alert("🎉 Token Valid! Membuka Full Student Report...");
      
      // Tandai status unlocked di sessionStorage
      sessionStorage.setItem(`cbt_report_unlocked_${ResultData.kode_ujian}`, "true");
      
      // Redirect ke modul Rapor Lengkap
      window.location.href = "../report/report.html";
    } else {
      alert("❌ Token Salah! Silakan periksa kembali token yang Anda masukkan atau hubungi admin.");
      inputEl.focus();
    }
  };

  window.kembaliKeGuide = function () {
    window.location.href = "../guide/guidetest.html";
  };

  document.addEventListener('DOMContentLoaded', initResultPage);
})();
