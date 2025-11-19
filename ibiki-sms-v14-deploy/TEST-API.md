# Testing Your Ibiki SMS API

## Quick Test (Recommended)

### 1. Test Locally First (Development)

```bash
# Set your API key (get it from the dashboard after signup)
export IBIKI_API_KEY="your_api_key_here"

# Run test script (won't actually send SMS - just checks authentication)
node test-api.js
```

### 2. Test on Your Server (Production)

```bash
# SSH to your server
ssh root@151.243.109.79

# Test with curl
curl -X GET http://151.243.109.79/api/v2/account/balance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Manual Testing Methods

### Method 1: Test with Node.js Script

**Download the test script to your computer:**
```bash
# From Replit, download test-api.js
# Then run it against your server:

API_BASE=http://151.243.109.79 IBIKI_API_KEY=your_key node test-api.js
```

**Expected output:**
```
🧪 Testing Ibiki SMS API
========================
Base URL: http://151.243.109.79
API Key: sk_test_...xyz

1️⃣  Testing: GET /api/v2/account/balance
✅ SUCCESS: {
  "success": true,
  "balance": 100,
  "currency": "credits"
}

2️⃣  Testing: POST /api/v2/sms/sendsingle
(DRY RUN - checking authentication only)
⚠️  SKIPPED: Set DRY_RUN=false to actually send SMS
...
```

### Method 2: Test with curl Commands

**1. Check your balance:**
```bash
curl -X GET http://151.243.109.79/api/v2/account/balance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**2. Send a single SMS:**
```bash
curl -X POST http://151.243.109.79/api/v2/sms/sendsingle \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "+1234567890",
    "message": "Test from Ibiki"
  }'
```

**3. Send bulk SMS (same content):**
```bash
curl -X POST http://151.243.109.79/api/v2/sms/sendbulk \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["+1234567890", "+1987654321"],
    "content": "Bulk test message"
  }'
```

**4. Send bulk SMS (different content):**
```bash
curl -X POST http://151.243.109.79/api/v2/sms/sendbulkmulti \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"recipient": "+1234567890", "content": "Your code is 123456"},
    {"recipient": "+1987654321", "content": "Order shipped"}
  ]'
```

**5. Check message status:**
```bash
curl -X GET http://151.243.109.79/api/v2/sms/status/MESSAGE_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## How the Proxy Works

```
Client Request → Ibiki Server → ExtremeSMS
     ↓              ↓               ↓
  API Key    Authenticate      Admin API Key
  (yours)    Check credits     (hidden from client)
              Deduct credits
              Log message
              Proxy request →  Send actual SMS
```

### What Ibiki Does:
1. ✅ **Authenticates** your API key
2. ✅ **Checks** if you have enough credits
3. ✅ **Deducts** credits from your balance
4. ✅ **Logs** the message for audit
5. ✅ **Proxies** request to ExtremeSMS with **admin credentials**
6. ✅ **Returns** ExtremeSMS response to you

### What Clients See:
- ❌ They **never** see ExtremeSMS
- ❌ They **never** see admin credentials
- ✅ They only interact with Ibiki

---

## Troubleshooting

### "Authentication required" error
- Check your API key is correct
- Make sure you're using `Bearer` prefix: `Authorization: Bearer YOUR_KEY`

### "Insufficient credits" error
- Add credits in the admin dashboard
- Go to: Admin Dashboard → Clients → Click Add Credits

### Connection refused
- Make sure the server is running on port 5000
- Check Nginx is proxying port 80 to port 5000
- Verify PM2 is running: `PM2_HOME=/home/ibiki/.pm2 pm2 status`

### "Invalid API key" error
- API key might be inactive
- Check in admin dashboard if the client is active

---

## Next Steps

1. **Sign up** on http://151.243.109.79
2. **Copy your API key** (shown only once!)
3. **Add credits** (admin can do this for you)
4. **Run tests** using the methods above
5. **Check logs** in Client Dashboard to see your messages

---

## Need Help?

Check the server logs:
```bash
ssh root@151.243.109.79
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms
```
