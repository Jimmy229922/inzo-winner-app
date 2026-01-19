const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const Competition = require('../models/Competition');
const Agent = require('../models/agent.model');
const CompetitionTemplate = require('../models/CompetitionTemplate'); // NEW: Import the template model
const Winner = require('../models/Winner');
const QuestionSuggestion = require('../models/QuestionSuggestion');
const { logActivity } = require('../utils/logActivity');
const { broadcastNotification, broadcastEvent } = require('../utils/notification');

/**
 * Creates a hash from the string for duplicate detection.
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Calculates the UTC end date for a competition based on local timezone logic.
 * @param {string} duration - The duration string (e.g., '1d', '2d', '1w').
 * @param {number} tzOffsetHours - The timezone offset in hours (e.g., 3 for Egypt).
 * @returns {string|null} The ISO string of the calculated end date in UTC, or null.
 */
function calculateEndsAtUTC(duration, tzOffsetHours = 3) {
    // NEW: Handle short, real-time durations for testing/special cases
    if (duration === '10s') {
        const endsAt = new Date(Date.now() + 10000); // 10 seconds from now
        return endsAt.toISOString();
    }

    const msDay = 86400000;

    // FIX: Correctly get the start of the current local day.
    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0);
    const localDayStartMs = localToday.getTime();

    // --- FIX: Map frontend duration values to backend-expected values ---
    const durationMapping = {
        '1d': '24h',
        '2d': '48h',
        '1w': '168h'
    };
    const backendDuration = durationMapping[duration] || duration;
    const durationMap = { '24h': 1, '48h': 2, '168h': 7 };
    const durationDays = durationMap[backendDuration];
    if (durationDays === undefined) return null;

    // The competition ends at the start of the day *after* the duration ends.
    // The winner selection date is the day *after* the competition's actual end date.
    // So, winner_selection_date = creation_date + duration_days + 1.
    const winnerLocalStartMs = localDayStartMs + (durationDays + 1) * msDay; // This logic is correct

    const winnerUtcMs = winnerLocalStartMs; // The timestamp is already correct relative to UTC
    return new Date(winnerUtcMs).toISOString();
}

exports.getAllCompetitions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, classification, sort, excludeStatus, agentId } = req.query;

        let query = {};

        if (agentId) {
            query.agent_id = agentId;
        }

        if (search) {
            const agents = await Agent.find({ name: { $regex: search, $options: 'i' } }).select('_id');
            const agentIds = agents.map(a => a._id);
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { agent_id: { $in: agentIds } }
            ];
        }

        // --- REFACTOR: Integrate classification filter into the main query for efficiency and correctness ---
        if (classification && classification !== 'all') {
            // Find agents with the specified classification first
            const classifiedAgents = await Agent.find({ classification: classification }).select('_id');
            const classifiedAgentIds = classifiedAgents.map(a => a._id);
            // Add this condition to the main query
            query.agent_id = { $in: classifiedAgentIds };
        }

        if (status && status !== 'all') {
            query.is_active = status === 'active';
        }

        if (excludeStatus) {
            query.status = { $ne: excludeStatus };
        }

        let sortOptions = { createdAt: -1 };
        if (sort === 'name_asc') sortOptions = { name: 1 };

        const competitions = await Competition.find(query)
            .populate('agent_id', 'name avatar_url classification')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Rename agent_id to agents and handle deleted agents
        const formattedCompetitions = competitions.map(comp => {
            const { agent_id, ...rest } = comp;
            return {
                ...rest,
                agents: agent_id || {
                    name: 'وكيل محذوف',
                    classification: 'غير متاح',
                    avatar_url: null
                },
                id: comp._id
            };
        });

        const count = await Competition.countDocuments(query);

        res.json({
            data: formattedCompetitions,
            count: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching competitions.', error: error.message });
    }
};

/**
 * Returns the latest active competition for a specific agent.
 */
