/* ============================================================
   無理でしょ — プロトタイプの挙動
   バニラJS・ビルドなし。サーバもAIも繋がない完全モック。
   本番で外部に出す想定の処理には「本番:」コメントを添える。
   ============================================================ */

// 反応の定型文。押した人は1コメントにつき1つだけ選べる（もう一度押すと取り消し）
// state の初期データ（floor の comments）がこれを使うので、state より先に定義する
const REACTIONS = [
  { id:'cheer', label:'がんばれ！' },
  { id:'doubt', label:'本当に？' },
  { id:'free',  label:'言うだけならタダ' },
  { id:'trust', label:'信じてる' },
];

function mkReactions(counts){
  const base = Object.fromEntries(REACTIONS.map(r => [r.id, 0]));
  return { ...base, ...counts };
}

// ---------- 状態 ----------
const state = {
  tab: 'mine',
  view: 'empty',

  // 自分の宣言。デモで直接オッズ画面へ飛べるよう、既定値を最初から持たせる
  hasDeclared: false,
  mine: {
    text: '今週中にジムへ行く',
    proof: 'ジムでの写真、または位置情報',
    poolDo: 350,   // 「やる」に賭けられた総額
    poolNo: 850,   // 「無理でしょ」に賭けられた総額
    hoursLeft: 62,
    lastPostDay: 0,   // 最後に日誌を投稿した日。今日と同じなら投稿済み
    comments: [],     // 自分の日誌（宣言者本人が書く、1日1回）
    streak: 3,        // 連続達成の週数
  },

  lastOdds: null,   // 前回表示した倍率。変動の矢印を出すために持つ
  day: 4,              // 通し日数。日誌の「1日1回」制限の基準
  threadFor: null,     // 今スレッドを開いている賭場カードのid
  density: 'loose',    // 賭場の札の大きさ。loose / normal / tight
  table: 'on',         // 卓の背景。前後比較のため off にできる
  rankTab: 'hits',     // 順位画面のどちら側。hits / done

  // 観客としての手持ち
  pt: 1200,

  // 賭場に並ぶ他人の宣言。comments は宣言者本人が書いた日誌のスレッド
  floor: [
    { id:1, who:'@kenta',  text:'金曜までに履歴書を出す',       poolDo:420, poolNo:180, hoursLeft:38,  myBet:null, streak:5, comments: [
      { id:101, day:1, text:'まず職務経歴書のフォーマットだけ決めた。', reactions: mkReactions({cheer:4, doubt:0, free:1, trust:2}), myReaction:null },
      { id:102, day:2, text:'書き出したら止まらなくなってきた。明日には終わりそう。', reactions: mkReactions({cheer:9, doubt:1, free:0, trust:5}), myReaction:null },
    ]},
    { id:2, who:'@mio',    text:'今月中に5kmを30分で走る',      poolDo:260, poolNo:940, hoursLeft:210, myBet:null, streak:6, comments: [
      { id:201, day:1, text:'今日は2kmで足が終わった。先は長い。', reactions: mkReactions({cheer:6, doubt:3, free:2, trust:1}), myReaction:null },
      { id:202, day:3, text:'3km、28分ペースまで来た。いける気がしてきた。', reactions: mkReactions({cheer:11, doubt:0, free:0, trust:4}), myReaction:null },
    ]},
    { id:3, who:'@shun',   text:'明日6時に起きる',              poolDo:610, poolNo:590, hoursLeft:14,  myBet:null, streak:0, comments: [
      { id:301, day:3, text:'アラーム3個セットした。これで多分いける。', reactions: mkReactions({cheer:2, doubt:8, free:5, trust:0}), myReaction:null },
    ]},
    { id:4, who:'@aya',    text:'週末までに部屋を片付ける',      poolDo:150, poolNo:770, hoursLeft:56,  myBet:null, streak:1, comments: [
      { id:401, day:2, text:'服だけ全部たたんだ。本棚は見なかったことにした。', reactions: mkReactions({cheer:3, doubt:2, free:6, trust:0}), myReaction:null },
    ]},
    { id:5, who:'@takuo',  text:'今日中にプロトを動かす',        poolDo:300, poolNo:900, hoursLeft:6,   myBet:null, streak:2, comments: [
      { id:501, day:4, text:'賭場の画面だけ4案作ってる。まだ終わらない。', reactions: mkReactions({cheer:7, doubt:1, free:3, trust:2}), myReaction:null },
    ]},
  ],

  // 順位。自分（@you）も混ぜて、自分の位置が分かるようにする
  ranking: {
    // 予想的中：他人の宣言を当てた回数。賭ける側の腕前
    hits: [
      { who:'@rui',   hit:47, total:52 },
      { who:'@kenta', hit:38, total:44 },
      { who:'@you',   hit:31, total:40, me:true },
      { who:'@mio',   hit:29, total:39 },
      { who:'@nao',   hit:26, total:36 },
      { who:'@aya',   hit:21, total:33 },
      { who:'@shun',  hit:14, total:31 },
      { who:'@takuo', hit:12, total:30 },
    ],
    // 宣言達成：自分が言ったことをやり切った回数。ストリークが主役
    done: [
      { who:'@mio',   done:11, total:12, streak:6 },
      { who:'@kenta', done:9,  total:11, streak:5 },
      { who:'@rui',   done:8,  total:10, streak:4 },
      { who:'@you',   done:7,  total:10, streak:3, me:true },
      { who:'@takuo', done:6,  total:11, streak:2 },
      { who:'@nao',   done:5,  total:9,  streak:1 },
      { who:'@aya',   done:4,  total:10, streak:1 },
      { who:'@shun',  done:3,  total:12, streak:0 },
    ],
  },
};

