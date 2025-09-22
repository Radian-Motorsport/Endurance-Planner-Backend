# Radian Planner - Quick Reference

## 🎯 What Changed
Original `index.html.html` (861 lines) → Split into 4 focused pages + centralized styles

## 📁 New Structure
- **`index.html`** - Landing page with navigation and quick setup
- **`race-setup.html`** - Race configuration (replaces race inputs section)  
- **`live-timing.html`** - Real-time race management (replaces live functionality)
- **`strategy-analysis.html`** - NEW: Garage61 team performance integration
- **`styles.css`** - Centralized stylesheet (extracted from inline styles)
- **`live-timing.js`** - Extracted JavaScript functionality

## 🔄 User Flow
1. **Landing Page** → Choose what to do
2. **Race Setup** → Configure race parameters  
3. **Live Timing** → Run race with real-time adjustments
4. **Strategy Analysis** → Analyze team performance & get recommendations

## 💾 Backup
- Original file: `index-original-backup.html` 
- Legacy planner: `liveupdating.html` (still available)

## 🚀 New Features
- Garage61 API integration for real team telemetry
- Quick setup presets (GT3, GT4, LMP2, etc.)
- Persistent configuration across pages
- Professional landing page with system status

## 📖 Full Documentation
See `REFACTORING-README.md` for complete technical details.

---
*Created: September 22, 2025 | 71% reduction in complexity | 4 focused components*