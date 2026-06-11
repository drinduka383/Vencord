/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { StartAt } from "@utils/types";

const STYLE_ID = "vc-sidebar-collapse-style";
const STORAGE_KEY = "vc-sidebar-collapse-focus";
const FOCUS_ATTRIBUTE = "data-vc-sidebar-collapse-focus";
const DOCK_ATTRIBUTE = "data-vc-sidebar-collapse-dock";
const FOOTER_ATTRIBUTE = "data-vc-sidebar-collapse-footer";

const ROOT_ATTRIBUTES = {
    channels: "data-vc-sidebar-collapse-channels-root",
    layout: "data-vc-sidebar-collapse-layout",
    main: "data-vc-sidebar-collapse-main",
    servers: "data-vc-sidebar-collapse-servers-root",
} as const;

const SERVER_NAV_SELECTORS = [
    'nav[aria-label*="Servers" i]',
    'nav[aria-label*="Guilds" i]',
    'nav[data-list-id="guildsnav"]',
] as const;

const CHANNEL_NAV_SELECTORS = [
    'nav[aria-label*="Channels" i]',
    'nav[aria-label*="Direct Messages" i]',
    'nav[aria-label*="Friends" i]',
] as const;

const TOOLBAR_ANCHOR_SELECTORS = [
    'button[aria-label*="Inbox" i]',
    '[role="button"][aria-label*="Inbox" i]',
    'button[aria-label*="Help" i]',
    '[role="button"][aria-label*="Help" i]',
] as const;

const CSS = `
[data-vc-sidebar-collapse-servers-root],
[data-vc-sidebar-collapse-channels-root] {
    transition:
        width 0.25s ease,
        min-width 0.25s ease,
        max-width 0.25s ease,
        flex-basis 0.25s ease,
        opacity 0.2s ease;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-servers-root],
body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-channels-root] {
    box-sizing: border-box !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: 0 !important;
    flex: 0 0 0 !important;
    flex-basis: 0 !important;
    margin-inline: 0 !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
}

[data-vc-sidebar-collapse-layout],
[data-vc-sidebar-collapse-layout] > * {
    min-width: 0 !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-main] {
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    flex: 1 1 auto !important;
}

[data-vc-sidebar-collapse-toggle] {
    box-sizing: border-box;
    min-width: 32px;
    height: 32px;
    margin: 0 4px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--interactive-normal, #b5bac1);
    font: 600 12px/32px var(--font-primary, sans-serif);
    cursor: pointer;
}

[data-vc-sidebar-collapse-toggle]:hover {
    background: var(--background-modifier-hover, rgb(255 255 255 / 8%));
    color: var(--interactive-hover, #dbdee1);
}

[data-vc-sidebar-collapse-toggle][aria-pressed="true"] {
    background: var(--brand-experiment, #5865f2);
    color: white;
}

[data-vc-sidebar-collapse-toggle][data-vc-sidebar-collapse-fallback] {
    position: fixed;
    z-index: 10000;
    top: 8px;
    right: 88px;
    margin: 0;
    background: var(--background-floating, #111214);
    box-shadow: var(--elevation-high, 0 8px 16px rgb(0 0 0 / 24%));
}

[data-vc-sidebar-collapse-dock] {
    position: fixed;
    z-index: 2;
    right: 12px;
    bottom: 12px;
    box-sizing: border-box;
    width: min(280px, calc(100vw - 24px));
    max-height: min(42vh, 320px);
    overflow: auto;
    border-radius: 8px;
    background: var(--background-secondary-alt, #1e1f22);
    box-shadow: var(--elevation-high, 0 8px 16px rgb(0 0 0 / 24%));
}

[data-vc-sidebar-collapse-dock]
    > [data-vc-sidebar-collapse-footer] {
    box-sizing: border-box !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
}
`;

type RootKind = keyof typeof ROOT_ATTRIBUTES;

let observer: MutationObserver | undefined;
let refreshFrame: number | undefined;
let style: HTMLStyleElement | undefined;
let toggleButton: HTMLButtonElement | undefined;
let waitingForDom = false;
let dockHost: HTMLDivElement | undefined;

