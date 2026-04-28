import { Client } from 'boardgame.io/react';
import { Settlement } from './game/index.ts';
import { SettlementBoard } from './Board.tsx';

const App = Client({
  game: Settlement,
  board: SettlementBoard,
  numPlayers: 4,
  debug: false,
});

export default App;
