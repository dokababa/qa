const { test, expect } = require('@playwright/test');

// Locators are written against the page as deployed on
// test-saayam.netlify.app: a single required email field (#email,
// placeholder "Your Email", label "Email *") with "Reset" and "Cancel"
// buttons under a "Password Reset" heading.

const emailField = page => page.getByPlaceholder(/your email/i);

const resetButton = page =>
  page.getByRole('button', {
    name: 'Reset',
    exact: true,
  });

const cancelButton = page =>
  page.getByRole('button', {
    name: 'Cancel',
    exact: true,
  });

test.describe('Forgot Password Page - Issue #104', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password', {
      waitUntil: 'domcontentloaded',
    });
  });

  test('TC-FP-001: Forgot Password page loads with required controls', async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/forgot-password/);

    await expect(
      page.getByRole('heading', { name: /password reset/i })
    ).toBeVisible();

    await expect(emailField(page)).toBeVisible();
    await expect(resetButton(page)).toBeVisible();
    await expect(cancelButton(page)).toBeVisible();
  });

  test('TC-FP-002: Blank email validation is displayed', async ({ page }) => {
    await resetButton(page).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();

    // The user must stay on the page when submission is rejected.
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('TC-FP-003: Whitespace-only email is rejected as empty', async ({
    page,
  }) => {
    await emailField(page).fill('   ');
    await resetButton(page).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('TC-FP-004: Malformed email shows a format validation message', async ({
    page,
  }) => {
    await emailField(page).fill('notanemail');
    await resetButton(page).click();

    await expect(
      page.getByText(/please enter a valid email address/i)
    ).toBeVisible();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('TC-FP-005: Malformed email variants are all rejected', async ({
    page,
  }) => {
    const malformed = ['plainstring', 'missing@tld', '@nolocalpart.com'];

    for (const value of malformed) {
      await page.goto('/forgot-password', {
        waitUntil: 'domcontentloaded',
      });

      await emailField(page).fill(value);
      await resetButton(page).click();

      // Either message is an acceptable rejection; what matters is that the
      // form does not advance to the verification step.
      await expect(
        page.getByText(
          /please enter a valid email address|email is required/i
        ),
        `"${value}" should be rejected as malformed`
      ).toBeVisible();

      await expect(
        page,
        `"${value}" should not advance past the request step`
      ).toHaveURL(/\/forgot-password/);
    }
  });

  test('TC-FP-006: Email field is a required email input with a label', async ({
    page,
  }) => {
    const email = emailField(page);

    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('required', '');

    // The visible "Email *" label must be programmatically associated with
    // the input, so screen readers announce it.
    const inputId = await email.getAttribute('id');
    expect(inputId, 'Email input needs an id to be labelled').toBeTruthy();

    await expect(
      page.locator(`label[for="${inputId}"]`)
    ).toBeVisible();
  });

  test('TC-FP-007: Forgot Password is reachable from the Log In page', async ({
    page,
  }) => {
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
    });

    await page.getByText(/forgot password/i).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(emailField(page)).toBeVisible();
  });

  test('TC-FP-008: Cancel returns the user to the Log In page', async ({
    page,
  }) => {
    // Arrive the way a user does, so there is history to return to. Cancel is
    // implemented as a back navigation, so a directly-opened tab with no
    // history is not a representative journey.
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
    });

    await page.getByText(/forgot password/i).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    await cancelButton(page).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-FP-009: Refresh clears an unsubmitted email value', async ({
    page,
  }) => {
    const email = emailField(page);

    await email.fill('qa-test@example.com');
    await expect(email).toHaveValue('qa-test@example.com');

    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    await expect(emailField(page)).toHaveValue('');
  });

  test('TC-FP-010: Email field is reachable and editable by keyboard', async ({
    page,
  }) => {
    const email = emailField(page);

    await email.focus();
    await expect(email).toBeFocused();

    await page.keyboard.type('qa-test@example.com');
    await expect(email).toHaveValue('qa-test@example.com');
  });

  test('TC-FP-011: Valid email advances to the verification step', async ({
    page,
  }) => {
    // example.com is reserved by RFC 2606 and cannot receive mail, so this
    // exercises the flow without sending anything to a real inbox.
    await emailField(page).fill('qa-nonexistent@example.com');
    await resetButton(page).click();

    await expect(page).toHaveURL(/\/verify-account/, {
      timeout: 20000,
    });

    await expect(
      page.getByText(/enter code/i).first()
    ).toBeVisible();
  });

  test('TC-FP-012: Page renders correctly across required viewport widths', async ({
    page,
  }) => {
    const viewportWidths = [320, 768, 1024, 1440];

    for (const width of viewportWidths) {
      await page.setViewportSize({
        width,
        height: 900,
      });

      await page.goto('/forgot-password', {
        waitUntil: 'domcontentloaded',
      });

      const controls = [
        emailField(page),
        resetButton(page),
        cancelButton(page),
      ];

      for (const control of controls) {
        await expect(control).toBeVisible();
      }

      // Verify the page does not introduce horizontal scrolling.
      const hasHorizontalScroll = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

      expect(
        hasHorizontalScroll,
        `Horizontal scrolling detected at ${width}px viewport`
      ).toBeFalsy();

      // Verify the controls remain inside the viewport.
      for (const control of controls) {
        const box = await control.boundingBox();

        expect(
          box,
          `Control was not rendered at ${width}px viewport`
        ).not.toBeNull();

        expect(
          box.x,
          `Control extends beyond left side at ${width}px`
        ).toBeGreaterThanOrEqual(0);

        expect(
          box.x + box.width,
          `Control extends beyond right side at ${width}px`
        ).toBeLessThanOrEqual(width);
      }
    }
  });
});
