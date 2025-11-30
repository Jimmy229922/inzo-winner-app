/**
 * TaskStore: The Single Source of Truth for task state management.
 * This store manages the state, handles updates, and persists data to localStorage.
 * It uses a custom event system to notify components of state changes,
 * mimicking a Redux/Context pattern in vanilla JavaScript.
 */

const TASK_STATE_KEY = 'inzoTaskState';
const { authedFetch } = window.utils;

const taskStore = {
    state: {
        // tasks: { agentId: { dayIndex: { audited: bool, competition_sent: bool } } }
        tasks: {},
    },
    _subscribers: [], // NEW: To hold all callback functions

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
    async updateTaskStatus(agentId, dayIndex, taskType, status) {
        console.log(`[TaskStore] updateTaskStatus called with:`, { agentId, dayIndex, taskType, status });

        // Log state before
        console.log(`[TaskStore] State for agent ${agentId} BEFORE update:`, JSON.parse(JSON.stringify(this.state.tasks[agentId] || {})));

        try {
            const response = await authedFetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ agentId, dayIndex, taskType, status })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update task on the server.');
            }

            // Ensure the agent and day objects exist
            if (!this.state.tasks[agentId]) {
                this.state.tasks[agentId] = {};
            }
            if (!Object.prototype.hasOwnProperty.call(this.state.tasks[agentId], dayIndex)) {
                this.state.tasks[agentId][dayIndex] = { audited: false, competition_sent: false };
            }

            // Update the state
            this.state.tasks[agentId][dayIndex][taskType] = status;

            // Log state after
            console.log(`[TaskStore] State for agent ${agentId} AFTER update:`, JSON.parse(JSON.stringify(this.state.tasks[agentId] || {})));

            // Persist and notify
            this._saveState();
            this._notify();

        } catch (error) {
            console.error("Error updating task status:", error);
            // Re-throw the error to be caught by the calling UI component
            throw error;
        }
    },

    async resetAllTasks() {
        console.log('[TaskStore] Resetting all tasks.');
        try {
            // Perform API call to reset all tasks on the backend
            const response = await authedFetch('/api/tasks/reset-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to reset tasks on server.');
            }

            // If API call is successful, reset the local state
            this.state.tasks = {};

            // Persist and notify
            this._saveState();
            this._notify();
            console.log('[TaskStore] All tasks have been reset locally and on the server.');

        } catch (error) {
            console.error("Error resetting all tasks:", error);
            throw error; // Re-throw for the UI to handle
        }
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
                // Use local day to match backend week calculation
                const dayIndex = new Date(task.task_date).getDay();
                // Safely build agentId from possible fields to avoid calling toString on undefined
                const agentId = String(task.agent_id ?? task.agentId ?? task._id ?? task.agent ?? '');
                if (!agentId) return; // skip malformed entries

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

    /**
     * مزامنة الحالة من الخادم لضمان توحيد العرض بين جميع المستخدمين.
     * الخادم هو مصدر الحقيقة؛ يتم استبدال الحالة المحلية بحالة الخادم.
     */
        async syncWithServer() {
        try {
            const response = await authedFetch('/api/calendar/data');
            if (!response.ok) throw new Error('Failed to sync calendar data');
            const { tasks: serverTasks } = await response.json();

            const incoming = {};
            (serverTasks || []).forEach(task => {
                const dayIndex = new Date(task.task_date).getDay();
                const agentId = String(task.agent_id ?? task.agentId ?? task._id ?? task.agent ?? '');
                if (!agentId) return;
                if (!incoming[agentId]) incoming[agentId] = {};
                if (!incoming[agentId][dayIndex]) {
                    incoming[agentId][dayIndex] = {
                        audited: !!task.audited,
                        competition_sent: !!task.competition_sent,
                        _updatedAt: task.updatedAt || task.task_date
                    };
                }
            });

            // Merge instead of replace to avoid wiping optimistic updates
            Object.keys(incoming).forEach(agentId => {
                if (!this.state.tasks[agentId]) this.state.tasks[agentId] = {};
                Object.keys(incoming[agentId]).forEach(dayIdx => {
                    const inc = incoming[agentId][dayIdx];
                    const existing = this.state.tasks[agentId][dayIdx];
                    if (!existing) {
                        this.state.tasks[agentId][dayIdx] = inc;
                    } else {
                        // Always overwrite booleans with server truth
                        existing.audited = inc.audited;
                        existing.competition_sent = inc.competition_sent;
                        existing._updatedAt = inc._updatedAt;
                    }
                });
            });
            this._saveState();
            this._notify();
        } catch (error) {
            console.error('TaskStore sync failed:', error);
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
        // Call all subscribed callbacks with a deep clone of the new state to prevent mutation.
        const stateClone = JSON.parse(JSON.stringify(this.state));
        this._subscribers.forEach(callback => callback(stateClone));
    },

    /**
     * Subscribes a callback function to state changes.
     * @param {Function} callback
     */
    subscribe(callback) {
        if (!this._subscribers.includes(callback)) {
            this._subscribers.push(callback);
        }
    },

    /**
     * Unsubscribes a callback function from state changes.
     * @param {Function} callback
     */
    unsubscribe(callback) {
        this._subscribers = this._subscribers.filter(cb => cb !== callback);
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
        // Start periodic server sync to reflect others' changes
        setInterval(() => taskStore.syncWithServer(), 20000);
    });
});