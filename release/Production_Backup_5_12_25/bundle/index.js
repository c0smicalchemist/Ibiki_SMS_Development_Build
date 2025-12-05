// server/index.ts
import dotenv from "dotenv";
import express2 from "express";
import fs from "fs";
import path from "path";

// server/routes.ts
import { createServer } from "http";
import express from "express";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  // bcrypt hashed
  name: text("name").notNull(),
  company: text("company"),
  role: text("role").notNull().default("client"),
  // "admin" | "supervisor" | "client"
  groupId: text("group_id"),
  isActive: boolean("is_active").notNull().default(true),
  resetToken: text("reset_token"),
  // Password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"),
  // Token expiration time
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  resetTokenIdx: index("reset_token_idx").on(table.resetToken),
  groupIdIdx: index("user_group_id_idx").on(table.groupId)
}));
var apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(),
  // First 8 chars for display (e.g., "ibk_live_")
  keySuffix: text("key_suffix").notNull(),
  // Last 4 chars for display
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at")
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  keyHashIdx: index("key_hash_idx").on(table.keyHash)
}));
var clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  credits: decimal("credits", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  customMarkup: decimal("custom_markup", { precision: 10, scale: 4 }),
  // Optional custom markup for this client
  assignedPhoneNumbers: text("assigned_phone_numbers").array(),
  // Array of phone numbers assigned to this client for routing incoming SMS
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(200),
  // Max messages per minute
  businessName: text("business_name"),
  deliveryMode: text("delivery_mode").default("poll"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  messageId: text("message_id").notNull(),
  // ExtremeSMS message ID
  endpoint: text("endpoint").notNull(),
  // Which endpoint was called
  recipient: text("recipient"),
  recipients: text("recipients").array(),
  // For bulk messages
  senderPhoneNumber: text("sender_phone_number"),
  // Phone number used to SEND this message (for 2-way SMS routing)
  status: text("status").notNull(),
  // queued, sent, delivered, failed
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull(),
  // What ExtremeSMS charged
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }).notNull(),
  // What we charged the client
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  requestPayload: text("request_payload"),
  // JSON string
  responsePayload: text("response_payload"),
  // JSON string
  isExample: boolean("is_example").notNull().default(false),
  // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("message_user_id_idx").on(table.userId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
  messageIdIdx: index("message_id_idx").on(table.messageId),
  senderPhoneIdx: index("message_sender_phone_idx").on(table.senderPhoneNumber),
  isExampleIdx: index("message_is_example_idx").on(table.isExample)
}));
var creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  // "credit", "debit", "adjustment"
  description: text("description").notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  messageLogId: varchar("message_log_id").references(() => messageLogs.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("transaction_user_id_idx").on(table.userId),
  createdAtIdx: index("transaction_created_at_idx").on(table.createdAt)
}));
var incomingMessages = pgTable("incoming_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  // Assigned client, null if unassigned
  from: text("from").notNull(),
  // Sender phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  message: text("message").notNull(),
  status: text("status").notNull(),
  // "received" or "blocked"
  matchedBlockWord: text("matched_block_word"),
  receiver: text("receiver").notNull(),
  // Your phone number that received the SMS
  usedmodem: text("usedmodem"),
  port: text("port"),
  extPayload: jsonb("ext_payload"),
  timestamp: timestamp("timestamp").notNull(),
  // From ExtremeSMS
  messageId: text("message_id").notNull(),
  // ExtremeSMS message ID
  isRead: boolean("is_read").notNull().default(false),
  // Track if message has been read
  isExample: boolean("is_example").notNull().default(false),
  // Mark as example data for UI preview
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("incoming_user_id_idx").on(table.userId),
  receiverIdx: index("incoming_receiver_idx").on(table.receiver),
  timestampIdx: index("incoming_timestamp_idx").on(table.timestamp),
  messageIdIdx: index("incoming_message_id_idx").on(table.messageId),
  fromIdx: index("incoming_from_idx").on(table.from),
  isExampleIdx: index("incoming_is_example_idx").on(table.isExample)
}));
var clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  // Customer phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  // Should contain client_id for routing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("contact_user_id_idx").on(table.userId),
  phoneIdx: index("contact_phone_idx").on(table.phoneNumber),
  businessIdx: index("contact_business_idx").on(table.business),
  phoneUserIdx: index("contact_phone_user_idx").on(table.phoneNumber, table.userId)
}));
var contactGroups = pgTable("contact_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  businessUnitPrefix: text("business_unit_prefix"),
  // Prefix for CSV export (e.g., "IBS", "SALES")
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("group_user_id_idx").on(table.userId)
}));
var contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").references(() => contactGroups.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  email: text("email"),
  notes: text("notes"),
  syncedToExtremeSMS: boolean("synced_to_extremesms").notNull().default(false),
  // Track if exported to ExtremeSMS
  lastExportedAt: timestamp("last_exported_at"),
  // When this contact was last exported
  isExample: boolean("is_example").notNull().default(false),
  // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => ({
  userIdIdx: index("contacts_user_id_idx").on(table.userId),
  groupIdIdx: index("contacts_group_id_idx").on(table.groupId),
  phoneIdx: index("contacts_phone_idx").on(table.phoneNumber),
  syncedIdx: index("contacts_synced_idx").on(table.syncedToExtremeSMS),
  isExampleIdx: index("contacts_is_example_idx").on(table.isExample)
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true
});
var insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  updatedAt: true
});
var insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true
});
var insertMessageLogSchema = createInsertSchema(messageLogs).omit({
  id: true,
  createdAt: true
});
var insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true
});
var insertIncomingMessageSchema = createInsertSchema(incomingMessages).omit({
  id: true,
  createdAt: true
});
var insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertContactGroupSchema = createInsertSchema(contactGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var actionLogs = pgTable("action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  actorRole: text("actor_role").notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  actorIdx: index("action_actor_idx").on(table.actorUserId),
  createdIdx: index("action_created_idx").on(table.createdAt)
}));

