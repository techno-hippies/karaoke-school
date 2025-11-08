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
            'headless': os.getenv('HREQUESTS_HEADLESS', 'true').lower() == 'true',
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
    
    async def authenticate(self, account: AccountCredentials, force_reauth: bool = False) -> str:
        """Authenticate with Quansic using hrequests browser automation and return cookie string"""
        logger.info(f"Authenticating with Quansic using account: {account.email}")

        # Check if we have a valid cached session
        cache_key = f"{account.email}_{account.status}"
        logger.info(f"Cache key: {cache_key}, force_reauth: {force_reauth}")
        logger.info(f"Session cache keys: {list(self.session_cache.keys())}")

        if not force_reauth and self._is_session_valid(cache_key):
            logger.info(f"✅ Using cached session for {account.email}")
            return self.session_cache[cache_key]
        else:
            logger.info(f"❌ Cache miss - will authenticate. force_reauth={force_reauth}, valid={self._is_session_valid(cache_key)}")

        try:
            # Run hrequests authentication in separate thread to avoid event loop conflict
            loop = asyncio.get_event_loop()
            cookie_str = await loop.run_in_executor(
                self.thread_pool, 
                self._perform_hrequests_login_sync, 
                account
            )

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
            page = hrequests.BrowserSession(
                browser=self.browser_config['browser'],
                headless=self.browser_config['headless'],
                mock_human=True
            )

            try:
                logger.info(f"Navigating to login page...")
                # Use underlying Playwright page with wait_until='domcontentloaded'
                page.page.goto('https://explorer.quansic.com/app-login', wait_until='domcontentloaded', timeout=60000)
                logger.info(f"Page loaded, current URL: {page.url}")

                # Wait for page to stabilize
                sleep_time = random.uniform(2, 5)
                logger.info(f"Sleeping for {sleep_time:.2f}s...")
                time.sleep(sleep_time)
                logger.info(f"Sleep complete, proceeding to form fill...")

                # Find and fill login form
                logger.info(f"Checking page content...")
                # Dump page HTML to see what's actually there
                try:
                    page_html = page.html.html[:1000] if hasattr(page, 'html') else "No HTML"
                    logger.info(f"Page HTML preview: {page_html[:200]}...")

                    # Try to find email input with different selectors
                    selectors_to_try = [
                        'input[name="email"]',
                        'input[type="email"]',
                        'input[id="email"]',
                        '#email',
                        'input[placeholder*="mail" i]',
                        'input[placeholder*="Email" i]'
                    ]

                    for selector in selectors_to_try:
                        try:
                            if page.isVisible(selector):
                                logger.info(f"✅ Found email input with selector: {selector}")
                                email_selector = selector
                                break
                        except:
                            continue
                    else:
                        logger.error(f"❌ Could not find email input with any selector!")
                        raise Exception("Email input not found on page")

                except Exception as e:
                    logger.error(f"Error checking page: {e}")
                    raise

                # Use human-like typing for anti-detection
                logger.info(f"Human-like typing email into {email_selector}...")
                self._human_type(page, email_selector, account.email)
                logger.info(f"Email typed successfully")
                time.sleep(random.uniform(0.5, 1.5))

                logger.info(f"Human-like typing password...")
                self._human_type(page, 'input[name="password"]', account.password)
                logger.info(f"Password typed successfully")
                time.sleep(random.uniform(0.5, 1.5))

                # Take screenshot after filling
                try:
                    page.screenshot(path='/tmp/quansic-after-fill.png')
                    logger.debug("Screenshot saved: /tmp/quansic-after-fill.png")
                except:
                    pass

                # Click login button (must actually click, not press Enter)
                logger.info(f"Looking for and clicking login button...")
                button_selectors = [
                    'button[loc="login.button.label"]',
                    'button[color="accent"]',
                    'button:has-text("Login")',
                    'button[mat-raised-button]'
                ]

                button_clicked = False
                click_error = None
                for button_selector in button_selectors:
                    try:
                        if page.isVisible(button_selector):
                            logger.info(f"✅ Found login button with selector: {button_selector}")
                            try:
                                page.page.click(button_selector)
                                logger.info(f"✅ Clicked login button with selector: {button_selector}")
                                button_clicked = True
                                break
                            except Exception as click_error:
                                logger.debug(f"Click failed for {button_selector}: {click_error}")
                                continue
                    except Exception as e:
                        logger.debug(f"isVisible check failed for {button_selector}: {e}")
                        continue

                if not button_clicked:
                    error_detail = f" ({click_error})" if click_error else ""
                    logger.error(f"❌ Could not click any login button{error_detail}")
                    logger.error(f"Tried selectors: {button_selectors}")
                    raise Exception(f"Login button click failed - no selector worked{error_detail}")

                # Take screenshot after click
                try:
                    time.sleep(2)
                    page.screenshot(path='/tmp/quansic-after-click.png')
                    logger.debug("Screenshot saved: /tmp/quansic-after-click.png")
                except:
                    pass

                # Wait for navigation by checking URL change
                logger.debug(f"Waiting for navigation away from login page...")
                max_wait = 30  # seconds
                start_time = time.time()
                login_url = page.url

                while time.time() - start_time < max_wait:
                    time.sleep(1)
                    current_url = page.url

                    # Check for "Authentication Failed" error on the page
                    try:
                        page_html = page.html.text.lower()
                        if 'authentication failed' in page_html:
                            logger.error("=" * 80)
                            logger.error("🚨 CRITICAL ERROR: QUANSIC ACCOUNT CREDENTIALS REJECTED!")
                            logger.error("=" * 80)
                            logger.error(f"Account: {account.email}")
                            logger.error("The Quansic account has been shut down or credentials are invalid.")
                            logger.error("Login page shows: 'Authentication Failed'")
                            logger.error("=" * 80)
                            raise Exception(f"QUANSIC ACCOUNT INVALID - Authentication Failed for {account.email}")
                    except Exception as e:
                        if "QUANSIC ACCOUNT INVALID" in str(e):
                            raise

                    if current_url != login_url and 'app-login' not in current_url:
                        logger.info(f"Successfully navigated to: {current_url}")
                        break
                else:
                    logger.warning(f"Still on login page after {max_wait}s: {page.url}")
                    # Check for error messages
                    try:
                        error_text = page.html.text.lower()
                        if 'authentication failed' in error_text:
                            logger.error("=" * 80)
                            logger.error("🚨 CRITICAL ERROR: QUANSIC ACCOUNT CREDENTIALS REJECTED!")
                            logger.error("=" * 80)
                            logger.error(f"Account: {account.email}")
                            logger.error("The Quansic account has been shut down or credentials are invalid.")
                            logger.error("=" * 80)
                            raise Exception(f"QUANSIC ACCOUNT INVALID - Authentication Failed for {account.email}")
                        if 'invalid' in error_text or 'incorrect' in error_text:
                            raise Exception(f"Login failed - invalid credentials")
                    except Exception as e:
                        if "QUANSIC ACCOUNT INVALID" in str(e) or "Authentication Failed" in str(e):
                            raise
                        pass

                # Extract cookies as string (like TypeScript implementation)
                cookie_str = '; '.join([f'{c.name}={c.value}' for c in page.cookies])
                logger.info(f"Extracted {len(page.cookies)} cookies")

                # Log cookie expiration info
                import base64
                from datetime import datetime

                for cookie in page.cookies:
                    if cookie.expires and cookie.expires > 0:
                        expires_timestamp = cookie.expires
                        expires_dt = datetime.fromtimestamp(expires_timestamp)
                        time_until_expiry = expires_timestamp - time.time()
                        hours_until_expiry = time_until_expiry / 3600
                        logger.info(f"Cookie '{cookie.name}': expires at {expires_dt} ({hours_until_expiry:.1f} hours from now)")
                    else:
                        # If it's a JWT, try to decode the expiration from the token
                        if 'jwt' in cookie.name.lower():
                            try:
                                # JWT format: header.payload.signature
                                parts = cookie.value.split('.')
                                if len(parts) == 3:
                                    # Decode payload (add padding if needed)
                                    payload = parts[1]
                                    payload += '=' * (4 - len(payload) % 4)
                                    decoded = base64.urlsafe_b64decode(payload)
                                    import json
                                    jwt_data = json.loads(decoded)

                                    if 'exp' in jwt_data:
                                        exp_timestamp = jwt_data['exp']
                                        exp_dt = datetime.fromtimestamp(exp_timestamp)
                                        time_until_expiry = exp_timestamp - time.time()
                                        hours_until_expiry = time_until_expiry / 3600
                                        logger.info(f"Cookie '{cookie.name}': JWT expires at {exp_dt} ({hours_until_expiry:.1f} hours from now)")
                                    else:
                                        logger.info(f"Cookie '{cookie.name}': JWT with no expiration")
                            except Exception as e:
                                logger.debug(f"Could not decode JWT '{cookie.name}': {e}")
                                logger.info(f"Cookie '{cookie.name}': session cookie (no expiry set)")
                        else:
                            logger.info(f"Cookie '{cookie.name}': session cookie (no expiry set)")

                return cookie_str

            finally:
                # Always close the page
                page.close()

        except Exception as e:
            logger.error(f"Login failed for {account.email}: {e}")
            raise Exception(f"Login failed: {e}")
    
    def _human_type(self, page, selector: str, text: str, min_delay: float = 0.05, max_delay: float = 0.2):
        """Type text character by character with human-like delays"""
        logger.debug(f"Starting human-like typing into {selector}")
        for i, char in enumerate(text):
            page.page.type(selector, char)
            delay = random.uniform(min_delay, max_delay)
            time.sleep(delay)
            if (i + 1) % 5 == 0:
                logger.debug(f"  Typed {i + 1}/{len(text)} characters...")
        logger.debug(f"Finished typing {len(text)} characters")

    def _is_session_valid(self, cache_key: str) -> bool:
        """Check if cached session is still valid"""
        if cache_key not in self.session_cache:
            return False

        expiry = self.session_expiry.get(cache_key, 0)
        return time.time() * 1000 < expiry
    
    async def get_artist_data(self, isni: str, musicbrainz_mbid: Optional[str] = None, 
                            spotify_artist_id: Optional[str] = None, 
                            force_reauth: bool = False) -> Dict[str, Any]:
        """Get artist data from Quansic with anti-detection"""
        logger.info(f"Enriching artist ISNI: {isni}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = await self.authenticate(account, force_reauth)
        
        try:
            # Get event loop for async operations
            loop = asyncio.get_event_loop()
            
            # Try direct ISNI lookup first
            artist_data = await loop.run_in_executor(
                self.thread_pool,
                self._lookup_artist_by_isni_sync,
                isni, session_cookie
            )
            
            # If direct lookup fails, try entity search
            if not artist_data:
                logger.debug(f"Direct ISNI lookup failed, trying entity search for {isni}")
                artist_data = await loop.run_in_executor(
                    self.thread_pool,
                    self._search_artist_by_isni_sync,
                    isni, session_cookie
                )
            
            # If still no data and we have Spotify ID, try Spotify search
            if not artist_data and spotify_artist_id:
                logger.debug(f"ISNI search failed, trying Spotify ID: {spotify_artist_id}")
                artist_data = await loop.run_in_executor(
                    self.thread_pool,
                    self._search_artist_by_spotify_sync,
                    spotify_artist_id, session_cookie
                )
            
            if not artist_data:
                raise Exception(f"No artist data found for ISNI: {isni}")
            
            # Get name variants
            name_variants = await loop.run_in_executor(
                self.thread_pool,
                self._get_artist_name_variants_sync,
                isni, session_cookie
            )
            
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

    async def lookup_artist_by_spotify(self, spotify_artist_id: str, force_reauth: bool = False) -> Dict[str, Any]:
        """Lookup artist by Spotify ID using search endpoint and return full Quansic data including ISNI"""
        logger.info(f"Looking up artist by Spotify ID: {spotify_artist_id}")

        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = await self.authenticate(account, force_reauth)

        try:
            # Get event loop for async operations
            loop = asyncio.get_event_loop()

            # Use search endpoint (no direct Spotify ID lookup available)
            artist_data = await loop.run_in_executor(
                self.thread_pool,
                self._search_artist_by_spotify_sync,
                spotify_artist_id, session_cookie
            )

            if not artist_data:
                return {
                    'error': 'SPOTIFY_ID_NOT_FOUND',
                    'message': f'Artist with Spotify ID {spotify_artist_id} not found in Quansic',
                    'spotify_artist_id': spotify_artist_id
                }

            # Extract party data from search result
            party = artist_data.get('party', {})

            # Extract data from party object
            ids = party.get('ids', {})
            isnis = ids.get('isnis', [])
            ipis = ids.get('ipis', [])

            # Mark account as successful
            account.mark_success()

            return {
                'spotify_artist_id': spotify_artist_id,
                'name': party.get('name'),
                'ids': {
                    'isnis': isnis,
                    'ipis': ipis,
                    'quansic_id': party.get('quansicId'),
                    'ipns': ids.get('ipns', []),
                    'musicbrainz_mbid': ids.get('musicbrainzIds', [None])[0],
                    'luminateIds': ids.get('luminateIds', []),
                    'gracenoteIds': ids.get('gracenoteIds', []),
                    'amazonIds': ids.get('amazonIds', []),
                    'appleIds': ids.get('appleIds', []),
                },
                'raw_data': party,
            }

        except Exception as e:
            logger.error(f"Spotify artist lookup failed: {e}")
            self.account_pool.mark_current_failed()
            raise

    async def get_recording_data(self, isrc: str, spotify_track_id: Optional[str] = None,
                               recording_mbid: Optional[str] = None,
                               force_reauth: bool = False) -> Dict[str, Any]:
        """Get recording data from Quansic with anti-detection"""
        logger.info(f"Enriching recording ISRC: {isrc}")

        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = await self.authenticate(account, force_reauth)

        try:
            # Get recording data
            loop = asyncio.get_event_loop()
            recording_data = await loop.run_in_executor(
                self.thread_pool,
                self._lookup_recording_by_isrc_sync,
                isrc, session_cookie
            )

            if not recording_data:
                logger.warning(f"No recording found in Quansic database for ISRC: {isrc}")
                # Return "not found" result - this is NOT an account failure
                return {
                    'isrc': isrc.replace(' ', '').replace('\t', '').replace('\n', ''),
                    'error': f'ISRC_NOT_FOUND',
                    'message': f'Recording not found in Quansic for ISRC: {isrc}'
                }
            
            # Get work data separately
            work_data = await loop.run_in_executor(
                self.thread_pool,
                self._lookup_work_by_isrc_sync,
                isrc, session_cookie
            )
            
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
            error_msg = str(e)
            if "AUTHENTICATION_FAILED" in error_msg or "401" in error_msg:
                logger.error(f"❌ RECORDING ENRICHMENT FAILED - AUTHENTICATION ERROR: {error_msg}")
                logger.error("The session cookie from login is not working. Check if Quansic has blocked the session.")
            else:
                logger.error(f"❌ RECORDING ENRICHMENT FAILED: {error_msg}")
            self.account_pool.mark_current_failed()
            raise
    
    async def get_work_data(self, iswc: str, work_mbid: Optional[str] = None,
                          force_reauth: bool = False) -> Dict[str, Any]:
        """Get work data from Quansic with anti-detection"""
        logger.info(f"Enriching work ISWC: {iswc}")
        
        # Get account and authenticate
        account = self.account_pool.get_next_account()
        session_cookie = await self.authenticate(account, force_reauth)
        
        try:
            # Get work data
            loop = asyncio.get_event_loop()
            work_data = await loop.run_in_executor(
                self.thread_pool,
                self._lookup_work_by_iswc_sync,
                iswc, session_cookie
            )

            if not work_data:
                logger.warning(f"No work found in Quansic database for ISWC: {iswc}")
                # Return "not found" result - this is NOT an account failure
                return {
                    'iswc': iswc.replace(' ', '').replace('\t', '').replace('\n', '').replace('-', '').replace('.', ''),
                    'error': 'ISWC_NOT_FOUND',
                    'message': f'Work not found in Quansic for ISWC: {iswc}'
                }
            
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
                logger.error("❌ AUTHENTICATION FAILED (401) - Session cookie is invalid or expired")
                logger.error("This means login succeeded but the session cookie doesn't work for API requests")
                raise Exception("AUTHENTICATION_FAILED: Session cookie invalid (401)")
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
    
    # Sync versions for thread pool execution
    def _lookup_artist_by_isni_sync(self, isni: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Direct ISNI lookup using Quansic API - Sync version for thread pool"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::{clean_isni}'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        try:
            response = hrequests.get(url, headers=headers, timeout=30)
            
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

    def _lookup_artist_by_spotify_sync(self, spotify_artist_id: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Direct Spotify ID lookup using Quansic API - Sync version for thread pool"""
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::spotify::{spotify_artist_id}'

        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'x-instance': 'default',
        }

        try:
            logger.info(f"🔍 Looking up Spotify artist: {spotify_artist_id}")
            logger.debug(f"URL: {url}")

            response = hrequests.get(url, headers=headers, timeout=30)

            logger.info(f"Response status: {response.status_code}")

            if response.status_code == 401:
                logger.error("❌ AUTHENTICATION FAILED (401)")
                raise Exception("SESSION_EXPIRED")
            elif response.status_code == 404:
                logger.warning(f"Spotify artist not found in Quansic (404): {spotify_artist_id}")
                return None
            elif not response.ok:
                logger.warning(f"API error {response.status_code} for Spotify ID {spotify_artist_id}")
                raise Exception(f"API error: {response.status_code}")

            data = response.json()
            logger.debug(f"Response data: {data}")

            # Check response status
            if data.get('status') != 'OK':
                logger.warning(f"API returned non-OK status: {data.get('status')}")
                return None

            party_data = data.get('results', {}).get('party')

            if not party_data:
                logger.warning(f"No party data in response for {spotify_artist_id}")
                return None

            logger.info(f"✅ Successfully fetched artist data for {spotify_artist_id}: {party_data.get('name')}")
            return party_data

        except Exception as e:
            logger.error(f"Direct Spotify lookup exception: {e}")
            return None

    def _search_artist_by_isni_sync(self, isni: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Search for artist using entity search endpoint - Sync version"""
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
    
    def _search_artist_by_spotify_sync(self, spotify_id: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Search for artist using Spotify ID - Sync version"""
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
    
    def _get_artist_name_variants_sync(self, isni: str, session_cookie: str) -> List[Dict[str, Any]]:
        """Get artist name variants - Sync version"""
        clean_isni = isni.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::{clean_isni}/nameVariants'
        
        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
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
    
    def _lookup_recording_by_isrc_sync(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup recording by ISRC using Quansic API - Sync version"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}'

        headers = {
            'cookie': session_cookie,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }

        try:
            logger.info(f"🔍 Looking up recording: {clean_isrc}")
            logger.debug(f"URL: {url}")
            logger.debug(f"Cookie length: {len(session_cookie)} chars")

            response = hrequests.get(url, headers=headers, timeout=30)

            logger.info(f"Response status: {response.status_code}")
            logger.debug(f"Response headers: {dict(response.headers)}")

            # Log response body for debugging
            try:
                response_text = response.text[:500]
                logger.debug(f"Response body (first 500 chars): {response_text}")
            except:
                pass

            if response.status_code == 401:
                logger.error("❌ AUTHENTICATION FAILED (401) - Session cookie is invalid or expired")
                logger.error("This means login succeeded but the session cookie doesn't work for API requests")
                raise Exception("AUTHENTICATION_FAILED: Session cookie invalid (401)")
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
    
    def _lookup_work_by_isrc_sync(self, isrc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup work by ISRC using Quansic API - Sync version"""
        clean_isrc = isrc.replace(' ', '').replace('\t', '').replace('\n', '')
        url = f'https://explorer.quansic.com/api/q/lookup/recording/isrc/{clean_isrc}/works/0'
        
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
    
    def _lookup_work_by_iswc_sync(self, iswc: str, session_cookie: str) -> Optional[Dict[str, Any]]:
        """Lookup work by ISWC using Quansic API - Sync version"""
        clean_iswc = iswc.replace(' ', '').replace('\t', '').replace('\n', '').replace('-', '').replace('.', '')
        url = f'https://explorer.quansic.com/api/q/lookup/work/iswc/{clean_iswc}'
        
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
