"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "spliceforge:canvas-tour:v1";

export function CanvasTour() {
  const t = useTranslations("canvas.tour");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (seen && !welcome) return;

    const timer = window.setTimeout(() => {
      const d = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: tCommon("next"),
        prevBtnText: tCommon("back"),
        doneBtnText: tCommon("finish"),
        steps: [
          {
            popover: { title: t("welcomeTitle"), description: t("welcomeBody") },
          },
          {
            element: '[data-tour="toolbar"]',
            popover: { title: t("toolbarTitle"), description: t("toolbarBody"), side: "bottom", align: "center" },
          },
          {
            element: '[data-tour="export"]',
            popover: { title: t("exportTitle"), description: t("exportBody"), side: "bottom", align: "end" },
          },
          {
            popover: { title: t("tipTitle"), description: t("tipBody") },
          },
        ],
        onDestroyed: () => {
          window.localStorage.setItem(STORAGE_KEY, "1");
        },
      });
      d.drive();
    }, 400);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  return null;
}
