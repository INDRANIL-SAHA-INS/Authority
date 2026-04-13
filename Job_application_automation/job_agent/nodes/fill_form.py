# Node to fill and submit the form using Playwright
from tools.browser import BrowserManager
from state import JobAgentState
import asyncio, json, logging

logger = logging.getLogger(__name__)

async def _fill(state: JobAgentState):
    """
    Execute the form-fill plan produced by map_fields_node.
    """
    print("      [Step] Launching Playwright Browser for Form Filling (Visible Mode)...")
    async with BrowserManager(headless=False) as bm:  # visible for debugging
        page = await bm.new_page()
        
        url = state.get("apply_url") or state.get("job_url") or state.get("current_url")
        if not url:
            print("      [ERROR] No URL found for filling form.")
            logger.error("No URL found for filling form.")
            return

        try:
            print(f"      [Step] Navigating to {url} (waiting for domcontent to load)...")
            await bm.goto(page, url, wait_until="domcontentloaded")
            print("      [Step] Form loaded. Scrolling down to initialize fields...")
        except Exception as e:
            print(f"      [ERROR] Network Timeout or Failure in fill_form: {e}")
            raise Exception(f"Failed to load form page: {e}")

        await bm.scroll_down(page, steps=2)
        print("      [Step] Executing Form Fill Actions...")

        form_data = state.get("form_data", {})
        cv_path = state.get("cv_path")

        for selector, instruction in form_data.items():
            action = instruction.get("action")
            value  = instruction.get("value", "")

            # Confirm element exists before acting
            if await page.locator(selector).count() == 0:
                logger.warning(f"Selector not found, skipping: {selector}")
                continue

            try:
                if action == "type":
                    # Skip if the field is disabled to prevent 30s timeout hangs
                    if await page.locator(selector).first.is_disabled():
                        print(f"      [Skip] Field is disabled, cannot type: {selector}")
                        continue
                    await bm.human_type(page, selector, value)

                elif action == "select_option":
                    await page.select_option(selector, value=value, timeout=5000)

                elif action == "check":
                    if str(value).lower() == "true":
                        await page.check(selector, timeout=5000)
                    else:
                        await page.uncheck(selector, timeout=5000)

                elif action == "upload_cv":
                    if cv_path:
                        # Prevent Playwright from attaching to duplicate hidden fields
                        upload_selector = selector
                        if "type" not in selector.lower():
                            upload_selector = f"{selector}:not([type='hidden'])"
                        
                        await page.locator(upload_selector).first.set_input_files(cv_path, timeout=5000)
                    else:
                        logger.warning("upload_cv requested but cv_path is missing.")

                elif action == "click_radio":
                    # Click the specific radio input with the matching value attribute
                    radio_selector = f'{selector}[value="{value}"]'
                    if await page.locator(radio_selector).count() > 0:
                        await page.click(radio_selector)
                    else:
                        # Fallback: find a label containing the value text
                        try:
                            await page.get_by_label(value).click(timeout=3000)
                        except:
                            # Final fallback: click the selector itself if it's a specific radio
                            await page.locator(selector).first.click()

                elif action == "click":
                    # Generic click for buttons or toggles
                    await page.locator(selector).first.click(timeout=5000)

                else:
                    logger.warning(f"Unknown action '{action}' for selector '{selector}'")

                # Small delay to allow for dynamic UI updates (e.g. conditional fields appearing)
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"Error executing '{action}' on '{selector}': {e}")

        # Submit bit
        print("      [Step] Searching for Submit button using Smart Fallbacks...")
        submit_selectors = [
            'button#submit-application',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Apply")',
            'a:has-text("Submit Application")',
            'a:has-text("Apply Now")',
            'div[role="button"]:has-text("Submit")',
            'input[value="Submit"]'
        ]
        
        submitted = False
        for sel in submit_selectors:
            btn = page.locator(sel).first
            if await btn.count() > 0 and not await btn.is_disabled():
                print(f"      [Step] Found Submit Button via '{sel}'. Clicking...")
                await bm.human_click(page, sel)
                await page.wait_for_timeout(4000) # Wait to observe network/DOM changes
                print("      [Step] Click resolved. Analyzing page response...")
                submitted = True
                break
        
        if not submitted:
            print("      [WARNING] No viable submit button found. Form may be stuck.")
            logger.warning("No submit button found — form may not have been submitted.")
            return False

        # Multi-step heuristic: did we stay on the same URL but new fields appeared?
        # Or did we get a success message? We'll assume success for now, but return True 
        # so the graph knows we at least successfully triggered a submit.
        print("      [Step] Form submission triggered successfully.")
        return True


def fill_form_node(state: JobAgentState) -> dict:
    print("\n[NODE START] ---> FILL_FORM -------------------------")
    success = asyncio.run(_fill(state))
    # If success=False, we could route back for multi-step in graph.py
    return {"applied": bool(success)}