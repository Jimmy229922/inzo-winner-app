// Profile.js - Updated: 2025-11-13 04:36:56
let competitionCountdownIntervals = [];
let renewalCountdownInterval = null; // For the new renewal countdown
let isRenewing = false; // Flag to prevent renewal race condition
const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
let profilePageEventListeners = []; // Defensive: To manage event listeners

// دالة للحصول على الوقت النسبي
function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return `منذ ${Math.floor(days / 7)} أسبوع`;
}

function stopCompetitionCountdowns() {
    competitionCountdownIntervals.forEach(clearInterval);
    competitionCountdownIntervals = [];
}

// --- NEW: Agent activity timeline renderer ---
function renderAgentActivityTimeline(agentId, container) {
    fetch(`/api/agents/${agentId}/activity-log`)
    .then(res => res.json())
    .then(logs => {
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div class="alert alert-info">لا يوجد سجل نشاط لهذا الوكيل.</div>';
            return;
        }

        const getIconForAction = (action) => {
            if (action.includes('تحديث')) return 'fas fa-pencil-alt';
            if (action.includes('إضافة') || action.includes('تعيين')) return 'fas fa-plus-circle';
            if (action.includes('حذف')) return 'fas fa-trash-alt';
            if (action.includes('تسجيل دخول')) return 'fas fa-sign-in-alt';
            if (action.includes('تغيير رتبة')) return 'fas fa-level-up-alt';
            return 'fas fa-history'; // Default icon
        };

        const timelineHtml = `
            <div class="professional-timeline">
                ${logs.map(log => {
                    const date = new Date(log.timestamp).toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
                    const iconClass = getIconForAction(log.action);
                    const details = log.details ? `<p class="timeline-details">${log.details}</p>` : '';
                    
                    return `
                        <div class="timeline-entry">
                            <div class="timeline-icon">
                                <i class="${iconClass}"></i>
                            </div>
                            <div class="timeline-content">
                                <p class="timeline-action">${log.action}</p>
                                <span class="timeline-timestamp">${date}</span>
                                ${details}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.innerHTML = `
            <h3 class="section-title-v2">
                <i class="fas fa-stream icon"></i> سجل النشاط
            </h3>
            ${timelineHtml}
        `;
    })
    .catch(err => {
        console.error('[AgentActivityTimeline] Error:', err);
        container.innerHTML = '<div class="alert alert-danger">حدث خطأ أثناء تحميل سجل النشاط.</div>';
    });
}

// --- END: Agent activity timeline renderer ---

function stopAllProfileTimers() {
    // A single function to clean up all timers when leaving the profile page.
    // This ensures complete separation.
    stopCompetitionCountdowns();
    if (renewalCountdownInterval) {
        clearInterval(renewalCountdownInterval);
        renewalCountdownInterval = null;
    }
    // Defensive: Remove all dynamically added event listeners for this page
    profilePageEventListeners.forEach(({ element, type, handler }) => {
        if (element) element.removeEventListener(type, handler);
    });
    profilePageEventListeners = [];

    // --- NEW: Unsubscribe from task store ---
    if (window.taskStore && window.profileStoreSubscription) {
        window.taskStore.unsubscribe(window.profileStoreSubscription);
        window.profileStoreSubscription = null;
    }
}

// Function to show rank change modal with reason and action inputs
function showRankChangeModal(agent, newRank, onConfirm, onCancel) {
    const modalContent = `
        <div class="rank-change-modal-dark" style="direction:rtl;text-align:right;font-family:'Cairo',sans-serif;">
            <div class="rcm-shell" style="background:#181a20;border:1px solid #2a2f38;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.55);max-width:640px;margin:0 auto;">
                <div class="rcm-header" style="background:linear-gradient(135deg,#222831,#1b2026);padding:14px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #2d343f;">
                    <i class="fas fa-layer-group" style="color:#4fa3ff;font-size:18px;"></i>
                    <h3 style="margin:0;color:#f2f5f7;font-size:17px;font-weight:700;letter-spacing:.5px;">تغيير مرتبة الوكيل</h3>
                </div>
                <div class="rcm-body" style="padding:18px 20px;background:#1f2228;max-height:70vh;overflow-y:auto;scrollbar-width:thin;">
                    <section class="rcm-agent" style="background:#22262d;border:1px solid #303841;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:13.5px;">
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">اسم الوكيل:</span> <strong style="color:#fff;">${agent.name}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">رقم الوكالة:</span> <strong style="color:#fff;">${agent.agent_id}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">التصنيف:</span> <strong style="color:#fff;">${agent.classification || agent.class || 'غير محدد'}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">المرتبة الحالية:</span> <span class="rank-chip" style="background:#39424d;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;">${agent.rank}</span></div>
                        </div>
                        <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                            <div style="flex:1;text-align:center;">
                                <div style="color:#b8c2cc;font-size:11px;margin-bottom:4px;">المرتبة القديمة</div>
                                <div style="display:inline-block;background:#ffb347;color:#3a2f00;font-weight:600;padding:4px 14px;border-radius:30px;font-size:13px;min-width:110px;">${agent.rank}</div>
                            </div>
                            <i class="fas fa-chevron-left" style="color:#4fa3ff;font-size:20px;"></i>
                            <div style="flex:1;text-align:center;">
                                <div style="color:#b8c2cc;font-size:11px;margin-bottom:4px;">المرتبة الجديدة</div>
                                <div style="display:inline-block;background:#2fbf71;color:#fff;font-weight:600;padding:4px 14px;border-radius:30px;font-size:13px;min-width:110px;">${newRank}</div>
                            </div>
                        </div>
                    </section>
                    <section class="rcm-inputs" style="display:flex;flex-direction:column;gap:18px;">
                        <div class="rcm-field" style="display:flex;flex-direction:column;gap:6px;">
                            <label for="rankChangeReason" style="color:#d2d8df;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-question-circle" style="color:#4fa3ff;"></i>
                                ما هو سبب تغيير المرتبة؟
                            </label>
                            <textarea id="rankChangeReason" rows="3" placeholder="مثال: زيادة التفاعل والمشاركات، عدم التعاون، زيادة عدد العملاء..." style="background:#272c33;color:#f5f7fa;border:1px solid #323b45;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;transition:border .2s, background .2s;" required></textarea>
                        </div>
                        <div class="rcm-field" style="display:flex;flex-direction:column;gap:6px;">
                            <label for="rankChangeAction" style="color:#d2d8df;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-tasks" style="color:#4fa3ff;"></i>
                                ما هو الإجراء المتخذ؟
                            </label>
                            <textarea id="rankChangeAction" rows="3" placeholder="مثال: ترقية التصنيف من C إلى B، حرمان من المسابقات، ترقية المرتبة إلى Silver..." style="background:#272c33;color:#f5f7fa;border:1px solid #323b45;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;transition:border .2s, background .2s;" required></textarea>
                        </div>
                        <div style="text-align:center;margin-top:-4px;">
                            <span style="color:#ff7675;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;">
                                <i class="fas fa-exclamation-triangle"></i>
                                يجب إدخال السبب والإجراء لحفظ التغيير
                            </span>
                        </div>
                    </section>
                </div>
            </div>
        </div>`;

    showConfirmationModal(modalContent, async () => {
        const reason = document.getElementById('rankChangeReason').value.trim();
        const action = document.getElementById('rankChangeAction').value.trim();

        if (!reason || !action) {
            showToast('يرجى إدخال السبب والإجراء', 'error');
            return false; // Prevent modal from closing
        }

        if (onConfirm) {
            await onConfirm(reason, action);
        }
        return true; // Allow modal to close
    }, {
        title: 'تغيير مرتبة الوكيل',
        confirmText: '<i class="fas fa-check"></i> حفظ التغيير',
        cancelText: '<i class="fas fa-times"></i> إلغاء',
        onCancel: onCancel
    });

    // CSP-safe: attach focus/blur styling listeners after modal mounts
    setTimeout(() => {
        const reasonEl = document.getElementById('rankChangeReason');
        const actionEl = document.getElementById('rankChangeAction');
        const bind = (el) => {
            if (!el) return;
            const onFocus = () => (el.style.borderColor = '#4fa3ff');
            const onBlur = () => (el.style.borderColor = '#323b45');
            el.addEventListener('focus', onFocus);
            el.addEventListener('blur', onBlur);
            // track for cleanup when leaving profile page
            if (window.profilePageEventListeners) {
                window.profilePageEventListeners.push({ element: el, type: 'focus', handler: onFocus });
                window.profilePageEventListeners.push({ element: el, type: 'blur', handler: onBlur });
            }
        };
        bind(reasonEl);
        bind(actionEl);
    }, 0);
}

// Function to show classification change modal with reason and action inputs
function showClassificationChangeModal(agent, newClassification, onConfirm, onCancel) {
    console.log('🎯 [showClassificationChangeModal] ========== FUNCTION CALLED ==========');
    console.log('🎯 [showClassificationChangeModal] Agent:', agent);
    console.log('🎯 [showClassificationChangeModal] Agent Name:', agent?.name);
    console.log('🎯 [showClassificationChangeModal] Old Classification:', agent?.classification);
    console.log('🎯 [showClassificationChangeModal] New Classification:', newClassification);
    console.log('🎯 [showClassificationChangeModal] onConfirm type:', typeof onConfirm);
    console.log('🎯 [showClassificationChangeModal] onCancel type:', typeof onCancel);
    console.log('🎯 [showClassificationChangeModal] showConfirmationModal exists?', typeof showConfirmationModal);
    console.log('🎯 [showClassificationChangeModal] =======================================');
    
    const modalContent = `
        <div class="classification-change-modal-dark" style="direction:rtl;text-align:right;font-family:'Cairo',sans-serif;">
            <div class="ccm-shell" style="background:#181a20;border:1px solid #2a2f38;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.55);max-width:640px;margin:0 auto;">
                <div class="ccm-header" style="background:linear-gradient(135deg,#222831,#1b2026);padding:14px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #2d343f;">
                    <i class="fas fa-tag" style="color:#4fa3ff;font-size:18px;"></i>
                    <h3 style="margin:0;color:#f2f5f7;font-size:17px;font-weight:700;letter-spacing:.5px;">تغيير تصنيف الوكيل</h3>
                </div>
                <div class="ccm-body" style="padding:18px 20px;background:#1f2228;max-height:70vh;overflow-y:auto;scrollbar-width:thin;">
                    <section class="ccm-agent" style="background:#22262d;border:1px solid #303841;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:13.5px;">
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">اسم الوكيل:</span> <strong style="color:#fff;">${agent.name}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">رقم الوكالة:</span> <strong style="color:#fff;">${agent.agent_id}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">المرتبة:</span> <strong style="color:#fff;">${agent.rank || 'غير محدد'}</strong></div>
                            <div style="color:#c9d3dc;"><span style="color:#7f8ea3;font-weight:600;">التصنيف الحالي:</span> <span class="classification-chip" style="background:#39424d;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;">${agent.classification}</span></div>
                        </div>
                        <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                            <div style="flex:1;text-align:center;">
                                <div style="color:#b8c2cc;font-size:11px;margin-bottom:4px;">التصنيف القديم</div>
                                <div style="display:inline-block;background:#ffb347;color:#3a2f00;font-weight:600;padding:4px 14px;border-radius:30px;font-size:13px;min-width:110px;">${agent.classification}</div>
                            </div>
                            <i class="fas fa-chevron-left" style="color:#4fa3ff;font-size:20px;"></i>
                            <div style="flex:1;text-align:center;">
                                <div style="color:#b8c2cc;font-size:11px;margin-bottom:4px;">التصنيف الجديد</div>
                                <div style="display:inline-block;background:#2fbf71;color:#fff;font-weight:600;padding:4px 14px;border-radius:30px;font-size:13px;min-width:110px;">${newClassification}</div>
                            </div>
                        </div>
                    </section>
                    <section class="ccm-inputs" style="display:flex;flex-direction:column;gap:18px;">
                        <div class="ccm-field" style="display:flex;flex-direction:column;gap:6px;">
                            <label for="classificationChangeReason" style="color:#d2d8df;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-question-circle" style="color:#4fa3ff;"></i>
                                ما هو سبب تغيير التصنيف؟
                            </label>
                            <textarea id="classificationChangeReason" rows="3" placeholder="مثال: زيادة التفاعل والمشاركات، عدم الالتزام، تحسين الأداء..." style="background:#272c33;color:#f5f7fa;border:1px solid #323b45;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;transition:border .2s, background .2s;" required></textarea>
                        </div>
                        <div class="ccm-field" style="display:flex;flex-direction:column;gap:6px;">
                            <label for="classificationChangeAction" style="color:#d2d8df;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-tasks" style="color:#4fa3ff;"></i>
                                ما هو الإجراء المتخذ؟
                            </label>
                            <textarea id="classificationChangeAction" rows="3" placeholder="مثال: ترقية التصنيف من C إلى B، تخفيض التصنيف من A إلى B، تغيير عدد المسابقات..." style="background:#272c33;color:#f5f7fa;border:1px solid #323b45;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;transition:border .2s, background .2s;" required></textarea>
                        </div>
                        <div style="text-align:center;margin-top:-4px;">
                            <span style="color:#ff7675;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;">
                                <i class="fas fa-exclamation-triangle"></i>
                                يجب إدخال السبب والإجراء لحفظ التغيير
                            </span>
                        </div>
                    </section>
                </div>
            </div>
        </div>`;

    console.log('🎨 [showClassificationChangeModal] Modal HTML created successfully');
    console.log('🎨 [showClassificationChangeModal] About to call showConfirmationModal...');
    console.log('🎨 [showClassificationChangeModal] showConfirmationModal function:', showConfirmationModal);
    
    showConfirmationModal(modalContent, async () => {
        console.log('💾 [Classification Modal] ========== CONFIRM CLICKED ==========');
        const reason = document.getElementById('classificationChangeReason')?.value?.trim();
        const action = document.getElementById('classificationChangeAction')?.value?.trim();

        console.log('💾 [Classification Modal] Reason:', reason);
        console.log('💾 [Classification Modal] Action:', action);

        if (!reason || !action) {
            console.log('❌ [Classification Modal] Missing reason or action - showing error');
            showToast('يرجى إدخال السبب والإجراء', 'error');
            return false; // Prevent modal from closing
        }

        console.log('✅ [Classification Modal] Valid input - calling onConfirm callback');
        if (onConfirm) {
            await onConfirm(reason, action);
        }
        console.log('✅ [Classification Modal] onConfirm completed - closing modal');
        return true; // Allow modal to close
    }, {
        title: 'تغيير تصنيف الوكيل',
        confirmText: '<i class="fas fa-check"></i> حفظ التغيير',
        cancelText: '<i class="fas fa-times"></i> إلغاء',
        onCancel: onCancel
    });

    console.log('🎉 [showClassificationChangeModal] showConfirmationModal called successfully!');
    console.log('🎉 [showClassificationChangeModal] Modal should be visible now!');

    // CSP-safe: attach focus/blur styling listeners after modal mounts
    setTimeout(() => {
        const reasonEl = document.getElementById('classificationChangeReason');
        const actionEl = document.getElementById('classificationChangeAction');
        const bind = (el) => {
            if (!el) return;
            const onFocus = () => (el.style.borderColor = '#4fa3ff');
            const onBlur = () => (el.style.borderColor = '#323b45');
            el.addEventListener('focus', onFocus);
            el.addEventListener('blur', onBlur);
            // track for cleanup when leaving profile page
            if (window.profilePageEventListeners) {
                window.profilePageEventListeners.push({ element: el, type: 'focus', handler: onFocus });
                window.profilePageEventListeners.push({ element: el, type: 'blur', handler: onBlur });
            }
        };
        bind(reasonEl);
        bind(actionEl);
    }, 0);
}

