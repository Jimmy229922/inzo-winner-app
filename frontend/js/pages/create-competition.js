function updateExpectedWinnerDate(duration) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(duration));
    
    const winnerDate = new Date(endDate);
    winnerDate.setDate(winnerDate.getDate() + 1);
    
    const formattedDate = winnerDate.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('expected-winner-date').textContent = formattedDate;
}

// تحديث مستمع الحدث للمدة
document.getElementById('duration').addEventListener('change', (e) => {
    updateExpectedWinnerDate(e.target.value);
});