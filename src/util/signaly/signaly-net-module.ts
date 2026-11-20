// «Twine СИГНАЛЫ»: сетевой модуль терминала — связь с центром сети приложения СИГНАЛЫ на телефоне мастера.
// Код перенесён из репозитория smanager7777777/signaly-app (src/terminal/sg-term-net.js, лицензия MIT) без изменений;
// при правке модуля там — скопировать сюда заново (signaly/tools/sync-net-module.py). Движок вставляет его в часть «только в игре».
// Строка хранится в шаблонной строке: в модуле нет обратных кавычек и «${».

export const signalyNetModule = String.raw`/* СИГНАЛЫ — сетевой модуль терминала (сессия П7; П9 — очередь и место в журнале переживают перезагрузку,
   адреса num:<номер сотрудника>, команды телефонам, входящие с телефонов для движка Twine 28+). Подключает терминал (Twine/SugarCube или простую страницу
   в Chrome) к центру сети на телефоне мастера. Протокол — docs/06_NETWORK.md. Лицензия MIT (как signaly-app).
   В SugarCube: вставить в «JavaScript истории». Команды: <<sg-net-notify "Заголовок" "Текст" ["acc:id" …]>>,
   <<sg-net-event "имя">>, <<sg-net-set "ключ" значение>>, <<sg-net-panel>>. Ctrl+Shift+N — окно «Сеть». */
(function (W) {
  'use strict';
  if (W.SgTermNet) return;
  var D = W.document, KEY = 'sg-term-net-url', PORT = 8790;
  var N = W.SgTermNet = { url: '', on: false, seq: 0, epoch: null, gen: 0, offset: 0, state: {}, last: [], dev: 'terminal-1', name: 'Терминал', findAfter: 4 };
  var ws = null, timer = null, pinger = null, heard = 0, stopped = true, queue = [], subs = [], skip = -1;
  var QKEY = 'sg-term-net-queue', PKEY = 'sg-term-net-pos';

  function store(k, v) { try { if (v === undefined) return W.localStorage.getItem(k) || ''; W.localStorage.setItem(k, v); } catch (e) { return ''; } }
  function fire(type, o) { subs.forEach(function (f) { try { f(type, o); } catch (e) {} }); paint(); }
  N.listen = function (f) { subs.push(f); };
  function json(k, v) {
    if (v === undefined) { try { return JSON.parse(store(k) || 'null'); } catch (e) { return null; } }
    store(k, JSON.stringify(v));
  }
  // П9: неотправленное и место в журнале центра — в памяти браузера (терминал перезагрузили — ничего не потеряно и не повторено)
  queue = json(QKEY) || [];
  (function () { var p = json(PKEY); if (p && p.epoch) { N.epoch = p.epoch; N.seq = +p.seq || 0; N.gen = +p.gen || 0; } })();
  function savePos() { json(PKEY, { epoch: N.epoch, seq: N.seq, gen: N.gen }); }
  // П17 (Т8-1 А): центр могут поднять на другом телефоне — после нескольких неудач терминал ищет его сам
  var fails = 0, findNow = false, finding = false, staleUrls = {};
  function saveQueue() { json(QKEY, queue.slice(-500)); }
  N.now = function () { return Date.now() + N.offset; };
  N.queued = function () { return queue.length; };
  N.norm = function (s) {
    s = String(s || '').trim().replace(/^SGNET:/i, '');
    if (!s) return '';
    if (!/^wss?:\/\//i.test(s)) s = 'ws://' + s;
    var host = s.replace(/^wss?:\/\//i, '').replace(/\/.*$/, '');
    if (!/:\d+$/.test(host)) s = s.replace(host, host + ':' + PORT);
    return s.replace(/\/+$/, '');
  };

  /* ---------- связь ---------- */
  N.connect = function (url) {
    url = N.norm(url || N.url || store(KEY));
    if (!url) return false;
    N.url = url; store(KEY, url); stopped = false; drop(); open(); if (N.showDot) N.showDot(); fire('status');
    return true;
  };
  N.disconnect = function () { stopped = true; drop(); fire('status'); };
  function drop() {
    clearTimeout(timer); clearInterval(pinger);
    if (ws) { var w = ws; ws = null; try { w.close(); } catch (e) {} }
    N.on = false;
  }
  function open() {
    clearTimeout(timer);
    var w;
    try { w = new W.WebSocket(N.url); } catch (e) { retry(); return; }
    ws = w;
    w.onopen = function () {
      heard = Date.now();
      fails = 0;
      w.send(JSON.stringify({ t: 'hello', role: 'terminal', dev: N.dev, acc: null, name: N.name, ver: 'term-net-2', epoch: N.epoch, since: N.seq, gen: N.gen || undefined }));
      clearInterval(pinger);
      pinger = setInterval(function () {
        if (ws !== w) return;
        if (Date.now() - heard > 20000) { try { w.close(); } catch (e) {} return; }   // центр молчит — переподключиться
        raw({ t: 'ping', id: 'p' + Date.now() });
      }, 8000);
    };
    w.onmessage = function (e) { heard = Date.now(); var o; try { o = JSON.parse(e.data); } catch (x) { return; } got(o); };
    w.onclose = function () { if (ws !== w) return; ws = null; clearInterval(pinger); var was = N.on; N.on = false; if (!was) fails++; if (was) fire('status'); retry(); };
    w.onerror = function () {};
  }
  function retry() {
    if (stopped) return;
    clearTimeout(timer);
    if (findNow || (fails >= N.findAfter && fails % N.findAfter === 0)) { findNow = false; timer = setTimeout(search, 300); return; }
    timer = setTimeout(open, 3000);
  }
  /* П17: где искать новый центр — список проверки, вся подсеть /24 прежнего адреса (тот же порт), адреса точек доступа. */
  N.searchList = function () {
    var l = [];
    if (W.SG_TERM_FIND) l = W.SG_TERM_FIND.slice();
    else {
      var m = /^ws:\/\/(\d+\.\d+\.\d+)\.(\d+)(:\d+)?/.exec(N.url || '');
      if (m) for (var i = 1; i < 255; i++) l.push(m[1] + '.' + i + (m[3] || ''));
      l = l.concat(N.candidates());
    }
    return l.filter(function (h) { var u = N.norm(h), t = staleUrls[u]; return !(t && Date.now() - t < 120000); });
  };
  function search() {
    if (stopped || finding) return;
    finding = true;
    N.searching = true; paint();
    N.find(function (h) {
      finding = false; N.searching = false;
      if (stopped) return;
      if (h && N.norm(h) !== N.url) { N.url = N.norm(h); store(KEY, N.url); fire('moved', { url: N.url }); }
      if (!h) fails++;
      open();
    }, N.searchList());
  }
  function raw(o) { if (ws && ws.readyState === 1 && N.on) { ws.send(JSON.stringify(o)); return true; } return false; }
  N.send = function (o) { if (!raw(o)) { queue.push(o); saveQueue(); paint(); } return o; };

  function got(o) {
    if (o.t === 'welcome') {
      // первое подключение этого терминала: старый журнал центра не разбирать (это было до него)
      skip = !N.epoch && typeof o.seq === 'number' ? o.seq : -1;
      if (N.epoch && N.epoch !== o.epoch) N.seq = 0;
      N.on = true; N.epoch = o.epoch; N.offset = (o.now || Date.now()) - Date.now(); N.state = o.state || {};
      if ((o.gen || 0) > N.gen) N.gen = o.gen;
      if (typeof o.seq === 'number' && o.seq < N.seq) N.seq = o.seq;
      savePos();
      var q = queue; queue = []; saveQueue(); q.forEach(function (m) { raw(m); });
      fire('status', o);
    } else if (o.t === 'msg') {
      if (o.seq <= skip) { if (o.seq > N.seq) { N.seq = o.seq; savePos(); } return; }
      if (o.seq > N.seq) { N.seq = o.seq; savePos(); }
      var b = o.body || {};
      // движок Twine (N.ownVars) сам пишет переменные — когда игра запущена (сессия П9)
      if (o.kind === 'term' && b.set && !N.ownVars) setVars(b.set);
      if (o.kind === 'term' && b.add && !N.ownVars) setVars(N.added(b.add));
      if (o.kind === 'vote-close' && b.term && !N.ownVars) setVars(voteResult(b));
      N.last.unshift(o); N.last.length = Math.min(N.last.length, 8);
      fire('msg', o);
    } else if (o.t === 'state') {
      if (o.value === null) delete N.state[o.key]; else N.state[o.key] = o.value;
      fire('state', o);
    } else if (o.t === 'stale') {
      // П17: этот центр уступил новому (поднят из копии на другом телефоне) — искать другой
      if ((o.gen || 0) > N.gen) N.gen = o.gen;
      staleUrls[N.url] = Date.now(); findNow = true; savePos();
      fire('stale', o);
    } else if (o.t === 'reset') {
      N.epoch = o.epoch; N.seq = 0; N.state = {}; savePos(); fire('reset', o);
    }
  }
  function voteResult(b) {          // итог голосования: номер варианта с наибольшим числом голосов
    var count = {}, best = -1, pre = 'v:' + b.id + ':', r = {};
    Object.keys(N.state).forEach(function (k) { if (k.indexOf(pre) === 0) { var v = N.state[k]; count[v] = (count[v] || 0) + 1; } });
    Object.keys(count).forEach(function (v) { if (best < 0 || count[v] > count[best]) best = +v; });
    r[b.term] = best < 0 ? null : (b.options && b.options[best] !== undefined ? b.options[best] : best);
    return r;
  }
  N.voteResult = voteResult;
  // П13: «прибавить» к переменной терминала (не общей): {add: {имя: N}}
  N.added = function (add, V) {
    var SC = W.SugarCube; V = V || (SC && SC.State ? SC.State.variables : (N.vars = N.vars || {}));
    var r = {};
    Object.keys(add).forEach(function (k) { var n = k.replace(/^\$/, ''); r[n] = (Number(V[n]) || 0) + (Number(add[k]) || 0); });
    return r;
  };
  // П13 (Т4-3): общие переменные — состояние центра «var:имя»; прибавить — центр считает сам
  N.share = function (name, value) { return N.set('var:' + String(name).replace(/^\$/, ''), value); };
  N.shareAdd = function (name, n, base) { return N.send({ t: 'set', key: 'var:' + String(name).replace(/^\$/, ''), add: Number(n) || 0, base: base }); };
  function setVars(set) {
    var SC = W.SugarCube, V = SC && SC.State ? SC.State.variables : (N.vars = N.vars || {});
    Object.keys(set).forEach(function (k) { V[k.replace(/^\$/, '')] = set[k]; });
    fire('vars', set);
  }

  /* ---------- что отправляет терминал ---------- */
  var n = 0;
  function id() { return 'term-' + Date.now().toString(36) + '-' + (n++) + '-' + Math.random().toString(36).slice(2, 6); }
  // кому: 'all', номера сотрудников ('3' → num:3) или готовые адреса ('acc:…', 'role:…', 'dev:…', 'num:…')
  function to(list) {
    list = [].concat(list || []).map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean)
      .map(function (x) { return /^(all|acc:|role:|dev:|num:)/.test(x) ? x : 'num:' + x; });
    return list.length ? list : ['all'];
  }
  N.to = to;
  N.msg = function (list, kind, body) { return N.send({ t: 'msg', id: id(), to: to(list), kind: kind, body: body || {} }); };
  N.notify = function (title, text, list) { return N.msg(list, 'notify', { title: String(title || ''), text: String(text || '') }); };
  N.event = function (name) { return N.msg(['role:master'], 'event', { name: String(name) }); };
  N.set = function (key, value) { return N.send({ t: 'set', key: String(key), value: value === undefined ? null : value }); };
  N.chat = function (text, list) { return N.msg(list, 'chat', { text: String(text || ''), sys: true }); };
  /* Команды телефонам (как действия кодов приложения: logic.js → expandActions). */
  function ids(x) { return [].concat(x || []).join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  N.open = function (blocks, title, list) { return N.msg(list, 'open', { blocks: ids(blocks), title: String(title || '') }); };
  N.glitch = function (id, list) { return N.msg(list, 'glitch', { id: String(id || '') }); };
  N.fix = function (id, list) { return N.msg(list, 'fix', { id: String(id || '') }); };
  N.module = function (id, on, list) { return N.msg(list, 'module', { id: String(id || ''), on: on || 'on' }); };
  N.alarm = function (on, title, text) {
    return N.set('alarm', on === false ? { on: false, at: N.now() } : { on: true, id: 'terminal', title: String(title || ''), text: String(text || ''), at: N.now() });
  };
  N.chapter = function (n) { return N.set('chapter', { n: Math.max(1, Math.round(+n || 1)), at: N.now() }); };
  N.countdown = function (seconds, title) {
    return N.set('countdown', seconds === false ? { on: false } : { on: true, title: String(title || ''), until: N.now() + Math.max(1, +seconds || 60) * 1000, at: N.now() });
  };

  /* ---------- поиск центра: адрес по умолчанию у точки доступа Android и iPhone ---------- */
  N.candidates = function () {
    var l = ['192.168.43.1', '172.20.10.1', '192.168.49.1'];
    for (var i = 0; i < 256; i++) l.push('192.168.' + i + '.1');
    return l;
  };
  N.find = function (done, list) {
    list = (list || N.candidates()).slice(); var found = false, live = 0;
    function one(host) {
      live++;
      var w, t;
      function end(ok) { if (!w) return; clearTimeout(t); try { w.close(); } catch (e) {} w = null; live--; if (ok && !found) { found = true; done(host); } next(); }
      try { w = new W.WebSocket(N.norm(host)); } catch (e) { live--; next(); return; }
      t = setTimeout(function () { end(false); }, 1500);
      w.onopen = function () { end(true); };
      w.onerror = function () { end(false); };
    }
    function next() {
      if (found) return;
      while (live < 48 && list.length) one(list.shift());
      if (!live && !list.length) done(null);
    }
    next();
  };

  /* ---------- QR «СЕТЬ» с камеры ноутбука (jsQR, если вставлен, или BarcodeDetector) ---------- */
  N.scan = function (video, done) {
    var stream = null, stop = false, det = null, cv = D.createElement('canvas'), cx = cv.getContext('2d');
    if (!W.jsQR && W.BarcodeDetector) { try { det = new W.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
    function finish(v) { if (stop) return; stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); done(v); }
    function tick() {
      if (stop) return;
      if (video.readyState >= 2 && video.videoWidth) {
        if (W.jsQR) {
          cv.width = video.videoWidth; cv.height = video.videoHeight; cx.drawImage(video, 0, 0);
          var r = W.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
          if (r && /^SGNET:/i.test(r.data)) return finish(r.data);
        } else if (det) {
          return det.detect(video).then(function (l) { var c = l.filter(function (x) { return /^SGNET:/i.test(x.rawValue); })[0]; if (c) finish(c.rawValue); else setTimeout(tick, 250); }, function () { setTimeout(tick, 250); });
        } else return finish(null);
      }
      setTimeout(tick, 250);
    }
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (s) { stream = s; video.srcObject = s; video.play(); tick(); }, function () { finish(null); });
    return function () { finish(null); };
  };

  /* ---------- окно «Сеть» и огонёк ---------- */
  var dot = null, box = null;
  function el(tag, css, text) { var e = D.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }
  function paint() {
    if (!D) return;
    if (dot) {
      dot.style.background = N.on ? '#3f3' : (stopped && !queue.length ? '#555' : '#f33');
      dot.title = N.on ? 'Сеть: ' + N.url : 'Сеть не подключена' + (queue.length ? ' · ждут отправки: ' + queue.length : '');
    }
    if (box && box.paintStatus) box.paintStatus();
  }
  N.panel = function () {
    if (box) { box.remove(); box = null; return; }
    var B = 'background:#000;color:#3f3;border:1px solid #3f3;font:15px monospace;padding:6px 10px;margin:4px 6px 4px 0;cursor:pointer';
    box = el('div', 'position:fixed;z-index:100000;right:12px;bottom:34px;width:440px;max-width:95vw;background:#010;color:#3f3;border:2px solid #3f3;padding:12px;font:15px monospace;box-shadow:0 0 18px #3f3a');
    var st = el('div', 'margin-bottom:8px;white-space:pre-wrap');
    var inp = el('input', 'width:100%;box-sizing:border-box;background:#000;color:#3f3;border:1px solid #3f3;font:16px monospace;padding:6px');
    inp.placeholder = 'адрес с пульта мастера, например 192.168.43.1'; inp.value = (N.url || store(KEY)).replace(/^ws:\/\//, '');
    var vid = el('video', 'display:none;width:100%;margin-top:6px;border:1px solid #3f3'); vid.muted = true; vid.setAttribute('playsinline', '');
    var stopScan = null;
    function btn(t, f) { var b = el('button', B, t); b.onclick = f; return b; }
    box.paintStatus = function () {
      st.textContent = (N.on ? '● В СЕТИ: ' + N.url : stopped ? '○ НЕ ПОДКЛЮЧЕНО' : N.searching ? '◌ ИЩУ ЦЕНТР В СЕТИ…' : '◌ ЖДУ ЦЕНТР: ' + N.url) +
        (queue.length ? '\nждут отправки: ' + queue.length + ' (уйдут, когда связь вернётся)' : '') +
        (N.last.length ? '\nпоследнее: ' + N.last[0].kind + ' ' + JSON.stringify(N.last[0].body).slice(0, 80) : '');
    };
    box.append(el('div', 'font-weight:bold;margin-bottom:6px', 'СЕТЬ ТЕРМИНАЛА'), st, inp,
      btn('ПОДКЛЮЧИТЬ', function () { N.connect(inp.value); }),
      btn('QR КАМЕРОЙ', function () {
        if (stopScan) { stopScan(); return; }
        vid.style.display = 'block'; st.textContent = 'Покажите камере QR «СЕТЬ» с пульта мастера…';
        stopScan = N.scan(vid, function (v) { stopScan = null; vid.style.display = 'none'; if (v) { inp.value = N.norm(v).replace(/^ws:\/\//, ''); N.connect(v); } else paint(); });
      }),
      btn('НАЙТИ', function () {
        st.textContent = 'Ищу центр в сети… (до 15 с)';
        N.find(function (h) { if (h) { inp.value = h; N.connect(h); } else st.textContent = 'Центр не найден. Введите адрес с пульта мастера или QR камерой.'; });
      }),
      btn('ОТКЛЮЧИТЬ', function () { N.disconnect(); }),
      btn('✕', function () { if (stopScan) stopScan(); N.panel(); }), vid);
    D.body.appendChild(box); paint();
  };
  // движок Twine ставит window.SG_TERM_NET_QUIET: огонёк — только если сеть есть в истории или терминал уже подключали
  function ui() {
    if (!D || !D.body || dot) return;
    dot = el('div', 'position:fixed;z-index:99999;right:6px;bottom:6px;width:10px;height:10px;border-radius:50%;cursor:pointer;opacity:.8');
    dot.onclick = N.panel;
    if (store('sg-term-net-dot') !== '0' && (!W.SG_TERM_NET_QUIET || store(KEY))) D.body.appendChild(dot);
    N.showDot = function () { if (dot && !dot.parentNode) D.body.appendChild(dot); };
    D.addEventListener('keydown', function (e) { if (e.ctrlKey && e.shiftKey && (e.code === 'KeyN')) { e.preventDefault(); N.panel(); } });
    paint();
  }

  /* ---------- SugarCube ---------- */
  var M = W.Macro || (W.SugarCube && W.SugarCube.Macro);
  if (M && !M.has('sg-net-notify')) {
    M.add('sg-net-notify', { handler: function () { N.notify(this.args[0], this.args[1], this.args.slice(2)); } });
    M.add('sg-net-event', { handler: function () { N.event(this.args[0]); } });
    M.add('sg-net-set', { handler: function () { N.set(this.args[0], this.args[1]); } });
    M.add('sg-net-panel', { handler: function () { N.panel(); } });
  }

  function start() {
    ui();
    var q = /[?&]center=([^&]+)/.exec(W.location ? W.location.search : '');
    if (q) N.connect(decodeURIComponent(q[1])); else if (store(KEY)) N.connect(store(KEY));
  }
  if (D && D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else if (D) start();
})(typeof window !== 'undefined' ? window : this);`;
