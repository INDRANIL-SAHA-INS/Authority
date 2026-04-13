# Node to extract ALL interactive and content-rich elements from the page
import asyncio
import logging
import json
from playwright.async_api import Page
from tools.browser import BrowserManager
from state import JobAgentState

logger = logging.getLogger(__name__)

# ─── JavaScript Extraction Script ─────────────────────────────────────────────
# This script runs INSIDE the browser to find elements that are truly interactive
# or semantically important, regardless of their HTML tag.
EXTRACTION_SCRIPT = r"""
() => {
    const results = [];
    const seen = new Set();

    // Helper to check if an element is visible and interactive
    const analyzeVisibility = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        const isHiddenByStyle = style.display === 'none' || style.visibility === 'hidden';
        const isZeroSize = rect.width === 0 || rect.height === 0;
        const isTransparent = style.opacity === '0';
        
        // EXCEPTION: Real inputs for files, checkboxes, and radios are often legally hidden by CSS
        // because developers build custom <div> or <label> wrappers over them for styling.
        const isHiddenButFunctional = el.tagName === 'INPUT' && ['file', 'checkbox', 'radio'].includes(el.type);
        
        if ((isHiddenByStyle || isZeroSize) && !isHiddenButFunctional) {
            return { visible: false }; // Completely skip
        }

        // Pointer event check
        const pointerEventsDisabled = style.pointerEvents === 'none';

        // Check if something else is physically covering the center of this element (layering)
        let isCovered = false;
        let coveredBy = null;
        if (!isZeroSize && !isHiddenByStyle && !isTransparent && style.pointerEvents !== 'none') {
            const centerX = rect.x + rect.width / 2;
            const centerY = rect.y + rect.height / 2;
            
            // Only evaluate if center is visible within the viewport
            if (centerX >= 0 && centerX <= window.innerWidth && centerY >= 0 && centerY <= window.innerHeight) {
                const topElement = document.elementFromPoint(centerX, centerY);
                // If the top element is NOT this element AND not a child/parent
                if (topElement && topElement !== el && !el.contains(topElement) && !topElement.contains(el)) {
                    isCovered = true;
                    // Provide a hint of what is covering it
                    coveredBy = topElement.tagName.toLowerCase();
                    if (topElement.className && typeof topElement.className === 'string') {
                       coveredBy += '.' + topElement.className.split(' ').join('.');
                    }
                }
            }
        }

        return { 
            visible: true, 
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            isTransparent,
            pointerEventsDisabled,
            isCovered,
            coveredBy
        };
    };

    // Helper to find the most robust selector possible
    const getSelector = (el) => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        if (el.getAttribute('name')) return `[name="${CSS.escape(el.getAttribute('name'))}"]`;
        if (el.tagName === 'INPUT' && el.type) {
             if (el.type === 'radio' || el.type === 'checkbox') {
                 const val = el.value ? `="${CSS.escape(el.value)}"` : '';
                 return `input[type="${el.type}"][value${val}]`;
             }
        }
        
        // Fallback to Tag + Classes
        let path = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(/\s+/).filter(c => c).map(c => `.${CSS.escape(c)}`).join('');
            if (classes.length < 50) path += classes; // limit class length for readability
        }
        return path;
    };

    // Helper to find associated label text securely
    const findLabel = (el) => {
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label) return label.innerText.trim();
        }
        
        const parentLabel = el.closest('label');
        if (parentLabel) {
            // Remove the element's own text if it's inside the label to prevent outputting "Option 1 Option 1"
            let text = parentLabel.innerText.trim();
            if (el.innerText) text = text.replace(el.innerText, '').trim();
            return text;
        }
        
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            // handle multiple space-separated IDs
            const ids = ariaLabelledBy.split(' ');
            const texts = ids.map(id => {
                const labelEl = document.getElementById(id);
                return labelEl ? labelEl.innerText.trim() : '';
            }).filter(t => t);
            if (texts.length) return texts.join(' ');
        }

        if (el.placeholder) return el.placeholder;
        if (el.title) return el.title;

        // Custom Div Comboboxes usually have the active or label text directly inside or preceding
        let prev = el.previousElementSibling;
        if (prev && prev.innerText && prev.innerText.trim().length < 100) {
            return prev.innerText.trim();
        }

        return '';
    };

    // Include more generic interactive elements (like custom checkboxes/radios mapped to divs or spans)
    const elements = document.querySelectorAll('input, select, textarea, button, a, [role], [contenteditable="true"], [tabindex], label');
    
    elements.forEach(el => {
        const vis = analyzeVisibility(el);
        if (!vis.visible) return;
        
        const tagName = el.tagName;
        const role = el.getAttribute('role');
        const type = el.getAttribute('type');
        const selector = getSelector(el);

        // Skip label elements if they are just wrappers pointing to an ID we already grabbed,
        // UNLESS the input they point to is actually hidden/0-size! 
        if (tagName === 'LABEL' && el.getAttribute('for')) {
             // We still add them, but the LLM will decide. (Labels often act as the click target)
        }

        if (seen.has(el)) return;
        seen.add(el);

        const data = {
            tagName: tagName,
            type: type || (role ? `role:${role}` : 'unknown'),
            selector: selector,
            id: el.id || '',
            name: el.getAttribute('name') || '',
            label: findLabel(el),
            text: el.innerText ? el.innerText.trim().substring(0, 200) : '',
            value: el.value || '',
            placeholder: el.getAttribute('placeholder') || '',
            isRequired: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
            ariaLabel: el.getAttribute('aria-label') || '',
            interactivity: {
                is_transparent: vis.isTransparent,
                pointer_events_disabled: vis.pointerEventsDisabled,
                is_covered: vis.isCovered,
                covered_by: vis.coveredBy
            },
            attributes: {}
        };

        ['data-value', 'aria-expanded', 'aria-haspopup', 'aria-controls', 'aria-checked', 'aria-selected'].forEach(attr => {
            if (el.hasAttribute(attr)) data.attributes[attr] = el.getAttribute(attr);
        });

        results.push(data);
    });

    return results;
}
"""

