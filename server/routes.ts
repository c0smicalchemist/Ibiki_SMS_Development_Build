import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./resend";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
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
  recipients?: string[]
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

  // Create message log
  const messageLog = await storage.createMessageLog({
    userId,
    messageId,
    endpoint,
    recipient: recipient || null,
    recipients: recipients || null,
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

      // Find client by assigned phone number (receiver field)
      let assignedUserId: string | null = null;
      const clientProfile = await storage.getClientProfileByPhoneNumber(payload.receiver);
      
      if (clientProfile) {
        assignedUserId = clientProfile.userId;
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
              lastActive: apiKeys[0]?.lastUsedAt 
                ? new Date(apiKeys[0].lastUsedAt).toLocaleDateString()
                : 'Never',
              assignedPhoneNumber: profile?.assignedPhoneNumber || null
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
      const { extremeApiKey, extremeCost, clientRate } = req.body;

      if (extremeApiKey) {
        await storage.setSystemConfig("extreme_api_key", extremeApiKey);
      }
      if (extremeCost) {
        await storage.setSystemConfig("extreme_cost_per_sms", extremeCost);
      }
      if (clientRate) {
        await storage.setSystemConfig("client_rate_per_sms", clientRate);
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

  // Add credits to client account (ADMIN ONLY)
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

  // Update client's assigned phone number (ADMIN ONLY)
  app.post("/api/admin/update-phone-number", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { userId, phoneNumber } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Phone number can be null to unassign
      const profile = await storage.getClientProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }

      // Update phone number
      await storage.updateClientPhoneNumber(userId, phoneNumber || null);

      res.json({ 
        success: true, 
        message: phoneNumber ? "Phone number assigned successfully" : "Phone number unassigned",
        phoneNumber: phoneNumber || null
      });
    } catch (error) {
      console.error("Update phone number error:", error);
      res.status(500).json({ error: "Failed to update phone number" });
    }
  });

  // ============================================
  // API Proxy Routes (ExtremeSMS passthrough)
  // ============================================

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

  // Check message status
  app.get("/api/v2/sms/status/:messageId", authenticateApiKey, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      const extremeApiKey = await getExtremeApiKey();
      
      const response = await axios.get(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/status/${messageId}`,
        {
          headers: {
            "Authorization": `Bearer ${extremeApiKey}`
          }
        }
      );

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

  const httpServer = createServer(app);
  return httpServer;
}
