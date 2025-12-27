const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Agent = require('../src/models/agent.model');

async function debugAuditDays() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/admin');
        const dbs = await mongoose.connection.db.admin().listDatabases();
        await mongoose.disconnect();

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'config', 'local'].includes(dbName)) continue;

            const uri = `mongodb://127.0.0.1:27017/${dbName}`;
            try {
                await mongoose.connect(uri);
                const count = await mongoose.connection.db.collection('agents').countDocuments();
                console.log(`DB: ${dbName} -> Agents: ${count}`);
                
                if (count > 10) {
                    const agentsWith6 = await mongoose.connection.db.collection('agents').countDocuments({ audit_days: 6 });
                    console.log(`   Agents with Saturday (6): ${agentsWith6}`);
                }
                
                await mongoose.disconnect();
            } catch (e) {
                console.log(`DB: ${dbName} -> Error: ${e.message}`);
            }
        }


        const todayIndex = new Date().getDay();
        console.log('Server thinks today is index:', todayIndex);

        const agentsOnSaturday = await Agent.find({ audit_days: 6 });
        console.log(`Agents with 6 in audit_days (Number): ${agentsOnSaturday.length}`);

        const agentsOnSaturdayString = await Agent.find({ audit_days: "6" });
        console.log(`Agents with "6" in audit_days (String): ${agentsOnSaturdayString.length}`);
        
        const allAgents = await Agent.find({}, 'name audit_days');
        console.log(`Total agents: ${allAgents.length}`);
        
        const with6 = allAgents.filter(a => a.audit_days.includes(6));
        console.log(`Agents with 6 in JS check: ${with6.length}`);

        const counts = {};
        allAgents.forEach(a => {
            a.audit_days.forEach(d => {
                counts[d] = (counts[d] || 0) + 1;
            });
        });
        console.log('Audit days distribution:', counts);

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugAuditDays();