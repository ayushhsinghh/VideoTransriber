// ═══════════════════════════════════════════════════════════════════════
//  SubForge — Frontend Controller
// ═══════════════════════════════════════════════════════════════════════

const API_BASE_URL = 'https://api.ayush.ltd';

let jobId = null;
let currentPage = 'home';
let currentXHR = null;
let uploadStartTime = null;
let currentOriginalFilename = null;

// Helper: derive .srt download name from the original filename
function srtFilename(originalFilename, fallbackId) {
  if (originalFilename) {
    return originalFilename.replace(/\.[^.]+$/, '') + '.srt';
  }
  return fallbackId + '.srt';
}

// ── Initialisation ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initializeEventListeners();
  checkAuthFromUrl();
  updateAuthUI();
  showHomePage();
});

// ── Language data (all Whisper-supported languages) ─────────────────────

var LANGUAGES = [
  { code: '', label: 'Auto-detect' }, { code: 'af', label: 'Afrikaans' }, { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' }, { code: 'az', label: 'Azerbaijani' }, { code: 'be', label: 'Belarusian' },
  { code: 'bs', label: 'Bosnian' }, { code: 'bg', label: 'Bulgarian' }, { code: 'ca', label: 'Catalan' },
  { code: 'zh', label: 'Chinese' }, { code: 'hr', label: 'Croatian' }, { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' }, { code: 'nl', label: 'Dutch' }, { code: 'en', label: 'English' },
  { code: 'et', label: 'Estonian' }, { code: 'fi', label: 'Finnish' }, { code: 'fr', label: 'French' },
  { code: 'gl', label: 'Galician' }, { code: 'de', label: 'German' }, { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' }, { code: 'hi', label: 'Hindi' }, { code: 'hu', label: 'Hungarian' },
  { code: 'is', label: 'Icelandic' }, { code: 'id', label: 'Indonesian' }, { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' }, { code: 'kn', label: 'Kannada' }, { code: 'kk', label: 'Kazakh' },
  { code: 'ko', label: 'Korean' }, { code: 'lv', label: 'Latvian' }, { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' }, { code: 'ms', label: 'Malay' }, { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' }, { code: 'mi', label: 'Maori' }, { code: 'mn', label: 'Mongolian' },
  { code: 'ne', label: 'Nepali' }, { code: 'no', label: 'Norwegian' }, { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' }, { code: 'pt', label: 'Portuguese' }, { code: 'pa', label: 'Punjabi' },
  { code: 'ro', label: 'Romanian' }, { code: 'ru', label: 'Russian' }, { code: 'sr', label: 'Serbian' },
  { code: 'sk', label: 'Slovak' }, { code: 'sl', label: 'Slovenian' }, { code: 'es', label: 'Spanish' },
  { code: 'sw', label: 'Swahili' }, { code: 'sv', label: 'Swedish' }, { code: 'tl', label: 'Tagalog' },
  { code: 'ta', label: 'Tamil' }, { code: 'te', label: 'Telugu' }, { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' }, { code: 'uk', label: 'Ukrainian' }, { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' }, { code: 'cy', label: 'Welsh' }
];

var langActiveIdx = -1;

function initializeEventListeners() {
  const fileInput = document.getElementById('file');
  const dropzone = document.getElementById('dropzone');

  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Drag & drop visual feedback
  if (dropzone) {
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', function () {
      dropzone.classList.remove('drag-over');
    });
  }

  // Language combobox
  initLangCombobox();
}
// ── Authentication Logic ───────────────────────────────────────────────

function checkAuthFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');

  if (token) {
    localStorage.setItem('subforge_token', token);
    if (email) localStorage.setItem('subforge_email', email);

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    showToast('Successfully logged in!', 'success');
  }
}

function loginWithGoogle() {
  const endpoint = API_BASE_URL + '/auth/google/login';
  window.location.href = endpoint;
}

function getToken() {
  return localStorage.getItem('subforge_token');
}

function updateAuthUI() {
  const token = getToken();
  const email = localStorage.getItem('subforge_email');

  const authBtn = document.getElementById('authBtn');
  const userMenu = document.getElementById('userMenu');
  const userGreeting = document.getElementById('userGreeting');

  if (token) {
    authBtn.style.display = 'none';
    if (email) {
      const name = email.split('@')[0];
      // Capitalize first letter logic
      const capitalizedRef = name.charAt(0).toUpperCase() + name.slice(1);
      userGreeting.textContent = 'Hi ' + capitalizedRef;
      userMenu.style.display = 'block';
    }
  } else {
    authBtn.style.display = 'inline-block';
    userMenu.style.display = 'none';
  }
}

// ── Dropdown Logic ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent document click from firing immediately
      const isExpanded = userMenuBtn.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        userMenuBtn.setAttribute('aria-expanded', 'false');
        userDropdown.classList.remove('show');
      } else {
        userMenuBtn.setAttribute('aria-expanded', 'true');
        userDropdown.classList.add('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userMenuBtn.setAttribute('aria-expanded', 'false');
        userDropdown.classList.remove('show');
      }
    });
  }
});

