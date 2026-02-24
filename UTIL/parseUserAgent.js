// UTIL/parseUserAgent.js

export const parseUserAgent = (ua = "") => {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Desktop", isMobile: false };

  // ── Browser detection (order matters — Edge before Chrome)
  let browser = "Other";
  if      (/Edg\//i.test(ua))     browser = "Edge";
  else if (/OPR\//i.test(ua))     browser = "Opera";
  else if (/Chrome\//i.test(ua))  browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua))  browser = "Safari";
  else if (/MSIE|Trident/i.test(ua)) browser = "IE";

  // ── OS detection
  let os = "Other";
  if      (/Windows/i.test(ua))  os = "Windows";
  else if (/Android/i.test(ua))  os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua))    os = "Linux";

  // ── Device detection
  let device   = "Desktop";
  let isMobile = false;
  if (/iPad/i.test(ua)) {
    device   = "Tablet";
    isMobile = true;
  } else if (/Mobile|Android|iPhone/i.test(ua)) {
    device   = "Mobile";
    isMobile = true;
  }

  return { browser, os, device, isMobile };
};
