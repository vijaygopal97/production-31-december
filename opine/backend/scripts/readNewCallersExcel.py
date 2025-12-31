#!/usr/bin/env python3
import pandas as pd
import json
import sys
from datetime import datetime

excel_path = sys.argv[1] if len(sys.argv) > 1 else '/var/www/opine/frontend/src/data/New callers from office.xlsx'

df = pd.read_excel(excel_path)

# Filter out any rows with missing data
df = df[df['Agent Name'].notna() & df['Contact Number'].notna() & df['ID'].notna()]

# Convert to dict
records = df.to_dict('records')

# Process each record to handle datetime and NaN values
for record in records:
    for key, value in record.items():
        if pd.isna(value):
            record[key] = None
        elif isinstance(value, pd.Timestamp):
            record[key] = value.strftime('%Y-%m-%d')
        elif isinstance(value, datetime):
            record[key] = value.strftime('%Y-%m-%d')
        elif isinstance(value, (int, float)):
            if pd.isna(value):
                record[key] = None
            elif value == int(value):
                record[key] = int(value)
        elif isinstance(value, str) and value.strip() == '':
            record[key] = None

print(json.dumps(records, default=str))


