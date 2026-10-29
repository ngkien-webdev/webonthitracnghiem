// script.js - Hệ thống logic luyện thi trắc nghiệm & Trang con Tiếng Anh 4 Kỹ Năng cho Nhà Gấu

// ==================== STATE MANAGEMENT ====================
let state = {
    currentSubject: null,
    sections: [],
    selectedSections: [],
    availableCount: 0,
    requestedCount: 10,
    mode: 'practice', // 'practice' | 'exam'
    time: 15, // phút
    quizData: [],
    answers: {},
    flagged: {},
    currentIndex: 0,
    timerInt: null,
    timeRem: 0,
    soundEnabled: localStorage.getItem('gau_sound') !== 'false',
    history: JSON.parse(localStorage.getItem('gau_history')) || [],
    reviewFilter: 'all', // 'all' | 'wrong' | 'correct'
    searchQuery: '',
    englishTab: 'listening',
    listeningIndex: 0,
    matchingSelected: { col: null, id: null },
    matchedPairs: new Set()
};

// ==================== DAILY MOTIVATIONAL QUOTES ====================
const BEAR_QUOTES = [
    '"Uống một ngụm nước ấm rồi cùng Gấu làm vài câu trắc nghiệm nhé! ☕"',
    '"Mỗi ngày một chút, kiến thức sẽ đầy dần. Cố lên bạn nhé! 🍯"',
    '"Học tập vui vẻ, thi cử nhẹ nhàng cùng Nhà Gấu 🐻"',
    '"Đường dài vạn dặm bắt đầu từ một bước chân. Bắt đầu ngay thôi! 🐾"',
    '"Tập trung một chút thôi, bạn đang làm rất tốt rồi đó! ✨"',
    '"Đừng nản lòng khi gặp câu hỏi khó, Gấu luôn đồng hành cùng bạn! 🌿"',
    '"Kiên trì thêm một chút nữa, bạn sẽ gặt hái kết quả xứng đáng! 🌟"'
];

function initBearQuote() {
    const el = document.getElementById('bear-quote');
    if (!el) return;
    const randomIndex = Math.floor(Math.random() * BEAR_QUOTES.length);
    el.innerText = BEAR_QUOTES[randomIndex];
}

// ==================== AUDIO SYNTHESIZER (WEB AUDIO API) ====================
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!state.soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(550, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'correct') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        } else if (type === 'wrong') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(175, now + 0.07);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'fanfare') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0.12, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.25);
            });
        }
    } catch (e) {
        console.warn("Audio error:", e);
    }
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem('gau_sound', state.soundEnabled);
    updateSoundUI();
    if (state.soundEnabled) playSound('click');
}

function updateSoundUI() {
    const icon = document.getElementById('sound-icon');
    if (!icon) return;
    if (state.soundEnabled) {
        icon.className = 'fa-solid fa-volume-high text-base text-honey';
    } else {
        icon.className = 'fa-solid fa-volume-xmark text-base text-subtext';
    }
}

// ==================== ENGLISH SPEECH SYNTHESIS (VOICE) ====================
function speakEnglish(text, rate = 0.88) {
    if (!('speechSynthesis' in window)) {
        alert("Trình duyệt không hỗ trợ phát âm!");
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
}

// ==================== THEME & DARK MODE ====================
function initTheme() {
    const saved = localStorage.getItem('gau_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
    }
    updateThemeIcon();
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light', !isDark);
    localStorage.setItem('gau_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    playSound('click');
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    const isDark = document.documentElement.classList.contains('dark');
    icon.className = isDark ? 'fa-solid fa-sun text-lg text-honey' : 'fa-solid fa-moon text-lg text-honey';
}

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    updateSoundUI();
    initBearQuote();
    renderSubjects();
    renderContinueStudyCard();
    renderRealStats();
    renderHistory();
    attachKeyboardNavigation();
});

