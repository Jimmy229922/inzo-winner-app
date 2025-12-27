const ITEM_HEIGHT = 140; // 130px height + 10px margin-bottom
const BUFFER_ITEMS = 5; // Render items above and below the viewport for smoother scrolling
let weeklyResetCountdownInterval = null;

/**
 * Applies or removes search term highlighting from an agent item element.
 * @param {HTMLElement} element The agent item element.
 * @param {string} searchTerm The search term to highlight.
 */
function applyHighlight(element, searchTerm) {
  const nameEl = element.querySelector(".agent-name");
  const idEl = element.querySelector(".calendar-agent-id");
  const originalName = element.dataset.name;
  const originalId = "#" + element.dataset.agentidStr;

  const regex = searchTerm
    ? new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi")
    : null;

  nameEl.innerHTML = searchTerm
    ? originalName.replace(regex, "<mark>$&</mark>")
    : originalName;
  idEl.innerHTML = searchTerm
    ? originalId.replace(regex, "<mark>$&</mark>")
    : originalId;
}

function createAgentItemHtml(
  agent,
  dayIndex,
  isToday,
  tasksState,
  number,
  searchTerm = ""
) {
  // Read state directly from the centralized store's state
  const agentTasks = tasksState.tasks[agent._id] || {};
  const task = agentTasks[dayIndex] || {
    audited: false,
    competition_sent: false,
  };

  const isComplete = task.audited; // Visual completion now only requires audit
  const avatarHtml = agent.avatar_url
    ? `<img src="${agent.avatar_url}" alt="Avatar" class="calendar-agent-avatar" loading="lazy">`
    : `<div class="calendar-agent-avatar-placeholder"><i class="fas fa-user"></i></div>`;

  const isSuperAdmin = currentUserProfile?.role === "super_admin";
  const cursorStyle = isSuperAdmin ? "cursor: grab;" : "cursor: pointer;";

  const element = document.createElement("div");
  element.id = `agent-card-${agent._id}-${dayIndex}`;
  element.className = `calendar-agent-item ${isComplete ? "complete" : ""}`;
  element.dataset.agentId = agent._id;
  element.dataset.classification = agent.classification;
  element.dataset.name = agent.name;
  element.dataset.agentidStr = agent.agent_id;
  element.dataset.dayIndex = dayIndex;
  element.style.cssText = cursorStyle;
  if (isSuperAdmin) element.setAttribute("draggable", "true");

  element.innerHTML = `
        <div class="calendar-agent-number">${number}</div>
        <div class="calendar-agent-main">
            ${avatarHtml}
            <div class="calendar-agent-info">
                <span class="agent-name"></span>
                <div class="agent-meta">
                    <p class="calendar-agent-id" title="نسخ الرقم" data-agent-id-copy="${
                      agent.agent_id
                    }"></p>
                    <span class="classification-badge classification-${agent.classification.toLowerCase()}">${
    agent.classification
  }</span>
                </div>
            </div>
        </div>
        <div class="calendar-agent-actions">
            <div class="action-item ${task.audited ? "done" : ""}">
                <label>التدقيق</label>
                <label class="custom-checkbox toggle-switch">
                    <input type="checkbox" class="audit-check" data-agent-id="${
                      agent._id
                    }" data-day-index="${dayIndex}" ${
    task.audited ? "checked" : ""
  }>
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="action-item ${task.competition_sent ? "done" : ""}">
                <label>المسابقة</label>
                <label class="custom-checkbox toggle-switch">
                    <input type="checkbox" class="competition-check" data-agent-id="${
                      agent._id
                    }" data-day-index="${dayIndex}" ${
    task.competition_sent ? "checked" : ""
  }>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
    `;

  applyHighlight(element, searchTerm);

  const nameEl = element.querySelector(".agent-name");
  // إضافة علامة الصح فقط عند تفعيل التدقيق
  if (isComplete) {
    nameEl.insertAdjacentHTML(
      "beforeend",
      '<i class="fas fa-check-circle task-complete-icon" title="المهمة مكتملة"></i>'
    );
    nameEl.classList.add("has-checkmark");
  }

  return element;
}

