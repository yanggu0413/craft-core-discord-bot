import http from 'http';
import path from 'path';
import { db } from '../db/database';
import { DockerService } from '../services/docker';
import { GitService } from '../services/git';

export function handleMcpJsonRpcRequest(body: any, res: http.ServerResponse) {
  const { jsonrpc, id, method, params } = body;

  if (method === 'tools/list') {
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'list_instances',
            description: 'List all running Docker containers, status, and resource usage quotas in Craft-Core Hosting',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_container_logs',
            description: 'Fetch real-time terminal output logs for a specific container instance',
            inputSchema: {
              type: 'object',
              properties: { instanceId: { type: 'string' } },
              required: ['instanceId'],
            },
          },
          {
            name: 'start_container',
            description: 'Start a specific Docker container instance',
            inputSchema: {
              type: 'object',
              properties: { instanceId: { type: 'string' } },
              required: ['instanceId'],
            },
          },
          {
            name: 'stop_container',
            description: 'Stop a specific Docker container instance',
            inputSchema: {
              type: 'object',
              properties: { instanceId: { type: 'string' } },
              required: ['instanceId'],
            },
          },
          {
            name: 'restart_container',
            description: 'Trigger a clean restart of a specific Docker container instance',
            inputSchema: {
              type: 'object',
              properties: { instanceId: { type: 'string' } },
              required: ['instanceId'],
            },
          },
          {
            name: 'set_env_vars',
            description: 'Set or update environment variables (KEY=VALUE pairs) for a specific instance, and automatically apply them to the container',
            inputSchema: {
              type: 'object',
              properties: {
                instanceId: { type: 'string', description: 'Instance ID (e.g., inst-ms6xyq3h)' },
                envVars: {
                  type: 'array',
                  description: 'Array of environment variable objects',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      value: { type: 'string' },
                    },
                    required: ['key', 'value'],
                  },
                },
              },
              required: ['instanceId', 'envVars'],
            },
          },
          {
            name: 'deploy_instance',
            description: 'Trigger a clean git pull, build, and container re-deploy/start for a specific instance',
            inputSchema: {
              type: 'object',
              properties: { instanceId: { type: 'string', description: 'Instance ID (e.g., inst-ms6xyq3h)' } },
              required: ['instanceId'],
            },
          },
        ],
      },
    }));
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (name === 'list_instances') {
      const instances = db.prepare('SELECT id, name, runtime, internal_port, assigned_host_port, cpu_limit, memory_limit, status, subdomain FROM instances').all();
      return res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(instances, null, 2) }],
        },
      }));
    }

    if (name === 'get_container_logs') {
      const { instanceId } = args || {};
      DockerService.getContainerLogs(instanceId)
        .then((logs) => {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: logs || 'No logs available' }],
            },
          }));
        })
        .catch((err) => {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err.message },
          }));
        });
      return;
    }

    if (name === 'start_container') {
      const { instanceId } = args || {};
      DockerService.startContainer(instanceId)
        .then(() => {
          db.prepare("UPDATE instances SET status = 'running' WHERE id = ?").run(instanceId);
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Container ${instanceId} started successfully.` }],
            },
          }));
        })
        .catch((err) => {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err.message },
          }));
        });
      return;
    }

    if (name === 'stop_container') {
      const { instanceId } = args || {};
      DockerService.stopContainer(instanceId)
        .then(() => {
          db.prepare("UPDATE instances SET status = 'stopped' WHERE id = ?").run(instanceId);
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Container ${instanceId} stopped successfully.` }],
            },
          }));
        })
        .catch((err) => {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err.message },
          }));
        });
      return;
    }

    if (name === 'restart_container') {
      const { instanceId } = args || {};
      DockerService.restartContainer(instanceId)
        .then(() => {
          db.prepare("UPDATE instances SET status = 'running' WHERE id = ?").run(instanceId);
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Container ${instanceId} restarted successfully.` }],
            },
          }));
        })
        .catch((err) => {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err.message },
          }));
        });
      return;
    }

    if (name === 'set_env_vars') {
      const { instanceId, envVars } = args || {};
      try {
        const inst = db.prepare('SELECT id FROM instances WHERE id = ?').get(instanceId);
        if (!inst) {
          return res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Instance ${instanceId} not found` },
          }));
        }

        const formattedVars = Array.isArray(envVars) ? envVars.map((e: any) => ({
          key: (e.key || '').trim(),
          value: e.value || '',
          isSecret: true,
        })) : [];

        db.prepare('UPDATE instances SET env_vars = ? WHERE id = ?').run(JSON.stringify(formattedVars), instanceId);

        DockerService.recreateContainer(instanceId)
          .then(() => {
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Environment variables updated successfully and container re-configured for instance ${instanceId}.` }],
              },
            }));
          })
          .catch((err) => {
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Environment variables saved to database, but container recreation reported: ${err.message}` }],
              },
            }));
          });
      } catch (err: any) {
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: err.message },
        }));
      }
      return;
    }

    if (name === 'deploy_instance') {
      const { instanceId } = args || {};
      (async () => {
        try {
          const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
          if (!inst) {
            return res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: `Instance ${instanceId} not found` },
            }));
          }

          if (inst.source_type === 'git' && inst.git_url) {
            await GitService.cloneRepo(inst.git_url, instanceId).catch(() => {});
          }

          await DockerService.recreateContainer(instanceId);
          await DockerService.startContainer(instanceId);
          db.prepare("UPDATE instances SET status = 'running' WHERE id = ?").run(instanceId);

          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Instance ${instanceId} successfully deployed and started!` }],
            },
          }));
        } catch (err: any) {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err.message },
          }));
        }
      })();
      return;
    }
  }

  return res.end(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: 'Method not found' },
  }));
}
