import './style.css';
import { preloadTiles } from './ui/dom';
import { mountTrainer } from './ui/trainer';

preloadTiles();
mountTrainer(document.getElementById('app')!);
