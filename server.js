const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3005;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch agent metrics from gateway
app.get('/api/metrics', async (req, res) => {
  try {
    // Try to fetch real data from gateway
    const [sessionsRes, agentsRes] = await Promise.allSettled([
      axios.get(`${GATEWAY_URL}/api/sessions`, { timeout: 2000 }),
      axios.get(`${GATEWAY_URL}/api/agents`, { timeout: 2000 })
    ]);

    let metrics = {
      activeSessions: 0,
      totalTasks: 0,
      agentCount: 0,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    if (sessionsRes.status === 'fulfilled') {
      const sessions = sessionsRes.value.data;
      metrics.activeSessions = Array.isArray(sessions) ? sessions.length : 0;
    }

    if (agentsRes.status === 'fulfilled') {
      const agents = agentsRes.value.data;
      metrics.agentCount = Array.isArray(agents) ? agents.length : 0;
    }

    // Mock task count based on sessions for now
    metrics.totalTasks = metrics.activeSessions * 3;

    res.json(metrics);
  } catch (error) {
    // Fallback to mock data if gateway unavailable
    console.log('Gateway unavailable, using mock data');
    res.json({
      activeSessions: Math.floor(Math.random() * 5) + 1,
      totalTasks: Math.floor(Math.random() * 20) + 5,
      agentCount: 3,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      mock: true
    });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Metrics Dashboard running on http://localhost:${PORT}`);
});