// ==================== NAVIGATION ====================
function navigateTo(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ==================== REAL STATISTICS ====================
function renderRealStats() {
    let totalQuestions = 0;
    let activeSubs = 0;

    SUBJECTS.forEach(sub => {
        if (sub.active && QUESTION_BANK[sub.id]) {
            totalQuestions += QUESTION_BANK[sub.id].length;
            activeSubs++;
        }
    });

    const activeEl = document.getElementById('stat-active-sub');
    if (activeEl) activeEl.innerText = `${activeSubs} Môn`;

    const totalEl = document.getElementById('stat-total-q');
    if (totalEl) totalEl.innerText = totalQuestions.toLocaleString();

    const histCountEl = document.getElementById('stat-history-count');
    if (histCountEl) histCountEl.innerText = state.history.length;

    const avgScoreEl = document.getElementById('stat-avg-score');
    if (avgScoreEl) {
        if (state.history.length === 0) {
            avgScoreEl.innerText = '-.-';
        } else {
            const sum = state.history.reduce((acc, cur) => acc + Number(cur.score || 0), 0);
            const avg = (sum / state.history.length).toFixed(1);
            avgScoreEl.innerText = `${avg}/10`;
        }
    }

    const badge = document.getElementById('history-badge-count');
    if (badge) badge.innerText = state.history.length;

    const subCountBadge = document.getElementById('subject-count-badge');
    if (subCountBadge) subCountBadge.innerText = `${activeSubs} môn khả dụng`;
}

// ==================== "TIẾP TỤC ÔN TẬP" CARD ====================
function renderContinueStudyCard() {
    const container = document.getElementById('continue-study-container');
    if (!container) return;

    if (state.history.length === 0) {
        container.classList.add('hidden');
        return;
    }

    const last = state.history[0];
    const sub = SUBJECTS.find(s => s.name === last.sub || s.id === last.subId);
    const subId = sub ? sub.id : 'tieng_anh';
    const subIcon = sub ? sub.icon : '📖';

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="cozy-card rounded-2xl p-4 sm:p-5 border border-honey/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3.5">
                <div class="w-10 h-10 rounded-xl bg-honey/15 text-honey flex items-center justify-center text-xl shrink-0">
                    ${subIcon}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-honey">Tiếp tục ôn tập</span>
                        <span class="text-xs text-subtext">• Lần gần nhất: ${last.date}</span>
                    </div>
                    <h4 class="font-extrabold text-sm sm:text-base text-bear-dark dark:text-[#FAF5F0]">
                        ${last.sub} <span class="text-xs font-semibold text-subtext">(${last.mode} - Đạt ${last.score}đ)</span>
                    </h4>
                </div>
            </div>
            <button onclick="selectSubject('${subId}')" class="self-start sm:self-center px-4 py-2 rounded-xl bg-honey hover:bg-honey-600 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5">
                <span>Ôn tập tiếp</span>
                <i class="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
        </div>
    `;
}

// ==================== 1. CHỌN MÔN HỌC (VIEW HOME) ====================
function renderSubjects() {
    const listEl = document.getElementById('subject-list');
    const emptyEl = document.getElementById('subject-empty-search');
    if (!listEl) return;

    const query = state.searchQuery.trim().toLowerCase();
    const filtered = SUBJECTS.filter(s => {
        if (!query) return true;
        return s.name.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    const pastelBgMap = {
        'cntt_nangcao': { bg: 'bg-pastel-blue dark:bg-[#1e293b]', icon: '💻' },
        'moi_truong_va_con_nguoi': { bg: 'bg-pastel-green dark:bg-[#1e3326]', icon: '🌱' },
        'tu_tuong_ho_chi_minh': { bg: 'bg-pastel-pink dark:bg-[#3b2028]', icon: '🇻🇳' },
        'tieng_anh': { bg: 'bg-pastel-blue dark:bg-[#1f2d3d]', icon: '🇬🇧' }
    };

    const html = filtered.map(sub => {
        const qList = QUESTION_BANK[sub.id] || [];
        const qCount = qList.length;
        const sectionsCount = new Set(qList.map(q => q.s)).size;
        const pastel = pastelBgMap[sub.id] || { bg: 'bg-cream-100 dark:bg-[#2c2018]', icon: sub.icon };

        const isEnglish = sub.id === 'tieng_anh';
        const tagText = isEnglish ? '4 KỸ NĂNG 🇬🇧' : sub.id === 'tu_tuong_ho_chi_minh' ? 'ĐANG MỞ 🇻🇳' : 'ĐANG HỌC';
        const actionText = isEnglish ? 'Khám phá ngay' : 'Ôn ngay';

        return `
        <div onclick="selectSubject('${sub.id}')" 
             class="cozy-card cozy-card-interactive rounded-3xl p-5 sm:p-6 cursor-pointer border border-[#F1E5D5] dark:border-[#3d2d23] flex flex-col justify-between group">
            <div>
                <!-- Top Icon in Pastel Container & Status Tag -->
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-2xl ${pastel.bg} flex items-center justify-center text-2xl shadow-xs transition-transform group-hover:scale-105">
                        ${pastel.icon}
                    </div>
                    <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cream-100 dark:bg-[#34241b] text-bear-dark dark:text-honey border border-[#EADBCC] dark:border-[#4d3628]">
                        ${tagText}
                    </span>
                </div>

                <!-- Title & Description -->
                <h3 class="font-extrabold text-base sm:text-lg text-bear-dark dark:text-[#FAF5F0] group-hover:text-honey transition-colors mb-1.5">
                    ${sub.name}
                </h3>
                <p class="text-xs text-subtext dark:text-[#C5B8A8] leading-relaxed mb-5 line-clamp-2">
                    ${sub.desc}
                </p>
            </div>

            <!-- Footer Meta Info & Interactive Action -->
            <div class="pt-3.5 border-t border-[#F1E5D5] dark:border-[#38271e] flex items-center justify-between">
                <div class="flex items-center gap-2 text-[11px] font-bold text-subtext dark:text-[#A0AEC0]">
                    <span>${sectionsCount} phần</span>
                    <span>•</span>
                    <span>${qCount} câu</span>
                </div>
                <span class="text-xs font-extrabold text-honey group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    <span>${actionText}</span>
                    <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </span>
            </div>
        </div>`;
    }).join('');

    listEl.innerHTML = html;
}

// Search handlers
function handleSubjectSearch(val) {
    state.searchQuery = val;
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
        if (val.trim()) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    renderSubjects();
}

function clearSubjectSearch() {
    const input = document.getElementById('subject-search-input');
    if (input) input.value = '';
    state.searchQuery = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderSubjects();
}

// ==================== DEDICATED ENGLISH 4 SKILLS SUB-PAGE ====================
function openEnglishApp() {
    playSound('click');
    state.currentSubject = 'tieng_anh';
    navigateTo('english');
    switchEnglishTab('listening');
    initEnglishListening();
    initEnglishSpeaking();
    initEnglishReading();
    initEnglishWriting();
}

function switchEnglishTab(tabId) {
    playSound('click');
    state.englishTab = tabId;

    // Update Tab Buttons
    document.querySelectorAll('.en-tab-btn').forEach(btn => {
        btn.className = "en-tab-btn px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 shrink-0 transition-all text-subtext hover:bg-cream-100 dark:hover:bg-[#2c2018]";
    });
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.className = "en-tab-btn px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 shrink-0 transition-all bg-honey text-white shadow-xs";
    }

    // Update Tab Contents
    document.querySelectorAll('.en-tab-content').forEach(c => c.classList.add('hidden'));
    const targetContent = document.getElementById(`en-tab-${tabId}`);
    if (targetContent) targetContent.classList.remove('hidden');
}

function startEnglishQuizFromTab() {
    selectSubject('tieng_anh', true);
}

// --- 1. LISTENING SKILL LOGIC ---
const LISTENING_DATA = [
    {
        word: "dandelion",
        hint: "Hoa bồ công anh màu vàng với cánh hoa xòe (trang 12, 13)",
        options: [
            { text: "dandelion", icon: "🌼", label: "Dandelion (Hoa bồ công anh)" },
            { text: "jasmine", icon: "🌸", label: "Jasmine (Hoa nhài)" },
            { text: "ivy", icon: "🌿", label: "Ivy (Cây thường xuân)" },
            { text: "chestnut", icon: "🌰", label: "Chestnut (Hạt dẻ)" }
        ],
        correct: "dandelion"
    },
    {
        word: "stopwatch",
        hint: "Đồng hồ bấm giờ chính xác dùng trong thể thao (trang 10, 20)",
        options: [
            { text: "stopwatch", icon: "⏱️", label: "Stopwatch (Đồng hồ bấm giờ)" },
            { text: "calculator", icon: "🧮", label: "Calculator (Máy tính bỏ túi)" },
            { text: "thermometer", icon: "🌡️", label: "Thermometer (Nhiệt kế)" },
            { text: "compass", icon: "🧭", label: "Compass (La bàn)" }
        ],
        correct: "stopwatch"
    },
    {
        word: "beehive",
        hint: "Tổ ong nơi đàn ong sinh sống và làm mật (trang 11, 12)",
        options: [
            { text: "beehive", icon: "🐝", label: "Beehive (Tổ ong)" },
            { text: "spiderweb", icon: "🕸️", label: "Spiderweb (Mạng nhện)" },
            { text: "birdcage", icon: "🦜", label: "Birdcage (Lồng chim)" },
            { text: "aquarium", icon: "🐠", label: "Aquarium (Bể cá)" }
        ],
        correct: "beehive"
    },
    {
        word: "roller skates",
        hint: "Giày trượt có bánh lăn (trang 10, 13)",
        options: [
            { text: "roller skates", icon: "🛼", label: "Roller skates (Giày trượt patin)" },
            { text: "sneakers", icon: "👟", label: "Sneakers (Giày thể thao)" },
            { text: "boots", icon: "👢", label: "Boots (Ủng cao cổ)" },
            { text: "slippers", icon: "🩴", label: "Slippers (Dép đi trong nhà)" }
        ],
        correct: "roller skates"
    },
    {
        word: "a quarter",
        hint: "Phân số biểu thị 1/4 (trang 17, 18)",
        options: [
            { text: "a half", icon: "🌗", label: "A half (1/2)" },
            { text: "a quarter", icon: "🌘", label: "A quarter (1/4)" },
            { text: "a third", icon: "🥧", label: "A third (1/3)" },
            { text: "an eighth", icon: "🍕", label: "An eighth (1/8)" }
        ],
        correct: "a quarter"
    },
    {
        word: "hexagon",
        hint: "Hình lục giác có 6 cạnh và 6 góc đều (trang 23)",
        options: [
            { text: "hexagon", icon: "⬡", label: "Hexagon (Hình lục giác)" },
            { text: "octagon", icon: "🛑", label: "Octagon (Hình bát giác 8 cạnh)" },
            { text: "crescent", icon: "🌙", label: "Crescent (Hình trăng lưỡi liềm)" },
            { text: "triangle", icon: "🔺", label: "Triangle (Hình tam giác)" }
        ],
        correct: "hexagon"
    }
];

function initEnglishListening() {
    renderListeningQuestion();
    renderLargeNumbersListening();
}

function renderListeningQuestion() {
    const item = LISTENING_DATA[state.listeningIndex];
    document.getElementById('listening-q-indicator').innerText = `Câu ${state.listeningIndex + 1} / ${LISTENING_DATA.length}`;

    const fb = document.getElementById('listening-feedback');
    fb.className = "hidden p-4 rounded-2xl text-xs sm:text-sm font-semibold mb-4";
    fb.innerHTML = "";

    const grid = document.getElementById('listening-options-grid');
    grid.innerHTML = item.options.map(opt => `
        <button onclick="checkListeningAnswer('${opt.text}')" 
                class="en-listen-opt p-4 rounded-2xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] hover:border-honey flex items-center gap-3.5 transition-all text-left">
            <span class="text-2xl">${opt.icon}</span>
            <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-[#FAF5F0]">${opt.label}</span>
        </button>
    `).join('');
}

function playCurrentListeningWord() {
    const item = LISTENING_DATA[state.listeningIndex];
    speakEnglish(item.word, 0.85);
}

function checkListeningAnswer(selectedText) {
    const item = LISTENING_DATA[state.listeningIndex];
    const fb = document.getElementById('listening-feedback');
    fb.classList.remove('hidden');

    if (selectedText === item.correct) {
        playSound('correct');
        fb.className = "p-4 rounded-2xl text-xs sm:text-sm font-bold bg-pastel-green text-emerald-900 border border-emerald-300";
        fb.innerHTML = `🎉 Chính xác! Bạn vừa nghe từ: <b>"${item.word}"</b> - ${item.hint}`;
    } else {
        playSound('wrong');
        fb.className = "p-4 rounded-2xl text-xs sm:text-sm font-bold bg-pastel-pink text-rose-900 border border-rose-300";
        fb.innerHTML = `💡 Chưa đúng rồi! Bấm nghe lại để chú ý âm: <b>"${item.word}"</b>`;
        speakEnglish(item.word, 0.75);
    }
}

function nextListeningQuestion() {
    playSound('click');
    state.listeningIndex = (state.listeningIndex + 1) % LISTENING_DATA.length;
    renderListeningQuestion();
    playCurrentListeningWord();
}

function renderLargeNumbersListening() {
    const container = document.getElementById('listening-numbers-container');
    if (!container) return;

    const data = [
        {
            spoken: "three hundred and thirty thousand, six hundred and seventy-eight",
            correct: "330,678",
            wrong: "313,678",
            hint: "Số 330,678"
        },
        {
            spoken: "six million, five hundred and twenty thousand",
            correct: "6,520,000",
            wrong: "6,052,000",
            hint: "Số 6,520,000"
        },
        {
            spoken: "seventy-six percent",
            correct: "76%",
            wrong: "67%",
            hint: "76 phần trăm"
        },
        {
            spoken: "zero point six",
            correct: "0.6",
            wrong: "0.06",
            hint: "Không phẩy sáu"
        }
    ];

    container.innerHTML = data.map((item, idx) => `
        <div class="p-4 rounded-2xl bg-cream-100 dark:bg-[#201611] border border-[#F1E5D5] dark:border-[#38271e]">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-bear-dark dark:text-honey">Bài ${idx + 1}: ${item.hint}</span>
                <button onclick="speakEnglish('${item.spoken}')" class="px-2.5 py-1 rounded-lg bg-honey text-white text-xs font-bold hover:bg-honey-600 flex items-center gap-1">
                    <i class="fa-solid fa-volume-high"></i> Nghe
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="checkNumberListen(this, '${item.correct}', '${item.correct}')" class="p-2.5 rounded-xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] font-extrabold text-xs sm:text-sm text-center hover:border-honey transition-all">
                    ${item.correct}
                </button>
                <button onclick="checkNumberListen(this, '${item.wrong}', '${item.correct}')" class="p-2.5 rounded-xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] font-extrabold text-xs sm:text-sm text-center hover:border-honey transition-all">
                    ${item.wrong}
                </button>
            </div>
        </div>
    `).join('');
}

function checkNumberListen(btn, choice, correct) {
    if (choice === correct) {
        playSound('correct');
        btn.className = "p-2.5 rounded-xl border-2 border-emerald-500 bg-pastel-green text-emerald-900 font-extrabold text-xs sm:text-sm text-center";
    } else {
        playSound('wrong');
        btn.className = "p-2.5 rounded-xl border-2 border-rose-500 bg-pastel-pink text-rose-900 font-extrabold text-xs sm:text-sm text-center";
    }
}

// --- 2. SPEAKING SKILL LOGIC ---
const SPEAKING_VOCAB = [
    { word: "dandelion", ipa: "/ˈdændɪlaɪən/", vn: "Hoa bồ công anh", icon: "🌼" },
    { word: "beehive", ipa: "/ˈbiːhaɪv/", vn: "Tổ ong", icon: "🐝" },
    { word: "hexagon", ipa: "/ˈheksəɡən/", vn: "Hình lục giác", icon: "⬡" },
    { word: "stopwatch", ipa: "/ˈstɒpwɒtʃ/", vn: "Đồng hồ bấm giờ", icon: "⏱️" },
    { word: "fortnight", ipa: "/ˈfɔːtnaɪt/", vn: "Hai tuần lễ (14 ngày)", icon: "🗓️" },
    { word: "crescent", ipa: "/ˈkresnt/", vn: "Hình trăng khuyết", icon: "🌙" },
    { word: "biscuit", ipa: "/ˈbɪskɪt/", vn: "Bánh quy giòn", icon: "🍪" },
    { word: "shuttlecock", ipa: "/ˈʃʌtlkɒk/", vn: "Quả cầu lông", icon: "🏸" },
    { word: "frequency", ipa: "/ˈfriːkwənsi/", vn: "Tần suất lặp lại", icon: "📊" }
];

function initEnglishSpeaking() {
    const grid = document.getElementById('speaking-cards-grid');
    if (!grid) return;

    grid.innerHTML = SPEAKING_VOCAB.map((item, idx) => `
        <div class="cozy-card p-4 rounded-2xl border border-[#F1E5D5] dark:border-[#3d2d23] flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-2xl">${item.icon}</span>
                    <span class="text-[10px] font-mono text-subtext bg-cream-100 dark:bg-[#34241b] px-2 py-0.5 rounded-full">${item.ipa}</span>
                </div>
                <h4 class="font-extrabold text-base text-bear-dark dark:text-[#FAF5F0] mb-0.5">${item.word}</h4>
                <p class="text-xs text-subtext mb-4">${item.vn}</p>
            </div>
            
            <div class="flex items-center gap-2 pt-3 border-t border-[#F1E5D5] dark:border-[#38271e]">
                <button onclick="speakEnglish('${item.word}')" class="flex-1 py-1.5 rounded-xl bg-cream-100 dark:bg-[#2c2018] hover:bg-cream-300 text-bear-dark dark:text-honey text-xs font-bold transition-all flex items-center justify-center gap-1.5" title="Nghe phát âm chuẩn">
                    <i class="fa-solid fa-volume-high text-xs"></i>
                    <span>Nghe</span>
                </button>
                <button onclick="practiceSpeakingVoice('${item.word}', ${idx})" id="spk-btn-${idx}" class="flex-1 py-1.5 rounded-xl bg-honey hover:bg-honey-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs" title="Luyện nói">
                    <i class="fa-solid fa-microphone text-xs"></i>
                    <span>Luyện nói</span>
                </button>
            </div>
        </div>
    `).join('');
}

function practiceSpeakingVoice(word, idx) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById(`spk-btn-${idx}`);

    if (!SpeechRecognition) {
        speakEnglish(word, 0.7);
        alert(`Bạn hãy lắng nghe và đọc to từ: "${word}" nhé! 🐻`);
        return;
    }

    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        if (btn) {
            btn.className = "flex-1 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold animate-pulse flex items-center justify-center gap-1.5";
            btn.innerHTML = `<i class="fa-solid fa-circle text-[8px]"></i> <span>Đang nghe...</span>`;
        }

        recognition.onresult = (event) => {
            const spoken = event.results[0][0].transcript.trim().toLowerCase();
            const target = word.toLowerCase();

            if (btn) {
                btn.className = "flex-1 py-1.5 rounded-xl bg-honey hover:bg-honey-600 text-white text-xs font-bold flex items-center justify-center gap-1.5";
                btn.innerHTML = `<i class="fa-solid fa-microphone text-xs"></i> <span>Luyện nói</span>`;
            }

            if (spoken.includes(target) || target.includes(spoken)) {
                playSound('correct');
                alert(`🌟 Tuyệt vời! Bạn phát âm từ "${word}" rất chuẩn!`);
            } else {
                playSound('wrong');
                alert(`Bạn nói là "${spoken}". Hãy nghe lại và thử lại từ "${word}" nhé! 🐻`);
                speakEnglish(word, 0.75);
            }
        };

        recognition.onerror = () => {
            if (btn) {
                btn.className = "flex-1 py-1.5 rounded-xl bg-honey hover:bg-honey-600 text-white text-xs font-bold flex items-center justify-center gap-1.5";
                btn.innerHTML = `<i class="fa-solid fa-microphone text-xs"></i> <span>Luyện nói</span>`;
            }
            speakEnglish(word, 0.75);
        };

        recognition.start();
    } catch (e) {
        speakEnglish(word, 0.75);
    }
}

// --- 3. READING & MIND MAP LOGIC ---
function initEnglishReading() {
    renderMindMap();
    renderReadingQuestions();
}

function renderMindMap() {
    const container = document.getElementById('mindmap-container');
    if (!container) return;

    const sections = [
        {
            title: "1. Numbers & Math Words",
            badge: "Theme 1",
            bg: "border-blue-200 dark:border-blue-900 bg-pastel-blue/20 dark:bg-[#1a2530]",
            items: [
                { en: "first, second, third", vn: "thứ 1, thứ 2, thứ 3 (ordinal)" },
                { en: "a half, a third, a quarter", vn: "1/2, 1/3, 1/4 (fractions)" },
                { en: "seventy-six percent", vn: "76% (percentages)" },
                { en: "zero point six", vn: "0.6 (decimals)" }
            ]
        },
        {
            title: "2. Time, Days & Frequency",
            badge: "Theme 1",
            bg: "border-amber-200 dark:border-amber-900 bg-pastel-yellow/30 dark:bg-[#2d281a]",
            items: [
                { en: "sunrise, daytime, sunset", vn: "bình minh, ban ngày, hoàng hôn" },
                { en: "fortnight", vn: "khoảng thời gian 2 tuần lễ" },
                { en: "always, usually, often", vn: "luôn luôn, thường xuyên" },
                { en: "sometimes, rarely, never", vn: "thỉnh thoảng, hiếm khi, không bao giờ" }
            ]
        },
        {
            title: "3. Shapes & Geometric Figures",
            badge: "Theme 1",
            bg: "border-emerald-200 dark:border-emerald-900 bg-pastel-green/20 dark:bg-[#16291e]",
            items: [
                { en: "triangle, square, rectangle", vn: "tam giác, hình vuông, chữ nhật" },
                { en: "crescent, cross, heart", vn: "hình trăng khuyết, chữ thập, trái tim" },
                { en: "hexagon, octagon", vn: "lục giác (6 cạnh), bát giác (8 cạnh)" },
                { en: "cube, cylinder", vn: "khối lập phương, khối trụ tròn" }
            ]
        },
        {
            title: "4. Daily Objects & Food",
            badge: "Theme 2",
            bg: "border-rose-200 dark:border-rose-900 bg-pastel-pink/20 dark:bg-[#2d1b22]",
            items: [
                { en: "biscuit, bread, muffin", vn: "bánh quy, bánh mì, bánh nướng xốp" },
                { en: "stopwatch, roller skates", vn: "đồng hồ bấm giờ, giày trượt patin" },
                { en: "dandelion, sakura", vn: "hoa bồ công anh, hoa anh đào" },
                { en: "beehive, spiderweb", vn: "tổ ong, mạng nhện" }
            ]
        }
    ];

    container.innerHTML = sections.map(sec => `
        <div class="p-5 rounded-2xl border ${sec.bg}">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-extrabold text-sm text-bear-dark dark:text-honey">${sec.title}</h4>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30 text-subtext">${sec.badge}</span>
            </div>
            <div class="space-y-2">
                ${sec.items.map(it => `
                    <div onclick="speakEnglish('${it.en}')" class="p-2 rounded-xl bg-white/80 dark:bg-[#251b15]/80 hover:bg-white cursor-pointer flex items-center justify-between transition-colors shadow-2xs">
                        <span class="text-xs font-extrabold text-bear-dark dark:text-[#FAF5F0]">${it.en}</span>
                        <span class="text-[11px] text-subtext dark:text-[#A0AEC0]">${it.vn}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderReadingQuestions() {
    const container = document.getElementById('reading-questions-container');
    if (!container) return;

    const questions = [
        {
            q: "1. What does Little Bear eat on Sunday morning?",
            options: ["A full pizza", "A half of a fresh biscuit", "Two apples"],
            correct: 1
        },
        {
            q: "2. What does Little Bear do in the park at two thirty in the afternoon?",
            options: ["He rides a bicycle", "He glides with his roller skates", "He swims in the pond"],
            correct: 1
        },
        {
            q: "3. When does Little Bear read his favorite English book?",
            options: ["At nighttime, after sunset", "At sunrise", "At noon"],
            correct: 0
        }
    ];

    container.innerHTML = questions.map((item, qIdx) => `
        <div class="p-4 rounded-2xl bg-cream-100 dark:bg-[#201611] border border-[#F1E5D5] dark:border-[#38271e]">
            <p class="text-xs sm:text-sm font-bold text-bear-dark dark:text-[#FAF5F0] mb-2.5">${item.q}</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                ${item.options.map((opt, oIdx) => `
                    <button onclick="checkReadingAnswer(this, ${qIdx}, ${oIdx}, ${item.correct})" 
                            class="p-2.5 rounded-xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] text-xs font-bold text-subtext dark:text-[#FAF5F0] hover:border-honey transition-all">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function checkReadingAnswer(btn, qIdx, oIdx, correctIdx) {
    if (oIdx === correctIdx) {
        playSound('correct');
        btn.className = "p-2.5 rounded-xl border-2 border-emerald-500 bg-pastel-green text-emerald-900 font-extrabold text-xs";
    } else {
        playSound('wrong');
        btn.className = "p-2.5 rounded-xl border-2 border-rose-500 bg-pastel-pink text-rose-900 font-extrabold text-xs";
    }
}

// --- 4. WRITING SKILL LOGIC ---
const MISSING_DATA = [
    { word: "CAR", display: ["C", "_", "R"], missing: ["A"], vn: "Ô tô (trang 10)" },
    { word: "ARROW", display: ["_", "R", "R", "_", "W"], missing: ["A", "O"], vn: "Mũi tên (trang 10)" },
    { word: "STOPWATCH", display: ["S", "T", "_", "P", "W", "_", "T", "C", "H"], missing: ["O", "A"], vn: "Đồng hồ bấm giờ" },
    { word: "HEXAGON", display: ["H", "_", "X", "_", "G", "_", "N"], missing: ["E", "A", "O"], vn: "Hình lục giác (trang 23)" },
    { word: "BISCUIT", display: ["B", "_", "S", "C", "_", "_", "T"], missing: ["I", "U", "I"], vn: "Bánh quy giòn (trang 8)" },
    { word: "BASEBALL", display: ["B", "_", "S", "_", "B", "A", "L", "L"], missing: ["A", "E"], vn: "Môn bóng chày (trang 10)" }
];

function initEnglishWriting() {
    renderMissingLetters();
    renderMatchingGame();
}

function renderMissingLetters() {
    const grid = document.getElementById('missing-letters-grid');
    if (!grid) return;

    grid.innerHTML = MISSING_DATA.map((item, itemIdx) => {
        let holeIdx = 0;
        const boxes = item.display.map(char => {
            if (char === '_') {
                const currentHole = holeIdx++;
                return `<input type="text" maxlength="1" data-item="${itemIdx}" data-hole="${currentHole}" class="missing-letter-input font-bold" oninput="handleMissingInput(this, ${itemIdx}, ${currentHole})">`;
            } else {
                return `<span class="w-7 h-10 flex items-center justify-center font-extrabold text-base text-bear-dark dark:text-[#FAF5F0]">${char}</span>`;
            }
        }).join('');

        return `
        <div class="cozy-card p-4 rounded-2xl border border-[#F1E5D5] dark:border-[#3d2d23] text-center">
            <span class="text-xs font-bold text-subtext mb-2 block">${item.vn}</span>
            <div class="flex items-center justify-center gap-1.5 mb-2">
                ${boxes}
            </div>
            <button onclick="speakEnglish('${item.word}')" class="text-[11px] font-bold text-honey hover:underline">
                <i class="fa-solid fa-volume-high"></i> Nghe từ này
            </button>
        </div>`;
    }).join('');
}

function handleMissingInput(input, itemIdx, holeIdx) {
    input.value = input.value.toUpperCase();
    if (input.value) {
        // focus next input
        const next = document.querySelector(`input[data-item="${itemIdx}"][data-hole="${holeIdx + 1}"]`);
        if (next) next.focus();
    }
}

function checkMissingLetters() {
    let totalHoles = 0;
    let correctHoles = 0;

    MISSING_DATA.forEach((item, itemIdx) => {
        item.missing.forEach((expectedChar, holeIdx) => {
            totalHoles++;
            const input = document.querySelector(`input[data-item="${itemIdx}"][data-hole="${holeIdx}"]`);
            if (input) {
                if (input.value.trim().toUpperCase() === expectedChar) {
                    correctHoles++;
                    input.className = "missing-letter-input correct";
                } else {
                    input.className = "missing-letter-input wrong";
                }
            }
        });
    });

    const scoreEl = document.getElementById('missing-letters-score');
    if (correctHoles === totalHoles) {
        playSound('correct');
        scoreEl.innerHTML = `<span class="text-emerald-600 font-extrabold">🎉 Tuyệt vời! Bạn đúng cả ${correctHoles}/${totalHoles} chữ cái!</span>`;
    } else {
        playSound('wrong');
        scoreEl.innerHTML = `<span class="text-rose-500 font-bold">Bạn làm đúng ${correctHoles}/${totalHoles} chữ cái. Hãy sửa lại các ô màu đỏ nhé!</span>`;
    }
}

function resetMissingLetters() {
    playSound('click');
    document.querySelectorAll('.missing-letter-input').forEach(input => {
        input.value = '';
        input.className = "missing-letter-input font-bold";
    });
    document.getElementById('missing-letters-score').innerText = "Chưa kiểm tra";
}

// Matching Game Logic
const MATCHING_PAIRS = [
    { id: 1, en: "bread", icon: "🍞", vn: "Bánh mì lát thơm phức" },
    { id: 2, en: "biscuit", icon: "🍪", vn: "Bánh quy nướng giòn" },
    { id: 3, en: "muffin", icon: "🧁", vn: "Bánh bông lan nướng xốp nhỏ" },
    { id: 4, en: "beehive", icon: "🐝", vn: "Tổ ong nơi làm mật ngọt" },
    { id: 5, en: "dandelion", icon: "🌼", vn: "Hoa bồ công anh vàng rực" }
];

function renderMatchingGame() {
    state.matchingSelected = { col: null, id: null };
    state.matchedPairs = new Set();

    const colA = document.getElementById('matching-col-a');
    const colB = document.getElementById('matching-col-b');
    if (!colA || !colB) return;

    // Shuffle Col B
    const shuffledB = [...MATCHING_PAIRS].sort(() => Math.random() - 0.5);

    colA.innerHTML = MATCHING_PAIRS.map(p => `
        <div onclick="handleMatchClick('A', ${p.id}, this)" id="match-a-${p.id}" class="matching-card p-3 rounded-2xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] font-extrabold text-xs sm:text-sm text-bear-dark dark:text-[#FAF5F0] flex items-center justify-between">
            <span class="flex items-center gap-2"><span>${p.icon}</span> <span>${p.en}</span></span>
            <i class="fa-solid fa-volume-high text-xs text-subtext cursor-pointer hover:text-honey" onclick="event.stopPropagation(); speakEnglish('${p.en}')"></i>
        </div>
    `).join('');

    colB.innerHTML = shuffledB.map(p => `
        <div onclick="handleMatchClick('B', ${p.id}, this)" id="match-b-${p.id}" class="matching-card p-3 rounded-2xl border border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] font-semibold text-xs text-subtext dark:text-[#C5B8A8] flex items-center gap-2">
            <span>🐾</span> <span>${p.vn}</span>
        </div>
    `).join('');

    updateMatchingScore();
}

function handleMatchClick(col, id, el) {
    if (state.matchedPairs.has(id)) return;
    playSound('click');

    if (!state.matchingSelected.col) {
        state.matchingSelected = { col, id };
        el.classList.add('selected');
    } else if (state.matchingSelected.col === col) {
        document.querySelectorAll('.matching-card.selected').forEach(c => c.classList.remove('selected'));
        state.matchingSelected = { col, id };
        el.classList.add('selected');
    } else {
        // Checking match
        const firstId = state.matchingSelected.id;
        const secondId = id;

        if (firstId === secondId) {
            playSound('correct');
            state.matchedPairs.add(firstId);

            const cardA = document.getElementById(`match-a-${firstId}`);
            const cardB = document.getElementById(`match-b-${firstId}`);
            if (cardA) { cardA.classList.remove('selected'); cardA.classList.add('matched'); }
            if (cardB) { cardB.classList.remove('selected'); cardB.classList.add('matched'); }

            state.matchingSelected = { col: null, id: null };
            updateMatchingScore();
        } else {
            playSound('wrong');
            document.querySelectorAll('.matching-card.selected').forEach(c => c.classList.remove('selected'));
            state.matchingSelected = { col: null, id: null };
        }
    }
}

function updateMatchingScore() {
    const badge = document.getElementById('matching-score-badge');
    if (badge) {
        badge.innerText = `Đã ghép: ${state.matchedPairs.size} / ${MATCHING_PAIRS.length} cặp`;
        if (state.matchedPairs.size === MATCHING_PAIRS.length) {
            playSound('fanfare');
            badge.innerHTML = `<span class="text-emerald-600 font-extrabold">🎉 Xuất sắc! Hoàn thành nối toàn bộ 5 cặp từ!</span>`;
        }
    }
}

function resetMatchingGame() {
    renderMatchingGame();
}

// ==================== 2. CẤU HÌNH BÀI THI (VIEW CONFIG) ====================
function selectSubject(subId, forceConfig = false) {
    playSound('click');
    state.currentSubject = subId;

    // If English and user didn't explicitly request the quiz config, open English 4-skills sub-page!
    if (subId === 'tieng_anh' && !forceConfig) {
        openEnglishApp();
        return;
    }

    const sub = SUBJECTS.find(s => s.id === subId);
    if (!sub) return;

    // Header info
    document.getElementById('config-subject-icon').innerText = sub.icon;
    document.getElementById('config-subject-title').innerText = sub.name;
    document.getElementById('config-subject-desc').innerText = sub.desc;

    // Unique sections
    const allQ = QUESTION_BANK[subId] || [];
    state.sections = [...new Set(allQ.map(q => q.s))];
    state.selectedSections = [...state.sections]; // Default select all

    renderSectionCheckboxes();
    calcAvailableQuestions();
    selectMode('practice'); // Default practice mode
    navigateTo('config');
}

function renderSectionCheckboxes() {
    const allQ = QUESTION_BANK[state.currentSubject] || [];
    const container = document.getElementById('section-checkboxes');
    if (!container) return;

    const html = state.sections.map(sec => {
        const count = allQ.filter(q => q.s === sec).length;
        const isChecked = state.selectedSections.includes(sec);

        return `
        <label class="p-3 rounded-2xl border ${isChecked ? 'border-honey bg-cream-100 dark:bg-[#34241b]' : 'border-[#F1E5D5] dark:border-[#3d2d23] hover:border-honey/50'} cursor-pointer flex items-center justify-between gap-2.5 transition-all select-none">
            <div class="flex items-center gap-2.5">
                <input type="checkbox" value="${sec}" ${isChecked ? 'checked' : ''} onchange="handleSectionChange()" class="sec-cb w-4 h-4 rounded text-honey accent-honey cursor-pointer">
                <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-[#FAF5F0]">${sec}</span>
            </div>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cream-300 dark:bg-[#201611] text-subtext dark:text-[#A0AEC0]">
                ${count} câu
            </span>
        </label>`;
    }).join('');

    container.innerHTML = html;
}

function toggleAllSections(select) {
    playSound('click');
    if (select) {
        state.selectedSections = [...state.sections];
    } else {
        state.selectedSections = [];
    }
    renderSectionCheckboxes();
    calcAvailableQuestions();
}

function handleSectionChange() {
    playSound('click');
    const cbs = document.querySelectorAll('.sec-cb:checked');
    state.selectedSections = Array.from(cbs).map(cb => cb.value);
    renderSectionCheckboxes();
    calcAvailableQuestions();
}

function calcAvailableQuestions() {
    const allQ = QUESTION_BANK[state.currentSubject] || [];
    const filtered = allQ.filter(q => state.selectedSections.includes(q.s));
    state.availableCount = filtered.length;

    const badge = document.getElementById('config-total-available-badge');
    if (badge) badge.innerText = `${state.availableCount} câu có sẵn`;

    const hint = document.getElementById('max-question-hint');
    if (hint) {
        if (state.availableCount === 0) {
            hint.innerText = "⚠️ Hãy chọn ít nhất 1 phần kiến thức bên trên!";
            hint.className = "text-xs font-bold text-rose-500";
        } else {
            hint.innerText = `Có thể chọn tối đa ${state.availableCount} câu`;
            hint.className = "text-xs font-semibold text-honey";
        }
    }

    if (state.requestedCount > state.availableCount && state.requestedCount !== 'all') {
        state.requestedCount = state.availableCount > 0 ? Math.min(10, state.availableCount) : 0;
    }
    renderCountButtons();
}

function renderCountButtons() {
    const counts = [10, 20, 30, 40, 50, 'all'];
    const container = document.getElementById('question-count-container');
    if (!container) return;

    const html = counts.map(c => {
        const isAll = c === 'all';
        const isDisabled = !isAll && c > state.availableCount;
        const isSelected = state.requestedCount === c || (isAll && state.requestedCount === 'all');

        let cls = "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold border transition-all ";
        if (isDisabled) {
            cls += "opacity-35 cursor-not-allowed bg-cream-100 dark:bg-[#201611] text-subtext border-[#F1E5D5] dark:border-[#38271e]";
        } else if (isSelected) {
            cls += "bg-honey text-white border-honey shadow-xs";
        } else {
            cls += "hover:bg-cream-100 dark:hover:bg-[#2c2018] text-subtext dark:text-[#FAF5F0] border-[#F1E5D5] dark:border-[#3d2d23]";
        }

        return `<button ${isDisabled ? 'disabled' : `onclick="setCount('${c}')"`} class="${cls}">
            ${isAll ? `Tất cả (${state.availableCount})` : `${c} câu`}
        </button>`;
    }).join('');

    container.innerHTML = html;
}

function setCount(c) {
    playSound('click');
    state.requestedCount = c === 'all' ? 'all' : parseInt(c);
    renderCountButtons();
}

function selectMode(m) {
    playSound('click');
    state.mode = m;
    const pEl = document.getElementById('mode-practice');
    const eEl = document.getElementById('mode-exam');
    const timeEl = document.getElementById('time-config');

    if (m === 'practice') {
        pEl.className = "p-4 rounded-2xl border-2 cursor-pointer transition-all border-emerald-500 bg-pastel-green/30 dark:bg-[#1a2f23]";
        eEl.className = "p-4 rounded-2xl border-2 cursor-pointer transition-all border-[#F1E5D5] dark:border-[#3d2d23]";
        timeEl.classList.add('hidden');
    } else {
        pEl.className = "p-4 rounded-2xl border-2 cursor-pointer transition-all border-[#F1E5D5] dark:border-[#3d2d23]";
        eEl.className = "p-4 rounded-2xl border-2 cursor-pointer transition-all border-rose-500 bg-pastel-pink/30 dark:bg-[#341d24]";
        timeEl.classList.remove('hidden');
    }
    setTime(state.time);
}

function setTime(t) {
    playSound('click');
    state.time = t;
    document.querySelectorAll('.btn-time').forEach(btn => {
        if (btn.innerText.includes(t)) {
            btn.className = "btn-time px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-extrabold shadow-xs";
        } else {
            btn.className = "btn-time px-3 py-1.5 rounded-xl border border-[#F1E5D5] dark:border-[#3d2d23] text-subtext dark:text-[#FAF5F0] text-xs font-bold hover:bg-cream-100 dark:hover:bg-[#2c2018]";
        }
    });
}

// ==================== 3. MÀN HÌNH LÀM BÀI (VIEW QUIZ) ====================
function startQuiz() {
    if (state.selectedSections.length === 0) {
        alert("Vui lòng chọn ít nhất 1 phần hoặc chương kiến thức để ôn tập!");
        return;
    }
    if (state.availableCount === 0) {
        alert("Không có câu hỏi nào trong các phần đã chọn!");
        return;
    }

    playSound('click');
    const allQ = QUESTION_BANK[state.currentSubject] || [];
    let pool = allQ.filter(q => state.selectedSections.includes(q.s));

    // Fisher-Yates Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const takeCount = state.requestedCount === 'all' ? pool.length : Math.min(state.requestedCount, pool.length);
    state.quizData = pool.slice(0, takeCount);
    state.answers = {};
    state.flagged = {};
    state.currentIndex = 0;

    const sub = SUBJECTS.find(s => s.id === state.currentSubject);
    document.getElementById('quiz-subject-badge').innerText = sub ? sub.name : 'Trắc nghiệm';

    // Timer setup
    const timerContainer = document.getElementById('quiz-timer');
    if (state.mode === 'exam') {
        state.timeRem = state.time * 60;
        timerContainer.classList.remove('hidden');
        clearInterval(state.timerInt);
        updateTimerDisplay();
        state.timerInt = setInterval(tickTimer, 1000);
    } else {
        timerContainer.classList.add('hidden');
        clearInterval(state.timerInt);
    }

    renderQuiz();
    navigateTo('quiz');
}

function tickTimer() {
    state.timeRem--;
    updateTimerDisplay();

    if (state.timeRem <= 0) {
        clearInterval(state.timerInt);
        alert("⏰ Hết thời gian làm bài! Hệ thống tự động nộp bài thi của bạn.");
        submitQuiz();
    }
}

function updateTimerDisplay() {
    const m = Math.floor(state.timeRem / 60).toString().padStart(2, '0');
    const s = (state.timeRem % 60).toString().padStart(2, '0');
    const timerText = document.getElementById('timer-text');
    if (timerText) timerText.innerText = `${m}:${s}`;
}

function renderQuiz() {
    const total = state.quizData.length;
    const q = state.quizData[state.currentIndex];
    if (!q) return;

    // Counter & Progress Bar
    document.getElementById('quiz-counter').innerText = `Câu ${state.currentIndex + 1} / ${total}`;
    const answeredCount = Object.keys(state.answers).length;
    const pct = Math.round((answeredCount / total) * 100);
    const pBar = document.getElementById('quiz-progress-bar');
    if (pBar) pBar.style.width = `${pct}%`;

    // Section Badge
    document.getElementById('q-section-badge').innerHTML = `<i class="fa-solid fa-bookmark text-[10px]"></i><span>${q.s}</span>`;

    // Clean question prompt
    const cleanPrompt = q.q.replace(/^Câu\s+\d+:\s*/i, '');
    document.getElementById('q-text').innerText = `Câu ${state.currentIndex + 1}: ${cleanPrompt}`;

    // Options Rendering
    const selectedKey = state.answers[state.currentIndex];
    const optsHTML = Object.entries(q.o).map(([k, v]) => {
        const isSelected = selectedKey === k;
        let cardStyle = "border-[#F1E5D5] dark:border-[#3d2d23] bg-white dark:bg-[#251b15] hover:border-honey/60";
        let letterBadge = "bg-cream-100 dark:bg-[#34241b] text-subtext dark:text-[#C5B8A8] border-[#EADBCC] dark:border-[#4d3628]";

        if (state.mode === 'practice' && selectedKey) {
            if (k === q.c) {
                cardStyle = "border-emerald-500 bg-pastel-green/40 dark:bg-[#1a3325] text-emerald-950 dark:text-emerald-100 font-semibold";
                letterBadge = "bg-emerald-600 text-white border-emerald-600 font-bold";
            } else if (isSelected) {
                cardStyle = "border-rose-400 bg-pastel-pink/40 dark:bg-[#3d1e26] text-rose-950 dark:text-rose-100 font-semibold";
                letterBadge = "bg-rose-500 text-white border-rose-500 font-bold";
            }
        } else if (isSelected) {
            cardStyle = "border-honey bg-cream-100 dark:bg-[#34241b] text-bear-dark dark:text-[#FAF5F0] font-semibold";
            letterBadge = "bg-honey text-white border-honey font-bold";
        }

        return `
        <button onclick="ans('${k}')" class="quiz-opt-btn w-full p-3.5 sm:p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${cardStyle} select-none">
            <span class="w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 border mt-0.5 ${letterBadge}">
                ${k}
            </span>
            <span class="text-xs sm:text-sm leading-relaxed flex-1">${v}</span>
            ${state.mode === 'practice' && selectedKey && k === q.c ? '<i class="fa-solid fa-check text-emerald-600 text-base ml-2 shrink-0"></i>' : ''}
            ${state.mode === 'practice' && isSelected && k !== q.c ? '<i class="fa-solid fa-xmark text-rose-500 text-base ml-2 shrink-0"></i>' : ''}
        </button>`;
    }).join('');

    document.getElementById('q-options').innerHTML = optsHTML;

    // Explanation Box (Practice mode)
    const exp = document.getElementById('q-explanation');
    if (state.mode === 'practice' && selectedKey) {
        exp.classList.remove('hidden');
        const isRight = selectedKey === q.c;
        exp.innerHTML = `
            <div class="flex items-start gap-2.5">
                <span class="text-lg shrink-0">${isRight ? '🎉' : '💡'}</span>
                <div>
                    <h5 class="font-bold text-xs sm:text-sm mb-1 ${isRight ? 'text-emerald-700 dark:text-emerald-300' : 'text-bear-dark dark:text-honey'}">
                        ${isRight ? 'Chính xác!' : 'Đáp án chính xác là'} 
                        <span class="underline">Lựa chọn ${q.c}</span>: ${q.o[q.c]}
                    </h5>
                    <p class="text-[11px] text-subtext">Cùng ghi nhớ kiến thức phần <b>${q.s}</b> nhé!</p>
                </div>
            </div>`;
    } else {
        exp.classList.add('hidden');
    }

    // Flag button styling
    const btnFlag = document.getElementById('btn-flag');
    if (state.flagged[state.currentIndex]) {
        btnFlag.className = "px-3 py-1 rounded-xl border border-honey bg-honey text-white font-bold text-xs flex items-center gap-1.5 shadow-xs";
        btnFlag.innerHTML = `<i class="fa-solid fa-star"></i><span>Đã đánh dấu</span>`;
    } else {
        btnFlag.className = "px-3 py-1 rounded-xl border border-[#F1E5D5] dark:border-[#3d2d23] text-subtext font-bold text-xs hover:border-honey hover:text-honey flex items-center gap-1.5 transition-colors";
        btnFlag.innerHTML = `<i class="fa-regular fa-star"></i><span>Đánh dấu</span>`;
    }

    // Prev / Next button
    const btnPrev = document.getElementById('btn-prev-q');
    const btnNext = document.getElementById('btn-next-q');
    btnPrev.disabled = state.currentIndex === 0;
    btnPrev.classList.toggle('opacity-40', state.currentIndex === 0);
    btnPrev.classList.toggle('cursor-not-allowed', state.currentIndex === 0);

    const isLast = state.currentIndex === total - 1;
    btnNext.innerHTML = isLast ? `<span>Nộp bài</span> <i class="fa-solid fa-check"></i>` : `<span class="hidden sm:inline">Câu tiếp</span> <i class="fa-solid fa-arrow-right"></i>`;

    renderGrid();
}

function ans(k) {
    const q = state.quizData[state.currentIndex];
    state.answers[state.currentIndex] = k;

    if (state.mode === 'practice') {
        if (k === q.c) playSound('correct');
        else playSound('wrong');
    } else {
        playSound('click');
    }

    renderQuiz();
}

function navQ(dir) {
    const total = state.quizData.length;
    const n = state.currentIndex + dir;
    if (n >= 0 && n < total) {
        state.currentIndex = n;
        playSound('click');
        renderQuiz();
    } else if (n === total) {
        promptSubmitQuiz();
    }
}

function toggleFlag() {
    playSound('click');
    state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
    renderQuiz();
}

function renderGrid() {
    const total = state.quizData.length;
    const gridEl = document.getElementById('q-grid');
    if (!gridEl) return;

    const answeredCount = Object.keys(state.answers).length;
    document.getElementById('grid-answered-badge').innerText = `${answeredCount}/${total} câu`;

    const html = state.quizData.map((_, i) => {
        const isCurrent = i === state.currentIndex;
        const isAnswered = state.answers[i] !== undefined;
        const isFlagged = state.flagged[i];

        let bg = "bg-cream-100 dark:bg-[#34241b] text-subtext dark:text-[#C5B8A8]";
        if (isAnswered) bg = "bg-honey text-white font-bold";
        if (isFlagged) bg = "bg-pastel-yellow dark:bg-[#3a301a] text-bear-dark font-bold border border-amber-400";
        if (isCurrent) bg += " ring-2 ring-bear dark:ring-honey";

        return `<button onclick="jumpToQ(${i})" class="h-8 rounded-xl font-bold text-xs transition-all ${bg}">
            ${i + 1}
        </button>`;
    }).join('');

    gridEl.innerHTML = html;
}

function jumpToQ(idx) {
    playSound('click');
    state.currentIndex = idx;
    renderQuiz();
}

function toggleMobileDrawer() {
    const panel = document.getElementById('drawer-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            panel.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// ==================== 4. XÁC NHẬN & NỘP BÀI ====================
function promptSubmitQuiz() {
    playSound('click');
    const total = state.quizData.length;
    const answeredCount = Object.keys(state.answers).length;
    const unansweredCount = total - answeredCount;
    const flaggedCount = Object.values(state.flagged).filter(Boolean).length;

    let summaryText = `Bạn đã trả lời <b>${answeredCount}/${total}</b> câu.`;
    if (unansweredCount > 0) {
        summaryText += `<br><span class="text-rose-500 font-bold">⚠️ Bạn còn ${unansweredCount} câu chưa làm!</span>`;
    }
    if (flaggedCount > 0) {
        summaryText += `<br><span class="text-honey">⭐ Có ${flaggedCount} câu đang đánh dấu.</span>`;
    }

    document.getElementById('modal-submit-summary').innerHTML = summaryText;
    document.getElementById('modal-submit').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('modal-submit').classList.add('hidden');
}

function confirmExitQuiz() {
    if (confirm("Bạn muốn rời khỏi bài thi hiện tại? Tiến độ đang làm sẽ bị hủy.")) {
        clearInterval(state.timerInt);
        navigateTo('config');
    }
}

function submitQuiz() {
    closeSubmitModal();
    clearInterval(state.timerInt);

    let correct = 0;
    state.quizData.forEach((q, i) => {
        if (state.answers[i] === q.c) correct++;
    });

    const total = state.quizData.length;
    const score = Number(((correct / total) * 10).toFixed(1));
    const accuracy = Math.round((correct / total) * 100);

    if (score >= 8.0) {
        playSound('fanfare');
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    } else {
        playSound('fanfare');
    }

    document.getElementById('r-score').innerText = score.toFixed(1);
    document.getElementById('r-correct').innerText = correct;
    document.getElementById('r-wrong').innerText = total - correct;
    document.getElementById('r-acc').innerText = `${accuracy}%`;

    const msgEl = document.getElementById('r-message');
    if (score >= 9.0) {
        msgEl.innerText = "🌟 Xuất sắc! Bạn nắm kiến thức cực kỳ vững vàng và tự tin nhé!";
    } else if (score >= 8.0) {
        msgEl.innerText = "🎉 Rất tốt! Bài thi của bạn rất ấn tượng!";
    } else if (score >= 6.5) {
        msgEl.innerText = "👍 Khá tốt! Xem lại chi tiết các câu sai để hoàn thiện nhé!";
    } else if (score >= 5.0) {
        msgEl.innerText = "💪 Đã vượt qua! Hãy bấm 'Luyện lại câu sai' để nắm chắc kiến thức hơn!";
    } else {
        msgEl.innerText = "📚 Cần cố gắng thêm một chút! Cùng Nhà Gấu luyện lại nhé!";
    }

    const btnPW = document.getElementById('btn-practice-wrong');
    btnPW.style.display = (total - correct > 0) ? 'inline-flex' : 'none';

    // Save History
    const subObj = SUBJECTS.find(s => s.id === state.currentSubject);
    state.history.unshift({
        date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sub: subObj ? subObj.name : 'Trắc nghiệm',
        subId: state.currentSubject,
        score: score.toFixed(1),
        mode: state.mode === 'practice' ? 'Luyện tập' : 'Thi thử',
        accuracy: `${accuracy}%`,
        correct: `${correct}/${total}`
    });
    localStorage.setItem('gau_history', JSON.stringify(state.history));
    renderHistory();
    renderRealStats();
    renderContinueStudyCard();

    navigateTo('result');
}

function retryCurrentQuiz() {
    state.answers = {};
    state.flagged = {};
    state.currentIndex = 0;
    if (state.mode === 'exam') {
        state.timeRem = state.time * 60;
        clearInterval(state.timerInt);
        state.timerInt = setInterval(tickTimer, 1000);
    }
    renderQuiz();
    navigateTo('quiz');
}

function practiceWrong() {
    const wrongList = state.quizData.filter((q, i) => state.answers[i] !== q.c);
    if (wrongList.length === 0) {
        alert("Tuyệt vời! Bạn không sai câu nào cả 🐻");
        return;
    }

    state.quizData = wrongList;
    state.answers = {};
    state.flagged = {};
    state.currentIndex = 0;
    state.mode = 'practice';
    selectMode('practice');
    renderQuiz();
    navigateTo('quiz');
}

// ==================== 5. XEM LẠI BÀI LÀM (VIEW REVIEW) ====================
function viewReview() {
    playSound('click');
    filterReview('all');
    navigateTo('review');
}

function filterReview(type) {
    state.reviewFilter = type;
    const btns = {
        'all': document.getElementById('rf-all'),
        'wrong': document.getElementById('rf-wrong'),
        'correct': document.getElementById('rf-correct')
    };

    Object.keys(btns).forEach(k => {
        if (!btns[k]) return;
        if (k === type) {
            btns[k].className = "px-3 py-1 rounded-lg bg-white dark:bg-[#201611] text-slate-900 dark:text-white font-extrabold shadow-xs";
        } else {
            btns[k].className = "px-3 py-1 rounded-lg text-subtext hover:text-bear-dark dark:hover:text-[#FAF5F0] font-bold";
        }
    });

    renderReviewList();
}

function renderReviewList() {
    const container = document.getElementById('review-list');
    if (!container) return;

    let items = state.quizData.map((q, idx) => ({
        q,
        idx,
        userAns: state.answers[idx],
        isCorrect: state.answers[idx] === q.c
    }));

    if (state.reviewFilter === 'wrong') {
        items = items.filter(it => !it.isCorrect);
    } else if (state.reviewFilter === 'correct') {
        items = items.filter(it => it.isCorrect);
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="cozy-card p-6 rounded-2xl text-center text-subtext font-bold">Không có câu hỏi nào trong danh mục này!</div>`;
        return;
    }

    const html = items.map(it => {
        const { q, idx, userAns, isCorrect } = it;
        const cleanPrompt = q.q.replace(/^Câu\s+\d+:\s*/i, '');

        const optsHTML = Object.entries(q.o).map(([k, v]) => {
            let optStyle = "text-subtext dark:text-[#C5B8A8]";
            let badgeStyle = "bg-cream-100 dark:bg-[#34241b] text-subtext border-[#EADBCC] dark:border-[#4d3628]";

            if (k === q.c) {
                optStyle = "text-emerald-700 dark:text-emerald-300 font-bold";
                badgeStyle = "bg-emerald-600 text-white border-emerald-600 font-bold";
            } else if (k === userAns && !isCorrect) {
                optStyle = "text-rose-600 dark:text-rose-400 font-bold line-through";
                badgeStyle = "bg-rose-500 text-white border-rose-500 font-bold";
            }

            return `
            <div class="flex items-center gap-2.5 p-2 rounded-xl border border-transparent ${k === q.c ? 'bg-pastel-green/30 dark:bg-[#1a3325] border-emerald-400/40' : ''}">
                <span class="w-5 h-5 rounded-lg text-xs flex items-center justify-center border shrink-0 ${badgeStyle}">
                    ${k}
                </span>
                <span class="text-xs sm:text-sm ${optStyle}">${v}</span>
                ${k === q.c ? '<i class="fa-solid fa-check text-emerald-600 ml-auto text-xs"></i>' : ''}
                ${k === userAns && !isCorrect ? '<i class="fa-solid fa-xmark text-rose-500 ml-auto text-xs"></i>' : ''}
            </div>`;
        }).join('');

        return `
        <div class="cozy-card p-5 sm:p-6 rounded-3xl border ${isCorrect ? 'border-emerald-300/80 dark:border-emerald-900/60' : 'border-rose-300/80 dark:border-rose-900/60'}">
            <div class="flex items-center justify-between mb-2.5">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isCorrect ? 'bg-pastel-green text-emerald-800' : 'bg-pastel-pink text-rose-800'}">
                    ${isCorrect ? '✅ Trả lời đúng' : '❌ Trả lời sai'} (${q.s})
                </span>
                <span class="text-xs text-subtext">Bạn chọn: <b>${userAns || 'Chưa chọn'}</b></span>
            </div>
            
            <h4 class="font-bold text-sm sm:text-base text-slate-900 dark:text-[#FAF5F0] mb-3">
                Câu ${idx + 1}: ${cleanPrompt}
            </h4>

            <div class="space-y-1 mb-3">
                ${optsHTML}
            </div>

            <div class="p-3 rounded-xl bg-cream-100 dark:bg-[#201611] border border-[#F1E5D5] dark:border-[#38271e] text-xs text-bear-dark dark:text-honey font-medium">
                💡 <b>Đáp án đúng là ${q.c}:</b> ${q.o[q.c]}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

// ==================== 6. LỊCH SỬ LÀM BÀI (VIEW HISTORY) ====================
function renderHistory() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    if (state.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-subtext font-medium">Chưa có bài thi nào được lưu lại. Hãy chọn môn để bắt đầu ôn thi nhé!</td></tr>`;
        return;
    }

    tbody.innerHTML = state.history.map(h => `
        <tr class="hover:bg-cream-100/60 dark:hover:bg-[#2c2018] transition-colors">
            <td class="p-3 sm:p-3.5 text-xs text-subtext dark:text-[#C5B8A8]">${h.date}</td>
            <td class="p-3 sm:p-3.5 text-xs font-bold text-slate-800 dark:text-[#FAF5F0]">${h.sub}</td>
            <td class="p-3 sm:p-3.5 font-extrabold text-xs sm:text-sm ${Number(h.score) >= 8.0 ? 'text-emerald-600 dark:text-emerald-400' : Number(h.score) >= 5.0 ? 'text-honey' : 'text-rose-500'}">
                ${h.score}
            </td>
            <td class="p-3 sm:p-3.5 text-xs">
                <span class="px-2 py-0.5 rounded-lg font-bold text-[10px] ${h.mode === 'Luyện tập' ? 'bg-pastel-green text-emerald-800' : 'bg-pastel-pink text-rose-800'}">
                    ${h.mode}
                </span>
            </td>
        </tr>
    `).join('');
}

function clearHistory() {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử ôn thi không?")) {
        state.history = [];
        localStorage.removeItem('gau_history');
        renderHistory();
        renderRealStats();
        renderContinueStudyCard();
    }
}

// ==================== KEYBOARD NAVIGATION & SHORTCUTS ====================
function attachKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
        const quizView = document.getElementById('view-quiz');
        if (!quizView || quizView.classList.contains('hidden')) return;

        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        const key = e.key.toUpperCase();

        if (['A', 'B', 'C', 'D'].includes(key)) {
            e.preventDefault();
            ans(key);
        } else if (['1', '2', '3', '4'].includes(key)) {
            e.preventDefault();
            const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
            ans(map[key]);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navQ(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navQ(1);
        } else if (key === 'F') {
            e.preventDefault();
            toggleFlag();
        } else if (e.key === 'Escape') {
            closeKeyboardModal();
            closeSubmitModal();
        }
    });
}

function openKeyboardModal() {
    playSound('click');
    document.getElementById('modal-keyboard').classList.remove('hidden');
}

function closeKeyboardModal() {
    document.getElementById('modal-keyboard').classList.add('hidden');
}
