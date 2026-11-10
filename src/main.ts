/**
 * Entry point of the app. Vite loads this file from index.html.
 */
import './styles.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Element #app not found in index.html');
}
new App(root);
