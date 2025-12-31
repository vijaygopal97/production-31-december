#!/usr/bin/env python3
"""
Calculation Audit Trail - Complete Working Documentation
Shows step-by-step how every number in the output PPT is calculated from Excel data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Import vote share calculator
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from vote_share_calculator import VoteShareCalculator


class CalculationAuditTrail:
    """Generate complete audit trail of all calculations"""
    
    def __init__(self, excel_path, reference_date=None):
        """
        Initialize audit trail
        
        Args:
            excel_path: Path to Excel file
            reference_date: Reference date for calculations (default: current date)
        """
        self.excel_path = excel_path
        self.df = None
        self.calculator = None
        
        # Set reference date
        if reference_date is None:
            self.reference_date = datetime.now()
        else:
            if isinstance(reference_date, str):
                self.reference_date = pd.to_datetime(reference_date)
            else:
                self.reference_date = pd.to_datetime(reference_date)
        
        self.load_data()
    
    def load_data(self):
        """Load Excel data"""
        print(f"Loading data from: {self.excel_path}")
        self.df = pd.read_excel(self.excel_path)
        
        # Preprocess dates
        self.df['Survey Date'] = pd.to_datetime(self.df['Survey Date'], errors='coerce')
        self.df = self.df[self.df['Survey Date'].notna()].copy()
        
        print(f"Loaded {len(self.df):,} records")
        
        # Filter by reference date
        self.df_filtered = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        print(f"Filtered to reference date {self.reference_date.date()}: {len(self.df_filtered):,} records")
        
        self.calculator = VoteShareCalculator(self.df_filtered)
    
    def audit_raw_vote_share(self):
        """Audit trail for Raw Vote Share calculation"""
        print("\n" + "="*80)
        print("AUDIT: RAW VOTE SHARE CALCULATION")
        print("="*80)
        
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        
        print(f"\nData Source:")
        print(f"  Question: {vote_question}")
        print(f"  Date Filter: All data up to {self.reference_date.date()}")
        # Sample size: only count records with non-empty responses to main question
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        sample_size = len(self.df_filtered[self.df_filtered[vote_question].notna()].copy()) if vote_question in self.df_filtered.columns else len(self.df_filtered)
        print(f"  Sample Size: {sample_size:,} records (only non-empty responses)")
        print(f"  Weights: NOT USED (raw calculation)")
        
        # Get raw party code distribution
        print(f"\nRaw Party Code Distribution:")
        party_codes = self.df_filtered[vote_question].value_counts().sort_index()
        total_valid = len(self.df_filtered[self.df_filtered[vote_question].notna()])
        
        party_mapping = {
            1: 'AITC',
            2: 'BJP',
            3: 'INC',
            4: 'LEFT',
            12: 'Independent → Others',
            44: 'Others',
            55: 'NOTA → NWR',
            66: 'Did not vote → NWR',
            67: 'Will not vote → NWR',
            77: 'Not eligible → NWR',
            78: 'Not yet decided → NWR',
            88: 'Refused → NWR'
        }
        
        party_counts = {}
        others_count = 0
        nwr_count = 0
        
        for code, count in party_codes.items():
            if pd.notna(code):
                code = int(code)
                print(f"  Code {code}: {count:,} records ({count/total_valid*100:.2f}%)")
                
                if code == 1:
                    party_counts['AITC'] = count
                elif code == 2:
                    party_counts['BJP'] = count
                elif code == 3:
                    party_counts['INC'] = count
                elif code == 4:
                    party_counts['LEFT'] = count
                elif code in [12, 44]:
                    others_count += count
                elif code in [55, 66, 67, 77, 78, 88]:
                    nwr_count += count
                else:
                    others_count += count
        
        # Missing/NaN
        missing_count = self.df_filtered[vote_question].isna().sum()
        nwr_count += missing_count
        if missing_count > 0:
            print(f"  Missing/NaN: {missing_count:,} records → NWR")
        
        party_counts['Others'] = others_count
        party_counts['NWR'] = nwr_count
        
        print(f"\nParty Categorization (After Mapping):")
        for party, count in sorted(party_counts.items()):
            pct = (count / total_valid) * 100
            print(f"  {party}: {count:,} records ({pct:.2f}%)")
        
        print(f"\nRaw Vote Share Calculation:")
        print(f"  Formula: (Party Count / Total Valid Records) × 100")
        print(f"  Total Valid Records: {total_valid:,}")
        print(f"\n  Results:")
        for party, count in sorted(party_counts.items()):
            raw_pct = (count / total_valid) * 100
            print(f"    {party}: {count:,} / {total_valid:,} × 100 = {raw_pct:.2f}%")
        
        # Calculate using calculator for comparison
        overall_data = self.calculator.filter_by_date_range(days=None)
        raw_vs = self.calculator.calculate_vote_share(overall_data, use_weights=False)
        
        print(f"\n  Verification (from VoteShareCalculator):")
        print(f"    Sample: {raw_vs.get('sample', 0):,}")
        print(f"    AITC: {raw_vs.get('AITC', 0):.2f}%")
        print(f"    BJP: {raw_vs.get('BJP', 0):.2f}%")
        print(f"    LEFT: {raw_vs.get('LEFT', 0):.2f}%")
        print(f"    INC: {raw_vs.get('INC', 0):.2f}%")
        print(f"    Others: {raw_vs.get('Others', 0):.2f}%")
        print(f"    NWR: {raw_vs.get('NWR', 0):.2f}%")
    
    def audit_normalized_vote_share(self):
        """Audit trail for Normalized Vote Share calculation"""
        print("\n" + "="*80)
        print("AUDIT: NORMALIZED VOTE SHARE CALCULATION")
        print("="*80)
        
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nData Source:")
        print(f"  Question: {vote_question}")
        print(f"  Date Filter: All data up to {self.reference_date.date()}")
        print(f"  Weight Column: {weight_column}")
        print(f"  Weights: USED for normalization")
        
        # Get data with valid weights
        data_with_weights = self.df_filtered[
            (self.df_filtered[vote_question].notna()) & 
            (self.df_filtered[weight_column].notna())
        ].copy()
        
        print(f"\nWeight Statistics:")
        weights = pd.to_numeric(data_with_weights[weight_column], errors='coerce')
        print(f"  Records with valid weights: {len(data_with_weights):,}")
        print(f"  Total Weight Sum: {weights.sum():,.2f}")
        print(f"  Average Weight: {weights.mean():.4f}")
        print(f"  Min Weight: {weights.min():.4f}")
        print(f"  Max Weight: {weights.max():.4f}")
        
        # Show weight distribution by party
        print(f"\nWeight Distribution by Party:")
        
        # Categorize parties
        def categorize_party(code):
            if pd.isna(code):
                return 'NWR'
            try:
                code = int(code)
            except:
                return 'NWR'
            
            if code == 1:
                return 'AITC'
            elif code == 2:
                return 'BJP'
            elif code == 3:
                return 'INC'
            elif code == 4:
                return 'LEFT'
            elif code in [12, 44]:
                return 'Others'
            elif code in [55, 66, 67, 77, 78, 88]:
                return 'NWR'
            else:
                return 'Others'
        
        data_with_weights['party_category'] = data_with_weights[vote_question].apply(categorize_party)
        
        total_weight = weights.sum()
        
        print(f"\nNormalized Vote Share Calculation:")
        print(f"  Formula: (Σ Weight for Party / Σ Total Weights) × 100")
        print(f"  Total Weight Sum: {total_weight:,.2f}")
        print(f"\n  Step-by-Step Calculation:")
        print(f"  Formula: For each party, sum all weights for that party, then divide by total weight sum")
        print(f"  Weight Column: {weight_column}")
        print(f"  Total Weight Sum: {total_weight:,.2f}")
        print(f"  Each record is multiplied by its weight, then summed by party")
        
        party_weight_sums = {}
        party_record_counts = {}
        
        for party in ['AITC', 'BJP', 'INC', 'LEFT', 'Others', 'NWR']:
            party_mask = data_with_weights['party_category'] == party
            party_weights = weights[party_mask]
            party_weight_sum = party_weights.sum()
            party_weight_sums[party] = party_weight_sum
            party_record_counts[party] = party_mask.sum()
            
            normalized_pct = (party_weight_sum / total_weight) * 100
            
            count = party_mask.sum()
            avg_weight = party_weights.mean() if len(party_weights) > 0 else 0
            
            print(f"\n    {party}:")
            print(f"      Record Count: {count:,}")
            print(f"      Average Weight per Record: {avg_weight:,.4f}")
            print(f"      Weight Sum (Σ weights for {party}): {party_weight_sum:,.2f}")
            print(f"      Calculation: {party_weight_sum:,.2f} / {total_weight:,.2f} × 100")
            print(f"      Normalized Vote Share: {normalized_pct:.2f}%")
            
            # Show sample weight values
            if count > 0:
                sample_weights = party_weights.head(5)
                print(f"      Sample Weights (first 5): {[round(w, 4) for w in sample_weights]}")
                print(f"      Note: Each record contributes its weight value to the party sum")
        
        # Verify with calculator
        overall_data = self.calculator.df[
            self.calculator.df['Survey Date'] <= self.reference_date
        ].copy()
        norm_vs = self.calculator.calculate_vote_share(
            overall_data,
            weight_column=weight_column,
            use_weights=True
        )
        
        print(f"\n  Verification (from VoteShareCalculator):")
        print(f"    Sample: {norm_vs.get('sample', 0):,}")
        print(f"    AITC: {norm_vs.get('AITC', 0):.2f}%")
        print(f"    BJP: {norm_vs.get('BJP', 0):.2f}%")
        print(f"    LEFT: {norm_vs.get('LEFT', 0):.2f}%")
        print(f"    INC: {norm_vs.get('INC', 0):.2f}%")
        print(f"    Others: {norm_vs.get('Others', 0):.2f}%")
        print(f"    NWR: {norm_vs.get('NWR', 0):.2f}%")
    
    def audit_7dma_calculation(self):
        """Audit trail for 7 DMA calculation"""
        print("\n" + "="*80)
        print("AUDIT: 7 DMA (7-Day Moving Average) CALCULATION")
        print("="*80)
        
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        # Use 7DMA-specific weights for 7DMA calculations
        weight_column = 'Weight - with Vote Share - AE 2021 - Region L7D'
        
        print(f"\n7 DMA Logic:")
        print(f"  Reference Date: {self.reference_date.date()}")
        print(f"  Calculation: Reference date is NOT included - use one day before as the last day")
        print(f"  So if reference_date is {self.reference_date.date()}, use {self.reference_date.date() - timedelta(days=1)} as the last day (day 7)")
        print(f"  Date Range: {self.reference_date.date() - timedelta(days=7)} to {self.reference_date.date() - timedelta(days=1)}")
        print(f"  Total Days: 7 days (Days 1-7, ending one day before reference date)")
        
        # Calculate cutoff date - end_date is one day before reference_date
        end_date = self.reference_date - timedelta(days=1)
        cutoff_date = end_date - timedelta(days=6)  # 6 days before end_date = 7 days total
        
        print(f"\nDate Range Details:")
        print(f"  Day 1 (Start): {cutoff_date.date()}")
        print(f"  Day 7 (End): {end_date.date()} (one day before reference date)")
        print(f"  Reference Date: {self.reference_date.date()} (NOT included)")
        print(f"  Days included: 7 days (ending on {end_date.date()})")
        
        # Filter data for 7 DMA
        dma7_data = self.df_filtered[
            (self.df_filtered['Survey Date'] >= cutoff_date) & 
            (self.df_filtered['Survey Date'] <= end_date)
        ].copy()
        
        # Sample size: only count records with non-empty responses to main question
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        sample_size_7dma = len(dma7_data[dma7_data[vote_question].notna()].copy()) if vote_question in dma7_data.columns else len(dma7_data)
        
        print(f"\nData Filtering:")
        print(f"  Date Filter: {cutoff_date.date()} to {end_date.date()}")
        print(f"  Sample Size: {sample_size_7dma:,} records (only non-empty responses)")
        
        # Show date distribution
        date_counts = dma7_data.groupby('Survey Date').size().sort_index()
        print(f"\n  Date Distribution:")
        total_records = 0
        for date, count in date_counts.items():
            print(f"    {date.date()}: {count:,} records")
            total_records += count
        print(f"  Total: {total_records:,} records")
        
        # Weight statistics
        data_with_weights = dma7_data[
            (dma7_data[vote_question].notna()) & 
            (dma7_data[weight_column].notna())
        ].copy()
        
        weights = pd.to_numeric(data_with_weights[weight_column], errors='coerce')
        total_weight = weights.sum()
        
        print(f"\nWeight Application:")
        print(f"  Records with valid weights: {len(data_with_weights):,}")
        print(f"  Total Weight Sum: {total_weight:,.2f}")
        print(f"  Average Weight: {weights.mean():.4f}")
        
        # Categorize parties
        def categorize_party(code):
            if pd.isna(code):
                return 'NWR'
            try:
                code = int(code)
            except:
                return 'NWR'
            
            if code == 1:
                return 'AITC'
            elif code == 2:
                return 'BJP'
            elif code == 3:
                return 'INC'
            elif code == 4:
                return 'LEFT'
            elif code in [12, 44]:
                return 'Others'
            elif code in [55, 66, 67, 77, 78, 88]:
                return 'NWR'
            else:
                return 'Others'
        
        data_with_weights['party_category'] = data_with_weights[vote_question].apply(categorize_party)
        
        print(f"\n7 DMA Normalized Vote Share Calculation:")
        print(f"  Formula: (Σ Weight for Party / Σ Total Weights) × 100")
        print(f"  Total Weight Sum: {total_weight:,.2f}")
        print(f"\n  Step-by-Step Calculation:")
        print(f"  Formula: For each party, sum all weights for that party in 7-day window, then divide by total weight sum")
        print(f"  Weight Column: {weight_column} (7DMA-specific weights)")
        print(f"  Note: 7DMA calculations use 'Weight - with Vote Share - AE 2021 - Region L7D' instead of regular weights")
        print(f"  Total Weight Sum: {total_weight:,.2f}")
        print(f"  Each record is multiplied by its weight, then summed by party")
        
        for party in ['AITC', 'BJP', 'INC', 'LEFT', 'Others', 'NWR']:
            party_mask = data_with_weights['party_category'] == party
            party_weights = weights[party_mask]
            party_weight_sum = party_weights.sum()
            
            normalized_pct = (party_weight_sum / total_weight) * 100
            
            count = party_mask.sum()
            avg_weight = party_weights.mean() if len(party_weights) > 0 else 0
            
            print(f"\n    {party}:")
            print(f"      Record Count: {count:,}")
            print(f"      Average Weight per Record: {avg_weight:,.4f}")
            print(f"      Weight Sum (Σ weights for {party} in 7-day window): {party_weight_sum:,.2f}")
            print(f"      Calculation: {party_weight_sum:,.2f} / {total_weight:,.2f} × 100")
            print(f"      7 DMA Normalized Vote Share: {normalized_pct:.2f}%")
            
            # Show sample weight values
            if count > 0:
                sample_weights = party_weights.head(5)
                print(f"      Sample Weights (first 5): {[round(w, 4) for w in sample_weights]}")
                print(f"      Note: Each record contributes its weight value to the party sum in this 7-day window")
        
        # Verify with calculator using L7D weights
        dma7_calc = self.calculator.filter_by_date_range(
            days=7,
            exclude_latest=False,
            reference_date=self.reference_date
        )
        dma7_vs = self.calculator.calculate_vote_share(
            dma7_calc,
            weight_column='Weight - with Vote Share - AE 2021 - Region L7D',  # Use L7D weights
            use_weights=True
        )
        
        print(f"\n  Verification (from VoteShareCalculator):")
        print(f"    Sample: {dma7_vs.get('sample', 0):,}")
        print(f"    AITC: {dma7_vs.get('AITC', 0):.2f}%")
        print(f"    BJP: {dma7_vs.get('BJP', 0):.2f}%")
        print(f"    LEFT: {dma7_vs.get('LEFT', 0):.2f}%")
        print(f"    INC: {dma7_vs.get('INC', 0):.2f}%")
        print(f"    Others: {dma7_vs.get('Others', 0):.2f}%")
        print(f"    NWR: {dma7_vs.get('NWR', 0):.2f}%")
    
    def audit_slide_6_calculation(self):
        """Audit trail for Slide 6 (Overall Normalized Vote Share Chart)"""
        print("\n" + "="*80)
        print("AUDIT: SLIDE 6 - OVERALL NORMALIZED VOTE SHARE CHART")
        print("="*80)
        
        print(f"\nChart Description:")
        print(f"  Type: Overall Normalized Vote Share (Cumulative)")
        print(f"  Data Points: 16 days ending at {self.reference_date.date()}")
        print(f"  Dates: Oct 15-31 (excluding Oct 19)")
        
        # Calculate dates (matching generate_complete_report.py logic)
        num_days = 16
        target_dates = []
        start_offset = num_days
        all_dates = []
        for i in range(start_offset, -1, -1):
            date = self.reference_date - timedelta(days=i)
            all_dates.append(date)
        
        # Exclude Oct 19
        oct_19 = self.reference_date - timedelta(days=12)
        target_dates = [d for d in all_dates if d != oct_19]
        if len(target_dates) > num_days:
            target_dates = target_dates[:num_days]
        
        print(f"\nDate Range:")
        print(f"  First Date: {target_dates[0].date()}")
        print(f"  Last Date: {target_dates[-1].date()}")
        print(f"  Total Dates: {len(target_dates)}")
        print(f"  Excluded: Oct 19")
        
        print(f"\nCalculation Method:")
        print(f"  For each date, calculate Overall Normalized Vote Share")
        print(f"  using ALL data from start up to that date (cumulative)")
        print(f"  Formula: (Σ Weight for Party up to Date / Σ Total Weights up to Date) × 100")
        
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        # Show calculation for first and last dates
        print(f"\nExample Calculations:")
        
        # First date
        first_date = target_dates[0]
        first_data = self.df_filtered[self.df_filtered['Survey Date'] <= first_date].copy()
        first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
        first_data_valid = first_data[
            (first_data['8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'].notna()) &
            (first_weights.notna())
        ].copy()
        first_weights_valid = pd.to_numeric(first_data_valid[weight_column], errors='coerce')
        first_total_weight = first_weights_valid.sum()
        
        print(f"\n  Date 1: {first_date.date()}")
        print(f"    Data Range: {self.df_filtered['Survey Date'].min().date()} to {first_date.date()}")
        print(f"    Records: {len(first_data_valid):,}")
        print(f"    Total Weight: {first_total_weight:,.2f}")
        
        # Last date
        last_date = target_dates[-1]
        last_data = self.df_filtered[self.df_filtered['Survey Date'] <= last_date].copy()
        last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
        last_data_valid = last_data[
            (last_data['8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'].notna()) &
            (last_weights.notna())
        ].copy()
        last_weights_valid = pd.to_numeric(last_data_valid[weight_column], errors='coerce')
        last_total_weight = last_weights_valid.sum()
        
        print(f"\n  Date {len(target_dates)}: {last_date.date()}")
        print(f"    Data Range: {self.df_filtered['Survey Date'].min().date()} to {last_date.date()}")
        print(f"    Records: {len(last_data_valid):,}")
        print(f"    Total Weight: {last_total_weight:,.2f}")
        print(f"    Note: This is cumulative - includes all data from start to this date")
    
    def audit_slide_7_calculation(self):
        """Audit trail for Slide 7 (7 DMA Chart)"""
        print("\n" + "="*80)
        print("AUDIT: SLIDE 7 - 7 DMA CHART")
        print("="*80)
        
        print(f"\nChart Description:")
        print(f"  Type: 7 DMA (7-Day Moving Average) Normalized Vote Share")
        print(f"  Data Points: 13 days ending at {self.reference_date.date()}")
        print(f"  Dates: Oct 18-31 (excluding Oct 19)")
        print(f"  Chart Categories: Excel serial numbers (45948, 45950, ..., 45961) matching final PPT DateAxis format")
        print(f"  Note: Chart uses DateAxis with Excel serial numbers, not date strings, to match final PPT")
        
        # Calculate dates (matching generate_complete_report.py logic)
        num_days = 13
        start_offset = num_days + 1
        all_dates = []
        for i in range(start_offset, -1, -1):
            date = self.reference_date - timedelta(days=i)
            all_dates.append(date)
        
        # Exclude Oct 19
        oct_19 = self.reference_date - timedelta(days=12)
        target_dates = [d for d in all_dates if d != oct_19]
        if len(target_dates) > num_days:
            target_dates = target_dates[-num_days:]
        
        print(f"\nDate Range:")
        print(f"  First Date: {target_dates[0].date()}")
        print(f"  Last Date: {target_dates[-1].date()}")
        print(f"  Total Dates: {len(target_dates)}")
        print(f"  Excluded: Oct 19")
        
        print(f"\nCalculation Method:")
        print(f"  For each date, calculate 7 DMA Normalized Vote Share")
        print(f"  using data from (date - 7 days) to (date - 1 day) = 7 days total, ending one day before the date")
        print(f"  Formula: (Σ Weight for Party in 7-day window / Σ Total Weights in 7-day window) × 100")
        print(f"  Logic: For each date point, the reference date for that 7 DMA is one day before the date")
        print(f"  So if date is Oct 31, 7 DMA uses Oct 24-30 (7 days ending on Oct 30, excluding Oct 31)")
        
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        # Show calculation for first and last dates
        print(f"\nExample Calculations:")
        
        # First date
        first_date = target_dates[0]
        # For 7 DMA: end_date is one day before the date point
        first_end_date = first_date - timedelta(days=1)
        first_cutoff = first_end_date - timedelta(days=6)
        first_data = self.df_filtered[
            (self.df_filtered['Survey Date'] >= first_cutoff) &
            (self.df_filtered['Survey Date'] <= first_end_date) &
            (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1))
        ].copy()
        
        first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
        first_data_valid = first_data[
            (first_data['8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'].notna()) &
            (first_weights.notna())
        ].copy()
        first_weights_valid = pd.to_numeric(first_data_valid[weight_column], errors='coerce')
        first_total_weight = first_weights_valid.sum()
        
        print(f"\n  Date 1: {first_date.date()}")
        print(f"    7 DMA Window: {first_cutoff.date()} to {first_end_date.date()} (7 days, ending one day before {first_date.date()})")
        print(f"    Records: {len(first_data_valid):,}")
        print(f"    Total Weight: {first_total_weight:,.2f}")
        
        # Last date
        last_date = target_dates[-1]
        # For 7 DMA: end_date is one day before the date point
        last_end_date = last_date - timedelta(days=1)
        last_cutoff = last_end_date - timedelta(days=6)
        last_data = self.df_filtered[
            (self.df_filtered['Survey Date'] >= last_cutoff) &
            (self.df_filtered['Survey Date'] <= last_end_date) &
            (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1))
        ].copy()
        
        last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
        last_data_valid = last_data[
            (last_data['8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'].notna()) &
            (last_weights.notna())
        ].copy()
        last_weights_valid = pd.to_numeric(last_data_valid[weight_column], errors='coerce')
        last_total_weight = last_weights_valid.sum()
        
        print(f"\n  Date {len(target_dates)}: {last_date.date()}")
        print(f"    7 DMA Window: {last_cutoff.date()} to {last_end_date.date()} (7 days, ending one day before {last_date.date()})")
        print(f"    Records: {len(last_data_valid):,}")
        print(f"    Total Weight: {last_total_weight:,.2f}")
    
    def audit_demographic_calculation(self):
        """Audit trail for Demographic calculations"""
        print("\n" + "="*80)
        print("AUDIT: DEMOGRAPHIC BREAKDOWN CALCULATIONS")
        print("="*80)
        
        # Use different weights for overall vs 7DMA vs 15DMA
        weight_column_overall = 'Weight - with Vote Share - AE 2021 - Region'
        weight_column_7dma = 'Weight - with Vote Share - AE 2021 - Region L7D'
        weight_column_15dma = 'Weight - with Vote Share - AE 2021 - Region L15D'
        
        print(f"\nDemographic Calculations Overview:")
        print(f"  Date Filter (Overall): All data up to {self.reference_date.date()}")
        print(f"  Date Filter (7 DMA): Last 7 days ending one day before {self.reference_date.date()}")
        print(f"  Date Filter (15 DMA): Last 15 days ending one day before {self.reference_date.date()}")
        print(f"  Weight Column (Overall): {weight_column_overall}")
        print(f"  Weight Column (7 DMA): {weight_column_7dma} (7DMA-specific weights)")
        print(f"  Weight Column (15 DMA): {weight_column_15dma} (15DMA-specific weights)")
        print(f"  Method: Same as Normalized Vote Share, but filtered by demographic category")
        print(f"  Formula (Overall): (Σ Weight for Party in Demographic / Σ Total Weights in Demographic) × 100")
        print(f"  Formula (7 DMA): (Σ Weight for Party in Demographic (7-day window) / Σ Total Weights in Demographic (7-day window)) × 100")
        print(f"  Formula (15 DMA): (Σ Weight for Party in Demographic (15-day window) / Σ Total Weights in Demographic (15-day window)) × 100")
        print(f"  Note: 7DMA calculations use '{weight_column_7dma}' instead of regular weights")
        print(f"  Note: 15DMA calculations use '{weight_column_15dma}' instead of regular weights")
        
        # Show detailed example for Gender
        if 'Gender' in self.df_filtered.columns:
            print(f"\nDetailed Example: Gender Breakdown")
            print(f"  Categories: 1 = Male, 2 = Female")
            
            # Overall data
            overall_data = self.df_filtered[self.df_filtered['Survey Date'] <= self.reference_date].copy()
            
            # 7 DMA data (ending one day before reference date)
            end_date_7dma = self.reference_date - timedelta(days=1)
            cutoff_7dma = end_date_7dma - timedelta(days=6)
            dma7_data = self.df[
                (self.df['Survey Date'] >= cutoff_7dma) & 
                (self.df['Survey Date'] <= end_date_7dma)
            ].copy()
            
            # 15 DMA data (ending one day before reference date)
            end_date_15dma = self.reference_date - timedelta(days=1)
            cutoff_15dma = end_date_15dma - timedelta(days=14)
            dma15_data = self.df[
                (self.df['Survey Date'] >= cutoff_15dma) & 
                (self.df['Survey Date'] <= end_date_15dma)
            ].copy()
            
            for gender_code in [1, 2]:
                gender_name = 'Male' if gender_code == 1 else 'Female'
                gender_overall_data = overall_data[overall_data['Gender'] == gender_code].copy()
                gender_dma7_data = dma7_data[dma7_data['Gender'] == gender_code].copy()
                gender_dma15_data = dma15_data[dma15_data['Gender'] == gender_code].copy()
                
                print(f"\n  {gender_name} (Code {gender_code}):")
                print(f"    Overall Records: {len(gender_overall_data):,}")
                print(f"    7 DMA Records: {len(gender_dma7_data):,}")
                print(f"    15 DMA Records: {len(gender_dma15_data):,}")
                
                # Calculate overall vote share for this demographic using overall weights
                overall_vote_shares = self.calculator.calculate_vote_share(
                    gender_overall_data,
                    weight_column=weight_column_overall,
                    use_weights=True
                )
                
                # Calculate 7 DMA vote share for this demographic using L7D weights
                # Check if L7D weights are available
                l7d_available = gender_dma7_data[weight_column_7dma].notna().sum() if weight_column_7dma in gender_dma7_data.columns else 0
                total_records_7dma = len(gender_dma7_data)
                if l7d_available > 0 and (l7d_available / total_records_7dma) >= 0.5:
                    gender_dma7_data_with_weights = gender_dma7_data[gender_dma7_data[weight_column_7dma].notna()].copy()
                    dma7_weight_col = weight_column_7dma
                else:
                    gender_dma7_data_with_weights = gender_dma7_data.copy()
                    dma7_weight_col = weight_column_overall
                
                dma7_vote_shares = self.calculator.calculate_vote_share(
                    gender_dma7_data_with_weights,
                    weight_column=dma7_weight_col,
                    use_weights=True
                )
                # Sample size: count all records with valid votes from original data
                vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
                if l7d_available > 0 and (l7d_available / total_records_7dma) >= 0.5:
                    dma7_vote_shares['sample'] = len(gender_dma7_data[gender_dma7_data[vote_question].notna()].copy())
                
                # Calculate 15 DMA vote share for this demographic using L15D weights
                # Check if L15D weights are available
                l15d_available = gender_dma15_data[weight_column_15dma].notna().sum() if weight_column_15dma in gender_dma15_data.columns else 0
                total_records_15dma = len(gender_dma15_data)
                if l15d_available > 0 and (l15d_available / total_records_15dma) >= 0.5:
                    gender_dma15_data_with_weights = gender_dma15_data[gender_dma15_data[weight_column_15dma].notna()].copy()
                    dma15_weight_col = weight_column_15dma
                else:
                    gender_dma15_data_with_weights = gender_dma15_data.copy()
                    dma15_weight_col = weight_column_overall
                
                dma15_vote_shares = self.calculator.calculate_vote_share(
                    gender_dma15_data_with_weights,
                    weight_column=dma15_weight_col,
                    use_weights=True
                )
                # Sample size: count all records with valid votes from original data
                if l15d_available > 0 and (l15d_available / total_records_15dma) >= 0.5:
                    dma15_vote_shares['sample'] = len(gender_dma15_data[gender_dma15_data[vote_question].notna()].copy())
                
                # Weight statistics
                overall_weights = pd.to_numeric(gender_overall_data[weight_column_overall], errors='coerce')
                dma7_weights = pd.to_numeric(gender_dma7_data_with_weights[dma7_weight_col], errors='coerce')
                dma15_weights = pd.to_numeric(gender_dma15_data_with_weights[dma15_weight_col], errors='coerce')
                overall_weight_sum = overall_weights.sum()
                dma7_weight_sum = dma7_weights.sum()
                dma15_weight_sum = dma15_weights.sum()
                
                print(f"\n    Overall Normalized Vote Share:")
                print(f"      Total Weight Sum: {overall_weight_sum:,.2f}")
                print(f"      Sample: {overall_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {overall_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {overall_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {overall_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {overall_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {overall_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {overall_vote_shares.get('NWR', 0):.1f}%")
                overall_margin = overall_vote_shares.get('AITC', 0) - overall_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {overall_margin:.1f}%")
                
                print(f"\n    7 DMA Normalized Vote Share:")
                print(f"      Date Range: {cutoff_7dma.date()} to {end_date_7dma.date()} (7 days, excluding {self.reference_date.date()})")
                print(f"      Weight Column: {dma7_weight_col}")
                print(f"      L7D Available: {l7d_available:,} ({l7d_available/total_records_7dma*100:.1f}%)" if total_records_7dma > 0 else "      L7D Available: 0")
                print(f"      Total Weight Sum: {dma7_weight_sum:,.2f}")
                print(f"      Sample: {dma7_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {dma7_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {dma7_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {dma7_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {dma7_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {dma7_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {dma7_vote_shares.get('NWR', 0):.1f}%")
                dma7_margin = dma7_vote_shares.get('AITC', 0) - dma7_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {dma7_margin:.1f}%")
                
                print(f"\n    15 DMA Normalized Vote Share:")
                print(f"      Date Range: {cutoff_15dma.date()} to {end_date_15dma.date()} (15 days, excluding {self.reference_date.date()})")
                print(f"      Weight Column: {dma15_weight_col}")
                print(f"      L15D Available: {l15d_available:,} ({l15d_available/total_records_15dma*100:.1f}%)" if total_records_15dma > 0 else "      L15D Available: 0")
                print(f"      Total Weight Sum: {dma15_weight_sum:,.2f}")
                print(f"      Sample: {dma15_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {dma15_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {dma15_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {dma15_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {dma15_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {dma15_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {dma15_vote_shares.get('NWR', 0):.1f}%")
                dma15_margin = dma15_vote_shares.get('AITC', 0) - dma15_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {dma15_margin:.1f}%")
                
                print(f"\n    Calculation Method:")
                print(f"      1. Filter data by {gender_name} (Code {gender_code})")
                print(f"      2. Apply date filter:")
                print(f"         - Overall: up to {self.reference_date.date()}")
                print(f"         - 7 DMA: {cutoff_7dma.date()} to {end_date_7dma.date()} (7 days, excluding {self.reference_date.date()})")
                print(f"         - 15 DMA: {cutoff_15dma.date()} to {end_date_15dma.date()} (15 days, excluding {self.reference_date.date()})")
                print(f"      3. Apply weights:")
                print(f"         - Overall: '{weight_column_overall}' column")
                print(f"         - 7 DMA: '{dma7_weight_col}' column (L7D if >=50% available, else regular)")
                print(f"         - 15 DMA: '{dma15_weight_col}' column (L15D if >=50% available, else regular)")
                print(f"      4. Sum weights by party")
                print(f"      5. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
                print(f"      6. Same normalization method as overall, but only using {gender_name} records")
        
        # Show detailed example for Social Category
        social_category_col = '21. Which social category do you belong to?'
        if social_category_col in self.df_filtered.columns:
            print(f"\n\nDetailed Example: Social Category (Caste) Breakdown")
            print(f"  Column: {social_category_col}")
            print(f"  Categories: 1=General, 2=OBC, 3=SC, 4=ST")
            print(f"  Table Categories: General+OBC (combined), SC, ST")
            
            # Overall data
            overall_data = self.df_filtered[self.df_filtered['Survey Date'] <= self.reference_date].copy()
            
            # 7 DMA data (ending one day before reference date)
            end_date_7dma = self.reference_date - timedelta(days=1)
            cutoff_7dma = end_date_7dma - timedelta(days=6)
            dma7_data = self.df[
                (self.df['Survey Date'] >= cutoff_7dma) & 
                (self.df['Survey Date'] <= end_date_7dma)
            ].copy()
            
            # 15 DMA data (ending one day before reference date)
            end_date_15dma = self.reference_date - timedelta(days=1)
            cutoff_15dma = end_date_15dma - timedelta(days=14)
            dma15_data = self.df[
                (self.df['Survey Date'] >= cutoff_15dma) & 
                (self.df['Survey Date'] <= end_date_15dma)
            ].copy()
            
            # Show code distribution
            print(f"\n  Code Distribution in Data:")
            code_counts = overall_data[social_category_col].value_counts()
            for code, count in code_counts.items():
                if pd.notna(code) and code != 'resp_social_cat':
                    try:
                        code_int = int(code)
                        code_name = {1: 'General', 2: 'OBC', 3: 'SC', 4: 'ST'}.get(code_int, f'Code {code_int}')
                        print(f"    Code {code_int} ({code_name}): {count:,} records ({count/len(overall_data)*100:.2f}%)")
                    except:
                        pass
            
            # Calculate for each category
            categories_to_calc = [
                ('General+OBC', [1, 2]),
                ('SC', [3]),
                ('ST', [4])
            ]
            
            for category_name, codes in categories_to_calc:
                print(f"\n  {category_name} (Codes {codes}):")
                
                # Overall data
                category_overall_data = overall_data[overall_data[social_category_col].isin(codes)].copy()
                category_dma7_data = dma7_data[dma7_data[social_category_col].isin(codes)].copy()
                category_dma15_data = dma15_data[dma15_data[social_category_col].isin(codes)].copy()
                
                print(f"    Overall Records: {len(category_overall_data):,}")
                print(f"    7 DMA Records: {len(category_dma7_data):,}")
                print(f"    15 DMA Records: {len(category_dma15_data):,}")
                
                # Calculate overall vote share using overall weights
                overall_vote_shares = self.calculator.calculate_vote_share(
                    category_overall_data,
                    weight_column=weight_column_overall,
                    use_weights=True
                )
                
                # Calculate 7 DMA vote share using L7D weights (with fallback)
                l7d_available = category_dma7_data[weight_column_7dma].notna().sum() if weight_column_7dma in category_dma7_data.columns else 0
                total_records_7dma = len(category_dma7_data)
                if l7d_available > 0 and (l7d_available / total_records_7dma) >= 0.5:
                    category_dma7_data_with_weights = category_dma7_data[category_dma7_data[weight_column_7dma].notna()].copy()
                    dma7_weight_col = weight_column_7dma
                else:
                    category_dma7_data_with_weights = category_dma7_data.copy()
                    dma7_weight_col = weight_column_overall
                
                dma7_vote_shares = self.calculator.calculate_vote_share(
                    category_dma7_data_with_weights,
                    weight_column=dma7_weight_col,
                    use_weights=True
                )
                vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
                if l7d_available > 0 and (l7d_available / total_records_7dma) >= 0.5:
                    dma7_vote_shares['sample'] = len(category_dma7_data[category_dma7_data[vote_question].notna()].copy())
                
                # Calculate 15 DMA vote share using L15D weights (with fallback)
                l15d_available = category_dma15_data[weight_column_15dma].notna().sum() if weight_column_15dma in category_dma15_data.columns else 0
                total_records_15dma = len(category_dma15_data)
                if l15d_available > 0 and (l15d_available / total_records_15dma) >= 0.5:
                    category_dma15_data_with_weights = category_dma15_data[category_dma15_data[weight_column_15dma].notna()].copy()
                    dma15_weight_col = weight_column_15dma
                else:
                    category_dma15_data_with_weights = category_dma15_data.copy()
                    dma15_weight_col = weight_column_overall
                
                dma15_vote_shares = self.calculator.calculate_vote_share(
                    category_dma15_data_with_weights,
                    weight_column=dma15_weight_col,
                    use_weights=True
                )
                if l15d_available > 0 and (l15d_available / total_records_15dma) >= 0.5:
                    dma15_vote_shares['sample'] = len(category_dma15_data[category_dma15_data[vote_question].notna()].copy())
                
                # Weight statistics
                overall_weights = pd.to_numeric(category_overall_data[weight_column_overall], errors='coerce')
                dma7_weights = pd.to_numeric(category_dma7_data_with_weights[dma7_weight_col], errors='coerce')
                dma15_weights = pd.to_numeric(category_dma15_data_with_weights[dma15_weight_col], errors='coerce')
                overall_weight_sum = overall_weights.sum()
                dma7_weight_sum = dma7_weights.sum()
                dma15_weight_sum = dma15_weights.sum()
                
                print(f"\n    Overall Normalized Vote Share:")
                print(f"      Total Weight Sum: {overall_weight_sum:,.2f}")
                print(f"      Sample: {overall_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {overall_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {overall_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {overall_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {overall_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {overall_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {overall_vote_shares.get('NWR', 0):.1f}%")
                overall_margin = overall_vote_shares.get('AITC', 0) - overall_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {overall_margin:.1f}%")
                
                print(f"\n    7 DMA Normalized Vote Share:")
                print(f"      Date Range: {cutoff_7dma.date()} to {end_date_7dma.date()} (7 days, excluding {self.reference_date.date()})")
                print(f"      Weight Column: {dma7_weight_col}")
                print(f"      L7D Available: {l7d_available:,} ({l7d_available/total_records_7dma*100:.1f}%)" if total_records_7dma > 0 else "      L7D Available: 0")
                print(f"      Total Weight Sum: {dma7_weight_sum:,.2f}")
                print(f"      Sample: {dma7_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {dma7_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {dma7_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {dma7_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {dma7_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {dma7_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {dma7_vote_shares.get('NWR', 0):.1f}%")
                dma7_margin = dma7_vote_shares.get('AITC', 0) - dma7_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {dma7_margin:.1f}%")
                
                print(f"\n    15 DMA Normalized Vote Share:")
                print(f"      Date Range: {cutoff_15dma.date()} to {end_date_15dma.date()} (15 days, excluding {self.reference_date.date()})")
                print(f"      Weight Column: {dma15_weight_col}")
                print(f"      L15D Available: {l15d_available:,} ({l15d_available/total_records_15dma*100:.1f}%)" if total_records_15dma > 0 else "      L15D Available: 0")
                print(f"      Total Weight Sum: {dma15_weight_sum:,.2f}")
                print(f"      Sample: {dma15_vote_shares.get('sample', 0):,}")
                print(f"      AITC: {dma15_vote_shares.get('AITC', 0):.1f}%")
                print(f"      BJP: {dma15_vote_shares.get('BJP', 0):.1f}%")
                print(f"      LEFT: {dma15_vote_shares.get('LEFT', 0):.1f}%")
                print(f"      INC: {dma15_vote_shares.get('INC', 0):.1f}%")
                print(f"      Others: {dma15_vote_shares.get('Others', 0):.1f}%")
                print(f"      NWR: {dma15_vote_shares.get('NWR', 0):.1f}%")
                dma15_margin = dma15_vote_shares.get('AITC', 0) - dma15_vote_shares.get('BJP', 0)
                print(f"      Margin (AITC - BJP): {dma15_margin:.1f}%")
                
                print(f"\n    Calculation Method:")
                print(f"      1. Filter data by {category_name} (Codes {codes})")
                print(f"      2. Apply date filter:")
                print(f"         - Overall: up to {self.reference_date.date()}")
                print(f"         - 7 DMA: {cutoff_7dma.date()} to {end_date_7dma.date()} (7 days, excluding {self.reference_date.date()})")
                print(f"         - 15 DMA: {cutoff_15dma.date()} to {end_date_15dma.date()} (15 days, excluding {self.reference_date.date()})")
                print(f"      3. Apply weights:")
                print(f"         - Overall: '{weight_column_overall}' column")
                print(f"         - 7 DMA: '{dma7_weight_col}' column (L7D if >=50% available, else regular)")
                print(f"         - 15 DMA: '{dma15_weight_col}' column (L15D if >=50% available, else regular)")
                print(f"      4. Sum weights by party")
                print(f"      5. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
                print(f"      6. Same normalization method as overall, but only using {category_name} records")
        
        # Show summary for other demographics
        print(f"\n\n  Other Demographic Categories:")
        print(f"    - Location: 1=Urban, 2=Rural")
        print(f"    - Religion: 1=Hindu, 2=Muslim, Others=3+")
        print(f"    - Age: Numeric age grouped into ranges (18-25, 26-34, 36-50, 50+)")
        print(f"    Note: All use the same calculation method as examples above")
    
    def audit_demographic_charts(self):
        """Audit trail for Demographic Chart calculations (Slides 14-23)"""
        print("\n" + "="*80)
        print("AUDIT: DEMOGRAPHIC CHARTS (SLIDES 14-23)")
        print("="*80)
        
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nDemographic Charts Overview:")
        print(f"  Chart Type: Overall Normalized Vote Share (Cumulative) Line Chart")
        print(f"  Data Points: 16 days ending at {self.reference_date.date()}")
        print(f"  Dates: Oct 15-31 (excluding Oct 19)")
        print(f"  Method: Same as Slide 6 (Overall Normalized), but filtered by demographic category")
        print(f"  Formula: For each date, calculate Overall Normalized Vote Share using ALL data up to that date,")
        print(f"           filtered by demographic category")
        print(f"  Formula: (Σ Weight for Party in Demographic up to Date / Σ Total Weights in Demographic up to Date) × 100")
        
        # Define demographic charts
        demographic_charts = [
            ('Gender', 'Male', 1),
            ('Gender', 'Female', 2),
            ('Location', 'Urban', 1),
            ('Location', 'Rural', 2),
            ('Religion', 'Hindu', 1),
            ('Religion', 'Muslim', 2),
            ('Social Category', 'General+OBC', [1, 2]),
            ('Social Category', 'SC', 3),
            ('Social Category', 'ST', 4),
            ('Age', '18-25', (18, 25)),
            ('Age', '26-34', (26, 34)),
            ('Age', '36-50', (36, 50)),
            ('Age', '50+', (51, None)),
        ]
        
        # Get demographic column map
        demographic_column_map = {
            'Gender': 'Gender',
            'Location': 'Residential locality type',
            'Religion': '20. Could you please tell me the religion that you belong to?',
            'Social Category': '21. Which social category do you belong to?',
            'Age': 'Could you please tell me your age in complete years?'
        }
        
        # Show example calculations for first few demographics
        print(f"\nExample Calculations (First 3 Demographics):")
        
        for demo_type, demo_value, demo_code in demographic_charts[:3]:
            print(f"\n  {demo_type} = {demo_value}:")
            
            demo_col = demographic_column_map.get(demo_type)
            if not demo_col or demo_col not in self.df_filtered.columns:
                print(f"    Warning: Column not found")
                continue
            
            # Create filter
            if demo_type == 'Gender':
                demo_filter = self.df_filtered[demo_col] == demo_code
            elif demo_type == 'Location':
                demo_filter = self.df_filtered[demo_col] == demo_code
            elif demo_type == 'Religion':
                demo_filter = self.df_filtered[demo_col] == demo_code
            else:
                continue
            
            # Calculate for first and last dates
            from datetime import timedelta
            num_days = 16
            start_offset = num_days
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[:num_days]
            
            # First date
            first_date = target_dates[0]
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= first_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                demo_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= last_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                demo_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            print(f"    Date Range: {first_date.date()} to {last_date.date()} (16 dates)")
            print(f"    First Date ({first_date.date()}):")
            print(f"      Records: {len(first_data):,}")
            print(f"      AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"    Last Date ({last_date.date()}):")
            print(f"      Records: {len(last_data):,}")
            print(f"      AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"    Note: Cumulative calculation - each date includes all data from start to that date")
        
        # Detailed calculation for Slide 23 (Age 50+)
        print(f"\n\nDetailed Calculation for Slide 23 (Age 50+):")
        age_col = 'Could you please tell me your age in complete years?'
        if age_col in self.df_filtered.columns:
            age_numeric = pd.to_numeric(self.df_filtered[age_col], errors='coerce')
            age_50_plus_filter = age_numeric > 50
            age_50_plus_data = self.df_filtered[age_50_plus_filter].copy()
            
            print(f"  Filter: Age > 50 years")
            print(f"  Total Records: {len(age_50_plus_data):,}")
            
            # Calculate for first and last dates
            from datetime import timedelta
            num_days = 16
            start_offset = num_days
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[:num_days]
            
            # First date
            first_date = target_dates[0]
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= first_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                age_50_plus_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= last_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                age_50_plus_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            # Weight statistics
            first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
            last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
            
            print(f"\n  First Date ({first_date.date()}):")
            print(f"    Records: {len(first_data):,}")
            print(f"    Total Weight Sum: {first_weights.sum():,.2f}")
            print(f"    Sample: {first_vs.get('sample', 0):,}")
            print(f"    AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"    BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"    LEFT: {first_vs.get('LEFT', 0):.1f}%")
            print(f"    INC: {first_vs.get('INC', 0):.1f}%")
            print(f"    Others: {first_vs.get('Others', 0):.1f}%")
            print(f"    NWR: {first_vs.get('NWR', 0):.1f}%")
            
            print(f"\n  Last Date ({last_date.date()}):")
            print(f"    Records: {len(last_data):,}")
            print(f"    Total Weight Sum: {last_weights.sum():,.2f}")
            print(f"    Sample: {last_vs.get('sample', 0):,}")
            print(f"    AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"    BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"    LEFT: {last_vs.get('LEFT', 0):.1f}%")
            print(f"    INC: {last_vs.get('INC', 0):.1f}%")
            print(f"    Others: {last_vs.get('Others', 0):.1f}%")
            print(f"    NWR: {last_vs.get('NWR', 0):.1f}%")
            
            print(f"\n  Calculation Method:")
            print(f"    1. Filter data by Age > 50 years")
            print(f"    2. For each date, filter data up to that date (cumulative)")
            print(f"    3. Apply weights from '{weight_column}' column")
            print(f"    4. Sum weights by party")
            print(f"    5. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
            print(f"    6. Each date point shows cumulative normalized vote share up to that date")
        
        # Detailed calculations for each Overall demographic chart
        print(f"\n\nDetailed Calculations for Each Overall Demographic Chart:")
        
        for slide_num, (demo_type, demo_value, demo_code) in enumerate(demographic_charts, start=11):
            print(f"\n  Slide {slide_num}: {demo_type}={demo_value}")
            
            demo_col = demographic_column_map.get(demo_type)
            if not demo_col or demo_col not in self.df_filtered.columns:
                print(f"    Warning: Column not found")
                continue
            
            # Create filter based on demographic type
            if demo_type == 'Gender':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code}"
            elif demo_type == 'Location':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code} ({'Urban' if demo_code == 1 else 'Rural'})"
            elif demo_type == 'Religion':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code} ({'Hindu' if demo_code == 1 else 'Muslim'})"
            elif demo_type == 'Social Category':
                if isinstance(demo_code, list):
                    demo_filter = self.df_filtered[demo_col].isin(demo_code)
                    filter_desc = f"Codes {demo_code}"
                else:
                    demo_filter = self.df_filtered[demo_col] == demo_code
                    filter_desc = f"Code {demo_code}"
            elif demo_type == 'Age':
                age_numeric = pd.to_numeric(self.df_filtered[demo_col], errors='coerce')
                if isinstance(demo_code, tuple):
                    if demo_code[1] is None:
                        # For 50+, demo_code is (51, None) but we want Age > 50
                        if demo_value == '50+':
                            demo_filter = age_numeric > 50
                            filter_desc = "Age > 50"
                        else:
                            demo_filter = age_numeric > demo_code[0]
                            filter_desc = f"Age > {demo_code[0]}"
                    else:
                        demo_filter = (age_numeric >= demo_code[0]) & (age_numeric <= demo_code[1])
                        filter_desc = f"Age {demo_code[0]}-{demo_code[1]}"
                else:
                    demo_filter = pd.Series([False] * len(self.df_filtered), index=self.df_filtered.index)
                    filter_desc = "Unknown"
            else:
                continue
            
            # Calculate dates for Overall (16 days: Oct 15-31, excluding Oct 19)
            from datetime import timedelta
            num_days = 16
            start_offset = num_days
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[:num_days]
            
            # First date
            first_date = target_dates[0]
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= first_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                demo_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] <= last_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date) &
                demo_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            # Weight statistics
            first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
            last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
            
            print(f"    Filter: {filter_desc}")
            print(f"    Date Range: {first_date.date()} to {last_date.date()} (16 dates)")
            print(f"    First Date ({first_date.date()}):")
            print(f"      Data Range: {self.df_filtered['Survey Date'].min().date()} to {first_date.date()} (cumulative)")
            print(f"      Records: {len(first_data):,}")
            print(f"      Total Weight Sum: {first_weights.sum():,.2f}")
            print(f"      Sample: {first_vs.get('sample', 0):,}")
            print(f"      AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"      LEFT: {first_vs.get('LEFT', 0):.1f}%")
            print(f"      INC: {first_vs.get('INC', 0):.1f}%")
            print(f"      Others: {first_vs.get('Others', 0):.1f}%")
            print(f"      NWR: {first_vs.get('NWR', 0):.1f}%")
            print(f"    Last Date ({last_date.date()}):")
            print(f"      Data Range: {self.df_filtered['Survey Date'].min().date()} to {last_date.date()} (cumulative)")
            print(f"      Records: {len(last_data):,}")
            print(f"      Total Weight Sum: {last_weights.sum():,.2f}")
            print(f"      Sample: {last_vs.get('sample', 0):,}")
            print(f"      AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"      LEFT: {last_vs.get('LEFT', 0):.1f}%")
            print(f"      INC: {last_vs.get('INC', 0):.1f}%")
            print(f"      Others: {last_vs.get('Others', 0):.1f}%")
            print(f"      NWR: {last_vs.get('NWR', 0):.1f}%")
            print(f"    Calculation Method:")
            print(f"      1. Filter data by {demo_type}={demo_value} ({filter_desc})")
            print(f"      2. For each date, filter data up to that date (cumulative)")
            print(f"      3. Apply weights from '{weight_column}' column")
            print(f"      4. Sum weights by party")
            print(f"      5. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
            print(f"      6. Each date point shows cumulative normalized vote share up to that date")
        
        # Summary for all demographics
        print(f"\n\nAll Demographic Charts (Slides 14-23):")
        slide_nums = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
        for i, (demo_type, demo_value, _) in enumerate(demographic_charts):
            if i < len(slide_nums):
                print(f"  Slide {slide_nums[i]}: {demo_type}={demo_value}")
        print(f"  Total: {len(demographic_charts)} charts")
        print(f"  All use the same calculation method: Overall Normalized Vote Share (cumulative) filtered by demographic")
    
    def audit_7dma_demographic_charts(self):
        """Audit trail for 7 DMA Demographic Chart calculations (Slides 24-39)"""
        print("\n" + "="*80)
        print("AUDIT: 7 DMA DEMOGRAPHIC CHARTS (SLIDES 24-39)")
        print("="*80)
        
        # Use 7DMA-specific weights for 7DMA calculations
        weight_column = 'Weight - with Vote Share - AE 2021 - Region L7D'
        
        print(f"\n7 DMA Demographic Charts Overview:")
        print(f"  Chart Type: 7 DMA (7-Day Moving Average) Normalized Vote Share Line Chart")
        print(f"  Data Points: 13 days ending at {self.reference_date.date()}")
        print(f"  Dates: Oct 18-31 (excluding Oct 19)")
        print(f"  Chart Categories: Excel serial numbers (45948, 45950, ..., 45961) matching final PPT DateAxis format")
        print(f"  Method: Same as Slide 7 (7 DMA), but filtered by demographic category")
        print(f"  Formula: For each date, calculate 7 DMA Normalized Vote Share using data from (date - 7 days) to (date - 1 day),")
        print(f"           filtered by demographic category")
        print(f"  Weight Column: {weight_column} (7DMA-specific weights with fallback to regular weights if <50% available)")
        print(f"  Note: 7DMA calculations use 'Weight - with Vote Share - AE 2021 - Region L7D' when >=50% of records have L7D weights,")
        print(f"        otherwise fall back to regular weights to avoid using sparse L7D weights which give incorrect results.")
        print(f"        Charts use DateAxis with Excel serial numbers.")
        print(f"  Formula: (Σ Weight for Party in Demographic (7-day window) / Σ Total Weights in Demographic (7-day window)) × 100")
        print(f"  Note: 7DMA window ends one day before the date point - window is (date - 7 days) to (date - 1 day) = 7 days total")
        print(f"  Slides: 24-39 (16 charts total)")
        
        # Define demographic charts (same as overall, but for 7 DMA)
        demographic_charts = [
            ('Gender', 'Male', 1),
            ('Gender', 'Female', 2),
            ('Location', 'Urban', 1),
            ('Location', 'Rural', 2),
            ('Religion', 'Hindu', 1),
            ('Religion', 'Muslim', 2),
            ('Social Category', 'General+OBC', [1, 2]),
            ('Social Category', 'SC', 3),
            ('Social Category', 'ST', 4),
            ('Age', '18-25', (18, 25)),
            ('Age', '26-34', (26, 34)),
            ('Age', '36-50', (36, 50)),
            ('Age', '50+', (51, None)),
        ]
        
        # Get demographic column map
        demographic_column_map = {
            'Gender': 'Gender',
            'Location': 'Residential locality type',
            'Religion': '20. Could you please tell me the religion that you belong to?',
            'Social Category': '21. Which social category do you belong to?',
            'Age': 'Could you please tell me your age in complete years?'
        }
        
        # Show example calculations for first few demographics
        print(f"\nExample Calculations (First 3 Demographics):")
        
        for demo_type, demo_value, demo_code in demographic_charts[:3]:
            print(f"\n  {demo_type} = {demo_value}:")
            
            demo_col = demographic_column_map.get(demo_type)
            if not demo_col or demo_col not in self.df_filtered.columns:
                print(f"    Warning: Column not found")
                continue
            
            # Create filter
            if demo_type == 'Gender':
                demo_filter = self.df_filtered[demo_col] == demo_code
            elif demo_type == 'Location':
                demo_filter = self.df_filtered[demo_col] == demo_code
            elif demo_type == 'Religion':
                demo_filter = self.df_filtered[demo_col] == demo_code
            else:
                continue
            
            # Calculate dates for 7 DMA (13 days: Oct 18-31, excluding Oct 19)
            from datetime import timedelta
            num_days = 13
            start_offset = num_days + 1
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[-num_days:]
            
            # First date
            first_date = target_dates[0]
            first_end_date = first_date - timedelta(days=1)  # One day before date point
            first_cutoff = first_end_date - timedelta(days=6)
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= first_cutoff) &
                (self.df_filtered['Survey Date'] <= first_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                demo_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_end_date = last_date - timedelta(days=1)  # One day before date point
            last_cutoff = last_end_date - timedelta(days=6)
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= last_cutoff) &
                (self.df_filtered['Survey Date'] <= last_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                demo_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            # Weight statistics
            first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
            last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
            
            print(f"    Date Range: {first_date.date()} to {last_date.date()} (13 dates)")
            print(f"    First Date ({first_date.date()}):")
            print(f"      7 DMA Window: {first_cutoff.date()} to {first_end_date.date()} (7 days)")
            print(f"      Records: {len(first_data):,}")
            print(f"      Total Weight Sum: {first_weights.sum():,.2f}")
            print(f"      AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"    Last Date ({last_date.date()}):")
            print(f"      7 DMA Window: {last_cutoff.date()} to {last_end_date.date()} (7 days)")
            print(f"      Records: {len(last_data):,}")
            print(f"      Total Weight Sum: {last_weights.sum():,.2f}")
            print(f"      AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"    Note: 7 DMA calculation - each date shows 7-day moving average ending one day before the date")
        
        # Detailed calculation for Slide 36 (Age 50+ 7 DMA)
        print(f"\n\nDetailed Calculation for Slide 36 (Age 50+ - 7 DMA):")
        age_col = 'Could you please tell me your age in complete years?'
        if age_col in self.df_filtered.columns:
            age_numeric = pd.to_numeric(self.df_filtered[age_col], errors='coerce')
            age_50_plus_filter = age_numeric > 50
            
            # Calculate dates for 7 DMA
            num_days = 13
            start_offset = num_days + 1
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[-num_days:]
            
            # First date
            first_date = target_dates[0]
            first_end_date = first_date - timedelta(days=1)
            first_cutoff = first_end_date - timedelta(days=6)
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= first_cutoff) &
                (self.df_filtered['Survey Date'] <= first_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                age_50_plus_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_end_date = last_date - timedelta(days=1)
            last_cutoff = last_end_date - timedelta(days=6)
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= last_cutoff) &
                (self.df_filtered['Survey Date'] <= last_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                age_50_plus_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            # Weight statistics
            first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
            last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
            
            print(f"  Filter: Age > 50 years")
            print(f"  7 DMA Date Range: Oct 18-31 (excluding Oct 19) = 13 dates")
            print(f"\n  First Date ({first_date.date()}):")
            print(f"    7 DMA Window: {first_cutoff.date()} to {first_end_date.date()} (7 days)")
            print(f"    Records: {len(first_data):,}")
            print(f"    Total Weight Sum: {first_weights.sum():,.2f}")
            print(f"    Sample: {first_vs.get('sample', 0):,}")
            print(f"    AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"    BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"    LEFT: {first_vs.get('LEFT', 0):.1f}%")
            print(f"    INC: {first_vs.get('INC', 0):.1f}%")
            print(f"    Others: {first_vs.get('Others', 0):.1f}%")
            print(f"    NWR: {first_vs.get('NWR', 0):.1f}%")
            
            print(f"\n  Last Date ({last_date.date()}):")
            print(f"    7 DMA Window: {last_cutoff.date()} to {last_end_date.date()} (7 days)")
            print(f"    Records: {len(last_data):,}")
            print(f"    Total Weight Sum: {last_weights.sum():,.2f}")
            print(f"    Sample: {last_vs.get('sample', 0):,}")
            print(f"    AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"    BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"    LEFT: {last_vs.get('LEFT', 0):.1f}%")
            print(f"    INC: {last_vs.get('INC', 0):.1f}%")
            print(f"    Others: {last_vs.get('Others', 0):.1f}%")
            print(f"    NWR: {last_vs.get('NWR', 0):.1f}%")
            
            print(f"\n  Calculation Method:")
            print(f"    1. Filter data by Age > 50 years")
            print(f"    2. For each date, calculate 7 DMA: end_date is one day before the date point")
            print(f"    3. 7 DMA window: (date - 8 days) to (date - 1 day) = 7 days")
            print(f"    4. Apply weights from '{weight_column}' column")
            print(f"    5. Sum weights by party in the 7-day window")
            print(f"    6. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
            print(f"    7. Each date point shows 7-day moving average normalized vote share")
        
        # Detailed calculations for each 7 DMA demographic chart
        print(f"\n\nDetailed Calculations for Each 7 DMA Demographic Chart:")
        
        for slide_num, (demo_type, demo_value, demo_code) in enumerate(demographic_charts, start=24):
            print(f"\n  Slide {slide_num}: 7 DMA {demo_type}={demo_value}")
            
            demo_col = demographic_column_map.get(demo_type)
            if not demo_col or demo_col not in self.df_filtered.columns:
                print(f"    Warning: Column not found")
                continue
            
            # Create filter based on demographic type
            if demo_type == 'Gender':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code}"
            elif demo_type == 'Location':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code} ({'Urban' if demo_code == 1 else 'Rural'})"
            elif demo_type == 'Religion':
                demo_filter = self.df_filtered[demo_col] == demo_code
                filter_desc = f"Code {demo_code} ({'Hindu' if demo_code == 1 else 'Muslim'})"
            elif demo_type == 'Social Category':
                if isinstance(demo_code, list):
                    demo_filter = self.df_filtered[demo_col].isin(demo_code)
                    filter_desc = f"Codes {demo_code}"
                else:
                    demo_filter = self.df_filtered[demo_col] == demo_code
                    filter_desc = f"Code {demo_code}"
            elif demo_type == 'Age':
                age_numeric = pd.to_numeric(self.df_filtered[demo_col], errors='coerce')
                if isinstance(demo_code, tuple):
                    if demo_code[1] is None:
                        # For 50+, demo_code is (51, None) but we want Age > 50
                        if demo_value == '50+':
                            demo_filter = age_numeric > 50
                            filter_desc = "Age > 50"
                        else:
                            demo_filter = age_numeric > demo_code[0]
                            filter_desc = f"Age > {demo_code[0]}"
                    else:
                        demo_filter = (age_numeric >= demo_code[0]) & (age_numeric <= demo_code[1])
                        filter_desc = f"Age {demo_code[0]}-{demo_code[1]}"
                else:
                    demo_filter = pd.Series([False] * len(self.df_filtered), index=self.df_filtered.index)
                    filter_desc = "Unknown"
            else:
                continue
            
            # Calculate dates for 7 DMA
            from datetime import timedelta
            num_days = 13
            start_offset = num_days + 1
            all_dates = []
            for i in range(start_offset, -1, -1):
                date = self.reference_date - timedelta(days=i)
                all_dates.append(date)
            
            oct_19 = self.reference_date - timedelta(days=12)
            target_dates = [d for d in all_dates if d != oct_19]
            if len(target_dates) > num_days:
                target_dates = target_dates[-num_days:]
            
            # First date
            first_date = target_dates[0]
            first_end_date = first_date - timedelta(days=1)
            first_cutoff = first_end_date - timedelta(days=6)
            first_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= first_cutoff) &
                (self.df_filtered['Survey Date'] <= first_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                demo_filter
            ].copy()
            
            # Last date
            last_date = target_dates[-1]
            last_end_date = last_date - timedelta(days=1)
            last_cutoff = last_end_date - timedelta(days=6)
            last_data = self.df_filtered[
                (self.df_filtered['Survey Date'] >= last_cutoff) &
                (self.df_filtered['Survey Date'] <= last_end_date) &
                (self.df_filtered['Survey Date'] <= self.reference_date - timedelta(days=1)) &
                demo_filter
            ].copy()
            
            # Calculate vote shares
            first_vs = self.calculator.calculate_vote_share(
                first_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            last_vs = self.calculator.calculate_vote_share(
                last_data,
                weight_column=weight_column,
                use_weights=True
            )
            
            # Weight statistics
            first_weights = pd.to_numeric(first_data[weight_column], errors='coerce')
            last_weights = pd.to_numeric(last_data[weight_column], errors='coerce')
            
            print(f"    Filter: {filter_desc}")
            print(f"    Date Range: {first_date.date()} to {last_date.date()} (13 dates)")
            print(f"    First Date ({first_date.date()}):")
            print(f"      7 DMA Window: {first_cutoff.date()} to {first_end_date.date()} (7 days)")
            print(f"      Records: {len(first_data):,}")
            print(f"      Total Weight Sum: {first_weights.sum():,.2f}")
            print(f"      Sample: {first_vs.get('sample', 0):,}")
            print(f"      AITC: {first_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {first_vs.get('BJP', 0):.1f}%")
            print(f"      LEFT: {first_vs.get('LEFT', 0):.1f}%")
            print(f"      INC: {first_vs.get('INC', 0):.1f}%")
            print(f"      Others: {first_vs.get('Others', 0):.1f}%")
            print(f"      NWR: {first_vs.get('NWR', 0):.1f}%")
            print(f"    Last Date ({last_date.date()}):")
            print(f"      7 DMA Window: {last_cutoff.date()} to {last_end_date.date()} (7 days)")
            print(f"      Records: {len(last_data):,}")
            print(f"      Total Weight Sum: {last_weights.sum():,.2f}")
            print(f"      Sample: {last_vs.get('sample', 0):,}")
            print(f"      AITC: {last_vs.get('AITC', 0):.1f}%")
            print(f"      BJP: {last_vs.get('BJP', 0):.1f}%")
            print(f"      LEFT: {last_vs.get('LEFT', 0):.1f}%")
            print(f"      INC: {last_vs.get('INC', 0):.1f}%")
            print(f"      Others: {last_vs.get('Others', 0):.1f}%")
            print(f"      NWR: {last_vs.get('NWR', 0):.1f}%")
            print(f"    Calculation Method:")
            print(f"      1. Filter data by {demo_type}={demo_value} ({filter_desc})")
            print(f"      2. For each date, calculate 7 DMA: end_date is one day before the date point")
            print(f"      3. 7 DMA window: (date - 8 days) to (date - 1 day) = 7 days")
            print(f"      4. Apply weights from '{weight_column}' column (7DMA-specific weights)")
            print(f"      5. Sum weights by party in the 7-day window")
            print(f"      6. Calculate percentage: (Party Weight Sum / Total Weight Sum) × 100")
            print(f"      7. Each date point shows 7-day moving average normalized vote share")
            print(f"      Note: Uses 'Weight - with Vote Share - AE 2021 - Region L7D' instead of regular weights")
        
        # Summary
        print(f"\n\nAll 7 DMA Demographic Charts (Slides 24-39):")
        slide_nums_7dma = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]
        for i, (demo_type, demo_value, _) in enumerate(demographic_charts):
            if i < len(slide_nums_7dma):
                print(f"  Slide {slide_nums_7dma[i]}: 7 DMA {demo_type}={demo_value}")
        print(f"  Total: {len(demographic_charts)} charts")
        print(f"  All use the same calculation method: 7 DMA Normalized Vote Share filtered by demographic")
    
    def audit_top_reasons_charts(self):
        """Audit trail for Top Reasons for Party Choices charts (Slides 44-45)"""
        print("\n" + "="*80)
        print("AUDIT: TOP REASONS FOR PARTY CHOICES (SLIDES 44-45)")
        print("="*80)
        
        # Filter data up to reference_date
        filtered_df = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        # Use different weights for overall vs 7DMA
        weight_col_overall = 'Weight - with Vote Share - AE 2021 - Region'
        weight_col_7dma = 'Weight - with Vote Share - AE 2021 - Region L7D'
        
        weights_overall = pd.to_numeric(filtered_df[weight_col_overall], errors='coerce').fillna(0)
        total_weighted_overall = weights_overall.sum()
        
        print(f"\nData Source:")
        print(f"  Excel File: {self.excel_path}")
        print(f"  Reference Date: {self.reference_date.date()}")
        print(f"  Total Records (Overall): {len(filtered_df):,}")
        print(f"  Total Weight Sum (Overall): {total_weighted_overall:,.2f}")
        print(f"  Weight Column (Overall): {weight_col_overall}")
        
        # For 7 DMA: last 7 days ending one day before reference_date - use L7D weights
        from datetime import timedelta
        end_date_7dma = self.reference_date - timedelta(days=1)
        cutoff_7dma = end_date_7dma - timedelta(days=6)
        filtered_7dma = self.df[
            (self.df['Survey Date'] >= cutoff_7dma) &
            (self.df['Survey Date'] <= end_date_7dma) &
            (self.df['Survey Date'] <= self.reference_date - timedelta(days=1))
        ].copy()
        weights_7dma = pd.to_numeric(filtered_7dma[weight_col_7dma], errors='coerce').fillna(0)
        total_weighted_7dma = weights_7dma.sum()
        
        print(f"\n7 DMA Data:")
        print(f"  7 DMA Window: {cutoff_7dma.date()} to {end_date_7dma.date()} (7 days)")
        print(f"  Total Records (7 DMA): {len(filtered_7dma):,}")
        print(f"  Total Weight Sum (7 DMA): {total_weighted_7dma:,.2f}")
        print(f"  Weight Column (7 DMA): {weight_col_7dma} (7DMA-specific weights)")
        print(f"  Note: 7DMA calculations use 'Weight - with Vote Share - AE 2021 - Region L7D' instead of regular weights")
        
        # Calculate for AITC (Question 11)
        print(f"\n\nAITC Reasons (Question 11):")
        print(f"  Question: 'In your opinion what are the top 3 reasons for voting for AITC?'")
        
        aitc_prefix = '11. In your opinion what are the top 3 reasons for voting for AITC?'
        
        # Exclude "Don't know / Can't say" more carefully
        def should_exclude(col_str):
            col_lower = str(col_str).lower()
            if ' - ' in col_str:
                reason_text = col_str.split(' - ')[-1].lower()
            else:
                reason_text = col_lower
            if 'know' in reason_text and 'say' in reason_text:
                return True
            exclude_patterns = ['others (specify)', 'don', 'can\'t', '.1']
            for pattern in exclude_patterns:
                if pattern in col_lower or pattern in reason_text:
                    return True
            return False
        
        aitc_cols = [col for col in self.df.columns 
                     if str(col).startswith(aitc_prefix) 
                     and not should_exclude(str(col))]
        
        print(f"  Total Reason Options: {len(aitc_cols)}")
        
        # Calculate overall top reasons for AITC using overall weights
        aitc_reason_counts = {}
        for col in aitc_cols:
            reason_text = str(col).split(' - ')[-1] if ' - ' in str(col) else str(col)
            reason_values = pd.to_numeric(filtered_df[col], errors='coerce').fillna(0)
            weighted_sum = (reason_values * weights_overall).sum()
            percentage = (weighted_sum / total_weighted_overall * 100) if total_weighted_overall > 0 else 0
            aitc_reason_counts[reason_text] = {
                'weighted_count': weighted_sum,
                'percentage': percentage
            }
        
        top_aitc_overall = sorted(aitc_reason_counts.items(), key=lambda x: x[1]['weighted_count'], reverse=True)[:3]
        
        print(f"\n  Top 3 Reasons (Overall):")
        for i, (reason, data) in enumerate(top_aitc_overall, 1):
            print(f"    {i}. {reason[:70]}")
            print(f"       Weighted Count: {data['weighted_count']:,.2f}")
            print(f"       Percentage: {data['percentage']:.1f}%")
            print(f"       Calculation: {data['weighted_count']:,.2f} / {total_weighted_overall:,.2f} × 100 = {data['percentage']:.1f}%")
            print(f"       Weight Column: {weight_col_overall}")
        
        # Calculate 7 DMA top reasons for AITC
        aitc_reason_counts_7dma = {}
        for col in aitc_cols:
            reason_text = str(col).split(' - ')[-1] if ' - ' in str(col) else str(col)
            reason_values = pd.to_numeric(filtered_7dma[col], errors='coerce').fillna(0)
            weighted_sum = (reason_values * weights_7dma).sum()
            percentage = (weighted_sum / total_weighted_7dma * 100) if total_weighted_7dma > 0 else 0
            aitc_reason_counts_7dma[reason_text] = {
                'weighted_count': weighted_sum,
                'percentage': percentage
            }
        
        top_aitc_7dma = sorted(aitc_reason_counts_7dma.items(), key=lambda x: x[1]['weighted_count'], reverse=True)[:3]
        
        print(f"\n  Top 3 Reasons (7 DMA):")
        for i, (reason, data) in enumerate(top_aitc_7dma, 1):
            print(f"    {i}. {reason[:70]}")
            print(f"       Weighted Count: {data['weighted_count']:,.2f}")
            print(f"       Percentage: {data['percentage']:.1f}%")
            print(f"       Calculation: {data['weighted_count']:,.2f} / {total_weighted_7dma:,.2f} × 100 = {data['percentage']:.1f}%")
        
        # Calculate for BJP (Question 12)
        print(f"\n\nBJP Reasons (Question 12):")
        print(f"  Question: 'In your opinion what are the top 3 reasons for voting for BJP?'")
        
        bjp_prefix = '12. In your opinion what are the top 3 reasons for voting for BJP?'
        bjp_cols = [col for col in self.df.columns 
                    if str(col).startswith(bjp_prefix) 
                    and not should_exclude(str(col))]
        
        print(f"  Total Reason Options: {len(bjp_cols)}")
        
        # Calculate overall top reasons for BJP using overall weights
        bjp_reason_counts = {}
        for col in bjp_cols:
            reason_text = str(col).split(' - ')[-1] if ' - ' in str(col) else str(col)
            reason_values = pd.to_numeric(filtered_df[col], errors='coerce').fillna(0)
            weighted_sum = (reason_values * weights_overall).sum()
            percentage = (weighted_sum / total_weighted_overall * 100) if total_weighted_overall > 0 else 0
            bjp_reason_counts[reason_text] = {
                'weighted_count': weighted_sum,
                'percentage': percentage
            }
        
        top_bjp_overall = sorted(bjp_reason_counts.items(), key=lambda x: x[1]['weighted_count'], reverse=True)[:3]
        
        print(f"\n  Top 3 Reasons (Overall):")
        for i, (reason, data) in enumerate(top_bjp_overall, 1):
            print(f"    {i}. {reason[:70]}")
            print(f"       Weighted Count: {data['weighted_count']:,.2f}")
            print(f"       Percentage: {data['percentage']:.1f}%")
            print(f"       Calculation: {data['weighted_count']:,.2f} / {total_weighted_overall:,.2f} × 100 = {data['percentage']:.1f}%")
            print(f"       Weight Column: {weight_col_overall}")
        
        # Calculate 7 DMA top reasons for BJP
        bjp_reason_counts_7dma = {}
        for col in bjp_cols:
            reason_text = str(col).split(' - ')[-1] if ' - ' in str(col) else str(col)
            reason_values = pd.to_numeric(filtered_7dma[col], errors='coerce').fillna(0)
            weighted_sum = (reason_values * weights_7dma).sum()
            percentage = (weighted_sum / total_weighted_7dma * 100) if total_weighted_7dma > 0 else 0
            bjp_reason_counts_7dma[reason_text] = {
                'weighted_count': weighted_sum,
                'percentage': percentage
            }
        
        top_bjp_7dma = sorted(bjp_reason_counts_7dma.items(), key=lambda x: x[1]['weighted_count'], reverse=True)[:3]
        
        print(f"\n  Top 3 Reasons (7 DMA):")
        for i, (reason, data) in enumerate(top_bjp_7dma, 1):
            print(f"    {i}. {reason[:70]}")
            print(f"       Weighted Count: {data['weighted_count']:,.2f}")
            print(f"       Percentage: {data['percentage']:.1f}%")
            print(f"       Calculation: {data['weighted_count']:,.2f} / {total_weighted_7dma:,.2f} × 100 = {data['percentage']:.1f}%")
        
        print(f"\n\nCalculation Method:")
        print(f"  1. Filter data by date range:")
        print(f"     - Overall: All data up to {self.reference_date.date()}")
        print(f"     - 7 DMA: Last 7 days from {cutoff_7dma.date()} to {end_date_7dma.date()}")
        print(f"  2. For each reason option column:")
        print(f"     - Convert column values to numeric (0 or 1)")
        print(f"     - Overall: Multiply by weights from '{weight_col_overall}' column")
        print(f"     - 7 DMA: Multiply by weights from '{weight_col_7dma}' column (7DMA-specific weights)")
        print(f"     - Sum weighted values to get weighted count")
        print(f"  3. Calculate percentage: (Weighted Count / Total Weight Sum) × 100")
        print(f"  4. Sort by weighted count and select top 3 reasons")
        print(f"  5. Display percentages rounded to 1 decimal place")
        print(f"\n  Slide 44: Shows top 3 reasons for AITC (7 DMA) - uses '{weight_col_7dma}' weights")
        print(f"  Slide 45: Shows top 3 reasons for AITC (Overall) - uses '{weight_col_overall}' weights")
        print(f"\n  Note: 7DMA calculations use 'Weight - with Vote Share - AE 2021 - Region L7D' instead of regular weights")
    
    def audit_caste_tables(self):
        """Audit trail for Caste Wise Vote Shares (Slides 41-42)"""
        print("\n" + "="*80)
        print("AUDIT: CASTE WISE VOTE SHARES (Slides 41-42)")
        print("="*80)
        
        caste_column = '22. Could you please tell me your caste?'
        
        if caste_column not in self.df.columns:
            print(f"Warning: {caste_column} not found in data")
            return
        
        print(f"\nData Source:")
        print(f"  Column: {caste_column}")
        print(f"  Total Records with Caste: {self.df[caste_column].notna().sum():,}")
        print(f"  Unique Caste Codes: {self.df[caste_column].nunique()}")
        
        # Get top caste codes
        top_codes = self.df[caste_column].value_counts().head(12).index.tolist()
        print(f"\nTop 12 Caste Codes:")
        for i, code in enumerate(top_codes):
            count = self.df[caste_column].value_counts().iloc[i]
            print(f"  Code {code}: {count:,} records ({count/len(self.df)*100:.2f}%)")
        
        print(f"\nSlide 41: Caste Wise Vote Shares (30 DMA)")
        print(f"  Date Range: Last 30 days ending one day before reference date")
        print(f"  End Date: {self.reference_date.date() - timedelta(days=1)}")
        print(f"  Start Date: {self.reference_date.date() - timedelta(days=30)}")
        print(f"  Weight Column: 'Weight - with Vote Share - AE 2021 - Region L15D' (if >=50% available),")
        print(f"                 otherwise 'Weight - with Vote Share - AE 2021 - Region'")
        print(f"  Formula: For each caste, filter data by caste code, then calculate normalized vote share")
        print(f"           using 30-day window data")
        
        print(f"\nSlide 42: Caste Wise Vote Shares (Overall)")
        print(f"  Date Range: All data up to {self.reference_date.date()}")
        print(f"  Weight Column: 'Weight - with Vote Share - AE 2021 - Region'")
        print(f"  Formula: For each caste, filter data by caste code, then calculate normalized vote share")
        print(f"           using all data up to reference date")
        
        print(f"\nCaste Code Mapping:")
        print(f"  Note: Caste codes are mapped to caste names from template based on frequency")
        print(f"  Code 88 is excluded (likely NWR/Refused)")
        print(f"  'Others' includes codes 44, 48, and other non-mainstream castes")
        
        # Show example calculation for first caste
        if len(top_codes) > 0 and top_codes[0] != 88:
            example_code = top_codes[0] if top_codes[0] != 88 else top_codes[1]
            example_data = self.df[self.df[caste_column] == example_code].copy()
            example_overall = example_data[example_data['Survey Date'] <= self.reference_date].copy()
            
            print(f"\nExample Calculation (Code {example_code} - Overall):")
            print(f"  Records: {len(example_overall):,}")
            if len(example_overall) > 0:
                vote_shares = self.calculator.calculate_vote_share(
                    example_overall,
                    weight_column='Weight - with Vote Share - AE 2021 - Region',
                    use_weights=True
                )
                print(f"  Sample: {vote_shares.get('sample', 0):,}")
                print(f"  AITC: {vote_shares.get('AITC', 0):.2f}%")
                print(f"  BJP: {vote_shares.get('BJP', 0):.2f}%")
                print(f"  Margin: {vote_shares.get('AITC', 0) - vote_shares.get('BJP', 0):.2f}%")
    
    def audit_gains_losses_tables(self):
        """Audit trail for Gains and Losses tables (Slides 47-61) - Detailed calculations for each slide"""
        print("\n" + "="*80)
        print("AUDIT: GAINS AND LOSSES TABLES (Slides 47-61)")
        print("="*80)
        
        question_2021 = '5. Which party did you vote for in the last assembly elections (MLA) in 2021?'
        question_2025 = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  These tables show the percentage of people who voted for party X in 2021 (AE 2021)")
        print(f"  and will vote for party Y in 2025 (current voting preference)")
        print(f"  Rows: Party voted for in 2021 (AITC, BJP, LEFT+, INC, Others, N+W+R, Total)")
        print(f"  Columns: Party will vote for in 2025 (AITC, BJP, LEFT+, INC, Others, N+W+R*)")
        print(f"  Values: Percentage of 2021 voters for party X who will vote for party Y in 2025")
        print(f"  Column 2: 'AE 2021 VS' - Vote share each party got in 2021")
        print(f"  'Total' row: Overall 2025 vote shares (weighted average across all 2021 parties)")
        
        print(f"\nData Sources:")
        print(f"  2021 Voting: {question_2021}")
        print(f"  2025 Voting: {question_2025}")
        print(f"  Weight Column: {weight_column}")
        
        # Helper function to categorize 2021 party
        def categorize_party_2021(code):
            if pd.isna(code):
                return 'NWR'
            try:
                code = int(code)
            except:
                return 'NWR'
            if code == 1: return 'AITC'
            elif code == 2: return 'BJP'
            elif code == 3: return 'INC'
            elif code == 4: return 'LEFT'
            elif code in [12, 44]: return 'Others'
            elif code in [55, 66, 67, 77, 78, 88]: return 'NWR'
            else: return 'Others'
        
        # Helper function to calculate gains/losses for a given dataset
        def calculate_gains_losses_detailed(data_filtered, slide_name, date_filter_desc, use_constant_ae2021=False):
            eligible_data = data_filtered[data_filtered[question_2021].notna()].copy()
            
            if len(eligible_data) == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No eligible voters found")
                return
            
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            
            eligible_data['party_2021'] = eligible_data[question_2021].apply(categorize_party_2021)
            eligible_data['party_2025'] = eligible_data[question_2025].apply(self.calculator.categorize_party)
            
            parties_2021 = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            parties_2025 = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            
            print(f"\n  {slide_name}:")
            print(f"    Date Filter: {date_filter_desc}")
            print(f"    Eligible Voters (voted in 2021): {len(eligible_data):,}")
            print(f"    Total Weight Sum: {weights.sum():,.2f}")
            
            # Calculate 2021 AE vote shares
            if use_constant_ae2021:
                # For overall tables (Slides 47-48), use constant values
                ae2021_vs = {
                    'AITC': 48.02,
                    'BJP': 37.97,
                    'LEFT': 5.66,
                    'INC': 3.03,
                    'Others': 2.88,
                    'NWR': 1.08
                }
                print(f"\n    2021 AE Vote Shares (Constant values from final format):")
                for party in parties_2021:
                    print(f"      {party}: {ae2021_vs[party]:.2f}%")
            else:
                # For demographic tables, calculate from survey data
                ae2021_vs = {}
                for party in parties_2021:
                    party_mask = eligible_data['party_2021'] == party
                    party_weights = weights[party_mask]
                    party_weight_sum = party_weights.sum()
                    total_weight = weights.sum()
                    ae2021_vs[party] = (party_weight_sum / total_weight * 100) if total_weight > 0 else 0
                
                print(f"\n    2021 AE Vote Shares (from survey data):")
                for party in parties_2021:
                    print(f"      {party}: {ae2021_vs[party]:.2f}% (Weight: {weights[eligible_data['party_2021'] == party].sum():,.2f} / {weights.sum():,.2f} × 100)")
            
            # Calculate gains/losses matrix
            matrix = {}
            for party_2021 in parties_2021:
                matrix[party_2021] = {}
                party_2021_data = eligible_data[eligible_data['party_2021'] == party_2021].copy()
                
                if len(party_2021_data) == 0:
                    for party_2025 in parties_2025:
                        matrix[party_2021][party_2025] = 0.0
                    continue
                
                party_2021_weights = weights[party_2021_data.index]
                total_weight_2021 = party_2021_weights.sum()
                
                print(f"\n    {party_2021} Row (2021):")
                print(f"      Records: {len(party_2021_data):,}")
                print(f"      Total Weight: {total_weight_2021:,.2f}")
                print(f"      AE 2021 VS: {ae2021_vs[party_2021]:.2f}%")
                
                for party_2025 in parties_2025:
                    party_2025_mask = party_2021_data['party_2025'] == party_2025
                    party_2025_weights = party_2021_weights[party_2025_mask]
                    weight_sum = party_2025_weights.sum()
                    percentage = (weight_sum / total_weight_2021) * 100 if total_weight_2021 > 0 else 0
                    matrix[party_2021][party_2025] = percentage
                    record_count = party_2025_mask.sum()
                    print(f"      → {party_2025}: {percentage:.1f}% (Records: {record_count:,}, Weight: {weight_sum:,.2f} / {total_weight_2021:,.2f} × 100)")
            
            # Calculate "Others" row (sum of Others and NWR from 2021)
            print(f"\n    Others Row (2021):")
            others_2021_data = eligible_data[eligible_data['party_2021'].isin(['Others', 'NWR'])].copy()
            if len(others_2021_data) > 0:
                others_2021_weights = weights[others_2021_data.index]
                total_weight_others_2021 = others_2021_weights.sum()
                others_ae2021 = ae2021_vs.get('Others', 0) + ae2021_vs.get('NWR', 0)
                print(f"      Records: {len(others_2021_data):,}")
                print(f"      Total Weight: {total_weight_others_2021:,.2f}")
                print(f"      AE 2021 VS: {others_ae2021:.2f}% (Others + NWR)")
                for party_2025 in parties_2025:
                    party_2025_mask = others_2021_data['party_2025'] == party_2025
                    party_2025_weights = others_2021_weights[party_2025_mask]
                    weight_sum = party_2025_weights.sum()
                    percentage = (weight_sum / total_weight_others_2021) * 100 if total_weight_others_2021 > 0 else 0
                    record_count = party_2025_mask.sum()
                    print(f"      → {party_2025}: {percentage:.1f}% (Records: {record_count:,}, Weight: {weight_sum:,.2f} / {total_weight_others_2021:,.2f} × 100)")
            
            # Calculate "N+W+R" row (same as Others row)
            print(f"\n    N+W+R Row (2021):")
            print(f"      Same as Others Row (sum of Others and NWR from 2021)")
            
            # Calculate Total row (overall 2025 vote shares)
            print(f"\n    Total Row:")
            total_2025_vote_shares = {}
            total_weight_all = weights.sum()
            for party_2025 in parties_2025:
                party_2025_mask = eligible_data['party_2025'] == party_2025
                party_2025_weights = weights[party_2025_mask]
                weight_sum = party_2025_weights.sum()
                total_2025_vote_shares[party_2025] = (weight_sum / total_weight_all) * 100 if total_weight_all > 0 else 0
                record_count = party_2025_mask.sum()
                print(f"      → {party_2025}: {total_2025_vote_shares[party_2025]:.1f}% (Records: {record_count:,}, Weight: {weight_sum:,.2f} / {total_weight_all:,.2f} × 100)")
            
            total_ae2021 = sum(ae2021_vs.get(p, 0) for p in parties_2021)
            print(f"      AE 2021 VS Total: {total_ae2021:.2f}% (Sum of all parties)")
        
        # Slide 47: 7 DMA (Overall)
        print(f"\n" + "="*80)
        print("SLIDE 47: GAINS AND LOSSES - 7 DMA (OVERALL)")
        print("="*80)
        end_date_7dma = self.reference_date - timedelta(days=1)
        cutoff_7dma = end_date_7dma - timedelta(days=6)
        dma7_data = self.df[
            (self.df['Survey Date'] >= cutoff_7dma) & 
            (self.df['Survey Date'] <= end_date_7dma)
        ].copy()
        
        calculate_gains_losses_detailed(
            dma7_data,
            "Slide 47: Gains and Losses - 7 DMA (Overall)",
            f"{cutoff_7dma.date()} to {end_date_7dma.date()} (7 days, excluding {self.reference_date.date()})",
            use_constant_ae2021=True
        )
        
        # Slide 48: Overall
        print(f"\n" + "="*80)
        print("SLIDE 48: GAINS AND LOSSES - OVERALL")
        print("="*80)
        overall_data = self.df_filtered.copy()
        calculate_gains_losses_detailed(
            overall_data,
            "Slide 48: Gains and Losses - Overall",
            f"All data up to {self.reference_date.date()}",
            use_constant_ae2021=True
        )
        
        # Demographic tables (Slides 49-61)
        demographic_slides = [
            (49, 'Location', 'Urban', 'Residential locality type', 1),
            (50, 'Location', 'Rural', 'Residential locality type', 2),
            (51, 'Gender', 'Male', 'Gender', 1),
            (52, 'Gender', 'Female', 'Gender', 2),
            (53, 'Age', '18-25', 'Could you please tell me your age in complete years?', (18, 25)),
            (54, 'Age', '26-34', 'Could you please tell me your age in complete years?', (26, 34)),
            (55, 'Age', '36-50', 'Could you please tell me your age in complete years?', (36, 50)),
            (56, 'Age', '50+', 'Could you please tell me your age in complete years?', (50, None)),
            (57, 'Religion', 'Hindu', '20. Could you please tell me the religion that you belong to?', 1),
            (58, 'Religion', 'Muslim', '20. Could you please tell me the religion that you belong to?', 2),
            (59, 'Social Category', 'General+OBC', '21. Which social category do you belong to?', [1, 2]),
            (60, 'Social Category', 'SC', '21. Which social category do you belong to?', 3),
            (61, 'Social Category', 'ST', '21. Which social category do you belong to?', 4),
        ]
        
        for slide_num, demo_type, demo_value, demo_col, demo_filter_value in demographic_slides:
            print(f"\n" + "="*80)
            print(f"SLIDE {slide_num}: GAINS AND LOSSES - {demo_type}={demo_value} (OVERALL)")
            print("="*80)
            
            # Filter data by demographic
            overall_data = self.df_filtered.copy()
            
            if demo_type == 'Age':
                age_col = overall_data[demo_col]
                age_numeric = pd.to_numeric(age_col, errors='coerce')
                if demo_value == '18-25':
                    demo_filter = (age_numeric >= 18) & (age_numeric <= 25)
                elif demo_value == '26-34':
                    demo_filter = (age_numeric >= 26) & (age_numeric <= 34)
                elif demo_value == '36-50':
                    demo_filter = (age_numeric >= 36) & (age_numeric <= 50)
                elif demo_value == '50+':
                    demo_filter = age_numeric > 50
                else:
                    demo_filter = pd.Series([False] * len(overall_data), index=overall_data.index)
            elif demo_type == 'Social Category' and isinstance(demo_filter_value, list):
                demo_filter = overall_data[demo_col].isin(demo_filter_value)
            else:
                demo_filter = overall_data[demo_col] == demo_filter_value
            
            demo_data = overall_data[demo_filter].copy()
            
            print(f"Demographic Filter:")
            print(f"  Type: {demo_type}")
            print(f"  Value: {demo_value}")
            print(f"  Column: {demo_col}")
            print(f"  Filter: {demo_filter_value}")
            print(f"  Records: {len(demo_data):,}")
            
            calculate_gains_losses_detailed(
                demo_data,
                f"Slide {slide_num}: Gains and Losses - {demo_type}={demo_value} (Overall)",
                f"All data up to {self.reference_date.date()}, filtered by {demo_type}={demo_value}",
                use_constant_ae2021=False
            )
    
    def audit_slide_wise(self):
        """Generate slide-wise audit trail - organized by slide number"""
        print("\n" + "="*80)
        print("SLIDE-WISE CALCULATION AUDIT TRAIL")
        print("="*80)
        print(f"Reference Date: {self.reference_date.date()}")
        print(f"Excel File: {self.excel_path}")
        print("="*80)
        
        # Slide 1: Title Slide
        print("\n" + "="*80)
        print("SLIDE 1: TITLE SLIDE")
        print("="*80)
        print("  Content: Title, Reporting Date, Overall Sample Size, Start Date, End Date, Duration")
        print(f"  Reporting Date: {self.reference_date.date()}")
        overall_metrics = self.get_overall_metrics()
        print(f"  Overall Sample Size: {overall_metrics['sample_size']:,}")
        print(f"  Start Date: {overall_metrics['start_date'].date()}")
        print(f"  End Date: {overall_metrics['end_date'].date()}")
        print(f"  Duration: {overall_metrics['duration_days']} days")
        
        # Slide 2: Introduction
        print("\n" + "="*80)
        print("SLIDE 2: INTRODUCTION")
        print("="*80)
        print("  Content: Sample size, Presentation Date, Daily Average, Gender Breakdown, F2F/CATI, Zones")
        print(f"  Presentation Date: {self.reference_date.date()}")
        print(f"  Total Sample: {overall_metrics['sample_size']:,}")
        print(f"  Daily Average: {overall_metrics['avg_daily_sample']:,}")
        print(f"  Male: {overall_metrics['male_sample']:,}")
        print(f"  Female: {overall_metrics['female_sample']:,}")
        print(f"  F2F: {overall_metrics['f2f_sample']:,}")
        print(f"  CATI: {overall_metrics['cati_sample']:,}")
        print(f"  Zones: {overall_metrics['zones_covered']}")
        
        # Slide 5: State Level Vote Share
        print("\n" + "="*80)
        print("SLIDE 5: STATE LEVEL VOTE SHARE")
        print("="*80)
        print("  Content: Raw Vote Share, 7DMA, Normalized Vote Share")
        print("  See detailed calculations in:")
        print("    - Raw Vote Share: AUDIT: RAW VOTE SHARE CALCULATION")
        print("    - 7DMA: AUDIT: 7 DMA CALCULATION")
        print("    - Normalized Vote Share: AUDIT: NORMALIZED VOTE SHARE CALCULATION")
        
        # Slide 6: Overall Normalized Vote Share Chart
        print("\n" + "="*80)
        print("SLIDE 6: OVERALL NORMALIZED VOTE SHARE CHART")
        print("="*80)
        print("  Content: Cumulative Overall Normalized Vote Share for last 16 days")
        print("  See detailed calculations in: AUDIT: SLIDE 6 CALCULATION (Overall Normalized Chart)")
        
        # Slide 7: 7 DMA Vote Share Chart
        print("\n" + "="*80)
        print("SLIDE 7: 7 DMA VOTE SHARE CHART")
        print("="*80)
        print("  Content: 7 DMA Normalized Vote Share for last 13 days")
        print("  See detailed calculations in: AUDIT: SLIDE 7 CALCULATION (7 DMA Chart)")
        
        # Slides 9-12: Demographic Tables
        print("\n" + "="*80)
        print("SLIDES 9-12: DEMOGRAPHIC TABLES")
        print("="*80)
        print("  Content: Gender, Location, Religion, Social Category, Age breakdowns")
        print("  Metrics: 7DMA, 15DMA, Overall (30DMA left empty)")
        print("  ")
        print("  Slide 9: Gender (Male, Female)")
        print("  Slide 10: Social Category (General+OBC, SC, ST) and Age (18-25, 26-34, 36-50, 50+)")
        print("  Slide 11: Social Category (General+OBC, SC, ST) and Age (18-25, 26-34, 36-50, 50+)")
        print("  Slide 12: Age (18-25, 26-34, 36-50, 50+)")
        print("  ")
        print("  Calculation Method:")
        print("    - 7DMA: Last 7 days ending one day before reference date")
        print("      Uses 'Weight - with Vote Share - AE 2021 - Region L7D' (if >=50% available, else regular)")
        print("    - 15DMA: Last 15 days ending one day before reference date")
        print("      Uses 'Weight - with Vote Share - AE 2021 - Region L15D' (if >=50% available, else regular)")
        print("    - Overall: All data up to reference date")
        print("      Uses 'Weight - with Vote Share - AE 2021 - Region'")
        print("    - 30DMA: Left empty (as per template)")
        print("  ")
        print("  See detailed calculations with actual numbers in: AUDIT: DEMOGRAPHIC BREAKDOWN CALCULATIONS")
        print("  (Includes 15DMA calculations with sample sizes, vote shares, and weight sums)")
        
        # Slides 14-23: Overall Normalized Demographic Charts
        print("\n" + "="*80)
        print("SLIDES 14-23: OVERALL NORMALIZED DEMOGRAPHIC CHARTS")
        print("="*80)
        print("  Content: Cumulative Overall Normalized Vote Share by demographic")
        print("  See detailed calculations in: AUDIT: DEMOGRAPHIC CHARTS (Slides 14-23)")
        
        # Slides 24-39: 7 DMA Demographic Charts
        print("\n" + "="*80)
        print("SLIDES 24-39: 7 DMA DEMOGRAPHIC CHARTS")
        print("="*80)
        print("  Content: 7 DMA Normalized Vote Share by demographic")
        print("  See detailed calculations in: AUDIT: 7 DMA DEMOGRAPHIC CHARTS (Slides 24-39)")
        print("  Note: Uses 'Weight - with Vote Share - AE 2021 - Region L7D'")
        
        # Slides 41-42: Caste Wise Vote Shares
        print("\n" + "="*80)
        print("SLIDES 41-42: CASTE WISE VOTE SHARES")
        print("="*80)
        print("  Content: Caste-wise vote shares (30DMA and Overall)")
        print("  See detailed calculations in: AUDIT: CASTE WISE VOTE SHARES (Slides 41-42)")
        
        # Slides 44-45: Top Reasons for Party Choices
        print("\n" + "="*80)
        print("SLIDES 44-45: TOP REASONS FOR PARTY CHOICES")
        print("="*80)
        print("  Content: Top 3 reasons for voting for AITC (7DMA and Overall)")
        print("  See detailed calculations in: AUDIT: TOP REASONS FOR PARTY CHOICES (Slides 44-45)")
        
        # Slides 47-61: Gains and Losses Tables
        print("\n" + "="*80)
        print("SLIDES 47-61: GAINS AND LOSSES TABLES")
        print("="*80)
        print("  Content: Voter movement from 2021 to 2025 by party")
        print("  See detailed calculations in: AUDIT: GAINS AND LOSSES TABLES (Slides 47-61)")
        
        # Slides 63-64: Vote Transferability Tables
        print("\n" + "="*80)
        print("SLIDES 63-64: VOTE TRANSFERABILITY TABLES")
        print("="*80)
        print("  Content: Percentage of people who vote for party X as first choice and party Y as second choice")
        print("  See detailed calculations in: AUDIT: VOTE TRANSFERABILITY TABLES (Slides 63-64)")
        
        # Slide 66: Preferred CM Candidate
        print("\n" + "="*80)
        print("SLIDE 66: PREFERRED CM CANDIDATE")
        print("="*80)
        print("  Content: Preferred Chief Minister candidate percentages (7DMA and Overall)")
        print("  Question: '17. Who do you think is the best leader to be the Chief Minister of West Bengal?'")
        print("  See detailed calculations in: AUDIT: PREFERRED CM CANDIDATE (Slide 66)")
        
        # Slide 68: State Government Rating
        print("\n" + "="*80)
        print("SLIDE 68: STATE GOVERNMENT RATING")
        print("="*80)
        print("  Content: Satisfaction rating with state government performance (7DMA and Overall)")
        print("  Question: '14. How satisfied or dissatisfied are you with the performance of the state govt led by Mamata Banerjee?'")
        print("  See detailed calculations in: AUDIT: STATE GOVERNMENT RATING (Slide 68)")
        
        # Slide 70: Key Issues
        print("\n" + "="*80)
        print("SLIDE 70: KEY ISSUES")
        print("="*80)
        print("  Content: Top pressing issues of assembly constituency (Overall)")
        print("  Question: '13. According to you, what are the three most pressing issues of your assembly constituency?'")
        print("  Shows: Count of people who chose each reason (not percentage)")
        print("  See detailed calculations in: AUDIT: KEY ISSUES (Slide 70)")
        
        # Slide 72: Wisdom of Crowds
        print("\n" + "="*80)
        print("SLIDE 72: WISDOM OF CROWDS")
        print("="*80)
        print("  Content: Which party is likely to win next elections (7DMA and Overall)")
        print("  Question: '19. In your opinion, which party would win the next election in your constituency, when you would elect your MLA?'")
        print("  See detailed calculations in: AUDIT: WISDOM OF CROWDS (Slide 72)")
        
        # Slide 74: Vote Share by Regions
        print("\n" + "="*80)
        print("SLIDE 74: VOTE SHARE BY REGIONS")
        print("="*80)
        print("  Content: Vote share percentages by region (2021 AE, 7DMA, and Overall)")
        print("  Question: '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'")
        print("  Shows: Sample size, vote shares for AITC, BJP, LEFT, INC, Others, N+W+R, and Margin (AITC - BJP)")
        print("  See detailed calculations in: AUDIT: VOTE SHARE BY REGIONS (Slide 74)")
        
        # Slides 75-84: Regional Graphs
        print("\n" + "="*80)
        print("SLIDES 75-84: REGIONAL GRAPHS")
        print("="*80)
        print("  Content: Vote share graphs by region (Overall and 7DMA)")
        print("  Question: '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'")
        print("  Regions: Jalpaiguri, Malda, Murshidabad, Nadia, North 24 Parganas, Purba Bardhaman, Purba Medinipur, South 24 Parganas, Uttar Dinajpur, Hooghly")
        print("  Odd slides (75, 77, 79, ...): Overall cumulative vote share (last 17 days)")
        print("  Even slides (76, 78, 80, ...): 7DMA vote share (last 13 days)")
        print("  Graph starts from first date with actual data for each region")
        print("  Dates displayed in MM/DD/YYYY format, vertically rotated")
        print("  See detailed calculations in: AUDIT: REGIONAL GRAPHS (Slides 75-84)")
        
        # Slides 86-87: Empty slides
        print("\n" + "="*80)
        print("SLIDES 86-87: EMPTY SLIDES")
        print("="*80)
        print("  Content: Left empty as per template")
        print("  No calculations required")
        
        # Slides 88-93: District Tables
        print("\n" + "="*80)
        print("SLIDES 88-93: DISTRICT TABLES")
        print("="*80)
        print("  Content: Vote share tables by district (15DMA, Overall, and 7DMA)")
        print("  Question: '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'")
        print("  Slides 88-89: 15DMA districts")
        print("  Slides 90-91: Overall districts")
        print("  Slides 92-93: 7DMA districts")
        print("  Shows: Sample size (actual count, not normalized), vote shares for AITC, BJP, LEFT, INC, Others, N+W+R, and Margin (AITC - BJP)")
        print("  Uses District-level weights: 'Weight - with Vote Share - AE 2021 - District L15D' (15DMA), 'Weight - with Vote Share - AE 2021 - District L7D' (7DMA), 'Weight - with Vote Share - AE 2021 - District' (Overall)")
        print("  Also shows: 2024 GE Winner, 2021 GE Winner (from template)")
        print("  See detailed calculations in: AUDIT: DISTRICT TABLES (Slides 88-93)")
        
        # Slides 95-136: District Graphs
        print("\n" + "="*80)
        print("SLIDES 95-136: DISTRICT GRAPHS")
        print("="*80)
        print("  Content: Vote share graphs by district (15DMA and Overall)")
        print("  Question: '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'")
        print("  Odd slides (95, 97, 99, ...): 15DMA vote share (last 13 days, limited to max 9 date points)")
        print("  Even slides (96, 98, 100, ...): Overall cumulative vote share (last 17 days, limited to max 9 date points)")
        print("  Graph starts from first date with actual data for each district")
        print("  Dates displayed in MM/DD/YYYY format, horizontally (not vertical)")
        print("  Maximum 9 date points shown per graph")
        print("  Uses District-level weights: 'Weight - with Vote Share - AE 2021 - District L15D' (15DMA), 'Weight - with Vote Share - AE 2021 - District' (Overall)")
        print("  Legend positioned lower to avoid overlapping with dates")
        print("  See detailed calculations in: AUDIT: DISTRICT GRAPHS (Slides 95-136)")
    
    def audit_vote_transferability_tables(self):
        """Audit trail for Vote Transferability tables (Slides 63-64)"""
        print("\n" + "="*80)
        print("AUDIT: VOTE TRANSFERABILITY TABLES (Slides 63-64)")
        print("="*80)
        
        question_first_choice = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        question_second_choice_reason = '10. Could you tell us the reason for choosing the above party as your second choice?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  These tables show the percentage of people who vote for party X as first choice")
        print(f"  and party Y as second choice")
        print(f"  Rows: First choice party (AITC, BJP, LEFT, INC, Others, N+W+R)")
        print(f"  Columns: Second choice party (AITC, BJP, LEFT, INC, Others, N+W+R*)")
        print(f"  Values: Percentage of first choice party X voters who choose party Y as second choice")
        
        print(f"\nData Sources:")
        print(f"  First Choice: {question_first_choice}")
        print(f"  Second Choice: Question 9 (party) - filtered by Question 10 (reason) response")
        print(f"  Question 10: {question_second_choice_reason}")
        print(f"  Weight Column: {weight_column}")
        print(f"\n  Note: Only records with a Question 10 response (indicating they have a second choice)")
        print(f"        are included in the calculation. Question 9 provides the actual second choice party.")
        
        # Find Question 9 column
        question_second_choice = None
        for col in self.df.columns:
            if '9.' in str(col) and 'assume' in str(col).lower() and 'party' in str(col).lower() and 'choose' in str(col).lower():
                question_second_choice = col
                break
        if question_second_choice is None:
            for col in self.df.columns:
                if '9.' in str(col) and 'party' in str(col).lower():
                    question_second_choice = col
                    break
        
        if question_second_choice is None:
            print(f"\n  ERROR: Question 9 column not found")
            return
        
        print(f"  Question 9 (Second Choice Party): {question_second_choice}")
        
        # Helper function to calculate vote transferability
        def calculate_transferability_detailed(data_filtered, slide_name, date_filter_desc):
            # Filter to records with first choice
            eligible_data = data_filtered[data_filtered[question_first_choice].notna()].copy()
            
            # Find all Question 10 columns
            q10_columns = [c for c in eligible_data.columns if question_second_choice_reason in str(c)]
            
            # Filter to records that have a second choice (indicated by having at least one Q10 response)
            if q10_columns:
                has_second_choice = False
                for q10_col in q10_columns:
                    has_second_choice = has_second_choice | (pd.to_numeric(eligible_data[q10_col], errors='coerce') == 1)
                eligible_data = eligible_data[has_second_choice].copy()
            
            # Filter to records that also have Question 9 (second choice party) response
            if question_second_choice not in eligible_data.columns:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    Question 9 column not found")
                return
            
            eligible_data = eligible_data[eligible_data[question_second_choice].notna()].copy()
            
            if len(eligible_data) == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No eligible records found")
                return
            
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            
            eligible_data['party_first'] = eligible_data[question_first_choice].apply(self.calculator.categorize_party)
            eligible_data['party_second'] = eligible_data[question_second_choice].apply(self.calculator.categorize_party)
            
            parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            
            print(f"\n  {slide_name}:")
            print(f"    Date Filter: {date_filter_desc}")
            print(f"    Eligible Records (with first and second choice): {len(eligible_data):,}")
            print(f"    Total Weight Sum: {weights.sum():,.2f}")
            
            # Calculate transferability matrix
            for party_first in parties:
                party_first_data = eligible_data[eligible_data['party_first'] == party_first].copy()
                
                if len(party_first_data) == 0:
                    print(f"\n    First Choice: {party_first}")
                    print(f"      No records found")
                    continue
                
                party_weights = weights.loc[party_first_data.index]
                total_weight_first = party_weights.sum()
                
                print(f"\n    First Choice: {party_first}")
                print(f"      Records: {len(party_first_data):,}")
                print(f"      Total Weight: {total_weight_first:,.2f}")
                
                if total_weight_first == 0:
                    print(f"      No valid weights")
                    continue
                
                # Calculate percentage for each second choice
                for party_second in parties:
                    party_second_data = party_first_data[party_first_data['party_second'] == party_second].copy()
                    if len(party_second_data) > 0:
                        weight_sum = party_weights.loc[party_second_data.index].sum()
                        percentage = (weight_sum / total_weight_first) * 100
                        print(f"      → {party_second}: {percentage:.1f}% (Weight: {weight_sum:,.2f} / {total_weight_first:,.2f} × 100, Records: {len(party_second_data):,})")
                    else:
                        print(f"      → {party_second}: 0.0% (No records)")
        
        # Slide 63: 7 DMA
        dma7_data = self.calculator.filter_by_date_range(
            days=7,
            exclude_latest=True,
            reference_date=self.reference_date
        )
        calculate_transferability_detailed(
            dma7_data,
            "Slide 63: Vote Transferability - 7 DMA",
            f"Last 7 days ending one day before {self.reference_date.strftime('%Y-%m-%d')}"
        )
        
        # Slide 64: Overall
        overall_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        calculate_transferability_detailed(
            overall_data,
            "Slide 64: Vote Transferability - Overall",
            f"All data up to {self.reference_date.strftime('%Y-%m-%d')}"
        )
    
    def audit_preferred_cm_candidate(self):
        """Audit trail for Preferred CM Candidate table (Slide 66)"""
        print("\n" + "="*80)
        print("AUDIT: PREFERRED CM CANDIDATE (Slide 66)")
        print("="*80)
        
        question = '17. Who do you think is the best leader to be the Chief Minister of West Bengal?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  This table shows the percentage of people who prefer each CM candidate")
        print(f"  Columns: 7DMA and Overall")
        print(f"  Rows: Different CM candidates (sorted by percentage)")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column: {weight_column}")
        
        # Helper function to calculate preferred CM
        def calculate_cm_detailed(data_filtered, slide_name, date_filter_desc):
            eligible_data = data_filtered[data_filtered[question].notna()].copy()
            
            if len(eligible_data) == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No eligible records found")
                return
            
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            
            total_weight = weights.sum()
            if total_weight == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No valid weights found")
                return
            
            print(f"\n  {slide_name}:")
            print(f"    Date Filter: {date_filter_desc}")
            print(f"    Eligible Records: {len(eligible_data):,}")
            print(f"    Total Weight Sum: {total_weight:,.2f}")
            
            # Calculate percentages for each CM candidate code
            percentages = {}
            for code in eligible_data[question].dropna().unique():
                if pd.isna(code) or code == 'q17':
                    continue
                try:
                    code_int = int(code)
                except:
                    continue
                code_data = eligible_data[eligible_data[question] == code_int]
                if len(code_data) > 0:
                    weight_sum = weights.loc[code_data.index].sum()
                    percentage = (weight_sum / total_weight) * 100
                    percentages[code_int] = {
                        'percentage': percentage,
                        'records': len(code_data),
                        'weight_sum': weight_sum
                    }
            
            # Sort by percentage (descending)
            sorted_cm = sorted(percentages.items(), key=lambda x: x[1]['percentage'], reverse=True)
            
            print(f"\n    CM Candidate Percentages (sorted by percentage):")
            for code, data in sorted_cm:
                print(f"      Code {code}: {data['percentage']:.1f}% (Weight: {data['weight_sum']:,.2f} / {total_weight:,.2f} × 100, Records: {data['records']:,})")
        
        # Slide 66: 7DMA
        dma7_data = self.calculator.filter_by_date_range(
            days=7,
            exclude_latest=True,
            reference_date=self.reference_date
        )
        calculate_cm_detailed(
            dma7_data,
            "Slide 66: Preferred CM Candidate - 7DMA",
            f"Last 7 days ending one day before {self.reference_date.strftime('%Y-%m-%d')}"
        )
        
        # Slide 66: Overall
        overall_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        calculate_cm_detailed(
            overall_data,
            "Slide 66: Preferred CM Candidate - Overall",
            f"All data up to {self.reference_date.strftime('%Y-%m-%d')}"
        )
    
    def audit_state_government_rating(self):
        """Audit trail for State Government Rating table (Slide 68)"""
        print("\n" + "="*80)
        print("AUDIT: STATE GOVERNMENT RATING (Slide 68)")
        print("="*80)
        
        question = '14. How satisfied or dissatisfied are you with the performance of the state govt led by Mamata Banerjee?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  This table shows the percentage of people with each satisfaction rating")
        print(f"  Columns: 7DMA and Overall")
        print(f"  Ratings: 1 = Very Satisfied, 2 = Satisfied, 3 = Neutral, 4 = Dissatisfied, 5 = Very Dissatisfied")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column: {weight_column}")
        
        # Rating codes: 1 = Very Satisfied, 2 = Satisfied, 3 = Neutral, 4 = Dissatisfied, 5 = Very Dissatisfied
        rating_map = {
            1: 'Very Satisfied',
            2: 'Satisfied',
            3: 'Neutral',
            4: 'Dissatisfied',
            5: 'Very Dissatisfied'
        }
        
        # Helper function to calculate rating
        def calculate_rating_detailed(data_filtered, slide_name, date_filter_desc):
            eligible_data = data_filtered[data_filtered[question].notna()].copy()
            
            # Remove invalid responses
            eligible_data = eligible_data[eligible_data[question] != 'q14'].copy()
            
            if len(eligible_data) == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No eligible records found")
                return
            
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            
            total_weight = weights.sum()
            if total_weight == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No valid weights found")
                return
            
            print(f"\n  {slide_name}:")
            print(f"    Date Filter: {date_filter_desc}")
            print(f"    Eligible Records: {len(eligible_data):,}")
            print(f"    Total Weight Sum: {total_weight:,.2f}")
            
            print(f"\n    Rating Percentages:")
            for code in [1, 2, 3, 4, 5]:
                code_data = eligible_data[pd.to_numeric(eligible_data[question], errors='coerce') == code]
                if len(code_data) > 0:
                    weight_sum = weights.loc[code_data.index].sum()
                    percentage = (weight_sum / total_weight) * 100
                    print(f"      {code} ({rating_map[code]}): {percentage:.1f}% (Weight: {weight_sum:,.2f} / {total_weight:,.2f} × 100, Records: {len(code_data):,})")
                else:
                    print(f"      {code} ({rating_map[code]}): 0.0% (No records)")
        
        # Slide 68: 7DMA
        dma7_data = self.calculator.filter_by_date_range(
            days=7,
            exclude_latest=True,
            reference_date=self.reference_date
        )
        calculate_rating_detailed(
            dma7_data,
            "Slide 68: State Government Rating - 7DMA",
            f"Last 7 days ending one day before {self.reference_date.strftime('%Y-%m-%d')}"
        )
        
        # Slide 68: Overall
        overall_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        calculate_rating_detailed(
            overall_data,
            "Slide 68: State Government Rating - Overall",
            f"All data up to {self.reference_date.strftime('%Y-%m-%d')}"
        )
    
    def audit_key_issues(self):
        """Audit trail for Key Issues table (Slide 70)"""
        print("\n" + "="*80)
        print("AUDIT: KEY ISSUES (Slide 70)")
        print("="*80)
        
        question_prefix = '13. According to you, what are the three most pressing issues of your assembly constituency?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  This table shows the top pressing issues of assembly constituency")
        print(f"  Columns: Issue, Sample, 30DMA (empty), Overall")
        print(f"  Rows: Top issues sorted by weighted count (descending)")
        
        print(f"\nData Sources:")
        print(f"  Question: {question_prefix}")
        print(f"  Weight Column: {weight_column}")
        print(f"  Note: 30DMA column is left empty as per template")
        
        # Filter data: all data up to reference_date
        filtered_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        
        # Find all Q13 columns
        issue_cols = [col for col in filtered_data.columns 
                     if str(col).startswith(question_prefix)]
        
        if len(issue_cols) == 0:
            print(f"\n  Slide 70: Key Issues - Overall")
            print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
            print(f"    No issue columns found")
            return
        
        print(f"\n  Total Issue Options: {len(issue_cols)}")
        
        # Filter to records with at least one issue selected
        has_issue = filtered_data[issue_cols].notna().any(axis=1)
        eligible_data = filtered_data[has_issue].copy()
        
        if len(eligible_data) == 0:
            print(f"\n  Slide 70: Key Issues - Overall")
            print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
            print(f"    No eligible records found")
            return
        
        weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
        eligible_data = eligible_data[weights.notna()].copy()
        weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
        
        total_weight = weights.sum()
        if total_weight == 0:
            print(f"\n  Slide 70: Key Issues - Overall")
            print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
            print(f"    No valid weights found")
            return
        
        print(f"\n  Slide 70: Key Issues - Overall")
        print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
        print(f"    Eligible Records: {len(eligible_data):,}")
        print(f"    Total Weight Sum: {total_weight:,.2f}")
        
        # Calculate weighted counts for each issue
        issue_counts = {}
        for col in issue_cols:
            # Extract issue text (everything after " - ")
            issue_text = str(col).split(' - ')[-1] if ' - ' in str(col) else str(col)
            
            # Convert column to numeric (0 or 1)
            issue_values = pd.to_numeric(eligible_data[col], errors='coerce').fillna(0)
            
            # Calculate weighted sum
            weighted_sum = (issue_values * weights).sum()
            
            # Calculate percentage
            percentage = (weighted_sum / total_weight * 100) if total_weight > 0 else 0
            
            issue_counts[issue_text] = {
                'weighted_count': weighted_sum,
                'percentage': percentage,
                'record_count': int(issue_values.sum())
            }
        
        # Sort by weighted count and get top issues
        top_issues = sorted(issue_counts.items(), key=lambda x: x[1]['weighted_count'], reverse=True)
        
        print(f"\n    Top Issues (sorted by weighted count):")
        for i, (issue_text, data) in enumerate(top_issues[:12], 1):
            print(f"      {i}. {issue_text}")
            print(f"         Weighted Count: {data['weighted_count']:,.2f}")
            print(f"         Percentage: {data['percentage']:.1f}%")
            print(f"         Calculation: {data['weighted_count']:,.2f} / {total_weight:,.2f} × 100 = {data['percentage']:.1f}%")
            print(f"         Record Count: {data['record_count']:,}")
    
    def audit_wisdom_of_crowds(self):
        """Audit trail for Wisdom of Crowds table (Slide 72)"""
        print("\n" + "="*80)
        print("AUDIT: WISDOM OF CROWDS (Slide 72)")
        print("="*80)
        
        question = '19. In your opinion, which party would win the next election in your constituency, when you would elect your MLA?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        
        print(f"\nOverview:")
        print(f"  This table shows the percentage of people who think each party will win")
        print(f"  Columns: 7DMA and Overall")
        print(f"  Rows: Parties (AITC, BJP, LEFT, INC, Others, NWR)")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column: {weight_column}")
        
        # Helper function to calculate wisdom of crowds
        def calculate_woc_detailed(data_filtered, slide_name, date_filter_desc):
            eligible_data = data_filtered[data_filtered[question].notna()].copy()
            
            if len(eligible_data) == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No eligible records found")
                return
            
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            
            total_weight = weights.sum()
            if total_weight == 0:
                print(f"\n  {slide_name}:")
                print(f"    Date Filter: {date_filter_desc}")
                print(f"    No valid weights found")
                return
            
            print(f"\n  {slide_name}:")
            print(f"    Date Filter: {date_filter_desc}")
            print(f"    Eligible Records: {len(eligible_data):,}")
            print(f"    Total Weight Sum: {total_weight:,.2f}")
            
            # Categorize party responses
            eligible_data['party'] = eligible_data[question].apply(self.calculator.categorize_party)
            
            # Calculate percentages for each party
            parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            percentages = {}
            
            print(f"\n    Party Percentages:")
            for party in parties:
                party_data = eligible_data[eligible_data['party'] == party].copy()
                if len(party_data) > 0:
                    weight_sum = weights.loc[party_data.index].sum()
                    percentage = (weight_sum / total_weight) * 100
                    percentages[party] = {
                        'percentage': percentage,
                        'records': len(party_data),
                        'weight_sum': weight_sum
                    }
                    print(f"      {party}: {percentage:.1f}% (Weight: {weight_sum:,.2f} / {total_weight:,.2f} × 100, Records: {len(party_data):,})")
                else:
                    percentages[party] = {
                        'percentage': 0,
                        'records': 0,
                        'weight_sum': 0
                    }
                    print(f"      {party}: 0.0% (No records)")
        
        # Slide 72: 7DMA
        dma7_data = self.calculator.filter_by_date_range(
            days=7,
            exclude_latest=True,
            reference_date=self.reference_date
        )
        calculate_woc_detailed(
            dma7_data,
            "Slide 72: Wisdom of Crowds - 7DMA",
            f"Last 7 days ending one day before {self.reference_date.strftime('%Y-%m-%d')}"
        )
        
        # Slide 72: Overall
        overall_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        calculate_woc_detailed(
            overall_data,
            "Slide 72: Wisdom of Crowds - Overall",
            f"All data up to {self.reference_date.strftime('%Y-%m-%d')}"
        )
    
    def audit_vote_share_by_regions(self):
        """Audit trail for Vote Share by Regions table (Slide 74)"""
        print("\n" + "="*80)
        print("AUDIT: VOTE SHARE BY REGIONS (Slide 74)")
        print("="*80)
        
        question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column = 'Weight - with Vote Share - AE 2021 - Region'
        region_column = 'Region Name'
        
        print(f"\nOverview:")
        print(f"  This table shows vote share percentages by region")
        print(f"  Columns: Region, Sample, Party vote shares (AITC, BJP, LEFT, INC, Others, NWR)")
        print(f"  Rows: Different regions")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column: {weight_column}")
        print(f"  Region Column: {region_column}")
        
        # Filter data: all data up to reference_date
        filtered_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        
        # Filter to records with valid response
        eligible_data = filtered_data[filtered_data[question].notna()].copy()
        
        if len(eligible_data) == 0:
            print(f"\n  Slide 74: Vote Share by Regions - Overall")
            print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
            print(f"    No eligible records found")
            return
        
        # Get weights
        if weight_column in eligible_data.columns:
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
            eligible_data = eligible_data[weights.notna()].copy()
            weights = pd.to_numeric(eligible_data[weight_column], errors='coerce')
        else:
            weights = pd.Series([1.0] * len(eligible_data), index=eligible_data.index)
        
        # Categorize party responses
        eligible_data['party'] = eligible_data[question].apply(self.calculator.categorize_party)
        
        # Get unique regions
        regions = eligible_data[region_column].dropna().unique()
        parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
        
        print(f"\n  Slide 74: Vote Share by Regions - Overall")
        print(f"    Date Filter: All data up to {self.reference_date.strftime('%Y-%m-%d')}")
        print(f"    Total Eligible Records: {len(eligible_data):,}")
        print(f"    Total Regions: {len(regions)}")
        
        # Calculate for each region
        for region in sorted(regions):
            region_records = eligible_data[eligible_data[region_column] == region].copy()
            if len(region_records) == 0:
                continue
            
            region_weights = weights.loc[region_records.index]
            total_weight_region = region_weights.sum()
            
            if total_weight_region == 0:
                continue
            
            print(f"\n    Region: {region}")
            print(f"      Records: {len(region_records):,}")
            print(f"      Total Weight Sum: {total_weight_region:,.2f}")
            
            print(f"      Vote Shares:")
            for party in parties:
                party_data = region_records[region_records['party'] == party].copy()
                if len(party_data) > 0:
                    party_weight = region_weights.loc[party_data.index].sum()
                    percentage = (party_weight / total_weight_region) * 100
                    print(f"        {party}: {percentage:.1f}% (Weight: {party_weight:,.2f} / {total_weight_region:,.2f} × 100, Records: {len(party_data):,})")
                else:
                    print(f"        {party}: 0.0% (No records)")
    
    def audit_regional_graphs(self):
        """Audit trail for Regional Graphs (Slides 75-84)"""
        print("\n" + "="*80)
        print("AUDIT: REGIONAL GRAPHS (Slides 75-84)")
        print("="*80)
        
        question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column_overall = 'Weight - with Vote Share - AE 2021 - Region'
        weight_column_7dma = 'Weight - with Vote Share - AE 2021 - Region L7D'
        region_column = 'Region Name'
        
        print(f"\nOverview:")
        print(f"  These graphs show vote share trends by region over time")
        print(f"  Slides 75, 77, 79, 81, 83: Overall cumulative vote share (last 17 days)")
        print(f"  Slides 76, 78, 80, 82, 84: 7DMA vote share (last 13 days)")
        print(f"  Regions: Jalpaiguri, Malda, Burdwan, Medinipur, Presidency")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column (Overall): {weight_column_overall}")
        print(f"  Weight Column (7DMA): {weight_column_7dma} (with fallback to {weight_column_overall})")
        print(f"  Region Column: {region_column}")
        
        region_order = ['Jalpaiguri', 'Malda', 'Burdwan', 'Medinipur', 'Presidency']
        
        for region in region_order:
            region_data = self.df[self.df[region_column] == region].copy()
            if len(region_data) == 0:
                print(f"\n  Region: {region}")
                print(f"    No data found")
                continue
            
            print(f"\n  Region: {region}")
            
            # Overall calculation
            overall_data = region_data[region_data['Survey Date'] <= self.reference_date].copy()
            unique_dates = sorted(overall_data['Survey Date'].dropna().unique())
            if len(unique_dates) > 0:
                # Note: Only dates with actual data for this region are included
                # Graph starts from the first date with data, not from day 0
                dates_to_calculate = unique_dates[-17:] if len(unique_dates) >= 17 else unique_dates
                print(f"    Overall (Slides 75, 77, 79, 81, 83):")
                print(f"      Date Range: {dates_to_calculate[0].strftime('%Y-%m-%d')} to {dates_to_calculate[-1].strftime('%Y-%m-%d')}")
                print(f"      Total Dates: {len(dates_to_calculate)}")
                print(f"      Weight Column: {weight_column_overall}")
                print(f"      Calculation: Cumulative vote share up to each date")
                print(f"      Note: Graph starts from first date with actual data for this region, not from day 0")
            
            # 7DMA calculation
            end_date = self.reference_date - timedelta(days=1)
            cutoff_date = end_date - timedelta(days=6)
            dma7_data = region_data[
                (region_data['Survey Date'] >= cutoff_date) & 
                (region_data['Survey Date'] <= end_date)
            ].copy()
            unique_dates_7dma = sorted(dma7_data['Survey Date'].dropna().unique())
            if len(unique_dates_7dma) > 0:
                # Note: Only dates with actual data in the 7-day window are included
                # Graph starts from the first date with data, not from day 0
                dates_to_calculate_7dma = unique_dates_7dma[-13:] if len(unique_dates_7dma) >= 13 else unique_dates_7dma
                print(f"    7DMA (Slides 76, 78, 80, 82, 84):")
                print(f"      Date Range: {dates_to_calculate_7dma[0].strftime('%Y-%m-%d')} to {dates_to_calculate_7dma[-1].strftime('%Y-%m-%d')}")
                print(f"      Total Dates: {len(dates_to_calculate_7dma)}")
                print(f"      Weight Column: {weight_column_7dma} (with fallback to {weight_column_overall})")
                print(f"      Calculation: 7-day moving average vote share for each date")
                print(f"      Note: Graph starts from first date with actual data for this region, not from day 0")
                print(f"      Sample Size: {len(dma7_data[dma7_data[question].notna()].copy()):,}")
    
    def audit_district_tables(self):
        """Audit trail for District Tables (Slides 88-93)"""
        print("\n" + "="*80)
        print("AUDIT: DISTRICT TABLES (Slides 88-93)")
        print("="*80)
        
        question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column_15dma = 'Weight - with Vote Share - AE 2021 - District L15D'
        weight_column_overall = 'Weight - with Vote Share - AE 2021 - District'
        district_column = 'District Name'
        
        print(f"\nOverview:")
        print(f"  These tables show vote share percentages by district")
        print(f"  Slides 88-89: 15DMA vote share")
        print(f"  Slides 90-91: Overall vote share")
        print(f"  Slides 92-93: 7DMA vote share")
        print(f"  Columns: District, Sample, AITC, BJP, LEFT, INC, Others, NWR, Margin (AITC - BJP)")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column (15DMA): {weight_column_15dma} (DISTRICT-LEVEL, with fallback to {weight_column_overall})")
        print(f"  Weight Column (Overall): {weight_column_overall} (DISTRICT-LEVEL)")
        print(f"  Weight Column (7DMA): Weight - with Vote Share - AE 2021 - District L7D (DISTRICT-LEVEL, with fallback to {weight_column_overall})")
        print(f"  District Column: {district_column}")
        print(f"  IMPORTANT: All calculations use DISTRICT-LEVEL weights, NOT Region-level weights")
        print(f"  This ensures proper normalization at the district level for accurate vote share calculations")
        
        # Get unique districts
        unique_districts = self.df[district_column].dropna().unique()
        unique_districts = sorted([d for d in unique_districts if d != 'district_name'])
        
        print(f"\n  Total Districts: {len(unique_districts)}")
        
        # 15DMA calculation
        end_date = self.reference_date - timedelta(days=1)
        cutoff_date = end_date - timedelta(days=14)
        dma15_data = self.df[
            (self.df['Survey Date'] >= cutoff_date) & 
            (self.df['Survey Date'] <= end_date)
        ].copy()
        
        # 15DMA calculation
        print(f"\n  15DMA (Slides 88-89):")
        print(f"    Date Range: {cutoff_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        print(f"    Weight Column: {weight_column_15dma} (DISTRICT-LEVEL, with fallback to {weight_column_overall})")
        print(f"    Total Records: {len(dma15_data):,}")
        print(f"    Calculation: For each district, calculate weighted vote share using DISTRICT-LEVEL 15DMA weights")
        print(f"    Formula: (Σ District Weight for Party in District / Σ Total District Weights in District) × 100")
        print(f"    Note: Uses District-level weights, NOT Region-level weights, for proper district normalization")
        
        # Show detailed calculations for all districts
        for district in unique_districts:
            district_data = dma15_data[dma15_data[district_column] == district].copy()
            if len(district_data) == 0:
                continue
            
            # Check if L15D weights are available
            l15d_col = weight_column_15dma
            regular_col = weight_column_overall
            
            l15d_available = district_data[l15d_col].notna().sum() if l15d_col in district_data.columns else 0
            total_records = len(district_data)
            
            if l15d_available > 0 and (l15d_available / total_records) >= 0.5:
                # Use L15D weights
                district_data_with_weights = district_data[district_data[l15d_col].notna()].copy()
                weight_column_used = l15d_col
            else:
                # Fall back to regular weights
                district_data_with_weights = district_data.copy()
                weight_column_used = regular_col
            
            vote_shares = self.calculator.calculate_vote_share(
                district_data_with_weights, 
                weight_column=weight_column_used,
                use_weights=True
            )
            
            # Get detailed weight sums for each party
            question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
            district_data_with_votes = district_data_with_weights[district_data_with_weights[question].notna()].copy()
            total_weight = district_data_with_votes[weight_column_used].sum()
            
            print(f"\n    District: {district}")
            print(f"      Records: {len(district_data):,}")
            print(f"      Records with Valid Votes: {len(district_data_with_votes):,}")
            print(f"      Weight Column Used: {weight_column_used}")
            print(f"      Total Weight: {total_weight:,.2f}")
            print(f"      Sample: {vote_shares.get('sample', 0):,}")
            
            # Calculate and show each party's vote share
            # Create reverse mapping from party name to codes
            party_name_to_codes = {
                'AITC': [1],
                'BJP': [2],
                'INC': [3],
                'LEFT': [4],
                'Others': [12, 44],
                'NWR': [55, 66, 67, 77, 78, 88]
            }
            
            parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            for party in parties:
                party_codes = party_name_to_codes.get(party, [])
                if len(party_codes) > 0:
                    party_data = district_data_with_votes[district_data_with_votes[question].isin(party_codes)].copy()
                else:
                    party_data = pd.DataFrame()
                
                party_weight = party_data[weight_column_used].sum() if len(party_data) > 0 else 0
                party_pct = vote_shares.get(party, 0)
                
                print(f"      {party}: {party_pct:.1f}% (Weight: {party_weight:,.2f} / {total_weight:,.2f} × 100)")
            
            # Calculate margin
            aitc_pct = vote_shares.get('AITC', 0)
            bjp_pct = vote_shares.get('BJP', 0)
            margin = aitc_pct - bjp_pct
            print(f"      Margin (AITC - BJP): {margin:.1f}% ({aitc_pct:.1f}% - {bjp_pct:.1f}%)")
        
        # Overall calculation
        overall_data = self.df[self.df['Survey Date'] <= self.reference_date].copy()
        print(f"\n  Overall (Slides 90-91):")
        print(f"    Date Range: Up to {self.reference_date.strftime('%Y-%m-%d')}")
        print(f"    Weight Column: {weight_column_overall} (DISTRICT-LEVEL)")
        print(f"    Total Records: {len(overall_data):,}")
        print(f"    Calculation: For each district, calculate weighted vote share using DISTRICT-LEVEL overall weights")
        print(f"    Formula: (Σ District Weight for Party in District / Σ Total District Weights in District) × 100")
        print(f"    Note: Uses District-level weights, NOT Region-level weights, for proper district normalization")
        
        # Show detailed calculations for all districts
        for district in unique_districts:
            district_data = overall_data[overall_data[district_column] == district].copy()
            if len(district_data) == 0:
                continue
            
            vote_shares = self.calculator.calculate_vote_share(
                district_data, 
                weight_column=weight_column_overall,
                use_weights=True
            )
            
            # Get detailed weight sums for each party
            district_data_with_votes = district_data[district_data[question].notna()].copy()
            total_weight = district_data_with_votes[weight_column_overall].sum()
            
            print(f"\n    District: {district}")
            print(f"      Records: {len(district_data):,}")
            print(f"      Records with Valid Votes: {len(district_data_with_votes):,}")
            print(f"      Weight Column Used: {weight_column_overall}")
            print(f"      Total Weight: {total_weight:,.2f}")
            print(f"      Sample: {vote_shares.get('sample', 0):,}")
            
            # Calculate and show each party's vote share
            # Create reverse mapping from party name to codes
            party_name_to_codes = {
                'AITC': [1],
                'BJP': [2],
                'INC': [3],
                'LEFT': [4],
                'Others': [12, 44],
                'NWR': [55, 66, 67, 77, 78, 88]
            }
            
            parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            for party in parties:
                party_codes = party_name_to_codes.get(party, [])
                if len(party_codes) > 0:
                    party_data = district_data_with_votes[district_data_with_votes[question].isin(party_codes)].copy()
                else:
                    party_data = pd.DataFrame()
                
                party_weight = party_data[weight_column_overall].sum() if len(party_data) > 0 else 0
                party_pct = vote_shares.get(party, 0)
                
                print(f"      {party}: {party_pct:.1f}% (Weight: {party_weight:,.2f} / {total_weight:,.2f} × 100)")
            
            # Calculate margin
            aitc_pct = vote_shares.get('AITC', 0)
            bjp_pct = vote_shares.get('BJP', 0)
            margin = aitc_pct - bjp_pct
            print(f"      Margin (AITC - BJP): {margin:.1f}% ({aitc_pct:.1f}% - {bjp_pct:.1f}%)")
        
        # 7DMA calculation
        weight_column_7dma = 'Weight - with Vote Share - AE 2021 - District L7D'
        end_date_7dma = self.reference_date - timedelta(days=1)
        cutoff_date_7dma = end_date_7dma - timedelta(days=6)
        dma7_data = self.df[
            (self.df['Survey Date'] >= cutoff_date_7dma) & 
            (self.df['Survey Date'] <= end_date_7dma)
        ].copy()
        
        print(f"\n  7DMA (Slides 92-93):")
        print(f"    Date Range: {cutoff_date_7dma.strftime('%Y-%m-%d')} to {end_date_7dma.strftime('%Y-%m-%d')}")
        print(f"    Weight Column: {weight_column_7dma} (DISTRICT-LEVEL, with fallback to {weight_column_overall})")
        print(f"    Total Records: {len(dma7_data):,}")
        print(f"    Calculation: For each district, calculate weighted vote share using DISTRICT-LEVEL 7DMA weights")
        print(f"    Formula: (Σ District Weight for Party in District / Σ Total District Weights in District) × 100")
        print(f"    Note: Uses District-level weights, NOT Region-level weights, for proper district normalization")
        
        # Show detailed calculations for all districts
        for district in unique_districts:
            district_data = dma7_data[dma7_data[district_column] == district].copy()
            if len(district_data) == 0:
                continue
            
            # Check if L7D weights are available
            l7d_col = weight_column_7dma
            regular_col = weight_column_overall
            
            l7d_available = district_data[l7d_col].notna().sum() if l7d_col in district_data.columns else 0
            total_records = len(district_data)
            
            if l7d_available > 0 and (l7d_available / total_records) >= 0.5:
                # Use L7D weights
                district_data_with_weights = district_data[district_data[l7d_col].notna()].copy()
                weight_column_used = l7d_col
            else:
                # Fall back to regular weights
                district_data_with_weights = district_data.copy()
                weight_column_used = regular_col
            
            vote_shares = self.calculator.calculate_vote_share(
                district_data_with_weights, 
                weight_column=weight_column_used,
                use_weights=True
            )
            
            # Get detailed weight sums for each party
            district_data_with_votes = district_data_with_weights[district_data_with_weights[question].notna()].copy()
            total_weight = district_data_with_votes[weight_column_used].sum()
            
            print(f"\n    District: {district}")
            print(f"      Records: {len(district_data):,}")
            print(f"      Records with Valid Votes: {len(district_data_with_votes):,}")
            print(f"      Weight Column Used: {weight_column_used}")
            print(f"      Total Weight: {total_weight:,.2f}")
            print(f"      Sample: {vote_shares.get('sample', 0):,}")
            
            # Calculate and show each party's vote share
            # Create reverse mapping from party name to codes
            party_name_to_codes = {
                'AITC': [1],
                'BJP': [2],
                'INC': [3],
                'LEFT': [4],
                'Others': [12, 44],
                'NWR': [55, 66, 67, 77, 78, 88]
            }
            
            parties = ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']
            for party in parties:
                party_codes = party_name_to_codes.get(party, [])
                if len(party_codes) > 0:
                    party_data = district_data_with_votes[district_data_with_votes[question].isin(party_codes)].copy()
                else:
                    party_data = pd.DataFrame()
                
                party_weight = party_data[weight_column_used].sum() if len(party_data) > 0 else 0
                party_pct = vote_shares.get(party, 0)
                
                print(f"      {party}: {party_pct:.1f}% (Weight: {party_weight:,.2f} / {total_weight:,.2f} × 100)")
            
            # Calculate margin
            aitc_pct = vote_shares.get('AITC', 0)
            bjp_pct = vote_shares.get('BJP', 0)
            margin = aitc_pct - bjp_pct
            print(f"      Margin (AITC - BJP): {margin:.1f}% ({aitc_pct:.1f}% - {bjp_pct:.1f}%)")
    
    def audit_district_graphs(self):
        """Audit trail for District Graphs (Slides 95-136)"""
        print("\n" + "="*80)
        print("AUDIT: DISTRICT GRAPHS (Slides 95-136)")
        print("="*80)
        
        question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        weight_column_15dma = 'Weight - with Vote Share - AE 2021 - District L15D'
        weight_column_overall = 'Weight - with Vote Share - AE 2021 - District'
        district_column = 'District Name'
        
        print(f"\nOverview:")
        print(f"  These graphs show vote share trends by district over time")
        print(f"  Odd slides (95, 97, 99, ...): 15DMA vote share (last 13 days)")
        print(f"  Even slides (96, 98, 100, ...): Overall cumulative vote share (last 17 days)")
        
        print(f"\nData Sources:")
        print(f"  Question: {question}")
        print(f"  Weight Column (15DMA): {weight_column_15dma} (with fallback to {weight_column_overall})")
        print(f"  Weight Column (Overall): {weight_column_overall}")
        print(f"  District Column: {district_column}")
        
        # Get unique districts
        unique_districts = self.df[district_column].dropna().unique()
        unique_districts = sorted([d for d in unique_districts if d != 'district_name'])
        
        print(f"\n  Total Districts: {len(unique_districts)}")
        
        # Show detailed calculations for all districts
        for district in unique_districts:
            district_data = self.df[self.df[district_column] == district].copy()
            if len(district_data) == 0:
                continue
            
            print(f"\n  District: {district}")
            
            # Overall calculation
            overall_data = district_data[district_data['Survey Date'] <= self.reference_date].copy()
            unique_dates = sorted(overall_data['Survey Date'].dropna().unique())
            if len(unique_dates) > 0:
                dates_to_calculate = unique_dates[-17:] if len(unique_dates) >= 17 else unique_dates
                # Limit to max 9 points
                if len(dates_to_calculate) > 9:
                    dates_to_calculate = dates_to_calculate[-9:]
                
                print(f"    Overall (Even slides, e.g., Slide 96, 98, 100, ...):")
                print(f"      Date Range: {dates_to_calculate[0].strftime('%Y-%m-%d')} to {dates_to_calculate[-1].strftime('%Y-%m-%d')}")
                print(f"      Total Dates: {len(dates_to_calculate)} (limited to max 9)")
                print(f"      Weight Column: {weight_column_overall}")
                print(f"      Calculation: Cumulative vote share up to each date")
                print(f"      Date Format: MM/DD/YYYY (e.g., {dates_to_calculate[0].strftime('%m/%d/%Y')})")
                print(f"      Date Orientation: Horizontal (not vertical)")
                
                # Show sample calculation for first and last date
                if len(dates_to_calculate) > 0:
                    first_date = dates_to_calculate[0]
                    first_date_data = overall_data[overall_data['Survey Date'] <= first_date].copy()
                    first_date_data = first_date_data[first_date_data[question].notna()].copy()
                    if len(first_date_data) > 0:
                        vote_shares_first = self.calculator.calculate_vote_share(
                            first_date_data, weight_column=weight_column_overall, use_weights=True
                        )
                        print(f"      First Date ({first_date.strftime('%m/%d/%Y')}) Sample: {len(first_date_data):,}")
                        print(f"        AITC: {vote_shares_first.get('AITC', 0):.1f}%, BJP: {vote_shares_first.get('BJP', 0):.1f}%")
                    
                    last_date = dates_to_calculate[-1]
                    last_date_data = overall_data[overall_data['Survey Date'] <= last_date].copy()
                    last_date_data = last_date_data[last_date_data[question].notna()].copy()
                    if len(last_date_data) > 0:
                        vote_shares_last = self.calculator.calculate_vote_share(
                            last_date_data, weight_column=weight_column_overall, use_weights=True
                        )
                        print(f"      Last Date ({last_date.strftime('%m/%d/%Y')}) Sample: {len(last_date_data):,}")
                        print(f"        AITC: {vote_shares_last.get('AITC', 0):.1f}%, BJP: {vote_shares_last.get('BJP', 0):.1f}%")
            
            # 15DMA calculation
            end_date = self.reference_date - timedelta(days=1)
            cutoff_date = end_date - timedelta(days=14)
            dma15_data = district_data[
                (district_data['Survey Date'] >= cutoff_date) & 
                (district_data['Survey Date'] <= end_date)
            ].copy()
            unique_dates_15dma = sorted(dma15_data['Survey Date'].dropna().unique())
            if len(unique_dates_15dma) > 0:
                dates_to_calculate_15dma = unique_dates_15dma[-13:] if len(unique_dates_15dma) >= 13 else unique_dates_15dma
                # Limit to max 9 points
                if len(dates_to_calculate_15dma) > 9:
                    dates_to_calculate_15dma = dates_to_calculate_15dma[-9:]
                
                print(f"    15DMA (Odd slides, e.g., Slide 95, 97, 99, ...):")
                print(f"      Date Range: {dates_to_calculate_15dma[0].strftime('%Y-%m-%d')} to {dates_to_calculate_15dma[-1].strftime('%Y-%m-%d')}")
                print(f"      Total Dates: {len(dates_to_calculate_15dma)} (limited to max 9)")
                print(f"      Weight Column: {weight_column_15dma} (with fallback to {weight_column_overall})")
                print(f"      Calculation: 15-day moving average vote share for each date")
                print(f"      Date Format: MM/DD/YYYY (e.g., {dates_to_calculate_15dma[0].strftime('%m/%d/%Y')})")
                print(f"      Date Orientation: Horizontal (not vertical)")
                print(f"      Sample Size (7DMA window): {len(dma15_data[dma15_data[question].notna()].copy()):,}")
                
                # Show sample calculation for first and last date
                if len(dates_to_calculate_15dma) > 0:
                    first_date = dates_to_calculate_15dma[0]
                    first_end_date = first_date - timedelta(days=1)
                    first_cutoff = first_end_date - timedelta(days=14)
                    first_date_data = district_data[
                        (district_data['Survey Date'] >= first_cutoff) & 
                        (district_data['Survey Date'] <= first_end_date)
                    ].copy()
                    first_date_data = first_date_data[first_date_data[question].notna()].copy()
                    if len(first_date_data) > 0:
                        # Use L15D weight if available
                        weight_col_used = weight_column_15dma if weight_column_15dma in first_date_data.columns and first_date_data[weight_column_15dma].notna().sum() >= len(first_date_data) * 0.5 else weight_column_overall
                        vote_shares_first = self.calculator.calculate_vote_share(
                            first_date_data, weight_column=weight_col_used, use_weights=True
                        )
                        print(f"      First Date ({first_date.strftime('%m/%d/%Y')}) Sample: {len(first_date_data):,}")
                        print(f"        Weight Used: {weight_col_used}")
                        print(f"        AITC: {vote_shares_first.get('AITC', 0):.1f}%, BJP: {vote_shares_first.get('BJP', 0):.1f}%")
                    
                    last_date = dates_to_calculate_15dma[-1]
                    last_end_date = last_date - timedelta(days=1)
                    last_cutoff = last_end_date - timedelta(days=14)
                    last_date_data = district_data[
                        (district_data['Survey Date'] >= last_cutoff) & 
                        (district_data['Survey Date'] <= last_end_date)
                    ].copy()
                    last_date_data = last_date_data[last_date_data[question].notna()].copy()
                    if len(last_date_data) > 0:
                        # Use L15D weight if available
                        weight_col_used = weight_column_15dma if weight_column_15dma in last_date_data.columns and last_date_data[weight_column_15dma].notna().sum() >= len(last_date_data) * 0.5 else weight_column_overall
                        vote_shares_last = self.calculator.calculate_vote_share(
                            last_date_data, weight_column=weight_col_used, use_weights=True
                        )
                        print(f"      Last Date ({last_date.strftime('%m/%d/%Y')}) Sample: {len(last_date_data):,}")
                        print(f"        Weight Used: {weight_col_used}")
                        print(f"        AITC: {vote_shares_last.get('AITC', 0):.1f}%, BJP: {vote_shares_last.get('BJP', 0):.1f}%")
        
        print(f"\n  Note: Legend positioned lower to avoid overlapping with dates")
        print(f"  Note: Graph starts from first date with actual data for each district")
    
    def get_overall_metrics(self):
        """Get overall metrics for audit trail - only count records with non-empty responses"""
        filtered_df = self.df_filtered.copy()
        
        # Overall sample size: only count records with non-empty responses to main question
        vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
        sample_size = len(filtered_df[filtered_df[vote_question].notna()].copy()) if vote_question in filtered_df.columns else 0
        
        # For date calculations, use all records (even empty ones) for date range
        valid_date_df = filtered_df[filtered_df['Survey Date'].notna()].copy()
        start_date = valid_date_df['Survey Date'].min() if len(valid_date_df) > 0 else None
        end_date = min(self.reference_date, valid_date_df['Survey Date'].max()) if len(valid_date_df) > 0 else None
        duration_days = (end_date - start_date).days + 1 if start_date and end_date else 0
        
        # Calculate daily average sample - only count records with valid responses
        valid_response_df = filtered_df[filtered_df[vote_question].notna()].copy() if vote_question in filtered_df.columns else pd.DataFrame()
        daily_samples = valid_response_df.groupby('Survey Date').size() if len(valid_response_df) > 0 else pd.Series()
        avg_daily_sample = int(daily_samples.mean()) if len(daily_samples) > 0 else 0
        
        # Calculate gender breakdown - only count those with valid responses
        male_sample = len(valid_response_df[valid_response_df['Gender'] == 1]) if 'Gender' in valid_response_df.columns else 0
        female_sample = len(valid_response_df[valid_response_df['Gender'] == 2]) if 'Gender' in valid_response_df.columns else 0
        
        # Calculate F2F and CATI samples - only with valid responses
        f2f_sample = len(valid_response_df[valid_response_df['Data Type'] == 1]) if 'Data Type' in valid_response_df.columns else 0
        cati_sample = len(valid_response_df[valid_response_df['Data Type'] == 2]) if 'Data Type' in valid_response_df.columns else 0
        
        zones_covered = filtered_df['Region Name'].nunique() if 'Region Name' in filtered_df.columns else 0
        
        return {
            'sample_size': sample_size,
            'start_date': start_date,
            'end_date': end_date,
            'duration_days': duration_days,
            'avg_daily_sample': avg_daily_sample,
            'male_sample': male_sample,
            'female_sample': female_sample,
            'f2f_sample': f2f_sample,
            'cati_sample': cati_sample,
            'zones_covered': zones_covered
        }
    
    def generate_complete_audit(self, output_file=None):
        """Generate complete audit trail for all calculations - organized slide-wise"""
        if output_file is None:
            output_file = f"calculation_audit_trail_{self.reference_date.strftime('%Y%m%d')}.txt"
        
        # Redirect output to file
        original_stdout = sys.stdout
        
        with open(output_file, 'w') as f:
            sys.stdout = f
            
            print("="*80)
            print("COMPLETE CALCULATION AUDIT TRAIL - SLIDE-WISE ORGANIZATION")
            print("="*80)
            print(f"Report Generation Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Reference Date (for calculations): {self.reference_date.date()}")
            print(f"Excel File: {self.excel_path}")
            print("="*80)
            
            # Slide-wise overview first
            self.audit_slide_wise()
            
            # Then detailed calculations organized by slide
            print("\n\n" + "="*80)
            print("DETAILED CALCULATIONS BY SLIDE")
            print("="*80)
            
            # Slide 1 & 2: Basic metrics (covered in slide-wise overview)
            # Slide 5: Raw, 7DMA, Normalized Vote Share
            print("\n" + "="*80)
            print("SLIDE 5: STATE LEVEL VOTE SHARE - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_raw_vote_share()
            self.audit_normalized_vote_share()
            self.audit_7dma_calculation()
            
            # Slide 6: Overall Normalized Chart
            print("\n" + "="*80)
            print("SLIDE 6: OVERALL NORMALIZED VOTE SHARE CHART - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_slide_6_calculation()
            
            # Slide 7: 7 DMA Chart
            print("\n" + "="*80)
            print("SLIDE 7: 7 DMA VOTE SHARE CHART - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_slide_7_calculation()
            
            # Slides 9-12: Demographic Tables (includes 15DMA)
            print("\n" + "="*80)
            print("SLIDES 9-12: DEMOGRAPHIC TABLES - DETAILED CALCULATIONS")
            print("="*80)
            print("Note: These slides include 7DMA, 15DMA, and Overall calculations")
            print("15DMA calculations use 'Weight - with Vote Share - AE 2021 - Region L15D'")
            print("(with fallback to regular weights if <50% available)")
            print("="*80)
            self.audit_demographic_calculation()
            
            # Slides 14-23: Overall Normalized Demographic Charts
            print("\n" + "="*80)
            print("SLIDES 14-23: OVERALL NORMALIZED DEMOGRAPHIC CHARTS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_demographic_charts()
            
            # Slides 24-39: 7 DMA Demographic Charts
            print("\n" + "="*80)
            print("SLIDES 24-39: 7 DMA DEMOGRAPHIC CHARTS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_7dma_demographic_charts()
            
            # Slides 41-42: Caste Wise Vote Shares
            print("\n" + "="*80)
            print("SLIDES 41-42: CASTE WISE VOTE SHARES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_caste_tables()
            
            # Slides 44-45: Top Reasons for Party Choices
            print("\n" + "="*80)
            print("SLIDES 44-45: TOP REASONS FOR PARTY CHOICES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_top_reasons_charts()
            
            # Slides 47-61: Gains and Losses Tables
            print("\n" + "="*80)
            print("SLIDES 47-61: GAINS AND LOSSES TABLES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_gains_losses_tables()
            
            # Slides 63-64: Vote Transferability Tables
            print("\n" + "="*80)
            print("SLIDES 63-64: VOTE TRANSFERABILITY TABLES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_vote_transferability_tables()
            
            # Slide 66: Preferred CM Candidate
            print("\n" + "="*80)
            print("SLIDE 66: PREFERRED CM CANDIDATE - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_preferred_cm_candidate()
            
            # Slide 68: State Government Rating
            print("\n" + "="*80)
            print("SLIDE 68: STATE GOVERNMENT RATING - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_state_government_rating()
            
            # Slide 70: Key Issues
            print("\n" + "="*80)
            print("SLIDE 70: KEY ISSUES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_key_issues()
            
            # Slide 72: Wisdom of Crowds
            print("\n" + "="*80)
            print("SLIDE 72: WISDOM OF CROWDS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_wisdom_of_crowds()
            
            # Slide 74: Vote Share by Regions
            print("\n" + "="*80)
            print("SLIDE 74: VOTE SHARE BY REGIONS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_vote_share_by_regions()
            
            # Slides 75-84: Regional Graphs
            print("\n" + "="*80)
            print("SLIDES 75-84: REGIONAL GRAPHS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_regional_graphs()
            
            # Slides 88-93: District Tables
            print("\n" + "="*80)
            print("SLIDES 88-93: DISTRICT TABLES - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_district_tables()
            
            # Slides 95-136: District Graphs
            print("\n" + "="*80)
            print("SLIDES 95-136: DISTRICT GRAPHS - DETAILED CALCULATIONS")
            print("="*80)
            self.audit_district_graphs()
            
            print("\n" + "="*80)
            print("END OF AUDIT TRAIL")
            print("="*80)
        
        sys.stdout = original_stdout
        
        print(f"\n✅ Complete audit trail saved to: {output_file}")
        return output_file


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate calculation audit trail')
    parser.add_argument('--excel', default='/Users/vijaygopal/Documents/Report_Generation/West_Bengal_31st_Oct_2025_With_Weights.xlsx',
                        help='Path to Excel file')
    parser.add_argument('--date', type=str, default=None,
                        help='Reference date for calculations (format: YYYY-MM-DD). Default: current date')
    parser.add_argument('--output', type=str, default=None,
                        help='Output file path (default: calculation_audit_trail_YYYYMMDD.txt)')
    
    args = parser.parse_args()
    
    reference_date = None
    if args.date:
        reference_date = pd.to_datetime(args.date)
    
    audit = CalculationAuditTrail(args.excel, reference_date=reference_date)
    output_file = audit.generate_complete_audit(args.output)
    
    print(f"\n📋 Audit trail complete!")
    print(f"📄 File: {output_file}")


if __name__ == '__main__':
    main()

