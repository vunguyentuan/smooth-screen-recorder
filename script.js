let cursorEvents = [];
let video, canvas, ctx;
let animationId;
let isPlaying = false;
let startTime = null;
let videoLoaded = false;
let cursorLoaded = false;
let timeOffset = 0;
let currentCursorIndex = 0;
let showDebug = false;
let trailFadeTimeout = 1000; // Trail disappears after 1 second of no movement
let hideCursorWhenStill = false;

// Camera system variables
let camera = {
    x: 0.5,        // Camera position (0-1 normalized coordinates)
    y: 0.5,
    zoom: 0.8,     // Current zoom level (default 0.8x)
    targetX: 0.5,  // Target position for smooth movement
    targetY: 0.5,
    targetZoom: 0.8, // Target zoom for smooth zooming (default 0.8x)
    smoothing: 0.08 // Camera smoothing factor
};

let cameraSettings = {
    margin: 0.4,        // Margin from viewport edges where cursor should stay
    followCursor: true   // Whether to follow the cursor
};

// Initialize elements
video = document.getElementById('backgroundVideo');
canvas = document.getElementById('trailCanvas');
ctx = canvas.getContext('2d');
const videoWrapper = document.getElementById('videoWrapper');

// File inputs
const videoInput = document.getElementById('videoInput');
const cursorInput = document.getElementById('cursorInput');
const videoContainer = document.getElementById('videoContainer');
const cursorContainer = document.getElementById('cursorContainer');
const canvasContainer = document.getElementById('canvasContainer');

// Status elements
const videoStatus = document.getElementById('videoStatus');
const cursorStatus = document.getElementById('cursorStatus');
const videoError = document.getElementById('videoError');
const cursorError = document.getElementById('cursorError');
const videoLoading = document.getElementById('videoLoading');
const cursorLoading = document.getElementById('cursorLoading');
const statusText = document.getElementById('statusText');
const debugInfo = document.getElementById('debugInfo');

// Controls
const playPauseButton = document.getElementById('playPauseButton');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const playPauseText = document.getElementById('playPauseText');
const resetButton = document.getElementById('resetButton');
const timeDisplay = document.getElementById('timeDisplay');
const syncControls = document.getElementById('syncControls');
const cameraControls = document.getElementById('cameraControls');

const opacitySlider = document.getElementById('opacitySlider');
const sizeSlider = document.getElementById('sizeSlider');
const trailSlider = document.getElementById('trailSlider');
const fadeTimeSlider = document.getElementById('fadeTimeSlider');
const fadeTimeValue = document.getElementById('fadeTimeValue');
const hideCursorCheck = document.getElementById('hideCursorCheck');
const speedSlider = document.getElementById('speedSlider');
const offsetSlider = document.getElementById('offsetSlider');
const offsetValue = document.getElementById('offsetValue');

// Camera controls
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const marginSlider = document.getElementById('marginSlider');
const marginValue = document.getElementById('marginValue');
const smoothingSlider = document.getElementById('smoothingSlider');
const smoothingValue = document.getElementById('smoothingValue');
const followCursorCheck = document.getElementById('followCursorCheck');
const resetCameraButton = document.getElementById('resetCameraButton');
const debugButton = document.getElementById('debugButton');

// New controls
const seekSlider = document.getElementById('seekSlider');
const zoom0_5xButton = document.getElementById('zoom0_5x');
const zoom1xButton = document.getElementById('zoom1x');
const zoom1_5xButton = document.getElementById('zoom1_5x');
const zoom2xButton = document.getElementById('zoom2x');

// Event listeners
videoInput.addEventListener('change', handleVideoSelect);
cursorInput.addEventListener('change', handleCursorSelect);

playPauseButton.addEventListener('click', togglePlayPause);
resetButton.addEventListener('click', resetPlayback);

speedSlider.addEventListener('input', updatePlaybackSpeed);
// Initialize speed display
updatePlaybackSpeed();
offsetSlider.addEventListener('input', updateTimeOffset);
fadeTimeSlider.addEventListener('input', updateFadeTime);
hideCursorCheck.addEventListener('change', updateHideCursor);

