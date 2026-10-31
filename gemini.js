/* Gemini extends SubForge's existing upload/status views; credentials remain server-side. */
var GeminiFlow = (function () {
  'use strict';
  var capabilities = null;
  var current = null;
  var pollTimer = null;
  var pending = false;
  function el(id) { return document.getElementById(id); }
  function visible(id, value) { el(id).hidden = !value; }
  function endpoint(id, path) { return API_BASE_URL + '/api/jobs/' + encodeURIComponent(id) + path; }
  function message(text) { el('geminiStatusText').textContent = text; }
  function clearPolling() { clearTimeout(pollTimer); pollTimer = null; }
  function time(seconds) {
    var total = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(total / 3600) + ':' + String(Math.floor(total % 3600 / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  async function init() {
    try {
      var response = await fetch(API_BASE_URL + '/api/gemini/capabilities', { credentials: 'include' });
      if (!response.ok) return;
      capabilities = await response.json();
      if (!capabilities.enabled) return;
      visible('geminiEngine', true);
      var list = el('geminiLanguageOptions');
      capabilities.languages.forEach(function (language) {
        var option = document.createElement('option');
        option.value = language.name + ' (' + language.code + ')';
        list.appendChild(option);
      });
      el('geminiTarget').value = 'English (en)';
      el('geminiTarget').addEventListener('input', subtitleNotice);
      subtitleNotice();
    } catch (_) { /* Old servers keep the existing engines available. */ }
  }
  function selectedLanguage() {
    if (!capabilities) return null;
    var value = el('geminiTarget').value.trim().toLowerCase();
    return capabilities.languages.find(function (language) {
      return language.code.toLowerCase() === value || (language.name + ' (' + language.code + ')').toLowerCase() === value;
    });
  }
  function subtitleNotice() {
    var language = selectedLanguage();
    el('geminiSubtitleNotice').textContent = language && !language.subtitle_fallback_supported
      ? 'This language requires timestamps from Gemini. If they are unavailable, audio remains downloadable and subtitle generation reports an error.' : '';
  }
  function select(engine) {
    visible('geminiOptions', engine === 'gemini');
    document.querySelector('#uploadAuthContent .page-title').textContent = engine === 'gemini' ? 'Translate video audio' : 'Upload & Transcribe';
    document.querySelector('#uploadAuthContent .page-subtitle').textContent = engine === 'gemini' ? 'Upload a video to create translated audio and optional subtitles' : 'Select one or more video or audio files to generate subtitles';
    el('file').accept = engine === 'gemini' ? 'video/*' : 'video/*,audio/*';
    el('uploadBtn').lastChild.textContent = engine === 'gemini' ? ' Start audio translation' : ' Start Transcription';
    document.querySelector('.dropzone-hint').textContent = engine === 'gemini' ? 'Videos up to 6 GB · duration up to 6 hours' : 'MP4, MKV, AVI, MOV, MP3, WAV — up to 6 GB each';
    var sourceField = el('languageSearch').closest('.field');
    sourceField.hidden = engine === 'gemini';
    el('translate').closest('.toggle-row').hidden = engine === 'gemini';
  }
  function validate(engine) {
    if (engine !== 'gemini') return true;
    if (!capabilities || !capabilities.enabled || !selectedLanguage()) {
      showToast('Select a supported Gemini target language.', 'warning');
      return false;
    }
    return true;
  }
  function append(form) {
    form.append('target_language', selectedLanguage().code);
    form.append('generate_subtitles', el('geminiSubtitles').checked ? 'true' : 'false');
  }
  function downloads(data) {
    var root = el('geminiDownloads');
    root.replaceChildren();
    var artifacts = data.artifacts || {};
    [['wav', 'Download WAV'], ['mp3', 'Download MP3'], ['srt', 'Download SRT'], ['vtt', 'Download VTT']].forEach(function (entry) {
      if (!artifacts[entry[0]]) return;
      var link = document.createElement('a');
      link.className = 'btn btn-ghost';
      link.textContent = entry[1];
      link.href = endpoint(data.job_id, (entry[0] === 'wav' || entry[0] === 'mp3' ? '/audio' : '/subtitles') + '?format=' + entry[0]);
      root.appendChild(link);
    });
    var audio = el('geminiAudio');
    var preview = artifacts.mp3 ? 'mp3' : artifacts.wav ? 'wav' : null;
    audio.hidden = !preview;
    if (preview) {
      var url = endpoint(data.job_id, '/audio?format=' + preview);
      if (audio.getAttribute('src') !== url) audio.src = url;
    } else { audio.pause(); audio.removeAttribute('src'); }
  }
  function status(data) {
    clearPolling();
    current = data.engine === 'gemini_translate' ? data : null;
    visible('geminiResult', !!current);
    if (!current) {
      el('geminiAudio').pause();
      el('geminiAudio').removeAttribute('src');
      document.querySelector('#progressContainer .progress-title').textContent = 'Transcribing…';
      document.querySelector('#statusPage .page-title').textContent = 'Transcription Status';
      document.querySelector('#statusPage .page-subtitle').textContent = 'Tracking your transcription job';
      return false;
    }
    document.querySelector('#statusPage .page-title').textContent = 'Audio translation status';
    document.querySelector('#statusPage .page-subtitle').textContent = 'You can leave this page and return to the saved job.';
    localStorage.setItem('subforge_gemini_job', data.job_id);
    el('downloadBtn').style.display = 'none';
    document.querySelector('#progressContainer .progress-title').textContent = data.stage === 'completed' ? 'Completed' : (data.stage || 'Queued').replaceAll('_', ' ');
    el('resetBtn').style.display = 'flex';
    el('errorMessage').style.display = 'none';
    el('statusValue').textContent = (data.cancel_requested && data.status === 'running' ? 'CANCELLING' : data.status.toUpperCase());
    el('statusValue').className = 'status-val ' + data.status;
    el('languageValue').textContent = data.target_language;
    el('modelValue').textContent = data.model;
    el('translateValue').textContent = 'Audio translation';
    el('jobIdDisplay').textContent = data.original_filename || data.job_id;
    el('progressContainer').style.display = 'block';
    el('segmentsRow').style.display = 'flex';
    el('segmentsValue').textContent = (data.completed_segments || 0) + ' / ' + (data.total_segments || 0);
    var percent = data.progress_percentage || 0;
    el('progressFill').style.width = percent + '%';
    el('progressPercent').textContent = percent + '%';
    el('progressText').textContent = time(data.processed_duration_seconds) + ' / ' + time(data.source_duration_seconds) + ' source audio completed';
    message((data.stage || data.status).replaceAll('_', ' ') + (data.error ? ': ' + data.error : ''));
    var notes = el('geminiWarnings');
    notes.replaceChildren();
    (data.warnings || []).forEach(function (warning) { var li = document.createElement('li'); li.textContent = warning; notes.appendChild(li); });
    downloads(data);
    visible('geminiCancel', ['pending', 'running'].includes(data.status) && !data.cancel_requested);
    visible('geminiRetry', ['failed', 'cancelled'].includes(data.status));
    el('checkStatusBtn').style.display = ['pending', 'running'].includes(data.status) ? 'flex' : 'none';
    if (['pending', 'running'].includes(data.status)) {
      pollTimer = setTimeout(function () { if (currentPage === 'status' && jobId === data.job_id) poll(); }, 5000);
    }
    return true;
  }
  async function poll() {
    if (pending || !jobId || currentPage !== 'status') return;
    pending = true;
    var id = jobId;
    try {
      var response = await fetch(endpoint(id, ''), { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        clearPolling();
        message('Sign in again to view this job. Processing continues on the server. Your job ID is ' + id + '.');
        visible('geminiSignIn', true);
        return;
      }
      if (!response.ok) throw new Error('Could not refresh job status. Use Check Status to retry.');
      var data = await response.json();
      if (jobId === id && currentPage === 'status') { visible('geminiSignIn', false); status(data); }
    } catch (error) { message(error.message); clearPolling(); }
    finally { pending = false; }
  }
  async function action(name) {
    if (!jobId || pending) return;
    pending = true;
    try {
      var response = await fetch(endpoint(jobId, '/' + name), { method: 'POST', credentials: 'include' });
      var data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'The job action failed.');
      message(name === 'retry' ? 'Queued. Saved sections will be reused.' : 'Cancellation requested. Waiting for the worker to stop.');
    } catch (error) { showToast(error.message, 'error'); }
    finally { pending = false; await poll(); }
  }
  function resetView() {
    clearPolling(); current = null;
    visible('geminiResult', false);
    el('geminiAudio').pause(); el('geminiAudio').removeAttribute('src');
  }
  document.addEventListener('DOMContentLoaded', function () {
    init();
    el('geminiCancel').addEventListener('click', function () { action('cancel'); });
    el('geminiRetry').addEventListener('click', function () { action('retry'); });
    el('geminiResume').addEventListener('click', function () {
      var id = localStorage.getItem('subforge_gemini_job');
      if (id) viewJobStatus(id);
    });
    if (localStorage.getItem('subforge_gemini_job')) visible('geminiResume', true);
  });
  return { select: select, validate: validate, append: append, status: status, resetView: resetView, action: action };
})();
