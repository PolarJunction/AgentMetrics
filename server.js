const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3006;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

// Track gateway connection status
let gatewayStatus = {
  connected: false,
  lastCheck: null,
  error: null
};

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for gateway
app.get('/api/gateway/status', async (req, res) => {
  try {
    // Try to ping the gateway
    await axios.get(GATEWAY_URL, { timeout: 2000 });
    gatewayStatus.connected = true;
    gatewayStatus.lastCheck = new Date().toISOString();
    gatewayStatus.error = null;
  } catch (error) {
    gatewayStatus.connected = false;
    gatewayStatus.lastCheck = new Date().toISOString();
    gatewayStatus.error = error.message;
  }
  
  res.json(gatewayStatus);
});

// API endpoint to fetch agent metrics from gateway
app.get('/api/metrics', async (req, res) => {
  let gatewayConnected = false;
  let errorMsg = null;
  
  try {
    // Try to fetch real data from gateway
    // Check various possible endpoints
    const endpoints = [
      `${GATEWAY_URL}/api/sessions`,
      `${GATEWAY_URL}/api/gateway/sessions`,
      `${GATEWAY_URL}/sessions`
    ];
    
    let sessionsData = null;
    let agentsData = null;
    
    for (const endpoint of endpoints) {
      try {
        const res = await axios.get(endpoint, { timeout: 1500 });
        if (res.data) {
          sessionsData = res.data;
          gatewayConnected = true;
          break;
        }
      } catch (e) {
        continue; // Try next endpoint
      }
    }
    
    // Try agents endpoint
    const agentEndpoints = [
      `${GATEWAY_URL}/api/agents`,
      `${GATEWAY_URL}/api/gateway/agents`,
      `${GATEWAY_URL}/agents`
    ];
    
    for (const endpoint of agentEndpoints) {
      try {
        const res = await axios.get(endpoint, { timeout: 1500 });
        if (res.data) {
          agentsData = res.data;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    let metrics = {
      activeSessions: 0,
      totalTasks: 0,
      agentCount: 0,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      gatewayConnected: false
    };

    if (sessionsData) {
      metrics.activeSessions = Array.isArray(sessionsData) ? sessionsData.length : 
        (sessionsData.sessions?.length || sessionsData.count || 0);
      metrics.gatewayConnected = true;
    }

    if (agentsData) {
      metrics.agentCount = Array.isArray(agentsData) ? agentsData.length :
        (agentsData.agents?.length || agentsData.count || 0);
    }

    // If we got session data, calculate tasks from it
    if (sessionsData && Array.isArray(sessionsData)) {
      metrics.totalTasks = sessionsData.reduce((sum, s) => sum + (s.tasksCompleted || s.tasks || 0), 0);
    } else if (metrics.activeSessions > 0) {
      metrics.totalTasks = metrics.activeSessions * 3;
    }
    
    gatewayStatus = { connected: true, lastCheck: new Date().toISOString(), error: null };
    res.json(metrics);
    
  } catch (error) {
    // Fallback to mock data if gateway unavailable
    console.log('Gateway unavailable, using mock data');
    gatewayConnected = false;
    errorMsg = error.message;
    
    // Generate consistent mock data (seeded by time)
    const now = Date.now();
    const hour = new Date().getHours();
    
    res.json({
      activeSessions: Math.floor(Math.sin(hour / 24 * Math.PI * 2) * 2 + 3),
      totalTasks: Math.floor(Math.cos(hour / 24 * Math.PI * 2) * 10 + 15),
      agentCount: 3,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      mock: true,
      gatewayConnected: false,
      gatewayError: errorMsg
    });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Metrics Dashboard running on http://localhost:${PORT}`);
});