async function renderAgentProfilePage(agentId, options = {}) {
    // Defensive: Guard against undefined/empty agentId early
    if (!agentId || agentId === 'undefined') {
        const appContent = document.getElementById('app-content');
        if (appContent) {
                appContent.innerHTML = `<div class="error-card"><i class="fas fa-exclamation-triangle"></i><p>معرّف الوكيل غير صالح أو مفقود.</p></div>`;
            }
            console.warn('[Profile] Invalid agentId supplied to renderAgentProfilePage:', agentId);
            return;
        }
    isRenewing = false; // Reset the flag on each render
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '';

    if (!authedFetch) { // Check if authedFetch is available (it's a placeholder for now)
        appContent.innerHTML = `<p class="error">لا يمكن عرض الملف الشخصي، لم يتم الاتصال بقاعدة البيانات.</p>`;
        return;
    }

    // Clear any previous timers from other profiles
    stopAllProfileTimers();

    // --- Defensive Programming: Use optional chaining and provide defaults ---
    if (!currentUserProfile) { // Worst-case: profile data not loaded yet
        appContent.innerHTML = `<p class="error">فشل تحميل بيانات المستخدم. يرجى تحديث الصفحة.</p>`;
        return;
    }
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = currentUserProfile?.role === 'admin';
    const userPerms = currentUserProfile?.permissions || {};

    // Check for edit mode in hash, e.g., #profile/123/edit
    const hashParts = window.location.hash.split('/');
    const startInEditMode = hashParts.includes('edit');
    const defaultTab = options.activeTab || 'action';

    // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
    let agent = null;
    let error = null;
    try {
        const response = await authedFetch(`/api/agents/${agentId}`);
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'فشل جلب بيانات الوكيل.');
        }
        const result = await response.json();
        agent = result.data;
    } catch (e) {
        error = e;
    }

    // --- Defensive Programming: Handle API failures gracefully ---
    let agentCompetitions = [];
    let agentLogs = [];
    try {
        const compResponse = await authedFetch(`/api/competitions?agentId=${agentId}&limit=100&sort=newest`); // Fetch up to 100 competitions for the agent
        const logUrl = `/api/logs?agent_id=${agentId}&limit=50&populate=user`;
        const logResponse = await authedFetch(logUrl); // Fetch latest 50 logs for the agent

        if (compResponse.ok) {
            const compResult = await compResponse.json();
            agentCompetitions = compResult.data || []; // Default to empty array
        } else {
            console.error("Failed to fetch agent competitions.");
            // Don't block rendering, just show an empty list.
        }
        if (logResponse.ok) {
            const logResult = await logResponse.json();
            agentLogs = logResult.data || []; // Default to empty array
        } else {
            console.error("Failed to fetch agent logs.");
        }
    } catch (compError) {
        console.error("Error fetching secondary profile data:", compError);
        // The page can still render without this data.
    }
    if (error || !agent) {
        appContent.innerHTML = `<p class="error">فشل العثور على الوكيل المطلوب.</p>`;
        return;
    }

    // --- NEW: Fetch today's task status for this agent from the central store ---
    const today = new Date();
    const todayDayIndex = today.getDay();
    let isTaskDay = (agent.audit_days || []).includes(todayDayIndex);

    // --- NEW: Ensure task store is initialized and get today's task status ---
    await window.taskStore.init(); // Make sure we have the latest task data
    const agentTaskToday = window.taskStore.state.tasks[agentId]?.[todayDayIndex] || { audited: false, competition_sent: false };
    const isAuditedToday = agentTaskToday.audited;

    // --- NEW: Subscribe to task store updates ---
    if (window.taskStore) {
        // Define the update function
        const updateProfileAuditButton = (newState) => {
            const updatedTask = newState.tasks[agentId]?.[todayDayIndex] || { audited: false };
            const isNowAudited = updatedTask.audited;
            
            const auditBtn = document.getElementById('perform-audit-btn');
            
            if (auditBtn) {
                const auditText = auditBtn.querySelector('.audit-status-text');
                const iconEl = auditBtn.querySelector('i');

                // Update button class
                if (isNowAudited) {
                    auditBtn.classList.add('audited');
                    auditBtn.classList.remove('pending');
                } else {
                    auditBtn.classList.add('pending');
                    auditBtn.classList.remove('audited');
                }
                
                // Update button icon and title
                auditBtn.title = isNowAudited ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
                if (iconEl) iconEl.className = `fas fa-${isNowAudited ? 'check-circle' : 'clipboard-check'}`;
                
                // Update text
                if (auditText) auditText.textContent = isNowAudited ? 'تم التدقيق' : 'التدقيق';
            }
        };

        // Subscribe
        window.taskStore.subscribe(updateProfileAuditButton);

        // Store the subscription for cleanup
        if (!window.profileStoreSubscription) {
            window.profileStoreSubscription = updateProfileAuditButton;
        } else {
            // If there was an old subscription, unsubscribe it first (though stopAllProfileTimers should have handled it)
            window.taskStore.unsubscribe(window.profileStoreSubscription);
            window.profileStoreSubscription = updateProfileAuditButton;
        }
    }

    const activeCompetition = agentCompetitions.find(c => c.is_active === true);
    const hasActiveCompetition = !!activeCompetition;
    const hasInactiveCompetition = !hasActiveCompetition && agentCompetitions.length > 0;

    let activeCompetitionCountdownHtml = '';
    if (activeCompetition && activeCompetition.ends_at) {
        const endDate = new Date(activeCompetition.ends_at);
        if (endDate.getTime() > new Date().getTime()) {
            // The content will be filled by the live countdown timer
            activeCompetitionCountdownHtml = `<div class="competition-countdown-header" data-end-date="${activeCompetition.ends_at}">
                <i class="fas fa-clock"></i> 
                <span>جاري حساب الوقت...</span>
            </div>`;
        }
    }

    // --- NEW: Create the audit button for the header ---
    // Modified: Always show audit button, clickable container
    const auditButtonHtml = `
        <button id="perform-audit-btn" class="header-audit-status-btn ${isAuditedToday ? 'audited' : 'pending'}" title="${isAuditedToday ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"'}">
            <i class="fas fa-${isAuditedToday ? 'check-circle' : 'clipboard-check'}"></i>
            <span class="audit-status-text">${isAuditedToday ? 'تم التدقيق' : 'التدقيق'}</span>
        </button>`;

    // Helper for audit days in Action Tab
    // --- تعديل: عرض أيام التدقيق المحددة فقط كعلامات (tags) ---
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']; 
    const auditDaysHtml = (agent.audit_days && agent.audit_days.length > 0)
        ? `<div class="audit-days-display">${agent.audit_days.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('')}</div>`
        : '<span class="day-tag-none">لا توجد أيام محددة</span>';

    // --- Defensive Programming: Centralize permission checks after data loading ---
    const canViewFinancials = isSuperAdmin || isAdmin || userPerms.agents?.view_financials;
    const canEditProfile = isSuperAdmin || isAdmin; // Or a specific permission
    const canViewAgentComps = isSuperAdmin || isAdmin || userPerms.agents?.can_view_competitions_tab;
    const canCreateComp = isSuperAdmin || isAdmin || userPerms.competitions?.can_create;
    const canEditComps = isSuperAdmin || isAdmin || userPerms.competitions?.manage_comps === 'full';
    const canManualRenew = isSuperAdmin || isAdmin; // Define who can manually renew

    // --- NEW: Calculate Renewal Info ---
    let renewalInfoHtml = '';
    if (agent.renewal_period && agent.renewal_period !== 'none') {
        const nextRenewal = calculateNextRenewalDate(agent);
        if (nextRenewal) {
            const now = new Date();
            const diffTime = nextRenewal - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const dateStr = nextRenewal.toLocaleDateString('ar-EG');
            const timeStr = nextRenewal.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
            
            renewalInfoHtml = `يُجدد في ${diffDays} أيام (${dateStr} الساعة ${timeStr})`;
        }
    }

    appContent.innerHTML = `
        <div class="profile-page-top-bar">
            <button id="back-btn" class="btn-secondary">&larr; عودة</button>
            ${renewalInfoHtml ? `<div id="renewal-date-display" class="countdown-timer">${renewalInfoHtml}</div>` : ''}
        </div>
        
        <div class="profile-header-v2">
            <div class="profile-avatar">
                ${agent.avatar_url ? `<img src="${agent.avatar_url}" alt="Avatar">` : '<i class="fas fa-user-astronaut"></i>'}
            </div>
            <div class="profile-main-info" data-agent-id="${agent._id}">
                <div class="profile-info-header">
                    <h1>${agent.name}</h1>
                    <div class="profile-badges">
                        ${hasActiveCompetition ? `<span class="status-badge active">مسابقة نشطة</span>${activeCompetitionCountdownHtml}` : ''}
                        ${hasInactiveCompetition ? `<span class="status-badge inactive">مسابقة غير نشطة</span>` : ''}
                    </div>
                </div>
                
                <div class="profile-info-grid">
                    <div class="info-item">
                        <span class="label">رقم الوكالة</span>
                        <span class="value agent-id-text" title="نسخ الرقم">${agent.agent_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">التصنيف</span>
                        <span class="value badge-classification">${agent.classification}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">المرتبة</span>
                        <span class="value badge-rank">${agent.rank || 'غير محدد'}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">معرف الدردشة</span>
                        <span class="value">${agent.telegram_chat_id || 'غير محدد'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">اسم المجموعة</span>
                        <span class="value">${agent.telegram_group_name || 'غير محدد'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">أيام التدقيق</span>
                        <div class="value audit-days-mini">${auditDaysHtml}</div>
                    </div>

                    <div class="info-item full-width">
                        <span class="label">روابط التلجرام</span>
                        <div class="value links-row">
                            ${agent.telegram_channel_url ? `<a href="${agent.telegram_channel_url}" target="_blank" class="telegram-link"><i class="fab fa-telegram-plane"></i> رابط القناة</a>` : '<span class="disabled-link">رابط القناة (غير محدد)</span>'}
                            ${agent.telegram_group_url ? `<a href="${agent.telegram_group_url}" target="_blank" class="telegram-link"><i class="fab fa-telegram-plane"></i> رابط الجروب</a>` : '<span class="disabled-link">رابط الجروب (غير محدد)</span>'}
                        </div>
                    </div>
                </div>
                
                <div class="profile-header-actions-row">
                     ${auditButtonHtml}
                     <button id="edit-profile-btn" class="btn-secondary"><i class="fas fa-user-edit"></i> تعديل</button>
                </div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-link active" data-tab="action">Action</button>
            <button class="tab-link" data-tab="details">تفاصيل</button>
            <button class="tab-link" data-tab="agent-competitions">المسابقات</button>
            <button class="tab-link" data-tab="log">سجل</button>
            ${(isSuperAdmin || isAdmin) ? '<button class="tab-link" data-tab="analytics">تحليلات</button>' : ''}
        </div>

        <div id="tab-action" class="tab-content active">
            <div class="action-tab-grid">
                <div class="action-section">
                    <h2><i class="fas fa-info-circle"></i> بيانات تلقائية</h2>
                    <div class="action-info-grid">
                        <div class="action-info-card">
                            <i class="fas fa-calendar-check"></i>
                            <div class="info">
                                <label>أيام التدقيق</label>
                                <div class="value-group">${auditDaysHtml}</div>
                            </div>
                        </div>
                        <div class="action-info-card">
                            <i class="fas fa-wallet"></i>
                            <div class="info">
                                <label>الرصيد المتبقي</label>
                                <p>$${Math.max(0, agent.remaining_balance || 0)}</p>
                            </div>
                        </div>
                        <div class="action-info-card">
                            <i class="fas fa-gift"></i>
                            <div class="info">
                                <label>بونص الإيداع</label>
                                <p>${Math.max(0, agent.remaining_deposit_bonus || 0)} <span class="sub-value">مرات بنسبة</span> ${agent.deposit_bonus_percentage || 0}%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="action-section">
                    <h2><i class="fas fa-rocket"></i> إجراءات سريعة</h2>
                    <div class="details-actions">
                        <button id="create-agent-competition" class="btn-primary"><i class="fas fa-magic"></i> إنشاء مسابقة</button>
                        <button id="select-agent-winners" class="btn-winners"><i class="fas fa-trophy"></i> اختيار الفائزين</button>
                        <button id="send-bonus-cliche-btn" class="btn-telegram-bonus"><i class="fas fa-paper-plane"></i> إرسال كليشة البونص</button>
                        <button id="send-winners-cliche-btn" class="btn-telegram-winners"><i class="fas fa-trophy"></i> إرسال كليشة الفائزين</button>
                        ${canManualRenew ? `<button id="manual-renew-btn" class="btn-renewal"><i class="fas fa-sync-alt"></i> تجديد الرصيد يدوياً</button>` : ''}
                    </div>
                </div>
            </div>
        </div>
        <div id="tab-details" class="tab-content">
            <!-- Content will be rendered here -->
        </div>
        <div id="tab-agent-competitions" class="tab-content">
            <!-- Content will be rendered here -->
        </div>
        <div id="tab-log" class="tab-content">
            <h2>سجل النشاط</h2>
            <p>لا توجد سجلات حالياً لهذا الوكيل.</p>
        </div>
        <div id="tab-analytics" class="tab-content">
            <!-- Analytics content will be rendered here -->
        </div>
    `;
 
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.hash = '#manage-agents';
    });

    // Click to copy agent ID from header
    const agentIdEl = appContent.querySelector('.profile-main-info .agent-id-text');
    if (agentIdEl) {
        agentIdEl.addEventListener('click', () => {
            navigator.clipboard.writeText(agent.agent_id).then(() => showToast(`تم نسخ الرقم: ${agent.agent_id}`, 'info'));
        });
    }

    const createCompBtn = document.getElementById('create-agent-competition');
    if (createCompBtn) {
        if (canCreateComp) { // This will be migrated later
            createCompBtn.addEventListener('click', () => {
                // التحقق من تفعيل التدقيق قبل السماح بإنشاء مسابقة - REMOVED per user request
                /*
                if (!agent.is_auditing_enabled) {
                    showToast('عذراً، لا يمكن إنشاء مسابقة قبل إتمام عملية التدقيق لهذا الوكيل.', 'error');
                    return;
                }
                */
                window.location.hash = `competitions/new?agentId=${agent._id}`;
            });
        } else {
            createCompBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لإنشاء مسابقة.', 'error'));
        }
    }

    const selectWinnersBtn = document.getElementById('select-agent-winners');
    if (selectWinnersBtn) {
        selectWinnersBtn.addEventListener('click', () => window.location.hash = `winner-roulette?agent_id=${agent._id}`);
    }

    // --- NEW: Event listener for the new audit button ---
    const auditBtn = document.getElementById('perform-audit-btn');
    if (auditBtn) {
        // --- MODIFICATION: Make the button a toggle ---
        auditBtn.addEventListener('click', async () => {
            // --- REFACTOR: Centralize state management for immediate UI feedback ---
            const wasAudited = auditBtn.classList.contains('audited');
            const newAuditStatus = !wasAudited;
            const statusTextEl = auditBtn.querySelector('.audit-status-text');
            const iconEl = auditBtn.querySelector('i');
 
            auditBtn.disabled = true;
            if (iconEl) iconEl.className = 'fas fa-spinner fa-spin';
 
            // 1. Optimistically update the UI
            auditBtn.classList.toggle('pending', !newAuditStatus);
            auditBtn.classList.toggle('audited', newAuditStatus);
            if (iconEl) iconEl.className = `fas fa-${newAuditStatus ? 'check-circle' : 'clipboard-check'}`;
            if (statusTextEl) statusTextEl.textContent = newAuditStatus ? 'تم التدقيق' : 'التدقيق';
            auditBtn.title = newAuditStatus ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
 
            // 2. Call the new backend endpoint to toggle is_auditing_enabled
            try {
                // First, toggle the is_auditing_enabled field in the database
                const auditingResponse = await authedFetch(`/api/agents/${agent._id}/toggle-auditing`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_auditing_enabled: newAuditStatus })
                });

                if (!auditingResponse.ok) {
                    const errorData = await auditingResponse.json();
                    throw new Error(errorData.message || 'فشل تحديث حالة التدقيق في قاعدة البيانات');
                }

                // Then, update the daily task status
                await window.taskStore.updateTaskStatus(agent._id, todayDayIndex, 'audited', newAuditStatus);
                
                // Log this important activity
                const logMessage = `تم ${newAuditStatus ? 'تفعيل' : 'إلغاء تفعيل'} التدقيق للوكيل ${agent.name}`;
                await logAgentActivity(currentUserProfile?._id, agent._id, 'TASK_UPDATE', logMessage);

                showToast('تم تحديث حالة التدقيق بنجاح.', 'success');
                
                // Update local agent object
                agent.is_auditing_enabled = newAuditStatus;
            } catch (error) {
                console.error('[Audit Toggle Error]:', error);
                showToast(error.message || 'فشل تحديث حالة التدقيق.', 'error');
                // Revert UI on error
                auditBtn.classList.toggle('pending', wasAudited);
                auditBtn.classList.toggle('audited', !wasAudited);
                if (iconEl) iconEl.className = `fas fa-${wasAudited ? 'check-circle' : 'clipboard-check'}`;
                if (statusTextEl) statusTextEl.textContent = wasAudited ? 'تم التدقيق' : 'التدقيق';
                auditBtn.title = wasAudited ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
            } finally {
                auditBtn.disabled = false; // Re-enable the button
            }
        });
    }

    // --- NEW: Listen for real-time auditing updates ---
    const handleAuditingUpdate = (event) => {
        const data = event.detail;
        // Check if the update is for the currently displayed agent
        if (data.agentId === agent._id) {
            const auditBtn = document.getElementById('perform-audit-btn');
            
            if (auditBtn) {
                const newAuditStatus = data.isAuditingEnabled;
                const iconEl = auditBtn.querySelector('i');
                const statusTextEl = auditBtn.querySelector('.audit-status-text');

                auditBtn.classList.toggle('pending', !newAuditStatus);
                auditBtn.classList.toggle('audited', newAuditStatus);
                if (iconEl) iconEl.className = `fas fa-${newAuditStatus ? 'check-circle' : 'clipboard-check'}`;
                if (statusTextEl) statusTextEl.textContent = newAuditStatus ? 'تم التدقيق' : 'التدقيق';
                auditBtn.title = newAuditStatus ? 'إلغاء التدقيق' : 'تمييز كـ "تم التدقيق"';
                
                // Update local agent object to keep state consistent
                agent.is_auditing_enabled = newAuditStatus;
            }
        }
    };
    
    // --- NEW: Listen for real-time competition updates ---
    const handleCompetitionUpdate = (event) => {
        const data = event.detail;
        if (data.agentId === agent._id) {
            // Refresh the profile page to show the new competition status
            // Ideally we would just update the DOM, but reloading the profile function is safer to ensure all state (timers, badges) is correct.
            console.log('[Profile] Received competition update, refreshing view...');
            
            // Update the header badge immediately for better UX
            const headerTitle = document.querySelector('.profile-main-info h1');
            if (headerTitle) {
                if (data.type === 'created') {
                    // Remove existing badges
                    const existingBadges = headerTitle.querySelectorAll('.status-badge');
                    existingBadges.forEach(b => b.remove());
                    
                    // Add active badge
                    const badge = document.createElement('span');
                    badge.className = 'status-badge active';
                    badge.textContent = 'مسابقة نشطة';
                    headerTitle.appendChild(badge);
                } else if (data.type === 'completed') {
                     // Remove existing badges
                    const existingBadges = headerTitle.querySelectorAll('.status-badge');
                    existingBadges.forEach(b => b.remove());
                    
                    // Add inactive badge
                    const badge = document.createElement('span');
                    badge.className = 'status-badge inactive';
                    badge.textContent = 'مسابقة غير نشطة';
                    headerTitle.appendChild(badge);
                }
            }

            // Reload the full profile after a short delay to allow backend to settle
            setTimeout(() => {
                renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
            }, 1000);
        }
    };

    window.addEventListener('agent-auditing-update', handleAuditingUpdate);
    window.addEventListener('competition-update', handleCompetitionUpdate);
    
    // Add to cleanup list so it gets removed when navigating away
    if (window.profilePageEventListeners) {
        window.profilePageEventListeners.push({ element: window, type: 'agent-auditing-update', handler: handleAuditingUpdate });
        window.profilePageEventListeners.push({ element: window, type: 'competition-update', handler: handleCompetitionUpdate });
    }

    // --- Manual Renewal Button Logic ---
    const manualRenewBtn = document.getElementById('manual-renew-btn');
    if (manualRenewBtn) {
      manualRenewBtn.addEventListener('click', async () => {
        if (!agent.renewal_period || agent.renewal_period === 'none') {
            showToast('لا يوجد نظام تجديد مفعل لهذا الوكيل.', 'info');
            return;
        }

        // Calculate next renewal date (same logic as the countdown)
        const renewalBtn = manualRenewBtn;
        const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.created_at);
        let nextRenewalDate = new Date(lastRenewal);
        const period = agent.renewal_period;
        if (period === 'weekly') nextRenewalDate.setDate(lastRenewal.getDate() + 7);
        else if (period === 'biweekly') nextRenewalDate.setDate(lastRenewal.getDate() + 14);
        else if (period === 'monthly') nextRenewalDate.setMonth(lastRenewal.getMonth() + 1);

        if (new Date() < nextRenewalDate) {
            const remainingTime = nextRenewalDate - new Date();
            const days = Math.ceil(remainingTime / (1000 * 60 * 60 * 24)); // Use ceil to show "1 day" for any remaining time
            showToast(`لا يمكن التجديد الآن. متبقي ${days} يوم.`, 'warning');
            return;
        }

        // If eligible, show confirmation
        showConfirmationModal(
            `هل أنت متأكد من تجديد رصيد الوكيل <strong>${agent.name}</strong> يدوياً؟`,
            async () => {
                // Defensive: Disable button immediately
                renewalBtn.disabled = true;
                renewalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                const updateData = {
                    consumed_balance: 0,
                    remaining_balance: agent.competition_bonus,
                    used_deposit_bonus: 0,
                    remaining_deposit_bonus: agent.deposit_bonus_count,
                    last_renewal_date: new Date().toISOString()
                };

                // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message || 'فشل تجديد الرصيد.');
                    }
                    // --- FIX: Add correct logging for manual renewal ---
                    await logAgentActivity(currentUserProfile?._id, agent._id, 'MANUAL_RENEWAL', `تم تجديد الرصيد يدوياً للوكيل ${agent.name}.`, {
                        renewed_by: currentUserProfile?.full_name || 'غير معروف',
                        new_balance: agent.competition_bonus
                    });
                    showToast('تم تجديد الرصيد بنجاح.', 'success');
                    renderAgentProfilePage(agent._id, { activeTab: 'action' }); // Re-render the page
                } catch (error) {
                    showToast(`فشل تجديد الرصيد: ${error.message}`, 'error');
                    // Defensive: Re-enable button on failure
                    renewalBtn.disabled = false;
                    renewalBtn.innerHTML = '<i class="fas fa-sync-alt"></i> تجديد الرصيد يدوياً';
                }
            },
            {
                title: 'تأكيد التجديد اليدوي',
                confirmText: 'نعم، جدد الآن',
                confirmClass: 'btn-renewal'
            }
        );
      });
    }

    document.getElementById('send-bonus-cliche-btn').addEventListener('click', async () => {
        // 1. Construct the message
        const baseLine = `يسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات:`

        // --- NEW: Add renewal period text ---
        const renewalPeriodMap = {
            'weekly': 'أسبوعي',
            'biweekly': 'كل أسبوعين',
            'monthly': 'شهري'
        };
        const renewalValue = (agent.renewal_period && agent.renewal_period !== 'none') 
            ? (renewalPeriodMap[agent.renewal_period] || '')
            : '';

        // --- تعديل: بناء نص المميزات حسب الشكل الجديد ---
        let benefitsText = '';
        const remainingBalance = agent.remaining_balance || 0;
        const remainingDepositBonus = agent.remaining_deposit_bonus || 0;

        if (remainingBalance > 0) {
            benefitsText += `💰 <b>بونص تداولي:</b> <code>${remainingBalance}$</code>\n`;
        }
        // إخفاء سطر بونص الإيداع لمرتبتي BEGINNING ووكيل حصري بدون مرتبة
        const hideDepositBonusRanks = ['BEGINNING', 'وكيل حصري بدون مرتبة'];
        const shouldHideDepositBonus = hideDepositBonusRanks.includes(agent.rank);
        if (remainingDepositBonus > 0 && !shouldHideDepositBonus) {
            benefitsText += `🎁 <b>بونص ايداع:</b> <code>${remainingDepositBonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
        }

        // إذا لم تكن هناك أي مميزات، لا تقم بالإرسال
        if (!benefitsText.trim()) {
            showToast('لا توجد أرصدة متاحة لإرسال كليشة البونص لهذا الوكيل.', 'info');
            return;
        }
        
        const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...

${baseLine}
${renewalValue ? `(<b>${renewalValue}</b>):\n\n` : ''}${benefitsText.trim()}

بامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.

هل ترغب بارسال مسابقة لحضرتك?`;

        // --- Verification Logic ---
        let targetGroupInfo = 'المجموعة العامة';
        // --- FIX: Check for chat_id first and show a clear error if it's missing ---
        if (!agent.telegram_chat_id) {
            showToast('لا يمكن الإرسال. معرف مجموعة التلجرام غير مسجل لهذا الوكيل.', 'error');
            return; // Stop the process
        }

        if (agent.telegram_chat_id && agent.telegram_group_name) {
            try {
                showToast('جاري التحقق من بيانات المجموعة...', 'info');
                const response = await authedFetch(`/api/get-chat-info?chatId=${agent.telegram_chat_id}`);
                const data = await response.json();
                // --- FIX: Handle 404 Not Found specifically ---
                if (response.status === 404) {
                    throw new Error('المجموعة غير موجودة أو تم طرد البوت منها.');
                } else if (!response.ok) {
                    throw new Error(data.message || 'فشل التحقق من بيانات المجموعة.');
                }

                const actualGroupName = data.title;
                if (actualGroupName.trim() !== agent.telegram_group_name.trim()) {
                    showToast(`<b>خطأ في التحقق:</b> اسم المجموعة المسجل (<b>${agent.telegram_group_name}</b>) لا يطابق الاسم الفعلي على تلجرام (<b>${actualGroupName}</b>). يرجى تصحيح البيانات.`, 'error');
                    return; // Stop the process
                }
                // Verification successful
                targetGroupInfo = `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong> (تم التحقق بنجاح)`;

            } catch (error) {
                showToast(`فشل التحقق من المجموعة: ${error.message}`, 'error');
                return; // Stop the process
            }
        } else if (agent.telegram_chat_id) {
            showToast('لا يمكن التحقق. اسم المجموعة غير مسجل لهذا الوكيل.', 'warning');
            return;
        }
        // --- End Verification Logic ---

        // Show confirmation modal only after successful verification (if applicable)
        showConfirmationModal(
            `<p>سيتم إرسال الرسالة إلى: ${targetGroupInfo}. هل أنت متأكد من المتابعة؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                try {
                    if (!agent.telegram_chat_id) throw new Error('معرف مجموعة تلجرام غير موجود لهذا الوكيل.');
                    const response = await authedFetch('/api/post-announcement', { // This will be migrated لاحقاً
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });
                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message || 'فشل الاتصال بالخادم.');
                    }
                    showToast('تم إرسال كليشة البونص إلى تلجرام بنجاح.', 'success');
                    // --- FIX: Add correct logging for sending bonus cliche ---
                    await logAgentActivity(currentUserProfile?._id, agent._id, 'BONUS_CLICHE_SENT', `تم إرسال كليشة تذكير البونص إلى تلجرام.`, {
                        sent_by: currentUserProfile?.full_name
                    });
                } catch (error) {
                    showToast(`فشل إرسال الكليشة: ${error.message}`, 'error');
                }
            },
            {
                title: 'إرسال رسالة البونص',
                confirmText: 'إرسال',
                confirmClass: 'btn-telegram-bonus',
                modalClass: 'modal-wide'
            }
        );
    });

    document.getElementById('send-winners-cliche-btn').addEventListener('click', async () => {
        // --- NEW: Use centralized verification function ---
        const verification = await verifyTelegramChat(agent);
        if (!verification.verified) {
            return;
        }
        const targetGroup = `مجموعة الوكيل: <strong>${agent.telegram_group_name}</strong> (تم التحقق)`;
        // --- End Verification ---
        // Defensive: Find active competition, but handle if it's not found
        const activeCompetition = agentCompetitions.find(c => c.is_active);

        const clicheText = `الأساتذة الكرام،

نحيطكم علمًا بانتهاء مدة المشاركة في المسابقة الأخيرة.
🔹 الإجابة الصحيحة: ${activeCompetition?.correct_answer || 'غير محددة'}

يرجى تزويدنا برابط منشور المسابقة من قناتكم ليقوم القسم المختص باختيار الفائزين والتحقق من بياناتهم، ثم إرسال الأسماء إليكم للإعلان عنها.

مع خالص التقدير،
إدارة المسابقات – انزو`;

        // Show confirmation modal before sending
        showConfirmationModal(
            `<p>سيتم إرسال الرسالة إلى: ${targetGroup}. هل أنت متأكد من المتابعة؟</p>
             <textarea class="modal-textarea-preview" readonly>${clicheText}</textarea>`,
            async () => {
                // Send to backend on confirmation
                try {
                    if (!agent.telegram_chat_id) throw new Error('معرف مجموعة تلجرام غير موجود لهذا الوكيل.');
                    const response = await authedFetch('/api/post-announcement', { // This will be migrated لاحقاً
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                        body: JSON.stringify({ message: clicheText, chatId: agent.telegram_chat_id })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'فشل الاتصال بالخادم.');

                    showToast('تم إرسال طلب اختيار الفائزين إلى تلجرام بنجاح.', 'success');
                    // --- FIX: Add correct logging for winner selection request ---
                    await logAgentActivity(currentUserProfile?._id, agent._id, 'WINNERS_SELECTION_REQUESTED', `تم إرسال طلب اختيار الفائزين لمسابقة "${activeCompetition?.name || 'الأخيرة'}".`, {
                        sent_by: currentUserProfile?.full_name
                    });
                } catch (error) {
                    showToast(`فشل إرسال الطلب: ${error.message}`, 'error');
                }
            },
            {
                title: 'طلب اختيار الفائزين',
                confirmText: 'إرسال',
                confirmClass: 'btn-telegram-winners',
                modalClass: 'modal-wide'
            }
        );
    });

    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
        if (canEditProfile) { // This will be migrated later
            editBtn.addEventListener('click', () => renderEditProfileHeader(agent));
        } else {
            editBtn.addEventListener('click', () => showToast('ليس لديك صلاحية لتعديل بيانات الوكيل.', 'error'));
        }
    }

    if (startInEditMode) {
        editBtn.click();
    }

    // Tab switching logic
    const tabLinks = appContent.querySelectorAll('.tab-link');
    const tabContents = appContent.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;

            // If clicking on "المسابقات" tab, redirect to agent-competitions page
            if (tabId === 'agent-competitions') {
                window.location.href = `/pages/agent-competitions.html?agent_id=${agent._id}`;
                return;
            }

            // Deactivate all
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate the clicked one
            link.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // Set the default active tab
    appContent.querySelector(`.tab-link[data-tab="${defaultTab}"]`)?.click();

    // Render competitions in the log tab
    const detailsTabContent = document.getElementById('tab-details');
    const logTabContent = document.getElementById('tab-log');
    const agentCompetitionsContent = document.getElementById('tab-agent-competitions'); // This will be migrated later
    const analyticsTabContent = document.getElementById('tab-analytics');

    // --- NEW: Render tab content based on permissions ---
    if (detailsTabContent) {
        if (!canViewFinancials) {
            detailsTabContent.innerHTML = `
                <div class="access-denied-container">
                    <i class="fas fa-lock"></i>
                    <h2>ليس لديك صلاحية وصول</h2>
                    <p>أنت لا تملك الصلاحية اللازمة لعرض التفاصيل المالية لهذا الوكيل.</p>
                </div>`;
        } else {
            renderDetailsView(agent);
            // Removed renderBalanceHistoryChart from here as it is now in Analytics tab
        }
    }

    if (logTabContent) {
        if (agentLogs && agentLogs.length > 0) {
            const { html, initFunction } = generateAgentActivityLogHTML(agentLogs);
            logTabContent.innerHTML = html;
            // Execute initialization function after HTML is inserted
            setTimeout(() => initFunction(), 0);
        } else {
            logTabContent.innerHTML = '<h2>سجل النشاط</h2><p>لا توجد سجلات حالياً لهذا الوكيل.</p>';
        }
    }
    // This will be migrated later
    if (analyticsTabContent && (isSuperAdmin || isAdmin)) {
        // --- FIX: Check if agent exists before rendering analytics ---
        if (agent && agent._id) {
            renderAgentAnalytics(agent, analyticsTabContent);
        } else {
            analyticsTabContent.innerHTML = '<p class="error">بيانات الوكيل غير متوفرة.</p>';
        }
    }
    if (agentCompetitionsContent) {
        if (agentCompetitions && agentCompetitions.length > 0) {
            if (!canViewAgentComps) {
                agentCompetitionsContent.innerHTML = `
                    <div class="access-denied-container"> 
                        <i class="fas fa-lock"></i>
                        <h2>ليس لديك صلاحية وصول</h2>
                        <p>أنت لا تملك الصلاحية اللازمة لعرض مسابقات هذا الوكيل.</p>
                    </div>`;
                // Stop further processing for this tab
                startCompetitionCountdowns(); // Still need to start other timers
                return;
            }
            const activeAndPendingCompetitions = agentCompetitions.filter(c => c.status !== 'completed');
            const completedCompetitions = agentCompetitions.filter(c => c.status === 'completed' || c.status === 'archived'); // Defensive: include archived

            const renderCompetitionList = (competitions) => {
                return competitions.map(comp => {
                    const endDate = comp.ends_at ? new Date(comp.ends_at) : null;
                    let countdownHtml = '';
                    if (endDate && comp.status !== 'completed' && comp.status !== 'awaiting_winners') {
                        const diffTime = endDate.getTime() - new Date().getTime();
                        if (diffTime > 0) {
                            countdownHtml = `<div class="competition-countdown" data-end-date="${comp.ends_at}"><i class="fas fa-hourglass-half"></i> <span>جاري حساب الوقت...</span></div>`;
                        } else {
                            countdownHtml = `<div class="competition-countdown expired"><i class="fas fa-hourglass-end"></i> في انتظار المعالجة...</div>`;
                        }
                    }

                    const statusSteps = {
                        'sent': { text: 'تم الإرسال', step: 1, icon: 'fa-paper-plane' },
                        'awaiting_winners': { text: 'في انتظار الفائزين', step: 2, icon: 'fa-user-clock' },
                        'completed': { text: 'مكتملة', step: 3, icon: 'fa-check-double' }
                    };
                    const currentStatus = statusSteps[comp.status] || statusSteps['sent'];

                    const progressBarHtml = `
                        <div class="stepper-wrapper step-${currentStatus.step}">
                            ${Object.values(statusSteps).map((s, index) => {
                                const isLineCompleted = currentStatus.step > index + 1; // Line is complete if the next step is reached
                                return `
                                <div class="stepper-item ${currentStatus.step >= s.step ? 'completed' : ''}" title="${s.text}">
                                    <div class="step-counter">
                                        ${currentStatus.step > s.step ? '<i class="fas fa-check"></i>' : s.step}
                                    </div>
                                    <div class="step-name">${s.text}</div>
                                </div>
                                ${index < Object.values(statusSteps).length - 1 ? `<div class="stepper-line ${isLineCompleted ? 'completed' : ''}"></div>` : ''}
                            `}).join('')}
                        </div>
                    `;

                    return `
                    <div class="competition-card">
                        <div class="competition-card-header">
                            <h3>${comp.name}</h3>
                            <div class="header-right-content">
                                ${countdownHtml}
                                <span class="status-badge-v2 status-${comp.status}">${currentStatus.text}</span>
                            </div>
                        </div>
                        <div class="competition-card-body">
                            <div class="competition-status-tracker">${progressBarHtml}</div>
                            <div class="competition-details-grid">
                                <p class="competition-detail-item"><i class="fas fa-users"></i><strong>عدد الفائزين:</strong> ${comp.winners_count || 0}</p>
                                <p class="competition-detail-item"><i class="fas fa-dollar-sign"></i><strong>الجائزة للفائز:</strong> ${comp.prize_per_winner ? comp.prize_per_winner.toFixed(2) : '0.00'}</p>
                                <!-- NEW: Display both expected and actual winner selection dates -->
                                <p class="competition-detail-item"><i class="fas fa-calendar-alt"></i><strong>تاريخ اختيار الفائز:</strong> ${comp.ends_at ? new Date(comp.ends_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '<em>غير محدد</em>'}</p>
                                ${comp.processed_at ? `
                                    <p class="competition-detail-item"><i class="fas fa-calendar-check"></i><strong>تاريخ المعالجة الفعلي:</strong> ${new Date(comp.processed_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                ` : ''}
                                <p class="competition-detail-item"><i class="fas fa-eye"></i><strong>المشاهدات:</strong> ${formatNumber(comp.views_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-heart"></i><strong>التفاعلات:</strong> ${formatNumber(comp.reactions_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-user-check"></i><strong>المشاركات:</strong> ${formatNumber(comp.participants_count)}</p>
                                <p class="competition-detail-item"><i class="fas fa-gift"></i><strong>عدد فائزين بونص الإيداع:</strong> ${comp.deposit_winners_count || 0}</p>
                                <p class="competition-detail-item"><i class="fas fa-percent"></i><strong>نسبة بونص الإيداع:</strong> ${typeof comp.deposit_bonus_percentage === 'number' ? `${comp.deposit_bonus_percentage}%` : '-'}</p>
                                <p class="competition-detail-item"><i class="fas fa-key"></i><strong>الإجابة الصحيحة:</strong> ${comp.correct_answer || '<em>غير محددة</em>'}</p>
                            </div>
                        </div>
                        <div class="competition-card-footer">
                            ${comp.status === 'awaiting_winners' ? `<button class="btn-primary complete-competition-btn" data-id="${comp.id}" data-name="${comp.name}"><i class="fas fa-check-double"></i> تم اختيار الفائزين</button>` : ''}
                            ${canEditComps ? `<button class="btn-danger delete-competition-btn" data-id="${comp._id}"><i class="fas fa-trash-alt"></i> حذف</button>` : ''}
                        </div>
                    </div>
                `}).join('');
            };

            agentCompetitionsContent.innerHTML = `
                <div class="competitions-list-profile">
                    ${renderCompetitionList(activeAndPendingCompetitions)}
                </div>
                ${completedCompetitions.length > 0 ? `
                    <details class="completed-competitions-group">
                        <summary>
                            <i class="fas fa-archive"></i> المسابقات المكتملة (${completedCompetitions.length})
                        </summary>
                        <div class="competitions-list-profile">
                            ${renderCompetitionList(completedCompetitions)}
                        </div>
                    </details>
                ` : ''}
            `;
        } else {
            if (canViewAgentComps) {
                agentCompetitionsContent.innerHTML = '<p>لا توجد مسابقات خاصة بهذا الوكيل بعد.</p>';
            }
        }
    }

    if (agentCompetitionsContent) {
        agentCompetitionsContent.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-competition-btn');
            const completeBtn = e.target.closest('.complete-competition-btn');

            if (completeBtn) {
                const id = completeBtn.dataset.id;
                const name = completeBtn.dataset.name;

                // --- NEW: Show modal with required fields before completing ---
                const modalContent = `
                    <p>لإكمال مسابقة "<strong>${name}</strong>"، يرجى إدخال البيانات التالية:</p>
                    <div class="form-layout" style="margin-top: 15px;">
                        <div class="form-group">
                            <label for="comp-views-count">عدد المشاهدات</label>
                            <input type="number" id="comp-views-count" class="modal-input" required min="0">
                        </div>
                        <div class="form-group">
                            <label for="comp-reactions-count">عدد التفاعلات</label>
                            <input type="number" id="comp-reactions-count" class="modal-input" required min="0">
                        </div>
                        <div class="form-group">
                            <label for="comp-participants-count">عدد المشاركات</label>
                            <input type="number" id="comp-participants-count" class="modal-input" required min="0">
                        </div>
                    </div>
                `;

                showConfirmationModal(
                    modalContent,
                    async () => {
                        const views = document.getElementById('comp-views-count').value;
                        const reactions = document.getElementById('comp-reactions-count').value;
                        const participants = document.getElementById('comp-participants-count').value;

                        const parsedViews = Number(views);
                        const parsedReactions = Number(reactions);
                        const parsedParticipants = Number(participants);

                        const updateData = {
                            status: 'completed',
                            is_active: false,
                            // Ensure numeric values are valid non-negative integers
                            views_count: Number.isFinite(parsedViews) && parsedViews >= 0 ? parsedViews : 0,
                            reactions_count: Number.isFinite(parsedReactions) && parsedReactions >= 0 ? parsedReactions : 0,
                            participants_count: Number.isFinite(parsedParticipants) && parsedParticipants >= 0 ? parsedParticipants : 0,
                            // Record processing timestamp for analytics and auditing
                            processed_at: new Date().toISOString()
                        };

                        const response = await authedFetch(`/api/competitions/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                            body: JSON.stringify(updateData)
                        });

                        if (!response.ok) {
                            let serverMsg = 'فشل إكمال المسابقة.';
                            try {
                                const txt = await response.text();
                                serverMsg = (JSON.parse(txt).message) || serverMsg;
                            } catch (_) {}
                            showToast(serverMsg, 'error');
                        } else {
                            showToast('تم إكمال المسابقة بنجاح.', 'success');
                            // --- FIX: Add correct logging for competition completion ---
                            await logAgentActivity(currentUserProfile?._id, agent._id, 'COMPETITION_COMPLETED', `تم إكمال مسابقة "${name}" وتسجيل الأداء.`, {
                                completed_by: currentUserProfile?.full_name,
                                performance: updateData
                            });
                            renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                        }
                    }, {
                        title: 'إكمال المسابقة وتسجيل الأداء',
                        confirmText: 'نعم، اكتملت',
                        confirmClass: 'btn-primary',
                        onRender: (modal) => {
                            const confirmBtn = modal.querySelector('#confirm-btn');
                            const inputs = modal.querySelectorAll('.modal-input');
                            confirmBtn.disabled = true; // Disable by default

                            inputs.forEach(input => input.addEventListener('input', () => {
                                const allFilled = Array.from(inputs).every(i => i.value.trim() !== '' && parseInt(i.value, 10) >= 0 && i.value !== '');
                                confirmBtn.disabled = !allFilled;
                            }));
                        }
                    }
                );
                return; // Stop further execution
            }

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (!id) return;
        
                showConfirmationModal(
                    'هل أنت متأكد من حذف هذه المسابقة؟<br><small>لا يمكن التراجع عن هذا الإجراء.</small>',
                    async () => {
                        const response = await authedFetch(`/api/competitions/${id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const result = await response.json();
                            showToast(result.message || 'فشل حذف المسابقة.', 'error');
                            return;
                        }
                        showToast('تم حذف المسابقة بنجاح.', 'success');
                        // --- FIX: Add correct logging for competition deletion ---
                        await logAgentActivity(currentUserProfile?._id, agent._id, 'COMPETITION_DELETED', `تم حذف مسابقة من سجل الوكيل.`, {
                            deleted_by: currentUserProfile?.full_name
                        });
                        renderAgentProfilePage(agent._id, { activeTab: 'agent-competitions' });
                    }, {
                        title: 'تأكيد الحذف',
                        confirmText: 'حذف',
                        confirmClass: 'btn-danger'
                    });
            }
        });
    }

    // Start live countdowns for competitions
    startCompetitionCountdowns(); // This will be migrated later

    // Display the next renewal date, which is now fully independent
    displayNextRenewalDate(agent); // This will be migrated later
}

/**
 * NEW: Renders an editor for the main profile header fields.
 * @param {object} agent The agent object to edit.
 */
function renderEditProfileHeader(agent) {
    // Defensive: Check for required permissions
    const canEditProfile = currentUserProfile?.role === 'super_admin' || currentUserProfile?.role === 'admin';
    if (!canEditProfile) {
        showToast('ليس لديك صلاحية لتعديل بيانات الوكيل.', 'error');
        return;
    }

    const headerContainer = document.querySelector('.profile-main-info');
    // CHANGED: Select the new actions row
    const actionsContainer = document.querySelector('.profile-header-actions-row');
    
    if (!headerContainer || !actionsContainer) return;

    // --- تعديل: إضافة محدد أيام التدقيق ---
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const auditDaysEditorHtml = `
        <div class="form-group" style="grid-column: 1 / -1; margin-top: 10px;"> 
            <label style="margin-bottom: 10px;">أيام التدقيق</label>
            <div class="days-selector-v2" id="header-edit-audit-days">
                ${dayNames.map((day, index) => `
                    <div class="day-toggle-wrapper">
                        <input type="checkbox" id="day-header-edit-${index}" value="${index}" class="day-toggle-input" ${(agent.audit_days || []).includes(index) ? 'checked' : ''}>
                        <label for="day-header-edit-${index}" class="day-toggle-btn">${day}</label>
                    </div>`).join('')}
            </div>
        </div>
    `;

    headerContainer.innerHTML = `
        <div class="form-layout-grid" style="gap: 10px;">
            <div class="form-group"><label>اسم الوكيل</label><input type="text" id="header-edit-name" value="${agent.name || ''}"></div>
            <div class="form-group"><label>رقم الوكالة</label><input type="text" id="header-edit-agent-id" value="${agent.agent_id || ''}"></div>
            <div class="form-group">
                <label>التصنيف</label>
                <select id="header-edit-classification">
                    <option value="R" ${agent.classification === 'R' ? 'selected' : ''}>R</option>
                    <option value="A" ${agent.classification === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${agent.classification === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${agent.classification === 'C' ? 'selected' : ''}>C</option>
                </select>
            </div>
            <div class="form-group"><label>معرف الدردشة</label><input type="text" id="header-edit-chatid" value="${agent.telegram_chat_id || ''}"></div>
            <div class="form-group"><label>اسم المجموعة</label><input type="text" id="header-edit-groupname" value="${agent.telegram_group_name || ''}"></div>
            <div class="form-group" style="grid-column: 1 / -1;"><label>رابط القناة</label><input type="text" id="header-edit-channel" value="${agent.telegram_channel_url || ''}"></div>
            <div class="form-group" style="grid-column: 1 / -1;"><label>رابط الجروب</label><input type="text" id="header-edit-group" value="${agent.telegram_group_url || ''}"></div>
            ${auditDaysEditorHtml}
        </div>
        <div class="profile-header-actions-row" style="justify-content: flex-end; margin-top: 20px;">
            <button id="header-save-btn" class="btn-primary"><i class="fas fa-check"></i> حفظ</button>
            <button id="header-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i> إلغاء</button>
        </div>
    `;

    const saveBtn = document.getElementById('header-save-btn');
    const cancelBtn = document.getElementById('header-cancel-btn');

    cancelBtn.addEventListener('click', () => {
        // Re-render the page to restore original state and listeners
        renderAgentProfilePage(agent._id);
    });

    saveBtn.addEventListener('click', async () => {
        console.log('🚀 [SAVE BUTTON] Clicked! Starting save process...');
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // --- تعديل: قراءة أيام التدقيق المحددة ---
        const selectedDays = Array.from(document.querySelectorAll('#header-edit-audit-days .day-toggle-input:checked')).map(input => parseInt(input.value, 10));

        const newClassification = document.getElementById('header-edit-classification').value;
        const oldClassification = agent.classification;

        // Check if classification changed
        if (newClassification !== oldClassification) {
            // Show classification change modal
            showClassificationChangeModal(agent, newClassification, async (reason, action) => {
                
                // --- تحديث: تحديث competitions_per_week تلقائياً بناءً على التصنيف الجديد ---
                let competitionsPerWeek = agent.competitions_per_week || 1; // القيمة الافتراضية
                if (newClassification === 'R' || newClassification === 'A') {
                    competitionsPerWeek = 2;
                } else if (newClassification === 'B' || newClassification === 'C') {
                    competitionsPerWeek = 1;
                }
                
                const updatedData = {
                    name: document.getElementById('header-edit-name').value,
                    agent_id: document.getElementById('header-edit-agent-id').value.trim(),
                    telegram_channel_url: document.getElementById('header-edit-channel').value,
                    telegram_group_url: document.getElementById('header-edit-group').value,
                    telegram_chat_id: document.getElementById('header-edit-chatid').value,
                    telegram_group_name: document.getElementById('header-edit-groupname').value,
                    classification: newClassification,
                    competitions_per_week: competitionsPerWeek, // تحديث عدد المسابقات الأسبوعية
                    audit_days: selectedDays
                };

                try {
                    const response = await authedFetch(`/api/agents/${agent._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData)
                    });

                    if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message || 'فشل تحديث البيانات.');
                    }

                    // Record classification change
                    const classificationChangeResponse = await authedFetch(`/api/agents/${agent._id}/classification-change`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            old_classification: oldClassification,
                            new_classification: newClassification,
                            reason: reason,
                            action_taken: action
                        })
                    });

                    if (!classificationChangeResponse.ok) {
                        console.error('Failed to record classification change:', await classificationChangeResponse.text());
                    }

                    showToast('تم تحديث التصنيف وتسجيل السبب والإجراء بنجاح.', 'success');
                    renderAgentProfilePage(agent._id);

                } catch (error) {
                    showToast(`فشل الحفظ: ${error.message}`, 'error');
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
                }
            }, () => {
                // On cancel, re-enable save button
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
            });
            
            return; // IMPORTANT: Stop here and wait for modal
        }

        // Normal save flow (no classification change)
        const updatedData = {
            name: document.getElementById('header-edit-name').value,
            agent_id: document.getElementById('header-edit-agent-id').value.trim(),
            telegram_channel_url: document.getElementById('header-edit-channel').value,
            telegram_group_url: document.getElementById('header-edit-group').value,
            telegram_chat_id: document.getElementById('header-edit-chatid').value,
            telegram_group_name: document.getElementById('header-edit-groupname').value,
            classification: newClassification,
            audit_days: selectedDays
        };

        try {
            const response = await authedFetch(`/api/agents/${agent._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'فشل تحديث البيانات.');
            }

            showToast('تم تحديث بيانات الوكيل بنجاح.', 'success');
            renderAgentProfilePage(agent._id);

        } catch (error) {
            showToast(`فشل الحفظ: ${error.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
        }
    });
}