// Camera control listeners
zoomSlider.addEventListener('input', updateZoom);
marginSlider.addEventListener('input', updateMargin);
smoothingSlider.addEventListener('input', updateSmoothing);
followCursorCheck.addEventListener('change', updateFollowCursor);
resetCameraButton.addEventListener('click', resetCamera);
debugButton.addEventListener('click', toggleDebug);

// New control listeners
seekSlider.addEventListener('input', handleSeek);
zoom0_5xButton.addEventListener('click', () => setZoomPreset(0.8));
zoom1xButton.addEventListener('click', () => setZoomPreset(1));
zoom1_5xButton.addEventListener('click', () => setZoomPreset(1.5));
zoom2xButton.addEventListener('click', () => setZoomPreset(2));

video.addEventListener('loadedmetadata', onVideoLoaded);
video.addEventListener('ended', onVideoEnded);

// Initialize default zoom preset and load default files
document.addEventListener('DOMContentLoaded', () => {
    setZoomPreset(0.8);
    loadDefaultFiles();
});

// Load default files
function loadDefaultFiles() {
    // Show loading state for default video
    showVideoLoading(true);
    
    // Load default video
    fetch('./windowcrop-EglPX.mov')
        .then(response => response.blob())
        .then(blob => {
            const file = new File([blob], 'windowcrop-EglPX.mov', { type: 'video/quicktime' });
            handleVideoFile(file);
        })
        .catch(error => {
            showVideoLoading(false);
            console.log('Default video not found, user will need to load manually');
        });
    
    // Show loading state for default cursor data
    showCursorLoading(true);
    
    // Load default cursor data
    fetch('./windowcrop-EglPX.input-events.json')
        .then(response => response.text())
        .then(text => {
            const file = new File([text], 'windowcrop-EglPX.input-events.json', { type: 'application/json' });
            handleCursorFile(file);
        })
        .catch(error => {
            showCursorLoading(false);
            console.log('Default cursor data not found, user will need to load manually');
        });
}

// Drag and drop for video
setupDragDrop(videoContainer, handleVideoFile, 'video/*');
setupDragDrop(cursorContainer, handleCursorFile, '.json,.txt');

function setupDragDrop(container, handler, accept) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.classList.add('dragover');
    });
    
    container.addEventListener('dragleave', () => {
        container.classList.remove('dragover');
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handler(files[0]);
        }
    });
}

function handleVideoSelect(event) {
    const file = event.target.files[0];
    if (file) handleVideoFile(file);
}

function handleCursorSelect(event) {
    const file = event.target.files[0];
    if (file) handleCursorFile(file);
}

function handleVideoFile(file) {
    showVideoError('');
    showVideoLoading(true);
    
    if (!file.type.startsWith('video/')) {
        showVideoLoading(false);
        showVideoError('Please select a valid video file');
        return;
    }
    
    const url = URL.createObjectURL(file);
    video.src = url;
    videoStatus.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
}

function onVideoLoaded() {
    showVideoLoading(false);
    videoLoaded = true;
    videoContainer.classList.add('loaded');
    
    // Resize canvas to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    checkReadyState();
}