function toggleAuthModal() {
  // Now redirects to the dedicated auth page
  hideAllPages();
  currentPage = 'auth';
  show('authPage');
  setBackBtn(true);

  // Pre-fill email if Remember Me applies
  const savedEmail = localStorage.getItem('subforge_remembered_email');
  if (savedEmail) {
    document.getElementById('emailInput').value = savedEmail;
    document.getElementById('rememberMe').checked = true;
  }
}

function toggleAuthMode(e) {
  e.preventDefault();
  const form = document.getElementById('loginForm');
  const submitBtnText = document.querySelector('#loginSubmitBtn .btn-text');
  const modeTxt = document.getElementById('authModeToggle');
  const title = document.querySelector('.auth-header .page-title');
  const subtitle = document.querySelector('.auth-header .page-subtitle');
  const optionsRow = document.querySelector('.auth-options');

  const isLogin = submitBtnText.textContent.trim() === 'Log In';

  // Clear errors on mode switch
  document.getElementById('emailError').textContent = '';
  document.getElementById('passwordError').textContent = '';
  document.getElementById('emailInput').classList.remove('invalid', 'valid');
  document.getElementById('passwordInput').classList.remove('invalid', 'valid');

  if (isLogin) {
    submitBtnText.textContent = 'Register';
    modeTxt.textContent = 'Log In';
    modeTxt.previousSibling.textContent = "Already have an account? ";
    title.textContent = "Create Account";
    subtitle.textContent = "Join SubForge to manage your jobs";
    form.dataset.mode = "register";
    optionsRow.style.display = 'none'; // Hide terms/remember me on register for now
  } else {
    submitBtnText.textContent = 'Log In';
    modeTxt.textContent = 'Register';
    modeTxt.previousSibling.textContent = "Don't have an account? ";
    title.textContent = "Welcome Back";
    subtitle.textContent = "Login to SubForge to manage your jobs";
    form.dataset.mode = "login";
    optionsRow.style.display = 'flex';
  }
}

// ── Real-Time Validation ───────────────────────────────────────────────

function validateEmail(focusedOut = false) {
  const emailInput = document.getElementById('emailInput');
  const errorSpan = document.getElementById('emailError');
  const email = emailInput.value.trim();

  if (!email) {
    if (focusedOut) {
      errorSpan.textContent = "Email is required.";
      errorSpan.classList.add('active');
      emailInput.classList.add('invalid');
      emailInput.classList.remove('valid');
    } else {
      errorSpan.classList.remove('active');
      emailInput.classList.remove('invalid', 'valid');
    }
    return false;
  }

  if (!email.includes('@')) {
    errorSpan.textContent = "Please include an '@' in the email address.";
    errorSpan.classList.add('active');
    emailInput.classList.add('invalid');
    emailInput.classList.remove('valid');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorSpan.textContent = "Please enter a fully valid email (e.g., name@domain.com).";
    errorSpan.classList.add('active');
    emailInput.classList.add('invalid');
    emailInput.classList.remove('valid');
    return false;
  }

  errorSpan.textContent = '';
  errorSpan.classList.remove('active');
  emailInput.classList.remove('invalid');
  emailInput.classList.add('valid');
  return true;
}

