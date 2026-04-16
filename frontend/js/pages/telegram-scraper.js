/**
 * Telegram Scraper Page – Frontend Logic
 * ----------------------------------------
 * Completely independent module. Communicates with
 * /api/telegram-scraper/* endpoints.
 */

// ── Render function (called by the router in main.js) ────────
async function renderTelegramScraperPage() {
    if (!window.appContent) return;
    window.appContent.innerHTML = getTelegramScraperHTML();
    setTimeout(() => initTelegramScraper(), 50);
}

// ── Inline HTML ──────────────────────────────────────────────
function getTelegramScraperHTML() {
    return `
<section class="page-section" id="telegram-scraper-page">
    <!-- Header -->
    <div class="ts-page-header">
        <h1><i class="fas fa-comments"></i> جلب المشاركين من تلجرام</h1>
        <p class="ts-subtitle">ألصق رابط بوست المسابقة من قناة تلجرام وسيتم جلب جميع التعليقات تلقائياً لنسخها إلى صفحة الروليت.</p>
    </div>

    <!-- Steps -->
    <div class="ts-steps" id="ts-steps">
        <div class="ts-step" id="ts-step-1">
            <span class="ts-step-num">1</span>
            <span>تسجيل الدخول</span>
        </div>
        <div class="ts-step" id="ts-step-2">
            <span class="ts-step-num">2</span>
            <span>لصق رابط البوست</span>
        </div>
        <div class="ts-step" id="ts-step-3">
            <span class="ts-step-num">3</span>
            <span>جلب التعليقات</span>
        </div>
        <div class="ts-step" id="ts-step-4">
            <span class="ts-step-num">4</span>
            <span>نسخ الأسماء</span>
        </div>
    </div>

    <!-- Auth Card -->
    <div class="ts-card" id="ts-auth-card">
        <div class="ts-card-header"><i class="fas fa-shield-alt"></i> حالة الاتصال بتلجرام</div>
        <p class="ts-shared-note"><i class="fas fa-users"></i> الاتصال مشترك — بمجرد تسجيل الدخول مرة واحدة، يمكن لجميع الموظفين استخدام الخدمة بدون تسجيل دخول إضافي.</p>
        <div id="ts-auth-status" class="ts-auth-status ts-loading">
            <i class="fas fa-spinner fa-spin"></i> جاري التحقق...
        </div>
        <div id="ts-auth-form-container" style="display:none;">
            <div class="ts-auth-form" id="ts-auth-form">
                <!-- Phone step -->
                <div id="ts-phone-step">
                    <div class="ts-input-group">
                        <label for="ts-phone">رقم الهاتف (مع كود الدولة)</label>
                        <input type="text" id="ts-phone" class="ts-input" placeholder="+201234567890" dir="ltr">
                    </div>
                    <button class="ts-btn ts-btn-primary" id="ts-send-code-btn">
                        <i class="fas fa-paper-plane"></i> إرسال كود التحقق
                    </button>
                </div>
                <!-- OTP step -->
                <div id="ts-otp-step" style="display:none;">
                    <div class="ts-input-group">
                        <label for="ts-otp">كود التحقق (من تلجرام)</label>
                        <input type="text" id="ts-otp" class="ts-input" placeholder="12345" dir="ltr" maxlength="6">
                    </div>
                    <div class="ts-input-group" id="ts-2fa-group" style="display:none;">
                        <label for="ts-2fa">كلمة المرور الثنائية (2FA)</label>
                        <input type="password" id="ts-2fa" class="ts-input" placeholder="كلمة المرور" dir="ltr">
                    </div>
                    <button class="ts-btn ts-btn-success" id="ts-verify-btn">
                        <i class="fas fa-check-circle"></i> تأكيد الكود
                    </button>
                </div>
            </div>
        </div>
        <div id="ts-logout-container" style="display:none; margin-top: 12px;">
            <button class="ts-btn ts-btn-danger ts-btn-sm" id="ts-logout-btn">
                <i class="fas fa-sign-out-alt"></i> قطع الاتصال (للسوبر أدمن فقط)
            </button>
        </div>
    </div>

    <!-- Fetch Card -->
    <div class="ts-card" id="ts-fetch-card" style="display:none;">
        <div class="ts-card-header"><i class="fas fa-link"></i> جلب التعليقات من بوست</div>
        <div class="ts-fetch-row">
            <div class="ts-input-group">
                <label for="ts-post-url">رابط البوست</label>
                <input type="text" id="ts-post-url" class="ts-input" placeholder="https://t.me/channel_name/123" dir="ltr">
            </div>
            <button class="ts-btn ts-btn-primary" id="ts-fetch-btn">
                <i class="fas fa-download"></i> جلب التعليقات
            </button>
        </div>
    </div>

    <!-- Results Card -->
    <div class="ts-card" id="ts-results-card" style="display:none;">
        <div class="ts-card-header"><i class="fas fa-list-ol"></i> النتائج</div>

        <!-- Stats Summary (compact) -->
        <div class="ts-stats-bar" id="ts-stats-bar" style="display:none;">
            <div class="ts-stat-item ts-stat-total"><span class="ts-stat-num" id="ts-stat-total">0</span><span class="ts-stat-label">إجمالي</span></div>
            <div class="ts-stat-item ts-stat-valid"><span class="ts-stat-num" id="ts-stat-valid">0</span><span class="ts-stat-label">صالح</span></div>
            <div class="ts-stat-item ts-stat-dup"><span class="ts-stat-num" id="ts-stat-dup">0</span><span class="ts-stat-label">مكرر</span></div>
            <div class="ts-stat-item ts-stat-prob"><span class="ts-stat-num" id="ts-stat-prob">0</span><span class="ts-stat-label">مشكلة</span></div>
            <div class="ts-stat-item ts-stat-inv"><span class="ts-stat-num" id="ts-stat-inv">0</span><span class="ts-stat-label">تالف</span></div>
        </div>

        <!-- Toolbar: Filter -->
        <div class="ts-toolbar">
            <div class="ts-toolbar-item">
                <i class="fas fa-search ts-toolbar-icon"></i>
                <input type="text" id="ts-filter-input" class="ts-input ts-toolbar-input" placeholder="بحث بالاسم، رقم الحساب، اليوزر..." dir="rtl">
            </div>
        </div>

        <div class="ts-results-header">
            <div class="ts-results-count" id="ts-results-count"></div>
            <div class="ts-results-actions">
                <button class="ts-btn ts-btn-success ts-btn-sm" id="ts-copy-names-btn" title="نسخ الأسماء فقط (جاهزة للروليت)">
                    <i class="fas fa-copy"></i> نسخ الأسماء للروليت
                </button>
                <button class="ts-btn ts-btn-primary ts-btn-sm" id="ts-copy-all-btn" title="نسخ الأسماء مع الإجابات">
                    <i class="fas fa-clipboard-list"></i> نسخ مع الإجابات
                </button>
                <button class="ts-btn ts-btn-secondary ts-btn-sm" id="ts-copy-formatted-btn" title="نسخ بتنسيق مرقم">
                    <i class="fas fa-sort-numeric-down"></i> نسخ مرقم
                </button>
            </div>
        </div>
        <div class="ts-table-wrap">
            <table class="ts-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>الاسم</th>
                        <th>رقم الحساب</th>
                        <th>اليوزر</th>
                        <th>التعليق (الإجابة)</th>
                        <th>التاريخ</th>
                    </tr>
                </thead>
                <tbody id="ts-results-body"></tbody>
            </table>
        </div>
        <div id="ts-empty-state" class="ts-empty" style="display:none;">
            <i class="fas fa-comment-slash"></i>
            <p>لا توجد تعليقات على هذا البوست</p>
        </div>
    </div>

    <!-- Excluded Section -->
    <div class="ts-card ts-excluded-card" id="ts-excluded-card" style="display:none;">
        <div class="ts-card-header ts-excluded-header">
            <i class="fas fa-filter"></i> المستبعدات
            <span class="ts-excluded-badge" id="ts-excluded-total-badge">0</span>
        </div>

        <!-- Part 0: Duplicates -->
        <div class="ts-excluded-section" id="ts-duplicates-section" style="display:none;">
            <div class="ts-excluded-section-header ts-duplicates-header" id="ts-duplicates-toggle">
                <span><i class="fas fa-clone"></i> تعليقات مكررة <small>(تم الاحتفاظ بآخر تعليق)</small></span>
                <span class="ts-excluded-badge ts-badge-dup" id="ts-duplicates-count">0</span>
                <i class="fas fa-chevron-down ts-toggle-icon"></i>
            </div>
            <div class="ts-excluded-body ts-collapsed" id="ts-duplicates-body">
                <table class="ts-table ts-table-dup">
                    <thead><tr><th>#</th><th>الاسم</th><th>رقم الحساب</th><th>اليوزر</th><th>التعليق</th><th>السبب</th></tr></thead>
                    <tbody id="ts-duplicates-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- Part 1: Problematic (has issue) -->
        <div class="ts-excluded-section" id="ts-problems-section" style="display:none;">
            <div class="ts-excluded-section-header ts-problems-header" id="ts-problems-toggle">
                <span><i class="fas fa-exclamation-triangle"></i> فيها مشكلة <small>(ناقص اسم، رقم حساب، أو تعليق معدل)</small></span>
                <span class="ts-excluded-badge ts-badge-warn" id="ts-problems-count">0</span>
                <i class="fas fa-chevron-down ts-toggle-icon"></i>
            </div>
            <div class="ts-excluded-body" id="ts-problems-body">
                <table class="ts-table ts-table-warn">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الاسم</th>
                            <th>رقم الحساب</th>
                            <th>اليوزر</th>
                            <th>التعليق</th>
                            <th>السبب</th>
                        </tr>
                    </thead>
                    <tbody id="ts-problems-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- Part 2: Completely invalid -->
        <div class="ts-excluded-section" id="ts-invalid-section" style="display:none;">
            <div class="ts-excluded-section-header ts-invalid-header" id="ts-invalid-toggle">
                <span><i class="fas fa-trash-alt"></i> تالفة تماماً <small>(بدون أي بيانات مفيدة)</small></span>
                <span class="ts-excluded-badge ts-badge-danger" id="ts-invalid-count">0</span>
                <i class="fas fa-chevron-down ts-toggle-icon"></i>
            </div>
            <div class="ts-excluded-body" id="ts-invalid-body">
                <table class="ts-table ts-table-danger">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>اليوزر</th>
                            <th>التعليق</th>
                            <th>السبب</th>
                        </tr>
                    </thead>
                    <tbody id="ts-invalid-tbody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Copy toast -->
    <div class="ts-copy-toast" id="ts-copy-toast">تم النسخ!</div>
</section>`;
}

