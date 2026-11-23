import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Teer Result Today - Shillong, Khanapara & Juwai Live | TeerResult',
  description:
    'Get fastest live Teer Result for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer. Real-time verified updates on TeerResult.',
  keywords: [
    'Teer Result',
    'Shillong Teer Result',
    'Khanapara Teer Result',
    'Juwai Teer Result',
    'Shillong Night Teer',
    'Teer Result Today',
    'Teer Dream Numbers',
    'Previous Teer Results',
  ],
  authors: [{ name: 'TeerResult Team' }],
  metadataBase: new URL('https://teerresult24.com'),
  openGraph: {
    title: 'Teer Result Today - Shillong, Khanapara & Juwai Teer Live | TeerResult',
    description:
      'Fast, verified Teer Result live updates, educational history, and searchable past result archive on TeerResult.',
    url: 'https://teerresult24.com',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teer Result Today - Live Updates | TeerResult',
    description: 'Fastest verified Teer Result, Shillong Teer and Khanapara Teer outcomes.',
  },
  
  verification: {
    other: {
      "msvalidate.01": "736F0433B47562A1EFBB566763DF23CF",
    },
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#059669" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