exports.getAgentActiveCompetition = async (req, res) => {
    const { agentId } = req.params;

    try {
        const competition = await Competition.findOne({ agent_id: agentId, is_active: true })
            .sort({ createdAt: -1 })
            .populate('agent_id', 'name avatar_url classification deposit_bonus_percentage')
            .populate('template_id')
            .lean();

        if (!competition) {
            return res.status(404).json({ message: 'No active competition found for this agent.' });
        }

        const currentWinnersCount = await Winner.countDocuments({ competition_id: competition._id });

        // Prefer competition-specific deposit bonus percentage; fallback to agent's configured percentage
        const effectiveDepositBonusPct = (competition.deposit_bonus_percentage && Number(competition.deposit_bonus_percentage) > 0)
            ? Number(competition.deposit_bonus_percentage)
            : Number(competition.agent_id?.deposit_bonus_percentage || 0);

        const formattedCompetition = {
            ...competition,
            template: competition.template_id,
            trading_winners_count: competition.trading_winners_count || 0,
            deposit_winners_count: competition.deposit_winners_count || 0,
            current_winners_count: currentWinnersCount,
            deposit_bonus_percentage: effectiveDepositBonusPct,
            required_winners: competition.required_winners || 3
        };
        delete formattedCompetition.template_id;

        res.json({ competition: formattedCompetition });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching active competition.', error: error.message });
    }
};

/**
 * Returns a competition by its ID with related metadata.
 */
exports.getCompetitionById = async (req, res) => {
    try {
        const competition = await Competition.findById(req.params.id)
            .populate('agent_id', 'name avatar_url classification')
            .populate('template_id')
            .lean();

        if (!competition) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        const currentWinnersCount = await Winner.countDocuments({ competition_id: competition._id });

        const formattedCompetition = {
            ...competition,
            template: competition.template_id,
            trading_winners_count: competition.trading_winners_count || 0,
            deposit_winners_count: competition.deposit_winners_count || 0,
            current_winners_count: currentWinnersCount
        };
        formattedCompetition.required_winners = competition.required_winners || 3;
        delete formattedCompetition.template_id;

        res.json({ competition: formattedCompetition });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching competition details.', error: error.message });
    }
};

