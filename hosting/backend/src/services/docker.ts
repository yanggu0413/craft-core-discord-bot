import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';

const docker = new Docker(); // connects via local socket or pipe

export interface CreateContainerOptions {
  instanceId: string;
  runtime: string;
  dockerImage?: string;
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

// Helper: Safely demux Docker multiplexed stream header bytes (8 bytes header per frame)
function cleanDockerStreamBuffer(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) return String(buffer || '');
  let offset = 0;
  let result = '';
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      result += buffer.toString('utf-8', offset);
      break;
    }
    const streamType = buffer[offset];
    if (streamType === 1 || streamType === 2) {
      const size = buffer.readUInt32BE(offset + 4);
      const chunk = buffer.toString('utf-8', offset + 8, Math.min(buffer.length, offset + 8 + size));
      result += chunk;
      offset += 8 + size;
    } else {
      result += buffer.toString('utf-8', offset);
      break;
    }
  }
  return result;
}

export const pullingStatusMap = new Map<string, string>();

export class DockerService {
  public static async ensureImageExists(imageName: string) {
    try {
      await docker.getImage(imageName).inspect();
    } catch (err) {
      console.log(`[DockerService] Image ${imageName} not found locally. Pulling image from Docker Hub...`);
      pullingStatusMap.set(imageName, `準備拉取 Docker 鏡像 [${imageName}]...`);

      const layerProgressMap: Record<string, { current: number; total: number; status: string }> = {};

      await new Promise((resolve, reject) => {
        docker.pull(imageName, (pullErr: any, stream: any) => {
          if (pullErr) {
            pullingStatusMap.delete(imageName);
            return reject(pullErr);
          }

          docker.modem.followProgress(
            stream,
            (onFinishedErr: any) => {
              pullingStatusMap.delete(imageName);
              if (onFinishedErr) return reject(onFinishedErr);
              console.log(`[DockerService] Image ${imageName} pulled successfully.`);
              resolve(true);
            },
            (event: any) => {
              if (!event) return;
              let statusText = `正在拉取鏡像 [${imageName}]...`;

              if (event.id && event.progressDetail && event.progressDetail.total > 0) {
                const { current, total } = event.progressDetail;
                layerProgressMap[event.id] = { current, total, status: event.status || '' };

                const totalCurrent = Object.values(layerProgressMap).reduce((s, l) => s + (l.current || 0), 0);
                const totalMax = Object.values(layerProgressMap).reduce((s, l) => s + (l.total || 0), 0);

                if (totalMax > 0) {
                  const pct = Math.round((totalCurrent / totalMax) * 100);
                  const currentMB = (totalCurrent / (1024 * 1024)).toFixed(1);
                  const totalMB = (totalMax / (1024 * 1024)).toFixed(1);
                  statusText = `下載鏡像分層 [${event.id}]: ${pct}% (${currentMB} MB / ${totalMB} MB)`;
                }
              } else if (event.status) {
                statusText = `鏡像處理狀態 [${event.id || 'system'}]: ${event.status}`;
              }

              pullingStatusMap.set(imageName, statusText);
            }
          );
        });
      });
    }
  }

