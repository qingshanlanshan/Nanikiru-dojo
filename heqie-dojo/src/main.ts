import './style.css';
import { mountApp } from './ui/app';
import { preloadTiles } from './ui/dom';
import { initInstall } from './ui/install';

preloadTiles();
initInstall();
mountApp(document.getElementById('app')!);
