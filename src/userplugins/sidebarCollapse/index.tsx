/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { ContextMenuApi, createRoot, ExpressionPickerStore, Menu, React, useEffect } from "@webpack/common";

const STYLE_ID = "vc-sidebar-collapse-style";
const FOCUS_ATTRIBUTE = "data-vc-sidebar-collapse-focus";
const DOCK_ATTRIBUTE = "data-vc-sidebar-collapse-dock";
const FOOTER_ATTRIBUTE = "data-vc-sidebar-collapse-footer";
const DOCK_PLACEMENT_ATTRIBUTE = "data-vc-sidebar-collapse-dock-placement";
const PICKER_OPEN_ATTRIBUTE = "data-vc-sidebar-collapse-picker-open";
const PICKER_BEHAVIOR_ATTRIBUTE = "data-vc-sidebar-collapse-picker-behavior";
const TOGGLE_HOST_ATTRIBUTE = "data-vc-sidebar-collapse-toggle-host";

enum DockLocation {
    Chat = "chat",
    MemberList = "member",
}

enum PickerBehavior {
    Overlay = "overlay",
    ShiftLeft = "shift-left",
}

const settings = definePluginSettings({
    focusEnabled: {
        type: OptionType.BOOLEAN,
        description: "Whether Focus Mode is enabled",
        default: false,
    },
    dockLocation: {
        type: OptionType.SELECT,
        description: "Where to place the utility dock when the member list is available",
        options: [
            { label: "Member list", value: DockLocation.MemberList, default: true },
            { label: "Chat", value: DockLocation.Chat },
        ],
    },
    pickerBehavior: {
        type: OptionType.SELECT,
        description: "How the chat dock behaves while an expression picker is open",
        options: [
            { label: "Overlay", value: PickerBehavior.Overlay, default: true },
            { label: "Shift left", value: PickerBehavior.ShiftLeft },
        ],
    },
});