  static async createContainer(opts: CreateContainerOptions) {
    const containerName = `craft-hosting-${opts.instanceId}`;

    let image = 'node:22-slim';
    if (opts.dockerImage && opts.dockerImage.trim()) {
      image = opts.dockerImage.trim();
    } else if (opts.runtime === 'nodejs') {
      try {
        await docker.getImage('craft-core-node:22').inspect();
        image = 'craft-core-node:22';
      } catch (e) {
        image = 'node:22-slim';
      }
    } else if (opts.runtime === 'python') {
      image = 'python:3.11-slim';
    } else if (opts.runtime === 'mongodb') {
      image = 'mongo:7.0';
    } else if (opts.runtime === 'postgres') {
      image = 'postgres:16-alpine';
    } else if (opts.runtime === 'mysql') {
      image = 'mysql:8.0';
    } else if (opts.runtime === 'redis') {
      image = 'redis:7.2-alpine';
    } else {
      image = 'node:22-slim';
    }

    await this.ensureImageExists(image);

    if (!fs.existsSync(opts.appDir)) {
      fs.mkdirSync(opts.appDir, { recursive: true });
    }
    try {
      fs.chmodSync(opts.appDir, 0o777);
    } catch (e) {}

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
    if (opts.dockerImage && opts.dockerImage.includes('ghost')) {
      envList.push(`url=http://localhost:${opts.internalPort}`);
      envList.push('NODE_ENV=development');
    }
    if (Array.isArray(opts.envVars)) {
      opts.envVars.forEach((item) => {
        if (item.key && item.key.trim()) {
          envList.push(`${item.key.trim()}=${item.value || ''}`);
        }
      });
    }

    const isCustomContainer = opts.dockerImage || ['mongodb', 'postgres', 'mysql', 'redis', 'docker'].includes(opts.runtime);
    let cmdArray: string[] | undefined = undefined;

    if (!isCustomContainer || (opts.startCommand && opts.startCommand.trim() && opts.startCommand !== 'none')) {
      let buildCmd = opts.buildCommand ? opts.buildCommand.trim() : '';

      // Auto-fallback build command if empty but package.json or requirements.txt exists
      if (!buildCmd) {
        if (opts.runtime === 'nodejs' && fs.existsSync(path.join(opts.appDir, 'package.json'))) {
          buildCmd = 'npm install';
        } else if (opts.runtime === 'python' && fs.existsSync(path.join(opts.appDir, 'requirements.txt'))) {
          buildCmd = 'pip install -r requirements.txt';
        }
      }

      const startCmd = opts.startCommand ? opts.startCommand.trim() : (opts.runtime === 'python' ? 'python main.py' : 'node index.js');

      if (buildCmd) {
        cmdArray = ['sh', '-c', `${buildCmd} && ${startCmd}`];
      } else {
        cmdArray = ['sh', '-c', startCmd];
      }
    }

    // Compute volume binds and working dir
    const binds: string[] = [];
    if (opts.dockerImage) {
      if (opts.dockerImage.includes('uptime-kuma')) {
        binds.push(`${path.resolve(opts.appDir)}:/app/data`);
      } else if (opts.dockerImage.includes('n8n')) {
        binds.push(`${path.resolve(opts.appDir)}:/home/node/.n8n`);
      } else if (opts.dockerImage.includes('pocketbase')) {
        binds.push(`${path.resolve(opts.appDir)}:/pb_data`);
      } else if (opts.dockerImage.includes('ghost')) {
        binds.push(`${path.resolve(opts.appDir)}:/var/lib/ghost/content`);
      } else if (opts.dockerImage.includes('alist')) {
        binds.push(`${path.resolve(opts.appDir)}:/opt/alist/data`);
      } else if (opts.dockerImage.includes('s-pdf') || opts.dockerImage.includes('stirling')) {
        binds.push(`${path.resolve(opts.appDir)}:/configs`);
      } else if (opts.dockerImage.includes('code-server')) {
        binds.push(`${path.resolve(opts.appDir)}:/home/coder`);
      } else {
        binds.push(`${path.resolve(opts.appDir)}:/data`);
      }
    } else {
      binds.push(`${path.resolve(opts.appDir)}:/app`);
    }

    const securityOpts: string[] = [];
    if (!opts.dockerImage || !opts.dockerImage.includes('code-server')) {
      securityOpts.push('no-new-privileges:true');
    }

    const containerConfig: any = {
      Image: image,
      name: containerName,
      Env: envList,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        NanoCPUs: nanoCpus,
        Memory: memoryBytes,
        MemorySwap: memoryBytes,
        MemoryReservation: Math.min(memoryBytes, 128 * 1024 * 1024),
        PidsLimit: 100,
        SecurityOpt: securityOpts,
        Binds: binds,
        AutoRemove: false,
      },
    };

