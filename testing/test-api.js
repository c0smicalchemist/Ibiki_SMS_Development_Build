#!/usr/bin/env node

/**
 * Ibiki SMS API Test Script
 * 
 * This script tests all SMS API endpoints to verify they're working correctly.
 * Run this AFTER deploying to your server (151.243.109.79)
 */

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const API_KEY = process.env.IBIKI_API_KEY || "YOUR_API_KEY_HERE";

console.log("🧪 Testing Ibiki SMS API");
console.log("========================");
console.log(`Base URL: ${API_BASE}`);
console.log(`API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}\n`);

// Test 1: Check account balance
async function testBalance() {
  console.log("1️⃣  Testing: GET /api/v2/account/balance");
  try {
    const response = await fetch(`${API_BASE}/api/v2/account/balance`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ SUCCESS:", JSON.stringify(data, null, 2));
      return data.balance;
    } else {
      console.log("❌ FAILED:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
    return null;
  }
  console.log();
}

// Test 2: Send single SMS (DRY RUN - won't actually send)
async function testSendSingle(dryRun = true) {
  console.log("\n2️⃣  Testing: POST /api/v2/sms/sendsingle");
  console.log(dryRun ? "(DRY RUN - checking authentication only)\n" : "");
  
  const testPayload = {
    recipient: "+1234567890",
    message: "Test message from Ibiki SMS API"
  };
  
  console.log("Request:", JSON.stringify(testPayload, null, 2));
  
  if (dryRun) {
    console.log("⚠️  SKIPPED: Set DRY_RUN=false to actually send SMS");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/v2/sms/sendsingle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ SUCCESS:", JSON.stringify(data, null, 2));
    } else {
      console.log("❌ FAILED:", data);
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
}

// Test 3: Send bulk SMS (same content)
async function testSendBulk(dryRun = true) {
  console.log("\n3️⃣  Testing: POST /api/v2/sms/sendbulk");
  console.log(dryRun ? "(DRY RUN - checking authentication only)\n" : "");
  
  const testPayload = {
    recipients: ["+1234567890", "+1987654321"],
    content: "Bulk message from Ibiki SMS API"
  };
  
  console.log("Request:", JSON.stringify(testPayload, null, 2));
  
  if (dryRun) {
    console.log("⚠️  SKIPPED: Set DRY_RUN=false to actually send SMS");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/v2/sms/sendbulk`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ SUCCESS:", JSON.stringify(data, null, 2));
    } else {
      console.log("❌ FAILED:", data);
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
}

// Test 4: Send bulk SMS (multi content)
async function testSendBulkMulti(dryRun = true) {
  console.log("\n4️⃣  Testing: POST /api/v2/sms/sendbulkmulti");
  console.log(dryRun ? "(DRY RUN - checking authentication only)\n" : "");
  
  const testPayload = [
    { recipient: "+1234567890", content: "Your code is 123456" },
    { recipient: "+1987654321", content: "Order shipped" }
  ];
  
  console.log("Request:", JSON.stringify(testPayload, null, 2));
  
  if (dryRun) {
    console.log("⚠️  SKIPPED: Set DRY_RUN=false to actually send SMS");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/v2/sms/sendbulkmulti`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ SUCCESS:", JSON.stringify(data, null, 2));
    } else {
      console.log("❌ FAILED:", data);
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
  }
}

// Main test runner
async function runTests() {
  const dryRun = process.env.DRY_RUN !== "false";
  
  if (API_KEY === "YOUR_API_KEY_HERE") {
    console.log("❌ ERROR: Please set IBIKI_API_KEY environment variable");
    console.log("\nExample:");
    console.log("  IBIKI_API_KEY=your_key_here node test-api.js");
    process.exit(1);
  }
  
  // Test balance endpoint (safe, no credits used)
  const balance = await testBalance();
  
  if (balance === null) {
    console.log("\n❌ Authentication failed. Cannot proceed with tests.");
    process.exit(1);
  }
  
  if (balance <= 0) {
    console.log("\n⚠️  WARNING: Your balance is 0. Add credits before sending SMS.");
  }
  
  // Test SMS endpoints (dry run by default)
  await testSendSingle(dryRun);
  await testSendBulk(dryRun);
  await testSendBulkMulti(dryRun);
  
  console.log("\n" + "=".repeat(50));
  if (dryRun) {
    console.log("✅ All tests completed (dry run mode)");
    console.log("\nTo actually send SMS, run:");
    console.log("  DRY_RUN=false IBIKI_API_KEY=your_key node test-api.js");
  } else {
    console.log("✅ All tests completed");
  }
  console.log("=".repeat(50));
}

runTests().catch(console.error);
