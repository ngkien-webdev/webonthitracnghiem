// script.js
let state = {
    currentSubject: null,
    sections: [],
    selectedSections: [],
    availableCount: 0,
    requestedCount: 10,
    mode: 'practice',
    time: 15,
    quizData: [],
    answers: {},
    flagged: {},
    currentIndex: 0,
    timerInt: null,
    timeRem: 0,
    history: JSON.parse(localStorage.getItem('gau_history')) || []
};

document.addEventListener("DOMContentLoaded", () => {
    renderSubjects();
    renderHistory();
});

// Điều hướng
function navigateTo(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    window.scrollTo(0,0);
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    document.getElementById('theme-icon').className = document.documentElement.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// 1. CHỌN MÔN HỌC
function renderSubjects() {
    const html = SUBJECTS.map(sub => `
        <div onclick="${sub.active ? `selectSubject('${sub.id}')` : ''}" 
             class="glass p-6 rounded-3xl ${sub.active ? 'hover:border-bear-500 cursor-pointer shadow-md' : 'opacity-60 cursor-not-allowed'} transition-all text-center">
            <div class="text-4xl mb-3">${sub.icon}</div>
            <h3 class="font-bold text-lg text-slate-800 dark:text-white">${sub.name}</h3>
            <p class="text-xs text-slate-500 mt-2">${sub.active ? sub.desc : 'Sắp ra mắt'}</p>
        </div>
    `).join('');
    document.getElementById('subject-list').innerHTML = html;
}

function selectSubject(subId) {
    state.currentSubject = subId;
    const sub = SUBJECTS.find(s => s.id === subId);
    document.getElementById('config-subject-title').innerText = `Thiết lập: ${sub.name}`;
    
    // Lấy các phần kiến thức độc nhất
    const allQ = QUESTION_BANK[subId];
    state.sections = [...new Set(allQ.map(q => q.s))];
    state.selectedSections = [...state.sections]; // Mặc định chọn hết
    
    renderSectionCheckboxes();
    calcAvailableQuestions();
    navigateTo('config');
}

// 2. CẤU HÌNH (Tính toán số câu linh hoạt)
function renderSectionCheckboxes() {
    const html = state.sections.map(sec => `
        <label class="p-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2">
            <input type="checkbox" value="${sec}" checked onchange="handleSectionChange()" class="sec-cb w-4 h-4 text-bear-500">
            <span class="text-sm font-semibold">${sec}</span>
        </label>
    `).join('');
    document.getElementById('section-checkboxes').innerHTML = html;
}

function handleSectionChange() {
    const cbs = document.querySelectorAll('.sec-cb:checked');
    state.selectedSections = Array.from(cbs).map(cb => cb.value);
    calcAvailableQuestions();
}

function calcAvailableQuestions() {
    const allQ = QUESTION_BANK[state.currentSubject];
    const filtered = allQ.filter(q => state.selectedSections.includes(q.s));
    state.availableCount = filtered.length;
    
    document.getElementById('max-question-hint').innerText = `Ngân hàng hiện có: ${state.availableCount} câu cho các phần đã chọn.`;
    
    // Điều chỉnh số lượng yêu cầu nếu vượt quá
    if (state.requestedCount > state.availableCount && state.requestedCount !== 'all') {
        state.requestedCount = state.availableCount;
    }
    renderCountButtons();
}

function renderCountButtons() {
    const counts = [10, 20, 30, 40, 50, 'all'];
    const html = counts.map(c => {
        const isAll = c === 'all';
        const num = isAll ? state.availableCount : c;
        const isDisabled = !isAll && c > state.availableCount;
        
        let btnClass = "px-4 py-2 rounded-lg text-sm font-bold border transition-all ";
        if (isDisabled) btnClass += "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800";
        else if (state.requestedCount === c || (isAll && state.requestedCount === 'all')) btnClass += "bg-bear-500 text-white border-bear-500 shadow";
        else btnClass += "hover:bg-amber-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700";

        return `<button ${isDisabled ? 'disabled' : `onclick="setCount('${c}')"`} class="${btnClass}">${isAll ? 'Tất cả' : c}</button>`;
    }).join('');
    document.getElementById('question-count-container').innerHTML = html;
}

function setCount(c) {
    state.requestedCount = c === 'all' ? 'all' : parseInt(c);
    renderCountButtons();
}

function selectMode(m) {
    state.mode = m;
    document.getElementById('mode-practice').className = `p-4 rounded-xl border-2 cursor-pointer transition-all ${m==='practice'?'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30':'border-slate-200 dark:border-slate-700'}`;
    document.getElementById('mode-exam').className = `p-4 rounded-xl border-2 cursor-pointer transition-all ${m==='exam'?'border-rose-500 bg-rose-50 dark:bg-rose-900/30':'border-slate-200 dark:border-slate-700'}`;
    
    const timeEl = document.getElementById('time-config');
    m === 'exam' ? timeEl.classList.remove('hidden') : timeEl.classList.add('hidden');
    setTime(state.time);
}

function setTime(t) {
    state.time = t;
    document.querySelectorAll('.btn-time').forEach(btn => {
        if(btn.innerText.includes(t)) btn.className = "btn-time px-4 py-1.5 rounded bg-rose-500 text-white text-sm font-bold";
        else btn.className = "btn-time px-4 py-1.5 rounded border border-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800";
    });
}

// 3. THỰC HIỆN THI
function startQuiz() {
    if (state.selectedSections.length === 0) return alert("Vui lòng chọn ít nhất 1 phần!");
    
    let pool = QUESTION_BANK[state.currentSubject].filter(q => state.selectedSections.includes(q.s));
    
    // Trộn mảng (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let takeCount = state.requestedCount === 'all' ? pool.length : state.requestedCount;
    state.quizData = pool.slice(0, takeCount);
    state.answers = {};
    state.flagged = {};
    state.currentIndex = 0;

    if (state.mode === 'exam') {
        state.timeRem = state.time * 60;
        document.getElementById('quiz-timer').classList.remove('hidden');
        clearInterval(state.timerInt);
        state.timerInt = setInterval(tick, 1000);
    } else {
        document.getElementById('quiz-timer').classList.add('hidden');
    }

    renderQuiz();
    navigateTo('quiz');
}

function tick() {
    state.timeRem--;
    const m = Math.floor(state.timeRem / 60).toString().padStart(2, '0');
    const s = (state.timeRem % 60).toString().padStart(2, '0');
    document.getElementById('quiz-timer').innerText = `${m}:${s}`;
    if (state.timeRem <= 0) {
        clearInterval(state.timerInt);
        alert("Hết giờ! Hệ thống tự động nộp bài.");
        submitQuiz();
    }
}

function renderQuiz() {
    const q = state.quizData[state.currentIndex];
    document.getElementById('quiz-counter').innerText = `Câu ${state.currentIndex + 1} / ${state.quizData.length}`;
    document.getElementById('q-section-badge').innerText = q.s;

    // Tự động lọc bỏ chữ "Câu XX: " nếu có sẵn trong data.js để không bị lặp
    const cleanQuestionText = q.q.replace(/^Câu\s+\d+:\s*/i, '');
    document.getElementById('q-text').innerText = `Câu ${state.currentIndex + 1}: ${cleanQuestionText}`;

    const optsHTML = Object.entries(q.o).map(([k, v]) => {
        let bg = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-bear-500";
        const isSelected = state.answers[state.currentIndex] === k;
        
        if (isSelected) bg = "bg-amber-100 dark:bg-amber-900/50 border-bear-500 font-bold";
        
        // Mode luyện tập: check ngay
        if (state.mode === 'practice' && state.answers[state.currentIndex]) {
            if (k === q.c) bg = "bg-emerald-100 border-emerald-500 text-emerald-800 font-bold";
            else if (isSelected) bg = "bg-rose-100 border-rose-500 text-rose-800 font-bold";
        }

        return `<button onclick="ans('${k}')" class="w-full p-4 text-left border rounded-xl flex gap-3 transition-all ${bg}">
            <span class="w-6 h-6 flex items-center justify-center border rounded font-bold text-xs shrink-0">${k}</span>
            <span class="text-sm">${v}</span>
        </button>`;
    }).join('');
    
    document.getElementById('q-options').innerHTML = optsHTML;

    // Giải thích
    const exp = document.getElementById('q-explanation');
    if (state.mode === 'practice' && state.answers[state.currentIndex]) {
        exp.classList.remove('hidden');
        exp.innerHTML = `💡 Đáp án đúng là <b>${q.c}</b>`;
    } else {
        exp.classList.add('hidden');
    }

    // Nút Flag
    const btnFlag = document.getElementById('btn-flag');
    if (state.flagged[state.currentIndex]) btnFlag.className = "px-4 py-2 rounded-lg border-2 border-amber-500 bg-amber-500 text-white font-bold";
    else btnFlag.className = "px-4 py-2 rounded-lg border-2 border-amber-400 text-amber-600 font-bold hover:bg-amber-50";

    renderGrid();
}

function ans(k) {
    state.answers[state.currentIndex] = k;
    renderQuiz();
}

function navQ(dir) {
    const n = state.currentIndex + dir;
    if (n >= 0 && n < state.quizData.length) {
        state.currentIndex = n;
        renderQuiz();
    }
}

function toggleFlag() {
    state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
    renderQuiz();
}

function renderGrid() {
    const html = state.quizData.map((_, i) => {
        let cls = "h-10 rounded-lg font-bold text-sm transition-all ";
        if (state.answers[i]) cls += "bg-bear-500 text-white";
        else cls += "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
        if (state.flagged[i]) cls = "bg-amber-400 text-amber-900 font-bold";
        if (i === state.currentIndex) cls += " ring-4 ring-amber-300 ring-offset-1";

        return `<button onclick="state.currentIndex=${i}; renderQuiz()" class="${cls}">${i+1}</button>`;
    }).join('');
    document.getElementById('q-grid').innerHTML = html;
}

// 4. KẾT QUẢ & LỊCH SỬ
function submitQuiz() {
    clearInterval(state.timerInt);
    let correct = 0;
    state.quizData.forEach((q, i) => { if(state.answers[i] === q.c) correct++; });
    
    const total = state.quizData.length;
    const score = ((correct/total)*10).toFixed(1);
    
    document.getElementById('r-score').innerText = score;
    document.getElementById('r-correct').innerText = correct;
    document.getElementById('r-wrong').innerText = total - correct;
    document.getElementById('r-acc').innerText = Math.round((correct/total)*100) + "%";

    // Lưu
    state.history.unshift({
        date: new Date().toLocaleDateString('vi-VN'),
        sub: SUBJECTS.find(s => s.id === state.currentSubject).name,
        score: score,
        mode: state.mode === 'practice' ? 'Luyện tập' : 'Kiểm tra'
    });
    localStorage.setItem('gau_history', JSON.stringify(state.history));
    renderHistory();

    navigateTo('result');
}

function viewReview() {
    const html = state.quizData.map((q, i) => {
        const uA = state.answers[i];
        const isC = uA === q.c;
        
        // Tự động lọc bỏ chữ "Câu XX: " có sẵn trong data.js để không bị lặp khi xem lại
        const cleanQuestionText = q.q.replace(/^Câu\s+\d+:\s*/i, '');

        return `
        <div class="p-6 rounded-2xl border ${isC ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10' : 'border-rose-300 bg-rose-50 dark:bg-rose-900/10'} mb-4">
            <h4 class="font-bold mb-3">Câu ${i+1}: ${cleanQuestionText}</h4>
            <div class="space-y-2 text-sm">
                ${Object.entries(q.o).map(([k,v]) => {
                    let st = "";
                    if (k === q.c) st = "font-bold text-emerald-600 dark:text-emerald-400";
                    else if (k === uA && !isC) st = "font-bold text-rose-600 dark:text-rose-400 line-through";
                    return `<p class="${st}">${k}. ${v}</p>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
    document.getElementById('review-list').innerHTML = html;
    navigateTo('review');
}

function practiceWrong() {
    const wrong = state.quizData.filter((q, i) => state.answers[i] !== q.c);
    if(wrong.length === 0) return alert("Tuyệt vời! Bạn không sai câu nào 🐻");
    
    state.quizData = wrong;
    state.answers = {};
    state.flagged = {};
    state.currentIndex = 0;
    state.mode = 'practice';
    selectMode('practice');
    renderQuiz();
    navigateTo('quiz');
}

function renderHistory() {
    if(state.history.length === 0) {
        document.getElementById('history-body').innerHTML = `<tr><td colspan="4" class="p-4 text-center">Chưa có dữ liệu</td></tr>`;
        return;
    }
    document.getElementById('history-body').innerHTML = state.history.map(h => `
        <tr>
            <td class="p-3 text-sm">${h.date}</td>
            <td class="p-3 text-sm font-bold text-bear-600 dark:text-amber-500">${h.sub}</td>
            <td class="p-3 font-bold text-sky-500">${h.score}</td>
            <td class="p-3 text-xs"><span class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">${h.mode}</span></td>
        </tr>
    `).join('');
}

// Khởi tạo mặc định
selectMode('practice');