function startCompetitionCountdowns() {
    const countdownElements = document.querySelectorAll('.competition-countdown, .competition-countdown-header');
    if (countdownElements.length === 0) return;

    stopCompetitionCountdowns(); // Clear any existing intervals before starting new ones

    const updateElements = () => {
        let activeTimers = false;
        countdownElements.forEach(el => {
            if (!document.body.contains(el)) return;

            const endDateStr = el.dataset.endDate;
            if (!endDateStr) {
                el.innerHTML = ''; // Clear if no date
                return;
            }

            const endDate = new Date(endDateStr);
            const diffTime = endDate.getTime() - Date.now();

            if (diffTime <= 0) {
                el.innerHTML = `<i class="fas fa-hourglass-end"></i> <span>في انتظار المعالجة...</span>`;
                el.classList.add('expired');
            } else {
                activeTimers = true;
                const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                let daysText = '';
                if (days > 1) {
                    daysText = `${days} أيام`;
                } else if (days === 1) {
                    daysText = `يوم واحد`;
                } else { // Fallback for less than a day
                    daysText = 'أقل من يوم';
                }
                el.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>متبقي: ${daysText}</span>`;
            }
        });
        if (!activeTimers) stopCompetitionCountdowns();
    };

    updateElements();
    const intervalId = setInterval(updateElements, 1000);
    competitionCountdownIntervals.push(intervalId);
}

/**
 * Generates an advanced activity log table with filtering, sorting, pagination, and statistics.
 * @param {Array} logs - The array of log objects for the agent.
 * @returns {Object} Object containing html string and initialization function
 */
function generateAgentActivityLogHTML(logs) {
    const getLogIconDetails = (actionType) => {
        if (actionType.includes('CREATED')) return { icon: 'fa-user-plus', colorClass: 'icon-create', label: 'إنشاء', type: 'CREATE', bgColor: '#10b981' };
        if (actionType.includes('DELETED')) return { icon: 'fa-user-slash', colorClass: 'icon-delete', label: 'حذف', type: 'DELETE', bgColor: '#ef4444' };
        if (actionType.includes('PROFILE_UPDATE') || actionType.includes('UPDATED')) return { icon: 'fa-user-edit', colorClass: 'icon-update', label: 'تحديث', type: 'UPDATE', bgColor: '#3b82f6' };
        if (actionType.includes('MANUAL_RENEWAL') || actionType.includes('RENEWAL')) return { icon: 'fa-sync-alt', colorClass: 'icon-renewal', label: 'تجديد', type: 'RENEWAL', bgColor: '#8b5cf6' };
        if (actionType.includes('DETAILS_UPDATE')) return { icon: 'fa-cogs', colorClass: 'icon-details', label: 'تعديل تفاصيل', type: 'DETAILS', bgColor: '#f59e0b' };
        if (actionType.includes('COMPETITION')) return { icon: 'fa-trophy', colorClass: 'icon-competition', label: 'مسابقة', type: 'COMPETITION', bgColor: '#f97316' };
        if (actionType.includes('RANK_CHANGE')) return { icon: 'fa-layer-group', colorClass: 'icon-rank', label: 'تغيير مرتبة', type: 'RANK', bgColor: '#ec4899' };
        if (actionType.includes('TELEGRAM') || actionType.includes('WINNERS_SELECTION')) return { icon: 'fa-paper-plane', colorClass: 'icon-telegram', label: 'تلجرام', type: 'TELEGRAM', bgColor: '#06b6d4' };
        if (actionType.includes('VIEWED') || actionType.includes('VIEW')) return { icon: 'fa-eye', colorClass: 'icon-view', label: 'مشاهدة', type: 'VIEW', bgColor: '#64748b' };
        return { icon: 'fa-history', colorClass: 'icon-generic', label: 'نشاط', type: 'OTHER', bgColor: '#6b7280' };
    };

    // Generate unique ID for this log instance
    const logId = `activity-log-${Date.now()}`;

    // إحصائيات سريعة للأنشطة
    const stats = logs.reduce((acc, log) => {
        const type = getLogIconDetails(log.action_type).type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const totalActivities = logs.length;
    const recentActivities = logs.filter(log => (Date.now() - new Date(log.createdAt).getTime()) < 24 * 60 * 60 * 1000).length;

    const html = `
        <div class="activity-log-header" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:15px;margin-bottom:15px;">
                <div style="width:50px;height:50px;background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-history" style="color:#fff;font-size:22px;"></i>
                </div>
                <div>
                    <h3 style="margin:0;color:#fff;font-size:20px;font-weight:600;">سجل الأنشطة والعمليات</h3>
                    <p style="margin:5px 0 0;color:#94a3b8;font-size:14px;">تتبع جميع العمليات والتغييرات على حساب الوكيل</p>
                </div>
            </div>

            <div class="activity-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
                <div class="stat-item" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#3b82f6;margin-bottom:4px;">${totalActivities}</div>
                    <div style="font-size:12px;color:#94a3b8;">إجمالي الأنشطة</div>
                </div>
                <div class="stat-item" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#10b981;margin-bottom:4px;">${recentActivities}</div>
                    <div style="font-size:12px;color:#94a3b8;">آخر 24 ساعة</div>
                </div>
                <div class="stat-item" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#f59e0b;margin-bottom:4px;">${stats.UPDATE || 0}</div>
                    <div style="font-size:12px;color:#94a3b8;">التحديثات</div>
                </div>
                <div class="stat-item" style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#8b5cf6;margin-bottom:4px;">${stats.COMPETITION || 0}</div>
                    <div style="font-size:12px;color:#94a3b8;">المسابقات</div>
                </div>
            </div>
        </div>

        <div class="activity-log-table-container" id="${logId}-container" style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px;"></div>

        <div class="activity-log-pagination" id="${logId}-pagination" style="display:flex;justify-content:center;gap:10px;padding:15px;"></div>
    `;

    // Initialization function that will be called after HTML is inserted
    const initFunction = () => {
        let currentPage = 1;
        const itemsPerPage = 15;

        function groupLogsByDate(arr) {
            const groups = {};
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const todayStr = today.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            arr.forEach(log => {
                try {
                    if (!log.createdAt) return;
                    const logDate = new Date(log.createdAt);
                    if (isNaN(logDate.getTime())) return;
                    const logDateStr = logDate.toISOString().split('T')[0];
                    let dateKey;
                    if (logDateStr === todayStr) dateKey = '📅 اليوم';
                    else if (logDateStr === yesterdayStr) dateKey = '📅 الأمس';
                    else dateKey = `📅 ${logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}`;
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(log);
                } catch (error) {
                    console.error('Error processing log:', error);
                }
            });
            return groups;
        }

        function renderTable() {
            const container = document.getElementById(logId + '-container');
            if (!container) return;

            // Always sort by newest first
            const sorted = [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageLogs = sorted.slice(startIndex, endIndex);
            const groupedLogs = groupLogsByDate(pageLogs);

            let tableHtml = '';

            if (Object.keys(groupedLogs).length === 0) {
                tableHtml = `
                    <div class="no-logs-message" style="text-align:center;padding:60px 20px;color:#64748b;">
                        <div style="font-size:48px;margin-bottom:15px;">📋</div>
                        <h4 style="margin:0 0 10px;color:#94a3b8;">لا توجد سجلات نشاط</h4>
                        <p style="margin:0;font-size:14px;">لم يتم تسجيل أي أنشطة لهذا الوكيل بعد</p>
                    </div>`;
            } else {
                for (const date in groupedLogs) {
                    tableHtml += `
                        <div class="log-date-group" style="margin-bottom:25px;">
                            <div class="log-date-header" style="background:linear-gradient(135deg, #374151 0%, #4b5563 100%);color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:15px;font-weight:600;font-size:16px;display:flex;align-items:center;gap:10px;">
                                <span>${date}</span>
                                <span style="background:#6b7280;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;">${groupedLogs[date].length} نشاط</span>
                            </div>

                            <div class="activity-cards" style="display:grid;gap:12px;">`;

                    groupedLogs[date].forEach((log) => {
                        const iconDetails = getLogIconDetails(log.action_type);
                        const fullTime = new Date(log.createdAt).toLocaleString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                        const relativeTime = getRelativeTime(new Date(log.createdAt));
                        const isRecent = (Date.now() - new Date(log.createdAt).getTime()) < 5 * 60 * 1000;

                        // تحسين عرض الوصف
                        const rawDesc = log.description || '';
                        const cleanDesc = rawDesc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;">رابط</a>');
                        const maxLen = 150;
                        const isLong = cleanDesc.length > maxLen;
                        const shortText = isLong ? cleanDesc.slice(0, maxLen) + '...' : cleanDesc;

                        tableHtml += `
                            <div class="activity-card ${isRecent ? 'activity-recent' : ''}" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;position:relative;overflow:hidden;">
                                ${isRecent ? '<div class="recent-indicator" style="position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(to bottom, #10b981, #059669);"></div>' : ''}

                                <div class="activity-header" style="display:flex;align-items:center;gap:15px;margin-bottom:15px;">
                                    <div class="activity-icon" style="width:45px;height:45px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${iconDetails.bgColor};color:#fff;font-size:18px;">
                                        <i class="fas ${iconDetails.icon}"></i>
                                    </div>
                                    <div style="flex:1;">
                                        <div class="activity-type" style="font-weight:600;color:#fff;font-size:16px;margin-bottom:2px;">${iconDetails.label}</div>
                                        <div class="activity-meta" style="display:flex;gap:15px;font-size:13px;color:#94a3b8;">
                                            <span><i class="fas fa-user"></i> ${log.user_name || 'النظام'}</span>
                                            <span><i class="fas fa-clock"></i> ${fullTime}</span>
                                            <span style="color:#64748b;">${relativeTime}</span>
                                        </div>
                                    </div>
                                    <button class="activity-details-btn" data-log='${JSON.stringify(log)}' style="background:#374151;border:1px solid #4b5563;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#374151'">
                                        <i class="fas fa-info-circle"></i> تفاصيل
                                    </button>
                                </div>

                                <div class="activity-description" style="color:#cbd5e1;font-size:14px;line-height:1.5;">
                                    ${shortText}
                                    ${isLong ? `<button class="desc-toggle" style="background:none;border:none;color:#3b82f6;font-size:13px;cursor:pointer;margin-left:5px;" data-full="${cleanDesc.replace(/"/g,'&quot;')}" data-short="${shortText}">المزيد</button>` : ''}
                                </div>
                            </div>`;
                    });

                    tableHtml += `
                            </div>
                        </div>`;
                }
            }

            container.innerHTML = tableHtml;

            // Add event listeners for detail buttons
            container.querySelectorAll('.activity-details-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const log = JSON.parse(e.currentTarget.dataset.log);
                    showLogDetailsModal(log);
                });
            });

            // Toggle full/short description
            container.querySelectorAll('.desc-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const full = e.currentTarget.dataset.full;
                    const short = e.currentTarget.dataset.short;
                    const descDiv = e.currentTarget.parentElement;
                    const isExpanded = descDiv.innerHTML.includes('إخفاء');

                    if (isExpanded) {
                        descDiv.innerHTML = short + ` <button class="desc-toggle" style="background:none;border:none;color:#3b82f6;font-size:13px;cursor:pointer;margin-left:5px;" data-full="${full}" data-short="${short}">المزيد</button>`;
                    } else {
                        descDiv.innerHTML = full + ` <button class="desc-toggle" style="background:none;border:none;color:#3b82f6;font-size:13px;cursor:pointer;margin-left:5px;" data-full="${full}" data-short="${short}">إخفاء</button>`;
                    }
                });
            });

            renderPagination();
        }

        function renderPagination() {
            const pagination = document.getElementById(logId + '-pagination');
            if (!pagination) return;

            const totalPages = Math.ceil(logs.length / itemsPerPage);
            if (totalPages <= 1) {
                pagination.innerHTML = '';
                return;
            }

            let paginationHtml = `
                <div class="pagination-info" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 15px;color:#94a3b8;font-size:13px;">
                    عرض ${((currentPage - 1) * itemsPerPage) + 1} - ${Math.min(currentPage * itemsPerPage, logs.length)} من ${logs.length} نشاط
                </div>
                <div class="pagination-buttons" style="display:flex;gap:5px;">
                    <button class="pagination-btn" data-page="1" ${currentPage === 1 ? 'disabled' : ''} style="background:#374151;border:1px solid #4b5563;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer;${currentPage === 1 ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                        <i class="fas fa-angle-double-right"></i>
                    </button>
                    <button class="pagination-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} style="background:#374151;border:1px solid #4b5563;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer;${currentPage === 1 ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                        <i class="fas fa-angle-right"></i>
                    </button>`;

            for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                paginationHtml += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}" style="background:${i === currentPage ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#374151'};border:1px solid ${i === currentPage ? '#3b82f6' : '#4b5563'};color:#fff;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:${i === currentPage ? '600' : '400'};">${i}</button>`;
            }

            paginationHtml += `
                    <button class="pagination-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} style="background:#374151;border:1px solid #4b5563;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer;${currentPage === totalPages ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                        <i class="fas fa-angle-left"></i>
                    </button>
                    <button class="pagination-btn" data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''} style="background:#374151;border:1px solid #4b5563;color:#e2e8f0;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer;${currentPage === totalPages ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                        <i class="fas fa-angle-double-left"></i>
                    </button>
                </div>`;

            pagination.innerHTML = paginationHtml;

            // Add click handlers for pagination buttons
            pagination.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = parseInt(e.currentTarget.dataset.page);
                    if (page && page !== currentPage) {
                        currentPage = page;
                        renderTable();
                        document.getElementById(logId + '-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }

        function showLogDetailsModal(log) {
            const iconDetails = getLogIconDetails(log.action_type);
            const fullTime = new Date(log.createdAt).toLocaleString('ar-EG', {
                dateStyle: 'full',
                timeStyle: 'medium'
            });

            const modalContent = `
                <div class="log-details-modal" style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:0;">
                    <div class="log-detail-header" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);padding:20px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:15px;">
                        <div style="width:50px;height:50px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${iconDetails.bgColor};color:#fff;font-size:20px;">
                            <i class="fas ${iconDetails.icon}"></i>
                        </div>
                        <div>
                            <h3 style="margin:0;color:#fff;font-size:18px;">${iconDetails.label}</h3>
                            <p style="margin:5px 0 0;color:#94a3b8;font-size:14px;">تفاصيل العملية</p>
                        </div>
                    </div>
                    <div class="log-detail-body" style="padding:25px;">
                        <div class="detail-row" style="margin-bottom:20px;">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                <i class="fas fa-align-right" style="color:#3b82f6;width:16px;"></i>
                                <strong style="color:#fff;font-size:14px;">الوصف:</strong>
                            </div>
                            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;padding:15px;background:#1e293b;border:1px solid #334155;border-radius:8px;">${log.description}</p>
                        </div>
                        <div class="detail-row" style="margin-bottom:20px;">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                <i class="fas fa-user" style="color:#10b981;width:16px;"></i>
                                <strong style="color:#fff;font-size:14px;">المستخدم:</strong>
                            </div>
                            <p style="color:#cbd5e1;font-size:14px;margin:0;">${log.user_name || 'النظام'}</p>
                        </div>
                        <div class="detail-row" style="margin-bottom:20px;">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                <i class="fas fa-clock" style="color:#f59e0b;width:16px;"></i>
                                <strong style="color:#fff;font-size:14px;">التاريخ والوقت:</strong>
                            </div>
                            <p style="color:#cbd5e1;font-size:14px;margin:0;">${fullTime}</p>
                        </div>
                        <div class="detail-row">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                <i class="fas fa-tag" style="color:#8b5cf6;width:16px;"></i>
                                <strong style="color:#fff;font-size:14px;">نوع الإجراء:</strong>
                            </div>
                            <p style="color:#cbd5e1;font-size:14px;margin:0;">${iconDetails.label}</p>
                        </div>
                    </div>
                </div>`;

            showConfirmationModal(modalContent, null, {
                title: 'تفاصيل السجل',
                showCancel: false,
                confirmText: 'إغلاق',
                confirmClass: 'btn-secondary'
            });
        }

        // Initial render
        renderTable();
    };

    return { html, initFunction };
}

function renderDetailsView(agent) {
    // --- NEW: Permission Check ---
    const isSuperAdmin = currentUserProfile?.role === 'super_admin';
    const isAdmin = currentUserProfile?.role === 'admin';
    // Local broader edit flag used in other places — ensure it's defined here to avoid ReferenceError
    const canEditProfile = isSuperAdmin || isAdmin;
    // --- MODIFICATION: Allow anyone who can view financials to also edit them, as per user request. ---
    const userPerms = currentUserProfile?.permissions || {};
    const canEditFinancials = isSuperAdmin || isAdmin || userPerms.agents?.view_financials;

    const container = document.getElementById('tab-details');
    if (!container) return;

    const createFieldHTML = (label, value, fieldName, isEditable = true) => {
        const numericFields = ['competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'deposit_bonus_winners_count'];
        // --- NEW: Define which fields are financial ---
        const financialFields = ['rank', 'competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'renewal_period', 'deposit_bonus_winners_count', 'last_competition_date', 'competition_duration', 'competitions_per_week'];
        const isFinancial = financialFields.includes(fieldName);
 
        let displayValue;
        let iconHtml = '';

        // --- تعديل: إظهار أيقونة التعديل لأيام التدقيق ولحقل التصنيف للمشرفين ---
        const isAuditDays = fieldName === 'audit_days';
        const isClassificationField = fieldName === 'classification';
        // Show edit icon for financial editors OR for audit_days when broader profile edit is allowed
        // Additionally, allow admins/super_admins (canEditProfile) to edit classification
        if (canEditFinancials || (isAuditDays && canEditProfile) || (isClassificationField && canEditProfile)) {
            iconHtml = `<span class="inline-edit-trigger" title="قابل للتعديل"><i class="fas fa-pen"></i></span>`;
        }

        if (numericFields.includes(fieldName) || fieldName === 'competitions_per_week') {
            displayValue = (value === null || value === undefined) ? 0 : value;
            if (fieldName === 'prize_per_winner' && typeof displayValue === 'number') displayValue = parseFloat(displayValue).toFixed(2);
            if (fieldName === 'deposit_bonus_percentage') displayValue = `${displayValue}%`;
            if (fieldName === 'competition_bonus') displayValue = `$${displayValue}`;
        } else if (fieldName === 'audit_days') {
            // --- تعديل: عرض أيام التدقيق كعلامات (tags) ---
            const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',];
            displayValue = (value && value.length > 0) ? value.sort().map(dayIndex => `<span class="day-tag">${dayNames[dayIndex]}</span>`).join('') : '<span class="day-tag-none">غير محدد</span>';
        } else if (fieldName.includes('_date')) {
            displayValue = value ? new Date(value).toLocaleDateString('ar-EG') : 'لم يحدد';
        } else {
            displayValue = value || 'غير محدد';
        }
        
        // --- NEW: Add special class for audit_days to span full width ---
        const extraClass = fieldName === 'audit_days' ? 'full-width-card' : '';
        
        return `
            <div class="details-card details-group ${extraClass}" data-field="${fieldName}">
                <div class="details-card-header">
                    <span class="details-label">${label}</span>
                    ${iconHtml}
                </div>
                <div class="details-value">${displayValue}</div>
            </div>
        `;
    };

    const htmlContent = `
        <div class="details-container-v2">
            <div class="details-section-v2">
                <h3 class="details-section-title-v2"><i class="fas fa-sliders-h"></i> الإعدادات الأساسية</h3>
                <div class="details-grid-v2">
                    ${createFieldHTML('المرتبة', agent.rank, 'rank')}
                    ${createFieldHTML('التصنيف', agent.classification, 'classification')}
                    ${createFieldHTML('بونص المسابقات (تداولي)', agent.competition_bonus, 'competition_bonus')}
                    ${createFieldHTML('مرات بونص الإيداع', agent.deposit_bonus_count, 'deposit_bonus_count')}
                    ${createFieldHTML('نسبة بونص الإيداع', agent.deposit_bonus_percentage, 'deposit_bonus_percentage')}
                </div>
            </div>
            
            <div class="details-section-v2">
                <h3 class="details-section-title-v2"><i class="fas fa-wallet"></i> الأرصدة</h3>
                <div class="details-grid-v2">
                    ${createFieldHTML('رصيد مستهلك', agent.consumed_balance, 'consumed_balance')}
                    ${createFieldHTML('رصيد متبقي', Math.max(0, agent.remaining_balance || 0), 'remaining_balance')}
                    ${createFieldHTML('بونص إيداع مستخدم', agent.used_deposit_bonus, 'used_deposit_bonus')}
                    ${createFieldHTML('بونص إيداع متبقي', Math.max(0, agent.remaining_deposit_bonus || 0), 'remaining_deposit_bonus')}
                </div>
            </div>

            <div class="details-section-v2">
                <h3 class="details-section-title-v2"><i class="fas fa-trophy"></i> إعدادات المسابقة الواحدة</h3>
                <div class="details-grid-v2">
                    ${createFieldHTML('رصيد المسابقة الواحدة', agent.single_competition_balance, 'single_competition_balance')}
                    ${createFieldHTML('عدد الفائزين', agent.winners_count, 'winners_count')}
                    ${createFieldHTML('جائزة كل فائز', agent.prize_per_winner, 'prize_per_winner')}
                    ${createFieldHTML('عدد فائزين بونص ايداع', agent.deposit_bonus_winners_count, 'deposit_bonus_winners_count')}
                </div>
            </div>
            
            <div class="details-section-v2">
                <h3 class="details-section-title-v2"><i class="fas fa-clock"></i> التجديد والمدة</h3>
                <div class="details-grid-v2">
                    ${createFieldHTML('يجدد كل', agent.renewal_period, 'renewal_period')}
                    ${createFieldHTML('مدة المسابقة', agent.competition_duration, 'competition_duration')}
                    ${createFieldHTML('أيام التدقيق', agent.audit_days, 'audit_days')}
                    ${createFieldHTML('تاريخ آخر مسابقة', agent.last_competition_date, 'last_competition_date')}
                    ${createFieldHTML('عدد المسابقات كل أسبوع', agent.competitions_per_week, 'competitions_per_week')}
                </div>
            </div>
        </div>
        ${isSuperAdmin ? `
            <div class="details-actions" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                <button id="trigger-renewal-test-btn" class="btn-danger"><i class="fas fa-history"></i> تجربة التجديد (3 ثواني)</button>
            </div>
        ` : ''}
    `;



    // --- FIX V3: Stable content update ---
    // Clear the container's content and re-add the event listener.
    // This prevents replacing the container itself, which caused content to leak across pages.
    container.innerHTML = htmlContent;
    // Debug helper: log classification to confirm render and help debug caching issues
    try { console.debug(`[Profile] renderDetailsView: agent ${agent?._id || '<no-id>'} classification=`, agent?.classification); } catch (_) {}
    const eventHandler = (e) => {
        const trigger = e.target.closest('.inline-edit-trigger'); // Defensive: Use closest to handle clicks on icon
        if (trigger) { // Permission is checked inside renderInlineEditor
            const group = trigger.closest('.details-group'); 
            // FIX: Add a null check to prevent race condition errors after a save.
            if (!group) return;
            renderInlineEditor(group, agent);
        }
    };
    
    // Defensive: Manage event listener to prevent duplicates
    container.addEventListener('click', eventHandler);
    profilePageEventListeners.push({ element: container, type: 'click', handler: eventHandler });


    // --- NEW: Add listener for the test renewal button ---
    const testRenewalBtn = document.getElementById('trigger-renewal-test-btn');
    if (testRenewalBtn) {
        testRenewalBtn.addEventListener('click', () => {
            if (testRenewalBtn.disabled) return; // Prevent double clicks
            testRenewalBtn.disabled = true;
            testRenewalBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> جارٍ التنفيذ...';
            setTimeout(async () => {
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                    const result = await response.json();
                    
                    // Normalize message for comparison
                    const msg = result && result.message ? result.message.trim() : '';
                    
                    // Fix: Check response.ok or result.message for success
                    if (response.ok || (msg && msg.includes('Agent balance renewed successfully'))) {
                        showToast('تم تجديد الوكيل بنجاح!', 'success');
                        renderAgentProfilePage(agent._id, { activeTab: 'details' });
                    } else {
                        throw new Error(msg || 'فشل التجديد');
                    }
                } catch (error) {
                    console.error('Renewal test error:', error);
                    showToast(`خطأ: ${error.message}`, 'error');
                } finally {
                    if (testRenewalBtn) {
                        testRenewalBtn.disabled = false;
                        testRenewalBtn.innerHTML = '<i class="fas fa-history"></i> تجربة التجديد (3 ثواني)';
                    }
                }
            }, 3000);
        });
    }
}

function enableInlineEdit(groupElement, fieldName, agent) {
    const currentValue = agent[fieldName];
    // Fix: Support both label tag and .details-label class to prevent null error
    const labelEl = groupElement.querySelector('label') || groupElement.querySelector('.details-label');
    const label = labelEl ? labelEl.textContent : '';
    let editorHtml = '';

    switch (fieldName) {
        case 'rank':
            // تعديل: توحيد شكل وترتيب قائمة المراتب مع صفحة الإضافة
            editorHtml = `<select id="inline-edit-input">
                <optgroup label="⁕ مراتب الوكلاء الاعتيادية ⁖">
                    ${Object.keys(RANKS_DATA).filter(r => ['BEGINNING', 'GROWTH', 'PRO', 'ELITE'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>🔸 ${rank}</option>`).join('')}
                </optgroup>
                <optgroup label="⁕ مراتب الوكالة الحصرية ⁖">
                    <option value="وكيل حصري بدون مرتبة" ${currentValue === 'وكيل حصري بدون مرتبة' ? 'selected' : ''}>⭐ وكيل حصري بدون مرتبة</option>
                    <option disabled>──────────</option>
                    ${Object.keys(RANKS_DATA).filter(r => ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'].includes(r)).map(rank => `<option value="${rank}" ${currentValue === rank ? 'selected' : ''}>⭐ ${rank}</option>`).join('')}
                </optgroup>
                <optgroup label="⁕ المراكز ⁖">
                    <option value="CENTER" ${currentValue === 'CENTER' ? 'selected' : ''}>🏢 CENTER</option>
                </optgroup>
            </select>`;
            break;
        case 'classification':
            editorHtml = `<select id="inline-edit-input">
                <option value="R" ${currentValue === 'R' ? 'selected' : ''}>R</option>
                <option value="A" ${currentValue === 'A' ? 'selected' : ''}>A</option>
                <option value="B" ${currentValue === 'B' ? 'selected' : ''}>B</option>
                <option value="C" ${currentValue === 'C' ? 'selected' : ''}>C</option>
            </select>`;
            break;
        case 'renewal_period':
            editorHtml = `<select id="inline-edit-input">
                <option value="none" ${currentValue === 'none' ? 'selected' : ''}>بدون تجديد</option>
                <option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>أسبوع</option>
                <option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>أسبوعين</option>
                <option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>شهر</option>
            </select>`;
            break;
        case 'last_competition_date': // تعديل: السماح بتعديل تاريخ آخر مسابقة
        case 'winner_selection_date': // تعديل: السماح بتعديل تاريخ اختيار الفائز
            editorHtml = `<input type="date" id="inline-edit-input" value="${currentValue || ''}">`;
            break;
        case 'competition_duration': // تعديل: السماح بتعديل مدة المسابقة (إضافة 5 ثواني للاختبار)
            editorHtml = `<select id="inline-edit-input">
                <optgroup label="⚡ تجريبي">
                    <option value="5s" ${currentValue === '5s' ? 'selected' : ''}>5 ثواني (اختبار سريع)</option>
                </optgroup>
                <optgroup label="⏳ مدة قياسية">
                    <option value="24h" ${currentValue === '24h' ? 'selected' : ''}>24 ساعة</option>
                    <option value="48h" ${currentValue === '48h' ? 'selected' : ''}>48 ساعة</option>
                </optgroup>
            </select>`;
            break;
        case 'audit_days':
            editorHtml = `
                <div class="days-selector-v2" id="inline-edit-input">
                    ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, index) => `
                        <div class="day-toggle-wrapper">
                            <input type="checkbox" id="day-edit-inline-${index}" value="${index}" class="day-toggle-input" ${(currentValue || []).includes(index) ? 'checked' : ''}>
                            <label for="day-edit-inline-${index}" class="day-toggle-btn">${day}</label>
                        </div>`).join('')}
                </div>`;
            break;
        default: // for text/number inputs
            editorHtml = `<input type="number" id="inline-edit-input" value="${currentValue || ''}" placeholder="${label}">`;
            break;
    }

    groupElement.innerHTML = `
        <label>${label}</label>
        ${editorHtml}
        <div class="inline-edit-actions">
            <button id="inline-save-btn" class="btn-primary"><i class="fas fa-check"></i></button>
            <button id="inline-cancel-btn" class="btn-secondary"><i class="fas fa-times"></i></button>
        </div>
    `;

    // --- تعديل: إضافة تحديث فوري لتاريخ اختيار الفائز ---
    const inputElement = groupElement.querySelector('#inline-edit-input');
    if (inputElement && (fieldName === 'last_competition_date' || fieldName === 'competition_duration')) {
        const liveUpdateWinnerDate = () => {
            // --- إصلاح: جلب القيم الحالية من الصفحة مباشرة ---
            // ابحث عن حقل الإدخال النشط لتاريخ آخر مسابقة، أو استخدم القيمة المعروضة إذا لم يكن في وضع التعديل.
            const lastCompDateInput = document.querySelector('.details-group[data-field="last_competition_date"] #inline-edit-input');
            const lastCompDateValue = lastCompDateInput ? lastCompDateInput.value : agent.last_competition_date;

            // ابحث عن حقل الإدخال النشط لمدة المسابقة، أو استخدم القيمة المعروضة.
            const durationInput = document.querySelector('.details-group[data-field="competition_duration"] #inline-edit-input');
            const durationValue = durationInput ? durationInput.value : agent.competition_duration;
            
            // ابحث عن عنصر عرض تاريخ اختيار الفائز لتحديثه.
            const winnerDateElement = document.querySelector('.details-group[data-field="winner_selection_date"] p');

            if (lastCompDateValue && durationValue && winnerDateElement) {
                const durationMap = { '24h': 1, '48h': 2, 'monthly': 30 };
                const durationDays = durationMap[durationValue] || 0;
                if (durationDays > 0) {
                    try {
                        const newDate = new Date(lastCompDateValue);
                        newDate.setDate(newDate.getDate() + durationDays);
                        winnerDateElement.textContent = newDate.toLocaleDateString('ar-EG');
                    } catch (e) {
                        // تجاهل الأخطاء الناتجة عن إدخال تاريخ غير صالح مؤقتاً
                    }
                }
            }
        };

        // استدعاء الدالة عند تغيير القيمة
        inputElement.addEventListener('change', liveUpdateWinnerDate);
    }

    groupElement.querySelector('#inline-cancel-btn').addEventListener('click', () => {
        renderDetailsView(agent);
    });

    groupElement.querySelector('#inline-save-btn').addEventListener('click', async () => {
        const input = groupElement.querySelector('#inline-edit-input');
        let newValue = input.value;
        const updateData = {};

        // --- DEBUG: Log the field and new value ---
        console.log(`[Inline Edit] Field: "${fieldName}", New Value from input: "${newValue}"`);

        
        // --- STEP 5: MIGRATION TO CUSTOM BACKEND ---
        let currentAgent;
        try {
            const response = await authedFetch(`/api/agents/${agent._id}`);
            if (!response.ok) throw new Error('Failed to fetch latest agent data.');
            const result = await response.json();
            currentAgent = result.data;
        } catch (fetchError) {
            showToast('فشل في جلب بيانات الوكيل المحدثة.', 'error');
            console.error(fetchError);
            return;
        }

        if (fieldName === 'rank') {
            // Check if rank actually changed
            if (newValue === currentAgent.rank) {
                showToast('المرتبة لم تتغير.', 'info');
            console.log('[Rank Change] Showing modal for rank change from', currentAgent.rank, 'to', newValue);
            
                renderDetailsView(agent);
                return;
            }

            // Show modal to get reason and action before saving
            showRankChangeModal(currentAgent, newValue, async (reason, action) => {
                console.log('[Rank Change] Modal confirmed with reason:', reason, 'action:', action);
                const rankData = RANKS_DATA[newValue] || {};
                updateData.rank = newValue;
                updateData.competition_bonus = rankData.competition_bonus;
                updateData.deposit_bonus_percentage = rankData.deposit_bonus_percentage;
                updateData.deposit_bonus_count = rankData.deposit_bonus_count;
                // When rank changes, it might affect balances
                // --- تعديل: منطق خاص لمرتبة "بدون مرتبة حصرية" ---
                if (newValue === 'بدون مرتبة حصرية') {
                    updateData.competition_bonus = 60;
                    updateData.remaining_balance = 60 - (currentAgent.consumed_balance || 0)
                    updateData.deposit_bonus_percentage = null;
                    updateData.deposit_bonus_count = null;
                } else {
                    updateData.competition_bonus = rankData.competition_bonus;
                    updateData.remaining_balance = (rankData.competition_bonus || 0) - (currentAgent.consumed_balance || 0);
                }
                updateData.remaining_deposit_bonus = (rankData.deposit_bonus_count || 0) - (currentAgent.used_deposit_bonus || 0);

                // Save the agent update first
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });
                    if (!response.ok) throw new Error((await response.json()).message || 'فشل تحديث المرتبة.');
                    const { data: updatedAgent } = await response.json();

                    // Record the rank change with reason and action
                    const rankChangeResponse = await authedFetch(`/api/agents/${agent._id}/rank-change`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            old_rank: currentAgent.rank,
                            new_rank: newValue,
                            reason: reason,
                            action_taken: action
                        })
                    });

                    if (!rankChangeResponse.ok) {
                        console.error('Failed to record rank change:', await rankChangeResponse.text());
                    }

                    showToast('تم تحديث المرتبة وتسجيل السبب والإجراء بنجاح.', 'success');
                    renderAgentProfilePage(agent._id, { activeTab: 'details' });
                } catch (e) {
                    showToast(`فشل تحديث المرتبة: ${e.message}`, 'error');
                    renderDetailsView(agent);
                }
            }, () => {
                // On cancel, revert to original view
                renderDetailsView(agent);
            });
            return; // Don't proceed with normal save flow
        } else if (fieldName === 'classification') {
            // Check if classification actually changed
            if (newValue === currentAgent.classification) {
                showToast('التصنيف لم يتغير.', 'info');
                renderDetailsView(agent);
                return;
            }

            // Show modal to get reason and action before saving
            showClassificationChangeModal(currentAgent, newValue, async (reason, action) => {
                console.log('[Classification Change] Modal confirmed with reason:', reason, 'action:', action);
                
                updateData.classification = newValue;
                // --- Automatically update competitions_per_week based on classification ---
                const newClassification = newValue.toUpperCase();
                if (newClassification === 'R' || newClassification === 'A') {
                    updateData.competitions_per_week = 2;
                } else if (newClassification === 'B' || newClassification === 'C') {
                    updateData.competitions_per_week = 1;
                }

                // Save the agent update first
                try {
                    const response = await authedFetch(`/api/agents/${agent._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });

                    if (!response.ok) {
                        throw new Error('فشل تحديث التصنيف.');
                    }

                    // Now record the classification change with reason and action
                    const classificationChangeResponse = await authedFetch(`/api/agents/${currentAgent._id}/classification-change`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            old_classification: currentAgent.classification,
                            new_classification: newValue,
                            reason: reason,
                            action_taken: action
                        })
                    });

                    if (!classificationChangeResponse.ok) {
                        console.error('Failed to record classification change:', await classificationChangeResponse.text());
                    }

                    showToast('تم تحديث التصنيف وتسجيل السبب والإجراء بنجاح.', 'success');
                    renderAgentProfilePage(agent._id, { activeTab: 'details' });
                } catch (e) {
                    showToast(`فشل تحديث التصنيف: ${e.message}`, 'error');
                    renderDetailsView(agent);
                }
            }, () => {
                // On cancel, revert to original view
                renderDetailsView(agent);
            });
            return; // Don't proceed with normal save flow
        } else {
            // --- NEW: Automatically update competition_duration when competitions_per_week changes ---
            if (fieldName === 'competitions_per_week') {
                const compsPerWeek = parseInt(newValue, 10);
                if (compsPerWeek === 1) {
                    updateData.competition_duration = '48h';
                } else if (compsPerWeek === 2) {
                    updateData.competition_duration = '24h';
                } else if (compsPerWeek === 3) {
                    updateData.competition_duration = '24h'; // Fallback for 16h
                }
            }

            let finalValue;
            if (fieldName === 'audit_days') {
                finalValue = Array.from(groupElement.querySelectorAll('.day-toggle-input:checked')).map(input => parseInt(input.value, 10));
            } else if (fieldName.includes('_date')) {
                finalValue = newValue === '' ? null : newValue;
            } else {
                // --- REWRITE: Professional and robust value parsing ---
                // Define which fields should be treated as integers vs floats
                const integerFields = ['deposit_bonus_count', 'used_deposit_bonus', 'remaining_deposit_bonus', 'winners_count', 'competitions_per_week', 'deposit_bonus_winners_count'];
                const floatFields = ['competition_bonus', 'consumed_balance', 'remaining_balance', 'single_competition_balance', 'prize_per_winner', 'deposit_bonus_percentage'];

                if (integerFields.includes(fieldName)) {
                    const parsedInt = parseInt(newValue, 10);
                    finalValue = isNaN(parsedInt) ? null : parsedInt;
                } else if (floatFields.includes(fieldName)) {
                    const parsedFloat = parseFloat(newValue);
                    finalValue = isNaN(parsedFloat) ? null : parsedFloat;
                } else {
                    // For all other fields (like rank, renewal_period, etc.)
                    finalValue = newValue;
                }
            }

            // --- DEBUG: Log the final parsed value ---
            console.log(`[Inline Edit] Final parsed value for "${fieldName}":`, finalValue);

            // --- NEW: Automatically calculate single_competition_balance ---
            const winnersCount = parseInt(fieldName === 'winners_count' ? finalValue : currentAgent.winners_count, 10) || 0;
            const prizePerWinner = parseFloat(fieldName === 'prize_per_winner' ? finalValue : currentAgent.prize_per_winner) || 0;

            if (fieldName === 'winners_count' || fieldName === 'prize_per_winner') {
                updateData.single_competition_balance = winnersCount * prizePerWinner;
            }

            // --- FIX: Smart updates for financial fields ---
            // Start with the direct update
            updateData[fieldName] = finalValue;

            // Get current values for calculation, defaulting to 0 if null/undefined
            const competitionBonus = parseFloat(fieldName === 'competition_bonus' ? finalValue : currentAgent.competition_bonus) || 0;
            const consumedBalance = parseFloat(fieldName === 'consumed_balance' ? finalValue : currentAgent.consumed_balance) || 0;
            const remainingBalance = parseFloat(fieldName === 'remaining_balance' ? finalValue : currentAgent.remaining_balance) || 0;
            
            const depositBonusCount = parseInt(fieldName === 'deposit_bonus_count' ? finalValue : currentAgent.deposit_bonus_count, 10) || 0;
            const usedDepositBonus = parseInt(fieldName === 'used_deposit_bonus' ? finalValue : currentAgent.used_deposit_bonus, 10) || 0;
            const remainingDepositBonus = parseInt(fieldName === 'remaining_deposit_bonus' ? finalValue : currentAgent.remaining_deposit_bonus, 10) || 0;

            // Recalculate related fields based on which field was edited
            // This logic is now primarily handled by the backend, but we keep it for immediate UI feedback if needed.
            if (fieldName === 'competition_bonus' || fieldName === 'consumed_balance') {
                updateData.remaining_balance = competitionBonus - consumedBalance;
            } else if (fieldName === 'remaining_balance') {
                updateData.consumed_balance = competitionBonus - remainingBalance;
            }

            if (fieldName === 'deposit_bonus_count' || fieldName === 'used_deposit_bonus') {
                updateData.remaining_deposit_bonus = depositBonusCount - usedDepositBonus;
            } else if (fieldName === 'remaining_deposit_bonus') {
                updateData.used_deposit_bonus = depositBonusCount - remainingDepositBonus;
            }

            // --- FIX: Ensure deposit_bonus_winners_count is handled ---
            if (fieldName === 'deposit_bonus_winners_count') {
                updateData.deposit_bonus_winners_count = finalValue;
            }

            // Ensure no negative values are saved for balances
            if (updateData.remaining_balance < 0) updateData.remaining_balance = 0;
            if (updateData.consumed_balance < 0) updateData.consumed_balance = 0;
            if (updateData.remaining_deposit_bonus < 0) updateData.remaining_deposit_bonus = 0;
            if (updateData.used_deposit_bonus < 0) updateData.used_deposit_bonus = 0;
        }

        // --- DEBUG: Log the complete data payload being sent to the server ---
        console.log('[Inline Edit] Sending update payload to server:', updateData);
        // --- NEW DEBUG: Log to show why the number is not being saved ---
        console.log(`[DEBUG] The payload for the server is being prepared. Field being edited: "${fieldName}". Does the payload include "deposit_bonus_winners_count"?`, 'deposit_bonus_winners_count' in updateData);


        try {
            const response = await authedFetch(`/api/agents/${agent._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'فشل تحديث الحقل.');
            const { data: updatedAgent } = await response.json();

            // --- ACTIVATED: Log the activity from the frontend to ensure user context is captured. ---
            const oldValue = currentAgent[fieldName];
            const description = `تم تحديث "${label}" من "${oldValue || 'فارغ'}" إلى "${newValue || 'فارغ'}".`;
            await logAgentActivity(currentUserProfile?._id, agent._id, 'DETAILS_UPDATE', description, { field: label, from: oldValue, to: newValue });

            showToast('تم حفظ التغيير بنجاح.', 'success');
            // FIX: Always re-render the full profile page to ensure all tabs (especially the log) are updated.
            // This is more reliable than partial updates.
            renderAgentProfilePage(agent._id, { activeTab: 'details' });
        } catch (e) {
            showToast(`فشل تحديث الحقل: ${e.message}`, 'error');
            renderDetailsView(agent); // Revert on error
        }
    });
}

// FIX: Missing function referenced by inline edit trigger
function renderInlineEditor(groupElement, agent) {
    if (!groupElement) return;
    const fieldName = groupElement.dataset.field;
    if (!fieldName) return;
    enableInlineEdit(groupElement, fieldName, agent);
}

function calculateNextRenewalDate(agent) {
    if (!agent || !agent.renewal_period || agent.renewal_period === 'none') {
        return null;
    }
    const lastRenewal = agent.last_renewal_date ? new Date(agent.last_renewal_date) : new Date(agent.createdAt);
    let nextRenewalDate = new Date(lastRenewal);

    switch (agent.renewal_period) {
        case 'weekly':
            nextRenewalDate.setDate(nextRenewalDate.getDate() + 7);
            break;
        case 'biweekly':
            nextRenewalDate.setDate(nextRenewalDate.getDate() + 14);
            break;
        case 'monthly':
            nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
            break;
        default:
            return null;
    }
    // Ensure it is set to 5:00 AM
    nextRenewalDate.setHours(5, 0, 0, 0);
    return nextRenewalDate;
}

// --- NEW: Detailed Countdown Modal ---
function showDetailedCountdownModal(targetDate) {
    const modalId = 'countdown-modal-' + Date.now();
    
    const modalContent = `
        <div style="text-align:center; padding: 20px;">
            <h3 style="color:#fff; margin-bottom: 20px; font-family:'Cairo', sans-serif;">الوقت المتبقي للتجديد</h3>
            <div id="${modalId}-timer" style="display:flex; justify-content:center; gap:15px; direction:ltr;">
                <!-- Timer parts will go here -->
            </div>
            <p style="margin-top:20px; color:#94a3b8; font-size:0.9em;">سيتم التجديد تلقائياً عند انتهاء الوقت</p>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e293b; border:1px solid #334155; border-radius:16px; padding:20px; width:90%; max-width:500px; box-shadow:0 20px 50px rgba(0,0,0,0.5); position:relative;';
    
    modal.innerHTML = `
        <button id="${modalId}-close" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#64748b; font-size:18px; cursor:pointer;"><i class="fas fa-times"></i></button>
        ${modalContent}
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const createTimerUnit = (value, label) => `
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div style="background:#0f172a; color:#3b82f6; font-size:28px; font-weight:bold; width:70px; height:70px; border-radius:12px; display:flex; align-items:center; justify-content:center; border:1px solid #1e40af; box-shadow:0 0 15px rgba(59,130,246,0.2); margin-bottom:8px; font-family:monospace;">
                ${value.toString().padStart(2, '0')}
            </div>
            <span style="color:#94a3b8; font-size:12px;">${label}</span>
        </div>
    `;

    const updateModalTimer = () => {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            cleanup();
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const timerContainer = document.getElementById(`${modalId}-timer`);
        if (timerContainer) {
            timerContainer.innerHTML = `
                ${createTimerUnit(days, 'أيام')}
                ${createTimerUnit(hours, 'ساعات')}
                ${createTimerUnit(minutes, 'دقائق')}
                ${createTimerUnit(seconds, 'ثواني')}
            `;
        }
    };
    
    updateModalTimer();
    const intervalId = setInterval(updateModalTimer, 1000);
    
    const cleanup = () => {
        clearInterval(intervalId);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    
    document.getElementById(`${modalId}-close`).onclick = cleanup;
    overlay.onclick = (e) => {
        if (e.target === overlay) cleanup();
    };
}

function updateManualRenewButtonState(agent) {
    const renewalBtn = document.getElementById('manual-renew-btn');
    if (!renewalBtn) return;

    const nextRenewalDate = calculateNextRenewalDate(agent);

    if (!nextRenewalDate) {
        renewalBtn.style.display = 'none';
        return;
    }

    renewalBtn.style.display = 'inline-flex';

    if (new Date() >= nextRenewalDate) {
        renewalBtn.disabled = false;
        renewalBtn.classList.add('ready');
    } else {
        renewalBtn.disabled = true;
        renewalBtn.classList.remove('ready');
    }
}

function formatDuration(ms) {
    if (ms < 0) ms = -ms;
    const time = {
        day: Math.floor(ms / 86400000),
        hour: Math.floor(ms / 3600000) % 24,
        minute: Math.floor(ms / 60000) % 60,
        second: Math.floor(ms / 1000) % 60
    };
    return Object.entries(time).filter(val => val[1] !== 0).map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`).join(', ');
}

