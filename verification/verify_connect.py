from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to /connect with valid params
        # We need to ensure REDIRECT_URI_ALLOWLIST includes our URI
        url = "http://localhost:8082/connect?redirect_uri=http://localhost:3000/callback&state=test&code_challenge=challenge&code_challenge_method=S256"
        print(f"Navigating to {url}")
        try:
            page.goto(url)
            # Wait for form to appear
            page.wait_for_selector("form#connect-form", timeout=5000)

            # Fill some fields just to see
            page.fill("#name", "Test Connection")
            page.fill("#apiKey", "pk_test_123")

            # Take screenshot
            page.screenshot(path="verification/connect_ui.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
            # Take screenshot of error
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
