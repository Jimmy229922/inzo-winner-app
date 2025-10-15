
function translateTelegramError(errorMessage) {
    if (!errorMessage) {
        return 'فشل إرسال غير معروف.';
    }

    const lowerCaseError = errorMessage.toLowerCase();

    if (lowerCaseError.includes('message and chat id are required')) {
        return 'معرف الدردشة (Chat ID) الخاص بالوكيل غير موجود أو غير صحيح. يرجى مراجعته في صفحة تعديل الوكيل.';
    }
    if (lowerCaseError.includes('chat not found')) {
        return 'فشل العثور على المحادثة. يرجى التأكد من أن معرف الدردشة (Chat ID) صحيح وأن الوكيل قد بدأ محادثة مع البوت.';
    }
    if (lowerCaseError.includes('bot was blocked by the user')) {
        return 'قام الوكيل بحظر البوت. لا يمكن إرسال الرسالة.';
    }
    if (lowerCaseError.includes('user is deactivated')) {
        return 'حساب المستخدم غير نشط في تيليجرام.';
    }
    if (lowerCaseError.includes('chat_id is empty') || lowerCaseError.includes('chat id is empty')) {
        return 'معرف الدردشة (Chat ID) فارغ. يرجى إضافته في ملف الوكيل.';
    }
    if (lowerCaseError.includes('message is too long')) {
        return 'الرسالة طويلة جداً. يرجى اختصارها.';
    }
    if (lowerCaseError.includes('wrong file identifier')) {
        return 'معرف الملف (للصور أو المرفقات) غير صحيح.';
    }
    // A more generic bad request
    if (lowerCaseError.includes('bad request')) {
        return 'طلب غير صالح. قد يكون هناك خطأ في تنسيق الرسالة أو معرف الدردشة.';
    }

    // Default fallback
    return `خطأ من تيليجرام: ${errorMessage}`;
}
