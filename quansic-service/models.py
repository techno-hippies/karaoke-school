"""
Quansic Enrichment Service using hrequests for anti-detection
Provides HTTP API for enriching music metadata through Quansic
"""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from pydantic import BaseModel, Field
from loguru import logger
import asyncio
import time
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Account management
@dataclass
class AccountCredentials:
    """Account credentials with status tracking"""
    email: str
    password: str
    status: str = 'active'  # active, failed, banned
    last_used: float = 0
    failure_count: int = 0
    request_count: int = 0
    success_count: int = 0
    
    def needs_rotation(self) -> bool:
        """Check if account needs rotation"""
        rotation_threshold = int(os.getenv('REQUESTS_PER_ACCOUNT', '30'))  # Lower threshold for safety
        rotation_interval = int(os.getenv('ROTATION_INTERVAL_MS', '1800000'))  # 30 minutes
        time_since_use = (time.time() - self.last_used) * 1000
        
        return (
            self.request_count >= rotation_threshold or
            time_since_use > rotation_interval or
            self.status != 'active' or
            self.failure_count >= 3
        )
    
    def mark_failed(self):
        """Mark account as failed"""
        self.failure_count += 1
        if self.failure_count >= 3:
            self.status = 'banned'
        else:
            self.status = 'failed'
        logger.warning(f"Account {self.email} marked as failed ({self.failure_count}/3)")
    
    def mark_success(self):
        """Mark successful request"""
        self.status = 'active'
        self.failure_count = 0
        self.success_count += 1
        self.request_count += 1
        self.last_used = time.time()


class AccountPool:
    """Account pool with rotation management"""
    
    def __init__(self):
        self.accounts: List[AccountCredentials] = []
        self.current_index = 0
        self._initialize_from_env()
    
    def _initialize_from_env(self):
        """Initialize account pool from environment variables"""
        # Load primary account
        email = os.getenv('QUANSIC_EMAIL')
        password = os.getenv('QUANSIC_PASSWORD')
        
        if email and password:
            self.accounts.append(AccountCredentials(email=email, password=password))
            logger.info(f"Loaded primary account: {email}")
        
        # Load additional accounts
        account_index = 2
        while True:
            email = os.getenv(f'QUANSIC_EMAIL_{account_index}')
            password = os.getenv(f'QUANSIC_PASSWORD_{account_index}')
            
            if not email or not password:
                break
            
            self.accounts.append(AccountCredentials(email=email, password=password))
            logger.info(f"Loaded account {account_index}: {email}")
            account_index += 1
        
        if not self.accounts:
            raise ValueError("No Quansic accounts configured. Set QUANSIC_EMAIL and QUANSIC_PASSWORD.")
        
        logger.info(f"Initialized account pool with {len(self.accounts)} accounts")
    
    def get_next_account(self) -> AccountCredentials:
        """Get next available account with rotation"""
        if not self.accounts:
            raise ValueError("No accounts available in pool")
        
        # Check current account
        current = self.accounts[self.current_index]
        
        if current.needs_rotation() and len(self.accounts) > 1:
            logger.info(f"Rotating from {current.email} (requests: {current.request_count}, status: {current.status})")
            
            # Find next active account
            for i in range(len(self.accounts)):
                next_index = (self.current_index + 1 + i) % len(self.accounts)
                next_account = self.accounts[next_index]
                
                if next_account.status == 'active' and next_account.failure_count < 3:
                    self.current_index = next_index
                    logger.info(f"Rotated to {next_account.email}")
                    return next_account
            
            # All accounts failed, reset and try again
            logger.warning("All accounts failed, resetting failure counts")
            for acc in self.accounts:
                if acc.status == 'failed':
                    acc.status = 'active'
                    acc.failure_count = 0
        
        return self.accounts[self.current_index]
    
    def mark_current_failed(self):
        """Mark current account as failed and rotate"""
        if self.accounts:
            current = self.accounts[self.current_index]
            current.mark_failed()
            
            # Force rotation to next account
            if len(self.accounts) > 1:
                self.current_index = (self.current_index + 1) % len(self.accounts)
                logger.info(f"Force rotated to {self.accounts[self.current_index].email}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get account pool status"""
        rotation_threshold = int(os.getenv('REQUESTS_PER_ACCOUNT', '30'))
        rotation_interval_minutes = int(os.getenv('ROTATION_INTERVAL_MS', '1800000')) // 60000
        
        return {
            'current_index': self.current_index,
            'total_accounts': len(self.accounts),
            'rotation_threshold': rotation_threshold,
            'rotation_interval_minutes': rotation_interval_minutes,
            'accounts': [
                {
                    'index': i,
                    'email': acc.email,
                    'status': acc.status,
                    'failure_count': acc.failure_count,
                    'request_count': acc.request_count,
                    'success_count': acc.success_count,
                    'requests_until_rotation': max(0, rotation_threshold - acc.request_count),
                    'last_used': datetime.fromtimestamp(acc.last_used).isoformat() if acc.last_used > 0 else 'never',
                    'is_current': i == self.current_index
                }
                for i, acc in enumerate(self.accounts)
            ]
        }


# Pydantic models for API
class EnrichRequest(BaseModel):
    isni: str = Field(..., description="Artist ISNI to enrich")
    musicbrainz_mbid: Optional[str] = Field(None, description="MusicBrainz MBID")
    spotify_artist_id: Optional[str] = Field(None, description="Spotify Artist ID")
    force_reauth: Optional[bool] = Field(False, description="Force re-authentication")


class EnrichRecordingRequest(BaseModel):
    isrc: str = Field(..., description="Recording ISRC")
    spotify_track_id: Optional[str] = Field(None, description="Spotify Track ID")
    recording_mbid: Optional[str] = Field(None, description="MusicBrainz Recording MBID")
    force_reauth: Optional[bool] = Field(False, description="Force re-authentication")


class EnrichWorkRequest(BaseModel):
    iswc: str = Field(..., description="Work ISWC")
    work_mbid: Optional[str] = Field(None, description="MusicBrainz Work MBID")
    force_reauth: Optional[bool] = Field(False, description="Force re-authentication")


class AuthRequest(BaseModel):
    email: str
    password: str


class SearchRequest(BaseModel):
    isni: str


class QuansicArtistData(BaseModel):
    isni: str
    musicbrainz_mbid: Optional[str] = None
    ipn: Optional[str] = None
    luminate_id: Optional[str] = None
    gracenote_id: Optional[str] = None
    amazon_id: Optional[str] = None
    apple_music_id: Optional[str] = None
    name_variants: List[Dict[str, Any]] = Field(default_factory=list)
    raw_data: Dict[str, Any]


class QuansicRecordingData(BaseModel):
    isrc: str
    spotify_track_id: Optional[str] = None
    recording_mbid: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    duration_ms: Optional[int] = None
    release_date: Optional[str] = None
    iswc: Optional[str] = None
    work_title: Optional[str] = None
    artists: List[Dict[str, Any]] = Field(default_factory=list)
    composers: List[Dict[str, Any]] = Field(default_factory=list)
    platform_ids: Dict[str, Any] = Field(default_factory=dict)
    q2_score: Optional[int] = None
    raw_data: Dict[str, Any]


class QuansicWorkData(BaseModel):
    iswc: str
    work_mbid: Optional[str] = None
    title: str
    contributors: List[Dict[str, Any]] = Field(default_factory=list)
    recording_count: Optional[int] = None
    q1_score: Optional[int] = None
    sample_recordings: List[Dict[str, Any]] = Field(default_factory=list)
    raw_data: Dict[str, Any]


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
