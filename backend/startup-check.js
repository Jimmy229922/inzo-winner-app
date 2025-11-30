#!/usr/bin/env node

/**
 * Quick startup test script
 * Tests that all routes are properly defined before starting the server
 */

const express = require('express');

try {
    console.log('🔍 Checking Express route definitions...\n');

    // Test that we can require the stats controller
    const statsController = require('./src/controllers/stats.controller');
    
    const methods = [
        { name: 'getAnalytics', exists: typeof statsController.getAnalytics === 'function' },
        { name: 'getHomeStats', exists: typeof statsController.getHomeStats === 'function' },
        { name: 'getAgentAnalytics', exists: typeof statsController.getAgentAnalytics === 'function' },
        { name: 'getTopAgents', exists: typeof statsController.getTopAgents === 'function' }
    ];

    let allOk = true;
    methods.forEach(method => {
        const status = method.exists ? '✅' : '❌';
        console.log(`${status} statsController.${method.name}: ${method.exists ? 'OK' : 'MISSING'}`);
        if (!method.exists) allOk = false;
    });

    console.log('\n');

    if (allOk) {
        console.log('✅ All required stats controller methods exist!');
        console.log('✅ Safe to start the server.');
        process.exit(0);
    } else {
        console.error('❌ Some controller methods are missing!');
        process.exit(1);
    }

} catch (error) {
    console.error('❌ Error during startup check:', error.message);
    process.exit(1);
}