function validatePassword(focusedOut = false) {
  const passwordInput = document.getElementById('passwordInput');
  const errorSpan = document.getElementById('passwordError');
  const password = passwordInput.value;

  if (!password) {
    if (focusedOut) {
      errorSpan.textContent = "Password is required.";
      errorSpan.classList.add('active');
      passwordInput.classList.add('invalid');
      passwordInput.classList.remove('valid');
    } else {
      errorSpan.classList.remove('active');
      passwordInput.classList.remove('invalid', 'valid');
    }
    return false;
  }

  if (password.length < 8) {
    errorSpan.textContent = "Password must be at least 8 characters long.";
    errorSpan.classList.add('active');
    passwordInput.classList.add('invalid');
    passwordInput.classList.remove('valid');
    return false;
  }

  errorSpan.textContent = '';
  errorSpan.classList.remove('active');
  passwordInput.classList.remove('invalid');
  passwordInput.classList.add('valid');
  return true;
}

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const showIcon = document.getElementById('eyeIconShow');
  const hideIcon = document.getElementById('eyeIconHide');
  const btn = document.getElementById('togglePasswordBtn');

  if (input.type === 'password') {
    input.type = 'text';
    showIcon.style.display = 'none';
    hideIcon.style.display = 'block';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    showIcon.style.display = 'block';
    hideIcon.style.display = 'none';
    btn.setAttribute('aria-label', 'Show password');
  }
}

function handleForgotPassword(e) {
  e.preventDefault();
  showToast('Password reset instructions have been sent to your email.', 'info');
}

// ── Auth Submission ────────────────────────────────────────────────────

async function handleLoginSubmit(e) {
  e.preventDefault();

  const isEmailValid = validateEmail(true);
  const isPasswordValid = validatePassword(true);

  if (!isEmailValid || !isPasswordValid) {
    return; // Block submission if validation fails
  }

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const form = document.getElementById('loginForm');
  const isRegister = form.dataset.mode === "register";

  const btn = document.getElementById('loginSubmitBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  // Activate Loading State
  btn.disabled = true;
  btnText.textContent = isRegister ? 'Registering...' : 'Logging In...';
  btnSpinner.style.display = 'inline-block';

  try {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    let url = isRegister ? '/auth/register' : '/auth/token';
    const endpoint = API_BASE_URL + url;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Authentication failed');
    }

    if (isRegister) {
      showToast('Registration successful! Please log in.', 'success');
      toggleAuthMode(new CustomEvent('click')); // switch back to login
    } else {
      localStorage.setItem('subforge_token', data.access_token);
      localStorage.setItem('subforge_email', email);

      if (rememberMe) {
        localStorage.setItem('subforge_remembered_email', email);
      } else {
        localStorage.removeItem('subforge_remembered_email');
      }

      updateAuthUI();
      showHomePage(); // Navigate away from Auth Page
      showToast('Successfully logged in!', 'success');
    }

  } catch (error) {
    showToast(error.message, 'error');

    // Optionally flag the inputs as invalid on a 401 Unauthorized
    if (error.message.toLowerCase().includes('incorrect') || error.message.toLowerCase().includes('unauthorized')) {
      document.getElementById('emailInput').classList.add('invalid');
      document.getElementById('passwordInput').classList.add('invalid');
    }
  } finally {
    // Restore Loading State
    btn.disabled = false;
    btnText.textContent = isRegister ? 'Register' : 'Log In';
    btnSpinner.style.display = 'none';
  }
}

function logoutUser() {
  localStorage.removeItem('subforge_token');
  localStorage.removeItem('subforge_email');
  updateAuthUI();
  showToast('Logged out successfully', 'info');
  showHomePage();
}

// ── Language Combobox Logic ──────────────────────────────────────────────

function initLangCombobox() {
  var input = document.getElementById('languageSearch');
  var list = document.getElementById('langList');
  var clearBtn = document.getElementById('langClear');
  var hidden = document.getElementById('language');
  if (!input) return;

  // Show list on focus
  input.addEventListener('focus', function () {
    renderLangList(input.value);
    list.style.display = 'block';
  });

  // Filter on typing
  input.addEventListener('input', function () {
    langActiveIdx = -1;
    renderLangList(input.value);
    list.style.display = 'block';
    // If user clears input, reset to auto-detect
    if (!input.value.trim()) {
      hidden.value = '';
      clearBtn.style.display = 'none';
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', function (e) {
    var items = list.querySelectorAll('.combobox-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      langActiveIdx = Math.min(langActiveIdx + 1, items.length - 1);
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      langActiveIdx = Math.max(langActiveIdx - 1, 0);
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (langActiveIdx >= 0 && items[langActiveIdx]) {
        items[langActiveIdx].click();
      }
    } else if (e.key === 'Escape') {
      list.style.display = 'none';
      input.blur();
    }
  });

  // Clear button
  clearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    input.value = '';
    hidden.value = '';
    clearBtn.style.display = 'none';
    input.placeholder = 'Auto-detect';
    input.focus();
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#langCombobox')) {
      list.style.display = 'none';
    }
  });
}

