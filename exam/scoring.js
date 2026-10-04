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
   * Helper Internal: Mengambil kunci dari variasi nama properti JSON
   */
  function extractRawKunci(q) {
    if (q.kunci !== undefined && q.kunci !== null) return q.kunci;
    if (q.Kunci !== undefined && q.Kunci !== null) return q.Kunci;
    if (q.correct_answer !== undefined && q.correct_answer !== null) return q.correct_answer;
    return "";
  }

  /**
   * Helper Internal: Konversi Kunci ke Array String Rapi
   */
  function parseKunciToArray(rawKunci) {
    if (Array.isArray(rawKunci)) {
      return rawKunci.map(k => String(k).trim().toUpperCase());
    }
    if (typeof rawKunci === "string" && rawKunci.trim() !== "") {
      return rawKunci.split(",").map(k => k.trim().toUpperCase());
    }
    return [];
  }

  /**
   * Fungsi Utama: Menerima config soal, data user, dan jawaban mentah, 
   * menghitung skor 8 tipe soal, memformat payload, dan mengirim data.
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
      const rawKunci = extractRawKunci(q);

      let pointSoal = 0;
      let maxPointSoal = 0;
      let isCorrect = false;
      let userAnsDisplay = "-";
      let kunciDisplay = "-";

      // A. TIPE 1A, 1B, 1C (Single Choice)
      if (["1A", "1B", "1C"].includes(tipe)) {
        const kunci = String(rawKunci || "").trim().toUpperCase();
        kunciDisplay = kunci || "-";
        
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
        let kunciArr = parseKunciToArray(rawKunci);
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
        let kunciArr = Array.isArray(rawKunci) 
          ? rawKunci.map(k => String(k).trim().toLowerCase()) 
          : String(rawKunci || "").split("|").map(k => k.trim().toLowerCase());
        
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
        let kunciArr = parseKunciToArray(rawKunci);
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
        let bobotMap = (typeof rawKunci === "object" && !Array.isArray(rawKunci) && rawKunci !== null) ? rawKunci : {};
        const bobotValues = Object.values(bobotMap).map(v => Number(v) || 0);
        maxPointSoal = bobotValues.length > 0 ? Math.max(...bobotValues) : 5;

        let bestOpt = ""; let maxVal = -Infinity;
        Object.entries(bobotMap).forEach(([k, v]) => { 
          if (Number(v) > maxVal) { maxVal = Number(v); bestOpt = k; } 
        });
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
        section_id: q.section_id || q.section_name || "ALL",
        topic_id: q.topic_id || "UNKNOWN",
        topic_name: q.topic_name || q.subtest_name || "-",
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

    const WebhookPayload = {
      action: "submit_analytics",
      attempt_info: HasilUjian,
      user_info: userData,
      responses_info: responsesAnalytics
    };

    // --------------------------------------------------------------------------
    // 3. PERSISTENCE & ASYNCHRONOUS BROADCAST TO RESULT
    // --------------------------------------------------------------------------
    const FinalReportData = {
      ...HasilUjian,
      rincian_jawaban: responsesAnalytics,
      nama_kegiatan: config.nama_kegiatan
    };

    // Simpan dengan key spesifik & key generik agar result.js selalu berhasil membaca
    sessionStorage.setItem(`cbt_last_result_${config.kode_ujian}`, JSON.stringify(FinalReportData));
    sessionStorage.setItem("cbt_last_result", JSON.stringify(FinalReportData));
    
    // Hapus State Pengerjaan Ujian
    sessionStorage.removeItem(`cbt_state_${config.kode_ujian}`);

    // Broadcast ke Google Sheets di background (Asinkron tanpa await agar redirect seketika)
    if (WEBHOOK_URL && WEBHOOK_URL.trim() !== "") {
      fetch(WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(WebhookPayload)
      }).then(() => {
        console.log("[SCORING-ENGINE] Webhook sync selesai di background.");
      }).catch(err => {
        console.warn("[SCORING-ENGINE] Webhook background sync error:", err);
      });
    }

    // INSTANT REDIRECT KE RESULT PREVIEW
    console.log("[SCORING-ENGINE] Kalkulasi tuntas. Navigasi ke result/result.html...");
    window.location.replace("../result/result.html");
  }

  return { calculateAndTransmit };
})();

// Assign ke Window Object
window.ScoringEngine = ScoringEngine;
