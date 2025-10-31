#!/bin/bash

# Unified Karaoke Pipeline Startup Script
# Manages all local services and runs the pipeline

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PIPELINE_DIR="/media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline"
DEMUCS_DIR="/media/t42/th42/Code/karaoke-school-v1/demucs-local"
LOG_DIR="${PIPELINE_DIR}/logs"
SCRIPT_NAME=$(basename "$0")

# Ensure directories exist
mkdir -p "$LOG_DIR"

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

cleanup() {
    log_info "Pipeline execution complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check for required tools
    local missing_tools=()
    
    command -v bun >/dev/null 2>&1 || missing_tools+=("bun")
    command -v python3 >/dev/null 2>&1 || missing_tools+=("python3")
    command -v ffprobe >/dev/null 2>&1 || missing_tools+=("ffprobe")
    command -v fpcalc >/dev/null 2>&1 || missing_tools+=("chromaprint-tools")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install missing tools and try again"
        exit 1
    fi
    
    log_success "All dependencies available"
}

start_demucs_local() {
    if [ "$USE_LOCAL_DEMUCS" != "true" ]; then
        log_info "Skipping local Demucs startup (USE_LOCAL_DEMUCS != true)"
        return 0
    fi

    log_info "Starting local Demucs service..."

    # Check if Demucs directory exists
    if [ ! -d "$DEMUCS_DIR" ]; then
        log_warning "Demucs directory not found: $DEMUCS_DIR"
        return 1
    fi

    # Check if Demucs is already running
    if curl -s http://localhost:8001/health >/dev/null 2>&1; then
        log_success "Demucs already running on port 8001"
        return 0
    fi

    # Start Demucs in background
    log_info "Launching Demucs on port 8001..."
    cd "$DEMUCS_DIR"
    nohup bash start.sh > "$LOG_DIR/demucs.log" 2>&1 &

    DEMUCS_PID=$!
    echo $DEMUCS_PID > "$LOG_DIR/demucs.pid"

    # Wait for Demucs to be ready (up to 60 seconds)
    log_info "Waiting for Demucs to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8001/health >/dev/null 2>&1; then
            log_success "Demucs service is ready (PID: $DEMUCS_PID)"
            cd "$PIPELINE_DIR"
            return 0
        fi
        sleep 2
    done

    log_warning "Demucs startup may be taking longer (still loading model), continuing..."
    cd "$PIPELINE_DIR"
    return 0
}

check_pipeline_dependencies() {
    log_info "Checking pipeline dependencies..."
    
    cd "$PIPELINE_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $PIPELINE_DIR"
        exit 1
    fi
    
    # Install/update dependencies if needed
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log_info "Installing pipeline dependencies..."
        dotenvx run -f .env -- bun install
    fi
    
    log_success "Pipeline dependencies ready"
}

start_pipeline() {
    log_info "Starting unified pipeline..."

    cd "$PIPELINE_DIR"

    # Start unified pipeline with specified arguments
    if [ $# -eq 0 ]; then
        # Default: run unified pipeline once with all steps
        log_info "Running unified pipeline (all steps, limit=10)"
        dotenvx run -f .env -- bun run-unified --all --limit=10
    else
        # Use provided arguments
        log_info "Running unified pipeline with args: $@"
        dotenvx run -f .env -- bun run-unified "$@"
    fi
}

show_status() {
    log_info "Service Status:"
    echo ""
    echo "  Unified Pipeline Status:"
    echo "    Location: $PIPELINE_DIR"
    echo ""
    echo "  Usage:"
    echo "    $0 --all --limit=10          # Run all steps"
    echo "    $0 --step=6 --limit=5        # Run single step"
    echo "    $0 --continuous --all        # Run continuously"
    echo ""
    echo "  View logs:"
    echo "    tail -f <logfile>"
    echo ""
}

show_help() {
    echo "Unified Karaoke Pipeline Startup Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [PIPELINE_ARGS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -d, --demucs        Start local Demucs service"
    echo "  -s, --status        Show service status"
    echo "  -c, --check         Check dependencies only"
    echo "  -l, --logs          Show recent logs"
    echo ""
    echo "Pipeline Args (passed to pipeline runner):"
    echo "  --all               Run all steps (2-12)"
    echo "  --step N            Run specific step only"
    echo "  --limit N           Limit processing to N items"
    echo "  --continuous        Run continuously with delays"
    echo ""
    echo "Environment Variables:"
    echo "  USE_LOCAL_DEMUCS=true    Start local Demucs service"
    echo ""
    echo "Examples:"
    echo "  $0 --check                    # Check dependencies"
    echo "  $0 --demucs --all --limit=5   # Start Demucs and run pipeline"
    echo "  $0 --continuous --all         # Continuous pipeline with Demucs"
    echo "  $0 --step 6 --limit=10        # Run step 6 only"
    echo ""
}

parse_args() {
    local demucs_flag=false
    local status_flag=false
    local check_flag=false
    local logs_flag=false
    
    # Check if first argument is help
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        exit 0
    fi
    
    # Parse flags
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--demucs)
                demucs_flag=true
                shift
                ;;
            -s|--status)
                status_flag=true
                shift
                ;;
            -c|--check)
                check_flag=true
                shift
                ;;
            -l|--logs)
                logs_flag=true
                shift
                ;;
            *)
                # Pipeline arguments - stop parsing flags
                break
                ;;
        esac
    done
    
    # Execute actions based on flags
    if [ "$check_flag" = true ]; then
        check_dependencies
        exit 0
    fi
    
    if [ "$status_flag" = true ]; then
        show_status
        exit 0
    fi
    
    if [ "$logs_flag" = true ]; then
        log_info "Recent pipeline logs:"
        [ -f "$LOG_DIR/pipeline.log" ] && tail -n 30 "$LOG_DIR/pipeline.log"
        echo ""
        log_info "Recent Demucs logs:"
        [ -f "$LOG_DIR/demucs.log" ] && tail -n 30 "$LOG_DIR/demucs.log"
        exit 0
    fi
    
    # Set Demucs environment variable
    if [ "$demucs_flag" = true ]; then
        export USE_LOCAL_DEMUCS=true
    fi
}

main() {
    echo "🎵 Unified Karaoke Pipeline"
    echo "============================"
    echo ""

    # Parse command line arguments
    parse_args "$@"

    # Run dependency checks
    check_dependencies
    check_pipeline_dependencies

    # Start services
    start_demucs_local

    # Start pipeline with remaining arguments
    start_pipeline "$@"

    # Show status
    echo ""
    show_status
}

# Run main function with all arguments
main "$@"