exports.createCompetition = async (req, res) => {
    // console.log(`[BACKEND] Received POST /api/competitions at ${new Date().toISOString()}`);
    try {
        const { agent_id, template_id, image_url, description } = req.body;

        // --- PRE-SEND TELEGRAM GROUP VALIDATION ---
        // ... (existing code)

        // 2. Balance Check
        const totalCost = Number(req.body.total_cost) || 0;
        const depositWinners = Number(req.body.deposit_winners_count) || 0;

        // --- FIX: Fetch agent before checking balance ---
        const agent = await Agent.findById(agent_id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        if ((agent.remaining_balance || 0) < totalCost) {
            return res.status(400).json({ message: 'رصيد الوكيل غير كافٍ لإرسال المسابقة.' });
        }
        if ((agent.remaining_deposit_bonus || 0) < depositWinners) {
            return res.status(400).json({ message: 'عدد مرات بونص الإيداع غير كافٍ.' });
        }

        // 3. Duplicate Checks
        // Normalize idempotency key if provided by client
        const clientRequestId = req.body.client_request_id || req.body.clientRequestId;
        // console.log(`[BACKEND] Using client_request_id: ${clientRequestId}`);

        if (clientRequestId && agent_id) {
            req.body.client_request_id = clientRequestId;
            const existingByKey = await Competition.findOne({ agent_id, client_request_id: clientRequestId });
            // console.log(`[BACKEND] Idempotency check (existingByKey): ${existingByKey ? existingByKey._id : 'null'}`);
            if (existingByKey) {
                return res.status(409).json({
                    data: existingByKey,
                    duplicate: true,
                    message: 'Competition already created for this request (idempotent replay).'
                });
            }
        }

        // Check if this template has EVER been sent to this agent
        /* 
        // DISABLED: Allow sending the same template multiple times as per user request
        if (agent_id && template_id) {
            const existingCompetition = await Competition.findOne({
                agent_id,
                template_id
            });
            console.log(`[BACKEND] Time-based duplicate check (existingCompetition): ${existingCompetition ? existingCompetition._id : 'null'}`);
            if (existingCompetition) {
                return res.status(409).json({
                    message: 'عذراً، تم إرسال هذه المسابقة لهذا الوكيل من قبل.',
                    error: 'Duplicate competition entry.',
                    duplicateId: existingCompetition._id
                });
            }
        }
        */

        // 4. Telegram Group Validation & Sending
        const botInstance = req.app.locals.telegramBot;

        if (agent.telegram_chat_id && botInstance) {
            // A. Validate Group Name
            try {
                const chatInfo = await botInstance.getChat(agent.telegram_chat_id);
                const realTitle = chatInfo?.title || '';
                const storedTitle = agent.telegram_group_name || '';
                
                if (storedTitle && realTitle && storedTitle.trim() !== realTitle.trim()) {
                    return res.status(409).json({
                        message: 'فشل التحقق من اسم مجموعة التليجرام. الاسم المسجل لا يطابق الاسم الحالي للمجموعة.',
                        error: 'Telegram group name mismatch',
                        stored_group_name: storedTitle,
                        actual_group_name: realTitle
                    });
                }
            } catch (tgErr) {
                return res.status(400).json({
                    message: 'تعذر الوصول إلى مجموعة التليجرام للتحقق.',
                    error: tgErr.message
                });
            }

            // B. Prepare Image
            let imageBuffer = null;
            let filename = 'competition.jpg';
            let contentType = 'image/jpeg';

            if (image_url) {
                try {
                    const normalizedPath = image_url.replace(/^\/+/, '');
                    let imagePath;
                    if (image_url.startsWith('/images/')) {
                        imagePath = path.join(__dirname, '..', '..', '..', 'frontend', normalizedPath);
                    } else {
                        imagePath = path.join(__dirname, '..', '..', normalizedPath);
                    }
                    
                    imageBuffer = await fs.readFile(imagePath);
                    const ext = path.extname(imagePath).toLowerCase();
                    if (ext === '.png') contentType = 'image/png';
                    else if (ext === '.gif') contentType = 'image/gif';
                    filename = path.basename(imagePath);
                } catch (err) {
                    console.error('Image read error:', err);
                    return res.status(400).json({ 
                        message: 'فشل قراءة صورة المسابقة. لا يمكن إرسال المسابقة بدون صورة.',
                        error: err.message 
                    });
                }
            } else {
                return res.status(400).json({ message: 'صورة المسابقة مطلوبة.' });
            }

            // C. Send to Telegram
            try {
                const caption = description || '';
                
                // console.log(`[Competition] Attempting to send competition to Telegram group: ${agent.telegram_group_name} (ID: ${agent.telegram_chat_id})`);

                // --- NEW: Register this message in the shared cache to prevent double-sending by telegram.controller.js ---
                if (req.app.locals.recentMessages) {
                    const msgHash = simpleHash(caption);
                    const dedupKey = `${agent.telegram_chat_id}-${msgHash}`;
                    // Set TTL to 10 seconds
                    req.app.locals.recentMessages.set(dedupKey, Date.now() + 10000);
                    // console.log(`[Competition] Registered deduplication key: ${dedupKey}`);
                }

                if (caption.length <= 1024) {
                    // Case 1: Text is short enough for one message
                    await botInstance.sendPhoto(
                        agent.telegram_chat_id,
                        imageBuffer,
                        { caption: caption, parse_mode: 'HTML' },
                        { filename: filename, contentType: contentType }
                    );
                } else {
                    // Case 2: Text is too long (> 1024 chars)
                    // Strategy: Send Photo first (with title), then Reply with the full text
                    console.log(`[Competition] Text length (${caption.length}) exceeds 1024 limit. Switching to Split Mode (Photo + Reply Text).`);
                    
                    // 1. Send Photo (with title only)
                    const photoMsg = await botInstance.sendPhoto(
                        agent.telegram_chat_id,
                        imageBuffer,
                        { caption: `<b>مسابقة جديدة</b>`, parse_mode: 'HTML' },
                        { filename: filename, contentType: contentType }
                    );

                    // 2. Send Full Text as a Reply to the Photo
                    if (photoMsg && photoMsg.message_id) {
                        await botInstance.sendMessage(
                            agent.telegram_chat_id,
                            caption,
                            { 
                                parse_mode: 'HTML', 
                                reply_to_message_id: photoMsg.message_id 
                            }
                        );
                    }
                }

                // console.log(`[Competition] Successfully sent competition to Telegram group: ${agent.telegram_group_name}`);

            } catch (sendErr) {
                console.error(`[Competition] Failed to send competition to Telegram group: ${agent.telegram_group_name}. Error: ${sendErr.message}`);
                return res.status(500).json({ 
                    message: 'فشل إرسال المسابقة إلى التليجرام.',
                    error: sendErr.message 
                });
            }
        } else {
             if (!agent.telegram_chat_id) {
                 return res.status(400).json({ message: 'الوكيل ليس لديه معرف مجموعة تليجرام.' });
             }
             if (!botInstance) {
                 return res.status(503).json({ message: 'خدمة التليجرام غير متوفرة حالياً.' });
             }
        }

        // 5. Deduct Balance (Only reached if Telegram send succeeded)
        // MOVED TO STEP 6 to consolidate updates

        // 6. Save Competition
        const competitionData = req.body;
        
        // Calculate ends_at on the backend for consistency and accuracy.
        const endsAtUTC = calculateEndsAtUTC(competitionData.duration);
        if (!endsAtUTC) {
            return res.status(400).json({ message: 'Invalid competition duration provided.' });
        }
        competitionData.ends_at = endsAtUTC;

        // Stamp server-side idempotency key when missing (helps future duplicate detection)
        if (!competitionData.client_request_id) {
            competitionData.client_request_id = new mongoose.Types.ObjectId().toString();
        }

        // Ensure deposit_bonus_percentage is saved from agent if missing
        if (!competitionData.deposit_bonus_percentage || competitionData.deposit_bonus_percentage === 0) {
            if (agent && agent.deposit_bonus_percentage) {
                competitionData.deposit_bonus_percentage = agent.deposit_bonus_percentage;
            }
        }

        const competition = new Competition(competitionData);
        // console.log(`[BACKEND] Attempting to save new competition with client_request_id: ${competition.client_request_id}`);
        await competition.save();
        // console.log(`[BACKEND] Successfully saved new competition with ID: ${competition._id}`);

        // --- NEW: Update Agent Balance and Deposit Bonus ---
        // This logic was moved from the frontend to ensure reliability and security.
        // Agent is already fetched at the top
        if (agent) {
            const cost = Number(competitionData.total_cost) || 0;
            const depositWinners = Number(competitionData.deposit_winners_count) || 0;

            // Update financial fields
            agent.remaining_balance = (agent.remaining_balance || 0) - cost;
            agent.consumed_balance = (agent.consumed_balance || 0) + cost;
            
            agent.remaining_deposit_bonus = (agent.remaining_deposit_bonus || 0) - depositWinners;
            agent.used_deposit_bonus = (agent.used_deposit_bonus || 0) + depositWinners;

            await agent.save();
            // console.log(`[BACKEND] Updated agent balance for agent: ${agent._id}. Cost: ${cost}, Deposit Winners: ${depositWinners}`);

            // --- NEW: Broadcast Notification ---
            broadcastNotification(
                req.app,
                `تم إنشاء مسابقة جديدة بواسطة ${agent.name}`,
                'success'
            );

            // --- NEW: Broadcast Event for Real-time UI Update ---
            broadcastEvent('COMPETITION_CREATED', {
                agentId: agent._id,
                agentName: agent.name,
                competitionId: competition._id,
                competitionName: competition.name,
                endsAt: competition.ends_at,
                createdBy: req.user ? req.user.full_name : 'System'
            });
        }

        // console.log(`[Competition] Competition created and saved successfully. ID: ${competition._id}`);

        // Save competition questions as suggestions
        if (competition.questions && competition.questions.length > 0) {
            try {
                const userId = req.user._id;
                const userName = req.user.full_name;
                
                const questionSuggestions = competition.questions.map(q => ({
                    suggested_by: userId,
                    suggested_by_name: userName,
                    question: q.question,
                    correct_answer: q.correct_answer,
                    category: 'general', // Default category
                    difficulty: 'medium', // Default difficulty
                    status: 'approved', // Auto-approve questions from competitions
                    used_in_competition: true,
                    competition_id: competition._id,
                    evaluation: {
                        reviewed_by: userId,
                        reviewed_by_name: userName,
                        reviewed_at: new Date(),
                        rating: 5,
                        feedback: 'تم إنشاؤه من مسابقة',
                        admin_notes: `تم الإنشاء تلقائياً من مسابقة: ${competition.name || 'غير محدد'}`
                    }
                }));
                
                await QuestionSuggestion.insertMany(questionSuggestions);
            } catch (suggestionError) {
                console.error('Error saving questions as suggestions:', suggestionError);
                // Don't fail the whole request if question saving fails
            }
        }

        // Increment template usage count and archive if limit is reached
        if (req.body.template_id) {
            const template = await CompetitionTemplate.findById(req.body.template_id);
            if (template) {
                template.usage_count = (template.usage_count || 0) + 1;

                // Archive if usage limit is met or exceeded
                if (template.usage_limit !== null && template.usage_count >= template.usage_limit) {
                    template.is_archived = true;
                }

                await template.save();
            }
        }
        res.status(201).json({ data: competition });
    } catch (error) {
        console.error('[BACKEND] CREATE COMPETITION FAILED:', error);
        if (error.code === 11000) {
            console.error('[BACKEND] Duplicate key error (E11000). This indicates the unique index on (agent_id, client_request_id) correctly prevented a duplicate write.');
            return res.status(409).json({ message: 'Duplicate competition detected by database.', error: 'E11000_DUPLICATE_KEY' });
        }
        res.status(400).json({ message: 'Failed to create competition.', error: error.message });
    }
};

exports.updateCompetition = async (req, res) => {
    try {
        const competitionBeforeUpdate = await Competition.findById(req.params.id).lean();
        if (!competitionBeforeUpdate) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        const updatedCompetition = await Competition.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // --- FIX: Add activity logging for competition updates ---
        const userId = req.user?._id;
        if (userId && updatedCompetition) {
            const changes = Object.entries(req.body).map(([field, newValue]) => {
                const oldValue = competitionBeforeUpdate[field];
                if (String(oldValue) !== String(newValue)) {
                    return `حقل "${field}" تغير من "${oldValue}" إلى "${newValue}"`;
                }
                return null;
            }).filter(Boolean);

            if (changes.length > 0) {
                const description = `تم تحديث مسابقة "${updatedCompetition.name}":\n${changes.join('\n')}`;
                await logActivity(userId, updatedCompetition.agent_id, 'COMPETITION_UPDATE', description);
            }
        }

        res.json({ data: updatedCompetition });
    } catch (error) {
        res.status(400).json({ message: 'Failed to update competition.', error: error.message });
    }
};

exports.deleteCompetition = async (req, res) => {
    try {
        const competition = await Competition.findByIdAndDelete(req.params.id);
        // --- FIX: Log this action ---
        const userId = req.user?._id;
        if (userId && competition) {
            await logActivity(userId, competition.agent_id, 'COMPETITION_DELETED', `تم حذف المسابقة: ${competition.name}.`);
        }
        if (!competition) return res.status(404).json({ message: 'Competition not found.' });
        res.json({ message: 'Competition deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete competition.', error: error.message });
    }
};

exports.bulkUpdateCompetitions = async (req, res) => {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || !data) {
        return res.status(400).json({ message: 'Invalid request body for bulk update.' });
    }
    try {
        await Competition.updateMany({ _id: { $in: ids } }, { $set: data });
        res.json({ message: 'Competitions updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to bulk update competitions.', error: error.message });
    }
};

