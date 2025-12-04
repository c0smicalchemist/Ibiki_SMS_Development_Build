import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { type User, insertContactSchema, insertContactGroupSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { exec } from "child_process";
import { normalizePhone, normalizeMany } from "../shared/phone";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./resend";

const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
const PROTECTED_ADMIN_EMAIL = 'ibiki_dash@proton.me';
const EXTREMESMS_BASE_URL = "https://extremesms.net";

// Middleware to verify JWT token
async function authenticateToken(req: any, res: any, next: any) {
  const hdr = req.headers["authorization"] || req.headers["Authorization"] || req.headers["x-auth-token"];
  let token: string | undefined = undefined;
  if (hdr && typeof hdr === 'string') {
    token = hdr.includes('Bearer ') ? hdr.split(' ')[1] : hdr;
  }

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

// Role gate: allow any of the provided roles
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient privileges" });
    }
    next();
  };
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
async function getPricingConfig(userId?: string, groupId?: string) {
  let gid = groupId;
  if (!gid && userId) {
    const u = await storage.getUser(userId).catch(() => undefined);
    gid = (u as any)?.groupId || undefined;
  }
  if (gid) {
    const gExtreme = await storage.getSystemConfig(`pricing.group.${gid}.extreme_cost`);
    const gRate = await storage.getSystemConfig(`pricing.group.${gid}.client_rate`);
    if (gExtreme && gRate) {
      const extremeCost = parseFloat(gExtreme.value);
      const clientRate = parseFloat(gRate.value);
      if (!Number.isNaN(extremeCost) && !Number.isNaN(clientRate)) return { extremeCost, clientRate };
    }
  }
  const extremeCostConfig = await storage.getSystemConfig("extreme_cost_per_sms");
  const clientRateConfig = await storage.getSystemConfig("client_rate_per_sms");
  const extremeCost = extremeCostConfig ? parseFloat(extremeCostConfig.value) : 0.01;
  const clientRate = clientRateConfig ? parseFloat(clientRateConfig.value) : 1.0;
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

  // Extract sender phone from response if available, otherwise fall back to client's assigned number
  let senderPhone = senderPhoneNumber || 
                    responsePayload?.senderPhone || 
                    responsePayload?.from || 
                    responsePayload?.sender || 
                    null;
  if (!senderPhone) {
    try {
      const assigned = (profile as any)?.assignedPhoneNumbers || [];
      if (Array.isArray(assigned) && assigned.length > 0) senderPhone = assigned[0];
    } catch {}
  }

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
    totalCharge: creditsToDeduct.toFixed(2),
    messageCount,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });

  // Create credit transaction
  await storage.createCreditTransaction({
    userId,
    amount: (-creditsToDeduct).toFixed(2),
    type: "debit",
    description: `SMS sent via ${endpoint} (USD $${totalChargeUSD.toFixed(2)})`,
    balanceBefore: currentCredits.toFixed(2),
    balanceAfter: newCredits.toFixed(2),
    messageLogId: messageLog.id
  });

  // Update credits
  await storage.updateClientCredits(userId, newCredits.toFixed(2));

  // Reduce group pool if configured for this user's group
  try {
    const u = await storage.getUser(userId).catch(() => undefined);
    const gid = (u as any)?.groupId || undefined;
    if (gid) {
      await ensureGroupPoolInitialized(gid);
      const pool = await storage.getSystemConfig(`group.pool.${gid}`);
      const currentPool = parseFloat(pool?.value || '0') || 0;
      const nextPool = Math.max(currentPool - creditsToDeduct, 0);
      await storage.setSystemConfig(`group.pool.${gid}`, nextPool.toFixed(2));
    }
  } catch {}

  // Reduce admin overall pool (IbikiSMS Balance tracked locally)
  try {
    const adminPool = await storage.getSystemConfig('admin.pool');
    const currentAdminPool = adminPool ? parseFloat(adminPool.value) || 0 : 0;
    const nextAdminPool = Math.max(currentAdminPool - creditsToDeduct, 0);
    await storage.setSystemConfig('admin.pool', nextAdminPool.toFixed(2));
  } catch {}

  return { messageLog, newBalance: newCredits };
}

async function createAdminAuditLog(
  adminUserId: string,
  sourceEndpoint: string,
  messageId: string,
  status: string,
  requestPayload: any,
  responsePayload: any,
  recipient?: string,
  recipients?: string[],
  senderPhoneNumber?: string
) {
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
    chargePerMessage: '0.0000',
    totalCost: extremeCost.toFixed(2),
    totalCharge: '0.00',
    messageCount: (recipients?.length || 0) > 0 ? recipients!.length : 1,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify(responsePayload)
  });
}

// Helper: allocate next unique IBS_<n> business name
async function allocateNextBusinessName(): Promise<string> {
  const all = await storage.getAllUsers();
  const names: string[] = [];
  for (const u of all) {
    const p = await storage.getClientProfileByUserId(u.id);
    if (p?.businessName) names.push(String(p.businessName));
  }
  const nums = names.map(n => /^IBS_(\d+)$/i.test(n) ? parseInt(n.replace(/^IBS_/, ''), 10) : null).filter((v: any) => typeof v === 'number') as number[];
  const next = (nums.length ? Math.max(...nums) + 1 : 0);
  return `IBS_${next}`;
}

async function ensureGroupPoolInitialized(gid: string): Promise<void> {
  const existing = await storage.getSystemConfig(`group.pool.${gid}`);
  if (existing) return;
  const all = await storage.getAllUsers();
  let sum = 0;
  for (const u of all) {
    if ((u as any)?.role === 'supervisor' && (u as any)?.groupId === gid) {
      const p = await storage.getClientProfileByUserId(u.id);
      sum += parseFloat(p?.credits || '0') || 0;
    }
  }
  await storage.setSystemConfig(`group.pool.${gid}`, sum.toFixed(2));
}

