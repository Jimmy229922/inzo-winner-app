import React from 'react';
import { useTasks } from '../state/TaskStoreContext';

/**
 * مكون زر التفعيل الذي يقرأ حالته من المخزن المركزي
 * ويرسل حركة (action) لتحديثه.
 * @param {string} agentId - معرف الوكيل
 * @param {number} dayIndex - فهرس اليوم (0-6)
 * @param {'audited' | 'competition_sent'} taskType - نوع المهمة
 */
const CalendarToggle = ({ agentId, dayIndex, taskType }) => {
    const { state, dispatch } = useTasks();

    // قراءة الحالة الحالية من المخزن المركزي
    const agentTasks = state.tasks[agentId] || [];
    const dayTask = agentTasks[dayIndex] || { [taskType]: false };
    const isChecked = dayTask[taskType];

    const handleToggle = (e) => {
        // إرسال حركة إلى الـ Reducer لتحديث الحالة
        dispatch({
            type: 'UPDATE_TASK_STATUS',
            payload: { agentId, dayIndex, taskType, status: e.target.checked }
        });
    };

    // استخدام React.memo لتحسين الأداء ومنع إعادة التصيير غير الضرورية
    return <input type="checkbox" checked={isChecked} onChange={handleToggle} />;
};

export default React.memo(CalendarToggle);