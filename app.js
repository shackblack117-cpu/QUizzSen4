(() => {
  const questions = window.QUIZ_QUESTIONS || [];
  const groups = [...new Set(questions.map(q => q.topic))];
  const palette = ['#eeeaff','#e8f6ef','#fff2e5','#eaf3ff','#fff0f2','#e8f6f6'];
  const progressKey = 'sen169QuizProgress';
  let saved = readProgress();
  let activeQuestions = [], answers = [], index = 0, points = 0, streak = 0, startedAt = 0, clockTick;
  let currentMode = 'practice', currentSelection = 'all', chosenAnswer = null;
  let currentCodeTask = '1-0';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function readProgress() {
    try { return JSON.parse(localStorage.getItem(progressKey)) || { answered: [], results: {}, best: 0, streak: 0 }; }
    catch { return { answered: [], results: {}, best: 0, streak: 0 }; }
  }
  function persist() { localStorage.setItem(progressKey, JSON.stringify(saved)); updateStats(); }
  function countFor(topic) { return questions.filter(q => q.topic === topic).length; }
  function renderTopics(target, limit = Infinity) {
    const container = document.getElementById(target);
    container.innerHTML = groups.slice(0, limit).map((topic, i) => `
      <button class="topic-card topic-color-${i % 6}" data-topic="${escapeAttr(topic)}" aria-label="Luyện ${escapeAttr(topic)}">
        <span class="topic-num">${String(i + 1).padStart(2, '0')}</span><strong>${escapeHTML(topic.replace(/–/g, '–'))}</strong>
        <small>${countFor(topic)} câu hỏi · ~${Math.max(2, Math.round(countFor(topic) * .45))} phút</small><span class="topic-arrow">↗</span>
      </button>`).join('');
    $$('.topic-card', container).forEach(card => card.addEventListener('click', () => startQuiz(card.dataset.topic, 'practice')));
  }
  function updateStats() {
    const total = saved.answered.length;
    $('#completed-count').textContent = total;
    const correct = Object.values(saved.results || {}).filter(Boolean).length;
    $('#accuracy-stat').textContent = total ? `${Math.round(correct / total * 100)}%` : '—';
    $('#best-score').textContent = saved.best;
    $('#streak-display').textContent = saved.streak;
    $('#sidebar-progress').textContent = `${total} / ${questions.length} câu đã luyện`;
    $('.mini-progress i').style.width = `${Math.min(100, total / questions.length * 100)}%`;
  }
  function showView(view) {
    $$('.view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`${view}-view`);
    if (target) target.classList.remove('hidden');
    $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === view || (view === 'quiz' && el.dataset.view === 'practice')));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function startQuiz(selection, mode = 'practice') {
    currentMode = mode;
    currentSelection = selection;
    let pool = selection === 'all' ? questions : questions.filter(q => q.topic === selection);
    if (mode === 'random10') pool = shuffle(questions).slice(0, 10);
    if (mode === 'exam20') pool = shuffle(questions).slice(0, 20);
    activeQuestions = shuffle(pool);
    answers = []; index = 0; points = 0; streak = 0; chosenAnswer = null; startedAt = Date.now();
    $('#quiz-mode-label').textContent = mode === 'exam20' ? 'MÔ PHỎNG THI' : 'LUYỆN TẬP';
    clearInterval(clockTick);
    clockTick = setInterval(() => { $('#quiz-timer').textContent = `◷ ${formatTime((Date.now() - startedAt) / 1000)}`; }, 1000);
    showView('quiz'); renderQuestion();
  }
  function renderQuestion() {
    const q = activeQuestions[index]; chosenAnswer = null;
    $('#question-count').textContent = `CÂU ${String(index + 1).padStart(2, '0')} / ${activeQuestions.length}`;
    $('#quiz-points').textContent = `${points} điểm`;
    $('#progress-fill').style.width = `${index / activeQuestions.length * 100}%`;
    $('#question-topic').textContent = q.topic;
    $('#question-text').textContent = q.question;
    const box = $('#feedback-box'); box.className = 'feedback-box hidden'; box.textContent = '';
    $('#next-question').disabled = true;
    $('#next-question').innerHTML = `${q.options.length ? 'Chọn một đáp án' : 'Nhập câu trả lời'} <span>→</span>`;
    $('#answer-list').innerHTML = q.options.length
      ? q.options.map(opt => `<button class="answer-option" data-answer="${opt.label}"><span class="answer-letter">${opt.label}</span><span>${escapeHTML(opt.text)}</span></button>`).join('')
      : `<div class="free-answer"><input id="free-answer-input" type="text" autocomplete="off" aria-label="Nhập câu trả lời" placeholder="Nhập câu trả lời của bạn"><button class="button button-secondary" id="check-free-answer">Kiểm tra</button></div>`;
    $$('.answer-option').forEach(btn => btn.addEventListener('click', () => selectAnswer(btn.dataset.answer)));
    $('#check-free-answer')?.addEventListener('click', () => selectAnswer($('#free-answer-input').value.trim()));
    $('#free-answer-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') selectAnswer(event.currentTarget.value.trim()); });
  }
  function selectAnswer(label) {
    if (chosenAnswer !== null || (typeof label === 'string' && !label.trim())) return;
    chosenAnswer = label;
    const q = activeQuestions[index];
    const normalize = value => String(value).toLocaleLowerCase().replace(/\s+/g, '').replace(/[“”‘’]/g, "'");
    const correct = q.options.length ? label === q.answer : normalize(label) === normalize(q.answerText);
    answers.push({ id: q.id, selected: label, correct: q.options.length ? q.answer : q.answerText, isCorrect: correct, topic: q.topic, question: q.question, options: q.options });
    if (!saved.answered.includes(q.id)) saved.answered.push(q.id);
    if (correct) { points += 100 + Math.max(0, streak) * 10; streak++; }
    else streak = 0;
    if (!saved.results) saved.results = {};
    saved.results[q.id] = correct;
    saved.streak = Math.max(saved.streak || 0, streak);
    persist();
    $$('.answer-option').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer === q.answer) btn.classList.add('correct');
      else if (btn.dataset.answer === label) btn.classList.add('incorrect');
    });
    if ($('#free-answer-input')) $('#free-answer-input').disabled = true;
    if ($('#check-free-answer')) $('#check-free-answer').disabled = true;
    const feedback = $('#feedback-box'); feedback.className = `feedback-box ${correct ? 'correct' : 'incorrect'}`;
    feedback.textContent = correct ? `✓ Chính xác! ${streak > 1 ? `Chuỗi ${streak} câu đúng · ` : ''}+${100 + Math.max(0, streak - 1) * 10} điểm.` : `Chưa đúng. Đáp án chính xác là ${q.options.length ? q.answer + '. ' + (q.options.find(o => o.label === q.answer)?.text || '') : q.answerText}.`;
    $('#quiz-points').textContent = `${points} điểm`;
    $('#next-question').disabled = false;
    $('#next-question').innerHTML = index === activeQuestions.length - 1 ? 'Xem kết quả <span>→</span>' : 'Câu tiếp theo <span>→</span>';
  }
  function nextQuestion() { if (!chosenAnswer) return; if (index + 1 >= activeQuestions.length) finishQuiz(); else { index++; renderQuestion(); } }
  function finishQuiz() {
    clearInterval(clockTick); $('#progress-fill').style.width = '100%';
    saved.best = Math.max(saved.best, points); persist();
    const correct = answers.filter(a => a.isCorrect).length;
    const accuracy = Math.round(correct / activeQuestions.length * 100);
    $('#result-score').innerHTML = `${points.toLocaleString()}<span>điểm</span>`;
    $('#result-correct').textContent = `${correct}/${activeQuestions.length}`;
    $('#result-accuracy').textContent = `${accuracy}%`;
    $('#result-time').textContent = formatTime((Date.now() - startedAt) / 1000);
    $('#result-title').textContent = accuracy >= 80 ? 'Xuất sắc lắm!' : accuracy >= 50 ? 'Bạn đang tiến bộ!' : 'Cùng ôn thêm nhé!';
    $('#result-subtitle').textContent = accuracy >= 80 ? 'Kiến thức của bạn đang rất vững. Tiếp tục giữ phong độ nhé.' : 'Xem lại những câu sai để ghi nhớ kiến thức lâu hơn.';
    $('#result-symbol').textContent = accuracy >= 80 ? '✦' : accuracy >= 50 ? '↗' : '✎';
    $('#review-list').innerHTML = answers.map((a, n) => `<article class="review-item"><strong>${n + 1}. ${escapeHTML(a.question)}</strong><p class="${a.isCorrect ? 'right' : 'wrong'}">${a.isCorrect ? '✓ Đúng' : `✕ Bạn trả lời ${escapeHTML(a.selected)}`} · Đáp án: ${escapeHTML(a.correct)}${escapeHTML(a.options.find(o => o.label === a.correct)?.text ? '. ' + a.options.find(o => o.label === a.correct).text : '')}</p></article>`).join('');
    showView('result');
  }
  function formatTime(sec) { sec = Math.floor(sec); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function escapeAttr(s) { return escapeHTML(s); }
  function renderExamples(week = 'all') {
    const data = window.WEEKLY_EXAMPLES || [];
    const filters = $('#week-filters');
    filters.innerHTML = `<button class="week-filter ${week === 'all' ? 'selected' : ''}" data-week="all">Tất cả tuần</button>` + data.map(item => `<button class="week-filter ${String(week) === String(item.week) ? 'selected' : ''}" data-week="${item.week}">Tuần ${String(item.week).padStart(2, '0')}</button>`).join('');
    const chosen = week === 'all' ? data : data.filter(item => String(item.week) === String(week));
    $('#examples-list').innerHTML = chosen.map(group => `<section class="week-group"><div class="week-heading"><span class="week-number">${String(group.week).padStart(2, '0')}</span><div><h2>Tuần ${group.week} · ${escapeHTML(group.topic)}</h2><small>Tham khảo: ${escapeHTML(group.tutorial)}</small></div><span class="week-total">${group.items.length} ví dụ</span></div><div class="example-grid">${group.items.map((item, n) => `<article class="example-card"><div class="example-label">VÍ DỤ ${String(n + 1).padStart(2, '0')}</div><h3>${escapeHTML(item.title)}</h3><p class="example-prompt">${escapeHTML(item.prompt)}</p><button class="open-code-workspace" data-code-task="${group.week}-${n}">Mở trong không gian code →</button><button class="solution-toggle" aria-expanded="false">Xem lời giải <span>⌄</span></button><div class="solution-content hidden"><pre>${escapeHTML(item.solution)}</pre><div class="example-result"><strong>Kết quả</strong><p>${escapeHTML(item.result)}</p></div><div class="example-note"><strong>Ghi nhớ</strong><p>${escapeHTML(item.note)}</p></div></div></article>`).join('')}</div></section>`).join('');
    $$('.week-filter', filters).forEach(btn => btn.addEventListener('click', () => renderExamples(btn.dataset.week)));
    $$('.solution-toggle').forEach(btn => btn.addEventListener('click', () => {
      const panel = btn.nextElementSibling;
      const opening = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !opening);
      btn.setAttribute('aria-expanded', String(opening));
      btn.innerHTML = opening ? 'Ẩn lời giải <span>⌃</span>' : 'Xem lời giải <span>⌄</span>';
    }));
    $$('.open-code-workspace').forEach(btn => btn.addEventListener('click', () => { renderCoding(btn.dataset.codeTask); showView('coding'); }));
  }
  function codingItem(id = currentCodeTask) {
    const [week, item] = id.split('-').map(Number);
    const group = (window.WEEKLY_EXAMPLES || []).find(row => row.week === week);
    return group ? { group, item: group.items[item], id, index: item } : null;
  }
  function renderCoding(taskId = currentCodeTask) {
    const groupsList = window.WEEKLY_EXAMPLES || [];
    if (!groupsList.length) return;
    currentCodeTask = taskId;
    const selected = codingItem(taskId) || codingItem('1-0');
    currentCodeTask = selected.id;
    $('#coding-task-list').innerHTML = groupsList.map(group => `<div class="coding-week-label">TUẦN ${String(group.week).padStart(2, '0')}</div>${group.items.map((item, n) => `<button class="coding-task-link ${selected.id === `${group.week}-${n}` ? 'selected' : ''}" data-task="${group.week}-${n}"><span class="task-link-dot"></span><span>${escapeHTML(item.title)}</span></button>`).join('')}`).join('');
    $$('.coding-task-link').forEach(btn => btn.addEventListener('click', () => renderCoding(btn.dataset.task)));
    $('#coding-task-week').textContent = `TUẦN ${String(selected.group.week).padStart(2, '0')} · ${selected.group.topic.toUpperCase()}`;
    $('#coding-task-title').textContent = selected.item.title;
    $('#coding-task-prompt').textContent = selected.item.prompt;
    $('#code-editor').value = localStorage.getItem(`se1TutDraft:${selected.id}`) || '';
    $('#reference-code').textContent = selected.item.solution;
    $('#reference-note').textContent = `${selected.item.result} ${selected.item.note}`;
    $('#code-reference').classList.add('hidden');
    $('#toggle-reference').innerHTML = 'Xem lời giải mẫu <span>⌄</span>';
    $('#draft-status').textContent = localStorage.getItem(`se1TutDraft:${selected.id}`) ? 'Có nháp đã lưu' : 'Chưa lưu';
    updateLineNumbers();
  }
  function updateLineNumbers() {
    const lines = Math.max(1, $('#code-editor').value.split('\n').length);
    $('#line-numbers').innerHTML = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('');
  }
  function saveCode() {
    localStorage.setItem(`se1TutDraft:${currentCodeTask}`, $('#code-editor').value);
    $('#draft-status').textContent = 'Đã lưu trên trình duyệt';
    toast('Đã lưu bản nháp');
  }
  function copyCode(text = $('#code-editor').value) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Đã sao chép')).catch(() => fallbackCopy(text));
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const field = document.createElement('textarea'); field.value = text; document.body.appendChild(field); field.select();
    const copied = document.execCommand('copy'); field.remove(); toast(copied ? 'Đã sao chép' : 'Không sao chép được, hãy chọn và copy thủ công');
  }
  function downloadCode() {
    const selected = codingItem();
    const blob = new Blob([$('#code-editor').value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `SE1-week-${String(selected.group.week).padStart(2, '0')}-example-${selected.index + 1}.txt`;
    link.click(); URL.revokeObjectURL(link.href);
  }
  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200); }

  renderTopics('home-topics', 6); renderTopics('all-topics'); renderExamples(); renderCoding(); updateStats();
  $$('[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $$('[data-start]').forEach(btn => btn.addEventListener('click', () => startQuiz(btn.dataset.start, btn.dataset.start === 'exam20' ? 'exam20' : btn.dataset.start === 'random10' ? 'random10' : 'practice')));
  $('#next-question').addEventListener('click', nextQuestion);
  $('#leave-quiz').addEventListener('click', () => { clearInterval(clockTick); showView('practice'); });
  $('#retry-quiz').addEventListener('click', () => startQuiz(currentSelection, currentMode));
  $('#code-editor').addEventListener('input', () => { updateLineNumbers(); $('#draft-status').textContent = 'Có thay đổi chưa lưu'; });
  $('#code-editor').addEventListener('scroll', () => { $('#line-numbers').scrollTop = $('#code-editor').scrollTop; });
  $('#code-editor').addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); const el = event.currentTarget; const start = el.selectionStart, end = el.selectionEnd; el.setRangeText('  ', start, end, 'end'); updateLineNumbers(); $('#draft-status').textContent = 'Có thay đổi chưa lưu'; }
  });
  $('#save-code').addEventListener('click', saveCode);
  $('#copy-code').addEventListener('click', () => copyCode());
  $('#reset-code').addEventListener('click', () => { $('#code-editor').value = ''; updateLineNumbers(); $('#draft-status').textContent = 'Đã xóa nội dung (chưa lưu)'; });
  $('#download-code').addEventListener('click', downloadCode);
  $('#toggle-reference').addEventListener('click', () => {
    const panel = $('#code-reference'); const opening = panel.classList.contains('hidden'); panel.classList.toggle('hidden', !opening);
    $('#toggle-reference').innerHTML = opening ? 'Ẩn lời giải mẫu <span>⌃</span>' : 'Xem lời giải mẫu <span>⌄</span>';
  });
  $('#use-reference').addEventListener('click', () => { $('#code-editor').value = codingItem().item.solution; updateLineNumbers(); $('#draft-status').textContent = 'Lời giải mẫu (chưa lưu)'; });
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !$('#coding-view').classList.contains('hidden')) { event.preventDefault(); saveCode(); } });
  document.addEventListener('keydown', e => {
    if ($('#quiz-view').classList.contains('hidden')) return;
    if (!e.target.matches('input, textarea') && ['a','b','c','d','e'].includes(e.key.toLowerCase()) && !chosenAnswer) selectAnswer(e.key.toUpperCase());
    if (e.key === 'Enter' && chosenAnswer) nextQuestion();
  });
})();