const BET_UNIT = 100;   // 1回の賭け金は固定。金額で悩ませない

const DEFAULT_MINE  = JSON.parse(JSON.stringify(state.mine));
const DEFAULT_FLOOR = JSON.parse(JSON.stringify(state.floor));
const DEFAULT_DAY   = state.day;

// コメント本文をそのままinnerHTMLへ差し込むので、必ずエスケープする
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- 小道具 ----------
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// パリミュチュエル方式：総プール ÷ その側のプール ＝ 配当倍率。胴元の取り分はゼロ
const odds = (mine, other) => (mine + other) / Math.max(mine, 1);

// 残り時間を「2日 14時間」の形に
function fmtTime(h){
  if (h <= 0) return '締切';
  const d = Math.floor(h / 24);
  const r = h % 24;
  return d > 0 ? `${d}日 ${r}時間` : `${r}時間`;
}

// ---------- 画面遷移 ----------
function show(view){
  state.view = view;
  $$('.view').forEach(v => v.classList.toggle('is-on', v.dataset.view === view));
  $('#screen').scrollTop = 0;

  // タブの点灯は、その画面がどの世界に属するかで決める
  const tab = view === 'floor' ? 'floor' : view === 'rank' ? 'rank' : 'mine';
  state.tab = tab;
  $$('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.tab === tab));

  if (view === 'odds')  renderOdds();
  if (view === 'floor') renderFloor();
  if (view === 'rank')  renderRank();
  if (view === 'judge') $('#judge-proof').textContent = state.mine.proof;
}

// 「自分」タブは、宣言の有無で行き先が変わる
function goMine(){ show(state.hasDeclared ? 'odds' : 'empty'); }

// ---------- 宣言の審査（本番:ここがLLM呼び出しになる） ----------
// 証明できない宣言は受け付けない。この却下がプロダクトの背骨。
const VAGUE = ['やる気','頑張','がんば','意識','ちゃんと','なるべく','大事に','前向き','努力','気をつけ','本気'];

const PROOF_RULES = [
  { kw:['ジム','走','ラン','散歩','行く','登','旅','出社'], proof:'現地での写真、または位置情報' },
  { kw:['読','本','積'],                                    proof:'読み終えたページの写真' },
  { kw:['実装','コード','push','リリース','提出','履歴書','応募','出す','送'], proof:'提出先のURL、またはスクリーンショット' },
  { kw:['起き','早起き','寝'],                              proof:'起床時刻のスクリーンショット' },
  { kw:['掃除','片付','洗','料理','作る'],                  proof:'ビフォー／アフターの写真' },
  { kw:['勉強','解く','過去問','単語','覚え'],              proof:'解答ページの写真、または学習記録のスクリーンショット' },
  { kw:['やめ','断','禁'],                                  proof:'期間中の利用記録のスクリーンショット' },
];

function review(text){
  const t = text.trim();
  if (t.length < 3){
    return { ok:false, reason:'宣言が短すぎて、何を達成するのか読み取れません。' };
  }
  const vague = VAGUE.find(v => t.includes(v));
  if (vague){
    return { ok:false, reason:`「${vague}」は、達成したかどうかを外から見分けられません。` };
  }
  const hit = PROOF_RULES.find(r => r.kw.some(k => t.includes(k)));
  if (!hit){
    return { ok:false, reason:'この宣言を証明する手段が見つかりませんでした。何をすれば達成なのかを具体的に書いてください。' };
  }
  return { ok:true, proof:hit.proof };
}

// ---------- オッズ画面 ----------
let oddsAnim = null;

function renderOdds(){
  const m = state.mine;
  const total = m.poolDo + m.poolNo;
  const value = odds(m.poolDo, m.poolNo);
  const doubt = Math.round(m.poolNo / total * 100);

  $('#odds-mydeclare').textContent = m.text;
  $('#odds-doubt').textContent = doubt;
  renderDelta(value);
  $('#odds-bar-do').style.width = `${(m.poolDo / total * 100).toFixed(1)}%`;
  $('#odds-time').textContent = fmtTime(m.hoursLeft);
  $('#odds-judge').disabled = false;
  $('#odds-judge').textContent = m.hoursLeft > 0 ? '証拠を出す' : '証拠を出す（締切）';
  // 締切が来たら証拠提出を日誌より上へ繰り上げる（CSSの order で並べ替える）
  $('.view--odds').classList.toggle('is-due', m.hoursLeft <= 0);

  countUp($('#odds-value'), value);
  updateFormula();
  renderJournal();
}

// ---------- 自分の日誌（宣言者本人が1日1回だけ書ける） ----------
function renderJournal(){
  const postedToday = state.mine.lastPostDay === state.day;
  $('#journal-day').textContent = `Day ${state.day}`;
  $('#journal-compose').hidden = postedToday;
  $('#journal-done').hidden = !postedToday;

  const sorted = [...state.mine.comments].sort((a, b) => b.day - a.day);

  // 過去ログは畳んだまま。0件なら見出しごと出さない
  $('#journal-past').hidden = sorted.length === 0;
  $('#journal-count').textContent = sorted.length;

  $('#journal-log').innerHTML = sorted.map(c => `
    <li class="journal__entry">
      <span class="journal__entry-day">Day ${c.day}</span>
      <p class="journal__entry-text">${escapeHtml(c.text)}</p>
      <p class="journal__entry-reactions">${REACTIONS.map(r =>
        c.reactions[r.id] > 0 ? `${r.label} ${c.reactions[r.id]}` : ''
      ).filter(Boolean).join('　')}</p>
    </li>`).join('');
}

function postJournal(){
  const text = $('#journal-text').value.trim();
  if (!text || state.mine.lastPostDay === state.day) return;
  state.mine.comments.push({ id: Date.now(), day: state.day, text, reactions: mkReactions({}) });
  state.mine.lastPostDay = state.day;
  $('#journal-text').value = '';
  renderJournal();
}

// ---------- 賭場カードのスレッド（他人の日誌への反応） ----------
// 端末フレームの中に収めたいので <dialog> は使わず、.phone 内のシートを出し入れする
function openThread(itemId){
  const item = state.floor.find(x => x.id === itemId);
  if (!item) return;
  state.threadFor = itemId;
  $('#thread-who').textContent = item.who;
  $('#thread-declare').textContent = item.text;
  renderThread();
  $('#thread-sheet').hidden = false;
  $('#thread-close').focus();
}

function closeThread(){
  $('#thread-sheet').hidden = true;
  state.threadFor = null;
}

const threadIsOpen = () => !$('#thread-sheet').hidden;

function renderThread(){
  const item = state.floor.find(x => x.id === state.threadFor);
  if (!item) return;
  const sorted = [...item.comments].sort((a, b) => b.day - a.day);
  $('#thread-list').innerHTML = sorted.length ? sorted.map(c => `
    <li class="thread-item">
      <p class="thread-item__day">Day ${c.day}</p>
      <p class="thread-item__text">${escapeHtml(c.text)}</p>
      <div class="thread-item__reactions">
        ${REACTIONS.map(r => `
          <button class="reaction ${c.myReaction === r.id ? 'is-picked' : ''}"
                  data-react="${r.id}" data-comment="${c.id}">
            ${r.label}<b>${c.reactions[r.id]}</b>
          </button>`).join('')}
      </div>
    </li>`).join('') : '<li class="thread-empty">まだ日誌がありません</li>';
}

function reactTo(commentId, reactionId){
  const item = state.floor.find(x => x.id === state.threadFor);
  const c = item && item.comments.find(x => x.id === commentId);
  if (!c) return;
  if (c.myReaction === reactionId){
    c.reactions[reactionId] -= 1;
    c.myReaction = null;
  } else {
    if (c.myReaction) c.reactions[c.myReaction] -= 1;
    c.reactions[reactionId] += 1;
    c.myReaction = reactionId;
  }
  renderThread();
  renderFloor();   // 賭場一覧側のコメント件数・最新の一言も更新する
}

// 前回からの変動を掲示板らしく出す。上がる＝もっと疑われた
function renderDelta(value){
  const el = $('#odds-delta');
  const prev = state.lastOdds;
  const moved = prev !== null && Math.abs(value - prev) >= 0.005;

  if (!moved){
    el.textContent = '';
    el.className = 'odds__delta';
  } else {
    const up = value > prev;
    el.textContent = `${up ? '▲' : '▼'} ${Math.abs(value - prev).toFixed(2)}　${up ? 'もっと疑われた' : '信じる人が増えた'}`;
    el.className = 'odds__delta ' + (up ? 'up' : 'down');

    // 更新の瞬間に一度だけ白く光らせる（再生し直すためリフローを挟む）
    const fig = $('#odds-figure');
    fig.classList.remove('is-flash');
    void fig.offsetWidth;
    fig.classList.add('is-flash');
  }
  state.lastOdds = value;
}

// 数字が動くこと自体が体験なので、代入せずカウントさせる
function countUp(el, to){
  cancelAnimationFrame(oddsAnim);
  const from = parseFloat(el.textContent) || 0;
  const t0 = performance.now();
  const dur = 700;
  const tick = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);          // easeOutCubic
    el.textContent = (from + (to - from) * e).toFixed(2);
    if (p < 1) oddsAnim = requestAnimationFrame(tick);
  };
  oddsAnim = requestAnimationFrame(tick);
}