interface FooterRelocation {
    footer: HTMLElement;
    originalParent: HTMLElement;
    originalNextSibling: ChildNode | null;
    placeholder: Comment;
}

let footerRelocation: FooterRelocation | undefined;

const roots: Partial<Record<RootKind, HTMLElement>> = {};

function findFirst(selectors: readonly string[]) {
    for (const selector of selectors) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element) return element;
    }
}

function isHorizontalLayout(element: HTMLElement) {
    const style = getComputedStyle(element);

    if (style.display.includes("grid")) return true;
    if (!style.display.includes("flex")) return false;

    return style.flexDirection === "row" || style.flexDirection === "row-reverse";
}

function findWidthOwner(nav: HTMLElement, otherNav: HTMLElement | undefined, expectedWidth: number) {
    const candidates: Array<{ element: HTMLElement; score: number; }> = [];
    let current: HTMLElement | null = nav;

    for (let depth = 0; current && current !== document.body && depth < 10; depth++) {
        const parent = current.parentElement;
        if (!parent) break;

        const rect = current.getBoundingClientRect();
        const widthIsSidebarSized = rect.width > 40 && rect.width < 400;
        const ownsHorizontalSlot = isHorizontalLayout(parent);
        const containsOtherSidebar = otherNav ? current.contains(otherNav) : false;

        if (widthIsSidebarSized && ownsHorizontalSlot && !containsOtherSidebar) {
            const widthDistance = Math.abs(rect.width - expectedWidth);
            const isWrapper = current !== nav;
            const score = (isWrapper ? 100 : 0) - widthDistance - depth;
            candidates.push({ element: current, score });
        }

        current = parent;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element ?? nav.parentElement ?? nav;
}

function findCommonAncestor(elements: HTMLElement[]) {
    const [first, ...rest] = elements;
    if (!first) return;

    for (let candidate: HTMLElement | null = first; candidate; candidate = candidate.parentElement) {
        if (rest.every(element => candidate.contains(element))) return candidate;
    }
}

function getSemanticLabel(element: HTMLElement) {
    return [element.getAttribute("aria-label"), element.getAttribute("title")]
        .filter(Boolean)
        .join(" ");
}

function findAccountControl(scope: HTMLElement, pattern: RegExp) {
    return Array.from(scope.querySelectorAll<HTMLElement>("button, [role=button]"))
        .find(element => pattern.test(getSemanticLabel(element)));
}

function findFooterStack() {
    const channelRoot = roots.channels;
    if (!channelRoot?.isConnected) return;

    const mute = findAccountControl(channelRoot, /^(?:un)?mute(?:\b|\s)/i);
    const deafen = findAccountControl(channelRoot, /^(?:un)?deafen(?:\b|\s)/i);
    const settings = findAccountControl(channelRoot, /^user settings(?:\b|\s)/i);
    if (!mute || !deafen || !settings) return;

    const accountPanel = findCommonAncestor([mute, deafen, settings]);
    if (!accountPanel) return;

    const utilityControl = Array.from(channelRoot.querySelectorAll<HTMLElement>("[aria-label], [title]"))
        .find(element => !accountPanel.contains(element) && /spotify|voice connected|disconnect|noise suppression|start an activity/i.test(getSemanticLabel(element)));

    if (utilityControl) {
        const utilityStack = findCommonAncestor([accountPanel, utilityControl]);
        if (utilityStack && utilityStack !== channelRoot && !utilityStack.querySelector("nav"))
            return utilityStack;
    }

    for (let candidate = accountPanel.parentElement; candidate && candidate !== channelRoot; candidate = candidate.parentElement) {
        if (!candidate.querySelector("nav")) return candidate;
    }
}

function getDockHost() {
    if (dockHost?.isConnected) return dockHost;

    dockHost = document.createElement("div");
    dockHost.setAttribute(DOCK_ATTRIBUTE, "");
    document.body?.append(dockHost);
    return dockHost;
}

function relocateFooter(footer: HTMLElement) {
    const originalParent = footer.parentElement;
    if (!originalParent) return;

    const placeholder = document.createComment("SidebarCollapse footer placeholder");
    const originalNextSibling = footer.nextSibling;
    originalParent.insertBefore(placeholder, footer);
    footer.setAttribute(FOOTER_ATTRIBUTE, "");
    getDockHost().append(footer);

    footerRelocation = { footer, originalNextSibling, originalParent, placeholder };
}

function discardRelocatedFooter() {
    const relocation = footerRelocation;
    if (!relocation) return;

    relocation.footer.removeAttribute(FOOTER_ATTRIBUTE);
    relocation.footer.remove();
    relocation.placeholder.remove();
    footerRelocation = undefined;
}

function restoreFooter() {
    const relocation = footerRelocation;
    if (!relocation) return;

    const { footer, originalNextSibling, originalParent, placeholder } = relocation;
    footer.removeAttribute(FOOTER_ATTRIBUTE);

    if (placeholder.isConnected) {
        placeholder.replaceWith(footer);
    } else if (originalParent.isConnected) {
        originalParent.insertBefore(
            footer,
            originalNextSibling?.parentNode === originalParent ? originalNextSibling : null
        );
    } else if (roots.channels?.isConnected) {
        roots.channels.append(footer);
    } else {
        footer.remove();
    }

    placeholder.remove();
    footerRelocation = undefined;
}

function removeDockHost() {
    dockHost?.remove();
    dockHost = undefined;
}

function updateFooterRelocation() {
    if (!isFocusEnabled()) {
        restoreFooter();
        removeDockHost();
        return;
    }

    const discoveredFooter = findFooterStack();
    if (discoveredFooter && discoveredFooter !== footerRelocation?.footer) {
        if (footerRelocation) discardRelocatedFooter();
        relocateFooter(discoveredFooter);
    }
}

function findLayoutBranch(layout: HTMLElement, descendant: HTMLElement) {
    let branch = descendant;

    while (branch.parentElement && branch.parentElement !== layout)
        branch = branch.parentElement;

    return branch.parentElement === layout ? branch : descendant;
}

function findMainRegion(serverNav: HTMLElement, channelNav: HTMLElement) {
    return Array.from(document.querySelectorAll<HTMLElement>("main, [role=main]"))
        .filter(element => !serverNav.contains(element) && !channelNav.contains(element))
        .map(element => {
            const rect = element.getBoundingClientRect();
            return { area: rect.width * rect.height, element };
        })
        .filter(candidate => candidate.area > 0)
        .sort((a, b) => b.area - a.area)[0]?.element;
}

function setRoot(kind: RootKind, element: HTMLElement | undefined) {
    const attribute = ROOT_ATTRIBUTES[kind];
    const previous = roots[kind];

    if (previous === element) return;
    previous?.removeAttribute(attribute);

    if (element) {
        element.setAttribute(attribute, "");
        roots[kind] = element;
    } else {
        delete roots[kind];
    }
}

function resolveWidthOwner(kind: "servers" | "channels", nav: HTMLElement, otherNav: HTMLElement | undefined, expectedWidth: number) {
    const existing = roots[kind];
    if (existing?.isConnected && existing.contains(nav)) return existing;

    return findWidthOwner(nav, otherNav, expectedWidth);
}

function discoverLayout() {
    const serverNav = findFirst(SERVER_NAV_SELECTORS);
    const channelNav = findFirst(CHANNEL_NAV_SELECTORS);

    if (!serverNav || !channelNav) return;

    const main = findMainRegion(serverNav, channelNav);
    if (!main) return;

    const serverRoot = resolveWidthOwner("servers", serverNav, channelNav, 72);
    const channelRoot = resolveWidthOwner("channels", channelNav, serverNav, 240);
    const layout = findCommonAncestor([serverRoot, channelRoot, main]);

    setRoot("servers", serverRoot);
    setRoot("channels", channelRoot);

    if (layout && layout !== document.body && layout !== document.documentElement) {
        setRoot("layout", layout);
        setRoot("main", findLayoutBranch(layout, main));
    } else {
        setRoot("layout", undefined);
        setRoot("main", main);
    }
}

function isFocusEnabled() {
    return document.body?.hasAttribute(FOCUS_ATTRIBUTE) ?? false;
}

function updateButtonState() {
    const enabled = isFocusEnabled();
    toggleButton?.setAttribute("aria-pressed", String(enabled));
    if (toggleButton)
        toggleButton.title = enabled ? "Disable Focus Mode" : "Enable Focus Mode";
}

function toggleFocus() {
    const { body } = document;
    if (!body) return;

    const enabled = body.toggleAttribute(FOCUS_ATTRIBUTE);
    try {
        localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (error) {
        console.warn("[SidebarCollapse] Could not persist Focus Mode state", error);
    }
    updateButtonState();
    scheduleRefresh();
}

function createToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Focus";
    button.setAttribute("aria-label", "Toggle Focus Mode");
    button.setAttribute("data-vc-sidebar-collapse-toggle", "");
    button.addEventListener("click", toggleFocus);
    toggleButton = button;
    updateButtonState();
    return button;
}

function placeToggleButton() {
    const { body } = document;
    if (!body) return;

    const button = toggleButton ?? createToggleButton();
    const anchor = findFirst(TOOLBAR_ANCHOR_SELECTORS);

    if (anchor?.parentElement) {
        button.removeAttribute("data-vc-sidebar-collapse-fallback");
        if (button.parentElement !== anchor.parentElement || button.nextElementSibling !== anchor)
            anchor.parentElement.insertBefore(button, anchor);
    } else {
        button.setAttribute("data-vc-sidebar-collapse-fallback", "");
        if (button.parentElement !== body) body.append(button);
    }
}

function refresh() {
    refreshFrame = undefined;
    try {
        discoverLayout();
        placeToggleButton();
        updateFooterRelocation();
    } catch (error) {
        console.error("[SidebarCollapse] Failed to refresh the Discord layout", error);
    }
}

function scheduleRefresh() {
    if (refreshFrame !== undefined) return;
    refreshFrame = requestAnimationFrame(refresh);
}

function addStyle() {
    if (style?.isConnected) return;

    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head ?? document.documentElement).append(style);
}