class CalendarUI {
  constructor(container) {
    this.container = container;
    this.container.innerHTML = `
        <div class="page-header column-header">
            <div class="header-top-row">
                <h1>تقويم المهام الأسبوعي</h1>
                <div class="header-actions-group">
                    <button id="reset-all-tasks-btn" class="btn btn-danger">
                        <i class="fas fa-undo"></i> إعادة تعيين الكل
                    </button>
                    <div id="weekly-reset-countdown-container" class="countdown-timer-container" style="display: none;">
                        <i class="fas fa-sync-alt"></i>
                        <span>إعادة التعيين خلال: <span id="weekly-reset-countdown" class="countdown-time"></span></span>
                    </div>
                    <span class="info-tooltip" title="حالة جميع الوكلاء سيتم إعادة تعيينها (إلغاء التدقيق والإرسال) تلقائياً كل يوم أحد الساعة 7 صباحاً">
                        <i class="fas fa-info-circle"></i>
                    </span>
                </div>
            </div>
            <div class="calendar-filters">
                <div class="filter-search-container">
                    <input type="search" id="calendar-search-input" placeholder="بحث بالاسم أو الرقم..." autocomplete="off">
                    <i class="fas fa-search"></i>
                    <i class="fas fa-times-circle search-clear-btn" id="calendar-search-clear"></i>
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">الكل</button>
                    <button class="filter-btn" data-filter="R">R</button>
                    <button class="filter-btn" data-filter="A">A</button>
                    <button class="filter-btn" data-filter="B">B</button>
                    <button class="filter-btn" data-filter="C">C</button>
                </div>
            </div>
        </div>
        <div id="calendar-container" class="calendar-container"></div>
        `;
    this.calendarContainer = this.container.querySelector(
      "#calendar-container"
    );
    this.calendarData = [];
    this.tasksState = null;
    this.daysOfWeek = [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة"
    ];
    this.searchDebounceTimer = null;
    this._syncInterval = null;

    this.boundHandleChange = this._handleChange.bind(this);
    this.boundHandleResetAll = this.handleResetAllTasks.bind(this);
    this.boundUpdateUIFromState = this.updateCalendarUIFromState.bind(this);
  }

  destroy() {
    if (window.taskStore && this.boundUpdateUIFromState) {
        window.taskStore.unsubscribe(this.boundUpdateUIFromState);
    }
    clearTimeout(this.searchDebounceTimer);
    if (weeklyResetCountdownInterval) {
      clearInterval(weeklyResetCountdownInterval);
    }
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
    this.calendarContainer.removeEventListener(
      "change",
      this.boundHandleChange
    );
    const resetBtn = this.container.querySelector("#reset-all-tasks-btn");
    if (resetBtn) {
      resetBtn.removeEventListener("click", this.boundHandleResetAll);
    }
    console.log("[Calendar Page] Instance destroyed and listeners cleaned up.");
  }