function updateFormula(){
  const m = state.mine;
  const total = m.poolDo + m.poolNo;
  $('#formula').textContent =
    `やる ${m.poolDo}pt / 無理 ${m.poolNo}pt\n倍率 = ${total} / ${m.poolDo} = ${odds(m.poolDo, m.poolNo).toFixed(2)}`;
}

// ---------- 賭場 ----------
// 札1枚ぶんのHTML。見た目は styles.css の [data-skin="card"] が付ける
function floorItemHTML(item, i){
  const total = item.poolDo + item.poolNo;
  const oDo   = odds(item.poolDo, item.poolNo).toFixed(2);
  const oNo   = odds(item.poolNo, item.poolDo).toFixed(2);
  const supportDo = item.poolDo / total * 100;
  const heads = Math.round(total / BET_UNIT);      // 賭けている人数の目安
  const done  = item.myBet !== null;

  // 最新の日誌を1行だけ札に載せる。開かなくても場の空気が伝わるように
  const latest = item.comments.length
    ? [...item.comments].sort((a, b) => b.day - a.day)[0]
    : null;

  return `
    <li class="floor__item">
      <span class="floor__no">${String(i + 1).padStart(2, '0')}</span>
      <p class="floor__who">${item.who}${streakBadge(item.streak)}</p>
      <p class="floor__text">${item.text}</p>

      <div class="floor__support" aria-hidden="true"><i style="width:${supportDo.toFixed(1)}%"></i></div>

      <div class="floor__meta">
        <span class="floor__time">${item.hoursLeft > 0 ? '残り ' + fmtTime(item.hoursLeft) : '締切'}</span>
        <span class="floor__pot">${total.toLocaleString()}pt</span>
        <span class="floor__heads">${heads}人が参加</span>
      </div>

      <div class="floor__acts">
        <button class="bet bet--do ${item.myBet==='do'?'is-picked':''}"
                data-bet="do" data-id="${item.id}" ${done?'disabled':''}>
          やる<b class="floor__odds">${oDo}倍</b></button>
        <button class="bet bet--no ${item.myBet==='no'?'is-picked':''}"
                data-bet="no" data-id="${item.id}" ${done?'disabled':''}>
          無理でしょ<b class="floor__odds">${oNo}倍</b></button>
      </div>
      ${done ? `<p class="floor__done">${BET_UNIT}pt を賭けました。結果は締切に出ます。</p>` : ''}

      ${latest ? `<p class="floor__latest">
        <span class="floor__latest-day">Day ${latest.day}</span>${escapeHtml(latest.text)}</p>` : ''}

      <button class="floor__thread" data-thread-open="${item.id}">
        本人の日誌を読む<b>${item.comments.length}</b>
      </button>
    </li>`;
}

