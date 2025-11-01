#!/bin/bash

# Docker Compose Karaoke Pipeline Startup
# Reliable service management using Docker containers

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PIPELINE_DIR="/media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline"
DOCKER_COMPOSE_FILE="docker-compose.yml"

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

check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose is not available. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Docker and Docker Compose are available"
}

start_services() {
    log_info "Starting all Karaoke Pipeline services with Docker Compose..."
    
    cd "$PIPELINE_DIR"
    
    # Build and start services
    if command -v docker-compose >/dev/null 2>&1; then
        # Use docker-compose (v1)
        docker-compose -f "$DOCKER_COMPOSE_FILE" up --build -d
    else
        # Use docker compose (v2)
        docker compose -f "$DOCKER_COMPOSE_FILE" up --build -d
    fi
    
    log_success "All services started!"
}

wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_wait=60
    local services=("bmi:3002" "audio-download:3001" "ffmpeg:3003" "demucs:8001" "pipeline:8787")
    
    for service_port in "${services[@]}"; do
        local service="${service_port%:*}"
        local port="${service_port#*:}"
        
        log_info "Waiting for $service service..."
        
        local ready=false
        for i in $(seq 1 $max_wait); do
            if curl -sf "http://localhost:$port/health" >/dev/null 2>&1 || \
               [ "$service" = "demucs" ] && curl -sf "http://localhost:$port/" >/dev/null 2>&1; then
                log_success "$service is ready"
                ready=true
                break
            fi
            
            if [ $i -eq $max_wait ]; then
                log_warning "$service may still be starting (timeout reached)"
            fi
            
            sleep 1
        done
        
        if [ "$ready" = false ]; then
            log_info "Note: $service service may be slow to start"
        fi
    done
}

show_status() {
    echo ""
    echo "🎵 KARAOKE PIPELINE SERVICES (Docker Compose)"
    echo "=============================================="
    echo ""
    
    cd "$PIPELINE_DIR"
    
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    else
        docker compose -f "$DOCKER_COMPOSE_FILE" ps
    fi
    
    echo ""
    echo "Service URLs:"
    echo "  Pipeline Server:  http://localhost:8787"
    echo "  Quansic Service:  http://d1crjmbvpla6lc3afdemo0mhgo.ingress.dhcloud.xyz (Akash hosted, v2.0.2)"
    echo "  BMI Service:      http://localhost:3002 (maps to :3000)"
    echo "  Audio Service:    http://localhost:3001"
    echo "  FFmpeg Service:   http://localhost:3003"
    echo "  Demucs Service:   http://localhost:8001"
    echo ""
    echo "Useful Commands:"
    echo "  View logs:        docker-compose -f $DOCKER_COMPOSE_FILE logs -f [service]"
    echo "  Stop services:    docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "  Restart service:  docker-compose -f $DOCKER_COMPOSE_FILE restart [service]"
    echo ""
}

stop_services() {
    log_info "Stopping all services..."
    
    cd "$PIPELINE_DIR"
    
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
    else
        docker compose -f "$DOCKER_COMPOSE_FILE" down
    fi
    
    log_success "All services stopped"
}

show_help() {
    echo "Docker Compose Karaoke Pipeline Startup Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start all services (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  status    Show service status"
    echo "  logs      Show service logs"
    echo "  help      Show this help"
    echo ""
    echo "Benefits of Docker Compose:"
    echo "  ✓ Isolated service containers"
    echo "  ✓ Automatic dependency management"
    echo "  ✓ Built-in health checks"
    echo "  ✓ Reliable restart behavior"
    echo "  ✓ No manual dependency installation"
    echo ""
}

# Handle cleanup on script termination
cleanup() {
    if [ "${1:-}" != "no-cleanup" ]; then
        log_info "Cleaning up..."
        stop_services
    fi
}

trap cleanup EXIT

main() {
    case "${1:-start}" in
        start)
            log_info "🎵 Starting Karaoke Pipeline with Docker Compose"
            echo ""
            
            check_docker
            start_services
            wait_for_services
            
            echo ""
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            log_info "🎵 Restarting Karaoke Pipeline"
            echo ""
            
            stop_services
            start_services
            wait_for_services
            
            echo ""
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            cd "$PIPELINE_DIR"
            if command -v docker-compose >/dev/null 2>&1; then
                docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
            else
                docker compose -f "$DOCKER_COMPOSE_FILE" logs -f
            fi
            ;;
        help|--help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