exports.bulkDeleteCompetitions = async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ message: 'Invalid request body for bulk delete.' });
    }
    try {
        await Competition.deleteMany({ _id: { $in: ids } });
        res.json({ message: 'Competitions deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to bulk delete competitions.', error: error.message });
    }
};

/**
 * NEW: Checks if a competition for a specific agent and template already exists.
 */
exports.checkCompetitionExistence = async (req, res) => {
    const { agent_id, template_id } = req.query;

    if (!agent_id || !template_id) {
        return res.status(400).json({ message: 'Agent ID and Template ID are required.' });
    }

    try {
        const existingCompetition = await Competition.findOne({ agent_id, template_id });
        res.json({ exists: !!existingCompetition });
    } catch (error) {
        res.status(500).json({
            message: 'Server error while checking for competition existence.',
            error: error.message
        });
    }
};

/**
 * NEW: Uploads an image for a competition.
 */
exports.uploadImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const imageUrl = `/uploads/competitions/${req.file.filename}`;
        res.status(200).json({ imageUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error while handling image upload.', error: error.message });
    }
};

/**
 * NEW: Completes a competition (approves winners or no winners).
 */
exports.completeCompetition = async (req, res) => {
    const { id } = req.params;
    const { winners, noWinners, isRestoreMode } = req.body;
    const userId = req.user?._id;
    const userName = req.user?.full_name || req.user?.username || 'مستخدم';

    try {
        const competition = await Competition.findById(id).populate('agent_id');
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        // في وضع الاستعادة، نسمح بالحفظ حتى لو المسابقة مكتملة
        if (competition.status === 'completed' && !isRestoreMode) {
            return res.status(400).json({ message: 'Competition is already completed.' });
        }

        // === حفظ نسخة كاملة من البيانات (Snapshot) للاسترجاع المستقبلي ===
        let completionSnapshot = null;
        
        // جلب الفائزين من قاعدة البيانات
        const winnersFromDB = await Winner.find({ competition_id: id });
        
        // جلب بيانات الوكيل إذا لم تكن محملة
        let agentData = competition.agent_id;
        if (!agentData || typeof agentData === 'string' || agentData instanceof mongoose.Types.ObjectId) {
            agentData = await Agent.findById(competition.agent_id);
        }
        
        if (agentData) {
            completionSnapshot = {
                agent: {
                    _id: agentData._id,
                    name: agentData.name,
                    agent_id: agentData.agent_id,
                    chat_id: agentData.telegram_chat_id,
                    avatar_url: agentData.avatar_url
                },
                winners: winnersFromDB.map(w => ({
                    _id: w._id,
                    name: w.name,
                    account_number: w.account_number,
                    email: w.email,
                    national_id: w.national_id,
                    national_id_image: w.national_id_image,
                    prize_type: w.prize_type,
                    prize_value: w.prize_value,
                    video_url: w.video_url,
                    order_number: w.order_number
                })),
                snapshot_at: new Date(),
                total_prize_value: winnersFromDB.reduce((sum, w) => sum + (w.prize_value || 0), 0),
                completed_by: userId,
                completed_by_name: userName
            };
        }

        // Use updateOne to avoid validation errors on legacy documents that might be missing new required fields
        const updateData = { 
            status: 'completed', 
            is_active: false 
        };
        
        // إضافة الـ snapshot فقط إذا لم يكن موجوداً أو في وضع غير الاستعادة
        if (completionSnapshot && !isRestoreMode) {
            updateData.completion_snapshot = completionSnapshot;
        }
        
        await Competition.updateOne(
            { _id: id }, 
            { $set: updateData }
        );
        
        // Update local object for logging/response (optional but good for consistency)
        competition.status = 'completed';
        competition.is_active = false;

        let logDescription = isRestoreMode 
            ? `تم حفظ تعديلات المسابقة المسترجعة "${competition.name}".`
            : `تم اعتماد المسابقة "${competition.name}" وإغلاقها.`;
        if (noWinners) {
            logDescription += ' (بدون فائزين)';
        } else if (winners && winners.length > 0) {
            logDescription += ` (عدد الفائزين: ${winners.length})`;
        }

        if (userId) {
            const activityType = isRestoreMode ? 'COMPETITION_RESTORED_UPDATED' : 'COMPETITION_COMPLETED';
            await logActivity(userId, competition.agent_id._id || competition.agent_id, activityType, logDescription);
        }

        // --- NEW: Broadcast Event for Real-time UI Update ---
        broadcastEvent('COMPETITION_COMPLETED', {
            agentId: competition.agent_id._id || competition.agent_id,
            competitionId: competition._id,
            competitionName: competition.name,
            completedBy: userName,
            isRestoreMode: !!isRestoreMode
        });

        res.json({ 
            message: isRestoreMode ? 'Changes saved successfully.' : 'Competition completed successfully.', 
            competition,
            snapshotSaved: !!completionSnapshot && !isRestoreMode
        });
    } catch (error) {
        console.error('[Complete Competition Error]:', error);
        res.status(500).json({ message: 'Failed to complete competition.', error: error.toString() });
    }
};

