const fieldTranslations = {
    rank: 'الرتبة',
    renewal_period: 'فترة التجديد',
    competition_bonus: 'مكافأة المسابقة',
    deposit_bonus_percentage: 'نسبة مكافأة الإيداع',
    deposit_bonus_count: 'عدد مكافآت الإيداع',
    remaining_balance: 'الرصيد المتبقي',
    remaining_deposit_bonus: 'مكافأة الإيداع المتبقية',
    name: 'الاسم',
    telegram_channel_url: 'رابط قناة التليجرام',
    telegram_group_url: 'رابط مجموعة التليجرام',
    telegram_chat_id: 'معرف دردشة التليجرام',
    telegram_group_name: 'اسم مجموعة التليجرام',
    phone: 'رقم الهاتف',
    status: 'الحالة',
    renewal_date: 'تاريخ التجديد'
};

const translateField = (fieldName) => {
    return fieldTranslations[fieldName] || fieldName;
};

const formatValue = (value) => {
    if (value === null || value === undefined) return 'غير محدد';
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
    if (typeof value === 'number') return value.toLocaleString('ar-EG');
    
    // ترجمة قيم فترة التجديد
    const renewalPeriodTranslations = {
        'weekly': 'أسبوعي',
        'biweekly': 'كل أسبوعين',
        'monthly': 'شهري'
    };
    
    if (renewalPeriodTranslations[value]) {
        return renewalPeriodTranslations[value];
    }
    
    return String(value);
};

module.exports = { translateField, formatValue };