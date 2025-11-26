import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, index, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - both clients and admin
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  name: text("name").notNull(),
  company: text("company"),
  role: text("role").notNull().default("client"), // "admin" or "client"
  isActive: boolean("is_active").notNull().default(true),
  resetToken: text("reset_token"), // Password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"), // Token expiration time
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  resetTokenIdx: index("reset_token_idx").on(table.resetToken),
}));

// Client API keys
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (e.g., "ibk_live_")
  keySuffix: text("key_suffix").notNull(), // Last 4 chars for display
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  keyHashIdx: index("key_hash_idx").on(table.keyHash),
}));

// Client profiles with credit balance
export const clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  credits: decimal("credits", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  customMarkup: decimal("custom_markup", { precision: 10, scale: 4 }), // Optional custom markup for this client
  assignedPhoneNumbers: text("assigned_phone_numbers").array(), // Array of phone numbers assigned to this client for routing incoming SMS
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(200), // Max messages per minute
  businessName: text("business_name"),
  deliveryMode: text("delivery_mode").default("poll"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System configuration
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Message logs for tracking and billing
export const messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  messageId: text("message_id").notNull(), // ExtremeSMS message ID
  endpoint: text("endpoint").notNull(), // Which endpoint was called
  recipient: text("recipient"),
  recipients: text("recipients").array(), // For bulk messages
  senderPhoneNumber: text("sender_phone_number"), // Phone number used to SEND this message (for 2-way SMS routing)
  status: text("status").notNull(), // queued, sent, delivered, failed
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull(), // What ExtremeSMS charged
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }).notNull(), // What we charged the client
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  requestPayload: text("request_payload"), // JSON string
  responsePayload: text("response_payload"), // JSON string
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("message_user_id_idx").on(table.userId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
  messageIdIdx: index("message_id_idx").on(table.messageId),
  senderPhoneIdx: index("message_sender_phone_idx").on(table.senderPhoneNumber),
  isExampleIdx: index("message_is_example_idx").on(table.isExample),
}));

// Credit transactions for audit trail
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // "credit", "debit", "adjustment"
  description: text("description").notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  messageLogId: varchar("message_log_id").references(() => messageLogs.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("transaction_user_id_idx").on(table.userId),
  createdAtIdx: index("transaction_created_at_idx").on(table.createdAt),
}));

// Incoming SMS messages from ExtremeSMS webhook
export const incomingMessages = pgTable("incoming_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Assigned client, null if unassigned
  from: text("from").notNull(), // Sender phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"),
  message: text("message").notNull(),
  status: text("status").notNull(), // "received" or "blocked"
  matchedBlockWord: text("matched_block_word"),
  receiver: text("receiver").notNull(), // Your phone number that received the SMS
  usedmodem: text("usedmodem"),
  port: text("port"),
  extPayload: jsonb("ext_payload"),
  timestamp: timestamp("timestamp").notNull(), // From ExtremeSMS
  messageId: text("message_id").notNull(), // ExtremeSMS message ID
  isRead: boolean("is_read").notNull().default(false), // Track if message has been read
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("incoming_user_id_idx").on(table.userId),
  receiverIdx: index("incoming_receiver_idx").on(table.receiver),
  timestampIdx: index("incoming_timestamp_idx").on(table.timestamp),
  messageIdIdx: index("incoming_message_id_idx").on(table.messageId),
  fromIdx: index("incoming_from_idx").on(table.from),
  isExampleIdx: index("incoming_is_example_idx").on(table.isExample),
}));

// Client contacts for routing (stores contact phone → client_id mapping)
export const clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(), // Customer phone number
  firstname: text("firstname"),
  lastname: text("lastname"),
  business: text("business"), // Should contain client_id for routing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("contact_user_id_idx").on(table.userId),
  phoneIdx: index("contact_phone_idx").on(table.phoneNumber),
  businessIdx: index("contact_business_idx").on(table.business),
  phoneUserIdx: index("contact_phone_user_idx").on(table.phoneNumber, table.userId),
}));

// Contact groups for organizing contacts (address book feature)
export const contactGroups = pgTable("contact_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  businessUnitPrefix: text("business_unit_prefix"), // Prefix for CSV export (e.g., "IBS", "SALES")
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("group_user_id_idx").on(table.userId),
}));

// Contacts (address book feature)
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").references(() => contactGroups.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  email: text("email"),
  notes: text("notes"),
  syncedToExtremeSMS: boolean("synced_to_extremesms").notNull().default(false), // Track if exported to ExtremeSMS
  lastExportedAt: timestamp("last_exported_at"), // When this contact was last exported
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("contacts_user_id_idx").on(table.userId),
  groupIdIdx: index("contacts_group_id_idx").on(table.groupId),
  phoneIdx: index("contacts_phone_idx").on(table.phoneNumber),
  syncedIdx: index("contacts_synced_idx").on(table.syncedToExtremeSMS),
  isExampleIdx: index("contacts_is_example_idx").on(table.isExample),
}));

// Zod schemas and types
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  updatedAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertMessageLogSchema = createInsertSchema(messageLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertIncomingMessageSchema = createInsertSchema(incomingMessages).omit({
  id: true,
  createdAt: true,
});

export const insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactGroupSchema = createInsertSchema(contactGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type ClientProfile = typeof clientProfiles.$inferSelect;
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

export type MessageLog = typeof messageLogs.$inferSelect;
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

export type IncomingMessage = typeof incomingMessages.$inferSelect;
export type InsertIncomingMessage = z.infer<typeof insertIncomingMessageSchema>;

export type ClientContact = typeof clientContacts.$inferSelect;
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;

