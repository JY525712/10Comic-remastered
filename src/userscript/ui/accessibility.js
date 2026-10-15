// One focus stack is shared by confirmation, diagnostics, help and drawers.
const modalFocusStack = [];

let modalFocusListenersReady = false;

function resetModalFocus() {
    modalFocusStack.length = 0;
    document.removeEventListener("keydown", handleModalKeydown, true);
    document.removeEventListener("focusin", keepModalFocus, true);
    modalFocusListenersReady = false;
}

function modalFocusables(dialog) {
    return [ ...dialog.querySelectorAll("button, input, select, textarea, a[href], [tabindex]") ].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility === "visible");
}

function activateModalFocus(id, preferredSelector) {
    const overlay = byId(id);
    const dialog = overlay?.querySelector('[role="dialog"], [role="alertdialog"]');
    if (!dialog) return;
    overlay.inert = false;
    if (!modalFocusStack.some(entry => entry.id === id)) {
        modalFocusStack.push({
            id: id,
            dialog: dialog,
            returnFocus: document.activeElement
        });
    }
    if (!modalFocusListenersReady) {
        document.addEventListener("keydown", handleModalKeydown, true);
        document.addEventListener("focusin", keepModalFocus, true);
        modalFocusListenersReady = true;
    }
    dialog.setAttribute("tabindex", "-1");
    const target = preferredSelector && dialog.querySelector(preferredSelector);
    (target || modalFocusables(dialog)[0] || dialog).focus({
        preventScroll: true
    });
}

function releaseModalFocus(id) {
    const index = modalFocusStack.findIndex(entry => entry.id === id);
    byId(id) && (byId(id).inert = true);
    if (index < 0) return;
    const wasTop = index === modalFocusStack.length - 1;
    const [entry] = modalFocusStack.splice(index, 1);
    if (!wasTop) return;
    const top = modalFocusStack[modalFocusStack.length - 1];
    const target = entry.returnFocus;
    if (target?.isConnected && !target.closest("[inert]") && target.getClientRects().length && (!top || top.dialog.contains(target))) {
        target.focus({
            preventScroll: true
        });
    } else if (top) (modalFocusables(top.dialog)[0] || top.dialog).focus({
        preventScroll: true
    });
}

function keepModalFocus(event) {
    const entry = modalFocusStack[modalFocusStack.length - 1];
    if (entry && !entry.dialog.contains(event.target)) {
        (modalFocusables(entry.dialog)[0] || entry.dialog).focus({
            preventScroll: true
        });
    }
}

function handleModalKeydown(event) {
    const entry = modalFocusStack[modalFocusStack.length - 1];
    if (!entry || event.defaultPrevented) return false;
    if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (entry.id === "ten-confirm") closeConfirm(false); else if (entry.id === "ten-diagnostic") closeDiagnostic(); else if (entry.id === "ten-rule-guide") closeRuleGuide(); else if (entry.id === "ten-mobile-drawer") closeMobileDrawer();
        return true;
    }
    if (event.key !== "Tab") return false;
    const focusables = modalFocusables(entry.dialog);
    const index = focusables.indexOf(document.activeElement);
    if (!focusables.length || index < 0 || (event.shiftKey ? index === 0 : index === focusables.length - 1)) {
        event.preventDefault();
        event.stopPropagation();
        (focusables[event.shiftKey ? focusables.length - 1 : 0] || entry.dialog).focus({
            preventScroll: true
        });
        return true;
    }
    return false;
}
