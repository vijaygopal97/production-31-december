#!/usr/bin/env python3
"""
Create Excel template with only first 3 rows (headers + 2 example rows)
"""

import pandas as pd
import sys
import os

def create_template(source_excel_path, output_template_path):
    """
    Create template Excel file with only first 3 rows
    
    Args:
        source_excel_path: Path to source Excel file with all data
        output_template_path: Path to save template Excel file
    """
    try:
        # Read the source Excel file
        print(f"Reading source Excel: {source_excel_path}")
        df = pd.read_excel(source_excel_path)
        
        # Keep only first 2 data rows (row 0 = headers, row 1-2 = 2 example data rows)
        # Total: 1 header row + 2 data rows = 3 rows total
        # If there are less than 2 data rows, keep all available rows
        template_df = df.head(2)  # Only 2 data rows (header is separate)
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_template_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Save as template Excel file
        print(f"Creating template with {len(template_df)} rows: {output_template_path}")
        template_df.to_excel(output_template_path, index=False, engine='openpyxl')
        
        print(f"Template created successfully!")
        return True
        
    except Exception as e:
        print(f"Error creating template: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 create_template.py <source_excel> <output_template>")
        sys.exit(1)
    
    source_excel = sys.argv[1]
    output_template = sys.argv[2]
    
    success = create_template(source_excel, output_template)
    sys.exit(0 if success else 1)


