// Competition Details Page Module
// DEBUG gate to silence logs in production
const DEBUG = false;
const dlog = DEBUG ? (..._args) => {} : null;

// Function to get competition ID from URL
function getCompetitionId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Function to format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to get status text
function getStatusText(status) {
    const statusMap = {
        'active': 'نشط',
        'completed': 'مكتمل',
        'awaiting_winners': 'بانتظار الفائزين',
        'pending': 'قيد الانتظار'
    };
    return statusMap[status] || status;
}

// Function to get competition type text
function getCompetitionTypeText(type) {
    const typeMap = {
        'standard': 'مميزات',
        'special': 'تفاعلية',
        'trading': 'بونص تداول',
        'deposit': 'بونص إيداع',
        'general': 'عام'
    };
    return typeMap[type] || type;
}

// Function to get classification text
function getClassificationText(classification) {
    const classMap = {
        'all': 'جميع العملاء',
        'new_clients': 'عملاء جدد',
        'existing_clients': 'عملاء حاليين',
        'R': 'R',
        'A': 'A',
        'B': 'B',
        'C': 'C',
        'All': 'الجميع'
    };
    return classMap[classification] || classification;
}

// Function to get duration text
function getDurationText(duration) {
    const durationMap = {
        '5s': '5 ثواني',
        '10s': '10 ثواني',
        '1d': 'يوم واحد',
        '2d': 'يومين',
        '1w': 'أسبوع'
    };
    return durationMap[duration] || duration || '-';
}

