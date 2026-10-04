/**
 * AUTH MODULE HEALTH CHECK & DUAL-PATHWAY ENGINE
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
      healthEl.textContent = '● MODULE AUTH: ONLINE [DUAL-PATHWAY OK]';
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
const btnFastPass = document.getElementById('btn-fastpass-verify');
const btnReguler = document.getElementById('btn-reguler-verify');
const notifBox = document.getElementById('notification-box');
const nextBox = document.getElementById('next-action-container');

// URL Web App Google Apps Script Resmi Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2MPM2sFzYOggxYdwLHhfglOCCTz4Reu8cYh5IsbxmHj6MYaPBXDYO0jpCYSXyxeI6/exec'; 

// =============================================================================
// JALUR 1: VERIFIKASI FAST-PASS (VIP / MASTER DEVELOPER)
// =============================================================================
if (btnFastPass) {
  btnFastPass.addEventListener('click', async () => {
    const kodeKegiatan = document.getElementById('input-kegiatan').value.trim().toUpperCase();
    const fastPassToken = document.getElementById('input-fastpass').value.trim();

    if (!kodeKegiatan) {
      showErrorNotification('N/A', 'N/A', 'Kode Kegiatan wajib diisi terlebih dahulu!');
      return;
    }

    if (!fastPassToken) {
      showErrorNotification('N/A', 'N/A', 'Token Fast-Pass (VIP / Master) tidak boleh kosong!');
      return;
    }

    btnFastPass.disabled = true;
    btnFastPass.textContent = '⚡ MEMERIKSA TOKEN FAST-PASS...';

    try {
      const jsonUrl = `../database-soal/${kodeKegiatan}.json`;
      const jsonResp = await fetch(jsonUrl);

      if (!jsonResp.ok) {
        showErrorNotification('N/A', fastPassToken, `File konfigurasi soal '${kodeKegiatan}.json' tidak ditemukan di database-soal/`);
        clearUserDetailForm();
        nextBox.classList.add('hidden');
        return;
      }

      const examConfig = await jsonResp.json();
      let tokenRole = null;

      if (fastPassToken === examConfig.token_master) {
        tokenRole = 'MASTER';
      } else if (fastPassToken === examConfig.token_vip) {
        tokenRole = 'VIP';
      }

      if (tokenRole) {
        // SUCCESS FAST-PASS: BYPASS GOOGLE SPREADSHEET!
        showFastPassNotification(tokenRole, kodeKegiatan);
        enableManualFormFilling(tokenRole, kodeKegiatan, examConfig);
        nextBox.classList.remove('hidden');
      } else {
        showErrorNotification('N/A', fastPassToken, `Token Fast-Pass '${fastPassToken}' tidak valid untuk kegiatan '${kodeKegiatan}'!`);
        clearUserDetailForm();
        nextBox.classList.add('hidden');
      }

    } catch (err) {
      console.error('[FAST-PASS ERROR]', err);
      showErrorNotification('N/A', fastPassToken, 'Gagal memproses file konfigurasi JSON soal.');
      clearUserDetailForm();
      nextBox.classList.add('hidden');
    } finally {
      btnFastPass.disabled = false;
      btnFastPass.textContent = '⚡ VERIFIKASI FAST-PASS (VIP / MASTER)';
    }
  });
}

// =============================================================================
// JALUR 2: VERIFIKASI REGULER (GOOGLE SPREADSHEET)
// =============================================================================
if (btnReguler) {
  btnReguler.addEventListener('click', async () => {
    const kodeKegiatan = document.getElementById('input-kegiatan').value.trim().toUpperCase();
    const username = document.getElementById('input-username').value.trim();
    const token = document.getElementById('input-token').value.trim();

    if (!kodeKegiatan) {
      showErrorNotification('N/A', 'N/A', 'Kode Kegiatan wajib diisi terlebih dahulu!');
      return;
    }

    if (!username || !token) {
      showErrorNotification(username || 'N/A', token || 'N/A', 'Username dan User Token Reguler wajib diisi!');
      return;
    }

    btnReguler.disabled = true;
    btnReguler.textContent = '🔄 MEMERIKSA DATABASE REGULER...';

    try {
      let userData = null;

      if (SCRIPT_URL) {
        const response = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(kodeKegiatan)}&username=${encodeURIComponent(username)}&token=${encodeURIComponent(token)}`);
        const result = await response.json();
        if (result.success && result.data) {
          userData = result.data;
        }
      }

      if (userData && (userData.status === 'VERIFIED' || userData.status.includes('VERIFIED'))) {
        showSuccessNotification(userData);
        fillUserDetailForm(userData);
        
        sessionStorage.setItem('cbt_auth_user', JSON.stringify({
          username: username,
          token: token,
          tokenRole: 'REGULER',
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
      showErrorNotification(username, token, 'Gagal terhubung ke server database Google Sheets.');
      clearUserDetailForm();
      nextBox.classList.add('hidden');
    } finally {
      btnReguler.disabled = false;
      btnReguler.textContent = '🔍 CEK VERIFIKASI REGULER';
    }
  });
}

// =============================================================================
// HELPER FUNCTIONS & UI RENDERERS
// =============================================================================
function showFastPassNotification(role, code) {
  notifBox.className = 'notif-card fastpass';
  notifBox.innerHTML = `
    <div>⚡ <strong>FAST-PASS TERVERIFIKASI (${role} ACCESS):</strong> Akses dibuka via Token ${role}! Database Spreadsheet di-bypass. Silakan lengkapi / sesuaikan profil di bawah ini secara manual.</div>
  `;
  notifBox.classList.remove('hidden');
}

function showErrorNotification(uname, tokenCode, customMsg) {
  notifBox.className = 'notif-card error';
  notifBox.innerHTML = `
    <div>⚠️ <strong>VERIFIKASI GAGAL:</strong> ${customMsg || `Kombinasi Username '<strong>${uname}</strong>' dan Kode Password '<strong>${tokenCode}</strong>' tidak ditemukan dalam sistem database atau belum berstatus VERIFIED!`}</div
    <div style="margin-top: 8px;">Silakan hubungi Admin untuk bantuan pendaftaran:</div>
    <a href="https://wa.me/6282268118842?text=Halo%20Admin,%20saya%20gagal%20verifikasi%20CBT%20dengan%20Username:%20${encodeURIComponent(uname)}" target="_blank" class="btn-wa-admin">
      💬 Hubungi Admin WhatsApp (082268118842)
    </a>
  `;
  notifBox.classList.remove('hidden');
}

function showSuccessNotification(data) {
  notifBox.className = 'notif-card success';
  notifBox.innerHTML = `
    <div>✅ <strong>VERIFIKASI BERHASIL:</strong> Selamat datang <strong>${data.namaLengkap}</strong>! Kepesertaan Anda telah tervalidasi secara resmi. Silakan periksa detail data Anda di bawah ini dan klik tombol untuk melanjutkan.</div>
  `;
  notifBox.classList.remove('hidden');
}

function enableManualFormFilling(role, kodeKegiatan, examConfig) {
  const fields = document.querySelectorAll('.field-autofill');
  fields.forEach(f => f.removeAttribute('readonly'));

  const statusEl = document.getElementById('info-status');
  statusEl.value = `VERIFIED (${role})`;
  statusEl.classList.remove('verified-badge');
  statusEl.classList.add('fastpass-badge');

  document.getElementById('info-kategoriBrand').value = examConfig.penyelenggara || 'Briska Education Corp';
  document.getElementById('info-kodeKegiatan').value = kodeKegiatan;
  document.getElementById('info-bidangKegiatan').value = examConfig.nama_kegiatan || '-';
  document.getElementById('info-skemaTarif').value = `Jalur Spesial ${role}`;
  document.getElementById('info-namaLengkap').value = role === 'MASTER' ? 'Dev Team / Tester' : 'Peserta VIP';
  document.getElementById('info-nomorHp').value = '082268118842';
  document.getElementById('info-email').value = 'vip@briska.education';
  document.getElementById('info-jenisKelamin').value = 'Laki-laki';
  document.getElementById('info-asalInstansi').value = examConfig.lembaga || 'Internal Briska Corp';
  document.getElementById('info-pekerjaanJurusan').value = 'Developer / Penguji';
  document.getElementById('info-nomorIdentitas').value = '9999999999';
  document.getElementById('info-asalKabupaten').value = 'Banjarmasin';
  document.getElementById('info-asalProvinsi').value = 'Kalimantan Selatan';

  fields.forEach(field => {
    field.addEventListener('input', () => {
      saveManualSession(role, kodeKegiatan);
    });
  });

  saveManualSession(role, kodeKegiatan);
}

function saveManualSession(role, kodeKegiatan) {
  sessionStorage.setItem('cbt_auth_user', JSON.stringify({
    username: document.getElementById('info-namaLengkap').value || 'User_FastPass',
    token: 'FAST_PASS_TOKEN',
    tokenRole: role,
    status: document.getElementById('info-status').value,
    kategoriBrand: document.getElementById('info-kategoriBrand').value,
    kodeKegiatan: kodeKegiatan,
    bidangKegiatan: document.getElementById('info-bidangKegiatan').value,
    skemaTarif: document.getElementById('info-skemaTarif').value,
    namaLengkap: document.getElementById('info-namaLengkap').value,
    nomorHp: document.getElementById('info-nomorHp').value,
    email: document.getElementById('info-email').value,
    jenisKelamin: document.getElementById('info-jenisKelamin').value,
    asalInstansi: document.getElementById('info-asalInstansi').value,
    pekerjaanJurusan: document.getElementById('info-pekerjaanJurusan').value,
    nomorIdentitas: document.getElementById('info-nomorIdentitas').value,
    asalKabupaten: document.getElementById('info-asalKabupaten').value,
    asalProvinsi: document.getElementById('info-asalProvinsi').value
  }));
}

function fillUserDetailForm(data) {
  const statusEl = document.getElementById('info-status');
  statusEl.value = data.status || '-';
  statusEl.classList.remove('fastpass-badge');
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

function clearUserDetailForm() {
  const statusEl = document.getElementById('info-status');
  statusEl.value = '';
  statusEl.classList.remove('verified-badge', 'fastpass-badge');

  const fields = document.querySelectorAll('.field-autofill');
  fields.forEach(f => {
    f.value = '';
    f.setAttribute('readonly', 'true');
  });
}