  async render() {
    const response = await authedFetch("/api/calendar/data");
    if (!response.ok) {
      throw new Error(
        (await response.json()).message || "فشل جلب بيانات التقويم"
      );
    }
    const { agents } = await response.json();

    this.tasksState = window.taskStore.state;

    // Ensure we have the most recent authoritative task state from the server
    // (in case taskStore.init/localStorage raced with page rendering)
    try {
      if (
        window.taskStore &&
        typeof window.taskStore.syncWithServer === "function"
      ) {
        await window.taskStore.syncWithServer();
        this.tasksState = window.taskStore.state;
      }
    } catch (e) {
      console.warn("[Calendar] Failed to sync store during render:", e);
    }

    this.calendarData = this.daysOfWeek.map(() => []);
    
    // --- FIX: Build calendar data from ALL agents, showing them on ALL days where they have tasks ---
    agents.forEach((agent) => {
      // Check if agent has any tasks in the store
      const agentTasks = this.tasksState.tasks[agent._id] || {};
      const daysWithTasks = Object.keys(agentTasks).map(d => parseInt(d, 10));
      
      // FIX: Always use audit_days as the source of truth for which days to show agent
      // Tasks are just status indicators, not day assignment
      const dayIndices = agent.audit_days || [];
      dayIndices.forEach((dayIndex) => {
        if (dayIndex >= 0 && dayIndex <= 5) {
          // Ensure the array exists before checking
          if (!this.calendarData[dayIndex]) {
            this.calendarData[dayIndex] = [];
          }
          const alreadyAdded = this.calendarData[dayIndex].some(a => a._id === agent._id);
          if (!alreadyAdded) {
            this.calendarData[dayIndex].push(agent);
          }
        }
      });
    });

    this._renderDayColumns();
    this._renderAllAgentCards();
    this._setupEventListeners();
    setupCalendarFilters(this);

    // مزامنة دورية مع الخادم لضمان ظهور تغييرات الجميع للجميع
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncInterval = setInterval(() => {
      try {
        if (window.taskStore && window.taskStore.state) {
          const prevState = JSON.stringify(this.tasksState?.tasks || {});
          const newState = JSON.stringify(window.taskStore.state.tasks || {});
          if (prevState !== newState) {
            this.tasksState = window.taskStore.state;
            this._renderDayColumns();
            this._renderAllAgentCards();
          }
        }
      } catch (_) {
        /* ignore */
      }
    }, 20000); // كل 20 ثانية

    // The global subscription is enabled
    if (window.taskStore) {
        window.taskStore.subscribe(this.boundUpdateUIFromState);
    }
  }

  updateCalendarUIFromState(newState) {
      console.log('[Calendar] Received store update');
      this.tasksState = newState;
      // Re-render columns to reflect changes
      // We could optimize this to only update changed cells, but re-rendering columns is fast enough
      this._renderDayColumns();
      this._renderAllAgentCards();
      
      // Re-apply filters if any
      const searchInput = document.getElementById("calendar-search-input");
      if (searchInput && searchInput.value) {
          searchInput.dispatchEvent(new Event('input'));
      }
  }

  _renderDayColumns() {
    this.calendarContainer.innerHTML = "";
    this.daysOfWeek.forEach((dayName, index) => {
      const isToday = new Date().getDay() === index;
      const { completedTasks, totalTasks, progressPercent } =
        this._calculateDayProgress(index);

      const columnEl = document.createElement("div");
      columnEl.className = `day-column ${isToday ? "today" : ""}`;
      columnEl.dataset.dayIndex = index;
      columnEl.innerHTML = `
                <h2>${dayName}</h2>
                <div class="day-progress">
                    <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    <span class="progress-label">${completedTasks} / ${totalTasks} مكتمل</span>
                </div>
                <div class="day-column-content"></div>
            `;
      this.calendarContainer.appendChild(columnEl);
    });
  }

  _calculateDayProgress(dayIndex) {
    const dailyAgents = this.calendarData[dayIndex] || [];
    const totalTasks = dailyAgents.length;
    let completedTasks = 0;
    dailyAgents.forEach((agent) => {
      const task = (this.tasksState.tasks[agent._id] || {})[dayIndex] || {};
      if (task.audited) {
        completedTasks++;
      }
    });
    const progressPercent =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    return { completedTasks, totalTasks, progressPercent };
  }

  _renderAllAgentCards() {
    this.calendarData.forEach((agentsForDay, dayIndex) => {
      const columnEl = this.calendarContainer.querySelector(
        `.day-column[data-day-index="${dayIndex}"]`
      );
      if (!columnEl) return;

      const contentContainer = columnEl.querySelector(".day-column-content");
      contentContainer.innerHTML = "";

      if (agentsForDay.length > 0) {
        const fragment = document.createDocumentFragment();
        const isToday = new Date().getDay() === dayIndex;
        agentsForDay.forEach((agent, index) => {
          const agentElement = createAgentItemHtml(
            agent,
            dayIndex,
            isToday,
            this.tasksState,
            index + 1,
            ""
          );
          fragment.appendChild(agentElement);
        });
        contentContainer.appendChild(fragment);
      } else {
        contentContainer.innerHTML =
          '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
      }
    });
  }