function renderLangList(query) {
  var list = document.getElementById('langList');
  var q = (query || '').toLowerCase().trim();

  var filtered = LANGUAGES.filter(function (lang) {
    if (!q) return true;
    return lang.label.toLowerCase().indexOf(q) !== -1 ||
      lang.code.toLowerCase().indexOf(q) !== -1;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<li class="combobox-empty">No language found</li>';
    return;
  }

  list.innerHTML = filtered.map(function (lang, i) {
    var display = lang.label;
    if (q && lang.label.toLowerCase().indexOf(q) !== -1) {
      var idx = lang.label.toLowerCase().indexOf(q);
      display = lang.label.substring(0, idx) +
        '<span class="match">' + lang.label.substring(idx, idx + q.length) + '</span>' +
        lang.label.substring(idx + q.length);
    }
    return '<li class="combobox-item" data-code="' + lang.code + '" data-label="' + lang.label + '">' + display + '</li>';
  }).join('');

  // Click handlers
  list.querySelectorAll('.combobox-item').forEach(function (item) {
    item.addEventListener('click', function () {
      selectLang(item.dataset.code, item.dataset.label);
    });
  });
}

function selectLang(code, label) {
  var input = document.getElementById('languageSearch');
  var hidden = document.getElementById('language');
  var list = document.getElementById('langList');
  var clearBtn = document.getElementById('langClear');

  hidden.value = code;
  if (code) {
    input.value = label;
    clearBtn.style.display = 'flex';
  } else {
    input.value = '';
    input.placeholder = 'Auto-detect';
    clearBtn.style.display = 'none';
  }
  list.style.display = 'none';
  langActiveIdx = -1;
}

function updateActiveItem(items) {
  items.forEach(function (el, i) {
    el.classList.toggle('active', i === langActiveIdx);
  });
  if (items[langActiveIdx]) {
    items[langActiveIdx].scrollIntoView({ block: 'nearest' });
  }
}

// ── File Handling ────────────────────────────────────────────────────────

function handleFileSelect() {
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];
  const content = document.querySelector('.dropzone-content');
  const preview = document.getElementById('filePreview');

  if (file && preview) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = sizeMB + ' MB';

    content.style.display = 'none';
    preview.style.display = 'flex';
  }
}

function clearFile() {
  const fileInput = document.getElementById('file');
  const content = document.querySelector('.dropzone-content');
  const preview = document.getElementById('filePreview');

  fileInput.value = '';
  content.style.display = '';
  preview.style.display = 'none';
}

// ── Toast Notifications ─────────────────────────────────────────────────

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('leaving');
    setTimeout(function () { toast.remove(); }, 250);
  }, 4000);
}

// ── Page Navigation ─────────────────────────────────────────────────────

function goBack() {
  showHomePage();
}

function showHomePage() {
  hideAllPages();
  currentPage = 'home';
  show('homePage');
  setBackBtn(false);
}

function showUploadPage() {
  hideAllPages();
  currentPage = 'upload';
  show('uploadPage');
  setBackBtn(true);

  const token = getToken();
  if (token) {
    document.getElementById('uploadUnauthState').style.display = 'none';
    document.getElementById('uploadAuthContent').style.display = 'block';
  } else {
    document.getElementById('uploadUnauthState').style.display = 'flex';
    document.getElementById('uploadAuthContent').style.display = 'none';
  }
}

function showJobsPage() {
  hideAllPages();
  currentPage = 'jobs';
  show('jobsPage');
  setBackBtn(true);

  const token = getToken();
  if (token) {
    document.getElementById('jobsUnauthState').style.display = 'none';
    document.getElementById('jobsAuthContent').style.display = 'block';
    loadAndDisplayJobs();
  } else {
    document.getElementById('jobsUnauthState').style.display = 'flex';
    document.getElementById('jobsAuthContent').style.display = 'none';
  }
}

function showStatusPage() {
  hideAllPages();
  currentPage = 'status';
  show('statusPage');
  setBackBtn(true);
  document.getElementById('jobIdDisplay').textContent = currentOriginalFilename ? currentOriginalFilename : 'Job ID: ' + jobId;
}

