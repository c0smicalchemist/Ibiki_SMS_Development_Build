CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_suffix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"firstname" text,
	"lastname" text,
	"business" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"credits" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"custom_markup" numeric(10, 4),
	"assigned_phone_numbers" text[],
	"rate_limit_per_minute" integer DEFAULT 200 NOT NULL,
	"business_name" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"business_unit_prefix" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"group_id" varchar,
	"phone_number" text NOT NULL,
	"name" text,
	"email" text,
	"notes" text,
	"synced_to_extremesms" boolean DEFAULT false NOT NULL,
	"last_exported_at" timestamp,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"message_log_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoming_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"from" text NOT NULL,
	"firstname" text,
	"lastname" text,
	"business" text,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"matched_block_word" text,
	"receiver" text NOT NULL,
	"usedmodem" text,
	"port" text,
	"timestamp" timestamp NOT NULL,
	"message_id" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"message_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"recipient" text,
	"recipients" text[],
	"sender_phone_number" text,
	"status" text NOT NULL,
	"cost_per_message" numeric(10, 4) NOT NULL,
	"charge_per_message" numeric(10, 4) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"total_charge" numeric(10, 2) NOT NULL,
	"message_count" integer DEFAULT 1 NOT NULL,
	"request_payload" text,
	"response_payload" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"role" text DEFAULT 'client' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_group_id_contact_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_message_log_id_message_logs_id_fk" FOREIGN KEY ("message_log_id") REFERENCES "public"."message_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_messages" ADD CONSTRAINT "incoming_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "contact_user_id_idx" ON "client_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_phone_idx" ON "client_contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contact_business_idx" ON "client_contacts" USING btree ("business");--> statement-breakpoint
CREATE INDEX "contact_phone_user_idx" ON "client_contacts" USING btree ("phone_number","user_id");--> statement-breakpoint
CREATE INDEX "group_user_id_idx" ON "contact_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_group_id_idx" ON "contacts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contacts_synced_idx" ON "contacts" USING btree ("synced_to_extremesms");--> statement-breakpoint
CREATE INDEX "contacts_is_example_idx" ON "contacts" USING btree ("is_example");--> statement-breakpoint
CREATE INDEX "transaction_user_id_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_created_at_idx" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "incoming_user_id_idx" ON "incoming_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incoming_receiver_idx" ON "incoming_messages" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "incoming_timestamp_idx" ON "incoming_messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "incoming_message_id_idx" ON "incoming_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "incoming_from_idx" ON "incoming_messages" USING btree ("from");--> statement-breakpoint
CREATE INDEX "incoming_is_example_idx" ON "incoming_messages" USING btree ("is_example");--> statement-breakpoint
CREATE INDEX "message_user_id_idx" ON "message_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_created_at_idx" ON "message_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_id_idx" ON "message_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_sender_phone_idx" ON "message_logs" USING btree ("sender_phone_number");--> statement-breakpoint
CREATE INDEX "message_is_example_idx" ON "message_logs" USING btree ("is_example");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "reset_token_idx" ON "users" USING btree ("reset_token");