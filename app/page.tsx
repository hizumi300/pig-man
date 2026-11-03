import { getChatGPTUser } from './chatgpt-auth';
import GameClient from './game-client';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return <GameClient signedIn={!!user} />;
}