function handleCursorFile(file) {
    showCursorError('');
    showCursorLoading(true);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            let data;
            
            try {
                data = JSON.parse(content);
            } catch (jsonError) {
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No valid JSON array found in file');
                }
            }
            
            if (!Array.isArray(data)) {
                throw new Error('Data must be an array of cursor events');
            }
            
            const processedEvents = processData(data);
            if (processedEvents.length === 0) {
                throw new Error('No valid cursor events found in data');
            }
            
            cursorEvents = processedEvents;
            cursorLoaded = true;
            cursorContainer.classList.add('loaded');
            showCursorLoading(false);
            currentCursorIndex = 0;
            
            cursorStatus.textContent = `${processedEvents.length} events loaded`;
            checkReadyState();
            
        } catch (error) {
            showCursorLoading(false);
            showCursorError('Error parsing file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

function processData(data) {
    const processed = [];
    
    for (let event of data) {
        if (!event || event.type !== 'mouse' || 
            typeof event.x !== 'number' || typeof event.y !== 'number') {
            continue;
        }
        
        let timeStamp = 0;
        if (event.time && typeof event.time.seconds === 'number') {
            timeStamp = event.time.seconds;
        } else if (typeof event.time === 'number') {
            timeStamp = event.time;
        }
        
        processed.push({
            x: event.x,
            y: event.y,
            time: timeStamp,
            eventType: event.mouseEventType || 'moved',
            isClick: event.mouseEventType === 'down'
        });
    }
    
    processed.sort((a, b) => a.time - b.time);
    return processed;
}

function checkReadyState() {
    if (videoLoaded && cursorLoaded) {
        canvasContainer.style.display = 'block';
        syncControls.style.display = 'block';
        cameraControls.style.display = 'block';
        
        playPauseButton.disabled = false;
        resetButton.disabled = false;
        seekSlider.disabled = false;
        
        const videoDuration = video.duration;
        const cursorDuration = cursorEvents.length > 0 ? 
            cursorEvents[cursorEvents.length - 1].time - cursorEvents[0].time : 0;
        
        statusText.innerHTML = `
            Ready to play | Video: ${videoDuration.toFixed(1)}s | 
            Cursor: ${cursorDuration.toFixed(1)}s | Events: ${cursorEvents.length}
        `;
        
        resetPlayback();
        resetCamera();
    }
}

function togglePlayPause() {
    if (!videoLoaded || !cursorLoaded) return;
    
    if (isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (!videoLoaded || !cursorLoaded) return;
    
    isPlaying = true;
    video.play();
    startTime = performance.now();
    updatePlayPauseButton();
    animate();
}

function pausePlayback() {
    isPlaying = false;
    video.pause();
    updatePlayPauseButton();
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

function updatePlayPauseButton() {
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        playPauseText.textContent = 'Pause';
        playPauseButton.classList.remove('bg-green-600', 'hover:bg-green-700');
        playPauseButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        playPauseText.textContent = 'Play';
        playPauseButton.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
        playPauseButton.classList.add('bg-green-600', 'hover:bg-green-700');
    }
}

function resetPlayback() {
    pausePlayback();
    video.currentTime = 0;
    currentCursorIndex = 0;
    clearCanvas();
    updateTimeDisplay();
    updateSeekSlider();
    updatePlayPauseButton();
}

function animate() {
    if (!isPlaying) return;
    
    const currentVideoTime = video.currentTime;
    updateCamera(currentVideoTime);
    applyVideoTransform();
    drawCursorAtTime(currentVideoTime);
    updateTimeDisplay();
    updateSeekSlider();
    updateDebugInfo();
    
    animationId = requestAnimationFrame(animate);
}

function drawCursorAtTime(videoTime) {
    clearCanvas();
    
    if (cursorEvents.length === 0) return;
    
    const targetTime = videoTime + timeOffset;
    
    updateCursorIndex(targetTime);
    
    const trailLength = parseInt(trailSlider.value);
    const trailStart = Math.max(0, currentCursorIndex - trailLength + 1);
    const trailEvents = cursorEvents.slice(trailStart, currentCursorIndex + 1);
    
    if (trailEvents.length === 0) return;
    
    const opacity = parseFloat(opacitySlider.value);
    const size = parseInt(sizeSlider.value);
    
    // Draw safe zone boundaries for debugging (if debug is on)
    if (showDebug && camera.zoom > 1) {
        drawSafeZone();
    }
    
    // Calculate time-based fade factor
    const currentEvent = trailEvents[trailEvents.length - 1];
    const timeSinceLastEvent = targetTime - currentEvent.time;
    const timeFadeFactor = Math.max(0, 1 - (timeSinceLastEvent / (trailFadeTimeout / 1000)));
    
    // Draw trail with smooth fade effect
    if (trailEvents.length > 1 && timeFadeFactor > 0) {
        // Draw multiple trail segments with decreasing opacity
        for (let i = 1; i < trailEvents.length; i++) {
            const progress = i / trailEvents.length;
            // Exponential fade-out for smoother disappearance
            const segmentAlpha = Math.pow(progress, 2) * opacity * 0.5 * timeFadeFactor;
            
            if (segmentAlpha > 0.01) { // Skip drawing if too faint
                ctx.strokeStyle = `rgba(0, 136, 255, ${segmentAlpha})`;
                ctx.lineWidth = 2 * progress * timeFadeFactor; // Trail gets thinner as it fades
                ctx.beginPath();
                
                const prevEvent = trailEvents[i - 1];
                const currEvent = trailEvents[i];
                
                ctx.moveTo(prevEvent.x * canvas.width, prevEvent.y * canvas.height);
                ctx.lineTo(currEvent.x * canvas.width, currEvent.y * canvas.height);
                ctx.stroke();
            }
        }
    }
    
    // Draw trail points with smooth fading effect
    if (timeFadeFactor > 0) {
        for (let i = 0; i < trailEvents.length - 1; i++) {
            const event = trailEvents[i];
            const progress = i / trailEvents.length;
            // Use exponential function for smooth fade-out
            const alpha = Math.pow(progress, 3) * opacity * 0.6 * timeFadeFactor;
            
            if (alpha > 0.01) { // Skip drawing if too faint
                const pointSize = size * 0.7 * progress * timeFadeFactor; // Points shrink as they fade
                drawCursorPoint(event.x, event.y, event.isClick, alpha, pointSize);
            }
        }
    }
    
    // Draw current cursor position with smooth fade in/out
    let cursorOpacity = opacity;
    if (hideCursorWhenStill) {
        if (timeSinceLastEvent > 1) {
            // Fade out over 0.3 seconds after being still for 1 second
            const fadeOutStart = 1;
            const fadeOutDuration = 0.3;
            const fadeOutProgress = Math.min(1, (timeSinceLastEvent - fadeOutStart) / fadeOutDuration);
            cursorOpacity = opacity * (1 - fadeOutProgress);
        } else if (timeSinceLastEvent < 0.3) {
            // Fade in over 0.3 seconds when cursor starts moving
            const fadeInProgress = Math.min(1, timeSinceLastEvent / 0.3);
            cursorOpacity = opacity * fadeInProgress;
        }
    }
    
    // Only draw if cursor has some opacity
    if (cursorOpacity > 0.01) {
        drawCursorPoint(currentEvent.x, currentEvent.y, currentEvent.isClick, cursorOpacity, size, true);
    }
}

function drawSafeZone() {
    const zoom = camera.zoom;
    const margin = cameraSettings.margin;

    // Calculate viewport dimensions in canvas pixels
    const viewPortWidth = canvas.width / zoom;
    const viewPortHeight = canvas.height / zoom;
    
    // Calculate viewport position based on camera position
    // camera.x and camera.y are in normalized coordinates (0-1)
    // We need to convert to canvas pixel coordinates
    const viewPortX = camera.x * canvas.width - viewPortWidth / 2;
    const viewPortY = camera.y * canvas.height - viewPortHeight / 2;
    
    // The viewport in screen space is always the full canvas when zoomed
    // Calculate safe zone in screen coordinates (pixels)
    const marginPixelsX = viewPortWidth * margin;
    const marginPixelsY = viewPortHeight * margin;
    
    // Safe zone boundaries in screen coordinates
    const safeLeft = viewPortX + (marginPixelsX/2);
    const safeTop = viewPortY + (marginPixelsY/2);
    
    // Draw safe zone rectangle (yellow)
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(safeLeft, safeTop, viewPortWidth - marginPixelsX, viewPortHeight - marginPixelsY);
    ctx.setLineDash([]);
    
    // Draw viewport bounds (red) - this is just the full canvas area
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 10;
    ctx.setLineDash([15, 5]);
    ctx.strokeRect(
        viewPortX + ctx.lineWidth, 
        viewPortY + ctx.lineWidth, 
        viewPortWidth, 
        viewPortHeight
    );
    ctx.setLineDash([]);
}

function updateCursorIndex(targetTime) {
    while (currentCursorIndex < cursorEvents.length - 1 && 
           cursorEvents[currentCursorIndex + 1].time <= targetTime) {
        currentCursorIndex++;
    }
    
    while (currentCursorIndex > 0 && 
           cursorEvents[currentCursorIndex].time > targetTime) {
        currentCursorIndex--;
    }
}

function drawCursorPoint(x, y, isClick, alpha, size, isMainCursor = false) {
    const canvasX = x * canvas.width;
    const canvasY = y * canvas.height;
    
    ctx.globalAlpha = alpha;
    
    // Add glow effect for main cursor
    if (isMainCursor) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = isClick ? 'rgba(255, 68, 68, 0.8)' : 'rgba(0, 136, 255, 0.8)';
    }
    
    if (isClick) {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, size * 1.5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, size * 2, 0, 2 * Math.PI);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, size, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, size, 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    // Reset shadow
    if (isMainCursor) {
        ctx.shadowBlur = 0;
    }
    
    ctx.globalAlpha = 1;
}

// FIXED: New camera system that guarantees cursor visibility
function updateCamera(videoTime) {
    if (!cameraSettings.followCursor || cursorEvents.length === 0) return;
    
    const adjustedTime = videoTime + timeOffset;
    const targetTime = adjustedTime;
    
    if (currentCursorIndex >= 0 && currentCursorIndex < cursorEvents.length) {
        const currentEvent = cursorEvents[currentCursorIndex];
        updateCameraTarget(currentEvent.x, currentEvent.y);
    }
    
    smoothCamera();
}

function updateCameraTarget(cursorX, cursorY) {
    const zoom = camera.targetZoom; // Use target zoom, not current zoom
    const margin = cameraSettings.margin;
    
    if (zoom <= 1) {
        // When zoomed out or at 1x, keep camera centered
        camera.targetX = 0.5;
        camera.targetY = 0.5;
        return;
    }
    
    // Calculate viewport dimensions in canvas pixels (same logic as drawSafeZone)
    const viewPortWidth = canvas.width / zoom;
    const viewPortHeight = canvas.height / zoom;
    
    // Calculate viewport position based on camera position
    // camera.x and camera.y are in normalized coordinates (0-1)
    // We need to convert to canvas pixel coordinates
    const viewPortX = camera.x * canvas.width - viewPortWidth / 2;
    const viewPortY = camera.y * canvas.height - viewPortHeight / 2;
    
    // Calculate safe zone in screen coordinates (pixels)
    const marginPixelsX = viewPortWidth * margin;
    const marginPixelsY = viewPortHeight * margin;
    
    // Safe zone boundaries in canvas pixel coordinates
    const safeLeft = viewPortX + (marginPixelsX/2);
    const safeTop = viewPortY + (marginPixelsY/2);
    const safeRight = viewPortX + viewPortWidth - (marginPixelsX/2);
    const safeBottom = viewPortY + viewPortHeight - (marginPixelsY/2);
    
    // Convert cursor position to canvas pixel coordinates
    const cursorPixelX = cursorX * canvas.width;
    const cursorPixelY = cursorY * canvas.height;
    
    // Calculate new camera target to keep cursor in safe zone
    let newTargetX = camera.targetX;
    let newTargetY = camera.targetY;
    
    // Horizontal adjustment
    if (cursorPixelX < safeLeft) {
        // Cursor is too far left, move camera left to bring it into safe zone
        const offset = safeLeft - cursorPixelX;
        newTargetX = camera.x - (offset / canvas.width);
    } else if (cursorPixelX > safeRight) {
        // Cursor is too far right, move camera right to bring it into safe zone
        const offset = cursorPixelX - safeRight;
        newTargetX = camera.x + (offset / canvas.width);
    }
    
    // Vertical adjustment
    if (cursorPixelY < safeTop) {
        // Cursor is too far up, move camera up to bring it into safe zone
        const offset = safeTop - cursorPixelY;
        newTargetY = camera.y - (offset / canvas.height);
    } else if (cursorPixelY > safeBottom) {
        // Cursor is too far down, move camera down to bring it into safe zone
        const offset = cursorPixelY - safeBottom;
        newTargetY = camera.y + (offset / canvas.height);
    }
    
    // Update camera target without clamping to ensure cursor stays in safe zone
    camera.targetX = newTargetX;
    camera.targetY = newTargetY;
}

function smoothCamera() {
    const smoothing = camera.smoothing;
    
    camera.x += (camera.targetX - camera.x) * smoothing;
    camera.y += (camera.targetY - camera.y) * smoothing;
    camera.zoom += (camera.targetZoom - camera.zoom) * smoothing;
}

function applyVideoTransform() {
    const zoom = camera.zoom;
    
    if (zoom <= 1) {
        videoWrapper.style.transformOrigin = 'center center';
        videoWrapper.style.transform = `scale(${zoom})`;
        return;
    }
    
    // Get container dimensions
    const containerWidth = videoWrapper.offsetWidth;
    const containerHeight = videoWrapper.offsetHeight;
    
    // Calculate where we want the transform origin to be
    // This is NOT the camera position, but rather the point that should
    // stay fixed when zooming (and end up at the center of the viewport)
    
    // The point we want to zoom into (camera position in container pixels)
    const targetX = camera.x * containerWidth;
    const targetY = camera.y * containerHeight;
    
    // When we scale from a transform-origin, that point stays fixed
    // We want that point to end up at the center of the container
    // So we need to calculate what point, when scaled, will put our target at center
    
    // The formula: origin + (target - origin) * zoom = center
    // Solving for origin: origin = (center - target * zoom) / (1 - zoom)
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    let originX, originY;
    
    if (zoom !== 1) {
        originX = (centerX - targetX * zoom) / (1 - zoom);
        originY = (centerY - targetY * zoom) / (1 - zoom);
    } else {
        originX = targetX;
        originY = targetY;
    }
    
    // Set transform origin and apply scale only
    videoWrapper.style.transformOrigin = `${originX}px ${originY}px`;
    videoWrapper.style.transform = `scale(${zoom})`;
    
    // Debug logging removed for cleaner output
}

function resetCamera() {
    camera.x = 0.5;
    camera.y = 0.5;
    camera.zoom = 0.8;
    camera.targetX = 0.5;
    camera.targetY = 0.5;
    camera.targetZoom = 0.8;
    zoomSlider.value = 0.8;
    updateZoomValue();
    setZoomPreset(0.8); // This will update the button states
    applyVideoTransform();
}

// Control handlers
function updateZoom() {
    const zoom = parseFloat(zoomSlider.value);
    camera.targetZoom = zoom;
    
    // If not following cursor, also update current zoom for immediate effect
    if (!cameraSettings.followCursor) {
        camera.zoom = zoom;
    }
    
    updateZoomValue();
}

function updateZoomValue() {
    zoomValue.textContent = `${parseFloat(zoomSlider.value).toFixed(1)}x`;
}

function updateMargin() {
    cameraSettings.margin = parseFloat(marginSlider.value);
    marginValue.textContent = `${Math.round(cameraSettings.margin * 100)}%`;
}

function updateSmoothing() {
    camera.smoothing = parseFloat(smoothingSlider.value);
    smoothingValue.textContent = camera.smoothing.toFixed(2);
}

function updateFollowCursor() {
    cameraSettings.followCursor = followCursorCheck.checked;
}

function toggleDebug() {
    showDebug = !showDebug;
    debugInfo.style.display = showDebug ? 'block' : 'none';
}

function updateDebugInfo() {
    if (!showDebug || cursorEvents.length === 0 || currentCursorIndex >= cursorEvents.length) return;
    
    const currentEvent = cursorEvents[currentCursorIndex];
    const zoom = camera.zoom;
    const viewportWidth = 1 / zoom;
    const viewportHeight = 1 / zoom;
    const margin = cameraSettings.margin;
    
    // Current viewport bounds (what we can actually see)
    const viewLeft = camera.x - viewportWidth / 2;
    const viewRight = camera.x + viewportWidth / 2;
    const viewTop = camera.y - viewportHeight / 2;
    const viewBottom = camera.y + viewportHeight / 2;
    
    // Safe zone bounds (margin area inside viewport)
    const marginWidth = viewportWidth * margin;
    const marginHeight = viewportHeight * margin;
    const safeLeft = viewLeft + marginWidth;
    const safeRight = viewRight - marginWidth;
    const safeTop = viewTop + marginHeight;
    const safeBottom = viewBottom - marginHeight;
    
    // Check if cursor is actually visible in viewport
    const inViewport = currentEvent.x >= viewLeft && currentEvent.x <= viewRight &&
                      currentEvent.y >= viewTop && currentEvent.y <= viewBottom;
    
    // Check if cursor is in safe zone
    const inSafeZone = currentEvent.x >= safeLeft && currentEvent.x <= safeRight &&
                      currentEvent.y >= safeTop && currentEvent.y <= safeBottom;
    
    debugInfo.innerHTML = `
        <strong>Debug Info:</strong><br>
        Cursor: (${currentEvent.x.toFixed(3)}, ${currentEvent.y.toFixed(3)})<br>
        Camera: (${camera.x.toFixed(3)}, ${camera.y.toFixed(3)}) Zoom: ${camera.zoom.toFixed(2)}x<br>
        Target: (${camera.targetX.toFixed(3)}, ${camera.targetY.toFixed(3)}) Target Zoom: ${camera.targetZoom.toFixed(2)}x<br>
        Viewport: ${viewportWidth.toFixed(3)} × ${viewportHeight.toFixed(3)}<br>
        View Bounds: [${viewLeft.toFixed(3)}, ${viewTop.toFixed(3)}] to [${viewRight.toFixed(3)}, ${viewBottom.toFixed(3)}]<br>
        Safe Zone: [${safeLeft.toFixed(3)}, ${safeTop.toFixed(3)}] to [${safeRight.toFixed(3)}, ${safeBottom.toFixed(3)}]<br>
        Cursor in Viewport: <span style="color: ${inViewport ? '#4CAF50' : '#ff6666'}">${inViewport ? 'YES' : 'NO'}</span><br>
        Cursor in Safe Zone: <span style="color: ${inSafeZone ? '#4CAF50' : '#ff6666'}">${inSafeZone ? 'YES' : 'NO'}</span><br>
        Follow Cursor: ${cameraSettings.followCursor ? 'ON' : 'OFF'}
    `;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateTimeDisplay() {
    const current = video.currentTime;
    const duration = video.duration || 0;
    
    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function updateSeekSlider() {
    if (!video || !video.duration) return;
    const progress = (video.currentTime / video.duration) * 100;
    seekSlider.value = progress;
}

function handleSeek() {
    if (!video || !video.duration) return;
    const newTime = (seekSlider.value / 100) * video.duration;
    video.currentTime = newTime;
    currentCursorIndex = 0;
    // Force update cursor index for new time
    const targetTime = newTime + timeOffset;
    updateCursorIndex(targetTime);
    if (!isPlaying) {
        drawCursorAtTime(newTime);
    }
}

function setZoomPreset(zoomLevel) {
    zoomSlider.value = zoomLevel;
    updateZoom();
    
    // Update button states
    const buttons = [zoom0_5xButton, zoom1xButton, zoom1_5xButton, zoom2xButton];
    buttons.forEach(btn => btn.classList.remove('bg-green-600', 'hover:bg-green-700'));
    buttons.forEach(btn => btn.classList.add('bg-blue-600', 'hover:bg-blue-700'));
    
    // Highlight active button
    if (zoomLevel === 0.8) {
        zoom0_5xButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        zoom0_5xButton.classList.add('bg-green-600', 'hover:bg-green-700');
    } else if (zoomLevel === 1) {
        zoom1xButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        zoom1xButton.classList.add('bg-green-600', 'hover:bg-green-700');
    } else if (zoomLevel === 1.5) {
        zoom1_5xButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        zoom1_5xButton.classList.add('bg-green-600', 'hover:bg-green-700');
    } else if (zoomLevel === 2) {
        zoom2xButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        zoom2xButton.classList.add('bg-green-600', 'hover:bg-green-700');
    }
}

function updatePlaybackSpeed() {
    const speed = parseFloat(speedSlider.value);
    video.playbackRate = speed;
    // Update speed display
    const speedDisplay = speedSlider.nextElementSibling;
    speedDisplay.textContent = `${speed}x`;
}

function updateTimeOffset() {
    timeOffset = parseFloat(offsetSlider.value);
    offsetValue.textContent = `${timeOffset.toFixed(1)}s`;
}

function updateFadeTime() {
    trailFadeTimeout = parseFloat(fadeTimeSlider.value) * 1000; // Convert to milliseconds
    fadeTimeValue.textContent = `${parseFloat(fadeTimeSlider.value).toFixed(1)}s`;
}

function updateHideCursor() {
    hideCursorWhenStill = hideCursorCheck.checked;
}

function onVideoEnded() {
    pausePlayback();
    updatePlayPauseButton();
}

function showVideoError(message) {
    videoError.textContent = message;
    videoError.style.display = message ? 'block' : 'none';
}

function showCursorError(message) {
    cursorError.textContent = message;
    cursorError.style.display = message ? 'block' : 'none';
}

function showVideoLoading(show) {
    videoLoading.style.display = show ? 'block' : 'none';
}

function showCursorLoading(show) {
    cursorLoading.style.display = show ? 'block' : 'none';
}