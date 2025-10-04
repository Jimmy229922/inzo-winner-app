import React, { useMemo } from 'react';
import { useTasks } from '../state/TaskStoreContext';
import CalendarToggle from './CalendarToggle';

/**
 * مكون يعرض قائمة مهام اليوم الحالي فقط.
 * @param {Array} agentsForToday - قائمة الوكلاء المجدولين لهذا اليوم.
 */
const DailyTasksList = ({ agentsForToday }) => {
    const { state } = useTasks(); // استهلاك الحالة من المخزن المركزي
    const todayIndex = new Date().getDay();

    // استخدام useMemo لتحسين الأداء وتجنب إعادة حساب البيانات مع كل تصيير
    const tasksForToday = useMemo(() => {
        return agentsForToday.map(agent => {
            const agentTasks = state.tasks[agent.id] || [];
            const task = agentTasks[todayIndex] || { audited: false, competition_sent: false };
            return { ...agent, task };
        });
    }, [state, agentsForToday, todayIndex]);

    return (
        <div>
            <h2>مهام اليوم</h2>
            {tasksForToday.map(agent => (
                <div key={agent.id} className="daily-task-item">
                    <span>{agent.name}</span>
                    <div className="actions">
                        <label>التدقيق: <CalendarToggle agentId={agent.id} dayIndex={todayIndex} taskType="audited" /></label>
                        <label>المسابقة: <CalendarToggle agentId={agent.id} dayIndex={todayIndex} taskType="competition_sent" /></label>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DailyTasksList;