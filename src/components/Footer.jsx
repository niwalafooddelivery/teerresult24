import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-columns">
          {/* Column 1 - About TeerResult2 */}
          <div className="footer-column">
            <h3 className="footer-brand-title">TeerResult2</h3>
            <p className="footer-desc">
              TeerResult2 is an independent informational and archival website providing accurate, daily traditional archery results from authorized grounds across Meghalaya and Assam.
            </p>
            <div className="footer-disclaimer-box">
              Disclaimer: Strictly for informational and educational reference. Strictly for individuals aged 18 and above. We are not affiliated with any commercial betting operations.
            </div>
          </div>

          {/* Column 2 - Daily Teer Results */}
          <div className="footer-column">
            <h4 className="footer-col-title">Daily Teer Results</h4>
            <ul className="footer-link-list">
              <li><Link href="/shillong-teer-result/">Shillong Teer Result</Link></li>
              <li><Link href="/khanapara-teer-result/">Khanapara Teer Result</Link></li>
              <li><Link href="/juwai-teer-result/">Juwai Teer Result</Link></li>
              <li><Link href="/shillong-night-teer/">Shillong Night Teer</Link></li>
            </ul>
          </div>

          {/* Column 3 - Important Links */}
          <div className="footer-column">
            <h4 className="footer-col-title">Important Links</h4>
            <ul className="footer-link-list">
              <li><Link href="/">Home</Link></li>
              <li><Link href="/teer-dream-numbers/">Dream Numbers</Link></li>
              <li><Link href="/previous-results/">Previous Results</Link></li>
              <li><Link href="/teer-result-history/">Teer Result History</Link></li>
              <li><Link href="/what-is-teer/">What Is Teer?</Link></li>
              <li><Link href="/about-us/">About Us</Link></li>
            </ul>
          </div>

          {/* Column 4 - Contact & Policies */}
          <div className="footer-column">
            <h4 className="footer-col-title">Contact &amp; Policies</h4>
            <ul className="footer-link-list">
              <li><Link href="/contact/">Contact Us</Link></li>
              <li><Link href="/privacy-policy/">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions/">Terms and Conditions</Link></li>
              <li><Link href="/result-verification/">Result Verification Policy</Link></li>
              <li><Link href="/correction-policy/">Correction Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom / Copyright */}
        <div className="footer-bottom-row" style={{ borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>
          <p>&copy; {currentYear} TeerResult2. All rights reserved. Fast, verified, and transparent daily archery results.</p>
          <p>Indian Standard Time (IST / UTC+05:30)</p>
        </div>
      </div>
    </footer>
  );
}
