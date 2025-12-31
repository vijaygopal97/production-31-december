#!/usr/bin/env python3
"""
Script to:
1. Add Interview_Round_number="2" to all existing polling stations
2. Parse Round 3 Excel file and add new polling stations with round_number="3"
3. Merge Round 3 data into existing groups
"""
import pandas as pd
import json
import os

def add_round_number_to_existing(data, round_number="2"):
    """Add Interview_Round_number to all existing polling stations"""
    total_updated = 0
    for state in data:
        for ac_no in data[state]:
            if "groups" in data[state][ac_no]:
                for group_name in data[state][ac_no]["groups"]:
                    for station in data[state][ac_no]["groups"][group_name]["polling_stations"]:
                        if "Interview_Round_number" not in station:
                            station["Interview_Round_number"] = round_number
                            total_updated += 1
    print(f"✅ Added round_number='{round_number}' to {total_updated} existing polling stations")
    return total_updated

def parse_round3_excel(excel_path):
    """Parse Round 3 Excel file and return structured data"""
    print(f"Reading Round 3 Excel file: {excel_path}")
    df = pd.read_excel(excel_path, sheet_name='Round-3')
    
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
            # Round 3 uses 'GPS' column instead of 'GPS LOCATION'
            gps_location = str(row['GPS']).strip() if pd.notna(row['GPS']) else None
            
            if part_details and gps_location:
                # Parse GPS coordinates
                try:
                    lat, lng = map(float, gps_location.split(','))
                    
                    polling_station = {
                        "name": part_details,
                        "gps_location": gps_location,
                        "latitude": lat,
                        "longitude": lng,
                        "Interview_Round_number": "3"
                    }
                    
                    data[current_state][current_ac_no]["groups"][current_group]["polling_stations"].append(polling_station)
                except (ValueError, AttributeError) as e:
                    print(f"Warning: Could not parse GPS for row {idx}: {gps_location} - {e}")
    
    # Print summary
    total_stations = 0
    for state in data:
        for ac_no in data[state]:
            for group in data[state][ac_no]["groups"]:
                total_stations += len(data[state][ac_no]["groups"][group]["polling_stations"])
    
    print(f"\nRound 3 Summary:")
    print(f"  States: {len(data)}")
    print(f"  Total ACs: {sum(len(data[state]) for state in data)}")
    print(f"  Total Groups: {sum(len(data[state][ac_no]['groups']) for state in data for ac_no in data[state])}")
    print(f"  Total Polling Stations: {total_stations}")
    
    return data