// ── Init ─────────────────────────────────────────────────────
function initTelegramScraper() {
    const API = '/api/telegram-scraper';
    let commentsData = [];
    const currentUserRole = (() => {
        try {
            if (window.currentUserProfile?.role) return window.currentUserProfile.role;
            const cachedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            return cachedProfile?.role || null;
        } catch {
            return null;
        }
    })();
    const isSuperAdmin = currentUserRole === 'super_admin';

    // DOM refs
    const authStatus = document.getElementById('ts-auth-status');
    const authFormContainer = document.getElementById('ts-auth-form-container');
    const phoneStep = document.getElementById('ts-phone-step');
    const otpStep = document.getElementById('ts-otp-step');
    const logoutContainer = document.getElementById('ts-logout-container');
    const fetchCard = document.getElementById('ts-fetch-card');
    const resultsCard = document.getElementById('ts-results-card');
    const resultsBody = document.getElementById('ts-results-body');
    const resultsCount = document.getElementById('ts-results-count');
    const emptyState = document.getElementById('ts-empty-state');
    const copyToast = document.getElementById('ts-copy-toast');

    // Step indicators
    const steps = [1, 2, 3, 4].map(n => document.getElementById(`ts-step-${n}`));

    function setStep(active) {
        steps.forEach((el, i) => {
            el.classList.remove('ts-active', 'ts-done');
            if (i + 1 < active) el.classList.add('ts-done');
            if (i + 1 === active) el.classList.add('ts-active');
        });
    }

    // ── Check auth status ──────────────────────────────────
    async function checkStatus() {
        try {
            const res = await window.authedFetch(`${API}/status`);
            const data = await res.json();
            if (data.authenticated) {
                showConnected(data.user);
            } else {
                showDisconnected();
            }
        } catch {
            showDisconnected();
        }
    }

    function showConnected(user) {
        const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
        const phone = user?.phone ? `+${user.phone}` : '';
        const accessNote = isSuperAdmin
            ? ' — يمكنك إدارة اتصال تيليجرام لهذا النظام'
            : ' — يمكنك استخدام الجلسة الحالية فقط';
        authStatus.className = 'ts-auth-status ts-connected';
        authStatus.innerHTML = `<i class="fas fa-check-circle"></i> متصل بتلجرام${name ? ` عبر حساب ${name}` : ''}${phone ? ` (${phone})` : ''}${accessNote}`;
        authFormContainer.style.display = 'none';
        logoutContainer.style.display = isSuperAdmin ? 'block' : 'none';
        fetchCard.style.display = 'block';
        setStep(2);
    }

    function showDisconnected() {
        authStatus.className = 'ts-auth-status ts-disconnected';
        if (!isSuperAdmin) {
            authStatus.innerHTML = '<i class="fas fa-times-circle"></i> غير متصل — تسجيل الدخول متاح للسوبر أدمن فقط';
            authFormContainer.style.display = 'none';
            phoneStep.style.display = 'none';
            otpStep.style.display = 'none';
            logoutContainer.style.display = 'none';
            fetchCard.style.display = 'none';
            resultsCard.style.display = 'none';
            setStep(1);
            return;
        }

        authStatus.innerHTML = '<i class="fas fa-times-circle"></i> غير متصل — يجب تسجيل الدخول مرة واحدة فقط وسيعمل لجميع الموظفين';
        authFormContainer.style.display = 'block';
        phoneStep.style.display = 'block';
        otpStep.style.display = 'none';
        logoutContainer.style.display = 'none';
        fetchCard.style.display = 'none';
        resultsCard.style.display = 'none';
        setStep(1);
    }

    // ── Send Code ──────────────────────────────────────────
    document.getElementById('ts-send-code-btn').addEventListener('click', async () => {
        if (!isSuperAdmin) return showToastMsg('تسجيل الدخول متاح للسوبر أدمن فقط', true);

        const phone = document.getElementById('ts-phone').value.trim();
        if (!phone) return showToastMsg('أدخل رقم الهاتف', true);

        const btn = document.getElementById('ts-send-code-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="ts-spinner"></span> جاري الإرسال...';

        try {
            const res = await window.authedFetch(`${API}/auth/send-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) {
                phoneStep.style.display = 'none';
                otpStep.style.display = 'block';
                showToastMsg('تم إرسال كود التحقق إلى تلجرام');
            } else {
                showToastMsg(data.error || data.message || 'خطأ في الإرسال', true);
            }
        } catch (err) {
            showToastMsg('خطأ: ' + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال كود التحقق';
        }
    });

    // ── Verify Code ────────────────────────────────────────
    document.getElementById('ts-verify-btn').addEventListener('click', async () => {
        if (!isSuperAdmin) return showToastMsg('تسجيل الدخول متاح للسوبر أدمن فقط', true);

        const code = document.getElementById('ts-otp').value.trim();
        const password = document.getElementById('ts-2fa').value.trim();
        if (!code) return showToastMsg('أدخل كود التحقق', true);

        const btn = document.getElementById('ts-verify-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="ts-spinner"></span> جاري التحقق...';

        try {
            const res = await window.authedFetch(`${API}/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, password: password || undefined })
            });
            const data = await res.json();
            if (data.needs2FA) {
                document.getElementById('ts-2fa-group').style.display = 'block';
                showToastMsg('أدخل كلمة المرور الثنائية');
            } else if (data.success) {
                showToastMsg('تم تسجيل الدخول بنجاح! ✓');
                checkStatus();
            } else {
                showToastMsg(data.error || data.message || 'خطأ في التحقق', true);
            }
        } catch (err) {
            showToastMsg('خطأ: ' + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الكود';
        }
    });

    // ── Logout ─────────────────────────────────────────────
    document.getElementById('ts-logout-btn').addEventListener('click', async () => {
        if (!isSuperAdmin) return showToastMsg('قطع الاتصال متاح للسوبر أدمن فقط', true);

        if (!confirm('⚠️ تحذير: قطع الاتصال سيؤثر على جميع الموظفين!\nسيحتاج أحد المسؤولين لإعادة تسجيل الدخول. هل أنت متأكد؟')) return;
        try {
            const res = await window.authedFetch(`${API}/auth/logout`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.message || 'تعذر تسجيل الخروج');
            }
            showToastMsg('تم تسجيل الخروج');
            showDisconnected();
        } catch (err) {
            showToastMsg('خطأ: ' + err.message, true);
        }
    });

    // ── Fetch Comments ─────────────────────────────────────
    document.getElementById('ts-fetch-btn').addEventListener('click', async () => {
        const postUrl = document.getElementById('ts-post-url').value.trim();
        if (!postUrl) return showToastMsg('ألصق رابط البوست', true);

        const btn = document.getElementById('ts-fetch-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="ts-spinner"></span> جاري الجلب...';
        setStep(3);

        try {
            const res = await window.authedFetch(`${API}/fetch-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postUrl })
            });
            const data = await res.json();

            if (data.error) {
                showToastMsg(data.error, true);
                return;
            }

            commentsData = data.comments || [];
            renderResults(commentsData);
            resultsCard.style.display = 'block';

            if (commentsData.length > 0) {
                setStep(4);
                const apiInfo = data.apiCalls ? ` (${data.apiCalls} طلبات API)` : '';
                showToastMsg(`تم جلب ${commentsData.length} تعليق بنجاح ✓${apiInfo}`);
            } else {
                setStep(3);
            }
        } catch (err) {
            showToastMsg('خطأ: ' + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-download"></i> جلب التعليقات';
        }
    });

    // ── Parse name & account from comment text ────────────
    /**
     * Extracts the real participant name and account number from comment text.
     * Common patterns:
     *   "Answer text\nبكيل عبدالفتاح طاهر\n3184036"
     *   "Answer\nالاسم: ماجد علي عبدة\nالحساب : 3258604"
     *   "Answer\nHaifa Ali Sultan\n3242997"
     */
    // Helper: strip emojis and special symbols from text
    function stripEmojis(str) {
        return str.replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27BF}|\u{FE00}-\u{FEFF}|\u{200B}-\u{200F}|\u{2028}-\u{202F}|\u{2060}-\u{206F}|\u{E0001}-\u{E007F}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{1FA70}-\u{1FAFF}|\u{2702}-\u{27B0}|\u{FE0F}|\u{20E3}|\u{3299}|\u{3297}|\u{303D}|\u{00A9}|\u{00AE}|\u{2B05}-\u{2B07}|\u{2B1B}|\u{2B1C}|\u{2B50}|\u{2B55}|\u{231A}|\u{231B}|\u{23E9}-\u{23F3}|\u{23F8}-\u{23FA}|\u{25AA}|\u{25AB}|\u{25B6}|\u{25C0}|\u{25FB}-\u{25FE}|\u{2614}|\u{2615}|\u{2648}-\u{2653}|\u{267F}|\u{2693}|\u{26A1}|\u{26AA}|\u{26AB}|\u{26BD}|\u{26BE}|\u{26C4}|\u{26C5}|\u{26CE}|\u{26D4}|\u{26EA}|\u{26F2}|\u{26F3}|\u{26F5}|\u{26FA}|\u{26FD}|\u{2934}|\u{2935}|\u{2B06}]/gu, '').trim();
    }

    function parseCommentData(text) {
        if (!text) return { name: '', account: '', answer: text || '' };

        const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
        let name = '';
        let account = '';
        const answerLines = [];

        // ── PASS 1: Find account number ─────────────────────
        // Any 6-7 digit number anywhere in the entire comment = account number
        // Scan all lines (clean of emojis/parentheses) for the first 6-7 digit match
        for (let i = 0; i < lines.length; i++) {
            const cleanLine = stripEmojis(lines[i]).replace(/[()（）]/g, ' ');
            const match = cleanLine.match(/(?:^|[^\d])(\d{6,7})(?:[^\d]|$)/);
            if (match) {
                account = match[1];
                break;
            }
        }

        // ── PASS 2: Find Labeled Name First ─────────────────
        // We do this before heuristics so it doesn't accidentally grab a pure-text answer line
        // Two-step: first try with mandatory separator (:, /, -, etc.)
        // Then try with just a space but validate the value looks like a real name
        for (let i = 0; i < lines.length; i++) {
            const cleanLine = stripEmojis(lines[i]);
            // Strict: requires a punctuation separator after the label
            const strictMatch = cleanLine.match(/^(?:الاسم|الارسم|الإسم|الأسم|اسمي|إسمي|اسم|إسم|Name|My\s*name)(?:\s+(?:الثلاثي|الكامل|الرباعي|بالكامل|الحقيقي|التداولي))?\s*[:\/\\\-\u2014_.]+\s*(.+)/i);
            if (strictMatch) {
                name = stripEmojis(strictMatch[1]).trim();
                break;
            }
            // Loose: just a space after the label, but reject if it starts with a preposition/article (= sentence, not a name)
            const looseMatch = cleanLine.match(/^(?:الاسم|الارسم|الإسم|الأسم|اسمي|إسمي|اسم|إسم|Name|My\s*name)(?:\s+(?:الثلاثي|الكامل|الرباعي|بالكامل|الحقيقي|التداولي))?\s+(.+)/i);
            if (looseMatch) {
                const val = looseMatch[1];
                // Reject values that start with Arabic prepositions/articles indicating a sentence
                if (!/^(?:ل[\u0600-\u06FF]|لل|في|من|على|عن|هو|هي|إن|أن|هل|كل|مع|عند|كان|لأن|التي|الذي|الكامل|المتكامل|العالمي|يعتبر|بين|عبر|أفضل|يجمع|تعطي|وسيط|يقاس|يختصر)/i.test(val)) {
                    name = stripEmojis(val).trim();
                    break;
                }
            }
        }

        // ── PASS 3: Extract name and answer ─────────────────
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = stripEmojis(line);

            // Skip lines that are just the account number (standalone)
            if (account) {
                const standaloneCheck = cleanLine.replace(/[()（）\s]/g, '');
                if (standaloneCheck === account) continue;
            }

            // Skip the labeled name line since we extracted it in Pass 2
            const isNameLabel = cleanLine.match(/^(?:الاسم|الارسم|الإسم|الأسم|اسمي|إسمي|اسم|إسم|Name|My\s*name)(?:\s+(?:الثلاثي|الكامل|الرباعي|بالكامل|الحقيقي|التداولي))?(?:\s*[:\/\\\-\u2014_.]+|\s+)/i);
            if (isNameLabel && name) continue;

            // Check for labeled account line: الحساب: / رقم الحساب: / رقم حسابي: etc.
            const accountLabelMatch = cleanLine.match(/^(?:الحساب|حسابي|رقم\s*(?:الحساب|حسابي)|حساب|Account)(?:\s+[\u0600-\u06FF]+)?\s*[^a-zA-Z\u0600-\u06FF\d]/i);
            if (accountLabelMatch) continue; // skip this line, account already extracted

            // If this line contains the embedded account number, try to extract name from remainder
            if (account && cleanLine.includes(account)) {
                let remainingText = cleanLine.replace(account, ' ').replace(/[()（）]/g, ' ').trim();
                if (remainingText && !name) {
                    const nameCandidate = remainingText.replace(/[,،.]/g, '').trim();
                    if (/^[\u0600-\u06FFa-zA-Z\s\.]+$/.test(nameCandidate) && nameCandidate.split(/\s+/).length >= 2 && nameCandidate.length <= 60) {
                        name = nameCandidate;
                        continue;
                    }
                }
                if (remainingText) answerLines.push(remainingText);
                continue;
            }

            // Heuristic: a line that's mostly Arabic/English letters (2+ words, no numbers)
            // and is NOT the first line (which is typically the answer) → likely a name
            const cleanForNameCheck = stripEmojis(line);
            if (i > 0 && !name && /^[\u0600-\u06FFa-zA-Z\s\.]+$/.test(cleanForNameCheck) && cleanForNameCheck.split(/\s+/).length >= 2 && cleanForNameCheck.length <= 60) {
                name = cleanForNameCheck;
                continue;
            }

            answerLines.push(line);
        }

        // Fallback: if no name was found, check the line right before the account number
        if (!name && account) {
            for (let idx = 0; idx < lines.length; idx++) {
                const cleanL = stripEmojis(lines[idx]).replace(/[()（）\s]/g, '');
                if (cleanL === account && idx > 0) {
                    const prevLine = stripEmojis(lines[idx - 1]);
                    if (/^[\u0600-\u06FFa-zA-Z\s\.]+$/.test(prevLine) && prevLine.split(/\s+/).length >= 2) {
                        name = prevLine;
                        const ai = answerLines.indexOf(lines[idx - 1]);
                        if (ai !== -1) answerLines.splice(ai, 1);
                    }
                    break;
                }
            }
        }

        return {
            name: name,
            account: account,
            answer: answerLines.join('\n')
        };
    }

    // ── Render Results ─────────────────────────────────────
    let parsedData = []; // Store parsed results for copy functions

    function renderResults(comments) {
        const excludedCard = document.getElementById('ts-excluded-card');
        const problemsSection = document.getElementById('ts-problems-section');
        const invalidSection = document.getElementById('ts-invalid-section');
        const problemsTbody = document.getElementById('ts-problems-tbody');
        const invalidTbody = document.getElementById('ts-invalid-tbody');

        if (!comments.length) {
            resultsBody.innerHTML = '';
            emptyState.style.display = 'block';
            resultsCount.innerHTML = '';
            parsedData = [];
            excludedCard.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';

        // Parse all comments
        const allParsed = comments.map(c => {
            const parsed = parseCommentData(c.text);
            return {
                ...c,
                parsedName: parsed.name || c.sender.name,
                parsedAccount: parsed.account,
                parsedAnswer: parsed.answer || c.text
            };
        });

        // ── Detect duplicates (keep latest comment per sender by date) ──
        const duplicates = [];
        const senderMap = new Map();
        for (let i = 0; i < allParsed.length; i++) {
            const sid = allParsed[i].sender.id || allParsed[i].sender.username || allParsed[i].sender.name;
            const current = allParsed[i];
            if (!senderMap.has(sid)) {
                senderMap.set(sid, current);
                continue;
            }

            const existing = senderMap.get(sid);
            const currentTs = current.date ? Date.parse(current.date) : NaN;
            const existingTs = existing.date ? Date.parse(existing.date) : NaN;

            const shouldKeepCurrent = Number.isFinite(currentTs) && Number.isFinite(existingTs)
                ? currentTs >= existingTs
                : true;

            if (shouldKeepCurrent) {
                duplicates.push({ ...existing, excludeReason: 'تعليق مكرر — تم الاحتفاظ بآخر تعليق' });
                senderMap.set(sid, current);
            } else {
                duplicates.push({ ...current, excludeReason: 'تعليق مكرر — تم الاحتفاظ بآخر تعليق' });
            }
        }
        const deduplicated = Array.from(senderMap.values());

        // ── Classify comments ───────────────────────────────────
        const valid = [];
        const problems = [];
        const invalid = [];

        for (const c of deduplicated) {
            const hasRealName = c.parsedName && c.parsedName !== 'مجهول' && c.parsedName !== c.sender.name;
            const hasSenderName = c.parsedName && c.parsedName !== 'مجهول';
            const hasAccount = !!c.parsedAccount;
            const text = (c.text || '').trim();
            const createdTs = c.date ? Date.parse(c.date) : NaN;
            const editedTs = c.editDate ? Date.parse(c.editDate) : NaN;
            const editedByTelegram = c.isEdited === true
                || (Number.isFinite(editedTs) && (!Number.isFinite(createdTs) || editedTs > createdTs));

            // Completely invalid: no account AND name is just the Telegram display name (not extracted from comment)
            // Also catches service messages, empty comments, bot messages like "Group Help"
            if (!hasAccount && !hasRealName) {
                let reason = '';
                if (!text || text.length < 3) {
                    reason = 'تعليق فارغ';
                } else if (/^(group\s*help|bot|service)/i.test(text)) {
                    reason = 'رسالة خدمة / بوت';
                } else {
                    reason = 'بدون اسم وبدون رقم حساب';
                }
                invalid.push({ ...c, excludeReason: reason });
            }
            // Problematic: has one but not the other
            else if (!hasAccount && hasSenderName) {
                problems.push({ ...c, excludeReason: 'رقم الحساب ناقص' });
            }
            else if (hasAccount && !hasSenderName) {
                problems.push({ ...c, excludeReason: 'الاسم ناقص أو غير واضح' });
            }
            // Edited message → problem
            else if (editedByTelegram) {
                problems.push({ ...c, excludeReason: 'تعليق معدل (edited)' });
            }
            // Valid
            else {
                valid.push(c);
            }
        }

        // Store only valid for copy functions
        parsedData = valid;

        // ── Render valid results ────────────────────────────
        const dupNote = duplicates.length > 0 ? ` | <span style="color:#f59e0b;">${duplicates.length} مكرر</span>` : '';
        resultsCount.innerHTML = `مشاركات صالحة: <strong>${valid.length}</strong> من أصل <strong>${allParsed.length}</strong> تعليق${dupNote}`;

        resultsBody.innerHTML = valid.map((c, i) => {
            const dateStr = c.date ? new Date(c.date).toLocaleString('ar-EG', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) : '';
            const usernameHtml = c.sender.username
                ? `<span class="ts-username">@${c.sender.username}</span>`
                : '<span style="color:#6b7280;">—</span>';

            return `<tr>
                <td>${i + 1}</td>
                <td>${escHtml(c.parsedName)}</td>
                <td style="direction:ltr; text-align:center; font-weight:600; color:#06b6d4;">${escHtml(c.parsedAccount) || '<span style="color:#6b7280;">—</span>'}</td>
                <td>${usernameHtml}</td>
                <td class="ts-comment-text">${escHtml(c.parsedAnswer)}</td>
                <td style="white-space:nowrap; font-size:0.85em; color:#9ca3af;">${dateStr}</td>
            </tr>`;
        }).join('');

        // ── Render excluded section ─────────────────────────
        const totalExcluded = duplicates.length + problems.length + invalid.length;
        if (totalExcluded > 0) {
            excludedCard.style.display = 'block';
            document.getElementById('ts-excluded-total-badge').textContent = totalExcluded;

            // Duplicates
            const dupSection = document.getElementById('ts-duplicates-section');
            const dupTbody = document.getElementById('ts-duplicates-tbody');
            if (duplicates.length > 0) {
                dupSection.style.display = 'block';
                document.getElementById('ts-duplicates-count').textContent = duplicates.length;
                dupTbody.innerHTML = duplicates.map((c, i) => {
                    const usernameHtml = c.sender.username
                        ? `<span class="ts-username">@${c.sender.username}</span>`
                        : '<span style="color:#6b7280;">—</span>';
                    return `<tr>
                        <td>${i + 1}</td>
                        <td>${escHtml(c.parsedName)}</td>
                        <td style="direction:ltr; text-align:center; font-weight:600; color:#06b6d4;">${escHtml(c.parsedAccount) || '<span style="color:#6b7280;">—</span>'}</td>
                        <td>${usernameHtml}</td>
                        <td class="ts-comment-text">${escHtml(c.text)}</td>
                        <td><span class="ts-reason-badge ts-reason-dup">${escHtml(c.excludeReason)}</span></td>
                    </tr>`;
                }).join('');
            } else {
                dupSection.style.display = 'none';
            }

            // Problems
            if (problems.length > 0) {
                problemsSection.style.display = 'block';
                document.getElementById('ts-problems-count').textContent = problems.length;
                problemsTbody.innerHTML = problems.map((c, i) => {
                    const usernameHtml = c.sender.username
                        ? `<span class="ts-username">@${c.sender.username}</span>`
                        : '<span style="color:#6b7280;">—</span>';
                    return `<tr>
                        <td>${i + 1}</td>
                        <td>${escHtml(c.parsedName)}</td>
                        <td style="direction:ltr; text-align:center; font-weight:600; color:#06b6d4;">${escHtml(c.parsedAccount) || '<span style="color:#6b7280;">—</span>'}</td>
                        <td>${usernameHtml}</td>
                        <td class="ts-comment-text">${escHtml(c.text)}</td>
                        <td><span class="ts-reason-badge ts-reason-warn">${escHtml(c.excludeReason)}</span></td>
                    </tr>`;
                }).join('');
            } else {
                problemsSection.style.display = 'none';
            }

            // Invalid
            if (invalid.length > 0) {
                invalidSection.style.display = 'block';
                document.getElementById('ts-invalid-count').textContent = invalid.length;
                invalidTbody.innerHTML = invalid.map((c, i) => {
                    const usernameHtml = c.sender.username
                        ? `<span class="ts-username">@${c.sender.username}</span>`
                        : '<span style="color:#6b7280;">—</span>';
                    return `<tr>
                        <td>${i + 1}</td>
                        <td>${usernameHtml}</td>
                        <td class="ts-comment-text">${escHtml(c.text)}</td>
                        <td><span class="ts-reason-badge ts-reason-danger">${escHtml(c.excludeReason)}</span></td>
                    </tr>`;
                }).join('');
            } else {
                invalidSection.style.display = 'none';
            }

            // Toggle functionality for collapsible sections
            setupExcludedToggles();
        } else {
            excludedCard.style.display = 'none';
        }

        // ── Stats bar ─────────────────────────────────────────
        document.getElementById('ts-stats-bar').style.display = 'flex';
        document.getElementById('ts-stat-total').textContent = allParsed.length;
        document.getElementById('ts-stat-valid').textContent = valid.length;
        document.getElementById('ts-stat-dup').textContent = duplicates.length;
        document.getElementById('ts-stat-prob').textContent = problems.length;
        document.getElementById('ts-stat-inv').textContent = invalid.length;

    }

    function setupExcludedToggles() {
        const bindToggle = (toggleId, bodyId) => {
            const toggle = document.getElementById(toggleId);
            const body = document.getElementById(bodyId);
            if (!toggle || !body) return;
            toggle.onclick = function() {
                const icon = this.querySelector('.ts-toggle-icon');
                body.classList.toggle('ts-collapsed');
                icon?.classList.toggle('fa-chevron-up');
                icon?.classList.toggle('fa-chevron-down');
            };
        };

        bindToggle('ts-duplicates-toggle', 'ts-duplicates-body');
        bindToggle('ts-problems-toggle', 'ts-problems-body');
        bindToggle('ts-invalid-toggle', 'ts-invalid-body');
    }

    // ── Filter ─────────────────────────────────────────
    document.getElementById('ts-filter-input').addEventListener('input', function() {
        const q = this.value.trim().toLowerCase();
        const rows = resultsBody.querySelectorAll('tr');
        rows.forEach(row => {
            if (!q) { row.style.display = ''; return; }
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(q) ? '' : 'none';
        });
    });

    // ── Copy functions ─────────────────────────────────────
    // Names + accounts (for roulette)
    document.getElementById('ts-copy-names-btn').addEventListener('click', () => {
        if (!parsedData.length) return;
        // Deduplicate by parsed name
        const seen = new Set();
        const entries = [];
        for (const c of parsedData) {
            const name = c.parsedName.trim();
            if (name && name !== 'مجهول' && !seen.has(name)) {
                seen.add(name);
                entries.push({ name, account: c.parsedAccount || '' });
            }
        }
        const text = entries.map((e, i) => {
            return e.account ? `${i + 1}- ${e.name} — ${e.account}` : `${i + 1}- ${e.name}`;
        }).join('\n');
        copyText(text);
        showToastMsg(`تم نسخ ${entries.length} اسم للروليت ✓`);
    });

    // Names + accounts + answers
    document.getElementById('ts-copy-all-btn').addEventListener('click', () => {
        if (!parsedData.length) return;
        const lines = parsedData.map((c, i) => {
            const parts = [`${i + 1}- ${c.parsedName}`];
            if (c.parsedAccount) parts.push(`— ${c.parsedAccount}`);
            parts.push(`— ${c.parsedAnswer}`);
            return parts.join(' ');
        });
        copyText(lines.join('\n'));
        showToastMsg(`تم نسخ ${parsedData.length} تعليق مع الإجابات ✓`);
    });

    // Names + accounts formatted
    document.getElementById('ts-copy-formatted-btn').addEventListener('click', () => {
        if (!parsedData.length) return;
        const seen = new Set();
        const lines = [];
        let num = 1;
        for (const c of parsedData) {
            const name = c.parsedName.trim();
            if (name && name !== 'مجهول' && !seen.has(name)) {
                seen.add(name);
                const acct = c.parsedAccount ? ` — ${c.parsedAccount}` : '';
                lines.push(`${num}- ${name}${acct}`);
                num++;
            }
        }
        copyText(lines.join('\n'));
        showToastMsg(`تم نسخ ${lines.length} اسم مرقم ✓`);
    });

    // ── Utilities ──────────────────────────────────────────
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }

    function showToastMsg(msg, isError) {
        copyToast.textContent = msg;
        copyToast.style.background = isError ? '#ef4444' : '#10b981';
        copyToast.classList.add('ts-show');
        setTimeout(() => copyToast.classList.remove('ts-show'), 2500);
    }

    function escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Start ─────────────────────────────────────────────
    checkStatus();
}
