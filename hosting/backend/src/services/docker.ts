import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';

const docker = new Docker(); // connects via local socket or pipe

export interface CreateContainerOptions {
  instanceId: string;
  runtime: 'nodejs' | 'python';
  appDir: string;
  startCommand: string;
  buildCommand?: string;
  rootDir?: string;
  internalPort: number;
  assignedHostPort?: number;
  cpuLimit: number; // e.g. 50 (%)
  memoryLimit: number; // e.g. 512 (MB)
  envVars?: { key: string; value: string; isSecret?: boolean }[];
}

export class DockerService {
  private static async ensureImageExists(imageName: string) {
    try {
      await docker.getImage(imageName).inspect();
    } catch (err) {
      console.log(`[DockerService] Image ${imageName} not found locally. Pulling image...`);
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (pullErr: any, stream: any) => {
          if (pullErr) return reject(pullErr);
          docker.modem.followProgress(stream, (onFinishedErr: any) => {
            if (onFinishedErr) return reject(onFinishedErr);
            console.log(`[DockerService] Image ${imageName} pulled successfully.`);
            resolve(true);
          });
        });
      });
    }
  }

  static async createContainer(opts: CreateContainerOptions) {
    const containerName = `craft-hosting-${opts.instanceId}`;
    const image = opts.runtime === 'nodejs' ? 'node:22-slim' : 'python:3.11-slim';

    await this.ensureImageExists(image);

    const nanoCpus = Math.floor(opts.cpuLimit * 1e7);
    const memoryBytes = opts.memoryLimit * 1024 * 1024;

    const portBindings: any = {};
    const exposedPorts: any = {};

    if (opts.assignedHostPort) {
      const portKey = `${opts.internalPort}/tcp`;
      exposedPorts[portKey] = {};
      portBindings[portKey] = [{ HostPort: String(opts.assignedHostPort) }];
    }

    const envList: string[] = [`PORT=${opts.internalPort}`];
    if (Array.isArray(opts.envVars)) {
      opts.envVars.forEach((item) => {
        if (item.key && item.key.trim()) {
          envList.push(`${item.key.trim()}=${item.value || ''}`);
        }
      });
    }

    // Support optional buildCommand preceding startCommand
    const fullCmdStr = opts.buildCommand && opts.buildCommand.trim()
      ? `${opts.buildCommand.trim()} && ${opts.startCommand}`
      : opts.startCommand;

    const cmdArray = ['sh', '-c', fullCmdStr];

    // Compute working directory from rootDir
    const safeRootDir = (opts.rootDir || '/').replace(/^[/\\]+/, '');
    const workingDir = safeRootDir ? `/app/${safeRootDir}` : '/app';

    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      Cmd: cmdArray,
      Env: envList,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        NanoCPUs: nanoCpus,
        Memory: memoryBytes,
        PidsLimit: 100,
        Binds: [`${path.resolve(opts.appDir)}:/app`],
        AutoRemove: false,
      },
      WorkingDir: workingDir,
    });

    return container;
  }

  static async isContainerRunning(instanceId: string): Promise<boolean> {
    const containerName = `craft-hosting-${instanceId}`;
    try {
      const container = docker.getContainer(containerName);
      const data = await container.inspect();
      return data.State.Running;
    } catch (err) {
      return false;
    }
  }

  static async recreateContainer(instanceId: string) {
    const isRunning = await this.isContainerRunning(instanceId);

    await this.removeContainer(instanceId).catch(() => {});

    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!inst) return;

    const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);
    const envVars = inst.env_vars ? JSON.parse(inst.env_vars) : [];

    await this.createContainer({
      instanceId: inst.id,
      runtime: inst.runtime,
      appDir,
      startCommand: inst.start_command,
      buildCommand: inst.build_command,
      rootDir: inst.root_dir,
      internalPort: inst.internal_port,
      assignedHostPort: inst.assigned_host_port,
      cpuLimit: inst.cpu_limit,
      memoryLimit: inst.memory_limit,
      envVars,
    });

    if (isRunning) {
      await this.startContainer(instanceId);
    }
  }

  static async startContainer(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);

    try {
      await container.inspect();
    } catch (err) {
      const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
      if (inst) {
        const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);
        const envVars = inst.env_vars ? JSON.parse(inst.env_vars) : [];
        await this.createContainer({
          instanceId: inst.id,
          runtime: inst.runtime,
          appDir,
          startCommand: inst.start_command,
          buildCommand: inst.build_command,
          rootDir: inst.root_dir,
          internalPort: inst.internal_port,
          assignedHostPort: inst.assigned_host_port,
          cpuLimit: inst.cpu_limit,
          memoryLimit: inst.memory_limit,
          envVars,
        });
      }
    }

    await container.start();
  }

  static async stopContainer(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    try {
      await container.stop({ t: 5 });
    } catch (err: any) {
      if (err.statusCode !== 304 && err.statusCode !== 404) {
        console.warn(`[DockerService] Non-fatal container stop notice for ${instanceId}:`, err.message || err);
      }
    }
  }

  static async restartContainer(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    await container.restart();
  }

  static async removeContainer(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    try {
      await container.stop();
    } catch (e) {
      // Container might already be stopped
    }
    await container.remove({ force: true }).catch(() => {});
  }

  static async getContainerLogs(instanceId: string): Promise<string> {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    try {
      const inst = db.prepare('SELECT logs_cleared_at FROM instances WHERE id = ?').get(instanceId) as any;
      const logsClearedAt = inst?.logs_cleared_at ? new Date(inst.logs_cleared_at).getTime() : 0;

      const logsBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail: 200,
        timestamps: true,
      });

      const rawLogs = logsBuffer.toString('utf-8');
      if (!logsClearedAt) return rawLogs;

      const lines = rawLogs.split('\n');
      const filtered = lines.filter((line: string) => {
        // Strip docker stream header bytes if present
        const cleanLine = line.replace(/^[\u0000-\u001f]+/, '');
        const spaceIdx = cleanLine.indexOf(' ');
        if (spaceIdx > 0) {
          const timeStr = cleanLine.substring(0, spaceIdx);
          const lineTime = new Date(timeStr).getTime();
          if (!isNaN(lineTime) && lineTime < logsClearedAt) {
            return false;
          }
        }
        return true;
      });

      return filtered.join('\n');
    } catch (err) {
      return 'Container not running or no log output emitted yet.';
    }
  }

  static async clearContainerLogs(instanceId: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE instances SET logs_cleared_at = ? WHERE id = ?').run(nowIso, instanceId);

    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    try {
      const data = await container.inspect();
      if (data.LogPath && fs.existsSync(data.LogPath)) {
        fs.writeFileSync(data.LogPath, '');
      }
    } catch (err) {}

    return true;
  }

  static async getContainerStats(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);
    try {
      const stats = await container.stats({ stream: false });
      
      let cpuPercent = 0.0;
      if (stats.cpu_stats && stats.precpu_stats) {
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
        const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
        const numCpus = stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage?.percpu_usage ? stats.cpu_stats.cpu_usage.percpu_usage.length : 1);
        if (systemDelta > 0 && cpuDelta > 0) {
          cpuPercent = (cpuDelta / systemDelta) * numCpus * 100;
        }
      }

      let memoryUsageMB = 0;
      let memoryLimitMB = 512;
      if (stats.memory_stats && stats.memory_stats.usage) {
        memoryUsageMB = Math.round(stats.memory_stats.usage / (1024 * 1024));
        memoryLimitMB = Math.round((stats.memory_stats.limit || 536870912) / (1024 * 1024));
      }

      return {
        cpuPercent: Number(cpuPercent.toFixed(1)),
        memoryUsageMB,
        memoryLimitMB,
      };
    } catch (err) {
      return {
        cpuPercent: 0,
        memoryUsageMB: 0,
        memoryLimitMB: 512,
      };
    }
  }
}
