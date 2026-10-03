/**
 * AUTH MODULE HEALTH CHECK & INITIALIZATION
 */
(function initAuthModule() {
  const healthEl = document.getElementById('auth-health-status');
  try {
    window.AUTH_MODULE = {
      loaded: true,
      timestamp: new Date().toISOString()
    };
    if (healthEl) {
      healthEl.style.color = '#34d399';
      healthEl.textContent = '● MODULE AUTH: ONLINE [ISOLATED OK]';
    }
    console.log('[AUTH-MOD] auth.js loaded successfully.');
  } catch (err) {
    if (healthEl) {
      healthEl.style.color = '#f87171';
      healthEl.textContent = '🚨 MODULE AUTH CORRUPT!';
    }
    console.error('[AUTH-MOD ERROR]', err);
  }
})();

// DOM Elements
const btnVerify = document.getElementById('btn-verify');
const notifBox = document.getElementById('notification-box');
const nextBox = document.getElementById('next-action-container');

// URL Web App Google Apps Script (Ubah dengan URL deployment Anda jika sudah ada)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2MPM2sFzYOggxYdwLHhfglOCCTz4Reu8cYh5IsbxmHj6MYaPBXDYO0jpCYSXyxeI6/exec'; 

btnVerify.addEventListener('click', async () => {
  const kodeKegiatan = document.getElementById('input-kegiatan').value.trim();
  const username = document.getElementById('input-username').value.trim();
  const token = document.getElementById('input-token').value.trim();

  // Basic Validation
  if (!kodeKegiatan || !username || !token) {
    showErrorNotification(username || 'N/A', token || 'N/A', 'Semua kolom input verifikasi wajib diisi!');
    return;
  }

  btnVerify.disabled = true;
  btnVerify.textContent = '🔄 MEMERIKSA DATABASE...';

  try {
    // Eksekusi Pengecekan ke Spreadsheet (Atau Simulasi jika SCRIPT_URL belum diset)
    let userData = null;

    if (SCRIPT_URL && !SCRIPT_URL.includes('YOUR_GOOGLE_APPS_SCRIPT')) {
      const response = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(kodeKegiatan)}&username=${encodeURIComponent(username)}&token=${encodeURIComponent(token)}`);
      const result = await response.json();
      if (result.success && result.data) {
        userData = result.data;
      }
    } else {
      // Fallback Demo Testing (Menggunakan data spesifikasi Anda)
      if (username.toLowerCase() === 'subs.ptbriska' && token === '082268118842') {
        userData = {
          status: 'VERIFIED',
          kategoriBrand: '4. Buku & Paket Ujian (Pena Bisa)',
          kodeKegiatan: kodeKegiatan || 'PB-BK-PATENCPNS',
          bidangKegiatan: 'E-Book + Latihan Soal',
          skemaTarif: '1. Tarif Normal',
          namaLengkap: 'Bimo',
          nomorHp: '082268118842',
          email: 'subs.ptbriska@gmail.com',
          jenisKelamin: 'Laki-laki',
          asalInstansi: 'BMKG',
          pekerjaanJurusan: 'IPA',
          nomorIdentitas: '00112',
          asalKabupaten: 'Makassar',
          asalProvinsi: 'Sulawesi Selatan'
        };
      }
    }

    // Pengecekan Kondisi Lolos: Data Ada DAN Status === VERIFIED
    if (userData && userData.status === 'VERIFIED') {
      showSuccessNotification(userData);
      fillUserDetailForm(userData);
      
      // Simpan Sesi Terisolasi
      sessionStorage.setItem('cbt_auth_user', JSON.stringify({
        username: username,
        token: token,
        ...userData
      }));

      nextBox.classList.remove('hidden');
    } else {
      showErrorNotification(username, token);
      clearUserDetailForm();
      nextBox.classList.add('hidden');
    }

  } catch (err) {
    console.error('[AUTH FETCH ERROR]', err);
    showErrorNotification(username, token, 'Gagal terhubung ke server database.');
    clearUserDetailForm();
    nextBox.classList.add('hidden');
  } finally {
    btnVerify.disabled = false;
    btnVerify.textContent = '🔍 CEK VERIFIKASI PESERTA';
  }
});

/**
 * TAMPILKAN ERROR NOTIFICATION (Card Merah)
 */
function showErrorNotification(uname, tokenCode, customMsg) {
  notifBox.className = 'notif-card error';
  notifBox.innerHTML = `
    <div>⚠️ <strong>VERIFIKASI GAGAL:</strong> Kombinasi Username '<strong>${uname}</strong>' dan Kode Password '<strong>${tokenCode}</strong>' tidak ditemukan dalam sistem database atau belum berstatus VERIFIED!</div>
    <div style="margin-top: 8px;">Silakan hubungi Admin untuk bantuan pendaftaran:</div>
    <a href="https://wa.me/6282268118842?text=Halo%20Admin,%20saya%20gagal%20verifikasi%20CBT%20dengan%20Username:%20${encodeURIComponent(uname)}" target="_blank" class="btn-wa-admin">
      💬 Hubungi Admin WhatsApp (082268118842)
    </a>
  `;
  notifBox.classList.remove('hidden');
}

/**
 * TAMPILKAN SUCCESS NOTIFICATION (Card Hijau)
 */
function showSuccessNotification(data) {
  notifBox.className = 'notif-card success';
  notifBox.innerHTML = `
    <div>✅ <strong>VERIFIKASI BERHASIL:</strong> Selamat datang <strong>${data.namaLengkap}</strong>! Kepesertaan Anda telah tervalidasi secara resmi. Silakan periksa detail data Anda di bawah ini dan klik tombol untuk melanjutkan.</div>
  `;
  notifBox.classList.remove('hidden');
}

/**
 * AUTOFILL FIELDS 3 - 16
 */
function fillUserDetailForm(data) {
  const statusEl = document.getElementById('info-status');
  statusEl.value = data.status || '-';
  statusEl.classList.add('verified-badge');

  document.getElementById('info-kategoriBrand').value = data.kategoriBrand || '-';
  document.getElementById('info-kodeKegiatan').value = data.kodeKegiatan || '-';
  document.getElementById('info-bidangKegiatan').value = data.bidangKegiatan || '-';
  document.getElementById('info-skemaTarif').value = data.skemaTarif || '-';
  document.getElementById('info-namaLengkap').value = data.namaLengkap || '-';
  document.getElementById('info-nomorHp').value = data.nomorHp || '-';
  document.getElementById('info-email').value = data.email || '-';
  document.getElementById('info-jenisKelamin').value = data.jenisKelamin || '-';
  document.getElementById('info-asalInstansi').value = data.asalInstansi || '-';
  document.getElementById('info-pekerjaanJurusan').value = data.pekerjaanJurusan || '-';
  document.getElementById('info-nomorIdentitas').value = data.nomorIdentitas || '-';
  document.getElementById('info-asalKabupaten').value = data.asalKabupaten || '-';
  document.getElementById('info-asalProvinsi').value = data.asalProvinsi || '-';
}

/**
 * KOSONGKAN FORM JIKA GAGAL
 */
function clearUserDetailForm() {
  const statusEl = document.getElementById('info-status');
  statusEl.value = '';
  statusEl.classList.remove('verified-badge');

  const fields = document.querySelectorAll('.field-autofill');
  fields.forEach(f => f.value = '');
}