// ---------- 順位 ----------
// 予想的中＝賭ける側の腕前、宣言達成＝宣言する側の信用。両方あって場が成立する
function renderRank(){
  const isHits = state.rankTab === 'hits';
  $$('.rank__seg').forEach(b => b.classList.toggle('is-on', b.dataset.rank === state.rankTab));
  $('#rank-note').textContent = isHits
    ? '他人の宣言をどれだけ言い当てたか。疑う目の正確さ'
    : '言ったことをどれだけやり切ったか。連続記録が信用になる';

  const rows = isHits
    ? [...state.ranking.hits].sort((a, b) => b.hit / b.total - a.hit / a.total)
    : [...state.ranking.done].sort((a, b) => b.streak - a.streak || b.done - a.done);

  $('#rank-list').innerHTML = rows.map((r, i) => {
    const rate = isHits
      ? Math.round(r.hit / r.total * 100)
      : Math.round(r.done / r.total * 100);
    // 並び順と、右端の大きな数字は必ず一致させる。
    // 達成側は連続記録が主役なので、率は補助に落とす
    const main = isHits ? `${rate}<i>%</i>` : `${r.streak}<i>週</i>`;
    const sub  = isHits
      ? `${r.hit} / ${r.total} 的中`
      : `${r.done} / ${r.total} 達成・${rate}%`;
    return `
      <li class="rank__item ${r.me ? 'is-me' : ''}">
        <span class="rank__no">${i + 1}</span>
        <span class="rank__who">${r.who}</span>
        <span class="rank__sub">${sub}</span>
        <span class="rank__rate">${main}</span>
      </li>`;
  }).join('');
}

