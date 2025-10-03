const Agent = require('../../models/agent.model');

exports.getAllAgents = async (req, res) => {
    try {
        const agents = await Agent.find({}).sort({ createdAt: -1 });
        const count = await Agent.countDocuments();
        res.json({ data: agents, count, error: null });
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ data: null, count: 0, error: 'Server error while fetching agents.' });
    }
};

exports.createAgent = async (req, res) => {
    try {
        const newAgentData = req.body;
        const existingAgent = await Agent.findOne({ $or: [{ agent_id: newAgentData.agent_id }, { name: newAgentData.name }] });
        if (existingAgent) {
            const message = existingAgent.agent_id === newAgentData.agent_id ? 'رقم الوكالة هذا مستخدم بالفعل.' : 'اسم الوكيل هذا مستخدم بالفعل.';
            return res.status(409).json({ message });
        }
        const agent = new Agent(newAgentData);
        const savedAgent = await agent.save();
        res.status(201).json({ data: savedAgent, error: null });
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ data: null, error: 'Server error while creating the agent.' });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAgent = await Agent.findByIdAndDelete(id);
        if (!deletedAgent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }
        res.status(200).json({ message: 'Agent deleted successfully.' });
    } catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ data: null, error: 'Server error while deleting the agent.' });
    }
};

exports.checkUniqueness = async (req, res) => {
    const { agent_id, name } = req.query;
    if (!agent_id && !name) {
        return res.status(400).json({ message: 'Agent ID or Name is required for check.' });
    }
    try {
        const query = [];
        if (agent_id) query.push({ agent_id: agent_id });
        if (name) query.push({ name: name });
        const existingAgent = await Agent.findOne({ $or: query });
        res.json({ exists: !!existingAgent });
    } catch (error) {
        console.error('Error checking agent uniqueness:', error);
        res.status(500).json({ message: 'Server error during uniqueness check.' });
    }
};

exports.getAgentById = async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await Agent.findById(id);

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }
        res.json({ data: agent, error: null });
    } catch (error) {
        console.error('Error fetching agent by ID:', error);
        res.status(500).json({ data: null, error: 'Server error while fetching agent.' });
    }
};

exports.updateAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const updatedAgent = await Agent.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!updatedAgent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }
        res.json({ data: updatedAgent, error: null });
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ data: null, error: 'Server error while updating agent.' });
    }
};