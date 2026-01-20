# Comprehensive System Health Monitor

## Overview
Enterprise-grade monitoring script that monitors:
- **Backend Workers** (Both Primary and Secondary servers)
- **Memory Leaks** (Detects memory growth patterns)
- **MongoDB Replica Set Health** (PRIMARY/SECONDARY status)
- **MongoDB Connections** (Active connections, network I/O)

## Usage

```bash
cd /var/www/opine/backend/scripts
./monitorSystemHealth.sh [duration_minutes] [interval_seconds]
```

### Examples

```bash
# Monitor for 60 minutes, check every 10 seconds (default)
./monitorSystemHealth.sh

# Monitor for 30 minutes, check every 5 seconds
./monitorSystemHealth.sh 30 5

# Quick 5-minute test, check every 3 seconds
./monitorSystemHealth.sh 5 3
```

## Features

### 1. Backend Workers Monitoring
- **Primary Server (172.31.43.71)**: Monitors all PM2 backend workers
- **Secondary Server (172.31.47.152)**: Monitors all PM2 backend workers via SSH
- Shows:
  - Total memory usage
  - Memory per worker process
  - CPU usage per worker
  - Memory growth from baseline

### 2. Memory Leak Detection
- Establishes baseline memory on startup
- Tracks memory increases over time
- **Leak Detection Thresholds:**
  - ✅ **Stable**: <50MB increase
  - ⚠️ **Growing**: 50-200MB increase
  - ⚠️ **LEAK**: 200-500MB increase
  - 🚨 **MASSIVE LEAK**: >500MB increase

### 3. MongoDB Replica Set Health
- Shows replica set name
- Displays PRIMARY and SECONDARY members
- Shows health status of each member
- Displays uptime and synchronization status

### 4. MongoDB Connections
- Current active connections
- Network I/O (bytes in/out)
- Connection pool status

## Output Format

The script displays a real-time dashboard with:
- Color-coded status indicators
- Per-worker memory breakdown
- Replica set member status
- Network statistics

## Final Summary

At the end of monitoring, you get:
- **Memory Leak Analysis**: Peak increases, leak event counts
- **MongoDB Status**: Final replica set state
- **Recommendations**: Actions needed if issues detected

## Requirements

- `jq` - JSON processor
- `bc` - Calculator
- `mongosh` - MongoDB shell
- SSH access to secondary server
- PM2 running on both servers

## Configuration

Server settings are hardcoded in the script:
- Primary Server: 172.31.43.71
- Secondary Server: 172.31.47.152
- Secondary SSH: 3.109.82.159
- SSH Key: /var/www/MyLogos/Convergent-New.pem

To modify, edit the script's configuration section at the top.

## Notes

- The script connects to the secondary server via SSH
- MongoDB connection handles both authenticated and non-authenticated scenarios
- Memory is displayed in MB
- CPU usage is shown as percentage per worker






