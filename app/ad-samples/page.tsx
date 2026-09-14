"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";

const TAB_LABEL = "Ad Samples";

// Static email creative served from /public.
const EMAIL_SAMPLE = {
  title: "ASSA ABLOY – The Critical Role of Access Control in K-12 School Safety (email)",
  src: "/email-samples/assa-abloy-asset2-critical-role-of-access-control.html",
};

const CLOUDINARY = "https://res.cloudinary.com/dkfcflgtp/image/upload/v1789390542/";
const CLOUDINARY_SOCIAL = "https://res.cloudinary.com/dkfcflgtp/image/upload/v1789391679/";

type Ad = { src: string; width: number; height: number; alt: string; label: string };

const SOCIAL_ADS: Ad[] = [
  { src: `${CLOUDINARY_SOCIAL}5f5533f7-a5c5-4f87-925b-b92d9e26d58e_fyynyn.png`, width: 465, height: 490, alt: "ASSA ABLOY LinkedIn sponsored post: Is your school's security foundation strong enough?", label: "LinkedIn" },
  { src: `${CLOUDINARY_SOCIAL}image001_nzqhkb.png`, width: 307, height: 551, alt: "ASSA ABLOY Facebook ad: Is your school's security foundation strong enough?", label: "Facebook" },
];

const DISPLAY_ALT = "ASSA ABLOY display ad";

const DISPLAY_ADS = {
  mediumRectangle: { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_300x250px_x1pdon.png`, width: 300, height: 250 },
  halfPage:        { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_300x600px_rmxylj.png`, width: 300, height: 600 },
  billboard:       { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_970x250px_exnm4r.png`, width: 970, height: 250 },
  leaderboard:     { src: `${CLOUDINARY}datia_datiak12_cbl_ASSA_ABLOY_assaabloyabm2026_asset02_728x90px_nlkjgj.png`, width: 728, height: 90 },
};

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="bg-white border border-gray-200 shadow-md py-3 text-center text-lg font-bold tracking-wide uppercase text-gray-900">
      {children}
    </h2>
  );
}

function DisplayAd({ ad, label, alt }: { ad: { src: string; width: number; height: number }; label: string; alt?: string }) {
  return (
    <figure className="m-0" style={{ width: ad.width, maxWidth: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.src}
        width={ad.width}
        height={ad.height}
        alt={alt ?? `${DISPLAY_ALT} (${label})`}
        loading="lazy"
        className="block w-full h-auto shadow-sm"
      />
      <figcaption className="mt-1 text-xs text-gray-400">{label}</figcaption>
    </figure>
  );
}

function EmailPreview() {
  const [height, setHeight] = useState(900);

  return (
    <iframe
      src={EMAIL_SAMPLE.src}
      title={EMAIL_SAMPLE.title}
      style={{ display: "block", width: "100%", height, border: 0 }}
      // Same-origin file, so size the iframe to its content instead of scrolling inside it.
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument;
        const table = doc?.querySelector("center");
        if (table) setHeight(Math.ceil(table.getBoundingClientRect().height));
      }}
    />
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
        <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm bg-white p-6">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_600px] 2xl:grid-cols-[minmax(0,1fr)_600px_minmax(0,1.2fr)]">
            <section className="flex flex-col gap-6 min-w-0">
              <ColumnHeading>Social Media</ColumnHeading>
              <div className="flex flex-col items-center gap-8">
                {SOCIAL_ADS.map((ad) => (
                  <DisplayAd key={ad.src} ad={ad} label={ad.label} alt={ad.alt} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-6 min-w-0">
              <ColumnHeading>Email</ColumnHeading>
              <div className="w-full max-w-[600px] mx-auto shadow-sm">
                <EmailPreview />
              </div>
            </section>

            <section className="flex flex-col gap-6 min-w-0 xl:col-span-2 2xl:col-span-1">
              <ColumnHeading>Digital Display</ColumnHeading>
              <div className="flex flex-col items-center gap-8">
                <div className="flex flex-wrap items-end justify-center gap-8 w-full">
                  <DisplayAd ad={DISPLAY_ADS.mediumRectangle} label="300 × 250" />
                  <DisplayAd ad={DISPLAY_ADS.halfPage} label="300 × 600" />
                </div>
                <DisplayAd ad={DISPLAY_ADS.billboard} label="970 × 250" />
                <DisplayAd ad={DISPLAY_ADS.leaderboard} label="728 × 90" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
