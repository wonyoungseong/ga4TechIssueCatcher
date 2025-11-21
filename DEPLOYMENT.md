# Deployment Guide

This guide covers deployment strategies for the GA4 Tech Issue Catcher application across different environments.

## Table of Contents

- [Render.com Deployment](#rendercom-deployment)
- [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
- [Local Development Setup](#local-development-setup)
- [Environment Migration](#environment-migration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Render.com Deployment

### Prerequisites

- Render.com account ([sign up](https://render.com))
- GitHub repository connected to Render
- Supabase project (cloud instance recommended)
- Domain (optional, for custom URL)

### Initial Setup

1. **Create New Web Service**
   - Go to Render Dashboard → "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository: `ga4TechIssueCatcher`

2. **Configure Build Settings**

   **Build Command:**
   ```bash
   npm install && cd front/crawler-monitor && npm install && npm run build && cd ../..
   ```

   **Start Command:**
   ```bash
   node src/server.js
   ```

   **Environment:** `Node`

3. **Set Environment Variables**

   Navigate to Environment tab and add:

   ```bash
   # Required - Supabase Connection
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here

   # Required - Node Environment
   NODE_ENV=production

   # Automatic - Set by Render
   # RENDER=true (automatically set, enables read-only mode)

   # Optional - Server Configuration
   SERVER_PORT=3000  # Render will override with assigned port
   ```

4. **Configure Health Check**

   - Health Check Path: `/api/status`
   - Expected Status: `200`
   - Interval: 30 seconds

5. **Deploy**

   - Click "Create Web Service"
   - Wait for initial deployment (5-10 minutes)
   - Monitor logs for successful startup

### Expected Behavior on Render

**Server Startup Logs:**
```
✅ Server running on port 10000
✅ Supabase connection successful
⏰ Automatic cleanup scheduler started
ℹ️  Retry queue scheduler disabled (read-only environment)
```

**Dashboard Behavior:**
- Shows info banner: "읽기 전용 대시보드 - 크롤링은 로컬 환경에서만 실행 가능합니다"
- Crawl controls (start button, pool size input) are hidden
- Historical results are viewable
- WebSocket connection works for real-time updates

**API Protection:**
- `POST /api/crawl/start` returns 403 Forbidden
- `GET /api/environment` returns `{ crawlDisabled: true, isRender: true }`
- All read-only endpoints work normally

### Auto-Deploy Configuration

1. **Enable Auto-Deploy**
   - Render Dashboard → Settings → Auto-Deploy
   - Select branch: `main`
   - Enable "Auto-Deploy"

2. **Deploy Hooks** (Optional)
   - Settings → Deploy Hooks
   - Create hook for manual triggers
   - Use webhook URL for CI/CD integration

### Custom Domain Setup

1. **Add Custom Domain**
   - Render Dashboard → Settings → Custom Domains
   - Click "Add Custom Domain"
   - Enter your domain (e.g., `ga4-catcher.yourdomain.com`)

2. **Configure DNS**
   - Add CNAME record in your DNS provider:
     ```
     CNAME  ga4-catcher  your-app.onrender.com
     ```

3. **Enable HTTPS**
   - Render automatically provisions SSL certificate
   - Verify certificate status in dashboard

## Cloudflare Tunnel Setup

Cloudflare Tunnel provides secure connectivity between Render deployment and local Supabase instance (optional advanced configuration).

### Prerequisites

- Cloudflare account with a domain
- Local Supabase instance running
- `cloudflared` CLI installed

### Installation

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

### Configuration

1. **Authenticate with Cloudflare**
   ```bash
   cloudflared tunnel login
   ```
   - Opens browser for authentication
   - Select your domain

2. **Create Tunnel**
   ```bash
   cloudflared tunnel create ga4-supabase-tunnel
   ```
   - Generates tunnel credentials in `~/.cloudflared/`
   - Note the Tunnel ID

3. **Configure Tunnel**

   Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: ga4-supabase-tunnel
   credentials-file: /Users/YOUR_USERNAME/.cloudflared/TUNNEL_ID.json

   ingress:
     - hostname: ga4-db.yourdomain.com
       service: http://localhost:54321
     - service: http_status:404
   ```

4. **Configure DNS**
   ```bash
   cloudflared tunnel route dns ga4-supabase-tunnel ga4-db.yourdomain.com
   ```

5. **Run Tunnel**
   ```bash
   # Foreground (testing)
   cloudflared tunnel run ga4-supabase-tunnel

   # Background (production)
   cloudflared tunnel run ga4-supabase-tunnel &
   ```

6. **Run as Service** (macOS)
   ```bash
   sudo cloudflared service install
   sudo launchctl start com.cloudflare.cloudflared
   ```

7. **Update Render Environment Variables**
   ```bash
   SUPABASE_URL=https://ga4-db.yourdomain.com
   # Use same SUPABASE_ANON_KEY from local Supabase
   ```

### Verifying Tunnel

```bash
# Test tunnel connectivity
curl https://ga4-db.yourdomain.com/rest/v1/

# Expected: Supabase API response
```

## Local Development Setup

### Standard Local Development

```bash
# 1. Install dependencies
npm install
cd front/crawler-monitor && npm install && cd ../..

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Configure environment (.env)
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start local Supabase (optional)
supabase start

# 5. Run application
npm run server  # Terminal 1 - Web server
npm start       # Terminal 2 - Crawl execution
```

### Local Supabase Development

```bash
# First-time setup
brew install supabase/tap/supabase
supabase start
./scripts/switch-to-local.sh
node scripts/import-properties-to-local.js

# Daily workflow
supabase start
npm run server  # Terminal 1
npm start       # Terminal 2

# Stop Supabase
supabase stop
```

## Environment Migration

### Switching Between Environments

**Local → Cloud Supabase:**
```bash
./scripts/switch-to-cloud.sh
npm run server
```

**Cloud → Local Supabase:**
```bash
./scripts/switch-to-local.sh
supabase start
npm run server
```

**Emergency Rollback:**
```bash
./scripts/rollback-to-cloud.sh
```

### Verifying Environment

```bash
# Check current environment
cat .env | grep SUPABASE_URL

# Test connection
npm run db:test

# Check environment endpoint
curl http://localhost:3000/api/environment
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing: `npm test`
- [ ] Frontend builds successfully: `cd front/crawler-monitor && npm run build`
- [ ] Backend starts without errors: `npm run server`
- [ ] Environment variables configured correctly
- [ ] Database migrations applied: `npm run db:migrate`
- [ ] Git branch is up to date with main

### Render Deployment

- [ ] Environment variables set in Render dashboard
- [ ] Build command: `npm install && cd front/crawler-monitor && npm install && npm run build && cd ../..`
- [ ] Start command: `node src/server.js`
- [ ] Health check configured: `/api/status`
- [ ] Auto-deploy enabled (if desired)

### Post-Deployment Verification

- [ ] Dashboard loads: `https://your-app.onrender.com`
- [ ] Environment endpoint returns correct values: `GET /api/environment`
- [ ] Server logs show correct scheduler status
- [ ] Info banner displayed (crawl disabled)
- [ ] Crawl controls hidden
- [ ] Historical results viewable
- [ ] WebSocket connection works
- [ ] API health check passes: `GET /api/status`

## Monitoring & Maintenance

### Health Checks

**Automated Monitoring:**
```bash
# Render provides built-in health checks
# Health Check Path: /api/status
# Expected Response: {"success":true,"data":{"status":"online"}}
```

**Manual Health Check:**
```bash
curl https://your-app.onrender.com/api/status

# Expected response:
# {
#   "success": true,
#   "data": {
#     "status": "online",
#     "version": "1.0.0",
#     "uptime": 12345,
#     "connectedClients": 2
#   }
# }
```

### Log Monitoring

**Key Log Messages to Monitor:**

✅ **Success Indicators:**
```
✅ Server running on port 10000
✅ Supabase connection successful
⏰ Automatic cleanup scheduler started
ℹ️  Retry queue scheduler disabled (read-only environment)
```

⚠️ **Warning Indicators:**
```
⚠️  Failed to start cleanup scheduler
⚠️  Supabase connection failed
⚠️  WebSocket connection lost
```

❌ **Error Indicators:**
```
❌ Server failed to start
❌ Database connection timeout
❌ Memory limit exceeded
```

### Performance Monitoring

**Render Dashboard:**
- CPU usage (should stay <20% in read-only mode)
- Memory usage (should stay <100MB)
- Response times (should be <500ms for API calls)
- Error rates (should be <0.1%)

**Supabase Dashboard:**
- Database connection pool usage
- Query performance
- Storage usage
- API request rates

### Scheduled Maintenance

**Weekly Tasks:**
- [ ] Review Render logs for errors
- [ ] Check database storage usage
- [ ] Verify cleanup scheduler is running
- [ ] Review WebSocket connection stability

**Monthly Tasks:**
- [ ] Update dependencies: `npm outdated`
- [ ] Review and apply security patches
- [ ] Database performance optimization
- [ ] Backup critical data

## Rollback Procedures

### Render Deployment Rollback

1. **Via Render Dashboard:**
   - Go to Render Dashboard → Deploys
   - Find previous successful deploy
   - Click "Redeploy"
   - Monitor logs for successful startup

2. **Via Git Revert:**
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   # Auto-deploy will trigger rollback
   ```

### Database Rollback

```bash
# If migration failed, rollback to previous version
npm run db:rollback

# Verify database state
npm run db:test
```

### Emergency Recovery

**If Render deployment fails completely:**

1. **Check Logs:**
   - Render Dashboard → Logs
   - Identify error cause

2. **Verify Environment Variables:**
   - Render Dashboard → Environment
   - Ensure all required variables are set

3. **Manual Redeploy:**
   - Render Dashboard → Manual Deploy
   - Deploy previous working commit

4. **Contact Support:**
   - If issue persists, contact Render support with logs

## Troubleshooting

### Common Issues

**Issue: 502 Bad Gateway**
- **Cause**: Application crashed or didn't start
- **Check**: Render logs for startup errors
- **Solution**: Verify environment variables, check for missing dependencies

**Issue: Build Failed**
- **Cause**: npm install errors or build script issues
- **Check**: Build logs in Render dashboard
- **Solution**: Verify package.json scripts, check Node version compatibility

**Issue: Database Connection Failed**
- **Cause**: Invalid Supabase credentials or network issue
- **Check**: Environment variables, Supabase dashboard status
- **Solution**: Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct

**Issue: High Memory Usage**
- **Cause**: Memory leak or crawler accidentally running
- **Check**: Verify `RENDER=true` is set, check logs for crawl attempts
- **Solution**: Ensure environment detection is working, restart service

**Issue: Crawl Controls Visible on Render**
- **Cause**: Frontend not fetching environment or cached version
- **Check**: Browser console for API errors
- **Solution**: Hard refresh (Ctrl+Shift+R), verify `/api/environment` endpoint

### Debug Mode

**Enable verbose logging:**
```bash
# In Render environment variables
DEBUG=*
LOG_LEVEL=debug
```

**Check specific components:**
```bash
# Server logs
curl https://your-app.onrender.com/api/status

# Environment detection
curl https://your-app.onrender.com/api/environment

# Database connection
# Check Render logs for Supabase connection messages
```

## Security Best Practices

1. **Environment Variables:**
   - Never commit `.env` files to Git
   - Use Render's encrypted environment variables
   - Rotate Supabase keys regularly

2. **API Security:**
   - All API endpoints use HTTPS in production
   - Supabase Row Level Security (RLS) policies enabled
   - Rate limiting configured (if applicable)

3. **Access Control:**
   - Limit Render dashboard access to authorized team members
   - Use strong passwords and 2FA
   - Monitor access logs regularly

4. **Data Protection:**
   - Regular database backups via Supabase
   - Screenshot retention policies enforced
   - GDPR compliance for any personal data

## Support & Resources

**Documentation:**
- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- Project CLAUDE.md: Environment Configuration section

**Support Channels:**
- Render Support: [https://render.com/support](https://render.com/support)
- Supabase Support: [https://supabase.com/support](https://supabase.com/support)
- GitHub Issues: Repository issues tab

**Monitoring Tools:**
- Render Dashboard: Real-time metrics and logs
- Supabase Dashboard: Database monitoring
- Cloudflare Dashboard: Tunnel status and analytics