/**
 * تسجيل استرجاع المسابقة
 */
exports.restoreCompetition = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?._id;
    const userName = req.user?.full_name || req.user?.username || 'مستخدم';

    try {
        const competition = await Competition.findById(id);
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        if (competition.status !== 'completed') {
            return res.status(400).json({ message: 'Only completed competitions can be restored.' });
        }

        // تسجيل تاريخ الاسترجاع وإضافته للسجل
        const restoreEntry = {
            restored_at: new Date(),
            restored_by: userId,
            restored_by_name: userName
        };
        
        await Competition.updateOne(
            { _id: id }, 
            { 
                $set: { restored_at: new Date() },
                $push: { restore_history: restoreEntry }
            }
        );

        const restoreCount = (competition.restore_history?.length || 0) + 1;
        const logDescription = `تم استرجاع المسابقة المكتملة "${competition.name}" لإعادة إرسال التقارير (المرة رقم ${restoreCount}).`;
        if (userId) {
            await logActivity(userId, competition.agent_id, 'COMPETITION_RESTORED', logDescription);
        }

        res.json({ message: 'Competition restored successfully.', competitionId: id, restoreCount });
    } catch (error) {
        console.error('[Restore Competition Error]:', error);
        res.status(500).json({ message: 'Failed to restore competition.', error: error.toString() });
    }
};

