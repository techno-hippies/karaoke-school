#!/bin/bash

# Robust Local Service Supervisor
# Manages all pipeline services with health checks and auto-restart
# Designed for local development, easy to migrate to production

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PIPELINE_DIR="/media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline"
AUDIO_SERVICE_DIR="/media/t42/th42/Code/karaoke-school-v1/audio-download-service"
DEMUCS_DIR="/media/t42/th42/Code/karaoke-school-v1/demucs-local"
QUANSIC_DIR="/media/t42/th42/Code/karaoke-school-v1/quansic-service"
LOG_DIR="${PIPELINE_DIR}/logs"

# Service configuration
declare -A SERVICES
SERVICES=(
    ["quansic"]="Quansic ISWC Service:3000:${QUANSIC_DIR}/main.py"
    ["pipeline"]="Standalone Pipeline Server:8787:${PIPELINE_DIR}/standalone-server.js"
    ["audio"]="Audio Download Service:3001:${AUDIO_SERVICE_DIR}/index.ts"
    ["demucs"]="Demucs GPU Service:8001:${DEMUCS_DIR}/start.sh"
)

# PID tracking
declare -A PIDS
declare -A STATUS
declare -A RESTART_COUNT

# Health check intervals (seconds)
HEALTH_CHECK_INTERVAL=10
MAX_RESTART_ATTEMPTS=3

# Logging
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Check if a port is in use
is_port_free() {
    local port=$1
    ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

# Wait for service to be healthy
wait_for_service() {
    local service=$1
    local port=$2
    local max_wait=$3
    
    log_info "Waiting for $service to be ready (port $port)..."
    
    for i in $(seq 1 $max_wait); do
        case $service in
            "quansic"|"bmi"|"pipeline"|"audio")
                if curl -sf http://localhost:$port/health >/dev/null 2>&1; then
                    log_success "$service is healthy on port $port"
                    return 0
                fi
                ;;
            "demucs")
                if curl -sf http://localhost:$port/ >/dev/null 2>&1; then
                    log_success "$service is healthy on port $port"
                    return 0
                fi
                ;;
        esac
        
        if [ $i -eq $max_wait ]; then
            log_error "$service failed to start on port $port"
            return 1
        fi
        
        sleep 1
    done
}

# Start a service
start_service() {
    local service=$1
    local port=$2
    local script=$3
    
    if [ ! -z "${PIDS[$service]:-}" ] && kill -0 "${PIDS[$service]}" 2>/dev/null; then
        log_warning "$service is already running (PID: ${PIDS[$service]})"
        return 0
    fi
    
    # Check if port is free
    if ! is_port_free $port; then
        log_error "Port $port is already in use for $service"
        return 1
    fi
    
    # Start the service
    log_info "Starting $service on port $port..."
    
    case $service in
        "quansic")
            cd "$QUANSIC_DIR"
            PORT=3000 python3 main.py > "$LOG_DIR/quansic.log" 2>&1 &
            ;;
        "bmi")
            cd "$BMI_DIR"
            dotenvx run -f .env -- bun run server.js > "$LOG_DIR/bmi.log" 2>&1 &
            ;;
        "pipeline")
            cd "$PIPELINE_DIR"
            # Use dotenvx and bun to run the standalone server
            dotenvx run -f .env -- bun run standalone-server.js > "$LOG_DIR/pipeline.log" 2>&1 &
            ;;
        "audio")
            cd "$AUDIO_SERVICE_DIR"
            dotenvx run -f .env -- bun run index.ts > "$LOG_DIR/audio.log" 2>&1 &
            ;;
        "demucs")
            cd "$DEMUCS_DIR"
            bash start.sh > "$LOG_DIR/demucs.log" 2>&1 &
            ;;
        *)
            log_error "Unknown service: $service"
            return 1
            ;;
    esac
    
    local pid=$!
    PIDS[$service]=$pid
    STATUS[$service]="starting"
    RESTART_COUNT[$service]=0
    
    log_success "Started $service (PID: $pid)"
}

# Health check a service
check_service_health() {
    local service=$1
    local port=$2
    local pid
    
    pid="${PIDS[$service]:-}"
    
    # Check if process is still running
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        STATUS[$service]="dead"
        return 1
    fi
    
    # Check service responsiveness
    case $service in
        "quansic"|"bmi"|"pipeline"|"audio")
            if curl -sf http://localhost:$port/health >/dev/null 2>&1; then
                STATUS[$service]="healthy"
                return 0
            else
                STATUS[$service]="unresponsive"
                return 1
            fi
            ;;
        "demucs")
            if curl -sf http://localhost:$port/ >/dev/null 2>&1; then
                STATUS[$service]="healthy"
                return 0
            else
                STATUS[$service]="unresponsive"
                return 1
            fi
            ;;
    esac
}

# Restart a failed service
restart_service() {
    local service=$1
    local port=$2
    local script=$3
    
    local current_count="${RESTART_COUNT[$service]:-0}"
    
    if [ $current_count -ge $MAX_RESTART_ATTEMPTS ]; then
        log_error "$service has failed too many times ($MAX_RESTART_ATTEMPTS). Stopping auto-restart."
        STATUS[$service]="failed"
        return 1
    fi
    
    # Kill the old process
    if [ ! -z "${PIDS[$service]:-}" ]; then
        log_warning "Killing failed $service process (PID: ${PIDS[$service]})"
        kill "${PIDS[$service]}" 2>/dev/null || true
        wait "${PIDS[$service]}" 2>/dev/null || true
    fi
    
    # Increment restart count
    RESTART_COUNT[$service]=$((current_count + 1))
    
    log_warning "Restarting $service (attempt ${RESTART_COUNT[$service]}/$MAX_RESTART_ATTEMPTS)"
    
    # Start fresh
    start_service "$service" "$port" "$script"
}

