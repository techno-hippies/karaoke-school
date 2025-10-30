"""
Core Quansic service using Playwright for anti-detection
Handles authentication, session management, and data enrichment
"""

import os
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any, List, Tuple
from loguru import logger
import time
import random
from datetime import datetime, timedelta
import requests
from tenacity import retry, stop_after_attempt, wait_exponential
import json

# Import hrequests for anti-detection browsing
try:
    import hrequests
    HREQUESTS_AVAILABLE = True
except ImportError:
    HREQUESTS_AVAILABLE = False
    raise ImportError("hrequests is required. Install with: pip install hrequests[all]")

# Import Playwright - the correct library for Python
try:
    from playwright.async_api import async_playwright, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

from models import AccountPool, AccountCredentials


class QuansicService:
    """Anti-detection Quansic enrichment service using hrequests"""

    def __init__(self):
        self.account_pool = AccountPool()
        self.session_cache: Dict[str, str] = {}  # Cache cookie strings, not Session objects
        self.session_expiry: Dict[str, float] = {}
        self.session_duration = int(os.getenv('SESSION_DURATION_MS', '43200000'))  # 12 hours (cookies last long)
        self.warmup_delay = (2, 8)  # seconds for natural browsing warmup
        
        # Thread pool for running hrequests in separate context
        self.thread_pool = ThreadPoolExecutor(max_workers=3)
        
        # hrequests configuration - simplified to match actual API
        self.browser_config = {
            'browser': os.getenv('HREQUESTS_BROWSER', 'firefox'),  # Firefox recommended for anti-detection
            'timeout': int(os.getenv('HREQUESTS_TIMEOUT', '30000')),
        }
        
        # Browser context caching - KEY BOT ANTI-DETECTION
        self._browser_session = None
        self._browser_context = None
        self._browser_lock = threading.Lock()
        
        logger.info(f"Initialized QuansicService with {self.browser_config}")
    
    def get_browser_context(self) -> Tuple[hrequests.Session, Any]:
        """Get or create browser context (reused across requests) - BOT ANTI-DETECTION"""
        if self._browser_session is None or self._browser_context is None:
            with self._browser_lock:
                if self._browser_session is None:  # Double-check pattern
                    logger.info("🌐 Creating browser context (cached)")
                    # Create browser session
                    self._browser_session = hrequests.Session(
                        browser=self.browser_config['browser'],
                        timeout=self.browser_config['timeout']
                    )
                    logger.info("✅ Browser session created and cached")
        return self._browser_session, self._browser_context
    
    def authenticate(self, account: AccountCredentials, force_reauth: bool = False) -> str:
        """Authenticate with Quansic using hrequests browser automation and return cookie string"""
        logger.info(f"Authenticating with Quansic using account: {account.email}")

        # Check if we have a valid cached session
        cache_key = f"{account.email}_{account.status}"
        if not force_reauth and self._is_session_valid(cache_key):
            logger.debug(f"Using cached session for {account.email}")
            return self.session_cache[cache_key]

        try:
            # Run hrequests authentication in separate thread to avoid event loop conflict
            cookie_str = self.thread_pool.submit(self._perform_hrequests_login_sync, account).result()

            # Cache cookie string
            self.session_cache[cache_key] = cookie_str
            self.session_expiry[cache_key] = time.time() * 1000 + self.session_duration

            # Mark account as active
            account.mark_success()

            logger.info(f"Successfully authenticated {account.email} (session valid for {self.session_duration / 3600000:.1f} hours)")
            return cookie_str

        except Exception as e:
            logger.error(f"Authentication failed for {account.email}: {e}")
            account.mark_failed()
            raise
    
    def _perform_hrequests_login_sync(self, account: AccountCredentials) -> str:
        """Perform login using hrequests browser automation and return cookie string"""
        logger.debug(f"Performing login for {account.email}")

        try:
            # Use BrowserSession directly for more control
            page = hrequests.BrowserSession(browser='firefox', headless=True, mock_human=True)

            try:
                logger.info(f"Navigating to login page...")
                # Navigate directly - try different waitUntil options
                try:
                    # Try Playwright's waitUntil parameter (camelCase)
                    page.goto('https://explorer.quansic.com/app-login', waitUntil='domcontentloaded')
                except TypeError:
                    try:
                        # Try snake_case
                        page.goto('https://explorer.quansic.com/app-login', wait_until='domcontentloaded')
                    except:
                        # Fallback: just navigate and don't wait for full load
                        logger.debug("waitUntil not supported, using basic navigation...")
                        page.goto('https://explorer.quansic.com/app-login')

                # Wait for page to stabilize
                time.sleep(random.uniform(2, 5))

                # Find and fill login form
                logger.debug(f"Waiting for email input...")
                page.awaitSelector('input[name="email"]', timeout=30000)

                logger.debug(f"Typing email...")
                page.type('input[name="email"]', account.email)
                time.sleep(random.uniform(0.5, 1.5))

                logger.debug(f"Typing password...")
                page.type('input[name="password"]', account.password)
                time.sleep(random.uniform(1, 3))

                # Click login button
                logger.debug(f"Clicking login button...")
                page.click('button:has-text("Login")')

                # Wait for navigation by checking URL change
                logger.debug(f"Waiting for navigation away from login page...")
                max_wait = 30  # seconds
                start_time = time.time()
                login_url = page.url

                while time.time() - start_time < max_wait:
                    time.sleep(1)
                    current_url = page.url
                    if current_url != login_url and 'app-login' not in current_url:
                        logger.info(f"Successfully navigated to: {current_url}")
                        break
                else:
                    logger.warning(f"Still on login page after {max_wait}s: {page.url}")
                    # Check for error messages
                    try:
                        error_text = page.html.text
                        if 'invalid' in error_text.lower() or 'incorrect' in error_text.lower():
                            raise Exception(f"Login failed - invalid credentials")
                    except:
                        pass

                # Extract cookies as string (like TypeScript implementation)
                cookie_str = '; '.join([f'{c.name}={c.value}' for c in page.cookies])
                logger.debug(f"Extracted {len(page.cookies)} cookies")

                return cookie_str

            finally:
                # Always close the page
                page.close()

        except Exception as e:
            logger.error(f"Login failed for {account.email}: {e}")
            raise Exception(f"Login failed: {e}")
    
    def _is_session_valid(self, cache_key: str) -> bool:
        """Check if cached session is still valid"""
        if cache_key not in self.session_cache:
            return False
        
        expiry = self.session_expiry.get(cache_key, 0)
        return time.time() * 1000 < expiry
    
    def get_artist_data(self, isni: str, musicbrainz_mbid: Optional[str] = None, 
                            spotify_artist_id: Optional[str] = None, 
                            force_reauth: bool = False) -> Dict[str, Any]:
        """Get artist data from Quansic with anti-detection"""
        logger.info(f"Enriching artist ISNI: {isni}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = self.authenticate(account, force_reauth)
        
        try:
            # Try direct ISNI lookup first
            artist_data = self._lookup_artist_by_isni(isni, session_cookie)
            
            # If direct lookup fails, try entity search
            if not artist_data:
                logger.debug(f"Direct ISNI lookup failed, trying entity search for {isni}")
                artist_data = self._search_artist_by_isni(isni, session_cookie)
            
            # If still no data and we have Spotify ID, try Spotify search
            if not artist_data and spotify_artist_id:
                logger.debug(f"ISNI search failed, trying Spotify ID: {spotify_artist_id}")
                artist_data = self._search_artist_by_spotify(spotify_artist_id, session_cookie)
            
            if not artist_data:
                raise Exception(f"No artist data found for ISNI: {isni}")
            
            # Get name variants
            name_variants = self._get_artist_name_variants(isni, session_cookie)
            
            return {
                'isni': isni.replace(' ', '').replace('\t', '').replace('\n', ''),
                'musicbrainz_mbid': musicbrainz_mbid,
                'ipn': artist_data.get('ids', {}).get('ipns', [None])[0],
                'luminate_id': artist_data.get('ids', {}).get('luminateIds', [None])[0],
                'gracenote_id': artist_data.get('ids', {}).get('gracenoteIds', [None])[0],
                'amazon_id': artist_data.get('ids', {}).get('amazonIds', [None])[0],
                'apple_music_id': artist_data.get('ids', {}).get('appleIds', [None])[0],
                'name_variants': name_variants,
                'raw_data': artist_data,
            }
            
        except Exception as e:
            logger.error(f"Artist enrichment failed: {e}")
            self.account_pool.mark_current_failed()
            raise
    
    def _lookup_artist_by_isni(self, isni: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Direct ISNI lookup using Quansic API - FIXED COOKIE APPROACH"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::{clean_isni}'
        
        # ✅ Use requests library with extracted cookie string (like TypeScript)
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
    
    def _search_artist_by_isni(self, isni: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Search for artist using entity search endpoint"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = 'https://explorer.quansic.com/api/log/entitySearch'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        try:
            response = hrequests.post(url, headers=headers, json={
                'entityType': 'isni',
                'searchTerm': clean_isni,
            }, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif not response.ok:
                return None
            
            data = response.json()
            parties = data.get('results', {}).get('parties', [])
            
            if parties:
                return {'party': parties[0]}
            
            return None
            
        except Exception as e:
            logger.debug(f"Entity search failed: {e}")
            return None
    
    def _search_artist_by_spotify(self, spotify_id: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Search for artist using Spotify ID"""
        url = f'https://explorer.quansic.com/api/q/search/party/spotifyId/{spotify_id}'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        try:
            response = hrequests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif not response.ok:
                return None
            
            data = response.json()
            parties = data.get('results', {}).get('parties', [])
            
            if parties:
                # Prefer party with most complete data
                best_party = max(parties, key=lambda p: len(p.get('ids', {}).get('isnis', [])))
                return {'party': best_party}
            
            return None
            
        except Exception as e:
            logger.debug(f"Spotify search failed: {e}")
            return None
    
    def _get_artist_name_variants(self, isni: str, session_cookie: str) -> List[Dict[str, Any]]:
        """Get artist name variants"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::{clean_isni}/nameVariants'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        try:
            response = hrequests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif not response.ok:
                return []
            
            data = response.json()
            variants = data.get('results', {}).get('nameVariants', [])
            
            return [
                {'name': v.get('fullname') or v.get('name', ''), 'language': v.get('language')}
                for v in variants
            ]
            
        except Exception as e:
            logger.debug(f"Name variants lookup failed: {e}")
            return []
    
    def get_recording_data(self, isrc: str, spotify_track_id: Optional[str] = None,
                               recording_mbid: Optional[str] = None,
                               force_reauth: bool = False) -> Dict[str, Any]:
        """Get recording data from Quansic with anti-detection"""
        logger.info(f"Enriching recording ISRC: {isrc}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = self.authenticate(account, force_reauth)
        
        try:
            # Get recording data
            recording_data = self._lookup_recording_by_isrc(isrc, session_cookie)
            
            if not recording_data:
                raise Exception(f"No recording found for ISRC: {isrc}")
            
            # Get work data separately
            work_data = self._lookup_work_by_isrc(isrc, session_cookie)
            
            # Extract recording metadata
            recording = recording_data.get('recording', {})
            work = work_data
            
            return {
                'isrc': isrc.replace(' ', '').replace('\t', '').replace('\n', ''),
                'spotify_track_id': spotify_track_id,
                'recording_mbid': recording_mbid,
                'title': recording.get('title', ''),
                'subtitle': recording.get('subtitle'),
                'duration_ms': recording.get('durationMs'),
                'release_date': recording.get('releaseDate'),
                'iswc': work.get('iswc', '').replace(' ', '').replace('\t', '').replace('\n', '') if work else None,
                'work_title': work.get('title') if work else None,
                'artists': [
                    {
                        'name': a.get('name', ''),
                        'isni': a.get('ids', {}).get('isnis', [None])[0],
                        'ipi': a.get('ids', {}).get('ipis', [None])[0],
                        'role': a.get('contributorType'),
                        'ids': a.get('ids', {}),
                    }
                    for a in recording.get('contributors', [])
                    if a.get('contributorType') == 'MainArtist'
                ],
                'composers': [
                    {
                        'name': c.get('name', ''),
                        'isni': c.get('ids', {}).get('isnis', [None])[0],
                        'ipi': c.get('ids', {}).get('ipis', [None])[0],
                        'role': c.get('role'),
                        'birthdate': c.get('birthdate'),
                    }
                    for c in (work.get('contributors', []) if work else [])
                ],
                'platform_ids': {
                    'spotify': recording.get('spotifyId'),
                    'apple': recording.get('appleId'),
                    'musicbrainz': recording.get('musicBrainzId'),
                    'luminate': recording.get('luminateId'),
                    'gracenote': recording.get('gracenoteId'),
                },
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
    
    def get_work_data(self, iswc: str, work_mbid: Optional[str] = None,
                          force_reauth: bool = False) -> Dict[str, Any]:
        """Get work data from Quansic with anti-detection"""
        logger.info(f"Enriching work ISWC: {iswc}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = self.authenticate(account, force_reauth)
        
        try:
            # Get work data
            work_data = self._lookup_work_by_iswc(iswc, session_cookie)
            
            if not work_data:
                raise Exception(f"No work found for ISWC: {iswc}")
            
            work = work_data.get('work', {})
            
            return {
                'iswc': iswc.replace(' ', '').replace('\t', '').replace('\n', '').replace('-', '').replace('.', ''),  # Remove dashes, dots, spaces
                'work_mbid': work_mbid,
                'title': work.get('title', ''),
                'contributors': [
                    {
                        'name': c.get('name', ''),
                        'isni': c.get('ids', {}).get('isnis', [None])[0],
                        'ipi': c.get('ids', {}).get('ipis', [None])[0],
                        'role': c.get('role'),
                        'birthdate': c.get('birthdate'),
                        'nationality': c.get('nationality'),
                    }
                    for c in work.get('contributors', [])
                ],
                'recording_count': len(work.get('recordings', [])),
                'q1_score': work.get('q1Score'),
                'sample_recordings': [
                    {
                        'isrc': r.get('isrc', ''),
                        'title': r.get('title', ''),
                        'subtitle': r.get('subtitle'),
                        'artists': [
                            a.get('name', '') for a in r.get('contributors', [])
                            if a.get('contributorType') == 'MainArtist'
                        ],
                    }
                    for r in work.get('recordings', [])[:5]  # First 5 for verification
                ],
                'raw_data': work_data,
            }
            
        except Exception as e:
            logger.error(f"Work enrichment failed: {e}")
            self.account_pool.mark_current_failed()
            raise
    
    def _lookup_recording_by_isrc(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup recording by ISRC using cookie string"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}'

        # Use requests library with cookie string (like TypeScript implementation)
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }

        try:
            logger.info(f"🔍 Looking up recording: {clean_isrc}")
            logger.debug(f"URL: {url}")
            logger.debug(f"Cookie length: {len(session_cookie)} chars")

            response = requests.get(url, headers=headers, timeout=30)

            logger.info(f"Response status: {response.status_code}")
            logger.debug(f"Response headers: {dict(response.headers)}")

            # Log response body for debugging
            try:
                response_text = response.text[:500]
                logger.debug(f"Response body (first 500 chars): {response_text}")
            except:
                pass

            if response.status_code == 401:
                logger.error("Session expired (401)")
                raise Exception("SESSION_EXPIRED")
            elif response.status_code == 404:
                logger.warning(f"ISRC not found in Quansic (404): {clean_isrc}")
                return None
            elif not response.ok:
                logger.warning(f"API error {response.status_code} for ISRC {clean_isrc}")
                return None

            data = response.json()
            logger.info(f"✅ Successfully fetched recording data for {clean_isrc}")
            return data.get('results')

        except Exception as e:
            logger.error(f"Recording ISRC lookup exception: {e}")
            return None
    
    def _lookup_work_by_isrc(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup work by ISRC using Quansic API - FIXED COOKIE APPROACH"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}/works/0'
        
        # ✅ Use requests library with extracted cookie string (like TypeScript)
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'x-instance': 'default',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise Exception("SESSION_EXPIRED")
            elif not response.ok:
                return None
            
            data = response.json()
            works = data.get('results', {}).get('data', [])
            
            return works[0] if works else None
            
        except Exception as e:
            logger.debug(f"Work ISRC lookup failed: {e}")
            return None
    
    def _lookup_work_by_iswc(self, iswc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup work by ISWC using Quansic API - FIXED COOKIE APPROACH"""
        clean_iswc = iswc.replace(' ', '').replace('\t', '').replace('\n', '').replace('-', '').replace('.', '')  # Remove dashes, dots, spaces
        url = f'https://explorer.quansic.com/api/q/lookup/work/iswc/{clean_iswc}'
        
        # ✅ Use requests library with extracted cookie string (like TypeScript)
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
            logger.debug(f"Work ISWC lookup failed: {e}")
            return None
    
    def cleanup(self):
        """Clean up browser instance on shutdown - BOT ANTI-DETECTION"""
        try:
            if self._browser_instance:
                logger.info("🛑 Cleaning up browser instance")
                self._browser_instance.close()
                self._browser_instance = None
                logger.info("✅ Browser instance cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up browser: {e}")
    
    def __del__(self):
        """Destructor to ensure cleanup"""
        self.cleanup()
