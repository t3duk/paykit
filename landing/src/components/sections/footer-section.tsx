"use client";

import { Github } from "lucide-react";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { Section, SectionContent } from "@/components/layout/section";
import { URLs } from "@/lib/consts";

const navLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Author", href: URLs.authorX, external: true },
];

export function FooterSection() {
  return (
    <Section last>
      <SectionContent>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {navLinks.map((link, i) => (
              <span key={link.label} className="flex items-center">
                <Link
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-foreground/45 hover:text-foreground/70 font-mono text-xs transition-colors"
                >
                  {link.label}
                </Link>
                {i < navLinks.length - 1 && (
                  <span className="text-foreground/15 mx-2 text-xs select-none">/</span>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href={URLs.discord}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.DiscordIcon className="size-4" />
            </Link>
            <Link
              href={URLs.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter/X"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.XIcon className="size-3.5" />
            </Link>
            <Link
              href={URLs.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.LinkedInIcon className="size-3.5" />
            </Link>
            <Link
              href={URLs.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Github className="size-4" />
            </Link>
            <span className="text-foreground/10 select-none">·</span>
            <span className="text-foreground/45 dark:text-foreground/30 font-mono text-xs">
              © {new Date().getFullYear()} PayKit
            </span>
          </div>
        </div>
      </SectionContent>
    </Section>
  );
}
