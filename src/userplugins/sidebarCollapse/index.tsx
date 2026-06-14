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
const FOOTER_ATTRIBUTE = "data-vc-sidebar-collapse-footer";
const DOCK_PLACEMENT_ATTRIBUTE = "data-vc-sidebar-collapse-dock-placement";
const CHAT_POSITION_ATTRIBUTE = "data-vc-sidebar-collapse-chat-position";
const ACCOUNT_PANEL_ATTRIBUTE = "data-vc-sidebar-collapse-account-panel";
const MEMBER_DOCKED_ATTRIBUTE = "data-vc-sidebar-collapse-member-docked";
const MEMBER_POSITION_ATTRIBUTE = "data-vc-sidebar-collapse-member-position";
const PICKER_OPEN_ATTRIBUTE = "data-vc-sidebar-collapse-picker-open";
const TOGGLE_HOST_ATTRIBUTE = "data-vc-sidebar-collapse-toggle-host";
const TOOLBAR_INBOX_ATTRIBUTE = "data-vc-sidebar-collapse-toolbar-inbox";

enum DockLocation {
    Chat = "chat",
    MemberList = "member",
}

enum ChatPosition {
    Bottom = "bottom",
    Top = "top",
}

enum MemberPosition {
    Bottom = "bottom",
    Top = "top",
}

const settings = definePluginSettings({
    focusEnabled: {
        type: OptionType.BOOLEAN,
        description: "Whether Focus Mode is enabled",
        default: false,
    },
    dockLocation: {
        type: OptionType.SELECT,
        description: "Whether the utility dock uses the member list or floats over chat",
        options: [
            { label: "Member list", value: DockLocation.MemberList, default: true },
            { label: "Floating over chat", value: DockLocation.Chat },
        ],
    },
    memberPosition: {
        type: OptionType.SELECT,
        description: "Which edge of the member list holds the utility dock",
        options: [
            { label: "Bottom", value: MemberPosition.Bottom, default: true },
            { label: "Top", value: MemberPosition.Top },
        ],
    },
    chatPosition: {
        type: OptionType.SELECT,
        description: "Which corner of the chat area holds the floating utility dock",
        options: [
            { label: "Bottom right", value: ChatPosition.Bottom, default: true },
            { label: "Top right", value: ChatPosition.Top },
        ],
    },
});

