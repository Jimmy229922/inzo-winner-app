/**
 * Calculates the real prize value and formats the prize text for a winner,
 * falling back to the agent's defaults if the specific prize value is 0.
 * 
 * @param {Object} winner - The winner object (containing prize_type, prize_value)
 * @param {Object} agent - The agent object (containing deposit_bonus_percentage)
 * @returns {Object} { effectiveValue: Number, prizeText: String }
 */
function calculateRealPrize(winner, agent) {
    const hasValidPrizeValue = (winner.prize_value && Number(winner.prize_value) > 0);
    
    // Calculate the numeric value
    const effectiveValue = hasValidPrizeValue ? Number(winner.prize_value) : (
        (winner.prize_type === 'deposit_prev' || winner.prize_type === 'deposit')
            ? (agent.deposit_bonus_percentage || 0)
            : 0 // For trading bonus without a set value, defaults to 0 unless provided
    );

    // Calculate the localized formatting text
    let prizeText = '';
    if (winner.prize_type === 'deposit_prev') {
        prizeText = `${effectiveValue}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
    } else if (winner.prize_type === 'deposit') {
        prizeText = `${effectiveValue}% بونص إيداع`;
    } else {
        prizeText = `${effectiveValue}$ بونص تداولي`;
    }

    return {
        effectiveValue,
        prizeText
    };
}

module.exports = {
    calculateRealPrize
};
