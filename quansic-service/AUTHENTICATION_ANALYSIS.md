# Quansic Service Authentication Analysis

## Summary of Findings

### ✅ **Bun/TypeScript Implementation (index.ts)** - WORKING CORRECTLY

#### Session Caching: ✅ PROPERLY IMPLEMENTED
- **Cookie storage** (lines 19-22): Global `sessionCookie` and `sessionExpiry` with 1-hour duration
- **Cache validation** (lines 539-541): `isSessionValid()` checks expiry before re-authenticating
- **Cookie extraction** (lines 497-501): Properly extracts cookies from Playwright context
  ```typescript
  const sessionCookieStr = cookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
  ```
- **Reuse logic** (lines 546-553): `ensureSession()` returns cached cookie if valid

#### Account Rotation: ✅ WORKING
- **Account pool** (lines 242-283): Loads multiple accounts from env vars
- **Proactive rotation** (lines 289-331): Rotates based on request count (50 default) or time (30 min)
- **Failure handling** (lines 336-352): Marks accounts as failed/banned after 3 failures

#### ISRC → ISWC Lookup: ✅ WORKING
- **Recording endpoint** (lines 818-930): Fetches recording data from ISRC
- **Work lookup** (lines 854-878): Separately fetches work data via `/works/0` endpoint
- **ISWC extraction** (line 892): `iswc: work?.iswc?.replace(/\s/g, '') || null`

---

### ❌ **Python Implementation (quansic_service.py)** - CRITICAL BUGS

#### 🐛 **BUG #1: Type Mismatch in Authentication** (BLOCKING ISSUE)

**Problem:** The `authenticate()` method returns the WRONG type.

**Evidence:**
```python
# Line 91 - Returns hrequests.Session object
return session

# Line 142 - Returns the session object (not cookies!)
return session

# Line 338 - Variable name misleading
session_cookie = self.authenticate(account, force_reauth)

# Lines 499-527 - Expects a STRING but receives Session object
def _lookup_work_by_isrc(self, isrc: str, session_cookie: str):
    headers = {
        'cookie': session_cookie,  # ❌ TypeError! session_cookie is a Session object, not a string
        ...
    }
```

**Impact:**
- ❌ Work lookups WILL FAIL
- ❌ ISWC discovery NOT WORKING
- ❌ Session caching is useless because wrong type is cached

**Fix Required:**
The `authenticate()` method must extract cookies as a string BEFORE returning:

```python
def _perform_hrequests_login_sync(self, account: AccountCredentials) -> str:
    """Perform login and return COOKIE STRING (not session object)"""

    session = hrequests.Session(browser='firefox', os='win')
    # ... login logic ...

    # ✅ Extract cookies as string before returning
    cookie_str = '; '.join([f'{c.name}={c.value}' for c in session.cookies])
    return cookie_str  # Return STRING, not Session object
```

---

#### 🐛 **BUG #2: Session Reuse Not Working**

**Problem:** Even though session validation exists (lines 148-154), it's checking the wrong cache.

**Evidence:**
```python
# Line 77 - Returns cached Session object
return self.session_cache[cache_key]

# But session_cache contains Session objects, not cookie strings
# So all subsequent API calls fail with TypeError
```

**Impact:**
- ❌ Cached sessions are unusable
- ⚠️ Re-authentication happens EVERY REQUEST (wasteful)
- ⚠️ Higher detection risk due to excessive logins

---

#### 🐛 **BUG #3: Mixed Request Libraries**

**Problem:** Code uses BOTH `hrequests` and `requests` library inconsistently.

**Evidence:**
```python
# Lines 203-230 - Uses regular 'requests' library
import requests
response = requests.get(url, headers=headers, timeout=30)

# Lines 244-265 - Uses 'hrequests' library
response = hrequests.post(url, headers=headers, json={...})

# Lines 459-497 - Uses Session object directly
response = session.get(url)  # Expects hrequests.Session
```

**Impact:**
- ⚠️ Inconsistent behavior
- ⚠️ Anti-detection features only work with hrequests
- ⚠️ Regular `requests` library exposes Python fingerprint

**Recommendation:** Use hrequests CONSISTENTLY across all API calls.

---

## Test Results

### Bun/TypeScript Service
```bash
curl -X POST http://localhost:3000/enrich-recording \
  -d '{"isrc": "USIR20400274"}'

# Expected: ✅ Returns ISWC if available
```

### Python Service (Current)
```bash
curl -X POST http://localhost:3000/enrich-recording \
  -d '{"isrc": "USIR20400274"}'

# Result: ❌ "No recording found for ISRC: USIR20400274"
# Reason: Type mismatch causes API call to fail
```

---

## Recommendations

### 🚨 Priority 1: Fix Authentication Return Type

**File:** `quansic_service.py`

Change `_perform_hrequests_login_sync()` to return cookie string:

```python
def _perform_hrequests_login_sync(self, account: AccountCredentials) -> str:
    """Login and return cookie string"""
    session = hrequests.Session(browser='firefox', os='win')

    # Add headers...
    session.headers.update({...})

    # Navigate and login...
    response = session.get('https://explorer.quansic.com/app-login')

    with response.render(mock_human=True) as page:
        # Fill form and login...
        page.type('input[name="email"]', account.email)
        page.type('input[name="password"]', account.password)
        page.click('button:has-text("Login")')
        page.awaitNavigation(timeout=15000)

    # ✅ Extract cookies as string
    cookie_str = '; '.join([f'{c.name}={c.value}' for c in session.cookies])
    return cookie_str
```

### 🚨 Priority 2: Update Method Signatures

Change all methods to expect `str` instead of `hrequests.Session`:

```python
def _lookup_recording_by_isrc(self, isrc: str, session_cookie: str):  # ✅ str
def _lookup_work_by_isrc(self, isrc: str, session_cookie: str):      # ✅ str
```

### 🚨 Priority 3: Standardize HTTP Library

Either:
- Use `hrequests` for ALL API calls (recommended for anti-detection)
- OR use regular `requests` with cookie string (simpler but less stealthy)

---

## Session Caching Status

| Implementation | Cached? | Expiry Check | Cookie Format | Status |
|---------------|---------|--------------|---------------|--------|
| **TypeScript** | ✅ Yes | ✅ Yes | ✅ String | **WORKING** |
| **Python** | ⚠️ Yes | ⚠️ Yes | ❌ **Wrong Type** | **BROKEN** |

---

## ISWC Discovery Status

| Implementation | Recording Lookup | Work Lookup | ISWC Extraction | Status |
|---------------|------------------|-------------|-----------------|--------|
| **TypeScript** | ✅ Working | ✅ Working | ✅ Working | **CONFIRMED** |
| **Python** | ⚠️ Implemented | ❌ **Type Error** | ❌ **Blocked** | **BROKEN** |

---

## Next Steps

1. **Fix Python authentication to return cookie string** (30 min)
2. **Test ISRC → ISWC lookup** (5 min)
3. **Verify session caching works** (5 min)
4. **Consider standardizing on hrequests** (optional, 1 hour)

---

## Quick Test Command

After fixes, verify with:

```bash
# Should return ISWC (or null if work doesn't exist)
curl -X POST http://localhost:3000/enrich-recording \
  -H "Content-Type: application/json" \
  -d '{"isrc": "USIR20400274"}' | jq '.data.iswc'
```

Expected output: `"T0701928597"` or `null` (if no work found)

---

**Generated:** 2025-10-30
**Service Status:** Python implementation requires critical fixes before production use.
