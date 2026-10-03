import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted in a container; see docs/architecture.md.
  output: "standalone",

  /**
   * Capture happens on a phone, which reaches `next dev` over the LAN rather
   * than on localhost. Next 16 blocks cross-origin requests to dev resources
   * by default, and the failure is silent in the worst possible way: the HTML
   * renders, the page looks fine, and the client bundle never runs — so a
   * <label> file input still opens the camera and nothing happens afterwards.
   *
   * Wildcards match per dot-separated segment, so these cover a DHCP lease
   * moving. Both ranges are entirely private; 172.16/12 is left out because
   * `172.*.*.*` would also allow public addresses. Development only.
   *
   * ootd.hvenry.com is the homelab's dev server behind Caddy, which is how
   * the phone reaches it over Tailscale while the app is being iterated on.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local", "ootd.hvenry.com"],
};

export default nextConfig;
