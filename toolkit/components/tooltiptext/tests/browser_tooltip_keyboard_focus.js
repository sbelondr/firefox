/* eslint-disable mozilla/no-arbitrary-setTimeout */

"use strict";

// Bug 97223 - HTML tooltips (title attribute) should show when an element
// receives keyboard focus, gated on browser.html.tooltips.show_on_focus.

const PAGE_URL =
  "data:text/html," +
  encodeURIComponent(`<!doctype html><body>
    <a href="#" id="link" title="Link tooltip">Link with tooltip</a>
    <a href="#" id="plain">No tooltip here</a>
  </body>`);

function getTooltip() {
  let tooltipId = Services.appinfo.browserTabsRemoteAutostart
    ? "remoteBrowserTooltip"
    : "aHTMLTooltip";
  return document.getElementById(tooltipId);
}

function promiseTooltipShown() {
  return new Promise(resolve => {
    getTooltip().addEventListener(
      "popupshown",
      event => resolve(event.target),
      {
        once: true,
      }
    );
  });
}

async function focusElement(browser, id) {
  await SpecialPowers.spawn(browser, [id], elementId => {
    content.document.getElementById(elementId).focus();
  });
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["ui.tooltip.delay_ms", 0],
      ["browser.html.tooltips.show_on_focus", true],
    ],
  });
});

add_task(async function test_tooltip_shown_on_focus() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);

  let shown = promiseTooltipShown();
  await focusElement(tab.linkedBrowser, "link");
  info("Waiting for tooltip to open");
  let tooltip = await shown;

  is(
    tooltip.getAttribute("label"),
    "Link tooltip",
    "tooltip label should match the focused element's title"
  );

  info("Moving focus away should hide the tooltip");
  let hidden = new Promise(resolve => {
    tooltip.addEventListener("popuphidden", () => resolve(), { once: true });
  });
  await focusElement(tab.linkedBrowser, "plain");
  await hidden;

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_tooltip_not_shown_when_pref_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.html.tooltips.show_on_focus", false]],
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, PAGE_URL);

  let tooltipShown = false;
  getTooltip().addEventListener(
    "popupshown",
    () => {
      tooltipShown = true;
    },
    { once: true }
  );

  await focusElement(tab.linkedBrowser, "link");
  info("Waiting to make sure no tooltip appears");
  await new Promise(resolve => setTimeout(resolve, 400));

  ok(!tooltipShown, "no tooltip should show when show_on_focus is false");
  is(getTooltip().state, "closed", "tooltip popup should stay closed");

  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});
