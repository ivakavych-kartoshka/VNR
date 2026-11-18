const STORAGE_KEY = 'vnr202_progress_v1';
const BANK = window.QUESTION_BANK || [];
const TOPICS = [...new Set(BANK.map(q => q.topic || 'Khác'))].sort();

function populateTopicSelects() {
  ['study-topic', 'quiz-topic', 'browse-topic'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value || 'all';
    sel.innerHTML = '<option value="all">Tất cả chủ đề</option>';
    TOPICS.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  });
}
function populateSetSelects() {
  const total = BANK.length;
  const sets = Math.ceil(total / 10);
  ['study-set', 'quiz-set'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value || 'all';
    sel.innerHTML = '<option value="all">Tất cả</option>';
    for (let i = 1; i <= sets; i++) {
      const start = (i - 1) * 10 + 1;
      const end = Math.min(i * 10, total);
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Bộ đề ${i} (câu ${start}-${end})`;
      sel.appendChild(opt);
    }
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  });
}
populateTopicSelects();
populateSetSelects();

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
let progress = loadProgress();

function getCard(id) {
  if (!progress[id]) progress[id] = { box: 0, ease: 2.5, interval: 1, due: 0, reps: 0, lapses: 0, attempts: 0, correct: 0, lastWrong: false };
  return progress[id];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'browse') renderBrowse(document.getElementById('browse-search').value);
    if (btn.dataset.tab === 'stats') renderStats();
  });
});

// ---------- Study ----------
const studyState = { queue: [], index: 0, current: null, selected: new Set(), checked: false };
const studyInfo = document.getElementById('study-info');
const studyCard = document.getElementById('study-card');
const studyCounter = document.getElementById('study-counter');
const studyBox = document.getElementById('study-box');
const studyQuestion = document.getElementById('study-question');
const studyChoices = document.getElementById('study-choices');
const studyFeedback = document.getElementById('study-feedback');
const studyRating = document.getElementById('study-rating');
const studyNext = document.getElementById('study-next');

function buildStudyQueue(mode) {
  const now = Date.now();
  const topic = document.getElementById('study-topic').value;
  const setSel = document.getElementById('study-set').value;
  const countSel = document.getElementById('study-count').value;
  let items = BANK.map(q => ({ q, p: getCard(q.id) }));
  if (setSel !== 'all') {
    const si = parseInt(setSel);
    items = items.filter(it => it.q.id > (si-1)*10 && it.q.id <= si*10);
  }
  if (topic !== 'all') items = items.filter(it => it.q.topic === topic);
  if (mode === 'due') items = items.filter(it => (it.p.due || 0) <= now);
  else if (mode === 'wrong') items = items.filter(it => it.p.lastWrong);
  if (items.length === 0) items = BANK.map(q => ({ q, p: getCard(q.id) }));
  if (setSel !== 'all') {
    const si = parseInt(setSel);
    items = items.filter(it => it.q.id > (si-1)*10 && it.q.id <= si*10);
  }
  if (topic !== 'all') items = items.filter(it => it.q.topic === topic);
  items = shuffle(items);
  let n = countSel === 'all' ? items.length : parseInt(countSel);
  n = Math.min(n, items.length);
  items = items.slice(0, n);
  if (items.length === 0 && mode === 'due') {
    items = shuffle(BANK.map(q => ({ q, p: getCard(q.id) }))).slice(0, 20);
  }
  return items;
}

function renderStudyCard() {
  if (studyState.index >= studyState.queue.length) {
    studyCard.classList.add('hidden');
    studyInfo.textContent = `Hoàn thành ${studyState.queue.length} thẻ. Chọn chế độ và bắt đầu lại.`;
    return;
  }
  studyState.current = studyState.queue[studyState.index];
  studyState.selected = new Set();
  studyState.checked = false;
  const q = studyState.current.q;
  const p = studyState.current.p;
  studyCounter.textContent = `Câu ${studyState.index + 1}/${studyState.queue.length}`;
  studyBox.textContent = `Box ${p.box || 0}`;
  document.getElementById('study-progress').style.width = `${Math.round((studyState.index / studyState.queue.length) * 100)}%`;
  document.getElementById('study-topic-label').textContent = q.topic;
  studyQuestion.textContent = q.question;
  studyChoices.innerHTML = '';
  q.choices.forEach(c => {
    const div = document.createElement('div');
    div.className = 'choice';
    const inp = document.createElement('input');
    inp.type = q.multiple ? 'checkbox' : 'radio';
    inp.name = 'study-choice';
    inp.value = c.key;
    inp.addEventListener('change', () => {
      if (q.multiple) {
        if (inp.checked) studyState.selected.add(c.key); else studyState.selected.delete(c.key);
      } else {
        studyState.selected.clear();
        if (inp.checked) studyState.selected.add(c.key);
      }
      // manual check via button
    });
    div.addEventListener('click', (e) => {
      if (studyState.checked) return;
      if (e.target !== inp) inp.click();
    });
    const span = document.createElement('span');
    span.textContent = `${c.key}. ${c.text}`;
    div.appendChild(inp);
    div.appendChild(span);
    studyChoices.appendChild(div);
  });
  studyFeedback.classList.add('hidden');
  studyRating.classList.add('hidden');
  studyNext.classList.add('hidden');
  studyCard.classList.remove('hidden');
}

document.getElementById('study-start').addEventListener('click', () => {
  const mode = document.getElementById('study-mode').value;
  studyState.queue = buildStudyQueue(mode);
  studyState.index = 0;
  if (studyState.queue.length === 0) {
    studyInfo.textContent = 'Không có thẻ phù hợp.';
    studyCard.classList.add('hidden');
    return;
  }
  studyInfo.textContent = `Đang học ${studyState.queue.length} thẻ.`;
  renderStudyCard();
});

function checkStudy() {
  if (studyState.checked || !studyState.current) return;
  studyState.checked = true;
  const q = studyState.current.q;
  const p = studyState.current.p;
  const correctSet = new Set(q.answer.split(''));
  const isCorrect = studyState.selected.size === correctSet.size &&
    [...studyState.selected].every(x => correctSet.has(x));
  p.attempts = (p.attempts || 0) + 1;
  if (isCorrect) p.correct = (p.correct || 0) + 1;
  p.lastWrong = !isCorrect;
  saveProgress();

  const divs = studyChoices.querySelectorAll('.choice');
  divs.forEach(div => {
    const key = div.querySelector('input').value;
    div.classList.remove('correct', 'wrong', 'missed');
    if (correctSet.has(key) && studyState.selected.has(key)) div.classList.add('correct');
    else if (correctSet.has(key) && !studyState.selected.has(key)) div.classList.add('missed');
    else if (!correctSet.has(key) && studyState.selected.has(key)) div.classList.add('wrong');
    const inp = div.querySelector('input');
    inp.disabled = true;
  });

  studyFeedback.textContent = isCorrect
    ? 'Đúng!'
    : `Sai. Đáp án đúng: ${q.answer.split('').join(', ')}`;
  studyFeedback.className = 'feedback ' + (isCorrect ? 'ok' : 'bad');
  studyFeedback.classList.remove('hidden');
  studyRating.classList.remove('hidden');
  studyNext.classList.add('hidden');
}
document.getElementById('study-check').addEventListener('click', checkStudy);

document.querySelectorAll('#study-rating .rate').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!studyState.current) return;
    const quality = parseInt(btn.dataset.q);
    const q = studyState.current.q;
    const p = getCard(q.id);
    let box = p.box || 0;
    if (quality < 3) {
      box = 0;
      p.lapses = (p.lapses || 0) + 1;
    } else if (quality === 5) {
      box = Math.min(5, box + 2);
    } else if (quality === 4) {
      box = Math.min(5, box + 1);
    } else {
      box = Math.max(1, box);
    }
    const intervals = [1, 1, 10, 1440, 4320, 10080];
    p.box = box;
    p.interval = intervals[box];
    p.due = Date.now() + intervals[box] * 60000;
    p.reps = (p.reps || 0) + 1;
    p.ease = Math.max(1.3, (p.ease || 2.5) + (quality >= 4 ? 0.1 : -0.15));
    progress[q.id] = p;
    saveProgress();
    studyState.index++;
    renderStudyCard();
  });
});

studyNext.addEventListener('click', () => {
  studyState.index++;
  renderStudyCard();
});

document.getElementById('study-reset').addEventListener('click', () => {
  if (confirm('Xóa toàn bộ tiến độ học?')) {
    progress = {};
    localStorage.removeItem(STORAGE_KEY);
    saveProgress(progress);
    studyState.queue = [];
    studyCard.classList.add('hidden');
    studyInfo.textContent = 'Đã reset tiến độ.';
  }
});

// ---------- Quiz ----------
const quizState = { queue: [], index: 0, answers: {}, timer: null, end: 0, selected: new Set() };

function renderQuizCard() {
  if (quizState.index >= quizState.queue.length) { finishQuiz(); return; }
  const q = quizState.queue[quizState.index];
  quizState.selected = quizState.answers[q.id] ? new Set(quizState.answers[q.id]) : new Set();
  document.getElementById('quiz-counter').textContent = `Câu ${quizState.index + 1}/${quizState.queue.length}`;
  document.getElementById('quiz-progress').style.width = `${Math.round((quizState.index / quizState.queue.length) * 100)}%`;
  document.getElementById('quiz-topic-label').textContent = q.topic;
  document.getElementById('quiz-question').textContent = q.question;
  const container = document.getElementById('quiz-choices');
  container.innerHTML = '';
  q.choices.forEach(c => {
    const div = document.createElement('div');
    div.className = 'choice';
    const inp = document.createElement('input');
    inp.type = q.multiple ? 'checkbox' : 'radio';
    inp.name = 'quiz-choice';
    inp.value = c.key;
    inp.checked = quizState.selected.has(c.key);
    inp.addEventListener('change', () => {
      if (q.multiple) {
        if (inp.checked) quizState.selected.add(c.key); else quizState.selected.delete(c.key);
      } else {
        quizState.selected.clear();
        if (inp.checked) quizState.selected.add(c.key);
      }
      quizState.answers[q.id] = new Set(quizState.selected);
    });
    div.addEventListener('click', (e) => {
      if (e.target !== inp) inp.click();
    });
    const span = document.createElement('span');
    span.textContent = `${c.key}. ${c.text}`;
    div.appendChild(inp);
    div.appendChild(span);
    container.appendChild(div);
  });
  const btn = document.getElementById('quiz-next');
  btn.textContent = (quizState.index === quizState.queue.length - 1) ? 'Nộp bài' : 'Câu tiếp theo';
}

document.getElementById('quiz-start').addEventListener('click', () => {
  const countSel = document.getElementById('quiz-count').value;
  const topic = document.getElementById('quiz-topic').value;
  const setSel = document.getElementById('quiz-set').value;
  let pool = BANK;
  if (setSel !== 'all') {
    const si = parseInt(setSel);
    pool = pool.filter(q => q.id > (si-1)*10 && q.id <= si*10);
  }
  if (topic !== 'all') pool = pool.filter(q => q.topic === topic);
  let n = countSel === 'all' ? pool.length : parseInt(countSel);
  n = Math.min(n, pool.length);
  quizState.queue = shuffle(pool).slice(0, n);
  quizState.index = 0;
  quizState.answers = {};
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-card').classList.remove('hidden');
  if (document.getElementById('quiz-timer').checked) {
    startTimer(15 * 60);
  } else {
    document.getElementById('quiz-time').textContent = '';
    if (quizState.timer) clearInterval(quizState.timer);
  }
  renderQuizCard();
});

function startTimer(seconds) {
  if (quizState.timer) clearInterval(quizState.timer);
  quizState.end = Date.now() + seconds * 1000;
  quizState.timer = setInterval(() => {
    const rem = Math.max(0, quizState.end - Date.now());
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    document.getElementById('quiz-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (rem <= 0) {
      clearInterval(quizState.timer);
      finishQuiz();
    }
  }, 1000);
}

document.getElementById('quiz-next').addEventListener('click', () => {
  const q = quizState.queue[quizState.index];
  quizState.answers[q.id] = new Set(quizState.selected);
  quizState.index++;
  renderQuizCard();
});

function finishQuiz() {
  if (quizState.index < quizState.queue.length) {
    const cq = quizState.queue[quizState.index];
    quizState.answers[cq.id] = new Set(quizState.selected);
  }
  if (quizState.timer) clearInterval(quizState.timer);
  document.getElementById('quiz-card').classList.add('hidden');
  const result = document.getElementById('quiz-result');
  result.classList.remove('hidden');
  let score = 0;
  const review = document.getElementById('quiz-review');
  review.innerHTML = '';
  quizState.queue.forEach((q, i) => {
    const ans = quizState.answers[q.id] ? quizState.answers[q.id] : new Set();
    const correctSet = new Set(q.answer.split(''));
    const isCorrect = ans.size === correctSet.size && [...ans].every(x => correctSet.has(x));
    if (isCorrect) score++;
    // update progress stats (not SRS)
    const p = getCard(q.id);
    p.attempts = (p.attempts || 0) + 1;
    if (isCorrect) p.correct = (p.correct || 0) + 1;
    p.lastWrong = !isCorrect;
    progress[q.id] = p;
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `<div><strong>Câu ${i + 1}:</strong> ${q.question}</div>
      <div>Trả lời: ${[...ans].join(', ') || '(trống)'} ${isCorrect ? '✓' : '✗'}</div>
      <div class="wrong">Đáp án đúng: ${q.answer.split('').join(', ')}</div>`;
    review.appendChild(div);
  });
  saveProgress();
  document.getElementById('quiz-score').textContent =
    `Điểm: ${score}/${quizState.queue.length} (${Math.round(score / quizState.queue.length * 100)}%)`;
}

document.getElementById('quiz-restart').addEventListener('click', () => {
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-card').classList.add('hidden');
});

// ---------- Browse ----------
const browseSearch = document.getElementById('browse-search');
const browseList = document.getElementById('browse-list');
const browseCount = document.getElementById('browse-count');

function renderBrowse(filter) {
  const f = (filter || '').toLowerCase();
  const topic = document.getElementById('browse-topic').value;
  const items = BANK.filter(q =>
    (topic === 'all' || q.topic === topic) &&
    (q.question.toLowerCase().includes(f) || String(q.id).includes(f) ||
    q.choices.some(c => c.text.toLowerCase().includes(f)))
  );
  browseCount.textContent = `${items.length} câu`;
  browseList.innerHTML = '';
  items.slice(0, 300).forEach(q => {
    const div = document.createElement('div');
    div.className = 'browse-item';
    div.innerHTML = `<div class="q">${q.id}. ${q.question}</div>
      <div class="a">Chủ đề: ${q.topic} | Đáp án: ${q.answer.split('').join(', ')}</div>`;
    browseList.appendChild(div);
  });
}
browseSearch.addEventListener('input', () => renderBrowse(browseSearch.value));
document.getElementById('browse-topic').addEventListener('change', () => renderBrowse(browseSearch.value));
renderBrowse('');

// ---------- Stats ----------
function renderStats() {
  const body = document.getElementById('stats-body');
  let studied = 0, due = 0, mastered = 0, attempts = 0, correct = 0;
  const boxes = [0, 0, 0, 0, 0, 0];
  BANK.forEach(q => {
    const p = progress[q.id];
    if (p) {
      studied++;
      attempts += p.attempts || 0;
      correct += p.correct || 0;
      boxes[p.box || 0]++;
      if ((p.box || 0) >= 4) mastered++;
    } else {
      boxes[0]++;
    }
    const pp = p || { due: 0 };
    if ((pp.due || 0) <= Date.now()) due++;
  });
  const acc = attempts ? Math.round(correct / attempts * 100) : 0;
  const boxBars = boxes.map((v, i) => `
    <div class="stats-bar">
      <div class="label">Box ${i}</div>
      <div class="bar"><div class="fill" style="width:${Math.round(v / BANK.length * 100)}%"></div></div>
      <div class="label">${v}</div>
    </div>`).join('');
  body.innerHTML = `
    <p><strong>Tổng số câu:</strong> ${BANK.length}</p>
    <p><strong>Đã học (có tiến độ):</strong> ${studied}</p>
    <p><strong>Đến hạn ôn:</strong> ${due}</p>
    <p><strong>Thành thạo (box ≥4):</strong> ${mastered}</p>
    <p><strong>Tổng lượt trả lời:</strong> ${attempts}</p>
    <p><strong>Số câu đúng:</strong> ${correct} (${acc}%)</p>
    <h3>Phân bố box</h3>
    ${boxBars}
  `;
}

document.getElementById('export-progress').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vnr202_progress.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-progress').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      progress = data;
      saveProgress(progress);
      renderStats();
      alert('Đã nhập tiến độ.');
    } catch (err) {
      alert('File không hợp lệ.');
    }
  };
  reader.readAsText(file);
});