function restoreFocusState() {
    try {
        if (localStorage.getItem(STORAGE_KEY) === "true")
            document.body?.setAttribute(FOCUS_ATTRIBUTE, "");
    } catch (error) {
        console.warn("[SidebarCollapse] Could not restore Focus Mode state", error);
    }
}

function initialize() {
    const { body } = document;
    if (!body) return;

    waitingForDom = false;
    addStyle();
    restoreFocusState();
    refresh();

    observer?.disconnect();
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(body, {
        attributes: true,
        attributeFilter: ["aria-label", "data-list-id", "role"],
        childList: true,
        subtree: true,
    });
}

export default definePlugin({
    name: "SidebarCollapse",
    description: "Adds a Focus Mode that collapses Discord's server and channel columns.",
    tags: ["Appearance"],
    authors: [{ name: "drind", id: 0n }],
    startAt: StartAt.DOMContentLoaded,

    start() {
        if (document.body) {
            initialize();
        } else {
            waitingForDom = true;
            document.addEventListener("DOMContentLoaded", initialize, { once: true });
        }
    },

    stop() {
        if (waitingForDom)
            document.removeEventListener("DOMContentLoaded", initialize);
        waitingForDom = false;

        observer?.disconnect();
        observer = undefined;

        if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
        refreshFrame = undefined;

        for (const kind of Object.keys(ROOT_ATTRIBUTES) as RootKind[])
            setRoot(kind, undefined);

        restoreFooter();
        removeDockHost();

        toggleButton?.removeEventListener("click", toggleFocus);
        toggleButton?.remove();
        toggleButton = undefined;

        document.body?.removeAttribute(FOCUS_ATTRIBUTE);
        style?.remove();
        style = undefined;
    },
});
