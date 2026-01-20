#!/bin/bash

# System Performance Monitor for Stress Test
# Monitors: Primary/Secondary Backend, Database, System Resources

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SECONDARY_SERVER="3.109.82.159"
SSH_KEY="/var/www/MyLogos/Convergent-New.pem"
SURVEY_ID="68fd1915d41841da463f0d46"

clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           STRESS TEST SYSTEM PERFORMANCE MONITOR                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

while true; do
    # Get timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}📊 System Performance - ${TIMESTAMP}${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # ===== TEST STATUS =====
    echo -e "${CYAN}🧪 TEST STATUS${NC}"
    TEST_RUNNING=$(ps aux | grep comprehensive-5min-stress-test.js | grep -v grep | wc -l)
    if [ "$TEST_RUNNING" -gt 0 ]; then
        echo -e "   ${GREEN}✅ Test Running${NC}"
        LATEST_LOG=$(ls -t /var/www/opine/stress-tests/situation-1-quality-checks/logs/comprehensive-5min-*.log 2>/dev/null | head -1)
        if [ -n "$LATEST_LOG" ]; then
            PROGRESS=$(tail -20 "$LATEST_LOG" 2>/dev/null | grep -oE "\[[0-9]+s/300s\]" | tail -1)
            if [ -n "$PROGRESS" ]; then
                echo -e "   Progress: ${GREEN}${PROGRESS}${NC}"
            fi
            LAST_UPDATE=$(tail -5 "$LATEST_LOG" 2>/dev/null | grep -E "Progress|requests|Success" | tail -1)
            if [ -n "$LAST_UPDATE" ]; then
                echo -e "   ${YELLOW}$LAST_UPDATE${NC}"
            fi
        fi
    else
        echo -e "   ${RED}❌ Test Not Running${NC}"
    fi
    echo ""
    
    # ===== PRIMARY SERVER - SYSTEM METRICS =====
    echo -e "${CYAN}🖥️  PRIMARY SERVER (13.202.181.167)${NC}"
    echo -e "   ${BLUE}System Load:${NC}"
    LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    CPU_CORES=8
    LOAD_PERCENT=$(echo "scale=0; ($LOAD * 100) / $CPU_CORES" | bc)
    if (( $(echo "$LOAD_PERCENT > 80" | bc -l) )); then
        echo -e "      Load Average: ${RED}${LOAD}${NC} (${LOAD_PERCENT}% of ${CPU_CORES} cores)"
    elif (( $(echo "$LOAD_PERCENT > 50" | bc -l) )); then
        echo -e "      Load Average: ${YELLOW}${LOAD}${NC} (${LOAD_PERCENT}% of ${CPU_CORES} cores)"
    else
        echo -e "      Load Average: ${GREEN}${LOAD}${NC} (${LOAD_PERCENT}% of ${CPU_CORES} cores)"
    fi
    
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    echo -e "      CPU Usage: ${CPU_USAGE}%"
    
    MEM=$(free -h | grep Mem | awk '{print $3 "/" $2 " (" $3/$2*100 "%)"}')
    MEM_USED=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$MEM_USED" -gt 80 ]; then
        echo -e "      Memory: ${RED}${MEM}${NC}"
    elif [ "$MEM_USED" -gt 60 ]; then
        echo -e "      Memory: ${YELLOW}${MEM}${NC}"
    else
        echo -e "      Memory: ${GREEN}${MEM}${NC}"
    fi
    
    echo -e "   ${BLUE}Backend Workers:${NC}"
    WORKER_COUNT=$(pm2 list | grep opine-backend | wc -l)
    echo -e "      Total Workers: ${GREEN}${WORKER_COUNT}${NC}"
    
    # Get worker CPU/Memory stats
    PM2_STATS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="opine-backend") | "\(.pid):\(.monit.cpu):\(.monit.memory)"' 2>/dev/null)
    if [ -n "$PM2_STATS" ]; then
        AVG_CPU=$(echo "$PM2_STATS" | awk -F: '{sum+=$2; count++} END {if(count>0) printf "%.1f", sum/count; else print "0"}')
        AVG_MEM=$(echo "$PM2_STATS" | awk -F: '{sum+=$3; count++} END {if(count>0) printf "%.0f", sum/count/1024/1024; else print "0"}')
        echo -e "      Avg CPU per Worker: ${AVG_CPU}%"
        echo -e "      Avg Memory per Worker: ${AVG_MEM}MB"
    fi
    
    NET_CONN=$(ss -tn | grep ESTAB | wc -l)
    echo -e "   ${BLUE}Network Connections:${NC} ${NET_CONN}"
    echo ""
    
    # ===== SECONDARY SERVER =====
    echo -e "${CYAN}🖥️  SECONDARY SERVER (3.109.82.159)${NC}"
    SSH_CMD="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@${SECONDARY_SERVER}"
    
    if $SSH_CMD "echo 'connected'" >/dev/null 2>&1; then
        SEC_LOAD=$($SSH_CMD "uptime | awk -F'load average:' '{print \$2}' | awk '{print \$1}' | sed 's/,//'" 2>/dev/null)
        SEC_CPU=$($SSH_CMD "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | sed 's/%us,//'" 2>/dev/null)
        SEC_MEM=$($SSH_CMD "free | grep Mem | awk '{printf \"%.0f\", \$3/\$2 * 100}'" 2>/dev/null)
        SEC_WORKERS=$($SSH_CMD "pm2 list | grep opine-backend | wc -l" 2>/dev/null)
        
        echo -e "   ${BLUE}System Load:${NC} ${SEC_LOAD}"
        echo -e "   ${BLUE}CPU Usage:${NC} ${SEC_CPU}%"
        echo -e "   ${BLUE}Memory Usage:${NC} ${SEC_MEM}%"
        echo -e "   ${BLUE}Backend Workers:${NC} ${GREEN}${SEC_WORKERS}${NC}"
    else
        echo -e "   ${RED}❌ Cannot connect to secondary server${NC}"
    fi
    echo ""
    
    # ===== DATABASE METRICS =====
    echo -e "${CYAN}🗄️  MONGODB DATABASE${NC}"
    MONGO_STATS=$(cd /var/www/opine/backend && node -e "
        require('dotenv').config({ path: '.env' });
        const mongoose = require('mongoose');
        mongoose.connect(process.env.MONGODB_URI).then(async () => {
            const admin = mongoose.connection.db.admin();
            const status = await admin.serverStatus();
            console.log(JSON.stringify({
                current: status.connections.current,
                available: status.connections.available,
                active: status.connections.active,
                total: status.connections.current + status.connections.available
            }));
            process.exit(0);
        }).catch(err => {
            console.log(JSON.stringify({error: err.message}));
            process.exit(0);
        });
    " 2>/dev/null)
    
    if [ -n "$MONGO_STATS" ] && ! echo "$MONGO_STATS" | grep -q "error"; then
        MONGO_CURRENT=$(echo "$MONGO_STATS" | jq -r '.current' 2>/dev/null)
        MONGO_AVAILABLE=$(echo "$MONGO_STATS" | jq -r '.available' 2>/dev/null)
        MONGO_ACTIVE=$(echo "$MONGO_STATS" | jq -r '.active' 2>/dev/null)
        MONGO_TOTAL=$(echo "$MONGO_STATS" | jq -r '.total' 2>/dev/null)
        MONGO_PERCENT=$(echo "scale=1; ($MONGO_CURRENT * 100) / $MONGO_TOTAL" | bc)
        
        echo -e "   ${BLUE}Connections:${NC}"
        if (( $(echo "$MONGO_PERCENT > 50" | bc -l) )); then
            echo -e "      Current: ${RED}${MONGO_CURRENT}${NC} / ${MONGO_TOTAL} (${MONGO_PERCENT}%)"
        elif (( $(echo "$MONGO_PERCENT > 30" | bc -l) )); then
            echo -e "      Current: ${YELLOW}${MONGO_CURRENT}${NC} / ${MONGO_TOTAL} (${MONGO_PERCENT}%)"
        else
            echo -e "      Current: ${GREEN}${MONGO_CURRENT}${NC} / ${MONGO_TOTAL} (${MONGO_PERCENT}%)"
        fi
        echo -e "      Available: ${GREEN}${MONGO_AVAILABLE}${NC}"
        echo -e "      Active: ${MONGO_ACTIVE}"
        
        # Check replica set status
        RS_STATUS=$(cd /var/www/opine/backend && node -e "
            require('dotenv').config({ path: '.env' });
            const mongoose = require('mongoose');
            mongoose.connect(process.env.MONGODB_URI).then(async () => {
                const admin = mongoose.connection.db.admin();
                try {
                    const status = await admin.command({ replSetGetStatus: 1 });
                    console.log(JSON.stringify({
                        set: status.set,
                        members: status.members.map(m => ({
                            name: m.name,
                            stateStr: m.stateStr,
                            health: m.health
                        }))
                    }));
                } catch(e) {
                    console.log(JSON.stringify({error: 'Not a replica set'}));
                }
                process.exit(0);
            });
        " 2>/dev/null)
        
        if [ -n "$RS_STATUS" ] && ! echo "$RS_STATUS" | grep -q "error"; then
            echo -e "   ${BLUE}Replica Set:${NC}"
            echo "$RS_STATUS" | jq -r '.members[] | "      \(.name): \(.stateStr) (Health: \(.health))"' 2>/dev/null
        fi
    else
        echo -e "   ${RED}❌ Cannot connect to MongoDB${NC}"
    fi
    echo ""
    
    # ===== LOAD BALANCING =====
    echo -e "${CYAN}⚖️  LOAD BALANCING${NC}"
    NGINX_UPSTREAM=$(sudo nginx -T 2>/dev/null | grep -A 5 "upstream opine_backend" | grep "server" | wc -l)
    echo -e "   Upstream Servers: ${GREEN}${NGINX_UPSTREAM}${NC}"
    echo ""
    
    # ===== TEST DATA STATUS =====
    echo -e "${CYAN}📊 TEST DATA STATUS${NC}"
    TEST_DATA=$(cd /var/www/opine/backend && node -e "
        require('dotenv').config({ path: '.env' });
        const mongoose = require('mongoose');
        mongoose.connect(process.env.MONGODB_URI).then(async () => {
            const SurveyResponse = mongoose.connection.db.collection('surveyresponses');
            const count = await SurveyResponse.countDocuments({ 'metadata.testMarker': 'STRESS_TEST_5MIN' });
            console.log(count);
            process.exit(0);
        });
    " 2>/dev/null)
    echo -e "   Test Responses in DB: ${TEST_DATA}"
    echo ""
    
    # Clear screen and wait
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Refreshing in 5 seconds... (Press Ctrl+C to stop)${NC}"
    sleep 5
    clear
done





