/**
 * ==============================================================================
 * scoring.js - PURE CALCULATION ENGINE & ANALYTICS FORMATTER (V3 ISOLATED)
 * Murni Fungsi Kalkulasi Nilai, 8 Tipe Soal, dan Pengiriman Data Webhook
 * ==============================================================================
 */

const ScoringEngine = (function () {
  // Webhook Default GAS (Penerima Data Analitik)
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyRN59LWciJUsqai5Pe3hssSD34hoo-_wv7CoySF8HzLSiOFiC0zYlPJgjIOqFeUt4U/exec";

  /**
   * Fungsi Utama: Menerima config soal, data user, dan jawaban mentah, 
   * lalu menghitung skor, memformat payload, dan mengirim data.
   */
  async function calculateAndTransmit(config, userData, rawPayload) {
    console.log("[SCORING-ENGINE] Memulai kalkulasi nilai & perakitan data analitik...");

    const questions = config.questions || [];
    const rules = config.scoring_rules || {};
    const userAnswers = rawPayload.raw_answers || {};
    const timeLogs = rawPayload.time_logs_per_question || {};

    let totalSkorMurni = 0;
    let totalSkorMaks = 0;
    let jumlahBenar = 0;
    let jumlahSalah = 0;
    let jumlahKosong = 0;

    // Array penyimpan data Learning Analytics Tier 2 (Granular per Soal)
    const responsesAnalytics = [];

    // --------------------------------------------------------------------------
    // 1. ENGINE EVALUASI (LOOP PER SOAL)
    // --------------------------------------------------------------------------
    questions.forEach((q, idx) => {
      const qId = q.question_id;
      const tipe = String(q.tipe || "1A").trim().toUpperCase();
      const userAns = userAnswers[qId];
      const timeSpent = timeLogs[qId] || 0;
      const rule = rules[tipe] || {};

      let pointSoal = 0;
      let maxPointSoal = 0;
      let isCorrect = false;
      let userAnsDisplay = "-";
      let kunciDisplay = "-";

      // A. TIPE 1A, 1B, 1C (Single Choice)
      if (["1A", "1B", "1C"].includes(tipe)) {
        const kunci = String(q.kunci || "").trim().toUpperCase();
        kunciDisplay = kunci || "-";
        
        // Penentuan Max Score berdasarkan Level (Khusus 1C) atau Standar
        if (tipe === "1C") {
          const lvl = String(q.level || "E").trim().toUpperCase();
          const bobotMap = rule.bobot_level || { "E": 1, "M": 3, "H": 5 };
          maxPointSoal = Number(bobotMap[lvl] || 1);
        } else {
          maxPointSoal = Number(rule.skor_benar || 1);
        }

        if (!userAns || String(userAns).trim() === "") {
          jumlahKosong++;
          pointSoal = Number(rule.skor_kosong || 0);
        } else {
          userAnsDisplay = String(userAns).trim().toUpperCase();
          isCorrect = (userAnsDisplay === kunci);
          
          if (isCorrect) {
            jumlahBenar++;
            pointSoal = maxPointSoal;
          } else {
            jumlahSalah++;
            pointSoal = Number(rule.skor_salah || 0);
          }
        }
      } 
      
      // B. TIPE 2A (Multiple Choice - Exact Match Array)
      else if (tipe === "2A") {
        maxPointSoal = Number(rule.skor_benar_semua || 1);
        
        let kunciArr = Array.isArray(q.kunci) ? q.kunci.map(k => String(k).trim().toUpperCase()) : [];
        kunciDisplay = kunciArr.sort().join(", ");
        
        let userAnsArr = Array.isArray(userAns) ? userAns.map(a => String(a).trim().toUpperCase()) : [];
        
        if (userAnsArr.length === 0) {
          jumlahKosong++;
          pointSoal = Number(rule.skor_kosong || 0);
        } else {
          userAnsDisplay = userAnsArr.sort().join(", ");
          isCorrect = (kunciArr.length === userAnsArr.length && kunciArr.every(val => userAnsArr.includes(val)));
          
          if (isCorrect) {
            jumlahBenar++;
            pointSoal = maxPointSoal;
          } else {
            jumlahSalah++;
            pointSoal = Number(rule.skor_salah || 0);
          }
        }
      }

      // C. TIPE 3A & 3B (Short Answer / Isian Singkat)
      else if (tipe === "3A" || tipe === "3B") {
        maxPointSoal = Number(rule.skor_benar || 1);
        let kunciArr = Array.isArray(q.kunci) ? q.kunci.map(k => String(k).trim().toLowerCase()) : [String(q.kunci || "").trim().toLowerCase()];
        kunciDisplay = kunciArr.join(" | ");

        if (!userAns || String(userAns).trim() === "") {
          jumlahKosong++;
          pointSoal = Number(rule.skor_kosong || 0);
        } else {
          userAnsDisplay = String(userAns).trim();
          const cleanUserAns = userAnsDisplay.toLowerCase();
          
          isCorrect = kunciArr.includes(cleanUserAns);
          if (isCorrect) {
            jumlahBenar++;
            pointSoal = maxPointSoal;
          } else {
            jumlahSalah++;
            pointSoal = Number(rule.skor_salah || 0);
          }
        }
      }

      // D. TIPE 4A (Matrix True/False Per Statement)
      else if (tipe === "4A") {
        let kunciArr = Array.isArray(q.kunci) ? q.kunci.map(k => String(k).trim().toUpperCase()) : [];
        kunciDisplay = kunciArr.join(", ");
        maxPointSoal = kunciArr.length * Number(rule.skor_per_baris_benar || 1);

        let userAnsArr = Array.isArray(userAns) ? userAns : [];

        if (userAnsArr.length === 0 || userAnsArr.every(a => a === "" || a === null)) {
          jumlahKosong++;
          pointSoal = 0;
        } else {
          userAnsDisplay = userAnsArr.map(v => v ? String(v).trim().toUpperCase() : "-").join(", ");
          let pointPerSoal = 0;
          let barisBenar = 0;

          kunciArr.forEach((kunciBaris, i) => {
            const ansBaris = String(userAnsArr[i] || "").trim().toUpperCase();
            if (ansBaris === kunciBaris) {
              pointPerSoal += Number(rule.skor_per_baris_benar || 1);
              barisBenar++;
            } else {
              pointPerSoal += Number(rule.skor_per_baris_salah || 0);
            }
          });

          pointSoal = pointPerSoal;
          isCorrect = (barisBenar === kunciArr.length);

          if (isCorrect) jumlahBenar++;
          else jumlahSalah++;
        }
      }

      // E. TIPE 5A (Weighted Options / Likert / TKP)
      else if (tipe === "5A") {
        let bobotMap = (typeof q.kunci === "object" && !Array.isArray(q.kunci)) ? q.kunci : {};
        const bobotValues = Object.values(bobotMap).map(v => Number(v) || 0);
        maxPointSoal = bobotValues.length > 0 ? Math.max(...bobotValues) : 5;

        // Cari Kunci Terbaik untuk display
        let bestOpt = ""; let maxVal = -Infinity;
        Object.entries(bobotMap).forEach(([k, v]) => { if (Number(v) > maxVal) { maxVal = Number(v); bestOpt = k; } });
        kunciDisplay = bestOpt ? `${bestOpt} (Skor: ${maxVal})` : "Opsi Berbobot";

        if (!userAns || String(userAns).trim() === "") {
          jumlahKosong++;
          pointSoal = Number(rule.skor_kosong || 0);
        } else {
          userAnsDisplay = String(userAns).trim().toUpperCase();
          pointSoal = Number(bobotMap[userAnsDisplay] || rule.skor_salah || 0);
          
          isCorrect = (pointSoal === maxPointSoal);
          if (pointSoal > 0) jumlahBenar++;
          else jumlahSalah++;
        }
      }

      // Akumulasi Total Global
      totalSkorMurni += pointSoal;
      totalSkorMaks += maxPointSoal;

      // Catat ke Analytics Responses Level (Tier 2)
      responsesAnalytics.push({
        question_id: qId,
        question_order: idx + 1,
        tipe: tipe,
        section_id: q.section_id || "ALL",
        topic_id: q.topic_id || "UNKNOWN",
        topic_name: q.topic_name || "-",
        competency_id: q.competency_id || "-",
        difficulty: q.level || "M",
        selected_answer: userAnsDisplay,
        correct_answer: kunciDisplay,
        is_correct: isCorrect,
        score_acquired: pointSoal,
        max_score: maxPointSoal,
        time_spent_seconds: timeSpent
      });
    });

    // --------------------------------------------------------------------------
    // 2. PERAKITAN DATA ANALITIK TINGKAT TINGGI (TIER 1 & 2)
    // --------------------------------------------------------------------------
    const skorAkhir = Number(Math.max(0, totalSkorMurni).toFixed(2));
    const akurasi = totalSkorMaks > 0 ? Math.round((skorAkhir / totalSkorMaks) * 100) : 0;

    // Rekap Data Utama Ujian
    const HasilUjian = {
      attempt_id: rawPayload.attempt_id,
      student_id: userData.username,
      kode_ujian: config.kode_ujian,
      timestamp_start: rawPayload.timestamp_start,
      timestamp_submit: rawPayload.timestamp_submit,
      duration_seconds: rawPayload.duration_seconds,
      status: "COMPLETED",
      
      skor_akhir: skorAkhir,
      skor_maksimal: totalSkorMaks,
      akurasi_persen: akurasi,
      
      benar: jumlahBenar,
      salah: jumlahSalah,
      kosong: jumlahKosong,
      total_soal: questions.length,

      security_logs: rawPayload.security_logs || []
    };

    // Payload Khusus Webhook GAS (Sesuai Blueprint Sheet Database Relasional)
    const WebhookPayload = {
      action: "submit_analytics",
      attempt_info: HasilUjian,
      user_info: userData,             // Data Identitas Auth
      responses_info: responsesAnalytics // Rincian Item-level
    };

    // --------------------------------------------------------------------------
    // 3. PENGIRIMAN DATA & REDIRECT KE RESULT PREVIEW
    // --------------------------------------------------------------------------
    // Simpan ke SessionStorage agar bisa dibaca langsung oleh halaman result.html
    const FinalReportData = {
      ...HasilUjian,
      rincian_jawaban: responsesAnalytics,
      nama_kegiatan: config.nama_kegiatan
    };
    sessionStorage.setItem(`cbt_last_result_${config.kode_ujian}`, JSON.stringify(FinalReportData));
    
    // Hapus State Jawaban Ujian agar tidak tersangkut di memory (Clean Slate)
    sessionStorage.removeItem(`cbt_state_${config.kode_ujian}`);

    // Transmisi ke Webhook (Asinkron / Latar Belakang)
    if (WEBHOOK_URL && WEBHOOK_URL.trim() !== "") {
      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(WebhookPayload)
        });
        console.log("[SCORING-ENGINE] Payload Analitik berhasil di-broadcast ke Webhook.");
      } catch (err) {
        console.warn("[SCORING-ENGINE] Webhook gagal dijangkau, namun data lokal aman.", err);
      }
    }

    // Eksekusi Pindah Halaman ke Result Preview (Ringkasan Skor & Teaser 3 Soal)
    console.log("[SCORING-ENGINE] Kalkulasi selesai. Redirecting ke Result Preview...");
    window.location.replace("../result/result.html");
  }

  // Expose API
  return { calculateAndTransmit };
})();

// Assign ke Window Object
window.ScoringEngine = ScoringEngine;