// ---------- 週次の一斉通知 ----------
// 日曜21:00、宣言のない全員に同時に飛ぶ。10分の締切が全員で共有されるのが肝
let noticeTimer = null;

function openNotice(){
  // すでに宣言している人には飛ばさない
  if (state.hasDeclared){
    $('#notice-title').textContent = '今週はもう宣言済み';
    $('#notice-sub').textContent = 'この通知は、宣言のない人にだけ届いています。';
    $('#notice-count').hidden = true;
    $('#notice-go').hidden = true;
  } else {
    // 「10分以／内。」と割れるので読点で改行を固定する（静的文字列）
    $('#notice-title').innerHTML = '今週の宣言、<br>10分以内。';
    $('#notice-sub').textContent = 'いま宣言のない全員に、同時に届いています。';
    $('#notice-count').hidden = false;
    $('#notice-go').hidden = false;
  }
  $('#notice').hidden = false;
  startNoticeCountdown(10 * 60);
}

function startNoticeCountdown(sec){
  clearInterval(noticeTimer);
  const tick = () => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    $('#notice-count').textContent = `${m}:${s}`;
    if (sec <= 0){ clearInterval(noticeTimer); return; }
    sec -= 1;
  };
  tick();
  noticeTimer = setInterval(tick, 1000);
}

