async function renderWinnersPage() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-poll-h"></i> إجابات المسابقات</h1>
            </div>
            <div class="filters-container" style="position: relative;">
                <div class="filter-search-container">
                    <input type="search" id="competition-answers-search" placeholder="ابحث عن مسابقة لعرض الإجابات..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="competition-answers-clear"></i>
                    <div id="competition-search-results" class="search-results" style="top: 110%; display: none;"></div>
                </div>
            </div>
        </div>

        <div id="selected-competition-info" class="selected-competition-info" style="display: none;">
            <!-- Agent info will be rendered here -->
        </div>

        <div class="answers-grid">
            <div class="answers-column correct-answers">
                <div class="answers-column-header">
                    <h2><i class="fas fa-check-circle"></i> الإجابات الصحيحة</h2>
                    <span class="answers-count" id="correct-answers-count">0</span>
                </div>
                <div id="correct-answers-list" class="answers-list">
                    <p class="no-results-message">اختر مسابقة لعرض الإجابات الصحيحة.</p>
                </div>
            </div>
            <div class="answers-column incorrect-answers">
                <div class="answers-column-header">
                    <h2><i class="fas fa-times-circle"></i> الإجابات الخاطئة</h2>
                    <span class="answers-count" id="incorrect-answers-count">0</span>
                </div>
                <div id="incorrect-answers-list" class="answers-list">
                    <p class="no-results-message">اختر مسابقة لعرض الإجابات الخاطئة.</p>
                </div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('competition-answers-search');
    const clearBtn = document.getElementById('competition-answers-clear');
    const searchResultsContainer = document.getElementById('competition-search-results');
    const correctList = document.getElementById('correct-answers-list');
    const incorrectList = document.getElementById('incorrect-answers-list');
    const correctCountEl = document.getElementById('correct-answers-count');
    const incorrectCountEl = document.getElementById('incorrect-answers-count');
    let searchTimeout;

    // Function to fetch and display answers for a given competition
    async function fetchAndDisplayAnswers(competition) {
        if (!competition) return;

        const agent = competition.agents;

        // Update UI to show selected competition
        searchInput.value = competition.name;
        searchResultsContainer.style.display = 'none';
        correctList.innerHTML = '<div class="loader-container" style="display: flex; min-height: 200px; justify-content: center; align-items: center;"><div class="spinner"></div></div>';
        incorrectList.innerHTML = '<div class="loader-container" style="display: flex; min-height: 200px; justify-content: center; align-items: center;"><div class="spinner"></div></div>';

        // Display agent info
        const avatarHtml = agent && agent.avatar_url
            ? `<img src="${agent.avatar_url}" alt="Avatar" class="info-avatar">`
            : `<div class="info-avatar-placeholder"><i class="fas fa-user"></i></div>`;

        const agentInfoContainer = document.getElementById('selected-competition-info');
        agentInfoContainer.innerHTML = `
            ${avatarHtml}
            <div class="info-text">
                <h3>إجابات مسابقة: <span class="highlight">${competition.name}</span></h3>
                <div class="info-meta">
                    <p>التابعة للوكيل: <strong>${agent ? agent.name : 'غير معروف'}</strong></p>
                    <p class="correct-answer-display">الإجابة الصحيحة: <strong>${competition.correct_answer || 'غير محددة'}</strong></p>
                </div>
            </div>
        `;
        agentInfoContainer.style.display = 'block';

        const { data: answers, error } = await supabase
            .from('competition_answers')
            .select('*')
            .eq('competition_id', competition.id);

        if (error) {
            showToast('فشل جلب الإجابات.', 'error');
            correctList.innerHTML = '<p class="error">فشل جلب الإجابات.</p>';
            incorrectList.innerHTML = '<p class="error">فشل جلب الإجابات.</p>';
            return;
        }

        // New Normalization Function
        const normalizeAnswer = (str) => {
            return (str || '').trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g,"").replace(/\s{2,}/g," ");
        };

        const normalizedCorrectAnswer = normalizeAnswer(competition.correct_answer);
        const correctAnswers = [];
        const incorrectAnswers = [];

        answers.forEach(answer => {
            if (normalizeAnswer(answer.client_answer) === normalizedCorrectAnswer) {
                correctAnswers.push(answer);
            } else {
                incorrectAnswers.push(answer);
            }
        });

        const renderAnswerCard = (answer) => `
            <div class="answer-card">
                <div class="answer-card-info">
                    <span class="client-name">${answer.client_name}</span>
                    <span class="client-id" title="نسخ الرقم">#${answer.client_account_id} <i class="far fa-copy"></i></span>
                </div>
                <div class="answer-card-details">
                    <span class="client-answer" title="إجابة العميل">${answer.client_answer}</span>
                </div>
            </div>
        `;

        correctCountEl.textContent = correctAnswers.length;
        incorrectCountEl.textContent = incorrectAnswers.length;

        correctList.innerHTML = correctAnswers.length > 0 ? correctAnswers.map(renderAnswerCard).join('') : '<p class="no-results-message">لا توجد إجابات صحيحة.</p>';
        incorrectList.innerHTML = incorrectAnswers.length > 0 ? incorrectAnswers.map(renderAnswerCard).join('') : '<p class="no-results-message">لا توجد إجابات خاطئة.</p>';
    }

    searchInput.addEventListener('input', (e) => {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
        clearTimeout(searchTimeout);
        const searchTerm = e.target.value.trim();

        if (searchTerm.length < 2) {
            searchResultsContainer.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            const { data: competitions, error } = await supabase
                .from('competitions')
                .select('id, name, correct_answer, agents!inner(name, avatar_url)')
                .ilike('name', `%${searchTerm}%`) // Use 'name' for searching competition question
                .limit(10);

            if (error || !competitions) {
                searchResultsContainer.innerHTML = '<div class="search-result-item">خطأ في البحث</div>';
            } else if (competitions.length === 0) {
                searchResultsContainer.innerHTML = '<div class="search-result-item">لا توجد مسابقات مطابقة</div>';
            } else {
                searchResultsContainer.innerHTML = competitions.map(comp => `
                    <div class="search-result-item" data-competition='${JSON.stringify(comp)}'>
                        <p class="agent-name">${comp.name}</p>
                    </div>
                `).join('');
            }
            searchResultsContainer.style.display = 'block';
        }, 300);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        correctList.innerHTML = '<p class="no-results-message">اختر مسابقة لعرض الإجابات الصحيحة.</p>';
        incorrectList.innerHTML = '<p class="no-results-message">اختر مسابقة لعرض الإجابات الخاطئة.</p>';
        correctCountEl.textContent = '0';
        incorrectCountEl.textContent = '0';
        document.getElementById('selected-competition-info').style.display = 'none';
    });

    searchResultsContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item && item.dataset.competition) {
            const competitionData = JSON.parse(item.dataset.competition);
            fetchAndDisplayAnswers(competitionData);
        }
    });

    // Add event listener for copying client ID
    appContent.addEventListener('click', (e) => {
        const clientIdEl = e.target.closest('.client-id');
        if (clientIdEl) {
            const id = clientIdEl.textContent.replace('#', '').trim();
            navigator.clipboard.writeText(id).then(() => showToast(`تم نسخ الرقم: ${id}`, 'info'));
        }
    });

    // --- NEW: Auto-load answers if competition_id is in URL ---
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const competitionIdFromUrl = urlParams.get('competition_id');

    if (competitionIdFromUrl) {
        // Fetch the specific competition data
        const { data: competition, error } = await supabase
            .from('competitions')
            .select('id, name, correct_answer, agents!inner(name, avatar_url)')
            .eq('id', competitionIdFromUrl)
            .single();

        if (error || !competition) {
            showToast('لم يتم العثور على المسابقة المحددة.', 'error');
        } else {
            fetchAndDisplayAnswers(competition);
        }
    }
}