function hideAllPages() {
  ['homePage', 'uploadPage', 'statusPage', 'jobsPage', 'authPage'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function show(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function setBackBtn(visible) {
  var btn = document.getElementById('backBtn');
  if (btn) btn.style.display = visible ? 'flex' : 'none';
}

// ── Engine Selector ─────────────────────────────────────────────────────

function selectEngine(engine) {
  var buttons = document.querySelectorAll('.engine-option');
  buttons.forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.engine === engine);
  });
  document.getElementById('engine').value = engine;

  // Show/hide the Whisper Model dropdown
  var modelField = document.getElementById('modelField');
  if (modelField) {
    modelField.style.display = engine === 'whisper' ? '' : 'none';
  }
}

// ── Upload ──────────────────────────────────────────────────────────────

function upload() {
  var fileInput = document.getElementById('file');
  var file = fileInput.files[0];

  if (!file) {
    showToast('Please select a video or audio file.', 'warning');
    return;
  }

  var engine = document.getElementById('engine').value;
  var form = new FormData();
  form.append('file', file);

  var language = document.getElementById('language').value;
  var model = document.getElementById('model').value;
  var translate = document.getElementById('translate').checked;

  if (language) form.append('language', language);
  if (engine === 'whisper') form.append('model', model);
  form.append('translate', translate ? 'on' : 'off');

  var uploadBtn = document.getElementById('uploadBtn');
  var cancelBtn = document.getElementById('cancelUploadBtn');
  var progressSection = document.getElementById('uploadProgressSection');

  uploadBtn.style.display = 'none';
  cancelBtn.style.display = 'flex';
  progressSection.style.display = 'block';

  uploadStartTime = Date.now();

  var xhr = new XMLHttpRequest();
  currentXHR = xhr;

  // Progress
  xhr.upload.addEventListener('progress', function (e) {
    if (e.lengthComputable) {
      var pct = (e.loaded / e.total) * 100;
      var uploadedMB = (e.loaded / (1024 * 1024)).toFixed(2);
      var totalMB = (e.total / (1024 * 1024)).toFixed(2);
      var elapsed = (Date.now() - uploadStartTime) / 1000;
      var speed = (e.loaded / (1024 * 1024)) / elapsed;

      var eta = '--:--';
      if (speed > 0) {
        var remaining = (e.total - e.loaded) / (speed * 1024 * 1024);
        var m = Math.floor(remaining / 60);
        var s = Math.floor(remaining % 60);
        eta = m + ':' + s.toString().padStart(2, '0');
      }

      document.getElementById('uploadProgressFill').style.width = pct + '%';
      document.getElementById('uploadPercentDisplay').textContent = pct.toFixed(1) + '%';
      document.getElementById('uploadedSize').textContent = uploadedMB + ' MB';
      document.getElementById('totalSize').textContent = totalMB + ' MB';
      document.getElementById('uploadSpeed').textContent = speed.toFixed(2) + ' MB/s';
      document.getElementById('uploadETA').textContent = eta;
    }
  });

  // Load
  xhr.addEventListener('load', function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        jobId = data.job_id;
        currentOriginalFilename = file.name || null;
        resetUploadUI();
        showStatusPage();
        showToast('Job created! Transcription is starting…', 'success');
        checkStatus();
      } catch (e) {
        showToast('Failed to parse server response.', 'error');
        resetUploadUI();
      }
    } else {
      var detail = 'Upload failed (status ' + xhr.status + ')';
      try {
        var err = JSON.parse(xhr.responseText);
        if (err.detail) detail = err.detail;
      } catch (_) { }
      showToast(detail, 'error');
      resetUploadUI();
    }
    currentXHR = null;
  });

  xhr.addEventListener('error', function () {
    showToast('Network error during upload.', 'error');
    resetUploadUI();
    currentXHR = null;
  });

  xhr.addEventListener('abort', function () {
    showToast('Upload cancelled.', 'warning');
    resetUploadUI();
    currentXHR = null;
  });

  var uploadUrl = engine === 'riva'
    ? API_BASE_URL + '/api/riva/jobs'
    : API_BASE_URL + '/api/jobs';
  xhr.open('POST', uploadUrl, true);

  const token = getToken();
  if (token) {
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  }

  xhr.send(form);
}

