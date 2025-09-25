let supabase = null;

async function initializeSupabase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        const config = await response.json();
        if (!config.supabaseUrl || !config.supabaseKey) throw new Error('Supabase config missing');
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        return true;
    } catch (error) {
        logMessage(`فشل الاتصال بقاعدة البيانات: ${error.message}`, 'error');
        return false;
    }
}

const logContainer = document.getElementById('log-container');
function logMessage(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function parseInputData(text) {
    const lines = text.trim().split('\n');
    const data = lines.map(line => {
        const parts = line.split(/\s+/); // Split by any whitespace
        if (parts.length >= 2) {
            const groupName = parts.slice(0, -1).join(' ');
            const chatId = parts[parts.length - 1];
            return { groupName, chatId };
        }
        return null;
    }).filter(Boolean); // Remove any null entries
    return data;
}

async function startBulkAdd() {
    const startBtn = document.getElementById('start-bulk-add-btn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري العمل...';

    const dataInput = document.getElementById('data-input').value;
    const telegramData = parseInputData(dataInput);

    if (telegramData.length < 40) {
        logMessage(`خطأ: تم العثور على ${telegramData.length} سجلاً فقط. يجب توفير 40 سجلاً.`, 'error');
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-play-circle"></i> بدء إضافة 40 وكيل';
        return;
    }

    logMessage(`تم تحليل ${telegramData.length} سجلاً بنجاح.`, 'success');
    logMessage('--- بدء عملية إضافة الوكلاء ---', 'info');

    for (let i = 0; i < 40; i++) {
        const agentNumber = i + 1;
        const agentName = `الوكيل رقم ${agentNumber}`;
        const agentId = `INZO-${String(agentNumber).padStart(4, '0')}`;
        const { groupName, chatId } = telegramData[i];

        const newAgentData = {
            name: agentName,
            agent_id: agentId,
            classification: 'R', // تصنيف افتراضي
            rank: 'Beginning', // مرتبة افتراضية
            renewal_period: 'weekly', // تجديد أسبوعي افتراضي
            audit_days: [1, 2, 3, 4, 5], // من الاثنين إلى الجمعة افتراضياً
            telegram_group_name: groupName,
            telegram_chat_id: chatId,
            // --- بيانات المرتبة الافتراضية ---
            competition_bonus: 60,
            deposit_bonus_percentage: null,
            deposit_bonus_count: null,
            remaining_balance: 60,
            remaining_deposit_bonus: null,
        };

        logMessage(`جاري إضافة الوكيل: ${agentName} (ID: ${agentId})`, 'info');

        const { data: insertedAgent, error } = await supabase
            .from('agents')
            .insert(newAgentData)
            .select()
            .single();

        if (error) {
            logMessage(`فشل إضافة الوكيل ${agentName}: ${error.message}`, 'error');
            // Stop on first error to avoid further issues
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play-circle"></i> بدء إضافة 40 وكيل';
            return;
        } else {
            logMessage(`تمت إضافة الوكيل ${insertedAgent.name} بنجاح.`, 'success');
        }
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    logMessage('--- اكتملت عملية إضافة جميع الوكلاء بنجاح! ---', 'success');
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-check-circle"></i> اكتملت العملية';
}

document.addEventListener('DOMContentLoaded', async () => {
    const isInitialized = await initializeSupabase();
    if (isInitialized) {
        document.getElementById('start-bulk-add-btn').addEventListener('click', startBulkAdd);
    }
});