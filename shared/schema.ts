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
  businessName: text("business_name"), // Business name for 2-way SMS routing and contact tagging
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
  timestamp: timestamp("timestamp").notNull(), // From ExtremeSMS
  messageId: text("message_id").notNull(), // ExtremeSMS message ID
  isRead: boolean("is_read").notNull().default(false), // Track if message has been read
  isExample: boolean("is_example").notNull().default(false), // Mark as example data for UI preview
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

// Social media contact scraping
export const scrapedContacts = pgTable("scraped_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // facebook, instagram, tiktok, twitter, linkedin, youtube
  platformUserId: text("platform_user_id").notNull(), // Platform-specific user ID
  username: text("username"),
  displayName: text("display_name"),
  profileUrl: text("profile_url"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  location: text("location"),
  followerCount: integer("follower_count").default(0),
  followingCount: integer("following_count").default(0),
  postCount: integer("post_count").default(0),
  isVerified: boolean("is_verified").default(false),
  isBusiness: boolean("is_business").default(false),
  category: text("category"), // Business category (e.g., "Digital Creator", "Restaurant")
  tags: text("tags").array().default(sql`ARRAY[]::text[]`), // Extracted hashtags and keywords
  engagementRate: numeric("engagement_rate", { precision: 5, scale: 2 }), // Calculated engagement rate
  lastPostDate: timestamp("last_post_date"),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  isReachable: boolean("is_reachable").notNull().default(true), // Can we message them?
  scrapingSource: text("scraping_source").notNull(), // hashtag, location, competitor, manual
  scrapingQuery: text("scraping_query"), // The original search query/hashtag
  privacyStatus: text("privacy_status").default("public"), // public, private, restricted
  validationStatus: text("validation_status").default("pending"), // pending, valid, invalid, duplicate
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("scraped_user_id_idx").on(table.userId),
  platformIdx: index("scraped_platform_idx").on(table.platform),
  usernameIdx: index("scraped_username_idx").on(table.username),
  platformUserIdIdx: index("scraped_platform_user_id_idx").on(table.platformUserId),
  tagsIdx: index("scraped_tags_idx").using("gin", table.tags),
  isActiveIdx: index("scraped_is_active_idx").on(table.isActive),
  isReachableIdx: index("scraped_is_reachable_idx").on(table.isReachable),
  validationStatusIdx: index("scraped_validation_status_idx").on(table.validationStatus),
  followerCountIdx: index("scraped_follower_count_idx").on(table.followerCount),
  scrapedAtIdx: index("scraped_scraped_at_idx").on(table.scrapedAt),
}));

// Scraping campaigns/jobs
export const scrapingCampaigns = pgTable("scraping_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  platforms: text("platforms").array().notNull(), // Target platforms
  scrapingType: text("scraping_type").notNull(), // hashtag, location, competitor, keyword, followers
  targetQueries: text("target_queries").array().notNull(), // Hashtags, keywords, locations, etc.
  filters: jsonb("filters"), // Advanced filters (min_followers, location, etc.)
  schedule: text("schedule"), // cron expression or 'once'
  status: text("status").notNull().default("draft"), // draft, active, paused, completed, failed
  contactsFound: integer("contacts_found").default(0),
  contactsValidated: integer("contacts_validated").default(0),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  isRecurring: boolean("is_recurring").default(false),
  maxContacts: integer("max_contacts"), // Limit contacts per campaign
  rateLimitDelay: integer("rate_limit_delay").default(1000), // Delay between requests (ms)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("scraping_user_id_idx").on(table.userId),
  statusIdx: index("scraping_status_idx").on(table.status),
  scrapingTypeIdx: index("scraping_type_idx").on(table.scrapingType),
  isRecurringIdx: index("scraping_is_recurring_idx").on(table.isRecurring),
  nextRunAtIdx: index("scraping_next_run_at_idx").on(table.nextRunAt),
}));

// Scraping logs for monitoring and compliance
export const scrapingLogs = pgTable("scraping_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => scrapingCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  scrapingType: text("scraping_type").notNull(),
  query: text("query").notNull(), // The actual query that was executed
  contactsFound: integer("contacts_found").default(0),
  contactsSaved: integer("contacts_saved").default(0),
  status: text("status").notNull(), // success, failed, rate_limited, blocked
  errorMessage: text("error_message"),
  responseTime: integer("response_time"), // Response time in milliseconds
  ipAddress: text("ip_address"), // For compliance tracking
  userAgent: text("user_agent"), // For compliance tracking
  rateLimitDelay: integer("rate_limit_delay"), // Actual delay used
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdIdx: index("scraping_log_campaign_id_idx").on(table.campaignId),
  userIdIdx: index("scraping_log_user_id_idx").on(table.userId),
  platformIdx: index("scraping_log_platform_idx").on(table.platform),
  statusIdx: index("scraping_log_status_idx").on(table.status),
  createdAtIdx: index("scraping_log_created_at_idx").on(table.createdAt),
}));

// Contact tags for organization and filtering
export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Tag name (e.g., "fitness", "tech", "foodie")
  color: text("color").default("#3B82F6"), // Hex color for UI
  description: text("description"),
  contactsCount: integer("contacts_count").default(0),
  isSystem: boolean("is_system").default(false), // System-generated tags
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("contact_tags_user_id_idx").on(table.userId),
  nameIdx: index("contact_tags_name_idx").on(table.name),
  isSystemIdx: index("contact_tags_is_system_idx").on(table.isSystem),
}));