def merge_round3_into_existing(existing_data, round3_data):
    """Merge Round 3 polling stations into existing groups - append to same groups"""
    total_added = 0
    appended_to_existing = 0
    new_groups = 0
    
    for state in round3_data:
        if state not in existing_data:
            # New state - add entire state
            existing_data[state] = round3_data[state]
            for ac_no in round3_data[state]:
                for group_name in round3_data[state][ac_no]["groups"]:
                    total_added += len(round3_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
            continue
        
        for ac_no in round3_data[state]:
            # Convert AC number to string for JSON key matching (JSON keys are always strings)
            ac_no_str = str(ac_no)
            
            if ac_no_str not in existing_data[state]:
                # New AC - add entire AC (use string key)
                existing_data[state][ac_no_str] = round3_data[state][ac_no]
                for group_name in round3_data[state][ac_no]["groups"]:
                    total_added += len(round3_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
                continue
            
            # AC exists - merge groups by appending Round 3 stations to existing groups
            # Use string key for existing_data access
            for group_name in round3_data[state][ac_no]["groups"]:
                # Normalize group name for matching
                normalized_round3_group = group_name.strip()
                
                # Check if group exists in existing data (exact match first)
                group_found = False
                if group_name in existing_data[state][ac_no_str]["groups"]:
                    # Exact match - append Round 3 stations
                    round3_stations = round3_data[state][ac_no]["groups"][group_name]["polling_stations"]
                    existing_data[state][ac_no_str]["groups"][group_name]["polling_stations"].extend(round3_stations)
                    total_added += len(round3_stations)
                    appended_to_existing += 1
                    group_found = True
                else:
                    # Try normalized match
                    if normalized_round3_group in existing_data[state][ac_no_str]["groups"]:
                        round3_stations = round3_data[state][ac_no]["groups"][group_name]["polling_stations"]
                        existing_data[state][ac_no_str]["groups"][normalized_round3_group]["polling_stations"].extend(round3_stations)
                        total_added += len(round3_stations)
                        appended_to_existing += 1
                        group_found = True
                    else:
                        # Try case-insensitive, whitespace-insensitive match
                        for existing_group_name in existing_data[state][ac_no_str]["groups"]:
                            if existing_group_name.strip().lower() == normalized_round3_group.lower():
                                # Found matching group - append to it
                                round3_stations = round3_data[state][ac_no]["groups"][group_name]["polling_stations"]
                                existing_data[state][ac_no_str]["groups"][existing_group_name]["polling_stations"].extend(round3_stations)
                                total_added += len(round3_stations)
                                appended_to_existing += 1
                                group_found = True
                                break
                
                if not group_found:
                    # Group doesn't exist - add as new group (use normalized name)
                    existing_data[state][ac_no_str]["groups"][normalized_round3_group] = round3_data[state][ac_no]["groups"][group_name]
                    total_added += len(round3_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
    
    print(f"\n✅ Merged Round 3 data:")
    print(f"  Stations appended to existing groups: {appended_to_existing}")
    print(f"  New groups added: {new_groups}")
    print(f"  Total Round 3 stations added: {total_added}")
    
    return total_added

def main():
    # Paths
    existing_json_path = "/var/www/opine/backend/data/polling_stations.json"
    round3_excel_path = "/var/www/Sampling Frame Sampling Round-3 DK (1).xlsx"
    output_json_path = "/var/www/opine/backend/data/polling_stations.json"
    
    # Step 1: Load existing JSON
    print("=" * 60)
    print("Step 1: Loading existing polling_stations.json")
    print("=" * 60)
    with open(existing_json_path, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    
    # Step 2: Add round_number="2" to all existing stations
    print("\n" + "=" * 60)
    print("Step 2: Adding Interview_Round_number='2' to existing stations")
    print("=" * 60)
    add_round_number_to_existing(existing_data, "2")
    
    # Step 3: Parse Round 3 Excel
    print("\n" + "=" * 60)
    print("Step 3: Parsing Round 3 Excel file")
    print("=" * 60)
    round3_data = parse_round3_excel(round3_excel_path)
    
    # Step 4: Merge Round 3 into existing
    print("\n" + "=" * 60)
    print("Step 4: Merging Round 3 data into existing structure")
    print("=" * 60)
    merge_round3_into_existing(existing_data, round3_data)
    
    # Step 5: Save updated JSON
    print("\n" + "=" * 60)
    print("Step 5: Saving updated polling_stations.json")
    print("=" * 60)
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    
    # Final summary
    total_stations = 0
    round2_count = 0
    round3_count = 0
    for state in existing_data:
        for ac_no in existing_data[state]:
            if "groups" in existing_data[state][ac_no]:
                for group_name in existing_data[state][ac_no]["groups"]:
                    for station in existing_data[state][ac_no]["groups"][group_name]["polling_stations"]:
                        total_stations += 1
                        round_num = station.get("Interview_Round_number", "unknown")
                        if round_num == "2":
                            round2_count += 1
                        elif round_num == "3":
                            round3_count += 1
    
    print(f"\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"  Total Polling Stations: {total_stations}")
    print(f"  Round 2 Stations: {round2_count}")
    print(f"  Round 3 Stations: {round3_count}")
    print(f"  Stations without round_number: {total_stations - round2_count - round3_count}")
    print("\n✅ Polling station data updated successfully!")

if __name__ == "__main__":
    main()

