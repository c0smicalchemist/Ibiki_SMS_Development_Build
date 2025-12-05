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
  type ClientContact,
  type InsertClientContact,
  type ContactGroup,
  type InsertContactGroup,
  type Contact,
  type InsertContact,
  type ActionLog,
  users,
  apiKeys,
  clientProfiles,
  systemConfig,
  messageLogs,
  creditTransactions,
  incomingMessages,
  clientContacts,
  contactGroups,
  contacts,
  actionLogs
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/node-postgres';
import path from 'path';
import { eq, desc, sql } from 'drizzle-orm';
import { Pool } from 'pg';

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
  deleteApiKey(id: string): Promise<void>;
  
  // Client Profile methods
  getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined>;
  getClientProfileByPhoneNumber(phoneNumber: string): Promise<ClientProfile | undefined>;
  createClientProfile(profile: InsertClientProfile): Promise<ClientProfile>;
  updateClientCredits(userId: string, newCredits: string): Promise<ClientProfile | undefined>;
  updateClientPhoneNumbers(userId: string, phoneNumbers: string[]): Promise<ClientProfile | undefined>;
  updateClientRateLimit(userId: string, rateLimitPerMinute: number): Promise<ClientProfile | undefined>;
  updateClientBusinessName(userId: string, businessName: string | null): Promise<ClientProfile | undefined>;
  
  // System Config methods
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(key: string, value: string): Promise<SystemConfig>;
  deleteSystemConfig(key: string): Promise<void>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
  
  // Message Log methods
  createMessageLog(log: InsertMessageLog): Promise<MessageLog>;
  getMessageLogsByUserId(userId: string, limit?: number): Promise<MessageLog[]>;
  getMessageLogByMessageId(messageId: string): Promise<MessageLog | undefined>;
  getAllMessageLogs(limit?: number): Promise<MessageLog[]>;
  updateMessageStatus(logId: string, status: string): Promise<void>;
  findClientBySenderPhone(senderPhone: string): Promise<string | undefined>; // Find userId by sender phone number
  findClientByRecipient(recipientPhone: string): Promise<string | undefined>; // Find userId who sent to this recipient
  
  // Credit Transaction methods
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactionsByUserId(userId: string, limit?: number): Promise<CreditTransaction[]>;
  
  // Incoming Message methods
  createIncomingMessage(message: InsertIncomingMessage): Promise<IncomingMessage>;
  getIncomingMessagesByUserId(userId: string, limit?: number): Promise<IncomingMessage[]>;
  getAllIncomingMessages(limit?: number): Promise<IncomingMessage[]>;
  markIncomingMessageAsRead(messageId: string): Promise<void>;
  markConversationAsRead(userId: string, phoneNumber: string): Promise<void>;
  getConversationHistory(userId: string, phoneNumber: string): Promise<{ incoming: IncomingMessage[]; outgoing: MessageLog[] }>;
  
  // Client Contact methods (for Business field routing)
  createClientContact(contact: InsertClientContact): Promise<ClientContact>;
  createClientContacts(contacts: InsertClientContact[]): Promise<ClientContact[]>;
  getClientContactsByUserId(userId: string): Promise<ClientContact[]>;
  getClientContactByPhone(phoneNumber: string): Promise<ClientContact | undefined>;
  updateClientContact(id: string, updates: Partial<ClientContact>): Promise<ClientContact | undefined>;
  deleteClientContact(id: string): Promise<void>;
  deleteClientContactsByUserId(userId: string): Promise<void>;
  
  // Contact Group methods (address book feature)
  createContactGroup(group: InsertContactGroup): Promise<ContactGroup>;
  getContactGroupsByUserId(userId: string): Promise<ContactGroup[]>;
  getContactGroup(id: string): Promise<ContactGroup | undefined>;
  findContactGroupByCode(code: string): Promise<ContactGroup | undefined>;
  updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined>;
  deleteContactGroup(id: string): Promise<void>;
  
  // Contact methods (address book feature)
  createContact(contact: InsertContact): Promise<Contact>;
  createContactsBulk(contacts: InsertContact[]): Promise<Contact[]>;
  getContactsByUserId(userId: string): Promise<Contact[]>;
  getContactsByGroupId(groupId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<void>;
  deleteContactsByGroupId(groupId: string): Promise<void>;
  deleteAllContactsByUserId(userId: string): Promise<void>;
  markContactsAsExported(contactIds: string[]): Promise<void>; // Mark contacts as synced to ExtremeSMS
  markAllContactsSyncedByUserId(userId: string): Promise<void>; // Mark all contacts for a user as synced
  getSyncStats(userId: string): Promise<{ total: number; synced: number; unsynced: number }>; // Get sync statistics
  
  // Error logging methods
  getErrorLogs(level?: string): Promise<any[]>;
  
  // Stats methods
  getTotalMessageCount(): Promise<number>;
  getMessageStatusStats(userId: string): Promise<{ sent: number; delivered: number; failed: number }>; // Get message status statistics
  
  // Example/Seed data methods
  seedExampleData(userId: string): Promise<void>; // Add example data for new users
  deleteExampleData(userId: string): Promise<void>;
  hasExampleData(userId: string): Promise<boolean>;
  
  // Admin account lifecycle
  disableUser(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private apiKeys: Map<string, ApiKey>;
  private clientProfiles: Map<string, ClientProfile>;
  private systemConfigs: Map<string, SystemConfig>;
  private messageLogs: Map<string, MessageLog>;
  private creditTransactions: Map<string, CreditTransaction>;
  private incomingMessages: Map<string, IncomingMessage>;
  private clientContacts: Map<string, ClientContact>;
  private contactGroups: Map<string, ContactGroup>;
  private contacts: Map<string, Contact>;
  private actionLogs: Map<string, ActionLog>;

  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.clientProfiles = new Map();
    this.systemConfigs = new Map();
    this.messageLogs = new Map();
    this.creditTransactions = new Map();
    this.incomingMessages = new Map();
    this.clientContacts = new Map();
    this.contactGroups = new Map();
    this.contacts = new Map();
    this.actionLogs = new Map();
  }

  async disableUser(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) this.users.set(userId, { ...u, isActive: false });
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    // Remove associated data
    for (const [id, k] of this.apiKeys) if (k.userId === userId) this.apiKeys.delete(id);
    for (const [id, p] of this.clientProfiles) if (p.userId === userId) this.clientProfiles.delete(id);
    for (const [id, c] of this.clientContacts) if (c.userId === userId) this.clientContacts.delete(id);
    for (const [id, g] of this.contactGroups) if (g.userId === userId) this.contactGroups.delete(id);
    for (const [id, c] of this.contacts) if (c.userId === userId) this.contacts.delete(id);
    for (const [id, m] of this.messageLogs) if (m.userId === userId) this.messageLogs.delete(id);
    for (const [id, t] of this.creditTransactions) if (t.userId === userId) this.creditTransactions.delete(id);
    for (const [id, i] of this.incomingMessages) if (i.userId === userId) this.incomingMessages.delete(id);
  }

  async deleteExampleData(userId: string): Promise<void> {
    for (const [id, i] of this.incomingMessages) if (i.userId === userId && i.isExample) this.incomingMessages.delete(id);
    for (const [id, m] of this.messageLogs) if (m.userId === userId && m.isExample) this.messageLogs.delete(id);
    for (const [id, c] of this.contacts) if (c.userId === userId && c.isExample) this.contacts.delete(id);
  }

  async hasExampleData(userId: string): Promise<boolean> {
    for (const i of this.incomingMessages.values()) if (i.userId === userId && i.isExample) return true;
    for (const m of this.messageLogs.values()) if (m.userId === userId && m.isExample) return true;
    for (const c of this.contacts.values()) if (c.userId === userId && c.isExample) return true;
    return false;
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

  async deleteApiKey(id: string): Promise<void> {
    this.apiKeys.delete(id);
  }

  // Client Profile methods
  async getClientProfileByUserId(userId: string): Promise<ClientProfile | undefined> {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.userId === userId,
    );
  }

  async getClientProfileByBusinessName(businessName: string): Promise<ClientProfile | undefined> {
    const target = businessName.trim().toLowerCase();
    return Array.from(this.clientProfiles.values()).find(
      (profile) => (profile.businessName || '').trim().toLowerCase() === target,
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
      rateLimitPerMinute: insertProfile.rateLimitPerMinute ?? 200,
      businessName: insertProfile.businessName ?? null,
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

  async updateClientRateLimit(userId: string, rateLimitPerMinute: number): Promise<ClientProfile | undefined> {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId,
    );
    if (!profile) return undefined;

    profile.rateLimitPerMinute = rateLimitPerMinute;
    profile.updatedAt = new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }

  async updateClientBusinessName(userId: string, businessName: string | null): Promise<ClientProfile | undefined> {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId,
    );
    if (!profile) return undefined;

    profile.businessName = businessName;
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

  async deleteSystemConfig(key: string): Promise<void> {
    const existing = await this.getSystemConfig(key);
    if (!existing) return;
    this.systemConfigs.delete(existing.id);
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
      senderPhoneNumber: insertLog.senderPhoneNumber ?? null,
      requestPayload: insertLog.requestPayload ?? null,
      responsePayload: insertLog.responsePayload ?? null,
      isExample: insertLog.isExample ?? false,
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

  async updateMessageStatus(logId: string, status: string): Promise<void> {
    const log = this.messageLogs.get(logId);
    if (log) {
      log.status = status;
      this.messageLogs.set(logId, log);
    }
  }

  async findClientBySenderPhone(senderPhone: string): Promise<string | undefined> {
    // Find the most recent message sent from this phone number
    const logs = Array.from(this.messageLogs.values())
      .filter(log => log.senderPhoneNumber === senderPhone)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return logs.length > 0 ? logs[0].userId : undefined;
  }

  // DB-backed version defined later

  async getTotalMessageCount(): Promise<number> {
    return this.messageLogs.size;
  }

  async getMessageStatusStats(userId: string): Promise<{ sent: number; delivered: number; failed: number }> {
    const logs = Array.from(this.messageLogs.values())
      .filter((log) => log.userId === userId && !log.isExample);

    const countFor = (log: any) => {
      const mc = Number(log.messageCount);
      if (Number.isFinite(mc) && mc > 0) return mc;
      const rl = Array.isArray(log.recipients) ? log.recipients.length : (log.recipient ? 1 : 0);
      return rl > 0 ? rl : 1;
    };

    const sent = logs.filter((log) => log.status === 'sent' || log.status === 'queued')
      .reduce((acc, log) => acc + countFor(log), 0);
    const delivered = logs.filter((log) => log.status === 'delivered')
      .reduce((acc, log) => acc + countFor(log), 0);
    const failed = logs.filter((log) => log.status === 'failed')
      .reduce((acc, log) => acc + countFor(log), 0);
    
    return { sent, delivered, failed };
  }

  async seedExampleData(userId: string): Promise<void> {
    // Avoid duplicates
    if (await this.hasExampleData(userId)) return;
    // Add one example contact
    await this.createContact({
      userId,
      phoneNumber: '+1-555-0123',
      name: 'Example Contact',
      email: 'example@demo.com',
      notes: 'This is an example contact for demonstration purposes',
      syncedToExtremeSMS: true,
      lastExportedAt: new Date(),
      isExample: true
    });

    // Add example sent/received thread
    await this.createMessageLog({
      userId,
      messageId: 'example-msg-001',
      endpoint: 'send-single',
      recipient: '+1-555-0123',
      status: 'delivered',
      costPerMessage: '0.0050',
      chargePerMessage: '0.0075',
      totalCost: '0.01',
      totalCharge: '0.01',
      messageCount: 1,
      requestPayload: JSON.stringify({ to: '+1-555-0123', message: 'Hello! This is an example message.' }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });

    // Add one example incoming message
    await this.createIncomingMessage({
      userId,
      firstname: 'Alex',
      lastname: 'Demo',
      business: 'Demo Co',
      from: '+1-555-0123',
      message: 'Hi! This is an example incoming message.',
      status: 'received',
      receiver: '+1-555-9999',
      timestamp: new Date(),
      messageId: 'example-incoming-001',
      isRead: false,
      isExample: true
    });
    await this.createMessageLog({
      userId,
      messageId: 'example-msg-002',
      endpoint: 'send-single',
      recipient: '+1-555-0123',
      status: 'delivered',
      costPerMessage: '0.0050',
      chargePerMessage: '0.0075',
      totalCost: '0.01',
      totalCharge: '0.01',
      messageCount: 1,
      requestPayload: JSON.stringify({ to: '+1-555-0123', message: 'Great to hear from you. How can we help?' }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.createIncomingMessage({
      userId,
      firstname: 'Alex',
      lastname: 'Demo',
      business: 'Demo Co',
      from: '+1-555-0123',
      message: 'We would like to confirm our order details.',
      status: 'received',
      receiver: '+1-555-9999',
      timestamp: new Date(),
      messageId: 'example-incoming-002',
      isRead: false,
      isExample: true
    });
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

  // Incoming Message methods (DB-backed only)

  // DB-backed version defined later

  // Client Contact methods (for Business field routing)
  async createClientContact(insertContact: InsertClientContact): Promise<ClientContact> {
    const id = randomUUID();
    const contact: ClientContact = {
      ...insertContact,
      id,
      firstname: insertContact.firstname ?? null,
      lastname: insertContact.lastname ?? null,
      business: insertContact.business ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.clientContacts.set(id, contact);
    return contact;
  }

  async createClientContacts(contacts: InsertClientContact[]): Promise<ClientContact[]> {
    const createdContacts: ClientContact[] = [];
    for (const contact of contacts) {
      const created = await this.createClientContact(contact);
      createdContacts.push(created);
    }
    return createdContacts;
  }

  async getClientContactsByUserId(userId: string): Promise<ClientContact[]> {
    return Array.from(this.clientContacts.values())
      .filter((contact) => contact.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getClientContactByPhone(phoneNumber: string): Promise<ClientContact | undefined> {
    return Array.from(this.clientContacts.values()).find(
      (contact) => contact.phoneNumber === phoneNumber
    );
  }

  async updateClientContact(id: string, updates: Partial<ClientContact>): Promise<ClientContact | undefined> {
    const contact = this.clientContacts.get(id);
    if (!contact) return undefined;
    
    const updated: ClientContact = {
      ...contact,
      ...updates,
      updatedAt: new Date()
    };
    this.clientContacts.set(id, updated);
    return updated;
  }

  async deleteClientContact(id: string): Promise<void> {
    this.clientContacts.delete(id);
  }

  async deleteClientContactsByUserId(userId: string): Promise<void> {
    const contactsToDelete = Array.from(this.clientContacts.entries())
      .filter(([_, contact]) => contact.userId === userId)
      .map(([id, _]) => id);
    
    for (const id of contactsToDelete) {
      this.clientContacts.delete(id);
    }
  }

  // Contact Group methods (address book feature)
  async createContactGroup(insertGroup: InsertContactGroup): Promise<ContactGroup> {
    const id = randomUUID();
    const group: ContactGroup = {
      ...insertGroup,
      id,
      description: insertGroup.description ?? null,
      businessUnitPrefix: insertGroup.businessUnitPrefix ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contactGroups.set(id, group);
    return group;
  }

  async getContactGroupsByUserId(userId: string): Promise<ContactGroup[]> {
    return Array.from(this.contactGroups.values()).filter((group) => group.userId === userId);
  }

  async getContactGroup(id: string): Promise<ContactGroup | undefined> {
    return this.contactGroups.get(id);
  }

  async findContactGroupByCode(code: string): Promise<ContactGroup | undefined> {
    const norm = (s: string | null | undefined) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(code);
    for (const g of this.contactGroups.values()) {
      if (norm(g.id) === target) return g;
      if (norm(g.businessUnitPrefix) === target) return g;
      if (norm(g.name) === target) return g;
    }
    return undefined;
  }

  async updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined> {
    const group = this.contactGroups.get(id);
    if (!group) return undefined;
    const updatedGroup = { ...group, ...updates, updatedAt: new Date() };
    this.contactGroups.set(id, updatedGroup);
    return updatedGroup;
  }

  async deleteContactGroup(id: string): Promise<void> {
    this.contactGroups.delete(id);
  }

  // Contact methods (address book feature)
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = {
      ...insertContact,
      id,
      groupId: insertContact.groupId ?? null,
      name: insertContact.name ?? null,
      email: insertContact.email ?? null,
      notes: insertContact.notes ?? null,
      syncedToExtremeSMS: insertContact.syncedToExtremeSMS ?? false,
      lastExportedAt: insertContact.lastExportedAt ?? null,
      isExample: insertContact.isExample ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async createContactsBulk(insertContacts: InsertContact[]): Promise<Contact[]> {
    const created: Contact[] = [];
    for (const insertContact of insertContacts) {
      const contact = await this.createContact(insertContact);
      created.push(contact);
    }
    return created;
  }

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((contact) => contact.userId === userId);
  }

  async getContactsByGroupId(groupId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((contact) => contact.groupId === groupId);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updatedContact = { ...contact, ...updates, updatedAt: new Date() };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async deleteContact(id: string): Promise<void> {
    this.contacts.delete(id);
  }

  async deleteContactsByGroupId(groupId: string): Promise<void> {
    const contactsToDelete = Array.from(this.contacts.entries())
      .filter(([_, contact]) => contact.groupId === groupId)
      .map(([id, _]) => id);
    
    for (const id of contactsToDelete) {
      this.contacts.delete(id);
    }
  }

  async deleteAllContactsByUserId(userId: string): Promise<void> {
    const ids = Array.from(this.contacts.entries())
      .filter(([_, c]) => c.userId === userId)
      .map(([id]) => id);
    for (const id of ids) this.contacts.delete(id);
  }

  async markContactsAsExported(contactIds: string[]): Promise<void> {
    for (const id of contactIds) {
      const contact = this.contacts.get(id);
      if (contact) {
        this.contacts.set(id, {
          ...contact,
          syncedToExtremeSMS: true,
          lastExportedAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  async markAllContactsSyncedByUserId(userId: string): Promise<void> {
    const now = new Date();
    for (const [id, contact] of this.contacts.entries()) {
      if (contact.userId === userId) {
        this.contacts.set(id, {
          ...contact,
          syncedToExtremeSMS: true,
          lastExportedAt: now,
          updatedAt: now
        });
      }
    }
  }

  async getSyncStats(userId: string): Promise<{ total: number; synced: number; unsynced: number }> {
    const userContacts = Array.from(this.contacts.values()).filter(c => c.userId === userId);
    const total = userContacts.length;
    const synced = userContacts.filter(c => c.syncedToExtremeSMS).length;
    const unsynced = total - synced;
    return { total, synced, unsynced };
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

  // Action logs (audit)
  async createActionLog(log: { actorUserId: string; actorRole: string; targetUserId?: string | null; action: string; details?: string | null; }): Promise<ActionLog> {
    const id = randomUUID();
    const rec: any = {
      id,
      actorUserId: log.actorUserId,
      actorRole: log.actorRole,
      targetUserId: log.targetUserId ?? null,
      action: log.action,
      details: log.details ?? null,
      createdAt: new Date()
    };
    this.actionLogs.set(id, rec);
    return rec as ActionLog;
  }

  async getActionLogs(limit: number = 200): Promise<ActionLog[]> {
    const logs = Array.from(this.actionLogs.values())
      .sort((a, b) => (b.createdAt as any as Date).getTime() - (a.createdAt as any as Date).getTime());
    return logs.slice(0, limit);
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

      const shouldUseSSL = () => {
        if (!connectionString) return false;
        if (process.env.POSTGRES_SSL === 'true') return true;
        return connectionString.includes('sslmode=require') || /neon\.tech|railway/i.test(connectionString);
      };
      const poolOptions: any = { connectionString };
      if (shouldUseSSL()) poolOptions.ssl = { rejectUnauthorized: false };
      poolInstance = new Pool(poolOptions);
      dbInstance = drizzle(poolInstance, {
        schema: {
          users,
          apiKeys,
          clientProfiles,
          systemConfig,
          messageLogs,
          creditTransactions,
          incomingMessages,
          actionLogs
        }
      });
      // Verify connectivity immediately
      poolInstance.query('select 1').catch((err) => {
        console.error('❌ Database connectivity check failed:', err?.message || err);
        throw err;
      });
      // Ensure optional columns exist for backwards compatibility
      poolInstance.query('ALTER TABLE IF NOT EXISTS users ADD COLUMN IF NOT EXISTS group_id text').catch(() => {});
      poolInstance.query('CREATE INDEX IF NOT EXISTS user_group_id_idx ON users(group_id)').catch(() => {});
      // Username column and email nullable for username-only signup
      poolInstance.query('ALTER TABLE IF NOT EXISTS users ADD COLUMN IF NOT EXISTS username text').catch(() => {});
      // Backfill usernames where missing
      poolInstance.query(`UPDATE users SET username = COALESCE(NULLIF(username,''), NULLIF(name,''), split_part(email,'@',1)) WHERE username IS NULL OR username = ''`).catch(() => {});
      // Ensure unique index on username
      poolInstance.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username)').catch(() => {});
      // Allow email to be nullable
      poolInstance.query('ALTER TABLE IF EXISTS users ALTER COLUMN email DROP NOT NULL').catch(() => {});
      
      
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
    try {
      const r = await poolInstance!.query(
        'SELECT id, email, password, name, company, role, is_active, reset_token, reset_token_expiry, created_at FROM users WHERE email=$1 LIMIT 1',
        [email]
      );
      const row = r.rows[0];
      if (!row) return undefined;
      return {
        id: row.id,
        email: row.email,
        password: row.password,
        name: row.name,
        company: row.company,
        role: row.role,
        isActive: row.is_active,
        resetToken: row.reset_token,
        resetTokenExpiry: row.reset_token_expiry,
        createdAt: row.created_at,
        groupId: null
      } as any as User;
    } catch (e: any) {
      console.error('❌ getUserByEmail fallback query failed:', e?.message || e);
      throw e;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const r = await poolInstance!.query(
        'SELECT id, email, username, password, name, company, role, is_active, reset_token, reset_token_expiry, created_at, group_id FROM users WHERE username=$1 LIMIT 1',
        [username]
      );
      const row = r.rows[0];
      if (!row) return undefined;
      return {
        id: row.id,
        email: row.email,
        password: row.password,
        name: row.name,
        company: row.company,
        role: row.role,
        isActive: row.is_active,
        resetToken: row.reset_token,
        resetTokenExpiry: row.reset_token_expiry,
        createdAt: row.created_at,
        groupId: row.group_id,
        username: row.username,
      } as any as User;
    } catch (e: any) {
      console.error('❌ getUserByUsername query failed:', e?.message || e);
      throw e;
    }
  }

  async setUsername(userId: string, username: string): Promise<void> {
    try {
      await poolInstance!.query('UPDATE users SET username=$1 WHERE id=$2', [username, userId]);
    } catch (e: any) {
      console.error('❌ setUsername failed:', e?.message || e);
      throw e;
    }
  }

  async supervisorExistsForGroup(groupId: string): Promise<boolean> {
    try {
      const r = await poolInstance!.query('SELECT 1 FROM users WHERE role=$1 AND group_id=$2 LIMIT 1', ['supervisor', groupId]);
      return !!r.rows[0];
    } catch (e: any) {
      console.error('❌ supervisorExistsForGroup failed:', e?.message || e);
      return false;
    }
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
    const user = result[0];
    if (!user) return undefined;
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      return undefined;
    }
    return user;
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.db.update(users)
      .set({ resetToken: null, resetTokenExpiry: null })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<User | undefined> {
    const result = await this.db.update(users)
      .set({ password: newPasswordHash, resetToken: null, resetTokenExpiry: null })
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
    await this.db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string): Promise<void> {
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

  async getClientProfileByBusinessName(businessName: string): Promise<ClientProfile | undefined> {
    const target = businessName.trim();
    const result = await this.db.select().from(clientProfiles)
      .where(sql`LOWER(${clientProfiles.businessName}) = LOWER(${target})`)
      .limit(1);
    return result[0];
  }

  async createClientProfile(profile: InsertClientProfile): Promise<ClientProfile> {
    // Set default credits if not provided
    const result = await this.db.insert(clientProfiles).values({
      credits: '0.00',
      customMarkup: '0.00',
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

  async updateClientRateLimit(userId: string, rateLimitPerMinute: number): Promise<ClientProfile | undefined> {
    const result = await this.db.update(clientProfiles)
      .set({ rateLimitPerMinute: rateLimitPerMinute, updatedAt: new Date() })
      .where(eq(clientProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async updateClientBusinessName(userId: string, businessName: string | null): Promise<ClientProfile | undefined> {
    const result = await this.db.update(clientProfiles)
      .set({ businessName: businessName, updatedAt: new Date() })
      .where(eq(clientProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async setClientDeliveryMode(userId: string, mode: string): Promise<void> {
    await this.db.update(clientProfiles)
      .set({ deliveryMode: mode, updatedAt: new Date() })
      .where(eq(clientProfiles.userId, userId));
  }

  async setClientWebhook(userId: string, url: string | null, secret: string | null): Promise<void> {
    await this.db.update(clientProfiles)
      .set({ webhookUrl: url, webhookSecret: secret, updatedAt: new Date() })
      .where(eq(clientProfiles.userId, userId));
  }

  async getLastInboundForUserAndRecipient(userId: string, recipient: string): Promise<IncomingMessage | undefined> {
    const result = await this.db.select().from(incomingMessages)
      .where(sql`${incomingMessages.userId} = ${userId} AND ${incomingMessages.from} = ${recipient}`)
      .orderBy(desc(incomingMessages.timestamp))
      .limit(1);
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

  async deleteSystemConfig(key: string): Promise<void> {
    await this.db.delete(systemConfig).where(eq(systemConfig.key, key));
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

  async updateMessageStatus(logId: string, status: string): Promise<void> {
    await this.db.update(messageLogs)
      .set({ status })
      .where(eq(messageLogs.id, logId));
  }

  async findClientBySenderPhone(senderPhone: string): Promise<string | undefined> {
    // Find the most recent message sent from this phone number
    const result = await this.db.select()
      .from(messageLogs)
      .where(eq(messageLogs.senderPhoneNumber, senderPhone))
      .orderBy(desc(messageLogs.createdAt))
      .limit(1);
    
    return result.length > 0 ? result[0].userId : undefined;
  }

  async findClientByRecipient(recipientPhone: string): Promise<string | undefined> {
    // Find the most recent message sent TO this recipient phone number
    // This is used for conversation tracking: if client sent to this number, route replies to them
    const result = await this.db.select()
      .from(messageLogs)
      .where(
        sql`${messageLogs.recipient} = ${recipientPhone} OR ${recipientPhone} = ANY(${messageLogs.recipients})`
      )
      .orderBy(desc(messageLogs.createdAt))
      .limit(1);
    
    return result.length > 0 ? result[0].userId : undefined;
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

  async markIncomingMessageAsRead(messageId: string): Promise<void> {
    await this.db.update(incomingMessages)
      .set({ isRead: true })
      .where(eq(incomingMessages.id, messageId));
  }

  async markConversationAsRead(userId: string, phoneNumber: string): Promise<void> {
    await this.db.update(incomingMessages)
      .set({ isRead: true })
      .where(
        sql`
          ${incomingMessages.userId} = ${userId}
          AND (
            ${incomingMessages.from} = ${phoneNumber}
            OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
            OR ('1' || regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
          )
        `
      );
  }

  async getIncomingMessagesWithMissingUserId(limit: number): Promise<IncomingMessage[]> {
    let query = this.db.select().from(incomingMessages)
      .where(sql`${incomingMessages.userId} IS NULL AND ${incomingMessages.business} IS NOT NULL`)
      .orderBy(desc(incomingMessages.createdAt));
    if (limit) query = query.limit(limit) as any;
    return query;
  }

  async updateIncomingMessageUserId(id: string, userId: string): Promise<void> {
    await this.db.update(incomingMessages)
      .set({ userId })
      .where(eq(incomingMessages.id, id));
  }

  async getConversationHistory(userId: string, phoneNumber: string): Promise<{ incoming: IncomingMessage[]; outgoing: MessageLog[] }> {
    const incoming = await this.db.select()
      .from(incomingMessages)
      .where(
        sql`
          (
            ${incomingMessages.userId} = ${userId}
            AND (
              ${incomingMessages.from} = ${phoneNumber}
              OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
              OR regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
              OR ('1' || regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR ('1' || regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            )
          )
          OR (
            ${incomingMessages.userId} IS NULL
            AND (
              ${incomingMessages.from} = ${phoneNumber}
              OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
              OR regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
              OR ('1' || regexp_replace(${incomingMessages.from}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR ('1' || regexp_replace(${incomingMessages.receiver}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            )
            AND EXISTS (
              SELECT 1 FROM client_profiles cp
              WHERE cp.user_id = ${userId}
              AND incoming_messages.receiver = ANY(cp.assigned_phone_numbers)
            )
          )
          OR (
            ${incomingMessages.userId} IS NULL
            AND EXISTS (
              SELECT 1 FROM client_profiles cp
              WHERE cp.user_id = ${userId}
              AND LOWER(incoming_messages.business) = LOWER(cp.business_name)
            )
          )
        `
      )
      .orderBy(incomingMessages.timestamp);
    
    const outgoing = await this.db.select()
      .from(messageLogs)
      .where(
        sql`
          ${messageLogs.userId} = ${userId}
          AND (
            ${messageLogs.recipient} = ${phoneNumber}
            OR regexp_replace(${messageLogs.recipient}, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            OR regexp_replace(${messageLogs.recipient}, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
            OR ('1' || regexp_replace(${messageLogs.recipient}, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            OR ${phoneNumber} = ANY(${messageLogs.recipients})
            OR EXISTS (
              SELECT 1 FROM unnest(COALESCE(${messageLogs.recipients}, '{}'::text[])) r
              WHERE regexp_replace(r, '[^0-9]', '', 'g') = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
              OR regexp_replace(r, '[^0-9]', '', 'g') = ('1' || regexp_replace(${phoneNumber}, '[^0-9]', '', 'g'))
              OR ('1' || regexp_replace(r, '[^0-9]', '', 'g')) = regexp_replace(${phoneNumber}, '[^0-9]', '', 'g')
            )
          )
        `
      )
      .orderBy(messageLogs.createdAt);
    
    if (incoming.length === 0 && outgoing.length === 0) {
      try {
        const digits = String(phoneNumber).replace(/[^0-9]/g, '');
        const incR = await poolInstance!.query(
          `SELECT id, user_id AS "userId", "from" AS "from", firstname, lastname, business, message, status, receiver, timestamp, message_id AS "messageId", is_read AS "isRead", usedmodem, port
           FROM incoming_messages
           WHERE (
             regexp_replace("from", '[^0-9]', '', 'g') = $1
             OR regexp_replace(receiver, '[^0-9]', '', 'g') = $1
           )
           ORDER BY timestamp ASC`,
          [digits]
        );
        const outR = await poolInstance!.query(
          `SELECT id, user_id AS "userId", recipient, recipients, request_payload AS "requestPayload", response_payload AS "responsePayload", created_at AS "createdAt", status, message_id AS "messageId", sender_phone_number AS "senderPhoneNumber", endpoint
           FROM message_logs
           WHERE (
             regexp_replace(recipient, '[^0-9]', '', 'g') = $1
             OR EXISTS (SELECT 1 FROM unnest(COALESCE(recipients, '{}'::text[])) r WHERE regexp_replace(r, '[^0-9]', '', 'g') = $1)
           )
           ORDER BY created_at ASC`,
          [digits]
        );
        const incF = incR.rows as any as IncomingMessage[];
        const outF = outR.rows as any as MessageLog[];
        return { incoming: incF, outgoing: outF };
      } catch {}
    }
    return { incoming, outgoing };
  }

  // Client Contact methods (for Business field routing)
  async createClientContact(contact: InsertClientContact): Promise<ClientContact> {
    const result = await this.db.insert(clientContacts).values(contact).returning();
    return result[0];
  }

  async createClientContacts(contacts: InsertClientContact[]): Promise<ClientContact[]> {
    if (contacts.length === 0) return [];
    const result = await this.db.insert(clientContacts).values(contacts).returning();
    return result;
  }

  async getClientContactsByUserId(userId: string): Promise<ClientContact[]> {
    return this.db.select().from(clientContacts)
      .where(eq(clientContacts.userId, userId))
      .orderBy(desc(clientContacts.createdAt));
  }

  async getClientContactByPhone(phoneNumber: string): Promise<ClientContact | undefined> {
    const result = await this.db.select().from(clientContacts)
      .where(eq(clientContacts.phoneNumber, phoneNumber))
      .limit(1);
    return result[0];
  }

  async updateClientContact(id: string, updates: Partial<ClientContact>): Promise<ClientContact | undefined> {
    const result = await this.db.update(clientContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientContacts.id, id))
      .returning();
    return result[0];
  }

  async deleteClientContact(id: string): Promise<void> {
    await this.db.delete(clientContacts).where(eq(clientContacts.id, id));
  }

  async deleteClientContactsByUserId(userId: string): Promise<void> {
    await this.db.delete(clientContacts).where(eq(clientContacts.userId, userId));
  }

  // Contact Group methods (address book feature)
  async createContactGroup(insertGroup: InsertContactGroup): Promise<ContactGroup> {
    const result = await this.db.insert(contactGroups).values(insertGroup).returning();
    return result[0];
  }

  async getContactGroupsByUserId(userId: string): Promise<ContactGroup[]> {
    return this.db.select().from(contactGroups).where(eq(contactGroups.userId, userId));
  }

  async getContactGroup(id: string): Promise<ContactGroup | undefined> {
    const result = await this.db.select().from(contactGroups).where(eq(contactGroups.id, id));
    return result[0];
  }

  async findContactGroupByCode(code: string): Promise<ContactGroup | undefined> {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = normalize(String(code));
    const result = await this.db.select().from(contactGroups)
      .where(sql`
        LOWER(regexp_replace(${contactGroups.id}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
        OR LOWER(regexp_replace(${contactGroups.businessUnitPrefix}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
        OR LOWER(regexp_replace(${contactGroups.name}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
      `)
      .limit(1);
    return result[0];
  }

  async updateContactGroup(id: string, updates: Partial<ContactGroup>): Promise<ContactGroup | undefined> {
    const result = await this.db.update(contactGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contactGroups.id, id))
      .returning();
    return result[0];
  }

  async deleteContactGroup(id: string): Promise<void> {
    await this.db.delete(contactGroups).where(eq(contactGroups.id, id));
  }

  // Contact methods (address book feature)
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const result = await this.db.insert(contacts).values(insertContact).returning();
    return result[0];
  }

  async createContactsBulk(insertContacts: InsertContact[]): Promise<Contact[]> {
    if (insertContacts.length === 0) return [];
    const result = await this.db.insert(contacts).values(insertContacts).returning();
    return result;
  }

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    return this.db.select().from(contacts).where(eq(contacts.userId, userId));
  }

  async getContactsByGroupId(groupId: string): Promise<Contact[]> {
    return this.db.select().from(contacts).where(eq(contacts.groupId, groupId));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const result = await this.db.update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.delete(contacts).where(eq(contacts.id, id));
  }

  async deleteContactsByGroupId(groupId: string): Promise<void> {
    await this.db.delete(contacts).where(eq(contacts.groupId, groupId));
  }

  async deleteAllContactsByUserId(userId: string): Promise<void> {
    await this.db.delete(contacts).where(eq(contacts.userId, userId));
  }

  async markContactsAsExported(contactIds: string[]): Promise<void> {
    if (contactIds.length === 0) return;
    await this.db.update(contacts)
      .set({ 
        syncedToExtremeSMS: true,
        lastExportedAt: new Date(),
        updatedAt: new Date()
      })
      .where(sql`${contacts.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`, `)})`);
  }

  async markAllContactsSyncedByUserId(userId: string): Promise<void> {
    await this.db.update(contacts)
      .set({
        syncedToExtremeSMS: true,
        lastExportedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(contacts.userId, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete related records first to avoid FK constraint errors
    await this.db.delete(apiKeys).where(eq(apiKeys.userId, userId));
    await this.db.delete(clientProfiles).where(eq(clientProfiles.userId, userId));
    await this.db.delete(incomingMessages).where(eq(incomingMessages.userId, userId));
    await this.db.delete(messageLogs).where(eq(messageLogs.userId, userId));
    await this.db.delete(creditTransactions).where(eq(creditTransactions.userId, userId));
    await this.db.delete(contacts).where(eq(contacts.userId, userId));
    await this.db.delete(contactGroups).where(eq(contactGroups.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async getSyncStats(userId: string): Promise<{ total: number; synced: number; unsynced: number }> {
    const allContacts = await this.db.select().from(contacts).where(eq(contacts.userId, userId));
    const total = allContacts.length;
    const synced = allContacts.filter(c => c.syncedToExtremeSMS).length;
    const unsynced = total - synced;
    return { total, synced, unsynced };
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

  // Action logs (audit)
  async createActionLog(log: { actorUserId: string; actorRole: string; targetUserId?: string | null; action: string; details?: string | null; }): Promise<ActionLog> {
    const result = await this.db.insert(actionLogs).values({
      actorUserId: log.actorUserId,
      actorRole: log.actorRole,
      targetUserId: log.targetUserId ?? null,
      action: log.action,
      details: log.details ?? null,
    }).returning();
    return result[0];
  }

  async getActionLogs(limit: number = 200): Promise<ActionLog[]> {
    let query = this.db.select().from(actionLogs).orderBy(desc(actionLogs.createdAt));
    if (limit) query = (query as any).limit(limit);
    return query;
  }

  async getLastActionForTarget(targetUserId: string, action: string): Promise<ActionLog | undefined> {
    const result = await this.db.select().from(actionLogs)
      .where(sql`${actionLogs.targetUserId} = ${targetUserId} AND ${actionLogs.action} = ${action}`)
      .orderBy(desc(actionLogs.createdAt))
      .limit(1);
    return result[0];
  }

  // Stats methods
  async getTotalMessageCount(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(messageLogs);
    return Number(result[0].count);
  }

  async getMessageStatusStats(userId: string): Promise<{ sent: number; delivered: number; failed: number }> {
    const logs = await this.db.select().from(messageLogs)
      .where(sql`${messageLogs.userId} = ${userId} AND ${messageLogs.isExample} = false`);

    const countFor = (log: any) => {
      const mc = Number(log.messageCount);
      if (Number.isFinite(mc) && mc > 0) return mc;
      const rl = Array.isArray(log.recipients) ? log.recipients.length : (log.recipient ? 1 : 0);
      return rl > 0 ? rl : 1;
    };

    const sent = logs.filter((log) => log.status === 'sent' || log.status === 'queued')
      .reduce((acc, log) => acc + countFor(log), 0);
    const delivered = logs.filter((log) => log.status === 'delivered')
      .reduce((acc, log) => acc + countFor(log), 0);
    const failed = logs.filter((log) => log.status === 'failed')
      .reduce((acc, log) => acc + countFor(log), 0);
    
    return { sent, delivered, failed };
  }

  async seedExampleData(userId: string): Promise<void> {
    const existsInc = await this.db.select().from(incomingMessages).where(sql`${incomingMessages.userId} = ${userId} AND ${incomingMessages.isExample} = true`).limit(1);
    const existsLogs = await this.db.select().from(messageLogs).where(sql`${messageLogs.userId} = ${userId} AND ${messageLogs.isExample} = true`).limit(1);
    if (existsInc.length > 0 || existsLogs.length > 0) return;
    // Add one example contact
    await this.db.insert(contacts).values({
      userId,
      phoneNumber: '+1-555-0123',
      name: 'Example Contact',
      email: 'example@demo.com',
      notes: 'This is an example contact for demonstration purposes',
      syncedToExtremeSMS: true,
      lastExportedAt: new Date(),
      isExample: true
    });

    // Add example sent/received thread
    await this.db.insert(messageLogs).values({
      userId,
      messageId: 'example-msg-001',
      endpoint: 'send-single',
      recipient: '+1-555-0123',
      status: 'delivered',
      costPerMessage: '0.0050',
      chargePerMessage: '0.0075',
      totalCost: '0.01',
      totalCharge: '0.01',
      messageCount: 1,
      requestPayload: JSON.stringify({ to: '+1-555-0123', message: 'Hello! This is an example message.' }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });

    // Add one example incoming message
    await this.db.insert(incomingMessages).values({
      userId,
      firstname: 'Alex',
      lastname: 'Demo',
      business: 'Demo Co',
      from: '+1-555-0123',
      message: 'Hi! This is an example incoming message.',
      status: 'received',
      receiver: '+1-555-9999',
      timestamp: new Date(),
      messageId: 'example-incoming-001',
      isRead: false,
      isExample: true
    });
    await this.db.insert(messageLogs).values({
      userId,
      messageId: 'example-msg-002',
      endpoint: 'send-single',
      recipient: '+1-555-0123',
      status: 'delivered',
      costPerMessage: '0.0050',
      chargePerMessage: '0.0075',
      totalCost: '0.01',
      totalCharge: '0.01',
      messageCount: 1,
      requestPayload: JSON.stringify({ to: '+1-555-0123', message: 'Great to hear from you. How can we help?' }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.db.insert(incomingMessages).values({
      userId,
      firstname: 'Alex',
      lastname: 'Demo',
      business: 'Demo Co',
      from: '+1-555-0123',
      message: 'We would like to confirm our order details.',
      status: 'received',
      receiver: '+1-555-9999',
      timestamp: new Date(),
      messageId: 'example-incoming-002',
      isRead: false,
      isExample: true
    });
  }
}

// Lazy initialization to ensure environment variables are loaded
let storageInstance: IStorage | null = null;

function initializeStorage(): IStorage {
  if (storageInstance) {
    return storageInstance;
  }

  if (process.env.DATABASE_URL) {
    const dbStorage = new DbStorage();
    console.log('✅ Using PostgreSQL database storage');
    console.log(`✅ Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] || 'connected'}`);
    storageInstance = dbStorage;
  } else {
    console.warn('⚠️  DATABASE_URL not set - using in-memory storage (data will not persist)');
    storageInstance = new MemStorage();
  }

  return storageInstance;
}

// Export a getter that initializes storage on first access
export const storage = new Proxy({} as IStorage, {
  get(target, prop) {
    const instance = initializeStorage();
    return (instance as any)[prop];
  }
});