// server/storage.ts
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sql as sql2 } from "drizzle-orm";
import { Pool } from "pg";
var MemStorage = class {
  users;
  apiKeys;
  clientProfiles;
  systemConfigs;
  messageLogs;
  creditTransactions;
  incomingMessages;
  clientContacts;
  contactGroups;
  contacts;
  actionLogs;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.apiKeys = /* @__PURE__ */ new Map();
    this.clientProfiles = /* @__PURE__ */ new Map();
    this.systemConfigs = /* @__PURE__ */ new Map();
    this.messageLogs = /* @__PURE__ */ new Map();
    this.creditTransactions = /* @__PURE__ */ new Map();
    this.incomingMessages = /* @__PURE__ */ new Map();
    this.clientContacts = /* @__PURE__ */ new Map();
    this.contactGroups = /* @__PURE__ */ new Map();
    this.contacts = /* @__PURE__ */ new Map();
    this.actionLogs = /* @__PURE__ */ new Map();
  }
  async disableUser(userId) {
    const u = this.users.get(userId);
    if (u) this.users.set(userId, { ...u, isActive: false });
  }
  async deleteUser(userId) {
    this.users.delete(userId);
    for (const [id, k] of this.apiKeys) if (k.userId === userId) this.apiKeys.delete(id);
    for (const [id, p] of this.clientProfiles) if (p.userId === userId) this.clientProfiles.delete(id);
    for (const [id, c] of this.clientContacts) if (c.userId === userId) this.clientContacts.delete(id);
    for (const [id, g] of this.contactGroups) if (g.userId === userId) this.contactGroups.delete(id);
    for (const [id, c] of this.contacts) if (c.userId === userId) this.contacts.delete(id);
    for (const [id, m] of this.messageLogs) if (m.userId === userId) this.messageLogs.delete(id);
    for (const [id, t] of this.creditTransactions) if (t.userId === userId) this.creditTransactions.delete(id);
    for (const [id, i] of this.incomingMessages) if (i.userId === userId) this.incomingMessages.delete(id);
  }
  async deleteExampleData(userId) {
    for (const [id, i] of this.incomingMessages) if (i.userId === userId && i.isExample) this.incomingMessages.delete(id);
    for (const [id, m] of this.messageLogs) if (m.userId === userId && m.isExample) this.messageLogs.delete(id);
    for (const [id, c] of this.contacts) if (c.userId === userId && c.isExample) this.contacts.delete(id);
  }
  async hasExampleData(userId) {
    for (const i of this.incomingMessages.values()) if (i.userId === userId && i.isExample) return true;
    for (const m of this.messageLogs.values()) if (m.userId === userId && m.isExample) return true;
    for (const c of this.contacts.values()) if (c.userId === userId && c.isExample) return true;
    return false;
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const isFirstUser = this.users.size === 0;
    const user = {
      ...insertUser,
      id,
      company: insertUser.company ?? null,
      role: isFirstUser ? "admin" : insertUser.role ?? "client",
      isActive: insertUser.isActive ?? true,
      resetToken: null,
      resetTokenExpiry: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    return user;
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return void 0;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  // Password Reset methods
  async setPasswordResetToken(email, token, expiry) {
    const user = await this.getUserByEmail(email);
    if (!user) return void 0;
    return this.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry
    });
  }
  async getUserByResetToken(token) {
    const user = Array.from(this.users.values()).find(
      (u) => u.resetToken === token
    );
    if (!user) return void 0;
    if (user.resetTokenExpiry && user.resetTokenExpiry < /* @__PURE__ */ new Date()) {
      return void 0;
    }
    return user;
  }
  async clearPasswordResetToken(userId) {
    await this.updateUser(userId, {
      resetToken: null,
      resetTokenExpiry: null
    });
  }
  async updateUserPassword(userId, newPasswordHash) {
    const user = await this.getUser(userId);
    if (!user) return void 0;
    const updatedUser = await this.updateUser(userId, {
      password: newPasswordHash,
      resetToken: null,
      resetTokenExpiry: null
    });
    return updatedUser;
  }
  // API Key methods
  async getApiKeyByHash(keyHash) {
    return Array.from(this.apiKeys.values()).find(
      (key) => key.keyHash === keyHash
    );
  }
  async getApiKeysByUserId(userId) {
    return Array.from(this.apiKeys.values()).filter(
      (key) => key.userId === userId
    );
  }
  async createApiKey(insertApiKey) {
    const id = randomUUID();
    const apiKey = {
      ...insertApiKey,
      id,
      isActive: insertApiKey.isActive ?? true,
      createdAt: /* @__PURE__ */ new Date(),
      lastUsedAt: null
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }
  async updateApiKeyLastUsed(id) {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsedAt = /* @__PURE__ */ new Date();
      this.apiKeys.set(id, apiKey);
    }
  }
  async revokeApiKey(id) {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.isActive = false;
      this.apiKeys.set(id, apiKey);
    }
  }
  async deleteApiKey(id) {
    this.apiKeys.delete(id);
  }
  // Client Profile methods
  async getClientProfileByUserId(userId) {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.userId === userId
    );
  }
  async getClientProfileByBusinessName(businessName) {
    const target = businessName.trim().toLowerCase();
    return Array.from(this.clientProfiles.values()).find(
      (profile) => (profile.businessName || "").trim().toLowerCase() === target
    );
  }
  async createClientProfile(insertProfile) {
    const id = randomUUID();
    const profile = {
      ...insertProfile,
      id,
      credits: insertProfile.credits ?? "0.00",
      currency: insertProfile.currency ?? "USD",
      customMarkup: insertProfile.customMarkup ?? null,
      assignedPhoneNumbers: insertProfile.assignedPhoneNumbers ?? null,
      rateLimitPerMinute: insertProfile.rateLimitPerMinute ?? 200,
      businessName: insertProfile.businessName ?? null,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientProfiles.set(id, profile);
    return profile;
  }
  async getClientProfileByPhoneNumber(phoneNumber) {
    return Array.from(this.clientProfiles.values()).find(
      (profile) => profile.assignedPhoneNumbers?.includes(phoneNumber)
    );
  }
  async updateClientCredits(userId, newCredits) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.credits = newCredits;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  async updateClientPhoneNumbers(userId, phoneNumbers) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.assignedPhoneNumbers = phoneNumbers.length > 0 ? phoneNumbers : null;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  async updateClientRateLimit(userId, rateLimitPerMinute) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.rateLimitPerMinute = rateLimitPerMinute;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  async updateClientBusinessName(userId, businessName) {
    const profile = Array.from(this.clientProfiles.values()).find(
      (p) => p.userId === userId
    );
    if (!profile) return void 0;
    profile.businessName = businessName;
    profile.updatedAt = /* @__PURE__ */ new Date();
    this.clientProfiles.set(profile.id, profile);
    return profile;
  }
  // System Config methods
  async getSystemConfig(key) {
    return Array.from(this.systemConfigs.values()).find(
      (config) => config.key === key
    );
  }
  async setSystemConfig(key, value) {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      existing.value = value;
      existing.updatedAt = /* @__PURE__ */ new Date();
      this.systemConfigs.set(existing.id, existing);
      return existing;
    }
    const id = randomUUID();
    const config = {
      id,
      key,
      value,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.systemConfigs.set(id, config);
    return config;
  }
  async deleteSystemConfig(key) {
    const existing = await this.getSystemConfig(key);
    if (!existing) return;
    this.systemConfigs.delete(existing.id);
  }
  async getAllSystemConfig() {
    return Array.from(this.systemConfigs.values());
  }
  // Message Log methods
  async createMessageLog(insertLog) {
    const id = randomUUID();
    const log2 = {
      ...insertLog,
      id,
      messageCount: insertLog.messageCount ?? 1,
      recipients: insertLog.recipients ?? null,
      recipient: insertLog.recipient ?? null,
      senderPhoneNumber: insertLog.senderPhoneNumber ?? null,
      requestPayload: insertLog.requestPayload ?? null,
      responsePayload: insertLog.responsePayload ?? null,
      isExample: insertLog.isExample ?? false,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.messageLogs.set(id, log2);
    return log2;
  }
  async getMessageLogsByUserId(userId, limit = 100) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => log2.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }
  async getMessageLogByMessageId(messageId) {
    return Array.from(this.messageLogs.values()).find(
      (log2) => log2.messageId === messageId
    );
  }
  async getAllMessageLogs(limit = 1e3) {
    const logs = Array.from(this.messageLogs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }
  async updateMessageStatus(logId, status) {
    const log2 = this.messageLogs.get(logId);
    if (log2) {
      log2.status = status;
      this.messageLogs.set(logId, log2);
    }
  }
  async findClientBySenderPhone(senderPhone) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => log2.senderPhoneNumber === senderPhone).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.length > 0 ? logs[0].userId : void 0;
  }
  // DB-backed version defined later
  async getTotalMessageCount() {
    return this.messageLogs.size;
  }
  async getMessageStatusStats(userId) {
    const logs = Array.from(this.messageLogs.values()).filter((log2) => log2.userId === userId && !log2.isExample);
    const countFor = (log2) => {
      const mc = Number(log2.messageCount);
      if (Number.isFinite(mc) && mc > 0) return mc;
      const rl = Array.isArray(log2.recipients) ? log2.recipients.length : log2.recipient ? 1 : 0;
      return rl > 0 ? rl : 1;
    };
    const sent = logs.filter((log2) => log2.status === "sent" || log2.status === "queued").reduce((acc, log2) => acc + countFor(log2), 0);
    const delivered = logs.filter((log2) => log2.status === "delivered").reduce((acc, log2) => acc + countFor(log2), 0);
    const failed = logs.filter((log2) => log2.status === "failed").reduce((acc, log2) => acc + countFor(log2), 0);
    return { sent, delivered, failed };
  }
  async seedExampleData(userId) {
    if (await this.hasExampleData(userId)) return;
    await this.createContact({
      userId,
      phoneNumber: "+1-555-0123",
      name: "Example Contact",
      email: "example@demo.com",
      notes: "This is an example contact for demonstration purposes",
      syncedToExtremeSMS: true,
      lastExportedAt: /* @__PURE__ */ new Date(),
      isExample: true
    });
    await this.createMessageLog({
      userId,
      messageId: "example-msg-001",
      endpoint: "send-single",
      recipient: "+1-555-0123",
      status: "delivered",
      costPerMessage: "0.0050",
      chargePerMessage: "0.0075",
      totalCost: "0.01",
      totalCharge: "0.01",
      messageCount: 1,
      requestPayload: JSON.stringify({ to: "+1-555-0123", message: "Hello! This is an example message." }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.createIncomingMessage({
      userId,
      firstname: "Alex",
      lastname: "Demo",
      business: "Demo Co",
      from: "+1-555-0123",
      message: "Hi! This is an example incoming message.",
      status: "received",
      receiver: "+1-555-9999",
      timestamp: /* @__PURE__ */ new Date(),
      messageId: "example-incoming-001",
      isRead: false,
      isExample: true
    });
    await this.createMessageLog({
      userId,
      messageId: "example-msg-002",
      endpoint: "send-single",
      recipient: "+1-555-0123",
      status: "delivered",
      costPerMessage: "0.0050",
      chargePerMessage: "0.0075",
      totalCost: "0.01",
      totalCharge: "0.01",
      messageCount: 1,
      requestPayload: JSON.stringify({ to: "+1-555-0123", message: "Great to hear from you. How can we help?" }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.createIncomingMessage({
      userId,
      firstname: "Alex",
      lastname: "Demo",
      business: "Demo Co",
      from: "+1-555-0123",
      message: "We would like to confirm our order details.",
      status: "received",
      receiver: "+1-555-9999",
      timestamp: /* @__PURE__ */ new Date(),
      messageId: "example-incoming-002",
      isRead: false,
      isExample: true
    });
  }
  // Credit Transaction methods
  async createCreditTransaction(insertTransaction) {
    const id = randomUUID();
    const transaction = {
      ...insertTransaction,
      id,
      messageLogId: insertTransaction.messageLogId ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }
  async getCreditTransactionsByUserId(userId, limit = 100) {
    const transactions = Array.from(this.creditTransactions.values()).filter((txn) => txn.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? transactions.slice(0, limit) : transactions;
  }
  // Incoming Message methods (DB-backed only)
  // DB-backed version defined later
  // Client Contact methods (for Business field routing)
  async createClientContact(insertContact) {
    const id = randomUUID();
    const contact = {
      ...insertContact,
      id,
      firstname: insertContact.firstname ?? null,
      lastname: insertContact.lastname ?? null,
      business: insertContact.business ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientContacts.set(id, contact);
    return contact;
  }
  async createClientContacts(contacts2) {
    const createdContacts = [];
    for (const contact of contacts2) {
      const created = await this.createClientContact(contact);
      createdContacts.push(created);
    }
    return createdContacts;
  }
  async getClientContactsByUserId(userId) {
    return Array.from(this.clientContacts.values()).filter((contact) => contact.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getClientContactByPhone(phoneNumber) {
    return Array.from(this.clientContacts.values()).find(
      (contact) => contact.phoneNumber === phoneNumber
    );
  }
  async updateClientContact(id, updates) {
    const contact = this.clientContacts.get(id);
    if (!contact) return void 0;
    const updated = {
      ...contact,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.clientContacts.set(id, updated);
    return updated;
  }
  async deleteClientContact(id) {
    this.clientContacts.delete(id);
  }
  async deleteClientContactsByUserId(userId) {
    const contactsToDelete = Array.from(this.clientContacts.entries()).filter(([_, contact]) => contact.userId === userId).map(([id, _]) => id);
    for (const id of contactsToDelete) {
      this.clientContacts.delete(id);
    }
  }
  // Contact Group methods (address book feature)
  async createContactGroup(insertGroup) {
    const id = randomUUID();
    const group = {
      ...insertGroup,
      id,
      description: insertGroup.description ?? null,
      businessUnitPrefix: insertGroup.businessUnitPrefix ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.contactGroups.set(id, group);
    return group;
  }
  async getContactGroupsByUserId(userId) {
    return Array.from(this.contactGroups.values()).filter((group) => group.userId === userId);
  }
  async getContactGroup(id) {
    return this.contactGroups.get(id);
  }
  async findContactGroupByCode(code) {
    const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(code);
    for (const g of this.contactGroups.values()) {
      if (norm(g.id) === target) return g;
      if (norm(g.businessUnitPrefix) === target) return g;
      if (norm(g.name) === target) return g;
    }
    return void 0;
  }
  async updateContactGroup(id, updates) {
    const group = this.contactGroups.get(id);
    if (!group) return void 0;
    const updatedGroup = { ...group, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    this.contactGroups.set(id, updatedGroup);
    return updatedGroup;
  }
  async deleteContactGroup(id) {
    this.contactGroups.delete(id);
  }
  // Contact methods (address book feature)
  async createContact(insertContact) {
    const id = randomUUID();
    const contact = {
      ...insertContact,
      id,
      groupId: insertContact.groupId ?? null,
      name: insertContact.name ?? null,
      email: insertContact.email ?? null,
      notes: insertContact.notes ?? null,
      syncedToExtremeSMS: insertContact.syncedToExtremeSMS ?? false,
      lastExportedAt: insertContact.lastExportedAt ?? null,
      isExample: insertContact.isExample ?? false,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.contacts.set(id, contact);
    return contact;
  }
  async createContactsBulk(insertContacts) {
    const created = [];
    for (const insertContact of insertContacts) {
      const contact = await this.createContact(insertContact);
      created.push(contact);
    }
    return created;
  }
  async getContactsByUserId(userId) {
    return Array.from(this.contacts.values()).filter((contact) => contact.userId === userId);
  }
  async getContactsByGroupId(groupId) {
    return Array.from(this.contacts.values()).filter((contact) => contact.groupId === groupId);
  }
  async getContact(id) {
    return this.contacts.get(id);
  }
  async updateContact(id, updates) {
    const contact = this.contacts.get(id);
    if (!contact) return void 0;
    const updatedContact = { ...contact, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }
  async deleteContact(id) {
    this.contacts.delete(id);
  }
  async deleteContactsByGroupId(groupId) {
    const contactsToDelete = Array.from(this.contacts.entries()).filter(([_, contact]) => contact.groupId === groupId).map(([id, _]) => id);
    for (const id of contactsToDelete) {
      this.contacts.delete(id);
    }
  }
  async deleteAllContactsByUserId(userId) {
    const ids = Array.from(this.contacts.entries()).filter(([_, c]) => c.userId === userId).map(([id]) => id);
    for (const id of ids) this.contacts.delete(id);
  }
  async markContactsAsExported(contactIds) {
    for (const id of contactIds) {
      const contact = this.contacts.get(id);
      if (contact) {
        this.contacts.set(id, {
          ...contact,
          syncedToExtremeSMS: true,
          lastExportedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        });
      }
    }
  }
  async markAllContactsSyncedByUserId(userId) {
    const now = /* @__PURE__ */ new Date();
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
  async getSyncStats(userId) {
    const userContacts = Array.from(this.contacts.values()).filter((c) => c.userId === userId);
    const total = userContacts.length;
    const synced = userContacts.filter((c) => c.syncedToExtremeSMS).length;
    const unsynced = total - synced;
    return { total, synced, unsynced };
  }
  // Error logging methods
  async getErrorLogs(level) {
    const failedLogs = Array.from(this.messageLogs.values()).filter((log2) => log2.status === "failed").map((log2) => {
      const user = this.users.get(log2.userId);
      return {
        id: log2.id,
        level: "error",
        message: `SMS delivery failed`,
        endpoint: log2.endpoint,
        userId: log2.userId,
        userName: user?.name || "Unknown",
        details: log2.responsePayload,
        timestamp: log2.createdAt.toISOString()
      };
    });
    if (level && level !== "all") {
      return failedLogs.filter((log2) => log2.level === level).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
    }
    return failedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
  }
  // Action logs (audit)
  async createActionLog(log2) {
    const id = randomUUID();
    const rec = {
      id,
      actorUserId: log2.actorUserId,
      actorRole: log2.actorRole,
      targetUserId: log2.targetUserId ?? null,
      action: log2.action,
      details: log2.details ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.actionLogs.set(id, rec);
    return rec;
  }
  async getActionLogs(limit = 200) {
    const logs = Array.from(this.actionLogs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return logs.slice(0, limit);
  }
};
var dbInstance = null;
var poolInstance = null;
var DbStorage = class {
  db;
  constructor() {
    if (!dbInstance) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.warn("DATABASE_URL not set - DbStorage requires database connection");
        throw new Error("DATABASE_URL environment variable is not set");
      }
      const shouldUseSSL = () => {
        if (!connectionString) return false;
        if (process.env.POSTGRES_SSL === "true") return true;
        return connectionString.includes("sslmode=require") || /neon\.tech|railway/i.test(connectionString);
      };
      const poolOptions = { connectionString };
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
      poolInstance.query("select 1").catch((err) => {
        console.error("\u274C Database connectivity check failed:", err?.message || err);
        throw err;
      });
      poolInstance.query("ALTER TABLE IF NOT EXISTS users ADD COLUMN IF NOT EXISTS group_id text").catch(() => {
      });
      poolInstance.query("CREATE INDEX IF NOT EXISTS user_group_id_idx ON users(group_id)").catch(() => {
      });
      poolInstance.query("ALTER TABLE IF NOT EXISTS users ADD COLUMN IF NOT EXISTS username text").catch(() => {
      });
      poolInstance.query(`UPDATE users SET username = COALESCE(NULLIF(username,''), NULLIF(name,''), split_part(email,'@',1)) WHERE username IS NULL OR username = ''`).catch(() => {
      });
      poolInstance.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username)").catch(() => {
      });
      poolInstance.query("ALTER TABLE IF EXISTS users ALTER COLUMN email DROP NOT NULL").catch(() => {
      });
      process.on("SIGINT", async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
      process.on("SIGTERM", async () => {
        if (poolInstance) await poolInstance.end();
        process.exit(0);
      });
    }
    this.db = dbInstance;
  }
  // User methods
  async getUser(id) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByEmail(email) {
    try {
      const r = await poolInstance.query(
        "SELECT id, email, password, name, company, role, is_active, reset_token, reset_token_expiry, created_at FROM users WHERE email=$1 LIMIT 1",
        [email]
      );
      const row = r.rows[0];
      if (!row) return void 0;
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
      };
    } catch (e) {
      console.error("\u274C getUserByEmail fallback query failed:", e?.message || e);
      throw e;
    }
  }
  async getUserByUsername(username) {
    try {
      const r = await poolInstance.query(
        "SELECT id, email, username, password, name, company, role, is_active, reset_token, reset_token_expiry, created_at, group_id FROM users WHERE username=$1 LIMIT 1",
        [username]
      );
      const row = r.rows[0];
      if (!row) return void 0;
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
        username: row.username
      };
    } catch (e) {
      console.error("\u274C getUserByUsername query failed:", e?.message || e);
      throw e;
    }
  }
  async setUsername(userId, username) {
    try {
      await poolInstance.query("UPDATE users SET username=$1 WHERE id=$2", [username, userId]);
    } catch (e) {
      console.error("\u274C setUsername failed:", e?.message || e);
      throw e;
    }
  }
  async supervisorExistsForGroup(groupId) {
    try {
      const r = await poolInstance.query("SELECT 1 FROM users WHERE role=$1 AND group_id=$2 LIMIT 1", ["supervisor", groupId]);
      return !!r.rows[0];
    } catch (e) {
      console.error("\u274C supervisorExistsForGroup failed:", e?.message || e);
      return false;
    }
  }
  async getAllUsers() {
    return this.db.select().from(users);
  }
  async createUser(user) {
    const allUsers = await this.getAllUsers();
    const isFirstUser = allUsers.length === 0;
    const result = await this.db.insert(users).values({
      ...user,
      role: isFirstUser ? "admin" : user.role || "client"
    }).returning();
    return result[0];
  }
  async updateUser(id, updates) {
    const result = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }
  // Password Reset methods
  async setPasswordResetToken(email, token, expiry) {
    const result = await this.db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.email, email)).returning();
    return result[0];
  }
  async getUserByResetToken(token) {
    const result = await this.db.select().from(users).where(eq(users.resetToken, token));
    const user = result[0];
    if (!user) return void 0;
    if (user.resetTokenExpiry && user.resetTokenExpiry < /* @__PURE__ */ new Date()) {
      return void 0;
    }
    return user;
  }
  async clearPasswordResetToken(userId) {
    await this.db.update(users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(users.id, userId));
  }
  async updateUserPassword(userId, newPasswordHash) {
    const result = await this.db.update(users).set({ password: newPasswordHash, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  // API Key methods
  async getApiKeyByHash(keyHash) {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return result[0];
  }
  async getApiKeysByUserId(userId) {
    return this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  }
  async createApiKey(apiKey) {
    const result = await this.db.insert(apiKeys).values(apiKey).returning();
    return result[0];
  }
  async updateApiKeyLastUsed(id) {
    await this.db.update(apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(apiKeys.id, id));
  }
  async revokeApiKey(id) {
    await this.db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }
  async deleteApiKey(id) {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
  // Client Profile methods
  async getClientProfileByUserId(userId) {
    const result = await this.db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId));
    return result[0];
  }
  async getClientProfileByPhoneNumber(phoneNumber) {
    const result = await this.db.select().from(clientProfiles).where(sql2`${phoneNumber} = ANY(${clientProfiles.assignedPhoneNumbers})`);
    return result[0];
  }
  async getClientProfileByBusinessName(businessName) {
    const target = businessName.trim();
    const result = await this.db.select().from(clientProfiles).where(sql2`LOWER(${clientProfiles.businessName}) = LOWER(${target})`).limit(1);
    return result[0];
  }
  async createClientProfile(profile) {
    const result = await this.db.insert(clientProfiles).values({
      credits: "0.00",
      customMarkup: "0.00",
      assignedPhoneNumbers: [],
      ...profile
    }).returning();
    return result[0];
  }
  async updateClientCredits(userId, newCredits) {
    const result = await this.db.update(clientProfiles).set({ credits: newCredits }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  async updateClientPhoneNumbers(userId, phoneNumbers) {
    const result = await this.db.update(clientProfiles).set({ assignedPhoneNumbers: phoneNumbers }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  async updateClientRateLimit(userId, rateLimitPerMinute) {
    const result = await this.db.update(clientProfiles).set({ rateLimitPerMinute, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  async updateClientBusinessName(userId, businessName) {
    const result = await this.db.update(clientProfiles).set({ businessName, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientProfiles.userId, userId)).returning();
    return result[0];
  }
  async setClientDeliveryMode(userId, mode) {
    await this.db.update(clientProfiles).set({ deliveryMode: mode, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientProfiles.userId, userId));
  }
  async setClientWebhook(userId, url, secret) {
    await this.db.update(clientProfiles).set({ webhookUrl: url, webhookSecret: secret, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientProfiles.userId, userId));
  }
  async getLastInboundForUserAndRecipient(userId, recipient) {
    const result = await this.db.select().from(incomingMessages).where(sql2`${incomingMessages.userId} = ${userId} AND ${incomingMessages.from} = ${recipient}`).orderBy(desc(incomingMessages.timestamp)).limit(1);
    return result[0];
  }
  // System Config methods
  async getSystemConfig(key) {
    const result = await this.db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return result[0];
  }
  async setSystemConfig(key, value) {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      const result = await this.db.update(systemConfig).set({ value }).where(eq(systemConfig.key, key)).returning();
      return result[0];
    } else {
      const result = await this.db.insert(systemConfig).values({ key, value }).returning();
      return result[0];
    }
  }
  async deleteSystemConfig(key) {
    await this.db.delete(systemConfig).where(eq(systemConfig.key, key));
  }
  async getAllSystemConfig() {
    return this.db.select().from(systemConfig);
  }
  // Message Log methods
  async createMessageLog(log2) {
    const result = await this.db.insert(messageLogs).values(log2).returning();
    return result[0];
  }
  async getMessageLogsByUserId(userId, limit) {
    let query = this.db.select().from(messageLogs).where(eq(messageLogs.userId, userId)).orderBy(desc(messageLogs.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async getMessageLogByMessageId(messageId) {
    const result = await this.db.select().from(messageLogs).where(eq(messageLogs.messageId, messageId));
    return result[0];
  }
  async getAllMessageLogs(limit) {
    let query = this.db.select().from(messageLogs).orderBy(desc(messageLogs.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async updateMessageStatus(logId, status) {
    await this.db.update(messageLogs).set({ status }).where(eq(messageLogs.id, logId));
  }
  async findClientBySenderPhone(senderPhone) {
    const result = await this.db.select().from(messageLogs).where(eq(messageLogs.senderPhoneNumber, senderPhone)).orderBy(desc(messageLogs.createdAt)).limit(1);
    return result.length > 0 ? result[0].userId : void 0;
  }
  async findClientByRecipient(recipientPhone) {
    const result = await this.db.select().from(messageLogs).where(
      sql2`${messageLogs.recipient} = ${recipientPhone} OR ${recipientPhone} = ANY(${messageLogs.recipients})`
    ).orderBy(desc(messageLogs.createdAt)).limit(1);
    return result.length > 0 ? result[0].userId : void 0;
  }
  // Credit Transaction methods
  async createCreditTransaction(transaction) {
    const result = await this.db.insert(creditTransactions).values(transaction).returning();
    return result[0];
  }
  async getCreditTransactionsByUserId(userId, limit) {
    let query = this.db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.createdAt));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  // Incoming Message methods
  async createIncomingMessage(message) {
    const result = await this.db.insert(incomingMessages).values(message).returning();
    return result[0];
  }
  async getIncomingMessagesByUserId(userId, limit) {
    let query = this.db.select().from(incomingMessages).where(eq(incomingMessages.userId, userId)).orderBy(desc(incomingMessages.timestamp));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async getAllIncomingMessages(limit) {
    let query = this.db.select().from(incomingMessages).orderBy(desc(incomingMessages.timestamp));
    if (limit) {
      query = query.limit(limit);
    }
    return query;
  }
  async markIncomingMessageAsRead(messageId) {
    await this.db.update(incomingMessages).set({ isRead: true }).where(eq(incomingMessages.id, messageId));
  }
  async markConversationAsRead(userId, phoneNumber) {
    await this.db.update(incomingMessages).set({ isRead: true }).where(
      sql2`
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
  async getIncomingMessagesWithMissingUserId(limit) {
    let query = this.db.select().from(incomingMessages).where(sql2`${incomingMessages.userId} IS NULL AND ${incomingMessages.business} IS NOT NULL`).orderBy(desc(incomingMessages.createdAt));
    if (limit) query = query.limit(limit);
    return query;
  }
  async updateIncomingMessageUserId(id, userId) {
    await this.db.update(incomingMessages).set({ userId }).where(eq(incomingMessages.id, id));
  }
  async getConversationHistory(userId, phoneNumber) {
    const incoming = await this.db.select().from(incomingMessages).where(
      sql2`
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
    ).orderBy(incomingMessages.timestamp);
    const outgoing = await this.db.select().from(messageLogs).where(
      sql2`
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
    ).orderBy(messageLogs.createdAt);
    if (incoming.length === 0 && outgoing.length === 0) {
      try {
        const digits = String(phoneNumber).replace(/[^0-9]/g, "");
        const incR = await poolInstance.query(
          `SELECT id, user_id AS "userId", "from" AS "from", firstname, lastname, business, message, status, receiver, timestamp, message_id AS "messageId", is_read AS "isRead", usedmodem, port
           FROM incoming_messages
           WHERE (
             regexp_replace("from", '[^0-9]', '', 'g') = $1
             OR regexp_replace(receiver, '[^0-9]', '', 'g') = $1
           )
           ORDER BY timestamp ASC`,
          [digits]
        );
        const outR = await poolInstance.query(
          `SELECT id, user_id AS "userId", recipient, recipients, request_payload AS "requestPayload", response_payload AS "responsePayload", created_at AS "createdAt", status, message_id AS "messageId", sender_phone_number AS "senderPhoneNumber", endpoint
           FROM message_logs
           WHERE (
             regexp_replace(recipient, '[^0-9]', '', 'g') = $1
             OR EXISTS (SELECT 1 FROM unnest(COALESCE(recipients, '{}'::text[])) r WHERE regexp_replace(r, '[^0-9]', '', 'g') = $1)
           )
           ORDER BY created_at ASC`,
          [digits]
        );
        const incF = incR.rows;
        const outF = outR.rows;
        return { incoming: incF, outgoing: outF };
      } catch {
      }
    }
    return { incoming, outgoing };
  }
  // Client Contact methods (for Business field routing)
  async createClientContact(contact) {
    const result = await this.db.insert(clientContacts).values(contact).returning();
    return result[0];
  }
  async createClientContacts(contacts2) {
    if (contacts2.length === 0) return [];
    const result = await this.db.insert(clientContacts).values(contacts2).returning();
    return result;
  }
  async getClientContactsByUserId(userId) {
    return this.db.select().from(clientContacts).where(eq(clientContacts.userId, userId)).orderBy(desc(clientContacts.createdAt));
  }
  async getClientContactByPhone(phoneNumber) {
    const result = await this.db.select().from(clientContacts).where(eq(clientContacts.phoneNumber, phoneNumber)).limit(1);
    return result[0];
  }
  async updateClientContact(id, updates) {
    const result = await this.db.update(clientContacts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clientContacts.id, id)).returning();
    return result[0];
  }
  async deleteClientContact(id) {
    await this.db.delete(clientContacts).where(eq(clientContacts.id, id));
  }
  async deleteClientContactsByUserId(userId) {
    await this.db.delete(clientContacts).where(eq(clientContacts.userId, userId));
  }
  // Contact Group methods (address book feature)
  async createContactGroup(insertGroup) {
    const result = await this.db.insert(contactGroups).values(insertGroup).returning();
    return result[0];
  }
  async getContactGroupsByUserId(userId) {
    return this.db.select().from(contactGroups).where(eq(contactGroups.userId, userId));
  }
  async getContactGroup(id) {
    const result = await this.db.select().from(contactGroups).where(eq(contactGroups.id, id));
    return result[0];
  }
  async findContactGroupByCode(code) {
    const normalize = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = normalize(String(code));
    const result = await this.db.select().from(contactGroups).where(sql2`
        LOWER(regexp_replace(${contactGroups.id}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
        OR LOWER(regexp_replace(${contactGroups.businessUnitPrefix}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
        OR LOWER(regexp_replace(${contactGroups.name}, '[^a-zA-Z0-9]', '', 'g')) = ${target}
      `).limit(1);
    return result[0];
  }
  async updateContactGroup(id, updates) {
    const result = await this.db.update(contactGroups).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(contactGroups.id, id)).returning();
    return result[0];
  }
  async deleteContactGroup(id) {
    await this.db.delete(contactGroups).where(eq(contactGroups.id, id));
  }
  // Contact methods (address book feature)
  async createContact(insertContact) {
    const result = await this.db.insert(contacts).values(insertContact).returning();
    return result[0];
  }
  async createContactsBulk(insertContacts) {
    if (insertContacts.length === 0) return [];
    const result = await this.db.insert(contacts).values(insertContacts).returning();
    return result;
  }
  async getContactsByUserId(userId) {
    return this.db.select().from(contacts).where(eq(contacts.userId, userId));
  }
  async getContactsByGroupId(groupId) {
    return this.db.select().from(contacts).where(eq(contacts.groupId, groupId));
  }
  async getContact(id) {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }
  async updateContact(id, updates) {
    const result = await this.db.update(contacts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(contacts.id, id)).returning();
    return result[0];
  }
  async deleteContact(id) {
    await this.db.delete(contacts).where(eq(contacts.id, id));
  }
  async deleteContactsByGroupId(groupId) {
    await this.db.delete(contacts).where(eq(contacts.groupId, groupId));
  }
  async deleteAllContactsByUserId(userId) {
    await this.db.delete(contacts).where(eq(contacts.userId, userId));
  }
  async markContactsAsExported(contactIds) {
    if (contactIds.length === 0) return;
    await this.db.update(contacts).set({
      syncedToExtremeSMS: true,
      lastExportedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(sql2`${contacts.id} IN (${sql2.join(contactIds.map((id) => sql2`${id}`), sql2`, `)})`);
  }
  async markAllContactsSyncedByUserId(userId) {
    await this.db.update(contacts).set({
      syncedToExtremeSMS: true,
      lastExportedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(contacts.userId, userId));
  }
  async deleteUser(userId) {
    await this.db.delete(apiKeys).where(eq(apiKeys.userId, userId));
    await this.db.delete(clientProfiles).where(eq(clientProfiles.userId, userId));
    await this.db.delete(incomingMessages).where(eq(incomingMessages.userId, userId));
    await this.db.delete(messageLogs).where(eq(messageLogs.userId, userId));
    await this.db.delete(creditTransactions).where(eq(creditTransactions.userId, userId));
    await this.db.delete(contacts).where(eq(contacts.userId, userId));
    await this.db.delete(contactGroups).where(eq(contactGroups.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
  }
  async getSyncStats(userId) {
    const allContacts = await this.db.select().from(contacts).where(eq(contacts.userId, userId));
    const total = allContacts.length;
    const synced = allContacts.filter((c) => c.syncedToExtremeSMS).length;
    const unsynced = total - synced;
    return { total, synced, unsynced };
  }
  // Error logging methods
  async getErrorLogs(level) {
    const failedLogs = await this.db.select({
      id: messageLogs.id,
      level: sql2`'error'`,
      message: sql2`'SMS delivery failed'`,
      endpoint: messageLogs.endpoint,
      userId: messageLogs.userId,
      details: messageLogs.responsePayload,
      timestamp: messageLogs.createdAt
    }).from(messageLogs).where(eq(messageLogs.status, "failed")).orderBy(desc(messageLogs.createdAt)).limit(100);
    const logsWithUsers = await Promise.all(
      failedLogs.map(async (log2) => {
        const user = await this.getUser(log2.userId.toString());
        return {
          ...log2,
          userName: user?.name || "Unknown",
          timestamp: log2.timestamp.toISOString()
        };
      })
    );
    if (level && level !== "all") {
      return logsWithUsers.filter((log2) => log2.level === level);
    }
    return logsWithUsers;
  }
  // Action logs (audit)
  async createActionLog(log2) {
    const result = await this.db.insert(actionLogs).values({
      actorUserId: log2.actorUserId,
      actorRole: log2.actorRole,
      targetUserId: log2.targetUserId ?? null,
      action: log2.action,
      details: log2.details ?? null
    }).returning();
    return result[0];
  }
  async getActionLogs(limit = 200) {
    let query = this.db.select().from(actionLogs).orderBy(desc(actionLogs.createdAt));
    if (limit) query = query.limit(limit);
    return query;
  }
  async getLastActionForTarget(targetUserId, action) {
    const result = await this.db.select().from(actionLogs).where(sql2`${actionLogs.targetUserId} = ${targetUserId} AND ${actionLogs.action} = ${action}`).orderBy(desc(actionLogs.createdAt)).limit(1);
    return result[0];
  }
  // Stats methods
  async getTotalMessageCount() {
    const result = await this.db.select({ count: sql2`count(*)` }).from(messageLogs);
    return Number(result[0].count);
  }
  async getMessageStatusStats(userId) {
    const logs = await this.db.select().from(messageLogs).where(sql2`${messageLogs.userId} = ${userId} AND ${messageLogs.isExample} = false`);
    const countFor = (log2) => {
      const mc = Number(log2.messageCount);
      if (Number.isFinite(mc) && mc > 0) return mc;
      const rl = Array.isArray(log2.recipients) ? log2.recipients.length : log2.recipient ? 1 : 0;
      return rl > 0 ? rl : 1;
    };
    const sent = logs.filter((log2) => log2.status === "sent" || log2.status === "queued").reduce((acc, log2) => acc + countFor(log2), 0);
    const delivered = logs.filter((log2) => log2.status === "delivered").reduce((acc, log2) => acc + countFor(log2), 0);
    const failed = logs.filter((log2) => log2.status === "failed").reduce((acc, log2) => acc + countFor(log2), 0);
    return { sent, delivered, failed };
  }
  async seedExampleData(userId) {
    const existsInc = await this.db.select().from(incomingMessages).where(sql2`${incomingMessages.userId} = ${userId} AND ${incomingMessages.isExample} = true`).limit(1);
    const existsLogs = await this.db.select().from(messageLogs).where(sql2`${messageLogs.userId} = ${userId} AND ${messageLogs.isExample} = true`).limit(1);
    if (existsInc.length > 0 || existsLogs.length > 0) return;
    await this.db.insert(contacts).values({
      userId,
      phoneNumber: "+1-555-0123",
      name: "Example Contact",
      email: "example@demo.com",
      notes: "This is an example contact for demonstration purposes",
      syncedToExtremeSMS: true,
      lastExportedAt: /* @__PURE__ */ new Date(),
      isExample: true
    });
    await this.db.insert(messageLogs).values({
      userId,
      messageId: "example-msg-001",
      endpoint: "send-single",
      recipient: "+1-555-0123",
      status: "delivered",
      costPerMessage: "0.0050",
      chargePerMessage: "0.0075",
      totalCost: "0.01",
      totalCharge: "0.01",
      messageCount: 1,
      requestPayload: JSON.stringify({ to: "+1-555-0123", message: "Hello! This is an example message." }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.db.insert(incomingMessages).values({
      userId,
      firstname: "Alex",
      lastname: "Demo",
      business: "Demo Co",
      from: "+1-555-0123",
      message: "Hi! This is an example incoming message.",
      status: "received",
      receiver: "+1-555-9999",
      timestamp: /* @__PURE__ */ new Date(),
      messageId: "example-incoming-001",
      isRead: false,
      isExample: true
    });
    await this.db.insert(messageLogs).values({
      userId,
      messageId: "example-msg-002",
      endpoint: "send-single",
      recipient: "+1-555-0123",
      status: "delivered",
      costPerMessage: "0.0050",
      chargePerMessage: "0.0075",
      totalCost: "0.01",
      totalCharge: "0.01",
      messageCount: 1,
      requestPayload: JSON.stringify({ to: "+1-555-0123", message: "Great to hear from you. How can we help?" }),
      responsePayload: JSON.stringify({ success: true }),
      isExample: true
    });
    await this.db.insert(incomingMessages).values({
      userId,
      firstname: "Alex",
      lastname: "Demo",
      business: "Demo Co",
      from: "+1-555-0123",
      message: "We would like to confirm our order details.",
      status: "received",
      receiver: "+1-555-9999",
      timestamp: /* @__PURE__ */ new Date(),
      messageId: "example-incoming-002",
      isRead: false,
      isExample: true
    });
  }
};
var storageInstance = null;
function initializeStorage() {
  if (storageInstance) {
    return storageInstance;
  }
  if (process.env.DATABASE_URL) {
    const dbStorage = new DbStorage();
    console.log("\u2705 Using PostgreSQL database storage");
    console.log(`\u2705 Database: ${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0] || "connected"}`);
    storageInstance = dbStorage;
  } else {
    console.warn("\u26A0\uFE0F  DATABASE_URL not set - using in-memory storage (data will not persist)");
    storageInstance = new MemStorage();
  }
  return storageInstance;
}
var storage = new Proxy({}, {
  get(target, prop) {
    const instance = initializeStorage();
    return instance[prop];
  }
});

// server/routes.ts
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { exec } from "child_process";

// shared/phone.ts
function strip(input) {
  const trimmed = String(input || "").trim();
  const hadPlus = /^\+/.test(trimmed);
  const digits = trimmed.replace(/[^0-9]/g, "");
  return { raw: digits, hadPlus };
}
function coerceInternationalPrefix(digits, original) {
  const s = original.trim();
  if (/^00/.test(s)) return { prefixed: true, value: s.replace(/^00+/, "+") };
  if (/^011/.test(s)) return { prefixed: true, value: s.replace(/^011+/, "+") };
  return { prefixed: false, value: s };
}
function isValidE164(e) {
  return /^\+[1-9][0-9]{7,14}$/.test(e);
}
function normalizePhone(input, defaultDial = "+1") {
  if (!input) return null;
  const coerced = coerceInternationalPrefix(input.replace(/\s+/g, ""), input);
  const s = coerced.value;
  if (s.startsWith("+")) {
    const e = "+" + s.replace(/[^0-9]/g, "");
    return isValidE164(e) ? e : null;
  }
  const { raw } = strip(s);
  const def = String(defaultDial || "+1");
  const defDigits = def.replace(/[^0-9]/g, "");
  if (raw.length === 0) return null;
  if (raw.startsWith(defDigits)) {
    const e = "+" + raw;
    return isValidE164(e) ? e : null;
  }
  if (raw.length >= 6 && raw.length <= 15) {
    const e = "+" + defDigits + raw;
    return isValidE164(e) ? e : null;
  }
  return null;
}
function normalizeMany(inputs, defaultDial = "+1") {
  const okSet = /* @__PURE__ */ new Set();
  const invalid = [];
  for (const item of inputs || []) {
    const n = normalizePhone(item, defaultDial);
    if (n) okSet.add(n);
    else invalid.push(item);
  }
  return { ok: Array.from(okSet), invalid };
}

// server/routes.ts
import crypto from "crypto";

// server/resend.ts
import { Resend } from "resend";
var connectionSettings;
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}
async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}
async function sendPasswordResetEmail(to, resetUrl) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const { data, error } = await client.emails.send({
      from: fromEmail || "noreply@ibikisms.com",
      to: [to],
      subject: "Password Reset - Ibiki SMS",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Ibiki SMS</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              You requested to reset your password. Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.
            </p>
            
            <p style="color: #9ca3af; font-size: 13px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="color: #667eea; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Ibiki SMS. All rights reserved.</p>
          </div>
        </body>
        </html>
      `
    });
    if (error) {
      console.error("Resend email error:", error);
      throw new Error("Failed to send password reset email");
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Password reset email error:", error);
    throw error;
  }
}

// server/routes.ts
var JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
var PROTECTED_ADMIN_EMAIL = "ibiki_dash@proton.me";
var EXTREMESMS_BASE_URL = "https://extremesms.net";
async function authenticateToken(req, res, next) {
  const hdr = req.headers["authorization"] || req.headers["Authorization"] || req.headers["x-auth-token"];
  let token = void 0;
  if (hdr && typeof hdr === "string") {
    token = hdr.includes("Bearer ") ? hdr.split(" ")[1] : hdr;
  }
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }
    next();
  };
}
async function authenticateApiKey(req, res, next) {
  const authHeader = req.headers["authorization"];
  const apiKey = authHeader && authHeader.split(" ")[1];
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  try {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const storedKey = await storage.getApiKeyByHash(keyHash);
    if (!storedKey || !storedKey.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    const user = await storage.getUser(storedKey.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User account inactive" });
    }
    req.user = { userId: user.id, role: user.role };
    req.apiKeyId = storedKey.id;
    await storage.updateApiKeyLastUsed(storedKey.id);
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}
async function getPricingConfig(userId, groupId) {
  let gid = groupId;
  if (!gid && userId) {
    const u = await storage.getUser(userId).catch(() => void 0);
    gid = u?.groupId || void 0;
  }
  if (gid) {
    const gExtreme = await storage.getSystemConfig(`pricing.group.${gid}.extreme_cost`);
    const gRate = await storage.getSystemConfig(`pricing.group.${gid}.client_rate`);
    if (gExtreme && gRate) {
      const extremeCost2 = parseFloat(gExtreme.value);
      const clientRate2 = parseFloat(gRate.value);
      if (!Number.isNaN(extremeCost2) && !Number.isNaN(clientRate2)) return { extremeCost: extremeCost2, clientRate: clientRate2 };
    }
  }
  const extremeCostConfig = await storage.getSystemConfig("extreme_cost_per_sms");
  const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");
  const extremeCost = extremeCostConfig ? parseFloat(extremeCostConfig.value) : 0.01;
  const clientRate = clientRateConfig ? parseFloat(clientRateConfig.value) : 1;
  return { extremeCost, clientRate };
}
async function deductCreditsAndLog(userId, messageCount, endpoint, messageId, status, requestPayload, responsePayload, recipient, recipients, senderPhoneNumber) {
  const { extremeCost, clientRate } = await getPricingConfig(userId);
  const totalCost = extremeCost * messageCount;
  const totalChargeUSD = clientRate * messageCount;
  const creditsToDeduct = messageCount;
  const profile = await storage.getClientProfileByUserId(userId);
  if (!profile) {
    throw new Error("Client profile not found");
  }
  const currentCredits = parseFloat(profile.credits);
  if (currentCredits < creditsToDeduct) {
    throw new Error("Insufficient credits");
  }
  const newCredits = currentCredits - creditsToDeduct;
  let senderPhone = senderPhoneNumber || responsePayload?.senderPhone || responsePayload?.from || responsePayload?.sender || null;
  if (!senderPhone) {
    try {
      const assigned = profile?.assignedPhoneNumbers || [];
      if (Array.isArray(assigned) && assigned.length > 0) senderPhone = assigned[0];
    } catch {
    }
  }
  const messageLog = await storage.createMessageLog({
    userId,
    messageId,
    endpoint,
    recipient: recipient || null,
    recipients: recipients || null,
    senderPhoneNumber: senderPhone,
    status,
    costPerMessage: extremeCost.toFixed(4),
    chargePerMessage: clientRate.toFixed(4),
    totalCost: totalCost.toFixed(2),
    totalCharge: creditsToDeduct.toFixed(2),
    messageCount,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });
  await storage.createCreditTransaction({
    userId,
    amount: (-creditsToDeduct).toFixed(2),
    type: "debit",
    description: `SMS sent via ${endpoint} (USD $${totalChargeUSD.toFixed(2)})`,
    balanceBefore: currentCredits.toFixed(2),
    balanceAfter: newCredits.toFixed(2),
    messageLogId: messageLog.id
  });
  await storage.updateClientCredits(userId, newCredits.toFixed(2));
  try {
    const u = await storage.getUser(userId).catch(() => void 0);
    const gid = u?.groupId || void 0;
    if (gid) {
      await ensureGroupPoolInitialized(gid);
      const pool = await storage.getSystemConfig(`group.pool.${gid}`);
      const currentPool = parseFloat(pool?.value || "0") || 0;
      const nextPool = Math.max(currentPool - creditsToDeduct, 0);
      await storage.setSystemConfig(`group.pool.${gid}`, nextPool.toFixed(2));
    }
  } catch {
  }
  try {
    const adminPool = await storage.getSystemConfig("admin.pool");
    const currentAdminPool = adminPool ? parseFloat(adminPool.value) || 0 : 0;
    const nextAdminPool = Math.max(currentAdminPool - creditsToDeduct, 0);
    await storage.setSystemConfig("admin.pool", nextAdminPool.toFixed(2));
  } catch {
  }
  return { messageLog, newBalance: newCredits };
}
async function createAdminAuditLog(adminUserId, sourceEndpoint, messageId, status, requestPayload, responsePayload, recipient, recipients, senderPhoneNumber) {
  const { extremeCost } = await getPricingConfig();
  const senderPhone = senderPhoneNumber || responsePayload?.senderPhone || responsePayload?.from || responsePayload?.sender || null;
  await storage.createMessageLog({
    userId: adminUserId,
    messageId,
    endpoint: `${sourceEndpoint}:admin-audit`,
    recipient: recipient || null,
    recipients: recipients || null,
    senderPhoneNumber: senderPhone,
    status,
    costPerMessage: extremeCost.toFixed(4),
    chargePerMessage: "0.0000",
    totalCost: extremeCost.toFixed(2),
    totalCharge: "0.00",
    messageCount: (recipients?.length || 0) > 0 ? recipients.length : 1,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });
}
async function allocateNextBusinessName() {
  const all = await storage.getAllUsers();
  const names = [];
  for (const u of all) {
    const p = await storage.getClientProfileByUserId(u.id);
    if (p?.businessName) names.push(String(p.businessName));
  }
  const nums = names.map((n) => /^IBS_(\d+)$/i.test(n) ? parseInt(n.replace(/^IBS_/, ""), 10) : null).filter((v) => typeof v === "number");
  const next = nums.length ? Math.max(...nums) + 1 : 0;
  return `IBS_${next}`;
}
async function ensureGroupPoolInitialized(gid) {
  const existing = await storage.getSystemConfig(`group.pool.${gid}`);
  if (existing) return;
  const all = await storage.getAllUsers();
  let sum = 0;
  for (const u of all) {
    if (u?.role === "supervisor" && u?.groupId === gid) {
      const p = await storage.getClientProfileByUserId(u.id);
      sum += parseFloat(p?.credits || "0") || 0;
    }
  }
  await storage.setSystemConfig(`group.pool.${gid}`, sum.toFixed(2));
}
async function resolveFetchLimit(userId, role, provided) {
  if (provided) {
    const n = typeof provided === "string" ? parseInt(provided) : provided;
    return Math.max(1, Math.min(2e3, isNaN(n) ? 100 : n));
  }
  const perUser = userId ? await storage.getSystemConfig(`messages_limit_user_${userId}`) : void 0;
  if (perUser?.value) {
    const v = parseInt(perUser.value);
    return Math.max(1, Math.min(2e3, isNaN(v) ? 100 : v));
  }
  const key = role === "admin" ? "default_admin_messages_limit" : "default_client_messages_limit";
  const cfg = await storage.getSystemConfig(key);
  if (cfg?.value) {
    const v = parseInt(cfg.value);
    return Math.max(1, Math.min(2e3, isNaN(v) ? 100 : v));
  }
  return 100;
}
async function getExtremeApiKey() {
  const config = await storage.getSystemConfig("extreme_api_key");
  if (!config) {
    throw new Error("ExtremeSMS API key not configured");
  }
  return config.value;
}
async function registerRoutes(app2) {
  app2.use(express.json());
  app2.use(express.urlencoded({ extended: true }));
  app2.post("/api/tools/paraphrase", authenticateToken, async (req, res) => {
    try {
      const { text: text2, n = 5, creativity = 0.5, lang = "en", includeLink = false } = req.body || {};
      if (!text2 || typeof text2 !== "string") return res.status(400).json({ error: "text required" });
      const count = Math.max(1, Math.min(25, parseInt(String(n)) || 5));
      const cfg = await getParaphraserConfig();
      const placeholders = {};
      const urlPlaceholders = /* @__PURE__ */ new Set();
      let protectedText = String(text2);
      protectedText = protectedText.replace(/\{\{[^}]+\}\}/g, (m) => {
        const k = `__PH_${Object.keys(placeholders).length}__`;
        placeholders[k] = m;
        return k;
      });
      protectedText = protectedText.replace(/https?:\/\/[^\s]+/g, (m) => {
        const k = `__PH_${Object.keys(placeholders).length}__`;
        placeholders[k] = m;
        urlPlaceholders.add(k);
        return k;
      });
      const clamp = (s) => {
        const max = cfg.rules?.targetMax || 155;
        const hardMax = cfg.rules?.maxChars || 160;
        let out = s.trim().replace(/\s+/g, " ");
        if (out.length <= max) return out;
        let cut = out.lastIndexOf(" ", max);
        if (cut < 0) cut = max;
        out = out.slice(0, cut).trim();
        const trailing = out.split(/\s+/).pop()?.toLowerCase() || "";
        if (["to", "and", "or", "is", "are", "with", "at", "for", "of", "on", "in"].includes(trailing)) out = out.replace(new RegExp(`${trailing}$`), "").trim();
        if (!/[.?!]$/.test(out)) out += ".";
        if (out.length > hardMax) out = out.slice(0, hardMax).trim();
        return out;
      };
      const stubGen = (base, c, creative) => {
        const synonyms = { hello: ["Hello", "Hi", "Hey", "Hello there"], thanks: ["Thank you", "Thanks", "Much appreciated"], please: ["please", "kindly"], good: ["great", "nice", "excellent"] };
        const arr = [];
        const endsWithQuestion = /\?\s*$/.test(base);
        for (let i = 0; i < c; i++) {
          const words = base.split(/\s+/);
          const v = words.map((w) => {
            const key = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
            if (synonyms[key] && Math.random() < 0.2 + creative * 0.6) {
              const opts = synonyms[key];
              return opts[Math.floor(Math.random() * opts.length)];
            }
            return w;
          }).join(" ");
          let out = v.trim();
          out = out.charAt(0).toUpperCase() + out.slice(1);
          if (!/[.?!]\s*$/.test(out)) out = out + (endsWithQuestion ? "?" : ".");
          Object.keys(placeholders).forEach((k) => {
            const orig = placeholders[k];
            if (includeLink && urlPlaceholders.has(k)) {
              const phrase = ` here is the link ${orig} here you will find more information `;
              out = out.replace(new RegExp(k, "g"), "");
              const mid = Math.floor(out.length / 2);
              let pos = out.indexOf(" ", mid);
              if (pos === -1) pos = out.lastIndexOf(" ", mid);
              if (pos === -1) pos = mid;
              out = `${out.slice(0, pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g, " ").trim();
            } else {
              out = out.replace(new RegExp(k, "g"), orig);
            }
          });
          out = clamp(out);
          const id = crypto.randomBytes(8).toString("hex");
          arr.push({ id, text: out, score: +(0.8 + Math.random() * 0.15).toFixed(2) });
        }
        return arr;
      };
      let variants = [];
      let providerUsed = "stub";
      if (cfg.provider === "ollama") {
        const temp = Math.max(0, Math.min(1, Number(creativity))) || 0.5;
        for (let i = 0; i < count; i++) {
          const prompt = `Paraphrase the following SMS. Preserve any tokens like {{name}} and any URLs exactly. Output only the paraphrase.
Text: ${protectedText}`;
          const resp = await axios.post(`${cfg.url}/api/generate`, { model: cfg.model, prompt, stream: false, options: { temperature: temp } }, { timeout: 15e3 });
          let out = String(resp.data?.response || protectedText);
          Object.keys(placeholders).forEach((k) => {
            out = out.replace(new RegExp(k, "g"), placeholders[k]);
          });
          out = clamp(out);
          const id = crypto.randomBytes(8).toString("hex");
          variants.push({ id, text: out, score: +0.8.toFixed(2) });
        }
        providerUsed = "ollama";
      } else if (cfg.provider === "openrouter" && cfg.key) {
        const temp = Math.max(0, Math.min(1, Number(creativity))) || 0.5;
        const minChars = cfg.rules?.targetMin || 145;
        const maxChars = cfg.rules?.targetMax || 155;
        const grammar = cfg.rules?.enforceGrammar ? "Ensure complete, grammatically correct sentences." : "";
        const prompt = `Paraphrase the following SMS into ${count} variants. ${grammar} Keep each variant between ${minChars}-${maxChars} characters and strictly under ${cfg.rules?.maxChars || 160}. Preserve tokens like {{name}} and any URLs exactly. Place any URL token mid-sentence using natural phrasing. Prefer responding with a JSON object {"variants":[{"text":"...","score":0.9},...]}. If you cannot respond as JSON, respond with ${count} bullet lines, one variant per line.
Text: ${protectedText}`;
        const rawKey = String(cfg.key || "").trim();
        const authHeader = rawKey.startsWith("Bearer ") ? rawKey : `Bearer ${rawKey}`;
        const headers = { "Content-Type": "application/json", "Authorization": authHeader };
        const body = { model: cfg.model || "openrouter/auto", messages: [{ role: "system", content: "Paraphrase SMS while preserving placeholders and links; respond as JSON." }, { role: "user", content: prompt }], temperature: temp, response_format: { type: "json_object" } };
        try {
          const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", body, { headers, timeout: 2e4 });
          let raw = String(resp.data?.choices?.[0]?.message?.content || "{}");
          raw = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
          let parsed = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = {};
          }
          let arr = Array.isArray(parsed?.variants) ? parsed.variants : [];
          if (!Array.isArray(arr) || arr.length === 0) {
            const lines = String(resp.data?.choices?.[0]?.message?.content || "").split(/\r?\n/).map((s) => s.replace(/^[-*\d\.\)\s]+/, "").trim()).filter((s) => s.length > 0);
            arr = lines.slice(0, count).map((txt) => ({ text: txt, score: 0.8 }));
          }
          for (const v of arr) {
            let out = String(v?.text || protectedText);
            Object.keys(placeholders).forEach((k) => {
              const orig = placeholders[k];
              if (includeLink && urlPlaceholders.has(k)) {
                if (out.includes(orig)) {
                  out = out.replace(new RegExp(k, "g"), orig);
                } else if (out.includes(k)) {
                  const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                  out = out.replace(new RegExp(k, "g"), phrase);
                } else {
                  const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                  const mid = Math.floor(out.length / 2);
                  let pos = out.indexOf(" ", mid);
                  if (pos === -1) pos = out.lastIndexOf(" ", mid);
                  if (pos === -1) pos = mid;
                  out = `${out.slice(0, pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g, " ").trim();
                }
              } else {
                out = out.replace(new RegExp(k, "g"), orig);
              }
            });
            out = clamp(out);
            const id = crypto.randomBytes(8).toString("hex");
            const score = typeof v?.score === "number" ? v.score : 0.8;
            variants.push({ id, text: out, score: +Number(score).toFixed(2) });
          }
          {
            const seen = /* @__PURE__ */ new Set();
            variants = variants.filter((v) => {
              const norm = v.text.toLowerCase().replace(/\s+/g, " ").trim();
              if (seen.has(norm)) return false;
              seen.add(norm);
              return true;
            });
          }
          if (variants.length < count) {
            const remain = count - variants.length;
            const prompt2 = `Provide ${remain} additional distinct variants that meet the same rules.
Text: ${protectedText}`;
            const body2 = { model: cfg.model || "openrouter/auto", messages: [{ role: "system", content: "Paraphrase SMS while preserving placeholders and links; respond as JSON." }, { role: "user", content: prompt2 }], temperature: temp, response_format: { type: "json_object" } };
            try {
              const resp2 = await axios.post("https://openrouter.ai/api/v1/chat/completions", body2, { headers, timeout: 2e4 });
              let raw2 = String(resp2.data?.choices?.[0]?.message?.content || "{}");
              raw2 = raw2.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
              let parsed2 = {};
              try {
                parsed2 = JSON.parse(raw2);
              } catch {
                parsed2 = {};
              }
              let arr2 = Array.isArray(parsed2?.variants) ? parsed2.variants : [];
              if (!Array.isArray(arr2) || arr2.length === 0) {
                const lines2 = String(resp2.data?.choices?.[0]?.message?.content || "").split(/\r?\n/).map((s) => s.replace(/^[-*\d\.\)\s]+/, "").trim()).filter((s) => s.length > 0);
                arr2 = lines2.slice(0, remain).map((txt) => ({ text: txt, score: 0.8 }));
              }
              for (const v of arr2) {
                let out = String(v?.text || protectedText);
                Object.keys(placeholders).forEach((k) => {
                  const orig = placeholders[k];
                  if (includeLink && urlPlaceholders.has(k)) {
                    if (out.includes(orig)) {
                      out = out.replace(new RegExp(k, "g"), orig);
                    } else if (out.includes(k)) {
                      const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                      out = out.replace(new RegExp(k, "g"), phrase);
                    } else {
                      const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                      const mid = Math.floor(out.length / 2);
                      let pos = out.indexOf(" ", mid);
                      if (pos === -1) pos = out.lastIndexOf(" ", mid);
                      if (pos === -1) pos = mid;
                      out = `${out.slice(0, pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g, " ").trim();
                    }
                  } else {
                    out = out.replace(new RegExp(k, "g"), orig);
                  }
                });
                out = clamp(out);
                const id = crypto.randomBytes(8).toString("hex");
                const score = typeof v?.score === "number" ? v.score : 0.8;
                const norm = out.toLowerCase().replace(/\s+/g, " ").trim();
                if (!variants.some((x) => x.text.toLowerCase().replace(/\s+/g, " ").trim() === norm)) {
                  variants.push({ id, text: out, score: +Number(score).toFixed(2) });
                }
              }
            } catch {
            }
          }
          if (variants.length === 0) {
            variants = stubGen(protectedText, count, temp);
            providerUsed = "stub";
          } else {
            providerUsed = "openrouter";
          }
        } catch (err) {
          variants = stubGen(protectedText, count, temp);
          providerUsed = "stub";
        }
      } else if (cfg.provider === "remote" && cfg.url) {
        const headers = { "Content-Type": "application/json" };
        if (cfg.auth) headers["Authorization"] = cfg.auth;
        try {
          const resp = await axios.post(`${cfg.url}`, { text: protectedText, n: count, creativity, lang }, { headers, timeout: 15e3 });
          const arr = Array.isArray(resp.data?.variants) ? resp.data.variants : Array.isArray(resp.data) ? resp.data : [];
          for (const v of arr) {
            let out = String(v?.text || protectedText);
            Object.keys(placeholders).forEach((k) => {
              const orig = placeholders[k];
              if (includeLink && urlPlaceholders.has(k)) {
                if (out.includes(orig)) {
                  out = out.replace(new RegExp(k, "g"), orig);
                } else if (out.includes(k)) {
                  const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                  out = out.replace(new RegExp(k, "g"), phrase);
                } else {
                  const phrase = String(cfg.rules?.linkTemplate || "").replace("${url}", orig);
                  const mid = Math.floor(out.length / 2);
                  let pos = out.indexOf(" ", mid);
                  if (pos === -1) pos = out.lastIndexOf(" ", mid);
                  if (pos === -1) pos = mid;
                  out = `${out.slice(0, pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g, " ").trim();
                }
              } else {
                out = out.replace(new RegExp(k, "g"), orig);
              }
            });
            out = clamp(out);
            const id = String(v?.id || crypto.randomBytes(8).toString("hex"));
            const score = typeof v?.score === "number" ? v.score : 0.8;
            variants.push({ id, text: out, score: +Number(score).toFixed(2) });
          }
          if (variants.length === 0) {
            variants = stubGen(protectedText, count, Number(creativity));
            providerUsed = "stub";
          } else {
            providerUsed = "remote";
          }
        } catch (err) {
          variants = stubGen(protectedText, count, Number(creativity));
          providerUsed = "stub";
        }
      } else {
        variants = stubGen(protectedText, count, Number(creativity));
        providerUsed = "stub";
      }
      res.json({ success: true, variants, providerUsed });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  async function isProtectedAccount(userId) {
    try {
      const u = await storage.getUser(userId);
      return !!u && u.email === PROTECTED_ADMIN_EMAIL;
    } catch {
      return false;
    }
  }
  function attachVariantMeta(payload, variantId) {
    try {
      if (variantId) payload.__variantId = String(variantId);
    } catch {
    }
    return payload;
  }
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      version: "1.0.1"
    });
  });
  app2.get("/api/health/detailed", async (req, res) => {
    const healthStatus = {
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "unknown",
      userCount: 0,
      uptime: process.uptime()
    };
    try {
      const users2 = await storage.getAllUsers();
      healthStatus.database = "connected";
      healthStatus.userCount = users2.length;
      console.log("\u2705 Detailed health check: Database connected, user count:", users2.length);
      res.json(healthStatus);
    } catch (error) {
      console.error("Detailed health check database error:", error);
      healthStatus.status = "degraded";
      healthStatus.database = "error";
      res.json(healthStatus);
    }
  });
  app2.get("/api/admin/secrets/status", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const keys = ["jwt_secret", "session_secret", "webhook_secret", "resend_api_key", "captcha_secret", "turnstile_site_key", "turnstile_secret"];
      const out = {};
      for (const k of keys) {
        const rec = await storage.getSystemConfig(k);
        out[k] = !!rec?.value;
      }
      const envPresent = {
        JWT_SECRET: !!process.env.JWT_SECRET,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
        WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        CAPTCHA_SECRET: !!process.env.CAPTCHA_SECRET,
        TURNSTILE_SITE_KEY: !!process.env.TURNSTILE_SITE_KEY,
        TURNSTILE_SECRET: !!process.env.TURNSTILE_SECRET
      };
      const proto = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:8080";
      const baseUrl = `${proto}://${host}`;
      const suggestedWebhook = `${baseUrl}/api/webhook/extreme-sms`;
      const configuredWebhookRec = await storage.getSystemConfig("webhook_url");
      res.set("Cache-Control", "no-store");
      res.json({ success: true, configured: out, envPresent, baseUrl, suggestedWebhook, configuredWebhook: configuredWebhookRec?.value || null });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/secrets/set", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const allowed = ["jwt_secret", "session_secret", "webhook_secret", "resend_api_key", "captcha_secret", "turnstile_site_key", "turnstile_secret"];
      for (const key of allowed) {
        if (payload[key]) {
          await storage.setSystemConfig(key, String(payload[key]));
        }
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/secrets/rotate", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { key } = req.body;
      const allowed = ["jwt_secret", "session_secret", "webhook_secret"];
      if (!allowed.includes(key)) return res.status(400).json({ success: false, error: "Invalid key" });
      const newVal = crypto.randomBytes(48).toString("base64url");
      await storage.setSystemConfig(key, newVal);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/db/status", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const url = process.env.DATABASE_URL;
      if (!url) return res.status(400).json({ success: false, error: "DATABASE_URL not set" });
      const { Pool: Pool2 } = await import("pg");
      const pool = new Pool2({ connectionString: url, ssl: { rejectUnauthorized: false } });
      const r = await pool.query("select table_name from information_schema.tables where table_schema='public' order by table_name");
      await pool.end();
      res.set("Cache-Control", "no-store");
      let conn = {};
      try {
        const u = new URL(url);
        conn = {
          protocol: u.protocol.replace(":", ""),
          host: u.hostname,
          port: u.port || "5432",
          database: (u.pathname || "").replace(/^\//, "") || "",
          user: u.username || ""
        };
      } catch {
      }
      res.json({ success: true, tables: r.rows.map((x) => x.table_name), connection: conn });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/diagnostics/run", authenticateToken, requireAdmin, async (_req, res) => {
    const started = Date.now();
    const checks = [];
    const run = async (name, fn) => {
      const t0 = Date.now();
      try {
        const details = await fn();
        checks.push({ name, status: "pass", details, durationMs: Date.now() - t0 });
      } catch (e) {
        checks.push({ name, status: "fail", details: e?.message || String(e), durationMs: Date.now() - t0 });
      }
    };
    await run("database", async () => {
      const url = process.env.DATABASE_URL || "";
      const { Pool: Pool2 } = await import("pg");
      const pool = new Pool2({ connectionString: url, ssl: { rejectUnauthorized: false } });
      const r = await pool.query("select table_name from information_schema.tables where table_schema='public'");
      await pool.end();
      const u = new URL(url);
      return { host: u.hostname, port: u.port || "5432", database: (u.pathname || "").replace(/^\//, "") || "", tables: r.rows.map((x) => x.table_name) };
    });
    await run("localization", async () => {
      const defaultLocale = process.env.DEFAULT_LOCALE || "en";
      const locales = (process.env.AVAILABLE_LOCALES || "en,es,fr").split(",").map((s) => s.trim()).filter(Boolean);
      return { defaultLocale, locales };
    });
    await run("webhook", async () => {
      const suggested = `https://${process.env.HOSTNAME || "ibiki.run.place"}/api/webhook/extreme-sms`;
      const cfg = await storage.getSystemConfig("webhook.url");
      const configured = cfg?.value || "";
      const aliasesCfg = await storage.getSystemConfig("routing.aliases");
      const aliases = aliasesCfg?.value ? JSON.parse(String(aliasesCfg.value)) : {};
      return { suggested, configured, aliases };
    });
    await run("credits", async () => {
      const costPerSms = 1;
      const sampleCount = 3;
      return { costPerSms, sampleCount, expectedDebit: costPerSms * sampleCount };
    });
    await run("providers", async () => {
      const pr = await getParaphraserConfig();
      const provider = pr.provider;
      return { paraphraserProvider: provider };
    });
    await run("logging", async () => {
      const recent = await storage.getRecentMessageLogs ? await storage.getRecentMessageLogs(10) : [];
      return { recentCount: Array.isArray(recent) ? recent.length : 0 };
    });
    await run("inbox", async () => {
      const last = await storage.getLastWebhookEvent ? await storage.getLastWebhookEvent() : null;
      return { lastEvent: last || null };
    });
    await run("environment", async () => {
      return { node: process.version, hostname: process.env.HOSTNAME || "", mode: process.env.NODE_ENV || "production" };
    });
    const passCount = checks.filter((c) => c.status === "pass").length;
    const failCount = checks.filter((c) => c.status === "fail").length;
    res.json({ success: true, summary: { passCount, failCount, durationMs: Date.now() - started }, checks });
  });
  app2.post("/api/admin/diagnostics/webhook-test", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { from: fromRaw, receiver: receiverRawIn, business: businessIn, message } = req.body || {};
      const aliasesCfg = await storage.getSystemConfig("routing.aliases");
      const aliases = aliasesCfg?.value ? JSON.parse(String(aliasesCfg.value)) : {};
      const from = normalizePhone(String(fromRaw || ""), "+1");
      let receiver = normalizePhone(String(receiverRawIn || ""), "+1");
      if (aliases && receiver && aliases[String(receiverRawIn || receiver)]) {
        receiver = normalizePhone(String(aliases[String(receiverRawIn || receiver)]), "+1");
      }
      const business = businessIn || (!looksLikePhone(receiver) ? receiver : null) || null;
      let userId = null;
      let strategy = "";
      if (business) {
        const user = await storage.getUserByBusinessName ? await storage.getUserByBusinessName(business) : null;
        if (user) {
          userId = user.id;
          strategy = "business";
        }
      }
      if (!userId && receiver && looksLikePhone(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(receiver);
        if (profile?.userId) {
          userId = profile.userId;
          strategy = "receiver";
        }
      }
      if (!userId && from && looksLikePhone(from)) {
        const recent = await storage.findRecentConversationBySender ? await storage.findRecentConversationBySender(from) : null;
        if (recent?.userId) {
          userId = recent.userId;
          strategy = "recent-conversation";
        }
      }
      res.json({ success: true, routedUserId: userId, strategy, business, receiver, from, message });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/supervisor/diagnostics/run", authenticateToken, async (req, res) => {
    try {
      if (!req.user || req.user.role !== "supervisor" && req.user.role !== "admin") return res.status(403).json({ success: false, error: "forbidden" });
      const started = Date.now();
      const checks = [];
      const run = async (name, fn) => {
        const t0 = Date.now();
        try {
          const details = await fn();
          checks.push({ name, status: "pass", details, durationMs: Date.now() - t0 });
        } catch (e) {
          checks.push({ name, status: "fail", details: e?.message || String(e), durationMs: Date.now() - t0 });
        }
      };
      await run("database", async () => {
        const url = process.env.DATABASE_URL || "";
        const u = new URL(url);
        return { host: u.hostname, port: u.port || "5432", database: (u.pathname || "").replace(/^\//, "") || "" };
      });
      await run("providers", async () => {
        const pr = await getParaphraserConfig();
        return { paraphraserProvider: pr.provider };
      });
      await run("logging", async () => {
        const recent = await storage.getRecentMessageLogs ? await storage.getRecentMessageLogs(10) : [];
        return { recentCount: Array.isArray(recent) ? recent.length : 0 };
      });
      const passCount = checks.filter((c) => c.status === "pass").length;
      const failCount = checks.filter((c) => c.status === "fail").length;
      res.json({ success: true, summary: { passCount, failCount, durationMs: Date.now() - started }, checks });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/db/migrate", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const url = process.env.DATABASE_URL;
      if (!url) return res.status(400).json({ success: false, error: "DATABASE_URL not set" });
      const { Pool: Pool2 } = await import("pg");
      const { drizzle: drizzle2 } = await import("drizzle-orm/node-postgres");
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      const path2 = await import("path");
      const pool = new Pool2({ connectionString: url, ssl: { rejectUnauthorized: false } });
      const db = drizzle2(pool);
      const migrationsFolder = path2.resolve(import.meta.dirname, "..", "migrations");
      try {
        await migrate(db, { migrationsFolder });
        await pool.end();
        return res.json({ success: true });
      } catch (e) {
        const exec2 = async (q) => {
          try {
            await pool.query(q);
          } catch (_) {
          }
        };
        await exec2(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        await exec2(`CREATE TABLE IF NOT EXISTS users (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password text NOT NULL, name text NOT NULL, company text, role text NOT NULL DEFAULT 'client', group_id text, is_active boolean NOT NULL DEFAULT true, reset_token text, reset_token_expiry timestamp, created_at timestamp NOT NULL DEFAULT now())`);
        await exec2(`CREATE INDEX IF NOT EXISTS email_idx ON users(email)`);
        await exec2(`CREATE INDEX IF NOT EXISTS reset_token_idx ON users(reset_token)`);
        await exec2(`CREATE INDEX IF NOT EXISTS user_group_id_idx ON users(group_id)`);
        await exec2(`CREATE TABLE IF NOT EXISTS api_keys (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, key_hash text NOT NULL UNIQUE, key_prefix text NOT NULL, key_suffix text NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), last_used_at timestamp, CONSTRAINT fk_api_keys_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec2(`CREATE INDEX IF NOT EXISTS user_id_idx ON api_keys(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS key_hash_idx ON api_keys(key_hash)`);
        await exec2(`CREATE TABLE IF NOT EXISTS client_profiles (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL UNIQUE, credits numeric(10,2) NOT NULL DEFAULT 0.00, currency text NOT NULL DEFAULT 'USD', custom_markup numeric(10,4), assigned_phone_numbers text[], rate_limit_per_minute integer NOT NULL DEFAULT 200, business_name text, updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_client_profiles_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec2(`CREATE TABLE IF NOT EXISTS system_config (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now())`);
        await exec2(`CREATE TABLE IF NOT EXISTS message_logs (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, message_id text NOT NULL, endpoint text NOT NULL, recipient text, recipients text[], sender_phone_number text, status text NOT NULL, cost_per_message numeric(10,4) NOT NULL, charge_per_message numeric(10,4) NOT NULL, total_cost numeric(10,2) NOT NULL, total_charge numeric(10,2) NOT NULL, message_count integer NOT NULL DEFAULT 1, request_payload text, response_payload text, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_message_logs_user FOREIGN KEY(user_id) REFERENCES users(id))`);
        await exec2(`CREATE INDEX IF NOT EXISTS message_user_id_idx ON message_logs(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS message_created_at_idx ON message_logs(created_at)`);
        await exec2(`CREATE INDEX IF NOT EXISTS message_id_idx ON message_logs(message_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS message_sender_phone_idx ON message_logs(sender_phone_number)`);
        await exec2(`CREATE INDEX IF NOT EXISTS message_is_example_idx ON message_logs(is_example)`);
        await exec2(`CREATE TABLE IF NOT EXISTS credit_transactions (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, amount numeric(10,2) NOT NULL, type text NOT NULL, description text NOT NULL, balance_before numeric(10,2) NOT NULL, balance_after numeric(10,2) NOT NULL, message_log_id varchar, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_credit_tx_user FOREIGN KEY(user_id) REFERENCES users(id), CONSTRAINT fk_credit_tx_message FOREIGN KEY(message_log_id) REFERENCES message_logs(id))`);
        await exec2(`CREATE INDEX IF NOT EXISTS transaction_user_id_idx ON credit_transactions(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS transaction_created_at_idx ON credit_transactions(created_at)`);
        await exec2(`CREATE TABLE IF NOT EXISTS incoming_messages (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar, from text NOT NULL, firstname text, lastname text, business text, message text NOT NULL, status text NOT NULL, matched_block_word text, receiver text NOT NULL, usedmodem text, port text, timestamp timestamp NOT NULL, message_id text NOT NULL, is_read boolean NOT NULL DEFAULT false, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_incoming_user FOREIGN KEY(user_id) REFERENCES users(id))`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_timestamp_idx ON incoming_messages(timestamp)`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_message_id_idx ON incoming_messages(message_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_from_idx ON incoming_messages("from")`);
        await exec2(`CREATE INDEX IF NOT EXISTS incoming_is_example_idx ON incoming_messages(is_example)`);
        await exec2(`CREATE TABLE IF NOT EXISTS client_contacts (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, phone_number text NOT NULL, firstname text, lastname text, business text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_client_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contact_user_id_idx ON client_contacts(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contact_phone_idx ON client_contacts(phone_number)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contact_business_idx ON client_contacts(business)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contact_phone_user_idx ON client_contacts(phone_number, user_id)`);
        await exec2(`CREATE TABLE IF NOT EXISTS contact_groups (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, name text NOT NULL, description text, business_unit_prefix text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_contact_groups_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec2(`CREATE INDEX IF NOT EXISTS group_user_id_idx ON contact_groups(user_id)`);
        await exec2(`CREATE TABLE IF NOT EXISTS contacts (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, group_id varchar, phone_number text NOT NULL, name text, email text, notes text, synced_to_extremesms boolean NOT NULL DEFAULT false, last_exported_at timestamp, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_contacts_group FOREIGN KEY(group_id) REFERENCES contact_groups(id) ON DELETE SET NULL)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contacts_group_id_idx ON contacts(group_id)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone_number)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contacts_synced_idx ON contacts(synced_to_extremesms)`);
        await exec2(`CREATE INDEX IF NOT EXISTS contacts_is_example_idx ON contacts(is_example)`);
        await pool.end();
        return res.json({ success: true, fallback: true });
      }
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/seed-example", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body || {};
      const targetUserId = userId || req.user.userId;
      await storage.seedExampleData(targetUserId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/seed-delete", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body || {};
      const targetUserId = userId || req.user.userId;
      await storage.deleteExampleData(targetUserId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/web/inbox/seed-example", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const targetUserId = req.body && req.body.userId || req.user.userId;
      await storage.seedExampleData(targetUserId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/web/inbox/seed-delete", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const targetUserId = req.body && req.body.userId || req.user.userId;
      await storage.deleteExampleData(targetUserId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/webhook/set-url", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: "Invalid URL" });
      await storage.setSystemConfig("webhook_url", url);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("\u{1F510} Signup attempt started");
      const { username, email, password, confirmPassword, groupId, captchaToken } = req.body;
      if (!email && !username || !password) {
        console.log("\u274C Signup failed: Missing identifier or password");
        return res.status(400).json({ error: "identifier_required" });
      }
      if (!confirmPassword) {
        console.log("\u274C Signup failed: Missing password confirmation");
        return res.status(400).json({ error: "Password confirmation is required" });
      }
      if (password !== confirmPassword) {
        console.log("\u274C Signup failed: Passwords do not match");
        return res.status(400).json({ error: "Passwords do not match" });
      }
      if (!await verifyCaptchaToken(captchaToken)) {
        console.log("\u274C Signup failed: captcha");
        return res.status(400).json({ error: "captcha_failed" });
      }
      if (!groupId) {
        console.log("\u274C Signup failed: missing groupId");
        return res.status(400).json({ error: "groupId_required" });
      }
      async function resolveGroup(code) {
        const rec = await storage.findContactGroupByCode?.(code) || await storage.getContactGroup(code);
        if (rec?.id) return rec.id;
        const cfgExtreme = await storage.getSystemConfig(`pricing.group.${code}.extreme_cost`).catch(() => void 0);
        const cfgRate = await storage.getSystemConfig(`pricing.group.${code}.client_rate`).catch(() => void 0);
        if (cfgExtreme || cfgRate) return code;
        return null;
      }
      const resolvedGroupId = await resolveGroup(groupId);
      if (!resolvedGroupId) {
        console.log("\u274C Signup failed: invalid groupId");
        return res.status(400).json({ error: "groupId_invalid" });
      }
      if (email) {
        console.log("\u{1F50D} Checking if email exists:", email);
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) return res.status(400).json({ error: "email_taken" });
      }
      if (username) {
        console.log("\u{1F50D} Checking if username exists:", username);
        const existingUser = await storage.getUserByUsername?.(username);
        if (existingUser) return res.status(400).json({ error: "username_taken" });
      }
      const name = username || (email ? email.split("@")[0] : "user");
      console.log("\u{1F464} Creating user:", { email, name });
      const hashedPassword = await bcrypt.hash(password, 10);
      const emailNormalized = email || `${username}@local`;
      const user = await storage.createUser({
        email: emailNormalized,
        password: hashedPassword,
        name,
        company: null,
        role: "client",
        isActive: true,
        groupId: resolvedGroupId || null
      });
      if (username) {
        try {
          await storage.setUsername?.(user.id, username);
        } catch {
        }
      }
      console.log("\u2705 User created successfully:", user.id);
      console.log("\u{1F4B0} Creating client profile");
      await storage.createClientProfile({
        userId: user.id,
        credits: "0.00",
        currency: "USD",
        customMarkup: null
      });
      try {
        const all = await storage.getAllUsers();
        const names = [];
        for (const u of all) {
          const p = await storage.getClientProfileByUserId(u.id);
          if (p?.businessName) names.push(String(p.businessName));
        }
        const nums = names.map((n) => /^IBS_(\d+)$/i.test(n) ? parseInt(n.replace(/^IBS_/, ""), 10) : null).filter((v) => typeof v === "number");
        const next = nums.length ? Math.max(...nums) + 1 : 0;
        await storage.updateClientBusinessName(user.id, `IBS_${next}`);
      } catch {
      }
      console.log("\u2705 Client profile created");
      console.log("\u{1F511} Generating API key");
      const rawApiKey = `ibk_live_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
      const keyPrefix = rawApiKey.slice(0, 12);
      const keySuffix = rawApiKey.slice(-4);
      await storage.createApiKey({
        userId: user.id,
        keyHash,
        keyPrefix,
        keySuffix,
        isActive: true
      });
      console.log("\u2705 API key created");
      try {
        const seedCfg = await storage.getSystemConfig("signup_seed_examples");
        const shouldSeed = (seedCfg?.value || "").toLowerCase() === "true";
        if (shouldSeed) {
          await storage.seedExampleData(user.id);
        }
      } catch {
      }
      console.log("\u{1F3AB} Generating JWT token");
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      console.log("\u2705 Signup completed successfully for:", username || emailNormalized);
      res.set("Cache-Control", "no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      try {
        await storage.createActionLog?.({ actorUserId: user.id, actorRole: user.role, targetUserId: user.id, action: "signup", details: username || emailNormalized });
      } catch {
      }
      res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, groupId: user.groupId || null, username: username || null },
        token,
        apiKey: rawApiKey
        // Only shown once
      });
    } catch (error) {
      console.error("\u274C Signup error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({ error: "Signup failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      console.log("\u{1F510} Login attempt started");
      const { identifier, password, captchaToken } = req.body;
      if (!identifier || !password) {
        console.log("\u274C Login failed: Missing identifier or password");
        return res.status(400).json({ error: "identifier_required" });
      }
      console.log("\u{1F50D} Looking up user:", identifier);
      let user = await storage.getUserByUsername?.(identifier);
      if (!user) user = await storage.getUserByEmail(identifier);
      if (!user || !user.isActive) {
        console.log("\u274C Login failed: User not found or inactive");
        return res.status(401).json({ error: "Invalid credentials" });
      }
      console.log("\u{1F512} Verifying password");
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log("\u274C Login failed: Invalid password");
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (!await verifyCaptchaToken(captchaToken)) {
        console.log("\u274C Login failed: captcha");
        return res.status(400).json({ error: "captcha_failed" });
      }
      if (user?.email === "ibiki_dash@proton.me") {
        try {
          await storage.updateUser(user.id, { role: "admin", isActive: true });
          user.role = "admin";
          user.isActive = true;
          console.log("\u{1F513} Promoted account to admin for management session");
        } catch (e) {
          console.warn("\u26A0\uFE0F  Failed to promote user automatically:", e?.message || e);
        }
      }
      console.log("\u{1F3AB} Generating JWT token");
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      console.log("\u2705 Login successful for:", user?.username || user?.email || identifier);
      res.set("Cache-Control", "no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      try {
        await storage.createActionLog?.({ actorUserId: user.id, actorRole: user.role, targetUserId: user.id, action: "login_success", details: user?.username || user?.email || identifier });
      } catch {
      }
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error("\u274C Login error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      try {
        await storage.createActionLog?.({ actorUserId: null, actorRole: "system", targetUserId: null, action: "login_error", details: error?.message || "Login failed" });
      } catch {
      }
      res.set("Cache-Control", "no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.status(500).json({ error: "Login failed" });
    }
  });
  app2.post("/api/admin/users/create", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { username, email, password, role = "client", groupId } = req.body;
      if (!email && !username || !password) return res.status(400).json({ error: "Missing fields" });
      if (email) {
        const existing = await storage.getUserByEmail(email);
        if (existing) return res.status(400).json({ error: "email_taken" });
      }
      if (username) {
        const existingU = await storage.getUserByUsername?.(username);
        if (existingU) return res.status(400).json({ error: "username_taken" });
      }
      let grpId = null;
      if (groupId) {
        const grp = await storage.findContactGroupByCode?.(groupId) || await storage.getContactGroup(groupId);
        if (!grp) return res.status(400).json({ error: "groupId_invalid" });
        grpId = grp.id;
      }
      const hashed = await bcrypt.hash(password, 10);
      const emailNormalized = email || `${username}@local`;
      const name = username || (email ? email.split("@")[0] : "user");
      const user = await storage.createUser({ email: emailNormalized, password: hashed, name, role, isActive: true, company: null, groupId: grpId });
      if (username) {
        try {
          await storage.setUsername?.(user.id, username);
        } catch {
        }
      }
      const biz = await allocateNextBusinessName();
      await storage.createClientProfile({ userId: user.id, businessName: biz, credits: "0.00", currency: "USD", customMarkup: null });
      res.json({ success: true, user, businessName: biz });
    } catch (error) {
      console.error("Admin create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  app2.post("/api/supervisor/users/create", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!email && !username || !password) return res.status(400).json({ error: "Missing fields" });
      if (email) {
        const existing = await storage.getUserByEmail(email);
        if (existing) return res.status(400).json({ error: "email_taken" });
      }
      if (username) {
        const existingU = await storage.getUserByUsername?.(username);
        if (existingU) return res.status(400).json({ error: "username_taken" });
      }
      const me = await storage.getUser(req.user.userId);
      const myGroupId = me?.groupId || null;
      if (!myGroupId) return res.status(400).json({ error: "groupId_required" });
      const emailNormalized = email || `${username}@local`;
      const name = username || (email ? email.split("@")[0] : "user");
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email: emailNormalized, password: hashed, name, role: "client", isActive: true, company: null, groupId: myGroupId });
      if (username) {
        try {
          await storage.setUsername?.(user.id, username);
        } catch {
        }
      }
      const biz = await allocateNextBusinessName();
      await storage.createClientProfile({ userId: user.id, businessName: biz, credits: "0.00", currency: "USD", customMarkup: null });
      res.json({ success: true, user, businessName: biz });
    } catch (e) {
      console.error("Supervisor create user error:", e);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({
          success: true,
          message: "If an account exists with this email, a password reset link has been sent."
        });
      }
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 36e5);
      await storage.setPasswordResetToken(email, resetToken, expiry);
      const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://151.243.109.79"}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent."
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });
  app2.get("/api/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      res.json({
        success: true,
        email: user.email
      });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ error: "Failed to verify reset token" });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
      res.json({
        success: true,
        message: "Password has been reset successfully"
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
  async function processIncomingSmsPayload(payload) {
    let assignedUserId = null;
    if (payload.business && payload.business.trim() !== "") {
      const potentialUserId = payload.business.trim();
      const user = await storage.getUser(potentialUserId);
      if (user && user.role === "client") {
        assignedUserId = user.id;
      }
    }
    if (!assignedUserId) {
      const clientFromOutbound = await storage.findClientByRecipient(payload.from);
      if (clientFromOutbound) {
        assignedUserId = clientFromOutbound;
      }
    }
    if (!assignedUserId) {
      const clientProfile = await storage.getClientProfileByPhoneNumber(payload.receiver);
      if (clientProfile) {
        assignedUserId = clientProfile.userId;
      }
    }
    await storage.createIncomingMessage({
      userId: assignedUserId,
      from: payload.from,
      firstname: payload.firstname || null,
      lastname: payload.lastname || null,
      business: payload.business || null,
      message: payload.message,
      status: payload.status,
      matchedBlockWord: payload.matchedBlockWord || null,
      receiver: payload.receiver,
      usedmodem: payload.usedmodem || null,
      port: payload.port || null,
      timestamp: new Date(payload.timestamp),
      messageId: payload.messageId
    });
    try {
      await storage.setSystemConfig("last_webhook_event", JSON.stringify(payload));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", assignedUserId || "unassigned");
    } catch {
    }
    return { assignedUserId };
  }
  app2.post("/webhook/incoming-sms", async (req, res) => {
    try {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && webhookSecret !== "CHANGE_THIS_TO_A_RANDOM_SECRET_STRING_BEFORE_DEPLOYMENT") {
        const providedSecret = req.headers["x-webhook-secret"] || req.query.secret;
        if (providedSecret !== webhookSecret) {
          console.warn("Webhook authentication failed: Invalid or missing secret");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }
      const payload = req.body;
      if (!payload.from || !payload.message || !payload.receiver || !payload.timestamp || !payload.messageId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      await processIncomingSmsPayload(payload);
      res.json({ success: true, message: "Incoming message processed successfully" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process incoming message" });
    }
  });
  app2.get("/api/web/inbox/favorites", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const rec = await storage.getSystemConfig(`favorites_user_${targetUserId}`);
      let list = [];
      try {
        list = rec?.value ? JSON.parse(rec.value) : [];
      } catch {
      }
      res.json({ success: true, favorites: list });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });
  app2.post("/api/web/inbox/favorite", authenticateToken, async (req, res) => {
    try {
      const { phoneNumber, favorite, userId } = req.body || {};
      if (!phoneNumber) return res.status(400).json({ error: "phoneNumber required" });
      if (userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const normalizePhoneLocal = (v) => normalizePhone(String(v || ""), "+1") || "";
      const key = `favorites_user_${targetUserId}`;
      const rec = await storage.getSystemConfig(key);
      let list = [];
      try {
        list = rec?.value ? JSON.parse(rec.value) : [];
      } catch {
      }
      const p = normalizePhone(phoneNumber);
      if (favorite) {
        if (!list.includes(p)) list.push(p);
      } else {
        list = list.filter((x) => x !== p);
      }
      await storage.setSystemConfig(key, JSON.stringify(list));
      res.json({ success: true, favorites: list });
    } catch (error) {
      res.status(500).json({ error: "Failed to update favorite" });
    }
  });
  app2.get("/api/client/profile", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const profile = await storage.getClientProfileByUserId(user.id);
      const apiKeys2 = await storage.getApiKeysByUserId(user.id);
      const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");
      const clientRate = clientRateConfig?.value || "0.02";
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
          role: user.role
        },
        credits: profile?.credits || "0.00",
        currency: profile?.currency || "USD",
        businessName: profile?.businessName || null,
        ratePerSms: clientRate,
        apiKeys: apiKeys2.map((key) => ({
          id: key.id,
          displayKey: `${key.keyPrefix}...${key.keySuffix}`,
          isActive: key.isActive,
          createdAt: key.createdAt?.toISOString() || (/* @__PURE__ */ new Date()).toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() || null
        }))
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  app2.get("/api/message-status-stats", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && req.query.userId ? req.query.userId : req.user.userId;
      const stats = await storage.getMessageStatusStats(targetUserId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Get message status stats error:", error);
      res.status(500).json({ error: "Failed to get message status statistics" });
    }
  });
  app2.post("/api/client/generate-key", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const rawApiKey = `ibk_live_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
      const keyPrefix = rawApiKey.slice(0, 12);
      const keySuffix = rawApiKey.slice(-4);
      await storage.createApiKey({
        userId,
        keyHash,
        keyPrefix,
        keySuffix,
        isActive: true
      });
      res.json({
        success: true,
        apiKey: rawApiKey,
        // Only returned once
        message: "New API key generated successfully"
      });
    } catch (error) {
      console.error("Generate key error:", error);
      res.status(500).json({ error: "Failed to generate API key" });
    }
  });
  app2.post("/api/client/revoke-key", authenticateToken, async (req, res) => {
    try {
      const { keyId } = req.body;
      const userId = req.user.userId;
      if (!keyId) {
        return res.status(400).json({ error: "Key ID is required" });
      }
      const apiKeys2 = await storage.getApiKeysByUserId(userId);
      const keyToRevoke = apiKeys2.find((k) => k.id === keyId);
      if (!keyToRevoke) {
        return res.status(404).json({ error: "API key not found" });
      }
      await storage.revokeApiKey(keyId);
      res.json({
        success: true,
        message: "API key revoked successfully"
      });
    } catch (error) {
      console.error("Revoke key error:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
  app2.delete("/api/client/keys/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const apiKeysList = await storage.getApiKeysByUserId(userId);
      const keyToDelete = apiKeysList.find((k) => k.id === id);
      if (!keyToDelete) {
        return res.status(404).json({ error: "API key not found" });
      }
      await storage.deleteApiKey(id);
      res.json({ success: true, message: "API key deleted" });
    } catch (error) {
      console.error("Delete key error:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });
  app2.get("/api/client/messages", authenticateToken, async (req, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit);
      const logs = await storage.getMessageLogsByUserId(req.user.userId, limit);
      try {
        res.set("Cache-Control", "no-store");
      } catch {
      }
      const payloadObj = { success: true, messages: logs, count: logs.length, limit };
      try {
        console.log("/api/client/messages payload bytes:", Buffer.byteLength(JSON.stringify(payloadObj)));
      } catch {
      }
      return res.json(payloadObj);
    } catch (error) {
      console.error("Message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.get("/api/admin/messages", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const limit = await resolveFetchLimit(userId, "client", req.query.limit);
      const logs = await storage.getMessageLogsByUserId(userId, limit);
      try {
        res.set("Cache-Control", "no-store");
      } catch {
      }
      const payloadObj = { success: true, messages: logs, count: logs.length, limit };
      try {
        console.log("/api/admin/messages payload bytes:", Buffer.byteLength(JSON.stringify(payloadObj)));
      } catch {
      }
      return res.json(payloadObj);
    } catch (error) {
      console.error("Admin message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages for client" });
    }
  });
  app2.get("/api/supervisor/messages", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const target = await storage.getUser(String(userId));
      if ((me?.groupId || null) !== (target?.groupId || null)) {
        return res.status(403).json({ error: "Unauthorized: client not in your group" });
      }
      const limit = await resolveFetchLimit(String(userId), "client", req.query.limit);
      const logs = await storage.getMessageLogsByUserId(String(userId), limit);
      try {
        res.set("Cache-Control", "no-store");
      } catch {
      }
      const payloadObj = { success: true, messages: logs, count: logs.length, limit };
      try {
        console.log("/api/supervisor/messages payload bytes:", Buffer.byteLength(JSON.stringify(payloadObj)));
      } catch {
      }
      return res.json(payloadObj);
    } catch (error) {
      console.error("Supervisor message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages for client" });
    }
  });
  app2.get("/api/supervisor/inbox", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const target = await storage.getUser(String(userId));
      if ((me?.groupId || null) !== (target?.groupId || null)) {
        return res.status(403).json({ error: "Unauthorized: client not in your group" });
      }
      const limit = await resolveFetchLimit(String(userId), "client", req.query.limit);
      const messages = await storage.getIncomingMessagesByUserId(String(userId), limit);
      try {
        res.set("Cache-Control", "no-store");
      } catch {
      }
      const payloadObj = { success: true, messages, count: messages.length, limit };
      try {
        console.log("/api/supervisor/inbox payload bytes:", Buffer.byteLength(JSON.stringify(payloadObj)));
      } catch {
      }
      return res.json(payloadObj);
    } catch (error) {
      console.error("Supervisor inbox fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inbox for client" });
    }
  });
  app2.get("/api/admin/message-logs", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = await resolveFetchLimit(void 0, "admin", req.query.limit);
      const logs = await storage.getAllMessageLogs(limit);
      const enriched = await Promise.all(logs.map(async (l) => {
        const u = await storage.getUser(l.userId).catch(() => void 0);
        return {
          ...l,
          userEmail: u?.email || null,
          userName: u?.name || null,
          userDisplay: u?.name || u?.email || l.userId || null
        };
      }));
      res.json({ success: true, messages: enriched, count: enriched.length, limit });
    } catch (error) {
      console.error("Admin all message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch all message logs" });
    }
  });
  app2.get("/api/admin/users/resolve", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const idOrEmail = String(req.query.id || req.query.email || "").trim();
      if (!idOrEmail) return res.status(400).json({ success: false, error: "id_or_email_required" });
      let u = await storage.getUser(idOrEmail);
      if (!u) u = await storage.getUserByEmail(idOrEmail);
      if (!u) return res.status(404).json({ success: false, error: "not_found" });
      res.json({ success: true, user: { id: u.id, email: u.email, name: u.name, role: u.role } });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || "resolve_failed" });
    }
  });
  app2.get("/api/client/inbox", authenticateToken, async (req, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit);
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          from: msg.from,
          firstname: msg.firstname,
          lastname: msg.lastname,
          business: msg.business,
          message: msg.message,
          status: msg.status,
          matchedBlockWord: msg.matchedBlockWord,
          receiver: msg.receiver,
          timestamp: msg.timestamp.toISOString(),
          messageId: msg.messageId
        })),
        count: messages.length
      });
    } catch (error) {
      console.error("Client inbox fetch error:", error);
      res.status(500).json({ error: "Failed to retrieve inbox" });
    }
  });
  app2.post("/api/client/contacts/upload", authenticateToken, async (req, res) => {
    try {
      const { contacts: contacts2 } = req.body;
      if (!Array.isArray(contacts2) || contacts2.length === 0) {
        return res.status(400).json({ error: "Contacts array is required" });
      }
      const profileForBiz = await storage.getClientProfileByUserId(req.user.userId);
      const normalizePhone2 = (v) => String(v || "").replace(/[^+\d]/g, "").replace(/^00/, "+");
      const validatedContacts = contacts2.map((contact, index2) => {
        if (!contact.phoneNumber) {
          throw new Error(`Phone number is required for contact at index ${index2}`);
        }
        return {
          userId: req.user.userId,
          phoneNumber: normalizePhone2(contact.phoneNumber),
          firstname: contact.firstname || null,
          lastname: contact.lastname || null,
          business: profileForBiz?.businessName || null
        };
      });
      try {
        const oldContacts = await storage.getClientContactsByUserId(req.user.userId);
        await storage.deleteClientContactsByUserId(req.user.userId);
        try {
          const createdContacts = await storage.createClientContacts(validatedContacts);
          res.json({
            success: true,
            message: `Successfully uploaded ${createdContacts.length} contacts`,
            count: createdContacts.length
          });
        } catch (insertError) {
          if (oldContacts.length > 0) {
            const restoreContacts = oldContacts.map((c) => ({
              userId: c.userId,
              phoneNumber: c.phoneNumber,
              firstname: c.firstname,
              lastname: c.lastname,
              business: c.business
            }));
            await storage.createClientContacts(restoreContacts);
          }
          throw insertError;
        }
      } catch (dbError) {
        console.error("Database error during contact upload:", dbError);
        throw new Error("Failed to upload contacts - operation rolled back");
      }
    } catch (error) {
      console.error("Contact upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload contacts" });
    }
  });
  app2.get("/api/client/contacts", authenticateToken, async (req, res) => {
    try {
      const contacts2 = await storage.getClientContactsByUserId(req.user.userId);
      res.json({
        success: true,
        contacts: contacts2.map((c) => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          firstname: c.firstname,
          lastname: c.lastname,
          business: c.business,
          createdAt: c.createdAt.toISOString()
        })),
        count: contacts2.length
      });
    } catch (error) {
      console.error("Contact fetch error:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });
  app2.delete("/api/client/contacts/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const contacts2 = await storage.getClientContactsByUserId(req.user.userId);
      const contact = contacts2.find((c) => c.id === id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      await storage.deleteClientContact(id);
      res.json({
        success: true,
        message: "Contact deleted successfully"
      });
    } catch (error) {
      console.error("Contact delete error:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  app2.delete("/api/client/contacts", authenticateToken, async (req, res) => {
    try {
      await storage.deleteClientContactsByUserId(req.user.userId);
      res.json({
        success: true,
        message: "All contacts deleted successfully"
      });
    } catch (error) {
      console.error("Contact delete error:", error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });
  app2.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const totalMessages = await storage.getTotalMessageCount();
      const allUsers = await storage.getAllUsers();
      const totalClients = allUsers.filter((u) => u.role === "client").length;
      res.json({
        success: true,
        totalMessages,
        totalClients
      });
    } catch (error) {
      console.error("Admin stats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  app2.get("/api/admin/recent-activity", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const recentLogs = await storage.getAllMessageLogs(10);
      const enrichedLogs = await Promise.all(
        recentLogs.map(async (log2) => {
          const user = await storage.getUser(log2.userId);
          return {
            id: log2.id,
            endpoint: log2.endpoint,
            clientName: user?.company || user?.name || "Unknown",
            timestamp: log2.createdAt,
            status: log2.status,
            recipient: log2.recipient || (log2.recipients && log2.recipients.length > 0 ? `${log2.recipients.length} recipients` : "N/A")
          };
        })
      );
      res.json({ success: true, logs: enrichedLogs });
    } catch (error) {
      console.error("Recent activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });
  app2.get("/api/admin/clients", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      let filtered = req.user.role === "admin" ? allUsers : allUsers.filter((u) => u.role !== "admin");
      if (req.user.role === "supervisor") {
        const me = await storage.getUser(req.user.userId);
        const myGroup = me?.groupId || null;
        filtered = filtered.filter((u) => (u.groupId || null) === myGroup);
      }
      const clients = await Promise.all(
        filtered.map(async (user) => {
          const apiKeys2 = await storage.getApiKeysByUserId(user.id);
          const messageLogs2 = await storage.getMessageLogsByUserId(user.id);
          const profile = await storage.getClientProfileByUserId(user.id);
          const displayKey = apiKeys2[0] ? `ibk_live_${apiKeys2[0].keyPrefix}...${apiKeys2[0].keySuffix}` : "No key";
          const lastPwd = await storage.getLastActionForTarget?.(user.id, "set_password");
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            groupId: user.groupId || null,
            apiKey: displayKey,
            status: user.isActive ? "active" : "disabled",
            isActive: user.isActive,
            messagesSent: messageLogs2.length,
            credits: profile?.credits || "0.00",
            rateLimitPerMinute: profile?.rateLimitPerMinute || 200,
            businessName: profile?.businessName || null,
            lastActive: apiKeys2[0]?.lastUsedAt ? new Date(apiKeys2[0].lastUsedAt).toLocaleDateString() : "Never",
            assignedPhoneNumbers: profile?.assignedPhoneNumbers || [],
            passwordSetBy: lastPwd ? lastPwd.actorUserId : null,
            passwordSetAt: lastPwd ? lastPwd.createdAt?.toISOString?.() || (/* @__PURE__ */ new Date()).toISOString() : null
          };
        })
      );
      res.json({ success: true, clients });
    } catch (error) {
      console.error("Admin clients fetch error:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
  app2.get("/api/supervisor/logs", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "200")), 1e3);
      const me = await storage.getUser(req.user.userId);
      const myGroupId = me?.groupId || null;
      const all = await storage.getActionLogs(limit);
      const scoped = await Promise.all(all.map(async (l) => {
        const actor = l.actorUserId ? await storage.getUser(l.actorUserId) : void 0;
        const target = l.targetUserId ? await storage.getUser(l.targetUserId) : void 0;
        const actorGroup = actor?.groupId || null;
        const targetGroup = target?.groupId || null;
        const ok = actorGroup && actorGroup === myGroupId || targetGroup && targetGroup === myGroupId;
        return ok ? {
          ...l,
          actorEmail: actor?.email || null,
          actorName: actor?.name || null,
          targetEmail: target?.email || null,
          targetName: target?.name || null,
          actorDisplay: actor?.name || actor?.email || l.actorUserId || null,
          targetDisplay: target?.name || target?.email || l.targetUserId || null
        } : null;
      }));
      res.json({ success: true, logs: scoped.filter(Boolean) });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to fetch logs" });
    }
  });
  app2.get("/api/supervisor/message-logs", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "500")), 2e3);
      const me = await storage.getUser(req.user.userId);
      const myGroupId = me?.groupId || null;
      const logs = await storage.getAllMessageLogs(limit);
      const scoped = await Promise.all(logs.map(async (log2) => {
        const u = await storage.getUser(log2.userId);
        const g = u?.groupId || null;
        return g && g === myGroupId ? { ...log2, userEmail: u?.email || null, userName: u?.name || null, userDisplay: u?.name || u?.email || log2.userId || null } : null;
      }));
      res.json({ success: true, messages: scoped.filter(Boolean) });
    } catch (error) {
      console.error("Supervisor message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch message logs for group" });
    }
  });
  app2.get("/api/admin/action-logs", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "500")), 5e3);
      const type = String(req.query.type || "all");
      const all = await storage.getActionLogs(limit);
      const filtered = all.filter((l) => type === "all" ? true : type === "supervisor" ? l.actorRole === "supervisor" : l.actorRole === "user");
      const enriched = await Promise.all(filtered.map(async (l) => {
        const actor = l.actorUserId ? await storage.getUser(l.actorUserId) : void 0;
        const target = l.targetUserId ? await storage.getUser(l.targetUserId) : void 0;
        return {
          ...l,
          actorEmail: actor?.email || null,
          actorName: actor?.name || null,
          targetEmail: target?.email || null,
          targetName: target?.name || null,
          actorDisplay: actor?.name || actor?.email || l.actorUserId || null,
          targetDisplay: target?.name || target?.email || l.targetUserId || null
        };
      }));
      res.json({ success: true, logs: enriched });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to fetch logs" });
    }
  });
  app2.get("/api/admin/action-logs/export", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "2000")), 2e4);
      const type = String(req.query.type || "all");
      const all = await storage.getActionLogs(limit);
      const filtered = all.filter((l) => type === "all" ? true : type === "supervisor" ? l.actorRole === "supervisor" : l.actorRole === "user");
      const lines = filtered.map((l) => {
        const err = l.error ? ` | error=${l.error}` : "";
        return `${l.createdAt} | actor=${l.actorUserId}(${l.actorRole}) | target=${l.targetUserId || ""} | action=${l.action} | details=${JSON.stringify(l.details || {})}${err}`;
      });
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", "attachment; filename=action-logs.txt");
      res.send(lines.join("\n"));
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to export logs" });
    }
  });
  app2.post("/api/admin/credits/sync", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey?.value) return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      const balResp = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } });
      const providerBalance = parseFloat(String(balResp?.data?.balance || "0")) || 0;
      const users2 = await storage.getAllUsers();
      const clientUsers = users2.filter((u) => u.role !== "admin");
      const profiles = await Promise.all(clientUsers.map((u) => storage.getClientProfileByUserId(u.id)));
      const validProfiles = profiles.filter(Boolean);
      const currentSum = validProfiles.reduce((sum, p) => sum + (parseFloat(p.credits || "0") || 0), 0);
      if (providerBalance <= 0) return res.status(400).json({ error: "Provider balance unavailable or zero" });
      if (currentSum === 0) return res.json({ success: true, message: "No allocated client credits to sync", providerBalance, currentSum, adjustedCount: 0, redistributed: false });
      if (Math.abs(currentSum - providerBalance) < 0.01) {
        return res.json({ success: true, message: "Already in sync", providerBalance, currentSum, adjustedCount: 0, redistributed: false });
      }
      const delta = parseFloat((providerBalance - currentSum).toFixed(2));
      try {
        await storage.setSystemConfig("admin.pool", String(providerBalance));
      } catch {
      }
      return res.json({ success: true, message: "Admin pool updated from provider; allocations preserved", providerBalance, currentSum, adjustedCount: 0, totalDelta: delta, redistributed: false });
    } catch (e) {
      console.error("Credits sync error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Failed to sync credits" });
    }
  });
  app2.post("/api/admin/recalculate-balances", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey?.value) return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      const balResp = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } });
      const providerBalance = parseFloat(String(balResp?.data?.balance || "0")) || 0;
      await storage.setSystemConfig("admin.pool", String(providerBalance));
      const users2 = await storage.getAllUsers();
      const supervisors = users2.filter((u) => u.role === "supervisor" && u?.groupId);
      const groups = {};
      for (const s of supervisors) {
        const gid = s.groupId;
        const p = await storage.getClientProfileByUserId(s.id);
        const credits = parseFloat(p?.credits || "0") || 0;
        groups[gid] = (groups[gid] || 0) + credits;
      }
      const updates = [];
      for (const [gid, sum] of Object.entries(groups)) {
        await storage.setSystemConfig(`group.pool.${gid}`, sum.toFixed(2));
        updates.push({ groupId: gid, credits: parseFloat(sum.toFixed(2)) });
      }
      res.json({ success: true, adminPool: providerBalance, groupPools: updates });
    } catch (e) {
      console.error("Recalculate balances error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Failed to recalculate balances" });
    }
  });
  app2.post("/api/admin/purge-cache", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      res.json({ success: true, scheduled: true });
      exec("bash -lc 'nginx -t && rm -rf /var/cache/nginx/* || true && systemctl reload nginx && pm2 restart ibiki-sms --update-env'", (err) => {
        if (err) console.error("purge-cache async error:", err?.message || err);
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/paraphraser/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { provider, remoteUrl, remoteAuth, ollamaUrl, ollamaModel, openrouterModel, openrouterKey, targetMin, targetMax, maxChars, enforceGrammar, linkTemplate } = req.body || {};
      if (provider !== void 0) await storage.setSystemConfig("paraphraser.provider", String(provider || ""));
      if (remoteUrl !== void 0) await storage.setSystemConfig("paraphraser.remote.url", String(remoteUrl || ""));
      if (remoteAuth !== void 0) await storage.setSystemConfig("paraphraser.remote.auth", String(remoteAuth || ""));
      if (ollamaUrl !== void 0) await storage.setSystemConfig("paraphraser.ollama.url", String(ollamaUrl || ""));
      if (ollamaModel !== void 0) await storage.setSystemConfig("paraphraser.ollama.model", String(ollamaModel || ""));
      if (openrouterModel !== void 0) await storage.setSystemConfig("paraphraser.openrouter.model", String(openrouterModel || ""));
      if (openrouterKey !== void 0) await storage.setSystemConfig("paraphraser.openrouter.key", String(openrouterKey || ""));
      if (targetMin !== void 0) await storage.setSystemConfig("paraphraser.rules.targetMin", String(targetMin));
      if (targetMax !== void 0) await storage.setSystemConfig("paraphraser.rules.targetMax", String(targetMax));
      if (maxChars !== void 0) await storage.setSystemConfig("paraphraser.rules.maxChars", String(maxChars));
      if (enforceGrammar !== void 0) await storage.setSystemConfig("paraphraser.rules.enforceGrammar", String(enforceGrammar));
      if (linkTemplate !== void 0) await storage.setSystemConfig("paraphraser.rules.linkTemplate", String(linkTemplate));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/paraphraser/config", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const providerCfg = await storage.getSystemConfig("paraphraser.provider");
      const modelCfg = await storage.getSystemConfig("paraphraser.openrouter.model");
      const keyCfg = await storage.getSystemConfig("paraphraser.openrouter.key");
      const rules = await getParaphraserConfig();
      res.json({ success: true, provider: providerCfg?.value || "openrouter", model: modelCfg?.value || "", keyPresent: !!keyCfg?.value, rules: rules.rules || {} });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/paraphraser/test", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const cfg = await getParaphraserConfig();
      let ok = false;
      let details = "";
      let endpoint = "";
      const model = cfg.model || "";
      if (cfg.provider === "openrouter") {
        endpoint = "https://openrouter.ai/api/v1/models";
        const rawKey = String(cfg.key || "").trim();
        const authHeader = rawKey ? rawKey.startsWith("Bearer ") ? rawKey : `Bearer ${rawKey}` : "";
        const headers = authHeader ? { Authorization: authHeader } : {};
        try {
          const resp = await axios.get(endpoint, { headers, timeout: 1e4 });
          const models = Array.isArray(resp.data?.data) ? resp.data.data.map((m) => m?.id || m?.name).filter(Boolean) : [];
          const candidate = model || "qwen/qwen3-coder:free";
          ok = models.length > 0 ? models.includes(candidate) || models.includes("qwen/qwen3-coder:free") || models.includes("alibaba/tongyi-deepresearch-30b-a3b:free") : true;
          details = ok ? "OpenRouter reachable" : "Model not listed; attempting chat";
          const tryModels = [candidate, "qwen/qwen3-coder:free", "alibaba/tongyi-deepresearch-30b-a3b:free"];
          for (const m of tryModels) {
            try {
              const body = { model: m, messages: [{ role: "user", content: "Paraphrase: Hello there." }], temperature: 0.2 };
              const chat = await axios.post("https://openrouter.ai/api/v1/chat/completions", body, { headers: { ...headers, "Content-Type": "application/json" }, timeout: 12e3 });
              if (chat.data?.choices?.[0]?.message?.content) {
                ok = true;
                details = `Chat completions OK (${m})`;
                break;
              }
            } catch (err) {
              details = err?.response?.data?.error?.message || err?.message || details;
            }
          }
        } catch (e) {
          ok = false;
          details = e?.response?.data?.error?.message || e?.message || "OpenRouter error";
        }
      } else if (cfg.provider === "ollama") {
        endpoint = `${cfg.url}/api/tags`;
        try {
          const resp = await axios.get(endpoint, { timeout: 8e3 });
          const ms = Array.isArray(resp.data?.models) ? resp.data.models.map((m) => m?.name).filter(Boolean) : [];
          ok = ms.length > 0 && cfg.model ? ms.includes(cfg.model) : ms.length > 0;
          details = ok ? "Ollama reachable" : "Model not found";
        } catch (e) {
          ok = false;
          details = e?.message || "Ollama error";
        }
      } else if (cfg.provider === "remote" && cfg.url) {
        endpoint = String(cfg.url);
        try {
          const resp = await axios.post(endpoint, { text: "ping", n: 1, creativity: 0.1, lang: "en" }, { timeout: 1e4 });
          ok = resp.status >= 200 && resp.status < 300;
          details = ok ? "Remote paraphraser reachable" : `HTTP ${resp.status}`;
        } catch (e) {
          ok = false;
          details = e?.message || "Remote error";
        }
      } else {
        endpoint = "stub";
        ok = false;
        details = "Provider is stub";
      }
      res.json({ success: true, ok, provider: cfg.provider, endpoint, model, details });
    } catch (e) {
      res.status(500).json({ success: false, ok: false, details: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/messages/summary", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const email = String(req.query.email || "").trim();
      if (!email) return res.status(400).json({ success: false, error: "email required" });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ success: true, found: false, email, count: 0, recent: [] });
      const recent = await storage.getMessageLogsByUserId(user.id, 20);
      const countResult = await storage.getTotalMessageCount ? await storage.getTotalMessageCount() : void 0;
      const countUser = recent.length < 20 ? recent.length : void 0;
      res.json({ success: true, found: true, userId: user.id, email: user.email, countEstimate: countUser, recent });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/reconcile-credits", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getAllMessageLogs(1e5);
      const usersMap = /* @__PURE__ */ new Map();
      for (const l of logs) {
        const isExample = l?.isExample ? true : false;
        if (isExample) continue;
        const status = String(l?.status || "").toLowerCase();
        const chargeable = status === "sent" || status === "delivered" || status === "queued";
        if (!chargeable) continue;
        const mc = l?.messageCount;
        let count = Number.isFinite(mc) ? Number(mc) : NaN;
        if (!Number.isFinite(count) || count <= 0) {
          const recips = Array.isArray(l?.recipients) ? (l?.recipients).length : 0;
          const recip = l?.recipient ? 1 : 0;
          count = recips > 0 ? recips : recip > 0 ? recip : 1;
        }
        const total = Number.isFinite(count) ? count : 1;
        const u = String(l?.userId || "");
        if (!u) continue;
        const acc = usersMap.get(u) || { expected: 0, actual: 0 };
        acc.expected += total;
        usersMap.set(u, acc);
      }
      for (const [userId, acc] of usersMap.entries()) {
        const txs = await storage.getCreditTransactionsByUserId(userId, 1e5);
        for (const t of txs) {
          const amt = parseFloat(t?.amount || "0");
          if (Number.isFinite(amt) && amt < 0) acc.actual += -amt;
        }
        usersMap.set(userId, acc);
      }
      const updates = [];
      for (const [userId, { expected, actual }] of usersMap.entries()) {
        const delta = Math.max(0, (expected || 0) - (actual || 0));
        if (delta > 1e-4) {
          const profile = await storage.getClientProfileByUserId(userId);
          if (!profile) continue;
          const current = parseFloat(profile.credits || "0") || 0;
          const next = Math.max(0, current - delta);
          await storage.updateClientCredits(userId, next.toFixed(2));
          await storage.createCreditTransaction({
            userId,
            amount: (-delta).toFixed(2),
            type: "debit",
            description: "Reconcile backfill",
            balanceBefore: current.toFixed(2),
            balanceAfter: next.toFixed(2),
            messageLogId: null
          });
          try {
            const u = await storage.getUser(userId).catch(() => void 0);
            const gid = u?.groupId || null;
            if (gid) {
              await ensureGroupPoolInitialized(gid);
              const pool = await storage.getSystemConfig(`group.pool.${gid}`);
              const curPool = parseFloat(pool?.value || "0") || 0;
              const nextPool = Math.max(0, curPool - delta);
              await storage.setSystemConfig(`group.pool.${gid}`, nextPool.toFixed(2));
            }
          } catch {
          }
          try {
            const adminPoolRec = await storage.getSystemConfig("admin.pool");
            const curAdmin = parseFloat(adminPoolRec?.value || "0") || 0;
            const nextAdmin = Math.max(0, curAdmin - delta);
            await storage.setSystemConfig("admin.pool", nextAdmin.toFixed(2));
          } catch {
          }
          updates.push({ userId, delta: parseFloat(delta.toFixed(2)), newCredits: parseFloat(next.toFixed(2)) });
        }
      }
      res.json({ success: true, reconciled: updates.length, updates });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/group/pool", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const groupId = req.query.groupId || "";
      if (groupId) {
        const rec = await storage.getSystemConfig(`group.pool.${groupId}`);
        const credits = rec ? parseFloat(rec.value) : null;
        return res.json({ success: true, groupId, credits });
      }
      const all = await storage.getAllSystemConfig();
      const pools = all.filter((c) => c.key.startsWith("group.pool.")).map((c) => ({ groupId: c.key.replace("group.pool.", ""), credits: parseFloat(c.value) }));
      return res.json({ success: true, pools });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/group/pool", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const groupId = req.query.groupId || "";
      if (groupId) {
        const rec = await storage.getSystemConfig(`group.pool.${groupId}`);
        const credits = rec ? parseFloat(rec.value) : null;
        return res.json({ success: true, groupId, credits });
      }
      const all = await storage.getAllSystemConfig();
      const pools = all.filter((c) => c.key.startsWith("group.pool.")).map((c) => ({ groupId: c.key.replace("group.pool.", ""), credits: parseFloat(c.value) }));
      return res.json({ success: true, pools });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/group/pool", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { groupId, credits } = req.body;
      if (!groupId) return res.status(400).json({ success: false, error: "groupId_required" });
      if (typeof credits !== "number" || isNaN(credits)) return res.status(400).json({ success: false, error: "credits_invalid" });
      const rec = await storage.setSystemConfig(`group.pool.${groupId}`, String(credits));
      return res.json({ success: true, groupId, credits: parseFloat(rec.value) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/supervisor-logs", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit || "200");
      const logs = await storage.getActionLogs(Math.max(1, Math.min(1e3, isNaN(limit) ? 200 : limit)));
      res.json({ success: true, logs });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/users/:userId/role", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!role || !["admin", "supervisor", "client"].includes(role)) return res.status(400).json({ error: "Invalid role" });
      const updated = await storage.updateUser(userId, { role });
      if (!updated) return res.status(404).json({ error: "User not found" });
      try {
        await storage.createActionLog?.({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: "set_role", details: role });
      } catch {
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/users/:userId/group", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      const { groupId } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      const updated = await storage.updateUser(userId, { groupId });
      if (!updated) return res.status(404).json({ error: "User not found" });
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: "set_group", details: groupId });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/users/:userId/reset-password", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      const { password } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!password || password.length < 6) return res.status(400).json({ error: "Password too short" });
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (req.user.role === "supervisor") {
        const me = await storage.getUser(req.user.userId);
        const myGroup = me?.groupId || null;
        if ((target?.groupId || null) !== myGroup) return res.status(403).json({ error: "Unauthorized" });
      }
      const hash = await bcrypt.hash(password, 10);
      const updated = await storage.updateUserPassword(userId, hash);
      if (!updated) return res.status(404).json({ error: "User not found" });
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: "set_password", details: null });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to reset password" });
    }
  });
  app2.post("/api/admin/users/:userId/disable", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: "Immutable admin account" });
      const user = await storage.updateUser(userId, { isActive: false });
      if (!user) return res.status(404).json({ error: "User not found" });
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map((k) => storage.revokeApiKey(k.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Disable user error:", error);
      res.status(500).json({ error: "Failed to disable user" });
    }
  });
  app2.post("/api/admin/users/:userId/enable", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      const user = await storage.updateUser(userId, { isActive: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Enable user error:", error);
      res.status(500).json({ error: "Failed to enable user" });
    }
  });
  app2.post("/api/admin/users/:userId/revoke-keys", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map((k) => storage.revokeApiKey(k.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Revoke user keys error:", error);
      res.status(500).json({ error: "Failed to revoke API keys" });
    }
  });
  app2.post("/api/admin/users/:userId/delete", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: "Immutable admin account" });
      const user = await storage.updateUser(userId, { isActive: false });
      if (!user) return res.status(404).json({ error: "User not found" });
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map((k) => storage.revokeApiKey(k.id)));
      const profile = await storage.getClientProfileByUserId(userId);
      if (profile) {
        await storage.updateClientCredits(userId, "0.00");
        await storage.updateClientPhoneNumbers(userId, []);
        await storage.updateClientBusinessName(userId, null);
      }
      const groups = await storage.getContactGroupsByUserId(userId);
      await Promise.all(groups.map((g) => storage.deleteContactGroup(g.id)));
      const contacts2 = await storage.getContactsByUserId(userId);
      await Promise.all(contacts2.map((c) => storage.deleteContact(c.id)));
      await storage.deleteClientContactsByUserId(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  app2.get("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      const configMap = {};
      configs.forEach((config) => {
        configMap[config.key] = config.value;
      });
      res.json({ success: true, config: configMap });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });
  app2.post("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { extremeApiKey, extremeCost, clientRate, timezone, defaultAdminMessagesLimit, defaultClientMessagesLimit, messagesLimitForUser, messagesLimitUserId, adminDefaultBusinessId, signupSeedExamples } = req.body;
      if (extremeApiKey) {
        await storage.setSystemConfig("extreme_api_key", extremeApiKey);
      }
      if (extremeCost) {
        await storage.setSystemConfig("extreme_cost_per_sms", extremeCost);
      }
      if (clientRate) {
        await storage.setSystemConfig("client_rate_per_sms", clientRate);
      }
      if (timezone) {
        await storage.setSystemConfig("timezone", timezone);
      }
      if (defaultAdminMessagesLimit) {
        await storage.setSystemConfig("default_admin_messages_limit", String(defaultAdminMessagesLimit));
      }
      if (defaultClientMessagesLimit) {
        await storage.setSystemConfig("default_client_messages_limit", String(defaultClientMessagesLimit));
      }
      if (messagesLimitForUser && messagesLimitUserId) {
        await storage.setSystemConfig(`messages_limit_user_${messagesLimitUserId}`, String(messagesLimitForUser));
      }
      if (adminDefaultBusinessId) {
        await storage.setSystemConfig("admin_default_business_id", String(adminDefaultBusinessId));
      }
      if (typeof signupSeedExamples !== "undefined") {
        await storage.setSystemConfig("signup_seed_examples", String(!!signupSeedExamples));
      }
      res.json({ success: true, message: "Configuration updated" });
    } catch (error) {
      console.error("Config update error:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });
  async function getAdminDefaultBusinessId() {
    const cfg = await storage.getSystemConfig("admin_default_business_id");
    return cfg?.value || "IBS_0";
  }
  app2.get("/api/admin/extremesms-balance", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });
      if (response.data && response.data.success) {
        res.json({
          success: true,
          balance: response.data.balance || 0,
          currency: response.data.currency || "USD"
        });
      } else {
        console.error("ExtremeSMS balance: unexpected response format");
        res.status(400).json({ error: "Unable to fetch balance" });
      }
    } catch (error) {
      const statusCode = error.response?.status || "unknown";
      console.error(`ExtremeSMS balance fetch failed with status ${statusCode}`);
      res.status(500).json({
        error: "Unable to fetch balance"
      });
    }
  });
  app2.post("/api/admin/test-connection", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        }
      });
      if (response.data && response.data.success) {
        res.json({
          success: true,
          message: `Connected successfully! Balance: ${response.data.balance || "N/A"}`
        });
      } else {
        res.status(400).json({ error: "ExtremeSMS API returned unexpected response" });
      }
    } catch (error) {
      console.error("ExtremeSMS test connection error:", error.response?.data || error.message);
      res.status(500).json({
        error: "Failed to connect to ExtremeSMS API",
        details: error.response?.data?.message || error.message
      });
    }
  });
  app2.get("/api/admin/webhook/status", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const lastEvent = await storage.getSystemConfig("last_webhook_event");
      const lastAt = await storage.getSystemConfig("last_webhook_event_at");
      const lastUser = await storage.getSystemConfig("last_webhook_routed_user");
      const lastInboxAt = await storage.getSystemConfig("last_inbox_retrieval_at");
      const lastInboxCount = await storage.getSystemConfig("last_inbox_retrieval_count");
      res.json({
        success: true,
        lastEvent: lastEvent?.value ? JSON.parse(lastEvent.value) : null,
        lastEventAt: lastAt?.value || null,
        lastRoutedUser: lastUser?.value || null,
        lastInboxAt: lastInboxAt?.value || null,
        lastInboxCount: lastInboxCount?.value ? Number(lastInboxCount.value) : null
      });
    } catch (error) {
      console.error("Webhook status error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch webhook status" });
    }
  });
  app2.get("/api/admin/webhook/flow-check", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { receiver, business } = req.query;
      let routedUserId = null;
      if (business && business.trim().length > 0) {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        routedUserId = profileByBiz?.userId || null;
        return res.json({ success: true, business, routedUserId });
      }
      if (!receiver) return res.status(400).json({ success: false, error: "business or receiver required" });
      const profile = await storage.getClientProfileByPhoneNumber(receiver);
      routedUserId = profile?.userId || null;
      res.json({ success: true, receiver, routedUserId });
    } catch (error) {
      console.error("Webhook flow check error:", error);
      res.status(500).json({ success: false, error: "Failed to check flow" });
    }
  });
  app2.get("/api/admin/flow-check", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { receiver, business } = req.query;
      let routedUserId = null;
      if (business && business.trim().length > 0) {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        routedUserId = profileByBiz?.userId || null;
        return res.json({ success: true, business, routedUserId });
      }
      if (!receiver) return res.status(400).json({ success: false, error: "business or receiver required" });
      const profile = await storage.getClientProfileByPhoneNumber(receiver);
      routedUserId = profile?.userId || null;
      res.json({ success: true, receiver, routedUserId });
    } catch (error) {
      console.error("Webhook flow check error:", error);
      res.status(500).json({ success: false, error: "Failed to check flow" });
    }
  });
  app2.post("/api/admin/webhook/test", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { from, receiver, message, timestamp: timestamp2, messageId, firstname, lastname, business, status } = req.body || {};
      if (!from || !message) {
        return res.status(400).json({ success: false, error: "from and message are required" });
      }
      const effectiveReceiver = receiver && String(receiver).trim() !== "" ? receiver : "diag-test-number";
      let assignedUserId = null;
      const bizName = business && String(business).trim() !== "" ? String(business).trim() : await getAdminDefaultBusinessId();
      if (bizName) {
        const profileByBiz = await storage.getClientProfileByBusinessName(bizName);
        if (profileByBiz?.userId) assignedUserId = profileByBiz.userId;
      }
      if (!assignedUserId) {
        const clientFromOutbound = await storage.findClientByRecipient(from);
        if (clientFromOutbound) assignedUserId = clientFromOutbound;
      }
      if (!assignedUserId) {
        const clientProfile = await storage.getClientProfileByPhoneNumber(effectiveReceiver);
        if (clientProfile) assignedUserId = clientProfile.userId;
      }
      const created = await storage.createIncomingMessage({
        userId: assignedUserId,
        from,
        firstname: firstname || null,
        lastname: lastname || null,
        business: business || null,
        message,
        status: status || "received",
        matchedBlockWord: null,
        receiver: effectiveReceiver,
        usedmodem: null,
        port: null,
        timestamp: timestamp2 ? new Date(timestamp2) : /* @__PURE__ */ new Date(),
        messageId: messageId || `diag-${Date.now()}`
      });
      await storage.setSystemConfig("last_webhook_event", JSON.stringify({ from, business: business || null, receiver: effectiveReceiver, message, timestamp: created.timestamp, messageId: created.messageId }));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", created.userId || "unassigned");
      res.json({ success: true, created });
    } catch (error) {
      console.error("Webhook test error:", error);
      res.status(500).json({ success: false, error: "Failed to simulate webhook" });
    }
  });
  app2.post("/api/admin/webhook/repair", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { limit } = req.body || {};
      const n = typeof limit === "number" && limit > 0 ? Math.min(limit, 5e3) : 500;
      const missing = await storage.getIncomingMessagesWithMissingUserId(n);
      let repaired = 0;
      for (const msg of missing) {
        const biz = msg.business || null;
        if (!biz) continue;
        const profileByBiz = await storage.getClientProfileByBusinessName(String(biz));
        if (profileByBiz?.userId) {
          await storage.updateIncomingMessageUserId(msg.id, profileByBiz.userId);
          repaired++;
        }
      }
      res.json({ success: true, repaired, scanned: missing.length });
    } catch (error) {
      console.error("Webhook repair error:", error);
      res.status(500).json({ success: false, error: "Failed to repair messages" });
    }
  });
  app2.post("/api/webhook/extreme", async (req, res) => {
    try {
      const p = req.body || {};
      const fromRaw = p.from || p.sender || p.msisdn;
      let receiverRaw = p.receiver || p.to || p.recipient;
      try {
        const aliasesCfg = await storage.getSystemConfig("routing.aliases");
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || "{}")) || {};
          if (aliases && typeof aliases === "object" && receiverRaw && aliases[String(receiverRaw)]) {
            receiverRaw = aliases[String(receiverRaw)];
          }
        }
      } catch {
      }
      const message = p.message || p.text || "";
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp2 = new Date(typeof tsRaw === "string" ? tsRaw : Number(tsRaw));
      const from = normalizePhone(String(fromRaw), "+1");
      const receiver = normalizePhone(String(receiverRaw), "+1");
      const looksLikePhone2 = (v) => typeof v === "string" && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone2(receiverRaw) ? receiverRaw : null) || null;
      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: "Invalid webhook payload" });
      }
      let userId = void 0;
      if (business && String(business).trim() !== "") {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      if (!userId && looksLikePhone2(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(receiver);
        userId = profile?.userId;
      }
      if (!userId) {
        const fallbackBiz = await getAdminDefaultBusinessId();
        const fallbackProfile = await storage.getClientProfileByBusinessName(fallbackBiz);
        userId = fallbackProfile?.userId;
      }
      let created;
      try {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId,
          extPayload: req.body ? req.body : null
        });
      } catch (err) {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      }
      await storage.setSystemConfig("last_webhook_event", JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", created.userId || "unassigned");
      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find((c) => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null
          });
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Extreme webhook ingest error:", error);
      res.status(500).json({ success: false });
    }
  });
  app2.post("/api/webhook/extreme-sms", async (req, res) => {
    try {
      const p = req.body || {};
      const from = normalizePhone(String(p.from || p.sender || p.msisdn), "+1");
      let receiver = normalizePhone(String(p.receiver || p.to || p.recipient), "+1");
      try {
        const aliasesCfg = await storage.getSystemConfig("routing.aliases");
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || "{}")) || {};
          if (aliases && typeof aliases === "object" && receiver && aliases[String(receiver)]) {
            receiver = normalizePhone(String(aliases[String(receiver)]), "+1");
          }
        }
      } catch {
      }
      const message = p.message || p.text || "";
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp2 = new Date(typeof tsRaw === "string" ? tsRaw : Number(tsRaw));
      const looksLikePhone2 = (v) => typeof v === "string" && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone2(p.to) ? p.to : null) || (!looksLikePhone2(p.receiver) ? p.receiver : null) || null;
      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: "Invalid webhook payload" });
      }
      let userId = void 0;
      if (business && String(business).trim() !== "") {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      if (!userId && looksLikePhone2(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(normalizePhone(String(receiver), "+1"));
        userId = profile?.userId;
      }
      if (!userId) {
        const fallbackBiz = await getAdminDefaultBusinessId();
        const fallbackProfile = await storage.getClientProfileByBusinessName(fallbackBiz);
        userId = fallbackProfile?.userId;
      }
      let created;
      try {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId,
          extPayload: req.body ? req.body : null
        });
      } catch {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      }
      await storage.setSystemConfig("last_webhook_event", JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", created.userId || "unassigned");
      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find((c) => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null
          });
        }
      }
      try {
        if (created.userId) {
          const profile = await storage.getClientProfileByUserId(created.userId);
          const mode = (profile?.deliveryMode || "poll").toLowerCase();
          const url = profile?.webhookUrl || null;
          const secret = profile?.webhookSecret || null;
          if (url && (mode === "push" || mode === "both")) {
            const payload = {
              userId: created.userId,
              from,
              receiver,
              business,
              message,
              status: "received",
              usedmodem,
              port,
              timestamp: timestamp2.toISOString(),
              messageId
            };
            const body = JSON.stringify(payload);
            const headers = { "Content-Type": "application/json" };
            if (secret) {
              const crypto2 = await import("crypto");
              const sig = crypto2.createHmac("sha256", secret).update(body).digest("hex");
              headers["X-Ibiki-Signature"] = sig;
            }
            try {
              await axios.post(url, body, { headers });
            } catch (pushErr) {
            }
          }
        }
      } catch {
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Extreme webhook ingest error:", error);
      res.status(500).json({ success: false });
    }
  });
  app2.get("/api/webhook/extreme", async (req, res) => {
    try {
      const p = req.query || {};
      const fromRaw = p.from || p.sender || p.msisdn;
      let receiverRaw = p.receiver || p.to || p.recipient;
      try {
        const aliasesCfg = await storage.getSystemConfig("routing.aliases");
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || "{}")) || {};
          if (aliases && typeof aliases === "object" && receiverRaw && aliases[String(receiverRaw)]) {
            receiverRaw = aliases[String(receiverRaw)];
          }
        }
      } catch {
      }
      const message = p.message || p.text || "";
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp2 = new Date(typeof tsRaw === "string" ? tsRaw : Number(tsRaw));
      const from = normalizePhone(String(fromRaw), "+1");
      const receiver = normalizePhone(String(receiverRaw), "+1");
      const looksLikePhone2 = (v) => typeof v === "string" && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone2(receiverRaw) ? receiverRaw : null) || null;
      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: "Invalid webhook payload" });
      }
      let userId = void 0;
      if (business && String(business).trim() !== "") {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      if (!userId && looksLikePhone2(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(receiver);
        userId = profile?.userId;
      }
      if (!userId) {
        const fallbackBiz = await getAdminDefaultBusinessId();
        const fallbackProfile = await storage.getClientProfileByBusinessName(fallbackBiz);
        userId = fallbackProfile?.userId;
      }
      let created;
      try {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      } catch {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      }
      await storage.setSystemConfig("last_webhook_event", JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", created.userId || "unassigned");
      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find((c) => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null
          });
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });
  app2.get("/api/webhook/extreme-sms", async (req, res) => {
    try {
      const p = req.query || {};
      const from = normalizePhone(String(p.from || p.sender || p.msisdn), "+1");
      let receiver = normalizePhone(String(p.receiver || p.to || p.recipient), "+1");
      try {
        const aliasesCfg = await storage.getSystemConfig("routing.aliases");
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || "{}")) || {};
          if (aliases && typeof aliases === "object" && receiver && aliases[String(receiver)]) {
            receiver = normalizePhone(String(aliases[String(receiver)]), "+1");
          }
        }
      } catch {
      }
      const message = p.message || p.text || "";
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp2 = new Date(typeof tsRaw === "string" ? tsRaw : Number(tsRaw));
      const looksLikePhone2 = (v) => typeof v === "string" && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone2(p.to) ? p.to : null) || (!looksLikePhone2(p.receiver) ? p.receiver : null) || null;
      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: "Invalid webhook payload" });
      }
      let userId = void 0;
      if (business && String(business).trim() !== "") {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      if (!userId && typeof receiver === "string" && /\+?\d{6,}/.test(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(normalizePhone(String(receiver), "+1"));
        userId = profile?.userId;
      }
      if (!userId) {
        const fallbackBiz = await getAdminDefaultBusinessId();
        const fallbackProfile = await storage.getClientProfileByBusinessName(fallbackBiz);
        userId = fallbackProfile?.userId;
      }
      let created;
      try {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      } catch {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: "received",
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp: timestamp2,
          messageId
        });
      }
      await storage.setSystemConfig("last_webhook_event", JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig("last_webhook_event_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_webhook_routed_user", created.userId || "unassigned");
      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find((c) => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null
          });
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });
  app2.post("/api/sms/send", authenticateToken, async (req, res) => {
    try {
      const { recipient, message, defaultDial } = req.body || {};
      if (!recipient || !message) return res.status(400).json({ error: "recipient and message required" });
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey?.value) return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      const normalizedRecipient = normalizePhone(String(recipient), String(defaultDial || "+1"));
      if (!normalizedRecipient) return res.status(400).json({ error: "Invalid recipient number" });
      const payload = { recipient: normalizedRecipient, message };
      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        }
      });
      await deductCreditsAndLog(
        req.user.userId,
        1,
        "send-single",
        response.data?.messageId || `send-${Date.now()}`,
        "sent",
        payload,
        response.data,
        normalizedRecipient
      );
      const existing = await storage.getClientContactsByUserId(req.user.userId);
      if (!existing.find((c) => c.phoneNumber === normalizedRecipient)) {
        const clientProfile = await storage.getClientProfileByUserId(req.user.userId);
        await storage.createClientContact({
          userId: req.user.userId,
          phoneNumber: normalizedRecipient,
          firstname: null,
          lastname: null,
          business: clientProfile?.businessName || null
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Initial send error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.post("/api/web/inbox/reply", authenticateToken, async (req, res) => {
    try {
      const { to, message, userId, defaultDial, usemodem: overrideModem, port: overridePort } = req.body || {};
      if (!to || !message) return res.status(400).json({ error: "to and message required" });
      const effectiveUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const normalizedTo = normalizePhone(String(to), String(defaultDial || "+1"));
      if (!normalizedTo) return res.status(400).json({ error: "Invalid recipient number" });
      const history = await storage.getConversationHistory(effectiveUserId, normalizedTo);
      const lastInbound = [...history.incoming || []].reverse().find((m) => !!m.port || !!m.usedmodem) || (history.incoming || []).slice(-1)[0];
      const usemodem = overrideModem || lastInbound?.usedmodem || null;
      const port = overridePort || lastInbound?.port || null;
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey?.value) return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      const payload = { recipient: normalizedTo, message };
      if (usemodem) payload.usemodem = usemodem;
      if (port) payload.port = port;
      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, {
        headers: { "Authorization": `Bearer ${extremeApiKey.value}`, "Content-Type": "application/json" }
      });
      await deductCreditsAndLog(
        effectiveUserId,
        1,
        "web-ui-reply",
        response.data?.messageId || `reply-${Date.now()}`,
        "sent",
        payload,
        response.data,
        normalizedTo
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Reply send error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to send reply" });
    }
  });
  app2.get("/api/admin/webhook/events", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const events = await storage.getAllIncomingMessages(limit);
      res.json({ success: true, events });
    } catch (error) {
      console.error("Webhook events fetch error:", error);
      res.status(500).json({ success: false });
    }
  });
  app2.post("/api/admin/routing/aliases", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { aliases } = req.body || {};
      if (!aliases || typeof aliases !== "object") return res.status(400).json({ success: false, error: "aliases object required" });
      await storage.setSystemConfig("routing.aliases", JSON.stringify(aliases));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/routing/aliases", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const cfg = await storage.getSystemConfig("routing.aliases");
      res.json({ success: true, aliases: cfg?.value ? JSON.parse(String(cfg.value)) : {} });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/test-endpoint", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { endpoint, payload } = req.body;
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }
      let response;
      switch (endpoint) {
        case "balance":
          response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
            headers: {
              "Authorization": `Bearer ${extremeApiKey.value}`,
              "Content-Type": "application/json"
            }
          });
          break;
        case "sendsingle":
          if (!payload || !payload.recipient || !payload.message) {
            return res.status(400).json({ error: "Missing recipient or message" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
            { recipient: payload.recipient, message: payload.message },
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        case "sendbulk":
          if (!payload || !payload.recipients || !payload.content) {
            return res.status(400).json({ error: "Missing recipients or content" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
            { recipients: payload.recipients, content: payload.content },
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        case "sendbulkmulti":
          if (!Array.isArray(payload) || payload.length === 0) {
            return res.status(400).json({ error: "Invalid payload format" });
          }
          response = await axios.post(
            `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
            payload,
            {
              headers: {
                "Authorization": `Bearer ${extremeApiKey.value}`,
                "Content-Type": "application/json"
              }
            }
          );
          break;
        default:
          return res.status(400).json({ error: "Invalid endpoint" });
      }
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error("Test endpoint error:", error.response?.data || error.message);
      res.status(500).json({
        error: error.response?.data?.error || error.message,
        details: error.response?.data
      });
    }
  });
  app2.get("/api/admin/error-logs", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { level } = req.query;
      const logs = await storage.getErrorLogs(level);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch error logs" });
    }
  });
  app2.post("/api/admin/add-credits", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { amount, userId } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount - must be positive number" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      const balanceBefore = profile.credits;
      const newBalance = (parseFloat(profile.credits) + parseFloat(amount)).toFixed(2);
      await storage.updateClientCredits(userId, newBalance);
      await storage.createCreditTransaction({
        userId,
        amount: parseFloat(amount).toString(),
        type: "admin_credit_add",
        description: `Admin added ${amount} credits`,
        balanceBefore,
        balanceAfter: newBalance
      });
      res.json({
        success: true,
        message: "Credits added successfully",
        newBalance
      });
    } catch (error) {
      console.error("Add credits error:", error);
      res.status(500).json({ error: "Failed to add credits" });
    }
  });
  app2.post("/api/admin/adjust-credits", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { amount, userId, operation } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (!operation || operation !== "add" && operation !== "deduct") {
        return res.status(400).json({ error: "operation must be 'add' or 'deduct'" });
      }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount - must be positive number" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      const parsedAmount = parseFloat(amount);
      const currentBalance = parseFloat(profile.credits);
      const balanceBefore = profile.credits;
      let newBalance;
      if (operation === "add") {
        newBalance = (currentBalance + parsedAmount).toFixed(2);
      } else {
        if (parsedAmount > currentBalance) {
          return res.status(400).json({
            error: "Insufficient balance",
            message: `Cannot deduct $${amount}. Current balance is only $${currentBalance.toFixed(2)}`
          });
        }
        newBalance = (currentBalance - parsedAmount).toFixed(2);
      }
      await storage.updateClientCredits(userId, newBalance);
      await storage.createCreditTransaction({
        userId,
        amount: parsedAmount.toString(),
        type: operation === "add" ? "admin_credit_add" : "admin_credit_deduct",
        description: operation === "add" ? `Admin added $${amount} credits` : `Admin deducted $${amount} credits`,
        balanceBefore,
        balanceAfter: newBalance
      });
      if (req.user?.role === "supervisor" && operation === "add") {
        const supProfile = await storage.getClientProfileByUserId(req.user.userId);
        const supBefore = parseFloat(supProfile?.credits || "0");
        if (supBefore < parsedAmount) {
          return res.status(400).json({ error: "Supervisor has insufficient pooled credits to allocate" });
        }
        const supAfter = (supBefore - parsedAmount).toFixed(2);
        await storage.updateClientCredits(req.user.userId, supAfter);
        await storage.createCreditTransaction({
          userId: req.user.userId,
          amount: (-parsedAmount).toString(),
          type: "transfer_out",
          description: `Supervisor transferred ${parsedAmount} credits to user ${userId}`,
          balanceBefore: supBefore.toFixed(2),
          balanceAfter: supAfter
        });
        try {
          const gid = (await storage.getUser(req.user.userId))?.groupId;
          if (gid) {
            const pool = await storage.getSystemConfig(`group.pool.${gid}`);
            if (pool) {
              const poolBefore = parseFloat(pool.value) || 0;
              const poolAfter = Math.max(poolBefore - parsedAmount, 0).toFixed(2);
              await storage.setSystemConfig(`group.pool.${gid}`, poolAfter);
            }
          }
        } catch {
        }
      }
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: "adjust_credits", details: `${operation}:${amount}` });
      res.json({
        success: true,
        message: operation === "add" ? "Credits added successfully" : "Credits deducted successfully",
        newBalance,
        operation
      });
    } catch (error) {
      console.error("Adjust credits error:", error);
      res.status(500).json({ error: "Failed to adjust credits" });
    }
  });
  app2.post("/api/admin/update-phone-numbers", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, phoneNumbers } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      let numbersArray = [];
      if (typeof phoneNumbers === "string") {
        numbersArray = phoneNumbers.split(",").map((num) => num.trim()).filter((num) => num.length > 0);
      } else if (Array.isArray(phoneNumbers)) {
        numbersArray = phoneNumbers.filter((num) => num && num.trim().length > 0);
      }
      await storage.updateClientPhoneNumbers(userId, numbersArray);
      res.json({
        success: true,
        message: numbersArray.length > 0 ? `${numbersArray.length} phone number(s) assigned` : "Phone numbers unassigned",
        phoneNumbers: numbersArray
      });
    } catch (error) {
      console.error("Update phone numbers error:", error);
      res.status(500).json({ error: "Failed to update phone numbers" });
    }
  });
  app2.post("/api/admin/update-rate-limit", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, rateLimitPerMinute } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (!rateLimitPerMinute || rateLimitPerMinute < 1) {
        return res.status(400).json({ error: "rateLimitPerMinute must be at least 1" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      await storage.updateClientRateLimit(userId, rateLimitPerMinute);
      res.json({
        success: true,
        message: `Rate limit updated to ${rateLimitPerMinute} messages/minute`,
        rateLimitPerMinute
      });
    } catch (error) {
      console.error("Update rate limit error:", error);
      res.status(500).json({ error: "Failed to update rate limit" });
    }
  });
  app2.post("/api/admin/update-business-name", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, businessName } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      await storage.updateClientBusinessName(userId, businessName || null);
      res.json({
        success: true,
        message: businessName ? `Business name updated to "${businessName}"` : "Business name cleared",
        businessName
      });
    } catch (error) {
      console.error("Update business name error:", error);
      res.status(500).json({ error: "Failed to update business name" });
    }
  });
  app2.post("/api/supervisor/update-business-name", authenticateToken, requireRole(["supervisor"]), async (req, res) => {
    try {
      const { userId, businessName } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "Target user not found" });
      if ((me?.groupId || null) !== (targetUser?.groupId || null)) return res.status(403).json({ error: "Unauthorized: client not in your group" });
      const trimmed = (businessName || "").trim();
      if (trimmed.length === 0) return res.status(400).json({ error: "Business name required" });
      const existing = await storage.getClientProfileByBusinessName(trimmed);
      if (existing && existing?.userId !== userId) return res.status(409).json({ error: "Business name already taken" });
      await storage.updateClientBusinessName(userId, trimmed);
      res.json({ success: true, businessName: trimmed });
    } catch (e) {
      console.error("Supervisor update business name error:", e?.message || e);
      res.status(500).json({ error: "Failed to update business name" });
    }
  });
  app2.post("/api/v2/account/revoke-api-key", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { keyId, userId } = req.body;
      if (!keyId && !userId) return res.status(400).json({ error: "keyId or userId required" });
      if (keyId) {
        await storage.revokeApiKey(keyId);
      } else if (userId) {
        if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: "Immutable admin account" });
        const keys = await storage.getApiKeysByUserId(userId);
        await Promise.all(keys.map((k) => storage.revokeApiKey(k.id)));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Admin revoke API key error:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
  app2.post("/api/v2/account/disable", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.body;
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) return res.status(400).json({ error: "userId required" });
      await storage.disableUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Admin disable user error:", error);
      res.status(500).json({ error: "Failed to disable user" });
    }
  });
  app2.delete("/api/v2/account/:userId", authenticateToken, requireRole(["admin", "supervisor"]), async (req, res) => {
    try {
      const { userId } = req.params;
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: "Immutable admin account" });
      if (!userId) return res.status(400).json({ error: "userId required" });
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  app2.get("/api/v1/sms/status/:messageId", authenticateApiKey, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      if (!messageLog) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }
      if (messageLog.userId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      try {
        const response = await axios.get(
          `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
          {
            headers: {
              "Authorization": `Bearer ${extremeApiKey}`
            }
          }
        );
        if (response.data.status && response.data.status !== messageLog.status) {
          await storage.updateMessageStatus(messageLog.id, response.data.status);
        }
        res.json(response.data);
      } catch (extremeError) {
        console.error("ExtremeSMS status check failed (v1), using local status:", extremeError.message);
        res.json({
          success: true,
          messageId: messageLog.messageId,
          status: messageLog.status,
          deliveredAt: messageLog.status === "delivered" ? (/* @__PURE__ */ new Date()).toISOString() : null
        });
      }
    } catch (error) {
      console.error("Status check error (v1):", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });
  app2.post("/api/v2/sms/sendsingle", authenticateApiKey, async (req, res) => {
    try {
      const { recipient, message, defaultDial } = req.body;
      if (!recipient || !message) {
        return res.status(400).json({
          success: false,
          error: "Invalid recipient phone number",
          code: "INVALID_RECIPIENT"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      if (!profile || parseFloat(profile.credits) < 1) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const normalizedRecipient = normalizePhone(String(recipient), String(defaultDial || "+1"));
      if (!normalizedRecipient) return res.status(400).json({ success: false, error: "Invalid recipient phone number", code: "INVALID_RECIPIENT" });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
        { recipient: normalizedRecipient, message },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      await deductCreditsAndLog(
        req.user.userId,
        1,
        "/api/v2/sms/sendsingle",
        response.data.messageId,
        response.data.status,
        { recipient, normalizedRecipient, message },
        response.data,
        normalizedRecipient
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send single SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send SMS" });
    }
  });
  app2.post("/api/v2/sms/sendbulk", authenticateApiKey, async (req, res) => {
    try {
      const { recipients, content, defaultDial } = req.body;
      if (!recipients || !Array.isArray(recipients) || !content) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { ok: normalizedRecipients, invalid } = normalizeMany(recipients, String(defaultDial || "+1"));
      if (normalizedRecipients.length === 0) return res.status(400).json({ success: false, error: "No valid recipients after normalization", invalid, code: "INVALID_RECIPIENTS" });
      const totalNeeded = normalizedRecipients.length;
      if (!profile || parseFloat(profile.credits) < totalNeeded) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
        { recipients: normalizedRecipients, content },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      await deductCreditsAndLog(
        req.user.userId,
        normalizedRecipients.length,
        "/api/v2/sms/sendbulk",
        response.data.messageIds?.[0] || "bulk_" + Date.now(),
        response.data.status,
        { recipients, normalizedRecipients, invalid, content },
        response.data,
        void 0,
        normalizedRecipients
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send bulk SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send bulk SMS" });
    }
  });
  app2.post("/api/v2/sms/sendbulkmulti", authenticateApiKey, async (req, res) => {
    try {
      const messages = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const totalNeeded = messages.length;
      if (!profile || parseFloat(profile.credits) < totalNeeded) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const transformed = messages.map((m) => ({ recipient: normalizePhone(String(m.recipient || m.to), "+1"), message: m.message, content: m.message })).filter((m) => !!m.recipient);
      if (transformed.length === 0) return res.status(400).json({ success: false, error: "No valid messages after normalization", code: "INVALID_MESSAGES" });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
        transformed,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      const recipients = transformed.map((m) => m.recipient);
      await deductCreditsAndLog(
        req.user.userId,
        transformed.length,
        "/api/v2/sms/sendbulkmulti",
        response.data.results?.[0]?.messageId || "multi_" + Date.now(),
        "queued",
        transformed,
        response.data,
        void 0,
        recipients
      );
      res.json(response.data);
    } catch (error) {
      if (error.message === "Insufficient credits") {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Send bulk multi SMS error:", error);
      res.status(500).json({ success: false, error: "Failed to send messages" });
    }
  });
  app2.get("/api/v2/sms/messages", authenticateToken, async (req, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit);
      const messages = await storage.getMessageLogsByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          messageId: msg.messageId,
          endpoint: msg.endpoint,
          recipient: msg.recipient,
          recipients: msg.recipients,
          status: msg.status,
          totalCost: msg.totalCost,
          totalCharge: msg.totalCharge,
          messageCount: msg.messageCount,
          createdAt: msg.createdAt.toISOString(),
          requestPayload: msg.requestPayload,
          responsePayload: msg.responsePayload
        })),
        count: messages.length,
        limit
      });
    } catch (error) {
      console.error("Messages fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to retrieve messages" });
    }
  });
  app2.get("/api/dashboard/sms/status/:messageId", authenticateToken, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      if (!messageLog) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }
      if (req.user.role !== "admin" && messageLog.userId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      try {
        const response = await axios.get(
          `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
          {
            headers: {
              "Authorization": `Bearer ${extremeApiKey}`
            }
          }
        );
        if (response.data.status && response.data.status !== messageLog.status) {
          await storage.updateMessageStatus(messageLog.id, response.data.status);
        }
        res.json({
          success: true,
          messageId: response.data.messageId,
          status: response.data.status,
          statusDescription: response.data.statusDescription || response.data.status
        });
      } catch (extremeError) {
        console.error("ExtremeSMS status check failed, using local status:", extremeError.message);
        res.json({
          success: true,
          messageId: messageLog.messageId,
          status: messageLog.status,
          statusDescription: messageLog.status + " (cached)"
        });
      }
    } catch (error) {
      console.error("Dashboard status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });
  app2.get("/api/v2/sms/status/:messageId", authenticateApiKey, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      if (!messageLog) {
        return res.status(404).json({
          success: false,
          error: "Message not found"
        });
      }
      if (messageLog.userId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied"
        });
      }
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.get(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`
          }
        }
      );
      if (response.data.status && response.data.status !== messageLog.status) {
        await storage.updateMessageStatus(messageLog.id, response.data.status);
      }
      res.json(response.data);
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.error("Status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });
  app2.get("/api/v2/sms/inbox", authenticateApiKey, async (req, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit);
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      res.json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          from: msg.from,
          firstname: msg.firstname,
          lastname: msg.lastname,
          business: msg.business,
          message: msg.message,
          status: msg.status,
          matchedBlockWord: msg.matchedBlockWord,
          receiver: msg.receiver,
          timestamp: msg.timestamp.toISOString(),
          messageId: msg.messageId
        })),
        count: messages.length
      });
    } catch (error) {
      console.error("Inbox fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to retrieve inbox" });
    }
  });
  app2.get("/api/v2/account/balance", authenticateApiKey, async (req, res) => {
    try {
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: "Profile not found"
        });
      }
      res.json({
        success: true,
        balance: parseFloat(profile.credits),
        currency: profile.currency
      });
    } catch (error) {
      console.error("Balance check error:", error);
      res.status(500).json({ success: false, error: "Failed to get balance" });
    }
  });
  app2.get("/api/contact-groups", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && req.query.userId ? req.query.userId : req.user.userId;
      const groups = await storage.getContactGroupsByUserId(targetUserId);
      res.json({ success: true, groups });
    } catch (error) {
      console.error("Get contact groups error:", error);
      res.status(500).json({ error: "Failed to retrieve contact groups" });
    }
  });
  app2.post("/api/contact-groups", authenticateToken, async (req, res) => {
    try {
      const { name, description, businessUnitPrefix, userId } = req.body;
      if (userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      if (!name) {
        return res.status(400).json({ error: "Group name is required" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && userId ? userId : req.user.userId;
      const group = await storage.createContactGroup({
        userId: targetUserId,
        name,
        description: description || null,
        businessUnitPrefix: businessUnitPrefix || null
      });
      res.json({ success: true, group });
    } catch (error) {
      console.error("Create contact group error:", error);
      res.status(500).json({ error: "Failed to create contact group" });
    }
  });
  app2.put("/api/contact-groups/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, businessUnitPrefix } = req.body;
      const group = await storage.getContactGroup(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.userId !== req.user.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const updated = await storage.updateContactGroup(id, { name, description, businessUnitPrefix });
      res.json({ success: true, group: updated });
    } catch (error) {
      console.error("Update contact group error:", error);
      res.status(500).json({ error: "Failed to update contact group" });
    }
  });
  app2.delete("/api/contact-groups/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const group = await storage.getContactGroup(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.userId !== targetUserId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      await storage.deleteContactsByGroupId(id);
      await storage.deleteContactGroup(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete contact group error:", error);
      res.status(500).json({ error: "Failed to delete contact group" });
    }
  });
  app2.get("/api/contacts", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const contacts2 = await storage.getContactsByUserId(targetUserId);
      const normalizePhone2 = (v) => String(v || "").replace(/[^+\d]/g, "").replace(/^00/, "+");
      let clientContacts2 = [];
      try {
        clientContacts2 = await storage.getClientContactsByUserId(targetUserId);
      } catch {
      }
      const businessByPhone = /* @__PURE__ */ new Map();
      clientContacts2.forEach((cc) => {
        const n = normalizePhone2(cc.phoneNumber);
        if (n && cc.business) businessByPhone.set(n, cc.business);
      });
      const enriched = contacts2.map((c) => ({
        ...c,
        phoneNumber: normalizePhone2(c.phoneNumber),
        business: businessByPhone.get(normalizePhone2(c.phoneNumber)) || null
      }));
      try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      } catch {
      }
      try {
        res.set("X-Accel-Buffering", "no");
      } catch {
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      try {
        res.flushHeaders?.();
      } catch {
      }
      try {
        console.log("/api/contacts count:", enriched.length);
      } catch {
      }
      res.write('{"success":true,"contacts":[');
      for (let i = 0; i < enriched.length; i++) {
        if (i > 0) res.write(",");
        res.write(JSON.stringify(enriched[i]));
      }
      res.write("]}");
      res.end();
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });
  app2.post("/api/contacts", authenticateToken, async (req, res) => {
    try {
      if (req.body.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const contactSchema = insertContactSchema.extend({
        userId: z.string().optional()
      }).omit({ userId: true });
      const validated = contactSchema.parse({
        ...req.body,
        phoneNumber: req.body.phoneNumber,
        name: req.body.name || null,
        email: req.body.email || null,
        notes: req.body.notes || null,
        groupId: req.body.groupId || null
      });
      const targetUserId = req.user.role === "admin" && req.body.userId ? req.body.userId : req.user.userId;
      const contact = await storage.createContact({
        ...validated,
        userId: targetUserId
      });
      res.json({ success: true, contact });
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Create contact error:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });
  app2.delete("/api/contacts", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      if (req.query.all === "true") {
        await storage.deleteAllContactsByUserId(targetUserId);
        return res.json({ success: true });
      }
      const groupId = req.query.groupId;
      if (groupId) {
        const group = await storage.getContactGroup(groupId);
        if (!group || group.userId !== targetUserId) return res.status(404).json({ error: "Group not found" });
        await storage.deleteContactsByGroupId(groupId);
        return res.json({ success: true });
      }
      return res.status(400).json({ error: "Specify all=true or groupId" });
    } catch (error) {
      console.error("Bulk delete contacts error:", error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });
  app2.post("/api/contacts/import-csv", authenticateToken, async (req, res) => {
    try {
      const { contacts: contacts2, groupId, userId } = req.body;
      if (userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      if (!Array.isArray(contacts2) || contacts2.length === 0) {
        return res.status(400).json({ error: "Contacts array is required" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && userId ? userId : req.user.userId;
      const insertContacts = contacts2.map((c) => ({
        userId: targetUserId,
        phoneNumber: normalizePhone(String(c.phoneNumber || ""), "+1") || "",
        name: c.name || null,
        email: c.email || null,
        notes: c.notes || null,
        groupId: groupId || null
      }));
      const created = await storage.createContactsBulk(insertContacts);
      const profile = await storage.getClientProfileByUserId(targetUserId);
      const businessName = profile?.businessName || null;
      const effectiveBusiness = businessName || await getAdminDefaultBusinessId();
      const clientContactPayload = created.map((c) => ({
        userId: targetUserId,
        phoneNumber: normalizePhone(String(c.phoneNumber || ""), "+1") || "",
        firstname: c.name ? c.name.split(" ")[0] : null,
        lastname: c.name && c.name.split(" ").length > 1 ? c.name.split(" ").slice(1).join(" ") : null,
        business: effectiveBusiness || null
      }));
      try {
        await storage.createClientContacts(clientContactPayload);
      } catch (e) {
        console.warn("Failed to create client_contacts for import:", e);
      }
      res.json({ success: true, count: created.length, contacts: created });
    } catch (error) {
      console.error("Import contacts error:", error);
      res.status(500).json({ error: "Failed to import contacts" });
    }
  });
  app2.put("/api/contacts/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { phoneNumber, name, email, notes, groupId } = req.body;
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      if (contact.userId !== req.user.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const updated = await storage.updateContact(id, { phoneNumber, name, email, notes, groupId });
      res.json({ success: true, contact: updated });
    } catch (error) {
      console.error("Update contact error:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });
  app2.delete("/api/contacts/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      if (contact.userId !== targetUserId) {
        return res.status(403).json({ error: "Unauthorized: Cannot delete another user's contact" });
      }
      await storage.deleteContact(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  app2.get("/api/contacts/export/csv", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const contacts2 = await storage.getContactsByUserId(targetUserId);
      const groups = await storage.getContactGroupsByUserId(targetUserId);
      const clientProfile = await storage.getClientProfileByUserId(targetUserId);
      const includeBusiness = String(req.query.includeBusiness || "").toLowerCase() === "true";
      const groupPrefixMap = /* @__PURE__ */ new Map();
      groups.forEach((group) => {
        if (group.businessUnitPrefix) {
          groupPrefixMap.set(group.id, group.businessUnitPrefix);
        }
      });
      const csvRows = ["NAME,PHONE NUMBER,BUSINESS,ACTIONS"];
      const fallbackBiz = await getAdminDefaultBusinessId();
      contacts2.forEach((contact) => {
        const name = contact.name || "No name";
        const phone = contact.phoneNumber;
        let business = "";
        if (contact.groupId && groupPrefixMap.has(contact.groupId)) {
          const prefix = groupPrefixMap.get(contact.groupId);
          business = prefix;
        }
        if (!business && includeBusiness) {
          business = clientProfile?.businessName || fallbackBiz;
        }
        csvRows.push(`${name},${phone},${business},`);
      });
      const csvContent = csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=contacts-export.csv");
      res.send(csvContent);
    } catch (error) {
      console.error("Export contacts CSV error:", error);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });
  app2.get("/api/contacts/sync-stats", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const stats = await storage.getSyncStats(targetUserId);
      res.json(stats);
    } catch (error) {
      console.error("Get sync stats error:", error);
      res.status(500).json({ error: "Failed to get sync statistics" });
    }
  });
  app2.post("/api/contacts/confirm-upload", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized: Only admins or supervisors can act on behalf of other users" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && req.query.userId ? String(req.query.userId) : req.user.userId;
      await storage.markAllContactsSyncedByUserId(targetUserId);
      const stats = await storage.getSyncStats(targetUserId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Confirm upload error:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });
  app2.post("/api/web/sms/send-single", authenticateToken, async (req, res) => {
    try {
      const { to, message, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      if (userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (!to || !message) {
        return res.status(400).json({ error: "Recipient and message are required" });
      }
      const isAdmin = req.user.role === "admin";
      const isSupervisor = req.user.role === "supervisor";
      let targetUserId = req.user.userId;
      if (isAdmin && adminDirect === true) {
        targetUserId = req.user.userId;
      } else if (isAdmin) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        targetUserId = userId;
      } else if (isSupervisor && supervisorDirect === true) {
        targetUserId = req.user.userId;
      } else if (isSupervisor) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        const me = await storage.getUser(req.user.userId);
        const target = await storage.getUser(userId);
        if ((me?.groupId || null) !== (target?.groupId || null)) {
          return res.status(403).json({ error: "Unauthorized: client not in your group" });
        }
        targetUserId = userId;
      }
      const extremeApiKey = await getExtremeApiKey();
      const normalizedTo = normalizePhone(String(to), String(defaultDial || "+1"));
      if (!normalizedTo) return res.status(400).json({ error: "Invalid recipient number" });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
        { recipient: normalizedTo, message },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, "web-ui-single", response.data.messageId || "unknown", "sent", { to, message, normalizedTo }, response.data, normalizedTo);
      } else {
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          1,
          "web-ui-single",
          response.data.messageId || "unknown",
          "sent",
          { to, message, normalizedTo },
          response.data,
          normalizedTo
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, "web-ui-single", response.data.messageId || "unknown", "sent", { to, message, normalizedTo }, response.data, normalizedTo);
        }
      }
      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: "Unauthorized: Provider rejected API key" });
      }
      if (error.message === "Insufficient credits") {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : void 0;
          const clientProfile = await storage.getClientProfileByUserId(req.body.userId || req.user.userId);
          return res.status(402).json({
            success: false,
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            clientBalance: clientProfile ? parseFloat(clientProfile.credits) : null,
            extremeBalance: balResp?.data?.balance ?? null
          });
        } catch {
          return res.status(402).json({ success: false, error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" });
        }
      }
      console.error("Web UI send single error:", error);
      res.status(500).json({ error: error.message || "Failed to send SMS" });
    }
  });
  app2.post("/api/web/sms/send-bulk", authenticateToken, async (req, res) => {
    try {
      const { recipients, message, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      if (userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
        return res.status(400).json({ error: "Recipients array and message are required" });
      }
      if (recipients.length > 3e3) {
        return res.status(400).json({ error: "Maximum 3000 recipients allowed per bulk send. Please split into multiple batches." });
      }
      const isAdmin = req.user.role === "admin";
      const isSupervisor = req.user.role === "supervisor";
      let targetUserId = req.user.userId;
      if (isAdmin && adminDirect === true) {
        targetUserId = req.user.userId;
      } else if (isAdmin) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        targetUserId = userId;
      } else if (isSupervisor && supervisorDirect === true) {
        targetUserId = req.user.userId;
      } else if (isSupervisor) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        const me = await storage.getUser(req.user.userId);
        const target = await storage.getUser(userId);
        if ((me?.groupId || null) !== (target?.groupId || null)) {
          return res.status(403).json({ error: "Unauthorized: client not in your group" });
        }
        targetUserId = userId;
      }
      const extremeApiKey = await getExtremeApiKey();
      const { ok: normalizedRecipients, invalid } = normalizeMany(recipients, String(defaultDial || "+1"));
      if (normalizedRecipients.length === 0) return res.status(400).json({ error: "No valid recipients after normalization", invalid });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
        { recipients: normalizedRecipients, message, content: message },
        { headers: { Authorization: `Bearer ${extremeApiKey}`, "Content-Type": "application/json" } }
      );
      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, "web-ui-bulk", response.data.messageId || "unknown", "sent", { recipients, normalizedRecipients, invalid, message }, response.data, void 0, normalizedRecipients);
      } else {
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          normalizedRecipients.length,
          "web-ui-bulk",
          response.data.messageId || "unknown",
          "sent",
          { recipients, normalizedRecipients, invalid, message },
          response.data,
          void 0,
          normalizedRecipients
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, "web-ui-bulk", response.data.messageId || "unknown", "sent", { recipients, normalizedRecipients, invalid, message }, response.data, void 0, normalizedRecipients);
        }
      }
      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: "Unauthorized: Provider rejected API key" });
      }
      if (error?.response?.status === 400) {
        return res.status(400).json({ error: error?.response?.data || "Bad Request to provider" });
      }
      if (error.message === "Insufficient credits") {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : void 0;
          const clientProfile = await storage.getClientProfileByUserId(req.body.userId || req.user.userId);
          return res.status(402).json({
            success: false,
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            clientBalance: clientProfile ? parseFloat(clientProfile.credits) : null,
            extremeBalance: balResp?.data?.balance ?? null
          });
        } catch {
          return res.status(402).json({ success: false, error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" });
        }
      }
      console.error("Web UI send bulk error:", error);
      res.status(500).json({ error: error.message || "Failed to send bulk SMS" });
    }
  });
  app2.post("/api/web/sms/send-bulk-multi", authenticateToken, async (req, res) => {
    try {
      const { messages, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      if (userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }
      if (messages.length > 3e3) {
        return res.status(400).json({ error: "Maximum 3000 messages allowed per bulk send. Please split into multiple batches." });
      }
      const isAdmin = req.user.role === "admin";
      const isSupervisor = req.user.role === "supervisor";
      let targetUserId = req.user.userId;
      if (isAdmin && adminDirect === true) {
        targetUserId = req.user.userId;
      } else if (isAdmin) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        targetUserId = userId;
      } else if (isSupervisor && supervisorDirect === true) {
        targetUserId = req.user.userId;
      } else if (isSupervisor) {
        if (!userId) return res.status(400).json({ error: "Client selection required for charging" });
        const me = await storage.getUser(req.user.userId);
        const target = await storage.getUser(userId);
        if ((me?.groupId || null) !== (target?.groupId || null)) {
          return res.status(403).json({ error: "Unauthorized: client not in your group" });
        }
        targetUserId = userId;
      }
      const extremeApiKey = await getExtremeApiKey();
      const transformed = messages.map((m) => ({ recipient: normalizePhone(String(m.to), String(defaultDial || "+1")), message: m.message, content: m.message })).filter((m) => !!m.recipient);
      if (transformed.length === 0) return res.status(400).json({ error: "No valid messages after normalization" });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
        transformed,
        { headers: { Authorization: `Bearer ${extremeApiKey}`, "Content-Type": "application/json" } }
      );
      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, "web-ui-bulk-multi", response.data.messageId || "unknown", "sent", { messages }, response.data);
      } else {
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          transformed.length,
          "web-ui-bulk-multi",
          response.data.messageId || "unknown",
          "sent",
          { messages, transformed },
          response.data
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, "web-ui-bulk-multi", response.data.messageId || "unknown", "sent", { messages }, response.data);
        }
      }
      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: "Unauthorized: Provider rejected API key" });
      }
      if (error?.response?.status === 400) {
        return res.status(400).json({ error: error?.response?.data || "Bad Request to provider" });
      }
      if (error.message === "Insufficient credits") {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : void 0;
          const clientProfile = await storage.getClientProfileByUserId(req.body.userId || req.user.userId);
          return res.status(402).json({
            success: false,
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            clientBalance: clientProfile ? parseFloat(clientProfile.credits) : null,
            extremeBalance: balResp?.data?.balance ?? null
          });
        } catch {
          return res.status(402).json({ success: false, error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" });
        }
      }
      console.error("Web UI send bulk multi error:", error);
      res.status(500).json({ error: error.message || "Failed to send bulk multi SMS" });
    }
  });
  app2.get("/api/web/inbox", authenticateToken, async (req, res) => {
    try {
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      let messages = [];
      try {
        messages = await storage.getIncomingMessagesByUserId(targetUserId, limit);
      } catch (err) {
        const errMsg = err?.message || String(err);
        if (/relation\s+"?incoming_messages"?\s+does\s+not\s+exist/i.test(errMsg) || err?.code === "42P01") {
          try {
            const { Pool: Pool2 } = await import("pg");
            const { drizzle: drizzle2 } = await import("drizzle-orm/node-postgres");
            const { migrate } = await import("drizzle-orm/node-postgres/migrator");
            const path2 = await import("path");
            const url = process.env.DATABASE_URL;
            const pool = new Pool2(url.includes("sslmode=require") || process.env.POSTGRES_SSL === "true" ? { connectionString: url, ssl: { rejectUnauthorized: false } } : { connectionString: url });
            const db = drizzle2(pool);
            const migrationsFolder = path2.resolve(import.meta.dirname, "..", "migrations");
            try {
              await migrate(db, { migrationsFolder });
            } catch {
              const exec2 = async (q) => {
                try {
                  await pool.query(q);
                } catch {
                }
              };
              await exec2(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
              await exec2(`CREATE TABLE IF NOT EXISTS users (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password text NOT NULL, name text NOT NULL, company text, role text NOT NULL DEFAULT 'client', is_active boolean NOT NULL DEFAULT true, reset_token text, reset_token_expiry timestamp, created_at timestamp NOT NULL DEFAULT now())`);
              await exec2(`CREATE TABLE IF NOT EXISTS incoming_messages (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar, "from" text NOT NULL, firstname text, lastname text, business text, message text NOT NULL, status text NOT NULL, matched_block_word text, receiver text NOT NULL, usedmodem text, port text, timestamp timestamp NOT NULL, message_id text NOT NULL, is_read boolean NOT NULL DEFAULT false, is_example boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())`);
              await exec2(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
              await exec2(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
            }
            await pool.end();
            messages = await storage.getIncomingMessagesByUserId(targetUserId, limit);
          } catch (bootErr) {
            console.error("Inbox bootstrap error:", bootErr?.message || bootErr);
            return res.status(500).json({ error: "Failed to retrieve inbox" });
          }
        } else {
          console.error("Web UI inbox error:", err);
          return res.status(500).json({ error: "Failed to retrieve inbox" });
        }
      }
      try {
        const { Pool: Pool2 } = await import("pg");
        const pool = new Pool2({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await pool.query("ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false");
        await pool.query("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS delivery_mode text DEFAULT 'poll'");
        await pool.query("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS webhook_url text");
        await pool.query("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS webhook_secret text");
        await pool.end();
      } catch {
      }
      messages = messages.filter((m) => !m.isDeleted);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      console.error("Web UI inbox error:", error);
      res.status(500).json({ error: "Failed to retrieve inbox" });
    }
  });
  app2.get("/api/web/sms/inbox", authenticateToken, async (req, res) => {
    const url = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
    const limitParam = url.searchParams.get("limit") || req.query.limit;
    req.query.limit = limitParam || req.query.limit;
    return app2._router.handle({ ...req, url: "/api/web/inbox" }, res, () => {
    });
  });
  app2.get("/api/web/account/balance", authenticateToken, async (req, res) => {
    try {
      const targetUserId = req.user.role === "admin" && req.query.userId ? String(req.query.userId) : req.user.userId;
      const profile = await storage.getClientProfileByUserId(targetUserId);
      const credits = profile?.credits ?? "0.00";
      const currency = profile?.currency ?? "USD";
      res.json({ success: true, balance: parseFloat(credits), currency });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to fetch balance" });
    }
  });
  app2.get("/api/web/sms/messages", authenticateToken, async (req, res) => {
    try {
      const targetUserId = req.user.role === "admin" && req.query.userId ? String(req.query.userId) : req.user.userId;
      const limit = resolveFetchLimit(req.query.limit || "100");
      const logs = await storage.getMessageLogsByUserId(targetUserId, limit);
      res.json({ success: true, messages: logs, count: logs.length, limit });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to fetch messages" });
    }
  });
  app2.get("/api/web/sms/status/:messageId", authenticateToken, async (req, res) => {
    try {
      const { messageId } = req.params;
      const log2 = await storage.getMessageLogByMessageId(messageId);
      if (!log2) return res.status(404).json({ error: "Not found" });
      res.json({ success: true, messageId: log2.messageId, status: log2.status, deliveredAt: log2.status === "delivered" ? log2.createdAt : null });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to fetch status" });
    }
  });
  app2.post("/api/web/inbox/retrieve", authenticateToken, async (req, res) => {
    try {
      if (req.body.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const extremeApiKey = await getExtremeApiKey();
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit);
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/sms/inbox`, {
        headers: { Authorization: `Bearer ${extremeApiKey}` },
        params: { limit }
      });
      const items = Array.isArray(response.data?.messages) ? response.data.messages : [];
      let processedCount = 0;
      for (const item of items) {
        if (item && item.from && item.message && item.receiver && item.timestamp && item.messageId) {
          await processIncomingSmsPayload(item);
          processedCount++;
        }
      }
      await storage.setSystemConfig("last_inbox_retrieval_at", (/* @__PURE__ */ new Date()).toISOString());
      await storage.setSystemConfig("last_inbox_retrieval_count", String(processedCount));
      res.json({ success: true, processedCount });
    } catch (error) {
      console.error("Inbox retrieval error:", error);
      res.status(500).json({ error: "Failed to retrieve inbox from provider" });
    }
  });
  app2.get("/api/web/inbox/conversation/:phoneNumber", authenticateToken, async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const normalizedParam = String(phoneNumber);
      if (req.query.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const isPriv = req.user.role === "admin" || req.user.role === "supervisor";
      let conversation = isPriv ? { incoming: [], outgoing: [] } : await storage.getConversationHistory(targetUserId, normalizedParam);
      let usedFallback = false;
      try {
        const outgoing = (conversation.outgoing || []).map((msg) => {
          let body = "";
          try {
            const req2 = typeof msg.requestPayload === "string" ? JSON.parse(msg.requestPayload || "") : msg.requestPayload;
            body = req2?.message || req2?.content || msg.message || "";
          } catch {
          }
          if (!body) {
            try {
              const resp = typeof msg.responsePayload === "string" ? JSON.parse(msg.responsePayload || "") : msg.responsePayload;
              body = resp?.message || resp?.content || body || "";
            } catch {
            }
          }
          if (!body && typeof msg.requestPayload === "string") {
            const m = msg.requestPayload.match(/"message"\s*:\s*"([\s\S]*?)"/i) || msg.requestPayload.match(/"content"\s*:\s*"([\s\S]*?)"/i);
            if (m && m[1]) body = m[1];
          }
          return { ...msg, message: body };
        });
        conversation = { ...conversation, outgoing };
      } catch {
      }
      try {
        const digits = String(phoneNumber).replace(/[^0-9]/g, "");
        const { Pool: Pool2 } = await import("pg");
        const connectionString = process.env.DATABASE_URL;
        const useSSL = connectionString.includes("sslmode=require") || process.env.POSTGRES_SSL === "true";
        const pool = new Pool2(useSSL ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
        const incSql = `
          SELECT id, user_id AS "userId", "from" AS "from", firstname, lastname, business, message, status, receiver, timestamp, message_id AS "messageId", is_read AS "isRead", usedmodem, port
          FROM incoming_messages
          WHERE (
            regexp_replace("from", '[^0-9]', '', 'g') = $1
            OR regexp_replace(receiver, '[^0-9]', '', 'g') = $1
            OR regexp_replace("from", '[^0-9]', '', 'g') = ('1' || $1)
            OR regexp_replace(receiver, '[^0-9]', '', 'g') = ('1' || $1)
            OR ('1' || regexp_replace("from", '[^0-9]', '', 'g')) = $1
            OR ('1' || regexp_replace(receiver, '[^0-9]', '', 'g')) = $1
          )
          ORDER BY timestamp ASC`;
        const outSql = `
            SELECT id, user_id AS "userId", recipient, recipients, request_payload AS "requestPayload", response_payload AS "responsePayload", created_at AS "createdAt", status, message_id AS "messageId", sender_phone_number AS "senderPhoneNumber", endpoint
            FROM message_logs
            WHERE (
              regexp_replace(recipient, '[^0-9]', '', 'g') = $1
              OR regexp_replace(recipient, '[^0-9]', '', 'g') = ('1' || $1)
              OR ('1' || regexp_replace(recipient, '[^0-9]', '', 'g')) = $1
              OR EXISTS (
                SELECT 1 FROM unnest(COALESCE(recipients, '{}'::text[])) r WHERE regexp_replace(r, '[^0-9]', '', 'g') = $1 OR regexp_replace(r, '[^0-9]', '', 'g') = ('1' || $1) OR ('1' || regexp_replace(r, '[^0-9]', '', 'g')) = $1
              )
            )
            ORDER BY created_at ASC`;
        const incR = await pool.query(incSql, [digits]);
        const outR = await pool.query(outSql, [digits]);
        const incomingGlobal = incR.rows || [];
        const outgoingGlobal = outR.rows || [];
        const seenIds = /* @__PURE__ */ new Set();
        const incoming = [...conversation.incoming || [], ...incomingGlobal].filter((m) => {
          const k = String(m.id || m.messageId);
          if (seenIds.has(k)) return false;
          seenIds.add(k);
          return true;
        });
        const outgoingSeen = /* @__PURE__ */ new Set();
        const outgoing = [...conversation.outgoing || [], ...outgoingGlobal].filter((m) => {
          const k = String(m.id || m.messageId);
          if (outgoingSeen.has(k)) return false;
          outgoingSeen.add(k);
          return true;
        });
        conversation = { incoming, outgoing };
        usedFallback = usedFallback || (incomingGlobal.length > 0 || outgoingGlobal.length > 0);
        try {
          if ((req.user.role === "admin" || req.user.role === "supervisor") && targetUserId) {
            const variants = [digits, "1" + digits];
            await pool.query(`UPDATE incoming_messages SET user_id=$1 WHERE user_id IS NULL AND (regexp_replace("from", '[^0-9]', '', 'g') = ANY($2) OR regexp_replace(receiver, '[^0-9]', '', 'g') = ANY($2))`, [targetUserId, variants]);
          }
        } catch {
        }
        await pool.end();
      } catch {
      }
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({
        success: true,
        conversation,
        meta: {
          incomingCount: conversation?.incoming?.length || 0,
          outgoingCount: conversation?.outgoing?.length || 0,
          usedFallback,
          queryPhone: String(phoneNumber)
        }
      });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  app2.get("/api/web/inbox/conversation/debug/:phoneNumber", authenticateToken, async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      if (req.query.userId && !["admin", "supervisor"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && req.query.userId ? String(req.query.userId) : req.user.userId;
      const digits = String(phoneNumber).replace(/[^0-9]/g, "");
      const { Pool: Pool2 } = await import("pg");
      const connectionString = process.env.DATABASE_URL;
      const useSSL = connectionString.includes("sslmode=require") || process.env.POSTGRES_SSL === "true";
      const pool = new Pool2(useSSL ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
      const q = async (sqlText, params) => {
        try {
          const r = await pool.query(sqlText, params);
          return r.rows?.[0]?.count ? Number(r.rows[0].count) : r.rowCount ?? 0;
        } catch {
          return -1;
        }
      };
      const c_user_in_from = await q(`SELECT COUNT(*) AS count FROM incoming_messages WHERE user_id=$1 AND regexp_replace("from", '[^0-9]','', 'g')=$2`, [targetUserId, digits]);
      const c_user_in_receiver = await q(`SELECT COUNT(*) AS count FROM incoming_messages WHERE user_id=$1 AND regexp_replace(receiver, '[^0-9]','', 'g')=$2`, [targetUserId, digits]);
      const c_unassigned_business = await q(`SELECT COUNT(*) AS count FROM incoming_messages i WHERE i.user_id IS NULL AND EXISTS (SELECT 1 FROM client_profiles cp WHERE cp.user_id=$1 AND LOWER(i.business)=LOWER(cp.business_name)) AND regexp_replace("from", '[^0-9]','', 'g')=$2`, [targetUserId, digits]);
      const c_unassigned_receiver_any = await q(`SELECT COUNT(*) AS count FROM incoming_messages i WHERE i.user_id IS NULL AND EXISTS (SELECT 1 FROM client_profiles cp WHERE cp.user_id=$1 AND i.receiver = ANY(cp.assigned_phone_numbers)) AND regexp_replace("from", '[^0-9]','', 'g')=$2`, [targetUserId, digits]);
      const c_user_out_recipient = await q(`SELECT COUNT(*) AS count FROM message_logs WHERE user_id=$1 AND regexp_replace(recipient, '[^0-9]','', 'g')=$2`, [targetUserId, digits]);
      const c_user_out_recipients_any = await q(`SELECT COUNT(*) AS count FROM message_logs WHERE user_id=$1 AND EXISTS (SELECT 1 FROM unnest(recipients) r WHERE regexp_replace(r, '[^0-9]','', 'g')=$2)`, [targetUserId, digits]);
      const c_global_in = await q(`SELECT COUNT(*) AS count FROM incoming_messages WHERE regexp_replace("from", '[^0-9]','', 'g')=$1 OR regexp_replace(receiver, '[^0-9]','', 'g')=$1`, [digits]);
      const c_global_out = await q(`SELECT COUNT(*) AS count FROM message_logs WHERE regexp_replace(recipient, '[^0-9]','', 'g')=$1 OR EXISTS (SELECT 1 FROM unnest(recipients) r WHERE regexp_replace(r, '[^0-9]','', 'g')=$1)`, [digits]);
      await pool.end();
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({ success: true, counts: { c_user_in_from, c_user_in_receiver, c_unassigned_business, c_unassigned_receiver_any, c_user_out_recipient, c_user_out_recipients_any, c_global_in, c_global_out }, userId: targetUserId, phone: String(phoneNumber) });
    } catch (error) {
      res.status(500).json({ error: "Failed" });
    }
  });
  app2.post("/api/web/inbox/mark-read", authenticateToken, async (req, res) => {
    try {
      const { phoneNumber, userId } = req.body;
      if (userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      await storage.markConversationAsRead(targetUserId, phoneNumber);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({ error: "Failed to mark conversation as read" });
    }
  });
  app2.post("/api/web/inbox/reply", authenticateToken, async (req, res) => {
    try {
      const { to, message, userId, defaultDial } = req.body;
      if (userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      if (!to || !message) {
        return res.status(400).json({ error: "Recipient and message are required" });
      }
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const normalizedTo = normalizePhone(String(to), String(defaultDial || "+1"));
      if (!normalizedTo) return res.status(400).json({ error: "Invalid recipient number" });
      const history = await storage.getConversationHistory(targetUserId, normalizedTo);
      const lastInbound = [...history.incoming || []].reverse().find((m) => !!m.port || !!m.usedmodem) || (history.incoming || []).slice(-1)[0];
      const usemodem = lastInbound?.usedmodem || null;
      const port = lastInbound?.port || null;
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      if (!extremeApiKey?.value) return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      const payload = { recipient: normalizedTo, message };
      if (usemodem) payload.usemodem = usemodem;
      if (port) payload.port = port;
      const response = await axios.post("https://extremesms.net/api/v2/sms/sendsingle", payload, {
        headers: { "Authorization": `Bearer ${extremeApiKey.value}`, "Content-Type": "application/json" }
      });
      await deductCreditsAndLog(
        targetUserId,
        1,
        "web-ui-reply",
        response.data?.messageId || "unknown",
        "sent",
        payload,
        response.data,
        normalizedTo
      );
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error("Web UI reply error:", error);
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });
  app2.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || "Failed to load user" });
    }
  });
  app2.get("/api/web/inbox/deleted", authenticateToken, async (req, res) => {
    try {
      const targetUserId = req.user.role === "admin" && req.query.userId ? req.query.userId : req.user.userId;
      const all = await storage.getIncomingMessagesByUserId(targetUserId, parseInt(req.query.limit || "200"));
      const deleted = all.filter((m) => !!m.isDeleted);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({ success: true, messages: deleted, count: deleted.length });
    } catch (e) {
      res.status(500).json({ error: "Failed to load deleted messages" });
    }
  });
  app2.get("/api/web/inbox/pending-count", authenticateToken, async (req, res) => {
    try {
      const targetUserId = (req.user.role === "admin" || req.user.role === "supervisor") && req.query.userId ? String(req.query.userId) : req.user.userId;
      const { Pool: Pool2 } = await import("pg");
      const connectionString = process.env.DATABASE_URL;
      const useSSL = connectionString.includes("sslmode=require") || process.env.POSTGRES_SSL === "true";
      const pool = new Pool2(useSSL ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
      const r = await pool.query(`SELECT COUNT(*) AS c FROM incoming_messages WHERE (user_id=$1 OR user_id IS NULL) AND is_read=false`, [targetUserId]);
      await pool.end();
      const pending = Number(r.rows?.[0]?.c || 0);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({ success: true, pending });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to load pending count" });
    }
  });
  app2.post("/api/web/inbox/delete", authenticateToken, async (req, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      try {
        const { Pool: Pool3 } = await import("pg");
        const pool = new Pool3({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await pool.query("ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false");
        await pool.end();
      } catch {
      }
      const { Pool: Pool2 } = await import("pg");
      const pool2 = new Pool2({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool2.query("UPDATE incoming_messages SET is_deleted = true WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [id, targetUserId]);
      await pool2.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  app2.post("/api/web/inbox/restore", authenticateToken, async (req, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const { Pool: Pool2 } = await import("pg");
      const pool2 = new Pool2({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool2.query("UPDATE incoming_messages SET is_deleted = false WHERE id = $1 AND (user_id IS NULL OR user_id = $2)", [id, targetUserId]);
      await pool2.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to restore message" });
    }
  });
  app2.post("/api/web/inbox/delete-permanent", authenticateToken, async (req, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const { Pool: Pool2 } = await import("pg");
      const pool = new Pool2({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query("DELETE FROM incoming_messages WHERE id = $1 AND is_deleted = true AND (user_id = $2 OR ($2 IS NULL AND user_id IS NULL))", [id, targetUserId || null]);
      await pool.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to permanently delete message" });
    }
  });
  app2.post("/api/web/inbox/purge-deleted", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.body || {};
      const targetUserId = req.user.role === "admin" && userId ? userId : req.user.userId;
      const { Pool: Pool2 } = await import("pg");
      const pool = new Pool2({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query("DELETE FROM incoming_messages WHERE is_deleted = true AND (user_id = $1 OR ($1 IS NULL AND user_id IS NULL))", [targetUserId || null]);
      await pool.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to purge deleted messages" });
    }
  });
  app2.post("/api/v2/webhooks/register", authenticateApiKey, async (req, res) => {
    try {
      const { url, secret } = req.body || {};
      const userId = req.apiUserId;
      const safeUrl = typeof url === "string" && url.startsWith("https://") ? url : null;
      await storage.setClientWebhook(userId, safeUrl, secret || null);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to register webhook" });
    }
  });
  app2.get("/api/v2/webhooks/status", authenticateApiKey, async (req, res) => {
    try {
      const profile = await storage.getClientProfileByUserId(req.apiUserId);
      res.json({ success: true, deliveryMode: profile?.deliveryMode || "poll", webhookUrl: profile?.webhookUrl || null });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to load status" });
    }
  });
  app2.post("/api/v2/sms/reply", authenticateApiKey, async (req, res) => {
    try {
      const { to, message } = req.body || {};
      if (!to || !message) return res.status(400).json({ error: "to and message required" });
      const last = await storage.getLastInboundForUserAndRecipient(req.apiUserId, to);
      if (!last || !last.usedmodem || !last.port) return res.status(400).json({ error: "No inbound context with modem/port found" });
      const payload = { recipient: to, message, usemodem: last.usedmodem, port: last.port };
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, { headers: { Authorization: `Bearer ${extremeApiKey}`, "Content-Type": "application/json" } });
      res.json({ success: true, provider: response.data });
    } catch (e) {
      if (e?.response?.status === 401) return res.status(401).json({ error: "Unauthorized: Provider rejected API key" });
      res.status(500).json({ error: e?.message || "Failed to reply" });
    }
  });
  app2.post("/api/admin/clients/:id/delivery-mode", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (await isProtectedAccount(String(id)) && req.user.userId !== String(id)) return res.status(403).json({ error: "Immutable admin account" });
      const { mode } = req.body || {};
      if (!["poll", "push", "both"].includes(String(mode))) return res.status(400).json({ error: "Invalid mode" });
      await storage.setClientDeliveryMode(id, String(mode));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to set delivery mode" });
    }
  });
  app2.post("/api/admin/clients/:id/webhook", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (await isProtectedAccount(String(id)) && req.user.userId !== String(id)) return res.status(403).json({ error: "Immutable admin account" });
      const { url, secret } = req.body || {};
      const safeUrl = typeof url === "string" && url.startsWith("https://") ? url : null;
      await storage.setClientWebhook(id, safeUrl, secret || null);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || "Failed to set webhook" });
    }
  });
  app2.get("/api/admin/pricing", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { groupId } = req.query;
      const baseExtreme = await storage.getSystemConfig("extreme_cost_per_sms");
      const baseRate = await storage.getSystemConfig("client_rate_per_sms");
      const base = {
        extremeCost: baseExtreme ? parseFloat(baseExtreme.value) : 0.01,
        clientRate: baseRate ? parseFloat(baseRate.value) : 0.02
      };
      let group = null;
      if (groupId) {
        const gExtreme = await storage.getSystemConfig(`pricing.group.${groupId}.extreme_cost`);
        const gRate = await storage.getSystemConfig(`pricing.group.${groupId}.client_rate`);
        group = {
          extremeCost: gExtreme ? parseFloat(gExtreme.value) : void 0,
          clientRate: gRate ? parseFloat(gRate.value) : void 0
        };
      }
      res.json({ success: true, base, group, groupId: groupId || null });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.post("/api/admin/pricing", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { groupId, extremeCost, clientRate } = req.body;
      if (groupId) {
        if (typeof extremeCost === "number") await storage.setSystemConfig(`pricing.group.${groupId}.extreme_cost`, String(extremeCost));
        if (typeof clientRate === "number") await storage.setSystemConfig(`pricing.group.${groupId}.client_rate`, String(clientRate));
      } else {
        if (typeof extremeCost === "number") await storage.setSystemConfig("extreme_cost_per_sms", String(extremeCost));
        if (typeof clientRate === "number") await storage.setSystemConfig("client_rate_per_sms", String(clientRate));
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.delete("/api/admin/pricing/group/:groupId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const gid = String(req.params.groupId);
      await storage.deleteSystemConfig(`pricing.group.${gid}.extreme_cost`);
      await storage.deleteSystemConfig(`pricing.group.${gid}.client_rate`);
      res.json({ success: true, groupId: gid });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  app2.get("/api/admin/pricing/all", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const all = await storage.getAllSystemConfig();
      const baseExtremeRec = all.find((x) => x.key === "extreme_cost_per_sms");
      const baseRateRec = all.find((x) => x.key === "client_rate_per_sms");
      const base = {
        extremeCost: baseExtremeRec ? parseFloat(baseExtremeRec.value) : 0.01,
        clientRate: baseRateRec ? parseFloat(baseRateRec.value) : 0.02
      };
      const groups = [];
      const map = {};
      for (const rec of all) {
        if (rec.key.startsWith("pricing.group.")) {
          const rest = rec.key.replace("pricing.group.", "");
          const [gid, type] = rest.split(".");
          if (!gid || !type) continue;
          if (!map[gid]) map[gid] = {};
          if (type === "extreme_cost") map[gid].extremeCost = parseFloat(rec.value);
          if (type === "client_rate") map[gid].clientRate = parseFloat(rec.value);
        }
      }
      for (const gid of Object.keys(map)) {
        const g = await storage.getContactGroup(gid).catch(() => void 0);
        const extremeCost = map[gid].extremeCost;
        const clientRate = map[gid].clientRate;
        const margin = extremeCost !== void 0 && clientRate !== void 0 ? clientRate - extremeCost : void 0;
        groups.push({ groupId: gid, name: g ? g.name : null, extremeCost, clientRate, margin });
      }
      res.json({ success: true, base, groups });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function verifyCaptchaToken(token) {
  try {
    if (process.env.TURNSTILE_SECRET) {
      const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: String(process.env.TURNSTILE_SECRET), response: String(token || "") })
      });
      const data = await resp.json();
      return !!data.success;
    }
    if (process.env.CAPTCHA_SECRET) {
      return token === "slider_ok";
    }
    return true;
  } catch {
    return false;
  }
}
async function getParaphraserConfig() {
  const providerCfg = await storage.getSystemConfig("paraphraser.provider");
  const provider = providerCfg?.value || "openrouter";
  const targetMinCfg = await storage.getSystemConfig("paraphraser.rules.targetMin");
  const targetMaxCfg = await storage.getSystemConfig("paraphraser.rules.targetMax");
  const maxCharsCfg = await storage.getSystemConfig("paraphraser.rules.maxChars");
  const enforceGrammarCfg = await storage.getSystemConfig("paraphraser.rules.enforceGrammar");
  const linkTemplateCfg = await storage.getSystemConfig("paraphraser.rules.linkTemplate");
  const rules = {
    targetMin: parseInt(String(targetMinCfg?.value || 145)),
    targetMax: parseInt(String(targetMaxCfg?.value || 155)),
    maxChars: parseInt(String(maxCharsCfg?.value || 160)),
    enforceGrammar: String(enforceGrammarCfg?.value || "true") === "true",
    linkTemplate: String(linkTemplateCfg?.value || "Here is the link ${url} here you will find all the information you were asking for.")
  };
  if (provider === "ollama") {
    const urlCfg = await storage.getSystemConfig("paraphraser.ollama.url");
    const modelCfg = await storage.getSystemConfig("paraphraser.ollama.model");
    return { provider, url: urlCfg?.value || "http://localhost:11434", model: modelCfg?.value || "llama3", rules };
  } else if (provider === "openrouter") {
    const modelCfg = await storage.getSystemConfig("paraphraser.openrouter.model");
    const keyCfg = await storage.getSystemConfig("paraphraser.openrouter.key");
    return { provider, model: modelCfg?.value || "qwen/qwen3-coder:free", key: keyCfg?.value || String(process.env.OPENROUTER_API_KEY || ""), rules };
  }
  return { provider, rules };
}

// server/index.ts
if (process.env.LOG_LEVEL === "debug") {
  console.log("\u{1F527} Initial environment check:");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PORT:", process.env.PORT);
  console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
}
var envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
if (!process.env.DATABASE_URL) {
  console.error("\u274C FATAL ERROR: DATABASE_URL environment variable is not set!");
  console.error("\u274C The application REQUIRES a PostgreSQL database.");
  console.error("\u{1F50D} All environment variables:");
  Object.keys(process.env).sort().forEach((key) => {
    const value = process.env[key];
    if (key.includes("DATABASE") || key.includes("POSTGRES") || key.includes("DB") || key.startsWith("RAILWAY")) {
      console.error(`  ${key}: ${value}`);
    }
  });
  console.error("\u274C First 20 env vars:", Object.keys(process.env).slice(0, 20).join(", "));
  console.error("\u274C Please set DATABASE_URL in your environment variables or .env file.");
  console.error("\u274C Example: DATABASE_URL=postgresql://user:password@host:port/database");
  console.error("\u274C Exiting: A consistent PostgreSQL database is required");
  process.exit(1);
}
if (process.env.DATABASE_URL) {
  console.log("\u{1F50D} Final DATABASE_URL validation:");
  console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
  console.log("DATABASE_URL type:", typeof process.env.DATABASE_URL);
  console.log("DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("\u2705 DATABASE_URL format is valid");
    console.log("Database host:", url.hostname);
    console.log("Database port:", url.port);
    console.log("Database name:", url.pathname.slice(1));
  } catch (error) {
    console.error("\u274C WARNING: DATABASE_URL format is invalid!");
    console.error("\u274C Exiting: Fix DATABASE_URL for consistent storage");
    process.exit(1);
  }
} else {
  console.log("\u{1F50D} DATABASE_URL not set - will use in-memory storage");
}
var app = express2();
app.disable("etag");
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
function serveStatic(app2) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  const exists = fs.existsSync(distPath);
  if (!exists) {
    console.warn(`Skipping static file serving; missing ${distPath}`);
    return;
  }
  app2.use(express2.static(distPath));
  app2.get(/^(?!\/api).*/, (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      const html = fs.readFileSync(indexPath, "utf8");
      const inject = `<script>
(function(){
var s=document.createElement('style');s.innerHTML='.__err{position:fixed;left:0;right:0;top:0;background:#f44336;color:#fff;padding:8px 12px;font:14px/1.4 system-ui;z-index:2147483647;box-shadow:0 2px 10px rgba(0,0,0,.2)}';document.head.appendChild(s);
function show(e){var el=document.querySelector('.__err');if(!el){el=document.createElement('div');el.className='__err';document.body.appendChild(el);}el.textContent='Error: '+e;}
window.addEventListener('error',function(ev){try{show(ev.error?ev.error.message:String(ev.message||ev));}catch{}});
window.addEventListener('unhandledrejection',function(ev){try{show(ev.reason?String(ev.reason):'Unhandled rejection');}catch{}});
})();
</script>`;
      const out = html.replace("</head>", inject + "</head>");
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.type("html").send(out);
    } catch {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexPath);
    }
  });
}
app.use(express2.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});
(async () => {
  const resolvedDbUrl = process.env.DATABASE_URL || "";
  if (!process.env.DATABASE_URL && resolvedDbUrl) {
    process.env.DATABASE_URL = resolvedDbUrl;
  }
  if (!process.env.RUN_DB_MIGRATIONS) process.env.RUN_DB_MIGRATIONS = "false";
  try {
    const desiredKeys = [
      { env: "JWT_SECRET", cfg: "jwt_secret" },
      { env: "SESSION_SECRET", cfg: "session_secret" },
      { env: "WEBHOOK_SECRET", cfg: "webhook_secret" },
      { env: "RESEND_API_KEY", cfg: "resend_api_key" },
      { env: "CAPTCHA_SECRET", cfg: "captcha_secret" },
      { env: "TURNSTILE_SITE_KEY", cfg: "turnstile_site_key" },
      { env: "TURNSTILE_SECRET", cfg: "turnstile_secret" },
      { env: "OPENROUTER_API_KEY", cfg: "paraphraser.openrouter.key" }
    ];
    for (const k of desiredKeys) {
      if (!process.env[k.env]) {
        const rec = await storage.getSystemConfig(k.cfg);
        if (rec?.value) {
          process.env[k.env] = rec.value;
          console.log(`\u{1F510} Loaded ${k.env} from system_config`);
        }
      }
    }
  } catch (e) {
    console.warn("\u26A0\uFE0F  Unable to bootstrap secrets from system_config:", e?.message || e);
  }
  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is running", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  console.log("\u{1F527} Registering routes...");
  let server;
  try {
    try {
      if (process.env.DATABASE_URL && process.env.RUN_DB_MIGRATIONS !== "false") {
        const connectionString = process.env.DATABASE_URL;
        const shouldUseSSL = () => {
          if (!connectionString) return false;
          if (process.env.POSTGRES_SSL === "true") return true;
          return connectionString.includes("sslmode=require") || /neon\.tech|railway/i.test(connectionString);
        };
        const { Pool: Pool2 } = await import("pg");
        const { drizzle: drizzle2 } = await import("drizzle-orm/node-postgres");
        const { migrate } = await import("drizzle-orm/node-postgres/migrator");
        const pool = new Pool2(shouldUseSSL() ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
        const db = drizzle2(pool);
        const migrationsFolder = path.resolve(import.meta.dirname, "..", "migrations");
        await migrate(db, { migrationsFolder });
        await pool.end();
        console.log("\u2705 Database migrations applied at startup");
      }
    } catch (e) {
      console.warn("\u26A0\uFE0F  Startup migrations skipped or failed:", e?.message || e);
      try {
        if (process.env.DATABASE_URL && process.env.RUN_DB_BOOTSTRAP === "true") {
          const { Pool: Pool2 } = await import("pg");
          const connectionString = process.env.DATABASE_URL;
          const useSSL = connectionString.includes("sslmode=require") || process.env.POSTGRES_SSL === "true";
          const pool = new Pool2(useSSL ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
          const exec2 = async (q) => {
            try {
              await pool.query(q);
            } catch (err) {
              console.warn("\u26A0\uFE0F  Bootstrap step warning:", err?.message || err);
            }
          };
          console.log("\u{1F527} Attempting schema bootstrap (CREATE TABLE IF NOT EXISTS)");
          await exec2(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
          await exec2(`CREATE TABLE IF NOT EXISTS users (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            email text NOT NULL UNIQUE,
            password text NOT NULL,
            name text NOT NULL,
            company text,
            role text NOT NULL DEFAULT 'client',
            is_active boolean NOT NULL DEFAULT true,
            reset_token text,
            reset_token_expiry timestamp,
            created_at timestamp NOT NULL DEFAULT now()
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS email_idx ON users(email)`);
          await exec2(`CREATE INDEX IF NOT EXISTS reset_token_idx ON users(reset_token)`);
          await exec2(`CREATE TABLE IF NOT EXISTS api_keys (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            key_hash text NOT NULL UNIQUE,
            key_prefix text NOT NULL,
            key_suffix text NOT NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamp NOT NULL DEFAULT now(),
            last_used_at timestamp,
            CONSTRAINT fk_api_keys_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS user_id_idx ON api_keys(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS key_hash_idx ON api_keys(key_hash)`);
          await exec2(`CREATE TABLE IF NOT EXISTS client_profiles (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL UNIQUE,
            credits numeric(10,2) NOT NULL DEFAULT 0.00,
            currency text NOT NULL DEFAULT 'USD',
            custom_markup numeric(10,4),
            assigned_phone_numbers text[],
            rate_limit_per_minute integer NOT NULL DEFAULT 200,
            business_name text,
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_client_profiles_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec2(`CREATE TABLE IF NOT EXISTS system_config (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            key text NOT NULL UNIQUE,
            value text NOT NULL,
            updated_at timestamp NOT NULL DEFAULT now()
          )`);
          await exec2(`CREATE TABLE IF NOT EXISTS message_logs (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            message_id text NOT NULL,
            endpoint text NOT NULL,
            recipient text,
            recipients text[],
            sender_phone_number text,
            status text NOT NULL,
            cost_per_message numeric(10,4) NOT NULL,
            charge_per_message numeric(10,4) NOT NULL,
            total_cost numeric(10,2) NOT NULL,
            total_charge numeric(10,2) NOT NULL,
            message_count integer NOT NULL DEFAULT 1,
            request_payload text,
            response_payload text,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_message_logs_user FOREIGN KEY(user_id) REFERENCES users(id)
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS message_user_id_idx ON message_logs(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS message_created_at_idx ON message_logs(created_at)`);
          await exec2(`CREATE INDEX IF NOT EXISTS message_id_idx ON message_logs(message_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS message_sender_phone_idx ON message_logs(sender_phone_number)`);
          await exec2(`CREATE INDEX IF NOT EXISTS message_is_example_idx ON message_logs(is_example)`);
          await exec2(`CREATE TABLE IF NOT EXISTS credit_transactions (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            amount numeric(10,2) NOT NULL,
            type text NOT NULL,
            description text NOT NULL,
            balance_before numeric(10,2) NOT NULL,
            balance_after numeric(10,2) NOT NULL,
            message_log_id varchar,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_credit_tx_user FOREIGN KEY(user_id) REFERENCES users(id),
            CONSTRAINT fk_credit_tx_message FOREIGN KEY(message_log_id) REFERENCES message_logs(id)
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS transaction_user_id_idx ON credit_transactions(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS transaction_created_at_idx ON credit_transactions(created_at)`);
          await exec2(`CREATE TABLE IF NOT EXISTS incoming_messages (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar,
            "from" text NOT NULL,
            firstname text,
            lastname text,
            business text,
            message text NOT NULL,
            status text NOT NULL,
            matched_block_word text,
            receiver text NOT NULL,
            usedmodem text,
            port text,
            timestamp timestamp NOT NULL,
            message_id text NOT NULL,
            is_read boolean NOT NULL DEFAULT false,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_incoming_user FOREIGN KEY(user_id) REFERENCES users(id)
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_timestamp_idx ON incoming_messages(timestamp)`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_message_id_idx ON incoming_messages(message_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_from_idx ON incoming_messages("from")`);
          await exec2(`CREATE INDEX IF NOT EXISTS incoming_is_example_idx ON incoming_messages(is_example)`);
          await exec2(`CREATE TABLE IF NOT EXISTS client_contacts (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            phone_number text NOT NULL,
            firstname text,
            lastname text,
            business text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_client_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS contact_user_id_idx ON client_contacts(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contact_phone_idx ON client_contacts(phone_number)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contact_business_idx ON client_contacts(business)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contact_phone_user_idx ON client_contacts(phone_number, user_id)`);
          await exec2(`CREATE TABLE IF NOT EXISTS contact_groups (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            name text NOT NULL,
            description text,
            business_unit_prefix text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_contact_groups_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS group_user_id_idx ON contact_groups(user_id)`);
          await exec2(`CREATE TABLE IF NOT EXISTS contacts (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            group_id varchar,
            phone_number text NOT NULL,
            name text,
            email text,
            notes text,
            synced_to_extremesms boolean NOT NULL DEFAULT false,
            last_exported_at timestamp,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_contacts_group FOREIGN KEY(group_id) REFERENCES contact_groups(id) ON DELETE SET NULL
          )`);
          await exec2(`CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contacts_group_id_idx ON contacts(group_id)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone_number)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contacts_synced_idx ON contacts(synced_to_extremesms)`);
          await exec2(`CREATE INDEX IF NOT EXISTS contacts_is_example_idx ON contacts(is_example)`);
          await pool.end();
          console.log("\u2705 Schema bootstrap completed");
        }
      } catch (bootErr) {
        console.warn("\u26A0\uFE0F  Schema bootstrap failed:", bootErr?.message || bootErr);
      }
    }
    server = await registerRoutes(app);
    console.log("\u2705 Routes registered successfully");
  } catch (error) {
    console.error("\u274C Failed to register routes:", error);
    throw error;
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  app.get("/api/debug/routes", (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      }
    });
    res.json({ routes, environment: process.env.NODE_ENV });
  });
  if (process.env.LOG_LEVEL === "debug") {
    console.log("\u{1F527} Environment check for static serving:");
    console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
    console.log('app.get("env"):', app.get("env"));
  }
  console.log("\u{1F527} Setting up static file serving...");
  serveStatic(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log("\u{1F680} Starting server...");
  console.log(`\u{1F310} Port: ${port}`);
  console.log(`\u{1F3E0} Host: 0.0.0.0`);
  console.log(`\u{1F4CA} Environment: ${process.env.NODE_ENV || "development"}`);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    console.log("\u2705 Server started successfully!");
    console.log(`\u2705 Listening on http://0.0.0.0:${port}`);
    console.log("\u2705 Health check available at /api/health");
    log(`serving on port ${port}`);
  });
  server.on("error", (error) => {
    console.error("\u274C Server startup error:", error);
    process.exit(1);
  });
})().catch((error) => {
  console.error("\u274C Application startup failed:", error);
  process.exit(1);
});
