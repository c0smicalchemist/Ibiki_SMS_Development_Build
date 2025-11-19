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
  type InsertCreditTransaction,
  type IncomingMessage,
  type InsertIncomingMessage,
  users,
  apiKeys,
  clientProfiles,
  systemConfig,
  messageLogs,
  creditTransactions,
  incomingMessages
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, desc, sql } from 'drizzle-orm';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Password Reset methods
  setPasswordResetToken(email: string, token: string, expiry: Date): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: string): Promise<void>;
  updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined>;
  
  // API Key methods
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeysByUserId(userId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<void>;
  
  // Client Profile methods
  getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined>;
  getClientProfileByPhoneNumber(phoneNumber: string): Promise<ClientProfile | undefined>;
  createClientProfile(profile: InsertClientProfile): Promise<ClientProfile>;
  updateClientCredits(userId: string, newCredits: string): Promise<ClientProfile | undefined>;
  updateClientPhoneNumbers(userId: string, phoneNumbers: string[]): Promise<ClientProfile | undefined>;
  
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
  
  // Incoming Message methods
  createIncomingMessage(message: InsertIncomingMessage): Promise<IncomingMessage>;
  getIncomingMessagesByUserId(userId: string, limit?: number): Promise<IncomingMessage[]>;
  getAllIncomingMessages(limit?: number): Promise<IncomingMessage[]>;
  
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
  private incomingMessages: Map<string, IncomingMessage>;

  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.clientProfiles = new Map();
    this.systemConfigs = new Map();
    this.messageLogs = new Map();
    this.creditTransactions = new Map();
    this.incomingMessages = new Map();
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
      resetToken: null,
      resetTokenExpiry: null,
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

  // Password Reset methods
  async setPasswordResetToken(email: string, token: string, expiry: Date): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    
    return this.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry
    });
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (u) => u.resetToken === token
    );
    
    if (!user) return undefined;
    
    // Check if token is expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      return undefined; // Token expired
    }
    
    return user;
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.updateUser(userId, {
      resetToken: null,
      resetTokenExpiry: null
    });
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const updatedUser = await this.updateUser(userId, {
      password: newPasswordHash,
      resetToken: null,
      resetTokenExpiry: null
    });
    
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
      assignedPhoneNumbers: insertProfile.assignedPhoneNumbers ?? null,
      updatedAt: new Date()
    };
    this.clientProfiles.set(id, profile);
    return profile;
  }

  async getClientProfileByPhoneNumber(phoneNumber: string): Promise<ClientProfile | undefined> {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.assignedPhoneNumbers?.includes(phoneNumber),
    );
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

  async updateClientPhoneNumbers(userId: string, phoneNumbers: string[]): Promise<ClientProfile | undefined> {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId,
    );
    if (!profile) return undefined;

    profile.assignedPhoneNumbers = phoneNumbers.length > 0 ? phoneNumbers : null;
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

  // Incoming Message methods
  async createIncomingMessage(insertMessage: InsertIncomingMessage): Promise<IncomingMessage> {
    const id = randomUUID();
    const message: IncomingMessage = {
      ...insertMessage,
      id,
      userId: insertMessage.userId ?? null,
      firstname: insertMessage.firstname ?? null,
      lastname: insertMessage.lastname ?? null,
      business: insertMessage.business ?? null,
      matchedBlockWord: insertMessage.matchedBlockWord ?? null,
      usedmodem: insertMessage.usedmodem ?? null,
      port: insertMessage.port ?? null,
      createdAt: new Date()
    };
    this.incomingMessages.set(id, message);
    return message;
  }

  async getIncomingMessagesByUserId(userId: string, limit: number = 100): Promise<IncomingMessage[]> {
    const messages = Array.from(this.incomingMessages.values())
      .filter((msg) => msg.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? messages.slice(0, limit) : messages;
  }

  async getAllIncomingMessages(limit: number = 100): Promise<IncomingMessage[]> {
    const messages = Array.from(this.incomingMessages.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? messages.slice(0, limit) : messages;
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

// PostgreSQL-backed storage using Drizzle ORM
let dbInstance: ReturnType<typeof drizzle> | null = null;
let poolInstance: Pool | null = null;

export class DbStorage implements IStorage {
  private db;

  constructor() {
    // Reuse singleton connection pool to prevent leaks
    if (!dbInstance) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.warn('DATABASE_URL not set - DbStorage requires database connection');
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Configure WebSocket for neon serverless
      neonConfig.webSocketConstructor = ws;
      
      poolInstance = new Pool({ connectionString });
      dbInstance = drizzle(poolInstance, {
        schema: {
          users,
          apiKeys,
          clientProfiles,
          systemConfig,
          messageLogs,
          creditTransactions,
          incomingMessages
        }
      });
      
      // Cleanup on process exit
      process.on('SIGINT', async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
    }
    
    this.db = dbInstance;
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    // Auto-promote first user to admin
    const allUsers = await this.getAllUsers();
    const isFirstUser = allUsers.length === 0;
    
    const result = await this.db.insert(users).values({
      ...user,
      role: isFirstUser ? 'admin' : (user.role || 'client')
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await this.db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Password Reset methods
  async setPasswordResetToken(email: string, token: string, expiry: Date): Promise<User | undefined> {
    const result = await this.db.update(users)
      .set({ resetToken: token, resetTokenExpiry: expiry })
      .where(eq(users.email, email))
      .returning();
    return result[0];
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await this.db.select().from(users)
      .where(eq(users.resetToken, token));
    return result[0];
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.db.update(users)
      .set({ resetToken: null, resetTokenExpiry: null })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const result = await this.db.update(users)
      .set({ password: newPasswordHash })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // API Key methods
  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return result[0];
  }

  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    return this.db.select().from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const result = await this.db.insert(apiKeys).values(apiKey).returning();
    return result[0];
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  // Client Profile methods
  async getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined> {
    const result = await this.db.select().from(clientProfiles)
      .where(eq(clientProfiles.userId, userId));
    return result[0];
  }

  async getClientProfileByPhoneNumber(phoneNumber: string): Promise<ClientProfile | undefined> {
    const result = await this.db.select().from(clientProfiles)
      .where(sql`${phoneNumber} = ANY(${clientProfiles.assignedPhoneNumbers})`);
    return result[0];
  }

  async createClientProfile(profile: InsertClientProfile): Promise<ClientProfile> {
    // Set default credits if not provided
    const result = await this.db.insert(clientProfiles).values({
      credits: '0.00',
      markup: '0.00',
      assignedPhoneNumbers: [],
      ...profile
    }).returning();
    return result[0];
  }

  async updateClientCredits(userId: string, newCredits: string): Promise<ClientProfile | undefined> {
    const result = await this.db.update(clientProfiles)
      .set({ credits: newCredits })
      .where(eq(clientProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async updateClientPhoneNumbers(userId: string, phoneNumbers: string[]): Promise<ClientProfile | undefined> {
    const result = await this.db.update(clientProfiles)
      .set({ assignedPhoneNumbers: phoneNumbers })
      .where(eq(clientProfiles.userId, userId))
      .returning();
    return result[0];
  }

  // System Config methods
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const result = await this.db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return result[0];
  }

  async setSystemConfig(key: string, value: string): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      const result = await this.db.update(systemConfig)
        .set({ value })
        .where(eq(systemConfig.key, key))
        .returning();
      return result[0];
    } else {
      const result = await this.db.insert(systemConfig)
        .values({ key, value })
        .returning();
      return result[0];
    }
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return this.db.select().from(systemConfig);
  }

  // Message Log methods
  async createMessageLog(log: InsertMessageLog): Promise<MessageLog> {
    const result = await this.db.insert(messageLogs).values(log).returning();
    return result[0];
  }

  async getMessageLogsByUserId(userId: string, limit?: number): Promise<MessageLog[]> {
    let query = this.db.select().from(messageLogs)
      .where(eq(messageLogs.userId, userId))
      .orderBy(desc(messageLogs.createdAt));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  async getMessageLogByMessageId(messageId: string): Promise<MessageLog | undefined> {
    const result = await this.db.select().from(messageLogs)
      .where(eq(messageLogs.messageId, messageId));
    return result[0];
  }

  async getAllMessageLogs(limit?: number): Promise<MessageLog[]> {
    let query = this.db.select().from(messageLogs)
      .orderBy(desc(messageLogs.createdAt));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  // Credit Transaction methods
  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const result = await this.db.insert(creditTransactions).values(transaction).returning();
    return result[0];
  }

  async getCreditTransactionsByUserId(userId: string, limit?: number): Promise<CreditTransaction[]> {
    let query = this.db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  // Incoming Message methods
  async createIncomingMessage(message: InsertIncomingMessage): Promise<IncomingMessage> {
    const result = await this.db.insert(incomingMessages).values(message).returning();
    return result[0];
  }

  async getIncomingMessagesByUserId(userId: string, limit?: number): Promise<IncomingMessage[]> {
    let query = this.db.select().from(incomingMessages)
      .where(eq(incomingMessages.userId, userId))
      .orderBy(desc(incomingMessages.timestamp));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  async getAllIncomingMessages(limit?: number): Promise<IncomingMessage[]> {
    let query = this.db.select().from(incomingMessages)
      .orderBy(desc(incomingMessages.timestamp));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  // Error logging methods
  async getErrorLogs(level?: string): Promise<any[]> {
    const failedLogs = await this.db.select({
      id: messageLogs.id,
      level: sql<string>`'error'`,
      message: sql<string>`'SMS delivery failed'`,
      endpoint: messageLogs.endpoint,
      userId: messageLogs.userId,
      details: messageLogs.responsePayload,
      timestamp: messageLogs.createdAt
    })
    .from(messageLogs)
    .where(eq(messageLogs.status, 'failed'))
    .orderBy(desc(messageLogs.createdAt))
    .limit(100);

    // Join with users to get usernames
    const logsWithUsers = await Promise.all(
      failedLogs.map(async (log) => {
        const user = await this.getUser(log.userId.toString());
        return {
          ...log,
          userName: user?.name || 'Unknown',
          timestamp: log.timestamp.toISOString()
        };
      })
    );

    if (level && level !== 'all') {
      return logsWithUsers.filter(log => log.level === level);
    }

    return logsWithUsers;
  }

  // Stats methods
  async getTotalMessageCount(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(messageLogs);
    return Number(result[0].count);
  }
}

// Use DbStorage if DATABASE_URL available, fallback to MemStorage for local dev
export const storage = process.env.DATABASE_URL 
  ? new DbStorage() 
  : (() => {
      console.warn('⚠️  DATABASE_URL not set - using in-memory storage (data will not persist)');
      return new MemStorage();
    })();
