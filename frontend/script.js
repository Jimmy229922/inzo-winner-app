// 1. إعداد Supabase
// املأ هذه البيانات من لوحة تحكم Supabase الخاصة بك
// اذهب إلى Project Settings > API
const supabaseUrl = 'https://xfnqbtrnqnjlwpwfoahu.supabase.co'; // تم وضع رابط المشروع
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnFidHJucW5qbHdwd2ZvYWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzU4NDksImV4cCI6MjA3NDExMTg0OX0.SDGmikg8YVcLULfuiByJCYSaqyWsSU0YXEXwtRreb8o'; // تم وضع مفتاح anon public

// ⚠️ تحذير: لا تضع أبداً مفتاح "service_role" في كود الواجهة الأمامية!
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

console.log('Supabase client initialized');

// 2. عرض الفائزين عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    await fetchWinners();
});

// 3. دالة لجلب الفائزين من قاعدة البيانات وعرضهم
async function fetchWinners() {
    const winnersList = document.getElementById('winners-list');
    winnersList.innerHTML = '<p>جاري تحميل الفائزين...</p>';

    // افترض أن اسم الجدول هو 'winners'
    const { data: winners, error } = await supabase
        .from('winners') 
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching winners:', error);
        winnersList.innerHTML = '<p>حدث خطأ في جلب البيانات.</p>';
        return;
    }

    if (winners.length === 0) {
        winnersList.innerHTML = '<p>لا يوجد فائزون حالياً.</p>';
        return;
    }

    winnersList.innerHTML = winners.map(winner => `
        <div>
            <p><strong>${winner.name}</strong> - ${new Date(winner.created_at).toLocaleString()}</p>
        </div>
    `).join('');
}

// 4. إضافة فائز جديد
const addWinnerForm = document.getElementById('add-winner-form');
addWinnerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const winnerNameInput = document.getElementById('winner-name');
    const name = winnerNameInput.value.trim();

    if (!name) return;

    // إضافة الفائز إلى قاعدة بيانات Supabase
    const { data, error } = await supabase
        .from('winners')
        .insert([{ name: name }])
        .select();

    if (error) {
        console.error('Error adding winner:', error);
        alert('حدث خطأ أثناء إضافة الفائز.');
        return;
    }

    console.log('Winner added:', data);
    winnerNameInput.value = ''; // تفريغ حقل الإدخال
    await fetchWinners(); // تحديث القائمة

    // استدعاء الـ Backend لنشر الخبر على تيليجرام
    await postToTelegram(name);
});

// 5. دالة لإرسال طلب إلى الـ Backend للنشر على تيليجرام
async function postToTelegram(winnerName) {
    try {
        // تأكد من أن الـ backend يعمل على هذا العنوان
        const response = await fetch('http://localhost:3000/post-winner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: winnerName }),
        });

        const result = await response.json();
        if (response.ok) {
            console.log('Posted to Telegram:', result.message);
            alert('تم النشر على تيليجرام بنجاح!');
        } else {
            throw new Error(result.message || 'Failed to post to Telegram');
        }
    } catch (error) {
        console.error('Error posting to Telegram:', error);
        alert(`فشل النشر على تيليجرام: ${error.message}`);
    }
}