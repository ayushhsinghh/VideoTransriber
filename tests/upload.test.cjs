const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function fixture({ engine = 'gemini', replies = [{status: 202, body: {job_id: 'job_accepted'}}], gemini = true } = {}) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, style: {}, textContent: '', innerHTML: '' });
    return elements.get(id);
  };
  get('engine').value = engine;
  get('model').value = 'base';
  const calls = [], messages = [];
  class XHR {
    constructor() { this.events = {}; this.upload = {addEventListener() {}}; }
    addEventListener(name, fn) { this.events[name] = fn; }
    open(method, url) { this.method = method; this.url = url; }
    send(form) {
      calls.push({method: this.method, url: this.url, credentials: this.withCredentials, fields: form.fields});
      const response = replies.shift();
      if (response.network) return this.events.error();
      this.status = response.status;
      this.responseText = response.raw === undefined ? JSON.stringify(response.body) : response.raw;
      this.events.load();
    }
  }
  const context = vm.createContext({ document: {addEventListener() {}, getElementById: get, querySelectorAll: () => []},
    XMLHttpRequest: XHR, FormData: class { constructor() {this.fields=[];} append(...entry) {this.fields.push(entry);} },
    localStorage: {getItem() {return 'fixture@example.test';}}, console,
    __messages: messages, __views: 0 });
  if (gemini) context.GeminiFlow = {validate: () => true, append: (form) => form.append('target_language', 'hi'), select() {}};
  vm.runInContext(script, context);
  vm.runInContext(`showToast = (message, kind) => __messages.push({message, kind});
    showJobsPage = () => { __views++; }; renderFileList = () => {};`, context);
  return {context, calls, messages, get, run(files = ['sample.mp3']) {
    vm.runInContext('selectedFiles = ' + JSON.stringify(files.map(name => ({name, size: 1024}))) + '; upload();', context);
  }, state() { return vm.runInContext('({uploading:isUploading, selected:selectedFiles.map(file => file.name)})', context); }};
}

test('Gemini 202 Accepted is a successful queued upload', () => {
  const f = fixture(); f.run();
  assert.equal(f.calls[0].url, 'https://api.ayush.ltd/api/gemini/jobs');
  assert.equal(f.calls[0].credentials, true);
  assert.equal(f.context.__views, 1);
  assert.ok(f.messages.some(item => item.kind === 'success'));
  assert.ok(!f.messages.some(item => item.message === 'All uploads failed.'));
  assert.equal(f.state().uploading, false);
});

test('all existing engines retain HTTP 200 upload handling', () => {
  for (const [engine, route] of [['whisper','/api/jobs'],['riva','/api/riva/jobs'],['openai','/api/openai/jobs']]) {
    const f = fixture({engine, replies:[{status:200, body:{job_id:'job_abcd'}}]}); f.run();
    assert.equal(f.calls[0].url, 'https://api.ayush.ltd'+route);
    assert.equal(f.context.__views, 1);
  }
});

test('a missing optional Gemini script does not block existing engines', () => {
  const f = fixture({engine:'whisper',gemini:false,replies:[{status:200,body:{job_id:'job_abcd'}}]});
  vm.runInContext("selectEngine('whisper')", f.context);
  f.run();
  assert.equal(f.context.__views, 1);
  assert.equal(f.calls.length, 1);
});

test('missing Gemini controls report a clear error before upload', () => {
  const f = fixture({gemini:false}); f.run();
  assert.equal(f.calls.length, 0);
  assert.match(f.messages[0].message, /controls did not load/);
  assert.equal(f.state().uploading, false);
});

test('authentication, quota, and validation errors retain files and show HTTP status', () => {
  for (const response of [{status:401,body:{detail:'Unauthorized'}},{status:429,body:{detail:'Rate limit'}},
    {status:422,body:{detail:[{msg:'target language is required'}]}},{status:500,raw:'<html>server error</html>'}]) {
    const f = fixture({replies:[response]}); f.run();
    assert.equal(f.context.__views, 0);
    assert.equal(f.state().selected.length, 1);
    assert.match(f.get('uploadErrors').textContent, new RegExp('HTTP '+response.status));
    assert.equal(f.get('uploadErrors').style.display, 'block');
    if (response.status===401) assert.match(f.get('uploadErrors').textContent, /session expired/);
    if (response.status===429) assert.match(f.get('uploadErrors').textContent, /limit/);
  }
});

test('network errors retain the original file for retry', () => {
  const f = fixture({replies:[{network:true}]});f.run();
  assert.equal(f.state().selected.length,1);
  assert.match(f.get('uploadErrors').textContent,/connection failed/);
});

test('invalid successful responses do not fabricate job creation', () => {
  for (const response of [{status:202,body:{}},{status:200,raw:'invalid JSON'}]) {
    const f = fixture({replies:[response]});f.run();
    assert.equal(f.context.__views,0);
    assert.equal(f.state().selected.length,1);
    assert.match(f.get('uploadErrors').textContent,/no valid job ID/);
  }
});

test('mixed batches count queued 202 jobs and keep only rejected files', () => {
  const f=fixture({replies:[{status:202,body:{job_id:'job_queued'}},{status:429,body:{detail:'limit'}}]});
  f.run(['accepted.mp3','rejected.mp3']);
  assert.equal(f.calls.length,2);
  assert.equal(f.context.__views,1);
  assert.equal(f.state().selected[0],'rejected.mp3');
  assert.equal(f.state().selected.length,1);
  assert.match(f.messages.find(item=>item.kind==='warning').message,/1 file uploaded successfully.*1 failed/);
});
