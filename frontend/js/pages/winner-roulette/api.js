/**
 * api.js
 * طبقة الاتصال الخاصة بالسيرفر (Network Layer)
 * هذا الملف هو الوحيد المسموح له باستخدام authedFetch لإرسال واستقبال البيانات
 */

// Imports can be added here if needed, like global utils
// e.g., const { authedFetch, translateTelegramError } = window.utils;

export async function fetchAgents() {
    try {
        const response = await window.utils.authedFetch('/api/agents');
        if (!response.ok) throw new Error('فشل جلب الوكلاء');
        return await response.json();
    } catch (error) {
        console.error('Error fetching agents:', error);
        throw error;
    }
}

export async function fetchCompetitions(agentId) {
    if (!agentId) return [];
    try {
        const response = await window.utils.authedFetch(`/api/competitions/agent/${agentId}`);
        if (!response.ok) throw new Error('فشل جلب المسابقات');
        return await response.json();
    } catch (error) {
        console.error('Error fetching competitions:', error);
        throw error;
    }
}

// ... Additional API methods like saveWinners, uploadAssets, syncWinners will go here.

// jlb al faezeen
export async function fetchWinners(agentId, compId) {
    if (!agentId || !compId) return [];
    try {
        const response = await window.utils.authedFetch(`/api/agents//winners?competition_id=`);
        if (!response.ok) throw new Error('فشل جلب الفائزين');
        const data = await response.json();
        return data.winners || [];
    } catch (error) {
        console.error('Error fetching winners:', error);
        throw error;
    }
}


// save winner
export async function saveWinner(agentId, compId, winnerData) {
    try {
        const payload = {
            agent_id: agentId,
            competition_id: compId,
            name: winnerData.name,
            account_number: winnerData.account,
            email: winnerData.email || '',
            prize_type: winnerData.prizeType || 'trading',
            prize_value: winnerData.prizeValue || 0
        };

        const response = await window.utils.authedFetch(`/api/winners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('فشل الحفظ');
        return await response.json();
    } catch (error) {
        console.error('Error saving winner:', error);
        throw error;
    }
}


// upload ID
export async function uploadIdImage(winnerId, blob, fallbackName = 'id_image.jpg') {
    if (!winnerId || !blob) return null;
    const formData = new FormData();
    window.utils.safeAppendFile(formData, 'id_image', blob, fallbackName);

    try {
        const response = await window.utils.authedFetch(`/api/winners//id-image`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('فشل رفع الهوية');
        return await response.json();
    } catch (error) {
        console.error('Error uploading ID:', error);
        throw error;
    }
}


// upload video
export async function uploadVideo(winnerId, blob, fallbackName = 'video.webm') {
    if (!winnerId || !blob) return null;
    const formData = new FormData();
    window.utils.safeAppendFile(formData, 'video', blob, fallbackName);

    try {
        const response = await window.utils.authedFetch(`/api/winners//video`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('فشل رفع الفيديو');
        return await response.json();
    } catch (error) {
        console.error('Error uploading video:', error);
        throw error;
    }
}