function closeNotice(){
  clearInterval(noticeTimer);
  $('#notice').hidden = true;
}

const noticeIsOpen = () => !$('#notice').hidden;

// 賭場の密度（札の大きさ）を切り替える。見た目はCSSの [data-density] が作る
const DENSITY_HINT = {
  loose:  'ゆったり：券の面を広く取る。1画面に約2.5枚',
  normal: '標準：余白と文字を1段階詰める。1画面に約3.5枚',
  tight:  '詰める：面取りを浅くし宣言文を1行に。1画面に約5枚',
};

function setDensity(d){
  state.density = d;
  $('#floor-view').dataset.density = d;
  $('#dens-hint').textContent = DENSITY_HINT[d] || '';
  $$('.densbtn').forEach(b => b.classList.toggle('is-on', b.dataset.densityPick === d));
  renderTableProps();
}

// 卓の地の有無。ポーカーテーブルの前後を見比べるための切り替え
function setTable(v){
  state.table = v;
  $('#floor-view').dataset.table = v;
  $$('.tablebtn').forEach(b => b.classList.toggle('is-on', b.dataset.tablePick === v));
}

// 連続達成のバッジ。0週なら出さない（無いことをわざわざ責めない）
function streakBadge(n){
  if (!n) return '';
  return `<span class="streak">${n}週連続</span>`;
}

// 卓全体へ小物を散らす。カード境界や画面端を基準にせず、卓の連続座標へ配置する。
// 固定seedの疑似乱数なので、再描画のたびに小物が飛び回ることはない。
function renderTableProps(){
  const props = $('.table__props');
  const inner = $('.table__inner');
  const cards = $$('#floor-list .floor__item');
  if (!props || !inner) return;

  props.querySelectorAll('.table-scatter').forEach(el => el.remove());
  if (!cards.length || inner.offsetHeight === 0) return;  // 非表示画面では show('floor') 後に再実行される

  const source = {
    chips: props.querySelector(':scope > .table-prop--chips'),
    cards: props.querySelector(':scope > .table-prop--cards'),
    cash:  props.querySelector(':scope > .table-prop--cash'),
    pawn:  props.querySelector(':scope > .table-prop--pawn'),
  };
  const kinds = ['chips', 'cards', 'cash', 'pawn'];
  const height = inner.offsetHeight;
  const width = inner.clientWidth;
  // 前景の背後へ隠れるぶんを見込み、卓面積125pxごとに約1個置く。
  const count = Math.max(12, Math.round(height / 125));

  // LCG。カード数と卓高が同じなら必ず同じ景色になる。
  let seed = (0x6D2B79F5 ^ cards.length * 2654435761 ^ height) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const kindOffset = Math.floor(random() * kinds.length);

  for (let index = 0; index < count; index++){
    const scatter = document.createElement('div');
    // 種類は均等に巡回し、位置・回転・縮尺だけを乱す。seedによる品目の偏りを防ぐ。
    const kind = kinds[(index + kindOffset) % kinds.length];
    const bandY = (index + random() * .82) / count; // 縦だけは偏りすぎないよう帯をずらす
    const x = -18 + random() * Math.max(1, width - 58);
    const y = 38 + bandY * Math.max(1, height - 126);
    const scale = .88 + random() * .32;
    const rotate = -28 + random() * 56;

    scatter.className = `table-scatter table-scatter--${kind}`;
    scatter.style.setProperty('--scatter-x', `${Math.round(x)}px`);
    scatter.style.setProperty('--scatter-y', `${Math.round(y)}px`);
    scatter.style.setProperty('--scatter-scale', scale.toFixed(2));
    scatter.style.setProperty('--scatter-rotate', `${Math.round(rotate)}deg`);
    scatter.append(source[kind].cloneNode(true));
    props.append(scatter);
  }
}

function renderFloor(){
  $('#pt').textContent = state.pt.toLocaleString();

  $('#floor-list').innerHTML = state.floor.map(floorItemHTML).join('');
  renderTableProps();
}