  _setupEventListeners() {
    this.calendarContainer.addEventListener("change", this.boundHandleChange);
    this.container
      .querySelector("#reset-all-tasks-btn")
      .addEventListener("click", this.boundHandleResetAll);
    setupClickAndDragEventListeners(
      this.calendarContainer,
      this.calendarData,
      this
    );
  }

  async handleResetAllTasks() {
    showConfirmationModal(
      "هل أنت متأكد من إعادة تعيين جميع المهام (التدقيق والمسابقة) لهذا الأسبوع؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        showLoader();
        try {
          await window.taskStore.resetAllTasks();
          showToast("تمت إعادة تعيين جميع المهام بنجاح.", "success");

          // FIX: Manually re-render the UI without a page reload
          this.tasksState = window.taskStore.state; // Get the fresh, reset state
          this._renderDayColumns(); // Re-render columns to reset progress bars
          this._renderAllAgentCards(); // Re-render agent cards with reset state
        } catch (error) {
          console.error("Failed to reset all tasks:", error);
          showToast(`فشل إعادة التعيين: ${error.message}`, "error");
        } finally {
          hideLoader();
        }
      },
      {
        title: "تأكيد إعادة تعيين الكل",
        confirmText: "نعم، أعد التعيين",
        confirmClass: "btn-danger",
      }
    );
  }

  async _handleChange(e) {
    const checkbox = e.target;
    if (!checkbox.matches(".audit-check, .competition-check")) return;

    const agentId = checkbox.dataset.agentId;
    const dayIndex = parseInt(checkbox.dataset.dayIndex, 10);
    const taskType = checkbox.classList.contains("audit-check")
      ? "audited"
      : "competition_sent";
    const status = checkbox.checked;

    // ========== DEBUG CONSOLE LOGS ==========
    /* console.log("🔄 Toggle Changed!");
    console.log("📍 Agent ID:", agentId);
    console.log("📅 Day Index:", dayIndex);
    console.log("🏷️ Task Type:", taskType);
    console.log("✅ New Status:", status ? "ON (checked)" : "OFF (unchecked)");
    console.log("🎯 Checkbox element:", checkbox);
    console.log("🔍 Checkbox classes:", checkbox.className);
    console.log("📊 Checkbox checked property:", checkbox.checked);
    console.log("========================================"); */
    // ========================================

    const agentItem = checkbox.closest(".calendar-agent-item");
    agentItem.classList.add("is-loading");
    agentItem
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => (cb.disabled = true));

    try {
      // This updates the central store
      // console.log("📤 Sending update to server...");
      await window.taskStore.updateTaskStatus(
        agentId,
        dayIndex,
        taskType,
        status
      );
      // console.log("✅ Server update successful!");

      // FIX: Now, manually and correctly update the UI for this single item.
      updateCalendarUIFromState.call(this, {
        agentId,
        dayIndex,
        taskType,
        status,
      });
      // console.log("🎨 UI updated successfully!");
    } catch (error) {
      console.error(
        `[Calendar Error] Failed to update task. AgentID: ${agentId}, Day: ${dayIndex}, Type: ${taskType}. Reason:`,
        error
      );
      console.error("❌ Error details:", error);
      showToast("فشل تحديث حالة المهمة.", "error");

      // Revert UI on error
      checkbox.checked = !status;
      console.log("⏪ Reverted checkbox to:", !status);
      agentItem.classList.remove("is-loading");
      agentItem
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => (cb.disabled = false));
    }
  }

  _updateAfterDrag(sourceDayIndex, newDayIndex, agentId) {
    const agentToMove = this.calendarData[sourceDayIndex].find(
      (a) => a._id === agentId
    );
    if (!agentToMove) return;

    this.calendarData[sourceDayIndex] = this.calendarData[
      sourceDayIndex
    ].filter((a) => a._id !== agentId);
    this.calendarData[newDayIndex].push(agentToMove);
    this.calendarData[newDayIndex].sort((a, b) => a.name.localeCompare(b.name));

    // Re-render only the two affected columns for efficiency
    this._renderSingleDayColumn(sourceDayIndex);
    this._renderSingleDayColumn(newDayIndex);
  }

  _renderSingleDayColumn(dayIndex) {
    const columnEl = this.calendarContainer.querySelector(
      `.day-column[data-day-index="${dayIndex}"]`
    );
    if (!columnEl) return;

    const contentContainer = columnEl.querySelector(".day-column-content");
    contentContainer.innerHTML = "";

    const agentsForDay = this.calendarData[dayIndex] || [];
    if (agentsForDay.length > 0) {
      const fragment = document.createDocumentFragment();
      const isToday = new Date().getDay() === dayIndex;
      agentsForDay.forEach((agent, index) => {
        const agentElement = createAgentItemHtml(
          agent,
          dayIndex,
          isToday,
          this.tasksState,
          index + 1,
          ""
        );
        fragment.appendChild(agentElement);
      });
      contentContainer.appendChild(fragment);
    } else {
      contentContainer.innerHTML =
        '<div class="no-tasks-placeholder"><i class="fas fa-bed"></i><p>لا توجد مهام</p></div>';
    }
    updateDayProgressUI.call(this, dayIndex);
  }
}

