import { 
  type User, 
  type InsertUser,
  type ApiKey,
  type InsertApiKey,
  type ClientProfile,
  type InsertClientProfile,
  type SystemConfig,
  type InsertSystemConfig,
  type MessageLog,
  type InsertMessageLog,
  type CreditTransaction,
  type InsertCreditTransaction
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // API Key methods
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeysByUserId(userId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<void>;
  
  // Client Profile methods
  getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined>;
  createClientProfile(profile: InsertClientProfile): Promise<ClientProfile>;
  updateClientCredits(userId: string, newCredits: string): Promise<ClientProfile | undefined>;
  
  // System Config methods
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(key: string, value: string): Promise<SystemConfig>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
  
  // Message Log methods
  createMessageLog(log: InsertMessageLog): Promise<MessageLog>;
  getMessageLogsByUserId(userId: string, limit?: number): Promise<MessageLog[]>;
  getMessageLogByMessageId(messageId: string): Promise<MessageLog | undefined>;
  getAllMessageLogs(limit?: number): Promise<MessageLog[]>;
  
  // Credit Transaction methods
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactionsByUserId(userId: string, limit?: number): Promise<CreditTransaction[]>;
  
  // Error logging methods
  getErrorLogs(level?: string): Promise<any[]>;
  
  // Stats methods
  getTotalMessageCount(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private apiKeys: Map<string, ApiKey>;
  private clientProfiles: Map<string, ClientProfile>;
  private systemConfigs: Map<string, SystemConfig>;
  private messageLogs: Map<string, MessageLog>;
  private creditTransactions: Map<string, CreditTransaction>;

  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.clientProfiles = new Map();
    this.systemConfigs = new Map();
    this.messageLogs = new Map();
    this.creditTransactions = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    // First user is automatically promoted to admin
    const isFirstUser = this.users.size === 0;
    const user: User = { 
      ...insertUser,
      id,
      company: insertUser.company ?? null,
      role: isFirstUser ? "admin" : (insertUser.role ?? "client"),
      isActive: insertUser.isActive ?? true,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // API Key methods
  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find(
      (key) => key.keyHash === keyHash,
    );
  }

  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter(
      (key) => key.userId === userId,
    );
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const apiKey: ApiKey = {
      ...insertApiKey,
      id,
      isActive: insertApiKey.isActive ?? true,
      createdAt: new Date(),
      lastUsedAt: null
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsedAt = new Date();
      this.apiKeys.set(id, apiKey);
    }
  }

  async revokeApiKey(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.isActive = false;
      this.apiKeys.set(id, apiKey);
    }
  }

  // Client Profile methods
  async getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined> {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.userId === userId,
    );
  }

  async createClientProfile(insertProfile: InsertClientProfile): Promise<ClientProfile> {
    const id = randomUUID();
    const profile: ClientProfile = {
      ...insertProfile,
      id,
      credits: insertProfile.credits ?? "0.00",
      currency: insertProfile.currency ?? "USD",
      customMarkup: insertProfile.customMarkup ?? null,
      updatedAt: new Date()
    };
    this.clientProfiles.set(id, profile);
    return profile;
  }

  async updateClientCredits(userId: string, newCredits: string): Promise<ClientProfile | undefined> {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId,
    );
    if (!profile) return undefined;

    profile.credits = newCredits;
    profile.updatedAt = new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }

  // System Config methods
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    return Array.from(this.systemConfigs.values()).find(
      (config) => config.key === key,
    );
  }

  async setSystemConfig(key: string, value: string): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(key);
    
    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date();
      this.systemConfigs.set(existing.id, existing);
      return existing;
    }

    const id = randomUUID();
    const config: SystemConfig = {
      id,
      key,
      value,
      updatedAt: new Date()
    };
    this.systemConfigs.set(id, config);
    return config;
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return Array.from(this.systemConfigs.values());
  }

  // Message Log methods
  async createMessageLog(insertLog: InsertMessageLog): Promise<MessageLog> {
    const id = randomUUID();
    const log: MessageLog = {
      ...insertLog,
      id,
      messageCount: insertLog.messageCount ?? 1,
      recipients: insertLog.recipients ?? null,
      recipient: insertLog.recipient ?? null,
      requestPayload: insertLog.requestPayload ?? null,
      responsePayload: insertLog.responsePayload ?? null,
      createdAt: new Date()
    };
    this.messageLogs.set(id, log);
    return log;
  }

  async getMessageLogsByUserId(userId: string, limit: number = 100): Promise<MessageLog[]> {
    const logs = Array.from(this.messageLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  async getMessageLogByMessageId(messageId: string): Promise<MessageLog | undefined> {
    return Array.from(this.messageLogs.values()).find(
      (log) => log.messageId === messageId,
    );
  }

  async getAllMessageLogs(limit: number = 1000): Promise<MessageLog[]> {
    const logs = Array.from(this.messageLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }

  async getTotalMessageCount(): Promise<number> {
    return this.messageLogs.size;
  }

  // Credit Transaction methods
  async createCreditTransaction(insertTransaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const id = randomUUID();
    const transaction: CreditTransaction = {
      ...insertTransaction,
      id,
      messageLogId: insertTransaction.messageLogId ?? null,
      createdAt: new Date()
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }

  async getCreditTransactionsByUserId(userId: string, limit: number = 100): Promise<CreditTransaction[]> {
    const transactions = Array.from(this.creditTransactions.values())
      .filter((txn) => txn.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? transactions.slice(0, limit) : transactions;
  }

  // Error logging methods
  async getErrorLogs(level?: string): Promise<any[]> {
    // Get failed message logs as error logs
    const failedLogs = Array.from(this.messageLogs.values())
      .filter((log) => log.status === 'failed')
      .map((log) => {
        const user = this.users.get(log.userId);
        return {
          id: log.id,
          level: 'error',
          message: `SMS delivery failed`,
          endpoint: log.endpoint,
          userId: log.userId,
          userName: user?.name || 'Unknown',
          details: log.responsePayload,
          timestamp: log.createdAt.toISOString()
        };
      });

    // Filter by level if specified
    if (level && level !== 'all') {
      return failedLogs.filter(log => log.level === level)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100);
    }

    return failedLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
  }
}

export const storage = new MemStorage();