    if (!opts.dockerImage) {
      const safeRootDir = (opts.rootDir || '/').replace(/^[/\\]+/, '');
      containerConfig.WorkingDir = safeRootDir ? `/app/${safeRootDir}` : '/app';
    }

    if (cmdArray) {
      containerConfig.Cmd = cmdArray;
    }

    const container = await docker.createContainer(containerConfig);

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
      dockerImage: inst.docker_image,
      appDir,
      startCommand: inst.start_command,
      buildCommand: inst.build_command,
      rootDir: inst.root_dir,
      internalPort: inst.internal_port,
      assignedHostPort: inst.assigned_host_port,
      cpuLimit: inst.cpu_limit,
      memoryLimit: inst.memory_limit,
    });

    if (isRunning) {
      await this.startContainer(instanceId);
    }
  }

  static async pullLatestImage(imageName: string) {
    console.log(`[DockerService] Force pulling latest image ${imageName}...`);
    pullingStatusMap.set(imageName, `準備拉取最新 Docker 鏡像 [${imageName}]...`);

    const layerProgressMap: Record<string, { current: number; total: number; status: string }> = {};

    await new Promise((resolve, reject) => {
      docker.pull(imageName, (pullErr: any, stream: any) => {
        if (pullErr) {
          pullingStatusMap.delete(imageName);
          return reject(pullErr);
        }

        docker.modem.followProgress(
          stream,
          (onFinishedErr: any) => {
            pullingStatusMap.delete(imageName);
            if (onFinishedErr) return reject(onFinishedErr);
            console.log(`[DockerService] Image ${imageName} updated to latest version successfully.`);
            resolve(true);
          },
          (event: any) => {
            if (!event) return;
            let statusText = `正在拉取最新鏡像 [${imageName}]...`;

            if (event.id && event.progressDetail && event.progressDetail.total > 0) {
              const { current, total } = event.progressDetail;
              layerProgressMap[event.id] = { current, total, status: event.status || '' };

              const totalCurrent = Object.values(layerProgressMap).reduce((s, l) => s + (l.current || 0), 0);
              const totalMax = Object.values(layerProgressMap).reduce((s, l) => s + (l.total || 0), 0);

              if (totalMax > 0) {
                const pct = Math.round((totalCurrent / totalMax) * 100);
                const currentMB = (totalCurrent / (1024 * 1024)).toFixed(1);
                const totalMB = (totalMax / (1024 * 1024)).toFixed(1);
                statusText = `下載鏡像分層 [${event.id}]: ${pct}% (${currentMB} MB / ${totalMB} MB)`;
              }
            } else if (event.status) {
              statusText = `鏡像處理狀態 [${event.id || 'system'}]: ${event.status}`;
            }

            pullingStatusMap.set(imageName, statusText);
          }
        );
      });
    });
  }

  static async upgradeContainer(instanceId: string) {
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!inst) throw new Error('專案不存在');

    let image = 'node:22-slim';
    if (inst.docker_image && inst.docker_image.trim()) {
      image = inst.docker_image.trim();
    } else if (inst.runtime === 'mongodb') image = 'mongo:7.0';
    else if (inst.runtime === 'postgres') image = 'postgres:16-alpine';
    else if (inst.runtime === 'mysql') image = 'mysql:8.0';
    else if (inst.runtime === 'redis') image = 'redis:7.2-alpine';

    await this.pullLatestImage(image);
    await this.recreateContainer(instanceId);
  }

  static async execInContainer(instanceId: string, command: string): Promise<{ exitCode: number; output: string }> {
    const containerName = `craft-hosting-${instanceId}`;
    let container = docker.getContainer(containerName);

    try {
      const inspectData = await container.inspect();
      if (!inspectData.State.Running) {
        await container.start();
      }
    } catch (err: any) {
      await this.startContainer(instanceId);
      container = docker.getContainer(containerName);
    }

    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({ Hijack: false, stdin: false });

    let output = '';
    await new Promise<void>((resolve, reject) => {
      docker.modem.demuxStream(
        stream,
        {
          write: (chunk: Buffer | string) => {
            output += chunk.toString();
          },
        },
        {
          write: (chunk: Buffer | string) => {
            output += chunk.toString();
          },
        }
      );
      stream.on('end', () => resolve());
      stream.on('error', (e: any) => reject(e));
    });

    const inspectExec = await exec.inspect();
    return {
      exitCode: inspectExec.ExitCode ?? 0,
      output: output.trim() || '(指令執行完畢，無輸出內容)',
    };
  }

  static async startContainer(instanceId: string) {
    const containerName = `craft-hosting-${instanceId}`;
    const container = docker.getContainer(containerName);

    let needsRecreate = false;
    try {
      const inspectData = await container.inspect();
      const inst = db.prepare('SELECT docker_image, runtime FROM instances WHERE id = ?').get(instanceId) as any;
      if (inst) {
        let expectedImage = inst.docker_image;
        if (!expectedImage) {
          if (inst.runtime === 'mongodb') expectedImage = 'mongo:7.0';
          else if (inst.runtime === 'postgres') expectedImage = 'postgres:16-alpine';
          else if (inst.runtime === 'mysql') expectedImage = 'mysql:8.0';
          else if (inst.runtime === 'redis') expectedImage = 'redis:7.2-alpine';
          else if (inst.runtime === 'python') expectedImage = 'python:3.11-slim';
          else expectedImage = 'craft-core-node:22';
        }
        if (inspectData.Config.Image !== expectedImage) {
          needsRecreate = true;
        }
      }
    } catch (err) {
      needsRecreate = true;
    }

    if (needsRecreate) {
      await this.removeContainer(instanceId).catch(() => {});
      const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
      if (inst) {
        const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);
        const envVars = inst.env_vars ? JSON.parse(inst.env_vars) : [];
        await this.createContainer({
          instanceId: inst.id,
          runtime: inst.runtime,
          dockerImage: inst.docker_image,
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
    await this.removeContainer(instanceId).catch(() => {});
    const inst = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (inst) {
      const appDir = path.join(process.cwd(), 'data', 'apps', instanceId);
      const envVars = inst.env_vars ? JSON.parse(inst.env_vars) : [];
      await this.createContainer({
        instanceId: inst.id,
        runtime: inst.runtime,
        dockerImage: inst.docker_image,
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
      await this.startContainer(instanceId);
    }
    db.prepare("UPDATE instances SET status = 'running' WHERE id = ?").run(instanceId);
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

      const rawLogs = cleanDockerStreamBuffer(logsBuffer);
      if (!logsClearedAt) return rawLogs;

      const lines = rawLogs.split('\n');
      const filtered = lines.filter((line: string) => {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx > 0) {
          const timeStr = line.substring(0, spaceIdx);
          const lineTime = new Date(timeStr).getTime();
          if (!isNaN(lineTime) && lineTime < logsClearedAt) {
            return false;
          }
        }
        return true;
      });

      return filtered.join('\n');
    } catch (err) {
      return '容器未啟動或尚無日誌輸出';
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

      let rxBytes = 0;
      let txBytes = 0;
      if (stats.networks) {
        Object.values(stats.networks).forEach((net: any) => {
          rxBytes += net.rx_bytes || 0;
          txBytes += net.tx_bytes || 0;
        });
      }

      return {
        cpuPercent: Number(cpuPercent.toFixed(1)),
        memoryUsageMB,
        memoryLimitMB,
        rxBytes,
        txBytes,
      };
    } catch (err) {
      return {
        cpuPercent: 0,
        memoryUsageMB: 0,
        memoryLimitMB: 512,
        rxBytes: 0,
        txBytes: 0,
      };
    }
  }
}
