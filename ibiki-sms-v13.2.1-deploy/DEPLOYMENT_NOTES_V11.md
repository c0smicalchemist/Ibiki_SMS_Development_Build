# Ibiki SMS v11 Deployment Notes

## What's New in Version 11
- **2-Way SMS Support**: Complete incoming message handling with webhook integration
- **Phone Number Assignment**: Admin can assign phone numbers to clients for message routing
- **Incoming Message Inbox**: Clients see incoming SMS in their dashboard with auto-refresh
- **API Endpoints**: New inbox endpoints for both API and dashboard access
- **Updated Documentation**: API docs now include webhook configuration instructions

## Deployment Instructions

### Quick Deploy (Same as Previous)
```bash
# Extract the package
tar -xzf ibiki-sms-v11-deployment.tar.gz

# Run the automated deployment script
chmod +x deploy.sh
./deploy.sh
```

### New Configuration Required

#### 1. ExtremeSMS Webhook Setup
After deployment, configure ExtremeSMS to send incoming messages to your webhook:

**Webhook URL:** `http://151.243.109.79/webhook/incoming-sms`

The webhook expects this payload format:
```json
{
  "from": "phone_number",
  "firstname": "sender_first_name",
  "lastname": "sender_last_name",
  "business": "sender_business",
  "message": "message_content",
  "status": "received",
  "matchedBlockWord": "null_or_blocked_word",
  "receiver": "your_phone_number",
  "usedmodem": "modem_id",
  "port": "port_id",
  "timestamp": "2025-11-18T10:30:00.000Z",
  "messageId": "unique_message_id"
}
```

#### 2. Database Migration
The deployment script will automatically run migrations for:
- New `incomingMessages` table
- New `assignedPhoneNumber` field in `clientProfiles`

No manual intervention required if using the deploy script.

### Admin Tasks After Deployment

1. **Assign Phone Numbers to Clients**
   - Login to admin dashboard
   - Go to "Client Management" tab
   - Enter phone numbers in the "Assigned Number" column
   - Numbers will save automatically when you click outside the field

2. **Test Incoming SMS**
   - Have ExtremeSMS send a test message to an assigned number
   - Login as that client
   - Check the "Incoming Messages" section in their dashboard
   - Messages auto-refresh every 5 seconds

### API Changes

**New Endpoints:**
- `GET /api/v2/sms/inbox` - Get incoming messages (API key auth)
- `GET /api/client/inbox` - Get incoming messages (JWT auth for dashboard)
- `POST /api/admin/update-phone-number` - Assign phone number to client (admin only)
- `POST /webhook/incoming-sms` - Webhook to receive from ExtremeSMS (no auth)

**Modified Endpoints:**
- `GET /api/admin/clients` - Now includes `assignedPhoneNumber` field

### Important Notes

1. **Message Routing**: All incoming messages to a phone number are routed to the client assigned that number. If 1,500 people reply to a client's number, that client receives all 1,500 messages (this is correct - it's like a dedicated phone line).

2. **Webhook Security**: The webhook endpoint has no authentication (ExtremeSMS doesn't support webhook auth). Consider IP whitelisting in Nginx if needed.

3. **Auto-Refresh**: Client dashboard inbox refreshes every 5 seconds - monitor server load with high message volumes.

4. **Database**: Uses existing PostgreSQL database - no additional database setup needed.

### Performance Considerations

- **High Volume Clients**: If a client receives many messages (e.g., 1,500+ responses), consider:
  - Pagination in the inbox (currently shows last 100 messages)
  - Rate limiting on the webhook endpoint
  - Database indexing on `userId` and `timestamp` fields (already implemented)

### Rollback
If you need to rollback to v10, simply redeploy the previous version. The database migration is additive only (adds tables/columns) and won't break v10.

## Server Information
- **Server**: 151.243.109.79
- **Port**: 5000 (internal), 80 (via Nginx)
- **Database**: Neon PostgreSQL (configured via DATABASE_URL)
- **Webhook**: http://151.243.109.79/webhook/incoming-sms

## Files Included
- Complete source code with all v11 features
- Automated deployment script (deploy.sh)
- Database migration files
- Updated documentation
- All dependencies listed in package.json