function cancelUpload() {
  if (currentXHR) {
    currentXHR.abort();
    resetUploadUI();
  }
}

function resetUploadUI() {
  var uploadBtn = document.getElementById('uploadBtn');
  var cancelBtn = document.getElementById('cancelUploadBtn');
  var progressSection = document.getElementById('uploadProgressSection');

  uploadBtn.style.display = 'flex';
  cancelBtn.style.display = 'none';
  progressSection.style.display = 'none';

  document.getElementById('uploadProgressFill').style.width = '0%';
  document.getElementById('uploadPercentDisplay').textContent = '0%';
  document.getElementById('uploadedSize').textContent = '0 MB';
  document.getElementById('totalSize').textContent = '0 MB';
  document.getElementById('uploadSpeed').textContent = '0 MB/s';
  document.getElementById('uploadETA').textContent = '--:--';
}

// ── Status Checking ─────────────────────────────────────────────────────

async function checkStatus() {
  if (!jobId) {
    showToast('No active job.', 'warning');
    return;
  }

  var checkBtn = document.getElementById('checkStatusBtn');
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner-inline"></span>Checking…';

  try {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var res = await fetch(API_BASE_URL + '/api/jobs/' + jobId, { headers });

    if (res.status === 401) {
      throw new Error('Unauthorized. Please log in.');
    }
    if (!res.ok) throw new Error('Failed to get job status');

    var data = await res.json();

    // Store original filename for download
    currentOriginalFilename = data.original_filename || null;
    document.getElementById('jobIdDisplay').textContent = currentOriginalFilename ? currentOriginalFilename : 'Job ID: ' + jobId;

    // Status
    var statusEl = document.getElementById('statusValue');
    statusEl.textContent = data.status.toUpperCase();
    statusEl.className = 'status-val ' + data.status;

    // Language
    var langDisplay = 'Auto-detect';
    if (data.detected_language) {
      langDisplay = data.detected_language.toUpperCase() + ' (detected)';
    } else if (data.language) {
      langDisplay = data.language.toUpperCase();
    }
    document.getElementById('languageValue').textContent = langDisplay;

    // Model
    document.getElementById('modelValue').textContent = (data.model || 'base').toUpperCase();

    // Translation
    document.getElementById('translateValue').textContent = data.translate ? 'Yes' : 'No';

    // Progress
    if (data.status === 'running' || data.total_segments > 0) {
      var pc = document.getElementById('progressContainer');
      pc.style.display = 'block';
      var pct = data.progress_percentage || 0;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPercent').textContent = pct + '%';
      document.getElementById('progressText').textContent =
        data.completed_segments + ' / ' + data.total_segments + ' segments';

      document.getElementById('segmentsRow').style.display = 'flex';
      document.getElementById('segmentsValue').textContent =
        data.completed_segments + ' / ' + data.total_segments;
    }

    if (data.status === 'done') {
      showToast('Transcription completed!', 'success');
      document.getElementById('downloadBtn').style.display = 'flex';
      document.getElementById('resetBtn').style.display = 'flex';
      document.getElementById('checkStatusBtn').style.display = 'none';
    } else if (data.status === 'failed') {
      showToast('Transcription failed.', 'error');
      document.getElementById('resetBtn').style.display = 'flex';
      document.getElementById('checkStatusBtn').style.display = 'none';
      if (data.error) {
        var errEl = document.getElementById('errorMessage');
        errEl.textContent = 'Error: ' + data.error;
        errEl.style.display = 'block';
      }
    }

  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 4L16 12L11 7L1 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      'Check Status';
  }
}

// ── Download & Reset ────────────────────────────────────────────────────

function downloadSubtitles() {
  if (!jobId) return;
  const token = getToken();
  let url = API_BASE_URL + '/api/jobs/' + jobId + '/subtitles';
  if (token) {
    url += '?token=' + token; // Backend would need to support auth via query param for direct download links, or we use File API
  }

  // To send authorization headers for a download, we use fetch and create an object URL
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  fetch(API_BASE_URL + '/api/jobs/' + jobId + '/subtitles', { headers })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized or not found");
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = srtFilename(currentOriginalFilename, jobId);
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => showToast("Error downloading: " + err.message, "error"));
}

