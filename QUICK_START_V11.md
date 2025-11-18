# Ibiki SMS v11 - Quick Start Guide

## Deploy in 3 Steps

### Step 1: Extract
```bash
tar -xzf ibiki-sms-v11-deployment.tar.gz
cd workspace
```

### Step 2: Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Configure Webhook in ExtremeSMS
Set your webhook URL to: `http://151.243.109.79/webhook/incoming-sms`

## That's It!

Your system will:
- ✅ Install all dependencies
- ✅ Run database migrations (new tables for incoming messages)
- ✅ Build the application
- ✅ Start with PM2
- ✅ Configure Nginx

## After Deployment

### For Admin:
1. Login to admin dashboard
2. Go to "Client Management" tab
3. Assign phone numbers to clients in the "Assigned Number" column
4. Phone numbers save automatically when you click outside the field

### For Clients:
1. Login to client dashboard
2. See incoming messages in the "Incoming Messages" section
3. Messages refresh every 5 seconds automatically

## New Features in v11

🔔 **2-Way SMS**: Clients can now receive SMS replies
📱 **Phone Assignment**: Admin assigns phone numbers to clients
📬 **Inbox**: Live incoming message display with auto-refresh
🔗 **Webhook**: Direct integration with ExtremeSMS
📖 **Documentation**: API docs updated with webhook info

## Important

**Message Routing**: Each client gets a dedicated phone number. All messages to that number go to that client. If 1,000 people reply, that client gets all 1,000 messages (this is correct behavior - like having your own phone line).
