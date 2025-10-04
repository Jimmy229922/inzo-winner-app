/**
 * TaskStore: The Single Source of Truth for task state management.
 * This store manages the state, handles updates, and persists data to localStorage.
 * It uses a custom event system to notify components of state changes,
 * mimicking a Redux/Context pattern in vanilla JavaScript.
 */

const TASK_STATE_KEY = 'inzoTaskState';

const taskStore = {
    state: {
        // tasks: { agentId: { dayIndex: { audited: bool, competition_sent: bool } } }
        tasks: {},
    },

    /**
     * Initializes the store by loading data from localStorage and fetching initial data.
     * This acts as the "hydration" step.
     */
    async init() {
        this._loadState();
        await this._fetchInitialData();
        // Notify all components that the initial state is ready.
        this._notify();
    },

    /**
     * The main dispatcher function to update task status.
     * This is the equivalent of a reducer action.
     * @param {string} agentId
     * @param {number} dayIndex
     * @param {'audited' | 'competition_sent'} taskType
     * @param {boolean} status
     */
    updateTaskStatus(agentId, dayIndex, taskType, status) {
        // Ensure the agent and day objects exist
        if (!this.state.tasks[agentId]) {
            this.state.tasks[agentId] = {};
        }
        if (!this.state.tasks[agentId][dayIndex]) {
            this.state.tasks[agentId][dayIndex] = { audited: false, competition_sent: false };
        }

        // Update the state
        this.state.tasks[agentId][dayIndex][taskType] = status;

        // Persist and notify
        this._saveState();
        this._notify();
    },

    /**
     * Fetches the initial data (agents and tasks for the week) from the backend.
     * It merges the backend state with the local state, giving precedence to local changes.
     */
    async _fetchInitialData() {
        try {
            const response = await authedFetch('/api/calendar/data');
            if (!response.ok) throw new Error('Failed to fetch calendar data');
            const { tasks: serverTasks } = await response.json();

            // Merge server tasks into local state
            (serverTasks || []).forEach(task => {
                const dayIndex = new Date(task.task_date).getUTCDay();
                const agentId = task.agent_id.toString();
                
                if (!this.state.tasks[agentId]) this.state.tasks[agentId] = {};
                if (!this.state.tasks[agentId][dayIndex]) {
                     this.state.tasks[agentId][dayIndex] = {
                        audited: task.audited,
                        competition_sent: task.competition_sent
                    };
                }
            });
            this._saveState();
        } catch (error) {
            console.error("Failed to fetch initial task data:", error);
        }
    },

    _loadState() {
        const storedState = localStorage.getItem(TASK_STATE_KEY);
        if (storedState) {
            this.state = JSON.parse(storedState);
        }
    },

    _saveState() {
        localStorage.setItem(TASK_STATE_KEY, JSON.stringify(this.state));
    },

    _notify() {
        // Dispatch a custom event that components can listen to.
        window.dispatchEvent(new CustomEvent('taskStateChanged', { detail: this.state }));
    },

    /**
     * Subscribes a callback function to state changes.
     * @param {Function} callback
     */
    subscribe(callback) {
        window.addEventListener('taskStateChanged', (e) => callback(e.detail));
    }
};

// Make it globally accessible immediately
window.taskStore = taskStore; 

// Initialize the store only after the main document is fully loaded and parsed.
// This ensures that functions from other scripts (like authedFetch) are available.
document.addEventListener('DOMContentLoaded', () => {
    taskStore.init().then(() => {
        // Dispatch storeReady event after initialization is complete.
        window.dispatchEvent(new Event('storeReady'));
    });
});