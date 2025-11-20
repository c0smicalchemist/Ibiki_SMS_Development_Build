import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { type User, insertContactSchema, insertContactGroupSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./resend";

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
const EXTREMESMS_BASE_URL = "https://extremesms.net";

// Middleware to verify JWT token
async function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// Middleware to verify admin role
function requireAdmin(req: any, res: any, next: any) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Middleware to authenticate API key (for client API requests)
async function authenticateApiKey(req: any, res: any, next: any) {
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

    // Update last used timestamp
    await storage.updateApiKeyLastUsed(storedKey.id);

    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}

// Helper to get pricing configuration
async function getPricingConfig() {
  const extremeCostConfig = await storage.getSystemConfig("extreme_cost_per_sms");
  const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");

  const extremeCost = extremeCostConfig ? parseFloat(extremeCostConfig.value) : 0.01;
  const clientRate = clientRateConfig ? parseFloat(clientRateConfig.value) : 0.02;

  return { extremeCost, clientRate };
}

// Helper to deduct credits and log message
async function deductCreditsAndLog(
  userId: string,
  messageCount: number,
  endpoint: string,
  messageId: string,
  status: string,
  requestPayload: any,
  responsePayload: any,
  recipient?: string,
  recipients?: string[],
  senderPhoneNumber?: string
) {
  const { extremeCost, clientRate } = await getPricingConfig();
  
  const totalCost = extremeCost * messageCount;
  const totalCharge = clientRate * messageCount;

  const profile = await storage.getClientProfileByUserId(userId);
  if (!profile) {
    throw new Error("Client profile not found");
  }

  const currentCredits = parseFloat(profile.credits);
  if (currentCredits < totalCharge) {
    throw new Error("Insufficient credits");
  }

  const newCredits = currentCredits - totalCharge;

  // Extract sender phone from response if available
  const senderPhone = senderPhoneNumber || 
                      responsePayload?.senderPhone || 
                      responsePayload?.from || 
                      responsePayload?.sender || 
                      null;

  // Create message log
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
    totalCharge: totalCharge.toFixed(2),
    messageCount,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });

  // Create credit transaction
  await storage.createCreditTransaction({
    userId,
    amount: (-totalCharge).toFixed(2),
    type: "debit",
    description: `SMS sent via ${endpoint}`,
    balanceBefore: currentCredits.toFixed(2),
    balanceAfter: newCredits.toFixed(2),
    messageLogId: messageLog.id
  });

  // Update credits
  await storage.updateClientCredits(userId, newCredits.toFixed(2));

  return { messageLog, newBalance: newCredits };
}

// Helper to get ExtremeSMS API key
async function getExtremeApiKey() {
  const config = await storage.getSystemConfig("extreme_api_key");
  if (!config) {
    throw new Error("ExtremeSMS API key not configured");
  }
  return config.value;
}

