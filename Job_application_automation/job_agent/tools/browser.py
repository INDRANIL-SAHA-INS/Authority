# Playwright browser utility tool
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import asyncio
import random
import logging

logger = logging.getLogger(__name__)


class BrowserManager:
    def __init__(self, headless: bool = True, slow_mo: int = 50):
        self.headless = headless
        self.slow_mo = slow_mo
        self._playwright = None
        self._browser: Browser = None
        self._context: BrowserContext = None

    async def start(self):
        """Launch browser and create a context with human-like settings."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        self._context = await self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            timezone_id="America/New_York",
        )
        # Hide automation fingerprint
        await self._context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        logger.info("Browser started.")

    async def new_page(self) -> Page:
        """Open a new page in the current context."""
        if not self._context:
            raise RuntimeError("Browser not started. Call start() first.")
        page = await self._context.new_page()
        return page

    async def goto(self, page: Page, url: str, wait_until: str = "domcontentloaded"):
        """Navigate to a URL with a small random delay to mimic human behaviour."""
        await asyncio.sleep(random.uniform(1.0, 2.5))
        await page.goto(url, wait_until=wait_until, timeout=30_000)
        logger.info(f"Navigated to: {url}")

    async def human_type(self, page: Page, selector: str, text: str):
        """Type text into a field with random delays between keystrokes."""
        await page.click(selector)
        for char in text:
            await page.keyboard.type(char)
            await asyncio.sleep(random.uniform(0.04, 0.12))

    async def human_click(self, page: Page, selector: str):
        """Click an element after a short random pause."""
        await asyncio.sleep(random.uniform(0.3, 0.9))
        await page.click(selector)

    async def scroll_down(self, page: Page, steps: int = 3):
        """Scroll down gradually to mimic reading behaviour."""
        for _ in range(steps):
            await page.mouse.wheel(0, random.randint(300, 600))
            await asyncio.sleep(random.uniform(0.4, 1.0))

    async def get_html(self, page: Page) -> str:
        """Return the full HTML of the current page."""
        return await page.content()

    async def screenshot(self, page: Page, path: str = "screenshot.png"):
        """Save a screenshot for debugging."""
        await page.screenshot(path=path, full_page=True)
        logger.info(f"Screenshot saved to {path}")

    async def close(self):
        """Shut down browser and playwright cleanly."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("Browser closed.")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


async def fetch_page_html(url: str, headless: bool = True) -> str:
    """One-shot helper: open a page, return its HTML, then close."""
    async with BrowserManager(headless=headless) as bm:
        page = await bm.new_page()
        await bm.goto(page, url)
        html = await bm.get_html(page)
    return html