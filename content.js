// POE Color Fixer - SVG Filter Daltonization Approach
// This applies a color correction matrix to the canvas element via CSS filters.

let currentSettings = null;

// Create SVG filter element for color correction
function createSVGFilter() {
    // Check if already exists
    if (document.getElementById('poe-color-fixer-svg')) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("id", "poe-color-fixer-svg");
    svg.setAttribute("style", "position: absolute; width: 0; height: 0; overflow: hidden;");
    svg.innerHTML = `
        <defs>
            <!-- 선택적 빨강→파랑 변환 (노랑 보존 시도) -->
            <!-- 빨강 채널만 파랑으로 이동, 초록/노랑은 최대한 유지 -->
            <filter id="selective-red-to-blue" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0.2   0.0   0.0   0  0
                    0.0   1.0   0.0   0  0
                    0.8   0.0   1.0   0  0
                    0.0   0.0   0.0   1  0
                "/>
            </filter>

            <!-- 선택적 초록→오렌지 변환 (빨강/노랑 보존 시도) -->
            <filter id="selective-green-to-orange" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    1.0   0.5   0.0   0  0
                    0.0   0.5   0.0   0  0
                    0.0   0.0   1.0   0  0
                    0.0   0.0   0.0   1  0
                "/>
            </filter>

            <!-- 빨강↔파랑 + 초록→노랑 (균형잡힌 변환) -->
            <filter id="balanced-rg-shift" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0.3   0.3   0.0   0  0
                    0.0   0.7   0.0   0  0.1
                    0.7   0.0   1.0   0  0
                    0.0   0.0   0.0   1  0
                "/>
            </filter>

            <!-- POE Specific: 빨강→시안, 초록→마젠타 (고대비) -->
            <filter id="poe-high-contrast" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0.0   0.0   0.0   0  0
                    0.5   0.5   0.5   0  0
                    0.5   0.5   0.5   0  0
                    0.0   0.0   0.0   1  0
                "/>
                <!-- 후처리: 채도 증가 -->
                <feColorMatrix type="saturate" values="1.5"/>
            </filter>

            <!-- Daltonization for Deuteranopia (적녹색약) - 기존 -->
            <filter id="daltonize-deuteranopia" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0.625  0.375  0      0  0
                    0.7    0.3    0      0  0
                    0      0.3    0.7    0  0
                    0      0      0      1  0
                "/>
            </filter>

            <!-- Daltonization for Protanopia - 기존 -->
            <filter id="daltonize-protanopia" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0.567  0.433  0      0  0
                    0.558  0.442  0      0  0
                    0      0.242  0.758  0  0
                    0      0      0      1  0
                "/>
            </filter>

            <!-- Simple Red-Blue Swap - 기존 -->
            <filter id="swap-red-blue" color-interpolation-filters="sRGB">
                <feColorMatrix type="matrix" values="
                    0  0  1  0  0
                    0  1  0  0  0
                    1  0  0  0  0
                    0  0  0  1  0
                "/>
            </filter>
        </defs>
    `;
    document.body.appendChild(svg);
    console.log("[POE Color Fixer] SVG Filters injected");
}

// Apply filter to canvas
function applyFilterToCanvas(filterMode) {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.log("[POE Color Fixer] No canvas found yet");
        return;
    }

    if (!currentSettings?.enabled) {
        canvas.style.filter = "none";
        return;
    }

    let filterUrl = "";
    switch (filterMode) {
        case "selective-red":
            filterUrl = "url(#selective-red-to-blue)";
            break;
        case "selective-green":
            filterUrl = "url(#selective-green-to-orange)";
            break;
        case "balanced":
            filterUrl = "url(#balanced-rg-shift)";
            break;
        case "poe-contrast":
            filterUrl = "url(#poe-high-contrast)";
            break;
        case "deuteranopia":
            filterUrl = "url(#daltonize-deuteranopia)";
            break;
        case "protanopia":
            filterUrl = "url(#daltonize-protanopia)";
            break;
        case "swap-rb":
            filterUrl = "url(#swap-red-blue)";
            break;
        case "hue-rotate":
            const hue = currentSettings.hueRotate || 0;
            filterUrl = `hue-rotate(${hue}deg)`;
            break;
        case "invert":
            filterUrl = "invert(1)";
            break;
        default:
            filterUrl = "none";
    }

    // Combine with additional CSS filters if needed
    let combinedFilter = filterUrl;
    if (currentSettings.invert && filterMode !== "invert") {
        combinedFilter += " invert(1)";
    }
    if (currentSettings.hueRotate > 0 && filterMode !== "hue-rotate") {
        combinedFilter += ` hue-rotate(${currentSettings.hueRotate}deg)`;
    }

    canvas.style.filter = combinedFilter;
    console.log("[POE Color Fixer] Applied filter:", combinedFilter);
}

// Initialize
chrome.storage.local.get(['enabled', 'filterMode', 'hueRotate', 'invert'], (result) => {
    currentSettings = {
        enabled: result.enabled !== undefined ? result.enabled : true,
        filterMode: result.filterMode || 'hue-rotate', // Default to hue rotation
        hueRotate: result.hueRotate !== undefined ? result.hueRotate : 188, // Optimized for colorblind
        invert: result.invert || false
    };

    createSVGFilter();
    applyFilterToCanvas(currentSettings.filterMode);
});

// Listen for popup updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "UPDATE_SETTINGS") {
        currentSettings = message.payload;
        applyFilterToCanvas(currentSettings.filterMode);
    }
});

// Observe for Canvas creation (handles lazy loading)
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.tagName === 'CANVAS') {
                createSVGFilter();
                applyFilterToCanvas(currentSettings?.filterMode || 'deuteranopia');
            } else if (node.querySelectorAll) {
                const canvases = node.querySelectorAll('canvas');
                if (canvases.length > 0) {
                    createSVGFilter();
                    applyFilterToCanvas(currentSettings?.filterMode || 'deuteranopia');
                }
            }
        }
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});