// Junction table for contact-tag relationships
export const contactTagRelations = pgTable("contact_tag_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => scrapedContacts.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => contactTags.id, { onDelete: "cascade" }),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).default(1.0), // AI confidence score
  source: text("source").default("manual"), // manual, ai, scraping
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  contactIdIdx: index("contact_tag_contact_id_idx").on(table.contactId),
  tagIdIdx: index("contact_tag_tag_id_idx").on(table.tagId),
  contactTagUnique: uniqueIndex("contact_tag_unique_idx").on(table.contactId, table.tagId),
}));

// Scraping compliance and ethics settings
export const scrapingCompliance = pgTable("scraping_compliance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  maxRequestsPerHour: integer("max_requests_per_hour").default(100),
  maxRequestsPerDay: integer("max_requests_per_day").default(1000),
  respectRobotsTxt: boolean("respect_robots_txt").default(true),
  avoidPrivateProfiles: boolean("avoid_private_profiles").default(true),
  avoidSensitiveContent: boolean("avoid_sensitive_content").default(true),
  dataRetentionDays: integer("data_retention_days").default(365),
  requireConsent: boolean("require_consent").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("compliance_user_id_idx").on(table.userId),
  platformIdx: index("compliance_platform_idx").on(table.platform),
  userPlatformUnique: uniqueIndex("compliance_user_platform_unique_idx").on(table.userId, table.platform),
}));

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScrapedContactSchema = createInsertSchema(scrapedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScrapingCampaignSchema = createInsertSchema(scrapingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScrapingLogSchema = createInsertSchema(scrapingLogs).omit({
  id: true,
  createdAt: true,
});

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactTagRelationSchema = createInsertSchema(contactTagRelations).omit({
  id: true,
  createdAt: true,
});

export const insertScrapingComplianceSchema = createInsertSchema(scrapingCompliance).omit({
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

export type ScrapedContact = typeof scrapedContacts.$inferSelect;
export type InsertScrapedContact = z.infer<typeof insertScrapedContactSchema>;

export type ScrapingCampaign = typeof scrapingCampaigns.$inferSelect;
export type InsertScrapingCampaign = z.infer<typeof insertScrapingCampaignSchema>;

export type ScrapingLog = typeof scrapingLogs.$inferSelect;
export type InsertScrapingLog = z.infer<typeof insertScrapingLogSchema>;

export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;

export type ContactTagRelation = typeof contactTagRelations.$inferSelect;
export type InsertContactTagRelation = z.infer<typeof insertContactTagRelationSchema>;

export type ScrapingCompliance = typeof scrapingCompliance.$inferSelect;
export type InsertScrapingCompliance = z.infer<typeof insertScrapingComplianceSchema>;

// Social media platform accounts
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // facebook, instagram, tiktok, twitter, linkedin, youtube
  accountName: text("account_name").notNull(),
  accountId: text("account_id").notNull(), // Platform-specific account ID
  accessToken: text("access_token").notNull(), // Encrypted access token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  tokenExpiry: timestamp("token_expiry"), // When the access token expires
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("social_user_id_idx").on(table.userId),
  platformIdx: index("social_platform_idx").on(table.platform),
  accountIdIdx: index("social_account_id_idx").on(table.accountId),
  isActiveIdx: index("social_is_active_idx").on(table.isActive),
}));

// Social media campaigns
export const socialMediaCampaigns = pgTable("social_media_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  message: text("message").notNull(),
  platforms: text("platforms").array().notNull(), // Array of platform names
  status: text("status").notNull().default("draft"), // draft, scheduled, sending, sent, paused, failed
  scheduledFor: timestamp("scheduled_for"), // When to send the campaign
  sentAt: timestamp("sent_at"), // When the campaign was sent
  totalRecipients: integer("total_recipients").notNull().default(0),
  successfulDeliveries: integer("successful_deliveries").notNull().default(0),
  failedDeliveries: integer("failed_deliveries").notNull().default(0),
  costPerMessage: decimal("cost_per_message", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("campaign_user_id_idx").on(table.userId),
  statusIdx: index("campaign_status_idx").on(table.status),
  scheduledForIdx: index("campaign_scheduled_for_idx").on(table.scheduledFor),
  createdAtIdx: index("campaign_created_at_idx").on(table.createdAt),
}));

// Social media recipients for campaigns
export const socialMediaRecipients = pgTable("social_media_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => socialMediaCampaigns.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  recipientId: text("recipient_id").notNull(), // Platform-specific recipient ID
  recipientUsername: text("recipient_username"), // Username/handle for display
  recipientName: text("recipient_name"), // Display name
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, read
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  platformMessageId: text("platform_message_id"), // Platform-specific message ID
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdIdx: index("recipient_campaign_id_idx").on(table.campaignId),
  platformIdx: index("recipient_platform_idx").on(table.platform),
  statusIdx: index("recipient_status_idx").on(table.status),
  recipientIdIdx: index("recipient_recipient_id_idx").on(table.recipientId),
}));

// Zod schemas for social media tables
export const insertSocialMediaAccountSchema = createInsertSchema(socialMediaAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
});

export const insertSocialMediaCampaignSchema = createInsertSchema(socialMediaCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  successfulDeliveries: true,
  failedDeliveries: true,
  totalCost: true,
  totalCharge: true,
});

export const insertSocialMediaRecipientSchema = createInsertSchema(socialMediaRecipients).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
  failedAt: true,
  errorMessage: true,
  platformMessageId: true,
});

// Types for social media tables
export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = z.infer<typeof insertSocialMediaAccountSchema>;

export type SocialMediaCampaign = typeof socialMediaCampaigns.$inferSelect;
export type InsertSocialMediaCampaign = z.infer<typeof insertSocialMediaCampaignSchema>;

export type SocialMediaRecipient = typeof socialMediaRecipients.$inferSelect;
export type InsertSocialMediaRecipient = z.infer<typeof insertSocialMediaRecipientSchema>;