function displayNextRenewalDate(agent) {
    const displayElement = document.getElementById('renewal-date-display');
    if (!displayElement) return;

    const nextRenewalDate = calculateNextRenewalDate(agent);

    if (!nextRenewalDate) {
        displayElement.style.display = 'none';
        updateManualRenewButtonState(agent);
        return;
    }

    displayElement.style.display = 'flex';

    const updateCountdown = () => {
        const now = new Date();
        const diff = nextRenewalDate - now;

        if (diff <= 0) {
            console.log('[Renewal] Countdown finished. Checking renewal status...');
            if (isRenewing) {
                console.log('[Renewal] Blocked: A renewal process is already in progress.');
                return;
            }
            console.log('[Renewal] Starting renewal process...');
            isRenewing = true; // Set flag

            if (renewalCountdownInterval) clearInterval(renewalCountdownInterval);
            
            displayElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>جاري التجديد...</span>`;
            displayElement.classList.add('due');

            // Trigger the renewal immediately
            (async () => {
                try {
                    console.log(`[Renewal] Calling API to renew agent ${agent._id}`);
                    const response = await authedFetch(`/api/agents/${agent._id}/renew`, { method: 'POST' });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'فشل التجديد التلقائي.');
                    }
                    console.log('[Renewal] API call successful. Re-rendering page.');
                    showToast(`تم تجديد رصيد الوكيل ${agent.name} بنجاح!`, 'success');
                    // Re-render the page to show updated values
                    renderAgentProfilePage(agent._id, { activeTab: 'details' });
                } catch (error) {
                    console.error('[Renewal] API call failed:', error.message);
                    showToast(`فشل التجديد: ${error.message}`, 'error');
                    // Re-render to show the 'due' state again if it fails
                    renderAgentProfilePage(agent._id, { activeTab: 'details' });
                }
            })();
            return;
        }

        if (diff < 86400000) { // Less than 24 hours
            const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
            const minutes = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
            const seconds = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
            
            const absoluteDateString = nextRenewalDate.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });
            const fullDateTimeString = `${absoluteDateString} الساعة 5:00 ص`;
            
            // Show countdown above the standard text
            displayElement.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;line-height:1.2;">
                    <div style="font-size:1.2em;font-weight:bold;color:#fbbf24;margin-bottom:2px;">
                        <i class="fas fa-hourglass-half fa-spin"></i> ${hours}:${minutes}:${seconds}
                    </div>
                    <div style="font-size:0.85em;opacity:0.9;">
                        <i class="fas fa-calendar-alt"></i> يُجدد خلال يوم (${fullDateTimeString})
                    </div>
                </div>
            `;
            displayElement.classList.add('imminent');
        } else {
            // More than 24 hours, show relative time
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            let relativeTime = `في ${days} أيام`;

            const absoluteDateString = nextRenewalDate.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });
            const fullDateTimeString = `${absoluteDateString} الساعة 5:00 ص`;

            displayElement.innerHTML = `<span class="renewal-details-trigger" style="cursor:pointer;margin-left:8px;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:rgba(255,255,255,0.1);border-radius:50%;transition:all 0.2s;" title="عرض العداد التفصيلي" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fas fa-clock"></i></span> <span>يُجدد ${relativeTime} (${fullDateTimeString})</span>`;
            displayElement.classList.remove('imminent', 'due');
            
            // Ensure click listener is attached (idempotent)
            if (!displayElement.hasAttribute('data-click-attached')) {
                displayElement.addEventListener('click', (e) => {
                    if (e.target.closest('.renewal-details-trigger')) {
                        showDetailedCountdownModal(nextRenewalDate);
                    }
                });
                displayElement.setAttribute('data-click-attached', 'true');
            }
        }
    };

    if (renewalCountdownInterval) clearInterval(renewalCountdownInterval);
    updateCountdown(); // Initial call
    renewalCountdownInterval = setInterval(updateCountdown, 1000); // Update every second

    updateManualRenewButtonState(agent);
}

