#!/usr/bin/env python3
"""
Vote Share Calculation Module
Implements calculations for normalized vote shares using weights
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta


class VoteShareCalculator:
    """Calculate vote shares with normalization using weights"""
    
    def __init__(self, df):
        """
        Initialize calculator with dataframe
        
        Args:
            df: DataFrame with survey data including weights
        """
        self.df = df.copy()
        
        # Party code mapping (from Questionnaire Q8)
        # Correct mapping per questionnaire:
        # Code 1 → AITC (Trinamool Congress)
        # Code 2 → BJP
        # Code 3 → INC (Congress)
        # Code 4 → Left Front
        self.party_map = {
            1: 'AITC',
            2: 'BJP',
            3: 'INC',  # Fixed: was LEFT
            4: 'LEFT',  # Fixed: was INC
            # Other codes go to 'Others' or 'NWR'
        }
        
        # Question column for vote share
        self.vote_question = '8. If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?'
    
    def filter_by_date_range(self, days=None, exclude_latest=False, reference_date=None):
        """
        Filter data by date range
        
        Args:
            days: Number of days from reference date (None for overall)
            exclude_latest: If True, exclude the latest date (for 7 DMA if latest day is partial)
            reference_date: Reference date for calculation (default: current date, or latest data date if None)
        
        Returns:
            Filtered DataFrame
        """
        if 'Survey Date' not in self.df.columns:
            return self.df
        
        self.df['Survey Date'] = pd.to_datetime(self.df['Survey Date'], errors='coerce')
        
        if days is None:
            return self.df[self.df['Survey Date'].notna()].copy()
        
        # Use reference date (current date when report is generated) or latest data date
        if reference_date is None:
            # Default to latest date in data if no reference date provided
            reference_date = self.df['Survey Date'].max()
        else:
            # Convert reference_date to datetime if it's a string
            if isinstance(reference_date, str):
                reference_date = pd.to_datetime(reference_date)
            elif not isinstance(reference_date, (pd.Timestamp, datetime)):
                reference_date = pd.to_datetime(reference_date)
        
        # Calculate date range for DMA
        # For 7 DMA: Reference date is NOT included - use one day before as the last day
        # So if reference_date is Oct 31, use Oct 30 as the last day (day 7)
        # We need 7 days ending on (reference_date - 1)
        # For N DMA: End date is (reference_date - 1), so we need (N-1) days before it
        # This ensures the last 7 days are covered, excluding the reference date itself
        
        # Always exclude reference date - use one day before as the last day
        end_date = reference_date - timedelta(days=1)
        cutoff_date = end_date - timedelta(days=days-1)  # (days-1) days before end_date
        
        # Filter data for this date range
        return self.df[
            (self.df['Survey Date'] >= cutoff_date) & 
            (self.df['Survey Date'] <= end_date)
        ].copy()
    
    def categorize_party(self, party_code):
        """
        Categorize party code into standard categories
        Based on Questionnaire Q8 mapping
        
        Args:
            party_code: Party code from survey
        
        Returns:
            Party category string
        """
        if pd.isna(party_code):
            return 'NWR'
        
        try:
            party_code = int(party_code)
        except (ValueError, TypeError):
            return 'NWR'
        
        # Main parties (from questionnaire Q8)
        if party_code in self.party_map:
            return self.party_map[party_code]
        # Independent → Others
        elif party_code == 12:
            return 'Others'
        # Others (specify) → Others
        elif party_code == 44:
            return 'Others'
        # All non-response codes → NWR
        # Code 55: NOTA
        # Code 66: Did not vote
        # Code 67: Will not vote
        # Code 77: Not eligible for voting
        # Code 78: Not yet decided
        # Code 88: Refused to answer
        elif party_code in [55, 66, 67, 77, 78, 88]:
            return 'NWR'
        # Any other code → Others (shouldn't happen but handle gracefully)
        else:
            return 'Others'
    
    def calculate_vote_share(self, data_filtered, weight_column='Weight - with Vote Share - AE 2021 - Region', use_weights=True):
        """
        Calculate vote share (raw or normalized using weights)
        
        Args:
            data_filtered: Filtered DataFrame
            weight_column: Column name for weights (if use_weights=True)
            use_weights: If True, use weights for normalization; if False, calculate raw vote share
        
        Returns:
            Dictionary with party vote shares and sample size
        """
        if not use_weights:
            weight_column = None
        
        if weight_column and weight_column not in data_filtered.columns:
            # Fallback to raw if weight column not available
            weight_column = None
            use_weights = False
        
        # Get vote responses
        if self.vote_question not in data_filtered.columns:
            return {'sample': 0, 'AITC': 0, 'BJP': 0, 'LEFT': 0, 'INC': 0, 'Others': 0, 'NWR': 0}
        
        vote_data = data_filtered[[self.vote_question]].copy()
        
        # Categorize parties
        vote_data['party_category'] = vote_data[self.vote_question].apply(self.categorize_party)
        
        # Add weights
        if weight_column and weight_column in data_filtered.columns:
            vote_data = vote_data.reset_index(drop=True)
            weights = data_filtered[weight_column].reset_index(drop=True)
            
            # Convert weights to numeric, filtering out non-numeric values
            vote_data['weight'] = pd.to_numeric(weights, errors='coerce')
            
            # Sample size: count all records with valid votes (from original filtered data)
            # This matches the final PPT which counts all valid votes, not just those with valid weights
            sample_size = len(data_filtered[data_filtered[self.vote_question].notna()].copy())
            
            # Filter out rows with invalid weights (NaN or non-numeric) for calculation
            vote_data = vote_data[vote_data['weight'].notna()].copy()
        else:
            vote_data['weight'] = 1.0
            # Sample size: count all records with valid votes
            sample_size = len(vote_data)
        
        total_weight = vote_data['weight'].sum()
        
        if total_weight == 0:
            return {'sample': sample_size, 'AITC': 0, 'BJP': 0, 'LEFT': 0, 'INC': 0, 'Others': 0, 'NWR': 0}
        
        # Calculate weighted vote share for each party
        vote_shares = {}
        for party in ['AITC', 'BJP', 'LEFT', 'INC', 'Others', 'NWR']:
            party_mask = vote_data['party_category'] == party
            party_weight = vote_data.loc[party_mask, 'weight'].sum()
            vote_shares[party] = (party_weight / total_weight) * 100
        
        vote_shares['sample'] = sample_size
        
        return vote_shares
    
    def calculate_margin(self, vote_shares):
        """
        Calculate margin (AITC - BJP)
        
        Args:
            vote_shares: Dictionary with vote shares
        
        Returns:
            Margin value
        """
        return vote_shares.get('AITC', 0) - vote_shares.get('BJP', 0)
    
    def calculate_dma(self, days=7):
        """
        Calculate Days Moving Average for each date
        
        Args:
            days: Number of days for moving average
        
        Returns:
            DataFrame with DMA values for each date
        """
        if 'Survey Date' not in self.df.columns:
            return pd.DataFrame()
        
        self.df['Survey Date'] = pd.to_datetime(self.df['Survey Date'], errors='coerce')
        dates = sorted(self.df['Survey Date'].dropna().unique())
        
        dma_results = []
        
        for date in dates:
            # Get data for this date going back N days
            cutoff_date = date - timedelta(days=days)
            date_data = self.df[
                (self.df['Survey Date'] >= cutoff_date) & 
                (self.df['Survey Date'] <= date)
            ].copy()
            
            vote_shares = self.calculate_vote_share(date_data)
            vote_shares['date'] = date
            vote_shares['margin'] = self.calculate_margin(vote_shares)
            dma_results.append(vote_shares)
        
        return pd.DataFrame(dma_results)
    
    def calculate_demographic_breakdown(self, data_filtered, demographic_column, weight_column='Weight - with Vote Share - AE 2021 - Region'):
        """
        Calculate vote share by demographic
        
        Args:
            data_filtered: Filtered DataFrame
            demographic_column: Column name for demographic (Gender, Religion, etc.)
            weight_column: Weight column to use
        
        Returns:
            Dictionary with vote shares by demographic category
        """
        results = {}
        
        if demographic_column not in data_filtered.columns:
            return results
        
        # Get unique demographic categories
        categories = data_filtered[demographic_column].dropna().unique()
        
        for category in categories:
            category_data = data_filtered[data_filtered[demographic_column] == category].copy()
            vote_shares = self.calculate_vote_share(category_data, weight_column)
            vote_shares['margin'] = self.calculate_margin(vote_shares)
            results[category] = vote_shares
        
        return results

