const LOGS_PER_PAGE = 25;

async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';

    if (!isAdmin) {
        appContent.innerHTML = `
            <div class="access-denied-container">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية وصول</h2>
                <p>أنت لا تملك الصلاحية اللازمة لعرض هذه الصفحة. يرجى التواصل مع المدير.</p>
            </div>`;
        return;
    }

    appContent.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1><i class="fas fa-history"></i> سجل نشاط الموقع</h1>
            </div>
            <div class="filters-container">
                <div class="sort-container">
                    <label for="log-sort-select">ترتيب حسب:</label>
                    <select id="log-sort-select">
                        <option value="newest">الأحدث أولاً</option>
                        <option value="oldest">الأقدم أولاً</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="activity-log-container">
            <div class="loader-container"><div class="spinner"></div></div>
        </div>
    `;

    document.getElementById('log-sort-select').addEventListener('change', () => fetchAndDisplayLogs(1));
    await fetchAndDisplayLogs(1);
}

async function fetchAndDisplayLogs(page) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    const sortValue = document.getElementById('log-sort-select')?.value || 'newest';

    try {
        const queryParams = new URLSearchParams({
            page: page,
            limit: LOGS_PER_PAGE,
            sort: sortValue,
            populate: 'user' // Request user data to be populated
        });

        const response = await authedFetch(`/api/logs?${queryParams.toString()}`);
        if (!response.ok) {
            throw new Error('فشل جلب بيانات السجل.');
        }
        const { data: logs, count } = await response.json();

        displayLogsPage(logs || [], page, count || 0);
    } catch (error) {
        console.error("Error fetching logs:", error);
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

function displayLogsPage(logs, page, totalCount) {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    page = parseInt(page);
    const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

    // Reuse the existing log HTML generator from profile.js
    const logHtml = logs.length > 0 ? generateActivityLogHTML(logs) : '<p class="no-results-message">لا توجد سجلات لعرضها.</p>';

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml += '<div class="pagination-container">';
        paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
        // Simplified pagination for many pages
        paginationHtml += `<span class="page-info">صفحة ${page} من ${totalPages}</span>`;
        paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
        paginationHtml += '</div>';
    }

    container.innerHTML = `${logHtml}${paginationHtml}`;

    // Attach pagination listeners
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = e.currentTarget.dataset.page;
            if (newPage) {
                fetchAndDisplayLogs(parseInt(newPage));
            }
        });
    });
}