/**
 * جلب بيانات المسابقة الكاملة للاسترجاع
 * يحاول أولاً استخدام الـ snapshot المحفوظ، وإن لم يوجد يجلب البيانات الحالية
 */
exports.getCompetitionForRestore = async (req, res) => {
    const { id } = req.params;
    const skipValidation = req.query.skipValidation === 'true'; // خيار لتخطي التحقق من الملفات
    
    try {
        // جلب المسابقة مع الوكيل بشكل متوازي مع الفائزين
        const [competition, winners] = await Promise.all([
            Competition.findById(id).populate('agent_id').lean(), // استخدام lean() للأداء
            Winner.find({ competition_id: id }).sort({ order_number: 1 }).lean()
        ]);
        
        if (!competition) {
            return res.status(404).json({ message: 'المسابقة غير موجودة.' });
        }
        
        // التحقق من سلامة الملفات (اختياري - يمكن تخطيه للسرعة)
        const fileValidation = {
            valid: true,
            issues: [],
            missingImages: [],
            missingVideos: []
        };
        
        // فقط نتحقق من الملفات إذا لم يُطلب تخطي التحقق
        if (!skipValidation && winners.length <= 20) { // نتحقق فقط لو الفائزين قليلين
            const fsSync = require('fs');
            for (const winner of winners) {
                // التحقق من صورة الهوية
                if (winner.national_id_image) {
                    const imagePath = winner.national_id_image.startsWith('/uploads') 
                        ? path.join(__dirname, '../../', winner.national_id_image.slice(1))
                        : winner.national_id_image;
                        
                    if (!fsSync.existsSync(imagePath)) {
                        fileValidation.valid = false;
                        fileValidation.missingImages.push({
                            winnerId: winner._id,
                            winnerName: winner.name,
                            path: winner.national_id_image
                        });
                        fileValidation.issues.push(`صورة هوية "${winner.name}" غير موجودة`);
                    }
                }
                
                // التحقق من الفيديو
                if (winner.video_url) {
                    const videoPath = winner.video_url.startsWith('/uploads')
                        ? path.join(__dirname, '../../', winner.video_url.slice(1))
                        : winner.video_url;
                        
                    if (!fsSync.existsSync(videoPath)) {
                        fileValidation.missingVideos.push({
                            winnerId: winner._id,
                            winnerName: winner.name,
                            path: winner.video_url
                        });
                        fileValidation.issues.push(`فيديو "${winner.name}" غير موجود`);
                    }
                }
            }
        }
        
        // بناء بيانات الوكيل
        let agentData = null;
        
        // أولاً: محاولة استخدام الـ snapshot إذا كان موجوداً
        if (competition.completion_snapshot?.agent) {
            agentData = competition.completion_snapshot.agent;
            
            // التحقق من أن الوكيل لا يزال موجوداً (للحصول على أحدث chat_id إذا تغير)
            const currentAgent = await Agent.findById(agentData._id).select('telegram_chat_id').lean();
            if (currentAgent) {
                agentData.chat_id = currentAgent.telegram_chat_id; // استخدام أحدث chat_id
                agentData.is_active = true;
            } else {
                agentData.is_active = false;
                fileValidation.issues.push('الوكيل محذوف من النظام - سيتم استخدام البيانات المحفوظة');
            }
        } 
        // ثانياً: استخدام البيانات الحالية
        else if (competition.agent_id && typeof competition.agent_id === 'object') {
            agentData = {
                _id: competition.agent_id._id,
                name: competition.agent_id.name,
                agent_id: competition.agent_id.agent_id,
                chat_id: competition.agent_id.telegram_chat_id,
                avatar_url: competition.agent_id.avatar_url,
                is_active: true
            };
        } else {
            // محاولة جلب الوكيل يدوياً
            const agent = await Agent.findById(competition.agent_id).lean();
            if (agent) {
                agentData = {
                    _id: agent._id,
                    name: agent.name,
                    agent_id: agent.agent_id,
                    chat_id: agent.telegram_chat_id,
                    avatar_url: agent.avatar_url,
                    is_active: true
                };
            } else {
                fileValidation.valid = false;
                fileValidation.issues.push('الوكيل غير موجود في النظام');
            }
        }
        
        // بناء الاستجابة
        res.json({
            competition: {
                _id: competition._id,
                name: competition.name,
                description: competition.description,
                status: competition.status,
                prize_per_winner: competition.prize_per_winner,
                deposit_bonus_percentage: competition.deposit_bonus_percentage,
                trading_winners_count: competition.trading_winners_count,
                deposit_winners_count: competition.deposit_winners_count,
                required_winners: competition.required_winners,
                createdAt: competition.createdAt,
                ends_at: competition.ends_at,
                restore_history: competition.restore_history,
                completion_snapshot: competition.completion_snapshot ? {
                    snapshot_at: competition.completion_snapshot.snapshot_at,
                    completed_by_name: competition.completion_snapshot.completed_by_name,
                    total_prize_value: competition.completion_snapshot.total_prize_value
                } : null
            },
            agent: agentData,
            winners: winners.map(w => ({
                _id: w._id,
                name: w.name,
                account_number: w.account_number,
                email: w.email,
                national_id: w.national_id,
                national_id_image: w.national_id_image,
                prize_type: w.prize_type,
                prize_value: w.prize_value,
                video_url: w.video_url,
                order_number: w.order_number
            })),
            validation: fileValidation,
            hasSnapshot: !!competition.completion_snapshot,
            canRestore: fileValidation.valid || fileValidation.missingImages.length === 0
        });
        
    } catch (error) {
        console.error('[Get Competition For Restore Error]:', error);
        res.status(500).json({ message: 'فشل في جلب بيانات المسابقة للاسترجاع.', error: error.toString() });
    }
};

