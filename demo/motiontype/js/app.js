// MotionType 2.0 — in-browser demo (kreevo.github.io). Preview only; Apply runs inside After Effects.

var APP_VERSION = '2.0.0';
var LINKS = {
  buy: 'https://kreevo.gumroad.com/l/motiontype',
  help: 'https://kreevo.github.io/guides/MotionType_Thank_You.pdf',
  support: 'mailto:kreevoassets@gmail.com?subject=MotionType%202.0'
};

var cs = (typeof CSInterface !== 'undefined') ? new CSInterface() : null;
var inAE = !!(cs && window.__adobe_cep__);
var EXT = inAE ? cs.getSystemPath(SystemPath.EXTENSION) : '';
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

function openURL(u) { if (inAE) cs.openURLInDefaultBrowser(u); else window.open(u, '_blank'); }
function host(code, cb) { if (!inAE) { cb && cb('ERR:Apply only works inside After Effects.'); return; } cs.evalScript(code, cb || function () {}); }

var toastT;
function toast(msg, err) {
  var t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, err ? 6000 : 2400);
}
$('#toast').onclick = function () { this.className = 'toast'; };

// ------------------------------------------------------------ views
function show(id) {
  $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === id); });
  document.body.classList.toggle('locked', id === 'lock');
  $('#menu').hidden = true;
  window.scrollTo(0, 0);
}

function openBuy() { try { (window.top || window).open(LINKS.buy, '_blank', 'noopener'); } catch (e) { window.open(LINKS.buy, '_blank'); } }

// ------------------------------------------------------------ home grid
var BY_KEY = {};
CATS.forEach(function (c) { c.items.forEach(function (p) { p.cat = c.name; BY_KEY[p.key] = p; }); });
function renderCats(q) {
  q = (q || '').toLowerCase();
  var html = CATS.map(function (c) {
    var items = c.items.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0 || c.name.toLowerCase().indexOf(q) >= 0; });
    if (!items.length) return '';
    return '<div class="sec"><i style="background:' + c.col + '">' + c.icon + '</i>' + c.name + '</div><div class="grid">' +
      items.map(function (p) {
        return '<button class="tile" data-k="' + p.key + '"><span class="ic">' + p.ic + '</span><span class="nm">' + p.name +
          '</span><span class="ch">›</span>' + (p.nw ? '<span class="tag">NEW</span>' : '') + '</button>';
      }).join('') + '</div>';
  }).join('');
  $('#cats').innerHTML = html || '<div class="empty">No presets match “' + q + '”.</div>';
  $$('.tile').forEach(function (t) { t.onclick = function () { openPreset(t.dataset.k); }; });
}
var total = 0; CATS.forEach(function (c) { total += c.items.length; });
$('#search').placeholder = 'Search ' + total + ' presets…';
$('#search').oninput = function () { renderCats(this.value); };
renderCats();

// ------------------------------------------------------------ preset editor
var st = {};
$('#sfxSel').innerHTML = SFX.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('');
$('#colors').innerHTML = COLORS.map(function (c, i) {
  if (c === 'keep') return '<button data-i="0" class="keep" title="Keep the layer\'s own color"></button>';
  return '<button data-i="' + i + '" style="background:' + (c === 'grad' ? 'linear-gradient(90deg,' + GRAD[0] + ',' + GRAD[1] + ')' : c) + '"></button>';
}).join('');