function placeBet(id, side){
  const item = state.floor.find(x => x.id === id);
  if (!item || item.myBet || state.pt < BET_UNIT) return;
  item.myBet = side;
  if (side === 'do') item.poolDo += BET_UNIT; else item.poolNo += BET_UNIT;
  state.pt -= BET_UNIT;
  renderFloor();
}

// ---------- 判定 ----------
const JUDGE_STEPS = [
  '証拠を受け取りました',
  '宣言文と証拠を照合しています…',
  '撮影時刻と期限を突き合わせています…',
  '一次判定が出ました',
];

function runJudge(){
  $('#judge-progress').hidden = false;
  let i = 0;
  const timer = setInterval(() => {
    $('#judge-step').textContent = JUDGE_STEPS[i];
    $('#judge-meter').style.width = `${(i + 1) / JUDGE_STEPS.length * 100}%`;
    i++;
    if (i >= JUDGE_STEPS.length){
      clearInterval(timer);
      setTimeout(showResult, 600);
    }
  }, 700);
}

function showResult(){
  const win = document.querySelector('input[name="outcome"]:checked').value === 'win';
  const m = state.mine;
  const total = m.poolDo + m.poolNo;

  const el = $('#result-verdict');
  el.textContent = win ? '達成' : '未達成';
  el.classList.toggle('is-win', win);
  el.classList.toggle('is-lose', !win);
  $('#result-declare').textContent = m.text;

  if (win){
    // 達成したときだけ「最大の疑い手」を表彰する。負けた人が主役になる画面
    $('.doubter').hidden = false;
    $('#doubter-name').textContent = '@yamada';
    $('#doubter-loss').textContent = `${Math.round(m.poolNo * 0.35)} pt を失いました`;
    $('#result-payout').textContent =
      `やる側に ${odds(m.poolDo, m.poolNo).toFixed(2)}倍 が配当されました。`;
  } else {
    $('.doubter').hidden = true;
    $('#result-payout').textContent =
      `無理でしょ側に ${odds(m.poolNo, m.poolDo).toFixed(2)}倍 が配当されました。次回のあなたのオッズは、もっと悪くなります。`;
  }
  show('result');
}

// ---------- イベント ----------
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go){ show(go.dataset.go); return; }

  const tab = e.target.closest('.tab');
  if (tab){
    const t = tab.dataset.tab;
    if (t === 'floor')      show('floor');
    else if (t === 'rank')  show('rank');
    else                    goMine();
    return;
  }

  const seg = e.target.closest('.rank__seg');
  if (seg){ state.rankTab = seg.dataset.rank; renderRank(); return; }

  const chip = e.target.closest('.chip');
  if (chip){ $('#declare-text').value = chip.dataset.fill; return; }

  const bet = e.target.closest('.bet');
  if (bet){ placeBet(Number(bet.dataset.id), bet.dataset.bet); return; }

  const threadOpen = e.target.closest('[data-thread-open]');
  if (threadOpen){ openThread(Number(threadOpen.dataset.threadOpen)); return; }

  const reactBtn = e.target.closest('.reaction');
  if (reactBtn){ reactTo(Number(reactBtn.dataset.comment), reactBtn.dataset.react); return; }

  if (e.target.closest('#thread-close')){ closeThread(); return; }

  const dens = e.target.closest('[data-density-pick]');
  if (dens){ setDensity(dens.dataset.densityPick); return; }

  const tbl = e.target.closest('[data-table-pick]');
  if (tbl){ setTable(tbl.dataset.tablePick); return; }

  if (e.target.closest('#notice-later')){ closeNotice(); return; }
  if (e.target.closest('#notice-go')){ closeNotice(); show('declare'); return; }
});

// 背景（シートの外側）クリックで閉じる
$('#thread-sheet').addEventListener('click', (e) => {
  if (e.target.id === 'thread-sheet') closeThread();
});

// Escで閉じる。<dialog> をやめたぶん自前で用意する
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (noticeIsOpen())      closeNotice();
  else if (threadIsOpen()) closeThread();
});

$('#journal-post').addEventListener('click', postJournal);

