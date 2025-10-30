"""
FastAPI application for Quansic Enrichment Service using hrequests
Provides HTTP API endpoints for music metadata enrichment
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
import uvicorn
import os
import signal
import sys
from loguru import logger
import asyncio

from models import (
    EnrichRequest, EnrichRecordingRequest, EnrichWorkRequest, AuthRequest, SearchRequest,
    ApiResponse, QuansicArtistData, QuansicRecordingData, QuansicWorkData
)
from quansic_service import QuansicService

# Global service instance
quansic_service: Optional[QuansicService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global quansic_service
    
    # Startup
    logger.info("Starting Quansic Enrichment Service with hrequests...")
    
    try:
        quansic_service = QuansicService()
        logger.info("✅ QuansicService initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize QuansicService: {e}")
        sys.exit(1)
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Quansic Enrichment Service...")
    if quansic_service:
        # Cleanup browser instance to avoid detection
        quansic_service.cleanup()
    logger.info("✅ Shutdown completed")


# Create FastAPI app
app = FastAPI(
    title="Quansic Enrichment Service",
    description="Anti-detection music metadata enrichment using hrequests",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get service instance
async def get_quansic_service() -> QuansicService:
    """Dependency to get QuansicService instance"""
    if quansic_service is None:
        raise HTTPException(status_code=500, detail="Service not initialized")
    return quansic_service


@app.get("/health", response_model=Dict[str, Any])
async def health_check(service: QuansicService = Depends(get_quansic_service)):
    """Health check endpoint with service status"""
    try:
        account_pool_status = service.account_pool.get_status()
        
        # Calculate session validity
        session_valid = any(
            service._is_session_valid(f"{acc.email}_{acc.status}")
            for acc in service.account_pool.accounts
        )
        
        # Get current account info
        current_account = service.account_pool.accounts[service.account_pool.current_index]
        
        return {
            "status": "healthy",
            "uptime": "running",
            "session_valid": session_valid,
            "service_version": "2.0.0",
            "hrequests_enabled": True,
            "anti_detection": True,
            "account_pool": {
                "total_accounts": len(service.account_pool.accounts),
                "active_accounts": len([acc for acc in service.account_pool.accounts if acc.status == 'active']),
                "failed_accounts": len([acc for acc in service.account_pool.accounts if acc.status == 'failed']),
                "banned_accounts": len([acc for acc in service.account_pool.accounts if acc.status == 'banned']),
                "current_account": current_account.email,
                "rotation_stats": {
                    "threshold": int(os.getenv('REQUESTS_PER_ACCOUNT', '30')),
                    "interval_minutes": int(os.getenv('ROTATION_INTERVAL_MS', '1800000')) // 60000,
                    "requests_today": sum(acc.request_count for acc in service.account_pool.accounts),
                    "success_rate": (
                        sum(acc.success_count for acc in service.account_pool.accounts) /
                        max(1, sum(acc.request_count for acc in service.account_pool.accounts))
                    ) * 100
                }
            },
            "browser_config": service.browser_config
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {e}")


@app.post("/auth", response_model=ApiResponse)
async def authenticate_account(
    request: AuthRequest,
    service: QuansicService = Depends(get_quansic_service)
):
    """Manual authentication endpoint"""
    try:
        from models import AccountCredentials
        
        # Create temporary account for testing
        temp_account = AccountCredentials(email=request.email, password=request.password)
        session_cookie = await service.authenticate(temp_account)
        
        return ApiResponse(
            success=True,
            data={"session_cookie": session_cookie, "authenticated": True}
        )
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        return ApiResponse(success=False, error=str(e))


@app.get("/session-status", response_model=Dict[str, Any])
async def session_status(service: QuansicService = Depends(get_quansic_service)):
    """Check session status"""
    try:
        valid_sessions = []
        for acc in service.account_pool.accounts:
            cache_key = f"{acc.email}_{acc.status}"
            if service._is_session_valid(cache_key):
                valid_sessions.append(acc.email)
        
        return {
            "valid_sessions": len(valid_sessions),
            "session_accounts": valid_sessions,
            "total_accounts": len(service.account_pool.accounts)
        }
    except Exception as e:
        logger.error(f"Session status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/account-pool", response_model=Dict[str, Any])
async def get_account_pool(service: QuansicService = Depends(get_quansic_service)):
    """Get account pool status and management info"""
    try:
        return service.account_pool.get_status()
    except Exception as e:
        logger.error(f"Account pool status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search", response_model=ApiResponse)
async def search_artist(
    request: SearchRequest,
    service: QuansicService = Depends(get_quansic_service)
):
    """Search for artist by ISNI using entity search"""
    try:
        account = service.account_pool.get_next_account()
        session_cookie = await service.authenticate(account)
        
        # Try entity search
        artist_data = await service._search_artist_by_isni(request.isni, session_cookie)
        
        if not artist_data:
            return ApiResponse(success=False, error="No artist found")
        
        return ApiResponse(success=True, data=artist_data)
        
    except Exception as e:
        logger.error(f"Artist search failed: {e}")
        return ApiResponse(success=False, error=str(e))


@app.post("/enrich", response_model=ApiResponse)
async def enrich_artist(
    request: EnrichRequest,
    service: QuansicService = Depends(get_quansic_service)
):
    """Enrich artist data by ISNI using anti-detection browsing"""
    try:
        logger.info(f"🎵 Artist enrichment request: ISNI {request.isni}")
        
        artist_data = await service.get_artist_data(
            isni=request.isni,
            musicbrainz_mbid=request.musicbrainz_mbid,
            spotify_artist_id=request.spotify_artist_id,
            force_reauth=request.force_reauth
        )
        
        return ApiResponse(success=True, data=artist_data)
        
    except Exception as e:
        logger.error(f"Artist enrichment failed: {e}")
        return ApiResponse(success=False, error=str(e))


@app.post("/enrich-recording", response_model=ApiResponse)
async def enrich_recording(
    request: EnrichRecordingRequest,
    service: QuansicService = Depends(get_quansic_service)
):
    """Enrich recording data by ISRC using anti-detection browsing"""
    try:
        logger.info(f"🎵 Recording enrichment request: ISRC {request.isrc}")
        
        recording_data = await service.get_recording_data(
            isrc=request.isrc,
            spotify_track_id=request.spotify_track_id,
            recording_mbid=request.recording_mbid,
            force_reauth=request.force_reauth
        )
        
        return ApiResponse(success=True, data=recording_data)
        
    except Exception as e:
        logger.error(f"Recording enrichment failed: {e}")
        return ApiResponse(success=False, error=str(e))


@app.post("/enrich-work", response_model=ApiResponse)
async def enrich_work(
    request: EnrichWorkRequest,
    service: QuansicService = Depends(get_quansic_service)
):
    """Enrich work data by ISWC using anti-detection browsing"""
    try:
        logger.info(f"📝 Work enrichment request: ISWC {request.iswc}")
        
        work_data = await service.get_work_data(
            iswc=request.iswc,
            work_mbid=request.work_mbid,
            force_reauth=request.force_reauth
        )
        
        return ApiResponse(success=True, data=work_data)
        
    except Exception as e:
        logger.error(f"Work enrichment failed: {e}")
        return ApiResponse(success=False, error=str(e))


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )


# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    sys.exit(0)


if __name__ == "__main__":
    # Configure logging
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start server
    port = int(os.getenv("PORT", "3000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"🚀 Starting Quansic Enrichment Service v2.0.0 with hrequests")
    logger.info(f"🌐 Server: http://{host}:{port}")
    logger.info(f"🛡️ Anti-detection: Enabled (Camoufox + Patchright)")
    logger.info(f"📊 Browser: {os.getenv('HREQUESTS_BROWSER', 'firefox')}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,  # Disable reload in production
        log_level="info"
    )
