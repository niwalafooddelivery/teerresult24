import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Teer Result Today - Shillong, Khanapara & Juwai Live | TeerResult2',
  description:
    'Get fastest live Teer Result for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer. Real-time verified updates on TeerResult2.',
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
  authors: [{ name: 'TeerResult2 Team' }],
  metadataBase: new URL('https://teerresult2.com'),
  openGraph: {
    title: 'Teer Result Today - Shillong, Khanapara & Juwai Teer Live | TeerResult2',
    description:
      'Fast, verified Teer Result live updates, educational history, and searchable past result archive on TeerResult2.',
    url: 'https://teerresult2.com',
    siteName: 'TeerResult2',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teer Result Today - Live Updates | TeerResult2',
    description: 'Fastest verified Teer Result, Shillong Teer and Khanapara Teer outcomes.',
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
