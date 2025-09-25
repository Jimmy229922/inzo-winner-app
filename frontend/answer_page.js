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
        console.error('Initialization failed:', error);
        document.body.innerHTML = '<div class="answer-container"><div class="answer-card"><h1>خطأ في الاتصال</h1><p>لا يمكن الاتصال بالخادم. يرجى المحاولة مرة أخرى لاحقاً.</p></div></div>';
        return false;
    }
}

async function loadCompetition() {
    const form = document.getElementById('answer-form');
    const loader = document.getElementById('loader');
    const questionEl = document.getElementById('competition-question');

    form.style.display = 'none';
    loader.style.display = 'flex';

    const urlParams = new URLSearchParams(window.location.search);
    const competitionId = urlParams.get('id');

    if (!competitionId) {
        questionEl.textContent = 'رابط المسابقة غير صالح.';
        loader.style.display = 'none';
        return;
    }

    const { data: competition, error } = await supabase
        .from('competitions')
        .select('name') // The question is stored in the 'name' field.
        .eq('id', competitionId)
        .single();

    loader.style.display = 'none';

    if (error || !competition) {
        console.error('Error fetching competition:', error);
        questionEl.textContent = 'لم يتم العثور على المسابقة.';
        form.style.display = 'block'; // Show form to display error
        document.getElementById('submit-answer-btn').disabled = true;
    } else {
        questionEl.textContent = competition.name;
        form.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-answer-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        const answerData = {
            competition_id: competitionId,
            client_name: document.getElementById('client-name').value,
            client_account_id: document.getElementById('client-account-id').value,
            client_answer: document.getElementById('client-answer').value,
        };

        const { error: insertError } = await supabase.from('competition_answers').insert(answerData);

        if (insertError) {
            console.error('Error submitting answer:', insertError);
            form.innerHTML = '<div class="submission-feedback error"><h3>حدث خطأ</h3><p>فشل إرسال إجابتك. يرجى المحاولة مرة أخرى.</p></div>';
        } else {
            form.innerHTML = '<div class="submission-feedback success"><h3>تم الإرسال بنجاح!</h3><p>شكراً لمشاركتك. سيتم إعلان الفائزين قريباً.</p></div>';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const isInitialized = await initializeSupabase();
    if (isInitialized) {
        await loadCompetition();
    }
});