let currentCalendarInstance = null;

async function renderCalendarPage() {
  if (currentCalendarInstance) {
    currentCalendarInstance.destroy();
  }
  const appContent = document.getElementById("app-content");
  currentCalendarInstance = new CalendarUI(appContent);
  try {
    await currentCalendarInstance.render();
    startWeeklyResetCountdown();
  } catch (error) {
    console.error("Error rendering calendar page:", error);
    const calendarContainer = document.getElementById("calendar-container");
    if (calendarContainer)
      calendarContainer.innerHTML = `<p class="error">حدث خطأ أثناء جلب بيانات التقويم: ${error.message}</p>`;
  }
}

function getNextResetTime() {
  const now = new Date();
  const nextReset = new Date();
  const day = now.getDay();
  const daysUntilSunday = (7 - day) % 7;
  nextReset.setDate(now.getDate() + daysUntilSunday);
  nextReset.setHours(7, 0, 0, 0);
  if (day === 0 && now.getTime() > nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 7);
  }
  return nextReset;
}

function startWeeklyResetCountdown() {
  const countdownContainer = document.getElementById(
    "weekly-reset-countdown-container"
  );
  const countdownElement = document.getElementById("weekly-reset-countdown");
  if (!countdownContainer || !countdownElement) return;

  const updateTimer = () => {
    const now = new Date();
    const nextReset = getNextResetTime();
    const diff = nextReset - now;

    if (diff > 0 && diff < 5 * 60 * 60 * 1000) {
      countdownContainer.style.display = "flex";
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      countdownElement.textContent = `${h}س ${m}د ${s}ث`;
    } else {
      countdownContainer.style.display = "none";
    }

    if (diff < 0) {
      const lastReset = localStorage.getItem("lastWeeklyReset");
      if (!lastReset || new Date(lastReset) < nextReset) {
        localStorage.setItem("lastWeeklyReset", new Date().toISOString());
        location.reload();
      }
    }
  };

  updateTimer();
  weeklyResetCountdownInterval = setInterval(updateTimer, 1000);
}

