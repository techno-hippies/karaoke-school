# Documentation Cleanup Plan for `root/`

**Date**: 2025-10-04
**Purpose**: Consolidate and organize all documentation in `root/`

---

## ✅ Actions Completed

1. **Updated FOUNDATION_STATUS.md** - Marked karaoke-scorer-v4 testing as IN PROGRESS
2. **Consolidated contracts/README.md** - Merged SongCatalog deployment info
3. **Updated deployment addresses** - All contracts now have real addresses

---

## 📋 Files to Keep (Core Documentation)

These files are well-maintained and should be preserved:

| File | Purpose | Status |
|------|---------|--------|
| **`/root/README.md`** | Main project overview | ⚠️ Needs updating (see below) |
| **`/root/FOUNDATION_STATUS.md`** | Deployment tracking & testing checklist | ✅ **EXCELLENT** - Keep updated |
| **`/root/ARCHITECTURE.md`** | Frontend component architecture | ✅ **EXCELLENT** - Reference doc |
| **`/root/contracts/README.md`** | Smart contracts overview & deployment | ✅ Updated with real addresses |
| **`/root/contracts/CHANGES.md`** | SongQuiz refactor changelog | ✅ Historical record |
| **`/root/contracts/SongQuiz/ARCHITECTURE.md`** | Detailed SongQuiz design | ✅ Reference doc |
| **`/root/lit-actions/DEPLOYMENT.md`** | Lit Actions deployment guide | ✅ Keep (needs v4 update) |
| **`/root/song-uploader/README.md`** | Song uploader CLI guide | ✅ Standalone tool doc |
| **`/root/song-uploader/INTEGRATION.md`** | SongCatalog integration notes | ✅ Migration reference |
| **`/root/app/src/components/exercises/README.md`** | Exercise architecture | ✅ Well-written |

---

## ❌ Files to Delete (Redundant/Merged)

```bash
# Already merged into contracts/README.md
rm /media/t42/th42/Code/site/root/contracts/SONGCATALOG_DEPLOYMENT.md

# Could be merged into lit-actions/DEPLOYMENT.md
# (But keeping for now as it has useful v1-specific details)
# rm /media/t42/th42/Code/site/root/lit-actions/STUDY_SESSION_RECORDER_README.md
```

**Rationale**: SONGCATALOG_DEPLOYMENT.md content has been integrated into contracts/README.md deployment addresses section.

---

## ⚠️ Files Needing Updates

### 1. `/root/README.md`

**Issues**:
- References old contract names (`StudyTracker` → `StudyProgressV1`, `ArtistQuizTracker` → `SongQuizV1`)
- Says "Lit Actions (TBD)" and "Frontend App (TBD)" - both are now in progress
- Deployment addresses show "TBD" - should reference actual addresses

**Recommended Updates**:
```markdown
# Update contract references
- StudyTracker → StudyProgressV1
- ArtistQuizTracker → SongQuizV1

# Update status
- Lit Actions (TBD) → Lit Actions ✅ (see lit-actions/DEPLOYMENT.md)
- Frontend App (TBD) → Frontend App 🔄 (see ARCHITECTURE.md)

# Update deployment section
Deployment Addresses:
See [contracts/README.md - Deployment Addresses](./contracts/README.md#deployment-addresses)
```

### 2. `/root/app/README.md`

**Current Status**: Default Vite template boilerplate

**Recommended Action**:
- **Low priority** (app not built yet)
- When app development starts, replace with actual architecture/setup docs
- Reference ARCHITECTURE.md for component structure

### 3. `/root/lit-actions/DEPLOYMENT.md`

**Needs**:
- Update karaoke-scorer to v4 (remove v1/v2/v3 references)
- Add current CID: `QmUq1CtXhDAHXc99oQK8jy7HvZ1dx1aYwsiYDTAxD48ZBj`
- Mark v1-v3 as "Legacy" or move to archive section

---

## 📁 Proposed Final Structure

```
root/
├── README.md                           # 🔄 UPDATE: Main hub with current status
├── FOUNDATION_STATUS.md                # ✅ KEEP: Deployment tracking
├── ARCHITECTURE.md                     # ✅ KEEP: Frontend architecture
├── DOCS_CLEANUP_PLAN.md               # 📄 THIS FILE (can delete after cleanup)
│
├── contracts/
│   ├── README.md                       # ✅ UPDATED: Includes all deployment info
│   ├── CHANGES.md                      # ✅ KEEP: Refactor history
│   ├── [DELETED] SONGCATALOG_DEPLOYMENT.md
│   └── SongQuiz/
│       └── ARCHITECTURE.md             # ✅ KEEP: Quiz design doc
│
├── lit-actions/
│   ├── DEPLOYMENT.md                   # 🔄 UPDATE: Add v4, archive old versions
│   └── STUDY_SESSION_RECORDER_README.md # ✅ KEEP: Feature-specific doc
│
├── song-uploader/
│   ├── README.md                       # ✅ KEEP: CLI guide
│   └── INTEGRATION.md                  # ✅ KEEP: Integration notes
│
└── app/
    ├── README.md                       # 🔄 UPDATE: Replace boilerplate (low priority)
    └── src/components/exercises/
        └── README.md                   # ✅ KEEP: Exercise architecture
```

---

## 🎯 Immediate Cleanup Commands

Execute these commands to clean up:

```bash
# Navigate to root
cd /media/t42/th42/Code/site/root

# 1. Delete merged file
rm contracts/SONGCATALOG_DEPLOYMENT.md

# 2. (Optional) Archive legacy docs
mkdir -p docs/archive
# (No files to archive at this time)
```

---

## 📝 Update Checklist

### High Priority (This Week)
- [ ] Delete `contracts/SONGCATALOG_DEPLOYMENT.md` (already merged)
- [ ] Update `/root/README.md` with current contract names and status
- [ ] Update `lit-actions/DEPLOYMENT.md` with v4 CID

### Medium Priority (Before App Launch)
- [ ] Add test results to FOUNDATION_STATUS.md after karaoke-scorer-v4 test completes
- [ ] Create polling pattern example for frontend (in FOUNDATION_STATUS.md)
- [ ] Document complete foundation readiness

### Low Priority (When App Development Starts)
- [ ] Replace `/root/app/README.md` with actual app documentation
- [ ] Create app-specific architecture docs if needed

---

## 🔍 Documentation Quality Standards

Going forward, all new docs should follow these principles:

1. **Single Source of Truth**: No duplicate information across files
2. **Clear Purpose**: Each file has a specific, well-defined role
3. **Up-to-Date**: Reflect current deployment status (no "TBD" placeholders)
4. **Cross-References**: Link between related docs instead of duplicating
5. **Versioning**: Mark legacy content clearly, keep current info prominent

---

## 🎉 Summary

**Current State**:
- 15+ markdown files (including subdirectories)
- Some redundancy (SONGCATALOG_DEPLOYMENT merged)
- Some outdated references (contract names, TBD placeholders)

**After Cleanup**:
- ~13 core docs (quality over quantity)
- Zero duplication
- All current status reflected
- Clear navigation between docs

**Next Steps**:
1. Execute cleanup commands
2. Update README.md
3. Update lit-actions/DEPLOYMENT.md
4. Mark this file as complete and optionally delete it

---

**Last Updated**: 2025-10-04