var DIRV = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
function dirOf(pos) { return !pos ? 'up' : pos[0] > 0 ? 'left' : pos[0] < 0 ? 'right' : pos[1] < 0 ? 'down' : 'up'; }
function setSeg(id, v) { $$('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === String(v)); }); }
function setSw(fx, on) { $('.sw[data-fx="' + fx + '"]').classList.toggle('on', !!on); }
function fmt() {
  $('#vAmount').textContent = st.amount + ' px';
  $('#vDelay').textContent = st.delay.toFixed(2) + ' s';
  $('#vDur').textContent = st.dur.toFixed(1) + ' s';
  $('#vBlur').textContent = st.blur + ' px';
  $('#lDelay').textContent = 'Delay between ' + (st.unit === 'line' ? 'lines' : st.unit + 's');
  ['amount', 'delay', 'dur', 'blur'].forEach(function (id) {
    var el = $('#' + id); el.style.setProperty('--p', (el.value - el.min) / (el.max - el.min) * 100 + '%');
  });
}

function openPreset(key) {
  var p = BY_KEY[key];
  st = { key: key, unit: p.unit, bounce: p.bounce ? 1 : 0, amount: p.amount, delay: p.delay, dur: p.dur, blur: p.blur,
         glow: p.glow ? 1 : 0, sweep: p.sweep ? 1 : 0, sfx: 1, sfxFile: p.sfx, color: p.color || 'keep',
         dir: dirOf(p.anim.pos), align: st.align || '', anchor: st.anchor || '' };
  $('#pName').textContent = p.name;
  $('#pCat').textContent = p.cat === 'Text' ? 'Text Animation' : p.cat;
  if (p.text) $('#textIn').value = p.text; else if (/^[\d.,+$%]+$/.test($('#textIn').value)) $('#textIn').value = 'Your text';
  setSeg('unit', st.unit); setSeg('bounce', st.bounce); setSeg('dir', st.dir); setSeg('align', st.align);
  $$('#anchor button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st.anchor); });
  $('#dirRow').style.display = (p.anim.pos && p.mode !== 'shake') ? '' : 'none';
  $('#amount').value = st.amount; $('#delay').value = Math.round(st.delay * 100); $('#dur').value = Math.round(st.dur * 10); $('#blur').value = st.blur;
  $('#slAmount').style.display = (p.anim.pos || p.mask) ? '' : 'none';
  $('#delay').parentNode.style.display = (p.counter || p.wipe) ? 'none' : '';
  $('#blur').parentNode.style.display = (p.counter || p.wipe) ? 'none' : '';
  $('#unit').style.visibility = (p.counter || p.wipe) ? 'hidden' : '';
  $('#bounce').style.visibility = (p.mode || p.counter || p.wipe) ? 'hidden' : '';
  setSw('glow', st.glow); setSw('sweep', st.sweep); setSw('sfx', st.sfx);
  $('#sfxSel').value = st.sfxFile;
  var ci = COLORS.indexOf(st.color); $$('#colors button').forEach(function (b, i) { b.classList.toggle('on', i === (ci < 0 ? 0 : ci)); });
  $('#bake').style.display = (p.counter || p.wipe || p.mode === 'shake') ? 'none' : '';
  fmt(); show('preset'); play();
}
$('#back').onclick = function () { show('home'); };

$$('#unit button').forEach(function (b) { b.onclick = function () { st.unit = b.dataset.v; setSeg('unit', st.unit); fmt(); play(); }; });
$$('#dir button').forEach(function (b) { b.onclick = function () { st.dir = b.dataset.v; setSeg('dir', st.dir); play(); }; });
$$('#align button').forEach(function (b) { b.onclick = function () { st.align = st.align === b.dataset.v ? '' : b.dataset.v; setSeg('align', st.align); play(); }; });
$$('#anchor button').forEach(function (b) { b.onclick = function () {
  st.anchor = st.anchor === b.dataset.v ? '' : b.dataset.v;
  $$('#anchor button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === st.anchor); }); }; });
$$('#bounce button').forEach(function (b) { b.onclick = function () { st.bounce = +b.dataset.v; setSeg('bounce', st.bounce); play(); }; });
$('#amount').oninput = function () { st.amount = +this.value; fmt(); play(); };
$('#delay').oninput = function () { st.delay = this.value / 100; fmt(); play(); };
$('#dur').oninput = function () { st.dur = this.value / 10; fmt(); play(); };
$('#blur').oninput = function () { st.blur = +this.value; fmt(); play(); };
$$('.sw').forEach(function (s) { s.onclick = function () { st[s.dataset.fx] = st[s.dataset.fx] ? 0 : 1; setSw(s.dataset.fx, st[s.dataset.fx]); play(); }; });
$('#sfxSel').onchange = function () { st.sfxFile = this.value; st.sfx = 1; setSw('sfx', 1); };
$$('#colors button').forEach(function (b) {
  b.onclick = function () { $$('#colors button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); st.color = COLORS[b.dataset.i]; play(); };
});
$('#textIn').oninput = function () { play(); };
$('#replay').onclick = function () { play(); };

// ------------------------------------------------------------ preview
var SCR = '!<>-_/[]{}=+*^?#ABCDEFX0123456789', timer, anims = [], ivs = [];
function play() {
  clearTimeout(timer); anims.forEach(function (a) { a.cancel(); }); anims = []; ivs.forEach(clearInterval); ivs = [];
  var p = BY_KEY[st.key]; if (!p) return;
  var box = $('#txt'), text = $('#textIn').value || ' ', pv = p.pv;
  var parts = (st.unit === 'letter' || pv === 'type') ? text.split('') : st.unit === 'word' ? text.split(/(\s+)/) : [text];
  if (pv === 'counter') parts = [text];
  box.innerHTML = parts.map(function (s) { return '<span>' + s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/ /g, '&nbsp;') + '</span>'; }).join('');
  var grad = st.color === 'grad', col = grad ? GRAD[0] : st.color === 'keep' ? '#ffffff' : st.color;
  box.style.textAlign = st.align || 'center'; box.parentNode.style.placeItems = 'center ' + ({ left: 'start', right: 'end' }[st.align] || 'center');
  box.style.padding = '0 18px';
  var dv = DIRV[st.dir] || DIRV.up;
  box.style.color = p.outline ? 'transparent' : col;
  box.style.webkitTextStroke = p.outline ? '1.5px ' + col : '';
  box.style.textShadow = st.glow ? '0 0 10px ' + col + ', 0 0 28px ' + col + ', 0 0 60px ' + col + 'aa' : 'none';
  box.style.letterSpacing = ''; box.style.clipPath = 'none';
  var spans = Array.prototype.slice.call(box.children), A = st.amount * .5, B = st.blur * .6, D = st.dur * 1000, n = 0;
  var ease = st.bounce ? 'cubic-bezier(.34,1.7,.5,1)' : 'cubic-bezier(.2,.9,.25,1)';
  spans.forEach(function (s, i) {
    if (grad) { s.style.color = mix(GRAD[0], GRAD[1], spans.length > 1 ? i / (spans.length - 1) : 0); }
    if (!s.textContent.trim()) return;
    var f1 = { opacity: 1, filter: 'blur(0px)', transform: 'none' }, k;
    var f0 = { opacity: p.anim.op ? 0 : 1, filter: 'blur(' + B + 'px)' };
    if (pv === 'pop' || pv === 'zoom') k = [assign(f0, { transform: 'scale(' + (pv === 'zoom' ? 2.6 : 0) + ')' }), f1];
    else if (pv === 'flip') k = [assign(f0, { transform: 'scaleY(0)' }), f1];
    else if (pv === 'spin') k = [assign(f0, { transform: 'rotate(-180deg) scale(0)' }), f1];
    else if (pv === 'slide' || pv === 'rise' || pv === 'drop') k = [assign(f0, { transform: 'translate(' + (dv[0] * A) + 'px,' + (dv[1] * A) + 'px)' + (p.anim.rot ? ' rotate(' + p.anim.rot + 'deg)' : '') + (p.anim.scale ? ' scale(' + p.anim.scale / 100 + ')' : '') }), f1];
    else if (pv === 'blur') k = [assign(f0, { filter: 'blur(' + Math.max(B, 6) + 'px)', transform: 'scale(1.12) translate(' + (dv[0] * A * .3) + 'px,' + (dv[1] * A * .3) + 'px)' }), f1];
    else if (pv === 'shake') k = [{ transform: 'none' }, { transform: 'translateX(' + (A * .3) + 'px) rotate(10deg)', offset: .15 }, { transform: 'translateX(' + (-A * .25) + 'px) rotate(-8deg)', offset: .35 }, { transform: 'rotate(4deg)', offset: .6 }, { transform: 'none' }];
    else if (pv === 'type') k = [{ opacity: 0 }, { opacity: 0, offset: .99 }, { opacity: 1 }];
    else if (pv === 'mask') {
      var cl = { up: ['inset(-50% -50% 110% -50%)', 'translateY(110%)'], down: ['inset(110% -50% -50% -50%)', 'translateY(-110%)'],
                 left: ['inset(-50% 110% -50% -50%)', 'translateX(110%)'], right: ['inset(-50% -50% -50% 110%)', 'translateX(-110%)'] }[st.dir];
      k = [assign(f0, { transform: cl[1], clipPath: cl[0] }), assign(f1, { clipPath: 'inset(-50% -50% -50% -50%)' })];
    }
    else if (pv === 'track') k = [assign(f0, { transform: 'translateX(' + ((i - spans.length / 2) * 10) + 'px)' }), f1];
    else if (pv === 'wipe' || pv === 'counter') return;
    else k = [assign(f0, { transform: 'translate(' + (dv[0] * A) + 'px,' + (dv[1] * A) + 'px)' }), f1];
    var step = pv === 'type' ? Math.max(st.delay, .03) * 1000 : st.delay * 1000;
    anims.push(s.animate(k, { duration: pv === 'type' ? 1 : D, delay: n * step, easing: pv === 'shake' ? 'ease-out' : ease, fill: 'backwards' }));
    if (pv === 'decode') { (function (s, real, d0) { var t = 0; var iv = setInterval(function () { t += 40; s.textContent = t > d0 + D * .7 ? real : SCR[Math.random() * SCR.length | 0]; if (t > d0 + D) clearInterval(iv); }, 40); ivs.push(iv); })(s, s.textContent, n * step); }
    n++;
  });
  if (pv === 'wipe') anims.push(box.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: p.wipe.feather ? 0 : 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: D, easing: ease, fill: 'backwards' }));
  if (pv === 'counter') {
    var m = text.match(/[\d.,]+/), end = m ? parseFloat(m[0].replace(/,/g, '')) : 1000, pre = m ? text.slice(0, text.indexOf(m[0])) : '', suf = m ? text.slice(text.indexOf(m[0]) + m[0].length) : '', t0 = performance.now();
    (function tick(t) {
      var q = Math.min(1, (t - t0) / D), v = Math.round(end * (1 - Math.pow(1 - q, 4)));
      if (box.firstChild) box.firstChild.textContent = pre + v.toLocaleString('en-US') + suf;
      if (q < 1 && st.key === p.key) requestAnimationFrame(tick);
    })(t0);
  }
  var totalMs = D + Math.max(0, n - 1) * st.delay * 1000;
  if (st.sweep) anims.push($('#sweepFx').animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], { duration: 900, delay: totalMs * .85, easing: 'ease-in-out', fill: 'both' }));
  timer = setTimeout(play, totalMs + 1700);
}
function assign(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
function mix(a, b, t) {
  var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
  return 'rgb(' + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); }).join(',') + ')';
}

// ------------------------------------------------------------ apply / bake
function params() {
  var p = BY_KEY[st.key], grad = st.color === 'grad';
  var sep = EXT.indexOf('\\') >= 0 ? '\\' : '/';
  return {
    name: p.name, unit: st.unit, bounce: st.bounce, amount: st.amount, delay: st.delay, dur: st.dur, blur: st.blur,
    mode: p.mode || 'smooth', anim: animFor(p), dir: st.dir, mask: !!p.mask,
    align: st.align, anchor: st.anchor ? st.anchor.split(',').map(Number) : null, wipe: p.wipe || null, counter: !!p.counter, outline: !!p.outline,
    glow: st.glow, sweep: st.sweep, color: grad ? GRAD[0] : (st.color === 'keep' ? '' : st.color), color2: grad ? GRAD[1] : null,
    sfxPath: st.sfx ? EXT + sep + 'assets' + sep + 'sfx' + sep + st.sfxFile : '',
    text: ($('#textIn').value || '').replace(/^\s+|\s+$/g, '')
  };
}
function animFor(p) {
  var a = assign(p.anim, {});
  if (a.pos && p.mode !== 'shake') { var m = Math.max(Math.abs(a.pos[0]), Math.abs(a.pos[1])), v = DIRV[st.dir]; a.pos = [v[0] * m, v[1] * m]; }
  return a;
}
$('#apply').onclick = function () {
  toast('Opening MotionType on Gumroad…');
  openBuy();
};

// ------------------------------------------------------------ boot
show('home');