function updateCalendarUIFromState({ agentId, dayIndex, taskType, status }) {
  const container = this.calendarContainer;
  if (!container) return;

  const agentItem = container.querySelector(
    `#agent-card-${agentId}-${dayIndex}`
  );
  if (!agentItem) return;

  const taskState = (this.tasksState.tasks[agentId] || {})[dayIndex] || {
    audited: false,
    competition_sent: false,
  };

  const checkbox = agentItem.querySelector(
    `.${taskType === "audited" ? "audit-check" : "competition-check"}`
  );
  if (checkbox) checkbox.checked = status;

  checkbox?.closest(".action-item").classList.toggle("done", status);

  if (taskType === "audited") {
    const isComplete = taskState.audited;
    agentItem.classList.toggle("complete", isComplete);
    const nameEl = agentItem.querySelector(".agent-name");
    if (nameEl) nameEl.classList.toggle("has-checkmark", isComplete);
  }

  agentItem.classList.remove("is-loading");
  agentItem
    .querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => (cb.disabled = false));

  updateDayProgressUI.call(this, dayIndex);
}

function updateDayProgressUI(dayIndex) {
  const column = document.querySelector(
    `.day-column[data-day-index="${dayIndex}"]`
  );
  if (!column) return;

  const progressBar = column.querySelector(".progress-bar");
  const progressLabel = column.querySelector(".progress-label");

  const allAgentsForDay = this.calendarData?.[dayIndex] || [];
  const totalTasks = allAgentsForDay.length;
  let completedTasks = 0;

  allAgentsForDay.forEach((agent) => {
    const task = (this.tasksState.tasks[agent._id] || {})[dayIndex] || {};
    if (task.audited) {
      completedTasks++;
    }
  });

  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  progressBar.style.width = `${progressPercent}%`;
  progressLabel.textContent = `${completedTasks} / ${totalTasks} مكتمل`;
}

