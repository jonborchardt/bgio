import { Client } from 'boardgame.io/react';
import { CardSweep } from './game.ts';
import { CardSweepBoard } from './Board.tsx';

const App = Client({
  game: CardSweep,
  board: CardSweepBoard,
  numPlayers: 2,
  debug: false,
});

export default App;