async function resolveFetchLimit(userId: string | undefined, role: string | undefined, provided?: string | number) {
  if (provided) {
    const n = typeof provided === 'string' ? parseInt(provided) : provided;
    return Math.max(1, Math.min(2000, isNaN(n as number) ? 100 : (n as number)));
  }
  const perUser = userId ? await storage.getSystemConfig(`messages_limit_user_${userId}`) : undefined;
  if (perUser?.value) {
    const v = parseInt(perUser.value);
    return Math.max(1, Math.min(2000, isNaN(v) ? 100 : v));
  }
  const key = role === 'admin' ? 'default_admin_messages_limit' : 'default_client_messages_limit';
  const cfg = await storage.getSystemConfig(key);
  if (cfg?.value) {
    const v = parseInt(cfg.value);
    return Math.max(1, Math.min(2000, isNaN(v) ? 100 : v));
  }
  return 100;
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
  app.use(express.urlencoded({ extended: true }));

  // Paraphrase endpoint (Ibiki Phraser) - simple stub generator for MVP
  app.post('/api/tools/paraphrase', authenticateToken, async (req: any, res) => {
    try {
      const { text, n = 5, creativity = 0.5, lang = 'en', includeLink = false } = req.body || {};
      if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
      const count = Math.max(1, Math.min(25, parseInt(String(n)) || 5));
      const cfg = await getParaphraserConfig();
      const placeholders: Record<string,string> = {};
      const urlPlaceholders: Set<string> = new Set();
      let protectedText = String(text);
      protectedText = protectedText.replace(/\{\{[^}]+\}\}/g, (m) => { const k = `__PH_${Object.keys(placeholders).length}__`; placeholders[k]=m; return k; });
      protectedText = protectedText.replace(/https?:\/\/[^\s]+/g, (m) => { const k = `__PH_${Object.keys(placeholders).length}__`; placeholders[k]=m; urlPlaceholders.add(k); return k; });

      const clamp = (s: string) => {
        const max = (cfg as any).rules?.targetMax || 155; const hardMax = (cfg as any).rules?.maxChars || 160;
        let out = s.trim().replace(/\s+/g,' ');
        if (out.length <= max) return out;
        let cut = out.lastIndexOf(' ', max);
        if (cut < 0) cut = max;
        out = out.slice(0, cut).trim();
        const trailing = out.split(/\s+/).pop()?.toLowerCase() || '';
        if (['to','and','or','is','are','with','at','for','of','on','in'].includes(trailing)) out = out.replace(new RegExp(`${trailing}$`),'').trim();
        if (!/[.?!]$/.test(out)) out += '.';
        if (out.length > hardMax) out = out.slice(0, hardMax).trim();
        return out;
      };

      const stubGen = (base: string, c: number, creative: number) => {
        const synonyms: Record<string,string[]> = { hello: ['Hello','Hi','Hey','Hello there'], thanks: ['Thank you','Thanks','Much appreciated'], please: ['please','kindly'], good: ['great','nice','excellent'] };
        const arr: any[] = [];
        const endsWithQuestion = /\?\s*$/.test(base);
        for (let i=0;i<c;i++){
          const words = base.split(/\s+/);
          const v = words.map(w => {
            const key = w.replace(/[^a-zA-Z]/g,'').toLowerCase();
            if (synonyms[key] && Math.random() < (0.2 + creative*0.6)) {
              const opts = synonyms[key]; return opts[Math.floor(Math.random()*opts.length)];
            }
            return w;
          }).join(' ');
          let out = v.trim();
          // Capitalize sentence start
          out = out.charAt(0).toUpperCase() + out.slice(1);
          // Ensure punctuation
          if (!/[.?!]\s*$/.test(out)) out = out + (endsWithQuestion ? '?' : '.');
          Object.keys(placeholders).forEach(k => {
            const orig = placeholders[k];
            if (includeLink && urlPlaceholders.has(k)) {
              const phrase = ` here is the link ${orig} here you will find more information `;
              // remove any leftover placeholder and insert mid-sentence
              out = out.replace(new RegExp(k,'g'), '');
              const mid = Math.floor(out.length/2);
              let pos = out.indexOf(' ', mid);
              if (pos === -1) pos = out.lastIndexOf(' ', mid);
              if (pos === -1) pos = mid;
              out = `${out.slice(0,pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g,' ').trim();
            } else {
              out = out.replace(new RegExp(k,'g'), orig);
            }
          });
          out = clamp(out);
          const id = crypto.randomBytes(8).toString('hex');
          arr.push({ id, text: out, score: +(0.80 + Math.random()*0.15).toFixed(2) });
        }
        return arr;
      };

      let variants: any[] = [];
      let providerUsed: 'openrouter' | 'ollama' | 'remote' | 'stub' = 'stub';
      if (cfg.provider === 'ollama') {
        const temp = Math.max(0, Math.min(1, Number(creativity))) || 0.5;
        for (let i=0;i<count;i++) {
          const prompt = `Paraphrase the following SMS. Preserve any tokens like {{name}} and any URLs exactly. Output only the paraphrase.\nText: ${protectedText}`;
          const resp = await axios.post(`${cfg.url}/api/generate`, { model: cfg.model, prompt, stream: false, options: { temperature: temp } }, { timeout: 15000 });
          let out = String(resp.data?.response || protectedText);
          Object.keys(placeholders).forEach(k => { out = out.replace(new RegExp(k,'g'), placeholders[k]); });
          out = clamp(out);
          const id = crypto.randomBytes(8).toString('hex');
          variants.push({ id, text: out, score: +(0.8).toFixed(2) });
        }
        providerUsed = 'ollama';
      } else if (cfg.provider === 'openrouter' && (cfg as any).key) {
        const temp = Math.max(0, Math.min(1, Number(creativity))) || 0.5;
        const minChars = (cfg as any).rules?.targetMin || 145;
        const maxChars = (cfg as any).rules?.targetMax || 155;
        const grammar = ((cfg as any).rules?.enforceGrammar ? 'Ensure complete, grammatically correct sentences.' : '');
        const prompt = `Paraphrase the following SMS into ${count} variants. ${grammar} Keep each variant between ${minChars}-${maxChars} characters and strictly under ${(cfg as any).rules?.maxChars || 160}. Preserve tokens like {{name}} and any URLs exactly. Place any URL token mid-sentence using natural phrasing. Prefer responding with a JSON object {"variants":[{"text":"...","score":0.9},...]}. If you cannot respond as JSON, respond with ${count} bullet lines, one variant per line.\nText: ${protectedText}`;
        const rawKey = String((cfg as any).key || '').trim();
        const authHeader = rawKey.startsWith('Bearer ') ? rawKey : `Bearer ${rawKey}`;
        const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Authorization': authHeader };
        const body = { model: (cfg as any).model || 'openrouter/auto', messages: [{ role: 'system', content: 'Paraphrase SMS while preserving placeholders and links; respond as JSON.' }, { role: 'user', content: prompt }], temperature: temp, response_format: { type: 'json_object' } };
        try {
          const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, { headers, timeout: 20000 });
          let raw = String(resp.data?.choices?.[0]?.message?.content || '{}');
          raw = raw.replace(/^```json\s*/i,'').replace(/\s*```$/,'');
          let parsed: any = {};
          try { parsed = JSON.parse(raw); } catch { parsed = {}; }
          let arr = Array.isArray(parsed?.variants) ? parsed.variants : [];
          if (!Array.isArray(arr) || arr.length === 0) {
            const lines = String(resp.data?.choices?.[0]?.message?.content || '').split(/\r?\n/).map(s => s.replace(/^[-*\d\.\)\s]+/,'').trim()).filter(s => s.length > 0);
            arr = lines.slice(0, count).map(txt => ({ text: txt, score: 0.8 }));
          }
          for (const v of arr) {
            let out = String(v?.text || protectedText);
            Object.keys(placeholders).forEach(k => {
              const orig = placeholders[k];
              if (includeLink && urlPlaceholders.has(k)) {
                if (out.includes(orig)) {
                  out = out.replace(new RegExp(k,'g'), orig);
                } else if (out.includes(k)) {
                  const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig);
                  out = out.replace(new RegExp(k,'g'), phrase);
                } else {
                  const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig);
                  const mid = Math.floor(out.length/2);
                  let pos = out.indexOf(' ', mid);
                  if (pos === -1) pos = out.lastIndexOf(' ', mid);
                  if (pos === -1) pos = mid;
                  out = `${out.slice(0,pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g,' ').trim();
                }
              } else {
                out = out.replace(new RegExp(k,'g'), orig);
              }
            });
            out = clamp(out);
            const id = crypto.randomBytes(8).toString('hex');
            const score = typeof v?.score === 'number' ? v.score : 0.8;
            variants.push({ id, text: out, score: +Number(score).toFixed(2) });
          }
          {
            const seen = new Set<string>();
            variants = variants.filter(v => { const norm = v.text.toLowerCase().replace(/\s+/g,' ').trim(); if (seen.has(norm)) return false; seen.add(norm); return true; });
          }
          if (variants.length < count) {
            const remain = count - variants.length;
            const prompt2 = `Provide ${remain} additional distinct variants that meet the same rules.\nText: ${protectedText}`;
            const body2 = { model: (cfg as any).model || 'openrouter/auto', messages: [{ role: 'system', content: 'Paraphrase SMS while preserving placeholders and links; respond as JSON.' }, { role: 'user', content: prompt2 }], temperature: temp, response_format: { type: 'json_object' } };
            try {
              const resp2 = await axios.post('https://openrouter.ai/api/v1/chat/completions', body2, { headers, timeout: 20000 });
              let raw2 = String(resp2.data?.choices?.[0]?.message?.content || '{}');
              raw2 = raw2.replace(/^```json\s*/i,'').replace(/\s*```$/,'');
              let parsed2: any = {}; try { parsed2 = JSON.parse(raw2); } catch { parsed2 = {}; }
              let arr2 = Array.isArray(parsed2?.variants) ? parsed2.variants : [];
              if (!Array.isArray(arr2) || arr2.length === 0) {
                const lines2 = String(resp2.data?.choices?.[0]?.message?.content || '').split(/\r?\n/).map(s => s.replace(/^[-*\d\.\)\s]+/,'').trim()).filter(s => s.length > 0);
                arr2 = lines2.slice(0, remain).map(txt => ({ text: txt, score: 0.8 }));
              }
              for (const v of arr2) {
                let out = String(v?.text || protectedText);
                Object.keys(placeholders).forEach(k => {
                  const orig = placeholders[k];
                  if (includeLink && urlPlaceholders.has(k)) {
                    if (out.includes(orig)) {
                      out = out.replace(new RegExp(k,'g'), orig);
                    } else if (out.includes(k)) {
                      const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig);
                      out = out.replace(new RegExp(k,'g'), phrase);
                    } else {
                      const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig);
                      const mid = Math.floor(out.length/2);
                      let pos = out.indexOf(' ', mid);
                      if (pos === -1) pos = out.lastIndexOf(' ', mid);
                      if (pos === -1) pos = mid;
                      out = `${out.slice(0,pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g,' ').trim();
                    }
                  } else {
                    out = out.replace(new RegExp(k,'g'), orig);
                  }
                });
                out = clamp(out);
                const id = crypto.randomBytes(8).toString('hex');
                const score = typeof v?.score === 'number' ? v.score : 0.8;
                const norm = out.toLowerCase().replace(/\s+/g,' ').trim();
                if (!variants.some(x => x.text.toLowerCase().replace(/\s+/g,' ').trim() === norm)) {
                  variants.push({ id, text: out, score: +Number(score).toFixed(2) });
                }
              }
            } catch {}
          }
          if (variants.length === 0) {
            variants = stubGen(protectedText, count, temp);
            providerUsed = 'stub';
          } else {
            providerUsed = 'openrouter';
          }
        } catch (err:any) {
          variants = stubGen(protectedText, count, temp);
          providerUsed = 'stub';
        }
      } else if (cfg.provider === 'remote' && cfg.url) {
        const headers: Record<string,string> = { 'Content-Type': 'application/json' };
        if ((cfg as any).auth) headers['Authorization'] = (cfg as any).auth;
        try {
          const resp = await axios.post(`${cfg.url}`, { text: protectedText, n: count, creativity, lang }, { headers, timeout: 15000 });
          const arr = Array.isArray(resp.data?.variants) ? resp.data.variants : (Array.isArray(resp.data) ? resp.data : []);
          for (const v of arr) {
            let out = String(v?.text || protectedText);
            Object.keys(placeholders).forEach(k => { const orig = placeholders[k]; if (includeLink && urlPlaceholders.has(k)) { if (out.includes(orig)) { out = out.replace(new RegExp(k,'g'), orig); } else if (out.includes(k)) { const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig); out = out.replace(new RegExp(k,'g'), phrase); } else { const phrase = String((cfg as any).rules?.linkTemplate || '').replace('${url}', orig); const mid = Math.floor(out.length/2); let pos = out.indexOf(' ', mid); if (pos === -1) pos = out.lastIndexOf(' ', mid); if (pos === -1) pos = mid; out = `${out.slice(0,pos)} ${phrase} ${out.slice(pos)}`.replace(/\s+/g,' ').trim(); } } else { out = out.replace(new RegExp(k,'g'), orig); } });
            out = clamp(out);
            const id = String(v?.id || crypto.randomBytes(8).toString('hex'));
            const score = typeof v?.score === 'number' ? v.score : 0.8;
            variants.push({ id, text: out, score: +Number(score).toFixed(2) });
          }
          if (variants.length === 0) {
            variants = stubGen(protectedText, count, Number(creativity));
            providerUsed = 'stub';
          } else {
            providerUsed = 'remote';
          }
        } catch (err:any) {
          variants = stubGen(protectedText, count, Number(creativity));
          providerUsed = 'stub';
        }
      } else {
        variants = stubGen(protectedText, count, Number(creativity));
        providerUsed = 'stub';
      }

      res.json({ success: true, variants, providerUsed });
    } catch (e:any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
  async function isProtectedAccount(userId: string): Promise<boolean> {
    try {
      const u = await storage.getUser(userId);
      return !!u && u.email === PROTECTED_ADMIN_EMAIL;
    } catch {
      return false;
    }
  }

  // Utility: extract variantId from payload (if provided) to embed into requestPayload
  function attachVariantMeta(payload: any, variantId?: string) {
    try {
      if (variantId) payload.__variantId = String(variantId);
    } catch {}
    return payload;
  }

  // ============================================
  // Health Check Routes
  // ============================================
  
  // Basic health check - no database required
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      version: "1.0.0"
    });
  });

  // Detailed health check with database
  app.get("/api/health/detailed", async (req, res) => {
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "unknown",
      userCount: 0,
      uptime: process.uptime()
    };

    try {
      // Test database connection by trying to get user count
      const users = await storage.getAllUsers();
      healthStatus.database = "connected";
      healthStatus.userCount = users.length;
      console.log('✅ Detailed health check: Database connected, user count:', users.length);
      
      res.json(healthStatus);
    } catch (error) {
      console.error("Detailed health check database error:", error);
      
      // Still return 200 OK for basic health check - app is running even if DB has issues
      healthStatus.status = "degraded";
      healthStatus.database = "error";
      
      res.json(healthStatus);
    }
  });

  // Secrets status
  app.get('/api/admin/secrets/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const keys = ['jwt_secret','session_secret','webhook_secret','resend_api_key','captcha_secret','turnstile_site_key','turnstile_secret'];
      const out: Record<string, boolean> = {};
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
        TURNSTILE_SECRET: !!process.env.TURNSTILE_SECRET,
      };
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:8080';
      const baseUrl = `${proto}://${host}`;
      const suggestedWebhook = `${baseUrl}/api/webhook/extreme-sms`;
      const configuredWebhookRec = await storage.getSystemConfig('webhook_url');
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, configured: out, envPresent, baseUrl, suggestedWebhook, configuredWebhook: configuredWebhookRec?.value || null });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Set secrets (admin)
  app.post('/api/admin/secrets/set', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const allowed = ['jwt_secret','session_secret','webhook_secret','resend_api_key','captcha_secret','turnstile_site_key','turnstile_secret'];
      for (const key of allowed) {
        if (payload[key]) {
          await storage.setSystemConfig(key, String(payload[key]));
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Rotate a specific secret
  app.post('/api/admin/secrets/rotate', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { key } = req.body as { key: string };
      const allowed = ['jwt_secret','session_secret','webhook_secret'];
      if (!allowed.includes(key)) return res.status(400).json({ success: false, error: 'Invalid key' });
      const newVal = crypto.randomBytes(48).toString('base64url');
      await storage.setSystemConfig(key, newVal);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.get("/api/admin/db/status", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const url = process.env.DATABASE_URL;
      if (!url) return res.status(400).json({ success: false, error: "DATABASE_URL not set" });
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
      const r = await pool.query("select table_name from information_schema.tables where table_schema='public' order by table_name");
      await pool.end();
      res.set('Cache-Control', 'no-store');
      let conn: any = {};
      try {
        const u = new URL(url);
        conn = {
          protocol: u.protocol.replace(':',''),
          host: u.hostname,
          port: u.port || '5432',
          database: (u.pathname || '').replace(/^\//,'') || '',
          user: u.username || ''
        };
      } catch {}
      res.json({ success: true, tables: r.rows.map((x: any) => x.table_name), connection: conn });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/admin/db/migrate", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const url = process.env.DATABASE_URL;
      if (!url) return res.status(400).json({ success: false, error: "DATABASE_URL not set" });
      const { Pool } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const path = await import('path');
      const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
      const db = drizzle(pool);
      const migrationsFolder = path.resolve(import.meta.dirname, '..', 'migrations');
      try {
        await migrate(db, { migrationsFolder });
        await pool.end();
        return res.json({ success: true });
      } catch (e: any) {
        const exec = async (q: string) => { try { await pool.query(q); } catch (_) {} };
        await exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        await exec(`CREATE TABLE IF NOT EXISTS users (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password text NOT NULL, name text NOT NULL, company text, role text NOT NULL DEFAULT 'client', group_id text, is_active boolean NOT NULL DEFAULT true, reset_token text, reset_token_expiry timestamp, created_at timestamp NOT NULL DEFAULT now())`);
        await exec(`CREATE INDEX IF NOT EXISTS email_idx ON users(email)`);
        await exec(`CREATE INDEX IF NOT EXISTS reset_token_idx ON users(reset_token)`);
        await exec(`CREATE INDEX IF NOT EXISTS user_group_id_idx ON users(group_id)`);
        await exec(`CREATE TABLE IF NOT EXISTS api_keys (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, key_hash text NOT NULL UNIQUE, key_prefix text NOT NULL, key_suffix text NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), last_used_at timestamp, CONSTRAINT fk_api_keys_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec(`CREATE INDEX IF NOT EXISTS user_id_idx ON api_keys(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS key_hash_idx ON api_keys(key_hash)`);
        await exec(`CREATE TABLE IF NOT EXISTS client_profiles (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL UNIQUE, credits numeric(10,2) NOT NULL DEFAULT 0.00, currency text NOT NULL DEFAULT 'USD', custom_markup numeric(10,4), assigned_phone_numbers text[], rate_limit_per_minute integer NOT NULL DEFAULT 200, business_name text, updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_client_profiles_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec(`CREATE TABLE IF NOT EXISTS system_config (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now())`);
        await exec(`CREATE TABLE IF NOT EXISTS message_logs (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, message_id text NOT NULL, endpoint text NOT NULL, recipient text, recipients text[], sender_phone_number text, status text NOT NULL, cost_per_message numeric(10,4) NOT NULL, charge_per_message numeric(10,4) NOT NULL, total_cost numeric(10,2) NOT NULL, total_charge numeric(10,2) NOT NULL, message_count integer NOT NULL DEFAULT 1, request_payload text, response_payload text, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_message_logs_user FOREIGN KEY(user_id) REFERENCES users(id))`);
        await exec(`CREATE INDEX IF NOT EXISTS message_user_id_idx ON message_logs(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS message_created_at_idx ON message_logs(created_at)`);
        await exec(`CREATE INDEX IF NOT EXISTS message_id_idx ON message_logs(message_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS message_sender_phone_idx ON message_logs(sender_phone_number)`);
        await exec(`CREATE INDEX IF NOT EXISTS message_is_example_idx ON message_logs(is_example)`);
        await exec(`CREATE TABLE IF NOT EXISTS credit_transactions (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, amount numeric(10,2) NOT NULL, type text NOT NULL, description text NOT NULL, balance_before numeric(10,2) NOT NULL, balance_after numeric(10,2) NOT NULL, message_log_id varchar, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_credit_tx_user FOREIGN KEY(user_id) REFERENCES users(id), CONSTRAINT fk_credit_tx_message FOREIGN KEY(message_log_id) REFERENCES message_logs(id))`);
        await exec(`CREATE INDEX IF NOT EXISTS transaction_user_id_idx ON credit_transactions(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS transaction_created_at_idx ON credit_transactions(created_at)`);
        await exec(`CREATE TABLE IF NOT EXISTS incoming_messages (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar, from text NOT NULL, firstname text, lastname text, business text, message text NOT NULL, status text NOT NULL, matched_block_word text, receiver text NOT NULL, usedmodem text, port text, timestamp timestamp NOT NULL, message_id text NOT NULL, is_read boolean NOT NULL DEFAULT false, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_incoming_user FOREIGN KEY(user_id) REFERENCES users(id))`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_timestamp_idx ON incoming_messages(timestamp)`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_message_id_idx ON incoming_messages(message_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_from_idx ON incoming_messages("from")`);
        await exec(`CREATE INDEX IF NOT EXISTS incoming_is_example_idx ON incoming_messages(is_example)`);
        await exec(`CREATE TABLE IF NOT EXISTS client_contacts (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, phone_number text NOT NULL, firstname text, lastname text, business text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_client_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec(`CREATE INDEX IF NOT EXISTS contact_user_id_idx ON client_contacts(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS contact_phone_idx ON client_contacts(phone_number)`);
        await exec(`CREATE INDEX IF NOT EXISTS contact_business_idx ON client_contacts(business)`);
        await exec(`CREATE INDEX IF NOT EXISTS contact_phone_user_idx ON client_contacts(phone_number, user_id)`);
        await exec(`CREATE TABLE IF NOT EXISTS contact_groups (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, name text NOT NULL, description text, business_unit_prefix text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_contact_groups_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
        await exec(`CREATE INDEX IF NOT EXISTS group_user_id_idx ON contact_groups(user_id)`);
        await exec(`CREATE TABLE IF NOT EXISTS contacts (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, group_id varchar, phone_number text NOT NULL, name text, email text, notes text, synced_to_extremesms boolean NOT NULL DEFAULT false, last_exported_at timestamp, is_example boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), CONSTRAINT fk_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_contacts_group FOREIGN KEY(group_id) REFERENCES contact_groups(id) ON DELETE SET NULL)`);
        await exec(`CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS contacts_group_id_idx ON contacts(group_id)`);
        await exec(`CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone_number)`);
        await exec(`CREATE INDEX IF NOT EXISTS contacts_synced_idx ON contacts(synced_to_extremesms)`);
        await exec(`CREATE INDEX IF NOT EXISTS contacts_is_example_idx ON contacts(is_example)`);
        await pool.end();
        return res.json({ success: true, fallback: true });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Seed example data (admin)
  app.post('/api/admin/seed-example', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = (req.body || {}) as { userId?: string };
      const targetUserId = userId || req.user.userId;
      await storage.seedExampleData(targetUserId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/admin/seed-delete', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = (req.body || {}) as { userId?: string };
      const targetUserId = userId || req.user.userId;
      await storage.deleteExampleData(targetUserId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Admin: seed/delete example for any user
  app.post('/api/web/inbox/seed-example', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const targetUserId = (req.body && req.body.userId) || req.user.userId;
      await storage.seedExampleData(targetUserId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/web/inbox/seed-delete', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const targetUserId = (req.body && req.body.userId) || req.user.userId;
      await storage.deleteExampleData(targetUserId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Persist webhook URL
  app.post('/api/admin/webhook/set-url', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { url } = req.body as { url: string };
      if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'Invalid URL' });
      await storage.setSystemConfig('webhook_url', url);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // ============================================
  // Authentication Routes
  // ============================================

  // Signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log('🔐 Signup attempt started');
      const { username, email, password, confirmPassword, groupId, captchaToken } = req.body;

      if ((!email && !username) || !password) {
        console.log('❌ Signup failed: Missing identifier or password');
        return res.status(400).json({ error: "identifier_required" });
      }

      if (!confirmPassword) {
        console.log('❌ Signup failed: Missing password confirmation');
        return res.status(400).json({ error: "Password confirmation is required" });
      }

      if (password !== confirmPassword) {
        console.log('❌ Signup failed: Passwords do not match');
        return res.status(400).json({ error: "Passwords do not match" });
      }

      if (!(await verifyCaptchaToken(captchaToken))) {
        console.log('❌ Signup failed: captcha');
        return res.status(400).json({ error: "captcha_failed" });
      }

      if (!groupId) {
        console.log('❌ Signup failed: missing groupId');
        return res.status(400).json({ error: "groupId_required" });
      }
      async function resolveGroup(code: string): Promise<string | null> {
        const rec = await (storage as any).findContactGroupByCode?.(code) || await storage.getContactGroup(code);
        if (rec?.id) return rec.id;
        const cfgExtreme = await storage.getSystemConfig(`pricing.group.${code}.extreme_cost`).catch(()=>undefined);
        const cfgRate = await storage.getSystemConfig(`pricing.group.${code}.client_rate`).catch(()=>undefined);
        if (cfgExtreme || cfgRate) return code; // accept pricing-configured group codes even if contact_groups missing
        return null;
      }
      const resolvedGroupId = await resolveGroup(groupId);
      if (!resolvedGroupId) {
        console.log('❌ Signup failed: invalid groupId');
        return res.status(400).json({ error: "groupId_invalid" });
      }

      if (email) {
        console.log('🔍 Checking if email exists:', email);
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) return res.status(400).json({ error: "email_taken" });
      }
      if (username) {
        console.log('🔍 Checking if username exists:', username);
        const existingUser = await (storage as any).getUserByUsername?.(username);
        if (existingUser) return res.status(400).json({ error: "username_taken" });
      }

      // Generate name from username or email
      const name = (username || (email ? email.split('@')[0] : 'user'));
      console.log('👤 Creating user:', { email, name });

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
      if (username) { try { await (storage as any).setUsername?.(user.id, username); } catch {} }
      console.log('✅ User created successfully:', user.id);

      // Create client profile with initial credits
      console.log('💰 Creating client profile');
      await storage.createClientProfile({
        userId: user.id,
        credits: "0.00",
        currency: "USD",
        customMarkup: null
      });
      try {
        const all = await storage.getAllUsers();
        const names: string[] = [];
        for (const u of all) {
          const p = await storage.getClientProfileByUserId(u.id);
          if (p?.businessName) names.push(String(p.businessName));
        }
        const nums = names.map(n => /^IBS_(\d+)$/i.test(n) ? parseInt(n.replace(/^IBS_/, ''), 10) : null).filter((v: any) => typeof v === 'number') as number[];
        const next = (nums.length ? Math.max(...nums) + 1 : 0);
        await storage.updateClientBusinessName(user.id, `IBS_${next}`);
      } catch {}
      console.log('✅ Client profile created');

      // Generate API key
      console.log('🔑 Generating API key');
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
      console.log('✅ API key created');

      // Optional: seed example data if admin enabled it
      try {
        const seedCfg = await storage.getSystemConfig('signup_seed_examples');
        const shouldSeed = (seedCfg?.value || '').toLowerCase() === 'true';
        if (shouldSeed) {
          await storage.seedExampleData(user.id);
        }
      } catch {}

      console.log('🎫 Generating JWT token');
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

      console.log('✅ Signup completed successfully for:', username || emailNormalized);
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      try { await (storage as any).createActionLog?.({ actorUserId: user.id, actorRole: user.role, targetUserId: user.id, action: 'signup', details: (username || emailNormalized) }); } catch {}
      res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, groupId: (user as any).groupId || null, username: username || null },
        token,
        apiKey: rawApiKey // Only shown once
      });
    } catch (error: any) {
      console.error("❌ Signup error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({ error: "Signup failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log('🔐 Login attempt started');
      const { identifier, password, captchaToken } = req.body;

      if (!identifier || !password) {
        console.log('❌ Login failed: Missing identifier or password');
        return res.status(400).json({ error: "identifier_required" });
      }

      console.log('🔍 Looking up user:', identifier);
      let user = await (storage as any).getUserByUsername?.(identifier);
      if (!user) user = await storage.getUserByEmail(identifier);
      if (!user || !user.isActive) {
        console.log('❌ Login failed: User not found or inactive');
        return res.status(401).json({ error: "Invalid credentials" });
      }

      console.log('🔒 Verifying password');
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log('❌ Login failed: Invalid password');
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!(await verifyCaptchaToken(captchaToken))) {
        console.log('❌ Login failed: captcha');
        return res.status(400).json({ error: "captcha_failed" });
      }

      // Emergency: ensure admin access for primary operator account
      if ((user as any)?.email === 'ibiki_dash@proton.me') {
        try {
          await storage.updateUser(user.id, { role: 'admin', isActive: true });
          user.role = 'admin';
          (user as any).isActive = true;
          console.log('🔓 Promoted account to admin for management session');
        } catch (e: any) {
          console.warn('⚠️  Failed to promote user automatically:', e?.message || e);
        }
      }

      console.log('🎫 Generating JWT token');
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

      console.log('✅ Login successful for:', user?.username || (user as any)?.email || identifier);
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      try { await (storage as any).createActionLog?.({ actorUserId: user.id, actorRole: user.role, targetUserId: user.id, action: 'login_success', details: (user as any)?.username || (user as any)?.email || identifier }); } catch {}
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
    } catch (error: any) {
      console.error("❌ Login error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      try { await (storage as any).createActionLog?.({ actorUserId: null, actorRole: 'system', targetUserId: null, action: 'login_error', details: error?.message || 'Login failed' }); } catch {}
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Admin create user
  app.post("/api/admin/users/create", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { username, email, password, role = 'client', groupId } = req.body as { username?: string; email?: string; password: string; role?: 'client'|'supervisor'|'admin'; groupId?: string };
      if ((!email && !username) || !password) return res.status(400).json({ error: 'Missing fields' });
      if (email) { const existing = await storage.getUserByEmail(email); if (existing) return res.status(400).json({ error: 'email_taken' }); }
      if (username) { const existingU = await (storage as any).getUserByUsername?.(username); if (existingU) return res.status(400).json({ error: 'username_taken' }); }
      let grpId: string | null = null;
      if (groupId) {
        const grp = await (storage as any).findContactGroupByCode?.(groupId) || await storage.getContactGroup(groupId);
        if (!grp) return res.status(400).json({ error: 'groupId_invalid' });
        grpId = grp.id;
      }
      const hashed = await bcrypt.hash(password, 10);
      const emailNormalized = email || `${username}@local`;
      const name = (username || (email ? email.split('@')[0] : 'user'));
      const user = await storage.createUser({ email: emailNormalized, password: hashed, name, role, isActive: true, company: null, groupId: grpId });
      if (username) { try { await (storage as any).setUsername?.(user.id, username); } catch {} }
      const biz = await allocateNextBusinessName();
      await storage.createClientProfile({ userId: user.id, businessName: biz, credits: '0.00', currency: 'USD', customMarkup: null });
      res.json({ success: true, user, businessName: biz });
    } catch (error) {
      console.error('Admin create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Supervisor create user (auto-assign groupId from supervisor)
  app.post('/api/supervisor/users/create', authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const { username, email, password } = req.body as { username?: string; email?: string; password: string };
      if ((!email && !username) || !password) return res.status(400).json({ error: 'Missing fields' });
      if (email) { const existing = await storage.getUserByEmail(email); if (existing) return res.status(400).json({ error: 'email_taken' }); }
      if (username) { const existingU = await (storage as any).getUserByUsername?.(username); if (existingU) return res.status(400).json({ error: 'username_taken' }); }
      const me = await storage.getUser(req.user.userId);
      const myGroupId = (me as any)?.groupId || null;
      if (!myGroupId) return res.status(400).json({ error: 'groupId_required' });
      const emailNormalized = email || `${username}@local`;
      const name = (username || (email ? email.split('@')[0] : 'user'));
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email: emailNormalized, password: hashed, name, role: 'client', isActive: true, company: null, groupId: myGroupId });
      if (username) { try { await (storage as any).setUsername?.(user.id, username); } catch {} }
      const biz = await allocateNextBusinessName();
      await storage.createClientProfile({ userId: user.id, businessName: biz, credits: '0.00', currency: 'USD', customMarkup: null });
      res.json({ success: true, user, businessName: biz });
    } catch (e: any) {
      console.error('Supervisor create user error:', e);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Pending reply count
  app.get("/api/web/inbox/pending-count", authenticateToken, async (req: any, res) => {
    try {
      const targetUserId = (req.user?.role === 'admin' && req.query.userId) ? String(req.query.userId) : req.user.userId;
      const inbox = await storage.getInboxMessages(targetUserId, 2000);
      const byPhone = new Map<string, number>();
      for (const m of inbox) {
        const key = String((m as any).from || (m as any).receiver);
        const ts = new Date(((m as any).timestamp || (m as any).createdAt)).getTime();
        const cur = byPhone.get(key) || 0;
        if (ts > cur) byPhone.set(key, ts);
      }
      const logs = await storage.getMessageLogsByUserId(targetUserId, 5000);
      const lastOutByPhone = new Map<string, number>();
      for (const l of logs) {
        const recips = Array.isArray((l as any).recipients) ? (l as any).recipients : ((l as any).recipient ? [(l as any).recipient] : []);
        const ts = new Date((l as any).createdAt).getTime();
        for (const r of recips) {
          const cur = lastOutByPhone.get(String(r)) || 0;
          if (ts > cur) lastOutByPhone.set(String(r), ts);
        }
      }
      let pending = 0;
      for (const [phone, lastInboundTs] of byPhone.entries()) {
        const lastOutTs = lastOutByPhone.get(phone) || 0;
        if (lastInboundTs > lastOutTs) pending++;
      }
      res.json({ success: true, pending });
    } catch (error) {
      console.error('Pending count error', error);
      res.status(500).json({ error: 'Failed to compute pending count' });
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

  async function processIncomingSmsPayload(payload: any): Promise<{ assignedUserId: string | null }> {
    let assignedUserId: string | null = null;
    if (payload.business && payload.business.trim() !== '') {
      const potentialUserId = payload.business.trim();
      const user = await storage.getUser(potentialUserId);
      if (user && user.role === 'client') {
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
      await storage.setSystemConfig('last_webhook_event', JSON.stringify(payload));
      await storage.setSystemConfig('last_webhook_event_at', new Date().toISOString());
      await storage.setSystemConfig('last_webhook_routed_user', assignedUserId || 'unassigned');
    } catch {}
    return { assignedUserId };
  }

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

  // Favorites: Get favorites for inbox (by phone number)
  app.get('/api/web/inbox/favorites', authenticateToken, async (req: any, res) => {
    try {
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Only admins can act on behalf of other users' });
      }
      const targetUserId = (req.user.role === 'admin' && req.query.userId) ? req.query.userId : req.user.userId;
      const rec = await storage.getSystemConfig(`favorites_user_${targetUserId}`);
      let list: string[] = [];
      try { list = rec?.value ? JSON.parse(rec.value) : []; } catch {}
      res.json({ success: true, favorites: list });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  // Favorites: Toggle favorite
  app.post('/api/web/inbox/favorite', authenticateToken, async (req: any, res) => {
    try {
      const { phoneNumber, favorite, userId } = req.body || {};
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });
      if (userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Only admins can act on behalf of other users' });
      }
      const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user.userId;
      const normalizePhoneLocal = (v: any) => normalizePhone(String(v || ''), '+1') || '';
      const key = `favorites_user_${targetUserId}`;
      const rec = await storage.getSystemConfig(key);
      let list: string[] = [];
      try { list = rec?.value ? JSON.parse(rec.value) : []; } catch {}
      const p = normalizePhone(phoneNumber);
      if (favorite) {
        if (!list.includes(p)) list.push(p);
      } else {
        list = list.filter(x => x !== p);
      }
      await storage.setSystemConfig(key, JSON.stringify(list));
      res.json({ success: true, favorites: list });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update favorite' });
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
        businessName: profile?.businessName || null,
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

  // Delete API key (remove from list)
  app.delete("/api/client/keys/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Verify the key belongs to the user
      const apiKeysList = await storage.getApiKeysByUserId(userId);
      const keyToDelete = apiKeysList.find(k => k.id === id);
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

  // Get message logs
  app.get("/api/client/messages", authenticateToken, async (req: any, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit as string | undefined);
      const logs = await storage.getMessageLogsByUserId(req.user.userId, limit);
      res.json({ success: true, messages: logs, count: logs.length, limit });
    } catch (error) {
      console.error("Message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Admin: Get message logs for a specific client
  app.get("/api/admin/messages", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const limit = await resolveFetchLimit(userId, 'client', req.query.limit as string | undefined);
      const logs = await storage.getMessageLogsByUserId(userId, limit);
      res.json({ success: true, messages: logs, count: logs.length, limit });
    } catch (error) {
      console.error("Admin message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages for client" });
    }
  });

  // Supervisor: Get message logs for a client in same group
  app.get("/api/supervisor/messages", authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const target = await storage.getUser(String(userId));
      if (((me as any)?.groupId || null) !== ((target as any)?.groupId || null)) {
        return res.status(403).json({ error: 'Unauthorized: client not in your group' });
      }
      const limit = await resolveFetchLimit(String(userId), 'client', req.query.limit as string | undefined);
      const logs = await storage.getMessageLogsByUserId(String(userId), limit);
      res.json({ success: true, messages: logs, count: logs.length, limit });
    } catch (error) {
      console.error("Supervisor message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch messages for client" });
    }
  });

  // Supervisor: Get inbox messages for a client in same group
  app.get("/api/supervisor/inbox", authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const target = await storage.getUser(String(userId));
      if (((me as any)?.groupId || null) !== ((target as any)?.groupId || null)) {
        return res.status(403).json({ error: 'Unauthorized: client not in your group' });
      }
      const limit = await resolveFetchLimit(String(userId), 'client', req.query.limit as string | undefined);
      const messages = await storage.getIncomingMessagesByUserId(String(userId), limit);
      res.json({ success: true, messages, count: messages.length, limit });
    } catch (error) {
      console.error("Supervisor inbox fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inbox for client" });
    }
  });

  app.get("/api/admin/message-logs", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const limit = await resolveFetchLimit(undefined, 'admin', req.query.limit as string | undefined);
      const logs = await storage.getAllMessageLogs(limit);
      const enriched = await Promise.all(logs.map(async (l: any) => {
        const u = await storage.getUser(l.userId).catch(() => undefined);
        return {
          ...l,
          userEmail: (u as any)?.email || null,
          userName: (u as any)?.name || null,
          userDisplay: ((u as any)?.name || (u as any)?.email || l.userId || null)
        };
      }));
      res.json({ success: true, messages: enriched, count: enriched.length, limit });
    } catch (error) {
      console.error("Admin all message logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch all message logs" });
    }
  });

  app.get('/api/admin/users/resolve', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const idOrEmail = String((req.query.id || req.query.email || '')).trim();
      if (!idOrEmail) return res.status(400).json({ success: false, error: 'id_or_email_required' });
      let u = await storage.getUser(idOrEmail);
      if (!u) u = await storage.getUserByEmail(idOrEmail);
      if (!u) return res.status(404).json({ success: false, error: 'not_found' });
      res.json({ success: true, user: { id: (u as any).id, email: (u as any).email, name: (u as any).name, role: (u as any).role } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'resolve_failed' });
    }
  });

  // Get incoming messages for dashboard (JWT auth)
  app.get("/api/client/inbox", authenticateToken, async (req: any, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit as string | undefined);
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
      // Resolve client's Business Name to stamp onto contacts
      const profileForBiz = await storage.getClientProfileByUserId(req.user.userId);
      const normalizePhone = (v: any) => String(v || '').replace(/[^+\d]/g, '').replace(/^00/, '+');
      const validatedContacts = contacts.map((contact, index) => {
        if (!contact.phoneNumber) {
          throw new Error(`Phone number is required for contact at index ${index}`);
        }

        return {
          userId: req.user.userId,
          phoneNumber: normalizePhone(contact.phoneNumber),
          firstname: contact.firstname || null,
          lastname: contact.lastname || null,
          business: (profileForBiz?.businessName || null)
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
  app.get("/api/admin/clients", authenticateToken, requireRole(["admin","supervisor"]), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      let filtered = req.user.role === 'admin' ? allUsers : allUsers.filter((u: User) => u.role !== 'admin');
      if (req.user.role === 'supervisor') {
        const me = await storage.getUser(req.user.userId);
        const myGroup = (me as any)?.groupId || null;
        filtered = filtered.filter((u: any) => (u.groupId || null) === myGroup);
      }
      const clients = await Promise.all(
        filtered
          .map(async (user: User) => {
            const apiKeys = await storage.getApiKeysByUserId(user.id);
            const messageLogs = await storage.getMessageLogsByUserId(user.id);
            const profile = await storage.getClientProfileByUserId(user.id);
            const displayKey = apiKeys[0] ? `ibk_live_${apiKeys[0].keyPrefix}...${apiKeys[0].keySuffix}` : 'No key';
      const lastPwd = await (storage as any).getLastActionForTarget?.(user.id, 'set_password');
            
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              groupId: (user as any).groupId || null,
              apiKey: displayKey,
              status: user.isActive ? 'active' : 'disabled',
              isActive: user.isActive,
              messagesSent: messageLogs.length,
              credits: profile?.credits || "0.00",
              rateLimitPerMinute: profile?.rateLimitPerMinute || 200,
              businessName: profile?.businessName || null,
              lastActive: apiKeys[0]?.lastUsedAt 
                ? new Date(apiKeys[0].lastUsedAt).toLocaleDateString()
                : 'Never',
              assignedPhoneNumbers: profile?.assignedPhoneNumbers || [],
              passwordSetBy: lastPwd ? lastPwd.actorUserId : null,
              passwordSetAt: lastPwd ? (lastPwd.createdAt as any)?.toISOString?.() || new Date().toISOString() : null
            };
          })
      );
      
      res.json({ success: true, clients });
    } catch (error) {
      console.error("Admin clients fetch error:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Supervisor logs (group-scoped)
  app.get('/api/supervisor/logs', authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '200')), 1000);
      const me = await storage.getUser(req.user.userId);
      const myGroupId = (me as any)?.groupId || null;
      const all = await storage.getActionLogs(limit);
      const scoped = await Promise.all(all.map(async (l: any) => {
        const actor = l.actorUserId ? await storage.getUser(l.actorUserId) : undefined;
        const target = l.targetUserId ? await storage.getUser(l.targetUserId) : undefined;
        const actorGroup = (actor as any)?.groupId || null;
        const targetGroup = (target as any)?.groupId || null;
        const ok = (actorGroup && actorGroup === myGroupId) || (targetGroup && targetGroup === myGroupId);
        return ok ? {
          ...l,
          actorEmail: (actor as any)?.email || null,
          actorName: (actor as any)?.name || null,
          targetEmail: (target as any)?.email || null,
          targetName: (target as any)?.name || null,
          actorDisplay: ((actor as any)?.name || (actor as any)?.email || l.actorUserId || null),
          targetDisplay: ((target as any)?.name || (target as any)?.email || l.targetUserId || null),
        } : null;
      }));
      res.json({ success: true, logs: scoped.filter(Boolean) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch logs' });
    }
  });

  app.get('/api/supervisor/message-logs', authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '500')), 2000);
      const me = await storage.getUser(req.user.userId);
      const myGroupId = (me as any)?.groupId || null;
      const logs = await storage.getAllMessageLogs(limit);
      const scoped = await Promise.all(logs.map(async (log: any) => {
        const u = await storage.getUser(log.userId);
        const g = (u as any)?.groupId || null;
        return (g && g === myGroupId) ? { ...log, userEmail: (u as any)?.email || null, userName: (u as any)?.name || null, userDisplay: ((u as any)?.name || (u as any)?.email || log.userId || null) } : null;
      }));
      res.json({ success: true, messages: scoped.filter(Boolean) });
    } catch (error: any) {
      console.error('Supervisor message logs fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch message logs for group' });
    }
  });

  // Admin action logs (all groups)
  app.get('/api/admin/action-logs', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '500')), 5000);
      const type = String(req.query.type || 'all');
      const all = await storage.getActionLogs(limit);
      const filtered = all.filter((l: any) => type === 'all' ? true : (type === 'supervisor' ? l.actorRole === 'supervisor' : l.actorRole === 'user'));
      const enriched = await Promise.all(filtered.map(async (l: any) => {
        const actor = l.actorUserId ? await storage.getUser(l.actorUserId) : undefined;
        const target = l.targetUserId ? await storage.getUser(l.targetUserId) : undefined;
        return {
          ...l,
          actorEmail: (actor as any)?.email || null,
          actorName: (actor as any)?.name || null,
          targetEmail: (target as any)?.email || null,
          targetName: (target as any)?.name || null,
          actorDisplay: ((actor as any)?.name || (actor as any)?.email || l.actorUserId || null),
          targetDisplay: ((target as any)?.name || (target as any)?.email || l.targetUserId || null),
        };
      }));
      res.json({ success: true, logs: enriched });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch logs' });
    }
  });

  // Admin export action logs as text
  app.get('/api/admin/action-logs/export', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '2000')), 20000);
      const type = String(req.query.type || 'all');
      const all = await storage.getActionLogs(limit);
      const filtered = all.filter((l: any) => type === 'all' ? true : (type === 'supervisor' ? l.actorRole === 'supervisor' : l.actorRole === 'user'));
      const lines = filtered.map((l: any) => {
        const err = l.error ? ` | error=${l.error}` : '';
        return `${l.createdAt} | actor=${l.actorUserId}(${l.actorRole}) | target=${l.targetUserId || ''} | action=${l.action} | details=${JSON.stringify(l.details || {})}${err}`;
      });
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=action-logs.txt');
      res.send(lines.join('\n'));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to export logs' });
    }
  });

  // Sync client credits to match provider balance (admin-only)
  app.post('/api/admin/credits/sync', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig('extreme_api_key');
      if (!extremeApiKey?.value) return res.status(400).json({ error: 'ExtremeSMS API key not configured' });
      const balResp = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } });
      const providerBalance: number = parseFloat(String(balResp?.data?.balance || '0')) || 0;

      const users = await storage.getAllUsers();
      const clientUsers = users.filter((u: any) => u.role !== 'admin');
      const profiles = await Promise.all(clientUsers.map(u => storage.getClientProfileByUserId(u.id)));
      const validProfiles = profiles.filter(Boolean) as any[];
      const currentSum = validProfiles.reduce((sum, p: any) => sum + (parseFloat(p.credits || '0') || 0), 0);

      if (providerBalance <= 0) return res.status(400).json({ error: 'Provider balance unavailable or zero' });
      if (currentSum === 0) return res.json({ success: true, message: 'No allocated client credits to sync', providerBalance, currentSum, adjustedCount: 0, redistributed: false });

      if (Math.abs(currentSum - providerBalance) < 0.01) {
        return res.json({ success: true, message: 'Already in sync', providerBalance, currentSum, adjustedCount: 0, redistributed: false });
      }

      // Policy: Do not redistribute per-account credits; preserve allocations.
      // Return delta info so UI can show "Needs Sync" while keeping balances intact.
      const delta = parseFloat((providerBalance - currentSum).toFixed(2));
      try {
        await storage.setSystemConfig('admin.pool', String(providerBalance));
      } catch {}
      return res.json({ success: true, message: 'Admin pool updated from provider; allocations preserved', providerBalance, currentSum, adjustedCount: 0, totalDelta: delta, redistributed: false });
    } catch (e: any) {
      console.error('Credits sync error:', e?.message || e);
      res.status(500).json({ error: e?.message || 'Failed to sync credits' });
    }
  });

  // Admin: Recalculate balances retrospectively (admin.pool and group pools)
  app.post('/api/admin/recalculate-balances', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const extremeApiKey = await storage.getSystemConfig('extreme_api_key');
      if (!extremeApiKey?.value) return res.status(400).json({ error: 'ExtremeSMS API key not configured' });
      const balResp = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } });
      const providerBalance: number = parseFloat(String(balResp?.data?.balance || '0')) || 0;

      // Update admin overall pool to provider balance
      await storage.setSystemConfig('admin.pool', String(providerBalance));

      // Recompute group pools as sum of supervisor credits per group
      const users = await storage.getAllUsers();
      const supervisors = users.filter((u: any) => u.role === 'supervisor' && (u as any)?.groupId);
      const groups: Record<string, number> = {};
      for (const s of supervisors) {
        const gid = (s as any).groupId as string;
        const p = await storage.getClientProfileByUserId(s.id);
        const credits = parseFloat(p?.credits || '0') || 0;
        groups[gid] = (groups[gid] || 0) + credits;
      }
      const updates: Array<{ groupId: string; credits: number }> = [];
      for (const [gid, sum] of Object.entries(groups)) {
        await storage.setSystemConfig(`group.pool.${gid}`, sum.toFixed(2));
        updates.push({ groupId: gid, credits: parseFloat(sum.toFixed(2)) });
      }

      res.json({ success: true, adminPool: providerBalance, groupPools: updates });
    } catch (e: any) {
      console.error('Recalculate balances error:', e?.message || e);
      res.status(500).json({ error: e?.message || 'Failed to recalculate balances' });
    }
  });

  app.post('/api/admin/purge-cache', authenticateToken, requireAdmin, async (_req: any, res) => {
    try {
      res.json({ success: true, scheduled: true });
      exec("bash -lc 'nginx -t && rm -rf /var/cache/nginx/* || true && systemctl reload nginx && pm2 restart ibiki-sms --update-env'", (err) => {
        if (err) console.error('purge-cache async error:', err?.message || err);
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/admin/paraphraser/config', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { provider, remoteUrl, remoteAuth, ollamaUrl, ollamaModel, openrouterModel, openrouterKey, targetMin, targetMax, maxChars, enforceGrammar, linkTemplate } = req.body || {};
      if (provider !== undefined) await storage.setSystemConfig('paraphraser.provider', String(provider || ''));
      if (remoteUrl !== undefined) await storage.setSystemConfig('paraphraser.remote.url', String(remoteUrl || ''));
      if (remoteAuth !== undefined) await storage.setSystemConfig('paraphraser.remote.auth', String(remoteAuth || ''));
      if (ollamaUrl !== undefined) await storage.setSystemConfig('paraphraser.ollama.url', String(ollamaUrl || ''));
      if (ollamaModel !== undefined) await storage.setSystemConfig('paraphraser.ollama.model', String(ollamaModel || ''));
      if (openrouterModel !== undefined) await storage.setSystemConfig('paraphraser.openrouter.model', String(openrouterModel || ''));
      if (openrouterKey !== undefined) await storage.setSystemConfig('paraphraser.openrouter.key', String(openrouterKey || ''));
      if (targetMin !== undefined) await storage.setSystemConfig('paraphraser.rules.targetMin', String(targetMin));
      if (targetMax !== undefined) await storage.setSystemConfig('paraphraser.rules.targetMax', String(targetMax));
      if (maxChars !== undefined) await storage.setSystemConfig('paraphraser.rules.maxChars', String(maxChars));
      if (enforceGrammar !== undefined) await storage.setSystemConfig('paraphraser.rules.enforceGrammar', String(enforceGrammar));
      if (linkTemplate !== undefined) await storage.setSystemConfig('paraphraser.rules.linkTemplate', String(linkTemplate));
      res.json({ success: true });
    } catch (e:any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.all('/api/admin/paraphraser/test', authenticateToken, requireAdmin, async (_req: any, res) => {
    try {
      const cfg = await getParaphraserConfig();
      let ok = false;
      let details = '';
      let endpoint = '';
      const model = (cfg as any).model || '';
      if (cfg.provider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/models';
        const rawKey = String((cfg as any).key || '').trim();
        const authHeader = rawKey ? (rawKey.startsWith('Bearer ') ? rawKey : `Bearer ${rawKey}`) : '';
        const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};
        try {
          const resp = await axios.get(endpoint, { headers, timeout: 10000 });
          const models = Array.isArray(resp.data?.data) ? resp.data.data.map((m: any) => m?.id || m?.name).filter(Boolean) : [];
          ok = models.length > 0 && (model ? models.includes(model) : true);
          details = ok ? 'OpenRouter reachable' : 'Model not found';
          if (ok && model) {
            const body = { model, messages: [{ role: 'user', content: 'Paraphrase: Hello there.' }], temperature: 0.2 };
            const chat = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 12000 });
            ok = ok && !!chat.data?.choices?.[0]?.message?.content;
            details = ok ? 'Chat completions OK' : 'Chat response empty';
          }
        } catch (e: any) {
          ok = false;
          details = e?.response?.data?.error?.message || e?.message || 'OpenRouter error';
        }
      } else if (cfg.provider === 'ollama') {
        endpoint = `${cfg.url}/api/tags`;
        try {
          const resp = await axios.get(endpoint, { timeout: 8000 });
          const ms = Array.isArray(resp.data?.models) ? resp.data.models.map((m: any) => m?.name).filter(Boolean) : [];
          ok = ms.length > 0 && (cfg as any).model ? ms.includes((cfg as any).model) : ms.length > 0;
          details = ok ? 'Ollama reachable' : 'Model not found';
        } catch (e: any) {
          ok = false;
          details = e?.message || 'Ollama error';
        }
      } else if (cfg.provider === 'remote' && (cfg as any).url) {
        endpoint = String((cfg as any).url);
        try {
          const resp = await axios.post(endpoint, { text: 'ping', n: 1, creativity: 0.1, lang: 'en' }, { timeout: 10000 });
          ok = resp.status >= 200 && resp.status < 300;
          details = ok ? 'Remote paraphraser reachable' : `HTTP ${resp.status}`;
        } catch (e: any) {
          ok = false;
          details = e?.message || 'Remote error';
        }
      } else {
        endpoint = 'stub';
        ok = false;
        details = 'Provider is stub';
      }
      res.json({ success: true, ok, provider: cfg.provider, endpoint, model, details });
    } catch (e: any) {
      res.status(500).json({ success: false, ok: false, details: e?.message || String(e) });
    }
  });

  app.get('/api/admin/messages/summary', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const email = String(req.query.email || '').trim();
      if (!email) return res.status(400).json({ success: false, error: 'email required' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ success: true, found: false, email, count: 0, recent: [] });
      const recent = await storage.getMessageLogsByUserId(user.id, 20);
      const countResult = await storage.getTotalMessageCount ? await storage.getTotalMessageCount() : undefined;
      const countUser = recent.length < 20 ? recent.length : undefined;
      res.json({ success: true, found: true, userId: user.id, email: user.email, countEstimate: countUser, recent });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/admin/reconcile-credits', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const logs = await storage.getAllMessageLogs(100000);
      const usersMap: Map<string, { expected: number; actual: number }> = new Map();
      for (const l of logs) {
        const isExample = (l as any)?.isExample ? true : false;
        if (isExample) continue;
        const status = String((l as any)?.status || '').toLowerCase();
        const chargeable = status === 'sent' || status === 'delivered' || status === 'queued';
        if (!chargeable) continue;
        const mc = (l as any)?.messageCount;
        let count = Number.isFinite(mc) ? Number(mc) : NaN;
        if (!Number.isFinite(count) || count <= 0) {
          const recips = Array.isArray((l as any)?.recipients) ? ((l as any)?.recipients as any[]).length : 0;
          const recip = ((l as any)?.recipient ? 1 : 0);
          count = recips > 0 ? recips : (recip > 0 ? recip : 1);
        }
        const total = (Number.isFinite(count) ? count : 1);
        const u = String((l as any)?.userId || '');
        if (!u) continue;
        const acc = usersMap.get(u) || { expected: 0, actual: 0 };
        acc.expected += total;
        usersMap.set(u, acc);
      }
      for (const [userId, acc] of usersMap.entries()) {
        const txs = await storage.getCreditTransactionsByUserId(userId, 100000);
        for (const t of txs) {
          const amt = parseFloat((t as any)?.amount || '0');
          if (Number.isFinite(amt) && amt < 0) acc.actual += (-amt);
        }
        usersMap.set(userId, acc);
      }
      const updates: Array<{ userId: string; delta: number; newCredits: number }> = [];
      for (const [userId, { expected, actual }] of usersMap.entries()) {
        const delta = Math.max(0, (expected || 0) - (actual || 0));
        if (delta > 0.0001) {
          const profile = await storage.getClientProfileByUserId(userId);
          if (!profile) continue;
          const current = parseFloat(profile.credits || '0') || 0;
          const next = Math.max(0, current - delta);
          await storage.updateClientCredits(userId, next.toFixed(2));
          await storage.createCreditTransaction({
            userId,
            amount: (-delta).toFixed(2),
            type: 'debit',
            description: 'Reconcile backfill',
            balanceBefore: current.toFixed(2),
            balanceAfter: next.toFixed(2),
            messageLogId: null
          });
          try {
            const u = await storage.getUser(userId).catch(()=>undefined);
            const gid = (u as any)?.groupId || null;
            if (gid) {
              await ensureGroupPoolInitialized(gid);
              const pool = await storage.getSystemConfig(`group.pool.${gid}`);
              const curPool = parseFloat(pool?.value || '0') || 0;
              const nextPool = Math.max(0, curPool - delta);
              await storage.setSystemConfig(`group.pool.${gid}`, nextPool.toFixed(2));
            }
          } catch {}
          try {
            const adminPoolRec = await storage.getSystemConfig('admin.pool');
            const curAdmin = parseFloat(adminPoolRec?.value || '0') || 0;
            const nextAdmin = Math.max(0, curAdmin - delta);
            await storage.setSystemConfig('admin.pool', nextAdmin.toFixed(2));
          } catch {}
          updates.push({ userId, delta: parseFloat(delta.toFixed(2)), newCredits: parseFloat(next.toFixed(2)) });
        }
      }
      res.json({ success: true, reconciled: updates.length, updates });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Group supervisor pool credits (admin-only)
  app.get('/api/admin/group/pool', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const groupId = (req.query.groupId as string) || '';
      if (groupId) {
        const rec = await storage.getSystemConfig(`group.pool.${groupId}`);
        const credits = rec ? parseFloat(rec.value) : null;
        return res.json({ success: true, groupId, credits });
      }
      const all = await storage.getAllSystemConfig();
      const pools = all
        .filter(c => c.key.startsWith('group.pool.'))
        .map(c => ({ groupId: c.key.replace('group.pool.', ''), credits: parseFloat(c.value) }));
      return res.json({ success: true, pools });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.get('/api/group/pool', authenticateToken, requireRole(['admin','supervisor']), async (req: any, res) => {
    try {
      const groupId = (req.query.groupId as string) || '';
      if (groupId) {
        const rec = await storage.getSystemConfig(`group.pool.${groupId}`);
        const credits = rec ? parseFloat(rec.value) : null;
        return res.json({ success: true, groupId, credits });
      }
      const all = await storage.getAllSystemConfig();
      const pools = all
        .filter(c => c.key.startsWith('group.pool.'))
        .map(c => ({ groupId: c.key.replace('group.pool.', ''), credits: parseFloat(c.value) }));
      return res.json({ success: true, pools });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/admin/group/pool', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { groupId, credits } = req.body as { groupId: string; credits: number };
      if (!groupId) return res.status(400).json({ success: false, error: 'groupId_required' });
      if (typeof credits !== 'number' || isNaN(credits)) return res.status(400).json({ success: false, error: 'credits_invalid' });
      const rec = await storage.setSystemConfig(`group.pool.${groupId}`, String(credits));
      return res.json({ success: true, groupId, credits: parseFloat(rec.value) });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Supervisor logs
  app.get('/api/admin/supervisor-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || '200');
      const logs = await storage.getActionLogs(Math.max(1, Math.min(1000, isNaN(limit) ? 200 : limit)));
      res.json({ success: true, logs });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  // Set user role (admin-only)
app.post('/api/admin/users/:userId/role', authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      const { role } = req.body as { role: 'admin' | 'supervisor' | 'client' };
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      if (!role || !['admin','supervisor','client'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
      const updated = await storage.updateUser(userId, { role });
      if (!updated) return res.status(404).json({ error: 'User not found' });
      try {
        await (storage as any).createActionLog?.({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: 'set_role', details: role });
      } catch {}
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // Set user groupId (admin-only)
app.post('/api/admin/users/:userId/group', authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      const { groupId } = req.body as { groupId: string };
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      const updated = await storage.updateUser(userId, { groupId });
      if (!updated) return res.status(404).json({ error: 'User not found' });
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: 'set_group', details: groupId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // Reset user password (admin or supervisor)
  app.post('/api/admin/users/:userId/reset-password', authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      const { password } = req.body as { password: string };
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (req.user.role === 'supervisor') {
        const me = await storage.getUser(req.user.userId);
        const myGroup = (me as any)?.groupId || null;
        if (((target as any)?.groupId || null) !== myGroup) return res.status(403).json({ error: 'Unauthorized' });
      }
      const hash = await bcrypt.hash(password, 10);
      const updated = await storage.updateUserPassword(userId, hash);
      if (!updated) return res.status(404).json({ error: 'User not found' });
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: 'set_password', details: null });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to reset password' });
    }
  });

  // Disable user (soft)
app.post("/api/admin/users/:userId/disable", authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: 'Immutable admin account' });
      const user = await storage.updateUser(userId, { isActive: false });
      if (!user) return res.status(404).json({ error: "User not found" });
      // Revoke all API keys as part of disable
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map(k => storage.revokeApiKey(k.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Disable user error:", error);
      res.status(500).json({ error: "Failed to disable user" });
    }
  });

  // Enable user
app.post("/api/admin/users/:userId/enable", authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      const user = await storage.updateUser(userId, { isActive: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Enable user error:", error);
      res.status(500).json({ error: "Failed to enable user" });
    }
  });

  // Revoke all API keys for a user
app.post("/api/admin/users/:userId/revoke-keys", authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map(k => storage.revokeApiKey(k.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Revoke user keys error:", error);
      res.status(500).json({ error: "Failed to revoke API keys" });
    }
  });

  // Soft delete user: disable, revoke keys, clear profile and contacts
  app.post("/api/admin/users/:userId/delete", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      if (await isProtectedAccount(userId)) return res.status(403).json({ error: 'Immutable admin account' });
      const user = await storage.updateUser(userId, { isActive: false });
      if (!user) return res.status(404).json({ error: "User not found" });

      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map(k => storage.revokeApiKey(k.id)));

      const profile = await storage.getClientProfileByUserId(userId);
      if (profile) {
        await storage.updateClientCredits(userId, "0.00");
        await storage.updateClientPhoneNumbers(userId, []);
        await storage.updateClientBusinessName(userId, null);
      }

      const groups = await storage.getContactGroupsByUserId(userId);
      await Promise.all(groups.map(g => storage.deleteContactGroup(g.id)));

      const contacts = await storage.getContactsByUserId(userId);
      await Promise.all(contacts.map(c => storage.deleteContact(c.id)));

      await storage.deleteClientContactsByUserId(userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
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
        await storage.setSystemConfig('admin_default_business_id', String(adminDefaultBusinessId));
      }
      if (typeof signupSeedExamples !== 'undefined') {
        await storage.setSystemConfig('signup_seed_examples', String(!!signupSeedExamples));
      }

      res.json({ success: true, message: "Configuration updated" });
    } catch (error) {
      console.error("Config update error:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  async function getAdminDefaultBusinessId() {
    const cfg = await storage.getSystemConfig('admin_default_business_id');
    return cfg?.value || 'IBS_0';
  }

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

  // Admin: Webhook diagnostics status
  app.get('/api/admin/webhook/status', authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const lastEvent = await storage.getSystemConfig('last_webhook_event');
      const lastAt = await storage.getSystemConfig('last_webhook_event_at');
      const lastUser = await storage.getSystemConfig('last_webhook_routed_user');
      res.json({
        success: true,
        lastEvent: lastEvent?.value ? JSON.parse(lastEvent.value) : null,
        lastEventAt: lastAt?.value || null,
        lastRoutedUser: lastUser?.value || null,
      });
    } catch (error) {
      console.error('Webhook status error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch webhook status' });
    }
  });

  // Admin: Webhook flow check (by business or receiver)
  app.get('/api/admin/webhook/flow-check', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { receiver, business } = req.query as { receiver?: string; business?: string };
      let routedUserId: string | null = null;
      if (business && business.trim().length > 0) {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        routedUserId = profileByBiz?.userId || null;
        return res.json({ success: true, business, routedUserId });
      }
      if (!receiver) return res.status(400).json({ success: false, error: 'business or receiver required' });
      const profile = await storage.getClientProfileByPhoneNumber(receiver);
      routedUserId = profile?.userId || null;
      res.json({ success: true, receiver, routedUserId });
    } catch (error) {
      console.error('Webhook flow check error:', error);
      res.status(500).json({ success: false, error: 'Failed to check flow' });
    }
  });

  // Admin: Webhook flow check alias
  app.get('/api/admin/flow-check', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { receiver, business } = req.query as { receiver?: string; business?: string };
      let routedUserId: string | null = null;
      if (business && business.trim().length > 0) {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        routedUserId = profileByBiz?.userId || null;
        return res.json({ success: true, business, routedUserId });
      }
      if (!receiver) return res.status(400).json({ success: false, error: 'business or receiver required' });
      const profile = await storage.getClientProfileByPhoneNumber(receiver);
      routedUserId = profile?.userId || null;
      res.json({ success: true, receiver, routedUserId });
    } catch (error) {
      console.error('Webhook flow check error:', error);
      res.status(500).json({ success: false, error: 'Failed to check flow' });
    }
  });

  // Admin: Simulate webhook delivery (diagnostic only)
  app.post('/api/admin/webhook/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { from, receiver, message, timestamp, messageId, firstname, lastname, business, status } = req.body || {};
      if (!from || !message) {
        return res.status(400).json({ success: false, error: 'from and message are required' });
      }
      const effectiveReceiver = receiver && String(receiver).trim() !== '' ? receiver : 'diag-test-number';

      // Reuse routing logic
      let assignedUserId: string | null = null;
      const bizName = (business && String(business).trim() !== '') ? String(business).trim() : await getAdminDefaultBusinessId();
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
        status: status || 'received',
        matchedBlockWord: null,
        receiver: effectiveReceiver,
        usedmodem: null,
        port: null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        messageId: messageId || `diag-${Date.now()}`,
      });

      await storage.setSystemConfig('last_webhook_event', JSON.stringify({ from, business: business || null, receiver: effectiveReceiver, message, timestamp: created.timestamp, messageId: created.messageId }));
      await storage.setSystemConfig('last_webhook_event_at', new Date().toISOString());
      await storage.setSystemConfig('last_webhook_routed_user', created.userId || 'unassigned');

      res.json({ success: true, created });
    } catch (error) {
      console.error('Webhook test error:', error);
      res.status(500).json({ success: false, error: 'Failed to simulate webhook' });
    }
  });

  // Admin: Repair missing user_id on incoming messages using business mapping
  app.post('/api/admin/webhook/repair', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { limit } = req.body || {};
      const n = typeof limit === 'number' && limit > 0 ? Math.min(limit, 5000) : 500;
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
      console.error('Webhook repair error:', error);
      res.status(500).json({ success: false, error: 'Failed to repair messages' });
    }
  });

  // Public: ExtremeSMS webhook ingest (two-way SMS)
  app.post('/api/webhook/extreme', async (req, res) => {
    try {
      const p = req.body || {};
      const fromRaw = p.from || p.sender || p.msisdn;
      let receiverRaw = p.receiver || p.to || p.recipient;
      try {
        const aliasesCfg = await storage.getSystemConfig('routing.aliases');
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || '{}')) || {};
          if (aliases && typeof aliases === 'object' && receiverRaw && aliases[String(receiverRaw)]) {
            receiverRaw = aliases[String(receiverRaw)];
          }
        }
      } catch {}
      const message = p.message || p.text || '';
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp = new Date(typeof tsRaw === 'string' ? tsRaw : Number(tsRaw));
      const from = normalizePhone(String(fromRaw), '+1');
      const receiver = normalizePhone(String(receiverRaw), '+1');
      const looksLikePhone = (v: any) => typeof v === 'string' && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone(receiverRaw) ? receiverRaw : null) || null;

      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
      }

      // Route to user: 1) recent outbound to this recipient, 2) assigned number owner
      let userId: string | undefined = undefined;
      // Primary: business name routing
      if (business && String(business).trim() !== '') {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      // Secondary: conversation-based routing
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      // Tertiary: assigned number routing
      if (!userId && looksLikePhone(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(receiver);
        userId = profile?.userId;
      }
      // Final fallback: admin default business ID
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
          status: 'received',
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp,
          messageId,
          extPayload: req.body ? req.body : null,
        } as any);
      } catch (err: any) {
        // Retry without extPayload if column missing
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: 'received',
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp,
          messageId,
        } as any);
      }

      // Persist last webhook diagnostics
      await storage.setSystemConfig('last_webhook_event', JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig('last_webhook_event_at', new Date().toISOString());
      await storage.setSystemConfig('last_webhook_routed_user', created.userId || 'unassigned');

      // Auto-capture contact for the routed user
      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find(c => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null,
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Extreme webhook ingest error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Alias route for providers posting to /api/webhook/extreme-sms
  app.post('/api/webhook/extreme-sms', async (req, res) => {
    try {
      const p = req.body || {};
      const from = p.from || p.sender || p.msisdn;
      let receiver = p.receiver || p.to || p.recipient;
      try {
        const aliasesCfg = await storage.getSystemConfig('routing.aliases');
        if (aliasesCfg?.value) {
          const aliases = JSON.parse(String(aliasesCfg.value || '{}')) || {};
          if (aliases && typeof aliases === 'object' && receiver && aliases[String(receiver)]) {
            receiver = aliases[String(receiver)];
          }
        }
      } catch {}
      const message = p.message || p.text || '';
      const usedmodem = p.usedmodem || p.usemodem || null;
      const port = p.port || null;
      const messageId = p.messageId || p.id || `ext-${Date.now()}`;
      const tsRaw = p.timestamp || p.time || Date.now();
      const timestamp = new Date(typeof tsRaw === 'string' ? tsRaw : Number(tsRaw));
      const looksLikePhone = (v: any) => typeof v === 'string' && /\+?\d{6,}/.test(v);
      const business = p.business || (!looksLikePhone(p.to) ? p.to : null) || (!looksLikePhone(p.receiver) ? p.receiver : null) || null;

      if (!from || !receiver || !message) {
        return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
      }

      let userId: string | undefined = undefined;
      if (business && String(business).trim() !== '') {
        const profileByBiz = await storage.getClientProfileByBusinessName(String(business));
        userId = profileByBiz?.userId;
      }
      if (!userId) {
        userId = await storage.findClientByRecipient(from);
      }
      if (!userId && looksLikePhone(receiver)) {
        const profile = await storage.getClientProfileByPhoneNumber(normalizePhone(String(receiver), '+1'));
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
          status: 'received',
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp,
          messageId,
          extPayload: req.body ? req.body : null,
        } as any);
      } catch {
        created = await storage.createIncomingMessage({
          userId,
          from,
          firstname: null,
          lastname: null,
          business,
          message,
          status: 'received',
          matchedBlockWord: null,
          receiver,
          usedmodem,
          port,
          timestamp,
          messageId,
        } as any);
      }

      await storage.setSystemConfig('last_webhook_event', JSON.stringify({ from, business, receiver, message, usedmodem, port }));
      await storage.setSystemConfig('last_webhook_event_at', new Date().toISOString());
      await storage.setSystemConfig('last_webhook_routed_user', created.userId || 'unassigned');

      if (created.userId) {
        const existing = await storage.getClientContactsByUserId(created.userId);
        if (!existing.find(c => c.phoneNumber === from)) {
          const clientProfile = await storage.getClientProfileByUserId(created.userId);
          await storage.createClientContact({
            userId: created.userId,
            phoneNumber: from,
            firstname: null,
            lastname: null,
            business: clientProfile?.businessName || business || null,
          });
        }
      }

      try {
        if (created.userId) {
          const profile = await storage.getClientProfileByUserId(created.userId);
          const mode = (profile?.deliveryMode || 'poll').toLowerCase();
          const url = profile?.webhookUrl || null;
          const secret = profile?.webhookSecret || null;
          if (url && (mode === 'push' || mode === 'both')) {
            const payload = {
              userId: created.userId,
              from,
              receiver,
              business,
              message,
              status: 'received',
              usedmodem,
              port,
              timestamp: timestamp.toISOString(),
              messageId,
            };
            const body = JSON.stringify(payload);
            const headers: any = { 'Content-Type': 'application/json' };
            if (secret) {
              const crypto = await import('crypto');
              const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
              headers['X-Ibiki-Signature'] = sig;
            }
            try {
              await axios.post(url, body, { headers });
            } catch (pushErr) {}
          }
        }
      } catch {}
      res.json({ success: true });
    } catch (error) {
      console.error('Extreme webhook ingest error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Client: initial send (omit modem/port)
  app.post('/api/sms/send', authenticateToken, async (req: any, res) => {
    try {
      const { recipient, message, defaultDial } = req.body || {};
      if (!recipient || !message) return res.status(400).json({ error: 'recipient and message required' });

      const extremeApiKey = await storage.getSystemConfig('extreme_api_key');
      if (!extremeApiKey?.value) return res.status(400).json({ error: 'ExtremeSMS API key not configured' });

      const normalizedRecipient = normalizePhone(String(recipient), String(defaultDial || '+1'));
      if (!normalizedRecipient) return res.status(400).json({ error: 'Invalid recipient number' });
      const payload = { recipient: normalizedRecipient, message };
      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, {
        headers: {
          'Authorization': `Bearer ${extremeApiKey.value}`,
          'Content-Type': 'application/json'
        }
      });

      await deductCreditsAndLog(
        req.user.userId,
        1,
        'send-single',
        response.data?.messageId || `send-${Date.now()}`,
        'sent',
        payload,
        response.data,
        normalizedRecipient
      );

      const existing = await storage.getClientContactsByUserId(req.user.userId);
      if (!existing.find(c => c.phoneNumber === normalizedRecipient)) {
        const clientProfile = await storage.getClientProfileByUserId(req.user.userId);
        await storage.createClientContact({
          userId: req.user.userId,
          phoneNumber: normalizedRecipient,
          firstname: null,
          lastname: null,
          business: clientProfile?.businessName || null,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Initial send error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Client: reply (normalize + deduct)
  app.post('/api/web/inbox/reply', authenticateToken, async (req: any, res) => {
    try {
      const { to, message, userId, defaultDial } = req.body || {};
      if (!to || !message) return res.status(400).json({ error: 'to and message required' });
      const effectiveUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;

      const normalizedTo = normalizePhone(String(to), String(defaultDial || '+1'));
      if (!normalizedTo) return res.status(400).json({ error: 'Invalid recipient number' });

      const history = await storage.getConversationHistory(effectiveUserId, normalizedTo);
      const lastInbound = [...(history.incoming || [])].reverse().find(m => !!m.port || !!m.usedmodem) || (history.incoming || []).slice(-1)[0];
      const usemodem = lastInbound?.usedmodem || null;
      const port = lastInbound?.port || null;

      const extremeApiKey = await storage.getSystemConfig('extreme_api_key');
      if (!extremeApiKey?.value) return res.status(400).json({ error: 'ExtremeSMS API key not configured' });

      const payload: any = { recipient: normalizedTo, message };
      if (usemodem) payload.usemodem = usemodem;
      if (port) payload.port = port;

      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, {
        headers: { 'Authorization': `Bearer ${extremeApiKey.value}`, 'Content-Type': 'application/json' }
      });

      await deductCreditsAndLog(
        effectiveUserId,
        1,
        'web-ui-reply',
        response.data?.messageId || `reply-${Date.now()}`,
        'sent',
        payload,
        response.data,
        normalizedTo
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Reply send error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send reply' });
    }
  });

  // Admin: recent webhook events
  app.get('/api/admin/webhook/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const limit = Number((req.query as any).limit || 50);
      const events = await storage.getAllIncomingMessages(limit);
      res.json({ success: true, events });
    } catch (error) {
      console.error('Webhook events fetch error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Admin: Set/get number aliases for routing (maps internal codes to real MSISDN)
  app.post('/api/admin/routing/aliases', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { aliases } = req.body || {};
      if (!aliases || typeof aliases !== 'object') return res.status(400).json({ success: false, error: 'aliases object required' });
      await storage.setSystemConfig('routing.aliases', JSON.stringify(aliases));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });
  app.get('/api/admin/routing/aliases', authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const cfg = await storage.getSystemConfig('routing.aliases');
      res.json({ success: true, aliases: cfg?.value ? JSON.parse(String(cfg.value)) : {} });
    } catch (e: any) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
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
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });

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
app.post("/api/admin/adjust-credits", authenticateToken, requireRole(['admin','supervisor']), async (req: any, res) => {
    try {
      const { amount, userId, operation } = req.body;
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });

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
      
  // Update credits on target client
      await storage.updateClientCredits(userId, newBalance);

  // Log the transaction for target client
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

      // If supervisor is adding credits, perform a transfer from supervisor's own balance and reduce group pool
      if (req.user?.role === 'supervisor' && operation === 'add') {
        const supProfile = await storage.getClientProfileByUserId(req.user.userId);
        const supBefore = parseFloat(supProfile?.credits || '0');
        if (supBefore < parsedAmount) {
          return res.status(400).json({ error: 'Supervisor has insufficient pooled credits to allocate' });
        }
        const supAfter = (supBefore - parsedAmount).toFixed(2);
        await storage.updateClientCredits(req.user.userId, supAfter);
        await storage.createCreditTransaction({
          userId: req.user.userId,
          amount: (-parsedAmount).toString(),
          type: 'transfer_out',
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
        } catch {}
      }

      // Audit actions
      await storage.createActionLog({ actorUserId: req.user.userId, actorRole: req.user.role, targetUserId: userId, action: 'adjust_credits', details: `${operation}:${amount}` });
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
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });

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
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });

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
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });

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

  // Update client's business name (SUPERVISOR) with uniqueness and group check
  app.post("/api/supervisor/update-business-name", authenticateToken, requireRole(['supervisor']), async (req: any, res) => {
    try {
      const { userId, businessName } = req.body as { userId?: string; businessName?: string };
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const me = await storage.getUser(req.user.userId);
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "Target user not found" });
      if (((me as any)?.groupId || null) !== ((targetUser as any)?.groupId || null)) return res.status(403).json({ error: 'Unauthorized: client not in your group' });

      const trimmed = (businessName || '').trim();
      if (trimmed.length === 0) return res.status(400).json({ error: 'Business name required' });
      const existing = await storage.getClientProfileByBusinessName(trimmed);
      if (existing && (existing as any)?.userId !== userId) return res.status(409).json({ error: 'Business name already taken' });

      await storage.updateClientBusinessName(userId, trimmed);
      res.json({ success: true, businessName: trimmed });
    } catch (e: any) {
      console.error('Supervisor update business name error:', e?.message || e);
      res.status(500).json({ error: 'Failed to update business name' });
    }
  });

// --- Admin: Revoke API Key for a user ---
app.post("/api/v2/account/revoke-api-key", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { keyId, userId } = req.body as { keyId?: string; userId?: string };
    if (!keyId && !userId) return res.status(400).json({ error: "keyId or userId required" });

    if (keyId) {
      await storage.revokeApiKey(keyId);
    } else if (userId) {
      if (await isProtectedAccount(userId) && req.user.userId !== userId) return res.status(403).json({ error: 'Immutable admin account' });
      const keys = await storage.getApiKeysByUserId(userId);
      await Promise.all(keys.map(k => storage.revokeApiKey(k.id)));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Admin revoke API key error:", error);
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});

// --- Admin: Disable a user account ---
app.post("/api/v2/account/disable", authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
  try {
    const { userId } = req.body;
    if (await isProtectedAccount(userId)) return res.status(403).json({ error: 'Immutable admin account' });
    if (!userId) return res.status(400).json({ error: "userId required" });
    await storage.disableUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Admin disable user error:", error);
    res.status(500).json({ error: "Failed to disable user" });
  }
});

// --- Admin: Delete a user account ---
app.delete("/api/v2/account/:userId", authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
  try {
    const { userId } = req.params;
    if (await isProtectedAccount(userId)) return res.status(403).json({ error: 'Immutable admin account' });
    if (!userId) return res.status(400).json({ error: "userId required" });
    await storage.deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
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
      const normalizedRecipient = normalizePhone(String(recipient), String(defaultDial || '+1'));
      if (!normalizedRecipient) return res.status(400).json({ success: false, error: "Invalid recipient phone number", code: "INVALID_RECIPIENT" });
      
      // Forward request to ExtremeSMS
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

      // Deduct credits and log
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
      const { recipients, content, defaultDial } = req.body;

      if (!recipients || !Array.isArray(recipients) || !content) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid parameters",
          code: "INVALID_PARAMS"
        });
      }

      const profile = await storage.getClientProfileByUserId(req.user.userId);
      const { ok: normalizedRecipients, invalid } = normalizeMany(recipients, String(defaultDial || '+1'));
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
        undefined,
        normalizedRecipients
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
      
      const transformed = messages.map((m: any) => ({ recipient: normalizePhone(String(m.recipient || m.to), '+1'), message: m.message, content: m.message })).filter((m: any) => !!m.recipient);
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

      const recipients = transformed.map(m => m.recipient);
      await deductCreditsAndLog(
        req.user.userId,
        transformed.length,
        "/api/v2/sms/sendbulkmulti",
        response.data.results?.[0]?.messageId || "multi_" + Date.now(),
        "queued",
        transformed,
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
  app.get("/api/v2/sms/messages", authenticateToken, async (req: any, res) => {
    try {
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit as string | undefined);
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
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit as string | undefined);
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
      // Allow admin to delete on behalf of another user via query userId
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const targetUserId = (req.user.role === 'admin' && req.query.userId)
        ? req.query.userId
        : req.user.userId;

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
      const normalizePhone = (v: any) => String(v || '').replace(/[^+\d]/g, '').replace(/^00/, '+');
      let clientContacts: any[] = [];
      try {
        clientContacts = await storage.getClientContactsByUserId(targetUserId);
      } catch {}
      const businessByPhone = new Map<string, string>();
      clientContacts.forEach((cc: any) => {
        const n = normalizePhone(cc.phoneNumber);
        if (n && cc.business) businessByPhone.set(n, cc.business);
      });
      const enriched = contacts.map((c: any) => ({
        ...c,
        phoneNumber: normalizePhone(c.phoneNumber),
        business: businessByPhone.get(normalizePhone(c.phoneNumber)) || null
      }));
      res.json({ success: true, contacts: enriched });
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

  // Bulk delete contacts
  app.delete('/api/contacts', authenticateToken, async (req: any, res) => {
    try {
      if (req.query.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Only admins can act on behalf of other users' });
      }
      const targetUserId = (req.user.role === 'admin' && req.query.userId)
        ? req.query.userId
        : req.user.userId;
      if (req.query.all === 'true') {
        await storage.deleteAllContactsByUserId(targetUserId);
        return res.json({ success: true });
      }
      const groupId = req.query.groupId as string | undefined;
      if (groupId) {
        const group = await storage.getContactGroup(groupId);
        if (!group || group.userId !== targetUserId) return res.status(404).json({ error: 'Group not found' });
        await storage.deleteContactsByGroupId(groupId);
        return res.json({ success: true });
      }
      return res.status(400).json({ error: 'Specify all=true or groupId' });
    } catch (error: any) {
      console.error('Bulk delete contacts error:', error);
      res.status(500).json({ error: 'Failed to delete contacts' });
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
        phoneNumber: normalizePhone(String(c.phoneNumber || ''), '+1') || '',
        name: c.name || null,
        email: c.email || null,
        notes: c.notes || null,
        groupId: groupId || null
      }));

      const created = await storage.createContactsBulk(insertContacts);

      const profile = await storage.getClientProfileByUserId(targetUserId);
      const businessName = profile?.businessName || null;
      const effectiveBusiness = businessName || await getAdminDefaultBusinessId();
      const clientContactPayload = created.map((c: any) => ({
        userId: targetUserId,
        phoneNumber: normalizePhone(String(c.phoneNumber || ''), '+1') || '',
        firstname: c.name ? c.name.split(' ')[0] : null,
        lastname: c.name && c.name.split(' ').length > 1 ? c.name.split(' ').slice(1).join(' ') : null,
        business: effectiveBusiness || null
      }));
      try {
        await storage.createClientContacts(clientContactPayload);
      } catch (e) {
        console.warn('Failed to create client_contacts for import:', e);
      }

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

  // Export contacts as CSV without sequential Business IDs
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
      const clientProfile = await storage.getClientProfileByUserId(targetUserId);
      const includeBusiness = String(req.query.includeBusiness || '').toLowerCase() === 'true';
      
      // Create a map of groupId -> businessUnitPrefix
      const groupPrefixMap = new Map<string, string>();
      groups.forEach((group: any) => {
        if (group.businessUnitPrefix) {
          groupPrefixMap.set(group.id, group.businessUnitPrefix);
        }
      });
      
      // Build CSV rows
      const csvRows = ['NAME,PHONE NUMBER,BUSINESS,ACTIONS'];
      
      const fallbackBiz = await getAdminDefaultBusinessId();
      contacts.forEach((contact: any) => {
        const name = contact.name || 'No name';
        const phone = contact.phoneNumber;
        let business = '';
        
        if (contact.groupId && groupPrefixMap.has(contact.groupId)) {
          const prefix = groupPrefixMap.get(contact.groupId)!;
          business = prefix;
        }

        if (!business && includeBusiness) {
          business = clientProfile?.businessName || fallbackBiz;
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
      const { to, message, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      
      // Check if userId parameter is being used by non-admin
      if (userId && !['admin','supervisor'].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!to || !message) {
        return res.status(400).json({ error: "Recipient and message are required" });
      }

      const isAdmin = req.user.role === 'admin';
      const isSupervisor = req.user.role === 'supervisor';
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
        if (((me as any)?.groupId || null) !== ((target as any)?.groupId || null)) {
          return res.status(403).json({ error: 'Unauthorized: client not in your group' });
        }
        targetUserId = userId;
      }

      const extremeApiKey = await getExtremeApiKey();

      const normalizedTo = normalizePhone(String(to), String(defaultDial || '+1'));
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
        
      // Admin direct mode: audit-only (no charge)
      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, 'web-ui-single', response.data.messageId || 'unknown', 'sent', { to, message, normalizedTo }, response.data, normalizedTo);
      } else {
        // Supervisor direct mode should deduct from supervisor's own account
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          1,
          'web-ui-single',
          response.data.messageId || 'unknown',
          'sent',
          { to, message, normalizedTo },
          response.data,
          normalizedTo
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, 'web-ui-single', response.data.messageId || 'unknown', 'sent', { to, message, normalizedTo }, response.data, normalizedTo);
        }
      }

      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: 'Unauthorized: Provider rejected API key' });
      }
      if (error.message === 'Insufficient credits') {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : undefined;
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
  app.post("/api/web/sms/send-bulk", authenticateToken, async (req: any, res) => {
    try {
      const { recipients, message, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      
      // Check acting on behalf
      if (userId && !['admin','supervisor'].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
        return res.status(400).json({ error: "Recipients array and message are required" });
      }

      // Enforce 3000 number limit for bulk sending
      if (recipients.length > 3000) {
        return res.status(400).json({ error: "Maximum 3000 recipients allowed per bulk send. Please split into multiple batches." });
      }

      const isAdmin = req.user.role === 'admin';
      const isSupervisor = req.user.role === 'supervisor';
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
        if (((me as any)?.groupId || null) !== ((target as any)?.groupId || null)) {
          return res.status(403).json({ error: 'Unauthorized: client not in your group' });
        }
        targetUserId = userId;
      }

      const extremeApiKey = await getExtremeApiKey();
      const { ok: normalizedRecipients, invalid } = normalizeMany(recipients, String(defaultDial || '+1'));
      if (normalizedRecipients.length === 0) return res.status(400).json({ error: "No valid recipients after normalization", invalid });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulk`,
        { recipients: normalizedRecipients, message, content: message },
        { headers: { Authorization: `Bearer ${extremeApiKey}`, "Content-Type": "application/json" } }
      );

      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, 'web-ui-bulk', response.data.messageId || 'unknown', 'sent', { recipients, normalizedRecipients, invalid, message }, response.data, undefined, normalizedRecipients);
      } else {
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          normalizedRecipients.length,
          'web-ui-bulk',
          response.data.messageId || 'unknown',
          'sent',
          { recipients, normalizedRecipients, invalid, message },
          response.data,
          undefined,
          normalizedRecipients
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, 'web-ui-bulk', response.data.messageId || 'unknown', 'sent', { recipients, normalizedRecipients, invalid, message }, response.data, undefined, normalizedRecipients);
        }
      }
      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: 'Unauthorized: Provider rejected API key' });
      }
      if (error?.response?.status === 400) {
        return res.status(400).json({ error: error?.response?.data || 'Bad Request to provider' });
      }
      if (error.message === 'Insufficient credits') {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : undefined;
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

  app.post("/api/web/sms/send-bulk-multi", authenticateToken, async (req: any, res) => {
    try {
      const { messages, userId, defaultDial, adminDirect, supervisorDirect } = req.body;
      
      if (userId && !['admin','supervisor'].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Enforce 3000 number limit for bulk multi sending
      if (messages.length > 3000) {
        return res.status(400).json({ error: "Maximum 3000 messages allowed per bulk send. Please split into multiple batches." });
      }

      const isAdmin = req.user.role === 'admin';
      const isSupervisor = req.user.role === 'supervisor';
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
        if (((me as any)?.groupId || null) !== ((target as any)?.groupId || null)) {
          return res.status(403).json({ error: 'Unauthorized: client not in your group' });
        }
        targetUserId = userId;
      }

      const extremeApiKey = await getExtremeApiKey();
      const transformed = messages.map((m: any) => ({ recipient: normalizePhone(String(m.to), String(defaultDial || '+1')), message: m.message, content: m.message }))
        .filter((m: any) => !!m.recipient);
      if (transformed.length === 0) return res.status(400).json({ error: "No valid messages after normalization" });
      const response = await axios.post(
        `${EXTREMESMS_BASE_URL}/api/v2/sms/sendbulkmulti`,
        transformed,
        { headers: { Authorization: `Bearer ${extremeApiKey}`, "Content-Type": "application/json" } }
      );

      if (isAdmin && adminDirect === true) {
        await createAdminAuditLog(req.user.userId, 'web-ui-bulk-multi', response.data.messageId || 'unknown', 'sent', { messages }, response.data);
      } else {
        if (isSupervisor && supervisorDirect === true) {
          targetUserId = req.user.userId;
        }
        const { messageLog } = await deductCreditsAndLog(
          targetUserId,
          transformed.length,
          'web-ui-bulk-multi',
          response.data.messageId || 'unknown',
          'sent',
          { messages, transformed },
          response.data
        );
        if ((isAdmin || isSupervisor) && req.user.userId !== targetUserId) {
          await createAdminAuditLog(req.user.userId, 'web-ui-bulk-multi', response.data.messageId || 'unknown', 'sent', { messages }, response.data);
        }
      }
      res.json({ success: true, messageId: response.data.messageId, data: response.data });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return res.status(401).json({ error: 'Unauthorized: Provider rejected API key' });
      }
      if (error?.response?.status === 400) {
        return res.status(400).json({ error: error?.response?.data || 'Bad Request to provider' });
      }
      if (error.message === 'Insufficient credits') {
        try {
          const extremeApiKey = await storage.getSystemConfig("extreme_api_key");
          const balResp = extremeApiKey?.value ? await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/account/balance`, { headers: { Authorization: `Bearer ${extremeApiKey.value}` } }) : undefined;
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
      // Do not auto-seed example inbox for clients
      let messages: any[] = [];
      try {
        messages = await storage.getIncomingMessagesByUserId(targetUserId, limit);
      } catch (err: any) {
        // If table is missing, bootstrap schema and retry once
        const errMsg = err?.message || String(err);
        if (/relation\s+"?incoming_messages"?\s+does\s+not\s+exist/i.test(errMsg) || err?.code === '42P01') {
          try {
            const { Pool } = await import('pg');
            const { drizzle } = await import('drizzle-orm/node-postgres');
            const { migrate } = await import('drizzle-orm/node-postgres/migrator');
            const path = await import('path');
            const url = process.env.DATABASE_URL!;
            const pool = new Pool(url.includes('sslmode=require') || process.env.POSTGRES_SSL === 'true' ? { connectionString: url, ssl: { rejectUnauthorized: false } } : { connectionString: url });
            const db = drizzle(pool);
            const migrationsFolder = path.resolve(import.meta.dirname, '..', 'migrations');
            try {
            await migrate(db, { migrationsFolder });
          } catch {
            const exec = async (q: string) => { try { await pool.query(q); } catch {} };
            await exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
            await exec(`CREATE TABLE IF NOT EXISTS users (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password text NOT NULL, name text NOT NULL, company text, role text NOT NULL DEFAULT 'client', is_active boolean NOT NULL DEFAULT true, reset_token text, reset_token_expiry timestamp, created_at timestamp NOT NULL DEFAULT now())`);
            await exec(`CREATE TABLE IF NOT EXISTS incoming_messages (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar, "from" text NOT NULL, firstname text, lastname text, business text, message text NOT NULL, status text NOT NULL, matched_block_word text, receiver text NOT NULL, usedmodem text, port text, timestamp timestamp NOT NULL, message_id text NOT NULL, is_read boolean NOT NULL DEFAULT false, is_example boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())`);
            await exec(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
            await exec(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
          }
          await pool.end();
          messages = await storage.getIncomingMessagesByUserId(targetUserId, limit);
        } catch (bootErr: any) {
          console.error('Inbox bootstrap error:', bootErr?.message || bootErr);
          return res.status(500).json({ error: 'Failed to retrieve inbox' });
        }
      } else {
        console.error('Web UI inbox error:', err);
        return res.status(500).json({ error: 'Failed to retrieve inbox' });
      }
    }
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query('ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false');
      await pool.query('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS delivery_mode text DEFAULT \'poll\'');
      await pool.query('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS webhook_url text');
      await pool.query('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS webhook_secret text');
      await pool.end();
    } catch {}
    messages = messages.filter((m: any) => !m.isDeleted);
      // No auto-seed; empty inbox is expected for new accounts
      
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

  // Aliases for docs: /api/web/sms/inbox → same as /api/web/inbox
  app.get("/api/web/sms/inbox", authenticateToken, async (req: any, res) => {
    const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    const limitParam = url.searchParams.get('limit') || (req.query.limit as string);
    req.query.limit = limitParam || req.query.limit;
    return app._router.handle({ ...req, url: '/api/web/inbox' } as any, res, () => {});
  });

  // Web API: account balance for acting user
  app.get("/api/web/account/balance", authenticateToken, async (req: any, res) => {
    try {
      const targetUserId = req.user.role === 'admin' && req.query.userId ? String(req.query.userId) : req.user.userId;
      const profile = await storage.getClientProfileByUserId(targetUserId);
      const credits = profile?.credits ?? '0.00';
      const currency = profile?.currency ?? 'USD';
      res.json({ success: true, balance: parseFloat(credits), currency });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch balance' });
    }
  });

  // Web API: sent messages list
  app.get("/api/web/sms/messages", authenticateToken, async (req: any, res) => {
    try {
      const targetUserId = req.user.role === 'admin' && req.query.userId ? String(req.query.userId) : req.user.userId;
      const limit = resolveFetchLimit((req.query.limit as string) || '100');
      const logs = await storage.getMessageLogsByUserId(targetUserId, limit);
      res.json({ success: true, messages: logs, count: logs.length, limit });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch messages' });
    }
  });

  // Web API: check delivery/status by messageId
  app.get("/api/web/sms/status/:messageId", authenticateToken, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      const log = await storage.getMessageLogByMessageId(messageId);
      if (!log) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, messageId: log.messageId, status: log.status, deliveredAt: log.status === 'delivered' ? log.createdAt : null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch status' });
    }
  });

  app.post("/api/web/inbox/retrieve", authenticateToken, async (req: any, res) => {
    try {
      if (req.body.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Only admins can act on behalf of other users" });
      }
      const extremeApiKey = await getExtremeApiKey();
      const limit = await resolveFetchLimit(req.user.userId, req.user.role, req.query.limit as string | undefined);
      const response = await axios.get(`${EXTREMESMS_BASE_URL}/api/v2/sms/inbox`, {
        headers: { Authorization: `Bearer ${extremeApiKey}` },
        params: { limit }
      });
      const items: any[] = Array.isArray(response.data?.messages) ? response.data.messages : [];
      let processedCount = 0;
      for (const item of items) {
        if (item && item.from && item.message && item.receiver && item.timestamp && item.messageId) {
          await processIncomingSmsPayload(item);
          processedCount++;
        }
      }
      await storage.setSystemConfig('last_inbox_retrieval_at', new Date().toISOString());
      await storage.setSystemConfig('last_inbox_retrieval_count', String(processedCount));
      res.json({ success: true, processedCount });
    } catch (error) {
      console.error("Inbox retrieval error:", error);
      res.status(500).json({ error: "Failed to retrieve inbox from provider" });
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
      
      let conversation = await storage.getConversationHistory(targetUserId, phoneNumber);
      try {
        const outgoing = (conversation.outgoing || []).map((msg: any) => {
          let body = '';
          try {
            const req = typeof msg.requestPayload === 'string' ? JSON.parse(msg.requestPayload || '') : msg.requestPayload;
            body = (req?.message || req?.content || msg.message || '') as string;
          } catch {}
          if (!body) {
            try {
              const resp = typeof msg.responsePayload === 'string' ? JSON.parse(msg.responsePayload || '') : msg.responsePayload;
              body = (resp?.message || resp?.content || body || '') as string;
            } catch {}
          }
          if (!body && typeof msg.requestPayload === 'string') {
            const m = (msg.requestPayload as string).match(/"message"\s*:\s*"([\s\S]*?)"/i) || (msg.requestPayload as string).match(/"content"\s*:\s*"([\s\S]*?)"/i);
            if (m && m[1]) body = m[1];
          }
          return { ...msg, message: body };
        });
        conversation = { ...conversation, outgoing };
      } catch {}
      if (req.user.role !== 'admin' && (conversation.incoming.length === 0 && conversation.outgoing.length === 0)) {
        await storage.seedExampleData(targetUserId);
        conversation = await storage.getConversationHistory(targetUserId, phoneNumber);
      }
      
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
      const { to, message, userId, defaultDial } = req.body;
      
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

      // Map modem/port from the last inbound message for proper two-way routing
      const normalizedTo = normalizePhone(String(to), String(defaultDial || '+1'));
      if (!normalizedTo) return res.status(400).json({ error: "Invalid recipient number" });
      const history = await storage.getConversationHistory(targetUserId, normalizedTo);
      const lastInbound = [...(history.incoming || [])].reverse().find(m => !!m.port || !!m.usedmodem) || (history.incoming || []).slice(-1)[0];
      const usemodem = lastInbound?.usedmodem || null;
      const port = lastInbound?.port || null;

      const extremeApiKey = await storage.getSystemConfig('extreme_api_key');
      if (!extremeApiKey?.value) return res.status(400).json({ error: 'ExtremeSMS API key not configured' });

      const payload: any = { recipient: normalizedTo, message };
      if (usemodem) payload.usemodem = usemodem;
      if (port) payload.port = port;

      const response = await axios.post('https://extremesms.net/api/v2/sms/sendsingle', payload, {
        headers: { 'Authorization': `Bearer ${extremeApiKey.value}`, 'Content-Type': 'application/json' }
      });

      // Deduct credits and log using targetUserId
      await deductCreditsAndLog(
        targetUserId,
        1,
        'web-ui-reply',
        response.data?.messageId || 'unknown',
        'sent',
        payload,
        response.data,
        normalizedTo
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Web UI reply error:", error);
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });

  // Current authenticated user
  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to load user' });
    }
  });

  app.get("/api/web/inbox/deleted", authenticateToken, async (req: any, res) => {
    try {
      const targetUserId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user.userId;
      const all = await storage.getIncomingMessagesByUserId(targetUserId, parseInt((req.query.limit as string) || '200'));
      const deleted = all.filter((m: any) => !!m.isDeleted);
      res.json({ success: true, messages: deleted, count: deleted.length });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load deleted messages' });
    }
  });

  app.post("/api/web/inbox/delete", authenticateToken, async (req: any, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await pool.query('ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false');
        await pool.end();
      } catch {}
      const { Pool } = await import('pg');
      const pool2 = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool2.query('UPDATE incoming_messages SET is_deleted = true WHERE id = $1 AND (user_id IS NULL OR user_id = $2)', [id, targetUserId]);
      await pool2.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  });

  app.post("/api/web/inbox/restore", authenticateToken, async (req: any, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;
      const { Pool } = await import('pg');
      const pool2 = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool2.query('UPDATE incoming_messages SET is_deleted = false WHERE id = $1 AND (user_id IS NULL OR user_id = $2)', [id, targetUserId]);
      await pool2.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to restore message' });
    }
  });

  app.post("/api/web/inbox/delete-permanent", authenticateToken, async (req: any, res) => {
    try {
      const { id, userId } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query('DELETE FROM incoming_messages WHERE id = $1 AND is_deleted = true AND (user_id = $2 OR ($2 IS NULL AND user_id IS NULL))', [id, targetUserId || null]);
      await pool.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to permanently delete message' });
    }
  });

  app.post("/api/web/inbox/purge-deleted", authenticateToken, async (req: any, res) => {
    try {
      const { userId } = req.body || {};
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query('DELETE FROM incoming_messages WHERE is_deleted = true AND (user_id = $1 OR ($1 IS NULL AND user_id IS NULL))', [targetUserId || null]);
      await pool.end();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to purge deleted messages' });
    }
  });

  app.post('/api/v2/webhooks/register', authenticateApiKey, async (req: any, res) => {
    try {
      const { url, secret } = req.body || {};
      const userId = req.apiUserId;
      const safeUrl = typeof url === 'string' && url.startsWith('https://') ? url : null;
      await storage.setClientWebhook(userId, safeUrl, secret || null);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to register webhook' });
    }
  });

  app.get('/api/v2/webhooks/status', authenticateApiKey, async (req: any, res) => {
    try {
      const profile = await storage.getClientProfileByUserId(req.apiUserId);
      res.json({ success: true, deliveryMode: profile?.deliveryMode || 'poll', webhookUrl: profile?.webhookUrl || null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to load status' });
    }
  });

  app.post('/api/v2/sms/reply', authenticateApiKey, async (req: any, res) => {
    try {
      const { to, message } = req.body || {};
      if (!to || !message) return res.status(400).json({ error: 'to and message required' });
      const last = await storage.getLastInboundForUserAndRecipient(req.apiUserId, to);
      if (!last || !last.usedmodem || !last.port) return res.status(400).json({ error: 'No inbound context with modem/port found' });
      const payload = { recipient: to, message, usemodem: last.usedmodem, port: last.port };
      const extremeApiKey = await getExtremeApiKey();
      const response = await axios.post(`${EXTREMESMS_BASE_URL}/api/v2/sms/sendsingle`, payload, { headers: { Authorization: `Bearer ${extremeApiKey}`, 'Content-Type': 'application/json' } });
      res.json({ success: true, provider: response.data });
    } catch (e: any) {
      if (e?.response?.status === 401) return res.status(401).json({ error: 'Unauthorized: Provider rejected API key' });
      res.status(500).json({ error: e?.message || 'Failed to reply' });
    }
  });

  app.post('/api/admin/clients/:id/delivery-mode', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (await isProtectedAccount(String(id)) && req.user.userId !== String(id)) return res.status(403).json({ error: 'Immutable admin account' });
      const { mode } = req.body || {};
      if (!['poll', 'push', 'both'].includes(String(mode))) return res.status(400).json({ error: 'Invalid mode' });
      await storage.setClientDeliveryMode(id, String(mode));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to set delivery mode' });
    }
  });

  app.post('/api/admin/clients/:id/webhook', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (await isProtectedAccount(String(id)) && req.user.userId !== String(id)) return res.status(403).json({ error: 'Immutable admin account' });
      const { url, secret } = req.body || {};
      const safeUrl = typeof url === 'string' && url.startsWith('https://') ? url : null;
      await storage.setClientWebhook(id, safeUrl, secret || null);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to set webhook' });
    }
  });

  // Admin pricing config endpoints (moved inside registerRoutes)
  app.get('/api/admin/pricing', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { groupId } = req.query as { groupId?: string };
      const baseExtreme = await storage.getSystemConfig('extreme_cost_per_sms');
      const baseRate = await storage.getSystemConfig('client_rate_per_sms');
      const base = {
        extremeCost: baseExtreme ? parseFloat(baseExtreme.value) : 0.01,
        clientRate: baseRate ? parseFloat(baseRate.value) : 0.02,
      };
      let group: { extremeCost?: number; clientRate?: number } | null = null;
      if (groupId) {
        const gExtreme = await storage.getSystemConfig(`pricing.group.${groupId}.extreme_cost`);
        const gRate = await storage.getSystemConfig(`pricing.group.${groupId}.client_rate`);
        group = {
          extremeCost: gExtreme ? parseFloat(gExtreme.value) : undefined,
          clientRate: gRate ? parseFloat(gRate.value) : undefined,
        };
      }
      res.json({ success: true, base, group, groupId: groupId || null });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post('/api/admin/pricing', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { groupId, extremeCost, clientRate } = req.body as { groupId?: string; extremeCost?: number; clientRate?: number };
      if (groupId) {
        if (typeof extremeCost === 'number') await storage.setSystemConfig(`pricing.group.${groupId}.extreme_cost`, String(extremeCost));
        if (typeof clientRate === 'number') await storage.setSystemConfig(`pricing.group.${groupId}.client_rate`, String(clientRate));
      } else {
        if (typeof extremeCost === 'number') await storage.setSystemConfig('extreme_cost_per_sms', String(extremeCost));
        if (typeof clientRate === 'number') await storage.setSystemConfig('client_rate_per_sms', String(clientRate));
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.delete('/api/admin/pricing/group/:groupId', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const gid = String(req.params.groupId);
      await storage.deleteSystemConfig(`pricing.group.${gid}.extreme_cost`);
      await storage.deleteSystemConfig(`pricing.group.${gid}.client_rate`);
      res.json({ success: true, groupId: gid });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.get('/api/admin/pricing/all', authenticateToken, requireAdmin, async (_req: any, res) => {
    try {
      const all = await storage.getAllSystemConfig();
      const baseExtremeRec = all.find(x => x.key === 'extreme_cost_per_sms');
      const baseRateRec = all.find(x => x.key === 'client_rate_per_sms');
      const base = {
        extremeCost: baseExtremeRec ? parseFloat(baseExtremeRec.value) : 0.01,
        clientRate: baseRateRec ? parseFloat(baseRateRec.value) : 0.02,
      };
      const groups: Array<{ groupId: string; name: string | null; extremeCost?: number; clientRate?: number; margin?: number }> = [];
      const map: Record<string, { extremeCost?: number; clientRate?: number }> = {};
      for (const rec of all) {
        if (rec.key.startsWith('pricing.group.')) {
          const rest = rec.key.replace('pricing.group.', '');
          const [gid, type] = rest.split('.');
          if (!gid || !type) continue;
          if (!map[gid]) map[gid] = {};
          if (type === 'extreme_cost') map[gid].extremeCost = parseFloat(rec.value);
          if (type === 'client_rate') map[gid].clientRate = parseFloat(rec.value);
        }
      }
      for (const gid of Object.keys(map)) {
        const g = await storage.getContactGroup(gid).catch(() => undefined);
        const extremeCost = map[gid].extremeCost;
        const clientRate = map[gid].clientRate;
        const margin = extremeCost !== undefined && clientRate !== undefined ? clientRate - extremeCost : undefined;
        groups.push({ groupId: gid, name: g ? (g as any).name : null, extremeCost, clientRate, margin });
      }
      res.json({ success: true, base, groups });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
  // Captcha verifier (Turnstile preferred)
  async function verifyCaptchaToken(token?: string) {
    try {
      if (process.env.TURNSTILE_SECRET) {
        const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: String(process.env.TURNSTILE_SECRET), response: String(token || '') }),
        });
        const data = await resp.json();
        return !!data.success;
      }
      if (process.env.CAPTCHA_SECRET) {
        return token === 'slider_ok';
      }
      return true;
    } catch {
      return false;
    }
  }
      
async function getParaphraserConfig() {
  const providerCfg = await storage.getSystemConfig('paraphraser.provider');
  const provider = providerCfg?.value || 'openrouter';
  const targetMinCfg = await storage.getSystemConfig('paraphraser.rules.targetMin');
  const targetMaxCfg = await storage.getSystemConfig('paraphraser.rules.targetMax');
  const maxCharsCfg = await storage.getSystemConfig('paraphraser.rules.maxChars');
  const enforceGrammarCfg = await storage.getSystemConfig('paraphraser.rules.enforceGrammar');
  const linkTemplateCfg = await storage.getSystemConfig('paraphraser.rules.linkTemplate');
  const rules = {
    targetMin: parseInt(String(targetMinCfg?.value || 145)),
    targetMax: parseInt(String(targetMaxCfg?.value || 155)),
    maxChars: parseInt(String(maxCharsCfg?.value || 160)),
    enforceGrammar: String(enforceGrammarCfg?.value || 'true') === 'true',
    linkTemplate: String(linkTemplateCfg?.value || 'Here is the link ${url} here you will find all the information you were asking for.')
  };
  if (provider === 'ollama') {
    const urlCfg = await storage.getSystemConfig('paraphraser.ollama.url');
    const modelCfg = await storage.getSystemConfig('paraphraser.ollama.model');
    return { provider, url: urlCfg?.value || 'http://localhost:11434', model: modelCfg?.value || 'llama3', rules };
  } else if (provider === 'openrouter') {
    const modelCfg = await storage.getSystemConfig('paraphraser.openrouter.model');
    const keyCfg = await storage.getSystemConfig('paraphraser.openrouter.key');
    return { provider, model: modelCfg?.value || 'x-ai/grok-4.1-fast:free', key: keyCfg?.value || String(process.env.OPENROUTER_API_KEY || ''), rules };
  }
  return { provider, rules };
}
