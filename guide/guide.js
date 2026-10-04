/**
 * GUIDE MODULE HEALTH CHECK & SESSION INITIALIZATION
 */
(function initGuideModule() {
  const healthEl = document.getElementById('guide-health-status');
  try {
    window.GUIDE_MODULE = {
      loaded: true,
      timestamp: new Date().toISOString()
    };
    if (healthEl) {
      healthEl.style.color = '#34d399';
      healthEl.textContent = '● MODULE GUIDE: ONLINE [ISOLATED OK]';
    }
    console.log('[GUIDE-MOD] guide.js loaded successfully.');
  } catch (err) {
    if (healthEl) {
      healthEl.style.color = '#f87171';
      healthEl.textContent = '🚨 MODULE GUIDE CORRUPT!';
    }
    console.error('[GUIDE-MOD ERROR]', err);
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  // 1. CEK AUTENTIKASI SESI
  const rawUser = sessionStorage.getItem('cbt_auth_user');
  if (!rawUser) {
    alert('Sesi Anda tidak ditemukan atau telah kadaluarsa. Silakan login kembali.');
    window.location.href = '../auth/auth.html';
    return;
  }

  const userData = JSON.parse(rawUser);
  const kodeKegiatan = userData.kodeKegiatan;
  const tokenRole = userData.tokenRole || 'REGULER';

  // 2. RENDER IDENTITAS PESERTA
  renderUserProfile(userData, tokenRole);

  // 3. FETCH CONFIG SOAL DARI DATABASE JSON
  try {
    const jsonUrl = `../database-soal/${kodeKegiatan}.json`;
    const response = await fetch(jsonUrl);
    
    if (!response.ok) {
      throw new Error(`File konfigurasi soal '${kodeKegiatan}.json' tidak ditemukan di database-soal/`);
    }

    const examConfig = await response.json();
    renderExamInfo(examConfig, kodeKegiatan);

    // 4. CEK BATAS RETAKE UJIAN (JIKA MODE === 'UJIAN')
    checkRetakeLimit(examConfig, kodeKegiatan, tokenRole);

  } catch (err) {
    console.error('[GUIDE FETCH ERROR]', err);
    alert(`Gagal memuat detail ujian: ${err.message}`);
  }

  // 5. EVENT HANDLER CHECKBOX AGREEMENT
  const checkAgree = document.getElementById('check-agree');
  const btnStart = document.getElementById('btn-start-exam');

  checkAgree.addEventListener('change', (e) => {
    btnStart.disabled = !e.target.checked;
  });

  // 6. EVENT HANDLER START EXAM
  btnStart.addEventListener('click', () => {
    // Tandai bahwa ujian siap dimulai
    sessionStorage.setItem('cbt_exam_active', 'TRUE');
    window.location.href = '../exam/exam.html';
  });
});

/**
 * RENDER PROFIL PESERTA DENGAN AKSEN WARNA ROLE
 */
function renderUserProfile(data, role) {
  document.getElementById('user-nama').textContent = data.namaLengkap || 'Peserta';
  document.getElementById('user-username').textContent = data.username || '-';
  document.getElementById('user-instansi').textContent = data.asalInstansi || '-';
  document.getElementById('user-kontak').textContent = `${data.email} / ${data.nomorHp}`;

  const profileCard = document.getElementById('user-profile-card');
  const badgeEl = document.getElementById('role-badge');
  badgeEl.textContent = role;

  // Bersihkan class role sebelumnya
  profileCard.classList.remove('card-reguler', 'card-vip', 'card-master');

  // Skema Warna Akses Role
  if (role === 'VIP') {
    profileCard.classList.add('card-vip');
  } else if (role === 'MASTER') {
    profileCard.classList.add('card-master');
  } else {
    profileCard.classList.add('card-reguler');
  }
}

/**
 * RENDER TEPAT 7 FIELD INFORMASI UJIAN
 */
function renderExamInfo(config, kode) {
  // Nama Sistem CBT & Logo
  if (config.nama_sistem_cbt) {
    document.getElementById('cbt-sys-name').textContent = config.nama_sistem_cbt;
  }
  if (config.logo) {
    document.getElementById('cbt-logo').src = config.logo;
  }
  if (config.penyelenggara) {
    document.getElementById('cbt-sub-institution').textContent = config.penyelenggara;
  }

  // 1. Kode Paket Ujian
  document.getElementById('info-kode-paket').textContent = `${kode} (${config.mode_ujian || 'LATIHAN'})`;
  // 2. Nama Kegiatan Ujian
  document.getElementById('info-nama-kegiatan').textContent = config.nama_kegiatan || '-';
  // 3. Sistem Ujian
  document.getElementById('info-sistem-ujian').textContent = config.sistem_ujian || 'CBT';
  // 4. Mode Ujian
  document.getElementById('info-mode-ujian').textContent = config.mode_ujian || 'LATIHAN';
  // 5. Penyelenggara
  document.getElementById('info-penyelenggara').textContent = config.penyelenggara || '-';
  // 6. Lembaga
  document.getElementById('info-lembaga').textContent = config.lembaga || '-';
  // 7. Total Durasi Pengerjaan
  document.getElementById('info-durasi').textContent = `${config.total_timer_menit || 120} Menit`;
}

/**
 * ATURAN RETAKE BERDASARKAN ROLE TOKEN & MODE UJIAN
 */
function checkRetakeLimit(config, kode, role) {
  const isFinished = localStorage.getItem(`cbt_finished_${kode}`);
  const mode = config.mode_ujian || 'LATIHAN';

  if (isFinished && mode === 'UJIAN' && role !== 'MASTER') {
    const checkAgree = document.getElementById('check-agree');
    const btnStart = document.getElementById('btn-start-exam');

    checkAgree.disabled = true;
    btnStart.disabled = true;
    btnStart.textContent = '🔒 UJIAN TELAH SELESAI DIKERJAKAN';
    btnStart.style.background = '#8b0000';

    alert('Anda sudah pernah menyelesaikan sesi UJIAN ini. Sesuai ketentuan, pengerjaan hanya diperbolehkan 1 kali.');
  }
}
