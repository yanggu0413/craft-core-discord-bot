export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  discordId: string;
  username: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  apiToken?: string;
}

export type RuntimeType = 'nodejs' | 'python';
export type InstanceStatus = 'running' | 'stopped' | 'building' | 'error';

export interface EnvVariable {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface Instance {
  id: string;
  userId: string;
  name: string;
  runtime: RuntimeType;
  sourceType: 'git' | 'zip';
  gitUrl?: string;
  zipFileName?: string;
  startCommand: string;
  buildCommand?: string;
  rootDir?: string;
  internalPort: number;
  assignedHostPort?: number;
  cpuLimit: number;
  memoryLimit: number;
  diskLimit: number;
  envVars: EnvVariable[];
  status: InstanceStatus;
  webhookSecret?: string;
  webhookUrl?: string;
  discordWebhookUrl?: string;
  healthCheckEndpoint?: string;
  customDomain?: string;
  subdomain?: string;
  ownerUsername?: string;
  createdAt: string;
}

export interface DeploymentCommit {
  id: string;
  instanceId: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: string;
  status: 'SUCCESS' | 'BUILDING' | 'FAILED';
  isCurrent?: boolean;
}

export interface PortRequest {
  id: string;
  instanceId: string;
  instanceName: string;
  userId: string;
  username: string;
  internalPort: number;
  assignedHostPort?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  content?: string;
}
