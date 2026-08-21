"use client";

import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type GuideTipLinkAction = {
  label: string;
  href: string;
  onAction?: never;
};

export type GuideTipLocalAction = {
  label: string;
  onAction: () => void;
  href?: never;
};

export type GuideTipAction = GuideTipLinkAction | GuideTipLocalAction;

export type GuideTipProps = {
  title: string;
  shortDescription: string;
  whatQuantaraDoes: string;
  whatProfessionalCanDo: string;
  cta?: GuideTipAction;
  ariaLabel?: string;
  className?: string;
};

type DesktopPanelPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

/**
 * Compact professional guidance that works as a hover/focus disclosure on
 * desktop and a tap-to-toggle disclosure on touch devices. Clicking an open
 * tip pins it; a second click, Escape, or an outside click closes it.
 */
export function GuideTip({
  title,
  shortDescription,
  whatQuantaraDoes,
  whatProfessionalCanDo,
  cta,
  ariaLabel,
  className = "",
}: GuideTipProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [desktopPanelPosition, setDesktopPanelPosition] = useState<DesktopPanelPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatedId = useId();
  const panelId = `guide-tip-${generatedId.replace(/:/g, "")}`;
  const titleId = `${panelId}-title`;
  const descriptionId = `${panelId}-description`;
  const isOpen = isPinned || (!isDismissed && (isHovering || hasFocusWithin));

  function cancelHoverClose() {
    if (hoverCloseTimerRef.current === null) return;
    clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  }

  function handleHoverEnter() {
    cancelHoverClose();
    setIsHovering(true);
    setIsDismissed(false);
  }

  function handleHoverLeave() {
    cancelHoverClose();
    // The desktop disclosure is fixed and intentionally separated from its
    // trigger by a small visual gap. Keep it mounted while the pointer crosses
    // that gap so its CTA remains reachable without requiring a click-pin.
    hoverCloseTimerRef.current = setTimeout(() => {
      setIsHovering(false);
      hoverCloseTimerRef.current = null;
    }, 180);
  }

  useEffect(() => () => {
    if (hoverCloseTimerRef.current !== null) {
      clearTimeout(hoverCloseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const focusBelongsToThisTip = document.activeElement !== null
        && containerRef.current?.contains(document.activeElement) === true;
      // Restore focus only for keyboard interaction within this disclosure.
      // A hover-open tip must not take focus from an unrelated control.
      if (focusBelongsToThisTip) {
        triggerRef.current?.focus();
      }
      setIsPinned(false);
      setIsDismissed(true);
      setIsHovering(false);
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsPinned(false);
      setIsDismissed(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setDesktopPanelPosition(null);
      return;
    }

    let animationFrame = 0;
    function updatePosition() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (window.innerWidth < 640 || !triggerRef.current || !panelRef.current) {
          setDesktopPanelPosition(null);
          return;
        }

        const viewportPadding = 16;
        const panelGap = 8;
        const width = Math.min(320, window.innerWidth - viewportPadding * 2);
        const triggerBounds = triggerRef.current.getBoundingClientRect();
        const naturalHeight = panelRef.current.scrollHeight;
        const availableBelow = window.innerHeight - triggerBounds.bottom - panelGap - viewportPadding;
        const availableAbove = triggerBounds.top - panelGap - viewportPadding;
        const placeBelow = availableBelow >= Math.min(naturalHeight, 240) || availableBelow >= availableAbove;
        const availableHeight = Math.max(80, placeBelow ? availableBelow : availableAbove);
        const renderedHeight = Math.min(naturalHeight, availableHeight);
        const left = Math.min(
          Math.max(triggerBounds.left + triggerBounds.width / 2 - width / 2, viewportPadding),
          window.innerWidth - width - viewportPadding,
        );
        const top = placeBelow
          ? triggerBounds.bottom + panelGap
          : Math.max(viewportPadding, triggerBounds.top - panelGap - renderedHeight);

        setDesktopPanelPosition({ left, top, width, maxHeight: availableHeight });
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [cta, isOpen, shortDescription, title, whatProfessionalCanDo, whatQuantaraDoes]);

  function handlePinToggle() {
    if (isPinned) {
      setIsPinned(false);
      setIsDismissed(true);
      return;
    }

    setIsPinned(true);
    setIsDismissed(false);
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`.trim()}
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
      onFocusCapture={() => {
        setHasFocusWithin(true);
        setIsDismissed(false);
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setHasFocusWithin(false);
        if (!isPinned) setIsDismissed(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? `Guide: ${title}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={handlePinToggle}
        className="group inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#009FE3]/35 bg-[#009FE3]/10 text-[#0077B6] shadow-[0_0_0_rgba(0,159,227,0)] transition hover:border-[#009FE3]/70 hover:bg-[#009FE3]/15 hover:shadow-[0_0_16px_rgba(0,159,227,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] dark:border-[#21C7F3]/35 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3] dark:hover:border-[#21C7F3]/70 dark:hover:bg-[#21C7F3]/15 dark:hover:shadow-[0_0_18px_rgba(33,199,243,0.24)] dark:focus-visible:outline-[#21C7F3]"
      >
        <Lightbulb className="h-4 w-4 transition-transform group-hover:scale-105" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
          style={desktopPanelPosition ?? undefined}
          className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#009FE3]/35 bg-white p-5 text-left text-[#08152E] shadow-[0_18px_60px_rgba(8,21,46,0.22),0_0_24px_rgba(0,159,227,0.1)] dark:border-[#21C7F3]/35 dark:bg-[#091326] dark:text-white dark:shadow-[0_18px_60px_rgba(0,0,0,0.5),0_0_26px_rgba(33,199,243,0.12)] sm:inset-x-auto sm:bottom-auto sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#009FE3]/30 bg-[#009FE3]/10 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10">
              <Lightbulb className="h-4 w-4 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 id={titleId} className="text-sm font-semibold text-[#08152E] dark:text-white">
                {title}
              </h3>
              <p id={descriptionId} className="mt-1 text-xs leading-5 text-[#536078] dark:text-[#B8C4D8]">
                {shortDescription}
              </p>
            </div>
          </div>

          <dl className="mt-4 space-y-3 border-t border-[#D5E0EC] pt-4 dark:border-[#20304D]">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0077B6] dark:text-[#21C7F3]">
                What Quantara does
              </dt>
              <dd className="mt-1 text-xs leading-5 text-[#536078] dark:text-[#B8C4D8]">{whatQuantaraDoes}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0077B6] dark:text-[#21C7F3]">
                What you can do
              </dt>
              <dd className="mt-1 text-xs leading-5 text-[#536078] dark:text-[#B8C4D8]">{whatProfessionalCanDo}</dd>
            </div>
          </dl>

          {cta ? (
            typeof cta.href === "string" ? (
              <Link
                href={cta.href}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#009FE3] bg-[#009FE3] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] dark:border-[#21C7F3] dark:bg-[#21C7F3] dark:text-[#040A16] dark:focus-visible:outline-[#21C7F3]"
              >
                {cta.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsPinned(false);
                  setIsDismissed(true);
                  setIsHovering(false);
                  cta.onAction();
                }}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#009FE3] bg-[#009FE3] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] dark:border-[#21C7F3] dark:bg-[#21C7F3] dark:text-[#040A16] dark:focus-visible:outline-[#21C7F3]"
              >
                {cta.label}
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default GuideTip;
