# Ibiki SMS Production Deployment Checklist

## Pre-Deployment Checklist

### Environment Setup
- [ ] Node.js 20.x or higher installed
- [ ] PostgreSQL 12+ installed and running
- [ ] PM2 process manager installed
- [ ] Service user created (ibiki)
- [ ] Application directory created (/opt/ibiki-sms)

### Application Files
- [ ] Source code copied to production server
- [ ] Dependencies installed (`npm ci --only=production`)
- [ ] Application built (`npm run build`)
- [ ] Environment variables configured (.env file)

### Database Setup
- [ ] PostgreSQL database created
- [ ] Database user created with appropriate permissions
- [ ] Database migrations executed
- [ ] Database connection tested

### Security Configuration
- [ ] Strong JWT_SECRET generated
- [ ] Strong SESSION_SECRET generated
- [ ] ExtremeSMS credentials configured
- [ ] File permissions set correctly
- [ ] Firewall configured (ports 80, 443, 22)

## Deployment Checklist

### Application Deployment
- [ ] PM2 ecosystem configuration verified
- [ ] Application started with PM2
- [ ] PM2 configuration saved
- [ ] Systemd service created and enabled
- [ ] Application accessible on configured port

### Web Server Setup (Optional)
- [ ] Nginx installed and configured
- [ ] Reverse proxy configuration tested
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Domain name configured

### Testing
- [ ] Application loads successfully
- [ ] User registration works
- [ ] User login works
- [ ] SMS sending functionality tested
- [ ] Admin direct mode toggle works
- [ ] Client selection mode works (for admins)
- [ ] Database operations verified
- [ ] API endpoints responding correctly

## Post-Deployment Checklist

### Monitoring Setup
- [ ] Log rotation configured
- [ ] Health check endpoints verified (/api/health)
- [ ] Monitoring tools configured (optional)
- [ ] Backup strategy implemented

### Documentation
- [ ] Deployment documentation updated
- [ ] Admin credentials documented securely
- [ ] Maintenance procedures documented
- [ ] Contact information for support updated

### Final Verification
- [ ] All features tested in production environment
- [ ] Admin functionality tested (both direct and client modes)
- [ ] SMS bulk sending tested
- [ ] Contact management tested
- [ ] Message history tested
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Backup and restore procedures tested

## Feature-Specific Testing

### SMS Functionality
- [ ] Single SMS sending works
- [ ] Bulk SMS sending works
- [ ] SMS templates work
- [ ] Contact groups work
- [ ] Message history displays correctly
- [ ] Inbox functionality works

### Admin Features
- [ ] Admin can toggle between direct mode and client selection
- [ ] Admin direct mode uses admin's own account
- [ ] Client selection mode works for managing client accounts
- [ ] Admin can view all client data when in client mode
- [ ] Admin mode toggle persists across page refreshes

### User Management
- [ ] User registration works
- [ ] User login/logout works
- [ ] Profile management works
- [ ] Role-based access control works
- [ ] Session management works correctly

## Rollback Plan

### Emergency Procedures
- [ ] Previous version backup available
- [ ] Database rollback procedure documented
- [ ] Quick rollback commands prepared
- [ ] Emergency contact list updated

### Recovery Testing
- [ ] Backup restoration tested
- [ ] Disaster recovery plan verified
- [ ] Data integrity checks implemented
- [ ] Service restoration time documented

## Maintenance Schedule

### Daily Tasks
- [ ] Check application status (`sudo systemctl status pm2-ibiki`)
- [ ] Review error logs (`sudo -u ibiki pm2 logs`)
- [ ] Monitor system resources (`htop`, `df -h`)
- [ ] Verify backup completion

### Weekly Tasks
- [ ] Update system packages (`sudo apt update && sudo apt upgrade`)
- [ ] Review security logs
- [ ] Performance analysis
- [ ] Database maintenance

### Monthly Tasks
- [ ] Security audit
- [ ] Dependency updates (`npm audit`)
- [ ] Backup testing
- [ ] Documentation review

## Production Environment Details

### Server Information
- **Server IP**: _______________
- **Domain**: _______________
- **OS Version**: _______________
- **Node.js Version**: _______________
- **PostgreSQL Version**: _______________

### Application Configuration
- **Application Port**: 3000
- **Database Name**: ibiki-sms
- **Service User**: ibiki
- **Application Directory**: /opt/ibiki-sms
- **PM2 Service**: pm2-ibiki

### Key Features Deployed
- ✅ SMS sending and receiving
- ✅ Contact management
- ✅ Message history
- ✅ User authentication
- ✅ Admin direct mode toggle
- ✅ Client selection for admins
- ✅ Bulk SMS operations
- ✅ Database migrations
- ✅ Health check endpoints

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: Check VERSION file
**Environment**: Production
**Git Commit**: _______________