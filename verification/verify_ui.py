
from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock the API responses
        page.route("**/api/connections", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body="[]"
        ))

        # Test OAuth Flow Redirect
        # Simulate visiting with redirect_uri
        page.goto("file:///app/src/public/index.html?redirect_uri=http://app.com/cb&state=xyz")

        # Check if the UI is in "Create Connection" mode automatically
        page.wait_for_selector("#view-create")

        # Check if "Authorize & Connect" button is present
        btn_text = page.inner_text("#save-btn")
        if "Authorize & Connect" not in btn_text:
             print(f"FAILED: Button text is {btn_text}")
        else:
             print("SUCCESS: Button text is correct")

        # Take screenshot
        page.screenshot(path="verification/ui_auth_flow.png")
        browser.close()

if __name__ == "__main__":
    verify_ui()