function setupClickAndDragEventListeners(container, calendarData, uiInstance) {
  container.addEventListener("click", (e) => {
    const copyIdTrigger = e.target.closest(
      ".calendar-agent-id[data-agent-id-copy]"
    );
    if (copyIdTrigger) {
      e.stopPropagation();
      navigator.clipboard
        .writeText(copyIdTrigger.dataset.agentIdCopy)
        .then(() =>
          showToast(
            `تم نسخ الرقم: ${copyIdTrigger.dataset.agentIdCopy}`,
            "info"
          )
        );
      return;
    }
    const card = e.target.closest(".calendar-agent-item[data-agent-id]");
    if (card && !e.target.closest(".calendar-agent-actions")) {
      window.location.hash = `#profile/${card.dataset.agentId}`;
    }

    const actionItem = e.target.closest(".action-item");
    if (actionItem && !e.target.matches('input[type="checkbox"]')) {
      const checkbox = actionItem.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  const isSuperAdmin = currentUserProfile?.role === "super_admin";
  if (isSuperAdmin) {
    let draggedItem = null;
    let sourceDayIndex = null;

    container.addEventListener("dragstart", (e) => {
      const target = e.target.closest(".calendar-agent-item");
      if (target) {
        draggedItem = target;
        sourceDayIndex = parseInt(target.dataset.dayIndex, 10);
        setTimeout(() => target.classList.add("dragging"), 0);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", target.dataset.agentId);
      }
    });

    container.addEventListener("dragend", () => {
      if (draggedItem) {
        draggedItem.classList.remove("dragging");
        draggedItem = null;
      }
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const column = e.target.closest(".day-column");
      if (column) column.classList.add("drag-over");
    });

    container.addEventListener("dragleave", (e) => {
      const column = e.target.closest(".day-column");
      if (column) column.classList.remove("drag-over");
    });

    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      const targetColumn = e.target.closest(".day-column");
      if (!targetColumn || !draggedItem) return;

      targetColumn.classList.remove("drag-over");
      const newDayIndex = parseInt(targetColumn.dataset.dayIndex, 10);
      const agentId = draggedItem.dataset.agentId;
      const agentNameSafe = draggedItem?.dataset?.name || "هذا الوكيل";

      if (sourceDayIndex === newDayIndex) return;

      try {
        const agentCheckResponse = await authedFetch(
          `/api/agents/${agentId}?select=audit_days`
        );
        const { data: agent } = await agentCheckResponse.json();
        if ((agent.audit_days || []).includes(newDayIndex)) {
          showToast(
            `هذا الوكيل مجدول بالفعل في يوم ${uiInstance.daysOfWeek[newDayIndex]}.`,
            "warning"
          );
          return;
        }

        showConfirmationModal(
          `هل أنت متأكد من نقل الوكيل <strong>${agentNameSafe}</strong> من يوم <strong>${uiInstance.daysOfWeek[sourceDayIndex]}</strong> إلى يوم <strong>${uiInstance.daysOfWeek[newDayIndex]}</strong>؟`,
          async () => {
            const agentResponse = await authedFetch(
              `/api/agents/${agentId}?select=audit_days`
            );
            const { data: agent } = await agentResponse.json();
            const newAuditDays = [
              ...(agent.audit_days || []).filter((d) => d !== sourceDayIndex),
              newDayIndex,
            ];

            await authedFetch(`/api/agents/${agentId}`, {
              method: "PUT",
              body: JSON.stringify({ audit_days: newAuditDays }),
            });

            showToast("تم تحديث يوم التدقيق بنجاح.", "success");
            await logAgentActivity(
              currentUserProfile?._id,
              agentId,
              "DETAILS_UPDATE",
              `تم تغيير يوم التدقيق من ${uiInstance.daysOfWeek[sourceDayIndex]} إلى ${uiInstance.daysOfWeek[newDayIndex]} عبر التقويم.`
            );

            uiInstance._updateAfterDrag(sourceDayIndex, newDayIndex, agentId);
          }
        );
      } catch (error) {
        showToast(`فشل تحديث يوم التدقيق: ${error.message}`, "error");
      }
    });
  }
}

function setupCalendarFilters(uiInstance) {
  const searchInput = document.getElementById("calendar-search-input");
  const clearBtn = document.getElementById("calendar-search-clear");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const applyFilters = () => {
    if (clearBtn) {
      clearBtn.style.display = searchInput.value ? "block" : "none";
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    const activeFilter =
      document.querySelector(".filter-btn.active").dataset.filter;

    uiInstance.calendarData.forEach((allAgentsForDay, dayIndex) => {
      const columnEl = uiInstance.calendarContainer.querySelector(
        `.day-column[data-day-index="${dayIndex}"]`
      );
      if (!columnEl) return;

      const filteredAgents = allAgentsForDay.filter((agent) => {
        const name = agent.name.toLowerCase();
        const agentIdStr = agent.agent_id;
        const classification = agent.classification;
        const matchesSearch =
          searchTerm === "" ||
          name.includes(searchTerm) ||
          agentIdStr.includes(searchTerm);
        const matchesFilter =
          activeFilter === "all" || classification === activeFilter;
        return matchesSearch && matchesFilter;
      });

      const contentContainer = columnEl.querySelector(".day-column-content");
      contentContainer.innerHTML = "";

      if (filteredAgents.length === 0) {
        contentContainer.innerHTML =
          '<div class="no-results-placeholder"><i class="fas fa-search"></i><p>لا توجد نتائج</p></div>';
      } else {
        const fragment = document.createDocumentFragment();
        const isToday = new Date().getDay() === dayIndex;
        filteredAgents.forEach((agent, index) => {
          const agentElement = createAgentItemHtml(
            agent,
            dayIndex,
            isToday,
            uiInstance.tasksState,
            index + 1,
            searchTerm
          );
          fragment.appendChild(agentElement);
        });
        contentContainer.appendChild(fragment);
      }
    });
  };

  searchInput.addEventListener("input", () => {
    clearTimeout(uiInstance.searchDebounceTimer);
    uiInstance.searchDebounceTimer = setTimeout(applyFilters, 300);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilters();
      searchInput.focus();
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      applyFilters();
    });
  });
}
