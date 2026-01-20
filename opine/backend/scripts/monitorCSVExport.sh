#!/bin/bash
# Monitor CSV Export Progress
# Usage: ./monitorCSVExport.sh [surveyId]

SURVEY_ID=${1:-"68fd1915d41841da463f0d46"}
LOG_FILE="/tmp/csv_export_${SURVEY_ID}.log"
CSV_FILE="/var/www/opine/backend/generated-csvs/${SURVEY_ID}/responses_responses.csv"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CSV Export Monitor - Survey: ${SURVEY_ID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if process is running
if pgrep -f "generateAllTimeCSVExport.js.*${SURVEY_ID}" > /dev/null; then
    PID=$(pgrep -f "generateAllTimeCSVExport.js.*${SURVEY_ID}")
    echo "✅ Export is RUNNING (PID: $PID)"
    echo ""
    
    # Show latest log entries
    if [ -f "$LOG_FILE" ]; then
        echo "📝 Latest Progress:"
        tail -15 "$LOG_FILE" | grep -v "Warning\|MONGOOSE\|MONGODB DRIVER"
        echo ""
    fi
    
    # Show file size if exists
    if [ -f "$CSV_FILE" ]; then
        FILE_SIZE=$(ls -lh "$CSV_FILE" | awk '{print $5}')
        LINE_COUNT=$(wc -l "$CSV_FILE" 2>/dev/null | awk '{print $1}')
        echo "📄 CSV File:"
        echo "   Path: $CSV_FILE"
        echo "   Size: $FILE_SIZE"
        echo "   Lines: $LINE_COUNT"
        echo ""
        echo "💡 To watch progress in real-time:"
        echo "   tail -f $LOG_FILE"
    fi
else
    echo "⚠️  Export process NOT RUNNING"
    echo ""
    
    # Check if it completed
    if [ -f "$LOG_FILE" ]; then
        echo "📝 Final Log Output:"
        tail -30 "$LOG_FILE" | grep -v "Warning\|MONGOOSE\|MONGODB DRIVER"
        echo ""
    fi
    
    # Check if CSV file exists
    if [ -f "$CSV_FILE" ]; then
        FILE_SIZE=$(ls -lh "$CSV_FILE" | awk '{print $5}')
        LINE_COUNT=$(wc -l "$CSV_FILE" 2>/dev/null | awk '{print $1}')
        echo "✅ CSV Export COMPLETED!"
        echo ""
        echo "📄 File Details:"
        echo "   Path: $CSV_FILE"
        echo "   Size: $FILE_SIZE"
        echo "   Lines: $LINE_COUNT"
    else
        echo "❌ CSV file not found - export may have failed"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"