async function getExtremeSMSCredentials() {
  // For now, use the API key as both username and password
  // This can be extended to use separate username/password configs if needed
  const apiKey = await getExtremeApiKey();
  return {
    extremeUsername: apiKey,
    extremePassword: apiKey
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json());

  // ============================================
  // Authentication Routes
  // ============================================

  // Signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, confirmPassword } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (!confirmPassword) {
        return res.status(400).json({ error: "Password confirmation is required" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Generate name from email (username part)
      const name = email.split('@')[0];

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        company: null,
        role: "client",
        isActive: true
      });

      // Create client profile with initial credits
      await storage.createClientProfile({
        userId: user.id,
        credits: "0.00",
        currency: "USD",
        customMarkup: null
      });

      // Generate API key
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

      // Seed example data for new users
      try {
        await storage.seedExampleData(user.id);
      } catch (error) {
        console.error("Failed to seed example data:", error);
        // Don't fail signup if example data seeding fails
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        apiKey: rawApiKey // Only shown once
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

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
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Forgot password - send reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ 
          success: true, 
          message: "If an account exists with this email, a password reset link has been sent." 
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hour from now
      
      await storage.setPasswordResetToken(email, resetToken, expiry);

      // Send reset email
      const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://151.243.109.79'}/reset-password?token=${resetToken}`;
      
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

  // Verify reset token
  app.get("/api/auth/verify-reset-token/:token", async (req, res) => {
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

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
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

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
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

  // ============================================
  // Webhook Routes (No authentication required)
  // ============================================

  // Incoming SMS webhook from ExtremeSMS
  app.post("/webhook/incoming-sms", async (req, res) => {
    try {
      // SECURITY: Verify webhook secret to prevent spoofing
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && webhookSecret !== 'CHANGE_THIS_TO_A_RANDOM_SECRET_STRING_BEFORE_DEPLOYMENT') {
        const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
        if (providedSecret !== webhookSecret) {
          console.warn("Webhook authentication failed: Invalid or missing secret");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }

      const payload = req.body;
      console.log("Incoming SMS webhook received:", { 
        from: payload.from, 
        receiver: payload.receiver,
        status: payload.status 
      });

      // Validate required fields
      if (!payload.from || !payload.message || !payload.receiver || !payload.timestamp || !payload.messageId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // SMART ROUTING: Business field contains client_id
      let assignedUserId: string | null = null;
      
      // Priority 1: Extract client_id from Business field (ExtremeSMS contact CSV)
      // When clients upload contacts with their userId in the Business field, we can route directly
      if (payload.business && payload.business.trim() !== '') {
        // Business field should contain the client's userId
        const potentialUserId = payload.business.trim();
        const user = await storage.getUser(potentialUserId);
        if (user && user.role === 'client') {
          assignedUserId = user.id;
          console.log(`Routing incoming SMS to client ${user.id} (matched Business field: ${payload.business})`);
        } else {
          console.log(`Business field '${payload.business}' does not match a valid client`);
        }
      }
      
      // Priority 2: Fall back to conversation tracking (client who sent to this customer)
      if (!assignedUserId) {
        const clientFromOutbound = await storage.findClientByRecipient(payload.from);
        if (clientFromOutbound) {
          assignedUserId = clientFromOutbound;
          console.log(`Routing incoming SMS to client ${clientFromOutbound} (matched conversation: client sent to ${payload.from})`);
        }
      }
      
      // Priority 3: Fall back to assigned phone numbers (manual assignment)
      if (!assignedUserId) {
        const clientProfile = await storage.getClientProfileByPhoneNumber(payload.receiver);
        if (clientProfile) {
          assignedUserId = clientProfile.userId;
          console.log(`Routing incoming SMS to client ${clientProfile.userId} (matched assigned phone number)`);
        } else {
          console.log(`No client found for incoming SMS from ${payload.from} to ${payload.receiver}`);
        }
      }

      // Store incoming message
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

      res.json({ 
        success: true, 
        message: "Incoming message processed successfully" 
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process incoming message" });
    }
  });

  // ============================================
  // Client Dashboard Routes
  // ============================================

  // Get user profile and credits
  app.get("/api/client/profile", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = await storage.getClientProfileByUserId(user.id);
      const apiKeys = await storage.getApiKeysByUserId(user.id);
      
      // Get client rate per SMS from system config
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
        ratePerSms: clientRate,
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          displayKey: `${key.keyPrefix}...${key.keySuffix}`,
          isActive: key.isActive,
          createdAt: key.createdAt?.toISOString() || new Date().toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() || null
        }))
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Get message status statistics
  app.get("/api/message-status-stats", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can check stats for another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      const stats = await storage.getMessageStatusStats(targetUserId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Get message status stats error:", error);
      res.status(500).json({ error: "Failed to get message status statistics" });
    }
  });

  // Generate new API key
  app.post("/api/client/generate-key", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.userId;

      // Generate new API key
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
        apiKey: rawApiKey, // Only returned once
        message: "New API key generated successfully"
      });
    } catch (error) {
      console.error("Generate key error:", error);
      res.status(500).json({ error: "Failed to generate API key" });
    }
  });

  // Revoke API key
  app.post("/api/client/revoke-key", authenticateToken, async (req: any, res) => {
    try {
      const { keyId } = req.body;
      const userId = req.user.userId;

      if (!keyId) {
        return res.status(400).json({ error: "Key ID is required" });
      }

      // Verify the key belongs to the user
      const apiKeys = await storage.getApiKeysByUserId(userId);
      const keyToRevoke = apiKeys.find(k => k.id === keyId);

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

  // Get message logs
  app.get("/api/client/messages", authenticateToken, async (req: any, res) => {
    try {
      const logs = await storage.getMessageLogsByUserId(req.user.userId, 100);
      res.json({ success: true, messages: logs });
    } catch (error) {
      console.error("Message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get incoming messages for dashboard (JWT auth)
  app.get("/api/client/inbox", authenticateToken, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      
      res.json({
        success: true,
        messages: messages.map(msg => ({
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

  // ============================================
  // Client Contact Management Routes
  // ============================================

  // Upload contacts (for Business field routing)
  app.post("/api/client/contacts/upload", authenticateToken, async (req: any, res) => {
    try {
      const { contacts } = req.body;
      
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: "Contacts array is required" });
      }

      // Validate contact structure BEFORE any database operations
      const validatedContacts = contacts.map((contact, index) => {
        if (!contact.phoneNumber) {
          throw new Error(`Phone number is required for contact at index ${index}`);
        }

        return {
          userId: req.user.userId,
          phoneNumber: contact.phoneNumber,
          firstname: contact.firstname || null,
          lastname: contact.lastname || null,
          business: req.user.userId // Store client's userId in Business field for routing
        };
      });

      // SAFER ATOMIC OPERATION: 
      // Store old contacts as backup, delete, insert new, restore on failure
      try {
        // Backup existing contacts
        const oldContacts = await storage.getClientContactsByUserId(req.user.userId);
        
        // Delete existing contacts
        await storage.deleteClientContactsByUserId(req.user.userId);
        
        try {
          // Insert new contacts
          const createdContacts = await storage.createClientContacts(validatedContacts);
          
          res.json({
            success: true,
            message: `Successfully uploaded ${createdContacts.length} contacts`,
            count: createdContacts.length
          });
        } catch (insertError) {
          // Rollback: restore old contacts if insert fails
          if (oldContacts.length > 0) {
            const restoreContacts = oldContacts.map(c => ({
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
    } catch (error: any) {
      console.error("Contact upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload contacts" });
    }
  });

  // Get all contacts for the authenticated client
  app.get("/api/client/contacts", authenticateToken, async (req: any, res) => {
    try {
      const contacts = await storage.getClientContactsByUserId(req.user.userId);
      
      res.json({
        success: true,
        contacts: contacts.map(c => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          firstname: c.firstname,
          lastname: c.lastname,
          business: c.business,
          createdAt: c.createdAt.toISOString()
        })),
        count: contacts.length
      });
    } catch (error) {
      console.error("Contact fetch error:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });

  // Delete a specific contact
  app.delete("/api/client/contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership before deleting
      const contacts = await storage.getClientContactsByUserId(req.user.userId);
      const contact = contacts.find(c => c.id === id);
      
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

  // Delete all contacts for the authenticated client
  app.delete("/api/client/contacts", authenticateToken, async (req: any, res) => {
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

  // ============================================
  // Admin Routes
  // ============================================

  // Get admin stats
  app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const totalMessages = await storage.getTotalMessageCount();
      const allUsers = await storage.getAllUsers();
      const totalClients = allUsers.filter(u => u.role === 'client').length;

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

  // Get recent API activity
  app.get("/api/admin/recent-activity", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const recentLogs = await storage.getAllMessageLogs(10); // Get last 10 logs
      
      // Enrich logs with user information
      const enrichedLogs = await Promise.all(
        recentLogs.map(async (log) => {
          const user = await storage.getUser(log.userId);
          return {
            id: log.id,
            endpoint: log.endpoint,
            clientName: user?.company || user?.name || 'Unknown',
            timestamp: log.createdAt,
            status: log.status,
            recipient: log.recipient || (log.recipients && log.recipients.length > 0 ? `${log.recipients.length} recipients` : 'N/A'),
          };
        })
      );

      res.json({ success: true, logs: enrichedLogs });
    } catch (error) {
      console.error("Recent activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });

  // Get all clients
  app.get("/api/admin/clients", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const clients = await Promise.all(
        allUsers
          .filter((user: User) => user.role === 'client')
          .map(async (user: User) => {
            const apiKeys = await storage.getApiKeysByUserId(user.id);
            const messageLogs = await storage.getMessageLogsByUserId(user.id);
            const profile = await storage.getClientProfileByUserId(user.id);
            const displayKey = apiKeys[0] ? `ibk_live_${apiKeys[0].keyPrefix}...${apiKeys[0].keySuffix}` : 'No key';
            
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              apiKey: displayKey,
              status: apiKeys.length > 0 && apiKeys[0].isActive ? 'active' : 'inactive',
              messagesSent: messageLogs.length,
              credits: profile?.credits || "0.00",
              rateLimitPerMinute: profile?.rateLimitPerMinute || 200,
              businessName: profile?.businessName || null,
              lastActive: apiKeys[0]?.lastUsedAt 
                ? new Date(apiKeys[0].lastUsedAt).toLocaleDateString()
                : 'Never',
              assignedPhoneNumbers: profile?.assignedPhoneNumbers || []
            };
          })
      );
      
      res.json({ success: true, clients });
    } catch (error) {
      console.error("Admin clients fetch error:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Get system configuration
  app.get("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      const configMap: Record<string, string> = {};
      configs.forEach(config => {
        configMap[config.key] = config.value;
      });

      res.json({ success: true, config: configMap });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // Update system configuration
  app.post("/api/admin/config", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { extremeApiKey, extremeCost, clientRate, timezone } = req.body;

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

      res.json({ success: true, message: "Configuration updated" });
    } catch (error) {
      console.error("Config update error:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  // Get ExtremeSMS account balance
  app.get("/api/admin/extremesms-balance", authenticateToken, requireAdmin, async (req, res) => {
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
          currency: response.data.currency || 'USD'
        });
      } else {
        console.error("ExtremeSMS balance: unexpected response format");
        res.status(400).json({ error: "Unable to fetch balance" });
      }
    } catch (error: any) {
      const statusCode = error.response?.status || 'unknown';
      console.error(`ExtremeSMS balance fetch failed with status ${statusCode}`);
      res.status(500).json({ 
        error: "Unable to fetch balance"
      });
    }
  });

  // Test ExtremeSMS API connection
  app.post("/api/admin/test-connection", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }

      // Test the ExtremeSMS API by checking balance using the correct endpoint
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
        headers: {
          "Authorization": `Bearer ${extremeApiKey.value}`,
          "Content-Type": "application/json"
        }
      });

      if (response.data && response.data.success) {
        res.json({ 
          success: true, 
          message: `Connected successfully! Balance: ${response.data.balance || 'N/A'}` 
        });
      } else {
        res.status(400).json({ error: "ExtremeSMS API returned unexpected response" });
      }
    } catch (error: any) {
      console.error("ExtremeSMS test connection error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to connect to ExtremeSMS API",
        details: error.response?.data?.message || error.message
      });
    }
  });

  // Test API endpoint (admin only - uses ExtremeSMS directly, NOT client keys)
  app.post("/api/admin/test-endpoint", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { endpoint, payload } = req.body;

      // Get admin's ExtremeSMS API key
      const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
      
      if (!extremeApiKey || !extremeApiKey.value) {
        return res.status(400).json({ error: "ExtremeSMS API key not configured" });
      }

      let response;

      switch (endpoint) {
        case "balance":
          // Test balance check directly with ExtremeSMS
          response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, {
            headers: {
              "Authorization": `Bearer ${extremeApiKey.value}`,
              "Content-Type": "application/json"
            }
          });
          break;
        
        case "sendsingle":
          // Test with ExtremeSMS directly
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
    } catch (error: any) {
      console.error("Test endpoint error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: error.response?.data?.error || error.message,
        details: error.response?.data
      });
    }
  });

  // Get error logs (admin only)
  app.get("/api/admin/error-logs", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { level } = req.query;
      
      // Get message logs with errors
      const logs = await storage.getErrorLogs(level as string);
      
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch error logs" });
    }
  });

  // Add credits to client account (ADMIN ONLY) - Legacy endpoint
  app.post("/api/admin/add-credits", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { amount, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount - must be positive number" });
      }

      // Get current profile
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }

      // Calculate new balance
      const balanceBefore = profile.credits;
      const newBalance = (parseFloat(profile.credits) + parseFloat(amount)).toFixed(2);
      
      // Update credits
      await storage.updateClientCredits(userId, newBalance);

      // Log the transaction
      await storage.createCreditTransaction({
        userId: userId,
        amount: parseFloat(amount).toString(),
        type: "admin_credit_add",
        description: `Admin added ${amount} credits`,
        balanceBefore: balanceBefore,
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

  // Adjust credits (add or deduct) for client account (ADMIN ONLY)
  app.post("/api/admin/adjust-credits", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { amount, userId, operation } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      if (!operation || (operation !== "add" && operation !== "deduct")) {
        return res.status(400).json({ error: "operation must be 'add' or 'deduct'" });
      }

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount - must be positive number" });
      }

      // Get current profile
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }

      const parsedAmount = parseFloat(amount);
      const currentBalance = parseFloat(profile.credits);
      const balanceBefore = profile.credits;

      // Calculate new balance based on operation
      let newBalance: string;
      if (operation === "add") {
        newBalance = (currentBalance + parsedAmount).toFixed(2);
      } else {
        // Check if deduction would result in negative balance
        if (parsedAmount > currentBalance) {
          return res.status(400).json({ 
            error: "Insufficient balance",
            message: `Cannot deduct $${amount}. Current balance is only $${currentBalance.toFixed(2)}`
          });
        }
        newBalance = (currentBalance - parsedAmount).toFixed(2);
      }
      
      // Update credits
      await storage.updateClientCredits(userId, newBalance);

      // Log the transaction
      await storage.createCreditTransaction({
        userId: userId,
        amount: parsedAmount.toString(),
        type: operation === "add" ? "admin_credit_add" : "admin_credit_deduct",
        description: operation === "add" 
          ? `Admin added $${amount} credits` 
          : `Admin deducted $${amount} credits`,
        balanceBefore: balanceBefore,
        balanceAfter: newBalance
      });

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

  // Update client's assigned phone numbers (ADMIN ONLY)
  app.post("/api/admin/update-phone-numbers", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { userId, phoneNumbers } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }

      // Convert string input to array if needed, filter out empty strings
      let numbersArray: string[] = [];
      if (typeof phoneNumbers === 'string') {
        numbersArray = phoneNumbers.split(',').map(num => num.trim()).filter(num => num.length > 0);
      } else if (Array.isArray(phoneNumbers)) {
        numbersArray = phoneNumbers.filter(num => num && num.trim().length > 0);
      }

      // Update phone numbers
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

  // Update client's rate limit (ADMIN ONLY)
  app.post("/api/admin/update-rate-limit", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { userId, rateLimitPerMinute } = req.body;

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

      // Update rate limit
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

  // Update client's business name (ADMIN ONLY)
  app.post("/api/admin/update-business-name", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { userId, businessName } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }

      // Update business name
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

  // ============================================
  // API Proxy Routes (ExtremeSMS passthrough)
  // ============================================

  // ============================================================================
  // API v1 ENDPOINTS (for backward compatibility)
  // ============================================================================
  
  // Check single message status by ID (API v1 - with local cache fallback)
  app.get("/api/v1/sms/status/:messageId", authenticateApiKey, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      
      // Find the message in our database
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      
      if (!messageLog) {
        return res.status(404).json({ 
          success: false, 
          error: "Message not found" 
        });
      }
      
      // Check ownership
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

        // Update our database with the latest status
        if (response.data.status && response.data.status !== messageLog.status) {
          await storage.updateMessageStatus(messageLog.id, response.data.status);
        }

        res.json(response.data);
      } catch (extremeError: any) {
        // If ExtremeSMS fails, return our local cached status
        console.error("ExtremeSMS status check failed (v1), using local status:", extremeError.message);
        res.json({
          success: true,
          messageId: messageLog.messageId,
          status: messageLog.status,
          deliveredAt: messageLog.status === 'delivered' ? new Date().toISOString() : null
        });
      }
    } catch (error: any) {
      console.error("Status check error (v1):", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });

  // ============================================================================
  // API v2 ENDPOINTS (current version)
  // ============================================================================
  
  // Send single SMS
  app.post("/api/v2/sms/sendsingle", authenticateApiKey, async (req: any, res) => {
    try {
      const { recipient, message } = req.body;

      if (!recipient || !message) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid recipient phone number",
          code: "INVALID_RECIPIENT"
        });
      }

      // Check credits before sending
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      
      if (!profile || parseFloat(profile.credits) < clientRate) {
        return res.status(402).json({ 
          success: false, 
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }

      const extremeApiKey = await getExtremeApiKey();
      
      // Forward request to ExtremeSMS
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`,
        { recipient, message },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      // Deduct credits and log
      await deductCreditsAndLog(
        req.user.userId,
        1,
        "/api/v2/sms/sendsingle",
        response.data.messageId,
        response.data.status,
        { recipient, message },
        response.data,
        recipient
      );

      res.json(response.data);
    } catch (error: any) {
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

  // Send bulk SMS (same content)
  app.post("/api/v2/sms/sendbulk", authenticateApiKey, async (req: any, res) => {
    try {
      const { recipients, content } = req.body;

      if (!recipients || !Array.isArray(recipients) || !content) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }

      // Check credits before sending
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      const totalCharge = clientRate * recipients.length;
      
      if (!profile || parseFloat(profile.credits) < totalCharge) {
        return res.status(402).json({ 
          success: false, 
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }

      const extremeApiKey = await getExtremeApiKey();
      
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
        { recipients, content },
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      await deductCreditsAndLog(
        req.user.userId,
        recipients.length,
        "/api/v2/sms/sendbulk",
        response.data.messageIds?.[0] || "bulk_" + Date.now(),
        response.data.status,
        { recipients, content },
        response.data,
        undefined,
        recipients
      );

      res.json(response.data);
    } catch (error: any) {
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

  // Send bulk SMS (different content)
  app.post("/api/v2/sms/sendbulkmulti", authenticateApiKey, async (req: any, res) => {
    try {
      const messages = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }

      // Check credits
      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { clientRate } = await getPricingConfig();
      const totalCharge = clientRate * messages.length;
      
      if (!profile || parseFloat(profile.credits) < totalCharge) {
        return res.status(402).json({ 
          success: false, 
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS"
        });
      }

      const extremeApiKey = await getExtremeApiKey();
      
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
        messages,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      const recipients = messages.map(m => m.recipient);
      await deductCreditsAndLog(
        req.user.userId,
        messages.length,
        "/api/v2/sms/sendbulkmulti",
        response.data.results?.[0]?.messageId || "multi_" + Date.now(),
        "queued",
        messages,
        response.data,
        undefined,
        recipients
      );

      res.json(response.data);
    } catch (error: any) {
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

  // Get all sent messages with status (NEW ENDPOINT)
  app.get("/api/v2/sms/messages", authenticateApiKey, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getMessageLogsByUserId(req.user.userId, limit);
      
      res.json({
        success: true,
        messages: messages.map(msg => ({
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
        limit: limit
      });
    } catch (error) {
      console.error("Messages fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to retrieve messages" });
    }
  });

  // Check single message status by ID (Dashboard - JWT Auth)
  app.get("/api/dashboard/sms/status/:messageId", authenticateToken, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      
      // Find the message in our database
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      
      if (!messageLog) {
        return res.status(404).json({ 
          success: false, 
          error: "Message not found" 
        });
      }
      
      // Check ownership (clients can only check their own messages, admins can check any)
      if (req.user.role !== 'admin' && messageLog.userId !== req.user.userId) {
        return res.status(403).json({ 
          success: false, 
          error: "Access denied" 
        });
      }
      
      // Fetch latest status from ExtremeSMS
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

        // Update our database with the latest status
        if (response.data.status && response.data.status !== messageLog.status) {
          await storage.updateMessageStatus(messageLog.id, response.data.status);
        }

        res.json({
          success: true,
          messageId: response.data.messageId,
          status: response.data.status,
          statusDescription: response.data.statusDescription || response.data.status
        });
      } catch (extremeError: any) {
        // If ExtremeSMS fails, return our local status
        console.error("ExtremeSMS status check failed, using local status:", extremeError.message);
        res.json({
          success: true,
          messageId: messageLog.messageId,
          status: messageLog.status,
          statusDescription: messageLog.status + " (cached)"
        });
      }
    } catch (error: any) {
      console.error("Dashboard status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });

  // Check single message status by ID (API - API Key Auth)
  app.get("/api/v2/sms/status/:messageId", authenticateApiKey, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      
      // Find the message in our database
      const messageLog = await storage.getMessageLogByMessageId(messageId);
      
      if (!messageLog) {
        return res.status(404).json({ 
          success: false, 
          error: "Message not found" 
        });
      }
      
      // Check ownership
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

      // Update our database with the latest status
      if (response.data.status && response.data.status !== messageLog.status) {
        await storage.updateMessageStatus(messageLog.id, response.data.status);
      }

      res.json(response.data);
    } catch (error: any) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      
      console.error("Status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  });

  // Get incoming messages (inbox)
  app.get("/api/v2/sms/inbox", authenticateApiKey, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getIncomingMessagesByUserId(req.user.userId, limit);
      
      res.json({
        success: true,
        messages: messages.map(msg => ({
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

  // Get account balance
  app.get("/api/v2/account/balance", authenticateApiKey, async (req: any, res) => {
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

  // ===== WEB UI ROUTES FOR SMS SENDING =====
  
  // Contact Groups API
  app.get("/api/contact-groups", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can query on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      const groups = await storage.getContactGroupsByUserId(targetUserId);
      res.json({ success: true, groups });
    } catch (error) {
      console.error("Get contact groups error:", error);
      res.status(500).json({ error: "Failed to retrieve contact groups" });
    }
  });

  app.post("/api/contact-groups", authenticateToken, async (req: any, res) => {
    try {
      const { name, description, businessUnitPrefix, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!name) {
        return res.status(400).json({ error: "Group name is required" });
      }
      // Admin can create on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;
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

  app.put("/api/contact-groups/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description, businessUnitPrefix } = req.body;
      
      // Verify ownership
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

  app.delete("/api/contact-groups/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const group = await storage.getContactGroup(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.userId !== req.user.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Delete associated contacts
      await storage.deleteContactsByGroupId(id);
      await storage.deleteContactGroup(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete contact group error:", error);
      res.status(500).json({ error: "Failed to delete contact group" });
    }
  });

  // Contacts API
  app.get("/api/contacts", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can query on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      const contacts = await storage.getContactsByUserId(targetUserId);
      res.json({ success: true, contacts });
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });

  app.post("/api/contacts", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.body.userId && req.user.role !== 'admin') {
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
      
      // Admin can create on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.body.userId) 
        ? req.body.userId 
        : req.user.userId;
      
      const contact = await storage.createContact({
        ...validated,
        userId: targetUserId
      });
      res.json({ success: true, contact });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Create contact error:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.post("/api/contacts/import-csv", authenticateToken, async (req: any, res) => {
    try {
      const { contacts, groupId, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: "Contacts array is required" });
      }

      // Admin can import on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;

      const insertContacts = contacts.map(c => ({
        userId: targetUserId,
        phoneNumber: c.phoneNumber,
        name: c.name || null,
        email: c.email || null,
        notes: c.notes || null,
        groupId: groupId || null
      }));

      const created = await storage.createContactsBulk(insertContacts);
      res.json({ success: true, count: created.length, contacts: created });
    } catch (error) {
      console.error("Import contacts error:", error);
      res.status(500).json({ error: "Failed to import contacts" });
    }
  });

  app.put("/api/contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { phoneNumber, name, email, notes, groupId } = req.body;
      
      // Verify ownership
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

  app.delete("/api/contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can delete on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      // Verify ownership against effective user
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

  // Export contacts as CSV with Business Unit IDs
  app.get("/api/contacts/export/csv", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can export on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      const contacts = await storage.getContactsByUserId(targetUserId);
      const groups = await storage.getContactGroupsByUserId(targetUserId);
      
      // Create a map of groupId -> businessUnitPrefix
      const groupPrefixMap = new Map<string, string>();
      groups.forEach((group: any) => {
        if (group.businessUnitPrefix) {
          groupPrefixMap.set(group.id, group.businessUnitPrefix);
        }
      });
      
      // Build CSV rows
      const csvRows = ['NAME,PHONE NUMBER,BUSINESS,ACTIONS'];
      
      // Track counters for each business unit prefix
      const prefixCounters = new Map<string, number>();
      
      contacts.forEach((contact: any) => {
        const name = contact.name || 'No name';
        const phone = contact.phoneNumber;
        let business = '';
        
        // Generate sequential Business ID if contact has a group with prefix
        if (contact.groupId && groupPrefixMap.has(contact.groupId)) {
          const prefix = groupPrefixMap.get(contact.groupId)!;
          
          // Initialize or increment counter for this prefix
          if (!prefixCounters.has(prefix)) {
            prefixCounters.set(prefix, 1);
          } else {
            prefixCounters.set(prefix, prefixCounters.get(prefix)! + 1);
          }
          
          business = `${prefix}_${prefixCounters.get(prefix)}`;
        }
        
        // CSV row: "Name,PhoneNumber,Business,Actions"
        csvRows.push(`${name},${phone},${business},`);
      });
      
      const csvContent = csvRows.join('\n');
      
      // Mark all exported contacts as synced to ExtremeSMS
      const contactIds = contacts.map((c: any) => c.id);
      if (contactIds.length > 0) {
        await storage.markContactsAsExported(contactIds);
      }
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts-export.csv');
      res.send(csvContent);
    } catch (error) {
      console.error("Export contacts CSV error:", error);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });

  // Get contact sync statistics
  app.get("/api/contacts/sync-stats", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can check stats for another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      const stats = await storage.getSyncStats(targetUserId);
      res.json(stats);
    } catch (error) {
      console.error("Get sync stats error:", error);
      res.status(500).json({ error: "Failed to get sync statistics" });
    }
  });

  // Web UI SMS Sending (calls ExtremeSMS via existing proxy logic)
  app.post("/api/web/sms/send-single", authenticateToken, async (req: any, res) => {
    try {
      const { to, message, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!to || !message) {
        return res.status(400).json({ error: "Recipient and message are required" });
      }

      // Admin can send on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;

      const { extremeUsername, extremePassword } = await getExtremeSMSCredentials();
      
      const response = await axios.post('https://extremesms.net/api2/api/sms/send-single', {
        username: extremeUsername,
        password: extremePassword,
        to,
        message
      });

      // Deduct credits and log using targetUserId
      await deductCreditsAndLog(
        targetUserId,
        1,
        'web-ui-single',
        response.data.messageId || 'unknown',
        'sent',
        { to, message },
        response.data,
        to
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Web UI send single error:", error);
      res.status(500).json({ error: error.message || "Failed to send SMS" });
    }
  });

  app.post("/api/web/sms/send-bulk", authenticateToken, async (req: any, res) => {
    try {
      const { recipients, message, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
        return res.status(400).json({ error: "Recipients array and message are required" });
      }

      // Enforce 3000 number limit for bulk sending
      if (recipients.length > 3000) {
        return res.status(400).json({ error: "Maximum 3000 recipients allowed per bulk send. Please split into multiple batches." });
      }

      // Admin can send on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;

      const extremeApiKey = await getExtremeApiKey();

      const response = await axios.post(
        \`\${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk\`,
        { recipients, content: message },
        {
          headers: {
            "Authorization": \`Bearer \${extremeApiKey}\`,
            "Content-Type": "application/json"
          }
        }
      );
        recipients.length,
        'web-ui-bulk',
        response.data.messageId || 'unknown',
        'sent',
        { recipients, message },
        response.data,
        undefined,
        recipients
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Web UI send bulk error:", error);
      res.status(500).json({ error: error.message || "Failed to send bulk SMS" });
    }
  });

  app.post("/api/web/sms/send-bulk-multi", authenticateToken, async (req: any, res) => {
    try {
      const { messages, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Enforce 3000 number limit for bulk multi sending
      if (messages.length > 3000) {
        return res.status(400).json({ error: "Maximum 3000 messages allowed per bulk send. Please split into multiple batches." });
      }

      // Admin can send on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;

      const extremeApiKey = await getExtremeApiKey();

      const response = await axios.post(
        \`\${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti\`,
        messages,
        {
          headers: {
            "Authorization": \`Bearer \${extremeApiKey}\`,
            "Content-Type": "application/json"
          }
        }
      );
      // Deduct credits and log using targetUserId
      await deductCreditsAndLog(
        targetUserId,
        messages.length,
        'web-ui-bulk-multi',
        response.data.messageId || 'unknown',
        'sent',
        { messages },
        response.data
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Web UI send bulk multi error:", error);
      res.status(500).json({ error: error.message || "Failed to send bulk multi SMS" });
    }
  });

  // Web UI Inbox
  app.get("/api/web/inbox", authenticateToken, async (req: any, res) => {
    try {
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      // Admin can query on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      const messages = await storage.getIncomingMessagesByUserId(targetUserId, limit);
      
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

  // Get conversation history with a specific phone number
  app.get("/api/web/inbox/conversation/:phoneNumber", authenticateToken, async (req: any, res) => {
    try {
      const { phoneNumber } = req.params;
      
      // Check if userId parameter is being used by non-admin
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      // Admin can query on behalf of another user
      const targetUserId = (req.user.role === 'admin' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;
      
      const conversation = await storage.getConversationHistory(targetUserId, phoneNumber);
      
      res.json({
        success: true,
        conversation
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Mark conversation as read
  app.post("/api/web/inbox/mark-read", authenticateToken, async (req: any, res) => {
    try {
      const { phoneNumber, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      // Admin can mark read on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;
      
      await storage.markConversationAsRead(targetUserId, phoneNumber);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      res.status(500).json({ error: 'Failed to mark conversation as read' });
    }
  });

  // Reply to incoming message
  app.post("/api/web/inbox/reply", authenticateToken, async (req: any, res) => {
    try {
      const { to, message, userId } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      
      if (!to || !message) {
        return res.status(400).json({ error: "Recipient and message are required" });
      }

      // Admin can send reply on behalf of another user
      const targetUserId = (req.user.role === 'admin' && userId) 
        ? userId 
        : req.user.userId;

      const { extremeUsername, extremePassword } = await getExtremeSMSCredentials();
      
      const response = await axios.post('https://extremesms.net/api2/api/sms/send-single', {
        username: extremeUsername,
        password: extremePassword,
        to,
        message
      });

      // Deduct credits and log using targetUserId
      await deductCreditsAndLog(
        targetUserId,
        1,
        'web-ui-reply',
        response.data.messageId || 'unknown',
        'sent',
        { to, message },
        response.data,
        to
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Web UI reply error:", error);
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
