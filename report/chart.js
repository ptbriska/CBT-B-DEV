/**
 * ==============================================================================
 * chart.js - CHART VISUALIZER ENGINE (REPORT MODULE V3)
 * Grafik Proporsi Skor, Tren Waktu Per Soal, & Akurasi Subtest (PDF Print Ready)
 * ==============================================================================
 */

(function () {
  // Registrasi Plugin DataLabels jika terdeteksi
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  function renderReportCharts(benar, salah, kosong, itemReviews, subtestStats) {
    if (typeof Chart === 'undefined') {
      console.error("[CHART-ENGINE] Library Chart.js belum dimuat.");
      return;
    }

    const safeInitChart = (canvasId, config) => {
      const canvasEl = document.getElementById(canvasId);
      if (!canvasEl) return;

      const existingChart = Chart.getChart(canvasId);
      if (existingChart) {
        existingChart.destroy();
      }
      new Chart(canvasEl.getContext('2d'), config);
    };

    // 1. CHART DOUGHNUT: Proporsi Jawaban
    safeInitChart('chartScorePie', {
      type: 'doughnut',
      data: {
        labels: ['Benar', 'Salah', 'Kosong'],
        datasets: [{
          data: [benar, salah, kosong],
          backgroundColor: ['#10B981', '#EF4444', '#9CA3AF'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disatukan tanpa animasi agar instan saat print PDF
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Inter', size: 11 }, padding: 12 }
          },
          datalabels: {
            display: true,
            color: '#ffffff',
            font: { family: 'Inter', weight: 'bold', size: 13 },
            formatter: (val) => (val > 0 ? val : '')
          }
        }
      }
    });

    // 2. CHART LINE: Waktu Pengerjaan Per Soal
    safeInitChart('chartTimeLine', {
      type: 'line',
      data: {
        labels: itemReviews.map(r => `No ${r.no}`),
        datasets: [{
          label: 'Durasi (Detik)',
          data: itemReviews.map(r => r.durasiSec),
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#0284c7'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            align: 'top',
            anchor: 'end',
            color: '#0284c7',
            font: { family: 'Inter', weight: 'bold', size: 10 },
            formatter: (val) => `${val}s`
          }
        }
      }
    });

    // 3. CHART BAR: Akurasi Subtest
    const subtestLabels = Object.keys(subtestStats);
    const subtestAccuracy = subtestLabels.map(k => {
      const st = subtestStats[k];
      return st.total > 0 ? Number(((st.benar / st.total) * 100).toFixed(1)) : 0;
    });

    safeInitChart('chartSubtestBar', {
      type: 'bar',
      data: {
        labels: subtestLabels,
        datasets: [{
          label: 'Akurasi (%)',
          data: subtestAccuracy,
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            align: 'top',
            anchor: 'end',
            color: '#7c3aed',
            font: { family: 'Inter', weight: 'bold', size: 10 },
            formatter: (val) => `${val}%`
          }
        }
      }
    });
  }

  window.renderReportCharts = renderReportCharts;
})();