function resetForm() {
  jobId = null;
  clearFile();
  document.getElementById('language').value = '';
  document.getElementById('languageSearch').value = '';
  document.getElementById('languageSearch').placeholder = 'Auto-detect';
  document.getElementById('langClear').style.display = 'none';
  document.getElementById('translate').checked = false;
  document.getElementById('downloadBtn').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'none';
  document.getElementById('checkStatusBtn').style.display = 'flex';
  document.getElementById('errorMessage').style.display = 'none';
  document.getElementById('progressContainer').style.display = 'none';
  document.getElementById('segmentsRow').style.display = 'none';
  currentOriginalFilename = null;
  selectEngine('whisper');
  showHomePage();
}

// ── Jobs List ───────────────────────────────────────────────────────────

async function loadAndDisplayJobs() {
  var grid = document.getElementById('jobsGrid');

  // Show skeleton while loading
  grid.innerHTML =
    '<div class="skeleton-card"><div class="skel-line w60"></div><div class="skel-line w40"></div><div class="skel-line w80"></div></div>' +
    '<div class="skeleton-card"><div class="skel-line w60"></div><div class="skel-line w40"></div><div class="skel-line w80"></div></div>' +
    '<div class="skeleton-card"><div class="skel-line w60"></div><div class="skel-line w40"></div><div class="skel-line w80"></div></div>';

  try {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var res = await fetch(API_BASE_URL + '/api/jobs', { headers });

    if (res.status === 401 || res.status === 403) {
      // Token may be invalid/expired, automatically trigger logout to clean state
      localStorage.removeItem('subforge_token');
      localStorage.removeItem('subforge_email');
      updateAuthUI();

      showJobsPage(); // Re-render the page to show the unauth state correctly
      return;
    }

    if (!res.ok) throw new Error('Failed to load jobs');

    var data = await res.json();
    var jobs = data.jobs || [];

    if (jobs.length === 0) {
      grid.innerHTML =
        '<div class="no-jobs">' +
        '<p>No transcription jobs yet</p>' +
        '<p style="font-size: 0.8125rem; margin-top: 6px;">Upload a video to get started</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = jobs.map(function (job) {
      return (
        '<div class="job-card">' +
        '<div class="job-card-header">' +
        '<span class="job-card-id">' + (job.original_filename || job.video || job.job_id) + '</span>' +
        '<span class="job-card-status ' + job.status + '">' + job.status + '</span>' +
        '</div>' +
        '<div class="job-card-details">' +
        '<div>Created: ' + new Date(job.created_at).toLocaleString() + '</div>' +
        (job.language ? '<div>Language: ' + job.language + '</div>' : '') +
        (job.detected_language ? '<div>Detected: ' + job.detected_language.toUpperCase() + '</div>' : '') +
        (job.progress_percentage !== undefined ? '<div>Progress: ' + job.progress_percentage + '%</div>' : '') +
        '</div>' +
        '<div class="job-card-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="viewJobStatus(\'' + job.job_id + '\', \'' + (job.original_filename || '').replace(/'/g, "\\'") + '\')">View</button>' +
        (job.status === 'done'
          ? '<button class="btn btn-accent btn-sm" onclick="downloadJobSubtitles(\'' + job.job_id + '\', \'' + (job.original_filename || '').replace(/'/g, "\\'") + '\')">Download</button>'
          : '') +
        '</div>' +
        '</div>'
      );
    }).join('');

  } catch (error) {
    grid.innerHTML =
      '<div class="no-jobs"><p style="color: #F87171;">Error loading jobs: ' + error.message + '</p></div>';
  }
}

function viewJobStatus(id, originalFilename) {
  jobId = id;
  currentOriginalFilename = originalFilename || null;
  hideAllPages();
  currentPage = 'status';
  show('statusPage');
  setBackBtn(true);

  document.getElementById('jobIdDisplay').textContent = currentOriginalFilename ? currentOriginalFilename : 'Job ID: ' + jobId;
  document.getElementById('downloadBtn').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'flex';
  document.getElementById('checkStatusBtn').style.display = 'flex';
  document.getElementById('errorMessage').style.display = 'none';

  checkStatus();
}

function downloadJobSubtitles(id, originalFilename) {
  const token = getToken();
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  fetch(API_BASE_URL + '/api/jobs/' + id + '/subtitles', { headers })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized or not found");
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = srtFilename(originalFilename, id);
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => showToast("Error downloading: " + err.message, "error"));
}
