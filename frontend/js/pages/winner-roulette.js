// == winner-roulette.js ==
// winner-roulette.js
// Module to manage a roulette wheel for selecting winners

(function() {
'use strict';

// Ensure the modern winner modal with email field exists (handles legacy cached HTML without the input)
    function ensureWinnerModalStructure(){
      // [ensureWinnerModalStructure] START
      
      // FORCE RECREATE: Always remove and rebuild modal to ensure latest structure
      const oldModal = document.getElementById('winner-modal');
      if(oldModal){
        // Removing old modal if exists
        oldModal.remove();
      } else {
        // No old modal found
      }
      
      // Create fresh modal every time
      // Creating fresh modal
      const modal = document.createElement('div');
      modal.id='winner-modal';
      modal.className='wr-celebration-modal';
      modal.style.display='none';
      modal.innerHTML = `
        <div class="wr-celebration-content" role="dialog" aria-modal="true" style="width: 100%; max-width: 600px; padding: 2rem;">
          <h2 class="wr-celebration-title" style="font-size: 2rem; margin-bottom: 1rem;">مبروك الفوز!</h2>
          <div class="wr-winner-card" style="margin-bottom: 1.5rem; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px;">
              <div class="wr-winner-name" id="celebration-winner-name" style="font-size: 1.5rem; font-weight: bold; color: #fff;">—</div>
              <div class="wr-winner-account" id="celebration-winner-account" style="color: #ccc;">—</div>
          </div>
          
          <div class="wr-form-group" style="text-align: right; margin-bottom: 1rem; position: relative; z-index: 10;">
              <label for="winner-email" class="wr-label" style="display: block; margin-bottom: 0.5rem; color: #ddd;">
                  <i class="fas fa-envelope"></i> البريد الإلكتروني
              </label>
              <input type="email" id="winner-email" class="wr-form-input" placeholder="example@email.com" autocomplete="email" tabindex="0" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; position: relative; z-index: 10;" />
              <div id="winner-email-error" class="wr-error-msg" style="display:none;color:#f87171;font-size:.75rem;margin-top:4px;">البريد غير صالح</div>
            </div>
  
            <div class="wr-form-group" style="text-align: right; margin-bottom: 1rem; position: relative; z-index: 10;">
              <label for="winner-id-image" class="wr-label" style="display: block; margin-bottom: 0.5rem; color: #ddd;">
                <i class="fas fa-image"></i> صورة الهوية
              </label>
              <input type="file" id="winner-id-image" accept="image/*" class="wr-form-input" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff;" />
              <div style="color:#9ca3af; font-size:.8rem; margin-top:6px;">يمكنك لصق الصورة مباشرة باستخدام Ctrl+V</div>
              <img id="winner-id-image-preview" alt="معاينة صورة الهوية" style="display:none; margin-top:8px; max-width:100%; max-height:80px; border-radius:8px; border:1px solid #444; background:#111; object-fit: contain; cursor: zoom-in;" />
          </div>
  
          <div class="wr-form-group" style="text-align: right; margin-bottom: 1rem; position: relative; z-index: 10;">
              <label class="wr-label" style="display: block; margin-bottom: 0.5rem; color: #ddd;">
                  <i class="fas fa-gift"></i> نوع الجائزة
              </label>
              <select id="winner-prize-type" class="wr-form-input" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff;">
                  <option value="trading">بونص تداولي</option>
                <option value="deposit">بونص إيداع</option>
                <option value="deposit_prev">بونص إيداع كونه فائز مسبقاً ببونص تداولي</option>
              </select>
          </div>
  
          <div class="wr-form-group" style="text-align: right; margin-bottom: 1.5rem; position: relative; z-index: 10;">
              <label class="wr-label" style="display: block; margin-bottom: 0.5rem; color: #ddd;">
                  <i class="fas fa-dollar-sign"></i> قيمة الجائزة
              </label>
              <div id="winner-prize-auto-display" style="display:block; padding: 12px; border-radius: 8px; border: 1px solid #10b981; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: bold; text-align: center;">
                  --
              </div>
          </div>
  
          <button id="confirm-winner" class="wr-confirm-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; position: relative; z-index: 10;">
              <i class="fas fa-check-circle"></i> اعتماد الفائز
          </button>
        </div>`;
      document.body.appendChild(modal);
      
      // Modal created and structure verified
      
      const contentBox = modal.querySelector('.wr-celebration-content');
      if (contentBox) {
        // Content box styles can be adjusted here if needed
      }
      
      // [ensureWinnerModalStructure] END
    }
    
    let state = {
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
      includeWarnPrev: false
    };
    
    const LS_KEY = 'winnerRouletteSession.v1';
    // Enforce no persistence of participants/winners across reloads
    try { localStorage.removeItem(LS_KEY); } catch {}
    
    function cleanName(name) {
      if (!name) return '';
      // Remove sequential numbers like "1- ", "2- ", etc. from the beginning
      return name.replace(/^\d+\s*-\s*/, '').trim();
    }
    
    function truncateText(str, max) {
      if (!str) return '';
      return str.length > max ? str.slice(0, Math.max(0, max - 1)) + '…' : str;
    }
    
    function getWheelDisplayName(name, n) {
      // Return full name without truncation
      return cleanName(name || '');
    }
    
    async function loadAgents() {
      const select = document.getElementById('agent-select');
      if (!select) return;
      try {
        const authedFetch = window.authedFetch || fetch;
        const response = await authedFetch('/api/agents?limit=1000');
        const result = await response.json();
        const agents = result.data || [];
        
        agents.forEach(agent => {
          const option = document.createElement('option');
          option.value = agent._id;
          option.textContent = `${agent.name} (#${agent.agent_id})`;
          option.dataset.agentId = agent.agent_id;
          select.appendChild(option);
        });
        
        // Don't restore selected agent - always start with default "-- اختر الوكيل --"
        // User must select agent explicitly each time
      } catch(e) {
        console.warn('Failed to load agents:', e);
      }
    }
    
    function updateAgentStatus(name, agentId) {
      const status = document.getElementById('agent-selection-status');
      if (!status) return;
      if (name && agentId) {
        status.textContent = `${name} (#${agentId})`;
        status.className = 'wr-agent-status selected';
      } else {
        status.textContent = '';
        status.className = 'wr-agent-status';
      }
    }
    
    async function loadAgentCompetitionInfo(agentId) {
      const infoBox = document.getElementById('agent-info-box');
      const nameEl = document.getElementById('agent-info-name');
      const idEl = document.getElementById('agent-info-id');
      const competitionInfo = document.getElementById('agent-competition-info');
      
      if (!infoBox || !state.selectedAgent) return;
      
      // Show box and populate agent basic info
      infoBox.style.display = 'block';
      nameEl.textContent = state.selectedAgent.name || '—';
      idEl.textContent = state.selectedAgent.agentId || '—';
      
      // Show loading state
      competitionInfo.innerHTML = '<div class="wr-agent-info-empty"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
      
      try {
        const authedFetch = window.authedFetch || fetch;
        const response = await authedFetch(`/api/competitions/agent/${agentId}/active`);
        
        if (!response.ok) {
          competitionInfo.innerHTML = '<div class="wr-agent-info-empty">لا توجد مسابقة نشطة</div>';
          return;
        }
        
        const result = await response.json();
        const competition = result.competition;
        
        if (!competition) {
          competitionInfo.innerHTML = '<div class="wr-agent-info-empty">لا توجد مسابقة نشطة</div>';
          return;
        }
        
        // Display comprehensive competition information
        const tradingWinners = competition.trading_winners_count || 0;
        const depositWinners = competition.deposit_winners_count || 0;
        const totalWinners = tradingWinners + depositWinners;
        const currentWinners = competition.current_winners_count || 0;
        
        // Store competition info in state for reference (include prize data)
        state.activeCompetition = {
          id: competition._id,
          tradingWinnersRequired: tradingWinners,
          depositWinnersRequired: depositWinners,
          totalRequired: totalWinners,
          currentWinners: currentWinners,
          prizePerWinner: competition.prize_per_winner || 0,
          depositBonusPercentage: competition.deposit_bonus_percentage || 0
        };
    
        // --- NEW: Fetch agent winner history for validation ---
        try {
            const historyResp = await authedFetch(`/api/agents/${agentId}/winners`);
            if (historyResp.ok) {
                const historyData = await historyResp.json();
                // Flatten the competitions structure to get a simple list of winners
                state.agentHistory = [];
                if (historyData.competitions) {
                    historyData.competitions.forEach(c => {
                        if (c.winners) {
                            c.winners.forEach(w => {
                                state.agentHistory.push({
                                    ...w,
                                    competitionName: c.title,
                                    competitionId: c.id
                                });
                            });
                        }
                    });
                }
                console.log('Loaded agent winner history:', state.agentHistory.length);
            }
        } catch (e) {
            console.warn('Failed to load agent history:', e);
            state.agentHistory = [];
        }
        // -----------------------------------------------------
    
        // Check if competition is completed
        if (currentWinners >= totalWinners && totalWinners > 0) {
          competitionInfo.innerHTML = `
            <div class="wr-agent-info-empty" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #10b981;">
              <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
              <br>
              تم اكتمال اختيار الفائزين لهذه المسابقة
            </div>`;
          // Disable controls
          const autoBtn = document.getElementById('auto-pick-btn');
          if(autoBtn) { autoBtn.disabled = true; autoBtn.classList.add('wr-btn-disabled'); }
          return;
        }
    
        // Show engagement stats modal if stats are missing (0)
        if ((!competition.views_count && !competition.reactions_count && !competition.participants_count) || 
            (competition.views_count === 0 && competition.reactions_count === 0 && competition.participants_count === 0)) {
          showEngagementModal(competition._id);
        }
        
        // Format competition data
        const createdDate = new Date(competition.createdAt).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const statusText = {
          'sent': 'تم الإرسال',
          'active': 'نشطة',
          'awaiting_winners': 'قيد الانتظار'
        }[competition.status] || competition.status;
        
        const statusColor = {
          'sent': '#f59e0b',
          'active': '#10b981',
          'awaiting_winners': '#3b82f6'
        }[competition.status] || '#6b7280';
        
        let html = `
          <div class="wr-competition-header">
            <div class="wr-competition-title">
              <i class="fas fa-trophy"></i>
              <span>${competition.name || 'مسابقة'}</span>
            </div>
            <div class="wr-competition-status" style="background-color: ${statusColor}">
              ${statusText}
            </div>
          </div>
          
          <div class="wr-competition-meta">
            <div class="wr-meta-row">
              <i class="fas fa-calendar"></i>
              <span>تم الإنشاء: ${createdDate}</span>
            </div>
            ${(() => {
              // Determine Arabic type label from template.type or legacy competition_type
              const t = competition.template?.type; // Arabic preferred
              const legacy = competition.template?.competition_type; // 'standard' | 'special'
              let label = '';
              if (t && (t === 'مميزات' || t === 'تفاعلية')) {
                label = t;
              } else if (legacy) {
                label = legacy === 'special' ? 'تفاعلية' : 'مميزات';
              }
              return label ? `
            <div class="wr-meta-row">
              <i class="fas fa-tag"></i>
              <span>نوع المسابقة: ${label}</span>
            </div>` : '';
            })()}
            ${competition.duration ? `
            <div class="wr-meta-row">
              <i class="fas fa-clock"></i>
              <span>المدة: ${competition.duration}</span>
            </div>` : ''}
          </div>
          
          <div class="wr-competition-stats">
            <div class="wr-stats-header">
              <i class="fas fa-users"></i>
              <span>إحصائيات الفائزين المطلوبين</span>
            </div>`;
        
        if (totalWinners > 0) {
          html += `<div class="wr-competition-stat-row wr-stat-total">
            <span class="wr-competition-stat-label"><i class="fas fa-trophy"></i> إجمالي الفائزين</span>
            <span class="wr-competition-stat-value">${totalWinners} فائز</span>
          </div>`;
          
          if (depositWinners > 0) {
            html += `<div class="wr-competition-stat-row">
              <span class="wr-competition-stat-label"><i class="fas fa-dollar-sign"></i> بونص إيداع</span>
              <span class="wr-competition-stat-value deposit">${depositWinners} فائز</span>
            </div>`;
          }
          
          if (tradingWinners > 0) {
            html += `<div class="wr-competition-stat-row">
              <span class="wr-competition-stat-label"><i class="fas fa-chart-line"></i> بونص تداولي</span>
              <span class="wr-competition-stat-value trading">${tradingWinners} فائز</span>
            </div>`;
          }
        } else {
          html += '<div class="wr-agent-info-empty">لم يتم تحديد فائزين في المسابقة</div>';
        }
        
        // Add prize information - always show if deposit bonus percentage exists
        if (competition.deposit_bonus_percentage) {
          html += `<div class="wr-prize-info">
            <div class="wr-prize-header">
              <i class="fas fa-gift"></i>
              <span>تفاصيل الجوائز</span>
            </div>`;
          
          if (competition.prize_per_winner) {
            html += `<div class="wr-prize-row">
              <span class="wr-prize-label">قيمة الجائزة لكل فائز:</span>
              <span class="wr-prize-value">$${competition.prize_per_winner}</span>
            </div>`;
          }
          
          html += `<div class="wr-prize-row">
            <span class="wr-prize-label">نسبة البونص الإيداعي:</span>
            <span class="wr-prize-value">${competition.deposit_bonus_percentage}%</span>
          </div>`;
          
          html += '</div>';
        }
        
        // Add engagement stats
        if (competition.views_count || competition.reactions_count || competition.participants_count) {
          html += `<div class="wr-engagement-stats">
            <div class="wr-engagement-header">
              <i class="fas fa-chart-bar"></i>
              <span>إحصائيات التفاعل</span>
            </div>
            <div class="wr-engagement-grid">`;
          
          if (competition.views_count !== undefined) {
            html += `<div class="wr-engagement-item">
              <div class="wr-engagement-value">${competition.views_count || 0}</div>
              <div class="wr-engagement-label">مشاهدة</div>
            </div>`;
          }
          
          if (competition.reactions_count !== undefined) {
            html += `<div class="wr-engagement-item">
              <div class="wr-engagement-value">${competition.reactions_count || 0}</div>
              <div class="wr-engagement-label">تفاعل</div>
            </div>`;
          }
          
          if (competition.participants_count !== undefined) {
            html += `<div class="wr-engagement-item">
              <div class="wr-engagement-value">${competition.participants_count || 0}</div>
              <div class="wr-engagement-label">مشارك</div>
            </div>`;
          }
          
          html += '</div></div>';
        }
        
        html += '</div>';
        competitionInfo.innerHTML = html;
        
      } catch(e) {
        console.warn('Failed to load agent competition:', e);
        competitionInfo.innerHTML = '<div class="wr-agent-info-empty">فشل تحميل البيانات</div>';
      }
    }
    
    function hideAgentInfoBox() {
      const infoBox = document.getElementById('agent-info-box');
      if (infoBox) infoBox.style.display = 'none';
    }
    
    function drawWheel() {
      const canvas = document.getElementById('winner-roulette-wheel');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const baseSize = 520;
      canvas.width = baseSize;
      canvas.height = baseSize;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const radius = Math.min(W, H) / 2 - 15;
    
      // تحديث وقت النبض للتأثير المتحرك
      state.pulseTime += 0.05;
    
      ctx.clearRect(0, 0, W, H);
    
      // المرشحين للاختيار (يستثنى الفائز إذا تم تفعيل الاستبعاد)
      const candidates = state.entries.filter(e => !e.selected || !state.excludeWinner);
      // If a spin is in progress and we have a snapshot, use it for consistent visuals
      const candidatesSource = (state.spinning && state.spinSnapshot && state.spinSnapshot.length) ? state.spinSnapshot : candidates;
      // إن اكتمل عدد الفائزين المطلوب للمسابقة اعرض الروليت بأسماء الفائزين فقط
      const showWinnersOnly = state.activeCompetition && state.winners.length === state.activeCompetition.totalRequired && state.winners.length > 0;
      const wheelData = showWinnersOnly ? state.winners : candidatesSource;
      const n = wheelData.length === 0 ? 1 : wheelData.length; // لا تجعلها صفر لتفادي القسمة على صفر
      const slice = (Math.PI * 2) / n;
      
      // لوحة الألوان بدرجات اللون الأزرق الداكن المطلوب
      const baseColor = 'rgb(12, 33, 64)';
      const colors = [
        { base: baseColor, light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' },
        { base: baseColor, light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' },
        { base: baseColor, light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' }
      ];
    
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-state.angle);
    
      for (let i = 0; i < n; i++) {
        const start = i * slice + Math.PI/2;
        const end = start + slice;
        const midAngle = start + slice / 2;
        const colorSet = colors[i % 3];
        
        // نصف قطر الشعار في المنتصف لتجنب التداخل
        const innerRadius = 60; // أصغر من قبل لإعطاء مساحة أكبر للنصوص
        
        // رسم القطاع الأساسي (حلقي بدلاً من مثلث)
        ctx.beginPath();
        ctx.arc(0, 0, radius, start, end);
        ctx.arc(0, 0, innerRadius, end, start, true);
        ctx.closePath();
        
        // تدرج لوني من المركز إلى الخارج
        const baseGradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, radius);
        baseGradient.addColorStop(0, colorSet.dark);
        baseGradient.addColorStop(0.4, colorSet.base);
        baseGradient.addColorStop(1, colorSet.light);
        ctx.fillStyle = baseGradient;
        ctx.fill();
    
        // تأثير الإضاءة ثلاثي الأبعاد
        ctx.save();
        ctx.clip();
        
        // إضاءة علوية
        const lightGradient = ctx.createRadialGradient(
          Math.cos(midAngle) * radius * 0.3, 
          Math.sin(midAngle) * radius * 0.3, 
          0,
          Math.cos(midAngle) * radius * 0.5, 
          Math.sin(midAngle) * radius * 0.5, 
          radius * 0.9
        );
        lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        lightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
        lightGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
        lightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        
        ctx.fillStyle = lightGradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, start, end);
        ctx.arc(0, 0, innerRadius, end, start, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    
        // رسم الخطوط الفاصلة بين القطاعات (من الشعار إلى الحافة الخارجية)
        ctx.beginPath();
        ctx.moveTo(Math.cos(start) * innerRadius, Math.sin(start) * innerRadius);
        ctx.lineTo(Math.cos(start) * radius, Math.sin(start) * radius);
        
        // خط فاصل ذهبي
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.stroke();
        
        // خط داخلي للعمق
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowColor = 'transparent';
        
        // دوائر زخرفية داخلية (ضمن المنطقة الحلقية فقط)
        const decorRadius1 = innerRadius + (radius - innerRadius) * 0.4;
        const decorRadius2 = innerRadius + (radius - innerRadius) * 0.7;
        
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, decorRadius2, start, end);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, decorRadius1, start, end);
        ctx.stroke();
    
        // النص: اسم المشارك (أفقي)
        // Note: We draw in the same order as the array (don't reverse)
        const entry = wheelData[i];
        // إذا لا يوجد بيانات (n=1 و wheelData فارغ) اعرض نص افتراضي
        const displayName = entry ? getWheelDisplayName(entry.name, n) : 'لا توجد أسماء';
        const seqPrefix = entry && (entry.seq || entry.seq === 0) ? `${entry.seq}- ` : '';
        const text = seqPrefix + displayName;
        ctx.save();
        ctx.rotate(midAngle);
        // وضع النص في منتصف المسافة بين الشعار والحافة الخارجية
        const textRadius = (innerRadius + radius) / 2;
        ctx.translate(textRadius, 0);
        // إزالة الدوران العمودي لجعل النص أفقياً
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // ظل ثلاثي للنص
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        // ضبط حجم الخط حسب عدد القطاعات
        const baseFontSize = 18;
        let dynamicSize = n <= 3 ? 32 : n <= 6 ? 26 : n <= 10 ? 22 : baseFontSize;
        
        // حساب العرض المتاح للنص في القطاع الحلقي
        const availableWidth = (radius - innerRadius) * 0.85; // عرض القطاع مع هامش
        
        // تجربة الخط وقياس عرض النص
        ctx.font = `bold ${dynamicSize}px Arial`;
        let textWidth = ctx.measureText(text).width;
        
        // تصغير الخط تلقائياً إذا كان النص أطول من العرض المتاح
        while (textWidth > availableWidth && dynamicSize > 8) {
          dynamicSize -= 1;
          ctx.font = `bold ${dynamicSize}px Arial`;
          textWidth = ctx.measureText(text).width;
        }
    
        // النص الأبيض فقط مع ظل أسود بسيط
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(text, 0, 0);
        
        ctx.shadowColor = 'transparent';
        ctx.restore();
      }
    
      ctx.restore();
    
      // رسم دائرة بخلفية زرقاء داكنة في المنتصف للشعار
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(19, 53, 91)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      // حدود بنفس لون الخلفية الزرقاء
      ctx.strokeStyle = 'rgb(19, 53, 91)';
      ctx.lineWidth = 4;
      ctx.stroke();
    
      // رسم الشعار في المنتصف
      if (!state.logoImage) {
        state.logoImage = new Image();
        state.logoImage.src = '/images/logo.png';
        state.logoImage.onload = () => {
          drawWheel(); // إعادة رسم العجلة بعد تحميل الشعار
        };
      }
      
      if (state.logoImage && state.logoImage.complete) {
        const logoSize = 60; // حجم الشعار أصغر لوضوح أفضل
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          state.logoImage,
          cx - logoSize / 2,
          cy - logoSize / 2,
          logoSize,
          logoSize
        );
        ctx.restore();
      }
      
      // رسم السهم الأحمر (المؤشر)
      ctx.save();
      ctx.translate(cx, cy - radius - 10); // موضع السهم فوق العجلة
      ctx.beginPath();
      ctx.moveTo(-15, -20); // الزاوية اليسرى العليا
      ctx.lineTo(15, -20);  // الزاوية اليمنى العليا
      ctx.lineTo(0, 10);    // رأس السهم (للأسفل)
      ctx.closePath();
      
      ctx.fillStyle = '#ef4444'; // لون أحمر
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      
      // حدود السهم
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      
      // إضافة نص "اضغط هنا" مع خلفية شفافة فوق الشعار
      if (state.showLogoHint) {
        ctx.save();
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    
        // قياس حجم النص
        const text = 'اضغط هنا';
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 24;
    
        // رسم خلفية دائرية متحركة بحجم الشعار كله
        const pulseOpacity = 0.2 + 0.2 * Math.sin(state.pulseTime); // تتراوح بين 0.2 و 0.4
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${pulseOpacity})`; // شفافية متحركة
        ctx.fill();
    
        // رسم النص مع ظل
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = 'white';
        ctx.fillText(text, cx, cy);
    
        ctx.restore();
      }
    }
    
    // ==========================================
    // Initialize Winner Roulette
    // ==========================================
    function init() {
      // [init] Winner Roulette initialization started
      
      try { document.body.classList.add('dark-mode'); } catch(e) {}
      
      // Make sure the modal structure is up-to-date before any winner selection occurs
      // Calling ensureWinnerModalStructure
      ensureWinnerModalStructure();
      // ensureWinnerModalStructure completed
      
      // التحقق من agent_id في URL للتحديد التلقائي
      const hash = window.location.hash;
      const [route, query] = hash.split('?');
      const urlParams = new URLSearchParams(query || '');
      const agentIdFromUrl = urlParams.get('agent_id');
      
      // Clear selected agent on page load - always start fresh
      state.selectedAgent = null;
      state.activeCompetition = null;
      
      loadAgents();
      bindUI();
      startPulseAnimation(); // بدء التأثير المتحرك للخلفية
      
      // إذا كان هناك agent_id في URL، حدد الوكيل تلقائياً
      if (agentIdFromUrl) {
        setTimeout(() => {
          autoSelectAgent(agentIdFromUrl);
        }, 500); // انتظار تحميل الوكلاء
      }
      
      restoreSession(true); // لا نستعيد الوكيل بعد الآن
      state.selectedAgent = null; // تأكيد التفريغ بعد الاسترجاع
      updateSpinControls?.();
      drawWheel();
    
      // Log screen size for debugging
      // Screen size log removed to reduce noise
    }
    
    function autoSelectAgent(agentId) {
      const agentSelect = document.getElementById('agent-select');
      if (!agentSelect) return;
      
      // البحث عن الخيار الذي يطابق agent _id
      const option = Array.from(agentSelect.options).find(opt => opt.value === agentId);
      if (option) {
        agentSelect.value = option.value;
        // محاكاة حدث change لتحديد الوكيل
        agentSelect.dispatchEvent(new Event('change'));
        console.log(`تم تحديد الوكيل تلقائياً: ${option.textContent}`);
      } else {
        console.warn(`لم يتم العثور على وكيل بالمعرف: ${agentId}`);
      }
    }
    
    function startPulseAnimation() {
      if (state.isAnimating) return; // تجنب التكرار
      state.isAnimating = true;
      
      const animate = () => {
        if (!state.isAnimating) return;
        state.pulseTime += 0.05;
        drawWheel(); // إعادة رسم العجلة مع التحديث الجديد
        requestAnimationFrame(animate);
      };
      
      animate();
    }
    
    function bindUI() {
      const applyBtn = document.getElementById('apply-list');
      const autoBtn = document.getElementById('auto-pick-btn');
      const resetBtn = document.getElementById('reset-wheel');
      const openWheelBtn = document.getElementById('open-wheelofnames');
      const excludeCb = document.getElementById('exclude-winner');
      const saveBtn = document.getElementById('save-session');
      const restoreBtn = document.getElementById('restore-session');
      const exportBtn = document.getElementById('export-winners');
      const batchInput = document.getElementById('batch-count');
      const speedSelect = document.getElementById('spin-speed');
      const confettiCanvas = document.getElementById('wr-confetti-canvas');
      const searchInput = document.getElementById('participants-search');
      const resetWinnersBtn = document.getElementById('reset-winners');
      const agentSelect = document.getElementById('agent-select');
      const refreshParticipantsBtn = document.getElementById('refresh-participants');
      const sendReportBtn = document.getElementById('send-winners-report');
      sendReportBtn?.addEventListener('click', sendWinnersReport);
      const sendDetailsBtn = document.getElementById('send-winners-details');
      sendDetailsBtn?.addEventListener('click', sendWinnersDetails);
      const warnMeetCb = document.getElementById('warn-meet-client');
      const warnPrevCb = document.getElementById('warn-prev-winner');
      // If toggles are missing (cached HTML), inject them
      if (!warnMeetCb || !warnPrevCb) {
        const inlineActions = document.querySelector('.wr-inline-actions');
        if (inlineActions && !document.getElementById('warn-meet-client')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'wr-warning-toggles';
          wrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:6px;width:100%;';
          wrapper.innerHTML = `
            <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.9rem;">
              <input type="checkbox" id="warn-meet-client">
              <span>إضافة تنبيه: ⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً</span>
            </label>
            <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.9rem;">
              <input type="checkbox" id="warn-prev-winner">
              <span>إضافة تنبيه: ‼️ فائز سابق ببونص تداولي، تأكد من نشر المسابقة السابقة قبل الاعتماد</span>
            </label>
          `;
          inlineActions.appendChild(wrapper);
        }
      }
      const warnMeetEl = document.getElementById('warn-meet-client');
     const warnPrevEl = document.getElementById('warn-prev-winner');
      warnMeetEl?.addEventListener('change', (e) => { state.includeWarnMeet = !!e.target.checked; });
      warnPrevEl?.addEventListener('change', (e) => { state.includeWarnPrev = !!e.target.checked; });
      if(confettiCanvas){confettiCanvas.width=window.innerWidth;confettiCanvas.height=window.innerHeight;}
    
      agentSelect?.addEventListener('change', async (e) => {
        const agentId = e.target.value;
        if (!agentId) {
          state.selectedAgent = null;
          updateAgentStatus('', '');
          hideAgentInfoBox();
          updateSpinControls?.();
          updateBatchCount?.();
          return;
        }
        const option = e.target.selectedOptions[0];
        const agentIdNum = option.dataset.agentId;
        const agentName = option.textContent.split(' (#')[0]; // Extract name only
        state.selectedAgent = {
          id: agentId,
          name: agentName,
          agentId: agentIdNum
        };
        updateAgentStatus(agentName, agentIdNum);
        await loadAgentCompetitionInfo(agentId);
        saveSession();
        updateSpinControls?.();
        updateBatchCount?.();
      });
    
      const participantsInput = document.getElementById('participants-input');
      participantsInput?.addEventListener('input', (e) => {
        // Auto-parse and add participants when typing (line by line)
        const raw = e.target.value;
        const lines = raw.split('\n');
        
        // Re-parse all entries from scratch to ensure accuracy
        const parsedEntries = [];
        
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          // Ignore fully empty or non-text lines (e.g., only dashes/punctuation)
          const contentOnly = line.replace(/[-–—_|.,;:~*+=#\s]+/g, '');
          if (!line || contentOnly.length === 0) {
            continue;
          }
    
          // Remove sequential numbers from the beginning (like "1- ", "2- ", etc.)
          const cleanedLine = line.replace(/^\d+\s*[-–—]\s*/, '');
          
          // Parse this single line
          const parts = cleanedLine.split(/[—\-–]/).map(p => p.trim());
          
          if (parts.length >= 2) {
            const name = parts[0];
            const account = parts[1].replace(/[^\d]/g, '');
    
            if (name && account) {
              // Check if this entry already exists (by name and account)
              const exists = parsedEntries.find(e => e.name === name && e.account === account);
              if (!exists) {
                const newEntry = {
                  id: `entry_${Date.now()}_${i}_${Math.random()}`,
                  name: name,
                  account: account,
                  label: `${name} — ${account}`,
                  selected: false
                };
                parsedEntries.push(newEntry);
              }
            }
          } else if (parts.length === 1) {
            const name = parts[0];
            
            if (name) {
              // Check if this entry already exists (by name only)
              const exists = parsedEntries.find(e => e.name === name && !e.account);
              if (!exists) {
                const newEntry = {
                  id: `entry_${Date.now()}_${i}_${Math.random()}`,
                  name: name,
                  account: '',
                  label: name,
                  selected: false
                };
                parsedEntries.push(newEntry);
              }
            }
          }
        }
    
        // Update state with parsed entries, preserving selected status
        const oldSelected = state.entries.filter(e => e.selected);
        
        parsedEntries.forEach(newEntry => {
          const wasSelected = oldSelected.find(e => e.name === newEntry.name && e.account === newEntry.account);
          if (wasSelected) {
            newEntry.selected = true;
            newEntry.id = wasSelected.id; // Preserve original ID
          }
        });
        
        state.entries = parsedEntries;
        // مسح قائمة الفائزين عند تغيير المشاركين
        state.winners = [];
        
        renderParticipants();
        renderWinners();
        drawWheel();
        saveSession();
      });
    
      applyBtn?.addEventListener('click', () => {
        // This button is now hidden, but we keep the logic just in case
        const raw = document.getElementById('participants-input').value;
        state.entries = parseEntries(raw);
        // مسح قائمة الفائزين عند تغيير المشاركين
        state.winners = [];
        renderParticipants();
        renderWinners();
        drawWheel();
        toast('تم تحديث قائمة المشاركين', 'success');
      });
    
      excludeCb?.addEventListener('change', (e) => {
        state.excludeWinner = !!e.target.checked;
      });
    
      // إضافة النقر على الشعار للدوران
      const wheelCanvas = document.getElementById('winner-roulette-wheel');
      wheelCanvas?.addEventListener('click', (e) => {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        
        // إذا كان النقر داخل منطقة الشعار (نصف قطر 70)
        // ADJUSTMENT: Increased click radius to 80 to cover border
        if (distance <= 80) {
          // Hide the overlay hint when user interacts with the logo
          state.showLogoHint = false;
          drawWheel();
          queueSpin(1);
        }
      });
      
      autoBtn?.addEventListener('click', () => {
        const c = parseInt(batchInput?.value || '1',10);
        const count = c>0 ? c : 1;
        startAutoPick(count);
      });
      resetBtn?.addEventListener('click', () => {
        state.angle = 0; state.targetAngle = 0; drawWheel();
      });
    
      // Open entries in Wheel of Names via backend integration (secure API key)
      openWheelBtn?.addEventListener('click', async () => {
        try {
          const entries = (state.entries && state.entries.length)
            ? state.entries.map(e => (e.account ? `${e.name} — ${e.account}` : e.name))
            : (document.getElementById('participants-input')?.value || '')
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean);
    
          if (!entries.length) {
            toast('لا توجد أسماء لفتحها في Wheel of Names', 'warning');
            return;
          }
    
          const authedFetch = window.authedFetch || fetch;
          const title = state.selectedAgent?.name ? `مسابقة ${state.selectedAgent.name}` : 'مسابقة INZO';
          const body = { entries, title, agent: state.selectedAgent || undefined, shareMode: 'copyable' };
          const resp = await authedFetch('/api/integrations/wheelofnames/wheels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
    
          if (!resp.ok) {
            // Fallback: construct a prefilled URL on wheelofnames.com/view
            const txt = encodeURIComponent(entries.join(','));
            const fallbackUrl = `https://wheelofnames.com/view?entries=${txt}`;
            toast('تعذر إنشاء عجلة عبر الـ API، تم فتح الرابط البديل', 'info');
            window.open(fallbackUrl, '_blank');
            return;
          }
    
          const data = await resp.json();
          if (data && data.url) {
            window.open(data.url, '_blank');
            toast('تم إنشاء عجلة على Wheel of Names', 'success');
          } else {
            const txt = encodeURIComponent(entries.join(','));
            const fallbackUrl = `https://wheelofnames.com/view?entries=${txt}`;
            window.open(fallbackUrl, '_blank');
          }
        } catch (e) {
          console.error('Wheel of Names open failed', e);
          const entries = state.entries?.map(e => (e.account ? `${e.name} — ${e.account}` : e.name)) || [];
          if (entries.length) {
            const txt = encodeURIComponent(entries.join(','));
            const fallbackUrl = `https://wheelofnames.com/view?entries=${txt}`;
            window.open(fallbackUrl, '_blank');
          } else {
            toast('فشل فتح Wheel of Names', 'error');
          }
        }
      });
    
      saveBtn?.addEventListener('click', () => saveSession());
      restoreBtn?.addEventListener('click', () => restoreSession());
      exportBtn?.addEventListener('click', exportWinners);
      
      // Bottom section buttons
      const exportBottomBtn = document.getElementById('export-winners-bottom');
      const resetBottomBtn = document.getElementById('reset-winners-bottom');
      exportBottomBtn?.addEventListener('click', exportWinners);
      resetBottomBtn?.addEventListener('click', ()=> { 
        showConfirmModal(
          'سيتم مسح جميع الفائزين بشكل دائم من القائمة. هل أنت متأكد من المتابعة؟',
          () => {
            state.winners = [];
            renderWinners();
            updateCounts();
            saveSession();
            toast('تم مسح الفائزين بنجاح', 'success');
          }
        );
      });
      
      window.addEventListener('resize', () => { drawWheel(); if(confettiCanvas){confettiCanvas.width=window.innerWidth;confettiCanvas.height=window.innerHeight;} });
      searchInput?.addEventListener('input', ()=> { state.filterTerm = searchInput.value.trim(); renderParticipants(); updateCounts(); });
      resetWinnersBtn?.addEventListener('click', ()=> { 
        showConfirmModal(
          'سيتم مسح جميع الفائزين بشكل دائم من القائمة. هل أنت متأكد من المتابعة؟',
          () => {
            state.winners = [];
            renderWinners();
            updateCounts();
            saveSession();
            toast('تم مسح الفائزين بنجاح', 'success');
          }
        );
      });
      
      // Refresh participants button - adds winner to roulette after confirmation
      refreshParticipantsBtn?.addEventListener('click', () => {
        if (state.winners.length === 0) {
          toast('لا توجد فائزين لإضافتهم للروليت', 'warning');
          return;
        }
        
        // Add the latest winner to the roulette
        const latestWinner = state.winners[state.winners.length - 1];
        const existingEntry = state.entries.find(e => e.name === latestWinner.name && e.account === latestWinner.account);
        
        if (!existingEntry) {
          // Add winner to participants list
          const newEntry = {
            id: `winner_${Date.now()}`,
            name: latestWinner.name,
            account: latestWinner.account,
            label: `${latestWinner.name} — ${latestWinner.account}`,
            selected: false
          };
          state.entries.push(newEntry);
          // Also reflect this in the participants textarea to satisfy the rule
          const ta = document.getElementById('participants-input');
          if (ta) {
            const line = `${latestWinner.name} — ${latestWinner.account}`;
            const existing = ta.value.split('\n').map(s=>s.trim()).filter(Boolean);
            if (!existing.includes(line)) {
              ta.value = (ta.value ? (ta.value.replace(/\n+$/,'') + '\n') : '') + line;
            }
          }
          renderParticipants();
          renderWinners();
          drawWheel();
          toast(`تم إضافة ${latestWinner.name} للروليت`, 'success');
        } else {
          toast('الفائز موجود بالفعل في الروليت', 'info');
        }
      });
    }
    
    // --- Helper Functions & Missing Definitions ---
    
    function toast(msg, type = 'info') {
        if (window.showToast) {
            window.showToast(msg, type);
        } else {
            console.log(`[${type}] ${msg}`);
            // Fallback: create a simple toast if window.showToast is missing
            const toastEl = document.createElement('div');
            toastEl.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: ${type === 'error' ? '#ef4444' : '#10b981'};
                color: white; padding: 10px 20px; border-radius: 8px; z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-weight: bold;
            `;
            toastEl.textContent = msg;
            document.body.appendChild(toastEl);
            setTimeout(() => {
                toastEl.style.opacity = '0';
                setTimeout(() => document.body.removeChild(toastEl), 300);
            }, 3000);
        }
    }
    
    function saveSession() {
      // Do not persist entries/winners per requirement
      const session = {
        entries: [],
        winners: [],
        selectedAgent: null,
        excludeWinner: state.excludeWinner,
        filterTerm: state.filterTerm
      };
      try { localStorage.setItem(LS_KEY, JSON.stringify(session)); } catch {}
    }
    
    function restoreSession(skipAgent = false) {
      // Intentionally do not restore entries/winners. Clear UI on load.
      try {
        const excludeCb = document.getElementById('exclude-winner');
        if (excludeCb) excludeCb.checked = true;
        const searchInput = document.getElementById('participants-search');
        if (searchInput) searchInput.value = '';
        const ta = document.getElementById('participants-input');
        if (ta) ta.value = '';
        state.entries = [];
        state.winners = [];
        state.selectedAgent = null;
        state.filterTerm = '';
        renderParticipants();
        renderWinners();
        updateCounts();
      } catch (e) {
        console.warn('Skipping session restore due to requirement');
      }
    }
    
    function exportWinners() {
      if (state.winners.length === 0) {
        toast('لا يوجد فائزين للتصدير', 'warning');
        return;
      }
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += "الاسم,رقم الحساب,البريد الإلكتروني,نوع الجائزة,قيمة الجائزة,الوكيل\n";
      
      state.winners.forEach(w => {
        const agentName = w.agent ? w.agent.name : (state.selectedAgent ? state.selectedAgent.name : '');
        const row = [
          w.name,
          w.account,
          w.email || '',
          w.prizeType === 'deposit' ? 'بونص إيداع' : 'بونص تداولي',
          w.prizeValue || '',
          agentName
        ].map(f => `"${f}"`).join(",");
        csvContent += row + "\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `winners_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    function updateSpinSpeed(speed) {
      switch(speed) {
        case 'slow': state.spinDuration = 8000; break;
        case 'fast': state.spinDuration = 3000; break;
        default: state.spinDuration = 5000; // normal
      }
    }
    
    function showEngagementModal(competitionId) {
        // Check if modal already exists
        let modal = document.getElementById('engagement-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'engagement-modal';
            modal.className = 'wr-confirm-overlay';
            modal.innerHTML = `
                <div class="wr-confirm-modal" style="max-width: 400px;">
                    <div class="wr-confirm-icon" style="color: #3b82f6;"><i class="fas fa-chart-bar"></i></div>
                    <h3 class="wr-confirm-title">تسجيل التفاعلات</h3>
                    <p class="wr-confirm-message">يرجى إدخال إحصائيات التفاعل للمسابقة الحالية</p>
                    
                    <div class="wr-form-group" style="text-align: right; margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; color:#cbd5e1;">المشاهدات (Views)</label>
                        <input type="number" id="eng-views" class="wr-form-input" placeholder="0" min="0">
                    </div>
                    
                    <div class="wr-form-group" style="text-align: right; margin-bottom: 15px;">
                        <label style="display:block; margin-bottom:5px; color:#cbd5e1;">التفاعلات (Reactions)</label>
                        <input type="number" id="eng-reactions" class="wr-form-input" placeholder="0" min="0">
                    </div>
                    
                    <div class="wr-form-group" style="text-align: right; margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:5px; color:#cbd5e1;">المشاركات (Shares/Participants)</label>
                        <input type="number" id="eng-participants" class="wr-form-input" placeholder="0" min="0">
                    </div>
    
                    <div class="wr-confirm-actions">
                        <button class="wr-btn wr-btn-secondary" id="eng-cancel">إلغاء</button>
                        <button class="wr-btn wr-btn-primary" id="eng-save">حفظ</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'flex';
        
        const viewsInput = document.getElementById('eng-views');
        const reactionsInput = document.getElementById('eng-reactions');
        const participantsInput = document.getElementById('eng-participants');
        
        // Reset inputs
        viewsInput.value = '';
        reactionsInput.value = '';
        participantsInput.value = '';
        
        // Focus first input
        setTimeout(() => viewsInput.focus(), 100);
        
        const cleanup = () => {
            modal.style.display = 'none';
        };
        
        const onSave = async () => {
            const views = parseInt(viewsInput.value) || 0;
            const reactions = parseInt(reactionsInput.value) || 0;
            const participants = parseInt(participantsInput.value) || 0;
            
            const saveBtn = document.getElementById('eng-save');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
            
            try {
                const authedFetch = window.authedFetch || fetch;
                const resp = await authedFetch(`/api/competitions/${competitionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        views_count: views,
                        reactions_count: reactions,
                        participants_count: participants
                    })
                });
                
                if (resp.ok) {
                    toast('تم حفظ الإحصائيات بنجاح', 'success');
                    cleanup();
                    // Refresh agent info and engagement stats immediately
                    if (state.selectedAgent) {
                        state.activeCompetition = {
                            ...(state.activeCompetition || {}),
                            views_count: views,
                            reactions_count: reactions,
                            participants_count: participants
                        };
                        await loadAgentCompetitionInfo(state.selectedAgent.id);
                        updateAgentStatus(state.selectedAgent.name, state.selectedAgent.agentId);
                    }
                } else {
                    toast('فشل حفظ الإحصائيات', 'error');
                }
            } catch (e) {
                console.error(e);
                toast('حدث خطأ أثناء الحفظ', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'حفظ';
            }
        };
        
        const cancelBtn = document.getElementById('eng-cancel');
        const saveBtn = document.getElementById('eng-save');
        
        // Remove old listeners to avoid duplicates if modal is reused
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', cleanup);
        
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', onSave);
    }
    
    function updateSpinControls() {
      const autoBtn = document.getElementById('auto-pick-btn');
      const hasAgent = !!state.selectedAgent;
      if(autoBtn){ autoBtn.disabled = !hasAgent; autoBtn.classList.toggle('wr-btn-disabled', !hasAgent); }
    }
    
    function updateBatchCount() {
      const input = document.getElementById('batch-count');
      if(!input) return;
      if(!state.selectedAgent || !state.activeCompetition){
        input.disabled = true;
        return;
      }
      input.disabled = false;
    }
    
    function updateCounts() {
        const countEl = document.getElementById('participants-count');
        if (countEl) countEl.textContent = state.entries.length;
        
        const winnersCountEl = document.getElementById('winners-count');
        if (winnersCountEl) winnersCountEl.textContent = state.winners.length;
    }
    
    function showConfirmModal(message, onConfirm) {
      const overlay = document.createElement('div');
      overlay.className = 'wr-confirm-overlay';
      overlay.innerHTML = `
        <div class="wr-confirm-modal">
          <div class="wr-confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <h3 class="wr-confirm-title">تأكيد العملية</h3>
          <p class="wr-confirm-message">${message}</p>
          <div class="wr-confirm-actions">
            <button class="wr-btn wr-btn-secondary" id="wr-confirm-cancel">إلغاء</button>
            <button class="wr-btn wr-btn-danger" id="wr-confirm-ok">تأكيد</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      
      const cancelBtn = overlay.querySelector('#wr-confirm-cancel');
      const okBtn = overlay.querySelector('#wr-confirm-ok');
      
      const cleanup = () => overlay.remove();
      
      cancelBtn?.addEventListener('click', cleanup);
      okBtn?.addEventListener('click', () => {
        if (onConfirm) onConfirm();
        cleanup();
      });
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
      });
    }
    
    function queueSpin(count){
      if(count<=0) return;
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (!state.activeCompetition) {
        toast('لا توجد مسابقة نشطة لهذا الوكيل', 'warning');
        return;
      }
      // منع الدوران إذا تم اختيار جميع الفائزين المطلوبين
      const currentTotal = state.activeCompetition.currentWinners || 0;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
        toast(`تم اختيار جميع الفائزين للوكيل ${agentLabel} (عددهم ${state.activeCompetition.totalRequired}).`, 'info');
        return;
      }
      state.spinQueue = count; // Set directly instead of adding
      if(!state.spinning) startSpin();
    }
    
    function startAutoPick(count){
      if(state.spinning){return;}
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      
      // Check if the number of winners has been reached
      const currentTotal = state.activeCompetition.currentWinners || 0;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
        toast(`تم اختيار جميع الفائزين للوكيل ${agentLabel} (عددهم ${state.activeCompetition.totalRequired}).`, 'info');
        return;
      }
      
      const available = state.entries.filter(e=> !e.selected || !state.excludeWinner).length;
      if(available===0){ toast('لا يوجد مشاركون كافيون'); return; }
      state.autoMode = true;
      state.autoRemaining = Math.min(count, available);
      state.autoBatchPicked = [];
      startSpin();
    }
    
    function startSpin(){
      if(state.spinning){return;}
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (!state.activeCompetition) {
        toast('لا توجد مسابقة نشطة لهذا الوكيل', 'warning');
        return;
      }
      // منع الدوران إذا تم اختيار جميع الفائزين المطلوبين
      const currentTotal = state.activeCompetition.currentWinners || 0;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
        toast(`تم اختيار جميع الفائزين للوكيل ${agentLabel} (عددهم ${state.activeCompetition.totalRequired}).`, 'info');
        return;
      }
      const candidates = state.entries.filter(e => !e.selected || !state.excludeWinner);
      if(candidates.length===0){toast('أضف مشاركين أولاً'); state.spinQueue=0; return;}
    
      // Normalize starting angle so each spin has consistent full rotations
      state.angle = 0;
      state.spinning = true;
      const n = candidates.length;
      const slice = (Math.PI*2)/n;
      
      // Select random winner using crypto.getRandomValues for 100% randomness
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      const randomFraction = randomBuffer[0] / (0xFFFFFFFF + 1);
      const winningIndex = Math.floor(randomFraction * n);
    
      // Create a snapshot of candidates to lock the wheel state for this spin
      state.spinSnapshot = candidates.slice();
      state.chosenIndex = winningIndex;
      
      // Store chosen winner based on snapshot/index
      const chosenWinner = state.spinSnapshot[winningIndex];
      
      // Calculate target angle to make the chosen slice land under the pointer
      // In drawWheel: slice i center is at (i * slice + slice/2 + PI/2)
      // After rotation by -state.angle, it appears at: (i * slice + slice/2 + PI/2 - state.angle)
      // We want it to be at PI/2 (pointer position)
      // Therefore: i * slice + slice/2 + PI/2 - state.angle = PI/2
      // Solving: state.angle = i * slice + slice/2
      // ADJUSTMENT: Pointer is at TOP (3PI/2), so we need to rotate by an extra PI so the winner lands on top
      const targetAngleBase = winningIndex * slice + slice / 2 + Math.PI;
      
      // Add multiple full rotations for effect. MUST be integer spins
      // so the normalized target lands on the intended slice center.
      const integerRotations = 4 + Math.floor(Math.random() * 2); // 4 or 5 full spins
      const fullSpins = integerRotations * Math.PI * 2;
      const epsilon = 1e-6; // tiny nudge to avoid boundary float issues
      state.targetAngle = targetAngleBase + fullSpins + epsilon;
      state.spinStart = performance.now();
      if(!state.spinDuration){updateSpinSpeed(document.getElementById('spin-speed')?.value || 'normal');}
      // Always override if chosen speed is slow to be more gradual
      if((document.getElementById('spin-speed')?.value || 'normal') === 'slow'){
        state.spinDuration = 8500 + Math.random()*1500; // 8.5s - 10s
      }
      // Capture start angle for accurate interpolation
      state.startAngle = state.angle;
      
      // --- START RECORDING ---
      startRecording();
      // -----------------------
      
      animateSpin(() => {
        state.spinning = false;
        // Calculate winner based on final visual position
        // Use state.angle directly (don't normalize) since our math expects positive cumulative angle
        const visualData = state.spinSnapshot || candidates;
        const visualIdx = pickIndexByAngle(visualData.length, state.angle);
        const winner = visualData[visualIdx];
        
        // Clear spin snapshot data
        state.spinSnapshot = null;
        state.chosenIndex = null;
    
        // --- RECORDING EPILOGUE ---
        // Keep drawing the overlay for 3 seconds to ensure it's captured and visible
        const recordingDuration = 3000;
        const startTime = performance.now();
        
        function keepDrawingOverlay() {
            const elapsed = performance.now() - startTime;
            if (elapsed < recordingDuration) {
                drawWinnerOverlay(winner);
                requestAnimationFrame(keepDrawingOverlay);
            } else {
                // Stop recording after 3 seconds
                stopRecording((blob) => {
                    showVideoPreview(blob, winner);
                });
            }
        }
        keepDrawingOverlay();
        // --------------------------
      });
    }
    
    function startRecording() {
      try {
        const canvas = document.getElementById('winner-roulette-wheel');
        if (!canvas) return;
        
        // console.log(`🎥 [Recording] Initializing MediaRecorder...`);
        const stream = canvas.captureStream(30); // 30 FPS
        
            // Detect supported mimeType
            const mimeTypes = [
                'video/mp4',
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm'
            ];    let mimeType = '';
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }
        
        if (!mimeType) {
            console.warn('🎥 [Recording] No supported mimeType found, trying default constructor');
        }
        
        state.recordingMimeType = mimeType;
        // console.log(`🎥 [Recording] Using mimeType: ${mimeType}`);
        
        const options = mimeType ? { mimeType } : undefined;
        state.mediaRecorder = new MediaRecorder(stream, options);
        state.recordedChunks = [];
        
        state.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            state.recordedChunks.push(e.data);
          }
        };
        
        state.mediaRecorder.onstart = () => {
            // Recording started
        };
    
        state.mediaRecorder.onerror = (e) => {
            console.error('🎥 [Recording] Error:', e);
        };
        
        state.mediaRecorder.start();
      } catch (e) {
        console.error('🎥 [Recording] Failed to start:', e);
        // toast('فشل بدء تسجيل الفيديو', 'error');
      }
    }
    
    function stopRecording(callback) {
      if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.onstop = () => {
          const blobType = state.recordingMimeType || 'video/webm';
          const blob = new Blob(state.recordedChunks, { type: blobType });
          console.log(`🎥 [Recording] Finished. Blob size: ${blob.size}, Type: ${blobType}`);
          if (callback) callback(blob);
        };
        state.mediaRecorder.stop();
      } else {
        if (callback) callback(null);
      }
    }
    
    function drawWinnerOverlay(winner) {
      const canvas = document.getElementById('winner-roulette-wheel');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      
      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, W, H);
      
      // Draw Winner Info
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Icon/Emoji
      ctx.font = '60px Arial';
      ctx.fillText('🎉', W/2, H/2 - 100);
      
      // "Winner" Label
      ctx.font = 'bold 32px Arial';
      ctx.fillStyle = '#fbbf24'; // Amber
      ctx.fillText('الفائز', W/2, H/2 - 40);
      
      // Name
      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(winner.name, W/2, H/2 + 20);
      
      // Account
      ctx.font = '24px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`رقم الحساب: ${winner.account}`, W/2, H/2 + 70);
      
      // Agent Name
      if (state.selectedAgent) {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`الوكيل: ${state.selectedAgent.name}`, W/2, H/2 + 120);
      }
    }
    
    function showVideoPreview(blob, winner) {
      if (!blob) {
        // Fallback to normal flow if recording failed
        if(state.autoMode){ showAutoWinnerModal(winner); } else { showWinnerModal(winner); }
        return;
      }
    
      const url = URL.createObjectURL(blob);
      
      const overlay = document.createElement('div');
      overlay.id = 'video-preview-modal';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 11000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        animation: fadeIn 0.3s ease;
      `;
      
      // Create container
      const container = document.createElement('div');
      container.style.cssText = 'background: #1e293b; padding: 20px; border-radius: 16px; max-width: 90%; width: 500px; text-align: center; border: 1px solid #334155;';
      
      // Title
      const title = document.createElement('h3');
      title.style.cssText = 'color: white; margin-bottom: 15px;';
      title.textContent = 'معاينة فيديو الفوز';
      container.appendChild(title);
    
      // Video Element
      const video = document.createElement('video');
      video.id = 'preview-video-el';
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width: 100%; border-radius: 8px; margin-bottom: 20px; max-height: 400px;';
      // Set src directly to avoid innerHTML safety checks
      video.src = url;
      container.appendChild(video);
    
      // Buttons Container
      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';
    
      // Save Button
      const saveBtn = document.createElement('button');
      saveBtn.id = 'save-video-btn';
      saveBtn.style.cssText = 'background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;';
      saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الفيديو والمتابعة';
      btnContainer.appendChild(saveBtn);
    
      // Skip Button
      const skipBtn = document.createElement('button');
      skipBtn.id = 'skip-video-btn';
      skipBtn.style.cssText = 'background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 16px;';
      skipBtn.textContent = 'تخطي';
      btnContainer.appendChild(skipBtn);
    
      container.appendChild(btnContainer);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
    
      // Force play attempt
      video.play().catch(e => console.error('🎥 [Preview] Auto-play failed:', e));
      video.onloadedmetadata = () => console.log('🎥 [Preview] Metadata loaded, duration:', video.duration);
      video.onerror = (e) => {
          console.error('🎥 [Preview] Video error:', video.error);
          const errDiv = document.createElement('div');
          errDiv.style.color = '#ef4444';
          errDiv.style.padding = '10px';
          errDiv.style.marginBottom = '20px';
          
          const msgText = document.createElement('div');
          msgText.textContent = 'عذراً، تعذر تشغيل معاينة الفيديو داخل المتصفح.';
          errDiv.appendChild(msgText);
    
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'winner-preview.webm';
          downloadLink.style.cssText = 'color: #3b82f6; text-decoration: underline; margin-top: 5px; display: inline-block;';
          downloadLink.innerHTML = '<i class="fas fa-download"></i> تحميل الفيديو للمشاهدة';
          errDiv.appendChild(downloadLink);
    
          video.style.display = 'none';
          container.insertBefore(errDiv, video);
      };
      
      const cleanup = () => {
        document.body.removeChild(overlay);
        URL.revokeObjectURL(url);
      };
      
      skipBtn.addEventListener('click', () => {
        cleanup();
        if(state.autoMode){ showAutoWinnerModal(winner); } else { showWinnerModal(winner); }
      });
      
      saveBtn.addEventListener('click', async () => {
        // بدلاً من الحفظ المباشر، ننتقل إلى نافذة إدخال البريد الإلكتروني
        // ونمرر الفيديو المسجل ليتم حفظه مع بيانات الفائز
        state.pendingVideoBlob = blob;
        cleanup();
        if(state.autoMode){ 
            showAutoWinnerModal(winner); 
        } else { 
            showWinnerModal(winner); 
        }
      });
    }
    
    function checkCompletion() {
      const currentTotal = state.activeCompetition ? (state.activeCompetition.currentWinners || 0) : state.winners.length;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        if (state.reportSent) {
          const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
          setTimeout(() => {
            showCompletionModal(agentLabel, state.activeCompetition.totalRequired);
          }, 500);
        } else {
          // Do not show completion text until winners are sent to agent
        }
      }
    }
    
    function animateSpin(onDone) {
      function step(ts) {
        const t = Math.min(1, (ts - state.spinStart)/state.spinDuration);
        // Composite easing: سريع في البداية ثم تباطؤ واضح
        const eased = compositeEase(t);
        state.angle = state.startAngle + (state.targetAngle - state.startAngle) * eased;
        drawWheel();
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          // Snap to exact target to be safe
          state.angle = state.targetAngle;
          drawWheel();
          onDone && onDone();
        }
      }
      requestAnimationFrame(step);
    }
    
    function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
    function easeInQuad(x){ return x*x; }
    function easeOutQuint(x){ return 1 - Math.pow(1 - x, 5); }
    function compositeEase(x){
      // First 30% accelerate (easeInQuad), remaining 70% decelerate (easeOutQuint) normalized
      if(x <= 0.3){ return 0.3 * easeInQuad(x/0.3); }
      const rest = (x - 0.3)/0.7; // 0..1
      return 0.3 + 0.7 * easeOutQuint(rest);
    }
    function lerp(a,b,t){ return a + (b-a)*t; }
    function normalizeAngle(a){
      let v = a % (Math.PI*2);
      if (v > Math.PI) v -= Math.PI*2;
      if (v < -Math.PI) v += Math.PI*2;
      return v;
    }
    function pickIndexByAngle(n, angle) {
      // After rotating canvas by -angle, the fixed pointer at PI/2 corresponds
      // to an effective pointer angle of PI/2 + angle in wheel coordinates.
      // Slices span [i*slice + PI/2, (i+1)*slice + PI/2). Therefore the index
      // is simply floor(angle / slice) modulo n when using angle in [0, 2π).
      // ADJUSTMENT: Pointer is at TOP (3PI/2), so we shift by PI.
      const twoPi = Math.PI * 2;
      const slice = twoPi / n;
      let a = (angle + Math.PI) % twoPi;
      if (a < 0) a += twoPi;
      let index = Math.floor(a / slice);
      return index % n;
    }
    
    function getAutoPrizeInfo(candidateAccount) {
      if (!state.activeCompetition) {
        return { prizeType: 'trading', prizeValue: 0, prizeUnit: '$' };
      }
    
      const {
        tradingWinnersRequired,
        depositWinnersRequired,
        prizePerWinner,
        depositBonusPercentage
      } = state.activeCompetition;
    
      const currentDepositWinners = state.winners.filter(w => w.prizeType === 'deposit').length;
      const currentTradingWinners = state.winners.filter(w => w.prizeType === 'trading').length;
    
      let prizeType = 'trading';
      
      // Prioritize Trading Bonus ($) first, then Deposit Bonus (%)
      if (currentTradingWinners < tradingWinnersRequired) {
        prizeType = 'trading';
      } else if (currentDepositWinners < depositWinnersRequired) {
        prizeType = 'deposit';
      }
    
      let prizeValue = 0;
      let prizeUnit = '$';
    
      if (prizeType === 'deposit') {
        prizeValue = depositBonusPercentage || 0;
        prizeUnit = '%';
      } else {
        prizeValue = prizePerWinner || 0;
        prizeUnit = '$';
      }
    
      return { prizeType, prizeValue, prizeUnit };
    }
    
    function renderParticipants() {
      const container = document.getElementById('participants-list');
      if (!container) return;
      // Ensure each entry has a stable sequence number based on current order
      try {
        for (let i = 0; i < state.entries.length; i++) {
          state.entries[i].seq = i + 1;
        }
      } catch(e) {}
      if (state.entries.length === 0) {
        container.innerHTML = '<div class="empty">لا توجد أسماء</div>';
        return;
      }
      const term = (state.filterTerm||'').toLowerCase();
      const list = state.entries.filter(e => !term || e.name.toLowerCase().includes(term) || e.account.includes(term));
      container.innerHTML = list.map((e,i) => `
        <div class="wr-item ${e.selected?'wr-item-selected':''}" data-id="${e.id}" title="${e.label}">
          <div class="wr-item-body">
            <div class="wr-item-label"><span class="wr-badge-num">${e.seq || (i+1)}</span> ${e.name}</div>
            <div class="wr-item-meta">${e.account}</div>
          </div>
          <div class="wr-item-actions">
            ${e.selected ? '<span class="wr-tag wr-tag-winner">فائز</span>' : ''}
            <button class="wr-icon-btn" data-action="remove" title="إزالة"><i class="fas fa-times"></i></button>
          </div>
        </div>
      `).join('');
    
      container.querySelectorAll('[data-action="remove"]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          const el = ev.currentTarget.closest('.participant-item');
          const id = el?.dataset.id;
          if (!id) return;
          state.entries = state.entries.filter(x => x.id !== id);
          state.winners = state.winners.filter(x => x.id !== id);
          renderParticipants();
          renderWinners();
          drawWheel();
        });
      });
    }
    
    function renderWinners() {
      const bottomContainer = document.getElementById('winners-list-bottom');
      
      if (!bottomContainer) return;
      
      if (state.winners.length === 0) {
        bottomContainer.innerHTML = '<div class="wr-winner-empty"><i class="fas fa-trophy" style="font-size:2rem;opacity:.3;margin-bottom:8px;"></i><p>لا يوجد اسماء</p></div>';
        return;
      }
      
      // Separate winners by prize type
      const depositWinners = state.winners.filter(w => w.prizeType === 'deposit');
      const tradingWinners = state.winners.filter(w => w.prizeType === 'trading');
      
      let html = '';
    
      // Add "Send All" button at the top of the bottom container if there are winners
      if (state.winners.length > 0) {
          html += `
          <div style="width:100%; margin-bottom: 20px;">
            <button id="send-all-winners-btn" class="wr-btn" style="
                width: 100%;
                background: linear-gradient(90deg, #2AABEE 0%, #229ED9 100%);
                color: white;
                box-shadow: 0 4px 15px rgba(42, 171, 238, 0.4);
                border: none;
                padding: 14px;
                font-size: 1.1rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(42, 171, 238, 0.6)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(42, 171, 238, 0.4)'">
                <i class="fas fa-paper-plane" style="font-size: 1.2em;"></i> 
                <span>إرسال الكل للوكيل (${state.winners.length})</span>
            </button>
            <div style="height: 15px;"></div>
            <button id="send-winners-ids-btn" style="
                width: 100%;
                background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
                color: white;
                box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
                border: none;
                padding: 14px;
                font-size: 1.1rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(14, 165, 233, 0.6)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(14, 165, 233, 0.4)'">
                <i class="fas fa-id-card" style="font-size: 1.2em;"></i> 
                <span>إرسال الهوية والكليشة لجروب Agent competitions (${state.winners.length})</span>
            </button>
          </div>
          `;
      }
      
      // Deposit bonus section
      if (depositWinners.length > 0) {
        html += `<div class="wr-prize-section">
          <h4 class="wr-prize-section-title"><i class="fas fa-dollar-sign"></i> بونص الإيداع (${depositWinners.length})</h4>
          <div class="wr-winners-grid">`;
        
        depositWinners.forEach((w, i) => {
          const warnMeetChecked = w.includeWarnMeet ? 'checked' : '';
          const warnPrevChecked = w.includeWarnPrev ? 'checked' : '';
          html += `
            <div class="wr-winner-card" data-id="${w.id}">
              <div class="wr-winner-card-badge">#${i+1}</div>
              <div class="wr-winner-card-body">
                <div class="wr-winner-card-name">${w.name}</div>
                <div class="wr-winner-card-account">رقم الحساب: ${w.account}</div>
                ${w.email ? `<div class="wr-winner-card-email"><i class="fas fa-envelope"></i> ${w.email}</div>` : ''}
                <div class="wr-winner-card-prize"><i class="fas fa-gift"></i> ${w.prizeValue || 0}%</div>
                ${w.agent ? `<div class="wr-winner-card-agent"><i class="fas fa-user-tie"></i> ${w.agent.name} (#${w.agent.agentId})</div>` : ''}
                <div class="wr-winner-warnings">
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="meet" data-id="${w.id}" ${w.includeWarnMeet ? 'checked' : ''}> ⚠️ الاجتماع والتحقق أولاً
                  </label>
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="prev" data-id="${w.id}" ${w.includeWarnPrev ? 'checked' : ''}> ‼️ فائز سابق ببونص تداولي
                  </label>
                </div>
    
              </div>
              <div class="wr-winner-card-actions">
                <button class="wr-icon-btn" data-send="${w.id}" title="إرسال للوكيل"><i class="fas fa-paper-plane"></i></button>
                <button class="wr-icon-btn" data-copy="${w.name} — ${w.account} — ${w.email} — ${w.prizeValue}%" title="نسخ"><i class="fas fa-copy"></i></button>
                <button class="wr-icon-btn" data-undo="${w.id}" title="تراجع"><i class="fas fa-undo"></i></button>
              </div>
            </div>`;
        });
        
        html += '</div></div>';
      }
      
      // Trading bonus section
      if (tradingWinners.length > 0) {
        html += `<div class="wr-prize-section">
          <h4 class="wr-prize-section-title"><i class="fas fa-chart-line"></i> بونص التداولي (${tradingWinners.length})</h4>
          <div class="wr-winners-grid">`;
    
    
        tradingWinners.forEach((w, i) => {
          html += `
            <div class="wr-winner-card" data-id="${w.id}">
              <div class="wr-winner-card-badge">#${i+1}</div>
              <div class="wr-winner-card-body">
                <div class="wr-winner-card-name">${w.name}</div>
                <div class="wr-winner-card-account">رقم الحساب: ${w.account}</div>
                ${w.email ? `<div class="wr-winner-card-email"><i class="fas fa-envelope"></i> ${w.email}</div>` : ''}
    
                <div class="wr-winner-card-prize"><i class="fas fa-gift"></i> $${w.prizeValue || 0}</div>
                ${w.agent ? `<div class="wr-winner-card-agent"><i class="fas fa-user-tie"></i> ${w.agent.name} (#${w.agent.agentId})</div>` : ''}
                <div class="wr-winner-warnings">
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="meet" data-id="${w.id}" ${w.includeWarnMeet ? 'checked' : ''}> ⚠️ الاجتماع والتحقق أولاً
                  </label>
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="prev" data-id="${w.id}" ${w.includeWarnPrev ? 'checked' : ''}> ‼️ فائز سابق ببونص تداولي
                  </label>
                </div>
              </div>
              <div class="wr-winner-card-actions">
                <button class="wr-icon-btn" data-send="${w.id}" title="إرسال للوكيل"><i class="fas fa-paper-plane"></i></button>
                <button class="wr-icon-btn" data-copy="${w.name} — ${w.account} — ${w.email} — $${w.prizeValue}" title="نسخ"><i class="fas fa-copy"></i></button>
                <button class="wr-icon-btn" data-undo="${w.id}" title="تراجع"><i class="fas fa-undo"></i></button>
              </div>
            </div>`;
        });
        
        html += '</div></div>';
      }
      
      bottomContainer.innerHTML = html;
    
      // Bind events
      const sendAllBtn = document.getElementById('send-all-winners-btn');
      if(sendAllBtn) {
          sendAllBtn.addEventListener('click', sendWinnersReport);
      }
    
      const sendIDsBtn = document.getElementById('send-winners-ids-btn');
      if(sendIDsBtn) {
          sendIDsBtn.addEventListener('click', sendWinnersWithIDsToAgent);
      }
    
      bottomContainer.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', handleCopyClick);
      });
      bottomContainer.querySelectorAll('input[data-warn]').forEach(input => {
        input.addEventListener('change', handleWinnerWarningToggle);
      });
          bottomContainer.querySelectorAll('[data-undo]').forEach(btn => {
            btn.addEventListener('click', handleUndoClick);
          });
          bottomContainer.querySelectorAll('[data-send]').forEach(btn => {
            btn.addEventListener('click', handleSendClick);
          });
        }function handleCopyClick(ev) {
      const text = ev.currentTarget.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          toast('تم النسخ');
        }).catch(() => {
          toast('فشل النسخ', 'error');
        });
      } else {
        toast('النسخ غير مدعوم', 'error');
      }
    }
    
    function handleUndoClick(ev) {
      const id = ev.currentTarget.getAttribute('data-undo');
      const entry = state.entries.find(e=> e.id===id);
      if(entry){ entry.selected=false; }
      state.winners = state.winners.filter(w=> w.id!==id);
      renderParticipants(); renderWinners(); updateCounts(); saveSession();
    }
    
    function handleWinnerWarningToggle(ev) {
      const id = ev.currentTarget.getAttribute('data-id');
      const warnType = ev.currentTarget.getAttribute('data-warn');
      const winner = state.winners.find(w => w.id === id);
      if (!winner) return;
      if (warnType === 'meet') winner.includeWarnMeet = !!ev.currentTarget.checked;
      if (warnType === 'prev') winner.includeWarnPrev = !!ev.currentTarget.checked;
      saveSession();
    }
    
    function handleSendClick(ev) {
      const id = ev.currentTarget.getAttribute('data-send');
      const winner = state.winners.find(w => w.id === id);
      if (!winner) return;
      
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
    
      if (!winner._id) {
        toast('يجب حفظ الفائز في قاعدة البيانات أولاً', 'warning');
        return;
      }
    
      showConfirmModal(
        `سيتم إرسال الفائز <strong>${winner.name}</strong> إلى مجموعة الوكيل. هل أنت متأكد؟`,
        async () => {
            try {
                const authedFetch = window.authedFetch || fetch;
                const resp = await authedFetch(`/api/agents/${state.selectedAgent.id}/send-winners-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        winnerIds: [winner._id],
                        messageText: generateSingleWinnerMessage(winner)
                    })
                });
                
                if (resp.ok) {
                    toast('تم إرسال الفائز بنجاح', 'success');
                } else {
                    const err = await resp.json();
                    toast(`فشل الإرسال: ${err.message}`, 'error');
                }
            } catch (e) {
                console.error(e);
                toast('حدث خطأ أثناء الإرسال', 'error');
            }
        }
      );
    }
    
    function generateSingleWinnerMessage(w) {
        const prizeText = w.prizeType === 'deposit' 
            ? `${w.prizeValue}% بونص ايداع كونه فائز مسبقا ببونص تداولي` 
            : `${w.prizeValue}$`;
    
        let msg = `◃ الفائز: ${w.name}\n`;
        msg += `           الجائزة: ${prizeText}\n\n`;
        msg += `********************************************************\n`;
        msg += `يرجى ابلاغ الفائزين بالتواصل معنا عبر معرف التليجرام و الاعلان عنهم بمعلوماتهم و فيديو الروليت بالقناة \n`;
        msg += `https://t.me/Ibinzo`;
        return msg;
    }
    
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      let yy = y;
      for (let n=0;n<words.length;n++){
        const test = line + words[n] + ' ';
        const w = ctx.measureText(test).width;
        if (w > maxWidth && n>0) {
          ctx.fillText(line, x, yy);
          line = words[n] + ' ';
          yy += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, x, yy);
    }
    
    function showWinnerModal(entry){
      console.log('🎉 [showWinnerModal] Called with entry:', entry.name);
      
      const modal = document.getElementById('winner-modal');
      const winnerName = document.getElementById('celebration-winner-name');
      const winnerAccount = document.getElementById('celebration-winner-account');
      const emailInput = document.getElementById('winner-email');
      const prizeTypeEl = document.getElementById('celebration-prize-type');
      const prizeValueEl = document.getElementById('celebration-prize-value');
      const confirmBtn = document.getElementById('confirm-winner');
      
      console.log('🔍 [showWinnerModal] Elements check:');
      console.log('  - modal:', modal ? 'FOUND' : 'MISSING');
      console.log('  - winnerName:', winnerName ? 'FOUND' : 'MISSING');
      console.log('  - emailInput:', emailInput ? 'FOUND' : 'MISSING');
      console.log('  - confirmBtn:', confirmBtn ? 'FOUND' : 'MISSING');
      
      // Fallback if modal elements are missing: commit winner automatically to avoid crashes
      if (!modal || !winnerName || !winnerAccount || !confirmBtn) {
        console.warn('[winner-roulette] Winner modal elements missing; committing winner without UI.');
        const autoPrize = getAutoPrizeInfo(entry.account);
          const winnerData = {
            ...entry,
            email: '',
            prizeType: autoPrize.prizeType,
            prizeValue: autoPrize.prizeValue,
            includeWarnMeet: state.includeWarnMeet || false,
            includeWarnPrev: state.includeWarnPrev || false,
            agent: state.selectedAgent ? {
              id: state.selectedAgent.id,
              name: state.selectedAgent.name,
              agentId: state.selectedAgent.agentId
            } : null,
          timestamp: new Date().toISOString()
        };
        const idx = state.entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) state.entries[idx].selected = true;
        if (!state.winners.find(w => w.id === entry.id)) state.winners.push(winnerData);
        state.entries = state.entries.filter(e => e.id !== entry.id);
        const ta = document.getElementById('participants-input');
        if (ta) ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
        renderParticipants(); renderWinners(); updateCounts(); drawWheel(); saveSession();
        updateBatchCount?.();
        if (state.activeCompetition && state.winners.length === state.activeCompetition.totalRequired) {
          const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
          checkCompletion();
        }
        state.spinQueue--; if(state.spinQueue>0){ setTimeout(()=> startSpin(), 350); } else { state.spinQueue = 0; }
        return;
      }
      
      // Populate winner info (include stable sequence prefix if available)
      const seqPrefix = (entry && (entry.seq || entry.seq === 0)) ? `${entry.seq}- ` : '';
      winnerName.textContent = seqPrefix + (entry.name || '—');
      winnerAccount.textContent = `رقم الحساب: ${entry.account || '—'}`;
    
    
      // Auto-determine and display prize info
      const autoPrize = getAutoPrizeInfo(entry.account);
    
      // --- NEW: Update Input Fields + live preview ---
      const prizeTypeInput = document.getElementById('winner-prize-type');
      const prizeValueInput = document.getElementById('winner-prize-value');
      const autoDisplay = document.getElementById('winner-prize-auto-display');
      
      const syncPrizePreview = () => {
          const selectedType = prizeTypeInput?.value || autoPrize.prizeType;
          // Console insight for selection while modal blur is active
          console.log('[PrizeTypeSelection] User selected:', selectedType, 'for account:', entry.account);
          if (selectedType === 'deposit_prev') {
            console.log('[PrizeTypeSelection] deposit_prev chosen: treating as manual deposit bonus display.');
          }
          
          if (selectedType === 'deposit' || selectedType === 'deposit_prev') {
              const depositPct = state.activeCompetition?.depositBonusPercentage || 0;
              if (autoDisplay) {
                  autoDisplay.textContent = `${depositPct}% (بونص إيداع)`;
                  autoDisplay.style.borderColor = '#10b981';
                  autoDisplay.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                  autoDisplay.style.color = '#10b981';
              }
              console.log('[PrizeTypePreview] Displaying deposit bonus %:', depositPct);
          } else {
              const tradingValue = state.activeCompetition?.prizePerWinner || 0;
              if (autoDisplay) {
                  autoDisplay.textContent = `${tradingValue}$ (بونص تداولي)`;
                  autoDisplay.style.borderColor = '#3b82f6';
                  autoDisplay.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  autoDisplay.style.color = '#3b82f6';
              }
              console.log('[PrizeTypePreview] Displaying trading bonus $:', tradingValue);
          }
      };
      
      if (prizeTypeInput) {
          prizeTypeInput.value = autoPrize.prizeType;
          prizeTypeInput.addEventListener('change', syncPrizePreview);
      }
      syncPrizePreview();
      // --------------------------------
      
      // Clear and focus email input
      if (emailInput) {
        emailInput.value = '';
        setTimeout(() => emailInput.focus(), 100);
      }
      
      // Helper function to compress image
      const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              
              // Calculate new dimensions maintaining aspect ratio
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              
              // Convert canvas to blob
              canvas.toBlob((blob) => {
                if (blob) {
                  console.log(`📸 [Image Compression] Original: ${(file.size / 1024).toFixed(2)}KB → Compressed: ${(blob.size / 1024).toFixed(2)}KB`);
                  resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                } else {
                  reject(new Error('Failed to compress image'));
                }
              }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
      
      // Add paste event handler for ID image
      const nationalIdImageInput = document.getElementById('winner-id-image');
      const idPreviewImg = document.getElementById('winner-id-image-preview');
      let idPreviewUrl = null;
      let compressedFile = null; // Store compressed file
    
      const openLightbox = () => {
        if (!idPreviewUrl) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:10000; cursor: zoom-out;';
        const img = document.createElement('img');
        img.src = idPreviewUrl;
        img.alt = 'معاينة صورة الهوية';
        img.style.cssText = 'max-width:95vw; max-height:95vh; border-radius:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5)';
        overlay.appendChild(img);
        const cleanupOverlay = () => { document.body.removeChild(overlay); document.removeEventListener('keydown', onEsc); };
        const onEsc = (e) => { if (e.key === 'Escape') cleanupOverlay(); };
        overlay.addEventListener('click', cleanupOverlay);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };
    
      const updateIdPreview = async () => {
        if (!nationalIdImageInput || !nationalIdImageInput.files || nationalIdImageInput.files.length === 0) {
          if (idPreviewImg) { idPreviewImg.style.display = 'none'; idPreviewImg.src = ''; }
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} idPreviewUrl = null; }
          compressedFile = null;
          return;
        }
        const file = nationalIdImageInput.files[0];
        if (!file || !file.type || !file.type.startsWith('image/')) {
          if (idPreviewImg) { idPreviewImg.style.display = 'none'; idPreviewImg.src = ''; }
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} idPreviewUrl = null; }
          compressedFile = null;
          return;
        }
        
        try {
          // Compress the image
          toast('جاري ضغط الصورة...', 'info');
          compressedFile = await compressImage(file);
          
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} }
          idPreviewUrl = URL.createObjectURL(compressedFile);
          if (idPreviewImg) { idPreviewImg.src = idPreviewUrl; idPreviewImg.style.display = 'block'; }
          toast('تم ضغط الصورة بنجاح', 'success');
        } catch (error) {
          console.error('Failed to compress image:', error);
          // Fallback to original file
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} }
          idPreviewUrl = URL.createObjectURL(file);
          if (idPreviewImg) { idPreviewImg.src = idPreviewUrl; idPreviewImg.style.display = 'block'; }
          compressedFile = file;
          toast('تم رفع الصورة الأصلية', 'warning');
        }
      };
    
      const onIdImageChange = () => updateIdPreview();
      nationalIdImageInput?.addEventListener('change', onIdImageChange);
      idPreviewImg?.addEventListener('click', openLightbox);
      const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            
            try {
              // Compress the pasted image
              toast('جاري ضغط الصورة...', 'info');
              const compressed = await compressImage(blob);
              
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(compressed);
              if (nationalIdImageInput) {
                nationalIdImageInput.files = dataTransfer.files;
                await updateIdPreview();
                toast('تم لصق الصورة وضغطها بنجاح', 'success');
              }
            } catch (error) {
              console.error('Failed to compress pasted image:', error);
              // Fallback to original blob
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(blob);
              if (nationalIdImageInput) {
                nationalIdImageInput.files = dataTransfer.files;
                await updateIdPreview();
                toast('تم لصق الصورة الأصلية', 'warning');
              }
            }
            
            e.preventDefault();
            break;
          }
        }
      };
      
      document.addEventListener('paste', handlePaste);
      
      modal.style.display = 'flex';
      
      console.log('📺 [showWinnerModal] Modal displayed');
      console.log('🔍 [showWinnerModal] Final modal check:');
      const contentBox = modal.querySelector('.wr-celebration-content');
      if (contentBox) {
        console.log('  - Content box max-height:', contentBox.style.maxHeight || 'NOT SET');
        console.log('  - Content box overflow-y:', contentBox.style.overflowY || 'NOT SET');
        console.log('  - Content box overflow-x:', contentBox.style.overflowX || 'NOT SET');
        console.log('  - Content box scrollbarGutter:', contentBox.style.scrollbarGutter || 'NOT SET');
      } else {
        console.error('❌ [showWinnerModal] Content box NOT FOUND!');
      }
      
      // launchConfetti() removed - no animations
      
      const onClose = () => { 
        modal.style.display = 'none';
        document.removeEventListener('paste', handlePaste);
        idPreviewImg?.removeEventListener('click', openLightbox);
        nationalIdImageInput?.removeEventListener('change', onIdImageChange);
        if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} idPreviewUrl = null; }
        if (idPreviewImg) { idPreviewImg.style.display = 'none'; idPreviewImg.src = ''; }
        cleanup(); 
      };
      
      const onConfirm = async () => {
        const email = emailInput?.value?.trim() || '';
        const nationalIdImageInput = document.getElementById('winner-id-image');
        const autoDisplay = document.getElementById('winner-prize-auto-display');
        let selectedPrizeType = prizeTypeInput?.value || autoPrize.prizeType;
        console.log('[PrizeTypeConfirm] Selected type before mapping:', selectedPrizeType);
        
        // Map special option to deposit for backend
        if (selectedPrizeType === 'deposit_prev') {
          console.log('[PrizeTypeConfirm] Mapping deposit_prev to deposit for backend payload');
          selectedPrizeType = 'deposit';
        }
        
        // Get prize value from active competition based on type
        const selectedPrizeValue = selectedPrizeType === 'deposit'
            ? (state.activeCompetition?.depositBonusPercentage ?? 0)
            : (state.activeCompetition?.prizePerWinner ?? 0);
        console.log('[PrizeValueConfirm] Final prize:', { type: selectedPrizeType, value: selectedPrizeValue });
        
        // Email is optional: validate only if provided
        const emailErrorEl = document.getElementById('winner-email-error');
        if (email && !/.+@.+\..+/.test(email)) {
          if (emailErrorEl) emailErrorEl.style.display = 'block';
          emailInput?.classList.add('wr-input-error');
          toast('البريد الإلكتروني غير صالح','error');
          setTimeout(()=>{ emailErrorEl && (emailErrorEl.style.display='none'); emailInput?.classList.remove('wr-input-error'); }, 2500);
          return; // Do not close modal
        }
        // Require ID image before confirming
        if (!(nationalIdImageInput?.files?.length > 0)) {
          const idInput = document.getElementById('winner-id-image');
          idInput?.classList.add('wr-input-error');
          toast('يجب رفع صورة الهوية قبل الاعتماد','error');
          setTimeout(()=> idInput?.classList.remove('wr-input-error'), 2000);
          return;
        }
        
        // Create winner object with collected data
        const winnerData = {
          ...entry,
          email: email,
          prizeType: selectedPrizeType,
          prizeValue: selectedPrizeValue,
          includeWarnMeet: state.includeWarnMeet || false,
          includeWarnPrev: state.includeWarnPrev || false,
          agent: state.selectedAgent ? {
            id: state.selectedAgent.id,
            name: state.selectedAgent.name,
            agentId: state.selectedAgent.agentId
          } : null,
          timestamp: new Date().toISOString()
        };
        
        // --- SAVE TO DATABASE IMMEDIATELY (Manual Mode) ---
        if (state.selectedAgent && state.selectedAgent.id) {
          const payload = {
            winners: [{
              id: `import_${winnerData.id}`,
              name: winnerData.name,
              account_number: winnerData.account || '',
              email: winnerData.email || '',
              national_id: winnerData.nationalId || '',
              prize_type: winnerData.prizeType || '',
              prize_value: Number(winnerData.prizeValue) || 0,
              selected_at: winnerData.timestamp,
              meta: {
                email: winnerData.email || '',
                national_id: winnerData.nationalId || '',
                prize_type: winnerData.prizeType || '',
                prize_value: Number(winnerData.prizeValue) || 0,
                original_import_id: `import_${winnerData.id}`
              }
            }]
          };
          
          const authedFetch = window.authedFetch || fetch;
          
          // Disable button to prevent double clicks
          if(confirmBtn) {
              confirmBtn.disabled = true;
              confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
          }
    
          authedFetch(`/api/agents/${encodeURIComponent(state.selectedAgent.id)}/winners/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(async (resp) => {
            if(!resp.ok) throw new Error('Failed to save winner');
            const data = await resp.json();
            const createdWinner = data.winners && data.winners[0];
            
            // If we have a pending video, upload it now
            if (state.pendingVideoBlob && createdWinner && createdWinner._id) {
                const formData = new FormData();
                // Determine extension based on recorded mimeType
                const extension = (state.recordingMimeType && state.recordingMimeType.includes('mp4')) ? 'mp4' : 'webm';
                formData.append('video', state.pendingVideoBlob, `winner_${createdWinner._id}.${extension}`);
                
                const uploadResp = await authedFetch(`/api/winners/${createdWinner._id}/video`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResp.ok) console.warn('Failed to upload video for winner', createdWinner._id);
                else toast('تم حفظ الفيديو بنجاح', 'success');
                
                // Clear pending blob
                state.pendingVideoBlob = null;
            }
            
            // Upload national ID image if provided
            if (compressedFile && createdWinner && createdWinner._id) {
                const idImageFormData = new FormData();
                idImageFormData.append('id_image', compressedFile);
                
                const idImageResp = await authedFetch(`/api/winners/${createdWinner._id}/id-image`, {
                    method: 'POST',
                    body: idImageFormData
                });
                
                if (!idImageResp.ok) console.warn('Failed to upload ID image for winner', createdWinner._id);
                else toast('تم حفظ صورة الهوية بنجاح', 'success');
            }
            
            // UPDATE LOCAL WINNER WITH DB ID
            if (createdWinner && createdWinner._id) {
                const localWinner = state.winners.find(w => w.id === winnerData.id);
                if (localWinner) {
                    localWinner._id = createdWinner._id;
                    saveSession(); // Save the _id to local storage
                }
            }
            
            toast('تم حفظ الفائز في قاعدة البيانات', 'success');
          }).catch(err => {
            console.error('Error saving winner to DB', err);
            toast('حدث خطأ أثناء الحفظ في قاعدة البيانات', 'error');
          }).finally(() => {
            if(confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> اعتماد الفائز';
            }
          });
        }
        // ------------------------------------
    
        const idx = state.entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) state.entries[idx].selected = true;
        if (!state.winners.find(w => w.id === entry.id)) {
          state.winners.push(winnerData);
          // Increment global counter
          if (state.activeCompetition) {
            state.activeCompetition.currentWinners = (state.activeCompetition.currentWinners || 0) + 1;
          }
        }
        
        // مسح الفائز من قائمة المشاركين
        state.entries = state.entries.filter(e => e.id !== entry.id);
        
        // تحديث حقل الإدخال
        const ta = document.getElementById('participants-input');
        if (ta) {
          ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
        }
        
        renderParticipants(); renderWinners(); updateCounts(); drawWheel(); onClose();
        saveSession();
        updateBatchCount?.();
        
        // إظهار شاشة منبثقة عند اكتمال عدد الفائزين
        const currentTotal = state.activeCompetition ? (state.activeCompetition.currentWinners || 0) : state.winners.length;
        if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
          const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
          checkCompletion();
        }
        
        state.spinQueue--;
        if(state.spinQueue>0){ setTimeout(()=> startSpin(), 350); }
        else { state.spinQueue = 0; }
      };
      
      function cleanup(){
        confirmBtn?.removeEventListener('click', onConfirm);
      }
      
      confirmBtn?.addEventListener('click', onConfirm);
    }
    
    function showAutoWinnerModal(entry){
      const modal = document.getElementById('winner-modal');
      const winnerName = document.getElementById('celebration-winner-name');
      const winnerAccount = document.getElementById('celebration-winner-account');
      const emailInput = document.getElementById('winner-email');
      const prizeTypeEl = document.getElementById('celebration-prize-type');
      const prizeValueEl = document.getElementById('celebration-prize-value');
      const confirmBtn = document.getElementById('confirm-winner');
      
      // Fallback if modal elements are missing in auto mode
      if (!modal || !winnerName || !winnerAccount || !confirmBtn) {
        console.warn('[winner-roulette] Auto mode: Winner modal elements missing; committing winner without UI.');
        const autoPrize = getAutoPrizeInfo(entry.account);
        const winnerData = {
          ...entry,
          email: '',
          prizeType: autoPrize.prizeType,
          prizeValue: autoPrize.prizeValue,
          includeWarnMeet: state.includeWarnMeet || false,
          includeWarnPrev: state.includeWarnPrev || false,
          agent: state.selectedAgent ? {
            id: state.selectedAgent.id,
            name: state.selectedAgent.name,
            agentId: state.selectedAgent.agentId
          } : null,
          timestamp: new Date().toISOString()
        };
        const idx = state.entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) state.entries[idx].selected = true;
        if (!state.winners.find(w => w.id === entry.id)) state.winners.push(winnerData);
        state.entries = state.entries.filter(e => e.id !== entry.id);
        const ta = document.getElementById('participants-input');
        if (ta) ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
        renderParticipants(); renderWinners(); updateCounts(); drawWheel(); saveSession();
        state.autoRemaining--; updateBatchCount?.();
        if(state.autoRemaining>0){ setTimeout(()=> startSpin(), 400); } else {
          state.autoMode=false; state.spinQueue=0; toast('انتهى الإختيار المتتالي','success');
          checkCompletion();
        }
        return;
      }
      
      // Populate winner info (include stable sequence prefix if available)
      const seqPrefix = (entry && (entry.seq || entry.seq === 0)) ? `${entry.seq}- ` : '';
      winnerName.textContent = seqPrefix + (entry.name || '—');
      winnerAccount.textContent = `رقم الحساب: ${entry.account || '—'}`;
      
      // Auto-determine and display prize info
      const autoPrize = getAutoPrizeInfo(entry.account);
    
      // --- NEW: Update Input Fields ---
      const prizeTypeInput = document.getElementById('winner-prize-type');
      const prizeValueInput = document.getElementById('winner-prize-value');
      
        if (prizeTypeInput) {
          prizeTypeInput.value = autoPrize.prizeType;
          // If previous winner special option desired, it should still act like deposit
          if (prizeTypeInput.value === 'deposit_prev') prizeTypeInput.value = 'deposit';
          prizeTypeInput.dispatchEvent(new Event('change'));
        }
      if (prizeValueInput) {
          prizeValueInput.value = autoPrize.prizeValue;
      }
      // --------------------------------
    
      if (prizeTypeEl && prizeValueEl) {
        if (autoPrize.prizeType === 'deposit') {
            prizeTypeEl.textContent = 'بونص إيداع';
            prizeValueEl.textContent = `${autoPrize.prizeValue}%`;
            prizeValueEl.style.display = 'block';
        } else {
            prizeTypeEl.textContent = 'بونص تداولي';
            prizeValueEl.textContent = `${autoPrize.prizeValue}$`;
            prizeValueEl.style.display = 'block';
        }
      }
      if (prizeTypeEl && !prizeValueEl) {
         const typeLabel = autoPrize.prizeType === 'deposit' ? 'بونص إيداع' : 'بونص تداولي';
         prizeTypeEl.textContent = typeLabel;
      }
      
      // Clear and focus email input
      if (emailInput) {
        emailInput.value = '';
        setTimeout(() => emailInput.focus(), 100);
      }
      
      // Add paste/change event handler for ID image (auto mode)
      const nationalIdImageInputAuto = document.getElementById('winner-id-image');
      const idPreviewImgAuto = document.getElementById('winner-id-image-preview');
      let idPreviewUrlAuto = null;
    
      const openLightboxAuto = () => {
        if (!idPreviewUrlAuto) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:10000; cursor: zoom-out;';
        const img = document.createElement('img');
        img.src = idPreviewUrlAuto;
        img.alt = 'معاينة صورة الهوية';
        img.style.cssText = 'max-width:95vw; max-height:95vh; border-radius:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5)';
        overlay.appendChild(img);
        const cleanupOverlay = () => { document.body.removeChild(overlay); document.removeEventListener('keydown', onEsc); };
        const onEsc = (e) => { if (e.key === 'Escape') cleanupOverlay(); };
        overlay.addEventListener('click', cleanupOverlay);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };
    
      const updateIdPreviewAuto = () => {
        if (!nationalIdImageInputAuto || !nationalIdImageInputAuto.files || nationalIdImageInputAuto.files.length === 0) {
          if (idPreviewImgAuto) { idPreviewImgAuto.style.display = 'none'; idPreviewImgAuto.src = ''; }
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} idPreviewUrlAuto = null; }
          return;
        }
        const file = nationalIdImageInputAuto.files[0];
        if (!file || !file.type || !file.type.startsWith('image/')) {
          if (idPreviewImgAuto) { idPreviewImgAuto.style.display = 'none'; idPreviewImgAuto.src = ''; }
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} idPreviewUrlAuto = null; }
          return;
        }
        if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} }
        idPreviewUrlAuto = URL.createObjectURL(file);
        if (idPreviewImgAuto) { idPreviewImgAuto.src = idPreviewUrlAuto; idPreviewImgAuto.style.display = 'block'; }
      };
    
      const onIdImageChangeAuto = () => updateIdPreviewAuto();
      nationalIdImageInputAuto?.addEventListener('change', onIdImageChangeAuto);
      idPreviewImgAuto?.addEventListener('click', openLightboxAuto);
      const handlePasteAuto = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(blob);
            if (nationalIdImageInputAuto) {
              nationalIdImageInputAuto.files = dataTransfer.files;
              updateIdPreviewAuto();
              toast('تم لصق الصورة بنجاح', 'success');
            }
            e.preventDefault();
            break;
          }
        }
      };
      
      document.addEventListener('paste', handlePasteAuto);
      
      modal.style.display = 'flex';
      // Improve scroll behavior for auto mode as well
      try {
        const contentBox = modal.querySelector('.wr-celebration-content');
        if (contentBox) {
          contentBox.style.overflowY = 'auto';
          contentBox.style.overflowX = 'hidden';
          contentBox.style.scrollbarGutter = 'stable';
        }
      } catch(e) { /* ignore */ }
      // launchConfetti() removed - no animations
      
      const onClose = () => { 
        modal.style.display = 'none';
        document.removeEventListener('paste', handlePasteAuto);
        idPreviewImgAuto?.removeEventListener('click', openLightboxAuto);
        nationalIdImageInputAuto?.removeEventListener('change', onIdImageChangeAuto);
        if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} idPreviewUrlAuto = null; }
        if (idPreviewImgAuto) { idPreviewImgAuto.style.display = 'none'; idPreviewImgAuto.src = ''; }
        cleanup(); 
      };
      
      const onConfirm = async () => {
        const email = emailInput?.value?.trim() || '';
        const nationalIdImageInput = document.getElementById('winner-id-image');
        
        const emailErrorEl = document.getElementById('winner-email-error');
        if (email && !/.+@.+\..+/.test(email)) {
          if (emailErrorEl) emailErrorEl.style.display = 'block';
          emailInput?.classList.add('wr-input-error');
          toast('البريد الإلكتروني غير صالح','error');
          setTimeout(()=>{ emailErrorEl && (emailErrorEl.style.display='none'); emailInput?.classList.remove('wr-input-error'); }, 2500);
          return;
        }
        // Require ID image before confirming
        if (!(nationalIdImageInput?.files?.length > 0)) {
          const idInput = document.getElementById('winner-id-image');
          idInput?.classList.add('wr-input-error');
          toast('يجب رفع صورة الهوية قبل الاعتماد','error');
          setTimeout(()=> idInput?.classList.remove('wr-input-error'), 2000);
          return;
        }
        
        // Create winner object with collected data
        const winnerData = {
          ...entry,
          email: email,
          prizeType: autoPrize.prizeType,
          prizeValue: autoPrize.prizeValue,
          agent: state.selectedAgent ? {
            id: state.selectedAgent.id,
            name: state.selectedAgent.name,
            agentId: state.selectedAgent.agentId
          } : null,
          timestamp: new Date().toISOString()
        };
        
        // --- SAVE TO DATABASE IMMEDIATELY (Auto Mode) ---
        if (state.selectedAgent && state.selectedAgent.id) {
          const payload = {
            winners: [{
              id: `import_${winnerData.id}`,
              name: winnerData.name,
              account_number: winnerData.account || '',
              email: winnerData.email || '',
              national_id: winnerData.nationalId || '',
              prize_type: winnerData.prizeType || '',
              prize_value: winnerData.prizeValue || 0,
              selected_at: winnerData.timestamp,
              meta: {
                email: winnerData.email || '',
                national_id: winnerData.nationalId || '',
                prize_type: winnerData.prizeType || '',
                prize_value: winnerData.prizeValue || 0,
                original_import_id: `import_${winnerData.id}`
              }
            }]
          };
          
          const authedFetch = window.authedFetch || fetch;
          authedFetch(`/api/agents/${encodeURIComponent(state.selectedAgent.id)}/winners/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(async resp => {
            if(resp.ok) {
                toast('تم حفظ الفائز في قاعدة البيانات', 'success');
                const data = await resp.json();
                const createdWinner = data.winners && data.winners[0];
                
                // Upload national ID image if provided
                if (compressedFile && createdWinner && createdWinner._id) {
                    const idImageFormData = new FormData();
                    idImageFormData.append('id_image', compressedFile);
                    
                    const idImageResp = await authedFetch(`/api/winners/${createdWinner._id}/id-image`, {
                        method: 'POST',
                        body: idImageFormData
                    });
                    
                    if (!idImageResp.ok) console.warn('Failed to upload ID image for winner', createdWinner._id);
                    else toast('تم حفظ صورة الهوية بنجاح', 'success');
                }
                
                // UPDATE LOCAL WINNER WITH DB ID
                if (createdWinner && createdWinner._id) {
                    const localWinner = state.winners.find(w => w.id === winnerData.id);
                    if (localWinner) {
                        localWinner._id = createdWinner._id;
                        saveSession();
                    }
                }
            }
            else console.warn('Failed to save winner to DB', resp.status);
          }).catch(err => console.error('Error saving winner to DB', err));
        }
        // ------------------------------------
    
        const idx = state.entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) state.entries[idx].selected = true;
        if (!state.winners.find(w => w.id === entry.id)) {
          state.winners.push(winnerData);
          // Increment global counter
          if (state.activeCompetition) {
            state.activeCompetition.currentWinners = (state.activeCompetition.currentWinners || 0) + 1;
          }
        }
        
        // مسح الفائز من قائمة المشاركين
        state.entries = state.entries.filter(e => e.id !== entry.id);
        
        // تحديث حقل الإدخال
        const ta = document.getElementById('participants-input');
        if (ta) {
          ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
        }
        
        renderParticipants(); renderWinners(); updateCounts(); drawWheel(); saveSession();
        state.autoRemaining--; onClose();
        updateBatchCount?.();
        
        if(state.autoRemaining>0){ 
          setTimeout(()=> startSpin(), 400); 
        } else { 
          state.autoMode=false; 
          state.spinQueue=0; 
          toast('انتهى الإختيار المتتالي','success');
          // Use gated completion check
          checkCompletion();
        }
      };
      
      function cleanup(){
        confirmBtn?.removeEventListener('click', onConfirm);
      }
      
      confirmBtn?.addEventListener('click', onConfirm);
    }
    
    function showCompletionModal(agentName, totalWinners) {
        const overlay = document.createElement('div');
        overlay.className = 'wr-confirm-overlay';
        overlay.innerHTML = `
          <div class="wr-confirm-modal" style="text-align: center;">
            <div class="wr-confirm-icon" style="color: #10b981;"><i class="fas fa-check-circle"></i></div>
            <h3 class="wr-confirm-title">اكتملت المسابقة!</h3>
            <p class="wr-confirm-message">
                تم اختيار جميع الفائزين المطلوبين (${totalWinners}) للوكيل <strong>${agentName}</strong>.
            </p>
            <div class="wr-confirm-actions" style="justify-content: center;">
              <button class="wr-btn wr-btn-primary" id="wr-complete-ok">حسناً</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        
        const okBtn = overlay.querySelector('#wr-complete-ok');
        const cleanup = () => overlay.remove();
        
        okBtn?.addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup();
        });
    }
    
    async function sendWinnersReport() {
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (state.winners.length === 0) {
        toast('لا يوجد فائزين لإرسالهم', 'warning');
        return;
      }
    
      // Filter winners that have _id (saved to DB)
      const validWinners = state.winners.filter(w => w._id);
      
      if (validWinners.length === 0) {
          toast('لم يتم العثور على معرفات الفائزين في قاعدة البيانات. تأكد من حفظ الفائزين.', 'error');
          return;
      }
    
      const messageText = generateWinnersMessage();
      
      showConfirmModal(
          `سيتم إرسال تقرير الفائزين (${validWinners.length}) إلى مجموعة الوكيل على تلجرام. هل أنت متأكد؟`,
          async () => {
              try {
                  const authedFetch = window.authedFetch || fetch;
                  const resp = await authedFetch(`/api/agents/${state.selectedAgent.id}/send-winners-report`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          winnerIds: validWinners.map(w => w._id),
                          messageText
                      })
                  });
                  
                    if (resp.ok) {
                      toast('تم إرسال التقرير بنجاح', 'success');
                      // Mark report as sent to allow completion status
                      state.reportSent = true;
                      // Clear winners list after successful send
                      state.winners = [];
                      renderWinners();
                      updateCounts();
                      saveSession();
                      // Redirect to agent competitions page after a short delay
                      setTimeout(() => {
                          window.location.href = `/pages/agent-competitions.html?agent_id=${state.selectedAgent.id}`;
                      }, 1500);
                  } else {
                      const err = await resp.json();
                      toast(`فشل الإرسال: ${err.message}`, 'error');
                  }
              } catch (e) {
                  console.error(e);
                  toast('حدث خطأ أثناء الإرسال', 'error');
              }
          }
      );
    }
    
    async function sendWinnersDetails() {
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (state.winners.length === 0) {
        toast('لا يوجد فائزين لإرسال بياناتهم', 'warning');
        return;
      }
      const validWinners = state.winners.filter(w => w._id);
      if (validWinners.length === 0) {
        toast('لم يتم العثور على معرفات الفائزين في قاعدة البيانات. تأكد من حفظ الفائزين.', 'error');
        return;
      }
    
      showConfirmModal(
        `سيتم إرسال بيانات الفائزين (${validWinners.length}) مع صور الهوية إلى مجموعة الوكيل. هل أنت متأكد؟`,
        async () => {
          try {
            const authedFetch = window.authedFetch || fetch;
            const warnings = state.winners
              .filter(w => w._id)
              .map(w => ({
                winnerId: w._id,
                include_warn_meet: !!w.includeWarnMeet,
                include_warn_prev: !!w.includeWarnPrev
              }));
            const resp = await authedFetch(`/api/agents/${state.selectedAgent.id}/send-winners-details`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                winnerIds: validWinners.map(w => w._id),
                include_warn_meet: !!state.includeWarnMeet,
                include_warn_prev: !!state.includeWarnPrev,
                warnings
              })
            });
            if (resp.ok) {
              toast('تم إرسال بيانات الفائزين بنجاح', 'success');
              state.reportSent = true;
              // لا نمسح الفائزين هنا بالضرورة؛ اترك التحكم لزر التقرير الكامل
            } else {
              const err = await resp.json();
              toast(`فشل الإرسال: ${err.message}`, 'error');
            }
          } catch (e) {
            console.error(e);
            toast('حدث خطأ أثناء الإرسال', 'error');
          }
        }
      );
    }
    
    async function sendWinnersWithIDsToAgent() {
      if (!state.selectedAgent) {
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (state.winners.length === 0) {
        toast('لا يوجد فائزين لإرسال بياناتهم', 'warning');
        return;
      }
      const validWinners = state.winners.filter(w => w._id);
      if (validWinners.length === 0) {
        toast('لم يتم العثور على معرفات الفائزين في قاعدة البيانات. تأكد من حفظ الفائزين.', 'error');
        return;
      }
    
      showConfirmModal(
        `سيتم إرسال بيانات الفائزين (${validWinners.length}) مع صور الهوية والكليشة إلى جروب الشركة (Agent competitions). هل أنت متأكد؟`,
        async () => {
          try {
            const authedFetch = window.authedFetch || fetch;
            const warnings = state.winners
              .filter(w => w._id)
              .map(w => ({
                winnerId: w._id,
                include_warn_meet: !!w.includeWarnMeet,
                include_warn_prev: !!w.includeWarnPrev
              }));
            const resp = await authedFetch(`/api/agents/${state.selectedAgent.id}/send-winners-details`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                winnerIds: validWinners.map(w => w._id),
                include_warn_meet: !!state.includeWarnMeet,
                include_warn_prev: !!state.includeWarnPrev,
                warnings,
                override_chat_id: '-4840260366'
              })
            });
            if (resp.ok) {
              toast('تم إرسال بيانات الفائزين إلى جروب الشركة بنجاح', 'success');
              state.reportSent = true;
            } else {
              const err = await resp.json();
              toast(`فشل الإرسال: ${err.message}`, 'error');
            }
          } catch (e) {
            console.error(e);
            toast('حدث خطأ أثناء الإرسال', 'error');
          }
        }
      );
    }
    
    function generateWinnersMessage() {
        const ordinals = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
        
        let msg = '';
        state.winners.forEach((w, i) => {
            const rank = ordinals[i] || (i + 1);
            const prizeText = w.prizeType === 'deposit' 
                ? `${w.prizeValue}% بونص ايداع كونه فائز مسبقا ببونص تداولي` 
                : `${w.prizeValue}$`;
    
            msg += `◃ الفائز ${rank}: ${w.name}\n`;
            msg += `           الجائزة: ${prizeText}\n\n`;
            msg += `********************************************************\n`;
        });
        
        msg += `يرجى ابلاغ الفائزين بالتواصل معنا عبر معرف التليجرام و الاعلان عنهم بمعلوماتهم و فيديو الروليت بالقناة \n`;
        msg += `https://t.me/Ibinzo`;
        return msg;
    }

// Make init available globally for both module and non-module environments
if (typeof window !== 'undefined') {
    window.winnerRouletteInit = init;
}

})(); // End of IIFE
    











