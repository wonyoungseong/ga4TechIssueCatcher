# Local Supabase Setup Guide

This guide explains how to run a complete local Supabase stack using Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.x or later
- At least 4GB of available RAM
- Ports 3000, 3001, 4000, 5000, 5001, 8000, 8080, 9999 available

## Quick Start

### 1. Start Docker Desktop

Ensure Docker Desktop is running before proceeding.

### 2. Start All Services

```bash
docker-compose --env-file .env.local up -d
```

### 3. Verify Services Are Running

```bash
docker-compose ps
```

All services should show as "healthy" or "running".

### 4. Access Supabase Studio

Open your browser and navigate to:
```
http://localhost:3001
```

## Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| **Supabase Studio** | http://localhost:3001 | Admin dashboard |
| **Kong API Gateway** | http://localhost:8000 | Main API entry point |
| **PostgREST** | http://localhost:3000 | Database REST API |
| **Auth (GoTrue)** | http://localhost:9999 | Authentication service |
| **Realtime** | http://localhost:4000 | Realtime subscriptions |
| **Storage API** | http://localhost:5000 | File storage service |
| **Postgres Meta** | http://localhost:8080 | Database management |
| **PostgreSQL** | localhost:5432 | Database (direct access) |

## Configuration

### Environment Variables

All configuration is in `.env.local`:

- `POSTGRES_PASSWORD`: Database password
- `JWT_SECRET`: JWT signing secret (min 32 chars)
- `ANON_KEY`: Public API key for client apps
- `SERVICE_KEY`: Admin API key (keep secret!)

### Default Credentials

**Database:**
- Host: localhost
- Port: 5432
- Database: postgres
- User: postgres
- Password: (from .env.local)

**API Keys:**
- Anon Key: Available in `.env.local`
- Service Role Key: Available in `.env.local`

## Common Operations

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove All Data

```bash
docker-compose down -v
```

**⚠️ Warning:** This will delete all data in the database and storage!

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f storage
docker-compose logs -f kong
```

### Restart a Service

```bash
docker-compose restart [service-name]
```

Example:
```bash
docker-compose restart storage
```

### Check Service Health

```bash
docker-compose ps
```

Healthy services will show `(healthy)` in their status.

## Testing Storage API

### Check Storage Version

```bash
curl http://localhost:5000/storage/v1/version
```

### Test File Upload (via Kong Gateway)

```bash
curl -X POST 'http://localhost:8000/storage/v1/object/test-bucket/test.txt' \
  -H 'Authorization: Bearer YOUR_SERVICE_KEY' \
  -F 'file=@/path/to/your/file.txt'
```

## Connecting Your Application

Update your application's Supabase configuration:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://localhost:8000'
const supabaseAnonKey = 'YOUR_ANON_KEY_FROM_ENV_LOCAL'

const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Troubleshooting

### Services Won't Start

1. Check Docker is running: `docker ps`
2. Check port conflicts: `lsof -i :8000` (repeat for other ports)
3. View logs: `docker-compose logs [service-name]`

### Database Connection Issues

1. Verify database is healthy: `docker-compose ps db`
2. Check logs: `docker-compose logs db`
3. Test connection:
   ```bash
   docker-compose exec db psql -U postgres
   ```

### Storage API Errors

1. Check storage service: `docker-compose logs storage`
2. Verify Kong routing: `docker-compose logs kong`
3. Test direct access: `curl http://localhost:5000/storage/v1/version`

### Reset Everything

If things get corrupted, start fresh:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove any orphaned containers
docker system prune

# Start again
docker-compose --env-file .env.local up -d
```

## Architecture

### Service Dependencies

```
┌─────────────────┐
│  Supabase Studio │ ← User Interface
└────────┬────────┘
         │
    ┌────▼────┐
    │  Kong   │ ← API Gateway (routes all requests)
    └────┬────┘
         │
    ┌────┴───────────────────────────┐
    │                                │
┌───▼────┐  ┌──────┐  ┌─────────┐  ┌▼────────┐
│PostgREST│  │ Auth │  │Realtime │  │ Storage │
└───┬────┘  └──┬───┘  └────┬────┘  └─┬───────┘
    │          │           │          │
    └──────────┴───────────┴──────────┘
               │
          ┌────▼─────┐
          │PostgreSQL│ ← Database
          └──────────┘
```

### Data Persistence

Two Docker volumes ensure data persists between restarts:

- `postgres-data`: Database files
- `storage-data`: Uploaded files

## Production Considerations

**⚠️ This setup is for LOCAL DEVELOPMENT ONLY**

For production:

1. Generate secure random `JWT_SECRET`
2. Generate new API keys based on your JWT secret
3. Change default `POSTGRES_PASSWORD`
4. Configure proper SMTP for emails
5. Enable SSL/TLS
6. Use proper secrets management
7. Configure backups
8. Set up monitoring

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kong Gateway Documentation](https://docs.konghq.com/)

## Support

For issues specific to this setup, check:
1. Service logs: `docker-compose logs [service-name]`
2. Docker status: `docker-compose ps`
3. Port availability: `netstat -an | grep LISTEN`