# Show service status
show_status() {
    echo ""
    echo "🎵 KARAOKE PIPELINE SERVICES"
    echo "============================"
    echo ""
    
    for service in quansic pipeline audio demucs; do
        local port
        case $service in
            "quansic") port=3000 ;;
            "pipeline") port=8787 ;;
            "audio") port=3001 ;;
            "demucs") port=8001 ;;
        esac

        local pid="${PIDS[$service]:-}"
        local status="${STATUS[$service]:-unknown}"
        local color

        case $status in
            "healthy") color=$GREEN ;;
            "starting") color=$YELLOW ;;
            "unresponsive"|"dead"|"failed") color=$RED ;;
            *) color=$NC ;;
        esac

        printf "  %-20s %-10s %-10s %s\n" \
            "${SERVICES[$service]%%:*}" \
            "Port $port" \
            "${color}$status${NC}" \
            "${pid:+PID: $pid}"
    done
    
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Shutting down services..."
    
    for service in pipeline audio demucs quansic; do
        local pid="${PIDS[$service]:-}"

        if [ ! -z "$pid" ]; then
            log_info "Stopping $service (PID: $pid)"
            kill "$pid" 2>/dev/null || true

            # Wait for graceful shutdown
            for i in {1..5}; do
                if ! kill -0 "$pid" 2>/dev/null; then
                    break
                fi
                sleep 1
            done

            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
    done
    
    log_success "All services stopped"
    exit 0
}

# Main service manager
main() {
    # Setup signal handlers
    trap cleanup SIGINT SIGTERM EXIT
    
    # Ensure directories exist
    mkdir -p "$LOG_DIR"
    
    # Check dependencies
    log_info "Checking dependencies..."
    
    local missing_tools=()
    
    command -v bun >/dev/null 2>&1 || missing_tools+=("bun")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    command -v lsof >/dev/null 2>&1 || missing_tools+=("lsof")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Start all services
    log_info "Starting all services..."

    for service in quansic pipeline audio demucs; do
        local port
        local script

        case $service in
            "quansic")
                port=3000
                script="${SERVICES[$service]#*:}"
                ;;
            "pipeline")
                port=8787
                script="${SERVICES[$service]#*:}"
                ;;
            "audio")
                port=3001
                script="${SERVICES[$service]#*:}"
                ;;
            "demucs")
                port=8001
                script="${SERVICES[$service]#*:}"
                ;;
        esac

        if ! start_service "$service" "$port" "$script"; then
            log_error "Failed to start $service"
            exit 1
        fi
    done

    # Wait for services to be ready
    log_info "Waiting for services to be ready..."

    for service in quansic pipeline audio demucs; do
        local port
        case $service in
            "quansic") port=3000 ;;
            "pipeline") port=8787 ;;
            "audio") port=3001 ;;
            "demucs") port=8001 ;;
        esac

        wait_for_service "$service" "$port" 30 || {
            log_error "$service startup failed"
            exit 1
        }
    done
    
    log_success "All services are ready!"
    show_status
    
    # Monitor services
    log_info "Monitoring services (Ctrl+C to stop)..."
    
    while true; do
        sleep $HEALTH_CHECK_INTERVAL
        
        local need_restart=false
        
        for service in quansic pipeline audio demucs; do
            local port
            local script

            case $service in
                "quansic")
                    port=3000
                    script="${SERVICES[$service]#*:}"
                    ;;
                "pipeline")
                    port=8787
                    script="${SERVICES[$service]#*:}"
                    ;;
                "audio")
                    port=3001
                    script="${SERVICES[$service]#*:}"
                    ;;
                "demucs")
                    port=8001
                    script="${SERVICES[$service]#*:}"
                    ;;
            esac
            
            if ! check_service_health "$service" "$port"; then
                log_warning "$service is unhealthy, restarting..."
                if restart_service "$service" "$port" "$script"; then
                    wait_for_service "$service" "$port" 15 || {
                        log_error "$service restart failed"
                        need_restart=true
                    }
                else
                    log_error "$service restart failed (max attempts reached)"
                    need_restart=true
                fi
            fi
        done
        
        # Show status if anything changed
        if [ "$need_restart" = true ]; then
            show_status
        fi
    done
}

# Help message
show_help() {
    echo "Robust Local Service Supervisor for Karaoke Pipeline"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help"
    echo "  -s, --status   Show service status only"
    echo ""
    echo "Services managed:"
    echo "  - Pipeline Server (port 8787)"
    echo "  - Audio Download Service (port 3001)"
    echo "  - Demucs GPU Service (port 8001)"
    echo ""
    echo "Features:"
    echo "  - Automatic service startup"
    echo "  - Health monitoring every $HEALTH_CHECK_INTERVAL seconds"
    echo "  - Auto-restart on failure (max $MAX_RESTART_ATTEMPTS attempts)"
    echo "  - Clean shutdown on Ctrl+C"
    echo ""
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -s|--status)
        show_status
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use -h for help"
        exit 1
        ;;
esac
