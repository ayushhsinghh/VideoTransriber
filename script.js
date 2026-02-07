// Configuration - adjust these if deploying on a separate server
const API_BASE_URL = window.location.origin || 'http://localhost:8000';

let jobId = null;
let currentPage = 'home'; // 'home', 'upload', 'status', 'jobs'

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  showHomePage();
});

function initializeEventListeners() {
  // File input change handler
  const fileInput = document.getElementById('file');
  if (fileInput) {
    fileInput.addEventListener('change', updateFileInfo);
  }
}

function updateFileInfo() {
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];
  const fileInfoEl = document.getElementById('fileInfo');
  
  if (file && fileInfoEl) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const durationEl = document.getElementById('fileDuration') || {};
    
    fileInfoEl.innerHTML = `
      <strong>File:</strong> ${file.name}<br>
      <strong>Size:</strong> ${sizeMB} MB
    `;
  }
}

function showMessage(message, type = 'info') {
  const msgEl = document.getElementById('message');
  msgEl.textContent = message;
  msgEl.className = `message show ${type}`;
}

function hideMessage() {
  const msgEl = document.getElementById('message');
  msgEl.className = 'message';
}

function goBack() {
  if (currentPage === 'upload') {
    showHomePage();
  } else if (currentPage === 'status') {
    showHomePage();
  } else if (currentPage === 'jobs') {
    showHomePage();
  }
}

function showHomePage() {
  hideAllPages();
  currentPage = 'home';
  
  const homeEl = document.getElementById('homePage');
  if (homeEl) {
    homeEl.style.display = 'block';
  }
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = 'none';
  }
}

function showUploadPage() {
  hideAllPages();
  currentPage = 'upload';
  
  const uploadEl = document.getElementById('uploadPage');
  if (uploadEl) {
    uploadEl.style.display = 'block';
  }
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = 'inline-block';
  }
  
  hideMessage();
}

function showJobsPage() {
  hideAllPages();
  currentPage = 'jobs';
  
  const jobsEl = document.getElementById('jobsPage');
  if (jobsEl) {
    jobsEl.style.display = 'block';
  }
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = 'inline-block';
  }
  
  loadAndDisplayJobs();
}

function hideAllPages() {
  const pages = ['homePage', 'uploadPage', 'statusPage', 'jobsPage'];
  pages.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
    }
  });
}

async function upload() {
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];

  if (!file) {
    showMessage('Please select a video file', 'warning');
    return;
  }

  if (file.size > 1000 * 1024 * 1024) { // 1GB limit
    showMessage('File size must be less than 1GB', 'error');
    return;
  }

  const form = new FormData();
  form.append('file', file);

  const language = document.getElementById('language').value;
  const translate = document.getElementById('translate').checked;

  if (language) {
    form.append('language', language);
  }
  form.append('translate', translate ? 'on' : 'off');

  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<span class="spinner"></span>Uploading...';

  showMessage('Uploading video file...', 'info');

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      body: form
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    jobId = data.job_id;

    showStatusPage();
    showMessage(`✓ Job created successfully! Transcription is starting...`, 'success');
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = 'Upload & Transcribe';

    // Fetch initial status
    await checkStatus();

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = 'Upload & Transcribe';
  }
}

function showStatusPage() {
  hideAllPages();
  currentPage = 'status';
  
  const statusEl = document.getElementById('statusPage');
  if (statusEl) {
    statusEl.style.display = 'block';
  }
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = 'inline-block';
  }
  
  document.getElementById('jobIdDisplay').textContent = `Job ID: ${jobId}`;
}

