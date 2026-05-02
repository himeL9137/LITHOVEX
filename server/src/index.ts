/**
 * LITHOVEX Server Entry Point
 * Initializes Express server with Agent Swarm system
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PORT, NODE_ENV } from './config';
import { agentRoutes } from './agents';

const app = express();

// ============================================================
// Middleware Setup
// ============================================================

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ============================================================
// Routes
// ============================================================

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    env: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Agent Swarm Routes
app.use('/api/agents', agentRoutes);

// API Documentation
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    title: 'LITHOVEX Agent Swarm API',
    version: '1.0.0',
    description: 'Multi-agent AI collaboration system',
    endpoints: {
      execute: {
        method: 'POST',
        path: '/api/agents/execute',
        description: 'Execute a single task across the swarm',
      },
      executeBatch: {
        method: 'POST',
        path: '/api/agents/execute-batch',
        description: 'Execute multiple tasks in batch',
      },
      getTask: {
        method: 'GET',
        path: '/api/agents/task/:taskId',
        description: 'Get completed task result',
      },
      status: {
        method: 'GET',
        path: '/api/agents/status',
        description: 'Get swarm status and statistics',
      },
      available: {
        method: 'GET',
        path: '/api/agents/available',
        description: 'Get available agents',
      },
      history: {
        method: 'GET',
        path: '/api/agents/history',
        description: 'Get task execution history',
      },
      reset: {
        method: 'POST',
        path: '/api/agents/reset',
        description: 'Reset all agents',
      },
      clearHistory: {
        method: 'POST',
        path: '/api/agents/clear-history',
        description: 'Clear task history',
      },
    },
  });
});

// ============================================================
// Error Handling
// ============================================================

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    details: `Route ${req.path} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /api/docs',
      'POST /api/agents/execute',
      'POST /api/agents/execute-batch',
      'GET /api/agents/task/:taskId',
      'GET /api/agents/status',
      'GET /api/agents/available',
      'GET /api/agents/history',
      'POST /api/agents/reset',
      'POST /api/agents/clear-history',
    ],
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    details: NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ============================================================
// Server Startup
// ============================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 LITHOVEX Server Started');
  console.log(`${'='.repeat(60)}`);
  console.log(`📡 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🤖 Agent Swarm System: ACTIVE (6 specialized AI models)`);
  console.log(`${'='.repeat(60)}\n`);
  console.log('📚 Available Endpoints:');
  console.log('  • POST   /api/agents/execute          - Execute task via swarm');
  console.log('  • POST   /api/agents/execute-batch    - Execute multiple tasks');
  console.log('  • GET    /api/agents/task/:taskId     - Get task result');
  console.log('  • GET    /api/agents/status           - Get swarm status');
  console.log('  • GET    /api/agents/available        - List available agents');
  console.log('  • GET    /api/agents/history          - Get task history');
  console.log('  • POST   /api/agents/reset            - Reset all agents');
  console.log('  • GET    /api/docs                    - API documentation');
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, gracefully shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, gracefully shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
