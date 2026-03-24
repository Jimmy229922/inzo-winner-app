/**
 * state.js
 * العقل المدبر ومكان تخزين بيانات الصفحة (State Management)
 */

export const state = {
    entries: [], // { id, name, account, label, selected }
    winners: [],
    spinning: false,
    angle: 0,
    targetAngle: 0,
    spinStart: 0,
    spinDuration: 0,
    excludeWinner: true,
    spinQueue: 0,
    spinSnapshot: null, // snapshot of candidates used during a spin
    chosenIndex: null, // index within snapshot chosen at spin start
    startAngle: 0,
    autoMode: false,
    autoRemaining: 0,
    autoBatchPicked: [],
    selectedAgent: null, // Store selected agent info
    activeCompetition: null, // Store active competition info
    logoImage: null, // Store logo image for wheel center
    pulseTime: 0, // For animated background pulse effect
    isAnimating: false, // Control animation loop
    showLogoHint: true, // whether to show the 'اضغط هنا' hint over the logo
    lastPickedIndex: -1, // Track last picked index for sequential selection
    reportSent: false, // Winners report sent to agent flag
    includeWarnMeet: false,
    includeWarnPrev: false,
    isRestoreMode: false, // وضع استعادة المسابقة المكتملة
    predeterminedWinner: null // تحديد فائز مسبق (اسم + حساب)
};

export const config = {
    // LocalStorage Keys
    LS_KEY: 'winnerRouletteSession.v1',
    STAGED_WINNERS_KEY: 'winnerRouletteStagedWinners.v1',
    
    // Limits
    MAX_WINNERS_LIMIT: 100, // حد أقصى للحماية من التعليق
    
    // API Saving constants
    SAVE_RETRY_COUNT: 3, 
    SAVE_RETRY_DELAY: 1000 
};
