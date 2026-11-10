/**
 * Entry point of the app. Vite loads this file from index.html.
 */
import './styles.css';
import { renderLayout } from './ui/layout';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Element #app not found in index.html');
}
renderLayout(root);
