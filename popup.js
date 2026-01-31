document.addEventListener('DOMContentLoaded', () => {
    const enabledToggle = document.getElementById('enabled-toggle');
    const filterModeSelect = document.getElementById('filter-mode');
    const hueSlider = document.getElementById('hue-slider');
    const hueInput = document.getElementById('hue-input');
    const hueMinus = document.getElementById('hue-minus');
    const huePlus = document.getElementById('hue-plus');
    const saveBtn = document.getElementById('save');
    const resetBtn = document.getElementById('reset');
    const toast = document.getElementById('toast');

    // Base colors (POE Ninja colors)
    const BASE_COLORS = {
        yellow: { r: 250, g: 204, b: 21 },  // #FACC15 - Main Tree
        red: { r: 248, g: 113, b: 113 },    // #F87171 - Weapon 1
        green: { r: 74, g: 222, b: 128 }    // #4ADE80 - Weapon 2
    };

    // Default settings (optimized for colorblind users)
    const defaults = {
        enabled: true,
        filterMode: 'hue-rotate',
        hueRotate: 188
    };

    // Color transformation matrices for each filter mode
    const FILTER_MATRICES = {
        'swap-rb': [
            [0, 0, 1], [0, 1, 0], [1, 0, 0]
        ]
    };

    // Apply color matrix to RGB
    function applyMatrix(color, matrix) {
        const r = Math.min(255, Math.max(0,
            color.r * matrix[0][0] + color.g * matrix[0][1] + color.b * matrix[0][2]));
        const g = Math.min(255, Math.max(0,
            color.r * matrix[1][0] + color.g * matrix[1][1] + color.b * matrix[1][2]));
        const b = Math.min(255, Math.max(0,
            color.r * matrix[2][0] + color.g * matrix[2][1] + color.b * matrix[2][2]));
        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }

    // Apply hue rotation
    function rotateHue(color, degrees) {
        let r = color.r / 255, g = color.g / 255, b = color.b / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        h = (h + degrees / 360) % 1;
        if (h < 0) h += 1;

        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function rgbToHex(color) {
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }

    // Update color previews
    function updateColorPreviews() {
        const filterMode = filterModeSelect.value;
        const hueRotateDeg = parseInt(hueSlider.value, 10);

        Object.keys(BASE_COLORS).forEach(colorName => {
            let transformed = { ...BASE_COLORS[colorName] };

            // Apply filter matrix
            if (FILTER_MATRICES[filterMode]) {
                transformed = applyMatrix(transformed, FILTER_MATRICES[filterMode]);
            }

            // Apply hue rotation
            if (hueRotateDeg > 0) {
                transformed = rotateHue(transformed, hueRotateDeg);
            }

            // Update preview box
            const previewElement = document.getElementById(`preview-${colorName}-after`);
            if (previewElement) {
                previewElement.style.background = rgbToHex(transformed);
            }
        });
    }

    // Sync all hue controls
    function syncHueControls(value) {
        value = Math.max(0, Math.min(360, parseInt(value, 10) || 0));
        hueSlider.value = value;
        hueInput.value = value;
    }

    // Show toast notification
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // Load settings
    chrome.storage.local.get(['enabled', 'filterMode', 'hueRotate'], (result) => {
        enabledToggle.checked = result.enabled !== undefined ? result.enabled : defaults.enabled;
        filterModeSelect.value = result.filterMode || defaults.filterMode;
        const hueValue = result.hueRotate !== undefined ? result.hueRotate : defaults.hueRotate;
        syncHueControls(hueValue);
        updateColorPreviews();
    });

    // Update preview on change (but don't save yet)
    function updatePreview() {
        updateColorPreviews();
    }

    enabledToggle.addEventListener('change', updatePreview);
    filterModeSelect.addEventListener('change', updatePreview);

    hueSlider.addEventListener('input', () => {
        syncHueControls(hueSlider.value);
        updatePreview();
    });

    hueInput.addEventListener('input', () => {
        syncHueControls(hueInput.value);
        updatePreview();
    });

    hueMinus.addEventListener('click', () => {
        syncHueControls(parseInt(hueSlider.value, 10) - 1);
        updatePreview();
    });

    huePlus.addEventListener('click', () => {
        syncHueControls(parseInt(hueSlider.value, 10) + 1);
        updatePreview();
    });

    // Save button - saves and notifies
    saveBtn.addEventListener('click', () => {
        const settings = {
            enabled: enabledToggle.checked,
            filterMode: filterModeSelect.value,
            hueRotate: parseInt(hueSlider.value, 10)
        };

        chrome.storage.local.set(settings, () => {
            showToast('✅ 설정이 저장되었습니다!');

            // Notify active tab (use try-catch to suppress any errors)
            try {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].url && tabs[0].url.includes("poe.ninja")) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: "UPDATE_SETTINGS",
                            payload: settings
                        }, () => {
                            // Suppress "Receiving end does not exist" error
                            if (chrome.runtime.lastError) {
                                // Ignore silently
                            }
                        });
                    }
                });
            } catch (e) {
                // Ignore
            }
        });
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        enabledToggle.checked = defaults.enabled;
        filterModeSelect.value = defaults.filterMode;
        syncHueControls(defaults.hueRotate);
        updatePreview();

        chrome.storage.local.set(defaults, () => {
            showToast('🔄 기본값으로 초기화되었습니다!');
        });
    });
});