// Function to load competition details
async function loadCompetitionDetails(competitionId) {
    dlog && dlog('[COMP-DETAILS] 🎯 Loading competition:', competitionId);
    
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const content = document.getElementById('content');

    try {
        loadingSpinner.classList.add('active');
        errorMessage.classList.remove('active');
        content.style.display = 'none';

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('لم يتم العثور على رمز المصادقة');
        }

        const response = await fetch(`/api/competitions/${competitionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

    dlog && dlog('[COMP-DETAILS] 📡 Response status:', response.status);

        if (!response.ok) {
            throw new Error(`خطأ في تحميل البيانات: ${response.status}`);
        }

    const result = await response.json();
    const competition = result.data || result;
    dlog && dlog('[COMP-DETAILS] 📊 Competition data:', competition);

        // Display competition details
        displayCompetitionDetails(competition);

        loadingSpinner.classList.remove('active');
        content.style.display = 'block';

    } catch (error) {
        // console suppressed per policy; show user-friendly message only
        loadingSpinner.classList.remove('active');
        errorMessage.textContent = error.message || 'حدث خطأ أثناء تحميل البيانات';
        errorMessage.classList.add('active');
    }
}

// Function to display competition details
function displayCompetitionDetails(competition) {
    dlog && dlog('[COMP-DETAILS] 🖼️ Displaying competition:', competition);

    // Extract template info
    const template = competition.template || {};
    const agent = competition.agent || {};
    
    // Page title
    const title = template.question || competition.name || 'تفاصيل المسابقة';
    document.getElementById('pageTitle').textContent = title;

    // Status badge
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = getStatusText(competition.status);
    statusBadge.className = 'competition-status-badge status-' + competition.status;

    // Image
    const image = document.getElementById('competitionImage');
    const imageUrl = competition.image_url || template.image_url;
    
    dlog && dlog('[COMP-DETAILS] 🖼️ Image URL:', imageUrl);
    
    if (imageUrl) {
        // Check if it's a full URL or just filename
        if (imageUrl.startsWith('http')) {
            image.src = imageUrl;
        } else if (imageUrl.includes('/')) {
            // Already has path structure
            image.src = `http://localhost:30001${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        } else {
            // Just filename
            image.src = `http://localhost:30001/uploads/competitions/${imageUrl}`;
        }
        
        // CSP-safe image error fallback without logging
        image.addEventListener('error', () => {
            image.src = '../images/competition_bg.jpg';
        }, { once: true });
    } else {
        dlog && dlog('[COMP-DETAILS] ℹ️ No image URL, using default');
        image.src = '../images/competition_bg.jpg';
    }

    // Main info
    document.getElementById('questionTitle').textContent = title;
    document.getElementById('description').textContent = competition.description || template.content || 'لا يوجد وصف';

    // Stats Cards (new section above details)
    document.getElementById('statsViews').textContent = (competition.views_count || 0).toLocaleString('ar-EG');
    document.getElementById('statsReactions').textContent = (competition.reactions_count || 0).toLocaleString('ar-EG');
    document.getElementById('statsParticipants').textContent = (competition.participants_count || 0).toLocaleString('ar-EG');

    // Competition details
    document.getElementById('duration').textContent = getDurationText(competition.duration);
    document.getElementById('createdAt').textContent = formatDate(competition.createdAt);
    document.getElementById('endsAt').textContent = formatDate(competition.ends_at);

    // Deposit bonus (if applicable) - show if deposit bonus exists in template or competition
    dlog && dlog('[COMP-DETAILS] 🔍 === بداية فحص بونص الإيداع ===');
    dlog && dlog('[COMP-DETAILS] 📦 Template object:', template);
    dlog && dlog('[COMP-DETAILS] 📦 Competition object:', competition);
    
    const hasDepositBonus = (template.deposit_bonus_prize_details && template.deposit_bonus_prize_details.trim() !== '') ||
                           (template.prize_details && template.prize_details.trim() !== '') ||
                           (typeof competition.deposit_bonus_percentage === 'number' && competition.deposit_bonus_percentage > 0) ||
                           (competition.deposit_winners_count && competition.deposit_winners_count > 0);
    
    dlog && dlog('[COMP-DETAILS] ✅ hasDepositBonus:', hasDepositBonus);
    
    if (hasDepositBonus) {
        document.getElementById('depositBonusItem').style.display = 'flex';

        // Get deposit bonus details - check multiple sources
        let depositBonusText = '';

    dlog && dlog('[COMP-DETAILS] 💰 === فحص مصادر بيانات بونص الإيداع ===');
    dlog && dlog('[COMP-DETAILS] 1️⃣ deposit_bonus_prize_details:', template.deposit_bonus_prize_details);
    dlog && dlog('[COMP-DETAILS] 2️⃣ prize_details:', template.prize_details);
    dlog && dlog('[COMP-DETAILS] 3️⃣ deposit_bonus_percentage:', competition.deposit_bonus_percentage);
    dlog && dlog('[COMP-DETAILS] 4️⃣ deposit_winners_count:', competition.deposit_winners_count);

        // First priority: deposit_bonus_prize_details from template
        if (template.deposit_bonus_prize_details && template.deposit_bonus_prize_details.trim() !== '') {
            depositBonusText = template.deposit_bonus_prize_details.trim();
            dlog && dlog('[COMP-DETAILS] ✅ استخدام deposit_bonus_prize_details:', depositBonusText);
        } 
        // Second priority: prize_details from template
        else if (template.prize_details && template.prize_details.trim() !== '') {
            depositBonusText = template.prize_details.trim();
            dlog && dlog('[COMP-DETAILS] ✅ استخدام prize_details:', depositBonusText);
        }
        else {
            dlog && dlog('[COMP-DETAILS] ⚠️ لا توجد بيانات في deposit_bonus_prize_details أو prize_details');
        }

    dlog && dlog('[COMP-DETAILS] 📝 depositBonusText قبل المعالجة:', depositBonusText);
        
        // If the text is a placeholder like {{prize_details}} or empty, use computed value
        const hasPlaceholder = /\{\{.*\}\}/.test(depositBonusText);
    dlog && dlog('[COMP-DETAILS] 🔍 hasPlaceholder:', hasPlaceholder);
        
        if (hasPlaceholder || depositBonusText === '') {
            dlog && dlog('[COMP-DETAILS] 🔄 النص فارغ أو placeholder، محاولة استخراج النسبة...');
            const pct = (typeof competition.deposit_bonus_percentage === 'number')
                ? competition.deposit_bonus_percentage
                : undefined;

            dlog && dlog('[COMP-DETAILS] 📊 deposit_bonus_percentage value:', pct);

            if (typeof pct === 'number' && pct > 0) {
                depositBonusText = `${pct}%`;
                dlog && dlog('[COMP-DETAILS] ✅ استخدام deposit_bonus_percentage:', depositBonusText);
            } else {
                depositBonusText = 'غير محدد';
                dlog && dlog('[COMP-DETAILS] ❌ لا توجد نسبة، النتيجة: "غير محدد"');
            }
        } else {
            dlog && dlog('[COMP-DETAILS] 🔍 محاولة استخراج النسبة من النص...');
            // Try to extract percentage from text like "60% بونص إيداع"
            const percentageMatch = depositBonusText.match(/(\d+)%/);
            if (percentageMatch) {
                depositBonusText = `${percentageMatch[1]}%`;
                dlog && dlog('[COMP-DETAILS] ✅ تم استخراج النسبة:', depositBonusText);
            } else {
                dlog && dlog('[COMP-DETAILS] ⚠️ لم يتم العثور على نسبة مئوية في النص، سيتم استخدام النص كاملاً');
            }
            // Otherwise keep the full text as is
        }

        dlog && dlog('[COMP-DETAILS] 💵 === النتيجة النهائية ===');
        dlog && dlog('[COMP-DETAILS] 💵 Final deposit bonus text:', depositBonusText);

        // Display deposit bonus with winner count if available
        const winnersCount = competition.deposit_winners_count || 0;
    dlog && dlog('[COMP-DETAILS] 🏆 عدد الفائزين:', winnersCount);
        
        const winnersText = winnersCount > 0 
            ? `<span style="margin-right: 0.5rem; color: var(--text-secondary);">(${winnersCount} فائز)</span>`
            : '';
        
    dlog && dlog('[COMP-DETAILS] 🎨 HTML النهائي:', `<span class="badge deposit">${depositBonusText}</span>${winnersText}`);
        
        document.getElementById('depositBonus').innerHTML = `
            <span class="badge deposit">${depositBonusText}</span>
            ${winnersText}
        `;
        
        dlog && dlog('[COMP-DETAILS] ✅ === انتهى عرض بونص الإيداع ===');
    } else {
        document.getElementById('depositBonusItem').style.display = 'none';
        dlog && dlog('[COMP-DETAILS] ❌ لا يوجد بونص إيداع، تم إخفاء العنصر');
    }

    // Trading bonus (if applicable) - show if trading bonus exists
    const hasTradingBonus = (competition.total_cost && competition.total_cost > 0) ||
                           (competition.prize_per_winner && competition.prize_per_winner > 0) ||
                           (competition.winners_count && competition.winners_count > 0);
    
    if (hasTradingBonus) {
        document.getElementById('tradingBonusItem').style.display = 'flex';

        // Get trading bonus amount
        const tradingAmount = competition.total_cost || competition.prize_per_winner || 0;
        const tradingWinners = competition.winners_count || 0;
        
        dlog && dlog('[COMP-DETAILS] 💵 Trading bonus:', {
            total_cost: competition.total_cost,
            prize_per_winner: competition.prize_per_winner,
            winners_count: competition.winners_count,
            final_amount: tradingAmount
        });

        // Display trading bonus with winner count
        const winnersText = tradingWinners > 0 
            ? `<span style="margin-right: 0.5rem; color: var(--text-secondary);">(${tradingWinners} فائز)</span>`
            : '';
        
        document.getElementById('tradingBonus').innerHTML = `
            <span class="badge trading">$${tradingAmount}</span>
            ${winnersText}
        `;
    } else {
        document.getElementById('tradingBonusItem').style.display = 'none';
    }

    // Agent info
    if (agent._id) {
        document.getElementById('agentName').textContent = agent.name || 'غير معروف';
        document.getElementById('agentClassification').textContent = 
            `التصنيف: ${agent.classification || '-'}`;
    } else {
        document.getElementById('agentName').textContent = 'غير محدد';
        document.getElementById('agentClassification').textContent = '-';
    }

    dlog && dlog('[COMP-DETAILS] ✅ Display complete');
}

// Back button handler
document.getElementById('backBtn').addEventListener('click', () => {
    // Check if coming from day-competitions page
    if (document.referrer.includes('day-competitions')) {
        window.history.back();
    } else {
        window.location.href = '../pages/analytics.html';
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    
    const competitionId = getCompetitionId();
    
    if (!competitionId) {
        // console suppressed; show visible error only
        document.getElementById('loadingSpinner').classList.remove('active');
        document.getElementById('errorMessage').textContent = 'لم يتم تحديد معرف المسابقة';
        document.getElementById('errorMessage').classList.add('active');
        return;
    }

    loadCompetitionDetails(competitionId);
});
