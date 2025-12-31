#!/usr/bin/env python3
"""
Script to:
1. Parse Round 1 Excel file and extract polling stations with round_number="1"
2. Insert Round 1 polling stations BEFORE Round 2 stations in existing groups
3. Ensure Round 1 stations appear first in each group's polling_stations array
"""
import pandas as pd
import json
import os

def parse_round1_excel(excel_path):
    """Parse Round 1 Excel file and return structured data"""
    print(f"Reading Round 1 Excel file: {excel_path}")
    df = pd.read_excel(excel_path, sheet_name='Sheet1')
    
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
            ac_code = row['AC Code'] if pd.notna(row['AC Code']) else None
            ac_name = str(row['AC Name']).strip() if pd.notna(row['AC Name']) else None
            pc_no = int(row['PC NO']) if pd.notna(row['PC NO']) else None
            pc_name = str(row['PC NAME']).strip() if pd.notna(row['PC NAME']) else None
            district = str(row['District']).strip() if pd.notna(row['District']) else None
            
            if state and ac_code and ac_name:
                current_state = state
                current_ac_no = int(ac_code)  # Convert to int for consistency
                current_ac_name = ac_name
                current_pc_no = pc_no
                current_pc_name = pc_name
                current_district = district
                
                # Initialize structure
                if state not in data:
                    data[state] = {}
                if current_ac_no not in data[state]:
                    data[state][current_ac_no] = {
                        "ac_name": ac_name,
                        "pc_no": pc_no,
                        "pc_name": pc_name,
                        "district": district,
                        "groups": {}
                    }
                if current_group not in data[state][current_ac_no]["groups"]:
                    data[state][current_ac_no]["groups"][current_group] = {
                        "polling_stations": []
                    }
        
        # Add polling station to current group
        if current_state and current_ac_no and current_group:
            part_details = str(row['Part Details']).strip() if pd.notna(row['Part Details']) else None
            # Round 1 uses 'Corrected GPS Locations' column
            gps_location = str(row['Corrected GPS Locations']).strip() if pd.notna(row['Corrected GPS Locations']) else None
            
            if part_details and gps_location:
                # Parse GPS coordinates
                try:
                    # Handle GPS format: "lat,lng" or "lat, lng" (with space)
                    gps_clean = gps_location.replace(' ', '')
                    lat, lng = map(float, gps_clean.split(','))
                    
                    polling_station = {
                        "name": part_details,
                        "gps_location": gps_location,  # Keep original format
                        "latitude": lat,
                        "longitude": lng,
                        "Interview_Round_number": "1"
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
    
    print(f"\nRound 1 Summary:")
    print(f"  States: {len(data)}")
    print(f"  Total ACs: {sum(len(data[state]) for state in data)}")
    print(f"  Total Groups: {sum(len(data[state][ac_no]['groups']) for state in data for ac_no in data[state])}")
    print(f"  Total Polling Stations: {total_stations}")
    
    return data

def remove_existing_round1(existing_data):
    """Remove all existing Round 1 stations to avoid duplicates"""
    total_removed = 0
    for state in existing_data:
        for ac_no in existing_data[state]:
            if "groups" in existing_data[state][ac_no]:
                for group_name in existing_data[state][ac_no]["groups"]:
                    original_count = len(existing_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    # Filter out Round 1 stations
                    existing_data[state][ac_no]["groups"][group_name]["polling_stations"] = [
                        station for station in existing_data[state][ac_no]["groups"][group_name]["polling_stations"]
                        if station.get("Interview_Round_number") != "1"
                    ]
                    removed = original_count - len(existing_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    total_removed += removed
    print(f"✅ Removed {total_removed} existing Round 1 stations to avoid duplicates")
    return total_removed

def merge_round1_into_existing(existing_data, round1_data):
    """Merge Round 1 polling stations into existing groups - INSERT at beginning (before Round 2)"""
    total_added = 0
    inserted_to_existing = 0
    new_groups = 0
    new_acs = 0
    new_states = 0
    
    for state in round1_data:
        if state not in existing_data:
            # New state - add entire state
            existing_data[state] = round1_data[state]
            for ac_no in round1_data[state]:
                for group_name in round1_data[state][ac_no]["groups"]:
                    total_added += len(round1_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
            new_states += 1
            continue
        
        for ac_no in round1_data[state]:
            # Convert AC number to string for JSON key matching (JSON keys are always strings)
            ac_no_str = str(ac_no)
            
            if ac_no_str not in existing_data[state]:
                # New AC - add entire AC (use string key)
                existing_data[state][ac_no_str] = round1_data[state][ac_no]
                for group_name in round1_data[state][ac_no]["groups"]:
                    total_added += len(round1_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
                new_acs += 1
                continue
            
            # AC exists - merge groups by INSERTING Round 1 stations at the beginning
            # Use string key for existing_data access
            for group_name in round1_data[state][ac_no]["groups"]:
                # Normalize group name for matching
                normalized_round1_group = group_name.strip()
                
                # Check if group exists in existing data (exact match first)
                group_found = False
                if group_name in existing_data[state][ac_no_str]["groups"]:
                    # Exact match - INSERT Round 1 stations at the beginning
                    round1_stations = round1_data[state][ac_no]["groups"][group_name]["polling_stations"]
                    # Insert at index 0 (beginning) so Round 1 comes before Round 2
                    existing_data[state][ac_no_str]["groups"][group_name]["polling_stations"] = round1_stations + existing_data[state][ac_no_str]["groups"][group_name]["polling_stations"]
                    total_added += len(round1_stations)
                    inserted_to_existing += 1
                    group_found = True
                else:
                    # Try normalized match
                    if normalized_round1_group in existing_data[state][ac_no_str]["groups"]:
                        round1_stations = round1_data[state][ac_no]["groups"][group_name]["polling_stations"]
                        # Insert at beginning
                        existing_data[state][ac_no_str]["groups"][normalized_round1_group]["polling_stations"] = round1_stations + existing_data[state][ac_no_str]["groups"][normalized_round1_group]["polling_stations"]
                        total_added += len(round1_stations)
                        inserted_to_existing += 1
                        group_found = True
                    else:
                        # Try case-insensitive, whitespace-insensitive match
                        for existing_group_name in existing_data[state][ac_no_str]["groups"]:
                            if existing_group_name.strip().lower() == normalized_round1_group.lower():
                                # Found matching group - INSERT at beginning
                                round1_stations = round1_data[state][ac_no]["groups"][group_name]["polling_stations"]
                                existing_data[state][ac_no_str]["groups"][existing_group_name]["polling_stations"] = round1_stations + existing_data[state][ac_no_str]["groups"][existing_group_name]["polling_stations"]
                                total_added += len(round1_stations)
                                inserted_to_existing += 1
                                group_found = True
                                break
                
                if not group_found:
                    # Group doesn't exist - add as new group (use normalized name)
                    existing_data[state][ac_no_str]["groups"][normalized_round1_group] = round1_data[state][ac_no]["groups"][group_name]
                    total_added += len(round1_data[state][ac_no]["groups"][group_name]["polling_stations"])
                    new_groups += 1
    
    print(f"\n✅ Merged Round 1 data:")
    print(f"  Stations inserted to existing groups: {inserted_to_existing}")
    print(f"  New groups added: {new_groups}")
    print(f"  New ACs added: {new_acs}")
    print(f"  New states added: {new_states}")
    print(f"  Total Round 1 stations added: {total_added}")
    
    return total_added

def main():
    # Paths
    existing_json_path = "/var/www/opine/backend/data/polling_stations.json"
    round1_excel_path = "/var/www/Sampled PS with Geo Coordinates Set 1 checked by Parveen (1).xlsx"
    output_json_path = "/var/www/opine/backend/data/polling_stations.json"
    
    # Step 1: Load existing JSON
    print("=" * 60)
    print("Step 1: Loading existing polling_stations.json")
    print("=" * 60)
    with open(existing_json_path, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    
    # Step 2: Remove existing Round 1 stations to avoid duplicates
    print("\n" + "=" * 60)
    print("Step 2: Removing existing Round 1 stations (to avoid duplicates)")
    print("=" * 60)
    remove_existing_round1(existing_data)
    
    # Step 3: Parse Round 1 Excel
    print("\n" + "=" * 60)
    print("Step 3: Parsing Round 1 Excel file")
    print("=" * 60)
    round1_data = parse_round1_excel(round1_excel_path)
    
    # Step 4: Merge Round 1 into existing (INSERT at beginning of groups)
    print("\n" + "=" * 60)
    print("Step 3: Merging Round 1 data into existing structure")
    print("Step 3: (Inserting Round 1 stations BEFORE Round 2 stations)")
    print("=" * 60)
    merge_round1_into_existing(existing_data, round1_data)
    
    # Step 5: Save updated JSON
    print("\n" + "=" * 60)
    print("Step 5: Saving updated polling_stations.json")
    print("=" * 60)
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    
    # Final summary
    total_stations = 0
    round1_count = 0
    round2_count = 0
    round3_count = 0
    for state in existing_data:
        for ac_no in existing_data[state]:
            if "groups" in existing_data[state][ac_no]:
                for group_name in existing_data[state][ac_no]["groups"]:
                    for station in existing_data[state][ac_no]["groups"][group_name]["polling_stations"]:
                        total_stations += 1
                        round_num = station.get("Interview_Round_number", "unknown")
                        if round_num == "1":
                            round1_count += 1
                        elif round_num == "2":
                            round2_count += 1
                        elif round_num == "3":
                            round3_count += 1
    
    print(f"\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"  Total Polling Stations: {total_stations}")
    print(f"  Round 1 Stations: {round1_count}")
    print(f"  Round 2 Stations: {round2_count}")
    print(f"  Round 3 Stations: {round3_count}")
    print(f"  Stations without round_number: {total_stations - round1_count - round2_count - round3_count}")
    print("\n✅ Polling station data updated successfully!")
    print("✅ Round 1 stations are now at the beginning of each group (before Round 2)")

if __name__ == "__main__":
    main()



