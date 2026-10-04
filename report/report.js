/**
 * ==============================================================================
 * report.js - FULL STUDENT REPORT GENERATOR ENGINE (V3 ISOLATED)
 * Menangani Rapor Lengkap, Visualisasi Metrik, & Review Pembahasan 8 Tipe Soal
 * ==============================================================================
 */

(function () {

  // HELPER FORMATTERS
  function formatKunciReport(kunci) {
    if (Array.isArray(kunci)) return kunci.join(", ");
    if (typeof kunci === "object" && kunci !== null) {
      return Object.entries(kunci).map(([k, v]) => `${k} = ${v}`).join(" | ");
    }
    return String(kunci || "-");
  }

  function formatUserAnswerReport(ans) {
    if (ans === undefined || ans === null || ans === "" || ans === "-") return "Tidak Diisi";
    if (Array.isArray(ans)) return ans.join(", ");
    if (typeof ans === "object" && ans !== null) {
      return Object.entries(ans).map(([k, v]) => `${k}: ${v}`).join(" | ");
    }
    return String(ans);
  }

  function formatTimeDuration(seconds) {
    if (!seconds || seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // HELPER RENDER OPTION / TABLE UNTUK PEMBAHASAN BERDASARKAN TIPE SOAL (1A - 5A)
  function renderOptionsByQuestionType(qConfig, resp) {
    const tipe = String(resp.tipe || "1A").toUpperCase();
    const options = qConfig.options || [];

    // TIPE 3A / 3B (Short Answer) -> Tanpa list opsi
    if (tipe === "3A" || tipe === "3B") return '';

    // TIPE 4A (Matrix True/False) -> Render Tabel Matrix
    if (tipe === "4A") {
      let kunciArr = Array.isArray(qConfig.kunci) ? qConfig.kunci : [];
      let userAnsArr = Array.isArray(resp.selected_answer) ? resp.selected_answer : String(resp.selected_answer || '').split(',').map(s => s.trim());

      return `
        <div class="table-responsive">
          <table class="premium-table compact-table">
            <thead>
              <tr>
                <th style="width:40px;">No</th>
                <th>Pernyataan</th>
                <th style="width:110px; color:var(--danger);">Jawaban Anda</th>
                <th style="width:90px; color:var(--success);">Kunci</th>
              </tr>
            </thead>
            <tbody>
              ${options.map((opt, sIdx) => {
                const uVal = userAnsArr[sIdx] || 'Kosong';
                const kVal = kunciArr[sIdx] || '-';
                const isMatch = String(uVal).toUpperCase() === String(kVal).toUpperCase();
                return `
                  <tr>
                    <td>${sIdx + 1}</td>
                    <td>${opt.text}</td>
                    <td style="color:${isMatch ? 'var(--success)' : 'var(--danger)'}; font-weight:bold;">${uVal}</td>
                    <td style="color:var(--success); font-weight:bold;">${kVal}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // TIPE 5A (Weighted Likert) -> Render Tabel Bobot Poin
    if (tipe === "5A") {
      const bobotMap = (typeof qConfig.kunci === "object" && !Array.isArray(qConfig.kunci)) ? qConfig.kunci : {};
      const userChoice = String(resp.selected_answer || "").toUpperCase();

      return `
        <div class="table-responsive">
          <table class="premium-table compact-table">
            <thead>
              <tr>
                <th style="width:50px;">Opsi</th>
                <th>Pernyataan Pilihan</th>
                <th style="width:90px;">Bobot Poin</th>
              </tr>
            </thead>
            <tbody>
              ${options.map(opt => {
                const weight = bobotMap[opt.key] !== undefined ? bobotMap[opt.key] : 0;
                const isSelected = userChoice === opt.key;
                return `
                  <tr style="${isSelected ? 'background:#fef08a;' : ''}">
                    <td><strong>${opt.key}</strong></td>
                    <td>${opt.text}</td>
                    <td><strong>${weight} Poin</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // TIPE 1A, 1B, 1C, 2A (Single Choice & Multiple Response)
    let userAnsArr = Array.isArray(resp.selected_answer) 
      ? resp.selected_answer.map(String) 
      : [String(resp.selected_answer)];
      
    let keyArr = Array.isArray(qConfig.kunci) 
      ? qConfig.kunci.map(String) 
      : [String(qConfig.kunci)];

    return `
      <div style="margin-top:10px;">
        ${options.map(opt => {
          const isKey = keyArr.includes(opt.key);
          const isUser = userAnsArr.includes(opt.key);

          let optStyle = "padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 6px; font-size: 0.85rem;";
          let badge = "";

          if (isKey && isUser) {
            optStyle = "padding: 8px 12px; border: 1.5px solid var(--success); background: #dcfce7; border-radius: 6px; margin-bottom: 6px; font-size: 0.85rem; color:#14532d;";
            badge = `<span style="float:right; background:var(--success); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">✓ Benar</span>`;
          } else if (isKey) {
            optStyle = "padding: 8px 12px; border: 1.5px solid var(--success); border-radius: 6px; margin-bottom: 6px; font-size: 0.85rem; color:#14532d;";
            badge = `<span style="float:right; background:var(--success); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">KUNCI</span>`;
          } else if (isUser) {
            optStyle = "padding: 8px 12px; border: 1.5px solid var(--danger); background: #fee2e2; border-radius: 6px; margin-bottom: 6px; font-size: 0.85rem; color:#7f1d1d;";
            badge = `<span style="float:right; background:var(--danger); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">Pilihan Anda</span>`;
          }

          return `
            <div style="${optStyle}">
              <strong>${opt.key}.</strong> ${opt.text}${badge}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // FUNGSI UTAMA RENDER RAPOR SISWA
  async function renderFullStudentReport() {
    const container = document.getElementById("pembahasan-container");
    if (!container) return;

    // 1. Ambil Data Hasil dari SessionStorage
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('cbt_last_result'));
    let resultData = null;

    if (keys.length > 0) {
      resultData = JSON.parse(sessionStorage.getItem(keys[0]));
    } else {
      const storedReport = JSON.parse(localStorage.getItem("cbt_report_data") || "{}");
      if (storedReport && storedReport.soalData) {
        resultData = storedReport;
      }
    }

    if (!resultData) {
      container.innerHTML = `
        <div class="card-box empty-state" style="text-align:center; padding: 40px;">
          <i class="fas fa-exclamation-triangle empty-icon text-danger" style="font-size:2.5rem; margin-bottom:12px;"></i>
          <h3>Data Rapor & Pembahasan Tidak Ditemukan</h3>
          <p>Silakan selesaikan ujian atau verifikasi token pembahasan terlebih dahulu.</p>
          <button onclick="window.close()" class="btn-print" style="position:static; transform:none; margin-top:16px;">Tutup Halaman</button>
        </div>
      `;
      return;
    }

    // Load JSON Konfigurasi Soal
    let configJSON = {};
    try {
      const res = await fetch(`../database-soal/${resultData.kode_ujian}.json`);
      if (res.ok) configJSON = await res.json();
    } catch (e) {
      console.warn("Gagal memuat JSON Soal untuk pembahasan lengkap.", e);
    }

    const responses = resultData.rincian_jawaban || [];
    const questionsList = configJSON.questions || [];

    // Agregasi Subtest & Section
    const subtestStats = {};
    const sectionStats = {};

    responses.forEach(r => {
      const st = r.section_id || "Umum"; // Gunakan Subtest/Section
      const sec = r.topic_name || "Umum";

      // Subtest Stats
      if (!subtestStats[st]) subtestStats[st] = { total: 0, benar: 0, salah: 0, kosong: 0 };
      subtestStats[st].total++;
      if (r.is_correct) subtestStats[st].benar++;
      else if (r.selected_answer === "-" || !r.selected_answer) subtestStats[st].kosong++;
      else subtestStats[st].salah++;

      // Section/Topic Stats
      if (!sectionStats[sec]) sectionStats[sec] = { total: 0, benar: 0, salah: 0, kosong: 0 };
      sectionStats[sec].total++;
      if (r.is_correct) sectionStats[sec].benar++;
      else if (r.selected_answer === "-" || !r.selected_answer) sectionStats[sec].kosong++;
      else sectionStats[sec].salah++;
    });

    const userProfileRaw = sessionStorage.getItem('cbt_auth_user');
    const userProfile = userProfileRaw ? JSON.parse(userProfileRaw) : {};

    const avgTimeSec = responses.length > 0 ? Math.round((resultData.duration_seconds || 0) / responses.length) : 0;

    // 2. RAKIT HTML
    let html = `
      <div class="premium-report-wrapper">

        <!-- KOP SURAT CBT -->
        <div class="report-header-card">
          ${configJSON.logo ? `<img src="${configJSON.logo}" class="brand-logo" alt="Logo">` : ''}
          <div class="brand-text-center">
            <h1 class="cbt-title">${configJSON.nama_sistem_cbt || 'CBT SYSTEM V3'}</h1>
            <h2 class="lembaga-title">${configJSON.lembaga || 'BRISKA EDUCATION CORPORATION'}</h2>
            <p class="alamat-text">${configJSON.alamat_lembaga || '-'}</p>
          </div>
          <button onclick="window.print()" class="btn-print">
            <i class="fas fa-print"></i> Cetak / Print PDF
          </button>
        </div>

        <hr style="border:0; border-top:2px solid var(--border-color); margin:16px 0;">

        <div class="report-main-title">
          <h1>LAPORAN HASIL UJIAN & PEMBAHASAN</h1>
        </div>

        <!-- IDENTITAS PESERTA -->
        <div class="card-box">
          <h3 style="font-size:1rem; font-weight:700; color:var(--text-dark); margin-bottom:10px;">📌 Identitas Peserta Tes</h3>
          <div class="identity-grid">
            <div class="id-item"><span>Nama Peserta:</span> <strong>${userProfile.namaLengkap || resultData.student_id}</strong></div>
            <div class="id-item"><span>ID / Username:</span> <strong>${resultData.student_id}</strong></div>
            <div class="id-item"><span>Kode Ujian:</span> <strong>${resultData.kode_ujian}</strong></div>
            <div class="id-item"><span>Nama Kegiatan:</span> <strong>${configJSON.nama_kegiatan || resultData.kode_ujian}</strong></div>
            <div class="id-item"><span>Total Durasi:</span> <strong>${formatTimeDuration(resultData.duration_seconds)} / ${configJSON.total_timer_menit || 120} Menit</strong></div>
          </div>
        </div>

        <!-- DASHBOARD SKOR -->
        <div class="dashboard-grid">
          <div class="score-card primary">
            <p class="card-label">TOTAL SKOR PEROLEHAN</p>
            <h2 class="card-value">${resultData.skor_akhir} <span class="max-val">/ ${resultData.skor_maksimal}</span></h2>
            <div class="progress-bg"><div class="progress-bar" style="width: ${Math.min((resultData.skor_akhir / (resultData.skor_maksimal || 1)) * 100, 100)}%"></div></div>
          </div>
          <div class="score-card success">
            <p class="card-label">SCORE ACCURACY</p>
            <h2 class="card-value">${resultData.akurasi_persen}%</h2>
            <p class="card-desc">${resultData.benar} dari ${resultData.total_soal} Soal Benar</p>
          </div>
          <div class="score-card info">
            <p class="card-label">AVG TIME / QUESTION</p>
            <h2 class="card-value">${formatTimeDuration(avgTimeSec)}</h2>
            <p class="card-desc">Rata-rata Waktu per Soal</p>
          </div>
          <div class="score-card danger">
            <p class="card-label">SOAL SALAH</p>
            <h2 class="card-value">${resultData.salah}</h2>
            <p class="card-desc">Perlu Evaluasi Ulang</p>
          </div>
          <div class="score-card warning">
            <p class="card-label">TIDAK DIJAWAB</p>
            <h2 class="card-value">${resultData.kosong}</h2>
            <p class="card-desc">Soal Kosong</p>
          </div>
        </div>

        <!-- VISUALISASI GRAFIK CHART.JS -->
        <div class="card-box">
          <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px;">📊 Visualisasi Analisis Performa Peserta</h3>
          <div style="display:grid; grid-template-columns: 1fr 2fr; gap:16px;">
            <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color);">
              <h4 style="text-align:center; font-size:0.82rem; margin-bottom:8px;">Proporsi Jawaban</h4>
              <div style="height:200px; position:relative;">
                <canvas id="chartScorePie"></canvas>
              </div>
            </div>
            <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color);">
              <h4 style="text-align:center; font-size:0.82rem; margin-bottom:8px;">Analisis Waktu Pengerjaan Per Soal (Detik)</h4>
              <div style="height:200px; position:relative;">
                <canvas id="chartTimeLine"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- SUBTEST STRENGTH ANALYSIS -->
        <div class="card-box">
          <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px;">📊 Subtest Strength Analysis</h3>
          <div style="height:180px; margin-bottom:16px;">
            <canvas id="chartSubtestBar"></canvas>
          </div>
          <div class="table-responsive">
            <table class="premium-table">
              <thead>
                <tr>
                  <th>Subtest</th>
                  <th>Jumlah Soal</th>
                  <th>Benar</th>
                  <th>Salah</th>
                  <th>Kosong</th>
                  <th>Akurasi (%)</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(subtestStats).map(([stName, stData]) => {
                  const pct = stData.total > 0 ? ((stData.benar / stData.total) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td><strong>${stName}</strong></td>
                      <td>${stData.total} Soal</td>
                      <td class="text-success font-weight-bold">${stData.benar}</td>
                      <td class="text-danger">${stData.salah}</td>
                      <td class="text-muted">${stData.kosong}</td>
                      <td>
                        <div class="progress-mini">
                          <div class="progress-mini-bar ${pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger'}" style="width: ${pct}%"></div>
                        </div>
                        <small>${pct}%</small>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- LOG REVIEW TABEL COMPACT -->
        <div class="card-box">
          <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px;">📋 Log Rekap Pengerjaan Soal</h3>
          <div class="table-responsive">
            <table class="premium-table compact-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tipe</th>
                  <th>Level</th>
                  <th>Section</th>
                  <th>Topik</th>
                  <th>Jawaban Anda</th>
                  <th>Kunci Jawaban</th>
                  <th>Skor</th>
                  <th>Durasi</th>
                </tr>
              </thead>
              <tbody>
                ${responses.map(r => `
                  <tr>
                    <td><strong>${r.question_order}</strong></td>
                    <td>${r.tipe}</td>
                    <td>${r.difficulty}</td>
                    <td>${r.section_id}</td>
                    <td>${r.topic_name}</td>
                    <td>${formatUserAnswerReport(r.selected_answer)}</td>
                    <td>${formatKunciReport(r.correct_answer)}</td>
                    <td><strong>+${r.score_acquired}</strong></td>
                    <td>${formatTimeDuration(r.time_spent_seconds)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- QUESTION REVIEW & PEMBAHASAN LENGKAP -->
        <div class="card-box">
          <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:16px;">📝 Question Review & Pembahasan Lengkap</h3>
          <div>
            ${responses.map(resp => {
              const qConfig = questionsList.find(q => q.question_id === resp.question_id) || {};
              let badgeClass = 'bg-muted', icon = '➖';
              if (resp.is_correct) { badgeClass = 'bg-success'; icon = '✓'; }
              else if (resp.selected_answer && resp.selected_answer !== '-') { badgeClass = 'bg-danger'; icon = '✗'; }

              const optionsHTML = renderOptionsByQuestionType(qConfig, resp);
              const soalText = qConfig.soal || `Soal No. ${resp.question_order}`;
              const pembahasanText = qConfig.pembahasan || "Penjelasan belum tersedia untuk nomor ini.";

              return `
                <div class="review-card-item">
                  <div class="card-head">
                    <div>
                      <span class="q-number">Soal No. ${resp.question_order}</span>
                      <span class="q-tags">${resp.section_id} • ${resp.topic_name} (Tipe${resp.tipe})</span>
                    </div>
                    <div>
                      <span class="status-badge ${badgeClass}">${icon} Skor: +${resp.score_acquired}</span>
                    </div>
                  </div>

                  <div class="q-text">${soalText}</div>${qConfig.gambar ? `<div class="q-image"><img src="${qConfig.gambar}" alt="Gambar Soal"></div>` : ''}

                  ${optionsHTML}

                  <div style="margin-top:16px; background:#f8fafc; padding:12px; border-radius:6px; border:1px solid var(--border-color);">
                    <h4 style="font-size:0.88rem; color:var(--primary); margin-bottom:6px;">💡 Penjelasan / Pembahasan:</h4>
                    <div style="font-size:0.88rem; color:#1e293b;">${pembahasanText}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- KALIMAT MOTIVASI -->
        ${configJSON.kalimat_motivasi ? `
          <div class="motivation-banner">
            <div class="quote-icon">❝</div>
            <p class="motivation-text">${configJSON.kalimat_motivasi}</p>
          </div>
        ` : ''}

      </div>
    `;

    container.innerHTML = html;

    // Trigger MathJax Typeset
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise().catch(err => console.warn("MathJax error:", err));
    }

    // Render Grafik setelah DOM siap
    setTimeout(() => {
      const itemReviewsForChart = responses.map(r => ({ no: r.question_order, durasiSec: r.time_spent_seconds }));
      if (window.renderReportCharts) {
        window.renderReportCharts(resultData.benar, resultData.salah, resultData.kosong, itemReviewsForChart, subtestStats);
      }
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", renderFullStudentReport);
})();
