import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
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
  status: text("status").notNull(), // queued, sent, delivered, failed
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull(), // What ExtremeSMS charged
  chargePerMessage: decimal("charge_per_message", { precision: 10, scale: 4 }).notNull(), // What we charged the client
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
  requestPayload: text("request_payload"), // JSON string
  responsePayload: text("response_payload"), // JSON string
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("message_user_id_idx").on(table.userId),
  createdAtIdx: index("message_created_at_idx").on(table.createdAt),
  messageIdIdx: index("message_id_idx").on(table.messageId),
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
