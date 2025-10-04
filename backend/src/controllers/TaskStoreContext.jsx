import React, { createContext, useReducer, useEffect, useContext } from 'react';

// 1. تصميم مخطط البيانات (Schema Design)
// الحالة الأولية، سيتم استعادتها من localStorage إن وجدت.
const initialState = {
    // tasks: { agentId: [{ day: 0, audited: false, competition_sent: false }, ...], ... }
    tasks: {}, 
};

// 2. إنشاء الـ Context
export const TaskContext = createContext(initialState);

// 3. تعريف الـ Reducer (وظيفة التزامن)
// هذه هي الوظيفة الوحيدة التي يمكنها تعديل الحالة.
const taskReducer = (state, action) => {
    switch (action.type) {
        case 'UPDATE_TASK_STATUS': {
            const { agentId, dayIndex, taskType, status } = action.payload;
            
            // إنشاء نسخة عميقة من الحالة لتجنب التعديل المباشر
            const newState = JSON.parse(JSON.stringify(state));
            
            // التأكد من وجود مصفوفة مهام للوكيل
            if (!newState.tasks[agentId]) {
                // إنشاء مصفوفة أسبوعية فارغة (7 أيام)
                newState.tasks[agentId] = Array(7).fill(null).map((_, i) => ({
                    day: i,
                    audited: false,
                    competition_sent: false
                }));
            }

            // تحديث الحالة المطلوبة
            newState.tasks[agentId][dayIndex][taskType] = status;

            return newState;
        }
        case 'HYDRATE_STATE': {
            // استعادة الحالة من localStorage
            return action.payload;
        }
        default:
            return state;
    }
};

// 4. إنشاء الـ Provider (المزود)
export const TaskProvider = ({ children }) => {
    const [state, dispatch] = useReducer(taskReducer, initialState);

    // 5. آلية الاستمرارية (Persistence Mechanism)
    // الخطوة أ: استعادة الحالة (Hydration) عند تحميل التطبيق لأول مرة
    useEffect(() => {
        try {
            const storedState = localStorage.getItem('taskState');
            if (storedState) {
                dispatch({ type: 'HYDRATE_STATE', payload: JSON.parse(storedState) });
            }
        } catch (error) {
            console.error("Failed to parse state from localStorage", error);
        }
    }, []); // يعمل مرة واحدة فقط

    // الخطوة ب: حفظ الحالة (Serialization) في localStorage بعد كل تحديث
    useEffect(() => {
        try {
            localStorage.setItem('taskState', JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save state to localStorage", error);
        }
    }, [state]); // يعمل كلما تغيرت الحالة

    return (
        <TaskContext.Provider value={{ state, dispatch }}>
            {children}
        </TaskContext.Provider>
    );
};

// 6. Hook مخصص لتسهيل استخدام الـ Context
export const useTasks = () => {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
};