const ROOT_ATTRIBUTES = {
    channels: "data-vc-sidebar-collapse-channels-root",
    layout: "data-vc-sidebar-collapse-layout",
    main: "data-vc-sidebar-collapse-main",
    member: "data-vc-sidebar-collapse-member-root",
    memberContent: "data-vc-sidebar-collapse-member-content",
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

[data-vc-sidebar-collapse-toggle-host] {
    display: contents;
}

[data-vc-sidebar-collapse-toggle-host][data-vc-sidebar-collapse-fallback] {
    display: block;
    position: fixed;
    z-index: 10000;
    top: 8px;
    right: 88px;
    margin: 0;
}

[data-vc-sidebar-collapse-toggle-host][data-vc-sidebar-collapse-fallback]
    [data-vc-sidebar-collapse-toggle] {
    margin: 0;
    background: var(--background-floating, #111214);
    box-shadow: var(--elevation-high, 0 8px 16px rgb(0 0 0 / 24%));
}

[data-vc-sidebar-collapse-dock] {
    z-index: 2;
    box-sizing: border-box;
    max-height: min(42vh, 320px);
    overflow: auto;
    border-radius: 8px;
    background: var(--background-secondary-alt, #1e1f22);
    box-shadow: var(--elevation-high, 0 8px 16px rgb(0 0 0 / 24%));
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-member-root]:has(> [data-vc-sidebar-collapse-dock-placement="member"]) {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-member-root]:has(> [data-vc-sidebar-collapse-dock-placement="member"])
    > [data-vc-sidebar-collapse-member-content] {
    flex: 1 1 auto !important;
    min-height: 0 !important;
}

[data-vc-sidebar-collapse-dock-placement="member"] {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    border-radius: 0;
}

[data-vc-sidebar-collapse-dock-placement="chat"] {
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: min(280px, calc(100vw - 24px));
}

body[data-vc-sidebar-collapse-picker-open]
    [data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-picker-behavior="overlay"] {
    z-index: 0;
}

body[data-vc-sidebar-collapse-picker-open]
    [data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-picker-behavior="shift-left"] {
    right: min(520px, 58vw);
    width: min(280px, calc(42vw - 24px));
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
let waitingForDom = false;
let dockHost: HTMLDivElement | undefined;
let toggleHost: HTMLDivElement | undefined;
let toggleRoot: ReturnType<typeof createRoot> | undefined;

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
    const channelRoot = roots.channels?.isConnected ? roots.channels : undefined;
    const scope = channelRoot ?? document.body;

    const mute = findAccountControl(scope, /^(?:un)?mute(?:\b|\s)/i);
    const deafen = findAccountControl(scope, /^(?:un)?deafen(?:\b|\s)/i);
    const settings = findAccountControl(scope, /^user settings(?:\b|\s)/i);
    if (!mute || !deafen || !settings) return;

    const accountPanel = findCommonAncestor([mute, deafen, settings]);
    if (!accountPanel) return;

    let utilityStack = accountPanel;

    for (let candidate = accountPanel.parentElement; candidate && candidate !== channelRoot; candidate = candidate.parentElement) {
        const { height } = candidate.getBoundingClientRect();
        const isTooTallForUtilityStack = height > Math.max(500, window.innerHeight * 0.65);
        if (candidate === document.body || candidate.querySelector("nav, main, [role=main]") || isTooTallForUtilityStack) break;
        utilityStack = candidate;
    }

    return utilityStack;
}

function getDockHost() {
    if (dockHost) {
        if (!dockHost.isConnected) getOverlayRoot()?.append(dockHost);
        return dockHost;
    }

    dockHost = document.createElement("div");
    dockHost.setAttribute(DOCK_ATTRIBUTE, "");
    getOverlayRoot()?.append(dockHost);
    return dockHost;
}

function getOverlayRoot() {
    return document.querySelector<HTMLElement>("#app-mount") ?? roots.layout ?? document.body;
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

function placeDockHost() {
    const host = dockHost;
    if (!host || !footerRelocation) return;

    host.setAttribute(PICKER_BEHAVIOR_ATTRIBUTE, settings.store.pickerBehavior);
    const memberRoot = roots.member;
    const useMemberList = settings.store.dockLocation === DockLocation.MemberList
        && memberRoot?.isConnected
        && isVisibleRightColumn(memberRoot);

    if (useMemberList) {
        host.setAttribute(DOCK_PLACEMENT_ATTRIBUTE, DockLocation.MemberList);
        if (host.parentElement !== memberRoot) memberRoot.append(host);
    } else {
        host.setAttribute(DOCK_PLACEMENT_ATTRIBUTE, DockLocation.Chat);
        const overlayRoot = getOverlayRoot();
        if (overlayRoot && host.parentElement !== overlayRoot) overlayRoot.append(host);
    }
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

    if (footerRelocation && footerRelocation.footer.parentElement !== dockHost)
        getDockHost().append(footerRelocation.footer);

    placeDockHost();
}

function findLayoutBranch(layout: HTMLElement, descendant: HTMLElement) {
    let branch = descendant;

    while (branch.parentElement && branch.parentElement !== layout)
        branch = branch.parentElement;

    return branch.parentElement === layout ? branch : descendant;
}

function findMainRegion(serverNav: HTMLElement | undefined, channelNav: HTMLElement | undefined) {
    return Array.from(document.querySelectorAll<HTMLElement>("main, [role=main]"))
        .filter(element => !serverNav?.contains(element) && !channelNav?.contains(element))
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

    const main = findMainRegion(serverNav, channelNav);
    const serverRoot = serverNav
        ? resolveWidthOwner("servers", serverNav, channelNav, 72)
        : undefined;
    const channelRoot = channelNav
        ? resolveWidthOwner("channels", channelNav, serverNav, 240)
        : undefined;

    setRoot("servers", serverRoot);
    setRoot("channels", channelRoot);

    if (!main) {
        setRoot("layout", undefined);
        setRoot("main", undefined);
        return;
    }

    const layoutParts = [serverRoot, channelRoot, main].filter((element): element is HTMLElement => element != null);
    const layout = layoutParts.length > 1 ? findCommonAncestor(layoutParts) : undefined;

    if (layout && layout !== document.body && layout !== document.documentElement) {
        setRoot("layout", layout);
        setRoot("main", findLayoutBranch(layout, main));
    } else {
        setRoot("layout", undefined);
        setRoot("main", main);
    }
}

function isVisibleRightColumn(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const elementStyle = getComputedStyle(element);

    return rect.width >= 180 && rect.width <= 500
        && rect.height >= Math.min(240, window.innerHeight * 0.4)
        && rect.right >= window.innerWidth - 80
        && elementStyle.display !== "none"
        && elementStyle.visibility !== "hidden";
}

function findMemberColumnRoot(element: HTMLElement) {
    let best: HTMLElement | undefined;
    let current: HTMLElement | null = element;

    for (let depth = 0; current && current !== document.body && depth < 10; depth++) {
        if (isVisibleRightColumn(current)) {
            best = current;
            if (current.parentElement && isHorizontalLayout(current.parentElement)) break;
        }
        current = current.parentElement;
    }

    return best;
}

function discoverMemberColumn() {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[aria-label], aside, [role=complementary]"))
        .filter(element => {
            if (roots.channels?.contains(element) || roots.servers?.contains(element)) return false;

            const label = getSemanticLabel(element);
            return /members?|member list|user profile|user information/i.test(label)
                || element.matches("aside, [role=complementary]");
        })
        .map(element => {
            const root = findMemberColumnRoot(element);
            if (!root) return;

            const rect = root.getBoundingClientRect();
            return { element, root, score: rect.height - Math.abs(rect.width - 240) };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
        .sort((a, b) => b.score - a.score);

    const match = candidates[0];
    if (!match) {
        setRoot("memberContent", undefined);
        setRoot("member", undefined);
        return;
    }

    setRoot("member", match.root);
    setRoot(
        "memberContent",
        match.root === match.element ? undefined : findLayoutBranch(match.root, match.element)
    );
}

function isFocusEnabled() {
    return settings.store.focusEnabled;
}

function FocusContextMenu() {
    const { dockLocation, pickerBehavior } = settings.use(["dockLocation", "pickerBehavior"]);

    return (
        <Menu.Menu navId="vc-sidebar-collapse" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuGroup label="Dock location">
                <Menu.MenuRadioItem
                    id="vc-sidebar-collapse-member-list"
                    group="vc-sidebar-collapse-location"
                    label="Member list"
                    checked={dockLocation === DockLocation.MemberList}
                    action={() => settings.store.dockLocation = DockLocation.MemberList}
                />
                <Menu.MenuRadioItem
                    id="vc-sidebar-collapse-chat"
                    group="vc-sidebar-collapse-location"
                    label="Chat"
                    checked={dockLocation === DockLocation.Chat}
                    action={() => settings.store.dockLocation = DockLocation.Chat}
                />
            </Menu.MenuGroup>
            <Menu.MenuSeparator />
            <Menu.MenuGroup label="Picker behavior">
                <Menu.MenuRadioItem
                    id="vc-sidebar-collapse-picker-overlay"
                    group="vc-sidebar-collapse-picker"
                    label="Overlay"
                    checked={pickerBehavior === PickerBehavior.Overlay}
                    action={() => settings.store.pickerBehavior = PickerBehavior.Overlay}
                />
                <Menu.MenuRadioItem
                    id="vc-sidebar-collapse-picker-shift"
                    group="vc-sidebar-collapse-picker"
                    label="Shift left"
                    checked={pickerBehavior === PickerBehavior.ShiftLeft}
                    action={() => settings.store.pickerBehavior = PickerBehavior.ShiftLeft}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

function FocusControl() {
    const { dockLocation, focusEnabled, pickerBehavior } = settings.use([
        "dockLocation",
        "focusEnabled",
        "pickerBehavior",
    ]);
    const activePickerView = ExpressionPickerStore.useExpressionPickerStore(state => state.activeView);

    useEffect(() => {
        document.body?.toggleAttribute(FOCUS_ATTRIBUTE, focusEnabled);
        document.body?.toggleAttribute(PICKER_OPEN_ATTRIBUTE, activePickerView != null);
        scheduleRefresh();
    }, [activePickerView, dockLocation, focusEnabled, pickerBehavior]);

    return (
        <button
            type="button"
            aria-label="Toggle Focus Mode"
            aria-pressed={focusEnabled}
            data-vc-sidebar-collapse-toggle=""
            title={focusEnabled ? "Disable Focus Mode" : "Enable Focus Mode"}
            onClick={() => settings.store.focusEnabled = !focusEnabled}
            onContextMenu={event => ContextMenuApi.openContextMenu(event, FocusContextMenu)}
        >
            Focus
        </button>
    );
}

function getToggleHost() {
    if (toggleHost) return toggleHost;

    toggleHost = document.createElement("div");
    toggleHost.setAttribute(TOGGLE_HOST_ATTRIBUTE, "");
    toggleRoot = createRoot(toggleHost);
    toggleRoot.render(<FocusControl />);
    return toggleHost;
}

function placeToggleButton() {
    const { body } = document;
    if (!body) return;

    const host = getToggleHost();
    const anchor = findFirst(TOOLBAR_ANCHOR_SELECTORS);

    if (anchor?.parentElement) {
        host.removeAttribute("data-vc-sidebar-collapse-fallback");
        if (host.parentElement !== anchor.parentElement || host.nextElementSibling !== anchor)
            anchor.parentElement.insertBefore(host, anchor);
    } else {
        host.setAttribute("data-vc-sidebar-collapse-fallback", "");
        if (host.parentElement !== body) body.append(host);
    }
}

function refresh() {
    refreshFrame = undefined;
    try {
        discoverLayout();
        discoverMemberColumn();
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

function initialize() {
    const { body } = document;
    if (!body) return;

    waitingForDom = false;
    addStyle();
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
    description: "Adds a Focus Mode that collapses Discord's sidebars and preserves the utility footer.",
    tags: ["Appearance"],
    authors: [{ name: "drind", id: 0n }],
    startAt: StartAt.DOMContentLoaded,
    settings,

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

        restoreFooter();
        removeDockHost();

        for (const kind of Object.keys(ROOT_ATTRIBUTES) as RootKind[])
            setRoot(kind, undefined);

        toggleRoot?.unmount();
        toggleRoot = undefined;
        toggleHost?.remove();
        toggleHost = undefined;

        document.body?.removeAttribute(FOCUS_ATTRIBUTE);
        document.body?.removeAttribute(PICKER_OPEN_ATTRIBUTE);
        style?.remove();
        style = undefined;
    },
});
