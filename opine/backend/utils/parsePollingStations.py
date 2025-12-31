#!/usr/bin/env python3
"""
Script to parse polling station data from Excel and create JSON structure
"""
import pandas as pd
import json
import os

def parse_polling_stations(excel_path, output_path):
    """
    Parse Excel file and create structured JSON for polling stations
    Structure:
    {
        "state": {
            "ac_no": {
                "ac_name": "...",
                "groups": {
                    "group_name": {
                        "polling_stations": [
                            {
                                "name": "...",
                                "gps_location": "lat,lng",
                                "latitude": float,
                                "longitude": float
                            }
                        ]
                    }
                }
            }
        }
    }
    """
    print(f"Reading Excel file: {excel_path}")
    df = pd.read_excel(excel_path, sheet_name='Sheet1')
    
    # Initialize data structure
    data = {}
    
    current_state = None
    current_ac_no = None
    current_ac_name = None
    current_pc_no = None
    current_pc_name = None
    current_district = None
    current_group = None
    
    for idx, row in df.iterrows():
        # Check if this is a group header row
        lot = str(row['Lot ']).strip() if pd.notna(row['Lot ']) else None
        
        if lot and lot.startswith('Group'):
            # New group found
            current_group = lot.strip()
            state = str(row['State']).strip() if pd.notna(row['State']) else None
            ac_no = int(row['AC No.']) if pd.notna(row['AC No.']) else None
            ac_name = str(row['AC Name']).strip() if pd.notna(row['AC Name']) else None
            pc_no = int(row['PC NO']) if pd.notna(row['PC NO']) else None
            pc_name = str(row['PC NAME']).strip() if pd.notna(row['PC NAME']) else None
            district = str(row['District']).strip() if pd.notna(row['District']) else None
            
            if state and ac_no and ac_name:
                current_state = state
                current_ac_no = ac_no
                current_ac_name = ac_name
                current_pc_no = pc_no
                current_pc_name = pc_name
                current_district = district
                
                # Initialize structure
                if state not in data:
                    data[state] = {}
                if ac_no not in data[state]:
                    data[state][ac_no] = {
                        "ac_name": ac_name,
                        "pc_no": pc_no,
                        "pc_name": pc_name,
                        "district": district,
                        "groups": {}
                    }
                if current_group not in data[state][ac_no]["groups"]:
                    data[state][ac_no]["groups"][current_group] = {
                        "polling_stations": []
                    }
        
        # Add polling station to current group
        if current_state and current_ac_no and current_group:
            part_details = str(row['Part Details']).strip() if pd.notna(row['Part Details']) else None
            gps_location = str(row['GPS LOCATION']).strip() if pd.notna(row['GPS LOCATION']) else None
            
            if part_details and gps_location:
                # Parse GPS coordinates
                try:
                    lat, lng = map(float, gps_location.split(','))
                    
                    polling_station = {
                        "name": part_details,
                        "gps_location": gps_location,
                        "latitude": lat,
                        "longitude": lng
                    }
                    
                    data[current_state][current_ac_no]["groups"][current_group]["polling_stations"].append(polling_station)
                except (ValueError, AttributeError) as e:
                    print(f"Warning: Could not parse GPS for row {idx}: {gps_location} - {e}")
    
    # Save to JSON
    print(f"Writing to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    total_stations = 0
    for state in data:
        for ac_no in data[state]:
            for group in data[state][ac_no]["groups"]:
                total_stations += len(data[state][ac_no]["groups"][group]["polling_stations"])
    
    print(f"\nSummary:")
    print(f"  States: {len(data)}")
    print(f"  Total ACs: {sum(len(data[state]) for state in data)}")
    print(f"  Total Groups: {sum(len(data[state][ac_no]['groups']) for state in data for ac_no in data[state])}")
    print(f"  Total Polling Stations: {total_stations}")
    
    return data

if __name__ == "__main__":
    excel_path = "/var/www/Sampled Polling Statoin Round-2.xlsx"
    output_path = "/var/www/opine/backend/data/polling_stations.json"
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    parse_polling_stations(excel_path, output_path)
    print("\n✅ Polling station data parsed successfully!")

