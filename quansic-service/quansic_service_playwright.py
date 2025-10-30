"""
Core Quansic service using Playwright (same as working TypeScript version)
Handles authentication, session management, and data enrichment
"""

import os
import asyncio
from typing import Optional, Dict, Any, List
from loguru import logger
import time
import random
from datetime import datetime, timedelta
import requests
from tenacity import retry, stop_after_attempt, wait_exponential
import json

from playwright.async_api import async_playwright, Browser, BrowserContext
from models import AccountPool, AccountCredentials


class QuansicServicePlaywright:
    """Anti-detection Quansic enrichment service using Playwright (like TypeScript version)"""
    
    def __init__(self):
        self.account_pool = AccountPool()
        self.session_cache: Dict[str, Any] = {}
        self.session_expiry: Dict[str, float] = {}
        self.session_duration = int(os.getenv('SESSION_DURATION_MS', '3600000'))  # 1 hour
        self.warmup_delay = (2, 8)  # seconds for natural browsing warmup
        
        # Playwright browser instance (same as TypeScript)
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        
        logger.info("Initialized QuansicServicePlaywright with browser caching")
    
    async def get_browser(self) -> Browser:
        """Get or create browser instance (reused across requests) - BOT ANTI-DETECTION"""
        if self.browser is None:
            logger.info("🌐 Creating Playwright browser instance (cached)")
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            )
            logger.info("✅ Playwright browser instance created and cached")
        return self.browser
    
    async def get_context(self) -> BrowserContext:
        """Get or create browser context (reused across requests)"""
        if self.context is None:
            browser = await self.get_browser()
            
            # Randomize browser fingerprint like TypeScript
            viewport_width = 1366 + random.randint(0, 554)  # 1366-1920
            viewport_height = 768 + random.randint(0, 312)  # 768-1080
            timezones = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver', 'Europe/London']
            locales = ['en-US', 'en-GB', 'en-CA']
            
            self.context = await browser.new_context(
                viewport={'width': viewport_width, 'height': viewport_height},
                locale=random.choice(locales),
                timezone_id=random.choice(timezones),
                device_scale_factor=1 + random.random() * 0.5,
            )
            logger.info("✅ Browser context created and cached")
        return self.context
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def authenticate(self, account: AccountCredentials, force_reauth: bool = False) -> str:
        """Authenticate with Quansic and get session cookie (exactly like TypeScript)"""
        logger.info(f"Authenticating with Quansic using account: {account.email}")
        
        # Check if we have a valid cached session
        cache_key = f"{account.email}_{account.status}"
        if not force_reauth and self._is_session_valid(cache_key):
            logger.debug(f"Using cached session for {account.email}")
            return self.session_cache[cache_key]
        
        try:
            # Get browser and context
            context = await self.get_context()
            page = await context.new_page()
            
            # Human-like delays
            async def human_delay(min_ms=800, max_ms=2500):
                delay = random.uniform(min_ms, max_ms) / 1000
                await asyncio.sleep(delay)
            
            async def human_type(page, selector, text):
                await page.click(selector)
                await human_delay(300, 800)
                
                for char in text:
                    await page.keyboard.type(char)
                    await asyncio.sleep(random.uniform(0.05, 0.15))
                
                await human_delay(200, 600)
            
            # Navigate to login page
            logger.info('📄 Navigating to login page...')
            await page.goto('https://explorer.quansic.com/app-login', wait_until='domcontentloaded', timeout=90000)
            
            # Human-like reading delay
            await human_delay(1500, 3000)
            
            # Wait for form
            logger.info('⏳ Waiting for email field...')
            await page.wait_for_selector('input[name="email"]', timeout=30000)
            
            # Scroll (humans do this)
            await page.mouse.wheel(0, random.uniform(0, 100))
            await human_delay(500, 1200)
            
            # Fill credentials
            logger.info('✍️ Typing email...')
            await human_type(page, 'input[name="email"]', account.email)
            
            await human_delay(600, 1400)
            
            logger.info('✍️ Typing password...')
            await human_type(page, 'input[name="password"]', account.password)
            
            # Pause before submitting
            await human_delay(1000, 2500)
            
            # Click login (simulate human mouse movement)
            logger.info('🖱️ Clicking login button...')
            await page.click('button:has-text("Login")')
            
            # Wait for navigation
            logger.info('⏳ Waiting for response...')
            try:
                await page.wait_for_url(r'explorer\.quansic\.com\/(?!app-login)', timeout=10000)
                logger.info('✅ Navigation completed')
            except Exception:
                # Check for errors
                current_url = page.url
                logger.warning(f'Still on URL: {current_url}')
                
                # Check for error messages
                body_text = await page.text_content('body').catch(lambda: '')
                if any(word in body_text.lower() for word in ['invalid', 'incorrect', 'error', 'failed', 'authentication']):
                    raise Exception(f'Login failed - authentication error detected')
                
                # Wait longer
                logger.info('⏳ No immediate error found, waiting longer...')
                await page.wait_for_url(r'explorer\.quansic\.com\/(?!app-login)', timeout=80000)
                logger.info('✅ Navigation completed (after extended wait)')
            
            # Extract cookies (exactly like TypeScript)
            logger.info('🍪 Extracting cookies...')
            cookies = await context.cookies()
            session_cookie = '; '.join([f"{cookie['name']}={cookie['value']}" for cookie in cookies])
            
            # Cache session
            self.session_cache[cache_key] = session_cookie
            self.session_expiry[cache_key] = time.time() * 1000 + self.session_duration
            
            # Mark account as active
            account.mark_success()
            
            logger.info('✅ Authentication successful')
            return session_cookie
            
        except Exception as e:
            logger.error(f'❌ Authentication failed: {e.message}')
            account.mark_failed()
            raise Exception(f'Quansic authentication failed: {e.message}')
        finally:
            await page.close()
    
    def _is_session_valid(self, cache_key: str) -> bool:
        """Check if cached session is still valid"""
        if cache_key not in self.session_cache:
            return False
        
        expiry = self.session_expiry.get(cache_key, 0)
        return time.time() * 1000 < expiry
    
    async def _lookup_recording_by_isrc(self, isni: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Direct ISNI lookup using Quansic API (exactly like TypeScript)"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::{clean_isni}'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif response.status_code == 404:
                return None
            elif not response.ok:
                raise Exception(f"API error: {response.status_code}")
            
            data = response.json()
            return data.get('results')
            
        except Exception as e:
            logger.debug(f"Direct ISNI lookup failed: {e}")
            return None
    
    async def _lookup_recording_by_isrc(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup recording by ISRC using Quansic API (exactly like TypeScript)"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif response.status_code == 404:
                return None
            elif not response.ok:
                raise Exception(f"API error: {response.status_code}")
            
            data = response.json()
            return data.get('results')
            
        except Exception as e:
            logger.debug(f"Recording ISRC lookup failed: {e}")
            return None
    
    async def _lookup_work_by_isrc(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup work by ISRC using Quansic API (exactly like TypeScript)"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}/works/0'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0',
            'x-instance': 'default',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif not response.ok:
                return None
            
            data = response.json()
            return data.get('results', {}).get('data', [None])[0] if data.get('results', {}).get('data') else None
            
        except Exception as e:
            logger.debug(f"Work ISRC lookup failed: {e}")
            return None
    
    async def get_recording_data(self, isrc: str, spotify_track_id: Optional[str] = None,
                               recording_mbid: Optional[str] = None,
                               force_reauth: bool = False) -> Dict[str, Any]:
        """Get recording data from Quansic with anti-detection (exactly like TypeScript)"""
        logger.info(f"Enriching recording ISRC: {isrc}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = await self.authenticate(account, force_reauth)
        
        try:
            # Get recording data
            recording_data = await self._lookup_recording_by_isrc(isrc, session_cookie)
            if not recording_data:
                raise Exception(f"No recording found for ISRC: {isrc}")
            
            # Get work data separately
            work_data = await self._lookup_work_by_isrc(isrc, session_cookie)
            
            # Extract recording metadata (exactly like TypeScript)
            recording = recording_data.get('recording', {})
            work = work_data
            
            return {
                'isrc': clean_isrc := isrc.replace(' ', '').replace('\t', '').replace('\n', ''),
                'spotify_track_id': spotify_track_id,
                'recording_mbid': recording_mbid,
                
                # Recording metadata
                'title': recording.get('title'),
                'subtitle': recording.get('subtitle'),
                'duration_ms': recording.get('durationMs'),
                'release_date': recording.get('releaseDate'),
                
                # Work data
                'iswc': work.get('iswc').replace('-', '').replace('.', '').replace(' ', '') if work and work.get('iswc') else None,
                'work_title': work.get('title') if work else None,
                
                # Artists
                'artists': recording.get('contributors', []),
                
                # Platform IDs
                'platform_ids': recording.get('platformIds', {}),
                
                # Quality score
                'q2_score': recording.get('q2Score'),
                
                'raw_data': {
                    'recording': recording_data,
                    'works': [work] if work else [],
                },
            }
            
        except Exception as e:
            logger.error(f"Recording enrichment failed: {e}")
            self.account_pool.mark_current_failed()
            raise
    
    async def cleanup(self):
        """Clean up browser instance on shutdown"""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            logger.info("✅ Browser instance cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up browser: {e}")
