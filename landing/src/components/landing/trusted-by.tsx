"use client";

import { Fragment, type ReactNode } from "react";

import {
  CreemLogo,
  LemonSqueezyLogo,
  PaddleLogo,
  PayPalLogo,
  PolarLogo,
  StripeLogo,
} from "./provider-logos";

const providers: { name: string; icon: ReactNode }[] = [
  { name: "Paddle", icon: <PaddleLogo className="-mx-0.5 h-5.5" /> },
  { name: "Stripe", icon: <StripeLogo className="h-5" /> },
  { name: "Creem", icon: <CreemLogo className="h-4.5" /> },
  { name: "PayPal", icon: <PayPalLogo className="h-4.5" /> },
  { name: "Lemon Squeezy", icon: <LemonSqueezyLogo className="h-4.5" /> },
  { name: "Polar", icon: <PolarLogo className="mb-0.5 h-5.5" /> },
];

function ProviderItem({ icon }: { icon: ReactNode }) {
  return (
    <div className="text-foreground/60 dark:text-foreground/40 flex shrink-0 items-center gap-2">
      <span className="shrink-0">{icon}</span>
    </div>
  );
}

export function TrustedBy() {
  return (
    <div className="space-y-3">
      <div className="relative overflow-x-clip">
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          }}
        >
          <div className="animate-logo-marquee flex w-fit gap-10.5 pl-4">
            {[0, 1].map((setIdx) => (
              <Fragment key={setIdx}>
                {providers.map((provider, i) => (
                  <ProviderItem key={`${setIdx}-${i}-${provider.name}`} icon={provider.icon} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
        {/* Invisible spacer to maintain height */}
        <div className="invisible flex" aria-hidden="true">
          {providers.slice(0, 1).map((provider, i) => (
            <ProviderItem key={`spacer-${i}`} icon={provider.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