// ==========================================
// التحقق من الملفات في الخلفية (Background Validation)
// يُستدعى بعد تحميل البيانات الأساسية
// ==========================================
exports.validateCompetitionFiles = async (req, res) => {
    const { id } = req.params;
    const fsSync = require('fs');
    
    try {
        // جلب الفائزين فقط (نحتاج الملفات)
        const winners = await Winner.find({ competition_id: id })
            .select('_id name national_id_image video_url')
            .lean();
        
        const validation = {
            valid: true,
            totalFiles: 0,
            checkedFiles: 0,
            missingImages: [],
            missingVideos: [],
            validImages: [],
            validVideos: [],
            issues: []
        };
        
        // التحقق من كل ملف
        for (const winner of winners) {
            // التحقق من صورة الهوية
            if (winner.national_id_image) {
                validation.totalFiles++;
                const imagePath = winner.national_id_image.startsWith('/uploads') 
                    ? path.join(__dirname, '../../', winner.national_id_image.slice(1))
                    : winner.national_id_image;
                
                if (fsSync.existsSync(imagePath)) {
                    validation.validImages.push({
                        winnerId: winner._id,
                        winnerName: winner.name
                    });
                } else {
                    validation.valid = false;
                    validation.missingImages.push({
                        winnerId: winner._id,
                        winnerName: winner.name,
                        path: winner.national_id_image
                    });
                    validation.issues.push(`صورة هوية "${winner.name}" غير موجودة`);
                }
                validation.checkedFiles++;
            }
            
            // التحقق من الفيديو
            if (winner.video_url) {
                validation.totalFiles++;
                const videoPath = winner.video_url.startsWith('/uploads')
                    ? path.join(__dirname, '../../', winner.video_url.slice(1))
                    : winner.video_url;
                
                if (fsSync.existsSync(videoPath)) {
                    validation.validVideos.push({
                        winnerId: winner._id,
                        winnerName: winner.name
                    });
                } else {
                    validation.missingVideos.push({
                        winnerId: winner._id,
                        winnerName: winner.name,
                        path: winner.video_url
                    });
                    validation.issues.push(`فيديو "${winner.name}" غير موجود`);
                }
                validation.checkedFiles++;
            }
        }
        
        // إحصائيات
        validation.summary = {
            totalWinners: winners.length,
            winnersWithImages: validation.validImages.length + validation.missingImages.length,
            winnersWithVideos: validation.validVideos.length + validation.missingVideos.length,
            imagesOk: validation.validImages.length,
            imagesMissing: validation.missingImages.length,
            videosOk: validation.validVideos.length,
            videosMissing: validation.missingVideos.length
        };
        
        res.json(validation);
        
    } catch (error) {
        console.error('[Validate Competition Files Error]:', error);
        res.status(500).json({ message: 'فشل في التحقق من الملفات.', error: error.toString() });
    }
};
