async function renderAnswersCollectorPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-magnet"></i> جامع إجابات المسابقات</h1>
        </div>
        <div id="answers-collector-container">
            <!-- Step 1: Select Competition -->
            <div class="form-container-v2" id="competition-selection-step">
                <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-tasks"></i> الخطوة 1: اختر المسابقة</h3>
                    <div class="form-group">
                        <label for="active-competitions-select">اختر مسابقة نشطة لجمع إجاباتها</label>
                        <select id="active-competitions-select">
                            <option value="">جاري تحميل المسابقات النشطة...</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Step 2: Enter Post Link -->
            <div class="form-container-v2" id="post-link-step" style="display: none;">
                 <div id="selected-competition-info" class="page-notification info"></div>
                 <div class="form-section">
                    <h3 class="details-section-title"><i class="fas fa-link"></i> الخطوة 2: أدخل رابط المنشور</h3>
                    <div class="form-group">
                        <label for="telegram-post-link">رابط منشور المسابقة على تلجرام</label>
                        <input type="url" id="telegram-post-link" placeholder="https://t.me/channel_name/1234">
                        <p class="form-hint">تأكد من أن الرابط هو رابط المنشور نفسه وليس القناة.</p>
                    </div>
                    <div class="form-actions-v2">
                        <button id="start-collecting-btn" class="btn-primary"><i class="fas fa-search-plus"></i> بدء جمع الإجابات</button>
                         <button id="back-to-comp-selection" class="btn-secondary">العودة</button>
                    </div>
                </div>
            </div>

            <!-- Step 3: Display Results -->
            <div id="results-step" style="display: none;">
                <div class="answers-grid">
                    <!-- Correct Answers Column -->
                    <div class="answers-column correct-answers">
                        <div class="answers-column-header">
                            <h2><i class="fas fa-check-circle"></i> الإجابات الصحيحة</h2>
                            <span id="correct-answers-count" class="answers-count">0</span>
                        </div>
                        <div class="answers-list" id="correct-answers-list">
                            <p class="no-results-message">لا توجد إجابات صحيحة بعد.</p>
                        </div>
                    </div>
                    <!-- Incorrect Answers Column -->
                    <div class="answers-column incorrect-answers">
                        <div class="answers-column-header">
                            <h2><i class="fas fa-times-circle"></i> الإجابات الخاطئة</h2>
                            <span id="incorrect-answers-count" class="answers-count">0</span>
                        </div>
                        <div class="answers-list" id="incorrect-answers-list">
                             <p class="no-results-message">لا توجد إجابات خاطئة بعد.</p>
                        </div>
                    </div>
                </div>
                <div class="form-actions-v2" style="margin-top: 20px;">
                    <button id="export-to-excel-btn" class="btn-success" style="display: none;"><i class="fas fa-file-excel"></i> تصدير الإجابات الصحيحة (Excel)</button>
                    <button id="collect-another-btn" class="btn-secondary" style="display: none;"><i class="fas fa-redo"></i> جمع مسابقة أخرى</button>
                </div>
            </div>
        </div>
    `;

    await setupAnswersCollector();
}

async function setupAnswersCollector() {
    const competitionSelect = document.getElementById('active-competitions-select');
    const postLinkStep = document.getElementById('post-link-step');
    const competitionSelectionStep = document.getElementById('competition-selection-step');
    const resultsStep = document.getElementById('results-step');
    const startCollectingBtn = document.getElementById('start-collecting-btn');
    const backToCompSelectionBtn = document.getElementById('back-to-comp-selection');
    const telegramPostLinkInput = document.getElementById('telegram-post-link');
    const exportBtn = document.getElementById('export-to-excel-btn');
    const collectAnotherBtn = document.getElementById('collect-another-btn');

    let selectedCompetition = null;

    // 1. Load active competitions
    try {
        const { data: competitions, error } = await supabase
            .from('competitions')
            .select('id, name, correct_answer, agents(name)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (competitions.length > 0) {
            competitionSelect.innerHTML = '<option value="">-- اختر مسابقة --</option>';
            competitions.forEach(comp => {
                const option = document.createElement('option');
                option.value = comp.id;
                option.textContent = `${comp.name} (وكيل: ${comp.agents.name})`;
                option.dataset.correctAnswer = comp.correct_answer;
                competitionSelect.appendChild(option);
            });
        } else {
            competitionSelect.innerHTML = '<option value="">لا توجد مسابقات نشطة حالياً</option>';
        }
    } catch (err) {
        console.error('Error loading active competitions:', err);
        competitionSelect.innerHTML = '<option value="">فشل تحميل المسابقات</option>';
    }

    // 2. Handle competition selection
    competitionSelect.addEventListener('change', () => {
        const selectedOption = competitionSelect.options[competitionSelect.selectedIndex];
        if (competitionSelect.value) {
            selectedCompetition = {
                id: competitionSelect.value,
                name: selectedOption.textContent,
                correctAnswer: selectedOption.dataset.correctAnswer
            };
            document.getElementById('selected-competition-info').innerHTML = `
                <i class="fas fa-info-circle"></i>
                <div>
                    <p>المسابقة المحددة: <strong>${selectedCompetition.name}</strong></p>
                    <p>الإجابة الصحيحة: <strong class="highlight">${selectedCompetition.correctAnswer}</strong></p>
                </div>
            `;
            competitionSelectionStep.style.display = 'none';
            postLinkStep.style.display = 'block';
        }
    });

    // 3. Handle back button
    backToCompSelectionBtn.addEventListener('click', () => {
        postLinkStep.style.display = 'none';
        competitionSelectionStep.style.display = 'block';
        selectedCompetition = null;
    });

    // NEW: Handle "Collect Another" button
    collectAnotherBtn.addEventListener('click', () => {
        resultsStep.style.display = 'none';
        exportBtn.style.display = 'none';
        collectAnotherBtn.style.display = 'none';
        competitionSelectionStep.style.display = 'block';
        selectedCompetition = null;
    });

    // 4. Handle "Start Collecting"
    startCollectingBtn.addEventListener('click', async () => {
        const postLink = telegramPostLinkInput.value.trim();
        if (!postLink || !selectedCompetition) {
            showToast('يرجى إدخال رابط منشور تلجرام صالح.', 'error');
            return;
        }

        startCollectingBtn.disabled = true;
        startCollectingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الجمع...';
        showToast('بدأت عملية جمع الإجابات. قد تستغرق بعض الوقت...', 'info');

        try {
            // This will be a new backend endpoint
            const response = await fetch('/api/collect-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postUrl: postLink })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            displayAnswers(result.answers, selectedCompetition.correctAnswer);
            postLinkStep.style.display = 'none';
            resultsStep.style.display = 'block';

        } catch (err) {
            console.error('Error collecting answers:', err);
            showToast(`فشل جمع الإجابات: ${err.message}`, 'error');
        } finally {
            startCollectingBtn.disabled = false;
            startCollectingBtn.innerHTML = '<i class="fas fa-search-plus"></i> بدء جمع الإجابات';
        }
    });
}

function displayAnswers(answers, correctAnswer) {
    const correctList = document.getElementById('correct-answers-list');
    const incorrectList = document.getElementById('incorrect-answers-list');
    const correctCountEl = document.getElementById('correct-answers-count');
    const incorrectCountEl = document.getElementById('incorrect-answers-count');
    const exportBtn = document.getElementById('export-to-excel-btn');
    const collectAnotherBtn = document.getElementById('collect-another-btn');

    correctList.innerHTML = '';
    incorrectList.innerHTML = '';
    let correctCount = 0;
    let incorrectCount = 0;

    const createAnswerCard = (answer) => `
        <div class="answer-card" data-account-id="${answer.account_id || ''}">
            <div class="answer-card-info">
                <strong class="client-name">${answer.author || 'مجهول'}</strong>
                <div class="client-id-wrapper">
                    <span class="client-id">${answer.account_id || 'لا يوجد رقم'}</span>
                    ${answer.account_id ? '<button class="copy-id-btn" title="نسخ رقم الحساب"><i class="far fa-copy"></i></button>' : ''}
                </div>
            </div>
            <div class="answer-card-details">
                <span>${answer.text}</span>
            </div>
        </div>
    `;

    const correctAnswersData = [];
    answers.forEach(answer => {
        // A simple check if the answer text contains the correct answer
        if (answer.text && answer.text.includes(correctAnswer)) {
            correctList.innerHTML += createAnswerCard(answer);
            correctCount++;
            correctAnswersData.push({
                'الاسم': answer.author || 'مجهول',
                'رقم الحساب': answer.account_id || 'غير متوفر',
                'نص الإجابة': answer.text
            });
        } else {
            incorrectList.innerHTML += createAnswerCard(answer);
            incorrectCount++;
        }
    });

    // Update counts
    correctCountEl.textContent = correctCount;
    incorrectCountEl.textContent = incorrectCount;

    // Show "no results" message if lists are empty
    if (correctCount === 0) correctList.innerHTML = '<p class="no-results-message">لا توجد إجابات صحيحة.</p>';
    if (incorrectCount === 0) incorrectList.innerHTML = '<p class="no-results-message">لا توجد إجابات خاطئة.</p>';

    // Show action buttons
    collectAnotherBtn.style.display = 'inline-flex';
    if (correctCount > 0) {
        exportBtn.style.display = 'inline-flex';
    }

    // --- NEW: Event listener for copy buttons (using delegation) ---
    resultsStep.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-id-btn');
        if (copyBtn) {
            const card = copyBtn.closest('.answer-card');
            const accountId = card.dataset.accountId;
            if (accountId) {
                navigator.clipboard.writeText(accountId).then(() => {
                    showToast(`تم نسخ رقم الحساب: ${accountId}`, 'success');
                }).catch(err => {
                    showToast('فشل نسخ الرقم.', 'error');
                    console.error('Copy failed:', err);
                });
            }
        }
    });

    // --- NEW: Event listener for export button ---
    exportBtn.addEventListener('click', () => {
        try {
            // Create a new workbook and a worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(correctAnswersData);

            // Append the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, 'الإجابات الصحيحة');

            // Generate a file name and trigger the download
            const fileName = `Correct_Answers_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } catch (err) {
            showToast('فشل تصدير الملف. يرجى المحاولة مرة أخرى.', 'error');
            console.error('Excel export error:', err);
        }
    });
}