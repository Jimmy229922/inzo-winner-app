async function renderActivityLogPage() {
    const appContent = document.getElementById('app-content');
    const LOGS_PER_PAGE = 20;
    let currentPage = 1;

    appContent.innerHTML = `
        <div class="page-header"><h1><i class="fas fa-history"></i> سجل الأنشطة العام</h1></div>
        <div id="activity-log-container">
            <p>جاري تحميل السجلات...</p>
        </div>
        <div id="activity-pagination-container" class="pagination-container"></div>
    `;

    const logContainer = document.getElementById('activity-log-container');
    const paginationContainer = document.getElementById('activity-pagination-container');

    async function loadAndDisplayLogs(page) {
        logContainer.innerHTML = '<p>جاري تحميل السجلات...</p>';
        
        const queryParams = new URLSearchParams({
            page: page,
            limit: LOGS_PER_PAGE,
            sort: 'newest',
            populate: 'agent'
        });
        const response = await authedFetch(`/api/logs?${queryParams.toString()}`);

        if (!response.ok) {
            logContainer.innerHTML = '<p class="error">فشل تحميل سجل الأنشطة.</p>';
            return;
        }

        const { data: logs, count } = await response.json();

        if (!logs || logs.length === 0) {
            logContainer.innerHTML = '<p class="no-results-message">لا توجد أنشطة مسجلة.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const getLogIconDetails = (actionType) => {
            if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'log-icon-create' };
            if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'log-icon-delete' };
            if (actionType.includes('PROFILE_UPDATE')) return { icon: 'fa-user-edit', colorClass: 'log-icon-profile' };
            if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'log-icon-details' };
            if (actionType.includes('COMPETITION_CREATED')) return { icon: 'fa-trophy', colorClass: 'log-icon-competition' };
            return { icon: 'fa-history', colorClass: 'log-icon-generic' };
        };

        logContainer.innerHTML = logs.map(log => {
            const { icon, colorClass } = getLogIconDetails(log.action_type);
            let finalDescription = log.description.replace(/`([^`]+)`/g, '<strong>$1</strong>');
            if (log.agent && log.agent.name) {
                finalDescription = finalDescription.replace(log.agent.name, `<a href="#profile/${log.agent._id}" class="agent-name-link">${log.agent.name}</a>`);
            }

            return `
                <div class="activity-item-full">
                    <div class="activity-icon ${colorClass}"><i class="fas ${icon}"></i></div>
                    <div class="activity-content">
                        <p class="activity-description">${finalDescription}</p>
                        <p class="activity-timestamp">${new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Render pagination
        const totalPages = Math.ceil(count / LOGS_PER_PAGE);
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>السابق</button>`;
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            paginationHtml += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>`;
        }
        paginationContainer.innerHTML = paginationHtml;
    }

    paginationContainer.addEventListener('click', (e) => {
        if (e.target.matches('.page-btn') && !e.target.disabled) {
            const newPage = parseInt(e.target.dataset.page);
            if (newPage) {
                currentPage = newPage;
                loadAndDisplayLogs(currentPage);
            }
        }
    });

    await loadAndDisplayLogs(currentPage);
}