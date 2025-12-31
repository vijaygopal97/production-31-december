#!/bin/bash
# Performance monitoring script

LOG_FILE="/var/www/performance_monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Get metrics
CPU=$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1)
MEM=$(free | grep Mem | awk '{printf "%.1f", ($3/$2)*100}')
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CONNECTIONS=$(ss -tn | grep ESTAB | wc -l)
PM2_MEM=$(pm2 jlist | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum([x['monit']['memory'] for x in d if 'opine-backend' in x['name']])/1024/1024)" 2>/dev/null || echo '0')

echo "[$DATE] CPU: ${CPU}% | MEM: ${MEM}% | LOAD: ${LOAD} | CONN: ${CONNECTIONS} | PM2_MEM: ${PM2_MEM}MB" >> $LOG_FILE

# Alert if resources are high
if (( $(echo "$CPU > 80" | bc -l 2>/dev/null || echo 0) )); then
    echo "⚠️  HIGH CPU: ${CPU}%" >> $LOG_FILE
fi

if (( $(echo "$MEM > 80" | bc -l 2>/dev/null || echo 0) )); then
    echo "⚠️  HIGH MEMORY: ${MEM}%" >> $LOG_FILE
fi

if (( $(echo "$LOAD > 6" | bc -l 2>/dev/null || echo 0) )); then
    echo "⚠️  HIGH LOAD: ${LOAD}" >> $LOG_FILE
fi
