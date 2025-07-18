# Camera Pan & Zoom with Safe Zone: Implementation Findings

## Overview
This document details the findings from implementing a camera pan/zoom system with a safe zone overlay that must remain perfectly centered in the viewport. The solution involves coordinate system transformations between canvas drawing and CSS transforms.

## Problem Statement
- **Goal**: Implement a camera system that follows a cursor/object while keeping it within a "safe zone"
- **Challenge**: The safe zone (drawn on canvas) must remain perfectly centered in the viewport during pan/zoom operations
- **Complexity**: Multiple coordinate systems need to be synchronized:
  - Canvas pixel coordinates (intrinsic video resolution)
  - Container/display coordinates (actual rendered size)
  - Normalized coordinates (0-1 range)
  - CSS transform space

## Key Findings

### 1. Coordinate System Mismatch
The fundamental challenge was aligning two different rendering systems:
- **Canvas drawing** (`drawSafeZone`): Draws directly on canvas using pixel coordinates
- **CSS transforms**: Transforms the video element within its container

### 2. Initial Approaches That Failed

#### Approach 1: Direct Translation Calculation
```javascript
// This approach failed due to incorrect coordinate mapping
const centerOffsetX = (camera.x - 0.5) * canvas.width / 2;
const centerOffsetY = (camera.y - 0.5) * canvas.height / 2;
const panX = -centerOffsetX * scaleRatio * zoom;
const panY = -centerOffsetY * scaleRatio * zoom;
```
**Issue**: Assumed direct relationship between canvas and container pixels, ignoring aspect ratio differences.

#### Approach 2: Viewport-Based Translation
```javascript
// Better but still had offset issues
const viewPortX = camera.x * canvas.width - viewPortWidth / 2;
const viewPortY = camera.y * canvas.height - viewPortHeight / 2;
const panX = -viewPortX * containerRatio;
const panY = -viewPortY * containerRatio;
```
**Issue**: Didn't account for CSS transform order and letterboxing/pillarboxing.

### 3. The Working Solution: Transform-Origin Approach

The breakthrough came from using CSS `transform-origin` with a mathematically calculated origin point:

```javascript
// The point we want to zoom into (camera position)
const targetX = camera.x * containerWidth;
const targetY = camera.y * containerHeight;

// Calculate transform origin using the formula:
// origin + (target - origin) * zoom = center
// Solving for origin: origin = (center - target * zoom) / (1 - zoom)
const centerX = containerWidth / 2;
const centerY = containerHeight / 2;

if (zoom !== 1) {
    originX = (centerX - targetX * zoom) / (1 - zoom);
    originY = (centerY - targetY * zoom) / (1 - zoom);
}

// Apply transform with calculated origin
videoWrapper.style.transformOrigin = `${originX}px ${originY}px`;
videoWrapper.style.transform = `scale(${zoom})`;
```

## Mathematical Foundation

### Transform Origin Formula Derivation

When scaling from a transform-origin point:
1. The origin point stays fixed in place
2. All other points move away from (or toward) the origin by the scale factor

Given:
- `origin`: The transform-origin point
- `target`: The point we want to center (camera position)
- `zoom`: The scale factor
- `center`: The center of the container

The position of any point after scaling:
```
newPosition = origin + (originalPosition - origin) * zoom
```

We want the target to end up at center:
```
center = origin + (target - origin) * zoom
center = origin + target * zoom - origin * zoom
center = origin * (1 - zoom) + target * zoom
origin * (1 - zoom) = center - target * zoom
origin = (center - target * zoom) / (1 - zoom)
```

## Implementation for Swift/AVFoundation

### Key Concepts to Apply

1. **Coordinate System Mapping**
   - Map your tracking coordinates (0-1 normalized) to video frame coordinates
   - Account for video aspect ratio vs output aspect ratio

2. **Transform Calculation**
   ```swift
   struct CameraTransform {
       let zoom: CGFloat
       let position: CGPoint  // Normalized 0-1
       
       func calculateTransformOrigin(containerSize: CGSize) -> CGPoint {
           let target = CGPoint(
               x: position.x * containerSize.width,
               y: position.y * containerSize.height
           )
           
           let center = CGPoint(
               x: containerSize.width / 2,
               y: containerSize.height / 2
           )
           
           guard zoom != 1 else { return target }
           
           return CGPoint(
               x: (center.x - target.x * zoom) / (1 - zoom),
               y: (center.y - target.y * zoom) / (1 - zoom)
           )
       }
   }
   ```

3. **AVFoundation Custom Compositor Implementation**
   ```swift
   class CameraCompositor: NSObject, AVVideoCompositing {
       func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {
           // Handle context changes
       }
       
       func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
           // Apply camera transform here
           let transform = calculateCameraTransform(for: request.compositionTime)
           
           // Create transform matrix
           var matrix = CGAffineTransform.identity
           
           // Set transform origin and scale
           let origin = transform.calculateTransformOrigin(
               containerSize: request.renderContext.size
           )
           
           // Translate to origin, scale, translate back
           matrix = matrix.translatedBy(x: origin.x, y: origin.y)
           matrix = matrix.scaledBy(x: transform.zoom, y: transform.zoom)
           matrix = matrix.translatedBy(x: -origin.x, y: -origin.y)
           
           // Apply to video frame
           // ... compositor implementation
       }
   }
   ```

4. **Safe Zone Overlay**
   - Draw safe zone as a separate layer
   - Use the same coordinate system as the video
   - Apply the same transform to keep it synchronized

### Additional Considerations for Video Export

1. **Frame-by-Frame Processing**
   - Calculate camera position for each frame based on timestamp
   - Interpolate between cursor positions if needed

2. **Performance Optimization**
   - Pre-calculate transform matrices
   - Cache frequently used calculations
   - Consider using Metal for GPU acceleration

3. **Aspect Ratio Handling**
   ```swift
   func calculateVideoRect(videoSize: CGSize, containerSize: CGSize) -> CGRect {
       let videoAspect = videoSize.width / videoSize.height
       let containerAspect = containerSize.width / containerSize.height
       
       var scale: CGFloat
       var offset = CGPoint.zero
       
       if videoAspect > containerAspect {
           // Video wider - fit to width
           scale = containerSize.width / videoSize.width
           let scaledHeight = videoSize.height * scale
           offset.y = (containerSize.height - scaledHeight) / 2
       } else {
           // Video taller - fit to height
           scale = containerSize.height / videoSize.height
           let scaledWidth = videoSize.width * scale
           offset.x = (containerSize.width - scaledWidth) / 2
       }
       
       return CGRect(
           x: offset.x,
           y: offset.y,
           width: videoSize.width * scale,
           height: videoSize.height * scale
       )
   }
   ```

## Debugging Tips

1. **Add Visual Debug Layers**
   - Draw viewport boundaries
   - Show camera position
   - Display transform origin point

2. **Log Key Values**
   - Camera position (normalized and pixel)
   - Transform origin
   - Calculated transforms
   - Viewport boundaries

3. **Test Edge Cases**
   - Maximum zoom levels
   - Viewport boundaries
   - Different aspect ratios
   - Rapid camera movements

## Conclusion

The key to perfect safe zone centering is understanding that:
1. Transform-origin determines the pivot point for scaling
2. The mathematical relationship between origin, target, zoom, and final position
3. Using only `scale()` with calculated `transform-origin` is cleaner than combining `scale()` and `translate()`

This approach can be directly applied to AVFoundation custom compositors by calculating the appropriate transform matrices using the same mathematical principles.