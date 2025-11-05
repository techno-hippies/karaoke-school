# Project Documentation Index

**Comprehensive documentation for Karaoke School v1**

## 📁 Documentation Structure

### Core Documentation
- **[README.md](../README.md)** - Main project overview and quick start
- **[AGENTS.md](../AGENTS.md)** - Service integration guide and API endpoints
- **[environment-setup.md](./environment-setup.md)** - Development environment configuration

### Service-Specific Documentation

#### React Frontend
- **[app/README.md](../app/docs/README.md)** - Frontend development guide
- **[app/line-level-fsrs.md](../app/docs/line-level-fsrs.md)** - Line-level FSRS implementation

#### Smart Contracts  
- **[contracts/README.md](../contracts/docs/README.md)** - Smart contract development
- **[contracts/grc20.md](../contracts/docs/grc20.md)** - GRC-20 integration (when created)

#### Processing Pipeline
- **[karaoke-pipeline/README.md](../karaoke-pipeline/docs/README.md)** - Pipeline development and deployment

#### GraphQL Subgraph
- **[subgraph/README.md](../subgraph/docs/README.md)** - Subgraph development and indexing
- **[subgraph/story-protocol.md](../subgraph/docs/story-protocol.md)** - Story Protocol integration

#### Lit Actions (AI)
- **[lit-actions/README.md](../lit-actions/docs/README.md)** - AI grading system
- **[lit-actions/voxtral-integration.md](../lit-actions/docs/voxtral-integration.md)** - Voxstral AI configuration

### Technical Architecture
- **[technical-architecture.md](./technical-architecture.md)** - Complete system architecture, coding guidelines, and database schema
- **[system-state.md](./system-state.md)** - Current system state and deployment status

## 🎯 Quick Navigation

### For New Developers
1. **Start Here**: [README.md](../README.md) - Project overview
2. **Setup**: [environment-setup.md](./environment-setup.md) - Environment configuration
3. **Integration**: [AGENTS.md](../AGENTS.md) - Service communication

### For Frontend Developers
1. **[app/docs/README.md](../app/docs/README.md)** - Frontend architecture and components
2. **[app/docs/line-level-fsrs.md](../app/docs/line-level-fsrs.md)** - FSRS integration details

### For Backend Developers
1. **[contracts/docs/README.md](../contracts/docs/README.md)** - Smart contract development
2. **[karaoke-pipeline/docs/README.md](../karaoke-pipeline/docs/README.md)** - Processing pipeline
3. **[lit-actions/docs/README.md](../lit-actions/docs/README.md)** - AI grading system

### For Blockchain Developers
1. **[contracts/docs/README.md](../contracts/docs/README.md)** - Contract architecture
2. **[subgraph/docs/README.md](../subgraph/docs/README.md)** - GraphQL indexing
3. **[technical-architecture.md](./technical-architecture.md)** - Complete blockchain stack

### For DevOps/Deployment
1. **[system-state.md](./system-state.md)** - Current deployment status
2. **Service docs** - Individual deployment guides in each service folder

## 🏗️ Architecture Overview

### Multi-Layer Blockchain Stack
```
┌─────────────────────────────────────┐
│ Layer 1: GRC-20 (Public Metadata)  │
│ - Industry identifiers (ISNI/ISWC)  │
│ - Network: Geo Testnet             │
└─────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────┐
│ Layer 2: Smart Contracts (Events)   │
│ - Karaoke segments, line-level FSRS │
│ - Network: Lens Testnet (37111)     │
└─────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────┐
│ Layer 3: The Graph (Query Layer)    │
│ - GraphQL indexing of events        │
│ - Local dev → Studio deployment     │
└─────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────┐
│ Layer 4: Grove/IPFS (Storage)       │
│ - Audio files, timing data          │
│ - Content-addressed storage         │
└─────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────┐
│ Layer 5: React Frontend (UX)        │
│ - Line-level spaced repetition      │
│ - AI-powered performance grading    │
└─────────────────────────────────────┘
```

### Line-Level FSRS Implementation
- **Database**: `karaoke_lines` table (2,766 lines)
- **Contract**: `LinePerformanceGraded` events  
- **Subgraph**: `LineCard` entities for fast queries
- **Frontend**: Progressive learning (15 cards/day)
- **AI**: Voxstral grading via Lit Actions

## 🔗 Key Resources

### Development Environment
- **Database**: Neon `frosty-smoke-70266868` (KS1)
- **Blockchain**: Lens Testnet (Chain ID: 37111)
- **AI Network**: Base Sepolia (Lit Actions)

### Service Ports (Local Development)
- **App**: http://localhost:5173
- **Pipeline**: http://localhost:8787  
- **Subgraph**: http://localhost:8000/subgraphs/name/subgraph-0

### Deployed Contracts
```typescript
const CONTRACTS = {
  PerformanceGrader: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D",
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6", 
  SegmentEvents: "0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8",
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
  TranslationEvents: "0x..."
};
```

## 🧪 Testing Quick Reference

### Start All Services
```bash
cd karaoke-pipeline && ./supervisor.sh &      # Pipeline (8787)
cd app && bun run dev &                       # App (5173)  
cd subgraph && npm run dev &                  # Subgraph (8000)
```

### Test Line-Level FSRS
```bash
# 1. Start app
cd app && bun run dev

# 2. Visit study page
# Navigate to: /song/{grc20WorkId}/study

# 3. Check subgraph entities
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ lineCards(first: 5) { id lineId lineIndex } }"}'

# 4. Verify database
psql $NEON_DATABASE_URL -c "SELECT COUNT(*) FROM karaoke_lines;"
```

## 🎯 Current Status

### ✅ Complete
- Database: 2,766 karaoke lines with UUID identifiers
- Smart Contracts: All 5 contracts deployed on Lens Testnet
- Line-Level FSRS: Backend implementation complete
- App Updates: StudySessionPage supports line progression
- Documentation: Consolidated and service-specific

### ⏳ Next Steps
1. **Deploy Subgraph**: Local → The Graph Studio
2. **Enable Line-Level in App**: Update useStudyCards to query lineCards
3. **Test Lit Actions**: Verify gradeLinePerformance() works
4. **Story Protocol**: Test single video IP Asset creation

## 📚 Additional Resources

### External Documentation
- **[Lit Protocol Docs](https://developer.litprotocol.com/)** - PKP authentication and Lit Actions
- **[The Graph Docs](https://thegraph.com/docs/en/)** - Subgraph development
- **[Lens Protocol](https://docs.lens.xyz/)** - Social graph integration
- **[Story Protocol](https://docs.storyprotocol.xyz/)** - IP Asset management

### Internal Resources
- **GitHub**: [Repository Link]
- **Discord**: [Community Link]
- **Linear**: [Project Tracking]

---

**All documentation follows consistent structure with service-specific details in appropriate folders**
