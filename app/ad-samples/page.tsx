"use client";

import { useEffect, useRef, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";

const TAB_LABEL = "Ad Samples";

// Static email creative served from /public.
const EMAIL_SAMPLE = {
  title: "ASSA ABLOY – The Critical Role of Access Control in K-12 School Safety (email)",
  src: "/email-samples/assa-abloy-asset2-critical-role-of-access-control.html",
  // One pixel wider than the email's `max-width: 600px` mobile breakpoint so its desktop layout renders.
  width: 601,
};

const CLOUDINARY = "https://res.cloudinary.com/dkfcflgtp/image/upload/v1789390542/";
const CLOUDINARY_SOCIAL = "https://res.cloudinary.com/dkfcflgtp/image/upload/v1789391679/";

type Ad = { src: string; width: number; height: number; alt: string };

const SOCIAL_ADS: Ad[] = [
  { src: `${CLOUDINARY_SOCIAL}5f5533f7-a5c5-4f87-925b-b92d9e26d58e_fyynyn.png`, width: 465, height: 490, alt: "ASSA ABLOY LinkedIn sponsored post: Is your school's security foundation strong enough?" },
  { src: `${CLOUDINARY_SOCIAL}image001_nzqhkb.png`, width: 307, height: 551, alt: "ASSA ABLOY Facebook ad: Is your school's security foundation strong enough?" },
];

const DISPLAY_ADS: Record<"mediumRectangle" | "halfPage" | "billboard" | "leaderboard", Ad> = {
  mediumRectangle: { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_300x250px_x1pdon.png`, width: 300, height: 250, alt: "ASSA ABLOY display ad (300 × 250)" },
  halfPage:        { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_300x600px_rmxylj.png`, width: 300, height: 600, alt: "ASSA ABLOY display ad (300 × 600)" },
  billboard:       { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_970x250px_exnm4r.png`, width: 970, height: 250, alt: "ASSA ABLOY display ad (970 × 250)" },
  leaderboard:     { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_728x90px_nlkjgj.png`, width: 728, height: 90, alt: "ASSA ABLOY display ad (728 × 90)" },
};

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] py-3 text-center text-xl font-bold tracking-wide uppercase text-gray-900">
      {children}
    </h2>
  );
}

function AdImage({ ad, className = "" }: { ad: Ad; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ad.src}
      width={ad.width}
      height={ad.height}
      alt={ad.alt}
      loading="lazy"
      className={`block h-auto ${className}`}
      style={{ width: ad.width, maxWidth: "100%" }}
    />
  );
}

/** Renders the 600px email at full fidelity, scaled down to fit its column. */
function EmailPreview() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(1000);
  const [scale, setScale] = useState(1);

  // Same-origin file, so size the iframe to its content instead of scrolling inside it.
  const measure = () => {
    const content = iframeRef.current?.contentDocument?.querySelector("center");
    if (content) setContentHeight(Math.ceil(content.getBoundingClientRect().height));
  };

  useEffect(() => {
    // The iframe can finish loading before hydration attaches onLoad, so measure now as well.
    if (iframeRef.current?.contentDocument?.readyState === "complete") measure();

    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / EMAIL_SAMPLE.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="w-full">
      <div
        className="mx-auto overflow-hidden"
        style={{ width: EMAIL_SAMPLE.width * scale, height: contentHeight * scale }}
      >
        <iframe
          ref={iframeRef}
          src={EMAIL_SAMPLE.src}
          title={EMAIL_SAMPLE.title}
          scrolling="no"
          style={{
            display: "block",
            width: EMAIL_SAMPLE.width,
            height: contentHeight,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          onLoad={measure}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "12rem",
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f9fafb",
        zIndex: 1,
      }}
    >
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl">
          <span className="font-bold text-sm tracking-wide uppercase">{TAB_LABEL}</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm bg-white px-6 py-8">
          {/* Three columns side by side, proportioned like the approved mockup; stacks only on small screens. */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.17fr)] lg:gap-8">
            <section className="flex flex-col gap-12 min-w-0">
              <ColumnHeading>Social Media</ColumnHeading>
              <div className="flex flex-col items-center gap-16 px-[8%]">
                <AdImage ad={SOCIAL_ADS[0]} />
                {/* Facebook sits narrower than the LinkedIn post, as in the mockup. */}
                <div className="w-[66%] flex justify-center">
                  <AdImage ad={SOCIAL_ADS[1]} />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-12 min-w-0">
              <ColumnHeading>Email</ColumnHeading>
              <div className="px-[8%]">
                <EmailPreview />
              </div>
            </section>

            <section className="flex flex-col gap-12 min-w-0">
              <ColumnHeading>Digital Display</ColumnHeading>
              <div className="flex flex-col items-end gap-10 pl-[6%]">
                <div className="flex items-end justify-between gap-[10%] w-full pl-[4%] pr-[7%]">
                  <div className="min-w-0" style={{ flex: "0 1 60%" }}>
                    <AdImage ad={DISPLAY_ADS.mediumRectangle} className="w-full!" />
                  </div>
                  <div className="min-w-0" style={{ flex: "0 1 40%" }}>
                    <AdImage ad={DISPLAY_ADS.halfPage} className="w-full!" />
                  </div>
                </div>
                <AdImage ad={DISPLAY_ADS.billboard} className="w-full!" />
                <AdImage ad={DISPLAY_ADS.leaderboard} className="w-full!" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
