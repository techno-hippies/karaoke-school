#!/usr/bin/env python3
"""
Monitor TikTok scraper progress
"""

import sys
import time
from pathlib import Path
from datetime import datetime

def monitor_progress():
    """Monitor the scraper progress"""
    log_file = Path("scraper_output.log")
    
    if not log_file.exists():
        print("❌ Scraper log file not found")
        return
    
    print("📊 Monitoring TikTok scraper progress...")
    print("Press Ctrl+C to stop monitoring\n")
    
    try:
        with open(log_file, 'r') as f:
            # Go to end of file
            f.seek(0, 2)
            
            while True:
                line = f.readline()
                if line:
                    print(line.strip())
                else:
                    time.sleep(2)
    except KeyboardInterrupt:
        print("\n👋 Stopped monitoring")

if __name__ == "__main__":
    monitor_progress()
