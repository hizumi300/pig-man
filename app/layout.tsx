import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '豚小屋探検隊 | 扉の向こうに、仲間か、罠か。',
  description: '仲間を信じて、子豚を救え。3〜10人で遊ぶ正体隠匿カードゲーム。ChatGPTでログインして探検をはじめよう。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ja"><body>{children}</body></html>;
}
