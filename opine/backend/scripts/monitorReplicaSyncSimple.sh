#!/bin/bash

# ============================================
# SIMPLE MONGODB REPLICA SET SYNC MONITOR (No Auth Required)
# Monitors replica set sync progress
# Usage: ./monitorReplicaSyncSimple.sh [check_interval_seconds]
# ============================================

INTERVAL=${1:-10}  # Default 10 seconds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            MONGODB REPLICA SET SYNC STATUS MONITOR                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Monitoring every ${GREEN}${INTERVAL} seconds${NC} | Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

CHECK_COUNT=0
SYNC_COMPLETE=false

while true; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  
  # Get replica set status
  REPLICA_STATUS=$(mongosh --quiet --eval "
    try {
      const r = db.adminCommand('ismaster');
      const s = rs.status();
      const members = s.members || [];
      
      print(JSON.stringify({
        primary: r.ismaster ? 'THIS_NODE' : (members.find(m => m.stateStr === 'PRIMARY')?.name || 'NONE'),
        setName: r.setName || 'NONE',
        members: members.map(m => ({
          name: m.name,
          state: m.stateStr,
          health: m.health,
          uptime: m.uptime || 0,
          optime: m.optimeDate ? m.optimeDate.toISOString() : null,
          lastHeartbeatMessage: m.lastHeartbeatMessage || null
        }))
      }));
    } catch(e) {
      print(JSON.stringify({error: e.message}));
    }
  " 2>/dev/null)
  
  # Check for errors
  if [ -z "$REPLICA_STATUS" ] || echo "$REPLICA_STATUS" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$REPLICA_STATUS" | jq -r '.error // "Connection failed"' 2>/dev/null)
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║            MONGODB REPLICA SET SYNC STATUS MONITOR                       ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}❌ Error: ${ERROR_MSG}${NC}"
    echo -e "Check #${CHECK_COUNT} at ${TIMESTAMP}"
    echo ""
    echo -e "${YELLOW}Retrying in ${INTERVAL} seconds...${NC}"
    sleep $INTERVAL
    continue
  fi
  
  # Parse status
  PRIMARY=$(echo "$REPLICA_STATUS" | jq -r '.primary // "UNKNOWN"' 2>/dev/null)
  SET_NAME=$(echo "$REPLICA_STATUS" | jq -r '.setName // "NONE"' 2>/dev/null)
  MEMBERS=$(echo "$REPLICA_STATUS" | jq -r '.members[]?' 2>/dev/null)
  
  # Clear and display
  clear
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║            MONGODB REPLICA SET SYNC STATUS MONITOR                       ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "Check #${CHECK_COUNT} | ${TIMESTAMP}"
  echo ""
  
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}📊 REPLICA SET STATUS${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Replica Set: ${GREEN}${SET_NAME}${NC}"
  echo -e "  Primary: ${GREEN}${PRIMARY}${NC}"
  echo ""
  
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}🔗 REPLICA SET MEMBERS${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  ALL_SYNCED=true
  MEMBER_COUNT=0
  
  while IFS= read -r member_json; do
    if [ -z "$member_json" ] || [ "$member_json" == "null" ]; then
      continue
    fi
    
    MEMBER_COUNT=$((MEMBER_COUNT + 1))
    NAME=$(echo "$member_json" | jq -r '.name // "UNKNOWN"')
    STATE=$(echo "$member_json" | jq -r '.state // "UNKNOWN"')
    HEALTH=$(echo "$member_json" | jq -r '.health // 0')
    UPTIME=$(echo "$member_json" | jq -r '.uptime // 0')
    OPTIME=$(echo "$member_json" | jq -r '.optime // null')
    LAST_MSG=$(echo "$member_json" | jq -r '.lastHeartbeatMessage // null')
    
    UPTIME_MIN=$((UPTIME / 60))
    
    # Determine status
    if [ "$STATE" == "PRIMARY" ]; then
      ICON="⭐"
      COLOR="${GREEN}"
      STATUS_MSG="PRIMARY - Accepting Writes"
      ALL_SYNCED=true
    elif [ "$STATE" == "SECONDARY" ]; then
      ICON="✅"
      COLOR="${GREEN}"
      STATUS_MSG="SECONDARY - Synced and Ready"
      if [ "$HEALTH" != "1" ]; then
        ALL_SYNCED=false
      fi
    elif [ "$STATE" == "STARTUP2" ] || [ "$STATE" == "RECOVERING" ]; then
      ICON="📥"
      COLOR="${YELLOW}"
      STATUS_MSG="SYNCING/RECOVERING (Initial sync in progress)"
      ALL_SYNCED=false
    else
      ICON="⚠️"
      COLOR="${RED}"
      STATUS_MSG="$STATE"
      ALL_SYNCED=false
    fi
    
    echo -e "\n${COLOR}${ICON} ${NAME}${NC}"
    echo -e "  State: ${COLOR}${STATE}${NC}"
    echo -e "  Health: $([ "$HEALTH" == "1" ] && echo -e "${GREEN}Healthy${NC}" || echo -e "${RED}Unhealthy${NC}")"
    echo -e "  Uptime: ${UPTIME_MIN} minutes"
    echo -e "  Status: ${STATUS_MSG}"
    
    if [ -n "$LAST_MSG" ] && [ "$LAST_MSG" != "null" ] && [ "$STATE" != "SECONDARY" ] && [ "$STATE" != "PRIMARY" ]; then
      echo -e "  ${YELLOW}Message: ${LAST_MSG}${NC}"
    fi
  done <<< "$(echo "$REPLICA_STATUS" | jq -c '.members[]?' 2>/dev/null)"
  
  if [ $MEMBER_COUNT -eq 0 ]; then
    echo -e "${RED}  ⚠️  No members found${NC}"
    ALL_SYNCED=false
  fi
  
  # Summary
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}📈 SYNC STATUS${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  if $ALL_SYNCED; then
    echo -e "${GREEN}✅✅✅ ALL REPLICAS SYNCED ✅✅✅${NC}"
    echo ""
    echo -e "${GREEN}Your replica set is fully operational!${NC}"
    echo ""
    echo -e "Use comprehensive monitoring:"
    echo -e "  ${CYAN}cd /var/www/opine/backend/scripts${NC}"
    echo -e "  ${CYAN}./monitorSystemHealth.sh${NC}"
    echo ""
    SYNC_COMPLETE=true
  else
    SECONDARY_COUNT=$(echo "$REPLICA_STATUS" | jq '[.members[]? | select(.state == "SECONDARY")] | length' 2>/dev/null)
    SYNCING_COUNT=$(echo "$REPLICA_STATUS" | jq '[.members[]? | select(.state == "STARTUP2" or .state == "RECOVERING")] | length' 2>/dev/null)
    
    echo -e "${YELLOW}📥 Sync in progress...${NC}"
    echo -e "  Secondary members synced: ${SECONDARY_COUNT}"
    echo -e "  Members syncing: ${SYNCING_COUNT}"
    echo ""
    echo -e "${YELLOW}Initial sync can take 10-30 minutes depending on data size.${NC}"
    SYNC_COMPLETE=false
  fi
  
  echo ""
  echo -e "${BLUE}Next check in ${INTERVAL} seconds... (Press Ctrl+C to stop)${NC}"
  
  if $SYNC_COMPLETE; then
    if [ $CHECK_COUNT -gt 6 ]; then
      echo ""
      echo -e "${GREEN}✅ Replica set is stable and fully synced!${NC}"
      exit 0
    fi
  fi
  
  sleep $INTERVAL
done