async def _extract_all(url: str) -> list[dict]:
    print(f"      [Step] Starting Deep Extraction for: {url}")
    async with BrowserManager(headless=False) as bm:
        page = await bm.new_page()
        try:
            print(f"      [Step] Navigating...")
            await bm.goto(page, url, wait_until="networkidle")
            
            # Additional scroll to reveal lazy content
            await bm.scroll_down(page, steps=2)
            await asyncio.sleep(1) # Wait for animations
            
            print("      [Step] Injecting JS extraction script...")
            results = await page.evaluate(EXTRACTION_SCRIPT)
            return results
            
        except Exception as e:
            print(f"      [ERROR] Extraction failed: {e}")
            raise e

async def extract_fields_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> EXTRACT_FIELDS (COMPREHENSIVE) --------------------")
    url = state.get("current_url") or state.get("apply_url") or state.get("job_url")
    
    if not url:
        return {"error": "No URL found in state."}

    try:
        # Run the async extraction directly with await
        all_elements = await _extract_all(url)
        
        # Display everything to the user as requested
        print(f"\n      [RESULTS] Extracted {len(all_elements)} interactive/semantic elements:")
        for i, el in enumerate(all_elements):
            tag = el.get('tagName', 'UNKNOWN')
            etype = el.get('type', 'unknown')
            label = el.get('label') or el.get('text', '')[:30] or "N/A"
            label = label.replace('\n', ' ').encode('ascii', 'ignore').decode('ascii')
            selector = el.get('selector', 'N/A').encode('ascii', 'ignore').decode('ascii')
            print(f"        {i+1:3}. [{tag:7}] Type: {etype:10} | Label/Text: {label:35} | Selector: {selector}")
        
        print("\n[NODE END] ---------------------------------------------------------\n")
        
        return {
            "form_fields": all_elements, 
            "form_ready": len(all_elements) > 0,
            "raw_extraction_count": len(all_elements)
        }
    except Exception as e:
        print(f"      [CRITICAL ERROR] {e}")
        return {"error": str(e)}