// 宣言 → 審査
$('#declare-submit').addEventListener('click', () => {
  const text = $('#declare-text').value;
  const due  = Number($('#declare-due').value);

  show('check');
  $('#check-loading').hidden = false;
  $('#check-reject').hidden = true;
  $('#check-accept').hidden = true;

  // 本番:ここでLLMへ投げる。審査に「間」があること自体が体験なので待たせる
  setTimeout(() => {
    const r = review(text);
    $('#check-loading').hidden = true;

    if (!r.ok){
      $('#reject-quote').textContent = `「${text.trim() || '（空）'}」`;
      $('#reject-reason').textContent = r.reason;
      $('#check-reject').hidden = false;
      return;
    }
    $('#accept-quote').textContent = `「${text.trim()}」`;
    $('#accept-proof').textContent = r.proof;
    $('#check-accept').hidden = false;

    // 受理された内容で自分の宣言を差し替える。プールと日誌は初期値から始める
    state.mine = { text:text.trim(), proof:r.proof, poolDo:100, poolNo:100, hoursLeft:due * 6,
                    lastPostDay:0, comments:[] };
  }, 1400);
});

$('#accept-go').addEventListener('click', () => {
  state.hasDeclared = true;
  show('odds');
});

$('#odds-judge').addEventListener('click', () => show('judge'));

$('#dropzone').addEventListener('click', function(){
  if (this.classList.contains('is-filled')) return;
  this.classList.add('is-filled');
  this.textContent = 'IMG_2418.jpg を提出しました';
  runJudge();
});

// ---------- デモ操作（端末の外） ----------
$('#d-flow').addEventListener('click', () => {
  // 観客の賭けを流し込む。自分の宣言には「無理でしょ」が集まりやすく寄せてある
  state.mine.poolDo += Math.floor(Math.random() * 120);
  state.mine.poolNo += Math.floor(Math.random() * 320) + 80;
  state.floor.forEach(i => {
    i.poolDo += Math.floor(Math.random() * 200);
    i.poolNo += Math.floor(Math.random() * 200);
  });
  if (state.view === 'odds')  renderOdds();
  if (state.view === 'floor') renderFloor();
  updateFormula();
});

$('#d-time').addEventListener('click', () => {
  state.mine.hoursLeft = 0;
  state.floor.forEach(i => { i.hoursLeft = Math.max(0, i.hoursLeft - 24); });
  if (state.view === 'odds')  renderOdds();
  if (state.view === 'floor') renderFloor();
});

$('#d-react').addEventListener('click', () => {
  // 他人が日誌へ反応してくる。開いているスレッドの数字がその場で増えるのが見せ場
  const pick = () => REACTIONS[Math.floor(Math.random() * REACTIONS.length)].id;
  const bump = (c) => { c.reactions[pick()] += Math.floor(Math.random() * 3) + 1; };
  state.floor.forEach(item => item.comments.forEach(bump));
  state.mine.comments.forEach(bump);

  if (threadIsOpen())         renderThread();
  if (state.view === 'odds')  renderJournal();
  if (state.view === 'floor') renderFloor();
});

$('#d-notice').addEventListener('click', openNotice);

$('#d-day').addEventListener('click', () => {
  // 日誌の「1日1回」をデモで確かめるための日送り。締切やオッズには触らない
  state.day += 1;
  if (state.view === 'odds') renderJournal();
});

$('#d-reset').addEventListener('click', () => {
  state.hasDeclared = false;
  state.mine = JSON.parse(JSON.stringify(DEFAULT_MINE));
  state.floor = JSON.parse(JSON.stringify(DEFAULT_FLOOR));
  state.day = DEFAULT_DAY;
  state.threadFor = null;
  state.pt = 1200;
  $('#declare-text').value = '';
  $('#journal-text').value = '';
  const dz = $('#dropzone');
  dz.classList.remove('is-filled');
  dz.textContent = 'タップして提出';
  $('#judge-progress').hidden = true;
  $('#judge-meter').style.width = '0';
  $('#odds-value').textContent = '0';
  state.lastOdds = null;
  $('#odds-delta').textContent = '';
  closeThread();
  closeNotice();
  show('empty');
});

// ---------- 起動 ----------
updateFormula();
setDensity(state.density);
setTable(state.table);
renderFloor();
renderRank();
show('empty');