const ROOT_ATTRIBUTES = {
    channelContent: "data-vc-sidebar-collapse-channel-content",
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
    'nav[aria-label$="(server)" i]',
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
    [data-vc-sidebar-collapse-channel-content] {
    display: none !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-channels-root] {
    box-sizing: border-box !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: 0 !important;
    flex: 0 0 0 !important;
    flex-basis: 0 !important;
    margin-inline: 0 !important;
    overflow: visible !important;
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
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    margin: 0 4px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vc-sidebar-collapse-toggle-color, #b5bac1);
    cursor: pointer;
}

[data-vc-sidebar-collapse-toggle] svg {
    width: 20px;
    height: 20px;
}

[data-vc-sidebar-collapse-toggle]:hover {
    background: var(--background-modifier-hover, rgb(255 255 255 / 8%));
    color: var(--vc-sidebar-collapse-toggle-color, #b5bac1);
}

[data-vc-sidebar-collapse-toggle][aria-pressed="true"] {
    color: var(--vc-sidebar-collapse-toggle-color, #b5bac1);
}

[data-vc-sidebar-collapse-toggle-host] {
    position: fixed;
    z-index: 10000;
}

[data-vc-sidebar-collapse-toggle-host]
    [data-vc-sidebar-collapse-toggle] {
    margin: 0;
    background: transparent;
    box-shadow: none;
}

[data-vc-sidebar-collapse-toolbar-inbox] {
    transform: translateX(-36px);
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer] {
    position: fixed !important;
    inset: auto !important;
    z-index: 100;
    box-sizing: border-box;
    max-height: min(42vh, 320px);
    margin: 0 !important;
    overflow: auto !important;
    border-radius: 8px;
    background: var(--background-secondary-alt, #1e1f22);
    box-shadow: var(--elevation-high, 0 8px 16px rgb(0 0 0 / 24%));
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-member-docked][data-vc-sidebar-collapse-member-position="bottom"] {
    box-sizing: border-box !important;
    padding-bottom: var(--vc-sidebar-collapse-dock-height, 0px) !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-member-docked][data-vc-sidebar-collapse-member-position="top"] {
    box-sizing: border-box !important;
    padding-top: var(--vc-sidebar-collapse-dock-height, 0px) !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"] {
    left: var(--vc-sidebar-collapse-dock-left) !important;
    right: auto !important;
    width: var(--vc-sidebar-collapse-dock-width) !important;
    min-width: 0 !important;
    max-width: none !important;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"][data-vc-sidebar-collapse-member-position="bottom"] {
    top: auto !important;
    bottom: var(--vc-sidebar-collapse-dock-bottom) !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"][data-vc-sidebar-collapse-member-position="top"] {
    top: var(--vc-sidebar-collapse-dock-top) !important;
    bottom: auto !important;
    display: flex !important;
    flex-direction: column !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"][data-vc-sidebar-collapse-member-position="top"]
    > [data-vc-sidebar-collapse-account-panel] {
    order: -1;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"][data-vc-sidebar-collapse-member-position="top"]
    > #vc-spotify-player {
    order: 1;
    border-top: 1px solid var(--border-subtle) !important;
    border-bottom: 0 !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"]
    > * {
    border-radius: 0 !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="member"]
    > :last-child {
    background: var(--background-secondary-alt, #1e1f22) !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"] {
    right: var(--vc-sidebar-collapse-chat-right, 12px) !important;
    width: min(280px, var(--vc-sidebar-collapse-chat-max-width, calc(100vw - 24px))) !important;
    min-width: 0 !important;
    max-width: var(--vc-sidebar-collapse-chat-max-width, calc(100vw - 24px)) !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-chat-position="bottom"] {
    top: auto !important;
    bottom: 76px !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-chat-position="top"] {
    top: var(--vc-sidebar-collapse-chat-top, 92px) !important;
    bottom: auto !important;
    display: flex !important;
    flex-direction: column !important;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-chat-position="top"]
    > [data-vc-sidebar-collapse-account-panel] {
    order: -1;
}

body[data-vc-sidebar-collapse-focus]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"][data-vc-sidebar-collapse-chat-position="top"]
    > #vc-spotify-player {
    order: 1;
    border-top: 1px solid var(--border-subtle) !important;
    border-bottom: 0 !important;
    border-radius: 0 0 8px 8px !important;
}

body[data-vc-sidebar-collapse-picker-open]
    [data-vc-sidebar-collapse-footer][data-vc-sidebar-collapse-dock-placement="chat"] {
    z-index: 1;
}
`;

type RootKind = keyof typeof ROOT_ATTRIBUTES;

let observer: MutationObserver | undefined;
let refreshFrame: number | undefined;
let style: HTMLStyleElement | undefined;
let waitingForDom = false;
let toggleHost: HTMLDivElement | undefined;
let toggleRoot: ReturnType<typeof createRoot> | undefined;
let footerStack: HTMLElement | undefined;
let footerAccountPanel: HTMLElement | undefined;
let footerResizeObserver: ResizeObserver | undefined;
let dockedMemberRoot: HTMLElement | undefined;
let toolbarInbox: HTMLElement | undefined;

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

function findFooterElements() {
    const channelRoot = roots.channels?.isConnected ? roots.channels : undefined;

    const mute = findAccountControl(document.body, /^(?:un)?mute(?:\b|\s)/i);
    const deafen = findAccountControl(document.body, /^(?:un)?deafen(?:\b|\s)/i);
    const settings = findAccountControl(document.body, /^user settings(?:\b|\s)/i);
    if (!mute || !deafen || !settings) return;

    const accountPanel = findCommonAncestor([mute, deafen, settings]);
    if (!accountPanel) return;

    if (footerStack?.isConnected && footerStack.contains(accountPanel))
        return { accountPanel, stack: footerStack };

    let utilityStack = accountPanel;

    for (let candidate = accountPanel.parentElement; candidate && candidate !== channelRoot; candidate = candidate.parentElement) {
        const { height } = candidate.getBoundingClientRect();
        const isTooTallForUtilityStack = height > Math.max(500, window.innerHeight * 0.65);
        if (candidate === document.body || candidate.querySelector("nav, main, [role=main]") || isTooTallForUtilityStack) break;
        utilityStack = candidate;
    }

    return { accountPanel, stack: utilityStack };
}

function clearDockedMember() {
    dockedMemberRoot?.removeAttribute(MEMBER_DOCKED_ATTRIBUTE);
    dockedMemberRoot?.removeAttribute(MEMBER_POSITION_ATTRIBUTE);
    dockedMemberRoot?.style.removeProperty("--vc-sidebar-collapse-dock-height");
    dockedMemberRoot?.style.removeProperty("padding-top");
    dockedMemberRoot?.style.removeProperty("padding-bottom");
    dockedMemberRoot = undefined;
}

function clearFooterDock() {
    footerResizeObserver?.disconnect();
    footerResizeObserver = undefined;
    clearDockedMember();

    if (!footerStack) return;

    footerAccountPanel?.removeAttribute(ACCOUNT_PANEL_ATTRIBUTE);
    footerAccountPanel = undefined;
    footerStack.removeAttribute(FOOTER_ATTRIBUTE);
    footerStack.removeAttribute(DOCK_PLACEMENT_ATTRIBUTE);
    footerStack.removeAttribute(CHAT_POSITION_ATTRIBUTE);
    footerStack.removeAttribute(MEMBER_POSITION_ATTRIBUTE);
    footerStack.style.removeProperty("--vc-sidebar-collapse-dock-left");
    footerStack.style.removeProperty("--vc-sidebar-collapse-dock-bottom");
    footerStack.style.removeProperty("--vc-sidebar-collapse-dock-top");
    footerStack.style.removeProperty("--vc-sidebar-collapse-dock-width");
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-top");
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-right");
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-max-width");
    footerStack = undefined;
}

function setFooterStack(footer: HTMLElement, accountPanel: HTMLElement) {
    const accountPanelItem = footer === accountPanel
        ? accountPanel
        : findLayoutBranch(footer, accountPanel);

    if (footerStack === footer) {
        if (footerAccountPanel !== accountPanelItem) {
            footerAccountPanel?.removeAttribute(ACCOUNT_PANEL_ATTRIBUTE);
            footerAccountPanel = accountPanelItem;
            footerAccountPanel.setAttribute(ACCOUNT_PANEL_ATTRIBUTE, "");
        }
        return;
    }

    clearFooterDock();
    footerStack = footer;
    footerAccountPanel = accountPanelItem;
    footerAccountPanel.setAttribute(ACCOUNT_PANEL_ATTRIBUTE, "");
    footerResizeObserver = new ResizeObserver(scheduleRefresh);
    footerResizeObserver.observe(footer);
}

function getChatTopOffset() {
    const toolbarControl = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]"))
        .find(element => /^(?:help|inbox)$/i.test(getSemanticLabel(element)));
    let toolbar: HTMLElement | null = toolbarControl ?? null;

    for (let depth = 0; toolbar && toolbar !== document.body && depth < 8; depth++) {
        const rect = toolbar.getBoundingClientRect();
        if (rect.top < 100
            && rect.height >= 32
            && rect.height <= 100
            && rect.width >= Math.min(320, window.innerWidth * 0.4))
            return Math.max(92, Math.ceil(rect.bottom + 32));

        toolbar = toolbar.parentElement;
    }

    return 92;
}

function updateFooterDock() {
    if (!isFocusEnabled()) {
        clearFooterDock();
        return;
    }

    const discoveredFooter = findFooterElements();
    if (discoveredFooter) setFooterStack(discoveredFooter.stack, discoveredFooter.accountPanel);
    if (!footerStack?.isConnected) {
        clearFooterDock();
        return;
    }

    clearDockedMember();
    footerStack.setAttribute(FOOTER_ATTRIBUTE, "");
    footerStack.setAttribute(CHAT_POSITION_ATTRIBUTE, settings.store.chatPosition);
    footerStack.setAttribute(MEMBER_POSITION_ATTRIBUTE, settings.store.memberPosition);

    const memberRoot = roots.member;
    const memberListVisible = memberRoot?.isConnected && isVisibleRightColumn(memberRoot);
    const useMemberList = settings.store.dockLocation === DockLocation.MemberList
        && memberListVisible;

    if (!useMemberList) {
        const memberRect = memberListVisible ? memberRoot.getBoundingClientRect() : undefined;
        const chatRight = memberRect ? window.innerWidth - memberRect.left + 12 : 12;
        const chatMaxWidth = memberRect ? memberRect.left - 24 : window.innerWidth - 24;

        footerStack.setAttribute(DOCK_PLACEMENT_ATTRIBUTE, DockLocation.Chat);
        footerStack.style.setProperty("--vc-sidebar-collapse-chat-top", `${getChatTopOffset()}px`);
        footerStack.style.setProperty("--vc-sidebar-collapse-chat-right", `${chatRight}px`);
        footerStack.style.setProperty("--vc-sidebar-collapse-chat-max-width", `${Math.max(0, chatMaxWidth)}px`);
        footerStack.style.removeProperty("--vc-sidebar-collapse-dock-left");
        footerStack.style.removeProperty("--vc-sidebar-collapse-dock-bottom");
        footerStack.style.removeProperty("--vc-sidebar-collapse-dock-top");
        footerStack.style.removeProperty("--vc-sidebar-collapse-dock-width");
        return;
    }

    const memberRect = memberRoot.getBoundingClientRect();
    footerStack.setAttribute(DOCK_PLACEMENT_ATTRIBUTE, DockLocation.MemberList);
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-top");
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-right");
    footerStack.style.removeProperty("--vc-sidebar-collapse-chat-max-width");
    footerStack.style.setProperty("--vc-sidebar-collapse-dock-left", `${memberRect.left}px`);
    footerStack.style.setProperty("--vc-sidebar-collapse-dock-bottom", `${window.innerHeight - memberRect.bottom}px`);
    footerStack.style.setProperty("--vc-sidebar-collapse-dock-top", `${memberRect.top}px`);
    footerStack.style.setProperty("--vc-sidebar-collapse-dock-width", `${memberRect.width}px`);

    dockedMemberRoot = memberRoot;
    dockedMemberRoot.setAttribute(MEMBER_DOCKED_ATTRIBUTE, "");
    dockedMemberRoot.setAttribute(MEMBER_POSITION_ATTRIBUTE, settings.store.memberPosition);
    dockedMemberRoot.style.setProperty("--vc-sidebar-collapse-dock-height", `${footerStack.getBoundingClientRect().height}px`);
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

function resolveWidthOwner(kind: "servers" | "channelContent", nav: HTMLElement, otherNav: HTMLElement | undefined, expectedWidth: number) {
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
    const channelContent = channelNav
        ? resolveWidthOwner("channelContent", channelNav, serverNav, 240)
        : undefined;
    const footer = findFooterElements()?.stack;
    const channelShell = channelContent && footer
        ? findCommonAncestor([channelContent, footer])
        : undefined;
    const channelRoot = channelShell && channelShell !== document.body && channelShell !== document.documentElement
        ? channelShell
        : channelContent;

    setRoot("servers", serverRoot);
    setRoot("channelContent", channelContent);
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
    const { chatPosition, dockLocation, memberPosition } = settings.use([
        "chatPosition",
        "dockLocation",
        "memberPosition",
    ]);
    const memberListAvailable = roots.member?.isConnected && isVisibleRightColumn(roots.member);
    const effectivePlacement = dockLocation === DockLocation.MemberList && memberListAvailable
        ? DockLocation.MemberList
        : DockLocation.Chat;

    return (
        <Menu.Menu navId="vc-sidebar-collapse" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuGroup label="Placement">
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
                    label="Floating over chat"
                    checked={dockLocation === DockLocation.Chat}
                    action={() => settings.store.dockLocation = DockLocation.Chat}
                />
            </Menu.MenuGroup>
            <Menu.MenuSeparator />
            {effectivePlacement === DockLocation.MemberList ? (
                <Menu.MenuGroup label="Member list position">
                    <Menu.MenuRadioItem
                        id="vc-sidebar-collapse-member-bottom"
                        group="vc-sidebar-collapse-member-position"
                        label="Bottom"
                        checked={memberPosition === MemberPosition.Bottom}
                        action={() => settings.store.memberPosition = MemberPosition.Bottom}
                    />
                    <Menu.MenuRadioItem
                        id="vc-sidebar-collapse-member-top"
                        group="vc-sidebar-collapse-member-position"
                        label="Top"
                        checked={memberPosition === MemberPosition.Top}
                        action={() => settings.store.memberPosition = MemberPosition.Top}
                    />
                </Menu.MenuGroup>
            ) : (
                <Menu.MenuGroup label="Floating position">
                    <Menu.MenuRadioItem
                        id="vc-sidebar-collapse-chat-bottom"
                        group="vc-sidebar-collapse-chat-position"
                        label="Bottom right"
                        checked={chatPosition === ChatPosition.Bottom}
                        action={() => settings.store.chatPosition = ChatPosition.Bottom}
                    />
                    <Menu.MenuRadioItem
                        id="vc-sidebar-collapse-chat-top"
                        group="vc-sidebar-collapse-chat-position"
                        label="Top right"
                        checked={chatPosition === ChatPosition.Top}
                        action={() => settings.store.chatPosition = ChatPosition.Top}
                    />
                </Menu.MenuGroup>
            )}
        </Menu.Menu>
    );
}

function FocusControl() {
    const { chatPosition, dockLocation, focusEnabled, memberPosition } = settings.use([
        "chatPosition",
        "dockLocation",
        "focusEnabled",
        "memberPosition",
    ]);
    const activePickerView = ExpressionPickerStore.useExpressionPickerStore(state => state.activeView);

    useEffect(() => {
        document.body?.toggleAttribute(FOCUS_ATTRIBUTE, focusEnabled);
        document.body?.toggleAttribute(PICKER_OPEN_ATTRIBUTE, activePickerView != null);
        window.dispatchEvent(new Event("resize"));
        scheduleRefresh();
    }, [activePickerView, chatPosition, dockLocation, focusEnabled, memberPosition]);

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
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fill="currentColor"
                    d={focusEnabled
                        ? "M9 3H7v4H3v2h6V3Zm6 0v6h6V7h-4V3h-2ZM3 15v2h4v4h2v-6H3Zm12 0v6h2v-4h4v-2h-6Z"
                        : "M5 3a2 2 0 0 0-2 2v4h2V5h4V3H5Zm10 0v2h4v4h2V5a2 2 0 0 0-2-2h-4ZM3 15v4a2 2 0 0 0 2 2h4v-2H5v-4H3Zm16 0v4h-4v2h4a2 2 0 0 0 2-2v-4h-2Z"}
                />
            </svg>
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
    const toolbarButtons = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]"));
    const inbox = toolbarButtons.find(element => /^inbox$/i.test(getSemanticLabel(element)));
    const help = toolbarButtons.find(element => /^help$/i.test(getSemanticLabel(element)));

    if (toolbarInbox !== inbox) {
        toolbarInbox?.removeAttribute(TOOLBAR_INBOX_ATTRIBUTE);
        toolbarInbox = inbox;
    }

    if (inbox && help) {
        const helpRect = help.getBoundingClientRect();

        inbox.setAttribute(TOOLBAR_INBOX_ATTRIBUTE, "");
        host.style.left = `${helpRect.left - 36}px`;
        host.style.top = `${helpRect.top}px`;
        host.style.setProperty("--vc-sidebar-collapse-toggle-color", getComputedStyle(inbox).color);
    }

    if (host.parentElement !== body) body.append(host);
}

function refresh() {
    refreshFrame = undefined;
    try {
        discoverLayout();
        discoverMemberColumn();
        placeToggleButton();
        updateFooterDock();
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
    window.addEventListener("resize", scheduleRefresh);
}

export default definePlugin({
    name: "SidebarCollapse",
    description: "Adds a Focus Mode that collapses Discord's sidebars and preserves the utility footer.",
    tags: ["Appearance"],
    authors: [{ name: "drind", id: 0n }],
    startAt: StartAt.WebpackReady,
    settings,
    patches: [{
        find: "showCallOrActivityPanel",
        replacement: {
            match: /window\.innerWidth>=1132/g,
            replace: "$&||document.body.hasAttribute('data-vc-sidebar-collapse-focus')",
        },
    }],

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

        window.removeEventListener("resize", scheduleRefresh);
        clearFooterDock();

        for (const kind of Object.keys(ROOT_ATTRIBUTES) as RootKind[])
            setRoot(kind, undefined);

        toggleRoot?.unmount();
        toggleRoot = undefined;
        toggleHost?.remove();
        toggleHost = undefined;
        toolbarInbox?.removeAttribute(TOOLBAR_INBOX_ATTRIBUTE);
        toolbarInbox = undefined;

        document.body?.removeAttribute(FOCUS_ATTRIBUTE);
        document.body?.removeAttribute(PICKER_OPEN_ATTRIBUTE);
        style?.remove();
        style = undefined;
    },
});
