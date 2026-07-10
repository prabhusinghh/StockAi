"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format large numbers into human-readable strings (1.2T, 340B, 12.5M). */
function formatMarketCap(value) {
  if (value == null) return null;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
}

/** Get the Clearbit logo URL for a company. Falls back to a generated icon. */
function getLogoUrl(companyName) {
  // Map well-known company names to their domains for Clearbit
  const domainMap = {
    apple: "apple.com",
    microsoft: "microsoft.com",
    google: "google.com",
    alphabet: "abc.xyz",
    amazon: "amazon.com",
    tesla: "tesla.com",
    nvidia: "nvidia.com",
    meta: "meta.com",
    netflix: "netflix.com",
    infosys: "infosys.com",
    reliance: "ril.com",
    tcs: "tcs.com",
    wipro: "wipro.com",
    hcl: "hcltech.com",
    "bharti airtel": "airtel.in",
    hdfc: "hdfcbank.com",
    icici: "icicibank.com",
    sbi: "sbi.co.in",
    adobe: "adobe.com",
    salesforce: "salesforce.com",
    oracle: "oracle.com",
    ibm: "ibm.com",
    intel: "intel.com",
    amd: "amd.com",
    spotify: "spotify.com",
    uber: "uber.com",
    airbnb: "airbnb.com",
    shopify: "shopify.com",
    paypal: "paypal.com",
    square: "squareup.com",
    stripe: "stripe.com",
    snap: "snap.com",
    twitter: "twitter.com",
    pinterest: "pinterest.com",
    zoom: "zoom.us",
    slack: "slack.com",
    dropbox: "dropbox.com",
    coinbase: "coinbase.com",
    robinhood: "robinhood.com",
  };

  const key = companyName.toLowerCase().trim();
  // Check direct match
  if (domainMap[key]) {
    return `https://logo.clearbit.com/${domainMap[key]}`;
  }
  // Check if any key is contained in the company name
  for (const [name, domain] of Object.entries(domainMap)) {
    if (key.includes(name)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }
  // Fallback: try company name as a domain
  const slug = key.replace(/[^a-z0-9]/g, "");
  return `https://logo.clearbit.com/${slug}.com`;
}

/** Generate initials for fallback avatar. */
function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CompanyHeader({ companyName, ticker, quoteData }) {
  const [imgError, setImgError] = useState(false);

  if (!companyName || !ticker) return null;

  const logoUrl = getLogoUrl(companyName);
  const initials = getInitials(companyName);

  const price = quoteData?.price;
  const change = quoteData?.change;
  const changePct = quoteData?.changePercent;
  const currency = quoteData?.currency ?? "USD";
  const marketCap = quoteData?.marketCap;
  const exchange = quoteData?.exchange;

  const isPositive = change != null && change >= 0;
  const isNegative = change != null && change < 0;

  return (
    <div className="company-header" id="company-header">
      {/* Logo */}
      <div className="company-header__logo-wrap">
        {!imgError ? (
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            className="company-header__logo"
            onError={() => setImgError(true)}
            width={48}
            height={48}
          />
        ) : (
          <div className="company-header__logo-fallback" aria-hidden="true">
            {initials}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="company-header__info">
        <div className="company-header__name-row">
          <h2 className="company-header__name">{companyName}</h2>
          <span className="company-header__ticker">{ticker}</span>
          {exchange && (
            <span className="company-header__exchange">{exchange}</span>
          )}
        </div>

        {/* Price + change */}
        <div className="company-header__price-row">
          {price != null && (
            <span className="company-header__price">
              {currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$"}
              {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}

          {change != null && (
            <span
              className={`company-header__change ${isPositive ? "company-header__change--up" : "company-header__change--down"}`}
            >
              <span className="company-header__change-arrow">
                {isPositive ? "▲" : "▼"}
              </span>
              {Math.abs(change).toFixed(2)}
              {changePct != null && (
                <span className="company-header__change-pct">
                  ({Math.abs(changePct).toFixed(2)}%)
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Quick stats */}
      {marketCap && (
        <div className="company-header__stats">
          <div className="company-header__stat">
            <span className="company-header__stat-label">Market Cap</span>
            <span className="company-header__stat-value">
              {currency === "INR" ? "₹" : "$"}{formatMarketCap(marketCap)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