async function checkStatus() {
  if (!jobId) {
    showMessage('No active job', 'warning');
    return;
  }

  const checkBtn = document.getElementById('checkStatusBtn');
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<span class="spinner"></span>Checking...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);

    if (!res.ok) {
      throw new Error('Failed to get job status');
    }

    const data = await res.json();

    // Update status display
    const statusValue = document.getElementById('statusValue');
    statusValue.textContent = data.status.toUpperCase();
    statusValue.className = `status-value ${data.status}`;

    // Update language display
    let languageDisplay = 'Auto-detect';
    if (data.detected_language) {
      languageDisplay = `${data.detected_language.toUpperCase()} (detected)`;
    } else if (data.language) {
      languageDisplay = data.language.toUpperCase();
    }
    document.getElementById('languageValue').textContent = languageDisplay;

    // Update translate display
    document.getElementById('translateValue').textContent = data.translate ? 'Yes' : 'No';

    // Update progress if running
    if (data.status === 'running' || (data.total_segments > 0)) {
      const progressContainer = document.getElementById('progressContainer');
      progressContainer.style.display = 'block';

      const percent = data.progress_percentage || 0;
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressPercent').textContent = percent + '%';
      document.getElementById('progressText').textContent = `${data.completed_segments}/${data.total_segments} segments`;

      document.getElementById('segmentsRow').style.display = 'flex';
      document.getElementById('segmentsValue').textContent = `${data.completed_segments}/${data.total_segments}`;

      hideMessage();
    }

    if (data.status === 'done') {
      showMessage('✓ Transcription completed!', 'success');
      document.getElementById('downloadBtn').style.display = 'flex';
      document.getElementById('resetBtn').style.display = 'flex';
      document.getElementById('checkStatusBtn').style.display = 'none';
    } else if (data.status === 'failed') {
      showMessage(`✗ Transcription failed`, 'error');
      document.getElementById('resetBtn').style.display = 'flex';
      document.getElementById('checkStatusBtn').style.display = 'none';
      if (data.error) {
        document.getElementById('errorMessage').textContent = `Error: ${data.error}`;
        document.getElementById('errorMessage').style.display = 'block';
      }
    } else {
      showMessage(`Current status: ${data.status}. Click "Check Status" to refresh.`, 'info');
    }

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML = 'Check Status';
  }
}

function downloadSubtitles() {
  if (!jobId) return;
  window.location.href = `${API_BASE_URL}/api/jobs/${jobId}/subtitles`;
}

function resetForm() {
  jobId = null;
  document.getElementById('file').value = '';
  document.getElementById('language').value = '';
  document.getElementById('translate').checked = false;
  document.getElementById('downloadBtn').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'none';
  document.getElementById('checkStatusBtn').style.display = 'flex';
  document.getElementById('errorMessage').style.display = 'none';
  document.getElementById('progressContainer').style.display = 'none';
  document.getElementById('segmentsRow').style.display = 'none';
  document.getElementById('fileInfo').innerHTML = '';
  showHomePage();
}

async function loadAndDisplayJobs() {
  const jobsGrid = document.getElementById('jobsGrid');
  jobsGrid.innerHTML = '<p style="text-align: center; padding: 20px;">Loading jobs...</p>';

  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs`);

    if (!res.ok) {
      throw new Error('Failed to load jobs');
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    if (jobs.length === 0) {
      jobsGrid.innerHTML = '<div class="no-jobs"><p>No transcription jobs yet</p><p style="font-size: 13px; margin-top: 10px;">Start a new job to see it here</p></div>';
      return;
    }

    jobsGrid.innerHTML = jobs.map(job => `
      <div class="job-card">
        <div class="job-card-header">
          <div class="job-card-id">${job.job_id}</div>
          <span class="job-card-status ${job.status}">${job.status.toUpperCase()}</span>
        </div>
        <div class="job-card-details">
          <div style="margin-bottom: 4px;">Created: ${new Date(job.created_at).toLocaleString()}</div>
          ${job.language ? `<div style="margin-bottom: 4px;">Language: ${job.language}</div>` : ''}
          ${job.detected_language ? `<div style="margin-bottom: 4px;">Detected: ${job.detected_language.toUpperCase()}</div>` : ''}
          ${job.progress_percentage !== undefined ? `<div style="margin-bottom: 4px;">Progress: ${job.progress_percentage}%</div>` : ''}
        </div>
        <div class="job-card-action">
          <button class="btn-tiny btn-tiny-primary" onclick="viewJobStatus('${job.job_id}')">View Status</button>
          ${job.status === 'done' ? `<button class="btn-tiny btn-tiny-primary" onclick="downloadJobSubtitles('${job.job_id}')">Download</button>` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    jobsGrid.innerHTML = `<div class="no-jobs"><p style="color: #d32f2f;">Error loading jobs: ${error.message}</p></div>`;
  }
}

function viewJobStatus(id) {
  jobId = id;
  hideAllPages();
  currentPage = 'status';
  
  const statusEl = document.getElementById('statusPage');
  if (statusEl) {
    statusEl.style.display = 'block';
  }
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = 'inline-block';
  }
  
  document.getElementById('jobIdDisplay').textContent = `Job ID: ${jobId}`;
  document.getElementById('downloadBtn').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'flex';
  document.getElementById('checkStatusBtn').style.display = 'flex';
  document.getElementById('errorMessage').style.display = 'none';
  
  checkStatus();
}

function downloadJobSubtitles(id) {
  window.location.href = `${API_BASE_URL}/api/jobs/${id}/subtitles`;
}
