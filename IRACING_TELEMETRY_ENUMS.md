# iRacing Telemetry Enums Reference

This document maps the enum values used in iRacing telemetry for track surface detection and car position tracking.

## CarIdxTrackSurface (irsdk_TrkLoc)

Indicates where the car is located on the track.

| Value | Name | Description | Car Marker Color |
|-------|------|-------------|------------------|
| -1 | `NotInWorld` | Car not spawned/loaded | Gray `#6b7280` |
| 0 | `OffTrack` | Car is off the racing surface | Red `#dc2626` |
| 1 | `InPitStall` | Car is stopped in pit stall | Orange `#f97316` |
| 2 | `AproachingPits` | Car is on pit road approaching pits | Yellow `#facc15` |
| 3 | `OnTrack` | Car is on the racing surface | Cyan `#0e7490` |

**Usage in Live Tracker:**
```javascript
// Automatically updates outer ring color based on location
carPositionTracker.setTrackSurface(values.CarIdxTrackSurface[playerCarIdx]);
```

**Visual Appearance:**
- **Inner circle (fill)**: Always cyan `#06b6d4` (car body)
- **Outer ring (stroke)**: Changes color based on track surface location

## CarIdxTrackSurfaceMaterial (irsdk_TrkSurf)

Indicates the specific material the car is driving on.

| Value | Name | Material Type | Color Mapping |
|-------|------|---------------|---------------|
| 0 | `SurfaceNotInWorld` | Not in world | Gray `#6b7280` |
| 1 | `UndefinedMaterial` | Unknown/undefined | Gray `#6b7280` |
| 2-5 | `Asphalt1-4Material` | Asphalt (racing surface) | Cyan `#0e7490` |
| 6-7 | `Concrete1-2Material` | Concrete | Light Blue `#06b6d4` |
| 8-9 | `RacingDirt1-2Material` | Racing dirt surface | Brown `#92400e` |
| 10-11 | `Paint1-2Material` | Painted surface (pit markings) | Orange `#f97316` |
| 12-15 | `Rumble1-4Material` | Rumble strips | Yellow `#eab308` |
| 16-19 | `Grass1-4Material` | Grass (off track) | Green `#16a34a` |
| 20-23 | `Dirt1-4Material` | Dirt (off track) | Red `#dc2626` |
| 24 | `SandMaterial` | Sand (off track) | Red `#dc2626` |
| 25-26 | `Gravel1-2Material` | Gravel (off track) | Red `#dc2626` |
| 27 | `GrasscreteMaterial` | Grasscrete runoff | Light Green `#22c55e` |
| 28 | `AstroturfMaterial` | Astroturf runoff | Light Green `#22c55e` |

**Material Categories:**
- **Racing Surfaces**: Asphalt (2-5), Concrete (6-7), Racing Dirt (8-9)
- **Track Markings**: Paint (10-11), Rumble strips (12-15)
- **Off Track**: Grass (16-19), Dirt (20-23), Sand (24), Gravel (25-26)
- **Runoff Areas**: Grasscrete (27), Astroturf (28)

**Usage in Live Tracker:**
```javascript
// Optional: Override color based on surface material
// Currently commented out - TrackSurface takes priority
carPositionTracker.setTrackSurfaceMaterial(values.CarIdxTrackSurfaceMaterial[playerCarIdx]);
```

## Current Implementation

### Car Marker Appearance

**Default State (On Track):**
- Inner circle: Cyan `#06b6d4`
- Outer ring: Dark cyan `#0e7490`
- Size: 14px radius with 3px stroke width

**Status Colors (Outer Ring):**
- 🔵 **Cyan** `#0e7490` - On track (normal racing)
- 🟡 **Yellow** `#facc15` - Approaching pits
- 🟠 **Orange** `#f97316` - In pit stall
- 🔴 **Red** `#dc2626` - Off track
- ⚫ **Gray** `#6b7280` - Not in world

### Implementation Priority

1. **Primary**: `CarIdxTrackSurface` - Used for location-based status
   - Most reliable for pit detection
   - Clear visual indication of car state
   
2. **Secondary**: `CarIdxTrackSurfaceMaterial` - Optional material detail
   - Can be used for more granular surface detection
   - Useful for detecting rumble strips, grass, gravel
   - Currently disabled to avoid conflicts with TrackSurface

### Code Location

**Car Position Tracker:**
- File: `public/js/modules/car-position-tracker.js`
- Methods:
  - `setTrackSurface(trackSurface)` - Sets color based on location
  - `setTrackSurfaceMaterial(surfaceMaterial)` - Sets color based on material
  - `setCarStrokeColor(color)` - Direct stroke color control

**Live Tracker Integration:**
- File: `public/js/live-tracker.js`
- Lines: ~565-585
- Reads `CarIdxTrackSurface[PlayerCarIdx]` from telemetry
- Updates car marker stroke color in real-time

## Testing & Debugging

To see the values in real-time:
```javascript
// In browser console while live tracker is running
console.log('Track Surface:', telemetryValues.CarIdxTrackSurface[telemetryValues.PlayerCarIdx]);
console.log('Surface Material:', telemetryValues.CarIdxTrackSurfaceMaterial[telemetryValues.PlayerCarIdx]);
```

To test different colors manually:
```javascript
// Access the car position tracker in console
const tracker = window.liveTracker?.carPositionTracker;
tracker.setTrackSurface(1); // Orange - in pit stall
tracker.setTrackSurface(0); // Red - off track
tracker.setTrackSurface(3); // Cyan - on track
```

## References

- iRacing SDK Documentation: https://github.com/kutu/pyirsdk
- Telemetry descriptor: `telemetry-desc (1).json`
- Car position tracker: `public/js/modules/car-position-tracker.js`
