# Ibiki SMS - API Middleware

A professional SMS API middleware platform that provides a secure passthrough service to ExtremeSMS. Hide your ExtremeSMS credentials from clients while managing pricing, credits, and usage tracking with multilingual support (English/Chinese).

## Features

- **Secure API Proxy**: Hide ExtremeSMS credentials from your clients
- **Client Management**: Multi-client support with individual API keys
- **Flexible Pricing**: Configure your markup on SMS rates
- **Credit System**: Track and manage client credits/balances
- **Complete API**: All 5 ExtremeSMS endpoints supported
- **Admin Dashboard**: Monitor clients, configure settings, view activity
- **Professional UI**: Clean, modern interface with dark mode support
- **Multilingual**: Full English and Chinese language support
- **Auto-Admin**: First user is automatically promoted to admin

## Quick Start

### For Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Access the application at `http://localhost:5000`

### For Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**Quick Deploy:**
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

## API Endpoints

All endpoints mirror ExtremeSMS API with authentication:

### Authentication
```bash
Authorization: Bearer YOUR_IBIKI_API_KEY
```

### Endpoints

1. **POST /api/v2/sms/sendsingle** - Send single SMS
2. **POST /api/v2/sms/sendbulk** - Send bulk SMS (same content)
3. **POST /api/v2/sms/sendbulkmulti** - Send bulk SMS (different content)
4. **GET /api/v2/sms/status/{messageId}** - Check message status
5. **GET /api/v2/account/balance** - Get account balance

## Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
# Security
JWT_SECRET=your-secret-key

# ExtremeSMS
EXTREMESMS_API_KEY=your_extremesms_api_key

# Pricing
DEFAULT_EXTREME_COST=0.01
DEFAULT_CLIENT_RATE=0.02

# Server
PORT=3000
```

### Admin Panel

Configure ExtremeSMS and pricing via the admin panel at `/admin`:

1. **ExtremeSMS API Key**: Your ExtremeSMS credentials
2. **Pricing Configuration**:
   - **ExtremeSMS Cost**: What ExtremeSMS charges you (e.g., $0.01)
   - **Client Rate**: What you charge clients (e.g., $0.02)
   - **Profit Margin**: Automatically calculated

## Project Structure

```
ibiki-sms/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── App.tsx         # Main app component
├── server/                  # Express backend
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Data storage layer
│   └── index.ts            # Server entry point
├── shared/                  # Shared types/schemas
│   └── schema.ts           # Data models
├── deploy.sh               # 1-click deployment script
├── DEPLOYMENT.md           # Deployment guide
└── .env.example            # Environment template
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- TailwindCSS for styling
- Shadcn UI components
- React Query for data fetching
- Wouter for routing

### Backend
- Node.js 20 with Express
- TypeScript
- JWT authentication
- Bcrypt password hashing
- Axios for ExtremeSMS API calls

### Deployment
- PM2 process manager
- Nginx reverse proxy
- Ubuntu/Debian Linux

## Usage Example

### Client Integration

```javascript
const axios = require('axios');

// Send single SMS
const response = await axios.post(
  'https://api.ibikisms.com/api/v2/sms/sendsingle',
  {
    recipient: '+1234567890',
    message: 'Hello from Ibiki SMS!'
  },
  {
    headers: {
      'Authorization': 'Bearer ibk_live_your_api_key',
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data);
// { success: true, messageId: "...", status: "queued" }
```

### Check Balance

```javascript
const balance = await axios.get(
  'https://api.ibikisms.com/api/v2/account/balance',
  {
    headers: {
      'Authorization': 'Bearer ibk_live_your_api_key'
    }
  }
);

console.log(balance.data);
// { success: true, balance: 250.00, currency: "USD" }
```

## Pricing Model

The platform supports flexible pricing:

- **Cost**: What ExtremeSMS charges you per SMS
- **Rate**: What you charge your clients per SMS
- **Margin**: Your profit per SMS (Rate - Cost)

Example:
- ExtremeSMS Cost: $0.01
- Your Client Rate: $0.02
- Your Profit: $0.01 per SMS

Configure pricing in the admin panel under "Configuration".

## User Roles

### Client
- View dashboard with usage stats
- Access API credentials
- View API documentation
- Monitor credit balance
- Track message history

### Admin
- Manage all clients
- Configure ExtremeSMS connection
- Set pricing rates
- View system-wide activity
- Monitor real-time API requests

## Security Features

- Bcrypt password hashing
- SHA-256 API key hashing
- JWT token authentication
- Role-based access control
- Environment variable configuration
- Secure credential storage

## Production Deployment

### Server Requirements
- Ubuntu/Debian Linux (20.04+)
- 1GB RAM minimum
- Node.js 20+
- Nginx
- PM2

### Deployment Steps

1. Upload files to server
2. Run deployment script: `sudo ./deploy.sh`
3. Configure domain DNS
4. Set up SSL with Certbot
5. Configure ExtremeSMS in admin panel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Monitoring & Maintenance

### View Logs
```bash
pm2 logs ibiki-sms
```

### Restart Application
```bash
pm2 restart ibiki-sms
```

### Monitor Performance
```bash
pm2 monit
```

### Check Status
```bash
pm2 status
```

## Troubleshooting

### Application Won't Start
- Check logs: `pm2 logs ibiki-sms`
- Verify .env file exists and is configured
- Ensure port 3000 is available

### API Requests Failing
- Verify ExtremeSMS API key in admin panel
- Check client has sufficient credits
- Review error logs for details

### Cannot Access via Domain
- Verify DNS is configured correctly
- Check Nginx is running: `systemctl status nginx`
- Ensure firewall allows HTTP/HTTPS

## Future Enhancements

- PostgreSQL database migration for data persistence
- Redis caching for improved performance
- Webhook support for delivery notifications
- Usage analytics and reporting
- Client billing integration
- Rate limiting per client
- Multi-currency support

## License

Proprietary - All rights reserved

## Support

For deployment assistance or issues:
- Review logs in `/var/log/ibiki-sms/`
- Check PM2 status: `pm2 status`
- Verify Nginx configuration: `nginx -t`
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting

## Quick Deployment

Upload to your server and run:
```bash
sudo ./deploy.sh
```

See [QUICKSTART.md](./QUICKSTART.md) for 3-step deployment guide.

---

Built with ❤️ for SMS service providers
