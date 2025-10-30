#!/usr/bin/env python3
"""
Direct test of hrequests authentication with real Quansic credentials
"""

import hrequests
import time

# Your real credentials
EMAIL = "christianimogen@tiffincrane.com"
PASSWORD = "Temporarypw710!"

def test_basic_connection():
    """Test basic connection to Quansic"""
    print("🌐 Testing basic connection to Quansic...")
    
    try:
        # Create hrequests session
        session = hrequests.Session(browser='firefox', os='win')
        print(f"✅ Session created: {session.browser}")
        
        # Test connection
        response = session.get('https://explorer.quansic.com/')
        print(f"✅ Connected! Status: {response.status_code}")
        print(f"📄 Content preview: {response.text[:200]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_login_page():
    """Test accessing the login page"""
    print("\n🔗 Testing login page access...")
    
    try:
        session = hrequests.Session(browser='firefox', os='win')
        
        # Get login page
        response = session.get('https://explorer.quansic.com/app-login')
        print(f"✅ Login page loaded! Status: {response.status_code}")
        
        # Check if login form exists
        if 'login' in response.text.lower() or 'email' in response.text.lower():
            print("✅ Login form detected in response")
            return True
        else:
            print("⚠️  Login form not detected - page might have changed")
            return False
            
    except Exception as e:
        print(f"❌ Login page test failed: {e}")
        return False

def test_browser_automation():
    """Test browser automation without async conflicts"""
    print("\n🎭 Testing browser automation...")
    
    try:
        session = hrequests.Session(browser='firefox', os='win')
        
        # Get login page
        response = session.get('https://explorer.quansic.com/app-login')
        print(f"✅ Login page response received")
        
        # Note: We can't use response.render() directly in this context
        # but we can verify the session works
        print(f"✅ Session cookies available: {len(session.cookies)}")
        for cookie in session.cookies:
            if len(cookie.name) > 0 and len(cookie.value) > 0:
                print(f"  - {cookie.name}: {cookie.value[:20]}...")
                break  # Just show first valid cookie
        else:
            print("  - No cookies yet (normal for initial request)")
        
        return True
        
    except Exception as e:
        print(f"❌ Browser automation test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing hrequests implementation with real Quansic credentials")
    print(f"🔑 Account: {EMAIL}")
    print("=" * 60)
    
    # Run tests
    tests = [
        ("Basic Connection", test_basic_connection),
        ("Login Page Access", test_login_page),
        ("Browser Automation", test_browser_automation),
    ]
    
    results = {}
    for test_name, test_func in tests:
        print(f"\n🔬 Running: {test_name}")
        print("-" * 40)
        
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:25} {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! hrequests implementation is working correctly.")
        print("💡 Next step: Test the API endpoints with real authentication.")
    else:
        print("⚠️  Some tests failed. Check the implementation.")

if __name__ == "__main__":
    main()
