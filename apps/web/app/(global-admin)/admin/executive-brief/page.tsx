'use client'
export const dynamic = 'force-dynamic'

import React from 'react'
import {
  Shield, Lock, Eye, FileCheck, Globe, Server,
  Brain, Heart, BarChart3, Users, BookOpen, Award,
  Printer, CheckCircle, TrendingUp, Zap, Webhook,
  ShieldCheck, KeyRound, ScrollText, CloudCog,
  Building2, HeartHandshake, Gauge, ArrowRight,
  AlertTriangle, Clock, FileText, Layers
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════
   Executive Summary & Security Brief
   Target audience: Fortune 500 CHROs and CISOs
   Print-optimized, professional layout
═══════════════════════════════════════════════════════════════════ */

function SecurityBadge({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="eb-security-item">
      <div className="eb-security-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="eb-security-title">{title}</p>
        <p className="eb-security-desc">{description}</p>
      </div>
    </div>
  )
}

function StatHighlight({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <div className="eb-stat">
      <span className="eb-stat-value">{value}</span>
      <span className="eb-stat-label">{label}</span>
    </div>
  )
}

export default function ExecutiveBriefPage() {
  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════════
           EXECUTIVE BRIEF — SCREEN STYLES
        ═══════════════════════════════════════════════════════════ */

        .eb-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 2.5rem 3rem;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: var(--text-primary);
          line-height: 1.6;
        }

        .eb-print-bar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1.5rem;
        }

        .eb-print-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          border-radius: 10px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--gradient-brand);
          color: #fff;
          border: none;
          box-shadow: 0 4px 16px var(--accent-glow);
          letter-spacing: -0.01em;
        }

        .eb-print-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px var(--accent-glow);
        }

        /* ── Header ────────────────────────────────────────────── */

        .eb-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 2px solid var(--border-subtle);
          margin-bottom: 2rem;
        }

        .eb-logo {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .eb-header-text h1 {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.2;
          margin: 0;
        }

        .eb-header-text p {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin: 0.25rem 0 0;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* ── Section styling ───────────────────────────────────── */

        .eb-section {
          margin-bottom: 2rem;
        }

        .eb-section-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 1rem;
        }

        .eb-section-header h2 {
          font-size: 1.0625rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .eb-section-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .eb-section-body {
          padding: 1.25rem 1.5rem;
          border-radius: 14px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
        }

        .eb-section-body p,
        .eb-section-body li {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        .eb-section-body ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .eb-section-body li {
          padding: 0.375rem 0;
          padding-left: 1.5rem;
          position: relative;
        }

        .eb-section-body li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.75rem;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-1);
        }

        .eb-highlight {
          font-weight: 700;
          color: var(--text-primary);
        }

        /* ── Problem stats row ─────────────────────────────────── */

        .eb-problem-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .eb-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 1rem 0.5rem;
          border-radius: 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
        }

        .eb-stat-value {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.375rem;
        }

        .eb-stat-label {
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.3;
          font-weight: 500;
        }

        /* ── Solution grid ─────────────────────────────────────── */

        .eb-solution-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .eb-solution-card {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
        }

        .eb-solution-card-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.625rem;
        }

        .eb-solution-card h4 {
          font-size: 0.75rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
          color: var(--text-primary);
        }

        .eb-solution-card p {
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0;
        }

        /* ── Security grid — the most important section ────────── */

        .eb-security-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .eb-security-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-elevated);
        }

        .eb-security-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(52, 211, 153, 0.12);
          color: var(--success);
        }

        .eb-security-title {
          font-size: 0.75rem;
          font-weight: 700;
          margin: 0 0 0.125rem;
          color: var(--text-primary);
        }

        .eb-security-desc {
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
        }

        .eb-security-banner {
          margin-top: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(52, 211, 153, 0.3);
          background: rgba(52, 211, 153, 0.06);
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .eb-security-banner p {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--success);
          margin: 0;
        }

        /* ── ROI list ──────────────────────────────────────────── */

        .eb-roi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .eb-roi-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.625rem 0.875rem;
          border-radius: 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .eb-roi-icon {
          color: var(--accent-1);
          flex-shrink: 0;
        }

        /* ── Capabilities ──────────────────────────────────────── */

        .eb-cap-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .eb-cap-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.875rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .eb-cap-icon {
          color: var(--accent-2);
          flex-shrink: 0;
        }

        /* ── Footer ────────────────────────────────────────────── */

        .eb-footer {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 2px solid var(--border-subtle);
          text-align: center;
        }

        .eb-footer-contacts {
          display: flex;
          justify-content: center;
          gap: 2.5rem;
          margin-bottom: 0.875rem;
        }

        .eb-footer-contact {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .eb-footer-contact strong {
          font-weight: 600;
          color: var(--text-primary);
        }

        .eb-footer-contact a {
          color: var(--accent-1);
          text-decoration: none;
          font-weight: 600;
        }

        .eb-footer-powered {
          font-size: 0.6875rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        .eb-confidential {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.75rem;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          font-size: 0.625rem;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ═══════════════════════════════════════════════════════════
           PRINT STYLES — Clean, black-on-white PDF export
        ═══════════════════════════════════════════════════════════ */

        @media print {
          /* Reset page */
          @page {
            size: letter;
            margin: 0.6in 0.65in;
          }

          /* Hide app chrome */
          body {
            background: #fff !important;
            color: #1a1a1a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hide sidebar, footer, Jesse widget, and nav */
          aside,
          footer,
          [class*="JesseAI"],
          [class*="jesse"],
          nav {
            display: none !important;
          }

          /* Page fills viewport */
          main {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          .eb-print-bar {
            display: none !important;
          }

          .eb-page {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Override theme colors for print */
          .eb-header {
            border-bottom-color: #d4d4d4 !important;
          }

          .eb-header-text h1 {
            color: #0f172a !important;
          }

          .eb-header-text p {
            color: #64748b !important;
          }

          .eb-section-header h2 {
            color: #0f172a !important;
          }

          .eb-section-body {
            background: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }

          .eb-section-body p,
          .eb-section-body li {
            color: #334155 !important;
          }

          .eb-highlight {
            color: #0f172a !important;
          }

          .eb-section-body li::before {
            background: #3b82f6 !important;
          }

          .eb-stat {
            background: #f1f5f9 !important;
            border-color: #e2e8f0 !important;
          }

          .eb-stat-value {
            background: none !important;
            -webkit-text-fill-color: #1e40af !important;
            color: #1e40af !important;
          }

          .eb-stat-label {
            color: #64748b !important;
          }

          .eb-solution-card,
          .eb-security-item,
          .eb-roi-item {
            background: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }

          .eb-solution-card h4,
          .eb-security-title {
            color: #0f172a !important;
          }

          .eb-solution-card p,
          .eb-security-desc,
          .eb-roi-item,
          .eb-cap-item {
            color: #475569 !important;
          }

          .eb-security-icon {
            background: #ecfdf5 !important;
            color: #059669 !important;
          }

          .eb-security-banner {
            background: #ecfdf5 !important;
            border-color: #a7f3d0 !important;
          }

          .eb-security-banner p {
            color: #047857 !important;
          }

          .eb-footer {
            border-top-color: #d4d4d4 !important;
          }

          .eb-footer-contact {
            color: #475569 !important;
          }

          .eb-footer-contact strong {
            color: #0f172a !important;
          }

          .eb-footer-contact a {
            color: #2563eb !important;
          }

          .eb-footer-powered {
            color: #94a3b8 !important;
          }

          .eb-confidential {
            background: #f1f5f9 !important;
            border-color: #e2e8f0 !important;
            color: #64748b !important;
          }

          /* Prevent breaks inside sections */
          .eb-section {
            break-inside: avoid;
          }

          .eb-section-body {
            break-inside: avoid;
          }

          /* Section icons: print-safe colors */
          .eb-section-icon {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="eb-page">
        {/* Print button — hidden in print */}
        <div className="eb-print-bar">
          <button
            className="eb-print-btn"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="eb-header">
          <img
            src="/jesse/logo.png"
            alt="Endevo Life"
            className="eb-logo"
          />
          <div className="eb-header-text">
            <h1>Endevo Life &mdash; Enterprise Legacy Readiness Platform</h1>
            <p>Executive Summary &amp; Security Brief</p>
          </div>
        </header>

        {/* ── Section 1: The Problem ─────────────────────────── */}
        <section className="eb-section">
          <div className="eb-section-header">
            <div
              className="eb-section-icon"
              style={{ background: 'rgba(248, 113, 113, 0.12)', color: 'var(--danger)' }}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2>The Problem</h2>
          </div>

          <div className="eb-problem-stats">
            <StatHighlight value="60%" label="of Americans have no estate plan" />
            <StatHighlight value="500+" label="HR hours spent per employee death" />
            <StatHighlight value="12-18%" label="productivity loss from end-of-life stress" />
            <StatHighlight value="$0" label="current HR budget for legacy readiness" />
          </div>

          <div className="eb-section-body">
            <ul>
              <li>
                HR departments bear the <span className="eb-highlight">full administrative burden</span> when
                employees pass away unexpectedly &mdash; benefits transitions, payroll termination, family
                communications, and compliance documentation.
              </li>
              <li>
                Employees dealing with unresolved estate planning experience measurable
                stress that directly impacts <span className="eb-highlight">workplace performance and retention</span>.
              </li>
              <li>
                No enterprise-grade platform exists today that addresses legacy readiness as a
                structured, measurable <span className="eb-highlight">employee wellness benefit</span>.
              </li>
            </ul>
          </div>
        </section>

        {/* ── Section 2: The Solution ────────────────────────── */}
        <section className="eb-section">
          <div className="eb-section-header">
            <div
              className="eb-section-icon"
              style={{ background: 'rgba(94, 106, 210, 0.12)', color: 'var(--accent-1)' }}
            >
              <Brain className="w-4 h-4" />
            </div>
            <h2>The Solution</h2>
          </div>

          <div className="eb-solution-grid">
            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(94, 106, 210, 0.12)', color: 'var(--accent-1)' }}
              >
                <BookOpen className="w-4 h-4" />
              </div>
              <h4>AI-Powered LMS</h4>
              <p>6 guided modules covering Legal, Financial, Physical, and Digital readiness &mdash; personalized to each employee.</p>
            </div>

            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(139, 92, 246, 0.12)', color: 'var(--accent-2)' }}
              >
                <HeartHandshake className="w-4 h-4" />
              </div>
              <h4>Jesse AI Copilot</h4>
              <p>Empathetic, role-aware AI assistant guiding employees through sensitive topics with compassion and clarity.</p>
            </div>

            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(52, 211, 153, 0.12)', color: 'var(--success)' }}
              >
                <Gauge className="w-4 h-4" />
              </div>
              <h4>Readiness Assessment</h4>
              <p>40-question diagnostic across 4 domains, producing a measurable readiness score per employee and company-wide.</p>
            </div>

            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(251, 191, 36, 0.12)', color: 'var(--gold)' }}
              >
                <Award className="w-4 h-4" />
              </div>
              <h4>Certificate of Completion</h4>
              <p>Verifiable certificate for HR records, demonstrating employee participation and module completion.</p>
            </div>

            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(244, 114, 182, 0.12)', color: '#f472b6' }}
              >
                <Users className="w-4 h-4" />
              </div>
              <h4>1:1 Coaching Sessions</h4>
              <p>Basic plan: 2 sessions/year. Premium plan: 6 sessions/year. Professional guidance for complex situations.</p>
            </div>

            <div className="eb-solution-card">
              <div
                className="eb-solution-card-icon"
                style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}
              >
                <Heart className="w-4 h-4" />
              </div>
              <h4>Compassion Mode</h4>
              <p>Automatic calming UI for bereaved delegates. Sensitivity-first design for the most difficult moments.</p>
            </div>
          </div>
        </section>

        {/* ── Section 3: Zero-Knowledge Security ─────────────── */}
        <section className="eb-section">
          <div className="eb-section-header">
            <div
              className="eb-section-icon"
              style={{ background: 'rgba(52, 211, 153, 0.12)', color: 'var(--success)' }}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2>Zero-Knowledge Security Architecture</h2>
          </div>

          <div className="eb-security-grid">
            <SecurityBadge
              icon={KeyRound}
              title="AWS KMS Envelope Encryption"
              description="Endevo cannot read your employees' data. Customer-managed keys ensure only authorized parties decrypt sensitive records."
            />
            <SecurityBadge
              icon={Lock}
              title="WorkOS SSO / SAML Federation"
              description="Enterprise identity federation with your existing IdP. Zero additional credentials for employees to manage."
            />
            <SecurityBadge
              icon={ScrollText}
              title="CloudTrail Audit Logging"
              description="Every platform action is logged immutably. Full audit trail exportable for compliance reviews at any time."
            />
            <SecurityBadge
              icon={Shield}
              title="WAFv2 DDoS & Injection Protection"
              description="AWS WAFv2 shields all endpoints from DDoS, SQL injection, XSS, and automated threats in real time."
            />
            <SecurityBadge
              icon={FileCheck}
              title="SOC 2 Type II Preparation"
              description="Active audit preparation in progress. Architecture designed from day one to meet SOC 2 Trust Service Criteria."
            />
            <SecurityBadge
              icon={Globe}
              title="US-Only Data Residency (us-east-1)"
              description="All data stored exclusively in US-based AWS regions. No cross-border data transfers. No third-party data sharing. Period."
            />
          </div>

          <div className="eb-security-banner">
            <ShieldCheck className="w-4 h-4" style={{ flexShrink: 0 }} />
            <p>Zero third-party data sharing. Zero data brokering. Your employees&apos; most sensitive information stays encrypted, in your control, always.</p>
          </div>
        </section>

        {/* ── Section 4: ROI for HR ──────────────────────────── */}
        <section className="eb-section">
          <div className="eb-section-header">
            <div
              className="eb-section-icon"
              style={{ background: 'rgba(251, 191, 36, 0.12)', color: 'var(--gold)' }}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2>ROI for HR</h2>
          </div>

          <div className="eb-roi-grid">
            <div className="eb-roi-item">
              <BarChart3 className="w-4 h-4 eb-roi-icon" />
              Measurable &ldquo;Peace of Mind Score&rdquo; per employee and company-wide
            </div>
            <div className="eb-roi-item">
              <Clock className="w-4 h-4 eb-roi-icon" />
              Projected 40% reduction in HR administrative burden
            </div>
            <div className="eb-roi-item">
              <Heart className="w-4 h-4 eb-roi-icon" />
              Employee wellness benefit that measurably improves retention
            </div>
            <div className="eb-roi-item">
              <Users className="w-4 h-4 eb-roi-icon" />
              Anonymized workforce readiness benchmarks across departments
            </div>
            <div className="eb-roi-item">
              <FileText className="w-4 h-4 eb-roi-icon" />
              Compliance-ready audit exports for regulatory requirements
            </div>
            <div className="eb-roi-item">
              <TrendingUp className="w-4 h-4 eb-roi-icon" />
              12-18% productivity recovery from reduced end-of-life stress
            </div>
          </div>
        </section>

        {/* ── Section 5: Platform Capabilities ───────────────── */}
        <section className="eb-section">
          <div className="eb-section-header">
            <div
              className="eb-section-icon"
              style={{ background: 'rgba(139, 92, 246, 0.12)', color: 'var(--accent-2)' }}
            >
              <Layers className="w-4 h-4" />
            </div>
            <h2>Platform Capabilities</h2>
          </div>

          <div className="eb-section-body">
            <div className="eb-cap-grid">
              <div className="eb-cap-item">
                <Building2 className="w-4 h-4 eb-cap-icon" />
                Multi-tenant architecture (B2B + B2C)
              </div>
              <div className="eb-cap-item">
                <Users className="w-4 h-4 eb-cap-icon" />
                Role-based dashboards (Super Admin, HR Admin, Employee)
              </div>
              <div className="eb-cap-item">
                <Zap className="w-4 h-4 eb-cap-icon" />
                EventBridge real-time platform events
              </div>
              <div className="eb-cap-item">
                <Webhook className="w-4 h-4 eb-cap-icon" />
                Webhook integrations (HRIS, CRM, rewards platforms)
              </div>
              <div className="eb-cap-item">
                <CloudCog className="w-4 h-4 eb-cap-icon" />
                API-first architecture with developer portal
              </div>
              <div className="eb-cap-item">
                <Server className="w-4 h-4 eb-cap-icon" />
                AWS serverless — auto-scaling, zero infrastructure management
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="eb-footer">
          <div className="eb-footer-contacts">
            <div className="eb-footer-contact">
              <strong>Schedule a Demo</strong>
              <br />
              <a href="mailto:niki@finalplaybook.com">niki@finalplaybook.com</a>
            </div>
            <div className="eb-footer-contact">
              <strong>Security Questions</strong>
              <br />
              <a href="mailto:trust@endevo.life">trust@endevo.life</a>
            </div>
          </div>
          <p className="eb-footer-powered">
            Powered by AWS Serverless &bull; Anthropic Claude AI &bull; WorkOS
          </p>
          <div className="eb-confidential">
            <Eye className="w-3 h-3" />
            Confidential — For Authorized Recipients Only
          </div>
        </footer>
      </div>
    </>
  )
}
