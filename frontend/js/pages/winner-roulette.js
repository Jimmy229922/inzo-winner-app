// == winner-roulette.js ==
// winner-roulette.js
// Module to manage a roulette wheel for selecting winners

(function() {
  // Debug marker to verify the latest roulette JS is actually loaded (helps detect browser caching)
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
        <div class="wr-celebration-content" role="dialog" aria-modal="true" style="width: 100%; max-width: 600px; padding: 2rem; box-sizing: border-box;">
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
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="text" id="winner-prize-value" class="wr-form-input" dir="rtl" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #10b981; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: bold; text-align: center;" placeholder="0" readonly />
              </div>
          </div>
  
          <div style="display: flex; gap: 10px;">
              <button id="confirm-winner" class="wr-confirm-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; position: relative; z-index: 10;">
                  <i class="fas fa-check-circle"></i> تجهيز فائز
              </button>
              <button id="skip-winner" class="wr-skip-btn" style="flex: 1; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; position: relative; z-index: 10;">
                  <i class="fas fa-redo"></i> تخطي
              </button>
          </div>
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
    const STAGED_WINNERS_KEY = 'winnerRouletteStagedWinners.v1';
    // Persist session across reloads
    
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
        // Fetch ALL competitions to filter agents who have active competitions
        const response = await authedFetch('/api/competitions?limit=2000&sort=-createdAt');
        const result = await response.json();
        const competitions = result.data || result.competitions || [];
        
        // Filter for active competitions
        const activeComps = competitions.filter(c => ['active', 'awaiting_winners', 'sent'].includes(c.status));
        
        // Extract unique agents
        const agentMap = new Map();
        activeComps.forEach(comp => {
            // comp.agents is the populated agent object (mapped from agent_id in backend)
            const agent = comp.agents;
            if (agent && agent._id && !agentMap.has(agent._id)) {
                agentMap.set(agent._id, {
                    _id: agent._id,
                    name: agent.name,
                    agent_id: agent.agent_id || '?' // agent_id might not be in the populated object if not selected
                });
            }
        });
        
        // If we need the agent.agent_id (the numeric ID), we might need to ensure the backend returns it.
        // The backend controller says: .populate('agent_id', 'name avatar_url classification')
        // It does NOT populate 'agent_id' (the numeric field).
        // Wait, the backend model likely has 'agent_id' as the numeric ID.
        // Let's check the backend controller again.
        // .populate('agent_id', 'name avatar_url classification')
        // It seems 'agent_id' (numeric) is NOT selected.
        // This is a problem if I need it for the option text `${agent.name} (#${agent.agent_id})`.
        // However, I can just use the name if the ID is missing, or try to fetch agents separately if needed.
        // Or I can rely on the fact that maybe the user doesn't strictly need the ID number if they just want to select the agent.
        // But the existing code uses `option.dataset.agentId = agent.agent_id;`.
        // And `updateAgentStatus` uses it.
        
        // Let's check if I can get the agent_id.
        // If I can't, I might need to fetch all agents AND all competitions, then intersect.
        // Fetching all agents is cheap (limit=1000).
        // Fetching all competitions is cheapish.
        
        // ALTERNATIVE STRATEGY:
        // 1. Fetch all agents (to get full details including numeric ID).
        // 2. Fetch all active competitions (to know which agents to show).
        // 3. Filter the agents list based on the competitions.
        
        const agentsResponse = await authedFetch('/api/agents?limit=1000');
        const agentsResult = await agentsResponse.json();
        const allAgents = agentsResult.data || [];
        
        // Filter agents who appear in activeComps
        // activeComps have `agent_id` (which is the ObjectId, or the populated object).
        // In the formatted response, `agents` is the populated object. `agents._id` is the ObjectId.
        
        const activeAgentIds = new Set();
        activeComps.forEach(c => {
            if (c.agents && c.agents._id) {
                activeAgentIds.add(String(c.agents._id));
            } else if (c.agent_id) {
                 // Fallback if not populated as expected
                 activeAgentIds.add(String(c.agent_id));
            }
        });
        
        const filteredAgents = allAgents.filter(a => activeAgentIds.has(String(a._id)));
        
        filteredAgents.forEach(agent => {
          const option = document.createElement('option');
          option.value = agent._id;
          option.textContent = `${agent.name} (#${agent.agent_id})`;
          option.dataset.agentId = agent.agent_id;
          select.appendChild(option);
        });
        
        // Agent restoration is handled by restoreSession()
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
      
      // Clear active competition before loading new one
      state.activeCompetition = null;
      // restoreSession(true); // Clear UI while loading - REMOVED to prevent loading stale entries

      // Show loading state
      competitionInfo.innerHTML = '<div class="wr-agent-info-empty"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

      // Render the competitions dropdown AND auto-load the default competition
      await renderAgentCompetitionsDropdown(agentId);
    }

    async function renderAgentCompetitionsDropdown(agentId) {
      // Target the agent selector container in the header
      const agentSelector = document.querySelector('.wr-agent-selector');
      if (!agentSelector) {
          console.warn('Agent selector container not found');
          return;
      }

      // Check if dropdown container exists
      let dropdownContainer = document.getElementById('agent-competitions-dropdown-container');
      if (!dropdownContainer) {
        dropdownContainer = document.createElement('div');
        dropdownContainer.id = 'agent-competitions-dropdown-container';
        dropdownContainer.className = 'wr-competitions-selector';
        dropdownContainer.style.display = 'inline-flex';
        dropdownContainer.style.alignItems = 'center';
        dropdownContainer.style.gap = '10px';
        dropdownContainer.style.marginLeft = '20px';
        
        dropdownContainer.innerHTML = `
            <label for="agent-competitions-select" style="font-weight:600; color:var(--wr-text-primary); display:flex; align-items:center; gap:6px;">
                <i class="fas fa-history" style="color:var(--wr-primary);"></i>
                سجل المسابقات:
            </label>
            <select id="agent-competitions-select" class="wr-agent-dropdown" style="min-width: 250px;">
                <option value="">جاري التحميل...</option>
            </select>
        `;
        // Append to the agent selector container
        agentSelector.appendChild(dropdownContainer);
      }

      try {
        const authedFetch = window.authedFetch || fetch;
        // console.log(`Fetching competitions for agent: ${agentId}`);
        // Ensure agentId is passed correctly as query param (backend expects 'agentId', not 'agent_id')
        const response = await authedFetch(`/api/competitions?agentId=${agentId}&sort=-createdAt&limit=100`);
        
        if (response.ok) {
            const data = await response.json();
            // console.log('Competitions data:', data);
            // Support both formats (data.competitions or data.data)
            const competitions = data.competitions || data.data || [];
            
            // --- DEBUG LOGS ---
            // console.log(`[DEBUG] Found ${competitions.length} competitions for agent ${agentId}`);
            // console.log('[DEBUG] All competition statuses:', competitions.map(c => c.status));
            // ------------------

            const select = document.getElementById('agent-competitions-select');
            
            if (competitions.length === 0) {
                // console.log('[DEBUG] No competitions found, showing empty message.');
                select.innerHTML = '<option value="">لا توجد مسابقات لهذا الوكيل</option>';
                return;
            }

            const activeCompetitions = competitions.filter(c => ['active', 'awaiting_winners', 'sent'].includes(c.status));
            // const endedCompetitions = competitions.filter(c => ['completed', 'archived'].includes(c.status)); // Hidden as per request

            // console.log(`[DEBUG] Active count: ${activeCompetitions.length}`);
            // console.log(`[DEBUG] Ended count: ${endedCompetitions.length}`);

            // Determine default selection (Latest Active only)
            let defaultCompId = null;
            if (activeCompetitions.length > 0) {
                defaultCompId = activeCompetitions[0]._id;
            }

            const renderOption = (c) => {
                const date = new Date(c.createdAt).toLocaleDateString('ar-EG');
                const statusMap = {
                    'active': 'نشطة',
                    'completed': 'مكتملة',
                    'sent': 'جديدة',
                    'awaiting_winners': 'انتظار الفائزين',
                    'archived': 'مؤرشفة'
                };
                const status = statusMap[c.status] || c.status;
                // Select if it matches active competition OR if it's the default and no active competition is set
                const isSelected = (state.activeCompetition && state.activeCompetition.id === c._id) || 
                                   (!state.activeCompetition && c._id === defaultCompId);
                return `<option value="${c._id}" ${isSelected ? 'selected' : ''}>
                    ${c.name || 'مسابقة'} (${date}) - ${status}
                </option>`;
            };

            const renderAllOptions = () => {
                let html = '<option value="">-- اختر مسابقة --</option>';

                if (activeCompetitions.length > 0) {
                    // No optgroup needed if only showing active, but keeping structure is fine or just listing them
                    html += activeCompetitions.map(renderOption).join('');
                } else {
                    html += '<option value="" disabled>لا توجد مسابقات نشطة</option>';
                }

                return html;
            };
            
            select.innerHTML = renderAllOptions();

            // Remove old listener
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            
            newSelect.addEventListener('change', async (e) => {
                const compId = e.target.value;
                if (compId) {
                    await loadCompetitionById(compId);
                }
            });
            
            // Store render function to update selection later
            state.renderCompetitionsDropdown = () => {
                const s = document.getElementById('agent-competitions-select');
                if(s) s.innerHTML = renderAllOptions();
            };

            // Auto-load default competition if none is active
            if (defaultCompId && !state.activeCompetition) {
                // console.log(`[DEBUG] Auto-loading default competition: ${defaultCompId}`);
                await loadCompetitionById(defaultCompId);
            } else if (!defaultCompId) {
                 const competitionInfo = document.getElementById('agent-competition-info');
                 if(competitionInfo) competitionInfo.innerHTML = '<div class="wr-agent-info-empty">لا توجد مسابقات نشطة لهذا الوكيل</div>';
            }

        } else {
            console.error('Failed to fetch competitions:', response.status);
        }
      } catch (e) {
        console.error('Failed to load agent competitions list', e);
      }
    }

    async function loadCompetitionById(compId) {
        const competitionInfo = document.getElementById('agent-competition-info');
        competitionInfo.innerHTML = '<div class="wr-agent-info-empty"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
        
        // Clear current state
        const previousCompetitionId = state.activeCompetition ? state.activeCompetition.id : null;
        state.activeCompetition = null;
        
        try {
            const authedFetch = window.authedFetch || fetch;
            
            // 1. Fetch Competition Details
            const response = await authedFetch(`/api/competitions/${compId}`);
            if (response.ok) {
                const data = await response.json();
                const competition = data.competition;

                // 2. Fetch Winners for this competition
                const winnersResponse = await authedFetch(`/api/agents/${state.selectedAgent.id}/winners?competition_id=${compId}`);
                let winners = [];
                if (winnersResponse.ok) {
                    const winnersData = await winnersResponse.json();
                    if (winnersData.competitions && winnersData.competitions.length > 0) {
                        winners = winnersData.competitions[0].winners || [];
                    }
                }

                // Set reportSent state based on competition status
                if (competition.status === 'completed' || competition.status === 'archived') {
                    state.reportSent = true;
                    // If there are no winners but status is completed, it means "No Winners" was approved
                    if (winners.length === 0) {
                        state.noWinnersApproved = true;
                    }
                } else {
                    state.reportSent = false;
                    state.noWinnersApproved = false;
                }

                // Map backend winners to frontend state.winners format
                let mappedWinners = winners.map(w => ({
                    id: w.id,
                    name: w.name,
                    account: w.account_number,
                    email: w.email,
                    prizeType: w.prize_type === 'deposit_prev' ? 'deposit_prev' : (w.prize_type === 'deposit' ? 'deposit' : (w.prize_type === 'trading' ? 'trading' : 'deposit')),
                    prizeValue: w.prize_value,
                    videoUrl: w.video_url,
                    nationalIdImage: w.national_id_image,
                    selected: true,
                    _id: w.id // Ensure _id is set for DB winners
                }));

                // --- NEW: Merge with staged winners (local edits) ---
                const staged = getStagedWinnersForCompetition(compId);
                if (staged.length > 0) {
                    // 1. Update existing DB winners with staged changes
                    mappedWinners = mappedWinners.map(w => {
                        const stagedW = staged.find(s => s.id === w.id);
                        if (stagedW) {
                            // Merge staged properties. Staged takes precedence.
                            return { ...w, ...stagedW };
                        }
                        return w;
                    });

                    // 2. Add new staged winners that are NOT in DB
                    const newStagedWinners = staged.filter(s => {
                        // Check by ID
                        if (mappedWinners.find(mw => mw.id === s.id)) return false;
                        
                        // Check by Name + Account (to prevent duplicates if ID update failed)
                        if (mappedWinners.find(mw => mw.name === s.name && mw.account === s.account)) return false;
                        
                        return true;
                    });
                    if (newStagedWinners.length > 0) {
                        mappedWinners = [...mappedWinners, ...newStagedWinners];
                    }
                }

                // --- FIX: Merge with local session winners if they belong to this competition ---
                // If we have local winners in state (restored from session) and they are NOT in the DB list,
                // and the DB list is empty (or we are in active state), we should probably keep the local ones.
                // However, to be safe, let's check if the local winners match the current competition ID.
                // Since local winners don't store competition ID explicitly in the array, we rely on the fact
                // that restoreSession runs before this.
                
                // If DB returns winners, they are the source of truth.
                // If DB returns NO winners, but we have local winners, we should keep them IF the competition status allows.
                
                if (mappedWinners.length > 0) {
                    state.winners = mappedWinners;
                } else {
                    // DB has no winners. Check if we have local winners restored from session.
                    // We only keep them if we are NOT switching to a different competition.
                    // If previousCompetitionId is null (first load) or same as current, we might keep them.
                    // But wait, loadCompetitionById is called when switching dropdowns too.
                    
                    // Better approach: Check if the restored session's activeCompetitionId matches this compId.
                    // We need to access the raw session data or store activeCompetitionId in state during restore.
                    
                    const key = LS_KEY;
                    let sessionCompId = null;
                    try {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const saved = JSON.parse(raw);
                            // We need to check if the saved session was for THIS competition
                            // But the saved object structure in saveSession uses 'activeCompetitionId'
                            // Let's check if we can retrieve it.
                            // Note: saveSession saves: activeCompetitionId: state.activeCompetition ? state.activeCompetition.id : null
                            sessionCompId = saved.activeCompetitionId;
                        }
                    } catch(e) {}

                    if (sessionCompId === compId && state.winners.length > 0) {
                        // Keep state.winners as is (restored from session)
                    } else {
                        state.winners = [];
                    }
                }

                  await restoreVideosFromDB();
                  await restoreImagesFromDB();
                
                // state.entries = []; // Clear entries as we are loading a specific state -> REMOVED to allow restoring entries from session if needed
                // Actually, if we switch competitions, we probably want to clear entries unless they are generic.
                // But if we are reloading the page, we want to keep entries.
                
                // Re-declare sessionCompId here because it's block-scoped above
                let currentSessionCompId = null;
                try {
                  const key = LS_KEY;
                    const raw = localStorage.getItem(key);
                    if (raw) currentSessionCompId = JSON.parse(raw).activeCompetitionId;
                } catch(e) {}

                if (currentSessionCompId !== compId) {
                     // If competition changed, we might want to clear entries.
                     // BUT user requested to keep entries even on reload.
                     // If it's a reload, currentSessionCompId might match compId.
                     // If it's a manual switch, they might differ.
                     // The user said: "keep participants list even if I reload page".
                     // So if I reload, compId matches sessionCompId, so we don't clear.
                     // If I switch agent/competition manually, we probably SHOULD clear to avoid confusion?
                     // Or maybe they want to carry over participants?
                     // The previous request was "don't save entries". Now it is "save entries".
                     // Let's assume if competition ID changes, we clear. If it's same (reload), we keep.
                     
                     state.entries = [];
                     // Clear input field to avoid showing previous participants
                     const ta = document.getElementById('participants-input');
                     if (ta) ta.value = '';
                }

                // Render without restoring session (since we just loaded it)
                renderCompetitionData(competition, previousCompetitionId, state.selectedAgent.id, false);
                
                // Update dropdown selection
                if(state.renderCompetitionsDropdown) state.renderCompetitionsDropdown();
                
                // Force update of winners list UI
                renderWinners();
                updateCounts();
                drawWheel();

            } else {
                 competitionInfo.innerHTML = '<div class="wr-agent-info-empty">فشل تحميل المسابقة</div>';
            }
        } catch (e) {
             competitionInfo.innerHTML = '<div class="wr-agent-info-empty">فشل تحميل المسابقة</div>';
             console.error(e);
        }
    }

    async function renderCompetitionData(competition, previousCompetitionId, agentId, shouldRestoreSession = true) {
        const competitionInfo = document.getElementById('agent-competition-info');
        
        // Display comprehensive competition information
        // Support both new schema (trading_winners_count, deposit_winners_count) and old schema (winners_count)
        // FIX: Check for undefined/null explicitly because 0 is a valid value
        const tradingWinners = (competition.trading_winners_count !== undefined && competition.trading_winners_count !== null)
            ? competition.trading_winners_count
            : (competition.winners_count || 0);
            
        const depositWinners = competition.deposit_winners_count || 0;
        const totalWinners = tradingWinners + depositWinners;
        const currentWinners = competition.current_winners_count || 0;
        
        // Store competition info in state for reference (include prize data)
        // console.log('Active competition loaded:', competition);
        state.activeCompetition = {
          id: competition._id || competition.id,
          tradingWinnersRequired: tradingWinners,
          depositWinnersRequired: depositWinners,
          // Prefer backend required_winners if provided; fallback to sum
          totalRequired: (typeof competition.required_winners === 'number' && competition.required_winners > 0)
            ? competition.required_winners
            : totalWinners,
          requiredWinners: (typeof competition.required_winners === 'number' && competition.required_winners > 0)
            ? competition.required_winners
            : totalWinners,
          currentWinners: currentWinners,
          prizePerWinner: competition.prize_per_winner || 0,
          depositBonusPercentage: competition.deposit_bonus_percentage || 0
        };
        
        // If competition ID changed, ensure we start fresh (though restoreSession handles it, we can be explicit)
        if (previousCompetitionId && previousCompetitionId !== competition._id) {
             // Only clear if we are going to restore session or if we didn't load anything
             if (shouldRestoreSession) {
                 state.winners = [];
                 state.entries = [];
                 const ta = document.getElementById('participants-input');
                 if (ta) ta.value = '';
             }
        }

        // Restore session for this specific competition ONLY if requested
        if (shouldRestoreSession) {
            await restoreSession(true);
        }
    
        // --- NEW: Fetch agent winner history for validation ---
        try {
            const historyResp = await window.authedFetch(`/api/agents/${agentId}/winners`);
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
                // console.log('Loaded agent winner history:', state.agentHistory.length);
            }
        } catch (e) {
            console.warn('Failed to load agent history:', e);
            state.agentHistory = [];
        }
        // -----------------------------------------------------
    
        // Check if competition is completed (only if winners are already sent/approved)
        if (currentWinners >= totalWinners && totalWinners > 0) {
          // Don't show completion message here, only show it after approval
          // This prevents showing "completed" when user just loads the page
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
          'awaiting_winners': 'قيد الانتظار',
          'completed': 'مكتملة'
        }[competition.status] || competition.status;
        
        const statusColor = {
          'sent': '#f59e0b',
          'active': '#10b981',
          'awaiting_winners': '#3b82f6',
          'completed': '#6b7280'
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
            ${state.selectedAgent && state.selectedAgent.agentId ? `
            <div class="wr-meta-row">
              <i class="fas fa-id-badge"></i>
              <span>رقم الوكالة: ${state.selectedAgent.agentId}</span>
            </div>` : ''}
            ${competition.correct_answer ? `
            <div class="wr-meta-row">
              <i class="fas fa-question-circle"></i>
              <span>الإجابة الصحيحة: ${competition.correct_answer}</span>
            </div>` : ''}
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
        
        // Always show stats - even if totalWinners is 0, we need to display the breakdown
        // Use local session selections for clearer UX while picking
        const requiredTotal = (typeof competition.required_winners === 'number' && competition.required_winners > 0) 
          ? competition.required_winners 
          : totalWinners;
        const localSelected = (state && Array.isArray(state.winners)) ? state.winners.length : 0;
        const remainingLocal = Math.max(requiredTotal - localSelected, 0);

        html += `<div class="wr-competition-stat-row wr-stat-total">
          <span class="wr-competition-stat-label"><i class="fas fa-trophy"></i> إجمالي الفائزين</span>
          <span class="wr-competition-stat-value">${requiredTotal} فائز</span>
        </div>`;

        html += `<div class="wr-competition-stat-row">
          <span class="wr-competition-stat-label"><i class="fas fa-hourglass-half"></i> المتبقي</span>
          <span class="wr-competition-stat-value">${remainingLocal}</span>
        </div>`;

        // Bonus breakdown - show REQUIRED counts from competition, not selected
        const depositWinnersRequired = competition.deposit_winners_count || 0;
        const tradingWinnersRequired = competition.trading_winners_count || 0;
        
        // Also show how many have been selected locally (for progress)
        const localDepositCount = (state && Array.isArray(state.winners)) ? state.winners.filter(w => w.prizeType === 'deposit' || w.prizeType === 'deposit_prev').length : 0;
        const localTradingCount = (state && Array.isArray(state.winners)) ? state.winners.filter(w => w.prizeType === 'trading').length : 0;

        html += `<div class="wr-competition-stat-row">
            <span class="wr-competition-stat-label"><i class="fas fa-dollar-sign"></i> بونص إيداع</span>
            <span class="wr-competition-stat-value deposit">${localDepositCount} / ${depositWinnersRequired} فائز</span>
          </div>`;

        html += `<div class="wr-competition-stat-row">
            <span class="wr-competition-stat-label"><i class="fas fa-chart-line"></i> بونص تداولي</span>
            <span class="wr-competition-stat-value trading">${localTradingCount} / ${tradingWinnersRequired} فائز</span>
          </div>`;
        
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
        
        // تحديث الإحصائيات فوق الروليت
        updateCompetitionStats();
    }
    
    // دالة لتحديث الإحصائيات فقط بدون إعادة تحميل كل البيانات
    function updateCompetitionStats() {
      if (!state.activeCompetition) return;
      
      const requiredTotal = state.activeCompetition.requiredWinners || state.activeCompetition.totalRequired || 0;
      const localSelected = (state && Array.isArray(state.winners)) ? state.winners.length : 0;
      const remainingLocal = Math.max(requiredTotal - localSelected, 0);
      
      const depositWinnersRequired = state.activeCompetition.depositWinnersRequired || 0;
      const tradingWinnersRequired = state.activeCompetition.tradingWinnersRequired || 0;
      
      const localDepositCount = (state && Array.isArray(state.winners)) ? state.winners.filter(w => w.prizeType === 'deposit' || w.prizeType === 'deposit_prev').length : 0;
      const localTradingCount = (state && Array.isArray(state.winners)) ? state.winners.filter(w => w.prizeType === 'trading').length : 0;
      
      // تحديث العناصر في قسم معلومات المسابقة (الجانب الأيسر)
      const remainingEl = document.querySelector('.wr-competition-stat-row:nth-child(2) .wr-competition-stat-value');
      if (remainingEl) {
        remainingEl.textContent = remainingLocal;
      }
      
      const depositEl = document.querySelector('.wr-competition-stat-row:nth-child(3) .wr-competition-stat-value.deposit');
      if (depositEl) {
        depositEl.textContent = `${localDepositCount} / ${depositWinnersRequired} فائز`;
      }
      
      const tradingEl = document.querySelector('.wr-competition-stat-row:nth-child(4) .wr-competition-stat-value.trading');
      if (tradingEl) {
        tradingEl.textContent = `${localTradingCount} / ${tradingWinnersRequired} فائز`;
      }
      
      // تحديث العناصر فوق الروليت (الجانب الأيمن)
      const wrDepositCount = document.getElementById('wr-deposit-count');
      if (wrDepositCount) {
        wrDepositCount.textContent = `${localDepositCount} / ${depositWinnersRequired} فائز`;
      }
      
      const wrTradingCount = document.getElementById('wr-trading-count');
      if (wrTradingCount) {
        wrTradingCount.textContent = `${localTradingCount} / ${tradingWinnersRequired} فائز`;
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
    // IndexedDB Helper for Video & Image Persistence
    // ==========================================
    const DB_NAME = 'WinnerRouletteDB';
    const STORE_NAME = 'videos'; // Keep for backward compatibility in variable name if used elsewhere, but we'll use specific constants
    const VIDEO_STORE = 'videos';
    const IMAGE_STORE = 'images';
    let dbInstance = null;

    function getDB() {
        if (dbInstance) return Promise.resolve(dbInstance);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(VIDEO_STORE)) {
                    db.createObjectStore(VIDEO_STORE);
                }
                if (!db.objectStoreNames.contains(IMAGE_STORE)) {
                    db.createObjectStore(IMAGE_STORE);
                }
            };
            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async function saveVideoToDB(id, blob) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(blob, id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('IndexedDB save failed', e);
        }
    }

    async function getVideoFromDB(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('IndexedDB get failed', e);
            return null;
        }
    }

    async function deleteVideoFromDB(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(VIDEO_STORE, 'readwrite');
                tx.objectStore(VIDEO_STORE).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('IndexedDB delete failed', e);
        }
    }
 
    async function saveImageToDB(id, blob) {
        try {
            console.log(`[IndexedDB] Saving image for ID: ${id}, Blob size: ${blob.size}, Type: ${blob.type}`);
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IMAGE_STORE, 'readwrite');
                const req = tx.objectStore(IMAGE_STORE).put(blob, id);
                tx.oncomplete = () => {
                    console.log(`[IndexedDB] Image saved successfully for ID: ${id}`);
                    resolve();
                };
                tx.onerror = () => {
                    console.error(`[IndexedDB] Transaction error saving image for ID: ${id}`, tx.error);
                    reject(tx.error);
                };
                req.onerror = () => {
                    console.error(`[IndexedDB] Request error saving image for ID: ${id}`, req.error);
                };
            });
        } catch (e) {
            console.error('[IndexedDB] saveImageToDB Exception:', e);
        }
    }

    async function getImageFromDB(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IMAGE_STORE, 'readonly');
                const req = tx.objectStore(IMAGE_STORE).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('IndexedDB get image failed', e);
            return null;
        }
    }

    async function deleteImageFromDB(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IMAGE_STORE, 'readwrite');
                tx.objectStore(IMAGE_STORE).delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('IndexedDB delete image failed', e);
        }
    }

    // ==========================================
    // Initialize Winner Roulette
    // ==========================================
    async function init() {
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
      // state.selectedAgent = null; // REMOVED to allow session restore
      state.activeCompetition = null;
      
      await loadAgents();
      bindUI();
      startPulseAnimation(); // بدء التأثير المتحرك للخلفية
      
      // إذا كان هناك agent_id في URL، حدد الوكيل تلقائياً
      if (agentIdFromUrl) {
        setTimeout(() => {
          autoSelectAgent(agentIdFromUrl);
        }, 500); // انتظار تحميل الوكلاء
      }
      
      await restoreSession(); // Restore everything including agent
      // state.selectedAgent = null; // REMOVED
      updateSpinControls?.();
      drawWheel();

      // مزامنة تلقائية للمتبقي: حدث دوري يحدث كل 25 ثانية لجلب حالة المسابقة الحالية
      try {
        if (window._wrAutoSyncTimer) { clearInterval(window._wrAutoSyncTimer); }
        window._wrAutoSyncTimer = setInterval(async () => {
          try {
            if (!state.selectedAgent || !state.selectedAgent.id) return;
            const authedFetch = window.authedFetch || fetch;
            const resp = await authedFetch(`/api/competitions/agent/${state.selectedAgent.id}/active`);
            if (!resp.ok) return;
            const result = await resp.json();
            const competition = result.competition;
            if (!competition) return;
            const currentWinners = competition.current_winners_count || 0;
            const requiredTotal = (typeof competition.required_winners === 'number' && competition.required_winners > 0)
              ? competition.required_winners
              : ((competition.trading_winners_count || 0) + (competition.deposit_winners_count || 0));
            state.activeCompetition = {
              ...(state.activeCompetition || {}),
              id: competition._id,
              tradingWinnersRequired: competition.trading_winners_count || 0,
              depositWinnersRequired: competition.deposit_winners_count || 0,
              totalRequired: requiredTotal,
              requiredWinners: requiredTotal,
              currentWinners: currentWinners,
              prizePerWinner: competition.prize_per_winner || 0,
              depositBonusPercentage: competition.deposit_bonus_percentage || 0
            };
            updateCounts();
          } catch (e) {
            // تجاهل أخطاء الشبكة المؤقتة
          }
        }, 25000);
      } catch (e) { /* ignore */ }
    
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
        // console.log(`تم تحديد الوكيل تلقائياً: ${option.textContent}`);
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
              <span>إضافة تنبيه: ‼️ يرجى التحقق أولًا من هذا العميل، حيث سبق أن فاز بجائزة (بونص تداولي) خلال الأيام الماضية</span>
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
    
      // Removed old event listener to avoid conflicts with inline onclick

    
      agentSelect?.addEventListener('change', async (e) => {
        const agentId = e.target.value;
        const prevAgentId = state.selectedAgent?.id || null;
        if (!agentId) {
          state.selectedAgent = null;
          // Switching away from an agent: clear participants so they don't bleed into the next selection
          state.entries = [];
          state.filterTerm = '';
          // Clear UI elements tied to participants
          const ta = document.getElementById('participants-input');
          if (ta) ta.value = '';
          const searchInput = document.getElementById('participants-search');
          if (searchInput) searchInput.value = '';
          try { renderParticipants(); } catch {}
          try { updateCounts(); } catch {}
          try { drawWheel(); } catch {}
          saveSession();
          updateAgentStatus('', '');
          hideAgentInfoBox();
          updateSpinControls?.();
          updateBatchCount?.();
          return;
        }

        // If the user switched to a different agent, wipe participants (and winners UI) to prevent inheritance
        if (prevAgentId && prevAgentId !== agentId) {
          state.entries = [];
          state.filterTerm = '';
          state.winners = [];
          const ta = document.getElementById('participants-input');
          if (ta) ta.value = '';
          const searchInput = document.getElementById('participants-search');
          if (searchInput) searchInput.value = '';
          try { renderParticipants(); } catch {}
          try { renderWinners(); } catch {}
          try { updateCounts(); } catch {}
          try { drawWheel(); } catch {}
          saveSession();
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
        updateSpinControls?.();
        updateBatchCount?.();
      });
    
      const participantsInput = document.getElementById('participants-input');
      const addParticipantsBtn = document.getElementById('add-participants-btn');
      
      // Remove old input listener if exists (by not adding it)
      // Add click listener for the new button
      // addParticipantsBtn?.addEventListener('click', () => { ... }); // REMOVED

      // Restore INPUT listener with robust parsing and "consumption" logic
      participantsInput?.addEventListener('input', (e) => {
        const raw = participantsInput.value;
        if (!raw) return; // Allow empty (clearing)

        const lines = raw.split('\n');
        let addedCount = 0;
        let duplicateCount = 0;
        const remainingLines = [];
        
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          
          // If line is empty, we might want to keep it if it's the last line (user typing)
          // But if it's in the middle, it's just an empty line.
          if (!line) {
             if (i < lines.length - 1) {
                 // Empty line in middle -> consume (ignore)
                 continue;
             } else {
                 // Empty line at end -> keep (user might be typing)
                 // But wait, if we keep it, the textarea will have a newline at end.
                 // That's fine.
                 // remainingLines.push(lines[i]); // Actually, split('\n') gives empty string for trailing newline
                 // If we push it, we preserve the newline.
                 // But if we don't push it, we lose the newline.
                 // Let's see. If raw ends with \n, lines has empty string at end.
                 // If we don't push it, value becomes "prevLine". Newline lost.
                 // So we must push it if we want to preserve typing flow.
                 remainingLines.push(lines[i]); 
                 continue;
             }
          }

          // Remove invisible chars (BOM, zero-width spaces, etc)
          line = line.replace(/[\u200B-\u200D\uFEFF]/g, '');
          
          // Remove "1- ", "1. ", "1 " prefix, including various dash types
          const cleanedLine = line.replace(/^\d+[\.\-\)\s—–]+\s*/, '');
          
          if (!cleanedLine) {
             // Should not happen if line.trim() was not empty, unless it was ONLY numbers and dashes?
             // If it was "1-", cleaned is empty.
             if (i === lines.length - 1) remainingLines.push(lines[i]);
             continue;
          }

          let name = '';
          let account = '';
          let isStrongMatch = false;

          // Robust parsing strategy
          // 1. Try to find a separator (any kind of dash) followed by digits at the end
          const separatorMatch = cleanedLine.match(/^(.*?)[\s\t]*[—\-–―‒−]+[\s\t]*(\d+)[\s\t]*$/);
          
          if (separatorMatch) {
            name = separatorMatch[1].trim();
            account = separatorMatch[2].trim();
            isStrongMatch = true;
          } else {
            // 2. Try to find just digits at the end separated by space
            const spaceMatch = cleanedLine.match(/^(.*?)[\s\t]+(\d+)$/);
            if (spaceMatch) {
                name = spaceMatch[1].trim();
                account = spaceMatch[2].trim();
                isStrongMatch = true;
            } else {
                // 3. Fallback: Split by any dash, take last part if it has digits
                const parts = cleanedLine.split(/[—\-–―‒−]/);
                if (parts.length > 1) {
                    const lastPart = parts[parts.length - 1].trim();
                    const digits = lastPart.replace(/[^\d]/g, '');
                    if (digits.length > 0) {
                        account = digits;
                        name = parts.slice(0, parts.length - 1).join(' ').trim();
                        isStrongMatch = true;
                    } else {
                        name = cleanedLine;
                    }
                } else {
                    name = cleanedLine;
                }
            }
          }

          // Final safety check
          if (!name && cleanedLine) {
             name = cleanedLine;
          }

          // DECISION: Should we consume this line?
          // If it's NOT the last line -> Consume (it's a pasted block or previous line)
          // If it IS the last line -> Only consume if it is a "Strong Match" (Name + Account)
          // This allows typing "Name" without it being eaten immediately.
          // But if user pastes "Name - 123", it is strong match, so it gets eaten.
          
          let shouldConsume = false;
          if (i < lines.length - 1) {
              shouldConsume = true;
          } else {
              // Last line
              if (isStrongMatch) {
                  shouldConsume = true;
              } else {
                  // Weak match (Name only)
                  // Don't consume yet, user might be typing account
                  shouldConsume = false;
              }
          }

          if (!shouldConsume) {
              remainingLines.push(lines[i]);
              continue;
          }

          let newEntry = null;
          let isDuplicate = false;

          if (name) {
              // Check duplicates
              const exists = state.entries.find(e => e.name === name && e.account === account);
              if (!exists) {
                newEntry = {
                  id: `entry_${Date.now()}_${i}_${Math.random()}`,
                  name: name,
                  account: account,
                  label: account ? `${name} — ${account}` : name,
                  selected: false
                };
              } else {
                isDuplicate = true;
              }
          }
          
          if (newEntry) {
            state.entries.push(newEntry);
            addedCount++;
          } else if (isDuplicate) {
            duplicateCount++;
          } else {
             // Failed to parse name? Keep line.
             remainingLines.push(lines[i]);
          }
        }
    
        // Update input with only remaining lines
        // We need to be careful not to disrupt cursor if we are just typing and nothing was consumed
        // But if something WAS consumed, we must update.
        // If nothing consumed, remainingLines should equal lines (roughly).
        
        if (addedCount > 0 || duplicateCount > 0) {
            const newText = remainingLines.join('\n');
            if (participantsInput.value !== newText) {
                participantsInput.value = newText;
            }
            
            renderParticipants();
            renderWinners();
            drawWheel();
            saveSession();
            
            // Only toast if we added a significant amount (paste), not just 1 (typing)
            // Or maybe just don't toast for auto-add to avoid annoyance
            if (addedCount > 1) {
                toast(`تم إضافة ${addedCount} مشارك بنجاح` + (duplicateCount > 0 ? ` (و ${duplicateCount} مكرر)` : ''), 'success');
            } else if (duplicateCount > 0 && addedCount === 0) {
                 // If we just typed a duplicate and it disappeared, maybe show a small info?
                 // toast(`هذا المشارك موجود بالفعل`, 'info');
            }
        }
      });

      /* 
      // OLD INPUT LISTENER REMOVED
      participantsInput?.addEventListener('input', (e) => { ... });
      */
    
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
      // Hide and disable reset button under roulette per request
      if (resetBottomBtn) { resetBottomBtn.style.display = 'none'; }
      exportBottomBtn?.addEventListener('click', exportWinners);
      resetBottomBtn?.addEventListener('click', ()=> { 
        showConfirmModal(
          'سيتم مسح جميع الفائزين وإعادة تحميل جميع المشاركين لاختيار الفائزين من جديد. هل أنت متأكد؟',
          () => {
            // Clear winners
            state.winners = [];
            // Re-add all participants from textarea/source
            const ta = document.getElementById('participants-input');
            const lines = (ta?.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
            state.entries = lines.map((line, idx) => {
              const parts = line.split(' — ');
              const name = parts[0] || line;
              const account = parts[1] || '';
              return { id: `entry_${idx}_${Date.now()}`, name, account, label: account ? `${name} — ${account}` : name, selected: false };
            });
            renderParticipants();
            renderWinners();
            updateCounts();
            saveSession();
            toast('تم إعادة التهيئة: مسح الفائزين وإرجاع المشاركين', 'success');
          }
        );
      });
      
      window.addEventListener('resize', () => { drawWheel(); if(confettiCanvas){confettiCanvas.width=window.innerWidth;confettiCanvas.height=window.innerHeight;} });
      searchInput?.addEventListener('input', ()=> { state.filterTerm = searchInput.value.trim(); renderParticipants(); updateCounts(); });
      // Reset button modified to clear PARTICIPANTS per request
      resetWinnersBtn?.addEventListener('click', ()=> { 
        showConfirmModal(
          'سيتم مسح جميع المشاركين من القائمة. هل أنت متأكد؟',
          () => {
            state.entries = [];
            const ta = document.getElementById('participants-input');
            if (ta) ta.value = '';
            renderParticipants();
            drawWheel();
            updateCounts();
            saveSession();
            toast('تم مسح المشاركين بنجاح', 'success');
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
    
    function getSessionKey() {
        if (state.selectedAgent && state.selectedAgent.id && state.activeCompetition && state.activeCompetition.id) {
            return `winnerRouletteSession_${state.selectedAgent.id}_${state.activeCompetition.id}`;
        }
        return null;
    }

    function getStagedWinners() {
      try {
        const raw = localStorage.getItem(STAGED_WINNERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function getStagedWinnersForCompetition(competitionId) {
      if (!competitionId) return [];
      return getStagedWinners().filter(w => w.competitionId === competitionId);
    }

    function addStagedWinner(stagedWinner) {
      const staged = getStagedWinners();
      staged.push(stagedWinner);
      try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(staged)); } catch {}
    }

    function saveStagedWinner(winner, competitionId) {
      const staged = getStagedWinners();
      const index = staged.findIndex(w => w.id === winner.id);
      if (index >= 0) {
        // Update existing
        staged[index] = { ...staged[index], ...winner, competitionId };
      } else {
        // Add new
        staged.push({ ...winner, competitionId });
      }
      try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(staged)); } catch {}
    }

    function updateStagedWinner(winnerId, competitionId, patch) {
      const staged = getStagedWinners();
      const next = staged.map(w => {
        if (w.id !== winnerId) return w;
        if (competitionId && w.competitionId !== competitionId) return w;
        return { ...w, ...patch };
      });
      try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(next)); } catch {}
    }

    function removeStagedWinner(winnerId, competitionId) {
      const staged = getStagedWinners();
      const next = staged.filter(w => {
        if (w.id !== winnerId) return true;
        if (competitionId && w.competitionId !== competitionId) return true;
        return false;
      });
      try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(next)); } catch {}
    }

    function clearStagedWinnersForCompetition(competitionId) {
      if (!competitionId) return;
      const staged = getStagedWinners();
      const next = staged.filter(w => w.competitionId !== competitionId);
      try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(next)); } catch {}
    }

    function saveSession() {
      // Persist entries and winners as requested
      const session = {
        entries: state.entries,
        winners: state.winners,
        selectedAgent: state.selectedAgent,
        excludeWinner: state.excludeWinner,
        filterTerm: state.filterTerm,
        activeCompetitionId: state.activeCompetition ? state.activeCompetition.id : null
      };
      try { localStorage.setItem(LS_KEY, JSON.stringify(session)); } catch {}
    }
    
    async function restoreVideosFromDB() {
      if (!state.winners || state.winners.length === 0) return;
      let updated = false;
      for (const winner of state.winners) {
        // Check if we have a valid Blob (JSON.parse turns Blobs into {})
        const hasValidVideo = winner.pendingVideoBlob instanceof Blob;
        if (!hasValidVideo && !winner.videoUrl) {
           try {
             const blob = await getVideoFromDB(winner.id);
             if (blob) {
               winner.pendingVideoBlob = blob;
               updated = true;
             }
           } catch(e) {
             console.error('Error restoring video for winner:', winner.id, e);
           }
        }
      }
      if (updated) {
        renderWinners();
      }
    }

    async function restoreImagesFromDB() {
      if (!state.winners || state.winners.length === 0) return;
      let updated = false;
      for (const winner of state.winners) {
        // Check if we have a valid Blob/File (JSON.parse turns them into {})
        const hasValidImage = winner.pendingIdImage instanceof Blob || winner.pendingIdImage instanceof File;
        if (!hasValidImage && !winner.nationalIdImage) {
           try {
             const blob = await getImageFromDB(winner.id);
             if (blob) {
               winner.pendingIdImage = blob;
               // Re-create File object if possible, or just use Blob
               if (winner.localIdImageName) {
                   try {
                       winner.pendingIdImage = new File([blob], winner.localIdImageName, { type: blob.type });
                   } catch(e) {}
               }
               updated = true;
             }
           } catch(e) {
             console.error(`[restoreImagesFromDB] Error restoring image for winner ID: ${winner.id}`, e);
           }
        }
      }
      if (updated) {
        renderWinners();
      }
    }

    async function restoreSession(skipAgent = false) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const session = JSON.parse(raw);
        
        state.entries = session.entries || [];
        
        // Smart merge for winners to preserve Blobs if already loaded
        const newWinners = session.winners || [];
        state.winners = newWinners.map(nw => {
            const existing = state.winners.find(ew => ew.id === nw.id);
            // If we already have a valid Blob in memory, keep it!
            if (existing && (existing.pendingIdImage instanceof Blob || existing.pendingIdImage instanceof File)) {
                nw.pendingIdImage = existing.pendingIdImage;
                nw.idImageUploaded = true;
            }
            // Same for video
            if (existing && (existing.pendingVideoBlob instanceof Blob)) {
                nw.pendingVideoBlob = existing.pendingVideoBlob;
            }
            return nw;
        });
        
        // Restore videos from IndexedDB immediately after loading winners
        await restoreVideosFromDB();
        await restoreImagesFromDB();

        state.excludeWinner = !!session.excludeWinner;
        state.filterTerm = session.filterTerm || '';
        
        if (!skipAgent && session.selectedAgent) {
          state.selectedAgent = session.selectedAgent;
          // We need to re-select the agent in the dropdown if possible
          const agentSelect = document.getElementById('agent-select');
          if (agentSelect) {
             agentSelect.value = session.selectedAgent.id;
             // Trigger change event to load competition info
             agentSelect.dispatchEvent(new Event('change'));
          }
        }

        const excludeCb = document.getElementById('exclude-winner');
        if (excludeCb) excludeCb.checked = state.excludeWinner;
        
        const searchInput = document.getElementById('participants-search');
        if (searchInput) searchInput.value = state.filterTerm;
        
        // Restore participants text area
        const ta = document.getElementById('participants-input');
        if (ta && state.entries.length > 0) {
             ta.value = state.entries.map(e => e.account ? `${e.name} — ${e.account}` : e.name).join('\n');
        }

        renderParticipants();
        renderWinners();
        updateCounts();
        drawWheel();
      } catch (e) {
        console.warn('Session restore failed', e);
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
                    clearStagedWinnersForCompetition(state.activeCompetition.id);
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
        // Total participants
        const totalEl = document.getElementById('participants-count-total');
        if (totalEl) totalEl.textContent = state.entries.length;
        // Winners selected
        const winnersCountEl = document.getElementById('winners-count');
        if (winnersCountEl) winnersCountEl.textContent = state.winners.length;
        // Remaining required winners (bind to backend required_winners if available)
        const remainingEl = document.getElementById('participants-count-remaining');
        if (remainingEl) {
          if (state.activeCompetition) {
            const totalReq = state.activeCompetition.totalRequired || state.activeCompetition.requiredWinners || 0;
            const current = (state.activeCompetition.currentWinners ?? state.winners.length);
            const remaining = Math.max(totalReq - current, 0);
            remainingEl.textContent = remaining;
          } else {
            remainingEl.textContent = Math.max(state.entries.length - state.winners.length, 0);
          }
        }
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
      const currentTotal = state.winners.length;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
        toast(`تم اختيار جميع الفائزين للوكيل ${agentLabel} (عددهم ${state.activeCompetition.totalRequired}). يرجى اعتماد الفائزين أو استرجاع فائز لإعادة الدوران.`, 'warning');
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
      const currentTotal = state.winners.length;
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
      const currentTotal = state.winners.length;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
        toast(`تم اختيار جميع الفائزين للوكيل ${agentLabel} (عددهم ${state.activeCompetition.totalRequired}). يرجى اعتماد الفائزين أو استرجاع فائز لإعادة الدوران.`, 'warning');
        return;
      }
      const candidates = state.entries.filter(e => {
          // Filter out if not selected (unless excludeWinner is false, but wait...)
          // The logic was: !e.selected || !state.excludeWinner
          // This means: include if NOT selected OR (selected AND we don't exclude winners)
          
          // BUT, we also want to strictly filter out anyone who is ALREADY in state.winners
          // regardless of the 'selected' flag on the entry itself, to be safe.
          const isAlreadyWinner = state.winners.some(w => {
              // Strict check:
              // 1. If both have accounts, they MUST match.
              // 2. If accounts don't match (and both exist), they are different people (even if names match).
              if (w.account && e.account) {
                  return w.account === e.account;
              }
              // If one or both lack account, fallback to name
              return w.name === e.name;
          });
          
          if (isAlreadyWinner) return false; // Always exclude confirmed winners from spinning again
          
          return !e.selected || !state.excludeWinner;
      });
      
      if(candidates.length===0){toast('أضف مشاركين أولاً (أو جميع المشاركين فازوا بالفعل)'); state.spinQueue=0; return;}
    
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

      // --- NEW: Check if this winner has already been selected in the current session ---
      // This prevents re-selecting the same winner if they are still on the wheel (e.g. excludeWinner=false)
      // or if they were manually added back but somehow still flagged.
      const alreadyWon = state.winners.find(w => {
          if (w.account && chosenWinner.account) {
              return w.account === chosenWinner.account;
          }
          return w.name === chosenWinner.name;
      });

      if (alreadyWon) {
          toast(`تنبيه: هذا المتسابق (${chosenWinner.name}) فاز بالفعل في هذه المسابقة!`, 'warning');
          // We can either stop the spin or let it spin but show a different modal at the end.
          // For better UX, let's stop immediately or re-spin.
          // Re-spinning might be complex if only 1 candidate left.
          // Let's just proceed but flag it, or maybe we should have filtered them out in candidates?
          // Ideally, candidates should filter out state.winners if we want to strictly enforce "one win per person per competition".
          
          // Let's filter candidates properly at the start of startSpin instead.
          // But if we are here, let's just continue and handle it in the completion callback.
      }
      
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
          // console.log(`🎥 [Recording] Finished. Blob size: ${blob.size}, Type: ${blobType}`);
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
      /* console.log('🎥 [Video Preview] Starting showVideoPreview');
      console.log('🎥 [Video Preview] Blob:', blob);
      console.log('🎥 [Video Preview] Winner:', winner); */
      
      if (!blob) {
        console.warn('🎥 [Video Preview] No blob provided, falling back to normal flow');
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
      video.autoplay = false;
      video.muted = false;
      video.loop = true;
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
    
      // Skip Winner Button (Cancel Winner)
      const skipWinnerBtn = document.createElement('button');
      skipWinnerBtn.id = 'skip-winner-btn';
      skipWinnerBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 16px;';
      skipWinnerBtn.innerHTML = '<i class="fas fa-redo"></i> تخطي الفائز';
      btnContainer.appendChild(skipWinnerBtn);
    
      container.appendChild(btnContainer);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
    
      // Load metadata and prepare video
      video.onloadedmetadata = () => {
        // console.log('🎥 [Preview] Metadata loaded, duration:', video.duration);
      };
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
      
      skipWinnerBtn.addEventListener('click', () => {
        cleanup();
        // Do NOT proceed to showWinnerModal.
        // Just close the preview. The winner is not added to state.winners yet (that happens in showWinnerModal).
        // We might want to re-spin if in auto mode or queue, similar to the other skip button.
        // But for now, just closing effectively "skips" this winner selection.
        toast('تم تخطي الفائز وإلغاء الاختيار', 'info');
      });
      
      saveBtn.addEventListener('click', async () => {
        // حفظ الفيديو ثم فتح نافذة بيانات الفائز بشكل موثوق
        /* console.log('🎬 [Save Video Continue] Button clicked');
        console.log('🎬 [Save Video Continue] Winner:', winner);
        console.log('🎬 [Save Video Continue] Auto mode:', state.autoMode);
        console.log('🎬 [Save Video Continue] Blob:', blob); */
        
        try {
          state.pendingVideoBlob = blob;
          // console.log('🎬 [Save Video Continue] Pending video blob stored');
          
          // تأكد من وجود هيكل المودال قبل الفتح
          try { 
            // console.log('🎬 [Save Video Continue] Ensuring winner modal structure...');
            ensureWinnerModalStructure(); 
            // console.log('🎬 [Save Video Continue] Winner modal structure ensured');
          } catch(e) {
            console.error('🎬 [Save Video Continue] Failed to ensure modal structure:', e);
          }
          
          // console.log('🎬 [Save Video Continue] Calling cleanup...');
          cleanup();
          // console.log('🎬 [Save Video Continue] Cleanup done');
          
          // افتح المودال بعد إزالة طبقة المعاينة لضمان الطبقات/z-index صحيحة
          // console.log('🎬 [Save Video Continue] Setting timeout to open modal...');
          setTimeout(() => {
            try {
              // console.log('🎬 [Save Video Continue] Timeout callback executing...');
              if (state.autoMode) {
                // console.log('🎬 [Save Video Continue] Opening AUTO winner modal');
                showAutoWinnerModal(winner);
              } else {
                // console.log('🎬 [Save Video Continue] Opening MANUAL winner modal');
                showWinnerModal(winner);
              }
              // console.log('🎬 [Save Video Continue] Modal opened successfully');
            } catch (e) {
              console.error('🎬 [Save Video Continue] Failed to open winner modal after video save:', e);
              // كحل أخير، أعد إنشاء المودال وافتحه مرة أخرى
              try { ensureWinnerModalStructure(); } catch {}
              if (state.autoMode) {
                showAutoWinnerModal(winner);
              } else {
                showWinnerModal(winner);
              }
            }
          }, 50);
        } catch (e) {
          console.error('🎬 [Save Video Continue] CRITICAL ERROR in flow:', e);
          toast('حدث خطأ أثناء المتابعة. سنفتح نموذج بيانات الفائز مباشرة.', 'warning');
          // فلو بديل مباشر
          try { ensureWinnerModalStructure(); } catch {}
          if (state.autoMode) {
            showAutoWinnerModal(winner);
          } else {
            showWinnerModal(winner);
          }
        }
      });
    }
    
    function checkCompletion() {
      // استخدام عدد الفائزين المحليين فقط (state.winners.length)
      const currentTotal = state.winners.length;
      if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
        if (state.reportSent) {
          const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
          // عرض إشعار بسيط بدلاً من modal
          setTimeout(() => {
            toast(`تم اكتمال اختيار الفائزين (${state.activeCompetition.totalRequired}) للوكيل ${agentLabel}`, 'success');
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
    
    // Global function for removing participants (fixes event delegation issues)
    window.removeParticipant = function(id, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      console.log('[CLICK] Removing participant via global function:', id);
      state.entries = state.entries.filter(x => String(x.id) !== String(id));
      
      // Update textarea - DISABLED to allow clearing input without clearing list
      /*
      const ta = document.getElementById('participants-input');
      if (ta) {
        ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
      }
      */
      
      renderParticipants();
      renderWinners();
      updateCounts();
      drawWheel();
      saveSession();
    };

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
      
      container.innerHTML = list.map((e,i) => {
        const html = `
        <div class="wr-item ${e.selected?'wr-item-selected':''}" data-id="${e.id}" title="${e.label}">
          <div class="wr-item-body">
            <div class="wr-item-label"><span class="wr-badge-num">${e.seq || (i+1)}</span> ${e.name}</div>
            <div class="wr-item-meta">${e.account}</div>
          </div>
          <div class="wr-item-actions">
            ${e.selected ? '<span class="wr-tag wr-tag-winner">فائز</span>' : ''}
            <button class="wr-icon-btn js-remove-btn" data-id="${e.id}" title="إزالة" style="background: #ef4444; color: white; cursor: pointer; z-index: 100; position: relative;"><i class="fas fa-times" style="pointer-events: none;"></i></button>
          </div>
        </div>
      `;
        return html;
      }).join('');
      
      // Attach event listeners directly to buttons (most robust method)
      const buttons = container.querySelectorAll('.js-remove-btn');
      
      buttons.forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = btn.dataset.id;
          
          // Call the removal logic directly
          state.entries = state.entries.filter(x => String(x.id) !== String(id));
          
          // Update textarea - DISABLED
          /*
          const ta = document.getElementById('participants-input');
          if (ta) {
            ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
          }
          */
          
          renderParticipants();
          renderWinners();
          updateCounts();
          drawWheel();
          saveSession();
          console.log('[CLICK] Removed successfully');
        });
      });
      
      console.log('[renderParticipants] HTML set, buttons count:', buttons.length);
    }
    
    function renderWinners() {
      const bottomContainer = document.getElementById('winners-list-bottom');
      
      if (!bottomContainer) return;

      const activeCompetitionId = state.activeCompetition?.id || null;
      if (state.winners.length === 0 && activeCompetitionId) {
        const stagedForCompetition = getStagedWinnersForCompetition(activeCompetitionId);
        if (stagedForCompetition.length > 0) {
          state.winners = stagedForCompetition.map(w => ({ ...w }));
        }
      }
      
      // Separate winners by prize type
      const depositWinners = state.winners.filter(w => w.prizeType === 'deposit' || w.prizeType === 'deposit_prev');
      const tradingWinners = state.winners.filter(w => w.prizeType === 'trading');
      
      let html = '';

      if (state.winners.length === 0) {
        html += '<div class="wr-winner-empty"><i class="fas fa-trophy" style="font-size:2rem;opacity:.3;margin-bottom:8px;"></i><p>لا يوجد اسماء</p></div>';
      }
    
      // Add "Send All" button at the top of the bottom container if there are winners
      // Only show these buttons if the competition is NOT approved yet
      // UPDATED: Always show buttons if not approved, regardless of winner count (user request)
      if (!state.noWinnersApproved) {
          // Check if all winners have ID images
          const allHaveIds = state.winners.length > 0 && state.winners.every(w => 
              (w.pendingIdImage && (w.pendingIdImage instanceof Blob || w.pendingIdImage instanceof File)) || 
              w.nationalIdImage
          );
          
          const hasWinners = state.winners.length > 0;

          const sendIdsBtnStyle = allHaveIds 
              ? "background: #22c55e; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);" 
              : "background: #9ca3af; cursor: not-allowed; opacity: 0.7;";
          
          const sendIdsBtnTitle = !hasWinners 
              ? "لا يوجد فائزين للإرسال"
              : (!allHaveIds ? "يجب رفع هويات جميع الفائزين أولاً" : "إرسال الهوية والكليشة");

          const sendAllBtnStyle = hasWinners
              ? "background: #0ea5e9; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35); cursor: pointer;"
              : "background: #9ca3af; cursor: not-allowed; opacity: 0.7;";

          html += `
          <div style="width:100%; margin-bottom: 20px;">
            <button id="send-all-winners-btn" ${!hasWinners ? 'disabled' : ''} class="wr-btn" style="
              width: 100%;
              ${sendAllBtnStyle}
              color: #fff;
              border: none;
              padding: 12px 16px;
              font-size: 1rem;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              border-radius: 999px;
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            " onmouseover="${hasWinners ? "this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(14, 165, 233, 0.45)'" : ''}" 
               onmouseout="${hasWinners ? "this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(14, 165, 233, 0.35)'" : ''}">
              <i class="fas fa-paper-plane" style="font-size: 1em;"></i> 
              <span>إرسال الكل للوكيل (${state.winners.length})</span>
            </button>
            <div style="height: 15px;"></div>
            <button id="send-winners-ids-btn" ${!allHaveIds ? 'disabled' : ''} title="${sendIdsBtnTitle}" style="
              width: 100%;
              ${sendIdsBtnStyle}
              color: #fff;
              border: none;
              padding: 12px 16px;
              font-size: 1rem;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              border-radius: 999px;
              cursor: ${allHaveIds ? 'pointer' : 'not-allowed'};
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            " onmouseover="${allHaveIds ? "this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(34, 197, 94, 0.45)'" : ''}" 
               onmouseout="${allHaveIds ? "this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(34, 197, 94, 0.35)'" : ''}">
              <i class="fas fa-id-card" style="font-size: 1em;"></i> 
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
          
          let prizeDisplay = '';
          if (w.prizeType === 'deposit_prev') {
              prizeDisplay = `${w.prizeValue || 0}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
          } else {
              prizeDisplay = `${w.prizeValue || 0}% بونص إيداع`;
          }

          // --- NEW: ID Image Thumbnail ---
          let idImageHtml = '';
          // console.log(`[RenderWinners] Processing winner ${w.id}. pendingIdImage:`, w.pendingIdImage);
          if (w.pendingIdImage) {
              try {
                  // Ensure we have a valid Blob or File before creating URL
                  const blob = (w.pendingIdImage instanceof Blob || w.pendingIdImage instanceof File) 
                      ? w.pendingIdImage 
                      : new Blob([w.pendingIdImage]); // Fallback if it's an ArrayBuffer or similar
                  
                  const blobUrl = URL.createObjectURL(blob);
                  // console.log(`[RenderWinners] Created blob URL for ${w.id}: ${blobUrl}`);
                  idImageHtml = `<div class="wr-winner-id-thumb" style="margin-top:8px; border-top:1px solid #eee; padding-top:8px;">
                      <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">صورة الهوية:</div>
                      <img src="${blobUrl}" alt="الهوية" style="max-width:100px; max-height:60px; border-radius:4px; border:1px solid #ddd; cursor:zoom-in;" onclick="window.open(this.src, '_blank')">
                  </div>`;
              } catch(e) { console.warn('Failed to create object URL', e); }
          } else if (w.nationalIdImage) {
              idImageHtml = `<div class="wr-winner-id-thumb" style="margin-top:8px; border-top:1px solid #eee; padding-top:8px;">
                  <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">صورة الهوية:</div>
                  <img src="${w.nationalIdImage}" alt="الهوية" style="max-width:100px; max-height:60px; border-radius:4px; border:1px solid #ddd; cursor:zoom-in;" onclick="window.open(this.src, '_blank')">
              </div>`;
          }
          // -------------------------------

          html += `
            <div class="wr-winner-card" data-id="${w.id}">
              <div class="wr-winner-card-badge">#${i+1}</div>
              <div class="wr-winner-card-body">
                <div class="wr-winner-card-name" style="color: #000000; font-weight: bold; font-size: 1.1rem;">الاسم: ${w.name}</div>
                <div class="wr-winner-card-account">رقم الحساب: ${w.account}</div>
                ${w.email ? `<div class="wr-winner-card-email"><i class="fas fa-envelope"></i> ${w.email}</div>` : ''}
                <div class="wr-winner-card-prize"><i class="fas fa-gift"></i> ${prizeDisplay}</div>
                ${w.agent ? `<div class="wr-winner-card-agent"><i class="fas fa-user-tie"></i> <a href="#profile/${w.agent.id}" style="color:inherit;text-decoration:underline;cursor:pointer;">${w.agent.name} (#${w.agent.agentId})</a></div>` : ''}
                ${idImageHtml}
                <div class="wr-winner-warnings">
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="meet" data-id="${w.id}" ${w.includeWarnMeet ? 'checked' : ''}> ⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً
                  </label>
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="prev" data-id="${w.id}" ${w.includeWarnPrev ? 'checked' : ''}> ‼️ يرجى التحقق أولًا من هذا العميل، حيث سبق أن فاز بجائزة (بونص تداولي) خلال الأيام الماضية
                  </label>
                </div>
    
              </div>
              <div class="wr-winner-card-actions">
                <button class="wr-icon-btn" data-send="${w.id}" title="إرسال للوكيل"><i class="fas fa-paper-plane"></i></button>
                <button class="wr-icon-btn" data-copy="${w.name} — ${w.account} — ${w.email} — ${w.prizeValue}%" title="نسخ"><i class="fas fa-copy"></i></button>
                <button class="wr-icon-btn" data-edit="${w.id}" title="تعديل" style="background: #3b82f6; color: white;"><i class="fas fa-edit"></i></button>
                <button class="wr-icon-btn" data-restore="${w.id}" title="استرجاع للروليت" style="width:auto; padding:0 10px; gap:6px;"><i class="fas fa-redo"></i> استرجاع</button>
                <button class="wr-icon-btn" data-delete="${w.id}" title="حذف" style="background: #ef4444; color: white;"><i class="fas fa-trash"></i></button>
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
          // --- NEW: ID Image Thumbnail (Trading) ---
          let idImageHtml = '';
          // console.log(`[RenderWinners] Processing winner ${w.id}. pendingIdImage:`, w.pendingIdImage);
          if (w.pendingIdImage) {
              try {
                  // Ensure we have a valid Blob or File before creating URL
                  const blob = (w.pendingIdImage instanceof Blob || w.pendingIdImage instanceof File) 
                      ? w.pendingIdImage 
                      : new Blob([w.pendingIdImage]); // Fallback if it's an ArrayBuffer or similar

                  const blobUrl = URL.createObjectURL(blob);
                  // console.log(`[RenderWinners] Created blob URL for ${w.id}: ${blobUrl}`);
                  idImageHtml = `<div class="wr-winner-id-thumb" style="margin-top:8px; border-top:1px solid #eee; padding-top:8px;">
                      <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">صورة الهوية:</div>
                      <img src="${blobUrl}" alt="الهوية" style="max-width:100px; max-height:60px; border-radius:4px; border:1px solid #ddd; cursor:zoom-in;" onclick="window.open(this.src, '_blank')">
                  </div>`;
              } catch(e) { console.warn('Failed to create object URL', e); }
          } else if (w.nationalIdImage) {
              idImageHtml = `<div class="wr-winner-id-thumb" style="margin-top:8px; border-top:1px solid #eee; padding-top:8px;">
                  <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">صورة الهوية:</div>
                  <img src="${w.nationalIdImage}" alt="الهوية" style="max-width:100px; max-height:60px; border-radius:4px; border:1px solid #ddd; cursor:zoom-in;" onclick="window.open(this.src, '_blank')">
              </div>`;
          }
          // ---------------------------------------

          html += `
            <div class="wr-winner-card" data-id="${w.id}">
              <div class="wr-winner-card-badge">#${i+1}</div>
              <div class="wr-winner-card-body">
                <div class="wr-winner-card-name" style="color: #000000; font-weight: bold; font-size: 1.1rem;">الاسم: ${w.name}</div>
                <div class="wr-winner-card-account">رقم الحساب: ${w.account}</div>
                ${w.email ? `<div class="wr-winner-card-email"><i class="fas fa-envelope"></i> ${w.email}</div>` : ''}
    
                <div class="wr-winner-card-prize"><i class="fas fa-gift"></i> $${w.prizeValue || 0} بونص تداولي</div>
                ${w.agent ? `<div class="wr-winner-card-agent"><i class="fas fa-user-tie"></i> <a href="#profile/${w.agent.id}" style="color:inherit;text-decoration:underline;cursor:pointer;">${w.agent.name} (#${w.agent.agentId})</a></div>` : ''}
                ${idImageHtml}
                <div class="wr-winner-warnings">
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="meet" data-id="${w.id}" ${w.includeWarnMeet ? 'checked' : ''}> ⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً
                  </label>
                  <label class="wr-toggle-label" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;">
                    <input type="checkbox" data-warn="prev" data-id="${w.id}" ${w.includeWarnPrev ? 'checked' : ''}> ‼️ يرجى التحقق أولًا من هذا العميل، حيث سبق أن فاز بجائزة (بونص تداولي) خلال الأيام الماضية
                  </label>
                </div>
              </div>
              <div class="wr-winner-card-actions">
                <button class="wr-icon-btn" data-send="${w.id}" title="إرسال للوكيل"><i class="fas fa-paper-plane"></i></button>
                <button class="wr-icon-btn" data-copy="${w.name} — ${w.account} — ${w.email} — $${w.prizeValue}" title="نسخ"><i class="fas fa-copy"></i></button>
                <button class="wr-icon-btn" data-edit="${w.id}" title="تعديل" style="background: #3b82f6; color: white;"><i class="fas fa-edit"></i></button>
                <button class="wr-icon-btn" data-restore="${w.id}" title="استرجاع للروليت" style="width:auto; padding:0 10px; gap:6px;"><i class="fas fa-redo"></i> استرجاع</button>
                <button class="wr-icon-btn" data-delete="${w.id}" title="حذف" style="background: #ef4444; color: white;"><i class="fas fa-trash"></i></button>
              </div>
            </div>`;
        });
        
        html += '</div></div>';
      }
      
        html += `
          <div id="approval-section" style="width:100%; margin-top: 20px; border-top: 1px solid #334155; padding-top: 20px;">
              <h4 class="wr-prize-section-title">إعتماد نهائي</h4>
              <div style="display: flex; gap: 10px;">
                  <button id="approve-winners-btn" class="wr-btn wr-btn-success" style="display: ${state.winners.length > 0 ? 'inline-flex' : 'none'}">
                      <i class="fas fa-check-double"></i> اعتماد الفائزين (${state.winners.length})
                  </button>
                  <button id="approve-no-winners-btn" class="wr-btn wr-btn-danger">
                      <i class="fas fa-times-circle"></i> اعتماد المسابقة بدون فائزين
                  </button>
              </div>
              <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 10px;">
                  سيؤدي هذا الإجراء إلى إغلاق المسابقة الحالية ومنع اختيار فائزين جدد.
              </p>
          </div>
      `;

        bottomContainer.innerHTML = html;

        // Bind events for new buttons
        const approveBtn = document.getElementById('approve-winners-btn');
        approveBtn?.addEventListener('click', async () => {
            console.log('[Approve Winners] Button clicked. Winners count:', state.winners.length);
            if (!state.activeCompetition || !state.activeCompetition.id) {
                console.error('[Approve Winners] Active competition state missing:', state.activeCompetition);
                toast('لا توجد مسابقة نشطة لاعتمادها (معرف مفقود).', 'error');
                return;
            }

          if (!state.selectedAgent || !state.selectedAgent.id) {
            console.error('[Approve Winners] Selected agent missing:', state.selectedAgent);
            toast('لا يوجد وكيل محدد.', 'error');
            return;
          }

          // Ensure everything is saved before completing
          try {
            toast('جاري حفظ الفائزين قبل الاعتماد...', 'info');
            await saveAllWinnersToDatabase();
            console.log('[Approve Winners] saveAllWinnersToDatabase completed');
          } catch (e) {
            console.error('[Approve Winners] Failed to save winners before approval:', e);
            toast('فشل حفظ الفائزين قبل الاعتماد. يرجى المحاولة مرة أخرى.', 'error');
            return;
          }

          // Verify on backend that each winner has video + national ID image
          try {
            toast('جاري التحقق من حفظ الفيديو وصورة الهوية...', 'info');
            const authedFetch = window.authedFetch || fetch;
            const verifyResp = await authedFetch(`/api/agents/${state.selectedAgent.id}/winners?competition_id=${state.activeCompetition.id}`);
            if (!verifyResp.ok) {
              console.error('[Approve Winners] Verify fetch failed:', verifyResp.status);
              toast('فشل التحقق من بيانات الفائزين من قاعدة البيانات.', 'error');
              return;
            }

            const verifyData = await verifyResp.json();
            const dbCompetition = (verifyData.competitions && verifyData.competitions[0]) ? verifyData.competitions[0] : null;
            const dbWinners = (dbCompetition && dbCompetition.winners) ? dbCompetition.winners : [];

            const missing = dbWinners.filter(w => !w.video_url || !w.national_id_image);
            console.log('[Approve Winners] verify result', {
              dbWinnersCount: dbWinners.length,
              missingCount: missing.length,
              missingIds: missing.map(m => m.id)
            });

            if (dbWinners.length === 0) {
              toast('لا يوجد فائزين محفوظين في قاعدة البيانات لهذه المسابقة.', 'error');
              return;
            }

            if (missing.length > 0) {
              toast(`يوجد ${missing.length} فائز بدون فيديو أو صورة هوية محفوظة. يرجى إعادة المحاولة.`, 'error');
              return;
            }
          } catch (e) {
            console.error('[Approve Winners] Verify exception:', e);
            toast('حدث خطأ أثناء التحقق من حفظ البيانات.', 'error');
            return;
          }
            
            // Direct approval without confirmation modal
            try {
                console.log('[Approve Winners] Sending approval request for competition:', state.activeCompetition.id);
                const authedFetch = window.authedFetch || fetch;
                const resp = await authedFetch(`/api/competitions/${state.activeCompetition.id}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        winners: state.winners.map(w => w._id).filter(Boolean)
                    })
                });
                
                if (resp.ok) {
                    console.log('[Approve Winners] Approval successful.');
                    toast('تم اعتماد المسابقة بنجاح', 'success');
                    clearStagedWinnersForCompetition(state.activeCompetition.id);
                    
                    // Redirect to agent competitions page
                    if (state.selectedAgent && state.selectedAgent.id) {
                        console.log('[Approve Winners] Redirecting to agent profile/competitions:', state.selectedAgent.id);
                        // Using the standard profile route which usually shows competitions
                        window.location.hash = `#profile/${state.selectedAgent.id}`;
                    } else {
                        console.warn('[Approve Winners] No selected agent found for redirect. Reloading page.');
                        setTimeout(() => window.location.reload(), 1500);
                    }

                    // Clear local state
                    state.winners = [];
                    state.entries = [];
                    state.activeCompetition = null;
                    saveSession();
                    renderParticipants();
                    renderWinners();
                    updateCounts();
                } else {
                    const err = await resp.json();
                    console.error('[Approve Winners] Approval failed:', err);
                    toast(`فشل الاعتماد: ${err.message} ${err.error || ''}`, 'error');
                }
            } catch (e) {
                console.error('[Approve Winners] Exception during approval:', e);
                toast('حدث خطأ أثناء الاعتماد', 'error');
            }
        });

        const approveNoWinnersBtn = document.getElementById('approve-no-winners-btn');
        approveNoWinnersBtn?.addEventListener('click', async () => {
            console.log('[Approve No Winners] Button clicked.');
            
            // Check if there are winners
            if (state.winners.length > 0) {
                console.warn('[Approve No Winners] Blocked: There are existing winners.');
                toast('لا يمكن اعتماد المسابقة بدون فائزين لوجود فائزين في القائمة. يرجى حذفهم أولاً.', 'error');
                return;
            }

            if (!state.activeCompetition || !state.activeCompetition.id) {
                console.error('[Approve No Winners] Active competition state missing:', state.activeCompetition);
                toast('لا توجد مسابقة نشطة لاعتمادها (معرف مفقود).', 'error');
                return;
            }
            
            // Direct approval without confirmation modal
            try {
                console.log('[Approve No Winners] Sending approval request (no winners) for competition:', state.activeCompetition.id);
                const authedFetch = window.authedFetch || fetch;
                const resp = await authedFetch(`/api/competitions/${state.activeCompetition.id}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noWinners: true
                    })
                });
                
                if (resp.ok) {
                    console.log('[Approve No Winners] Approval successful.');
                    toast('تم إغلاق المسابقة بنجاح', 'success');
                    clearStagedWinnersForCompetition(state.activeCompetition.id);
                    state.winners = [];
                    state.entries = [];
                    state.activeCompetition = null;
                    saveSession();
                    renderParticipants();
                    renderWinners();
                    updateCounts();
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    const err = await resp.json();
                    console.error('[Approve No Winners] Approval failed:', err);
                    toast(`فشل الإغلاق: ${err.message} ${err.error || ''}`, 'error');
                }
            } catch (e) {
                console.error('[Approve No Winners] Exception during approval:', e);
                toast('حدث خطأ أثناء الإغلاق', 'error');
            }
        });

        // Bind events
        const sendAllBtn = document.getElementById('send-all-winners-btn');
        if (sendAllBtn) {
            sendAllBtn.addEventListener('click', sendWinnersReport);
        }

        const sendIDsBtn = document.getElementById('send-winners-ids-btn');
        if (sendIDsBtn) {
            sendIDsBtn.addEventListener('click', sendWinnersWithIDsToAgent);
        }

        bottomContainer.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', handleCopyClick);
        });
        bottomContainer.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', handleEditClick);
        });
        bottomContainer.querySelectorAll('input[data-warn]').forEach(input => {
            input.addEventListener('change', handleWinnerWarningToggle);
        });
        bottomContainer.querySelectorAll('[data-restore]').forEach(btn => {
            btn.addEventListener('click', handleRestoreClick);
        });
        bottomContainer.querySelectorAll('[data-send]').forEach(btn => {
            btn.addEventListener('click', handleSendClick);
        });
        bottomContainer.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', handleDeleteClick);
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
    
    function handleReturnClick(ev) {
      const id = ev.currentTarget.getAttribute('data-return');
      
      // Find the winner to return
      const winnerIndex = state.winners.findIndex(w => w.id === id);
      if (winnerIndex === -1) return;
      
      const winner = state.winners[winnerIndex];
      
      // Remove from winners list
      state.winners.splice(winnerIndex, 1);
      
      // Check if already in entries
      let entry = state.entries.find(e => e.id === id);
      
      if (!entry) {
          // Re-create entry
          entry = {
              id: winner.id,
              name: winner.name,
              account: winner.account,
              label: winner.label || winner.name,
              selected: false,
              seq: winner.seq
          };
          state.entries.push(entry);
      } else {
          entry.selected = false;
      }
      
      // Update the textarea to reflect the returned participant
      const ta = document.getElementById('participants-input');
      if (ta) {
          ta.value = state.entries.map(e => `${e.name} — ${e.account}`).join('\n');
      }

      // Decrement current winners count in active competition
      if (state.activeCompetition && state.activeCompetition.currentWinners > 0) {
          state.activeCompetition.currentWinners--;
      }

      renderParticipants(); 
      renderWinners(); 
      updateCounts(); 
      drawWheel(); 
      saveSession();
      removeStagedWinner(id, state.activeCompetition?.id || null);
      toast('تم استرجاع الفائز للروليت', 'info');
    }

    function handleDeleteClick(ev) {
      const id = ev.currentTarget.getAttribute('data-delete');
      if (!id) return;
      
      if (!confirm('هل أنت متأكد من حذف هذا الفائز؟')) return;
      
      // Remove from winners list
      state.winners = state.winners.filter(w => w.id !== id);
      
      // Delete video from DB
      deleteVideoFromDB(id).catch(e => console.error('Failed to delete video', e));
      
      saveSession();
      removeStagedWinner(id, state.activeCompetition?.id || null);
      renderWinners();
      updateCounts();
      toast('تم حذف الفائز', 'success');
    }
    
    function handleRestoreClick(ev) {
      const id = ev.currentTarget.getAttribute('data-restore');
      const winner = state.winners.find(w => w.id === id);
      
      if (!winner) {
        toast('لم يتم العثور على الفائز', 'error');
        return;
      }
      
      console.log('[Restore] Request to restore winner:', winner);

      showConfirmModal(
        `هل تريد استرجاع <strong>${winner.name}</strong> إلى الروليت؟ سيتم إلغاء اختياره كفائز وإعادته للمشاركين.`,
        async () => {
          console.log('[Restore] User confirmed restoration. Processing...');
          
          // Delete video from DB
          deleteVideoFromDB(id).catch(e => console.error('Failed to delete video', e));

          // إزالة الفائز من قائمة الفائزين
          const initialWinnersCount = state.winners.length;
          state.winners = state.winners.filter(w => w.id !== id);
          console.log(`[Restore] Winners count: ${initialWinnersCount} -> ${state.winners.length}`);
          
          // إعادة ضبط حالة جميع المشاركين لضمان أن الجميع متاح للروليت ما عدا الفائزين الحاليين
          const currentWinnerIds = new Set(state.winners.map(w => w.id));
          
          // التحقق من وجود الفائز المسترجع في القائمة، وإضافته إذا لم يكن موجوداً
          // Check by ID OR by Name+Account to avoid duplicates
          const restoredEntryExists = state.entries.some(e => e.id === id || (e.name === winner.name && e.account === winner.account));
          if (!restoredEntryExists) {
            console.log('[Restore] Adding winner back to entries list');
            state.entries.push({
              id: winner.id,
              name: winner.name,
              account: winner.account,
              label: `${winner.name} — ${winner.account}`,
              selected: false,
              seq: state.entries.length + 1
            });
          } else {
             console.log('[Restore] Winner already exists in entries list');
          }

          // تحديث حالة الاختيار لجميع المشاركين
          let updatedCount = 0;
          state.entries.forEach(entry => {
            // المشارك يعتبر "مختاراً" (مستبعداً من الروليت) فقط إذا كان في قائمة الفائزين الحالية
            const wasSelected = entry.selected;
            entry.selected = currentWinnerIds.has(entry.id);
            if (wasSelected !== entry.selected) updatedCount++;
          });
          console.log(`[Restore] Updated selection status for ${updatedCount} entries`);
          
          // حذف الفائز من قاعدة البيانات إذا كان محفوظاً
          if (winner._id && state.selectedAgent && state.selectedAgent.id) {
            try {
              const authedFetch = window.authedFetch || fetch;
              await authedFetch(`/api/agents/${state.selectedAgent.id}/winners/${winner._id}`, {
                method: 'DELETE'
              });

              // NEW: If we delete a winner, we should ensure the competition is not "completed" anymore
              // This allows the user to spin again and select a replacement
              if (state.activeCompetition && state.activeCompetition.id) {
                  // We optimistically update local state
                  state.reportSent = false;
                  state.noWinnersApproved = false;

                  // And update backend status to 'active' (or 'awaiting_winners' if supported, but 'active' is safer)
                  await authedFetch(`/api/competitions/${state.activeCompetition.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'active' })
                  });
              }
            } catch (e) {
              console.error('فشل حذف الفائز من قاعدة البيانات:', e);
            }
          } else {
             // Even if not saved in DB, we should unlock the UI locally
             state.reportSent = false;
             state.noWinnersApproved = false;
          }
          
          // IMPORTANT: Remove from staged storage BEFORE rendering, otherwise renderWinners might re-populate it!
          removeStagedWinner(id, state.activeCompetition?.id || null);

          // تحديث الواجهة
          console.log(`[Restore] Re-rendering UI. Entries: ${state.entries.length}, Winners: ${state.winners.length}`);
          renderParticipants();
          renderWinners();
          updateCounts();
          drawWheel();
          saveSession();

          // تحديث حقل الإدخال ليعكس القائمة الحالية (بما في ذلك الفائز المسترجع)
          const ta = document.getElementById('participants-input');
          if (ta) {
              ta.value = state.entries.map(e => e.account ? `${e.name} — ${e.account}` : e.name).join('\n');
          }
          
          toast(`تم استرجاع ${winner.name} إلى الروليت بنجاح`, 'success');
        }
      );
    }
    
    function handleWinnerWarningToggle(ev) {
      const id = ev.currentTarget.getAttribute('data-id');
      const warnType = ev.currentTarget.getAttribute('data-warn');
      const winner = state.winners.find(w => w.id === id);
      if (!winner) return;
      if (warnType === 'meet') winner.includeWarnMeet = !!ev.currentTarget.checked;
      if (warnType === 'prev') winner.includeWarnPrev = !!ev.currentTarget.checked;
      saveSession();
      updateStagedWinner(id, state.activeCompetition?.id || null, {
        includeWarnMeet: winner.includeWarnMeet,
        includeWarnPrev: winner.includeWarnPrev
      });
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
        let prizeText = '';
        if (w.prizeType === 'deposit_prev') {
            prizeText = `${w.prizeValue}% بونص ايداع كونه فائز مسبقا ببونص تداولي`;
        } else if (w.prizeType === 'deposit') {
            prizeText = `${w.prizeValue}% بونص ايداع`;
        } else {
            prizeText = `${w.prizeValue}$ بونص تداولي`;
        }
    
        let msg = `◃ الفائز: ${w.name}\n`;
        msg += `           الجائزة: ${prizeText}\n`;

        if (w.includeWarnMeet) {
            msg += `\n⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً\n`;
        }
        if (w.includeWarnPrev) {
            msg += `\n‼️ فائز سابق ببونص تداولي، تأكد من نشر المسابقة السابقة قبل الاعتماد\n`;
        }

        msg += `\n********************************************************\n`;
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
    
    function handleEditClick(ev) {
      const id = ev.currentTarget.getAttribute('data-edit');
      const winner = state.winners.find(w => w.id === id);
      if (winner) {
        showEditWinnerModal(winner);
      }
    }

    function showEditWinnerModal(winner) {
      const modal = document.getElementById('winner-modal');
      const winnerName = document.getElementById('celebration-winner-name');
      const winnerAccount = document.getElementById('celebration-winner-account');
      const emailInput = document.getElementById('winner-email');
      const prizeTypeInput = document.getElementById('winner-prize-type');
      const prizeValueInput = document.getElementById('winner-prize-value');
      const confirmBtn = document.getElementById('confirm-winner');
      const skipBtn = document.getElementById('skip-winner');
      const idInput = document.getElementById('winner-id-image');
      const idPreview = document.getElementById('winner-id-image-preview');

      if (!modal) return;

      // Populate fields
      winnerName.textContent = `الاسم: ${winner.name}`;
      winnerAccount.textContent = `رقم الحساب: ${winner.account}`;

      // --- NEW: Click to Copy Account Number (Edit Mode) ---
      winnerAccount.style.cursor = 'pointer';
      winnerAccount.title = 'اضغط لنسخ رقم الحساب';
      winnerAccount.onclick = () => {
          if (winner.account) {
              navigator.clipboard.writeText(winner.account).then(() => {
                  toast('تم نسخ رقم الحساب', 'success');
              }).catch(() => {
                  toast('فشل نسخ رقم الحساب', 'error');
              });
          }
      };
      // -----------------------------------------------------

      if (emailInput) emailInput.value = winner.email || '';
      
      // --- Sync Prize Preview Logic ---
      const syncPrizePreview = () => {
          const selectedType = prizeTypeInput?.value || 'trading';
          
          if (selectedType === 'deposit' || selectedType === 'deposit_prev') {
              const depositPct = state.activeCompetition?.depositBonusPercentage || 0;
              const text = selectedType === 'deposit_prev' ? 'بونص إيداع (فائز سابق)' : 'بونص إيداع';
              if (prizeValueInput) {
                  prizeValueInput.value = `${depositPct}% ${text}`;
                  prizeValueInput.style.borderColor = '#10b981';
                  prizeValueInput.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                  prizeValueInput.style.color = '#10b981';
              }
          } else {
              const tradingValue = state.activeCompetition?.prizePerWinner || 0;
              const text = 'بونص تداولي';
              if (prizeValueInput) {
                  prizeValueInput.value = `${tradingValue}$ ${text}`;
                  prizeValueInput.style.borderColor = '#3b82f6';
                  prizeValueInput.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  prizeValueInput.style.color = '#3b82f6';
              }
          }
      };

      // Prize Type
      if (prizeTypeInput) {
          prizeTypeInput.value = winner.prizeType || 'trading';
          prizeTypeInput.addEventListener('change', syncPrizePreview);
      }
      
      // Initial sync (sets default value based on type)
      syncPrizePreview();
      
      // Override with existing value if present (so we don't lose custom values on open)
      if (prizeValueInput && winner.prizeValue !== undefined) {
          const selectedType = prizeTypeInput?.value || 'trading';
          if (selectedType === 'deposit' || selectedType === 'deposit_prev') {
             const text = selectedType === 'deposit_prev' ? 'بونص إيداع (فائز سابق)' : 'بونص إيداع';
             prizeValueInput.value = `${winner.prizeValue}% ${text}`;
          } else {
             const text = 'بونص تداولي';
             prizeValueInput.value = `${winner.prizeValue}$ ${text}`;
          }
      }

      // ID Image Preview
      if (idInput) idInput.value = '';
      if (idPreview) {
           let previewShown = false;
           
           // Try pending image first (if valid)
           if (winner.pendingIdImage) {
               try {
                   if (winner.pendingIdImage instanceof Blob || winner.pendingIdImage instanceof File) {
                       idPreview.src = URL.createObjectURL(winner.pendingIdImage);
                       idPreview.style.display = 'block';
                       previewShown = true;
                   }
               } catch (e) {
                   console.warn('Failed to create object URL for pending image', e);
               }
           }
           
           // Fallback to uploaded image URL
           if (!previewShown && winner.nationalIdImage) {
               idPreview.src = winner.nationalIdImage;
               idPreview.style.display = 'block';
               previewShown = true;
           }
           
           if (!previewShown) {
               idPreview.style.display = 'none';
               idPreview.src = '';
           }
      }

      // Helper to compress image (duplicated for safety)
      const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      let width = img.width;
                      let height = img.height;
                      if (width > maxWidth) {
                          height = (height * maxWidth) / width;
                          width = maxWidth;
                      }
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, width, height);
                      canvas.toBlob((blob) => {
                          if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                          else reject(new Error('Failed to compress'));
                      }, 'image/jpeg', quality);
                  };
                  img.onerror = reject;
                  img.src = e.target.result;
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
          });
      };

      let compressedFile = null;
      let isImageUploading = false;

      const updateIdPreview = async () => {
           if (!idInput || !idInput.files || idInput.files.length === 0) return;
           const file = idInput.files[0];
           try {
               isImageUploading = true;
               toast('جاري ضغط الصورة...', 'info');
               compressedFile = await compressImage(file);
               idPreview.src = URL.createObjectURL(compressedFile);
               idPreview.style.display = 'block';
               isImageUploading = false;
               toast('تم ضغط الصورة بنجاح', 'success');
           } catch (e) {
               console.error(e);
               isImageUploading = false;
           }
      };
      
      const onIdImageChange = () => updateIdPreview();
      if (idInput) idInput.addEventListener('change', onIdImageChange);

      modal.style.display = 'flex';

      const onConfirm = async () => {
          if (isImageUploading) {
              toast('يرجى الانتظار...', 'warning');
              return;
          }

          const email = emailInput?.value?.trim();
          if (!email) {
              toast('البريد الإلكتروني مطلوب', 'error');
              return;
          }
          
          // --- NEW: Email Format Validation ---
          if (!/.+@.+\..+/.test(email)) {
              toast('البريد الإلكتروني غير صالح', 'error');
              return;
          }
          
          // --- NEW: ID Image Validation ---
          // Must have either a new file, an existing pending blob, or an existing URL
          const hasNewFile = !!compressedFile;
          const hasExistingPending = !!(winner.pendingIdImage && (winner.pendingIdImage instanceof Blob || winner.pendingIdImage instanceof File));
          const hasExistingUrl = !!winner.nationalIdImage;
          
          if (!hasNewFile && !hasExistingPending && !hasExistingUrl) {
              toast('يجب رفع صورة الهوية', 'error');
              return;
          }
          // ------------------------------------

          // Update winner object
          winner.email = email;
          winner.prizeType = prizeTypeInput?.value || winner.prizeType;
          
          // Read value from input
          if (prizeValueInput) {
              const match = prizeValueInput.value.match(/(\d+(\.\d+)?)/);
              winner.prizeValue = match ? parseFloat(match[0]) : 0;
          } else {
               // Fallback logic
               if (winner.prizeType === 'deposit' || winner.prizeType === 'deposit_prev') {
                   winner.prizeValue = state.activeCompetition?.depositBonusPercentage || 0;
               } else {
                   winner.prizeValue = state.activeCompetition?.prizePerWinner || 0;
               }
          }

          if (compressedFile) {
              // console.log(`[DEBUG_ID_IMAGE] Edit winner confirmed. ID: ${winner.id}. Saving NEW image to DB...`);
              winner.pendingIdImage = compressedFile;
              winner.idImageUploaded = true;
              winner.localIdImageName = compressedFile.name; // Store filename
              
              // --- NEW: Persist updated image to IndexedDB ---
              saveImageToDB(winner.id, compressedFile)
                // .then(() => console.log(`[DEBUG_ID_IMAGE] Updated image saved successfully for ${winner.id}`))
                .catch(e => console.error(`Failed to update image in DB for ${winner.id}`, e));
          } else {
              // console.log(`[DEBUG_ID_IMAGE] Edit winner confirmed. ID: ${winner.id}. No new image uploaded.`);
          }

          // --- NEW: Update Winner in DB if exists ---
          if (winner._id) {
              try {
                  const authedFetch = window.authedFetch || fetch;
                  const updateResp = await authedFetch(`/api/winners/${winner._id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          email: winner.email,
                          prize_type: winner.prizeType,
                          prize_value: winner.prizeValue
                      })
                  });
                  
                  if (!updateResp.ok) {
                      console.error('Failed to update winner in DB', await updateResp.text());
                      toast('تم التعديل محلياً ولكن فشل التحديث في قاعدة البيانات', 'warning');
                  }
              } catch (e) {
                  console.error('Error updating winner in DB:', e);
                  toast('خطأ في الاتصال بقاعدة البيانات', 'error');
              }
          }
          // ------------------------------------------

          // Update Staged Winner (Persist changes locally)
          saveStagedWinner({
              ...winner,
              localIdImageName: winner.localIdImageName // Ensure filename is saved
          }, state.activeCompetition?.id);

          toast('تم تعديل بيانات الفائز', 'success');
          renderWinners();
          saveSession();
          cleanup();
          modal.style.display = 'none';
      };

      const onSkip = () => {
          cleanup();
          modal.style.display = 'none';
      };

      function cleanup() {
          confirmBtn?.removeEventListener('click', onConfirm);
          skipBtn?.removeEventListener('click', onSkip);
          idInput?.removeEventListener('change', onIdImageChange);
          prizeTypeInput?.removeEventListener('change', syncPrizePreview);
      }

      confirmBtn?.addEventListener('click', onConfirm);
      skipBtn?.addEventListener('click', onSkip);
    }

    function showWinnerModal(entry){
      /* console.log('🎉 [showWinnerModal] Called with entry:', entry);
      console.log('🎉 [showWinnerModal] Entry name:', entry?.name); */

      // --- NEW: Final check before showing modal ---
      const isAlreadyWinner = state.winners.some(w => {
          if (w.account && entry.account) {
              return w.account === entry.account;
          }
          return w.name === entry.name;
      });
      
      if (isAlreadyWinner) {
          toast(`عذراً، المتسابق ${entry.name} موجود بالفعل في قائمة الفائزين!`, 'error');
          // Don't show modal
          return;
      }
      // ---------------------------------------------
      
      const modal = document.getElementById('winner-modal');
      const winnerName = document.getElementById('celebration-winner-name');
      const winnerAccount = document.getElementById('celebration-winner-account');
      const emailInput = document.getElementById('winner-email');
      const prizeTypeEl = document.getElementById('celebration-prize-type');
      const prizeValueEl = document.getElementById('celebration-prize-value');
      const confirmBtn = document.getElementById('confirm-winner');
      const skipBtn = document.getElementById('skip-winner'); // NEW: Skip button
      
      // Reset ID image input and preview to avoid leaking previous winner's image
      const idInput = document.getElementById('winner-id-image');
      const idPreview = document.getElementById('winner-id-image-preview');
      try { if (idInput) idInput.value = ''; } catch(e){}
      if (idPreview) { idPreview.style.display = 'none'; idPreview.src = ''; }
      
      // Initialize variables after using them for cleanup
      let idPreviewUrl = null;
      let compressedFile = null;
      let isImageUploading = false;
      
      /* console.log('🔍 [showWinnerModal] Elements check:');
      console.log('  - modal:', modal ? 'FOUND' : 'MISSING');
      console.log('  - winnerName:', winnerName ? 'FOUND' : 'MISSING');
      console.log('  - emailInput:', emailInput ? 'FOUND' : 'MISSING');
      console.log('  - confirmBtn:', confirmBtn ? 'FOUND' : 'MISSING'); */
      
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
      winnerName.textContent = `الاسم: ${seqPrefix + (entry.name || '—')}`;
      winnerAccount.textContent = `رقم الحساب: ${entry.account || '—'}`;
      
      // --- NEW: Click to Copy Account Number ---
      winnerAccount.style.cursor = 'pointer';
      winnerAccount.title = 'اضغط لنسخ رقم الحساب';
      winnerAccount.onclick = () => {
          if (entry.account) {
              navigator.clipboard.writeText(entry.account).then(() => {
                  toast('تم نسخ رقم الحساب', 'success');
              }).catch(() => {
                  toast('فشل نسخ رقم الحساب', 'error');
              });
          }
      };
      // -----------------------------------------
    
    
      // Auto-determine and display prize info
      const autoPrize = getAutoPrizeInfo(entry.account);
    
      // --- NEW: Update Input Fields + live preview ---
      const prizeTypeInput = document.getElementById('winner-prize-type');
      const prizeValueInput = document.getElementById('winner-prize-value');
      
      const syncPrizePreview = () => {
          const selectedType = prizeTypeInput?.value || autoPrize.prizeType;
          
          if (selectedType === 'deposit' || selectedType === 'deposit_prev') {
              const depositPct = state.activeCompetition?.depositBonusPercentage || 0;
              const text = selectedType === 'deposit_prev' ? 'بونص إيداع (فائز سابق)' : 'بونص إيداع';
              if (prizeValueInput) {
                  prizeValueInput.value = `${depositPct}% ${text}`;
                  prizeValueInput.style.borderColor = '#10b981';
                  prizeValueInput.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                  prizeValueInput.style.color = '#10b981';
              }
          } else {
              const tradingValue = state.activeCompetition?.prizePerWinner || 0;
              const text = 'بونص تداولي';
              if (prizeValueInput) {
                  prizeValueInput.value = `${tradingValue}$ ${text}`;
                  prizeValueInput.style.borderColor = '#3b82f6';
                  prizeValueInput.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  prizeValueInput.style.color = '#3b82f6';
              }
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

      // --- NEW: Clear ID Image Input and Preview ---
      // (Cleared at the top of the function)

      // ---------------------------------------------
      
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
                  // console.log(`📸 [Image Compression] Original: ${(file.size / 1024).toFixed(2)}KB → Compressed: ${(blob.size / 1024).toFixed(2)}KB`);
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
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} }
          idPreviewUrl = null;
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
          isImageUploading = true;
          toast('جاري ضغط الصورة...', 'info');
          compressedFile = await compressImage(file);
          
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} }
          idPreviewUrl = URL.createObjectURL(compressedFile);
          if (idPreviewImg) { idPreviewImg.src = idPreviewUrl; idPreviewImg.style.display = 'block'; }
          isImageUploading = false;
          toast('تم ضغط الصورة بنجاح', 'success');
        } catch (error) {
          console.error('Failed to compress image:', error);
          // Fallback to original file
          if (idPreviewUrl) { try { URL.revokeObjectURL(idPreviewUrl); } catch(e){} }
          idPreviewUrl = URL.createObjectURL(file);
          if (idPreviewImg) { idPreviewImg.src = idPreviewUrl; idPreviewImg.style.display = 'block'; }
          compressedFile = file;
          isImageUploading = false;
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
      
      /* console.log('📺 [showWinnerModal] Modal displayed');
      console.log('🔍 [showWinnerModal] Final modal check:');
      const contentBox = modal.querySelector('.wr-celebration-content');
      if (contentBox) {
        console.log('  - Content box max-height:', contentBox.style.maxHeight || 'NOT SET');
        console.log('  - Content box overflow-y:', contentBox.style.overflowY || 'NOT SET');
        console.log('  - Content box overflow-x:', contentBox.style.overflowX || 'NOT SET');
        console.log('  - Content box scrollbarGutter:', contentBox.style.scrollbarGutter || 'NOT SET');
      } else {
        console.error('❌ [showWinnerModal] Content box NOT FOUND!');
      } */
      
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
        const prizeValueInput = document.getElementById('winner-prize-value');
        let selectedPrizeType = prizeTypeInput?.value || autoPrize.prizeType;
        
        // Get prize value from input if available, else fallback
        let selectedPrizeValue = 0;
        if (prizeValueInput) {
            const match = prizeValueInput.value.match(/(\d+(\.\d+)?)/);
            selectedPrizeValue = match ? parseFloat(match[0]) : 0;
        } else {
            selectedPrizeValue = (selectedPrizeType === 'deposit' || selectedPrizeType === 'deposit_prev')
                ? (state.activeCompetition?.depositBonusPercentage ?? 0)
                : (state.activeCompetition?.prizePerWinner ?? 0);
        }
        
        // Email is REQUIRED: validate existence and format
        const emailErrorEl = document.getElementById('winner-email-error');
        if (!email) {
          emailInput?.classList.add('wr-input-error');
          toast('يجب إدخال البريد الإلكتروني','error');
          setTimeout(()=> emailInput?.classList.remove('wr-input-error'), 2000);
          return;
        }
        if (!/.+@.+\..+/.test(email)) {
          if (emailErrorEl) emailErrorEl.style.display = 'block';
          emailInput?.classList.add('wr-input-error');
          toast('البريد الإلكتروني غير صالح','error');
          setTimeout(()=>{ emailErrorEl && (emailErrorEl.style.display='none'); emailInput?.classList.remove('wr-input-error'); }, 2500);
          return; // Do not close modal
        }
        
        // Check if image is still uploading
        if (isImageUploading) {
          toast('يرجى الانتظار حتى يتم رفع صورة الهوية بالكامل', 'warning');
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

        // Require Video before confirming
        if (!state.pendingVideoBlob) {
          toast('يجب تسجيل فيديو الفوز قبل الاعتماد', 'error');
          return;
        }

        console.log('[Winner Confirm] validation passed', {
          entryId: entry?.id,
          hasVideoBlob: !!state.pendingVideoBlob,
          videoMime: state.recordingMimeType || null,
          hasIdFile: !!(nationalIdImageInput?.files?.length > 0)
        });
        
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
        // --- الحفظ المحلي فقط (لن يتم الحفظ في قاعدة البيانات حتى الضغط على "اعتماد الفائزين") ---
        // حفظ الفيديو والصورة مؤقتاً في الكائن المحلي
        if (state.pendingVideoBlob) {
          winnerData.pendingVideoBlob = state.pendingVideoBlob;
          winnerData.recordingMimeType = state.recordingMimeType;
          
          // --- NEW: Save Video to IndexedDB for Persistence ---
          saveVideoToDB(winnerData.id, state.pendingVideoBlob).catch(e => console.warn('Failed to persist video', e));
          // ----------------------------------------------------

          state.pendingVideoBlob = null; // Clear from state
        }
        
        if (compressedFile) {
          console.log('[Winner Confirm] ID image ready', {
            winnerId: winnerData.id,
            name: compressedFile.name,
            size: compressedFile.size,
            type: compressedFile.type
          });
          winnerData.pendingIdImage = compressedFile;
          winnerData.idImageUploaded = true; // Mark as having image
          // Store filename for reference as requested
          winnerData.localIdImageName = compressedFile.name;
          
          // --- NEW: Save Image to IndexedDB for Persistence ---
          saveImageToDB(winnerData.id, compressedFile)
            .then(() => console.log('[Winner Confirm] Image saved to IndexedDB', { winnerId: winnerData.id }))
            .catch(e => console.error(`Failed to persist image for ${winnerData.id}`, e));
          // ----------------------------------------------------
        } else {
            // console.warn(`[DEBUG_ID_IMAGE] No compressedFile found for new winner ${winnerData.id}`);
        }

        const stagedWinner = {
          id: winnerData.id,
          name: winnerData.name,
          account: winnerData.account,
          email: winnerData.email,
          prizeType: winnerData.prizeType,
          prizeValue: winnerData.prizeValue,
          includeWarnMeet: winnerData.includeWarnMeet,
          includeWarnPrev: winnerData.includeWarnPrev,
          idImageUploaded: !!winnerData.idImageUploaded,
          localIdImageName: winnerData.localIdImageName, // Save filename in staged
          agent: winnerData.agent,
          competitionId: state.activeCompetition?.id || null,
          competitionName: state.activeCompetition?.name || null,
          timestamp: winnerData.timestamp
        };
        addStagedWinner(stagedWinner);

        
        toast('جاري حفظ الفائز في قاعدة البيانات...', 'info');
        // ------------------------------------
    
        const idx = state.entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) state.entries[idx].selected = true;
        if (!state.winners.find(w => w.id === entry.id)) {
          state.winners.push(winnerData);
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

        // NEW: Save immediately to backend (manual "prepare winner")
        try {
          console.log('[Winner Confirm] saving immediately to backend...');
          await saveAllWinnersToDatabase();
          console.log('[Winner Confirm] saved to backend successfully');
          toast('تم حفظ الفائز (الفيديو + الهوية) بنجاح', 'success');
        } catch (e) {
          console.error('[Winner Confirm] save to backend failed', e);
          toast('فشل حفظ الفائز في قاعدة البيانات. يرجى المحاولة مرة أخرى.', 'error');
        }

        updateBatchCount?.();
        
        // تحديث إحصائيات المسابقة في القسم العلوي
        if (state.selectedAgent && state.selectedAgent.id) {
          updateCompetitionStats();
        }
        
        // إظهار شاشة منبثقة عند اكتمال عدد الفائزين
        const currentTotal = state.winners.length;
        if (state.activeCompetition && currentTotal >= state.activeCompetition.totalRequired) {
          const agentLabel = state.selectedAgent ? state.selectedAgent.name : 'هذا الوكيل';
          checkCompletion();
        }
        
        state.spinQueue--;
        if(state.spinQueue>0){ setTimeout(()=> startSpin(), 350); }
        else { state.spinQueue = 0; }
      };

      // --- NEW: Skip Logic ---
      const onSkip = () => {
        onClose();
        // User requested to stop automatic re-spin on skip
      };
      
      function cleanup(){
        confirmBtn?.removeEventListener('click', onConfirm);
        skipBtn?.removeEventListener('click', onSkip);
      }
      
      confirmBtn?.addEventListener('click', onConfirm);
      skipBtn?.addEventListener('click', onSkip);
    }
    
    function showAutoWinnerModal(entry){
      let isImageUploadingAuto = false;
      // --- NEW: Final check before showing modal ---
      const isAlreadyWinner = state.winners.some(w => {
          if (w.account && entry.account) {
              return w.account === entry.account;
          }
          return w.name === entry.name;
      });
      
      if (isAlreadyWinner) {
          toast(`عذراً، المتسابق ${entry.name} موجود بالفعل في قائمة الفائزين!`, 'error');
          return;
      }
      // ---------------------------------------------

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
      winnerName.textContent = `الاسم: ${seqPrefix + (entry.name || '—')}`;
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
                  // console.log(`📸 [Image Compression] Original: ${(file.size / 1024).toFixed(2)}KB → Compressed: ${(blob.size / 1024).toFixed(2)}KB`);
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

      // Add paste/change event handler for ID image (auto mode)
      const nationalIdImageInputAuto = document.getElementById('winner-id-image');
      const idPreviewImgAuto = document.getElementById('winner-id-image-preview');
      let idPreviewUrlAuto = null;
      let compressedFile = null; // Store compressed file
    
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
    
      const updateIdPreviewAuto = async () => {
        if (!nationalIdImageInputAuto || !nationalIdImageInputAuto.files || nationalIdImageInputAuto.files.length === 0) {
          if (idPreviewImgAuto) { idPreviewImgAuto.style.display = 'none'; idPreviewImgAuto.src = ''; }
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} idPreviewUrlAuto = null; }
          compressedFile = null;
          return;
        }
        const file = nationalIdImageInputAuto.files[0];
        if (!file || !file.type || !file.type.startsWith('image/')) {
          if (idPreviewImgAuto) { idPreviewImgAuto.style.display = 'none'; idPreviewImgAuto.src = ''; }
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} idPreviewUrlAuto = null; }
          compressedFile = null;
          return;
        }
        
        try {
          // Compress the image
          isImageUploadingAuto = true;
          toast('جاري ضغط الصورة...', 'info');
          compressedFile = await compressImage(file);
          
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} }
          idPreviewUrlAuto = URL.createObjectURL(compressedFile);
          if (idPreviewImgAuto) { idPreviewImgAuto.src = idPreviewUrlAuto; idPreviewImgAuto.style.display = 'block'; }
          isImageUploadingAuto = false;
          toast('تم ضغط الصورة بنجاح', 'success');
        } catch (error) {
          console.error('Failed to compress image:', error);
          // Fallback to original file
          if (idPreviewUrlAuto) { try { URL.revokeObjectURL(idPreviewUrlAuto); } catch(e){} }
          idPreviewUrlAuto = URL.createObjectURL(file);
          if (idPreviewImgAuto) { idPreviewImgAuto.src = idPreviewUrlAuto; idPreviewImgAuto.style.display = 'block'; }
          compressedFile = file;
          isImageUploadingAuto = false;
          toast('تم رفع الصورة الأصلية', 'warning');
        }
      };
    
      const onIdImageChangeAuto = () => updateIdPreviewAuto();
      nationalIdImageInputAuto?.addEventListener('change', onIdImageChangeAuto);
      idPreviewImgAuto?.addEventListener('click', openLightboxAuto);
      const handlePasteAuto = async (e) => {
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
              if (nationalIdImageInputAuto) {
                nationalIdImageInputAuto.files = dataTransfer.files;
                await updateIdPreviewAuto();
                toast('تم لصق الصورة وضغطها بنجاح', 'success');
              }
            } catch (error) {
              console.error('Failed to compress pasted image:', error);
              // Fallback to original blob
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(blob);
              if (nationalIdImageInputAuto) {
                nationalIdImageInputAuto.files = dataTransfer.files;
                await updateIdPreviewAuto();
                toast('تم لصق الصورة الأصلية', 'warning');
              }
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
          // contentBox.style.overflowY = 'auto'; // REMOVED
          // contentBox.style.overflowX = 'hidden'; // REMOVED
          // contentBox.style.scrollbarGutter = 'stable'; // REMOVED
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
        
        // --- NEW: Email Required Validation ---
        if (!email) {
          emailInput?.classList.add('wr-input-error');
          toast('يجب إدخال البريد الإلكتروني','error');
          setTimeout(()=> emailInput?.classList.remove('wr-input-error'), 2000);
          return;
        }
        // --------------------------------------

        if (email && !/.+@.+\..+/.test(email)) {
          if (emailErrorEl) emailErrorEl.style.display = 'block';
          emailInput?.classList.add('wr-input-error');
          toast('البريد الإلكتروني غير صالح','error');
          setTimeout(()=>{ emailErrorEl && (emailErrorEl.style.display='none'); emailInput?.classList.remove('wr-input-error'); }, 2500);
          return;
        }
        
        // Check if image is still uploading (auto mode)
        if (isImageUploadingAuto) {
          toast('يرجى الانتظار حتى يتم رفع صورة الهوية بالكامل', 'warning');
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

        // Require Video before confirming (Auto Mode)
        if (!state.pendingVideoBlob) {
          toast('يجب تسجيل فيديو الفوز قبل الاعتماد', 'error');
          return;
        }
        
        // Get values from inputs if available
        const selectedPrizeType = prizeTypeInput?.value || autoPrize.prizeType;
        const selectedPrizeValue = (selectedPrizeType === 'deposit' || selectedPrizeType === 'deposit_prev')
            ? (state.activeCompetition?.depositBonusPercentage ?? 0)
            : (state.activeCompetition?.prizePerWinner ?? 0);

        // Create winner object with collected data
        const winnerData = {
          ...entry,
          email: email,
          prizeType: selectedPrizeType,
          prizeValue: selectedPrizeValue,
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
                
                // If we have a pending video, upload it now (Added for Auto Mode)
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
        
        // تحديث إحصائيات المسابقة في القسم العلوي
        if (state.selectedAgent && state.selectedAgent.id) {
          updateCompetitionStats();
        }
        
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
    
    // دالة لحفظ جميع الفائزين في قاعدة البيانات
    async function saveAllWinnersToDatabase() {
      if (!state.selectedAgent || !state.selectedAgent.id) {
        throw new Error('لا يوجد وكيل محدد');
      }
      
      const authedFetch = window.authedFetch || fetch;

      // Winners that are already saved (have _id) but still have pending local media
      // (e.g. previous upload failed, or refresh happened mid-upload).
      const savedWinnersNeedingUpload = state.winners.filter(w => {
        const hasDbId = !!w._id || (typeof w.id === 'string' && w.id.length === 24);
        if (!hasDbId) return false;
        const hasPendingVideo = w.pendingVideoBlob instanceof Blob;
        const hasPendingIdImage = (w.pendingIdImage instanceof Blob || w.pendingIdImage instanceof File);
        const hasPendingIdImageFile = (w.pendingIdImageFile instanceof Blob || w.pendingIdImageFile instanceof File);
        return hasPendingVideo || hasPendingIdImage || hasPendingIdImageFile;
      });
      
      // Filter only unsaved winners (those without a valid MongoDB _id)
      // Assuming MongoDB _id is 24 hex characters. Local IDs are usually shorter or different format.
      // Also check if w._id exists (which we set after saving)
      const unsavedWinners = state.winners.filter(w => !w._id && (!w.id || w.id.length !== 24));
      
      if (unsavedWinners.length === 0 && savedWinnersNeedingUpload.length === 0) {
        console.log('[saveAllWinnersToDatabase] All winners are already saved (and no pending uploads).');
        return;
      }

      let savedWinners = [];

      if (unsavedWinners.length > 0) {
        // تحضير بيانات الفائزين الجدد فقط
        const winnersPayload = unsavedWinners.map(winner => ({
          id: `import_${winner.id}`,
          name: winner.name,
          account_number: winner.account || '',
          email: winner.email || '',
          national_id: winner.nationalId || '',
          prize_type: winner.prizeType || '',
          prize_value: Number(winner.prizeValue) || 0,
          selected_at: winner.timestamp,
          meta: {
            email: winner.email || '',
            national_id: winner.nationalId || '',
            prize_type: winner.prizeType || '',
            prize_value: Number(winner.prizeValue) || 0,
            original_import_id: `import_${winner.id}`
          }
        }));
        
        // حفظ الفائزين الجدد
        const resp = await authedFetch(`/api/agents/${encodeURIComponent(state.selectedAgent.id)}/winners/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winners: winnersPayload })
        });
        
        if (!resp.ok) {
          throw new Error('فشل حفظ الفائزين في قاعدة البيانات');
        }
        
        const data = await resp.json();
        savedWinners = data.winners || [];
      }

      // If we change a winner.id from a local id to a Mongo _id, any locally persisted media
      // (IndexedDB) may still be stored under the old key. Copy it so refresh/restore still works.
      const migrateIndexedDbMediaKey = async (oldId, newId) => {
        if (!oldId || !newId || oldId === newId) return;
        try {
          const existingVideo = await getVideoFromDB(oldId);
          if (existingVideo) {
            await saveVideoToDB(newId, existingVideo);
          }
        } catch (e) {
          console.warn('[saveAllWinnersToDatabase] Failed to migrate video in IndexedDB', { oldId, newId }, e);
        }

        try {
          const existingImage = await getImageFromDB(oldId);
          if (existingImage) {
            await saveImageToDB(newId, existingImage);
          }
        } catch (e) {
          console.warn('[saveAllWinnersToDatabase] Failed to migrate image in IndexedDB', { oldId, newId }, e);
        }
      };
      
      // تحديث معرفات الفائزين المحلية
      for (let i = 0; i < savedWinners.length; i++) {
        const savedWinner = savedWinners[i];
        // Find by original_import_id in meta
        const localWinner = state.winners.find(w => `import_${w.id}` === savedWinner.meta?.original_import_id);
        
        if (localWinner && savedWinner._id) {
          const oldId = localWinner.id;
          localWinner._id = savedWinner._id;
          // Also update the main id to match _id for consistency
          localWinner.id = savedWinner._id;

          // Copy any locally persisted media to the new key so it can be restored after refresh
          await migrateIndexedDbMediaKey(oldId, savedWinner._id);
          
          // --- NEW: Update Staged Winner ID ---
          // We must update the ID in the staged storage so future updates (like toggles) work
          const staged = getStagedWinners();
          const stagedIdx = staged.findIndex(s => s.id === oldId);
          if (stagedIdx !== -1) {
              staged[stagedIdx].id = savedWinner._id;
              try { localStorage.setItem(STAGED_WINNERS_KEY, JSON.stringify(staged)); } catch {}
          }
          // ------------------------------------
          
          // رفع الفيديو إن وجد
          if (localWinner.pendingVideoBlob) {
            try {
              const formData = new FormData();
              const extension = (localWinner.recordingMimeType && localWinner.recordingMimeType.includes('mp4')) ? 'mp4' : 'webm';
              formData.append('video', localWinner.pendingVideoBlob, `winner_${savedWinner._id}.${extension}`);
              
              const videoResp = await authedFetch(`/api/winners/${savedWinner._id}/video`, {
                method: 'POST',
                body: formData
              });

              if (videoResp.ok) {
                delete localWinner.pendingVideoBlob;
                delete localWinner.recordingMimeType;

                // Clean up from IndexedDB only after successful upload
                deleteVideoFromDB(oldId).catch(e => console.warn('Failed to delete video from DB', e));
              } else {
                console.warn('Failed to upload video for winner (will keep local copy)', savedWinner._id, videoResp.status);
              }
            } catch (e) {
              console.warn('Failed to upload video for winner', savedWinner._id, e);
            }
          }

          // رفع صورة الهوية إن وجدت (pendingIdImageFile)
          if (localWinner.pendingIdImageFile && (localWinner.pendingIdImageFile instanceof Blob || localWinner.pendingIdImageFile instanceof File)) {
            try {
              const formData = new FormData();
              formData.append('id_image', localWinner.pendingIdImageFile);
              
              const uploadResp = await authedFetch(`/api/winners/${savedWinner._id}/id-image`, {
                method: 'POST',
                body: formData
              });
              
              if (uploadResp.ok) {
                  const uploadResult = await uploadResp.json();
                  localWinner.nationalIdImage = uploadResult.national_id_image;
                  localWinner.idImageUploaded = true; // Mark as uploaded

                  delete localWinner.pendingIdImageFile;
                  // NOTE: pendingIdImageFile is not stored in IndexedDB by default, so no DB cleanup here
              } else {
                  console.warn('Failed to upload ID image for winner (will keep local copy)', savedWinner._id, uploadResp.status);
              }
            } catch (e) {
              console.warn('Failed to upload ID image for winner', savedWinner._id, e);
            }
          }
          
          // رفع صورة الهوية إن وجدت
          if (localWinner.pendingIdImage && (localWinner.pendingIdImage instanceof Blob || localWinner.pendingIdImage instanceof File)) {
            try {
              const idFormData = new FormData();
              idFormData.append('id_image', localWinner.pendingIdImage);
              
              const idUploadResp = await authedFetch(`/api/winners/${savedWinner._id}/id-image`, {
                method: 'POST',
                body: idFormData
              });

              if (idUploadResp.ok) {
                try {
                  const idUploadResult = await idUploadResp.json();
                  localWinner.nationalIdImage = idUploadResult.national_id_image;
                  localWinner.idImageUploaded = true;
                } catch (e) {}

                // Clear local + IndexedDB only after successful upload
                delete localWinner.pendingIdImage;
                deleteImageFromDB(oldId).catch(e => console.warn('Failed to delete image from DB', e));
              } else {
                console.warn('Failed to upload ID image for winner (will keep local copy)', savedWinner._id, idUploadResp.status);
              }
            } catch (e) {
              console.warn('Failed to upload ID image for winner', savedWinner._id, e);
            }
          }
        }
      }

      // Retry uploads for winners that already exist in DB but still have pending local media
      for (const w of savedWinnersNeedingUpload) {
        const winnerDbId = w._id || w.id;
        if (!winnerDbId) continue;
        const keyId = w.id || winnerDbId;

        // Video
        if (w.pendingVideoBlob instanceof Blob) {
          try {
            const formData = new FormData();
            const extension = (w.recordingMimeType && w.recordingMimeType.includes('mp4')) ? 'mp4' : 'webm';
            formData.append('video', w.pendingVideoBlob, `winner_${winnerDbId}.${extension}`);
            const videoResp = await authedFetch(`/api/winners/${winnerDbId}/video`, { method: 'POST', body: formData });
            if (videoResp.ok) {
              delete w.pendingVideoBlob;
              delete w.recordingMimeType;
              deleteVideoFromDB(keyId).catch(e => console.warn('Failed to delete video from DB', e));
            } else {
              console.warn('Failed to upload video for winner (will keep local copy)', winnerDbId, videoResp.status);
            }
          } catch (e) {
            console.warn('Failed to upload video for winner', winnerDbId, e);
          }
        }

        // ID image (pendingIdImageFile)
        if (w.pendingIdImageFile && (w.pendingIdImageFile instanceof Blob || w.pendingIdImageFile instanceof File)) {
          try {
            const formData = new FormData();
            formData.append('id_image', w.pendingIdImageFile);
            const uploadResp = await authedFetch(`/api/winners/${winnerDbId}/id-image`, { method: 'POST', body: formData });
            if (uploadResp.ok) {
              try {
                const uploadResult = await uploadResp.json();
                w.nationalIdImage = uploadResult.national_id_image;
                w.idImageUploaded = true;
              } catch (e) {}
              delete w.pendingIdImageFile;
            } else {
              console.warn('Failed to upload ID image for winner (will keep local copy)', winnerDbId, uploadResp.status);
            }
          } catch (e) {
            console.warn('Failed to upload ID image for winner', winnerDbId, e);
          }
        }

        // ID image (pendingIdImage stored in IndexedDB)
        if (w.pendingIdImage && (w.pendingIdImage instanceof Blob || w.pendingIdImage instanceof File)) {
          try {
            const idFormData = new FormData();
            idFormData.append('id_image', w.pendingIdImage);
            const idUploadResp = await authedFetch(`/api/winners/${winnerDbId}/id-image`, { method: 'POST', body: idFormData });
            if (idUploadResp.ok) {
              try {
                const idUploadResult = await idUploadResp.json();
                w.nationalIdImage = idUploadResult.national_id_image;
                w.idImageUploaded = true;
              } catch (e) {}
              delete w.pendingIdImage;
              deleteImageFromDB(keyId).catch(e => console.warn('Failed to delete image from DB', e));
            } else {
              console.warn('Failed to upload ID image for winner (will keep local copy)', winnerDbId, idUploadResp.status);
            }
          } catch (e) {
            console.warn('Failed to upload ID image for winner', winnerDbId, e);
          }
        }
      }
      
      saveSession();
      // --- NEW: Re-render winners to update data-id attributes in DOM ---
      renderWinners();
      // ------------------------------------------------------------------
      return savedWinners;
    }

    async function sendWinnersReport() {
      // console.log('[sendWinnersReport] Button clicked');
      if (!state.selectedAgent) {
        console.warn('[sendWinnersReport] No agent selected');
        toast('يرجى اختيار وكيل أولاً', 'warning');
        return;
      }
      if (state.winners.length === 0) {
        console.warn('[sendWinnersReport] No winners in list');
        toast('لا يوجد فائزين لإرسالهم', 'warning');
        return;
      }
      
      // التحقق من وجود فائزين غير محفوظين في قاعدة البيانات، مع الحفظ التلقائي قبل الإرسال
      let unsavedWinners = state.winners.filter(w => !w._id);
      /* console.log('[sendWinnersReport] clicked:', {
        total: state.winners.length,
        unsaved: unsavedWinners.length,
        agentId: state.selectedAgent && state.selectedAgent.id
      }); */

      if (unsavedWinners.length > 0) {
        try {
          // console.log('[sendWinnersReport] auto-saving unsaved winners before send...', unsavedWinners);
          toast('جاري حفظ الفائزين تلقائياً قبل الإرسال...', 'info');
          await saveAllWinnersToDatabase();
          // console.log('[sendWinnersReport] auto-save completed successfully');
        } catch (error) {
          console.error('[sendWinnersReport] auto-save failed:', error);
          toast('فشل الحفظ التلقائي للفائزين. يرجى المحاولة مرة أخرى.', 'error');
          return;
        }
      }

      // Filter winners that have _id (saved to DB) بعد الحفظ التلقائي
      const validWinners = state.winners.filter(w => w._id);
      // console.log('[sendWinnersReport] Valid winners count:', validWinners.length);
      
      if (validWinners.length === 0) {
          console.error('[sendWinnersReport] No valid winners with DB IDs');
          toast('لم يتم العثور على معرفات الفائزين في قاعدة البيانات. تأكد من حفظ الفائزين.', 'error');
          console.error('[sendWinnersReport] no winners with _id after filtering');
          return;
      }
    
      const messageText = generateWinnersMessage();
      
        // Directly send without confirmation modal
          // Confirm before sending all winners to agent
          showConfirmModal(
          `سيتم إرسال جميع الفائزين (${validWinners.length}) إلى الوكيل. هل أنت متأكد من المتابعة؟`,
          async () => {
              // console.log('[sendWinnersReport] User confirmed send');
              const sendingOverlay = document.createElement('div');
              sendingOverlay.className = 'wr-confirm-overlay';
              sendingOverlay.innerHTML = `
                <div class="wr-confirm-modal" style="text-align: center;">
                  <div class="wr-confirm-icon" style="color: #10b981;"><i class="fas fa-spinner fa-spin"></i></div>
                  <h3 class="wr-confirm-title">جاري الإرسال...</h3>
                  <p class="wr-confirm-message">يرجى الانتظار حتى يكتمل الإرسال بنجاح.</p>
                </div>
              `;
              document.body.appendChild(sendingOverlay);

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
                  
                  // console.log('[sendWinnersReport] Response status:', resp.status);

                    if (resp.ok) {
                      const result = await resp.json();
                      // console.log('[sendWinnersReport] Success response:', result);
                      toast('تم إرسال التقرير بنجاح', 'success');
                      // Mark report as sent to allow completion status
                      state.reportSent = true;
                      
                      // Do NOT clear winners or redirect, as per user request
                      // state.winners = [];
                      // renderWinners();
                      // updateCounts();
                      
                      saveSession();
                      
                      // Redirect removed
                      // setTimeout(() => {
                      //    window.location.href = `/pages/agent-competitions.html?agent_id=${state.selectedAgent.id}`;
                      // }, 1500);
                  } else {
                      const err = await resp.json();
                      console.error('[sendWinnersReport] Error response:', err);
                      toast(`فشل الإرسال: ${err.message}`, 'error');
                  }
              } catch (e) {
                  console.error(e);
                  toast('حدث خطأ أثناء الإرسال', 'error');
              } finally {
                  sendingOverlay.remove();
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
      
      // التحقق من وجود فائزين غير محفوظين
      const unsavedWinners = state.winners.filter(w => !w._id);
      /* console.log('[sendWinnersDetails] clicked: current winners:', {
        total: state.winners.length,
        unsaved: unsavedWinners.length,
        agentId: state.selectedAgent && state.selectedAgent.id
      }); */
      if (unsavedWinners.length > 0) {
        try {
            // console.log('[sendWinnersDetails] auto-saving unsaved winners before send...', unsavedWinners);
            toast('جاري حفظ الفائزين تلقائياً قبل الإرسال...', 'info');
            await saveAllWinnersToDatabase();
            // console.log('[sendWinnersDetails] auto-save completed successfully');
        } catch (error) {
            console.error('[sendWinnersDetails] auto-save failed:', error);
            toast('فشل الحفظ التلقائي للفائزين. يرجى المحاولة مرة أخرى.', 'error');
            return;
        }
      }
      
      const validWinners = state.winners.filter(w => w._id);
      // console.log('[sendWinnersDetails] valid winners after save:', validWinners.map(w => w._id));
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
                // Merge global state with winner state: if global is ON, it applies to all.
                // If global is OFF, individual winner setting is preserved.
                include_warn_meet: !!(w.includeWarnMeet || state.includeWarnMeet),
                include_warn_prev: !!(w.includeWarnPrev || state.includeWarnPrev)
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
              // state.reportSent = true; // Removed to allow manual approval
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
      
      // التحقق من وجود فائزين غير محفوظين
      const unsavedWinners = state.winners.filter(w => !w._id);
      /* console.log('[sendWinnersWithIDsToAgent] clicked: current winners:', {
        total: state.winners.length,
        unsaved: unsavedWinners.length,
        agentId: state.selectedAgent && state.selectedAgent.id
      }); */
      if (unsavedWinners.length > 0) {
        try {
            // console.log('[sendWinnersWithIDsToAgent] auto-saving unsaved winners before send...', unsavedWinners);
            toast('جاري حفظ الفائزين تلقائياً قبل الإرسال...', 'info');
            await saveAllWinnersToDatabase();
            // console.log('[sendWinnersWithIDsToAgent] auto-save completed successfully');
        } catch (error) {
            console.error('[sendWinnersWithIDsToAgent] auto-save failed:', error);
            toast('فشل الحفظ التلقائي للفائزين. يرجى المحاولة مرة أخرى.', 'error');
            return;
        }
      }
      
      const validWinners = state.winners.filter(w => w._id);
      // console.log('[sendWinnersWithIDsToAgent] valid winners after save:', validWinners.map(w => w._id));
      if (validWinners.length === 0) {
        toast('لم يتم العثور على معرفات الفائزين في قاعدة البيانات. تأكد من حفظ الفائزين.', 'error');
        return;
      }

      // Precheck: ensure each winner has ID image uploaded
      const missingIdImages = validWinners.filter(w => !w.idImageUploaded);
      // console.log('[sendWinnersWithIDsToAgent] winners missing ID image:', missingIdImages.map(w => w._id));
      if (missingIdImages.length > 0) {
        toast(`يوجد ${missingIdImages.length} فائز بدون صورة هوية مرفوعة. يرجى رفع الصورة من نافذة اعتماد الفائز قبل الإرسال.`, 'warning');
        return;
      }
    
      showConfirmModal(
        `سيتم إرسال بيانات الفائزين (${validWinners.length}) مع صور الهوية والكليشة إلى جروب الشركة (Agent competitions). هل أنت متأكد؟`,
        async () => {
          const sendingOverlay = document.createElement('div');
          sendingOverlay.className = 'wr-confirm-overlay';
          sendingOverlay.innerHTML = `
            <div class="wr-confirm-modal" style="text-align: center;">
              <div class="wr-confirm-icon" style="color: #10b981;"><i class="fas fa-spinner fa-spin"></i></div>
              <h3 class="wr-confirm-title">جاري الإرسال...</h3>
              <p class="wr-confirm-message">يرجى الانتظار حتى يكتمل الإرسال بنجاح.</p>
            </div>
          `;
          document.body.appendChild(sendingOverlay);
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
                override_chat_id: 'COMPANY_GROUP'
              })
            });
            if (resp.ok) {
              toast('تم إرسال بيانات الفائزين إلى جروب الشركة بنجاح', 'success');
              // state.reportSent = true; // Removed to allow manual approval
            } else {
              const err = await resp.json();
              toast(`فشل الإرسال: ${err.message}`, 'error');
            }
          } catch (e) {
            console.error(e);
            toast('حدث خطأ أثناء الإرسال', 'error');
          } finally {
            sendingOverlay.remove();
          }
        }
      );
    }
    
    function generateWinnersMessage() {
        const ordinals = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
        
        let msg = '';
        state.winners.forEach((w, i) => {
            const rank = ordinals[i] || (i + 1);
            let prizeText = '';
            
            if (w.prizeType === 'deposit_prev') {
                prizeText = `${w.prizeValue}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
            } else if (w.prizeType === 'deposit') {
                prizeText = `${w.prizeValue}% بونص إيداع`;
            } else {
                prizeText = `${w.prizeValue}$ بونص تداولي`;
            }
    
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
    