// --- NEW: Agent Analytics Section ---
async function renderAgentAnalytics(agent, container, dateRange = 'all') {
    // Loader while fetching
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    let data = null;
    try {
        const queryParams = new URLSearchParams({ dateRange });
        const resp = await authedFetch(`/api/stats/agent-analytics/${agent._id}?${queryParams.toString()}`);
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.message || 'خطأ في جلب بيانات الوكيل');
        data = json.data;
    } catch (e) {
        console.error('[AgentAnalytics] Failed:', e);
        container.innerHTML = '<p class="error">فشل تحميل بيانات التحليلات.</p>';
        return;
    }

    if (!data || !data.stats) {
        container.innerHTML = '<p>لا توجد بيانات تحليلية في النطاق الزمني المحدد.</p>';
        return;
    }

    const competitions = (data.stats.competitions || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latest = competitions.slice(0, 10);

    const analyticsHeaderHtml = `
        <div class="analytics-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:20px;background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);border-radius:12px;border:1px solid #2a2d3a;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-chart-line" style="color:#fff;font-size:18px;"></i>
                </div>
                <div>
                    <h3 style="margin:0;color:#fff;font-size:18px;font-weight:600;">تحليلات الوكيل المتقدمة</h3>
                    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px;">بيانات شاملة ومفصلة لأداء الوكيل</p>
                </div>
            </div>
            <div class="date-range-selector" style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="range-btn dark-range-btn ${dateRange === '30' ? 'active' : ''}" data-range="30" style="background:#2a2d3a;color:#e2e8f0;border:1px solid #404040;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;transition:all 0.2s;cursor:pointer;">آخر 30 يوم</button>
                <button class="range-btn dark-range-btn ${dateRange === '90' ? 'active' : ''}" data-range="90" style="background:#2a2d3a;color:#e2e8f0;border:1px solid #404040;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;transition:all 0.2s;cursor:pointer;">آخر 90 يوم</button>
                <button class="range-btn dark-range-btn ${dateRange === '365' ? 'active' : ''}" data-range="365" style="background:#2a2d3a;color:#e2e8f0;border:1px solid #404040;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;transition:all 0.2s;cursor:pointer;">آخر سنة</button>
                <button class="range-btn dark-range-btn ${dateRange === 'all' ? 'active' : ''}" data-range="all" style="background:#2a2d3a;color:#e2e8f0;border:1px solid #404040;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;transition:all 0.2s;cursor:pointer;">كل الوقت</button>
            </div>
        </div>`;

    const kpisHtml = `
        <div class="agent-kpis" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-trophy" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(59,130,246,0.1) 0%, rgba(29,78,216,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">إجمالي المسابقات</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.total_competitions}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-play-circle" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">المسابقات النشطة</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.active_competitions}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-eye" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">إجمالي المشاهدات</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.total_views}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #ec4899 0%, #be185d 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-heart" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(236,72,153,0.1) 0%, rgba(190,24,93,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">عدد التفاعلات</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.total_reactions || 0}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-users" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(139,92,246,0.1) 0%, rgba(124,58,237,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">عدد المشاركين</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.total_participants}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-medal" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">عدد الفائزين</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${data.stats.total_winners}</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
            <div class="kpi-card dark-kpi-card" style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);border:1px solid #475569;border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;">
                <div class="kpi-icon" style="width:48px;height:48px;background:linear-gradient(135deg, #22c55e 0%, #16a34a 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:2;">
                    <i class="fas fa-rocket" style="color:#fff;font-size:20px;"></i>
                </div>
                <div class="kpi-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(34,197,94,0.1) 0%, rgba(22,163,74,0.05) 100%);border-radius:12px;"></div>
                <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-bottom:8px;position:relative;z-index:2;">معدل النمو</div>
                <div style="font-weight:700;font-size:28px;color:#f1f5f9;position:relative;z-index:2;">${(() => {
                    const views = data.stats.total_views || 0;
                    const participants = data.stats.total_participants || 0;
                    const reactions = data.stats.total_reactions || 0;
                    const competitions = data.stats.total_competitions || 1;
                    
                    // حساب معدل النمو الاحترافي
                    // 1. معدل التحويل من المشاهدات إلى المشاركات (40% من الوزن)
                    const participationRate = views > 0 ? (participants / views) * 100 : 0;
                    
                    // 2. معدل التفاعل لكل مشاهدة (30% من الوزن)
                    const reactionRate = views > 0 ? (reactions / views) * 100 : 0;
                    
                    // 3. متوسط المشاركين لكل مسابقة (30% من الوزن)
                    const avgParticipantsPerComp = competitions > 0 ? participants / competitions : 0;
                    
                    // 4. حساب النمو الإجمالي كمتوسط مرجح
                    const growthScore = (participationRate * 0.4) + (reactionRate * 0.3) + (avgParticipantsPerComp * 2 * 0.3);
                    
                    return growthScore.toFixed(1) + '%';
                })()}</div>
                <div style="font-size:11px;color:#64748b;margin-top:6px;position:relative;z-index:2;">نمو احترافي شامل</div>
                <div style="position:absolute;top:-20px;right:-20px;width:60px;height:60px;background:radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%);border-radius:50%;"></div>
            </div>
        </div>`;

    const tableHtml = `
        <div class="agent-competitions dark-table-container" style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);border:1px solid #2a2d3a;border-radius:12px;padding:24px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div class="table-header" style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-list" style="color:#fff;font-size:18px;"></i>
                </div>
                <div>
                    <h4 style="margin:0;color:#fff;font-size:18px;font-weight:600;">آخر 10 مسابقات</h4>
                    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px;">تفاصيل المسابقات الأخيرة والأداء</p>
                </div>
            </div>
            <div class="table-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(255,107,107,0.05) 0%, transparent 70%);pointer-events:none;"></div>
            ${latest.length === 0 ? '<p style="margin:0;color:#94a3b8;text-align:center;padding:40px;">لا توجد مسابقات.</p>' : `
            <div style="overflow-x:auto;border-radius:8px;background:#0f172a;border:1px solid #334155;">
            <table style="width:100%;border-collapse:collapse;min-width:720px;">
                <thead>
                    <tr style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%);color:#f1f5f9;font-size:13px;font-weight:600;">
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">السؤال / الاسم</th>
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">التاريخ</th>
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">المشاهدات</th>
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">المشاركون</th>
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">الفائزون</th>
                        <th style="padding:16px 20px;text-align:right;border-bottom:1px solid #475569;">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${latest.map(c => {
                        const title = c.name || c.question || 'بدون عنوان';
                        const safeTitle = title.replace(/[<>]/g, s => ({'<':'&lt;','>':'&gt;'}[s]));
                        const statusText = c.status === 'completed' ? 'مكتملة' : (c.status === 'active' ? 'نشطة' : 'غير محدد');
                        const statusColor = c.status === 'completed' ? '#10b981' : (c.status === 'active' ? '#f59e0b' : '#6b7280');
                        return `
                        <tr style="border-bottom:1px solid #334155;font-size:13px;background:#1e293b;color:#e2e8f0;" class="table-row">
                            <td class="comp-title-cell" data-full="${safeTitle}" style="padding:14px 20px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;cursor:pointer;color:#60a5fa;" title="انقر لعرض النص الكامل">${safeTitle}</td>
                            <td style="padding:14px 20px;color:#cbd5e1;">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                            <td style="padding:14px 20px;font-weight:600;color:#3b82f6;">${c.views_count || 0}</td>
                            <td style="padding:14px 20px;color:#cbd5e1;">${c.participants_count || 0}</td>
                            <td style="padding:14px 20px;color:#cbd5e1;">${c.winners_count || 0}</td>
                            <td style="padding:14px 20px;">
                                <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:500;background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}30;">
                                    <div style="width:6px;height:6px;border-radius:50%;background:${statusColor};"></div>
                                    ${statusText}
                                </span>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>`}
        </div>`;

    const series = competitions.filter(c => c.createdAt).slice(-30).map(c => ({
        date: new Date(c.createdAt).toLocaleDateString('ar-EG'),
        views: c.views_count || 0,
        participants: c.participants_count || 0
    }));
    const chartHtml = series.length > 1 ? `
        <div class="chart-container dark-chart-container" style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);border:1px solid #2a2d3a;border-radius:12px;padding:24px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div class="chart-header" style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg, #a855f7 0%, #9333ea 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-chart-bar" style="color:#fff;font-size:18px;"></i>
                </div>
                <div>
                    <h4 style="margin:0;color:#fff;font-size:18px;font-weight:600;">تطور المشاهدات والمشاركات</h4>
                    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px;">تحليل الأداء عبر الوقت</p>
                </div>
            </div>
            <div class="chart-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(168,85,247,0.05) 0%, transparent 70%);pointer-events:none;"></div>
            <div style="position:relative;z-index:2;background:#0f172a;border-radius:8px;padding:16px;border:1px solid #334155;">
                <canvas id="agentCompetitionsTrend" height="220"></canvas>
            </div>
        </div>` : '';

    // --- NEW: Balance History Chart Container ---
    const balanceChartHtml = `
        <div class="chart-container dark-chart-container" style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);border:1px solid #2a2d3a;border-radius:12px;padding:24px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div class="chart-header" style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-wallet" style="color:#fff;font-size:18px;"></i>
                </div>
                <div>
                    <h4 style="margin:0;color:#fff;font-size:18px;font-weight:600;">سجل استهلاك الرصيد</h4>
                    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px;">تتبع استهلاك الرصيد عبر الوقت</p>
                </div>
            </div>
            <div class="chart-glow" style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg, rgba(16,185,129,0.05) 0%, transparent 70%);pointer-events:none;"></div>
            <div id="balanceHistoryChartContainer" style="position:relative;z-index:2;background:#0f172a;border-radius:8px;padding:16px;border:1px solid #334155;height:300px;">
                <canvas id="balanceHistoryChart"></canvas>
            </div>
        </div>`;

    container.innerHTML = analyticsHeaderHtml + kpisHtml + chartHtml + balanceChartHtml + tableHtml;

    // --- NEW: Render Balance History Chart ---
    renderBalanceHistoryChart(agent._id, document.getElementById('balanceHistoryChartContainer'));

    // Add event listeners for range buttons
    container.querySelectorAll('.dark-range-btn').forEach(btn => {
        // Set initial active state styling
        if (btn.classList.contains('active')) {
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            btn.style.borderColor = '#667eea';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
        }
        
        btn.addEventListener('click', () => {
            // Remove active styling from all buttons
            container.querySelectorAll('.dark-range-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = '#2a2d3a';
                b.style.borderColor = '#404040';
                b.style.color = '#e2e8f0';
                b.style.boxShadow = 'none';
            });
            // Add active styling to clicked button
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            btn.style.borderColor = '#667eea';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            // Re-render analytics with new date range
            renderAgentAnalytics(agent, container, btn.dataset.range);
        });
    });

    // Add hover effects for KPI cards
    container.querySelectorAll('.dark-kpi-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
            card.style.borderColor = '#64748b';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = '#475569';
        });
    });

    // Add hover effects for table rows
    container.querySelectorAll('.table-row').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = '#334155';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = '#1e293b';
        });
    });

    // Attach click handlers for competition question/name expansion
    container.querySelectorAll('.comp-title-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const full = cell.getAttribute('data-full');
            if (!full) return;
            if (typeof showConfirmationModal === 'function') {
                const body = `
                    <div class='dark-expand-modal-wrapper'>
                        <div class='dark-expand-modal'>
                            <div class='dark-expand-modal-header'>
                                <i class='fas fa-question-circle' style='color:#ff9800'></i> السؤال / الاسم الكامل
                            </div>
                            <div class='dark-expand-modal-body'>
                                <pre>${full}</pre>
                            </div>
                        </div>
                    </div>`;
                showConfirmationModal(body, async () => true, { title:'', confirmText:'<i class="fas fa-times"></i> إغلاق', showCancel:false });
            } else { alert(full); }
        });
    });

    if (chartHtml) {
        try {
            const ctx = document.getElementById('agentCompetitionsTrend').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: series.map(p => p.date), 
                    datasets: [
                        { 
                            label: 'مشاهدات', 
                            data: series.map(p => p.views), 
                            borderColor: '#3b82f6', 
                            backgroundColor: 'rgba(59,130,246,0.1)', 
                            tension: 0.4, 
                            fill: true,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#1e40af',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        { 
                            label: 'مشاركون', 
                            data: series.map(p => p.participants), 
                            borderColor: '#f59e0b', 
                            backgroundColor: 'rgba(245,158,11,0.1)', 
                            tension: 0.4, 
                            fill: true,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#d97706',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: { 
                        legend: { 
                            position: 'top',
                            labels: {
                                color: '#e2e8f0',
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f1f5f9',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 12
                        }
                    }, 
                    scales: { 
                        x: { 
                            grid: { 
                                color: 'rgba(51, 65, 85, 0.3)',
                                borderColor: '#334155'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: {
                                    size: 11
                                }
                            }
                        }, 
                        y: { 
                            beginAtZero: true, 
                            grid: { 
                                color: 'rgba(51, 65, 85, 0.3)',
                                borderColor: '#334155'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: {
                                    size: 11
                                }
                            }
                        } 
                    },
                    elements: {
                        point: {
                            hoverBorderWidth: 3
                        }
                    }
                }
            });
        } catch (e) { console.warn('Chart render failed', e); }
    }
}

function renderAgentAnalyticsChart(competitions, dateRange, agent) {
    const ctx = document.getElementById('agent-analytics-chart')?.getContext('2d');
    if (!ctx) return;

    // --- FIX: Ensure competitions is always an array ---
    if (!Array.isArray(competitions)) {
        competitions = [];
    }

    // --- FIX: Ensure agent exists ---
    if (!agent) {
        console.warn('[Analytics] Agent is undefined, cannot render chart');
        return;
    }

    // Determine the date range for the chart labels
    const chartLabels = [];
    const dailyData = {};
    const today = new Date();
    let daysInChart = 7; // Default for 'all' or '7d'

    if (dateRange === '30d') daysInChart = 30;
    else if (dateRange === 'month') daysInChart = today.getDate();
    else if (dateRange === 'all') {
        // --- FIX: Check if agent.created_at exists ---
        if (agent.created_at) {
            const oldestDate = new Date(agent.created_at); // Use agent creation date
            const diffTime = Math.abs(today - oldestDate);
            daysInChart = Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1); // +1 to include today
        }
    }

    for (let i = daysInChart - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        chartLabels.push(date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
        dailyData[dateString] = { views: 0, reactions: 0, participants: 0 };
    }

    competitions.forEach(comp => {
        if (comp.createdAt) { // Check if createdAt exists
            const dateString = new Date(comp.createdAt).toISOString().split('T')[0];
            if (dailyData[dateString]) {
                dailyData[dateString].views += comp.views_count || 0;
                dailyData[dateString].reactions += comp.reactions_count || 0;
                dailyData[dateString].participants += comp.participants_count || 0;
            }
        }
    });

    const dailyViews = Object.values(dailyData).map(d => d.views);
    const dailyReactions = Object.values(dailyData).map(d => d.reactions);
    const dailyParticipants = Object.values(dailyData).map(d => d.participants);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                { label: 'المشاهدات', data: dailyViews, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.3 },
                { label: 'التفاعلات', data: dailyReactions, borderColor: 'rgba(255, 206, 86, 1)', backgroundColor: 'rgba(255, 206, 86, 0.2)', fill: true, tension: 0.3 },
                { label: 'المشاركات', data: dailyParticipants, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            plugins: { legend: { position: 'top' } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// --- NEW: Render Balance History Chart ---
async function renderBalanceHistoryChart(agentId, container) {
    // If container is passed as an element (from analytics tab), use it directly.
    // If passed as a parent container (from details tab), create the section.
    let chartCanvas;
    let chartContainerDiv;

    if (container.id === 'balanceHistoryChartContainer') {
        // Called from Analytics Tab
        chartCanvas = container.querySelector('canvas');
        chartContainerDiv = container;
    } else {
        // Called from Details Tab (Legacy/Fallback)
        // Create container for the chart
        const chartSection = document.createElement('div');
        chartSection.className = 'action-section';
        chartSection.style.marginTop = '20px';
        chartSection.innerHTML = `
            <h2><i class="fas fa-chart-line"></i> سجل استهلاك الرصيد</h2>
            <div class="chart-container" style="position: relative; height: 300px; width: 100%;">
                <canvas id="balanceHistoryChartDetails"></canvas>
            </div>
        `;
        container.appendChild(chartSection);
        chartCanvas = chartSection.querySelector('canvas');
        chartContainerDiv = chartSection.querySelector('.chart-container');
    }

    try {
        const response = await authedFetch(`/api/agents/${agentId}/transactions?limit=12`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const result = await response.json();
        const transactions = result.data || [];

        if (transactions.length === 0) {
            chartContainerDiv.innerHTML = '<p class="no-data-message" style="color:#94a3b8;text-align:center;padding:20px;">لا توجد بيانات كافية لعرض الرسم البياني.</p>';
            return;
        }

        // Process data for chart
        // We want to show the "amount restored" (consumption) over time
        // Sort by date ascending for the chart
        const sortedTx = transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const labels = sortedTx.map(tx => new Date(tx.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));
        const dataPoints = sortedTx.map(tx => tx.amount); // Amount restored = consumption

        new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'الرصيد المستهلك ($)',
                    data: dataPoints,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)', // Green to match wallet theme
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Cairo' }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Cairo' }
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                family: 'Cairo'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#e2e8f0',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return `تم استهلاك: $${context.raw}`;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error rendering balance chart:', error);
        chartContainerDiv.innerHTML = '<p class="error-message" style="color:#ef4444;text-align:center;">فشل تحميل الرسم البياني.</p>';
    }
}
