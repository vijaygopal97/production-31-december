# AWS Application Load Balancer (ALB) Setup Guide

## Why AWS ALB is Better Than Nginx Load Balancing

1. **Automatic Health Checks**: ALB automatically checks backend health and routes traffic only to healthy servers
2. **Better Distribution**: ALB uses advanced algorithms (round-robin, least connections) with proper health awareness
3. **SSL Termination**: ALB handles SSL certificates, reducing backend load
4. **Automatic Scaling**: Works seamlessly with Auto Scaling Groups
5. **Built-in Monitoring**: CloudWatch integration for metrics
6. **No Single Point of Failure**: ALB itself is highly available across multiple AZs

## Current Server Setup

- **Current Server (Primary)**: 13.202.181.167 (Nginx + Backend)
- **Server 1**: 13.233.231.180 (Backend only)
- **Server 2**: 3.109.186.86 (Backend only - currently not accessible)

## AWS ALB Setup Steps

### Step 1: Create Target Groups

1. Go to **EC2 Console** → **Target Groups** → **Create target group**
2. **Target type**: Instances
3. **Name**: `opine-backend-tg`
4. **Protocol**: HTTP
5. **Port**: 5000
6. **VPC**: Select your VPC
7. **Health checks**:
   - Health check path: `/health`
   - Health check protocol: HTTP
   - Health check port: 5000
   - Healthy threshold: 2
   - Unhealthy threshold: 3
   - Timeout: 5 seconds
   - Interval: 30 seconds
8. **Register targets**:
   - Add all 3 servers (13.202.181.167, 13.233.231.180, 3.109.186.86)
   - Port: 5000
9. Click **Create target group**

### Step 2: Create Application Load Balancer

1. Go to **EC2 Console** → **Load Balancers** → **Create Load Balancer**
2. Select **Application Load Balancer**
3. **Basic configuration**:
   - Name: `opine-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
4. **Network mapping**:
   - VPC: Select your VPC
   - Availability Zones: Select at least 2 AZs
   - Subnets: Select public subnets in each AZ
5. **Security groups**:
   - Create new or use existing
   - Allow inbound:
     - HTTP (80) from 0.0.0.0/0
     - HTTPS (443) from 0.0.0.0/0
6. **Listeners and routing**:
   - **Listener 1**:
     - Protocol: HTTP, Port: 80
     - Default action: Redirect to HTTPS
   - **Listener 2**:
     - Protocol: HTTPS, Port: 443
     - Default SSL certificate: Use your existing certificate (convo.convergentview.com)
     - Default action: Forward to `opine-backend-tg`
7. Click **Create load balancer**

### Step 3: Update DNS

1. Get the ALB DNS name (e.g., `opine-alb-123456789.us-east-1.elb.amazonaws.com`)
2. Go to your DNS provider (Route 53 or other)
3. Update `convo.convergentview.com` A record:
   - Type: A
   - Alias: Yes
   - Alias target: Your ALB
   - Or use CNAME pointing to ALB DNS name

### Step 4: Update Security Groups

**For each backend server (13.202.181.167, 13.233.231.180, 3.109.186.86):**

1. Go to **EC2 Console** → **Security Groups**
2. Find the security group attached to each server
3. **Inbound rules**: Add rule
   - Type: Custom TCP
   - Port: 5000
   - Source: ALB Security Group (or 0.0.0.0/0 for testing)
   - Description: Allow ALB health checks

### Step 5: Configure Target Group Health Checks

1. Go to **Target Groups** → Select `opine-backend-tg`
2. **Health checks** tab:
   - Path: `/health`
   - Port: 5000
   - Protocol: HTTP
   - Success codes: 200
3. **Targets** tab:
   - Verify all targets are healthy (green)
   - If unhealthy, check:
     - Security groups allow ALB → Backend (port 5000)
     - Backend is listening on 0.0.0.0:5000 (not just 127.0.0.1)
     - `/health` endpoint is accessible

### Step 6: Update Nginx Configuration (Optional)

If you want to keep Nginx for static files but use ALB for API:

1. Keep Nginx serving static files from `/var/www/opine/frontend/dist`
2. Remove backend API proxying from Nginx
3. Let ALB handle all `/api/*` requests directly

Or remove Nginx entirely and serve everything through ALB.

## Benefits of AWS ALB

✅ **Automatic failover**: Unhealthy servers are automatically removed
✅ **Better load distribution**: Advanced algorithms with health awareness
✅ **SSL termination**: Reduces backend CPU load
✅ **Monitoring**: Built-in CloudWatch metrics
✅ **Cost**: ~$16/month + data transfer
✅ **Scalability**: Easy to add more backend servers

## Cost Estimate

- ALB: ~$0.0225/hour = ~$16/month
- Data transfer: $0.008/GB (first 10TB)
- Total: ~$20-30/month depending on traffic

## Migration Steps

1. **Create ALB** (Steps 1-2 above)
2. **Test ALB** with temporary DNS (e.g., `test.convergentview.com`)
3. **Verify health checks** - all servers should be healthy
4. **Test load distribution** - verify traffic goes to all servers
5. **Update DNS** - point `convo.convergentview.com` to ALB
6. **Monitor** - watch CloudWatch metrics for 24 hours
7. **Remove Nginx load balancing** - keep Nginx only for static files or remove it

## Current Issues with Nginx Load Balancing

- ❌ Nginx cannot reach Server 1 (likely security group issue)
- ❌ No automatic health checks
- ❌ Manual configuration required
- ❌ Single point of failure (Nginx server)

## Recommendation

**Use AWS ALB** - It's the industry-standard solution for this use case and will solve all current load balancing issues automatically.





