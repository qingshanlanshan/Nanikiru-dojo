import './style.css';
import { mountApp } from './ui/app';
import { preloadTiles } from './ui/dom';

preloadTiles();
mountApp(document.getElementById('app')!);
